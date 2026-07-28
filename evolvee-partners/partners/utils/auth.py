from django.urls import reverse


def is_admin_user(user) -> bool:
    """Staff and superusers use the admin Command Center, not the partner portal."""
    return user.is_authenticated and user.is_staff


def get_post_login_url(user) -> str:
    if is_admin_user(user):
        return reverse("analytics:command_center")
    return reverse("partners:dashboard")
