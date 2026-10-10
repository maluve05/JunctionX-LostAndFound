"""CLI: geolocate one panorama and say whether a hint is worth taking.

    python run.py pano.jpg [--hint "region: Andalucía"] [--arm plonk] [--out result.json]
    python run.py screenshots_folder/ --hint "country: Spain" --hint "text: Concello"

Arms (plan Verification §3):
    plonk     (d) PLONK alone — self-contained, works today
    baseline  (a) one Opus call + geodata tools        -> aggregator.baseline()      [person B]
    pipeline  (b) specialists + aggregator             -> agents + aggregator        [A + B]
    hybrid    (e) pipeline + PLONK combined (§4b)      -> aggregator + plonk_engine  [A + B + C]
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Any

import numpy as np

from regions import COUNTRIES, REGIONS, country_of, haversine_km, normalise
from schemas import Candidate, Hint, Result

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp"}
_ENGINE = None  # one PLONK model per process


def get_engine():
    global _ENGINE
    if _ENGINE is None:
        from plonk_engine import PlonkEngine
        _ENGINE = PlonkEngine()
    return _ENGINE


# ------------------------------------------------------------------ hints
def parse_hint(text: str) -> Hint:
    """'region: Andalucía' -> Hint(region, ES-AN). Rejects anything not on the allowlist."""
    if ":" not in text:
        raise ValueError(f"hint must look like 'type: value', got {text!r}")
    kind, value = (s.strip() for s in text.split(":", 1))
    kind = kind.lower()
    if kind in ("country", "region"):
        code = normalise(value)
        if kind == "country" and code not in COUNTRIES:
            raise ValueError(f"{value!r} is not PT/ES/FR")
        if kind == "region" and code in COUNTRIES:
            raise ValueError(f"{value!r} is a country; use 'country: {value}'")
        return Hint(type=kind, value=code)
    if kind in ("city", "text", "other"):
        return Hint(type=kind, value=value)
    raise ValueError(f"unknown hint type {kind!r} (country | region | city | text | other)")


def hard_filter(hints: list[Hint]) -> set[str] | None:
    codes = {h.value for h in hints if h.type in ("country", "region")}
    return codes or None


def allowed(code: str, filt: set[str] | None) -> bool:
    return filt is None or code in filt or country_of(code) in filt


# ------------------------------------------------------------------ views
def load_views(path: Path) -> list[Any]:
    """Perspective views as PIL images. Prefers person A's preprocess module when present."""
    from PIL import Image

    try:
        import preprocess  # person A
        return list(preprocess.load_views(path))
    except (ImportError, AttributeError):
        pass
    if path.is_dir():
        files = sorted(p for p in path.iterdir() if p.suffix.lower() in IMAGE_EXTS)
        if not files:
            raise ValueError(f"no images in {path}")
        return [Image.open(p).convert("RGB") for p in files]
    img = Image.open(path).convert("RGB")
    w, h = img.size
    if abs(w / h - 2) > 0.1:  # not equirectangular: treat as a single view
        return [img]
    try:
        import py360convert
        arr = np.asarray(img)
        return [Image.fromarray(py360convert.e2p(arr, fov_deg=90, u_deg=yaw, v_deg=0, out_hw=(512, 512)))
                for yaw in range(-180, 180, 45)]
    except ImportError:  # crude fallback: 4 horizontal crops of the horizon band
        return [img.crop((i * w // 4, h // 4, (i + 1) * w // 4, 3 * h // 4)) for i in range(4)]


# ------------------------------------------------------------------ hint advice
def advise(region_probs: dict[str, float], low_confidence: bool, tau: float = 0.1) -> tuple[str, str | None]:
    """Uses person B's hint_advisor when present; otherwise the plan §5 rule."""
    try:
        import hint_advisor  # person B
        return hint_advisor.advise(region_probs, low_confidence, tau=tau)
    except (ImportError, AttributeError):
        pass
    ranked = sorted(((c, p) for c, p in region_probs.items() if "-" in c), key=lambda t: -t[1])
    if not ranked:
        return "take_hint", "country hint"
    p1 = ranked[0][1]
    p2 = ranked[1][1] if len(ranked) > 1 else 0.0
    if p1 - p2 >= tau and not low_confidence:
        return "submit", None
    if len(ranked) < 2:
        return "take_hint", f"region hint: confirm {ranked[0][0]}"
    a, b = ranked[0][0], ranked[1][0]
    if country_of(a) != country_of(b):
        return "take_hint", f"country hint: splits {country_of(a)} vs {country_of(b)}"
    return "take_hint", f"region hint: splits {a} vs {b}"


# ------------------------------------------------------------------ plonk arm
def _density_mode(pts: np.ndarray, bandwidth_km: float = 25.0) -> tuple[np.ndarray, float]:
    """Sample with the most neighbours within bandwidth_km, and median spread around it."""
    if len(pts) > 1500:
        pts = pts[np.linspace(0, len(pts) - 1, 1500).astype(int)]
    lat = np.radians(pts[:, 0])
    x = np.radians(pts[:, 1]) * np.cos(lat.mean()) * 6371.0
    y = lat * 6371.0
    d = np.hypot(x[:, None] - x[None, :], y[:, None] - y[None, :])
    best = int((d < bandwidth_km).sum(1).argmax())
    return pts[best], float(np.median(d[best]))


def predict_plonk(views: list[Any], image_id: str, hints: list[Hint]) -> Result:
    from regions import region_of
    engine = get_engine()
    report = engine.region_report(image_id, views)
    filt = hard_filter(hints)
    probs = {c: p for c, p in report.region_scores.items() if allowed(c, filt)}
    z = sum(probs.values())
    probs = {c: p / z for c, p in probs.items()} if z else {}

    # same pooled samples (cached in the engine) to place a pin inside each top region
    samples = engine.pooled_samples(views)
    sample_regions = np.array([region_of(float(a), float(b)) or "" for a, b in samples])

    candidates = []
    for rank, (code, p) in enumerate(sorted(probs.items(), key=lambda t: -t[1])[:5], start=1):
        in_region = samples[sample_regions == code]
        if len(in_region):
            (lat, lon), spread = _density_mode(in_region)
        else:
            (_, lat, lon), spread = REGIONS[code], 100.0
        candidates.append(Candidate(
            rank=rank, lat=float(lat), lon=float(lon), radius_km=round(max(spread, 5.0), 1),
            name=f"PLONK mode in {REGIONS[code][0]}", region=code, probability=p,
            evidence=[f"{100 * p:.0f}% of PLONK samples", "source: plonk"],
        ))
    if not candidates and filt:  # hint excluded every sample: fall back to the hinted region's centre
        code = sorted(filt)[0]
        from regions import centroid
        lat, lon = centroid(code)
        target = code if "-" in code else (region_of(lat, lon) or next(r for r in REGIONS if country_of(r) == code))
        candidates.append(Candidate(rank=1, lat=lat, lon=lon, radius_km=150, name=f"Centre of {code}",
                                    region=target, probability=0.0, evidence=["source: region_centroid"]))
    threshold = LOW_LOCALIZABILITY["exact" if engine.exact else "kde"]
    low_conf = report.localizability is not None and report.localizability < threshold
    advice, suggestion = advise(probs, low_conf)
    return Result(image_id=image_id, candidates=candidates, region_probs=probs, low_confidence=low_conf,
                  hint_advice=advice, suggested_hint=suggestion, hints_used=hints)


# Placeholders until tuned on the eval set. "exact" = PLONK's own localizability (Challenge-01 poster: 0.14);
# "kde" = concentration() proxy, share of samples within 150 km of the mode.
LOW_LOCALIZABILITY = {"exact": 0.1, "kde": 0.15}


# ------------------------------------------------------------------ entry point
def predict(path: Path | str, arm: str = "plonk", image_id: str | None = None,
            hints: list[Hint] | None = None) -> Result:
    path = Path(path)
    image_id = image_id or path.stem
    hints = hints or []
    views = load_views(path)
    if arm == "plonk":
        return predict_plonk(views, image_id, hints)
    if arm in ("baseline", "pipeline", "hybrid"):
        try:
            import aggregator  # person B
        except ImportError as e:
            raise NotImplementedError(f"arm {arm!r} needs aggregator.py (person B)") from e
        if arm == "baseline":
            return aggregator.baseline(views, image_id=image_id, hints=hints)
        import agents  # person A
        reports = agents.run_specialists(views, image_id=image_id)
        plonk = get_engine() if arm == "hybrid" else None
        return aggregator.aggregate(reports, views, image_id=image_id, hints=hints, plonk=plonk)
    raise ValueError(f"unknown arm {arm!r}")


def format_result(result: Result) -> str:
    lines = [f"## {result.image_id}", "",
             "| # | region | prob | radius | name | map | evidence |", "|---|---|---|---|---|---|---|"]
    for c in sorted(result.candidates, key=lambda c: c.rank):
        url = f"https://www.google.com/maps?q={c.lat:.5f},{c.lon:.5f}"
        lines.append(f"| {c.rank} | {c.region} ({REGIONS[c.region][0]}) | {100 * c.probability:.0f}% | "
                     f"{c.radius_km:.0f} km | {c.name} | [{c.lat:.4f}, {c.lon:.4f}]({url}) | "
                     f"{'; '.join(c.evidence + c.verified_by)} |")
    ranked = sorted(((k, v) for k, v in result.region_probs.items() if "-" in k), key=lambda t: -t[1])
    p1 = ranked[0][1] if ranked else 0.0
    p2 = ranked[1][1] if len(ranked) > 1 else 0.0
    lines += ["", f"**Top region:** {result.top_region()}  ·  p1 = {p1:.2f}, margin p1−p2 = {p1 - p2:.2f}"
              + ("  ·  ⚠ low confidence" if result.low_confidence else ""),
              f"**Advice:** {result.hint_advice}" + (f" — {result.suggested_hint}" if result.suggested_hint else "")]
    if result.hints_used:
        lines.append("**Hints used:** " + ", ".join(f"{h.type}={h.value}" for h in result.hints_used))
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("image", type=Path, help="equirectangular image or folder of screenshots")
    ap.add_argument("--hint", action="append", default=[], help='e.g. "region: Andalucía" (repeatable)')
    ap.add_argument("--arm", default="plonk", choices=["plonk", "baseline", "pipeline", "hybrid"])
    ap.add_argument("--out", type=Path, help="write the Result JSON here")
    args = ap.parse_args(argv)
    try:
        hints = [parse_hint(h) for h in args.hint]
    except ValueError as e:
        ap.error(str(e))
    result = predict(args.image, arm=args.arm, hints=hints)
    print(format_result(result))
    if args.out:
        args.out.write_text(result.model_dump_json(indent=2), encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
