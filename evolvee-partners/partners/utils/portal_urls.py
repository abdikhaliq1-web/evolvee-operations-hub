"""Central URL helpers — one public base ties webhooks, apply, and tracking together."""
from urllib.parse import urlparse

from django.conf import settings
from django.urls import reverse


def _is_placeholder(value: str) -> bool:
    return not value or value.upper().startswith("PLACEHOLDER")


def get_portal_public_base() -> str:
    """
    Public HTTPS (or local) base for the partner portal.

    Priority: PARTNER_PORTAL_PUBLIC_URL → SHOPIFY_WEBHOOK_BASE_URL → tracking base.
    """
    for candidate in (
        getattr(settings, "PARTNER_PORTAL_PUBLIC_URL", ""),
        getattr(settings, "SHOPIFY_WEBHOOK_BASE_URL", ""),
    ):
        value = (candidate or "").strip().rstrip("/")
        if _is_placeholder(value):
            continue
        if not value.startswith(("http://", "https://")):
            value = f"https://{value}"
        return value

    tracking = (settings.PARTNER_TRACKING_BASE_URL or "").strip().rstrip("/")
    if tracking.endswith("/r"):
        base = tracking[:-2]
        if base and not _is_placeholder(base):
            return base

    return "http://127.0.0.1:8000"


def get_partner_apply_url() -> str:
    return f"{get_portal_public_base()}/apply/"


def get_partner_tracking_base_url() -> str:
    configured = (settings.PARTNER_TRACKING_BASE_URL or "").strip().rstrip("/")
    public = get_portal_public_base()

    if public.startswith("https://") and (
        _is_placeholder(configured)
        or configured.startswith("http://127.0.0.1")
        or configured.startswith("http://localhost")
    ):
        return f"{public}/r"

    if configured and not _is_placeholder(configured):
        return configured

    return f"{public}/r"


def get_shopify_webhook_base_url() -> str:
    configured = (settings.SHOPIFY_WEBHOOK_BASE_URL or "").strip().rstrip("/")
    if configured and not _is_placeholder(configured):
        return configured
    return get_portal_public_base()


def get_shopify_become_partner_page_url() -> str:
    from partners.utils.redirects import get_main_website_url

    store = get_main_website_url()
    if store.startswith("/"):
        return ""
    return f"{store.rstrip('/')}/pages/become-a-partner"


def portal_hostname() -> str | None:
    parsed = urlparse(get_portal_public_base())
    return parsed.hostname


def normalize_public_origin(url: str) -> tuple[str, str | None]:
    """Return (origin, hostname) e.g. ('https://foo.ngrok.dev', 'foo.ngrok.dev')."""
    value = (url or "").strip().rstrip("/")
    if not value or _is_placeholder(value):
        return "", None
    if not value.startswith(("http://", "https://")):
        value = f"https://{value}"
    parsed = urlparse(value)
    if not parsed.netloc:
        return "", None
    origin = f"{parsed.scheme}://{parsed.netloc}"
    return origin, parsed.hostname


def partner_apply_path() -> str:
    return reverse("partners:apply")
