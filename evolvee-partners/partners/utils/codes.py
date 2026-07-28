import re
import secrets
import string

from django.utils import timezone

from partners.models import Partner

CODE_PREFIX = "ER-"
PARTNER_CODE_SUFFIX_LENGTH = 6
DISCOUNT_SUFFIX_MIN = 5
DISCOUNT_SUFFIX_MAX = 7


def _name_letters(partner_name: str) -> str:
    letters = re.sub(r"[^A-Za-z]", "", partner_name or "").upper()
    if len(letters) < 3:
        letters = (letters + "CREATOR")[:3]
    return letters


def _year_suffix() -> str:
    return str(timezone.now().year % 100).zfill(2)


def _discount_code_exists(code: str, exclude_pk=None) -> bool:
    qs = Partner.objects.filter(discount_code__iexact=code)
    if exclude_pk:
        qs = qs.exclude(pk=exclude_pk)
    return qs.exists()


def _partner_code_exists(code: str, exclude_pk=None) -> bool:
    qs = Partner.objects.filter(partner_code__iexact=code)
    if exclude_pk:
        qs = qs.exclude(pk=exclude_pk)
    return qs.exists()


def generate_partner_code(exclude_pk=None) -> str:
    """Admin creator ID: ER- + 6 random uppercase letters/digits."""
    alphabet = string.ascii_uppercase + string.digits
    for _ in range(80):
        suffix = "".join(secrets.choice(alphabet) for _ in range(PARTNER_CODE_SUFFIX_LENGTH))
        code = f"{CODE_PREFIX}{suffix}"
        if not _partner_code_exists(code, exclude_pk=exclude_pk):
            return code
    raise ValueError("Unable to generate a unique partner code.")


def generate_discount_code(partner_name: str, exclude_pk=None) -> str:
    """
    Creator-facing discount code: ER- + 5–7 chars from name + year.
    Example: Junjunpanda -> ER-JUN26
    """
    letters = _name_letters(partner_name)
    year = _year_suffix()

    candidates: list[str] = []

    for name_len in range(3, min(len(letters), DISCOUNT_SUFFIX_MAX - len(year)) + 1):
        suffix = (letters[:name_len] + year)[:DISCOUNT_SUFFIX_MAX]
        if DISCOUNT_SUFFIX_MIN <= len(suffix) <= DISCOUNT_SUFFIX_MAX:
            candidates.append(suffix)

    for name_len in range(3, len(letters) + 1):
        suffix = (letters[:name_len] + year)[:DISCOUNT_SUFFIX_MAX]
        if len(suffix) >= DISCOUNT_SUFFIX_MIN:
            candidates.append(suffix)

    for extra_index in range(1, len(letters)):
        for name_len in range(3, min(len(letters), DISCOUNT_SUFFIX_MAX - len(year)) + 1):
            suffix = (letters[:name_len] + letters[extra_index] + year)[:DISCOUNT_SUFFIX_MAX]
            if DISCOUNT_SUFFIX_MIN <= len(suffix) <= DISCOUNT_SUFFIX_MAX:
                candidates.append(suffix)

    seen = set()
    for suffix in sorted(candidates, key=len):
        if suffix in seen:
            continue
        seen.add(suffix)
        code = f"{CODE_PREFIX}{suffix}"
        if not _discount_code_exists(code, exclude_pk=exclude_pk):
            return code

    for attempt in range(1, 100):
        suffix = (letters[:3] + letters[attempt % len(letters)] + year)[:DISCOUNT_SUFFIX_MAX]
        if len(suffix) < DISCOUNT_SUFFIX_MIN:
            suffix = (letters + year)[:DISCOUNT_SUFFIX_MIN].ljust(DISCOUNT_SUFFIX_MIN, "X")
        code = f"{CODE_PREFIX}{suffix}"
        if not _discount_code_exists(code, exclude_pk=exclude_pk):
            return code

    raise ValueError("Unable to generate a unique discount code.")


def assign_creator_codes(partner: Partner) -> bool:
    """Assign admin ID + discount code when a partner is approved. Returns True if updated."""
    from partners.models import PartnerStatus

    if partner.status != PartnerStatus.APPROVED:
        return False

    updated = False
    if not partner.partner_code:
        partner.partner_code = generate_partner_code(exclude_pk=partner.pk)
        updated = True
    if not partner.discount_code:
        partner.discount_code = generate_discount_code(partner.partner_name, exclude_pk=partner.pk)
        updated = True
    return updated
