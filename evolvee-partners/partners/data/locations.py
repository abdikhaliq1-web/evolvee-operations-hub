"""Continent → country → state/province → city hierarchy for partner forms."""

CONTINENTS = [
    "Africa",
    "Asia",
    "Europe",
    "North America",
    "Oceania",
    "South America",
]

COUNTRIES_BY_CONTINENT: dict[str, list[dict[str, str]]] = {
    "Africa": [
        {"code": "EG", "name": "Egypt"},
        {"code": "GH", "name": "Ghana"},
        {"code": "KE", "name": "Kenya"},
        {"code": "MA", "name": "Morocco"},
        {"code": "NG", "name": "Nigeria"},
        {"code": "ZA", "name": "South Africa"},
    ],
    "Asia": [
        {"code": "CN", "name": "China"},
        {"code": "IN", "name": "India"},
        {"code": "ID", "name": "Indonesia"},
        {"code": "JP", "name": "Japan"},
        {"code": "MY", "name": "Malaysia"},
        {"code": "PH", "name": "Philippines"},
        {"code": "SA", "name": "Saudi Arabia"},
        {"code": "SG", "name": "Singapore"},
        {"code": "KR", "name": "South Korea"},
        {"code": "TH", "name": "Thailand"},
        {"code": "AE", "name": "United Arab Emirates"},
        {"code": "VN", "name": "Vietnam"},
    ],
    "Europe": [
        {"code": "DE", "name": "Germany"},
        {"code": "ES", "name": "Spain"},
        {"code": "FR", "name": "France"},
        {"code": "IE", "name": "Ireland"},
        {"code": "IT", "name": "Italy"},
        {"code": "NL", "name": "Netherlands"},
        {"code": "NO", "name": "Norway"},
        {"code": "PL", "name": "Poland"},
        {"code": "PT", "name": "Portugal"},
        {"code": "SE", "name": "Sweden"},
        {"code": "CH", "name": "Switzerland"},
        {"code": "GB", "name": "United Kingdom"},
    ],
    "North America": [
        {"code": "CA", "name": "Canada"},
        {"code": "MX", "name": "Mexico"},
        {"code": "US", "name": "United States"},
    ],
    "Oceania": [
        {"code": "AU", "name": "Australia"},
        {"code": "NZ", "name": "New Zealand"},
    ],
    "South America": [
        {"code": "AR", "name": "Argentina"},
        {"code": "BR", "name": "Brazil"},
        {"code": "CL", "name": "Chile"},
        {"code": "CO", "name": "Colombia"},
        {"code": "PE", "name": "Peru"},
    ],
}

# ISO code → display name (all countries above)
COUNTRY_NAMES: dict[str, str] = {
    country["code"]: country["name"]
    for countries in COUNTRIES_BY_CONTINENT.values()
    for country in countries
}

