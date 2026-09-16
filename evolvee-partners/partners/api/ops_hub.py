import secrets

from django.conf import settings
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from partners.analytics.queries import get_ops_hub_summary


def _header_api_key(request) -> str:
    return (request.headers.get("X-Ops-Hub-Key") or "").strip()


class OpsSummaryView(APIView):
    """Read-only KPIs for the Operations Hub. QR scans, Shopify, and the portal do not use this."""

    authentication_classes = []
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        expected = (getattr(settings, "OPS_HUB_API_KEY", "") or "").strip()
        if not expected:
            return Response(
                {"detail": "Operations Hub API is not configured."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        provided = _header_api_key(request)
        if len(provided) != len(expected) or not secrets.compare_digest(provided, expected):
            return Response(
                {"detail": "Invalid API key."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        return Response(get_ops_hub_summary())
