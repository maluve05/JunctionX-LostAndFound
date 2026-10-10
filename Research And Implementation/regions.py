"""Region allowlist, name -> ISO code normalisation, centroids and point-in-polygon lookup.

Every region code in the project must come from ``REGIONS`` (plus the three
country codes). Province / département codes are folded into their region by
``normalise()``; free-text names are never stored.
"""
from __future__ import annotations

import json
import math
import re
import unicodedata
from functools import lru_cache
from pathlib import Path

COUNTRIES = ("PT", "ES", "FR")

# code -> (display name, centroid lat, centroid lon)
REGIONS: dict[str, tuple[str, float, float]] = {
    # --- Portugal: 18 districts + 2 autonomous regions ---
    "PT-01": ("Aveiro", 40.64, -8.47),
    "PT-02": ("Beja", 37.95, -7.90),
    "PT-03": ("Braga", 41.55, -8.20),
    "PT-04": ("Bragança", 41.60, -6.80),
    "PT-05": ("Castelo Branco", 39.85, -7.50),
    "PT-06": ("Coimbra", 40.20, -8.15),
    "PT-07": ("Évora", 38.55, -7.85),
    "PT-08": ("Faro", 37.20, -8.10),
    "PT-09": ("Guarda", 40.60, -7.25),
    "PT-10": ("Leiria", 39.75, -8.85),
    "PT-11": ("Lisboa", 38.90, -9.15),
    "PT-12": ("Portalegre", 39.25, -7.55),
    "PT-13": ("Porto", 41.20, -8.45),
    "PT-14": ("Santarém", 39.30, -8.55),
    "PT-15": ("Setúbal", 38.35, -8.70),
    "PT-16": ("Viana do Castelo", 41.85, -8.35),
    "PT-17": ("Vila Real", 41.45, -7.60),
    "PT-18": ("Viseu", 40.75, -7.90),
    "PT-20": ("Açores", 38.65, -28.00),
    "PT-30": ("Madeira", 32.75, -17.00),
    # --- Spain: 17 autonomous communities + 2 autonomous cities ---
    "ES-AN": ("Andalucía", 37.45, -4.70),
    "ES-AR": ("Aragón", 41.55, -0.90),
    "ES-AS": ("Asturias", 43.30, -5.95),
    "ES-CB": ("Cantabria", 43.18, -4.03),
    "ES-CL": ("Castilla y León", 41.70, -4.30),
    "ES-CM": ("Castilla-La Mancha", 39.50, -3.00),
    "ES-CN": ("Canarias", 28.30, -16.00),
    "ES-CT": ("Cataluña", 41.80, 1.50),
    "ES-EX": ("Extremadura", 39.20, -6.15),
    "ES-GA": ("Galicia", 42.75, -7.90),
    "ES-IB": ("Illes Balears", 39.60, 2.95),
    "ES-RI": ("La Rioja", 42.30, -2.50),
    "ES-MD": ("Comunidad de Madrid", 40.50, -3.75),
    "ES-MC": ("Región de Murcia", 38.00, -1.50),
    "ES-NC": ("Navarra", 42.70, -1.65),
    "ES-PV": ("País Vasco", 43.00, -2.60),
    "ES-VC": ("Comunitat Valenciana", 39.40, -0.70),
    "ES-CE": ("Ceuta", 35.89, -5.32),
    "ES-ML": ("Melilla", 35.29, -2.94),
    # --- France: 13 metropolitan régions ---
    "FR-ARA": ("Auvergne-Rhône-Alpes", 45.50, 4.90),
    "FR-BFC": ("Bourgogne-Franche-Comté", 47.20, 4.80),
    "FR-BRE": ("Bretagne", 48.20, -2.90),
    "FR-CVL": ("Centre-Val de Loire", 47.50, 1.70),
    "FR-20R": ("Corse", 42.15, 9.10),
    "FR-GES": ("Grand Est", 48.70, 5.60),
    "FR-HDF": ("Hauts-de-France", 50.00, 2.80),
    "FR-IDF": ("Île-de-France", 48.65, 2.50),
    "FR-NOR": ("Normandie", 49.10, 0.20),
    "FR-NAQ": ("Nouvelle-Aquitaine", 45.00, 0.30),
    "FR-OCC": ("Occitanie", 43.70, 2.30),
    "FR-PDL": ("Pays de la Loire", 47.50, -0.80),
    "FR-PAC": ("Provence-Alpes-Côte d'Azur", 43.95, 6.05),
}

ALLOWLIST: frozenset[str] = frozenset(REGIONS) | frozenset(COUNTRIES)


def country_of(code: str) -> str:
    """'ES-GA' -> 'ES'; 'ES' -> 'ES'."""
    return code.split("-")[0]


