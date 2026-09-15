from django.apps import AppConfig


class PartnersConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "partners"
    verbose_name = "QR Partner Program"

    def ready(self):
        import partners.signals  # noqa: F401