# Subdivision code → {name, cities}
SUBDIVISIONS: dict[str, dict[str, dict]] = {
    "US": {
        "AL": {"name": "Alabama", "cities": ["Birmingham", "Montgomery", "Mobile", "Huntsville"]},
        "AK": {"name": "Alaska", "cities": ["Anchorage", "Fairbanks", "Juneau"]},
        "AZ": {"name": "Arizona", "cities": ["Phoenix", "Tucson", "Mesa", "Scottsdale"]},
        "AR": {"name": "Arkansas", "cities": ["Little Rock", "Fayetteville", "Fort Smith"]},
        "CA": {"name": "California", "cities": ["Los Angeles", "San Francisco", "San Diego", "San Jose", "Sacramento", "Oakland"]},
        "CO": {"name": "Colorado", "cities": ["Denver", "Colorado Springs", "Aurora", "Boulder"]},
        "CT": {"name": "Connecticut", "cities": ["Hartford", "New Haven", "Stamford", "Bridgeport"]},
        "DE": {"name": "Delaware", "cities": ["Wilmington", "Dover", "Newark"]},
        "FL": {"name": "Florida", "cities": ["Miami", "Orlando", "Tampa", "Jacksonville", "Fort Lauderdale"]},
        "GA": {"name": "Georgia", "cities": ["Atlanta", "Savannah", "Augusta", "Columbus"]},
        "HI": {"name": "Hawaii", "cities": ["Honolulu", "Hilo", "Kailua"]},
        "ID": {"name": "Idaho", "cities": ["Boise", "Meridian", "Nampa"]},
        "IL": {"name": "Illinois", "cities": ["Chicago", "Springfield", "Naperville", "Aurora"]},
        "IN": {"name": "Indiana", "cities": ["Indianapolis", "Fort Wayne", "Evansville"]},
        "IA": {"name": "Iowa", "cities": ["Des Moines", "Cedar Rapids", "Davenport"]},
        "KS": {"name": "Kansas", "cities": ["Wichita", "Overland Park", "Kansas City"]},
        "KY": {"name": "Kentucky", "cities": ["Louisville", "Lexington", "Bowling Green"]},
        "LA": {"name": "Louisiana", "cities": ["New Orleans", "Baton Rouge", "Shreveport"]},
        "ME": {"name": "Maine", "cities": ["Portland", "Bangor", "Augusta"]},
        "MD": {"name": "Maryland", "cities": ["Baltimore", "Annapolis", "Rockville", "Silver Spring"]},
        "MA": {"name": "Massachusetts", "cities": ["Boston", "Cambridge", "Worcester", "Springfield"]},
        "MI": {"name": "Michigan", "cities": ["Detroit", "Grand Rapids", "Ann Arbor", "Lansing"]},
        "MN": {"name": "Minnesota", "cities": ["Minneapolis", "Saint Paul", "Rochester"]},
        "MS": {"name": "Mississippi", "cities": ["Jackson", "Gulfport", "Hattiesburg"]},
        "MO": {"name": "Missouri", "cities": ["Kansas City", "St. Louis", "Springfield"]},
        "MT": {"name": "Montana", "cities": ["Billings", "Missoula", "Bozeman"]},
        "NE": {"name": "Nebraska", "cities": ["Omaha", "Lincoln", "Bellevue"]},
        "NV": {"name": "Nevada", "cities": ["Las Vegas", "Reno", "Henderson"]},
        "NH": {"name": "New Hampshire", "cities": ["Manchester", "Nashua", "Concord"]},
        "NJ": {"name": "New Jersey", "cities": ["Newark", "Jersey City", "Trenton", "Atlantic City"]},
        "NM": {"name": "New Mexico", "cities": ["Albuquerque", "Santa Fe", "Las Cruces"]},
        "NY": {"name": "New York", "cities": ["New York City", "Buffalo", "Rochester", "Albany", "Syracuse"]},
        "NC": {"name": "North Carolina", "cities": ["Charlotte", "Raleigh", "Durham", "Asheville"]},
        "ND": {"name": "North Dakota", "cities": ["Fargo", "Bismarck", "Grand Forks"]},
        "OH": {"name": "Ohio", "cities": ["Columbus", "Cleveland", "Cincinnati", "Toledo"]},
        "OK": {"name": "Oklahoma", "cities": ["Oklahoma City", "Tulsa", "Norman"]},
        "OR": {"name": "Oregon", "cities": ["Portland", "Salem", "Eugene", "Bend"]},
        "PA": {"name": "Pennsylvania", "cities": ["Philadelphia", "Pittsburgh", "Harrisburg", "Allentown"]},
        "RI": {"name": "Rhode Island", "cities": ["Providence", "Warwick", "Newport"]},
        "SC": {"name": "South Carolina", "cities": ["Charleston", "Columbia", "Greenville"]},
        "SD": {"name": "South Dakota", "cities": ["Sioux Falls", "Rapid City", "Pierre"]},
        "TN": {"name": "Tennessee", "cities": ["Nashville", "Memphis", "Knoxville", "Chattanooga"]},
        "TX": {"name": "Texas", "cities": ["Houston", "Dallas", "Austin", "San Antonio", "Fort Worth", "El Paso"]},
        "UT": {"name": "Utah", "cities": ["Salt Lake City", "Provo", "Ogden"]},
        "VT": {"name": "Vermont", "cities": ["Burlington", "Montpelier", "Rutland"]},
        "VA": {"name": "Virginia", "cities": ["Virginia Beach", "Richmond", "Arlington", "Norfolk"]},
        "WA": {"name": "Washington", "cities": ["Seattle", "Spokane", "Tacoma", "Bellevue"]},
        "WV": {"name": "West Virginia", "cities": ["Charleston", "Huntington", "Morgantown"]},
        "WI": {"name": "Wisconsin", "cities": ["Milwaukee", "Madison", "Green Bay"]},
        "WY": {"name": "Wyoming", "cities": ["Cheyenne", "Casper", "Jackson"]},
        "DC": {"name": "District of Columbia", "cities": ["Washington"]},
    },
    "CA": {
        "AB": {"name": "Alberta", "cities": ["Calgary", "Edmonton", "Red Deer"]},
        "BC": {"name": "British Columbia", "cities": ["Vancouver", "Victoria", "Surrey", "Kelowna"]},
        "MB": {"name": "Manitoba", "cities": ["Winnipeg", "Brandon"]},
        "NB": {"name": "New Brunswick", "cities": ["Moncton", "Saint John", "Fredericton"]},
        "NL": {"name": "Newfoundland and Labrador", "cities": ["St. John's", "Corner Brook"]},
        "NS": {"name": "Nova Scotia", "cities": ["Halifax", "Dartmouth", "Sydney"]},
        "ON": {"name": "Ontario", "cities": ["Toronto", "Ottawa", "Mississauga", "Hamilton", "London"]},
        "PE": {"name": "Prince Edward Island", "cities": ["Charlottetown", "Summerside"]},
        "QC": {"name": "Quebec", "cities": ["Montreal", "Quebec City", "Laval", "Gatineau"]},
        "SK": {"name": "Saskatchewan", "cities": ["Saskatoon", "Regina"]},
    },
    "GB": {
        "ENG": {"name": "England", "cities": ["London", "Manchester", "Birmingham", "Leeds", "Liverpool", "Bristol"]},
        "SCT": {"name": "Scotland", "cities": ["Edinburgh", "Glasgow", "Aberdeen", "Dundee"]},
        "WLS": {"name": "Wales", "cities": ["Cardiff", "Swansea", "Newport"]},
        "NIR": {"name": "Northern Ireland", "cities": ["Belfast", "Derry", "Lisburn"]},
    },
    "AU": {
        "NSW": {"name": "New South Wales", "cities": ["Sydney", "Newcastle", "Wollongong"]},
        "VIC": {"name": "Victoria", "cities": ["Melbourne", "Geelong", "Ballarat"]},
        "QLD": {"name": "Queensland", "cities": ["Brisbane", "Gold Coast", "Cairns"]},
        "WA": {"name": "Western Australia", "cities": ["Perth", "Fremantle"]},
        "SA": {"name": "South Australia", "cities": ["Adelaide", "Mount Gambier"]},
        "TAS": {"name": "Tasmania", "cities": ["Hobart", "Launceston"]},
        "ACT": {"name": "Australian Capital Territory", "cities": ["Canberra"]},
        "NT": {"name": "Northern Territory", "cities": ["Darwin", "Alice Springs"]},
    },
    "IT": {
        "LOM": {"name": "Lombardy", "cities": ["Milan", "Bergamo", "Brescia"]},
        "LAZ": {"name": "Lazio", "cities": ["Rome", "Latina", "Viterbo"]},
        "CAM": {"name": "Campania", "cities": ["Naples", "Salerno", "Caserta"]},
        "SIC": {"name": "Sicily", "cities": ["Palermo", "Catania", "Messina"]},
        "VEN": {"name": "Veneto", "cities": ["Venice", "Verona", "Padua"]},
        "TOS": {"name": "Tuscany", "cities": ["Florence", "Pisa", "Siena"]},
        "PIE": {"name": "Piedmont", "cities": ["Turin", "Novara", "Alessandria"]},
        "EMR": {"name": "Emilia-Romagna", "cities": ["Bologna", "Modena", "Parma"]},
    },
    "DE": {
        "BY": {"name": "Bavaria", "cities": ["Munich", "Nuremberg", "Augsburg"]},
        "BE": {"name": "Berlin", "cities": ["Berlin"]},
        "NW": {"name": "North Rhine-Westphalia", "cities": ["Cologne", "Düsseldorf", "Dortmund"]},
        "BW": {"name": "Baden-Württemberg", "cities": ["Stuttgart", "Mannheim", "Karlsruhe"]},
        "HE": {"name": "Hesse", "cities": ["Frankfurt", "Wiesbaden", "Darmstadt"]},
        "HH": {"name": "Hamburg", "cities": ["Hamburg"]},
    },
    "FR": {
        "IDF": {"name": "Île-de-France", "cities": ["Paris", "Versailles", "Boulogne-Billancourt"]},
        "PAC": {"name": "Provence-Alpes-Côte d'Azur", "cities": ["Marseille", "Nice", "Toulon"]},
        "ARA": {"name": "Auvergne-Rhône-Alpes", "cities": ["Lyon", "Grenoble", "Saint-Étienne"]},
        "NAQ": {"name": "Nouvelle-Aquitaine", "cities": ["Bordeaux", "Limoges", "Poitiers"]},
        "OCC": {"name": "Occitanie", "cities": ["Toulouse", "Montpellier", "Nîmes"]},
    },
    "ES": {
        "MD": {"name": "Community of Madrid", "cities": ["Madrid", "Móstoles", "Alcalá de Henares"]},
        "CT": {"name": "Catalonia", "cities": ["Barcelona", "L'Hospitalet", "Badalona"]},
        "AN": {"name": "Andalusia", "cities": ["Seville", "Málaga", "Granada"]},
        "VC": {"name": "Valencian Community", "cities": ["Valencia", "Alicante", "Elche"]},
    },
    "MX": {
        "CMX": {"name": "Mexico City", "cities": ["Mexico City"]},
        "JAL": {"name": "Jalisco", "cities": ["Guadalajara", "Puerto Vallarta"]},
        "NLE": {"name": "Nuevo León", "cities": ["Monterrey", "San Pedro Garza García"]},
        "BCN": {"name": "Baja California", "cities": ["Tijuana", "Mexicali", "Ensenada"]},
    },
    "BR": {
        "SP": {"name": "São Paulo", "cities": ["São Paulo", "Campinas", "Santos"]},
        "RJ": {"name": "Rio de Janeiro", "cities": ["Rio de Janeiro", "Niterói"]},
        "MG": {"name": "Minas Gerais", "cities": ["Belo Horizonte", "Uberlândia"]},
        "BA": {"name": "Bahia", "cities": ["Salvador", "Feira de Santana"]},
    },
    "IN": {
        "MH": {"name": "Maharashtra", "cities": ["Mumbai", "Pune", "Nagpur"]},
        "DL": {"name": "Delhi", "cities": ["New Delhi", "Delhi"]},
        "KA": {"name": "Karnataka", "cities": ["Bengaluru", "Mysuru"]},
        "TN": {"name": "Tamil Nadu", "cities": ["Chennai", "Coimbatore"]},
    },
}

