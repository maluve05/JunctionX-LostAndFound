"""Day-0 gate (b): does PLONK run on this machine, and how fast?

    python dev/day0_plonk.py <panorama.jpg> [--device cpu|cuda]

Times model load, embedding, sampling (100 / 1000), likelihood (100 points) and
localizability on one image, and prints the top regions of the samples.
Paste the table into the plan's cost/latency section.
"""
from __future__ import annotations

import argparse
import time
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))  # repo root, for plonk_engine


def timed(label, fn, rows):
    t0 = time.perf_counter()
    out = fn()
    rows.append((label, time.perf_counter() - t0))
    print(f"{label:<32} {rows[-1][1]:8.2f} s", flush=True)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("image", type=Path, help="any street-level photo or panorama view")
    ap.add_argument("--device", default=None)
    ap.add_argument("--quick", action="store_true", help="skip the 100-point likelihood; 16-sample localizability")
    args = ap.parse_args()

    import torch
    from plonk_engine import PlonkBackend, PlonkEngine, region_shares

    device = args.device or ("cuda" if torch.cuda.is_available() else "cpu")
    print(f"torch {torch.__version__}, device={device}, threads={torch.get_num_threads()}")
    img = Image.open(args.image).convert("RGB")
    rows = []
    backend = timed("load model", lambda: PlonkBackend(device=device), rows)
    engine = PlonkEngine(backend)
    emb = timed("embed 1 view", lambda: backend.embed(img), rows)
    timed("sample 100", lambda: backend.sample(img, 100, 0.0), rows)
    samples = timed("sample 1000", lambda: backend.sample(img, 1000, 0.0), rows)
    timed("likelihood 10 points", lambda: backend.log_likelihood(emb, samples[:10]), rows)
    if not args.quick:
        timed("likelihood 100 points", lambda: backend.log_likelihood(emb, samples[:100]), rows)
    backend.loc_samples = 16 if args.quick else backend.loc_samples
    loc = timed(f"localizability ({backend.loc_samples} MC)", lambda: backend.localizability(img), rows)

    shares = region_shares([tuple(s) for s in samples])
    in_area = sum(1 for s in samples if 27.5 <= s[0] <= 51.2 and -31.5 <= s[1] <= 9.7)
    print(f"\nimage: {args.image.name}  localizability={loc:.3f}  samples in PT/ES/FR bbox: {in_area}/1000")
    print("top regions:", ", ".join(f"{r} {100 * p:.0f}%" for r, p in list(shares.items())[:5]) or "none")
    print("\n| step | seconds |\n|---|---|")
    for label, s in rows:
        print(f"| {label} | {s:.2f} |")
    _ = engine


if __name__ == "__main__":
    main()
