from partners.data.locations import (
    continent_for_country_code,
    country_has_subdivisions,
    find_country_code,
    find_subdivision_code,
    resolve_country_name,
    resolve_subdivision_name,
)


def location_initial_for_partner(partner) -> dict:
    country_code = partner.country_code or find_country_code(partner.country)
    return {
        "continent": partner.continent or continent_for_country_code(country_code),
        "country_code": country_code,
        "region_code": find_subdivision_code(country_code, partner.region),
        "city": partner.city,
    }


def apply_location_to_partner(partner, post_data) -> list[str]:
    errors = []
    continent = (post_data.get("continent") or "").strip()
    country_code = (post_data.get("country_code") or "").strip().upper()
    region_code = (post_data.get("region_code") or "").strip()
    city = (post_data.get("city") or "").strip()

    if not continent:
        errors.append("Please select your region / continent.")
    if not country_code:
        errors.append("Please select your country.")
    if not city:
        errors.append("Please select or enter your city.")
    if country_code and country_has_subdivisions(country_code) and not region_code:
        errors.append("Please select your state / province / region.")

    if country_code and region_code:
        region_name = resolve_subdivision_name(country_code, region_code)
    else:
        region_name = ""

    if errors:
        return errors

    partner.continent = continent
    partner.country_code = country_code
    partner.country = resolve_country_name(country_code)
    partner.region = region_name
    partner.city = city
    return []
