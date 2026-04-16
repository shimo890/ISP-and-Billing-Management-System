"""
Server-side PDF generation for invoices.
Generates Service Name Invoice PDF (column shows service_name, e.g. IT Service).
"""
import io
from decimal import Decimal
from datetime import datetime

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

from .serializers import InvoiceMasterSerializer


def _format_date(d):
    """Format date as 'DD MMM YYYY'."""
    if not d:
        return ''
    if isinstance(d, str):
        try:
            d = datetime.strptime(d[:10], '%Y-%m-%d').date()
        except (ValueError, TypeError):
            return str(d)
    months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
    return f"{d.day:02d} {months[d.month - 1]} {d.year}"


def _format_number(num):
    """Indian numbering: 1,00,000 style."""
    if num is None:
        return ''
    s = str(num)
    if '.' in s:
        int_part, dec_part = s.split('.')
    else:
        int_part, dec_part = s, ''
    n = len(int_part)
    if n <= 3:
        formatted = int_part
    else:
        formatted = int_part[-3:]
        rest = int_part[:-3]
        while rest:
            formatted = (rest[-2:] if len(rest) >= 2 else rest) + ',' + formatted
            rest = rest[:-2] if len(rest) >= 2 else ''
    return f"{formatted}.{dec_part}" if dec_part else formatted


