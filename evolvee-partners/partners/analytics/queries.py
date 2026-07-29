from datetime import timedelta
from decimal import Decimal

from django.db.models import Count, Q, Sum
from django.db.models.functions import TruncDate
from django.utils import timezone

from partners.models import (
    Partner,
    PartnerClick,
    PartnerSale,
    PartnerStatus,
    ProgramActivity,
    SaleStatus,
)


def get_program_kpis() -> dict:
    now = timezone.now()
    thirty_days_ago = now - timedelta(days=30)

    approved_partners = Partner.objects.filter(status=PartnerStatus.APPROVED).count()
    pending_partners = Partner.objects.filter(status=PartnerStatus.PENDING).count()
    total_clicks = PartnerClick.objects.count()
    recent_clicks = PartnerClick.objects.filter(clicked_at__gte=thirty_days_ago).count()
    total_conversions = PartnerClick.objects.filter(converted=True).count()
    approved_sales = PartnerSale.objects.filter(status=SaleStatus.APPROVED)
    total_revenue = approved_sales.aggregate(total=Sum("total"))["total"] or Decimal("0.00")
    total_commission = approved_sales.aggregate(total=Sum("commission_amount"))["total"] or Decimal("0.00")
    pending_commission = PartnerSale.objects.filter(status=SaleStatus.PENDING).aggregate(
        total=Sum("commission_amount")
    )["total"] or Decimal("0.00")

    return {
        "approved_partners": approved_partners,
        "pending_partners": pending_partners,
        "total_clicks": total_clicks,
        "recent_clicks": recent_clicks,
        "total_conversions": total_conversions,
        "conversion_rate": round(
            (total_conversions / total_clicks * 100) if total_clicks else 0,
            1,
        ),
        "total_revenue": total_revenue,
        "total_commission": total_commission,
        "pending_commission": pending_commission,
        "total_sales_count": approved_sales.count(),
    }


def get_daily_metrics(days: int = 30) -> dict:
    since = timezone.now() - timedelta(days=days)

    click_rows = (
        PartnerClick.objects.filter(clicked_at__gte=since)
        .annotate(day=TruncDate("clicked_at"))
        .values("day")
        .annotate(clicks=Count("id"))
        .order_by("day")
    )
    clicks_by_day = {str(r["day"]): r["clicks"] for r in click_rows}

    conversion_rows = (
        PartnerClick.objects.filter(converted=True, converted_at__gte=since)
        .annotate(day=TruncDate("converted_at"))
        .values("day")
        .annotate(count=Count("id"))
        .order_by("day")
    )
    conversions_by_day = {str(r["day"]): r["count"] for r in conversion_rows}

    sale_rows = (
        PartnerSale.objects.filter(created_at__gte=since, status=SaleStatus.APPROVED)
        .annotate(day=TruncDate("created_at"))
        .values("day")
        .annotate(
            sales=Count("id"),
            revenue=Sum("total"),
            commission=Sum("commission_amount"),
        )
        .order_by("day")
    )
    sales_by_day = {str(r["day"]): r["sales"] for r in sale_rows}
    revenue_by_day = {str(r["day"]): float(r["revenue"] or 0) for r in sale_rows}
    commission_by_day = {str(r["day"]): float(r["commission"] or 0) for r in sale_rows}

    labels = sorted(
        set(clicks_by_day) | set(conversions_by_day) | set(sales_by_day) | set(revenue_by_day)
    )

    return {
        "labels": labels,
        "clicks": [clicks_by_day.get(label, 0) for label in labels],
        "conversions": [conversions_by_day.get(label, 0) for label in labels],
        "sales": [sales_by_day.get(label, 0) for label in labels],
        "revenue": [revenue_by_day.get(label, 0) for label in labels],
        "commission": [commission_by_day.get(label, 0) for label in labels],
    }


def get_partner_leaderboard(limit: int = 10) -> list[dict]:
    partners = (
        Partner.objects.filter(status=PartnerStatus.APPROVED)
        .annotate(
            click_count=Count("clicks"),
            conversion_count=Count("clicks", filter=Q(clicks__converted=True)),
        )
        .order_by("-total_commission_earned")[:limit]
    )

    leaderboard = []
    for partner in partners:
        leaderboard.append(
            {
                "id": partner.id,
                "partner_name": partner.partner_name,
                "partner_code": partner.partner_code,
                "location": partner.location_label,
                "city": partner.city,
                "region": partner.region,
                "country": partner.country,
                "continent": partner.continent,
                "clicks": partner.click_count,
                "conversions": partner.conversion_count,
                "revenue": partner.total_sales,
                "commission": partner.total_commission_earned,
            }
        )
    return leaderboard


def get_region_breakdown(days: int = 30, limit: int = 15) -> list[dict]:
    """Top scan locations aggregated by city, region, and country."""
    since = timezone.now() - timedelta(days=days)
    rows = (
        PartnerClick.objects.filter(clicked_at__gte=since)
        .exclude(country="")
        .values("city", "region", "country")
        .annotate(scans=Count("id"), conversions=Count("id", filter=Q(converted=True)))
        .order_by("-scans")[:limit]
    )

    from partners.utils.geoip import format_location

    breakdown = []
    for row in rows:
        breakdown.append(
            {
                "location": format_location(row["city"], row["region"], row["country"]),
                "city": row["city"],
                "region": row["region"],
                "country": row["country"],
                "scans": row["scans"],
                "conversions": row["conversions"],
            }
        )
    return breakdown


def get_country_breakdown(days: int = 30) -> list[dict]:
    since = timezone.now() - timedelta(days=days)
    rows = (
        PartnerClick.objects.filter(clicked_at__gte=since)
        .exclude(country="")
        .values("country")
        .annotate(scans=Count("id"), conversions=Count("id", filter=Q(converted=True)))
        .order_by("-scans")
    )
    return [{"country": r["country"], "scans": r["scans"], "conversions": r["conversions"]} for r in rows]


def get_partner_click_regions(partner: Partner, days: int = 30, limit: int = 10) -> list[dict]:
    since = timezone.now() - timedelta(days=days)
    rows = (
        partner.clicks.filter(clicked_at__gte=since)
        .exclude(country="")
        .values("city", "region", "country")
        .annotate(scans=Count("id"), conversions=Count("id", filter=Q(converted=True)))
        .order_by("-scans")[:limit]
    )

    from partners.utils.geoip import format_location

    return [
        {
            "location": format_location(row["city"], row["region"], row["country"]),
            "scans": row["scans"],
            "conversions": row["conversions"],
        }
        for row in rows
    ]


def get_activity_feed(limit: int = 50, event_type: str = "") -> list[ProgramActivity]:
    qs = ProgramActivity.objects.select_related("partner", "user", "sale", "click", "payment")
    if event_type:
        qs = qs.filter(event_type=event_type)
    return list(qs[:limit])


def get_event_type_counts(days: int = 30) -> list[dict]:
    since = timezone.now() - timedelta(days=days)
    rows = (
        ProgramActivity.objects.filter(created_at__gte=since)
        .values("event_type")
        .annotate(count=Count("id"))
        .order_by("-count")
    )
    return [{"event_type": r["event_type"], "count": r["count"]} for r in rows]
