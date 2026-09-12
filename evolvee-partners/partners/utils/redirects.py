from django.conf import settings
from django.urls import reverse


def get_main_website_url() -> str:
    """
    Return the Evolvée Radiance main website URL for post-logout redirects.

    PLACEHOLDER — replace MAIN_WEBSITE_URL in .env with the actual store homepage
    when the main website link is provided.
    """
    url = (settings.MAIN_WEBSITE_URL or "").strip().rstrip("/")

    if not url or url.startswith("PLACEHOLDER"):
        return reverse("partners:apply")

    if not url.startswith(("http://", "https://")):
        url = f"https://{url}"

    return url
