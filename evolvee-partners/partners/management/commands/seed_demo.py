from django.core.management.base import BaseCommand
from django.contrib.auth.models import User

from partners.models import MarketingAsset, Partner, PartnerStatus, SaleStatus
from partners.utils.commission import record_partner_sale
from decimal import Decimal


class Command(BaseCommand):
    help = "Create demo partner data for local development"

    def handle(self, *args, **options):
        user, created = User.objects.get_or_create(
            username="demo@evolveeradiance.com",
            defaults={
                "email": "demo@evolveeradiance.com",
                "first_name": "Demo",
                "last_name": "Partner",
            },
        )
        if created:
            user.set_password("demo12345")
            user.save()

        partner, _ = Partner.objects.get_or_create(
            user=user,
            defaults={
                "partner_name": "Radiance Beauty Co.",
                "status": PartnerStatus.APPROVED,
                "commission_percentage": Decimal("12.00"),
                "social_handle": "@radiancebeauty",
            },
        )
        if partner.status != PartnerStatus.APPROVED:
            partner.status = PartnerStatus.APPROVED
            partner.save()

        MarketingAsset.objects.get_or_create(
            title="Launch Week Instagram Post",
            defaults={
                "asset_type": MarketingAsset.AssetType.COPY,
                "content": "Discover your glow with Evolvée Radiance ✨ Use my code {code} for an exclusive partner discount.",
                "is_active": True,
            },
        )

        if not partner.sales.exists():
            record_partner_sale(
                partner=partner,
                order_id="DEMO-1001",
                customer_email="customer@example.com",
                subtotal=Decimal("89.00"),
                total=Decimal("89.00"),
                products_data=[{"name": "Radiance Serum", "qty": 1}],
                status=SaleStatus.APPROVED,
            )

        self.stdout.write(self.style.SUCCESS(
            f"Demo partner ready: {partner.partner_code} / password: demo12345"
        ))
