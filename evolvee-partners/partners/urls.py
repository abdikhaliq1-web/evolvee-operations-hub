from django.urls import path

from partners import views

app_name = "partners"

urlpatterns = [
    path("", views.dashboard, name="dashboard"),
    path("apply/", views.apply, name="apply"),
    path("login/", views.PartnerLoginView.as_view(), name="login"),
    path("admin/login/", views.AdminLoginView.as_view(), name="admin_login"),
    path("logout/", views.logout_and_redirect, name="logout"),
    path("profile/", views.profile, name="profile"),
    path("notifications/<int:notification_id>/read/", views.mark_notification_read, name="mark_notification_read"),
    path("assets/", views.assets_hub, name="assets"),
    path("assets/<int:asset_id>/download/", views.download_asset, name="download_asset"),
    path("log-copy/", views.log_copy_event, name="log_copy"),
    path("r/<str:partner_code>/", views.track_referral, name="track_referral"),
]
