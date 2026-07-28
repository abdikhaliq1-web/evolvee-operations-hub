import csv

from django.contrib.admin.views.decorators import staff_member_required
from django.http import HttpResponse
from django.shortcuts import get_object_or_404, render

from partners.analytics.queries import (
    get_activity_feed,
    get_country_breakdown,
    get_daily_metrics,
    get_event_type_counts,
    get_partner_click_regions,
    get_partner_leaderboard,
    get_program_kpis,
    get_region_breakdown,
)
from partners.models import Partner, ProgramActivity
from partners.utils.commission import get_partner_chart_data, get_partner_stats


@staff_member_required(login_url="partners:admin_login")
def command_center(request):
    days = int(request.GET.get("days", 30))
    event_filter = request.GET.get("event", "")

    context = {
        "kpis": get_program_kpis(),
        "chart_data": get_daily_metrics(days=days),
        "leaderboard": get_partner_leaderboard(),
        "region_breakdown": get_region_breakdown(days=days),
        "country_breakdown": get_country_breakdown(days=days),
        "activities": get_activity_feed(limit=100, event_type=event_filter),
        "event_counts": get_event_type_counts(days=days),
        "event_types": ProgramActivity.EventType.choices,
        "selected_days": days,
        "selected_event": event_filter,
        "brand_name": "Evolvée Radiance",
        "active_admin_nav": "overview",
    }
    return render(request, "analytics/command_center.html", context)


@staff_member_required(login_url="partners:admin_login")
def partner_detail(request, partner_id):
    partner = get_object_or_404(Partner, pk=partner_id)
    days = int(request.GET.get("days", 30))

    context = {
        "partner": partner,
        "stats": get_partner_stats(partner),
        "chart_data": get_partner_chart_data(partner),
        "click_regions": get_partner_click_regions(partner, days=days),
        "recent_clicks": partner.clicks.select_related("sale").order_by("-clicked_at")[:25],
        "recent_sales": partner.sales.order_by("-created_at")[:15],
        "recent_activities": partner.activities.order_by("-created_at")[:20],
        "selected_days": days,
        "brand_name": "Evolvée Radiance",
        "active_admin_nav": "partners",
    }
    return render(request, "analytics/partner_detail.html", context)


@staff_member_required(login_url="partners:admin_login")
def export_activity_csv(request):
    days = int(request.GET.get("days", 30))
    from django.utils import timezone
    from datetime import timedelta

    since = timezone.now() - timedelta(days=days)
    activities = (
        ProgramActivity.objects.filter(created_at__gte=since)
        .select_related("partner", "user")
        .order_by("-created_at")
    )

    response = HttpResponse(content_type="text/csv")
    response["Content-Disposition"] = f'attachment; filename="program-activity-{days}d.csv"'

    writer = csv.writer(response)
    writer.writerow([
        "timestamp",
        "event_type",
        "description",
        "partner_code",
        "partner_name",
        "user",
        "ip_address",
        "metadata",
    ])

    for activity in activities:
        writer.writerow([
            activity.created_at.isoformat(),
            activity.event_type,
            activity.description,
            activity.partner.partner_code if activity.partner else "",
            activity.partner.partner_name if activity.partner else "",
            activity.user.email if activity.user else "",
            activity.ip_address or "",
            activity.metadata,
        ])

    return response


@staff_member_required(login_url="partners:admin_login")
def export_partners_xlsx(request):
    from partners.analytics.exports import build_partners_workbook

    buffer = build_partners_workbook()
    response = HttpResponse(
        buffer.getvalue(),
        content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )
    response["Content-Disposition"] = 'attachment; filename="evolvee-creators-report.xlsx"'
    return response
