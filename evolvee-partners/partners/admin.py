from django import forms
from django.contrib import admin, messages
from django.contrib.admin import helpers
from django.http import HttpResponse
from django.shortcuts import render
from django.urls import path
from django.utils.html import format_html

from partners.analytics.exports import build_partners_workbook
from partners.models import (
    MarketingAsset,
    Partner,
    PartnerClick,
    PartnerNotification,
    PartnerPayment,
    PartnerSale,
    PartnerStatus,
    ProgramActivity,
    ShopifyWebhookEvent,
)


class PartnerSaleInline(admin.TabularInline):
    model = PartnerSale
    extra = 0
    readonly_fields = ("order_id", "total", "commission_amount", "status", "created_at")
    can_delete = False


class PartnerNotificationInline(admin.TabularInline):
    model = PartnerNotification
    extra = 0
    readonly_fields = ("notification_type", "title", "message", "is_read", "created_at")
    can_delete = False

    def has_add_permission(self, request, obj=None):
        return False


class PartnerAdminForm(forms.ModelForm):
    message_to_partner = forms.CharField(
        required=False,
        widget=forms.Textarea(attrs={"rows": 3}),
        help_text="Optional. Sent by email and shown in the partner portal when you change their status.",
        label="Message to partner",
    )

    class Meta:
        model = Partner
        fields = "__all__"


class PartnerStatusActionForm(forms.Form):
    _selected_action = forms.CharField(widget=forms.MultipleHiddenInput)
    message_to_partner = forms.CharField(
        required=False,
        widget=forms.Textarea(attrs={"rows": 4, "placeholder": "Optional feedback for the creator…"}),
        label="Message to partner (optional)",
    )


