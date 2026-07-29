"""Region-aware payout field schemas for partner payment forms."""

from django.core.exceptions import ValidationError

from partners.models import PaymentMethod

FieldSpec = dict[str, str | bool]

SEPA_COUNTRIES = {"DE", "FR", "IT", "ES", "NL", "IE", "PT", "BE", "AT", "FI", "GR", "LU", "SK", "SI", "EE", "LV", "LT", "CY", "MT"}

COMMON_HOLDER = {
    "name": "account_holder",
    "label": "Account holder name",
    "type": "text",
    "required": True,
    "placeholder": "Full name on the account",
}

COMMON_BANK = {
    "name": "bank_name",
    "label": "Bank name",
    "type": "text",
    "required": True,
    "placeholder": "Name of your bank",
}


def _fields(*specs: FieldSpec) -> list[FieldSpec]:
    return list(specs)


PAYPAL_FIELDS = _fields(
    {
        "name": "paypal_email",
        "label": "PayPal email",
        "type": "email",
        "required": True,
        "placeholder": "you@email.com",
    },
)

STRIPE_FIELDS = _fields(
    {
        "name": "stripe_email",
        "label": "Stripe account email",
        "type": "email",
        "required": True,
        "placeholder": "you@email.com",
    },
)

OTHER_FIELDS = _fields(
    COMMON_HOLDER,
    {
        "name": "payout_identifier",
        "label": "Payout account / ID",
        "type": "text",
        "required": True,
        "placeholder": "Account, wallet ID, or payment handle",
    },
    {
        "name": "payout_notes",
        "label": "Additional instructions",
        "type": "textarea",
        "required": False,
        "placeholder": "Any extra details our team needs to pay you",
    },
)

BANK_FIELDS_BY_REGION: dict[str, list[FieldSpec]] = {
    "US": _fields(
        COMMON_HOLDER,
        COMMON_BANK,
        {
            "name": "routing_number",
            "label": "Routing number (ABA)",
            "type": "text",
            "required": True,
            "placeholder": "9 digits",
        },
        {
            "name": "account_number",
            "label": "Account number",
            "type": "text",
            "required": True,
            "placeholder": "Your bank account number",
        },
        {
            "name": "account_type",
            "label": "Account type",
            "type": "select",
            "required": True,
            "options": [
                {"value": "checking", "label": "Checking"},
                {"value": "savings", "label": "Savings"},
            ],
        },
    ),
    "GB": _fields(
        COMMON_HOLDER,
        COMMON_BANK,
        {
            "name": "sort_code",
            "label": "Sort code",
            "type": "text",
            "required": True,
            "placeholder": "XX-XX-XX",
        },
        {
            "name": "account_number",
            "label": "Account number",
            "type": "text",
            "required": True,
            "placeholder": "8 digits",
        },
    ),
    "CA": _fields(
        COMMON_HOLDER,
        COMMON_BANK,
        {
            "name": "institution_number",
            "label": "Institution number",
            "type": "text",
            "required": True,
            "placeholder": "3 digits",
        },
        {
            "name": "transit_number",
            "label": "Transit number",
            "type": "text",
            "required": True,
            "placeholder": "5 digits",
        },
        {
            "name": "account_number",
            "label": "Account number",
            "type": "text",
            "required": True,
            "placeholder": "Your account number",
        },
    ),
    "AU": _fields(
        COMMON_HOLDER,
        COMMON_BANK,
        {
            "name": "bsb",
            "label": "BSB",
            "type": "text",
            "required": True,
            "placeholder": "XXX-XXX",
        },
        {
            "name": "account_number",
            "label": "Account number",
            "type": "text",
            "required": True,
            "placeholder": "Your account number",
        },
    ),
    "SEPA": _fields(
        COMMON_HOLDER,
        COMMON_BANK,
        {
            "name": "iban",
            "label": "IBAN",
            "type": "text",
            "required": True,
            "placeholder": "IT60 X054 2811 1010 0000 0123 456",
        },
        {
            "name": "bic",
            "label": "BIC / SWIFT",
            "type": "text",
            "required": True,
            "placeholder": "8 or 11 characters",
        },
    ),
    "DEFAULT": _fields(
        COMMON_HOLDER,
        COMMON_BANK,
        {
            "name": "iban",
            "label": "IBAN (if applicable)",
            "type": "text",
            "required": False,
            "placeholder": "International bank account number",
        },
        {
            "name": "swift",
            "label": "SWIFT / BIC",
            "type": "text",
            "required": True,
            "placeholder": "8 or 11 characters",
        },
        {
            "name": "account_number",
            "label": "Account number",
            "type": "text",
            "required": False,
            "placeholder": "Local account number if no IBAN",
        },
    ),
}


def bank_region_for_country(country_code: str) -> str:
    code = (country_code or "").upper()
    if code == "US":
        return "US"
    if code == "GB":
        return "GB"
    if code == "CA":
        return "CA"
    if code == "AU":
        return "AU"
    if code in SEPA_COUNTRIES:
        return "SEPA"
    return "DEFAULT"


def get_payment_fields(payment_method: str, country_code: str = "") -> list[FieldSpec]:
    if payment_method == PaymentMethod.PAYPAL:
        return PAYPAL_FIELDS
    if payment_method == PaymentMethod.STRIPE:
        return STRIPE_FIELDS
    if payment_method == PaymentMethod.OTHER:
        return OTHER_FIELDS
    if payment_method == PaymentMethod.BANK_TRANSFER:
        region = bank_region_for_country(country_code)
        return BANK_FIELDS_BY_REGION[region]
    return []


def validate_payment_submission(payment_method: str, country_code: str, data: dict[str, str]) -> dict[str, str]:
    fields = get_payment_fields(payment_method, country_code)
    cleaned: dict[str, str] = {}
    errors: dict[str, str] = {}

    for field in fields:
        name = field["name"]
        raw = (data.get(name) or "").strip()
        if field.get("required") and not raw:
            errors[name] = f"{field['label']} is required."
            continue
        if field.get("type") == "select" and raw:
            valid = {opt["value"] for opt in field.get("options", [])}
            if raw not in valid:
                errors[name] = f"Choose a valid {field['label'].lower()}."
                continue
        cleaned[name] = raw

    if errors:
        raise ValidationError(errors)

    return cleaned


def build_payment_details_data(
    payment_method: str,
    country_code: str,
    field_values: dict[str, str],
) -> dict:
    region = bank_region_for_country(country_code) if payment_method == PaymentMethod.BANK_TRANSFER else ""
    return {
        "method": payment_method,
        "country_code": country_code.upper() if country_code else "",
        "bank_region": region,
        "fields": field_values,
    }


def format_payment_details_for_admin(payment_method: str, data: dict | None) -> str:
    if not data or not data.get("fields"):
        return ""

    method_labels = dict(PaymentMethod.choices)
    lines = [f"Payout method: {method_labels.get(payment_method, payment_method)}"]

    country_code = data.get("country_code")
    if country_code:
        from partners.data.locations import resolve_country_name

        lines.append(f"Country: {resolve_country_name(country_code)}")

    bank_region = data.get("bank_region")
    if bank_region:
        lines.append(f"Bank format: {bank_region}")

    field_map = {f["name"]: f["label"] for f in get_payment_fields(payment_method, country_code or "")}
    for key, value in data.get("fields", {}).items():
        if value:
            label = field_map.get(key, key.replace("_", " ").title())
            lines.append(f"{label}: {value}")

    return "\n".join(lines)
