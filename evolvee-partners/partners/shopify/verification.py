"""
Verify Shopify webhook HMAC signatures.

NOT CONNECTED YET — requires PLACEHOLDER_SHOPIFY_WEBHOOK_SECRET to be replaced
with the actual secret when integration is provided.
"""
import base64
import hashlib
import hmac


def verify_shopify_webhook(body: bytes, hmac_header: str, secret: str) -> bool:
    if not secret or not hmac_header:
        return False

    digest = hmac.new(secret.encode("utf-8"), body, hashlib.sha256).digest()
    computed = base64.b64encode(digest).decode("utf-8")
    return hmac.compare_digest(computed, hmac_header)
