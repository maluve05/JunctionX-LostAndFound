"""Build data/regions.geojson (one polygon per allowlist region) from Natural Earth admin-1.

    python dev/scripts/build_regions_geojson.py

Downloads Natural Earth 10m admin-1 (public domain), keeps PT/ES/FR, maps each
province / département / district to its allowlist region with regions.normalise(),
and dissolves them. regions.region_of() picks the file up automatically.
"""
from __future__ import annotations

import json
import sys
from collections import defaultdict
from pathlib import Path

import requests
from shapely.geometry import mapping, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT))
from regions import REGIONS, normalise  # noqa: E402

URL = ("https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/"
       "geojson/ne_10m_admin_1_states_provinces.geojson")
CACHE = ROOT / "data" / "ne_10m_admin_1.geojson"
OUT = ROOT / "data" / "regions.geojson"


def main():
    CACHE.parent.mkdir(exist_ok=True)
    if not CACHE.exists():
        print("downloading Natural Earth admin-1 (~40 MB)…")
        r = requests.get(URL, timeout=300, headers={"User-Agent": "junctionx-geoloc/0.1"})
        r.raise_for_status()
        CACHE.write_bytes(r.content)
    feats = json.loads(CACHE.read_text(encoding="utf-8"))["features"]

    parts, unmapped = defaultdict(list), []
    for f in feats:
        p = f["properties"]
        if p.get("adm0_a3") not in ("PRT", "ESP", "FRA"):
            continue
        iso = p.get("iso_3166_2") or ""
        try:
            code = normalise(iso)
        except ValueError:
            code = None
        if code not in REGIONS:  # overseas départements, unknown codes
            unmapped.append(f"{iso} {p.get('name')}")
            continue
        parts[code].append(shape(f["geometry"]).buffer(0))

    out = {"type": "FeatureCollection", "features": [
        {"type": "Feature", "properties": {"code": c, "name": REGIONS[c][0]},
         "geometry": mapping(unary_union(geoms).simplify(0.002))}
        for c, geoms in sorted(parts.items())]}
    OUT.write_text(json.dumps(out), encoding="utf-8")
    missing = sorted(set(REGIONS) - set(parts))
    print(f"wrote {OUT} with {len(parts)} regions")
    if missing:
        print("MISSING regions:", missing)
    if unmapped:
        print(f"skipped {len(unmapped)} admin-1 units (e.g. overseas):", ", ".join(unmapped[:12]))


if __name__ == "__main__":
    main()
