# Integration points (proposal from C, change freely)

`run.py` and `eval.py` call these functions. They're imported lazily, so nothing breaks while a module is missing. If you prefer other names, say so and C will update `run.py`.

| Owner | Function | Returns | Used by |
|---|---|---|---|
| A | `preprocess.load_views(path: Path) -> list[PIL.Image]` | the perspective views (an equirect file or a folder of screenshots) | `run.load_views` (falls back to its own simple cutter) |
| A | `agents.run_specialists(views, image_id: str) -> list[SpecialistReport]` | one report per specialist | arms `pipeline`, `hybrid` |
| B | `aggregator.baseline(views, image_id: str, hints: list[Hint]) -> Result` | ablation arm (a): one Opus call + tools | arm `baseline` |
| B | `aggregator.aggregate(reports, views, image_id: str, hints: list[Hint], plonk: PlonkEngine \| None) -> Result` | arm (b) when `plonk is None`, arm (e) otherwise | arms `pipeline`, `hybrid` |
| B | `hint_advisor.advise(region_probs: dict, low_confidence: bool, tau: float = 0.1) -> tuple[Literal["submit","take_hint"], str \| None]` | advice + suggested hint | `run.advise` (falls back to the plan §5 rule) |

## What `plonk_engine.PlonkEngine` gives B

```python
engine.region_report(image_id, views)           -> SpecialistReport(specialist="plonk", region_scores=..., localizability=...)
engine.score_candidates(views, [(lat, lon), …]) -> mean log-likelihood per point (≤ 2000 points per call)
engine.rank_candidates(views, coords, log_p_reasoning=[…]) -> [((lat, lon), score), …] best first
engine.best_in_region(views, region="ES-GA")    -> (lat, lon, ll)  # 5 km grid; or center=…, radius_km=25
plonk_engine.combine(p_plonk, p_reasoning, alpha, hard_filter={"ES"}) -> region probs, sums to 1
plonk_engine.StubBackend(samples=…, peak=…)     # deterministic fake for B's tests: PlonkEngine(StubBackend(...))
```

Embeddings, samples and localizability are cached per view inside the engine, so reusing one engine across a hint rerun is cheap.

## Additions to the plan's `schemas.py`

- `Result.top_region()` returns argmax over region codes (bare country codes are ignored); `Result.top_country()` sums per country. `eval.py` uses both.
- `city` hints keep free text (`"Ribadeo"`). Cities have no ISO code, so only `country` and `region` hint values are validated.
- `region_of(lat, lon)` uses `data/regions.geojson` (Natural Earth, dissolved to the allowlist; rebuild with `dev/scripts/build_regions_geojson.py`) and snaps points up to ~5 km offshore.
