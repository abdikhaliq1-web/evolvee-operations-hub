"""
Shopify webhook URL routes.

NOT CONNECTED YET — these endpoints are ready but inactive until
PLACEHOLDER_SHOPIFY_* values in .env are replaced with real credentials.
"""
from django.urls import path

from partners.shopify import views

app_name = "shopify_webhooks"

urlpatterns = [
    path("orders/paid/", views.orders_paid, name="orders_paid"),
    path("orders/cancelled/", views.orders_cancelled, name="orders_cancelled"),
    path("refunds/create/", views.refunds_create, name="refunds_create"),
]
