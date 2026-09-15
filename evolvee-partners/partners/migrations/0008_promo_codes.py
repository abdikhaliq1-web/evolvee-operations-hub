# Generated manually for promo codes feature

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("partners", "0007_partner_discount_code_on_approval"),
    ]

    operations = [
        migrations.CreateModel(
            name="PromoCode",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("code", models.CharField(max_length=32, unique=True)),
                ("title", models.CharField(help_text="Internal label, e.g. Summer Launch 2026.", max_length=200)),
                ("description", models.TextField(blank=True)),
                (
                    "expires_at",
                    models.DateTimeField(
                        blank=True,
                        help_text="When this promo stops working at checkout. Leave blank only for open-ended campaigns.",
                        null=True,
                    ),
                ),
                ("is_active", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
        migrations.CreateModel(
            name="PartnerPromoAssignment",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("assigned_at", models.DateTimeField(auto_now_add=True)),
                (
                    "partner",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="promo_assignments",
                        to="partners.partner",
                    ),
                ),
                (
                    "promo",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="assignments",
                        to="partners.promocode",
                    ),
                ),
            ],
            options={
                "ordering": ["-assigned_at"],
            },
        ),
        migrations.AddConstraint(
            model_name="partnerpromoassignment",
            constraint=models.UniqueConstraint(fields=("partner", "promo"), name="unique_partner_promo"),
        ),
        migrations.AlterField(
            model_name="partner",
            name="discount_code",
            field=models.CharField(
                blank=True,
                editable=False,
                help_text="Personal store discount code from the creator's name (permanent, does not expire).",
                max_length=16,
                null=True,
                unique=True,
            ),
        ),
    ]
