"""
Register Shopify webhooks with the Evolvée Radiance store.

NOT CONNECTED YET — run this command only after replacing all
PLACEHOLDER_SHOPIFY_* values in .env with actual integration credentials.
"""
import json
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError


WEBHOOK_TOPICS = [
    ("orders/paid", "webhooks/shopify/orders/paid/"),
    ("orders/cancelled", "webhooks/shopify/orders/cancelled/"),
    ("refunds/create", "webhooks/shopify/refunds/create/"),
]


class Command(BaseCommand):
    help = (
        "Register Shopify webhooks for automatic partner order tracking. "
        "NOT CONNECTED YET — replace PLACEHOLDER_SHOPIFY_* in .env first."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--base-url",
            help="Public base URL for webhook callbacks (overrides SHOPIFY_WEBHOOK_BASE_URL)",
        )
        parser.add_argument(
            "--list",
            action="store_true",
            help="List existing Shopify webhooks instead of creating them",
        )

    def handle(self, *args, **options):
        shop_domain = settings.SHOPIFY_SHOP_DOMAIN
        access_token = settings.SHOPIFY_ACCESS_TOKEN
        api_version = settings.SHOPIFY_API_VERSION
        base_url = (options.get("base_url") or settings.SHOPIFY_WEBHOOK_BASE_URL or "").rstrip("/")

        if not shop_domain or not access_token:
            raise CommandError(
                "Shopify not connected yet. Replace PLACEHOLDER_SHOPIFY_SHOP_DOMAIN and "
                "PLACEHOLDER_SHOPIFY_ACCESS_TOKEN in .env with actual credentials first."
            )

        api_base = f"https://{shop_domain}/admin/api/{api_version}"

        if options["list"]:
            self._list_webhooks(api_base, access_token)
            return

        if not base_url:
            raise CommandError(
                "Replace PLACEHOLDER_SHOPIFY_WEBHOOK_BASE_URL in .env or pass --base-url "
                "with the actual public URL when integration is ready."
            )

        for topic, path in WEBHOOK_TOPICS:
            address = f"{base_url}/{path}"
            payload = json.dumps({"webhook": {"topic": topic, "address": address, "format": "json"}}).encode()
            request = Request(
                f"{api_base}/webhooks.json",
                data=payload,
                headers={
                    "Content-Type": "application/json",
                    "X-Shopify-Access-Token": access_token,
                },
                method="POST",
            )
            try:
                with urlopen(request) as response:
                    data = json.loads(response.read().decode())
                    webhook_id = data.get("webhook", {}).get("id")
                    self.stdout.write(self.style.SUCCESS(f"Registered {topic} → {address} (id={webhook_id})"))
            except HTTPError as exc:
                body = exc.read().decode()
                self.stdout.write(self.style.WARNING(f"Could not register {topic}: {exc.code} {body}"))
            except URLError as exc:
                raise CommandError(f"Network error registering {topic}: {exc}") from exc

    def _list_webhooks(self, api_base: str, access_token: str):
        request = Request(
            f"{api_base}/webhooks.json",
            headers={"X-Shopify-Access-Token": access_token},
        )
        with urlopen(request) as response:
            data = json.loads(response.read().decode())

        for webhook in data.get("webhooks", []):
            self.stdout.write(f"{webhook.get('id')}: {webhook.get('topic')} → {webhook.get('address')}")
