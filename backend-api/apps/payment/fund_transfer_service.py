"""
Customer-to-customer fund transfer service.
Deducts from source customer credit balance, adds to target customer(s).
Creates CustomerCreditTransaction entries (transfer_out / transfer_in).

When source_payment_master_id is provided (fund adjustment):
- Transfer amount must come from that payment's overpayment
- Reduces source PaymentDetails and recalculates source invoice
- Creates target PaymentMaster (payment received) when target has unpaid invoice,
  otherwise credits target via transfer_in
"""
from decimal import Decimal
from django.db import transaction
from django.db.models import Sum

from apps.customers.models import CustomerMaster, CustomerCreditTransaction
from apps.bills.models import InvoiceMaster
from .models import (
    CustomerFundTransfer,
    CustomerFundTransferLine,
    PaymentMaster,
    PaymentDetails,
)


def get_overpayment_from_payment(payment_master_id):
    """Return total overpayment (credit) linked to this PaymentMaster."""
    total = CustomerCreditTransaction.objects.filter(
        reference_type=CustomerCreditTransaction.REFERENCE_TYPE_PAYMENT,
        reference_id=payment_master_id,
        amount__gt=0,
    ).aggregate(total=Sum('amount'))['total']
    return total or Decimal('0')


def create_fund_transfer(
    *,
    source_allocations,
    target_allocations,
    transfer_date,
    remarks,
    created_by,
    source_payment_master_id=None,
    apply_to_target_invoice=True,
    target_invoice_id=None,
    target_invoice_ids=None,
):
    """
    Create a fund transfer: multiple sources (debit) and multiple targets (credit).
    source_allocations: list of { "customer_id": int, "amount": Decimal } (amount positive)
    target_allocations: list of { "customer_id": int, "amount": Decimal } (amount positive)
    Sum of source amounts must equal sum of target amounts.
    Each source customer must have credit_balance >= amount.

    When source_payment_master_id is provided (single source only):
    - Transfer amount must be <= overpayment from that payment
    - Reduces source PaymentDetails by transfer amount and recalculates source invoice
    - For each target: creates PaymentMaster (payment received) when target has unpaid
      invoice, otherwise creates transfer_in (credit)
    """
    total_debit = sum(Decimal(str(a["amount"])) for a in source_allocations)
    total_credit = sum(Decimal(str(a["amount"])) for a in target_allocations)
    if total_debit <= 0 or total_credit <= 0:
        raise ValueError("Source and target amounts must be positive.")
    if total_debit != total_credit:
        raise ValueError(
            f"Total debit ({total_debit}) must equal total credit ({total_credit})."
        )

    with transaction.atomic():
        # When source_payment_master_id provided: validate amount from that payment's overpayment
        if source_payment_master_id and len(source_allocations) == 1:
            overpayment_available = get_overpayment_from_payment(source_payment_master_id)
            amount = Decimal(str(source_allocations[0]["amount"]))
            if amount > overpayment_available:
                raise ValueError(
                    f"Transfer amount ({amount}) exceeds overpayment from payment #{source_payment_master_id} "
                    f"({overpayment_available}). Fund adjustment must be based on source_payment_master_id amount."
                )

        # Validate source balances (pooled credit)
        for alloc in source_allocations:
            cid = alloc["customer_id"]
            amount = Decimal(str(alloc["amount"]))
            balance = CustomerMaster.objects.get(pk=cid).get_credit_balance()
            if balance < amount:
                raise ValueError(
                    f"Customer ID {cid} has insufficient credit balance. "
                    f"Available: {balance}, requested: {amount}."
                )

        # Create transfer header (use source_payment_master_id_id for raw FK when passing int)
        create_kwargs = {
            "transfer_date": transfer_date,
            "remarks": remarks or "",
            "created_by": created_by,
        }
        if source_payment_master_id is not None:
            create_kwargs["source_payment_master_id_id"] = source_payment_master_id
        transfer = CustomerFundTransfer.objects.create(**create_kwargs)
        transfer.refresh_from_db()

        # Process source side
        for alloc in source_allocations:
            cid = alloc["customer_id"]
            amount = Decimal(str(alloc["amount"]))
            CustomerFundTransferLine.objects.create(
                transfer_id=transfer,
                customer_id_id=cid,
                amount=-amount,
            )
            CustomerCreditTransaction.objects.create(
                customer_id_id=cid,
                amount=-amount,
                transaction_type=CustomerCreditTransaction.TRANSACTION_TYPE_TRANSFER_OUT,
                reference_type=CustomerCreditTransaction.REFERENCE_TYPE_FUND_TRANSFER,
                reference_id=transfer.id,
                entry_date=transfer.transfer_date,
                remarks=remarks or "",
                created_by=created_by,
            )

        # When source_payment_master_id: reduce source PaymentDetails and recalc invoice
        if source_payment_master_id and len(source_allocations) == 1:
            _adjust_source_payment(
                payment_master_id=source_payment_master_id,
                reduce_amount=Decimal(str(source_allocations[0]["amount"])),
            )

        # Process target side
        # When source_payment_master_id: create PaymentMaster (payment received) for unpaid invoice, else transfer_in
        # When not fund adjustment: always transfer_in (credit)
        for alloc in target_allocations:
            cid = alloc["customer_id"]
            amount = Decimal(str(alloc["amount"]))
            CustomerFundTransferLine.objects.create(
                transfer_id=transfer,
                customer_id_id=cid,
                amount=amount,
            )
            if apply_to_target_invoice:
                applied_to_invoice, remainder = _apply_transfer_to_target(
                    customer_id=cid,
                    amount=amount,
                    transfer_date=transfer.transfer_date,
                    remarks=remarks or "",
                    transfer_ref=transfer.reference_number or f"TRF-{transfer.id:05d}",
                    created_by=created_by,
                    target_invoice_id=target_invoice_id,
                    target_invoice_ids=target_invoice_ids,
                )
                if remainder > 0:
                    CustomerCreditTransaction.objects.create(
                        customer_id_id=cid,
                        amount=remainder,
                        transaction_type=CustomerCreditTransaction.TRANSACTION_TYPE_TRANSFER_IN,
                        reference_type=CustomerCreditTransaction.REFERENCE_TYPE_FUND_TRANSFER,
                        reference_id=transfer.id,
                        entry_date=transfer.transfer_date,
                        remarks=remarks or "",
                        created_by=created_by,
                    )
            else:
                CustomerCreditTransaction.objects.create(
                    customer_id_id=cid,
                    amount=amount,
                    transaction_type=CustomerCreditTransaction.TRANSACTION_TYPE_TRANSFER_IN,
                    reference_type=CustomerCreditTransaction.REFERENCE_TYPE_FUND_TRANSFER,
                    reference_id=transfer.id,
                    entry_date=transfer.transfer_date,
                    remarks=remarks or "",
                    created_by=created_by,
                )

    return transfer


