from django.conf import settings
from django.contrib.auth.models import User
from django.db import models


class PartnerStatus(models.TextChoices):
    PENDING = "pending", "Pending Approval"
    APPROVED = "approved", "Approved"
    SUSPENDED = "suspended", "Suspended"
    REJECTED = "rejected", "Rejected"


class PaymentMethod(models.TextChoices):
    PAYPAL = "paypal", "PayPal"
    BANK_TRANSFER = "bank_transfer", "Bank Transfer"
    STRIPE = "stripe", "Stripe"
    OTHER = "other", "Other"


class Partner(models.Model):
    partner_code = models.CharField(
        max_length=32,
        unique=True,
        null=True,
        blank=True,
        editable=False,
        help_text="Internal creator ID for admins (ER- + 6 characters). Assigned on approval.",
    )
    discount_code = models.CharField(
        max_length=16,
        unique=True,
        null=True,
        blank=True,
        editable=False,
        help_text="Store discount code based on creator name (ER- + 5–7 characters). Assigned on approval.",
    )
    partner_name = models.CharField(max_length=150)
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="partner_profile")
    commission_percentage = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=settings.DEFAULT_COMMISSION_PERCENTAGE,
    )
    status = models.CharField(
        max_length=20,
        choices=PartnerStatus.choices,
        default=PartnerStatus.PENDING,
    )
    payment_method = models.CharField(
        max_length=32,
        choices=PaymentMethod.choices,
        blank=True,
    )
    payment_details = models.TextField(
        blank=True,
        help_text="Formatted payout details for admin review (auto-generated).",
    )
    payment_details_data = models.JSONField(default=dict, blank=True)
    payment_details_updated_at = models.DateTimeField(null=True, blank=True)
    total_sales = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_commission_earned = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    qr_code_image = models.ImageField(upload_to="partners/qr_codes/", blank=True)
    bio = models.TextField(blank=True)
    social_handle = models.CharField(max_length=100, blank=True)
    city = models.CharField(max_length=128, blank=True)
    region = models.CharField(max_length=128, blank=True, help_text="State, province, or region.")
    country = models.CharField(max_length=64, blank=True)
    country_code = models.CharField(max_length=8, blank=True, help_text="ISO country code for forms and payouts.")
    continent = models.CharField(max_length=64, blank=True)
    application_notes = models.TextField(blank=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        code_label = self.partner_code or "pending"
        return f"{self.partner_name} ({code_label})"

    @property
    def has_creator_codes(self):
        return bool(self.partner_code and self.discount_code)

    @property
    def is_active(self):
        return self.status == PartnerStatus.APPROVED

    @property
    def has_payment_details(self):
        if not self.payment_method:
            return False
        if self.payment_details_data and self.payment_details_data.get("fields"):
            return True
        return bool(self.payment_details.strip())

    @property
    def display_initials(self):
        parts = self.partner_name.split()
        if len(parts) >= 2:
            return (parts[0][0] + parts[-1][0]).upper()
        label = self.partner_name or self.user.email
        return label[:2].upper()

    @property
    def referral_url(self):
        if not self.discount_code:
            return ""
        return f"{settings.PARTNER_REFERRAL_BASE_URL}{self.discount_code}"

    @property
    def tracking_url(self):
        if not self.partner_code:
            return ""
        base = settings.PARTNER_TRACKING_BASE_URL.rstrip("/")
        return f"{base}/{self.partner_code}/"

    @property
    def share_url(self):
        return self.tracking_url or self.referral_url

    @property
    def location_label(self):
        from partners.utils.geoip import format_location

        return format_location(self.city, self.region, self.country, self.continent)

    def save(self, *args, **kwargs):
        from partners.data.locations import continent_for_country_code, resolve_country_name
        from partners.utils.continents import country_to_continent

        if self.country_code and not self.country:
            self.country = resolve_country_name(self.country_code)
        if self.country_code and not self.continent:
            self.continent = continent_for_country_code(self.country_code) or country_to_continent(self.country)
        elif self.country and not self.continent:
            self.continent = country_to_continent(self.country)
        super().save(*args, **kwargs)


class PartnerNotification(models.Model):
    """In-app messages for partners (approvals, declines, suspensions, etc.)."""

    class NotificationType(models.TextChoices):
        APPROVED = "approved", "Application Approved"
        REJECTED = "rejected", "Application Declined"
        SUSPENDED = "suspended", "Account Suspended"
        PAYMENT = "payment", "Payment Update"
        GENERAL = "general", "General"

    partner = models.ForeignKey(Partner, on_delete=models.CASCADE, related_name="notifications")
    notification_type = models.CharField(max_length=20, choices=NotificationType.choices)
    title = models.CharField(max_length=200)
    message = models.TextField(blank=True)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.title} — {self.partner.partner_code}"


class SaleStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    APPROVED = "approved", "Approved"
    REFUNDED = "refunded", "Refunded"
    CANCELLED = "cancelled", "Cancelled"


