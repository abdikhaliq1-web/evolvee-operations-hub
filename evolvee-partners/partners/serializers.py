from rest_framework import serializers

from partners.models import MarketingAsset, Partner, PartnerClick, PartnerPayment, PartnerSale


class PartnerSerializer(serializers.ModelSerializer):
    referral_url = serializers.CharField(read_only=True)
    tracking_url = serializers.CharField(read_only=True)
    is_active = serializers.BooleanField(read_only=True)

    class Meta:
        model = Partner
        fields = [
            "id",
            "partner_code",
            "partner_name",
            "commission_percentage",
            "status",
            "payment_method",
            "total_sales",
            "total_commission_earned",
            "qr_code_image",
            "referral_url",
            "tracking_url",
            "discount_code",
            "is_active",
            "approved_at",
            "created_at",
        ]
        read_only_fields = fields

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if not instance.is_active:
            data["partner_code"] = None
            data["discount_code"] = None
            data["referral_url"] = ""
            data["tracking_url"] = ""
            data["qr_code_image"] = None
        return data


class PartnerSaleSerializer(serializers.ModelSerializer):
    class Meta:
        model = PartnerSale
        fields = [
            "id",
            "order_id",
            "customer_email",
            "subtotal",
            "total",
            "commission_amount",
            "status",
            "products_data",
            "created_at",
        ]


class PartnerClickSerializer(serializers.ModelSerializer):
    class Meta:
        model = PartnerClick
        fields = ["id", "converted", "clicked_at", "converted_at"]


class PartnerPaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = PartnerPayment
        fields = [
            "id",
            "amount",
            "payment_method",
            "transaction_id",
            "period_start",
            "period_end",
            "status",
            "paid_at",
        ]


class MarketingAssetSerializer(serializers.ModelSerializer):
    class Meta:
        model = MarketingAsset
        fields = ["id", "title", "asset_type", "description", "file", "content", "created_at"]


class PartnerApplicationSerializer(serializers.Serializer):
    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    password = serializers.CharField(min_length=8, write_only=True)
    partner_name = serializers.CharField(max_length=150)
    social_handle = serializers.CharField(max_length=100)
    bio = serializers.CharField(required=False, allow_blank=True)
    application_notes = serializers.CharField(required=False, allow_blank=True)

    def validate_social_handle(self, value):
        handle = value.strip()
        if not handle:
            raise serializers.ValidationError("Social media handle is required.")
        return handle
