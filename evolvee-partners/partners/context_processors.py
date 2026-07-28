from partners.utils.redirects import get_main_website_url


def site_urls(request):
    context = {"main_website_url": get_main_website_url()}

    if request.user.is_authenticated and hasattr(request.user, "partner_profile"):
        partner = request.user.partner_profile
        context["partner_profile"] = partner
        context["unread_notification_count"] = partner.notifications.filter(is_read=False).count()
    else:
        context["partner_profile"] = None
        context["unread_notification_count"] = 0

    return context
