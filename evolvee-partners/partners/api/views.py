from django.db.models.functions import TruncDate
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from partners.models import MarketingAsset, Partner, PartnerPayment, PartnerSale, ProgramActivity
from partners.serializers import (
    MarketingAssetSerializer,
    PartnerApplicationSerializer,
    PartnerPaymentSerializer,
    PartnerSaleSerializer,
    PartnerSerializer,
)
from partners.utils.activity import log_activity
from partners.utils.commission import get_partner_stats


class IsApprovedPartner(permissions.BasePermission):
    def has_permission(self, request, view):
        return (
            request.user.is_authenticated
            and hasattr(request.user, "partner_profile")
            and request.user.partner_profile.is_active
        )


class PartnerApplicationView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = PartnerApplicationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        from django.contrib.auth.models import User

        if User.objects.filter(email=data["email"]).exists():
            return Response(
                {"detail": "An account with this email already exists."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = User.objects.create_user(
            username=data["email"],
            email=data["email"],
            password=data["password"],
            first_name=data["first_name"],
            last_name=data["last_name"],
        )
        partner = Partner.objects.create(
            user=user,
            partner_name=data["partner_name"],
            social_handle=data.get("social_handle", ""),
            bio=data.get("bio", ""),
            payment_method=data.get("payment_method", ""),
            application_notes=data.get("application_notes", ""),
        )

        log_activity(
            ProgramActivity.EventType.PARTNER_APPLIED,
            partner=partner,
            user=user,
            description=f"API application from {partner.partner_name}.",
            metadata={"partner_code": partner.partner_code},
        )

        return Response(
            {
                "detail": "Application submitted. You will receive access once approved.",
                "partner_code": partner.partner_code,
                "status": partner.status,
            },
            status=status.HTTP_201_CREATED,
        )


class PartnerProfileView(generics.RetrieveAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = PartnerSerializer

    def get_object(self):
        return self.request.user.partner_profile


class PartnerStatsView(APIView):
    permission_classes = [IsApprovedPartner]

    def get(self, request):
        partner = request.user.partner_profile
        stats = get_partner_stats(partner)

        daily_clicks = (
            partner.clicks.annotate(day=TruncDate("clicked_at"))
            .values("day")
            .order_by("day")
            .distinct()
        )
        click_chart = [
            {"date": str(item["day"]), "clicks": partner.clicks.filter(clicked_at__date=item["day"]).count()}
            for item in daily_clicks[:30]
        ]

        return Response({**stats, "click_chart": click_chart})


class PartnerActivityLogMixin:
    def dispatch(self, request, *args, **kwargs):
        response = super().dispatch(request, *args, **kwargs)
        if request.user.is_authenticated and hasattr(request.user, "partner_profile"):
            log_activity(
                ProgramActivity.EventType.API_REQUEST,
                partner=request.user.partner_profile,
                user=request.user,
                description=f"API {request.method} {request.path}",
                metadata={"path": request.path, "method": request.method},
            )
        return response


class PartnerSalesListView(PartnerActivityLogMixin, generics.ListAPIView):
    permission_classes = [IsApprovedPartner]
    serializer_class = PartnerSaleSerializer

    def get_queryset(self):
        return PartnerSale.objects.filter(partner=self.request.user.partner_profile)


class PartnerPaymentsListView(PartnerActivityLogMixin, generics.ListAPIView):
    permission_classes = [IsApprovedPartner]
    serializer_class = PartnerPaymentSerializer

    def get_queryset(self):
        return PartnerPayment.objects.filter(partner=self.request.user.partner_profile)


class MarketingAssetListView(PartnerActivityLogMixin, generics.ListAPIView):
    permission_classes = [IsApprovedPartner]
    serializer_class = MarketingAssetSerializer

    def get_queryset(self):
        return MarketingAsset.objects.filter(is_active=True)
