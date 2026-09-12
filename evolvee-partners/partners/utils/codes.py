import re
import secrets
import string

from django.utils import timezone

from partners.models import Partner, PromoCode

CODE_PREFIX = "ER-"
PARTNER_CODE_SUFFIX_LENGTH = 6
DISCOUNT_CODE_MAX_LENGTH = 16
DISCOUNT_SUFFIX_MAX = DISCOUNT_CODE_MAX_LENGTH - len(CODE_PREFIX)


def normalize_code(code: str) -> str:
    return (code or "").strip().upper().replace(" ", "")


def _name_letters(partner_name: str) -> str:
    letters = re.sub(r"[^A-Za-z]", "", partner_name or "").upper()
    if len(letters) < 3:
        letters = (letters + "CREATOR")[:3]
    return letters


def _name_parts(partner_name: str) -> list[str]:
    return [part for part in re.sub(r"[^A-Za-z\s]", " ", partner_name or "").upper().split() if part]


def code_is_taken(code: str, *, exclude_partner_pk=None, exclude_promo_pk=None) -> bool:
    normalized = normalize_code(code)
    if not normalized:
        return False

    partner_qs = Partner.objects.filter(discount_code__iexact=normalized)
    if exclude_partner_pk:
        partner_qs = partner_qs.exclude(pk=exclude_partner_pk)
    if partner_qs.exists():
        return True

    promo_qs = PromoCode.objects.filter(code__iexact=normalized)
    if exclude_promo_pk:
        promo_qs = promo_qs.exclude(pk=exclude_promo_pk)
    return promo_qs.exists()


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
    Permanent creator discount code from their name, e.g. Jun Jun -> ER-JUNJUN.
    Does not expire.
    """
    letters = _name_letters(partner_name)
    parts = _name_parts(partner_name)
    candidates: list[str] = []

    if parts:
        first = parts[0]
        if len(first) >= 3:
            candidates.append(first[:DISCOUNT_SUFFIX_MAX])

        if len(parts) >= 2:
            combined = f"{parts[0]}{parts[-1]}"
            if len(combined) >= 3:
                candidates.append(combined[:DISCOUNT_SUFFIX_MAX])

        full_name = "".join(parts)
        if len(full_name) >= 3:
            candidates.append(full_name[:DISCOUNT_SUFFIX_MAX])

    for length in range(min(len(letters), DISCOUNT_SUFFIX_MAX), 2, -1):
        candidates.append(letters[:length])

    seen: set[str] = set()
    for base in candidates:
        base = base[:DISCOUNT_SUFFIX_MAX]
        if len(base) < 3 or base in seen:
            continue
        seen.add(base)
        code = f"{CODE_PREFIX}{base}"
        if not code_is_taken(code, exclude_partner_pk=exclude_pk):
            return code

    base = (parts[0] if parts else letters)[: max(3, DISCOUNT_SUFFIX_MAX - 2)]
    for suffix_number in range(2, 100):
        suffix = f"{base}{suffix_number}"[:DISCOUNT_SUFFIX_MAX]
        code = f"{CODE_PREFIX}{suffix}"
        if not code_is_taken(code, exclude_partner_pk=exclude_pk):
            return code

    raise ValueError("Unable to generate a unique discount code.")


def assign_creator_codes(partner: Partner) -> bool:
    """Assign admin ID + personal discount code when a partner is approved."""
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


def lookup_partner_by_discount_code(code: str):
    """Match a checkout code to an approved partner (personal or assigned promo)."""
    from django.db.models import Q

    from partners.models import Partner, PartnerStatus

    normalized = normalize_code(code)
    if not normalized:
        return None

    partner = Partner.objects.filter(
        status=PartnerStatus.APPROVED,
        discount_code__iexact=normalized,
    ).first()
    if partner:
        return partner

    now = timezone.now()
    promo = (
        PromoCode.objects.filter(is_active=True, code__iexact=normalized)
        .filter(Q(expires_at__isnull=True) | Q(expires_at__gt=now))
        .first()
    )
    if not promo:
        return None

    assigned = list(
        promo.assignments.filter(partner__status=PartnerStatus.APPROVED).select_related("partner")
    )
    if len(assigned) == 1:
        return assigned[0].partner
    return None