class PartnerSale(models.Model):
    order_id = models.CharField(max_length=64, unique=True)
    partner = models.ForeignKey(Partner, on_delete=models.CASCADE, related_name="sales")
    customer_email = models.EmailField()
    subtotal = models.DecimalField(max_digits=12, decimal_places=2)
    total = models.DecimalField(max_digits=12, decimal_places=2)
    commission_amount = models.DecimalField(max_digits=12, decimal_places=2)
    status = models.CharField(max_length=20, choices=SaleStatus.choices, default=SaleStatus.PENDING)
    products_data = models.JSONField(default=list, blank=True)
    shopify_order_id = models.CharField(max_length=64, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Order {self.order_id} — {self.partner.partner_code}"


class PartnerClick(models.Model):
    partner = models.ForeignKey(Partner, on_delete=models.CASCADE, related_name="clicks")
    session_key = models.CharField(max_length=64, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    city = models.CharField(max_length=128, blank=True)
    region = models.CharField(max_length=128, blank=True)
    country = models.CharField(max_length=64, blank=True)
    continent = models.CharField(max_length=64, blank=True)
    converted = models.BooleanField(default=False)
    sale = models.ForeignKey(
        PartnerSale,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="attributed_clicks",
    )
    clicked_at = models.DateTimeField(auto_now_add=True)
    converted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-clicked_at"]

    def __str__(self):
        return f"Click for {self.partner.partner_code} at {self.clicked_at:%Y-%m-%d %H:%M}"

    @property
    def location_label(self):
        from partners.utils.geoip import format_location

        return format_location(self.city, self.region, self.country, self.continent)


class PaymentStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    PROCESSING = "processing", "Processing"
    PAID = "paid", "Paid"
    FAILED = "failed", "Failed"


class PartnerPayment(models.Model):
    partner = models.ForeignKey(Partner, on_delete=models.CASCADE, related_name="payments")
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    payment_method = models.CharField(max_length=32, choices=PaymentMethod.choices)
    transaction_id = models.CharField(max_length=128, blank=True)
    period_start = models.DateField()
    period_end = models.DateField()
    sales = models.ManyToManyField(PartnerSale, related_name="payments", blank=True)
    status = models.CharField(max_length=20, choices=PaymentStatus.choices, default=PaymentStatus.PENDING)
    paid_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-period_end"]

    def __str__(self):
        return f"Payment {self.partner.partner_code} — {self.period_start} to {self.period_end}"


class MarketingAsset(models.Model):
    """Pre-made content partners can download and share."""

    class AssetType(models.TextChoices):
        IMAGE = "image", "Image"
        VIDEO = "video", "Video"
        COPY = "copy", "Social Copy"
        CAMPAIGN = "campaign", "Campaign Message"

    title = models.CharField(max_length=200)
    asset_type = models.CharField(max_length=20, choices=AssetType.choices)
    description = models.TextField(blank=True)
    file = models.FileField(upload_to="partners/assets/", blank=True)
    content = models.TextField(blank=True, help_text="Pre-written social post or campaign copy.")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.title


class ShopifyWebhookEvent(models.Model):
    class Status(models.TextChoices):
        RECEIVED = "received", "Received"
        PROCESSED = "processed", "Processed"
        SKIPPED = "skipped", "Skipped"
        FAILED = "failed", "Failed"

    webhook_id = models.CharField(max_length=128, unique=True)
    topic = models.CharField(max_length=64)
    shopify_order_id = models.CharField(max_length=64, blank=True)
    partner = models.ForeignKey(
        Partner,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="shopify_webhooks",
    )
    sale = models.ForeignKey(
        PartnerSale,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="shopify_webhooks",
    )
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.RECEIVED)
    error_message = models.TextField(blank=True)
    received_at = models.DateTimeField(auto_now_add=True)
    processed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-received_at"]

    def __str__(self):
        return f"{self.topic} — {self.webhook_id}"


class ProgramActivity(models.Model):
    """Central log of every partner program interaction for admin analysis."""

    class EventType(models.TextChoices):
        PARTNER_APPLIED = "partner_applied", "Partner Applied"
        PARTNER_APPROVED = "partner_approved", "Partner Approved"
        PARTNER_REJECTED = "partner_rejected", "Partner Rejected"
        PARTNER_SUSPENDED = "partner_suspended", "Partner Suspended"
        PARTNER_LOGIN = "partner_login", "Partner Login"
        DASHBOARD_VIEW = "dashboard_view", "Dashboard Viewed"
        QR_SCAN = "qr_scan", "QR Scan / Referral Click"
        LINK_COPIED = "link_copied", "Link/Code Copied"
        SALE_CREATED = "sale_created", "Sale Created"
        SALE_APPROVED = "sale_approved", "Sale Approved"
        SALE_REFUNDED = "sale_refunded", "Sale Refunded"
        SALE_CANCELLED = "sale_cancelled", "Sale Cancelled"
        COMMISSION_EARNED = "commission_earned", "Commission Earned"
        PAYOUT_CREATED = "payout_created", "Payout Created"
        PAYOUT_PAID = "payout_paid", "Payout Paid"
        WEBHOOK_RECEIVED = "webhook_received", "Shopify Webhook Received"
        WEBHOOK_PROCESSED = "webhook_processed", "Shopify Webhook Processed"
        WEBHOOK_FAILED = "webhook_failed", "Shopify Webhook Failed"
        ASSET_VIEWED = "asset_viewed", "Marketing Asset Viewed"
        ASSET_DOWNLOADED = "asset_downloaded", "Marketing Asset Downloaded"
        ASSET_COPIED = "asset_copied", "Marketing Asset Copied"
        API_REQUEST = "api_request", "API Request"

    event_type = models.CharField(max_length=32, choices=EventType.choices, db_index=True)
    description = models.CharField(max_length=255, blank=True)
    partner = models.ForeignKey(
        Partner,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="activities",
    )
    user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="program_activities",
    )
    sale = models.ForeignKey(
        PartnerSale,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="activities",
    )
    click = models.ForeignKey(
        PartnerClick,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="activities",
    )
    payment = models.ForeignKey(
        PartnerPayment,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="activities",
    )
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name_plural = "Program activities"

    def __str__(self):
        partner_label = self.partner.partner_code if self.partner else "—"
        return f"{self.get_event_type_display()} ({partner_label})"
