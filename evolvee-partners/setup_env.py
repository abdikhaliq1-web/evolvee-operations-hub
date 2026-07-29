"""Prepare the .env files so the partner app and the Operations Hub can talk.

Creates evolvee-partners\\.env from .env.example, fills a generated SECRET_KEY,
and writes one shared secret to both OPS_HUB_API_KEY (partner app) and
PARTNER_DASHBOARD_API_KEY (hub backend). Existing values are never overwritten.

Run from setup.bat / setup-demo.bat, or by hand:
    py setup_env.py --base-url http://127.0.0.1:8000 --mode live
"""

import argparse
import re
import secrets
import sys
from pathlib import Path

APP_DIR = Path(__file__).resolve().parent
REPO_DIR = APP_DIR.parent
PARTNER_ENV = APP_DIR / ".env"
PARTNER_ENV_EXAMPLE = APP_DIR / ".env.example"
BACKEND_ENV = REPO_DIR / "backend" / ".env"

PLACEHOLDER_SECRETS = {"", "django-insecure-evolvee-radiance-dev-key-change-me"}

# Mirrors the placeholder list in backend/src/config/env.js. Switching the hub to
# live mode makes it demand a strong JWT_SECRET, so a .env still carrying the
# shipped placeholder would stop the backend booting at all.
WEAK_JWT_SECRETS = {
    "",
    "changeme",
    "change-me",
    "secret",
    "your-secret",
    "change-me-to-a-long-random-string",
}


def jwt_secret_is_weak(value):
    return value is None or value.lower() in WEAK_JWT_SECRETS or len(value) < 32


def read_var(path, name):
    if not path.exists():
        return None
    match = re.search(rf"^{re.escape(name)}=(.*)$", path.read_text(encoding="utf-8"), re.M)
    return match.group(1).strip() if match else None


def write_var(path, name, value):
    text = path.read_text(encoding="utf-8") if path.exists() else ""
    line = f"{name}={value}"
    pattern = re.compile(rf"^{re.escape(name)}=.*$", re.M)
    if pattern.search(text):
        text = pattern.sub(lambda _: line, text, count=1)
    else:
        if text and not text.endswith("\n"):
            text += "\n"
        text += line + "\n"
    path.write_text(text, encoding="utf-8")


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default="", help="Partner app URL the hub should call.")
    parser.add_argument("--mode", default="", choices=["", "off", "sample", "live"])
    args = parser.parse_args(argv)

    if not PARTNER_ENV.exists():
        if not PARTNER_ENV_EXAMPLE.exists():
            print("ERROR: evolvee-partners\\.env.example is missing.", file=sys.stderr)
            return 1
        PARTNER_ENV.write_text(PARTNER_ENV_EXAMPLE.read_text(encoding="utf-8"), encoding="utf-8")
        print("Created evolvee-partners\\.env from .env.example")

    if (read_var(PARTNER_ENV, "SECRET_KEY") or "") in PLACEHOLDER_SECRETS:
        write_var(PARTNER_ENV, "SECRET_KEY", secrets.token_urlsafe(50))
        print("Generated SECRET_KEY in evolvee-partners\\.env")

    if not BACKEND_ENV.exists():
        print(
            "ERROR: backend\\.env not found. Run the backend section of setup.bat first.",
            file=sys.stderr,
        )
        return 1

    key = (
        read_var(PARTNER_ENV, "OPS_HUB_API_KEY")
        or read_var(BACKEND_ENV, "PARTNER_DASHBOARD_API_KEY")
        or secrets.token_hex(32)
    )
    write_var(PARTNER_ENV, "OPS_HUB_API_KEY", key)
    write_var(BACKEND_ENV, "PARTNER_DASHBOARD_API_KEY", key)
    print("Paired OPS_HUB_API_KEY with the hub's PARTNER_DASHBOARD_API_KEY")

    if args.base_url:
        write_var(BACKEND_ENV, "PARTNER_DASHBOARD_BASE_URL", args.base_url)
        print(f"Set PARTNER_DASHBOARD_BASE_URL={args.base_url}")
    if args.mode:
        if args.mode == "live" and jwt_secret_is_weak(read_var(BACKEND_ENV, "JWT_SECRET")):
            write_var(BACKEND_ENV, "JWT_SECRET", secrets.token_hex(48))
            print("Replaced the placeholder JWT_SECRET in backend\\.env - live mode requires a strong one")
        write_var(BACKEND_ENV, "PARTNER_DASHBOARD_MODE", args.mode)
        print(f"Set PARTNER_DASHBOARD_MODE={args.mode}")

    return 0


def _self_check():
    import tempfile

    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / ".env"
        path.write_text("A=1\nB=two\n", encoding="utf-8")

        write_var(path, "B", "changed")
        assert path.read_text(encoding="utf-8") == "A=1\nB=changed\n", path.read_text()

        write_var(path, "C", "new")
        assert read_var(path, "C") == "new"
        assert read_var(path, "A") == "1"
        assert read_var(path, "MISSING") is None

        write_var(path, "C", "again")
        assert path.read_text(encoding="utf-8").count("C=") == 1

        path.write_text("A=1", encoding="utf-8")
        write_var(path, "B", "2")
        assert path.read_text(encoding="utf-8") == "A=1\nB=2\n"

        path.write_text("KEY=abc$1def\n", encoding="utf-8")
        write_var(path, "KEY", "x\\1y")
        assert read_var(path, "KEY") == "x\\1y", read_var(path, "KEY")

        missing = Path(tmp) / "nope.env"
        assert read_var(missing, "A") is None

        assert jwt_secret_is_weak(None)
        assert jwt_secret_is_weak("")
        assert jwt_secret_is_weak("change-me-to-a-long-random-string")
        assert jwt_secret_is_weak("CHANGE-ME-TO-A-LONG-RANDOM-STRING")
        assert jwt_secret_is_weak("short")
        assert not jwt_secret_is_weak(secrets.token_hex(48))

    print("setup_env self-check passed.")


if __name__ == "__main__":
    if "--self-check" in sys.argv:
        _self_check()
    else:
        raise SystemExit(main())
