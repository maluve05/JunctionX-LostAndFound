"""Evaluate one or more pipeline arms on the labelled eval set (no hints).

    python eval.py --arm plonk                  # run arm, cache predictions, print metrics
    python eval.py --arm mock --mock-dir dev/mocks  # score pre-made Result JSON files
    python eval.py --compare plonk baseline     # paired comparison of two cached arms

Labels live in ``dev/eval/labels.csv`` with columns:
    image_id, path, lat, lon, region, source, notes
``path`` is relative to ``dev/eval/`` and may be an equirectangular image or a folder of
viewer screenshots. ``region`` must be an allowlist code (see regions.py).
Predictions are cached per arm in ``dev/eval/runs/<arm>/<image_id>.json``.
"""
from __future__ import annotations

import argparse
import csv
import json
import math
import random
import statistics
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

from regions import country_of, haversine_km, region_of, validate_code
from schemas import Result

EVAL_DIR = Path(__file__).parent / "dev" / "eval"
LABELS = EVAL_DIR / "labels.csv"
RUNS = EVAL_DIR / "runs"


# ------------------------------------------------------------------ labels
@dataclass(frozen=True)
class Label:
    image_id: str
    path: Path
    lat: float
    lon: float
    region: str
    source: str = ""
    notes: str = ""


def load_labels(csv_path: Path = LABELS, check_files: bool = True) -> list[Label]:
    """Read and validate labels.csv. Raises ValueError listing every bad row."""
    labels, errors, seen = [], [], set()
    with open(csv_path, newline="", encoding="utf-8") as f:
        for i, row in enumerate(csv.DictReader(f), start=2):
            try:
                image_id = row["image_id"].strip()
                if not image_id or image_id in seen:
                    raise ValueError(f"missing or duplicate image_id {image_id!r}")
                seen.add(image_id)
                lat, lon = float(row["lat"]), float(row["lon"])
                region = validate_code(row["region"].strip())
                if "-" not in region:
                    raise ValueError(f"label region must be a region, not a country: {region}")
                path = csv_path.parent / row["path"].strip()
                if check_files and not path.exists():
                    raise ValueError(f"file not found: {path}")
                labels.append(Label(image_id, path, lat, lon, region,
                                    (row.get("source") or "").strip(), (row.get("notes") or "").strip()))
            except (KeyError, ValueError) as e:
                errors.append(f"labels.csv line {i}: {e}")
    if errors:
        raise ValueError("\n".join(errors))
    return labels


def check_label_consistency(labels: list[Label]) -> list[str]:
    """Warn where the labelled region disagrees with the region looked up from lat/lon."""
    warnings = []
    for lab in labels:
        looked_up = region_of(lab.lat, lab.lon)
        if looked_up is not None and looked_up != lab.region:
            warnings.append(f"{lab.image_id}: label {lab.region} but coordinates fall in {looked_up}")
        if looked_up is None:
            warnings.append(f"{lab.image_id}: coordinates ({lab.lat}, {lab.lon}) are outside PT/ES/FR")
    return warnings


# ------------------------------------------------------------------ metrics
def wilson_ci(k: int, n: int, z: float = 1.96) -> tuple[float, float]:
    """95% Wilson score interval for a proportion k/n."""
    if n == 0:
        return (0.0, 1.0)
    p = k / n
    denom = 1 + z * z / n
    centre = (p + z * z / (2 * n)) / denom
    half = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / denom
    return (max(0.0, centre - half), min(1.0, centre + half))


def bootstrap_median_ci(values: list[float], n_boot: int = 2000, seed: int = 0) -> tuple[float, float]:
    if not values:
        return (math.nan, math.nan)
    rng = random.Random(seed)
    meds = sorted(statistics.median(rng.choices(values, k=len(values))) for _ in range(n_boot))
    return (meds[int(0.025 * n_boot)], meds[int(0.975 * n_boot) - 1])


def top_k_regions(result: Result, k: int) -> list[str]:
    regions = {c: p for c, p in result.region_probs.items() if "-" in c}
    return sorted(regions, key=regions.get, reverse=True)[:k]


@dataclass
class ImageScore:
    image_id: str
    region_correct: bool
    country_correct: bool
    top3_correct: bool
    distance_km: float | None   # None when the Result has no candidates
    took_hint: bool


def score_one(label: Label, result: Result) -> ImageScore:
    top = result.top_region()
    dist = None
    if result.candidates:
        best = min(result.candidates, key=lambda c: c.rank)
        dist = haversine_km(label.lat, label.lon, best.lat, best.lon)
    return ImageScore(
        image_id=label.image_id,
        region_correct=top == label.region,
        country_correct=result.top_country() == country_of(label.region),
        top3_correct=label.region in top_k_regions(result, 3),
        distance_km=dist,
        took_hint=result.hint_advice == "take_hint",
    )


def summarise(scores: list[ImageScore]) -> dict:
    n = len(scores)

    def rate(attr):
        k = sum(getattr(s, attr) for s in scores)
        lo, hi = wilson_ci(k, n)
        return {"k": k, "n": n, "rate": k / n if n else math.nan, "ci": (lo, hi)}

    dists = [s.distance_km for s in scores if s.distance_km is not None]
    return {
        "n": n,
        "region_acc": rate("region_correct"),
        "country_acc": rate("country_correct"),
        "top3_region": rate("top3_correct"),
        "take_hint_rate": rate("took_hint"),
        "median_km": statistics.median(dists) if dists else math.nan,
        "median_km_ci": bootstrap_median_ci(dists),
        "n_with_coords": len(dists),
    }


