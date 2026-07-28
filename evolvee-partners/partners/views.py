from django.contrib import messages
from django.contrib.auth import login, logout
from django.contrib.auth.decorators import login_required
from django.contrib.auth.views import LoginView
from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404, redirect, render
from django.core.exceptions import ValidationError
from django.utils import timezone
from django.views.decorators.http import require_GET, require_http_methods, require_POST

from django.conf import settings

from partners.forms import PartnerPaymentMethodForm, PartnerProfileForm
from partners.models import MarketingAsset, Partner, PartnerClick, PartnerNotification, PartnerSale, PartnerStatus, ProgramActivity
from partners.serializers import PartnerApplicationSerializer
from partners.data.locations import list_continents
from partners.utils.activity import log_activity
from partners.utils.auth import get_post_login_url, is_admin_user
from partners.utils.commission import get_partner_chart_data, get_partner_stats
from partners.utils.location_helpers import apply_location_to_partner, location_initial_for_partner
from partners.utils.notifications import notify_partner_payment_updated
from partners.utils.payment_schemas import (
    build_payment_details_data,
    format_payment_details_for_admin,
    get_payment_fields,
    validate_payment_submission,
)
from partners.utils.qr_generator import ensure_partner_qr
from partners.utils.geoip import lookup_ip
from partners.utils.redirects import get_main_website_url


def get_client_ip(request):
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


def get_request_meta(request) -> dict:
    return {
        "ip_address": get_client_ip(request),
        "user_agent": request.META.get("HTTP_USER_AGENT", ""),
    }


@require_GET
def track_referral(request, partner_code):
    partner = get_object_or_404(Partner, partner_code=partner_code, status=PartnerStatus.APPROVED)
    meta = get_request_meta(request)

    if not request.session.session_key:
        request.session.create()

    geo = lookup_ip(meta["ip_address"])

    click = PartnerClick.objects.create(
        partner=partner,
        session_key=request.session.session_key or "",
        ip_address=meta["ip_address"],
        user_agent=meta["user_agent"],
        city=geo["city"],
        region=geo["region"],
        country=geo["country"],
        continent=geo["continent"],
    )

    request.session["partner_referral"] = partner.partner_code
    request.session.set_expiry(60 * 60 * 24 * 30)

    log_activity(
        ProgramActivity.EventType.QR_SCAN,
        partner=partner,
        click=click,
        description=f"Referral click from {meta['ip_address'] or 'unknown IP'}.",
        metadata={
            "partner_code": partner.partner_code,
            "source": "tracking_link",
            "city": geo["city"],
            "region": geo["region"],
            "country": geo["country"],
            "continent": geo["continent"],
        },
        **meta,
    )

    return redirect(partner.referral_url)


class PartnerLoginView(LoginView):
    template_name = "partners/login.html"
    redirect_authenticated_user = True

    def get_success_url(self):
        return get_post_login_url(self.request.user)

    def get_default_redirect_url(self):
        if self.request.user.is_authenticated:
            return get_post_login_url(self.request.user)
        return super().get_default_redirect_url()

    def form_valid(self, form):
        response = super().form_valid(form)
        partner = getattr(self.request.user, "partner_profile", None)
        log_activity(
            ProgramActivity.EventType.PARTNER_LOGIN,
            partner=partner,
            user=self.request.user,
            description=f"{self.request.user.email} logged in.",
            **get_request_meta(self.request),
        )
        return response


class AdminLoginView(PartnerLoginView):
    template_name = "partners/admin_login.html"

    def form_valid(self, form):
        response = super().form_valid(form)
        if not self.request.user.is_staff:
            logout(self.request)
            messages.error(
                self.request,
                "This login is for Evolvée Radiance staff only. Use partner login if you are an influencer.",
            )
            return redirect("partners:admin_login")
        return response


@require_http_methods(["GET", "POST"])
def logout_and_redirect(request):
    """Log out partner or staff and redirect to the main Evolvée Radiance website."""
    if request.user.is_authenticated:
        partner = getattr(request.user, "partner_profile", None)
        log_activity(
            ProgramActivity.EventType.PARTNER_LOGIN,
            partner=partner,
            user=request.user,
            description=f"{request.user.email} logged out.",
            metadata={"action": "logout"},
            **get_request_meta(request),
        )
        logout(request)

    return redirect(get_main_website_url())