# Cities for countries without subdivisions
COUNTRY_CITIES: dict[str, list[str]] = {
    "SG": ["Singapore"],
    "AE": ["Dubai", "Abu Dhabi", "Sharjah"],
    "IE": ["Dublin", "Cork", "Galway", "Limerick"],
    "NL": ["Amsterdam", "Rotterdam", "The Hague", "Utrecht"],
    "SE": ["Stockholm", "Gothenburg", "Malmö"],
    "NO": ["Oslo", "Bergen", "Trondheim"],
    "CH": ["Zurich", "Geneva", "Basel", "Bern"],
    "PT": ["Lisbon", "Porto", "Faro"],
    "PL": ["Warsaw", "Kraków", "Wrocław", "Gdańsk"],
    "NZ": ["Auckland", "Wellington", "Christchurch"],
    "ZA": ["Johannesburg", "Cape Town", "Durban", "Pretoria"],
    "NG": ["Lagos", "Abuja", "Port Harcourt"],
    "KE": ["Nairobi", "Mombasa", "Kisumu"],
    "JP": ["Tokyo", "Osaka", "Kyoto", "Yokohama"],
    "KR": ["Seoul", "Busan", "Incheon"],
    "CN": ["Beijing", "Shanghai", "Guangzhou", "Shenzhen"],
    "PH": ["Manila", "Quezon City", "Cebu City"],
    "TH": ["Bangkok", "Chiang Mai", "Phuket"],
    "VN": ["Ho Chi Minh City", "Hanoi", "Da Nang"],
    "MY": ["Kuala Lumpur", "George Town", "Johor Bahru"],
    "ID": ["Jakarta", "Surabaya", "Bandung"],
    "SA": ["Riyadh", "Jeddah", "Dammam"],
    "AR": ["Buenos Aires", "Córdoba", "Rosario"],
}

