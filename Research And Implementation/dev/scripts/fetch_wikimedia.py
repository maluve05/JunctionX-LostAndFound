"""Top up the eval set with geotagged 360° (equirectangular) images from Wikimedia Commons.

    python dev/scripts/fetch_wikimedia.py --per-region 2            # every allowlist region
    python dev/scripts/fetch_wikimedia.py --regions ES-GA PT-11 --per-region 5

For each region it runs Commons full-text searches (nearcoord:) at random points inside the region,
keeps files that look equirectangular (2:1, >= 3000 px wide, or a 360°/equirectangular
category; at most one frame per Mapillary sequence), downloads a 4096 px rendition into dev/eval/, and appends rows to
dev/eval/labels.csv (region looked up from the file's coordinates). Own challenge
rounds should still come first; these are the top-up.
"""
from __future__ import annotations

import argparse
import csv
import random
import re
import sys
import time
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT))
from regions import REGIONS, region_of  # noqa: E402

API = "https://commons.wikimedia.org/w/api.php"
UA = {"User-Agent": "junctionx-geoloc-eval/0.1 (hackathon research; non-commercial)"}
EVAL = ROOT / "dev" / "eval"
LABELS = EVAL / "labels.csv"
FIELDS = ["image_id", "path", "lat", "lon", "region", "source", "notes"]
PANO_CAT = re.compile(r"360|equirectangular|spherical panorama", re.I)


def random_point_in(code: str, rng: random.Random) -> tuple[float, float]:
    _, lat0, lon0 = REGIONS[code]
    for _ in range(200):
        lat, lon = lat0 + rng.uniform(-2, 2), lon0 + rng.uniform(-2.5, 2.5)
        if region_of(lat, lon) == code:
            return lat, lon
    return lat0, lon0


# Commons CirrusSearch with a geo filter; Mapillary imports are street-level, closest to challenge panoramas
QUERIES = ['mapillary 360 nearcoord:{r}km,{lat},{lon}',
           '"360°" panorama nearcoord:{r}km,{lat},{lon}',
           'spherical panorama nearcoord:{r}km,{lat},{lon}']


def search(lat: float, lon: float, session: requests.Session, radius_km: int = 50) -> list[dict]:
    pages: dict[str, dict] = {}
    for q in QUERIES:
        params = {
            "action": "query", "format": "json", "generator": "search",
            "gsrsearch": q.format(r=radius_km, lat=f"{lat:.4f}", lon=f"{lon:.4f}"),
            "gsrnamespace": 6, "gsrlimit": 50,
            "prop": "imageinfo|coordinates|categories", "iiprop": "url|size|mime|extmetadata",
            "iiurlwidth": 4096, "cllimit": "max", "colimit": "max",
        }
        for p in get_json(session, params).get("query", {}).get("pages", {}).values():
            pages[p["title"]] = p
        time.sleep(1)
    return list(pages.values())


def get_json(session: requests.Session, params: dict, retries: int = 5) -> dict:
    for attempt in range(retries):
        r = session.get(API, params=params, timeout=30)
        if r.status_code == 429:
            wait = int(r.headers.get("Retry-After", 0)) or 5 * 2 ** attempt
            print(f"rate limited, waiting {wait}s", file=sys.stderr)
            time.sleep(wait)
            continue
        r.raise_for_status()
        return r.json()
    raise requests.HTTPError("still rate limited after retries")


MAPILLARY_SEQ = re.compile(r"Mapillary \(([^)]+)\)")


def dedup_key(title: str) -> str:
    """One image per Mapillary sequence: consecutive frames are near-duplicates."""
    m = MAPILLARY_SEQ.search(title)
    return f"mapillary:{m.group(1)}" if m else title


def is_equirect(page: dict) -> bool:
    info = (page.get("imageinfo") or [{}])[0]
    w, h = info.get("width", 0), info.get("height", 1)
    if info.get("mime") not in ("image/jpeg", "image/png"):
        return False
    cats = " ".join(c["title"] for c in page.get("categories", []))
    return (abs(w / h - 2) < 0.02 and w >= 3000) or (PANO_CAT.search(cats) is not None and abs(w / h - 2) < 0.05)


def existing_rows() -> list[dict]:
    if not LABELS.exists():
        return []
    with open(LABELS, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--regions", nargs="*", default=sorted(REGIONS))
    ap.add_argument("--per-region", type=int, default=2)
    ap.add_argument("--tries", type=int, default=8, help="geosearch points per region")
    ap.add_argument("--seed", type=int, default=0)
    args = ap.parse_args()

    rng = random.Random(args.seed)
    session = requests.Session()
    session.headers.update(UA)
    EVAL.mkdir(exist_ok=True)
    rows = existing_rows()
    seen = {dedup_key(r["notes"].split(" | ")[0]) for r in rows}
    new_rows = []

    for code in args.regions:
        got = sum(1 for r in rows + new_rows if r["region"] == code and r["source"] == "wikimedia")
        for _ in range(args.tries):
            if got >= args.per_region:
                break
            lat, lon = random_point_in(code, rng)
            try:
                pages = search(lat, lon, session)
            except requests.RequestException as e:
                print(f"{code}: search failed: {e}", file=sys.stderr)
                time.sleep(2)
                continue
            time.sleep(1)
            for page in pages:
                if got >= args.per_region:
                    break
                title = page["title"]
                coords = page.get("coordinates")
                if dedup_key(title) in seen or not coords or not is_equirect(page):
                    continue
                plat, plon = coords[0]["lat"], coords[0]["lon"]
                region = region_of(plat, plon)
                if region != code:
                    continue
                info = page["imageinfo"][0]
                url = info.get("thumburl") or info["url"]
                image_id = f"wm_{code.lower().replace('-', '')}_{page['pageid']}"
                dest = EVAL / f"{image_id}.jpg"
                try:
                    img = session.get(url, timeout=120)
                    img.raise_for_status()
                except requests.RequestException as e:
                    print(f"{title}: download failed: {e}", file=sys.stderr)
                    continue
                dest.write_bytes(img.content)
                lic = info.get("extmetadata", {}).get("LicenseShortName", {}).get("value", "?")
                new_rows.append({"image_id": image_id, "path": dest.name, "lat": f"{plat:.6f}", "lon": f"{plon:.6f}",
                                 "region": region, "source": "wikimedia", "notes": f"{title} | {lic}"})
                seen.add(dedup_key(title))
                got += 1
                print(f"{code}: + {title} ({lic})")
                time.sleep(1)
        if got < args.per_region:
            print(f"{code}: only {got}/{args.per_region} found", file=sys.stderr)

    write_header = not LABELS.exists()
    with open(LABELS, "a", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        if write_header:
            w.writeheader()
        w.writerows(new_rows)
    print(f"added {len(new_rows)} images; labels.csv now has {len(rows) + len(new_rows)} rows")


if __name__ == "__main__":
    main()
