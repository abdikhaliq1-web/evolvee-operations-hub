import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("partners", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="ProgramActivity",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("event_type", models.CharField(choices=[
                    ("partner_applied", "Partner Applied"),
                    ("partner_approved", "Partner Approved"),
                    ("partner_rejected", "Partner Rejected"),
                    ("partner_suspended", "Partner Suspended"),
                    ("partner_login", "Partner Login"),
                    ("dashboard_view", "Dashboard Viewed"),
                    ("qr_scan", "QR Scan / Referral Click"),
                    ("link_copied", "Link/Code Copied"),
                    ("sale_created", "Sale Created"),
                    ("sale_approved", "Sale Approved"),
                    ("sale_refunded", "Sale Refunded"),
                    ("sale_cancelled", "Sale Cancelled"),
                    ("commission_earned", "Commission Earned"),
                    ("payout_created", "Payout Created"),
                    ("payout_paid", "Payout Paid"),
                    ("webhook_received", "Shopify Webhook Received"),
                    ("webhook_processed", "Shopify Webhook Processed"),
                    ("webhook_failed", "Shopify Webhook Failed"),
                    ("asset_viewed", "Marketing Asset Viewed"),
                    ("asset_downloaded", "Marketing Asset Downloaded"),
                    ("asset_copied", "Marketing Asset Copied"),
                    ("api_request", "API Request"),
                ], db_index=True, max_length=32)),
                ("description", models.CharField(blank=True, max_length=255)),
                ("ip_address", models.GenericIPAddressField(blank=True, null=True)),
                ("user_agent", models.TextField(blank=True)),
                ("metadata", models.JSONField(blank=True, default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("click", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="activities", to="partners.partnerclick")),
                ("partner", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="activities", to="partners.partner")),
                ("payment", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="activities", to="partners.partnerpayment")),
                ("sale", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="activities", to="partners.partnersale")),
                ("user", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="program_activities", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "verbose_name_plural": "Program activities",
                "ordering": ["-created_at"],
            },
        ),
    ]
