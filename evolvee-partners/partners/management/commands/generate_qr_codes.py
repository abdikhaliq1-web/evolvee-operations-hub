from django.core.management.base import BaseCommand

from partners.models import Partner, PartnerStatus
from partners.utils.qr_generator import ensure_partner_qr


class Command(BaseCommand):
    help = "Generate QR codes for approved creators who are missing one."

    def add_arguments(self, parser):
        parser.add_argument(
            "--all",
            action="store_true",
            help="Include all approved partners (regenerates only if missing unless --force).",
        )
        parser.add_argument(
            "--force",
            action="store_true",
            help="Regenerate QR codes even when one already exists.",
        )

    def handle(self, *args, **options):
        qs = Partner.objects.filter(status=PartnerStatus.APPROVED)
        if not options["all"]:
            qs = qs.filter(qr_code_image="")

        created = 0
        for partner in qs:
            if options["force"] and partner.qr_code_image:
                partner.qr_code_image.delete(save=False)
                partner.qr_code_image = ""
                partner.save(update_fields=["qr_code_image"])
            if ensure_partner_qr(partner):
                created += 1
                self.stdout.write(self.style.SUCCESS(f"QR created for {partner.partner_code}"))

        self.stdout.write(self.style.SUCCESS(f"Done. {created} QR code(s) generated."))
