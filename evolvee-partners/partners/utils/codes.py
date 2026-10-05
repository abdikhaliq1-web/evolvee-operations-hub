import re
import secrets
import string

from django.utils import timezone

from partners.models import Partner, PromoCode

CODE_PREFIX = "ER-"
PARTNER_CODE_SUFFIX_LENGTH = 6
DISCOUNT_CODE_MAX_LENGTH = 16
DISCOUNT_SUFFIX_MAX = 8


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

def discount_code_source(partner: Partner) -> str:
    """Public name they promote with, not the account login name."""
    return (partner.social_handle or partner.partner_name or "").strip()

def _split_brand_tokens(source: str) -> list[str]:
    raw = (source or "").strip().lstrip("@")
    spaced = re.sub(r"([a-z])([A-Z])", r"\1 \2", raw)
    spaced = re.sub(r"([A-Z]+)([A-Z][a-z])", r"\1 \2", spaced)
    return [part for part in re.sub(r"[^A-Za-z\s]", " ", spaced).upper().split() if part]


def _letter_code_candidates(source: str) -> list[str]:
    tokens = _split_brand_tokens(source)
    letters = _name_letters(source)
    if not tokens and letters:
        tokens = [letters]

    raw: list[str] = []
    if len(tokens) == 1:
        word = tokens[0]
        raw.append(word[:DISCOUNT_SUFFIX_MAX])
        if len(word) > DISCOUNT_SUFFIX_MAX:
            raw.append(word[-DISCOUNT_SUFFIX_MAX:])
            raw.append((word[:4] + word[-4:])[:DISCOUNT_SUFFIX_MAX])
        consonants = re.sub(r"[AEIOU]", "", word)
        if len(consonants) >= 3:
            raw.append(consonants[:DISCOUNT_SUFFIX_MAX])
    elif len(tokens) == 2:
        first, second = tokens
        raw.append((first[0] + second)[:DISCOUNT_SUFFIX_MAX])  # GREVIEWS
        raw.append(first[:DISCOUNT_SUFFIX_MAX])
        raw.append(f"{first[0]}{second[0]}")
        raw.append(second[:DISCOUNT_SUFFIX_MAX])
        raw.append((first[:3] + second[:3])[:DISCOUNT_SUFFIX_MAX])
    else:
        raw.append(tokens[0][:DISCOUNT_SUFFIX_MAX])  # SPOOKY
        raw.append("".join(token[0] for token in tokens)[:DISCOUNT_SUFFIX_MAX])  # SSS
        raw.append((tokens[0][0] + tokens[-1])[:DISCOUNT_SUFFIX_MAX])
        raw.append("".join(token[:2] for token in tokens)[:DISCOUNT_SUFFIX_MAX])
        raw.append(tokens[-1][:DISCOUNT_SUFFIX_MAX])

    raw.append(letters[:DISCOUNT_SUFFIX_MAX])

    seen: set[str] = set()
    unique: list[str] = []
    for item in raw:
        item = re.sub(r"[^A-Z]", "", item)[:DISCOUNT_SUFFIX_MAX]
        if len(item) < 3 or item in seen:
            continue
        seen.add(item)
        unique.append(item)
    return unique

def generate_discount_code(partner_name: str, exclude_pk=None) -> str:
    """
    Letter-only personal code from the public brand name.
    Tries distinctive short forms; never appends 2, 3, 4.
    """
    for base in _letter_code_candidates(partner_name):
        code = f"{CODE_PREFIX}{base}"
        if not code_is_taken(code, exclude_partner_pk=exclude_pk):
            return code
    raise ValueError(
        "Could not build a unique letter-only discount code. Set one in admin."
    )

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
        partner.discount_code = generate_discount_code(
            discount_code_source(partner), exclude_pk=partner.pk
            )
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
    if partner and partner.discount_code_is_valid:
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
