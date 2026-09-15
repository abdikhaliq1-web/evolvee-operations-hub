"""Print partner portal URLs and Shopify redirect instructions."""
from django.core.management.base import BaseCommand

from partners.utils.redirects import get_main_website_url
from partners.utils.portal_urls import (
    get_partner_apply_url,
    get_partner_tracking_base_url,
    get_portal_public_base,
    get_shopify_become_partner_page_url,
    get_shopify_webhook_base_url,
)


class Command(BaseCommand):
    help = "Show unified portal URLs and Shopify setup values (all derived from PARTNER_PORTAL_PUBLIC_URL)."

    def handle(self, *args, **options):
        public = get_portal_public_base()
        apply_url = get_partner_apply_url()
        tracking = get_partner_tracking_base_url()
        webhooks = get_shopify_webhook_base_url()
        shopify_page = get_shopify_become_partner_page_url()
        store_home = get_main_website_url()

        self.stdout.write(self.style.SUCCESS("Partner portal URLs (keep in sync via .env):"))
        self.stdout.write(f"  PARTNER_PORTAL_PUBLIC_URL → {public}")
        self.stdout.write(f"  Apply form              → {apply_url}")
        self.stdout.write(f"  Tracking links (/r/…)   → {tracking}/<code>/")
        self.stdout.write(f"  Shopify webhooks base   → {webhooks}")
        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS("Shopify store integration:"))
        self.stdout.write(f"  Store homepage          → {store_home}")
        if shopify_page:
            self.stdout.write(f"  Become A Partner page   → {shopify_page}")
            self.stdout.write(f"  Redirect FROM           → /pages/become-a-partner")
            self.stdout.write(f"  Redirect TO             → {apply_url}")
        self.stdout.write("")
        self.stdout.write("Shopify Admin → URL redirects → create redirect FROM → TO above.")
        self.stdout.write("Main menu → Become A Partner → external link → apply URL above.")
        self.stdout.write("")
        self.stdout.write("Register webhooks:")
        self.stdout.write("  python manage.py register_shopify_webhooks")
