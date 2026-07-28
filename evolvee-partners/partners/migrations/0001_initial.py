import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="Partner",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("partner_code", models.CharField(editable=False, max_length=32, unique=True)),
                ("partner_name", models.CharField(max_length=150)),
                ("commission_percentage", models.DecimalField(decimal_places=2, default=10, max_digits=5)),
                ("status", models.CharField(choices=[("pending", "Pending Approval"), ("approved", "Approved"), ("suspended", "Suspended"), ("rejected", "Rejected")], default="pending", max_length=20)),
                ("payment_method", models.CharField(blank=True, choices=[("paypal", "PayPal"), ("bank_transfer", "Bank Transfer"), ("stripe", "Stripe"), ("other", "Other")], max_length=32)),
                ("payment_details", models.TextField(blank=True, help_text="PayPal email, bank details, or other payout info.")),
                ("total_sales", models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ("total_commission_earned", models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ("qr_code_image", models.ImageField(blank=True, upload_to="partners/qr_codes/")),
                ("bio", models.TextField(blank=True)),
                ("social_handle", models.CharField(blank=True, max_length=100)),
                ("application_notes", models.TextField(blank=True)),
                ("approved_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("user", models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name="partner_profile", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.CreateModel(
            name="MarketingAsset",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("title", models.CharField(max_length=200)),
                ("asset_type", models.CharField(choices=[("image", "Image"), ("video", "Video"), ("copy", "Social Copy"), ("campaign", "Campaign Message")], max_length=20)),
                ("description", models.TextField(blank=True)),
                ("file", models.FileField(blank=True, upload_to="partners/assets/")),
                ("content", models.TextField(blank=True, help_text="Pre-written social post or campaign copy.")),
                ("is_active", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.CreateModel(
            name="PartnerSale",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("order_id", models.CharField(max_length=64, unique=True)),
                ("customer_email", models.EmailField(max_length=254)),
                ("subtotal", models.DecimalField(decimal_places=2, max_digits=12)),
                ("total", models.DecimalField(decimal_places=2, max_digits=12)),
                ("commission_amount", models.DecimalField(decimal_places=2, max_digits=12)),
                ("status", models.CharField(choices=[("pending", "Pending"), ("approved", "Approved"), ("refunded", "Refunded"), ("cancelled", "Cancelled")], default="pending", max_length=20)),
                ("products_data", models.JSONField(blank=True, default=list)),
                ("shopify_order_id", models.CharField(blank=True, max_length=64)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("partner", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="sales", to="partners.partner")),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.CreateModel(
            name="PartnerPayment",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("amount", models.DecimalField(decimal_places=2, max_digits=12)),
                ("payment_method", models.CharField(choices=[("paypal", "PayPal"), ("bank_transfer", "Bank Transfer"), ("stripe", "Stripe"), ("other", "Other")], max_length=32)),
                ("transaction_id", models.CharField(blank=True, max_length=128)),
                ("period_start", models.DateField()),
                ("period_end", models.DateField()),
                ("status", models.CharField(choices=[("pending", "Pending"), ("processing", "Processing"), ("paid", "Paid"), ("failed", "Failed")], default="pending", max_length=20)),
                ("paid_at", models.DateTimeField(blank=True, null=True)),
                ("notes", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("partner", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="payments", to="partners.partner")),
                ("sales", models.ManyToManyField(blank=True, related_name="payments", to="partners.partnersale")),
            ],
            options={"ordering": ["-period_end"]},
        ),
        migrations.CreateModel(
            name="PartnerClick",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("session_key", models.CharField(blank=True, max_length=64)),
                ("ip_address", models.GenericIPAddressField(blank=True, null=True)),
                ("user_agent", models.TextField(blank=True)),
                ("converted", models.BooleanField(default=False)),
                ("clicked_at", models.DateTimeField(auto_now_add=True)),
                ("converted_at", models.DateTimeField(blank=True, null=True)),
                ("partner", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="clicks", to="partners.partner")),
                ("sale", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="attributed_clicks", to="partners.partnersale")),
            ],
            options={"ordering": ["-clicked_at"]},
        ),
        migrations.CreateModel(
            name="ShopifyWebhookEvent",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("webhook_id", models.CharField(max_length=128, unique=True)),
                ("topic", models.CharField(max_length=64)),
                ("shopify_order_id", models.CharField(blank=True, max_length=64)),
                ("status", models.CharField(choices=[("received", "Received"), ("processed", "Processed"), ("skipped", "Skipped"), ("failed", "Failed")], default="received", max_length=20)),
                ("error_message", models.TextField(blank=True)),
                ("received_at", models.DateTimeField(auto_now_add=True)),
                ("processed_at", models.DateTimeField(blank=True, null=True)),
                ("partner", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="shopify_webhooks", to="partners.partner")),
                ("sale", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="shopify_webhooks", to="partners.partnersale")),
            ],
            options={"ordering": ["-received_at"]},
        ),
    ]
