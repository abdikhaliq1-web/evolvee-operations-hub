from django.http import JsonResponse
from django.views.decorators.http import require_GET

from partners.data.locations import (
    list_cities,
    list_continents,
    list_countries,
    list_subdivisions,
    resolve_country_name,
)
from partners.utils.payment_schemas import bank_region_for_country, get_payment_fields


@require_GET
def location_continents(request):
    return JsonResponse({"continents": list_continents()})


@require_GET
def location_countries(request):
    continent = request.GET.get("continent", "")
    return JsonResponse({"countries": list_countries(continent)})


@require_GET
def location_subdivisions(request):
    country = request.GET.get("country", "").upper()
    return JsonResponse({"subdivisions": list_subdivisions(country)})


@require_GET
def location_cities(request):
    country = request.GET.get("country", "").upper()
    region = request.GET.get("region", "")
    return JsonResponse({"cities": list_cities(country, region)})


@require_GET
def payment_fields_schema(request):
    method = request.GET.get("method", "")
    country_code = request.GET.get("country", "").upper()
    fields = get_payment_fields(method, country_code)

    region_key = bank_region_for_country(country_code) if method == "bank_transfer" else ""
    region_labels = {
        "US": "United States (routing + account number)",
        "GB": "United Kingdom (sort code + account number)",
        "CA": "Canada (institution + transit + account)",
        "AU": "Australia (BSB + account number)",
        "SEPA": "SEPA / IBAN format",
        "DEFAULT": "International bank transfer",
    }

    return JsonResponse(
        {
            "fields": fields,
            "country_label": resolve_country_name(country_code) if country_code else "",
            "region_label": region_labels.get(region_key, ""),
        }
    )
