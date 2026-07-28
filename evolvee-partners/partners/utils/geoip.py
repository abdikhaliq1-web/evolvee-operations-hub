import ipaddress
import json
import logging
from urllib.error import URLError
from urllib.request import urlopen

from django.conf import settings

logger = logging.getLogger(__name__)


def _is_public_ip(ip_address: str) -> bool:
    try:
        ip = ipaddress.ip_address(ip_address)
    except ValueError:
        return False
    return not (ip.is_private or ip.is_loopback or ip.is_reserved or ip.is_link_local)


def _lookup_geoip2(ip_address: str) -> dict | None:
    db_path = getattr(settings, "GEOLITE2_CITY_PATH", "")
    if not db_path:
        return None
    try:
        import geoip2.database
    except ImportError:
        return None

    try:
        with geoip2.database.Reader(db_path) as reader:
            response = reader.city(ip_address)
            return {
                "country": response.country.iso_code or "",
                "region": response.subdivisions.most_specific.name if response.subdivisions else "",
                "city": response.city.name or "",
                "continent": response.continent.name if response.continent else "",
            }
    except Exception:
        logger.debug("GeoIP2 lookup failed for %s", ip_address, exc_info=True)
        return None


def _lookup_ip_api(ip_address: str) -> dict | None:
    url = f"http://ip-api.com/json/{ip_address}?fields=status,country,countryCode,regionName,city,continent"
    try:
        with urlopen(url, timeout=2) as response:
            data = json.loads(response.read().decode("utf-8"))
    except (URLError, TimeoutError, json.JSONDecodeError, ValueError):
        logger.debug("ip-api lookup failed for %s", ip_address, exc_info=True)
        return None

    if data.get("status") != "success":
        return None

    return {
        "country": data.get("countryCode") or data.get("country") or "",
        "region": data.get("regionName") or "",
        "city": data.get("city") or "",
        "continent": data.get("continent") or "",
    }


def lookup_ip(ip_address: str | None) -> dict:
    """
    Resolve an IP to country, region (state), and city.
    Uses GeoLite2 when GEOLITE2_CITY_PATH is configured, otherwise ip-api.com.
    """
    empty = {"country": "", "region": "", "city": "", "continent": ""}
    if not ip_address or not _is_public_ip(ip_address):
        return empty

    geo = _lookup_geoip2(ip_address) or _lookup_ip_api(ip_address)
    if not geo:
        return empty

    from partners.utils.continents import country_to_continent

    country = (geo.get("country") or "")[:64]
    continent = (geo.get("continent") or "")[:64]
    if not continent and country:
        continent = country_to_continent(country)

    return {
        "country": country,
        "region": (geo.get("region") or "")[:128],
        "city": (geo.get("city") or "")[:128],
        "continent": continent[:64] if continent else "",
    }


def format_location(city: str = "", region: str = "", country: str = "", continent: str = "") -> str:
    """Build a readable label like 'Los Angeles, California, US, North America'."""
    parts = [part for part in (city, region, country, continent) if part]
    return ", ".join(parts) if parts else "—"