@require_http_methods(["GET", "POST"])
def apply(request):
    if request.user.is_authenticated:
        if is_admin_user(request.user):
            return redirect("analytics:command_center")
        if hasattr(request.user, "partner_profile"):
            return redirect("partners:dashboard")

    if request.method == "POST":
        serializer = PartnerApplicationSerializer(data=request.POST)
        location_probe = Partner()
        location_errors = apply_location_to_partner(location_probe, request.POST)

        if serializer.is_valid() and not location_errors:
            data = serializer.validated_data
            from django.contrib.auth.models import User

            if User.objects.filter(email=data["email"]).exists():
                messages.error(request, "An account with this email already exists.")
            else:
                user = User.objects.create_user(
                    username=data["email"],
                    email=data["email"],
                    password=data["password"],
                    first_name=data["first_name"],
                    last_name=data["last_name"],
                )
                partner = Partner.objects.create(
                    user=user,
                    partner_name=data["partner_name"],
                    social_handle=data["social_handle"],
                    bio=data.get("bio", ""),
                    application_notes=data.get("application_notes", ""),
                )
                apply_location_to_partner(partner, request.POST)
                partner.save()
                log_activity(
                    ProgramActivity.EventType.PARTNER_APPLIED,
                    partner=partner,
                    user=user,
                    description=f"New application from {partner.partner_name}.",
                    metadata={
                        "partner_code": partner.partner_code,
                        "social_handle": partner.social_handle,
                        "city": partner.city,
                        "region": partner.region,
                        "country": partner.country,
                        "continent": partner.continent,
                    },
                    **get_request_meta(request),
                )
                login(request, user)
                messages.success(
                    request,
                    "Application submitted! You'll get your QR code and discount link once approved (typically 1–3 business days).",
                )
                return redirect("partners:dashboard")
        else:
            for field, errors in serializer.errors.items():
                for error in errors:
                    messages.error(request, f"{field}: {error}")
            for error in location_errors:
                messages.error(request, error)

    return render(
        request,
        "partners/apply.html",
        {
            "brand_name": settings.BRAND_NAME,
            "continents": list_continents(),
            "location_initial": {},
        },
    )


@login_required
def dashboard(request):
    if is_admin_user(request.user) and not getattr(request.user, "partner_profile", None):
        return redirect("analytics:command_center")

    partner = getattr(request.user, "partner_profile", None)
    if not partner:
        messages.error(request, "No partner profile found for this account.")
        return redirect("partners:apply")

    stats = get_partner_stats(partner)
    chart_data = get_partner_chart_data(partner)
    recent_sales = PartnerSale.objects.filter(partner=partner)[:10]
    recent_payments = partner.payments.all()[:5]
    assets = MarketingAsset.objects.filter(is_active=True)[:3]

    if partner.is_active:
        ensure_partner_qr(partner)
        partner.refresh_from_db(fields=["qr_code_image"])
        log_activity(
            ProgramActivity.EventType.DASHBOARD_VIEW,
            partner=partner,
            user=request.user,
            description=f"{partner.partner_name} viewed dashboard.",
            **get_request_meta(request),
        )

    payment_schedule_label = "Monthly" if settings.PAYMENT_SCHEDULE == "monthly" else "Bi-weekly"
    status_notifications = partner.notifications.filter(is_read=False)[:5]

    context = {
        "partner": partner,
        "stats": stats,
        "chart_data": chart_data,
        "recent_sales": recent_sales,
        "recent_payments": recent_payments,
        "assets": assets,
        "brand_name": settings.BRAND_NAME,
        "is_approved": partner.is_active,
        "approved_at": partner.approved_at,
        "payment_schedule": payment_schedule_label,
        "tracking_url": partner.tracking_url,
        "status_notifications": status_notifications,
    }
    return render(request, "partners/dashboard.html", context)


@login_required
def assets_hub(request):
    partner = getattr(request.user, "partner_profile", None)
    if not partner or not partner.is_active:
        messages.error(request, "Marketing assets are available after partner approval.")
        return redirect("partners:dashboard")

    assets = MarketingAsset.objects.filter(is_active=True)
    log_activity(
        ProgramActivity.EventType.ASSET_VIEWED,
        partner=partner,
        user=request.user,
        description=f"{partner.partner_name} opened marketing asset hub.",
        **get_request_meta(request),
    )

    return render(
        request,
        "partners/assets.html",
        {
            "partner": partner,
            "assets": assets,
            "brand_name": settings.BRAND_NAME,
        },
    )