def _number_to_words(num):
    """Convert number to words (taka/paise). Indian style."""
    ones = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine']
    teens = ['ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen']
    tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']

    def convert_hundreds(n):
        if n == 0:
            return ''
        out = ''
        if n >= 100:
            out += ones[n // 100] + ' hundred '
            n %= 100
        if n >= 20:
            out += tens[n // 10]
            if n % 10:
                out += '-' + ones[n % 10]
            out += ' '
            return out
        if n >= 10:
            out += teens[n - 10] + ' '
        elif n > 0:
            out += ones[n] + ' '
        return out

    def convert_int(n):
        if n == 0:
            return 'zero'
        out = ''
        if n >= 10_000_000:
            out += convert_hundreds(n // 10_000_000) + ' crore '
            n %= 10_000_000
        if n >= 100_000:
            out += convert_hundreds(n // 100_000) + ' lac '
            n %= 100_000
        if n >= 1000:
            out += convert_hundreds(n // 1000) + ' thousand '
            n %= 1000
        if n > 0:
            out += convert_hundreds(n)
        return out.strip()

    def cap_each(s):
        return ' '.join(w.capitalize() for w in s.split())

    parts = str(num).split('.')
    result = convert_int(int(parts[0])) + ' taka'
    if len(parts) > 1 and int(parts[1].ljust(2, '0')[:2]):
        paise = int(parts[1].ljust(2, '0')[:2])
        result += ' and ' + convert_hundreds(paise).strip() + ' paise'
    return cap_each(result)


def _calc_days(start, end):
    """Days between dates (inclusive)."""
    if not start or not end:
        return 0
    s = datetime.strptime(str(start)[:10], '%Y-%m-%d').date()
    e = datetime.strptime(str(end)[:10], '%Y-%m-%d').date()
    return max(0, (e - s).days + 1)


def _get_service_name(detail):
    """Service column: use PackageMaster.service_name only (no package_name fallback)."""
    v = detail.get('entitlement_service_name') or detail.get('service_name')
    if v is not None and str(v).strip():
        return str(v).strip()
    return '–'


def generate_service_name_invoice_pdf(invoice) -> bytes:
    """
    Generate Service Name Invoice PDF for the given InvoiceMaster instance.
    Returns raw PDF bytes.
    """
    serializer = InvoiceMasterSerializer(invoice)
    data = serializer.data

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=10 * mm,
        rightMargin=10 * mm,
        topMargin=8 * mm,
        bottomMargin=10 * mm,
    )
    elements = []
    styles = getSampleStyleSheet()

    # Title
    elements.append(Paragraph('INVOICE', ParagraphStyle('title', parent=styles['Heading1'], fontSize=18, alignment=1)))
    elements.append(Spacer(1, 4 * mm))

    # Company info
    elements.append(Paragraph('Kloud Technologies Limited', styles['Normal']))
    elements.append(Paragraph('House # 13, Road # 7, Block # F, Banani, Dhaka-1213', styles['Normal']))
    elements.append(Paragraph('Phone: 01313 75 25 77, Email: accounts@kloud.com.bd', styles['Normal']))
    elements.append(Spacer(1, 6 * mm))

    cust = data.get('entitlement_details', {}) or {}
    if isinstance(cust, dict):
        cust = cust.get('customer_master', {}) or cust
    cust_name = cust.get('customer_name', '') or data.get('customer_name', '')
    company = cust.get('company_name', '') if isinstance(cust, dict) else ''
    phone = cust.get('phone', '') if isinstance(cust, dict) else ''
    address = cust.get('address', '') if isinstance(cust, dict) else ''
    email = cust.get('email', '') if isinstance(cust, dict) else ''

    customer_id = data.get('customer_id', '')
    issue_date = _format_date(data.get('issue_date'))
    inv_num = data.get('invoice_number', '') or f"INV-{data.get('id')}"
    total_due = data.get('customer_total_due') or data.get('total_balance_due') or 0

    details = data.get('details', []) or []
    start_dates = [d.get('start_date') for d in details if d.get('start_date')]
    end_dates = [d.get('end_date') for d in details if d.get('end_date')]
    inv_for_start = _format_date(min(start_dates)) if start_dates else _format_date(data.get('activation_date'))
    inv_for_end = _format_date(max(end_dates)) if end_dates else issue_date

    # Two-column info
    info_data = [
        [
            Paragraph(f'<b>Customer ID:</b> {customer_id}', styles['Normal']),
            Paragraph(f'<b>Issue Date:</b> {issue_date}', styles['Normal']),
        ],
        [
            Paragraph(f'<b>Name:</b> {cust_name}', styles['Normal']),
            Paragraph(f'<b>Invoice For:</b> {inv_for_start} - {inv_for_end}', styles['Normal']),
        ],
        [
            Paragraph(f'<b>Company:</b> {company}', styles['Normal']),
            Paragraph(f'<b>Invoice No:</b> {inv_num}', styles['Normal']),
        ],
    ]
    if phone:
        info_data.append([Paragraph(f'<b>Phone:</b> {phone}', styles['Normal']), ''])
    if address:
        info_data.append([Paragraph(f'<b>Address:</b> {address}', styles['Normal']), ''])
    info_table = Table(info_data, colWidths=[90 * mm, 90 * mm])
    info_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    elements.append(info_table)
    elements.append(Paragraph(f'<b>Total Due:</b> {_format_number(total_due)} BDT', styles['Normal']))
    elements.append(Spacer(1, 6 * mm))

    # Line items - Service column
    sorted_details = sorted(details, key=lambda d: d.get('created_at', '') or '')
    subtotal = Decimal(str(data.get('total_bill', 0) or 0))
    vat_rate = float(data.get('vat_rate', 0) or 0)
    total_vat = Decimal(str(data.get('total_vat_amount', 0) or 0))
    total_discount = Decimal(str(data.get('total_discount_amount', 0) or 0))
    total_bill = Decimal(str(data.get('total_bill_amount', 0) or 0))

    discount_rate = 0
    if subtotal and total_discount:
        discount_rate = round(float(total_discount / subtotal * 100), 2)

    table_data = [['SL No.', 'Start Date', 'End Date', 'Service', 'MBPS', 'Days', 'Rate', 'Total (taka)']]
    for i, d in enumerate(sorted_details, 1):
        ln_total = d.get('line_total') or 0
        mbps = d.get('entitlement_mbps') or d.get('mbps') or ''
        table_data.append([
            str(i),
            _format_date(d.get('start_date')),
            _format_date(d.get('end_date')),
            _get_service_name(d),
            str(mbps),
            str(_calc_days(d.get('start_date'), d.get('end_date'))),
            _format_number(d.get('unit_price')),
            _format_number(ln_total),
        ])

    table_data.append([
        Paragraph('<b>Subtotal (without VAT):</b>', styles['Normal']),
        '', '', '', '', '', '',
        Paragraph(f'<b>{_format_number(float(subtotal))}</b>', styles['Normal']),
    ])
    if total_discount > 0:
        lbl = f'<b>Discount ({discount_rate}%):</b>' if discount_rate else '<b>Discount:</b>'
        table_data.append([
            Paragraph(lbl, styles['Normal']),
            '', '', '', '', '', '',
            Paragraph(f'<b>-{_format_number(float(total_discount))}</b>', styles['Normal']),
        ])
    table_data.append([
        Paragraph(f'<b>VAT ({vat_rate}%):</b>', styles['Normal']),
        '', '', '', '', '', '',
        Paragraph(f'<b>{_format_number(float(total_vat))}</b>', styles['Normal']),
    ])
    table_data.append([
        Paragraph('<b>Total (with VAT):</b>', styles['Normal']),
        '', '', '', '', '', '',
        Paragraph(f'<b>{_format_number(float(total_bill))}</b>', styles['Normal']),
    ])

    col_widths = [12, 22, 22, 55, 18, 15, 22, 28]
    t = Table(table_data, colWidths=col_widths)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f5f5f5')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.black),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('ALIGN', (3, 0), (3, -1), 'LEFT'),
        ('ALIGN', (4, 0), (4, -1), 'RIGHT'),
        ('ALIGN', (6, 0), (-1, -1), 'RIGHT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 6),
        ('TOPPADDING', (0, 0), (-1, 0), 6),
        ('BACKGROUND', (0, -4), (-1, -1), colors.white),
        ('ALIGN', (0, -4), (6, -1), 'RIGHT'),
        ('FONTNAME', (0, -4), (-1, -1), 'Helvetica-Bold'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.black),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    elements.append(t)
    elements.append(Spacer(1, 6 * mm))

    elements.append(Paragraph(f'<b>Total: {_format_number(float(total_bill))} BDT</b>', styles['Normal']))
    elements.append(Paragraph(f'In Word: {_number_to_words(float(total_bill))} Only', styles['Normal']))
    elements.append(Spacer(1, 4 * mm))
    elements.append(Paragraph('Thank you for being a valued part of the Kloud Technologies Ltd family.', styles['Normal']))
    elements.append(Paragraph('This is software generated invoice and does not require a signature.', ParagraphStyle(
        'centered', parent=styles['Normal'], alignment=1, fontSize=8
    )))
    elements.append(Spacer(1, 4 * mm))
    elements.append(Paragraph('<b>Bank Informations:</b>', styles['Normal']))
    elements.append(Paragraph('1. A/C Name: Kloud Technologies Limited', styles['Normal']))
    elements.append(Paragraph('A/C No: 0050-0210013920, Routing Number: 160260430, Swift Code: NCCLBDDHBAB', styles['Normal']))
    elements.append(Paragraph('National Credit and Commerce Bank PLC. (NCC), Branch Name: Banani', styles['Normal']))
    elements.append(Paragraph('Bkash Payment No: 01313 75 25 77 [Merchant Account]', styles['Normal']))

    doc.build(elements)
    return buffer.getvalue()


def get_invoice_pdf_filename(invoice) -> str:
    """Generate standard invoice PDF filename."""
    cust = invoice.customer_entitlement_master_id.customer_master_id if invoice.customer_entitlement_master_id else invoice.customer_master_id
    company = (cust.company_name or cust.customer_name or 'Invoice') if cust else 'Invoice'
    slug = ''.join(c if c.isalnum() or c in ' -' else '' for c in str(company)).replace(' ', '-').strip('-') or 'Invoice'
    inv_num = invoice.invoice_number or f'INV-{invoice.id}'
    d = invoice.issue_date or datetime.now().date()
    months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    return f"{slug}-{inv_num}-{d.day}-{months[d.month - 1]}-{d.year}.pdf"
