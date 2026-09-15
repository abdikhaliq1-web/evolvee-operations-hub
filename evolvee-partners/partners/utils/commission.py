from decimal import Decimal

from django.db.models import Count, Sum
from django.db.models.functions import TruncDate
from django.utils import timezone

from partners.models import Partner, PartnerSale, SaleStatus


def calculate_commission(total: Decimal, commission_percentage: Decimal) -> Decimal:
    return (total * commission_percentage / Decimal("100")).quantize(Decimal("0.01"))


def record_partner_sale(
    *,
    partner: Partner,
    order_id: str,
    customer_email: str,
    subtotal: Decimal,
    total: Decimal,
    products_data=None,
    shopify_order_id: str = "",
    status: str = SaleStatus.PENDING,
) -> PartnerSale:
    commission_amount = calculate_commission(total, partner.commission_percentage)
    sale = PartnerSale.objects.create(
        order_id=order_id,
        partner=partner,
        customer_email=customer_email,
        subtotal=subtotal,
        total=total,
        commission_amount=commission_amount,
        status=status,
        products_data=products_data or [],
        shopify_order_id=shopify_order_id,
    )
    refresh_partner_totals(partner)
    return sale


def refresh_partner_totals(partner: Partner) -> None:
    approved_sales = partner.sales.filter(status=SaleStatus.APPROVED)
    totals = approved_sales.aggregate(
        sales_total=Sum("total"),
        commission_total=Sum("commission_amount"),
    )
    partner.total_sales = totals["sales_total"] or Decimal("0.00")
    partner.total_commission_earned = totals["commission_total"] or Decimal("0.00")
    partner.save(update_fields=["total_sales", "total_commission_earned", "updated_at"])


def get_partner_stats(partner: Partner) -> dict:
    now = timezone.now()
    thirty_days_ago = now - timezone.timedelta(days=30)

    recent_clicks = partner.clicks.filter(clicked_at__gte=thirty_days_ago).count()
    recent_conversions = partner.clicks.filter(
        clicked_at__gte=thirty_days_ago,
        converted=True,
    ).count()
    pending_commission = partner.sales.filter(status=SaleStatus.PENDING).aggregate(
        total=Sum("commission_amount")
    )["total"] or Decimal("0.00")
    approved_commission = partner.sales.filter(status=SaleStatus.APPROVED).aggregate(
        total=Sum("commission_amount")
    )["total"] or Decimal("0.00")

    return {
        "total_clicks": partner.clicks.count(),
        "total_conversions": partner.clicks.filter(converted=True).count(),
        "recent_clicks": recent_clicks,
        "recent_conversions": recent_conversions,
        "total_sales": partner.total_sales,
        "total_commission_earned": partner.total_commission_earned,
        "pending_commission": pending_commission,
        "approved_commission": approved_commission,
        "conversion_rate": round(
            (partner.clicks.filter(converted=True).count() / partner.clicks.count() * 100)
            if partner.clicks.count()
            else 0,
            1,
        ),
    }


def get_partner_chart_data(partner: Partner, days: int = 30) -> dict:
    since = timezone.now() - timezone.timedelta(days=days)

    click_rows = (
        partner.clicks.filter(clicked_at__gte=since)
        .annotate(day=TruncDate("clicked_at"))
        .values("day")
        .annotate(count=Count("id"))
        .order_by("day")
    )
    clicks_by_day = {str(row["day"]): row["count"] for row in click_rows}

    conversion_rows = (
        partner.clicks.filter(converted=True, converted_at__gte=since)
        .annotate(day=TruncDate("converted_at"))
        .values("day")
        .order_by("day")
        .distinct()
    )
    conversions_by_day = {
        str(row["day"]): partner.clicks.filter(converted_at__date=row["day"], converted=True).count()
        for row in conversion_rows
    }

    sale_rows = (
        partner.sales.filter(created_at__gte=since, status=SaleStatus.APPROVED)
        .annotate(day=TruncDate("created_at"))
        .values("day")
        .annotate(revenue=Sum("total"), commission=Sum("commission_amount"))
        .order_by("day")
    )
    revenue_by_day = {str(r["day"]): float(r["revenue"] or 0) for r in sale_rows}
    commission_by_day = {str(r["day"]): float(r["commission"] or 0) for r in sale_rows}

    labels = sorted(set(clicks_by_day) | set(conversions_by_day) | set(revenue_by_day))

    return {
        "labels": labels,
        "clicks": [clicks_by_day.get(label, 0) for label in labels],
        "conversions": [conversions_by_day.get(label, 0) for label in labels],
        "revenue": [revenue_by_day.get(label, 0) for label in labels],
        "commission": [commission_by_day.get(label, 0) for label in labels],
    }