@login_required
@require_GET
def download_asset(request, asset_id):
    partner = getattr(request.user, "partner_profile", None)
    if not partner or not partner.is_active:
        raise Http404

    asset = get_object_or_404(MarketingAsset, pk=asset_id, is_active=True)
    if not asset.file:
        raise Http404

    log_activity(
        ProgramActivity.EventType.ASSET_DOWNLOADED,
        partner=partner,
        user=request.user,
        description=f"Downloaded asset: {asset.title}.",
        metadata={"asset_id": asset.id, "asset_title": asset.title},
        **get_request_meta(request),
    )

    return FileResponse(asset.file.open("rb"), as_attachment=True, filename=asset.file.name.split("/")[-1])


@login_required
@require_http_methods(["POST"])
def log_copy_event(request):
    partner = getattr(request.user, "partner_profile", None)
    if not partner:
        return redirect("partners:dashboard")

    copy_type = request.POST.get("type", "link")
    log_activity(
        ProgramActivity.EventType.LINK_COPIED,
        partner=partner,
        user=request.user,
        description=f"Copied {copy_type} to clipboard.",
        metadata={"copy_type": copy_type},
        **get_request_meta(request),
    )
    return redirect("partners:dashboard")


@login_required
@require_http_methods(["GET", "POST"])
def profile(request):
    if is_admin_user(request.user) and not getattr(request.user, "partner_profile", None):
        return redirect("analytics:command_center")

    partner = getattr(request.user, "partner_profile", None)
    if not partner:
        messages.error(request, "No partner profile found for this account.")
        return redirect("partners:apply")

    profile_form = PartnerProfileForm(instance=partner)
    payment_form = PartnerPaymentMethodForm(initial={"payment_method": partner.payment_method})
    location_initial = location_initial_for_partner(partner)

    if request.method == "POST":
        section = request.POST.get("section")
        if section == "profile":
            profile_form = PartnerProfileForm(request.POST, instance=partner)
            location_errors = apply_location_to_partner(partner, request.POST)
            if profile_form.is_valid() and not location_errors:
                profile_form.save()
                partner.save()
                messages.success(request, "Profile updated.")
                return redirect("partners:profile")
            for error in location_errors:
                messages.error(request, error)
        elif section == "payment" and partner.is_active:
            payment_form = PartnerPaymentMethodForm(request.POST)
            if payment_form.is_valid():
                method = payment_form.cleaned_data["payment_method"]
                country_code = partner.country_code or request.POST.get("country_code", "")
                field_names = [field["name"] for field in get_payment_fields(method, country_code)]
                raw_fields = {name: request.POST.get(name, "") for name in field_names}
                try:
                    cleaned_fields = validate_payment_submission(method, country_code, raw_fields)
                except ValidationError as exc:
                    if hasattr(exc, "message_dict"):
                        for field, errs in exc.message_dict.items():
                            for err in errs:
                                messages.error(request, f"{field}: {err}")
                    else:
                        for err in exc.messages:
                            messages.error(request, err)
                    cleaned_fields = None

                if cleaned_fields is not None:
                    details_data = build_payment_details_data(method, country_code, cleaned_fields)
                    partner.payment_method = method
                    partner.payment_details_data = details_data
                    partner.payment_details = format_payment_details_for_admin(method, details_data)
                    partner.payment_details_updated_at = timezone.now()
                    partner.save(
                        update_fields=[
                            "payment_method",
                            "payment_details",
                            "payment_details_data",
                            "payment_details_updated_at",
                            "updated_at",
                        ]
                    )
                    notify_partner_payment_updated(partner)
                    messages.success(
                        request,
                        "Payment details saved. Our team can now pay you using this information.",
                    )
                    return redirect("partners:profile")
        else:
            messages.error(request, "Unable to save those details.")

    notifications = partner.notifications.all()[:20]

    return render(
        request,
        "partners/profile.html",
        {
            "partner": partner,
            "user_obj": request.user,
            "profile_form": profile_form,
            "payment_form": payment_form,
            "notifications": notifications,
            "brand_name": settings.BRAND_NAME,
            "continents": list_continents(),
            "location_initial": location_initial,
            "payment_initial": partner.payment_details_data or {},
        },
    )


@login_required
@require_POST
def mark_notification_read(request, notification_id):
    partner = getattr(request.user, "partner_profile", None)
    if not partner:
        return redirect("partners:dashboard")

    notification = get_object_or_404(PartnerNotification, pk=notification_id, partner=partner)
    notification.is_read = True
    notification.save(update_fields=["is_read"])
    return redirect("partners:profile")
