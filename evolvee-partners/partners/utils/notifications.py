from django.conf import settings
from django.core.mail import send_mail
from django.template.loader import render_to_string

from partners.models import Partner, PartnerNotification, PartnerStatus


DEFAULT_STATUS_MESSAGES = {
    PartnerStatus.APPROVED: (
        "Your partner application has been approved!",
        "Welcome to the Evolvée Radiance partner program. Your creator ID, discount code, QR code, and referral tools are ready on your dashboard.",
    ),
    PartnerStatus.REJECTED: (
        "Your partner application was not approved",
        "Thank you for applying. We are unable to approve your application at this time.",
    ),
    PartnerStatus.SUSPENDED: (
        "Your partner account has been suspended",
        "Your partner account has been temporarily suspended. Please contact us if you have questions.",
    ),
}

NOTIFICATION_TYPES = {
    PartnerStatus.APPROVED: PartnerNotification.NotificationType.APPROVED,
    PartnerStatus.REJECTED: PartnerNotification.NotificationType.REJECTED,
    PartnerStatus.SUSPENDED: PartnerNotification.NotificationType.SUSPENDED,
}


def notify_partner_status_change(
    partner: Partner,
    new_status: str,
    admin_message: str = "",
) -> PartnerNotification | None:
    if new_status not in DEFAULT_STATUS_MESSAGES:
        return None

    default_title, default_body = DEFAULT_STATUS_MESSAGES[new_status]
    title = default_title
    body = admin_message.strip() if admin_message else default_body

    notification = PartnerNotification.objects.create(
        partner=partner,
        notification_type=NOTIFICATION_TYPES[new_status],
        title=title,
        message=body,
    )

    _send_status_email(partner, title, body, new_status)
    return notification


def notify_partner_payment_updated(partner: Partner) -> None:
    title = "Payment details saved"
    body = (
        "Your payout information has been updated and is now visible to our team for future payments."
    )
    PartnerNotification.objects.create(
        partner=partner,
        notification_type=PartnerNotification.NotificationType.PAYMENT,
        title=title,
        message=body,
    )


def _send_status_email(partner: Partner, subject: str, body: str, status: str) -> None:
    if not partner.user.email:
        return

    context = {
        "partner": partner,
        "subject": subject,
        "body": body,
        "status": status,
        "brand_name": settings.BRAND_NAME,
        "portal_url": _portal_url(),
        "profile_url": _profile_url(),
    }

    text_message = render_to_string("partners/emails/status_notification.txt", context)
    html_message = render_to_string("partners/emails/status_notification.html", context)

    send_mail(
        subject=f"{settings.BRAND_NAME} Partners — {subject}",
        message=text_message,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[partner.user.email],
        html_message=html_message,
        fail_silently=True,
    )


def _portal_url() -> str:
    base = settings.PARTNER_TRACKING_BASE_URL.rsplit("/r", 1)[0]
    if not base or base == settings.PARTNER_TRACKING_BASE_URL:
        return "http://127.0.0.1:8000/"
    return f"{base}/"


def _profile_url() -> str:
    return f"{_portal_url().rstrip('/')}/profile/"
