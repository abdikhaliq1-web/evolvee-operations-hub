from pathlib import Path
import os

from decouple import Csv, config

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = config("SECRET_KEY", default="django-insecure-evolvee-radiance-dev-key-change-me")
DEBUG = config("DEBUG", default=True, cast=bool)
ALLOWED_HOSTS = config("ALLOWED_HOSTS", default="localhost,127.0.0.1", cast=Csv())
CSRF_TRUSTED_ORIGINS = config("CSRF_TRUSTED_ORIGINS", default="", cast=Csv())

INSTALLED_APPS = [
    "config",
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "corsheaders",
    "partners",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
                "partners.context_processors.site_urls",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

DATABASES = {
    "default": {
        "ENGINE": config("DB_ENGINE", default="django.db.backends.sqlite3"),
        "NAME": config("DB_NAME", default=str(BASE_DIR / "db.sqlite3")),
        "USER": config("DB_USER", default=""),
        "PASSWORD": config("DB_PASSWORD", default=""),
        "HOST": config("DB_HOST", default=""),
        "PORT": config("DB_PORT", default=""),
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STATICFILES_DIRS = [BASE_DIR / "static"]
STORAGES = {
    "default": {
        "BACKEND": "django.core.files.storage.FileSystemStorage",
    },
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedStaticFilesStorage",
    },
}

MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

LOGIN_URL = "partners:login"
LOGIN_REDIRECT_URL = "partners:dashboard"  # Overridden for staff in PartnerLoginView
# Logout handled by logout_and_redirect → MAIN_WEBSITE_URL (see partners/views.py)

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
}

CORS_ALLOWED_ORIGINS = config(
    "CORS_ALLOWED_ORIGINS",
    default="http://localhost:8000,http://127.0.0.1:8000",
    cast=Csv(),
)

# Evolvée Radiance partner program settings
BRAND_NAME = config("BRAND_NAME", default="Evolvée Radiance")
DEFAULT_COMMISSION_PERCENTAGE = config("DEFAULT_COMMISSION_PERCENTAGE", default=10, cast=float)

# Email — defaults to console backend in development
EMAIL_BACKEND = config(
    "EMAIL_BACKEND",
    default="django.core.mail.backends.console.EmailBackend",
)
EMAIL_HOST = config("EMAIL_HOST", default="localhost")
EMAIL_PORT = config("EMAIL_PORT", default=587, cast=int)
EMAIL_HOST_USER = config("EMAIL_HOST_USER", default="")
EMAIL_HOST_PASSWORD = config("EMAIL_HOST_PASSWORD", default="")
EMAIL_USE_TLS = config("EMAIL_USE_TLS", default=True, cast=bool)
DEFAULT_FROM_EMAIL = config("DEFAULT_FROM_EMAIL", default="partners@evolveeradiance.com")

# PLACEHOLDER — replace PARTNER_REFERRAL_BASE_URL in .env with the actual
# Evolvée Radiance Shopify store link when integration access is given.
PARTNER_REFERRAL_BASE_URL = config(
    "PARTNER_REFERRAL_BASE_URL",
    default="PLACEHOLDER_SHOPIFY_STORE_LINK/?ref=",
)
PARTNER_TRACKING_BASE_URL = config(
    "PARTNER_TRACKING_BASE_URL",
    default="http://127.0.0.1:8000/r",
)
# Public HTTPS URL for the partner portal (ngrok locally, your domain in production).
# Webhooks, apply links, and tracking URLs are derived from this when possible.
PARTNER_PORTAL_PUBLIC_URL = config("PARTNER_PORTAL_PUBLIC_URL", default="").strip().rstrip("/")
# PLACEHOLDER — replace with actual Evolvée Radiance homepage when link is provided.
# Used for logout redirects (partners and admin). Until then, users go to /apply/.
MAIN_WEBSITE_URL = config("MAIN_WEBSITE_URL", default="PLACEHOLDER_MAIN_WEBSITE_URL")
PAYMENT_SCHEDULE = config("PAYMENT_SCHEDULE", default="monthly")  # monthly | bi-weekly

# Shared secret for the Operations Hub read-only summary. Empty disables /api/ops-hub/summary/.
# Hub auth header is X-Ops-Hub-Key. Partner portal, QR tracking, and Shopify never use this key.
OPS_HUB_API_KEY = config("OPS_HUB_API_KEY", default="").strip()

# Optional path to MaxMind GeoLite2-City.mmdb for offline IP geolocation.
GEOLITE2_CITY_PATH = config("GEOLITE2_CITY_PATH", default="")

# Shopify integration — NOT CONNECTED YET.
# PLACEHOLDER — replace all SHOPIFY_* values in .env with actual credentials
# and URLs when the Evolvée Radiance store integration is provided.
SHOPIFY_WEBHOOK_SECRET = config("SHOPIFY_WEBHOOK_SECRET", default="")
SHOPIFY_SHOP_DOMAIN = config("SHOPIFY_SHOP_DOMAIN", default="")
SHOPIFY_ACCESS_TOKEN = config("SHOPIFY_ACCESS_TOKEN", default="")
SHOPIFY_API_VERSION = config("SHOPIFY_API_VERSION", default="2025-01")
SHOPIFY_WEBHOOK_BASE_URL = config("SHOPIFY_WEBHOOK_BASE_URL", default="").strip().rstrip("/")

# ── Unified public portal URL (webhooks + apply + tracking stay in sync) ──
def _is_placeholder_url(value: str) -> bool:
    return not value or value.upper().startswith("PLACEHOLDER")


def _normalize_origin(url: str) -> tuple[str, str | None]:
    value = (url or "").strip().rstrip("/")
    if _is_placeholder_url(value):
        return "", None
    if not value.startswith(("http://", "https://")):
        value = f"https://{value}"
    from urllib.parse import urlparse

    parsed = urlparse(value)
    if not parsed.netloc:
        return "", None
    return f"{parsed.scheme}://{parsed.netloc}", parsed.hostname


_portal_origin, _portal_host = _normalize_origin(PARTNER_PORTAL_PUBLIC_URL)
if not _portal_origin:
    _portal_origin, _portal_host = _normalize_origin(SHOPIFY_WEBHOOK_BASE_URL)

if _portal_origin:
    PARTNER_PORTAL_PUBLIC_URL = _portal_origin
    if not _normalize_origin(SHOPIFY_WEBHOOK_BASE_URL)[0]:
        SHOPIFY_WEBHOOK_BASE_URL = _portal_origin
    if PARTNER_TRACKING_BASE_URL.startswith(("http://127.0.0.1", "http://localhost")):
        PARTNER_TRACKING_BASE_URL = f"{_portal_origin}/r"
    if _portal_host and _portal_host not in ALLOWED_HOSTS:
        ALLOWED_HOSTS = [*ALLOWED_HOSTS, _portal_host]
    if _portal_origin not in CSRF_TRUSTED_ORIGINS:
        CSRF_TRUSTED_ORIGINS = [*CSRF_TRUSTED_ORIGINS, _portal_origin]
    if _portal_origin not in CORS_ALLOWED_ORIGINS:
        CORS_ALLOWED_ORIGINS = [*CORS_ALLOWED_ORIGINS, _portal_origin]
elif not _normalize_origin(SHOPIFY_WEBHOOK_BASE_URL)[0]:
    SHOPIFY_WEBHOOK_BASE_URL = ""
else:
    _webhook_origin, _webhook_host = _normalize_origin(SHOPIFY_WEBHOOK_BASE_URL)
    SHOPIFY_WEBHOOK_BASE_URL = _webhook_origin
    if _webhook_host and _webhook_host not in ALLOWED_HOSTS:
        ALLOWED_HOSTS = [*ALLOWED_HOSTS, _webhook_host]
    if _webhook_origin not in CSRF_TRUSTED_ORIGINS:
        CSRF_TRUSTED_ORIGINS = [*CSRF_TRUSTED_ORIGINS, _webhook_origin]

# Render.com — auto-allow the service hostname (fixes DisallowedHost if env vars missing)
_render_hostname = os.environ.get("RENDER_EXTERNAL_HOSTNAME")
if _render_hostname:
    if _render_hostname not in ALLOWED_HOSTS:
        ALLOWED_HOSTS = [*ALLOWED_HOSTS, _render_hostname]
    _render_origin = f"https://{_render_hostname}"
    if _render_origin not in CSRF_TRUSTED_ORIGINS:
        CSRF_TRUSTED_ORIGINS = [*CSRF_TRUSTED_ORIGINS, _render_origin]
    if PARTNER_TRACKING_BASE_URL.startswith("http://127.0.0.1"):
        PARTNER_TRACKING_BASE_URL = f"https://{_render_hostname}/r"

if os.environ.get("RENDER"):
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
