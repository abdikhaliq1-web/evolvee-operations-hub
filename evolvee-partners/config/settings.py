from pathlib import Path

from decouple import Csv, config

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = config("SECRET_KEY", default="django-insecure-evolvee-radiance-dev-key-change-me")
DEBUG = config("DEBUG", default=True, cast=bool)
ALLOWED_HOSTS = config("ALLOWED_HOSTS", default="localhost,127.0.0.1", cast=Csv())

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
# PLACEHOLDER — replace with actual Evolvée Radiance homepage when link is provided.
# Used for logout redirects (partners and admin). Until then, users go to /apply/.
MAIN_WEBSITE_URL = config("MAIN_WEBSITE_URL", default="PLACEHOLDER_MAIN_WEBSITE_URL")
PAYMENT_SCHEDULE = config("PAYMENT_SCHEDULE", default="monthly")  # monthly | bi-weekly

# Optional path to MaxMind GeoLite2-City.mmdb for offline IP geolocation.
GEOLITE2_CITY_PATH = config("GEOLITE2_CITY_PATH", default="")

# Shopify integration — NOT CONNECTED YET.
# PLACEHOLDER — replace all SHOPIFY_* values in .env with actual credentials
# and URLs when the Evolvée Radiance store integration is provided.
SHOPIFY_WEBHOOK_SECRET = config("SHOPIFY_WEBHOOK_SECRET", default="")
SHOPIFY_SHOP_DOMAIN = config("SHOPIFY_SHOP_DOMAIN", default="")
SHOPIFY_ACCESS_TOKEN = config("SHOPIFY_ACCESS_TOKEN", default="")
SHOPIFY_API_VERSION = config("SHOPIFY_API_VERSION", default="2025-01")
SHOPIFY_WEBHOOK_BASE_URL = config("SHOPIFY_WEBHOOK_BASE_URL", default="")