def _adjust_source_payment(*, payment_master_id, reduce_amount):
    """Reduce source PaymentDetails by amount and recalculate invoice."""
    pm = PaymentMaster.objects.select_related("invoice_master_id").get(
        pk=payment_master_id
    )
    details = list(PaymentDetails.objects.filter(payment_master_id=pm).order_by("id"))
    if not details:
        return
    remaining = reduce_amount
    for d in details:
        if remaining <= 0:
            break
        deduct = min(remaining, d.pay_amount)
        if deduct > 0:
            new_amount = d.pay_amount - deduct
            extra = f" [Fund transfer -{deduct}]"
            new_remarks = ((d.remarks or "").rstrip() + extra).lstrip()
            PaymentDetails.objects.filter(pk=d.id).update(
                pay_amount=new_amount,
                remarks=new_remarks,
            )
            remaining -= deduct
    invoice = pm.invoice_master_id
    if invoice:
        invoice.update_payment_status()


def _apply_transfer_to_target(
    *,
    customer_id,
    amount,
    transfer_date,
    remarks,
    transfer_ref,
    created_by,
    target_invoice_id=None,
    target_invoice_ids=None,
):
    """
    Apply transfer amount to target: create PaymentMaster for unpaid invoice if possible.
    Returns (amount_applied_to_invoice, remainder_as_credit).
    """
    from apps.bills.models import CustomerEntitlementMaster

    # Find first unpaid/partial invoice for this customer
    invoice_qs = InvoiceMaster.objects.filter(
        customer_entitlement_master_id__customer_master_id_id=customer_id
    ).exclude(status="paid").filter(total_balance_due__gt=0)

    if target_invoice_ids:
        ordered_ids = [int(i) for i in target_invoice_ids if i]
        invoice_map = {inv.id: inv for inv in invoice_qs.filter(id__in=ordered_ids)}
        invoices = [invoice_map[i] for i in ordered_ids if i in invoice_map]
    elif target_invoice_id:
        invoice = invoice_qs.filter(id=target_invoice_id).first()
        invoices = [invoice] if invoice else []
    else:
        invoice = invoice_qs.order_by("issue_date", "id").first()
        invoices = [invoice] if invoice else []

    if not invoices:
        return Decimal("0"), amount

    remaining = amount
    applied_total = Decimal("0")

    for invoice in invoices:
        if remaining <= 0:
            break
        balance_due = invoice.total_balance_due or Decimal("0")
        apply_amount = min(remaining, balance_due)
        if apply_amount <= 0:
            continue

        entitlement = invoice.customer_entitlement_master_id
        payment_master = PaymentMaster.objects.create(
            payment_date=transfer_date,
            payment_method="Fund Transfer",
            customer_entitlement_master_id=entitlement,
            invoice_master_id=invoice,
            remarks=f"{remarks} [From {transfer_ref}]",
            status="completed",
            created_by=created_by,
        )
        PaymentDetails.objects.create(
            payment_master_id=payment_master,
            pay_amount=apply_amount,
            transaction_id=transfer_ref,
            remarks=f"Fund transfer applied to {invoice.invoice_number}",
            status="completed",
            created_by=created_by,
        )
        invoice.update_payment_status()
        remaining -= apply_amount
        applied_total += apply_amount

    return applied_total, remaining