def paired_compare(a: list[ImageScore], b: list[ImageScore], attr: str = "region_correct") -> dict:
    """Exact McNemar test on the images both arms scored."""
    bmap = {s.image_id: s for s in b}
    pairs = [(s, bmap[s.image_id]) for s in a if s.image_id in bmap]
    only_a = sum(getattr(x, attr) and not getattr(y, attr) for x, y in pairs)
    only_b = sum(getattr(y, attr) and not getattr(x, attr) for x, y in pairs)
    m = only_a + only_b
    if m == 0:
        p = 1.0
    else:
        tail = sum(math.comb(m, i) for i in range(0, min(only_a, only_b) + 1)) / 2 ** m
        p = min(1.0, 2 * tail)
    return {"n_paired": len(pairs), "only_a": only_a, "only_b": only_b, "p_value": p}


def format_summary(name: str, s: dict) -> str:
    def pct(m):
        lo, hi = m["ci"]
        return f"{100 * m['rate']:.1f}% [{100 * lo:.0f}–{100 * hi:.0f}] ({m['k']}/{m['n']})"

    lo, hi = s["median_km_ci"]
    return "\n".join([
        f"### Arm `{name}` — {s['n']} images",
        "| metric | value (95% CI) |",
        "|---|---|",
        f"| region accuracy | {pct(s['region_acc'])} |",
        f"| country accuracy | {pct(s['country_acc'])} |",
        f"| true region in top 3 | {pct(s['top3_region'])} |",
        f"| median distance error | {s['median_km']:.0f} km [{lo:.0f}–{hi:.0f}] ({s['n_with_coords']} with coords) |",
        f"| hint advisor says take_hint | {pct(s['take_hint_rate'])} |",
    ])


# ------------------------------------------------------------------ arms
Predictor = Callable[[Label], Result]


def _mock_predictor(mock_dir: Path) -> Predictor:
    def predict(label: Label) -> Result:
        return Result.model_validate_json((mock_dir / f"{label.image_id}.json").read_text(encoding="utf-8"))
    return predict


def get_predictor(arm: str, mock_dir: Path | None = None) -> Predictor:
    if arm == "mock":
        return _mock_predictor(mock_dir or Path("dev/mocks"))
    import run  # lazy: pulls in torch / anthropic only when needed
    return lambda label: run.predict(label.path, arm=arm, image_id=label.image_id)


def run_arm(arm: str, labels: list[Label], predictor: Predictor, rerun: bool = False) -> list[tuple[Label, Result]]:
    out_dir = RUNS / arm
    out_dir.mkdir(parents=True, exist_ok=True)
    timings = {}
    pairs = []
    for i, lab in enumerate(labels, 1):
        cache = out_dir / f"{lab.image_id}.json"
        if cache.exists() and not rerun:
            result = Result.model_validate_json(cache.read_text(encoding="utf-8"))
        else:
            t0 = time.perf_counter()
            try:
                result = predictor(lab)
            except Exception as e:  # one bad image must not kill a long eval run
                print(f"[{i}/{len(labels)}] {lab.image_id}: FAILED {type(e).__name__}: {e}", file=sys.stderr)
                continue
            timings[lab.image_id] = time.perf_counter() - t0
            cache.write_text(result.model_dump_json(indent=2), encoding="utf-8")
            print(f"[{i}/{len(labels)}] {lab.image_id}: {result.top_region()} "
                  f"(truth {lab.region}) {timings[lab.image_id]:.1f}s", file=sys.stderr)
        pairs.append((lab, result))
    if timings:
        print(f"mean seconds/image for new runs: {statistics.mean(timings.values()):.1f}", file=sys.stderr)
    return pairs


def load_cached(arm: str, labels: list[Label]) -> list[tuple[Label, Result]]:
    pairs = []
    for lab in labels:
        f = RUNS / arm / f"{lab.image_id}.json"
        if f.exists():
            pairs.append((lab, Result.model_validate_json(f.read_text(encoding="utf-8"))))
    return pairs


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--arm", help="arm to run: plonk | baseline | pipeline | hybrid | mock")
    ap.add_argument("--labels", type=Path, default=LABELS)
    ap.add_argument("--mock-dir", type=Path)
    ap.add_argument("--rerun", action="store_true", help="ignore cached predictions")
    ap.add_argument("--limit", type=int, help="only the first N images (smoke test)")
    ap.add_argument("--compare", nargs=2, metavar=("ARM_A", "ARM_B"), help="paired comparison of cached arms")
    ap.add_argument("--check-labels", action="store_true", help="validate labels.csv and exit")
    args = ap.parse_args(argv)

    labels = load_labels(args.labels, check_files=not args.compare)
    for w in check_label_consistency(labels):
        print("WARN", w, file=sys.stderr)
    if args.limit:
        labels = labels[: args.limit]
    if args.check_labels:
        print(f"{len(labels)} labels OK")
        return 0

    if args.compare:
        a_name, b_name = args.compare
        a = [score_one(l, r) for l, r in load_cached(a_name, labels)]
        b = [score_one(l, r) for l, r in load_cached(b_name, labels)]
        print(format_summary(a_name, summarise(a)), "\n")
        print(format_summary(b_name, summarise(b)), "\n")
        for attr in ("region_correct", "country_correct"):
            c = paired_compare(a, b, attr)
            print(f"paired {attr}: {c['n_paired']} images, only {a_name} right {c['only_a']}, "
                  f"only {b_name} right {c['only_b']}, McNemar p={c['p_value']:.3f}")
        return 0

    if not args.arm:
        ap.error("--arm or --compare is required")
    pairs = run_arm(args.arm, labels, get_predictor(args.arm, args.mock_dir), rerun=args.rerun)
    scores = [score_one(l, r) for l, r in pairs]
    summary = summarise(scores)
    print(format_summary(args.arm, summary))
    (RUNS / args.arm / "_summary.json").write_text(json.dumps(summary, indent=2, default=list), encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
