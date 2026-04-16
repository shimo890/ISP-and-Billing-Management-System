import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import jsPDF from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import { Download, Printer, Mail, Package, Wrench } from 'lucide-react';
import qrWebsite from '../assets/qr website.png';
import api from '../services/api';
import {
  COMPANY_LEGAL_NAME,
  COMPANY_BILLING_ADDRESS,
  COMPANY_BILLING_CONTACT,
  INVOICE_PAYMENT_FOOTER_NOTE,
} from '../constants/branding';

const InvoiceView = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const initialInvoice = location.state?.invoice;
  const [invoice, setInvoice] = useState(initialInvoice || null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const invoiceRef = useRef();
  const [emailSending, setEmailSending] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  // Invoice generation mode used for both PDF download and email.
  // package = show package name (e.g. NIX), service = show service name (e.g. IT Service)
  const [invoiceMode, setInvoiceMode] = useState('package');

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    
    const day = String(date.getDate()).padStart(2, '0');
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    
    return `${day} ${month} ${year}`;
  };

  const displayOrNA = (value) => {
    if (value === null || value === undefined) return 'N/A';
    const str = String(value).trim();
    return str ? str : 'N/A';
  };

  const formatNumber = (num) => {
    if (num === null || num === undefined || num === '') return '';
    
    const numStr = num.toString();
    const parts = numStr.split('.');
    const integerPart = parts[0];
    const decimalPart = parts[1] || '';
    
    // Indian numbering system: first comma after 3 digits, then every 2 digits
    let formatted = '';
    const len = integerPart.length;
    
    if (len <= 3) {
      formatted = integerPart;
    } else {
      // First 3 digits from right
      formatted = integerPart.slice(-3);
      let remaining = integerPart.slice(0, -3);
      
      // Then every 2 digits
      while (remaining.length > 0) {
        if (remaining.length >= 2) {
          formatted = remaining.slice(-2) + ',' + formatted;
          remaining = remaining.slice(0, -2);
        } else {
          formatted = remaining + ',' + formatted;
          remaining = '';
        }
      }
    }
    
    return decimalPart ? `${formatted}.${decimalPart}` : formatted;
  };

  const numberToWords = (num) => {
    const ones = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
    const teens = ['ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
    const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

    const convertHundreds = (n) => {
      if (n === 0) return '';
      let words = '';
      if (n >= 100) {
        words += ones[Math.floor(n / 100)] + ' hundred ';
        n %= 100;
      }
      if (n >= 20) {
        words += tens[Math.floor(n / 10)];
        if (n % 10 > 0) {
          words += '-' + ones[n % 10];
        }
        words += ' ';
        n = 0;
      }
      if (n >= 10) {
        words += teens[n - 10] + ' ';
      } else if (n > 0) {
        words += ones[n] + ' ';
      }
      return words.trim();
    };

    const convertInteger = (n) => {
      if (n === 0) return 'zero';
      let words = '';
      if (n >= 10000000) {
        const crores = Math.floor(n / 10000000);
        words += convertHundreds(crores) + ' crore ';
        n %= 10000000;
      }
      if (n >= 100000) {
        const lakhs = Math.floor(n / 100000);
        words += convertHundreds(lakhs) + ' lac ';
        n %= 100000;
      }
      if (n >= 1000) {
        const thousands = Math.floor(n / 1000);
        words += convertHundreds(thousands) + ' thousand ';
        n %= 1000;
      }
      if (n > 0) {
        words += convertHundreds(n);
      }
      return words.trim();
    };

    const capitalizeEachWord = (str) => {
      if (!str) return str;
      return str
        .split(' ')
        .map(word => {
          // Handle hyphenated words like "twenty-four"
          if (word.includes('-')) {
            return word
              .split('-')
              .map(w => w.charAt(0).toUpperCase() + w.slice(1))
              .join('-');
          }
          return word.charAt(0).toUpperCase() + word.slice(1);
        })
        .join(' ');
    };

    const parts = num.toString().split('.');
    let result = convertInteger(parseInt(parts[0])) + ' taka';
    if (parts[1] && parseInt(parts[1]) > 0) {
      const decimalPart = parts[1].padEnd(2, '0').substring(0, 2);
      const paise = parseInt(decimalPart);
      if (paise > 0) {
        result += ' and ' + convertHundreds(paise) + ' paise';
      }
    }
    return capitalizeEachWord(result.trim());
  };

  useEffect(() => {
    const fetchInvoiceDetails = async () => {
      if (!initialInvoice?.id) return;
      // Always fetch from API so total_balance_due matches ledger (both use fresh DB data).
      // Skipping fetch when hasFullDetails caused stale total_due after discount/payment edits.
      try {
        setLoadingDetails(true);
        const data = await api.get(`/bills/invoices/${initialInvoice.id}/`);
        setInvoice(data);
      } catch {
        setInvoice(initialInvoice);
      } finally {
        setLoadingDetails(false);
      }
    };

    fetchInvoiceDetails();
  }, [initialInvoice]);

  if (loadingDetails) {
    return (
      <div className="min-h-screen p-6 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-2xl mx-auto text-center text-gray-600 dark:text-gray-400">
          Loading invoice details...
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="min-h-screen p-6 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 text-center">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">No Invoice Data</h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6">Please select an invoice from the invoices list.</p>
            <button
              onClick={() => navigate('/invoices')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
            >
              Back to Invoices
            </button>
          </div>
        </div>
      </div>
    );
  }

  const subtotalBill = Number(invoice.total_bill ?? 0) || 0;
  const _rawDiscountRate = invoice.discount_rate ?? 0;
  const discountRateNum = Number.isFinite(Number(_rawDiscountRate)) ? Number(_rawDiscountRate) : 0;
  const totalDiscountAmount =
    invoice.total_discount_amount != null && invoice.total_discount_amount !== ''
      ? Number(invoice.total_discount_amount)
      : (discountRateNum > 0 ? subtotalBill * (discountRateNum / 100) : 0);
  const displayDiscountRate =
    discountRateNum > 0
      ? discountRateNum
      : subtotalBill > 0 && totalDiscountAmount > 0
        ? Math.round((totalDiscountAmount / subtotalBill) * 100 * 100) / 100
        : 0;
  const vatRateNum = Number.isFinite(Number(invoice.vat_rate ?? 0)) ? Number(invoice.vat_rate ?? 0) : 0;
  const displayTotalVatAmount = Number(invoice.total_vat_amount ?? 0);
  const displayTotalBillAmount = Number(invoice.total_bill_amount ?? 0);

  const calculateDays = (startDate, endDate) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both dates
    return diffDays;
  };

  /** PDF filename: CompanyName-InvoiceNumber-Day-Month-Year.pdf */
  const getInvoicePdfFilename = () => {
    const companyName = invoice?.entitlement_details?.customer_master?.company_name
      || invoice?.company_name
      || invoice?.customer_name
      || 'Invoice';
    const slug = String(companyName)
      .replace(/[^a-zA-Z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      || 'Invoice';
    const invNum = invoice?.invoice_number || `INV-${invoice?.id}`;
    const d = invoice?.issue_date ? new Date(invoice.issue_date) : new Date();
    const day = d.getDate();
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    return `${slug}-${invNum}-${day}-${month}-${year}.pdf`;
  };

  const handleBackToInvoices = () => {
    navigate('/invoices');
  };

  const handlePrint = () => window.print();

  const imgToBase64 = (src, type = 'image/png') => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const c = document.createElement('canvas');
          c.width = img.naturalWidth;
          c.height = img.naturalHeight;
          const ctx = c.getContext('2d');
          ctx.drawImage(img, 0, 0);
          resolve(c.toDataURL(type));
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = src;
    });
  };

  /** Create semi-transparent image base64 for watermark (matches view opacity 0.07). */
  const imgToWatermarkBase64 = (imageSrc) => {
    const src = typeof imageSrc === 'string' ? imageSrc : (imageSrc?.default ?? imageSrc);
    if (!src) return Promise.resolve(null);
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const size = Math.max(img.naturalWidth, img.naturalHeight, 400);
          const c = document.createElement('canvas');
          c.width = size;
          c.height = size;
          const ctx = c.getContext('2d');
          ctx.globalAlpha = 0.08;
          ctx.drawImage(img, (size - img.naturalWidth) / 2, (size - img.naturalHeight) / 2);
          resolve(c.toDataURL('image/png'));
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = src;
    });
  };

  /**
   * Generate invoice PDF - layout matches invoice view exactly.
   * @param {Object} options
   * @param {boolean} [options.useServiceName=false] - If true, use Service column (e.g. IT Service); if false, use Package column (e.g. NIX)
   */
  const generateInvoicePDF = async (options = {}) => {
    const useServiceName = options.useServiceName ?? (invoiceMode === 'service');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    // Match view: padding 12px 16px → ~3mm top/bottom, ~4mm left/right
    const marginH = 4;
    const marginV = 3;
    let y = marginV;

    const [logoBase64, qrBase64, watermarkBase64] = await Promise.all([
      Promise.resolve(null),
      imgToBase64(qrWebsite),
      Promise.resolve(null),
    ]);

    pdf.setFontSize(10);
    pdf.setTextColor(0, 0, 0);

    if (logoBase64) {
      pdf.addImage(logoBase64, 'JPEG', marginH, y, 45, 18);
    }
    pdf.setFontSize(18);
    pdf.setFont('helvetica', 'bold');
    pdf.text('INVOICE', pageW / 2, y + 12, { align: 'center' });
    if (qrBase64) {
      pdf.addImage(qrBase64, 'PNG', pageW - marginH - 25, y, 25, 25);
    }
    y += 20;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.text(COMPANY_LEGAL_NAME, marginH, y);
    y += 3.5;
    pdf.text(COMPANY_BILLING_ADDRESS, marginH, y);
    y += 3.5;
    pdf.text(COMPANY_BILLING_CONTACT, marginH, y);
    y += 6;

    const cust = invoice.entitlement_details?.customer_master || invoice.customer_master || {};
    const kam = cust.kam_details || {};
    const leftX = marginH;
    const rightX = pageW / 2 + 5;
    let leftY = y;
    let rightY = y;

    pdf.setFont('helvetica', 'bold');
    pdf.text('Customer Number:', leftX, leftY); pdf.setFont('helvetica', 'normal'); pdf.text(displayOrNA(cust.customer_number), leftX + 28, leftY);
    leftY += 3.5;
    pdf.setFont('helvetica', 'bold'); pdf.text('Name:', leftX, leftY); pdf.setFont('helvetica', 'normal'); pdf.text(displayOrNA(cust.customer_name), leftX + 28, leftY);
    leftY += 3.5;
    pdf.setFont('helvetica', 'bold'); pdf.text('NID:', leftX, leftY); pdf.setFont('helvetica', 'normal'); pdf.text(displayOrNA(cust.nid), leftX + 28, leftY);
    pdf.setFont('helvetica', 'bold'); leftY += 3.5;
    pdf.text('Company:', leftX, leftY); pdf.setFont('helvetica', 'normal'); pdf.text(displayOrNA(cust.company_name), leftX + 28, leftY);
    leftY += 3.5;
    pdf.setFont('helvetica', 'bold'); pdf.text('Contact Person:', leftX, leftY); pdf.setFont('helvetica', 'normal'); pdf.text(displayOrNA(cust.contact_person || cust.customer_name), leftX + 28, leftY);
    leftY += 3.5;
    pdf.setFont('helvetica', 'bold'); pdf.text('Email:', leftX, leftY); pdf.setFont('helvetica', 'normal'); pdf.text(displayOrNA(cust.email), leftX + 28, leftY);
    leftY += 3.5;
    pdf.setFont('helvetica', 'bold'); pdf.text('Phone:', leftX, leftY); pdf.setFont('helvetica', 'normal'); pdf.text(displayOrNA(cust.phone), leftX + 28, leftY);
    leftY += 3.5;
    pdf.setFont('helvetica', 'bold'); pdf.text('Address:', leftX, leftY); pdf.setFont('helvetica', 'normal'); pdf.text(displayOrNA(cust.address), leftX + 28, leftY);
    leftY += 3.5;
    pdf.setFont('helvetica', 'bold'); pdf.text('KAM Name:', leftX, leftY); pdf.setFont('helvetica', 'normal'); pdf.text(displayOrNA(kam.name), leftX + 28, leftY);
    leftY += 3.5;
    pdf.setFont('helvetica', 'bold'); pdf.text('KAM Designation:', leftX, leftY); pdf.setFont('helvetica', 'normal'); pdf.text(displayOrNA(kam.designation), leftX + 28, leftY);

    pdf.setFont('helvetica', 'bold');
    pdf.text('Issue Date:', rightX, rightY); pdf.setFont('helvetica', 'normal'); pdf.text(formatDate(invoice.issue_date), rightX + 25, rightY);
    rightY += 3.5;
    const startD = invoice.details?.length ? invoice.details.reduce((m, d) => (!m || (d.start_date && new Date(d.start_date) < new Date(m))) ? d.start_date : m, null) : invoice.activation_date;
    const endD = invoice.details?.length ? invoice.details.reduce((m, d) => (!m || (d.end_date && new Date(d.end_date) > new Date(m))) ? d.end_date : m, null) : invoice.issue_date;
    pdf.setFont('helvetica', 'bold');
    pdf.text('Invoice For:', rightX, rightY); pdf.setFont('helvetica', 'normal'); pdf.text(`${formatDate(startD)} - ${formatDate(endD)}`, rightX + 25, rightY);
    rightY += 3.5;
    pdf.setFont('helvetica', 'bold');
    pdf.text('Invoice No:', rightX, rightY); pdf.setFont('helvetica', 'normal'); pdf.text(String(invoice.invoice_number ?? ''), rightX + 25, rightY);
    rightY += 3.5;
    pdf.text('Total Due:', rightX, rightY); pdf.text(`${formatNumber(invoice.customer_total_due ?? invoice.total_balance_due ?? invoice.entitlement_details?.customer_master?.total_due)} BDT`, rightX + 25, rightY);

    y = Math.max(leftY, rightY) + 4;

    // Column widths: match view 6%, 12%, 12%, 28%, 8%, 8%, 12%, 14% of content width
    const tableW = pageW - 2 * marginH;
    const colWidths = [0.06, 0.12, 0.12, 0.28, 0.08, 0.08, 0.12, 0.14].map(p => Math.round(tableW * p));

    const sortedDetails = [...(invoice.details || [])].sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
    const packageCol = useServiceName ? 'Service' : 'Package';
    const head = [['SL No.', 'Start Date', 'End Date', packageCol, 'MBPS', 'Days', 'Rate', 'Total (taka)']];
    const body = sortedDetails.map((d, i) => [
      String(i + 1),
      formatDate(d.start_date),
      formatDate(d.end_date),
      useServiceName
        ? (String(d.entitlement_service_name ?? d.service_name ?? '').trim() || '–')
        : (d.entitlement_package ?? d.package_name ?? '–'),
      String(d.entitlement_mbps ?? d.mbps ?? ''),
      String(calculateDays(d.start_date, d.end_date)),
      formatNumber(d.unit_price),
      formatNumber(d.line_total),
    ]);
    body.push([
      { content: 'Subtotal (without VAT):', colSpan: 7, styles: { halign: 'right', fontStyle: 'bold' } },
      { content: formatNumber(subtotalBill), styles: { halign: 'right', fontStyle: 'bold' } },
    ]);
    if (totalDiscountAmount > 0) {
      body.push([
        { content: displayDiscountRate > 0 ? `Discount (${displayDiscountRate}):` : 'Discount:', colSpan: 7, styles: { halign: 'right', fontStyle: 'bold' } },
        { content: `-${formatNumber(totalDiscountAmount)}`, styles: { halign: 'right', fontStyle: 'bold' } },
      ]);
    }
    body.push([
      { content: `VAT (${vatRateNum}):`, colSpan: 7, styles: { halign: 'right', fontStyle: 'bold' } },
      { content: formatNumber(displayTotalVatAmount), styles: { halign: 'right', fontStyle: 'bold' } },
    ]);
    body.push([
      { content: 'Total (with VAT):', colSpan: 7, styles: { halign: 'right', fontStyle: 'bold' } },
      { content: formatNumber(displayTotalBillAmount), styles: { halign: 'right', fontStyle: 'bold' } },
    ]);

    // Match view: table padding 2px 4px → ~0.5mm 1mm, fontSize 11px, lineHeight 1.2
    const cellPad = { top: 0.5, right: 1, bottom: 0.5, left: 1 };
    autoTable(pdf, {
      head,
      body,
      startY: y,
      margin: { left: marginH, right: marginH },
      tableWidth: 'wrap',
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: cellPad, lineHeight: 1.2 },
      headStyles: {
        fillColor: [245, 245, 245],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        fontSize: 9,
        halign: 'center',
        valign: 'middle',
        cellPadding: cellPad,
      },
      bodyStyles: { valign: 'middle', textColor: [0, 0, 0] },
      columnStyles: {
        0: { halign: 'center', cellWidth: colWidths[0] },
        1: { halign: 'center', cellWidth: colWidths[1] },
        2: { halign: 'center', cellWidth: colWidths[2] },
        3: { halign: 'left', cellWidth: colWidths[3] },
        4: { halign: 'right', cellWidth: colWidths[4] },
        5: { halign: 'center', cellWidth: colWidths[5] },
        6: { halign: 'right', cellWidth: colWidths[6] },
        7: { halign: 'right', cellWidth: colWidths[7] },
      },
      minCellHeight: 4,
    });

    y = pdf.lastAutoTable.finalY + 5;
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.text(`Total: ${formatNumber(displayTotalBillAmount)} BDT`, marginH, y);
    y += 4;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.text(`In Word: ${numberToWords(displayTotalBillAmount)} Only`, marginH, y);
    y += 4;
    pdf.text(`Thank you for choosing ${COMPANY_LEGAL_NAME}.`, marginH, y);
    y += 4;
    pdf.setFontSize(8);
    pdf.text('This is software generated invoice and does not require a signature.', pageW / 2, y, { align: 'center' });
    y += 5;
    pdf.setFontSize(9);
    pdf.text(INVOICE_PAYMENT_FOOTER_NOTE, marginH, y, { maxWidth: pageW - 2 * marginH });

    // Watermark: draw on top as overlay (like view), centered on each page
    if (watermarkBase64) {
      const wmSize = 100;
      const wmX = (pageW - wmSize) / 2;
      const wmY = (pageH - wmSize) / 2 - 5;
      const totalPages = pdf.internal.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        pdf.setPage(p);
        pdf.addImage(watermarkBase64, 'PNG', wmX, wmY, wmSize, wmSize);
      }
      pdf.setPage(1);
    }

    return pdf;
  };

  const handleDownloadPDF = async () => {
    try {
      const pdf = await generateInvoicePDF({ useServiceName: invoiceMode === 'service' });
      pdf.save(getInvoicePdfFilename());
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert(`Error generating PDF: ${error?.message || 'Unknown error'}`);
    }
  };

  /** Send invoice as PDF via email based on selected invoice mode. */
  const handleSendEmail = async (recipientEmail) => {
    if (!recipientEmail?.trim() || !recipientEmail.includes('@')) {
      alert('Please enter a valid email address.');
      return;
    }
    setEmailSending(true);
    try {
      const pdf = await generateInvoicePDF({ useServiceName: invoiceMode === 'service' });
      const pdfBlob = pdf.output('blob');
      const reader = new FileReader();
      reader.readAsDataURL(pdfBlob);
      reader.onloadend = async () => {
        const base64 = reader.result?.split(',')[1]; // strip data:application/pdf;base64,
        if (!base64) {
          setEmailSending(false);
          alert('Failed to generate PDF.');
          return;
        }
        try {
          await api.post(`/bills/invoices/${invoice.id}/send-email/`, {
            email: recipientEmail.trim(),
            pdf_base64: base64,
            filename: getInvoicePdfFilename(),
          });
          setShowEmailModal(false);
          alert(`Invoice sent successfully to ${recipientEmail}`);
        } catch (err) {
          alert(err?.message || 'Failed to send email. Please try again.');
        } finally {
          setEmailSending(false);
        }
      };
      reader.onerror = () => {
        setEmailSending(false);
        alert('Failed to generate PDF.');
      };
    } catch (error) {
      setEmailSending(false);
      alert(`Error: ${error?.message || 'Failed to generate PDF'}`);
    }
  };

  /** Send invoice as PDF via WhatsApp - Web Share API attaches file when user selects WhatsApp. */
  const handleShareWhatsApp = async () => {
    try {
      const pdf = await generateInvoicePDF();
      const pdfBlob = pdf.output('blob');
      const file = new File([pdfBlob], getInvoicePdfFilename(), { type: 'application/pdf' });
      const shareText = `Invoice ${invoice.invoice_number} - Total: ${invoice.total_bill_amount} BDT | ${COMPANY_LEGAL_NAME}`;
      const shareData = {
        title: `Invoice ${invoice.invoice_number}`,
        text: shareText,
        files: [file],
      };

      // Web Share API: when user picks WhatsApp, the PDF is automatically attached
      if (navigator.share && (navigator.canShare?.(shareData) ?? true)) {
        try {
          await navigator.share(shareData);
          return;
        } catch (shareErr) {
          if (shareErr?.name === 'AbortError') {
            return;
          }
          console.warn('Share failed, falling back to download:', shareErr);
        }
      }

      // Fallback: Web Share not available (e.g. HTTP, or browser doesn't support file sharing)
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = getInvoicePdfFilename();
      a.click();
      URL.revokeObjectURL(url);

      const phone = invoice.entitlement_details?.customer_master?.phone || invoice.customer_master?.phone;
      const cleanPhone = phone ? String(phone).replace(/\D/g, '').replace(/^0/, '880') : '';
      const waUrl = cleanPhone
        ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent('Please find your invoice attached. ' + shareText)}`
        : `https://wa.me/?text=${encodeURIComponent('Please find your invoice attached. ' + shareText)}`;
      window.open(waUrl, '_blank');
      alert('Automatic WhatsApp sharing requires a supported browser (e.g. Chrome/Safari on phone). PDF has been downloaded—please share it from your device or use the Download PDF button and send from your phone.');
    } catch (error) {
      if (error?.name !== 'AbortError') {
        try {
          const pdf = await generateInvoicePDF();
          pdf.save(getInvoicePdfFilename());
          alert('PDF downloaded. For direct WhatsApp sharing, please use a mobile device (Chrome or Safari).');
        } catch (e) {
          console.error('Share error:', e);
          alert('Could not generate or share PDF. Please try Download PDF instead.');
        }
      }
    }
  };

  return (
    <div className="min-h-screen p-6 bg-gray-50 dark:bg-gray-900">
      <style>
        {`
          @media print {
            .no-print {
              display: none !important;
            }
            .fixed.left-0 {
              display: none !important;
            }
            .fixed.inset-0 {
              display: none !important;
            }
            .fixed.top-4.right-4 {
              display: none !important;
            }
            .print-content {
              margin: 0;
              padding: 0px;
              box-shadow: none;
              background-color: white;
            }
          }
          [data-invoice-content] {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          [data-invoice-content] * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
        `}
      </style>
      <div className="max-w-4xl mx-auto">
        <div className="mb-6 flex flex-wrap justify-between items-center gap-3 no-print">
          <div className="flex gap-2">
          <button
            onClick={handleBackToInvoices}
            className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Invoices
          </button>
          <button
            onClick={() => navigate(`/invoice-edit/${invoice.id}`, { state: { invoice } })}
            className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit Invoice
          </button>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Invoice Generation Mode:</span>
            <div className="inline-flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden">
              <button
                type="button"
                onClick={() => setInvoiceMode('package')}
                className={`px-3 py-2 text-sm font-medium flex items-center gap-1.5 transition-colors ${
                  invoiceMode === 'package'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
                title="Generate invoice in package mode (e.g. NIX)"
              >
                <Package className="w-4 h-4" />
                Package Mode
              </button>
              <button
                type="button"
                onClick={() => setInvoiceMode('service')}
                className={`px-3 py-2 text-sm font-medium flex items-center gap-1.5 transition-colors ${
                  invoiceMode === 'service'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
                title="Generate invoice in service mode (e.g. IT Service)"
              >
                <Wrench className="w-4 h-4" />
                Service Mode
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleDownloadPDF}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center"
            >
              <Download className="w-4 h-4 mr-2" />
              Download PDF
            </button>
            <button
              onClick={handleShareWhatsApp}
              className="bg-[#25D366] hover:bg-[#20BD5A] text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center"
              title="Share invoice PDF to WhatsApp—select WhatsApp from the share menu and the PDF will be attached automatically (works best on mobile)"
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              WhatsApp
            </button>
            <button
              onClick={() => setShowEmailModal(true)}
              disabled={emailSending}
              className="bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center"
              title="Send invoice as PDF via email"
            >
              <Mail className="w-4 h-4 mr-2" />
              {emailSending ? 'Sending…' : 'Email'}
            </button>
            {showEmailModal && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => !emailSending && setShowEmailModal(false)}>
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 max-w-sm w-full mx-4" onClick={(e) => e.stopPropagation()}>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Send Invoice via Email</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    Enter the recipient email address. The invoice will be generated in{' '}
                    <strong>{invoiceMode === 'service' ? 'Service Mode' : 'Package Mode'}</strong>{' '}
                    and sent as an attachment.
                  </p>
                  <input
                    type="email"
                    placeholder="customer@example.com"
                    defaultValue={invoice?.entitlement_details?.customer_master?.email || invoice?.customer_master?.email || ''}
                    id="invoice-email-input"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white mb-4"
                    onKeyDown={(e) => e.key === 'Enter' && handleSendEmail(document.getElementById('invoice-email-input')?.value)}
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => !emailSending && setShowEmailModal(false)}
                      className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                      disabled={emailSending}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleSendEmail(document.getElementById('invoice-email-input')?.value)}
                      disabled={emailSending}
                      className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg disabled:opacity-50"
                    >
                      {emailSending ? 'Sending…' : 'Send'}
                    </button>
                  </div>
                </div>
              </div>
            )}
            <button
              onClick={handlePrint}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center"
            >
              <Printer className="w-4 h-4 mr-2" />
              Print
            </button>
          </div>
        </div>

        <div ref={invoiceRef} data-invoice-content className="print-content" style={{ fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', fontSize: '12px', lineHeight: '1.4', margin: '0 auto', padding: '12px 16px', width: '210mm', boxSizing: 'border-box', backgroundColor: 'white', boxShadow: 'none', position: 'relative', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact', overflow: 'visible' }}>

          {/* Watermark - Centered behind content */}
          <div 
            style={{ 
              position: 'absolute', 
              top: '40%', 
              left: '50%', 
              transform: 'translate(-50%, -50%)', 
              width: '700px', 
              height: '700px', 
              zIndex: '0', 
              pointerEvents: 'none', 
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'visible'
            }}
          >
            <span
              style={{
                fontSize: 'clamp(80px, 18vw, 200px)',
                fontWeight: 800,
                color: 'rgba(15, 23, 42, 0.06)',
                userSelect: 'none',
              }}
              aria-hidden
            >
              ISP
            </span>
          </div>

          <div data-invoice-header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0', marginBottom: '6px', position: 'relative', zIndex: '1' }}>
            <div
              style={{
                width: '200px',
                minHeight: '60px',
                display: 'flex',
                alignItems: 'center',
                fontWeight: 800,
                fontSize: '18px',
                color: '#0f172a',
              }}
            >
              {COMPANY_LEGAL_NAME}
            </div>
            <div style={{ textAlign: 'center', flex: '1' }}>
              <h1 style={{ fontSize: '24px', margin: '0' }}>INVOICE</h1>
            </div>
            <div style={{ width: '200px', height: 'auto', display: 'flex', justifyContent: 'flex-end' }} >
            <img 
              src={qrWebsite} 
              alt="QR Code" 
              style={{ width: '80px', height: 'auto', boxShadow: 'none', display: 'block', objectFit: 'contain', minHeight: '60px' }}
              onError={(e) => { 
                console.error('Failed to load QR image:', e.target.src);
                // Keep image visible even on error - don't hide it
                e.target.style.border = '1px dashed #ccc';
                e.target.style.backgroundColor = '#f9f9f9';
              }}
              onLoad={() => {
                console.log('QR image loaded successfully');
              }}
            />
            </div>
          </div>

          <div data-invoice-header style={{ marginBottom: '8px', position: 'relative', zIndex: '1' }}>
            <p><strong>{COMPANY_LEGAL_NAME}</strong></p>
            <p>{COMPANY_BILLING_ADDRESS}</p>
            <p>{COMPANY_BILLING_CONTACT}</p>
          </div>

          <div data-invoice-header style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', paddingBottom: '6px', position: 'relative', zIndex: '1' }}>
            {/* LEFT SIDE  */}
            <div style={{ width: '48%' }}>
              <p><strong>Customer Number: </strong>{displayOrNA(invoice.entitlement_details?.customer_master?.customer_number)}</p>
              <p><strong>Name: </strong>{displayOrNA(invoice.entitlement_details?.customer_master?.customer_name)}</p>
              <p><strong>NID: </strong>{displayOrNA(invoice.entitlement_details?.customer_master?.nid)}</p>
              <p><strong>Company: </strong>{displayOrNA(invoice.entitlement_details?.customer_master?.company_name)}</p>
              <p><strong>Contact Person: </strong>{displayOrNA(invoice.entitlement_details?.customer_master?.contact_person || invoice.entitlement_details?.customer_master?.customer_name)}</p>
              <p><strong>Email: </strong>{displayOrNA(invoice.entitlement_details?.customer_master?.email)}</p>
              <p><strong>Phone: </strong>{displayOrNA(invoice.entitlement_details?.customer_master?.phone)}</p>
              <p><strong>Address: </strong>{displayOrNA(invoice.entitlement_details?.customer_master?.address)}</p>
            </div>
            {/* RIGHT SIDE  */} 
            <div style={{ width: '48%', textAlign: 'right' }}>
              <p><strong>KAM Name: </strong>{displayOrNA(invoice.entitlement_details?.customer_master?.kam_details?.name)}</p>
              <p><strong>KAM Designation: </strong>{displayOrNA(invoice.entitlement_details?.customer_master?.kam_details?.designation)}</p>
              <p><strong>Issue Date: </strong>{formatDate(invoice.issue_date)}</p>
              {/* <p><strong>Invoice For:</strong> {formatDate(invoice.activation_date)} <strong>-</strong> {formatDate(invoice.entitlement_details?.last_bill_invoice_date)}</p> */}
              <p><strong>Invoice Period: </strong>{formatDate(
                invoice.details?.length
                  ? invoice.details.reduce((min, d) => {
                      const dVal = d.start_date ? new Date(d.start_date).getTime() : Infinity;
                      const minVal = min ? new Date(min).getTime() : Infinity;
                      return dVal < minVal ? d.start_date : min;
                    }, null)
                  : invoice.activation_date
              )} <strong>-</strong> {formatDate(
                invoice.details?.length
                  ? invoice.details.reduce((max, d) => {
                      const dVal = d.end_date ? new Date(d.end_date).getTime() : -Infinity;
                      const maxVal = max ? new Date(max).getTime() : -Infinity;
                      return dVal > maxVal ? d.end_date : max;
                    }, null)
                  : invoice.issue_date
              )}</p>
              <p><strong>Invoice No:</strong> {invoice.invoice_number}</p>
              <p><strong>Total Due:</strong> {formatNumber(invoice.customer_total_due ?? invoice.total_balance_due ?? invoice.entitlement_details?.customer_master?.total_due)} BDT</p>
            </div>
          </div>

          <table data-invoice-table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '4px', marginBottom: '4px', position: 'relative', zIndex: '1', fontSize: '11px', tableLayout: 'fixed', lineHeight: '1.2' }}>
            <colgroup>
              <col style={{ width: '6%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '28%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '14%' }} />
            </colgroup>
            <thead>
              <tr>
                <th style={{ border: '1px solid #333', padding: '2px 4px', textAlign: 'center', verticalAlign: 'middle', backgroundColor: '#f5f5f5', fontWeight: '600', lineHeight: '1.2' }}>SL No.</th>
                <th style={{ border: '1px solid #333', padding: '2px 4px', textAlign: 'center', verticalAlign: 'middle', backgroundColor: '#f5f5f5', fontWeight: '600', lineHeight: '1.2' }}>Start Date</th>
                <th style={{ border: '1px solid #333', padding: '2px 4px', textAlign: 'center', verticalAlign: 'middle', backgroundColor: '#f5f5f5', fontWeight: '600', lineHeight: '1.2' }}>End Date</th>
                <th style={{ border: '1px solid #333', padding: '2px 4px', textAlign: 'left', verticalAlign: 'middle', backgroundColor: '#f5f5f5', fontWeight: '600', lineHeight: '1.2' }}>{invoiceMode === 'package' ? 'Package' : 'Service'}</th>
                <th style={{ border: '1px solid #333', padding: '2px 4px', textAlign: 'right', verticalAlign: 'middle', backgroundColor: '#f5f5f5', fontWeight: '600', lineHeight: '1.2' }}>MBPS</th>
                <th style={{ border: '1px solid #333', padding: '2px 4px', textAlign: 'center', verticalAlign: 'middle', backgroundColor: '#f5f5f5', fontWeight: '600', lineHeight: '1.2' }}>Days</th>
                <th style={{ border: '1px solid #333', padding: '2px 4px', textAlign: 'right', verticalAlign: 'middle', backgroundColor: '#f5f5f5', fontWeight: '600', lineHeight: '1.2' }}>Rate</th>
                <th style={{ border: '1px solid #333', padding: '2px 4px', textAlign: 'right', verticalAlign: 'middle', backgroundColor: '#f5f5f5', fontWeight: '600', lineHeight: '1.2' }}>Total (taka)</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const details = (invoice.details || []).sort((a, b) => {
                  const dateA = new Date(a.created_at || 0);
                  const dateB = new Date(b.created_at || 0);
                  return dateA - dateB;
                });

                const renderDetailRow = (detail, index) => (
                  <tr key={detail.id}>
                    <td style={{ border: '1px solid #333', padding: '2px 4px', textAlign: 'center', verticalAlign: 'middle', lineHeight: '1.2' }}>{index + 1}</td>
                    <td style={{ border: '1px solid #333', padding: '2px 4px', textAlign: 'center', verticalAlign: 'middle', lineHeight: '1.2' }}>{formatDate(detail.start_date)}</td>
                    <td style={{ border: '1px solid #333', padding: '2px 4px', textAlign: 'center', verticalAlign: 'middle', lineHeight: '1.2' }}>{formatDate(detail.end_date)}</td>
                    <td style={{ border: '1px solid #333', padding: '2px 4px', textAlign: 'left', verticalAlign: 'middle', lineHeight: '1.2' }}>
                      {invoiceMode === 'package'
                        ? (detail.entitlement_package ?? detail.package_name ?? '–')
                        : (String(detail.entitlement_service_name ?? detail.service_name ?? '').trim() || '–')}
                    </td>
                    <td style={{ border: '1px solid #333', padding: '2px 4px', textAlign: 'right', verticalAlign: 'middle', lineHeight: '1.2' }}>{detail.entitlement_mbps || detail.mbps}</td>
                    <td style={{ border: '1px solid #333', padding: '2px 4px', textAlign: 'center', verticalAlign: 'middle', lineHeight: '1.2' }}>{calculateDays(detail.start_date, detail.end_date)}</td>
                    <td style={{ border: '1px solid #333', padding: '2px 4px', textAlign: 'right', verticalAlign: 'middle', lineHeight: '1.2' }}>{formatNumber(detail.unit_price || detail.unit_price)}</td>
                    <td style={{ border: '1px solid #333', padding: '2px 4px', textAlign: 'right', verticalAlign: 'middle', lineHeight: '1.2' }}>{formatNumber(detail.line_total)}</td>
                  </tr>
                );

                // Show all items as a flat list (no zone grouping)
                return details.map((detail, index) => renderDetailRow(detail, index));
              })()}
              <tr>
                <td colSpan="7" style={{ border: '1px solid #333', padding: '2px 4px', textAlign: 'right', verticalAlign: 'middle', fontWeight: '600', lineHeight: '1.2' }}>Subtotal (without VAT):</td>
                <td style={{ border: '1px solid #333', padding: '2px 4px', textAlign: 'right', verticalAlign: 'middle', fontWeight: '600', lineHeight: '1.2' }}>{formatNumber(subtotalBill)}</td>
              </tr>
              {totalDiscountAmount > 0 && (
                <tr>
                  <td colSpan="7" style={{ border: '1px solid #333', padding: '2px 4px', textAlign: 'right', verticalAlign: 'middle', fontWeight: '600', lineHeight: '1.2' }}>
                    {displayDiscountRate > 0 ? `Discount (${displayDiscountRate}%):` : "Discount:"}
                  </td>
                  <td style={{ border: '1px solid #333', padding: '2px 4px', textAlign: 'right', verticalAlign: 'middle', fontWeight: '600', lineHeight: '1.2' }}>-{formatNumber(totalDiscountAmount)}</td>
                </tr>
              )}
              <tr>
                <td colSpan="7" style={{ border: '1px solid #333', padding: '2px 4px', textAlign: 'right', verticalAlign: 'middle', fontWeight: '600', lineHeight: '1.2' }}>
                  VAT ({vatRateNum}%):
                </td>
                <td style={{ border: '1px solid #333', padding: '2px 4px', textAlign: 'right', verticalAlign: 'middle', fontWeight: '600', lineHeight: '1.2' }}>{formatNumber(displayTotalVatAmount)}</td>
              </tr>
              <tr>
                <td colSpan="7" style={{ border: '1px solid #333', padding: '2px 4px', textAlign: 'right', verticalAlign: 'middle', fontWeight: '600', lineHeight: '1.2' }}>Total (with VAT):</td>
                <td style={{ border: '1px solid #333', padding: '2px 4px', textAlign: 'right', verticalAlign: 'middle', fontWeight: '600', lineHeight: '1.2' }}>{formatNumber(displayTotalBillAmount)}</td>
              </tr>
            </tbody>
          </table>

          <div data-invoice-footer style={{ paddingTop: '8px', fontSize: '11px', position: 'relative', zIndex: '1' }}>
            <h4 style={{ fontFamily: '"Inter", sans-serif', fontSize: '16px', }}>Total: {formatNumber(displayTotalBillAmount)} BDT</h4>
            <h5 style={{ fontFamily: '"Inter", sans-serif', fontSize: '12px', }}>In Word: {numberToWords(displayTotalBillAmount)} Only</h5>
            <p>Thank you for choosing {COMPANY_LEGAL_NAME}.</p>
            <p style={{ fontSize: '10px', fontWeight: 'bold', textAlign: 'center', marginTop: '6px'}}>This is software generated invoice and does not require a signature.</p>
            <hr />

            <h5>Payment</h5>
            <p>{INVOICE_PAYMENT_FOOTER_NOTE}</p>

          </div>
          
        </div>

      </div>
    </div>
  );
};

export default InvoiceView;