COUNTRY_CITIES["CL"] = ["Santiago", "Valparaíso", "Concepción"]
COUNTRY_CITIES["CO"] = ["Bogotá", "Medellín", "Cali", "Cartagena"]
COUNTRY_CITIES["PE"] = ["Lima", "Arequipa", "Trujillo"]
COUNTRY_CITIES["EG"] = ["Cairo", "Alexandria", "Giza"]
COUNTRY_CITIES["MA"] = ["Casablanca", "Marrakesh", "Rabat"]
COUNTRY_CITIES["GH"] = ["Accra", "Kumasi", "Tamale"]


def list_continents() -> list[str]:
    return CONTINENTS


def list_countries(continent: str) -> list[dict[str, str]]:
    return COUNTRIES_BY_CONTINENT.get(continent, [])


def country_has_subdivisions(country_code: str) -> bool:
    return country_code in SUBDIVISIONS


def list_subdivisions(country_code: str) -> list[dict[str, str]]:
    subdivisions = SUBDIVISIONS.get(country_code, {})
    return [{"code": code, "name": data["name"]} for code, data in subdivisions.items()]


def list_cities(country_code: str, subdivision_code: str = "") -> list[str]:
    if subdivision_code and country_code in SUBDIVISIONS:
        subdiv = SUBDIVISIONS[country_code].get(subdivision_code)
        if subdiv:
            return subdiv.get("cities", [])
    return COUNTRY_CITIES.get(country_code, [])


def resolve_country_name(country_code: str) -> str:
    return COUNTRY_NAMES.get(country_code.upper(), country_code)


def resolve_subdivision_name(country_code: str, subdivision_code: str) -> str:
    if not subdivision_code:
        return ""
    subdiv = SUBDIVISIONS.get(country_code, {}).get(subdivision_code)
    return subdiv["name"] if subdiv else subdivision_code


def find_country_code(country_label: str) -> str:
    if not country_label:
        return ""
    label = country_label.strip()
    upper = label.upper()
    if upper in COUNTRY_NAMES:
        return upper
    for code, name in COUNTRY_NAMES.items():
        if name.upper() == upper:
            return code
    return label


def find_subdivision_code(country_code: str, region_label: str) -> str:
    if not region_label or country_code not in SUBDIVISIONS:
        return ""
    label = region_label.strip()
    for code, data in SUBDIVISIONS[country_code].items():
        if data["name"].upper() == label.upper() or code.upper() == label.upper():
            return code
    return label


def continent_for_country_code(country_code: str) -> str:
    for continent, countries in COUNTRIES_BY_CONTINENT.items():
        if any(c["code"] == country_code for c in countries):
            return continent
    return ""
