"""
Shopify webhook handlers.

NOT CONNECTED YET — webhooks will work once PLACEHOLDER_SHOPIFY_* values in .env
are replaced with the actual Evolvée Radiance Shopify integration credentials.
"""
import json
import logging

from django.conf import settings
from django.http import HttpResponse, HttpResponseForbidden, JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST

from partners.models import ProgramActivity, ShopifyWebhookEvent
from partners.shopify.orders import (
    process_order_cancelled,
    process_order_paid,
    process_refund_created,
)
from partners.shopify.verification import verify_shopify_webhook
from partners.utils.activity import log_activity

logger = logging.getLogger(__name__)


def _get_header(request, name: str) -> str:
    return request.headers.get(name) or request.META.get(f"HTTP_{name.upper().replace('-', '_')}", "")


def _log_webhook(
    *,
    webhook_id: str,
    topic: str,
    status: str,
    shopify_order_id: str = "",
    partner=None,
    sale=None,
    error_message: str = "",
) -> ShopifyWebhookEvent:
    event, _ = ShopifyWebhookEvent.objects.update_or_create(
        webhook_id=webhook_id,
        defaults={
            "topic": topic,
            "shopify_order_id": shopify_order_id,
            "partner": partner,
            "sale": sale,
            "status": status,
            "error_message": error_message,
            "processed_at": timezone.now(),
        },
    )
    return event


@csrf_exempt
@require_POST
def shopify_webhook(request, topic: str):
    body = request.body
    hmac_header = _get_header(request, "X-Shopify-Hmac-Sha256")
    webhook_id = _get_header(request, "X-Shopify-Webhook-Id")
    shop_domain = _get_header(request, "X-Shopify-Shop-Domain")

    if settings.SHOPIFY_SHOP_DOMAIN and shop_domain and shop_domain != settings.SHOPIFY_SHOP_DOMAIN:
        return HttpResponseForbidden("Unexpected shop domain.")

    if not verify_shopify_webhook(body, hmac_header, settings.SHOPIFY_WEBHOOK_SECRET):
        logger.warning("Rejected Shopify webhook with invalid HMAC for topic %s", topic)
        return HttpResponseForbidden("Invalid webhook signature.")

    log_activity(
        ProgramActivity.EventType.WEBHOOK_RECEIVED,
        description=f"Shopify webhook received: {topic}.",
        metadata={"topic": topic, "webhook_id": webhook_id},
    )

    if webhook_id and ShopifyWebhookEvent.objects.filter(
        webhook_id=webhook_id,
        status__in=[
            ShopifyWebhookEvent.Status.PROCESSED,
            ShopifyWebhookEvent.Status.SKIPPED,
        ],
    ).exists():
        return JsonResponse({"status": "duplicate"})

    try:
        payload = json.loads(body.decode("utf-8"))
    except json.JSONDecodeError:
        _log_webhook(
            webhook_id=webhook_id or f"invalid-{timezone.now().timestamp()}",
            topic=topic,
            status=ShopifyWebhookEvent.Status.FAILED,
            error_message="Invalid JSON payload.",
        )
        return JsonResponse({"status": "invalid_payload"}, status=400)

    sale = None
    partner = None
    result = ""
    shopify_order_id = ""

    try:
        if topic == "orders/paid":
            shopify_order_id = str(payload.get("id", ""))
            sale, result = process_order_paid(payload)
            partner = sale.partner if sale else None
            status = (
                ShopifyWebhookEvent.Status.PROCESSED
                if sale
                else ShopifyWebhookEvent.Status.SKIPPED
            )
        elif topic == "orders/cancelled":
            shopify_order_id = str(payload.get("id", ""))
            sale, result = process_order_cancelled(payload)
            partner = sale.partner if sale else None
            status = (
                ShopifyWebhookEvent.Status.PROCESSED
                if sale
                else ShopifyWebhookEvent.Status.SKIPPED
            )
        elif topic == "refunds/create":
            shopify_order_id = str(payload.get("order_id", ""))
            sale, result = process_refund_created(payload)
            partner = sale.partner if sale else None
            status = (
                ShopifyWebhookEvent.Status.PROCESSED
                if sale
                else ShopifyWebhookEvent.Status.SKIPPED
            )
        else:
            return JsonResponse({"status": "unsupported_topic"}, status=404)
    except Exception as exc:
        logger.exception("Failed to process Shopify webhook %s", topic)
        _log_webhook(
            webhook_id=webhook_id or f"failed-{timezone.now().timestamp()}",
            topic=topic,
            status=ShopifyWebhookEvent.Status.FAILED,
            shopify_order_id=shopify_order_id,
            error_message=str(exc),
        )
        return JsonResponse({"status": "error"}, status=500)

    _log_webhook(
        webhook_id=webhook_id or f"{topic}-{shopify_order_id}-{timezone.now().timestamp()}",
        topic=topic,
        status=status,
        shopify_order_id=shopify_order_id,
        partner=partner,
        sale=sale,
        error_message="" if sale else result,
    )

    if status == ShopifyWebhookEvent.Status.PROCESSED:
        log_activity(
            ProgramActivity.EventType.WEBHOOK_PROCESSED,
            partner=partner,
            sale=sale,
            description=f"Shopify {topic} processed ({result}).",
            metadata={"topic": topic, "shopify_order_id": shopify_order_id},
        )
    elif status == ShopifyWebhookEvent.Status.SKIPPED:
        log_activity(
            ProgramActivity.EventType.WEBHOOK_PROCESSED,
            description=f"Shopify {topic} skipped ({result}).",
            metadata={"topic": topic, "shopify_order_id": shopify_order_id, "skipped": True},
        )

    return JsonResponse({"status": result, "attributed": bool(sale)})


@csrf_exempt
@require_POST
def orders_paid(request):
    return shopify_webhook(request, "orders/paid")


@csrf_exempt
@require_POST
def orders_cancelled(request):
    return shopify_webhook(request, "orders/cancelled")


@csrf_exempt
@require_POST
def refunds_create(request):
    return shopify_webhook(request, "refunds/create")
