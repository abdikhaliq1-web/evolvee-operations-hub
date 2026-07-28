from django.urls import path

from partners.analytics import views

app_name = "analytics"

urlpatterns = [
    path("", views.command_center, name="command_center"),
    path("partners/<int:partner_id>/", views.partner_detail, name="partner_detail"),
    path("export/", views.export_activity_csv, name="export_activity"),
    path("export/creators/", views.export_partners_xlsx, name="export_creators"),
]
