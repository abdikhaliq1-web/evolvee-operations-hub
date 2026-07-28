import io

import qrcode
from django.core.files.base import ContentFile

from partners.models import Partner


def generate_qr_code_image(referral_url: str, partner_code: str) -> ContentFile:
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=10,
        border=4,
    )
    qr.add_data(referral_url)
    qr.make(fit=True)

    img = qr.make_image(fill_color="black", back_color="white")
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    buffer.seek(0)

    filename = f"qr_{partner_code}.png"
    return ContentFile(buffer.read(), name=filename)


def ensure_partner_qr(partner: Partner) -> bool:
    """Generate and save a QR code for an approved partner if missing. Returns True if created."""
    if not partner.is_active or partner.qr_code_image:
        return False
    qr_file = generate_qr_code_image(partner.tracking_url, partner.partner_code)
    partner.qr_code_image.save(qr_file.name, qr_file, save=True)
    return True
