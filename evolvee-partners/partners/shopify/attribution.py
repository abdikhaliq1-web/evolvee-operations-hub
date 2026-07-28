"""
Match Shopify orders to partners via discount codes, cart attributes, etc.

NOT CONNECTED YET — used by webhooks once PLACEHOLDER_SHOPIFY_* values are replaced.
"""
import re
from urllib.parse import parse_qs, urlparse

from django.db.models import Q

from partners.models import Partner, PartnerStatus


REF_ATTRIBUTE_NAMES = {"ref", "partner_code", "partner_ref", "partner", "discount_code"}


def lookup_partner_by_code(code: str) -> Partner | None:
    normalized = code.strip().upper().replace(" ", "")
    if not normalized:
        return None

    return (
        Partner.objects.filter(status=PartnerStatus.APPROVED)
        .filter(Q(partner_code__iexact=normalized) | Q(discount_code__iexact=normalized))
        .first()
    )


def extract_ref_from_url(url: str) -> Partner | None:
    if not url:
        return None

    parsed = urlparse(url)
    query_values = parse_qs(parsed.query)
    for key in ("ref", "partner", "partner_code", "discount_code"):
        if key in query_values and query_values[key]:
            partner = lookup_partner_by_code(query_values[key][0])
            if partner:
                return partner

    match = re.search(r"ref=([A-Za-z0-9-]+)", url, re.IGNORECASE)
    if match:
        return lookup_partner_by_code(match.group(1))

    return None


def find_partner_from_order(order_data: dict) -> Partner | None:
    for discount in order_data.get("discount_codes", []):
        partner = lookup_partner_by_code(discount.get("code", ""))
        if partner:
            return partner

    for attribute in order_data.get("note_attributes", []):
        name = (attribute.get("name") or "").lower()
        if name in REF_ATTRIBUTE_NAMES:
            partner = lookup_partner_by_code(attribute.get("value", ""))
            if partner:
                return partner

    for url_field in ("landing_site_ref", "referring_site"):
        partner = extract_ref_from_url(order_data.get(url_field, ""))
        if partner:
            return partner

    tags = order_data.get("tags", "")
    if tags:
        for tag in tags.split(","):
            if tag.strip().upper().startswith("ER-"):
                partner = lookup_partner_by_code(tag.strip())
                if partner:
                    return partner

    return None
