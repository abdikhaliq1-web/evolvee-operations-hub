from datetime import date

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from partners.utils.payouts import generate_monthly_payouts, payday_for, payout_period


class Command(BaseCommand):
    help = (
        "Create one pending PartnerPayment per partner from eligible sales. "
        "Staff still send money and mark Paid. Default payday is the 15th."
    )

    def add_arguments(self, parser):
        parser.add_argument("--date", help="Run as this date (YYYY-MM-DD). Defaults to today.")
        parser.add_argument(
            "--force",
            action="store_true",
            help="Allow a run on a day that is not the payday.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Print what would be created without writing payments.",
        )

    def handle(self, *args, **options):
        if options["date"]:
            try:
                as_of = date.fromisoformat(options["date"])
            except ValueError as exc:
                raise CommandError("Use --date YYYY-MM-DD.") from exc
        else:
            as_of = timezone.localdate()

        payday = payday_for(as_of)
        if as_of != payday and not options["force"]:
            raise CommandError(
                f"Payday is {payday.isoformat()}. Today is {as_of.isoformat()}. "
                f"Pass --force or --date {payday.isoformat()}."
            )

        period_start, period_end = payout_period(as_of)
        window = getattr(settings, "PAYOUT_RETURN_WINDOW_DAYS", 14)
        self.stdout.write(
            f"Period {period_start} to {period_end}. Return window {window} days. "
            f"{'Dry run. ' if options['dry_run'] else ''}"
        )

        rows = generate_monthly_payouts(as_of=as_of, dry_run=options["dry_run"])
        if not rows:
            self.stdout.write("No eligible unpaid sales. Nothing to create.")
            return

        for row in rows:
            self.stdout.write(
                f"{row['partner']}: ${row['amount']} ({row['sales']} sales) {row['status']}"
            )
        self.stdout.write(self.style.SUCCESS(f"{len(rows)} partner row(s)."))