def is_valid(code: str) -> bool:
    return code in ALLOWLIST


def validate_code(code: str) -> str:
    """Return ``code`` unchanged if it is on the allowlist, else raise ValueError."""
    if code not in ALLOWLIST:
        raise ValueError(
            f"{code!r} is not an allowlisted region code (province codes and free-text names are rejected)"
        )
    return code


# ---------------------------------------------------------------- normalise
# Spanish provinces (ISO 3166-2:ES) -> autonomous community
_ES_PROVINCES = {
    "C": "GA", "LU": "GA", "OR": "GA", "PO": "GA",
    "O": "AS", "S": "CB", "BI": "PV", "SS": "PV", "VI": "PV", "NA": "NC", "LO": "RI",
    "HU": "AR", "TE": "AR", "Z": "AR",
    "B": "CT", "GI": "CT", "L": "CT", "T": "CT",
    "AV": "CL", "BU": "CL", "LE": "CL", "P": "CL", "SA": "CL", "SG": "CL", "SO": "CL", "VA": "CL", "ZA": "CL",
    "AB": "CM", "CR": "CM", "CU": "CM", "GU": "CM", "TO": "CM",
    "BA": "EX", "CC": "EX", "M": "MD", "MU": "MC",
    "A": "VC", "CS": "VC", "V": "VC", "PM": "IB",
    "GC": "CN", "TF": "CN",
    "AL": "AN", "CA": "AN", "CO": "AN", "GR": "AN", "H": "AN", "J": "AN", "MA": "AN", "SE": "AN",
}

# French départements -> région (metropolitan)
_FR_DEPTS: dict[str, str] = {}
for _region, _depts in {
    "ARA": "01 03 07 15 26 38 42 43 63 69 73 74",
    "BFC": "21 25 39 58 70 71 89 90",
    "BRE": "22 29 35 56",
    "CVL": "18 28 36 37 41 45",
    "20R": "2A 2B",
    "GES": "08 10 51 52 54 55 57 67 68 88",
    "HDF": "02 59 60 62 80",
    "IDF": "75 77 78 91 92 93 94 95",
    "NOR": "14 27 50 61 76",
    "NAQ": "16 17 19 23 24 33 40 47 64 79 86 87",
    "OCC": "09 11 12 30 31 32 34 46 48 65 66 81 82",
    "PDL": "44 49 53 72 85",
    "PAC": "04 05 06 13 83 84",
}.items():
    for _d in _depts.split():
        _FR_DEPTS[_d] = f"FR-{_region}"
_FR_OLD_CODES = {"FR-6AE": "FR-GES"}  # Alsace collectivité européenne


def _fold(text: str) -> str:
    text = unicodedata.normalize("NFKD", text)
    text = "".join(c for c in text if not unicodedata.combining(c))
    text = re.sub(r"[^a-z0-9]+", " ", text.lower()).strip()
    return text


_ALIASES: dict[str, str] = {}


def _alias(code: str, *names: str) -> None:
    for n in names:
        _ALIASES[_fold(n)] = code


for _code, (_name, _, _) in REGIONS.items():
    _alias(_code, _name)

_alias("PT", "Portugal")
_alias("ES", "Spain", "España", "Espana")
_alias("FR", "France", "Francia")
_alias("ES-AN", "Andalusia", "Andalucia")
_alias("ES-AR", "Aragon")
_alias("ES-AS", "Asturias", "Principado de Asturias", "Asturies")
_alias("ES-CL", "Castile and Leon", "Castilla Leon", "Castilla y Leon")
_alias("ES-CM", "Castilla La Mancha", "Castile-La Mancha", "Castile La Mancha")
_alias("ES-CN", "Canary Islands", "Canarias", "Islas Canarias", "Canaries")
_alias("ES-CT", "Catalonia", "Catalunya", "Cataluna", "Catalogne")
_alias("ES-EX", "Estremadura")
_alias("ES-GA", "Galiza", "Galicia")
_alias("ES-IB", "Balearic Islands", "Baleares", "Islas Baleares", "Illes Balears", "Balears")
_alias("ES-RI", "Rioja")
_alias("ES-MD", "Madrid", "Community of Madrid", "Comunidad de Madrid")
_alias("ES-MC", "Murcia", "Region de Murcia")
_alias("ES-NC", "Navarre", "Nafarroa", "Comunidad Foral de Navarra")
_alias("ES-PV", "Basque Country", "Euskadi", "Pais Vasco", "Pays Basque Espagnol")
_alias("ES-VC", "Valencia", "Valencian Community", "Comunidad Valenciana", "Comunitat Valenciana")
_alias("PT-20", "Azores", "Acores", "Açores")
_alias("PT-30", "Madeira")
_alias("PT-11", "Lisbon")
_alias("PT-13", "Oporto")
_alias("FR-ARA", "Auvergne Rhone Alpes", "Rhone Alpes")
_alias("FR-BFC", "Burgundy", "Bourgogne Franche Comte", "Bourgogne")
_alias("FR-BRE", "Brittany", "Bretagne")
_alias("FR-CVL", "Centre", "Centre Val de Loire")
_alias("FR-20R", "Corsica", "Corse")
_alias("FR-GES", "Alsace", "Lorraine", "Champagne Ardenne", "Grand Est")
_alias("FR-HDF", "Nord Pas de Calais", "Picardie", "Hauts de France")
_alias("FR-IDF", "Ile de France", "Paris Region")
_alias("FR-NOR", "Normandy", "Normandie")
_alias("FR-NAQ", "Aquitaine", "Limousin", "Poitou Charentes", "Nouvelle Aquitaine")
_alias("FR-OCC", "Languedoc Roussillon", "Midi Pyrenees", "Occitania")
_alias("FR-PDL", "Pays de la Loire", "Loire Country")
_alias("FR-PAC", "Provence", "Provence Alpes Cote d Azur", "PACA", "Cote d Azur")


