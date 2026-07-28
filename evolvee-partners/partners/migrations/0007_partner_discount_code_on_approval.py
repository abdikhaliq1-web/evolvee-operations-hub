import re

from django.db import migrations, models
from django.utils import timezone


def _name_letters(partner_name: str) -> str:
    letters = re.sub(r"[^A-Za-z]", "", partner_name or "").upper()
    if len(letters) < 3:
        letters = (letters + "CREATOR")[:3]
    return letters


def _generate_discount_code(partner_name: str, year: str, existing: set[str]) -> str:
    letters = _name_letters(partner_name)
    candidates = []

    for name_len in range(3, min(len(letters), 5) + 1):
        suffix = (letters[:name_len] + year)[:7]
        if 5 <= len(suffix) <= 7:
            candidates.append(suffix)

    for extra_index in range(1, len(letters)):
        suffix = (letters[:3] + letters[extra_index] + year)[:7]
        if 5 <= len(suffix) <= 7:
            candidates.append(suffix)

    for suffix in candidates:
        code = f"ER-{suffix}"
        if code not in existing:
            existing.add(code)
            return code

    for attempt in range(1, 100):
        suffix = (letters[:3] + letters[attempt % len(letters)] + year)[:7]
        code = f"ER-{suffix}"
        if code not in existing:
            existing.add(code)
            return code

    fallback = f"ER-{letters[:3]}{year}X"
    existing.add(fallback)
    return fallback


def forwards(apps, schema_editor):
    Partner = apps.get_model("partners", "Partner")
    year = str(timezone.now().year % 100).zfill(2)
    existing_discount_codes = set(
        Partner.objects.exclude(discount_code__isnull=True)
        .exclude(discount_code="")
        .values_list("discount_code", flat=True)
    )

    for partner in Partner.objects.exclude(status="approved"):
        partner.partner_code = None
        partner.discount_code = None
        partner.save(update_fields=["partner_code", "discount_code"])

    for partner in Partner.objects.filter(status="approved"):
        if not partner.discount_code:
            partner.discount_code = _generate_discount_code(partner.partner_name, year, existing_discount_codes)
            partner.save(update_fields=["discount_code"])


def backwards(apps, schema_editor):
    Partner = apps.get_model("partners", "Partner")
    Partner.objects.update(discount_code=None)


class Migration(migrations.Migration):
    dependencies = [
        ("partners", "0006_location_and_payment_schema"),
    ]

    operations = [
        migrations.AddField(
            model_name="partner",
            name="discount_code",
            field=models.CharField(
                blank=True,
                editable=False,
                help_text="Store discount code based on creator name (ER- + 5–7 characters). Assigned on approval.",
                max_length=16,
                null=True,
                unique=True,
            ),
        ),
        migrations.AlterField(
            model_name="partner",
            name="partner_code",
            field=models.CharField(
                blank=True,
                editable=False,
                help_text="Internal creator ID for admins (ER- + 6 characters). Assigned on approval.",
                max_length=32,
                null=True,
                unique=True,
            ),
        ),
        migrations.RunPython(forwards, backwards),
    ]
