from django.urls import path

from partners.api.views import (
    MarketingAssetListView,
    PartnerApplicationView,
    PartnerPaymentsListView,
    PartnerProfileView,
    PartnerSalesListView,
    PartnerStatsView,
)
from partners.api.form_data_views import (
    location_cities,
    location_continents,
    location_countries,
    location_subdivisions,
    payment_fields_schema,
)

app_name = "partners_api"

urlpatterns = [
    path("apply/", PartnerApplicationView.as_view(), name="apply"),
    path("me/", PartnerProfileView.as_view(), name="profile"),
    path("stats/", PartnerStatsView.as_view(), name="stats"),
    path("sales/", PartnerSalesListView.as_view(), name="sales"),
    path("payments/", PartnerPaymentsListView.as_view(), name="payments"),
    path("assets/", MarketingAssetListView.as_view(), name="assets"),
    path("locations/continents/", location_continents, name="location_continents"),
    path("locations/countries/", location_countries, name="location_countries"),
    path("locations/subdivisions/", location_subdivisions, name="location_subdivisions"),
    path("locations/cities/", location_cities, name="location_cities"),
    path("payment-fields/", payment_fields_schema, name="payment_fields"),
]
