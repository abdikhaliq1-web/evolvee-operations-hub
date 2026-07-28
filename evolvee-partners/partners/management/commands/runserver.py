import os
import sys

from django.contrib.staticfiles.management.commands.runserver import (
    Command as StaticfilesRunserverCommand,
)
from django.core.management import call_command


class Command(StaticfilesRunserverCommand):
    help = (
        "Starts the development server (with static files) and optionally "
        "guides admin account setup."
    )

    def add_arguments(self, parser):
        super().add_arguments(parser)
        parser.add_argument(
            "--skip-startup-prompt",
            action="store_true",
            dest="skip_startup_prompt",
            help="Skip the admin setup prompt on startup.",
        )

    def handle(self, *args, **options):
        if self._should_prompt(options):
            self._admin_startup_prompt(options)
        super().handle(*args, **options)

    def _should_prompt(self, options) -> bool:
        if options.get("skip_startup_prompt"):
            return False
        if not sys.stdin.isatty():
            return False
        run_main = os.environ.get("RUN_MAIN")
        use_reloader = options.get("use_reloader", True)
        return run_main == "true" or not use_reloader

    def _admin_startup_prompt(self, options) -> None:
        addr, port = self._resolve_addr_port(options)
        admin_url = f"http://{addr}:{port}/admin/login/"

        print("")
        print("=" * 44)
        print("  Evolvée Radiance — Partner Portal")
        print("=" * 44)
        print("")
        print("Are you a new admin/superuser?")
        print("  1) Yes — create a new admin account now")
        print("  2) No  — I'll log in with my existing account")
        print("")

        while True:
            choice = input("Enter 1 or 2: ").strip()
            if choice in {"1", "2"}:
                break
            print("Please enter 1 or 2.")

        print("")
        if choice == "1":
            print("Create your admin account below.")
            print("(Leave username blank to use your email address.)\n")
            try:
                call_command("createsuperuser")
            except KeyboardInterrupt:
                print("\nAccount setup cancelled.")
            print(f"\nAfter the server starts, sign in at: {admin_url}\n")
        else:
            print("After the server starts, sign in with your existing account at:")
            print(f"  {admin_url}\n")

        print("Starting server...\n")

    def _resolve_addr_port(self, options) -> tuple[str, str]:
        addrport = options.get("addrport")
        if addrport:
            if ":" in addrport:
                addr, port = addrport.rsplit(":", 1)
            else:
                addr, port = "", addrport
        else:
            addr, port = "", ""

        if not addr:
            addr = self.default_addr_ipv6 if options.get("use_ipv6") else self.default_addr
        if not port:
            port = self.default_port

        if addr == "0":
            addr = "0.0.0.0"
        if addr == "0.0.0.0":
            addr = "127.0.0.1"

        return addr, port
