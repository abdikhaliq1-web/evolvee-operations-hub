"""
Process Shopify order webhooks into PartnerSale records.

NOT CONNECTED YET — requires PLACEHOLDER_SHOPIFY_* values in .env to be replaced
with actual integration credentials when store access is given.
"""
from decimal import Decimal

from django.utils import timezone

from partners.models import Partner, PartnerClick, PartnerSale, ProgramActivity, SaleStatus
from partners.shopify.attribution import find_partner_from_order
from partners.utils.activity import log_activity
from partners.utils.commission import calculate_commission, record_partner_sale, refresh_partner_totals


def extract_line_items(order_data: dict) -> list[dict]:
    items = []
    for line_item in order_data.get("line_items", []):
        items.append(
            {
                "id": line_item.get("id"),
                "title": line_item.get("title"),
                "sku": line_item.get("sku"),
                "quantity": line_item.get("quantity"),
                "price": line_item.get("price"),
                "variant_id": line_item.get("variant_id"),
                "product_id": line_item.get("product_id"),
            }
        )
    return items


def mark_click_converted(partner: Partner, sale: PartnerSale) -> None:
    click = (
        partner.clicks.filter(converted=False)
        .order_by("-clicked_at")
        .first()
    )
    if not click:
        return

    click.converted = True
    click.converted_at = timezone.now()
    click.sale = sale
    click.save(update_fields=["converted", "converted_at", "sale"])


def process_order_paid(order_data: dict) -> tuple[PartnerSale | None, str]:
    shopify_order_id = str(order_data["id"])
    existing = PartnerSale.objects.filter(shopify_order_id=shopify_order_id).first()
    if existing:
        if existing.status != SaleStatus.APPROVED:
            existing.status = SaleStatus.APPROVED
            existing.save(update_fields=["status", "updated_at"])
            refresh_partner_totals(existing.partner)
        return existing, "already_recorded"

    partner = find_partner_from_order(order_data)
    if not partner:
        return None, "no_partner_attribution"

    order_name = order_data.get("name") or shopify_order_id
    internal_order_id = f"SHOPIFY-{str(order_name).lstrip('#')}"

    if PartnerSale.objects.filter(order_id=internal_order_id).exists():
        internal_order_id = f"{internal_order_id}-{shopify_order_id}"

    subtotal = Decimal(str(order_data.get("subtotal_price") or order_data.get("total_price") or "0"))
    total = Decimal(str(order_data.get("total_price") or "0"))

    sale = record_partner_sale(
        partner=partner,
        order_id=internal_order_id,
        customer_email=order_data.get("email") or order_data.get("contact_email") or "",
        subtotal=subtotal,
        total=total,
        products_data=extract_line_items(order_data),
        shopify_order_id=shopify_order_id,
        status=SaleStatus.APPROVED,
    )
    mark_click_converted(partner, sale)
    log_activity(
        ProgramActivity.EventType.COMMISSION_EARNED,
        partner=partner,
        sale=sale,
        description=f"Commission ${sale.commission_amount} earned on {sale.order_id}.",
        metadata={"shopify_order_id": shopify_order_id, "source": "shopify"},
    )
    return sale, "created"


def process_order_cancelled(order_data: dict) -> tuple[PartnerSale | None, str]:
    shopify_order_id = str(order_data["id"])
    sale = PartnerSale.objects.filter(shopify_order_id=shopify_order_id).first()
    if not sale:
        return None, "sale_not_found"

    sale.status = SaleStatus.CANCELLED
    sale.save(update_fields=["status", "updated_at"])
    refresh_partner_totals(sale.partner)
    log_activity(
        ProgramActivity.EventType.SALE_CANCELLED,
        partner=sale.partner,
        sale=sale,
        description=f"Sale {sale.order_id} cancelled via Shopify.",
    )
    return sale, "cancelled"


def process_refund_created(refund_data: dict) -> tuple[PartnerSale | None, str]:
    shopify_order_id = str(refund_data.get("order_id", ""))
    if not shopify_order_id:
        return None, "missing_order_id"

    sale = PartnerSale.objects.filter(shopify_order_id=shopify_order_id).first()
    if not sale:
        return None, "sale_not_found"

    refunded_amount = Decimal("0.00")
    for transaction in refund_data.get("transactions", []):
        if transaction.get("kind") == "refund":
            refunded_amount += Decimal(str(transaction.get("amount") or "0"))

    if refunded_amount <= 0:
        for item in refund_data.get("refund_line_items", []):
            subtotal = item.get("subtotal") or item.get("line_item", {}).get("price") or "0"
            refunded_amount += Decimal(str(subtotal))

    if refunded_amount >= sale.total:
        sale.status = SaleStatus.REFUNDED
        sale.commission_amount = Decimal("0.00")
        sale.save(update_fields=["status", "commission_amount", "updated_at"])
        refresh_partner_totals(sale.partner)
        log_activity(
            ProgramActivity.EventType.SALE_REFUNDED,
            partner=sale.partner,
            sale=sale,
            description=f"Sale {sale.order_id} fully refunded.",
        )
        return sale, "fully_refunded"

    sale.total = max(sale.total - refunded_amount, Decimal("0.00"))
    sale.commission_amount = calculate_commission(sale.total, sale.partner.commission_percentage)
    sale.save(update_fields=["total", "commission_amount", "updated_at"])
    refresh_partner_totals(sale.partner)
    return sale, "partially_refunded"
