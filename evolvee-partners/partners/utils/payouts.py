"""Monthly Version 1 payout batch: eligible sales, one pending payment per partner."""
from calendar import monthrange
from datetime import date, datetime, time, timedelta
from decimal import Decimal

from django.conf import settings
from django.db.models import Sum
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from partners.models import (
    Partner,
    PartnerPayment,
    PartnerSale,
    PartnerStatus,
    PaymentStatus,
    SaleStatus,
)


def return_window_days() -> int:
    return max(0, int(getattr(settings, "PAYOUT_RETURN_WINDOW_DAYS", 14)))


def payout_day() -> int:
    return min(28, max(1, int(getattr(settings, "PAYOUT_DAY", 15))))


def parse_shopify_datetime(value):
    if not value:
        return None
    if isinstance(value, datetime):
        if timezone.is_naive(value):
            return timezone.make_aware(value, timezone.get_current_timezone())
        return value
    parsed = parse_datetime(str(value))
    if parsed is None:
        return None
    if timezone.is_naive(parsed):
        return timezone.make_aware(parsed, timezone.get_current_timezone())
    return parsed


def mark_sale_fulfilled(sale: PartnerSale, fulfilled_at=None) -> PartnerSale:
    when = parse_shopify_datetime(fulfilled_at) or timezone.now()
    sale.fulfilled_at = when
    sale.payout_eligible_at = when + timedelta(days=return_window_days())
    sale.save(update_fields=["fulfilled_at", "payout_eligible_at", "updated_at"])
    return sale


def payday_for(as_of: date) -> date:
    day = payout_day()
    last = monthrange(as_of.year, as_of.month)[1]
    return date(as_of.year, as_of.month, min(day, last))

def next_payout_on_or_after(when: date) -> date:
    this = payday_for(when)
    if when <= this:
        return this
    if this.month == 12:
        return payday_for(date(when.year + 1, 1, 1))
    return payday_for(date(when.year, when.month + 1, 1))

def previous_payday(payday: date) -> date:
    if payday.month == 1:
        year, month = payday.year - 1, 12
    else:
        year, month = payday.year, payday.month - 1
    last = monthrange(year, month)[1]
    return date(year, month, min(payout_day(), last))


def payout_period(as_of: date) -> tuple[date, date]:
    end = payday_for(as_of)
    start = previous_payday(end)
    return start, end


def unpaid_eligible_sales(partner: Partner, as_of=None):
    when = as_of or timezone.now()
    already_batched = PartnerSale.objects.filter(
        payments__status__in=[
            PaymentStatus.PENDING,
            PaymentStatus.PROCESSING,
            PaymentStatus.PAID,
        ]
    )
    return (
        partner.sales.filter(
            status=SaleStatus.APPROVED,
            fulfilled_at__isnull=False,
            payout_eligible_at__lte=when,
        )
        .exclude(id__in=already_batched)
        .distinct()
    )


def owed_commission(partner: Partner, as_of=None) -> Decimal:
    when = as_of or timezone.now()
    paid_ids = PartnerSale.objects.filter(
        partner=partner,
        payments__status=PaymentStatus.PAID,
    ).values_list("id", flat=True)
    total = (
        partner.sales.filter(
            status=SaleStatus.APPROVED,
            payout_eligible_at__lte=when,
        )
        .exclude(id__in=paid_ids)
        .aggregate(total=Sum("commission_amount"))["total"]
    )
    return total or Decimal("0.00")


def generate_monthly_payouts(*, as_of: date | None = None, dry_run: bool = False) -> list[dict]:
    as_of = as_of or timezone.localdate()
    period_start, period_end = payout_period(as_of)
    cutoff = timezone.make_aware(
        datetime.combine(period_end, time(23, 59, 59)),
        timezone.get_current_timezone(),
    )
    created = []

    partners = Partner.objects.filter(status=PartnerStatus.APPROVED)
    for partner in partners:
        sales = list(unpaid_eligible_sales(partner, as_of=cutoff))
        if not sales:
            continue

        amount = sum((sale.commission_amount for sale in sales), Decimal("0.00"))
        if amount <= 0:
            continue

        existing = PartnerPayment.objects.filter(
            partner=partner,
            period_start=period_start,
            period_end=period_end,
        ).first()
        if existing:
            created.append(
                {
                    "partner": partner.partner_code,
                    "amount": existing.amount,
                    "sales": existing.sales.count(),
                    "status": "already_exists",
                    "payment_id": existing.id,
                }
            )
            continue

        if dry_run:
            created.append(
                {
                    "partner": partner.partner_code,
                    "amount": amount,
                    "sales": len(sales),
                    "status": "would_create",
                    "payment_id": None,
                }
            )
            continue

        payment = PartnerPayment.objects.create(
            partner=partner,
            amount=amount,
            payment_method=partner.payment_method or "",
            period_start=period_start,
            period_end=period_end,
            status=PaymentStatus.PENDING,
            notes=(
                f"Monthly batch {period_start.isoformat()} to {period_end.isoformat()}. "
                "Staff send Venmo, PayPal, or bank, then mark Paid."
            ),
        )
        payment.sales.set(sales)
        created.append(
            {
                "partner": partner.partner_code,
                "amount": amount,
                "sales": len(sales),
                "status": "created",
                "payment_id": payment.id,
            }
        )

    return created