@admin.register(Partner)
class PartnerAdmin(admin.ModelAdmin):
    form = PartnerAdminForm
    list_display = (
        "partner_name",
        "partner_code",
        "discount_code",
        "social_handle",
        "status",
        "payment_method",
        "payment_ready",
        "commission_percentage",
        "total_commission_earned",
        "created_at",
    )
    list_filter = ("status", "payment_method", "country")
    search_fields = (
        "partner_name",
        "partner_code",
        "discount_code",
        "social_handle",
        "user__email",
        "user__username",
        "payment_details",
    )
    readonly_fields = (
        "partner_code",
        "discount_code",
        "total_sales",
        "total_commission_earned",
        "qr_preview",
        "approved_at",
        "payment_details_updated_at",
        "payment_details_data",
        "country",
    )
    inlines = [PartnerSaleInline, PartnerNotificationInline]
    actions = [
        "approve_partners",
        "reject_partners",
        "suspend_partners",
        "export_partners_excel",
    ]
    change_list_template = "admin/partners/partner/change_list.html"

    fieldsets = (
        (None, {"fields": ("user", "partner_name", "partner_code", "discount_code", "status", "approved_at")}),
        (
            "Partner communication",
            {"fields": ("message_to_partner",), "description": "Optional note sent when status changes on save."},
        ),
        (
            "Profile",
            {"fields": ("bio", "social_handle", "continent", "country_code", "country", "region", "city", "application_notes")},
        ),
        (
            "Commission & Payouts",
            {
                "fields": (
                    "commission_percentage",
                    "payment_method",
                    "payment_details",
                    "payment_details_data",
                    "payment_details_updated_at",
                )
            },
        ),
        ("Totals", {"fields": ("total_sales", "total_commission_earned")}),
        ("QR Code", {"fields": ("qr_code_image", "qr_preview")}),
    )

    def payment_ready(self, obj):
        if obj.has_payment_details:
            return format_html('<span style="color:#2d6a4f;">Ready</span>')
        return format_html('<span style="color:#b08900;">Missing</span>')

    payment_ready.short_description = "Payout info"

    def qr_preview(self, obj):
        if obj.qr_code_image:
            return format_html('<img src="{}" width="160" />', obj.qr_code_image.url)
        return "Generated on approval"

    qr_preview.short_description = "QR Preview"

    def save_model(self, request, obj, form, change):
        if change:
            previous = Partner.objects.filter(pk=obj.pk).first()
            if previous and previous.status != obj.status:
                obj._admin_status_message = form.cleaned_data.get("message_to_partner", "")
        super().save_model(request, obj, form, change)

    def _apply_status_action(self, request, queryset, new_status, action_label, action_name):
        if "apply" in request.POST:
            form = PartnerStatusActionForm(request.POST)
            if form.is_valid():
                message = form.cleaned_data["message_to_partner"]
                updated = 0
                for partner in queryset:
                    if partner.status != new_status:
                        partner._admin_status_message = message
                        partner.status = new_status
                        partner.save()
                        updated += 1
                self.message_user(request, f"{updated} partner(s) {action_label}.")
                return None

            self.message_user(request, "Invalid form submission.", level=messages.ERROR)
            return None

        form = PartnerStatusActionForm(
            initial={"_selected_action": request.POST.getlist(helpers.ACTION_CHECKBOX_NAME)}
        )
        context = {
            **self.admin_site.each_context(request),
            "title": f"{action_label.title()} selected partners",
            "partners": queryset,
            "form": form,
            "action_label": action_label,
            "action_name": action_name,
            "opts": self.model._meta,
        }
        return render(request, "admin/partner_status_action.html", context)

    @admin.action(description="Approve selected partners")
    def approve_partners(self, request, queryset):
        return self._apply_status_action(
            request, queryset, PartnerStatus.APPROVED, "approved", "approve_partners"
        )

    @admin.action(description="Decline selected applications")
    def reject_partners(self, request, queryset):
        return self._apply_status_action(
            request, queryset, PartnerStatus.REJECTED, "declined", "reject_partners"
        )

    @admin.action(description="Suspend selected partners")
    def suspend_partners(self, request, queryset):
        return self._apply_status_action(
            request, queryset, PartnerStatus.SUSPENDED, "suspended", "suspend_partners"
        )

    @admin.action(description="Export selected partners to Excel")
    def export_partners_excel(self, request, queryset):
        buffer = build_partners_workbook(queryset)
        response = HttpResponse(
            buffer.getvalue(),
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        response["Content-Disposition"] = 'attachment; filename="partners_export.xlsx"'
        return response

    def changelist_view(self, request, extra_context=None):
        extra_context = extra_context or {}
        extra_context["show_export_all_link"] = True
        return super().changelist_view(request, extra_context=extra_context)

    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path(
                "export-all/",
                self.admin_site.admin_view(self.export_all_partners_view),
                name="partners_partner_export_all",
            ),
        ]
        return custom_urls + urls

    def export_all_partners_view(self, request):
        buffer = build_partners_workbook()
        response = HttpResponse(
            buffer.getvalue(),
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        response["Content-Disposition"] = 'attachment; filename="all_partners_export.xlsx"'
        return response


@admin.register(PartnerNotification)
class PartnerNotificationAdmin(admin.ModelAdmin):
    list_display = ("created_at", "partner", "notification_type", "title", "is_read")
    list_filter = ("notification_type", "is_read", "created_at")
    search_fields = ("title", "message", "partner__partner_code", "partner__partner_name")
    readonly_fields = ("partner", "notification_type", "title", "message", "created_at")


@admin.register(PartnerSale)
class PartnerSaleAdmin(admin.ModelAdmin):
    list_display = ("order_id", "partner", "customer_email", "total", "commission_amount", "status", "created_at")
    list_filter = ("status",)
    search_fields = ("order_id", "customer_email", "partner__partner_code", "shopify_order_id")
    readonly_fields = ("commission_amount",)


@admin.register(PartnerClick)
class PartnerClickAdmin(admin.ModelAdmin):
    list_display = ("partner", "converted", "clicked_at", "converted_at", "city", "region", "country", "ip_address")
    list_filter = ("converted",)
    search_fields = ("partner__partner_code", "session_key")


@admin.register(PartnerPayment)
class PartnerPaymentAdmin(admin.ModelAdmin):
    list_display = ("partner", "amount", "status", "period_start", "period_end", "paid_at")
    list_filter = ("status", "payment_method")
    filter_horizontal = ("sales",)


@admin.register(MarketingAsset)
class MarketingAssetAdmin(admin.ModelAdmin):
    list_display = ("title", "asset_type", "is_active", "created_at")
    list_filter = ("asset_type", "is_active")


@admin.register(ShopifyWebhookEvent)
class ShopifyWebhookEventAdmin(admin.ModelAdmin):
    list_display = ("topic", "status", "shopify_order_id", "partner", "received_at", "processed_at")
    list_filter = ("topic", "status")
    search_fields = ("webhook_id", "shopify_order_id", "partner__partner_code", "error_message")
    readonly_fields = (
        "webhook_id",
        "topic",
        "shopify_order_id",
        "partner",
        "sale",
        "status",
        "error_message",
        "received_at",
        "processed_at",
    )


@admin.register(ProgramActivity)
class ProgramActivityAdmin(admin.ModelAdmin):
    list_display = ("created_at", "event_type", "partner", "description", "ip_address")
    list_filter = ("event_type", "created_at")
    search_fields = ("description", "partner__partner_code", "partner__partner_name", "user__email")
    readonly_fields = (
        "event_type",
        "description",
        "partner",
        "user",
        "sale",
        "click",
        "payment",
        "ip_address",
        "user_agent",
        "metadata",
        "created_at",
    )
    date_hierarchy = "created_at"

    actions = ["export_activity_excel"]

    @admin.action(description="Export selected activity to Excel")
    def export_activity_excel(self, request, queryset):
        from partners.analytics.exports import build_activity_workbook

        buffer = build_activity_workbook(queryset)
        response = HttpResponse(
            buffer.getvalue(),
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        response["Content-Disposition"] = 'attachment; filename="program_activity.xlsx"'
        return response
