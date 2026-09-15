from partners.utils.portal_urls import (
    get_partner_apply_url,
    get_partner_tracking_base_url,
    get_portal_public_base,
    get_shopify_become_partner_page_url,
    get_shopify_webhook_base_url,
)
from partners.utils.redirects import get_main_website_url


def site_urls(request):
    context = {
        "main_website_url": get_main_website_url(),
        "partner_portal_public_url": get_portal_public_base(),
        "partner_apply_url": get_partner_apply_url(),
        "partner_tracking_base_url": get_partner_tracking_base_url(),
        "shopify_webhook_base_url": get_shopify_webhook_base_url(),
        "shopify_become_partner_page_url": get_shopify_become_partner_page_url(),
    }

    if request.user.is_authenticated and hasattr(request.user, "partner_profile"):
        partner = request.user.partner_profile
        context["partner_profile"] = partner
        context["unread_notification_count"] = partner.notifications.filter(is_read=False).count()
    else:
        context["partner_profile"] = None
        context["unread_notification_count"] = 0

    return context
