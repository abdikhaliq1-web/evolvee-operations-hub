from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

from partners.views import logout_and_redirect

urlpatterns = [
    path("admin/logout/", logout_and_redirect),
    path("admin/", admin.site.urls),
    path("command-center/", include("partners.analytics.urls")),
    path("api/", include("partners.api.urls")),
    # Shopify webhooks — active once PLACEHOLDER_SHOPIFY_* values in .env are replaced.
    path("webhooks/shopify/", include("partners.shopify.urls")),
    path("", include("partners.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