def normalise(value: str) -> str:
    """Map a name or code (any case, any province/département code) to an allowlist code.

    "Andalucía" / "Andalusia" -> "ES-AN"; "ES-LU" -> "ES-GA"; "FR-6AE" -> "FR-GES".
    Raises ValueError when the value cannot be resolved.
    """
    raw = value.strip()
    up = raw.upper()
    if up in ALLOWLIST:
        return up
    if up in _FR_OLD_CODES:
        return _FR_OLD_CODES[up]
    if up.startswith("ES-") and up[3:] in _ES_PROVINCES:
        return f"ES-{_ES_PROVINCES[up[3:]]}"
    if up.startswith("FR-") and up[3:] in _FR_DEPTS:
        return _FR_DEPTS[up[3:]]
    folded = _fold(raw)
    if folded in _ALIASES:
        return _ALIASES[folded]
    raise ValueError(f"Cannot resolve {value!r} to an allowlisted region")


# ------------------------------------------------------------ geometry
_GEOJSON_PATH = Path(__file__).parent / "data" / "regions.geojson"
_SNAP_DEG = 0.05  # ≈ 5 km


def centroid(code: str) -> tuple[float, float]:
    """(lat, lon) of a region's centroid, or of a country (mean of its regions)."""
    if code in REGIONS:
        _, lat, lon = REGIONS[code]
        return lat, lon
    validate_code(code)
    pts = [(la, lo) for c, (_, la, lo) in REGIONS.items() if country_of(c) == code]
    return sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts)


@lru_cache(maxsize=1)
def _load_polygons():
    """Load ``data/regions.geojson`` (features with a ``code`` property) if present."""
    if not _GEOJSON_PATH.exists():
        return None
    from shapely.geometry import shape
    from shapely.strtree import STRtree

    feats = json.loads(_GEOJSON_PATH.read_text(encoding="utf-8"))["features"]
    geoms, codes = [], []
    for f in feats:
        code = f["properties"].get("code")
        if code in REGIONS:
            geoms.append(shape(f["geometry"]))
            codes.append(code)
    return STRtree(geoms), geoms, codes


def _haversine_km(lat1, lon1, lat2, lon2) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi, dl = p2 - p1, math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * 6371.0088 * math.asin(math.sqrt(a))


def region_of(lat: float, lon: float, max_centroid_km: float = 350.0) -> str | None:
    """Region code containing (lat, lon), or None if outside PT/ES/FR.

    Uses real polygons when ``data/regions.geojson`` exists; otherwise falls back
    to the nearest centroid within ``max_centroid_km`` (coarse, good enough for
    development and tests).
    """
    loaded = _load_polygons()
    if loaded is not None:
        from shapely.geometry import Point

        tree, geoms, codes = loaded
        pt = Point(lon, lat)
        for idx in tree.query(pt):
            if geoms[int(idx)].covers(pt):
                return codes[int(idx)]
        # just offshore (coastal samples, simplified polygons): snap to the nearest region within ~5 km
        near = [(geoms[int(i)].distance(pt), codes[int(i)]) for i in tree.query(pt.buffer(_SNAP_DEG))]
        near = [t for t in near if t[0] <= _SNAP_DEG]
        return min(near)[1] if near else None
    best, best_d = None, float("inf")
    for code, (_, clat, clon) in REGIONS.items():
        d = _haversine_km(lat, lon, clat, clon)
        if d < best_d:
            best, best_d = code, d
    return best if best_d <= max_centroid_km else None


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    return _haversine_km(lat1, lon1, lat2, lon2)
