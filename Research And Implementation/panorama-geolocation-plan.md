# Plan: Multi-agent geolocation of 360° panoramas (PT / ES / FR)

## Context
Challenge: you get a 360° panorama from somewhere in Portugal, Spain or France and must say where it is. Each hint lowers the score; the exact scoring isn't defined. **The goal is to guess with no hints, and getting the right region counts as success** (our working assumption; Day-0 gate (c) confirms it). "Region" means exactly one ISO 3166-2 code from a fixed allowlist (see `schemas.py`): a Spanish autonomous community or autonomous city, a Portuguese district or autonomous region, or a French metropolitan région. You get the panorama (and any hints) through a website by hand. The goal is a Python tool that takes the panorama and returns **ranked candidate locations**. It also tells you whether a hint is worth taking, and which one. It uses the Claude API (vision) for the reasoning, plus free geodata APIs to check the reasoning. The workspace is empty, so this is a new project.

## Approach

### 0. Build order: baseline first
Everything below is the *target* architecture. Build it in this order, and add a layer only if it beats the previous best on the eval (see Verification):
1. **Day 0 gates:** (a) confirm that the challenge rules allow tool help; (b) confirm PLONK runs on the team's hardware: `pip install diff-plonk`, load `PLONK_OSV_5M`, and time sampling and likelihood on one image, on GPU and on CPU; (c) confirm how the challenge actually scores a guess (right region, or distance from the true spot). If it scores by distance, distance becomes the main metric.
2. **Week 1, baseline:** eval set + `eval.py` + preprocessing + **one Opus call** with the knowledge base and the geodata tools (ablation (a)). This is the first thing that runs end to end.
3. **Then add, one at a time and only if each beats the baseline:** specialists (§2), PLONK (§4b), hint advisor tuning (§5).
4. **Out of the first version:** the Sun agent and the trained models (§2b). The Streamlit UI is a stretch goal.

### 1. Preprocess the panorama (`preprocess.py`)
- **Input, either kind:**
  - an equirectangular image, if the challenge site lets you download one, or
  - a folder of viewer screenshots taken while turning 360°. This is likely the realistic case for a manual challenge. In this case, skip the projection step and use the screenshots as the views.
- For equirectangular input, use `py360convert` to cut it into about 8 perspective views (45° yaw steps, 90° FOV), plus one view tilted down at the road/ground and one tilted up at the sky/sun.
- Also make high-resolution tiled crops (about 2×2 per view) so the model can read small text such as signs, plates and kilometre markers.

### 2. Specialist agents (`agents.py`), run in parallel with `claude-sonnet-5-5`
Each agent returns a `SpecialistReport` (see Shared data formats).
- **Who gets what:** all agents get the full views. Only the Text and Road agents also get the high-resolution tiles. This keeps the image count, and therefore cost and latency, under control.

| Agent | Looks for |
|---|---|
| **Text/Language** | Any readable text. Tells apart PT, ES, Catalan, Galician, Basque, FR, Occitan and Breton. Picks out place names, street names, postcodes, phone prefixes, web domains and business chains. |
| **Road infrastructure** | Road numbers (PT: EN/IC/IP/A; ES: A-/N-/AP- plus regional prefixes such as CL-, CV-, GR-; FR: A/N/D/C), sign fonts and shapes, km/PK markers and *bornes*, bollards, road-line colour and dash pattern, guardrails, licence plates (PT yellow band; the FR département number is a *weak* tell, because since 2009 the owner chooses it freely, so use confidence ≤ 0.3). Keep regional prefixes (CL-, CV-) apart from provincial ones (e.g. GR- = Granada province). |
| **Environment** | Vegetation (eucalyptus, cork/holm oak, olive, maritime pine, vineyards), terrain, soil colour, climate, coast or mountains. |
| **Built environment** | Architecture (azulejos, whitewash, slate roofs vs. terracotta, Basque *caserío*, Breton granite), utility poles, mailboxes, shop types. |
| **Sun/shadows** *(not in the first version)* | Sun direction plus compass orientation, if any can be inferred. Gives a rough latitude/time sanity check. Of little use when the panorama's heading is unknown. |

Each agent's system prompt holds a curated **knowledge base** (`knowledge/*.md`) of country and region tells. This is where most of the accuracy comes from, so the curation should be careful: **every tell needs a cited source** (a Wikipedia page, an official road or plate standard, or a GeoGuessr meta guide), and a second person checks each entry before it is merged.

### 2b. Optional trained Layer-1 models (`models/`): not in the first version; add only if the eval shows Claude is weak at a clue type
- **Geo-embedding prior:** an extra specialist that captures the overall "feel" of the scene. Two options:
  - **StreetCLIP:** zero-shot over text labels of the regions. Licence CC-BY-NC-4.0 (non-commercial use only).
  - **GeoCLIP:** MIT licence (`pip install geoclip`). It returns top-k GPS coordinates, not label scores, so map each point to a region with a point-in-polygon lookup and sum the scores per region.
- **Small fine-tuned classifiers** (CLIP linear probe or a small ViT) for narrow visual tells that are hard to describe in words: bollard type, licence plate style, road-line pattern. Train them on crops labelled with the country/region.
- All Layer-1 outputs use the same `SpecialistReport` schema, so the aggregator treats every source alike. "Nothing visible" is an empty `clues` list; scores over regions go in `region_scores`.

### 3. Check the clues with real geodata (`tools.py`), exposed to the aggregator as Claude tools
- `geocode(name, country)` uses **Nominatim** to find coordinates for place or street names.
- `overpass_query(ql)` uses the **OSM Overpass API** for things like "road D-123 within département 29" or "a village named X near a road named Y".
- `region_bbox(region)` returns the bounding box of a region for filtering.

These clues are usually hard evidence: a confirmed road number plus a place name often pins the location to within about 1 km.

### 4. Aggregator / judge agent with `claude-opus-5-5` and an agentic tool loop
- Gets the specialist JSON outputs **and the raw views** (to avoid losing information in the bottleneck), then combines them, settles conflicts (strong text clues outweigh vegetation guesses), and calls the geodata tools to check hypotheses.
- Works down a hierarchy: country, then region/province/département, then candidate towns or road segments.
- Output: a `Result` with 3–10 ranked `Candidate`s.

### 4b. PLONK as the coordinate engine, steered by our reasoning (`plonk_engine.py`)
**PLONK** (Dufour et al., CVPR 2025; code under MIT licence; `pip install diff-plonk`; checkpoint `nicolas-dufour/PLONK_OSV_5M`, trained on 5M street-view images) runs locally and costs nothing per call. It replaces Picarta: Picarta's API is for Enterprise accounts only, and its free web tier allows 1 search. Use a GPU if one is available. Load the model **once per process**. Only `compute_likelihood` accepts a precomputed `emb=`, so compute each view's embedding once and reuse it for candidate and grid scoring (points 3 and 4). Sampling, `compute_likelihood_grid` and `compute_localizability` take the image and compute the embedding again internally. `compute_likelihood_grid` covers the whole globe, so build regional grids yourself and pass them to `compute_likelihood`.

**Licence note:** the `PLONK_OSV_5M` checkpoint uses StreetCLIP (`geolocal/StreetCLIP`, CC-BY-NC-4.0) as its image embedder. That is fine for this non-commercial challenge, but not for commercial reuse.

**What PLONK can and cannot take** (checked in `plonk/pipe.py`):
- It **cannot** take text, a country/region filter or a radius. Nothing equivalent to Picarta's `CONTEXT`, `COUNTRY_CODE`, `ADMIN1` or `RADIUS` exists.
- What it does have:
  - `pipeline(image, batch_size=N, cfg=…)` with **one** image draws N sample locations: the source repeats the image embedding N times. With several images in one call, `batch_size` must equal the number of images and you get one sample each, so **call it once per view**. `cfg` is a guidance scale: higher values give sharper, more confident samples.
  - `compute_likelihood(emb=…, coordinates=[(lat, lon), …])` returns the **exact log-likelihood of any point we choose**.
  - `compute_localizability(image)` measures how locatable the image is at all.
- That makes PLONK a probability map we can **query**. It can't take our clues as input, but it can score any place the other agents suggest, which steers it more than Picarta's filters did.

**How the other agents help PLONK:**
1. **Layer 1, an image-only vote.** Draw about 1,000 samples per view (`pipeline(view, batch_size=1000)`, one call per view) for the 2–3 most informative views. Drop samples outside PT/ES/FR and map each remaining one to its region by point-in-polygon lookup. The share of samples per region becomes `region_scores` in a `SpecialistReport` (`specialist: "plonk"`). Also put `compute_localizability`, averaged over the views, in the report's `localizability` field.
2. **Combine with the clues** (the replacement for `ADMIN1`). The aggregator settles on its own region probabilities from the clues. The final region probability is computed as `p(region) ∝ p_plonk(region)^α · p_reasoning(region)`, where α is tuned on the eval set; this is a weighted product of the two, not a hard filter. A hard region hint from the challenge sets p = 0 outside that region.
3. **Score the agents' candidate places** (the replacement for `CONTEXT`). For every place the aggregator puts forward, compute its PLONK log-likelihood, averaged over the views. Those places are: geocoded towns, points every 1–2 km along a road confirmed by Overpass, and centroids of nearby villages. Rank the candidates by `log p_plonk + log p_reasoning`. This is where a clue like "road N-634" plus "Galician text" turns into a pin: PLONK picks which stretch of the road looks most like the image.
4. **Fill gaps inside the chosen region** (the replacement for `RADIUS`). If no candidate place came from the clues, compute the likelihood over a grid of points about 5 km apart inside the top region (or within 25 km of a partial clue). Use the highest-scoring point.

**Which coordinates win** (the first available source wins):
1. A *verified* clue: a geocoded place name, or a road confirmed by Overpass. If there are several candidate points, PLONK's likelihood picks among them. **A verified clue also dominates the region answer:** the aggregator sets `region_probs` so that the clue's region is the top one. This keeps the pin consistent with the `candidates[0].region == argmax(region_probs)` invariant. If two verified clues point to different regions, the result is not treated as verified: neither overrides, both go to the normal probability combination, and `low_confidence` is set.
2. The best PLONK-scored candidate or grid point inside the top region.
3. A Nominatim geocode of the town the aggregator picked.
4. The centre of the region.

**Other outputs:**
- Set `Result.low_confidence = true` in either case:
  - PLONK's top country and the reasoning's top country disagree.
  - Localizability is very low, meaning the image barely says where it is; this tells the hint advisor something.
- The Candidate `evidence` must say where the coordinates came from (`"source: verified_clue" | "source: plonk" | "source: geocoded_town" | "source: region_centroid"`), so the reasoning that is displayed never contradicts the pin.
- **Cost:** free. The likelihood calls solve an ODE, so they are slower than sampling: cap each round at about 2,000 points and time it in the cost/latency table. Cache embeddings and samples per image so reruns with a hint are cheap.

### 5. Hint advisor (`hint_advisor.py`, a pure function over `Result.region_probs`)
- **Default is "submit, no hint".** Fewer hints means a higher score, and the right *region* counts as success.
- **One rule:** let `p1`, `p2` be the two highest values in `region_probs`. Return `take_hint` if `p1 - p2 < τ` **or** `low_confidence` is true; otherwise return `submit`. Start with τ = 0.1 and tune it on the eval set.
- When it returns `take_hint`, `suggested_hint` names the cheapest hint type that separates the top two regions: a country hint if they are in different countries, otherwise a region hint (for example, "region hint: splits ES-GA vs ES-AS"). It's only advice.
- It always reports the remaining uncertainty (`p1`, `p1 - p2`).
- If you paste a hint in later, the run continues: hints are added as hard constraints and the aggregation steps run again (specialists are not re-run).

### 6. CLI (`run.py`)
```
python run.py pano.jpg [--hint "region: Andalucía"] [--out result.json]
```
Prints a markdown table of ranked candidates with Google Maps links, plus the hint advice. The CLI turns hint names into ISO codes with `regions.normalise()` ("Andalucía" / "Andalusia" → `ES-AN`) and rejects anything that isn't on the allowlist. A Streamlit UI (`app.py`) is a **stretch goal**, built only if time remains.

## Team split (3 people, working in parallel)
**Day 1, together:** freeze the contracts in `schemas.py`: **`SpecialistReport`** (A → B), **`Result`** (B → C), `Hint`, and the **region allowlist** in `regions.py`. Commit 2–3 hand-written mock files of each so nobody has to wait on anyone else.

| Person | Owns | Starts against |
|---|---|---|
| **A: Perception (Layer 1)** | `preprocess.py`, specialist agents, prompts | real images; outputs `SpecialistReport` |
| **B: Reasoning (Layer 2)** | `regions.py` (allowlist + `normalise()`), `tools.py` (Nominatim/Overpass), `aggregator.py` (including the single-Opus baseline), `hint_advisor.py` | mock `SpecialistReport` |
| **C: Eval + engine + interface** | **from Day 1:** collecting and labelling the eval set, `eval.py`, and Day-0 gate (b); then `plonk_engine.py` (self-contained: views in, region shares, likelihood scores and localizability out); then `run.py`; stretch goals: `app.py`, `models/` | real labelled images + mock `Result`; B calls `plonk_engine` through a stub until the real one lands |
| **Shared (all three)** | `knowledge/*.md`: each person writes one country file, with sources, and a different person reviews it. `dev/tests/`: each owner writes the tests for their own modules | — |

They integrate on a shared branch once A's real outputs replace the mocks. C's eval score then decides what each person improves next.

## Shared data formats (`schemas.py`, Pydantic)
```python
class Clue(BaseModel):
    category: Literal["language","text","road_number","sign","bollard","plate",
                      "road_marking","vegetation","terrain","architecture","sun","other"]
    observation: str            # what was seen: "white bollard with red reflector"
    raw_text: str | None        # exact text read, if any: "N-632", "Rua da Igreja"
    view_id: str                # which crop it came from: "yaw135_tile2"
    implies: list[str]          # places it points to: ["FR"], ["ES-GA","ES-AS"]
    excludes: list[str] = []    # places it rules out
    confidence: float           # 0–1: how sure the reading is AND how strong the tell is

class SpecialistReport(BaseModel):   # Layer 1 -> Layer 2
    specialist: str             # "text", "road", "environment", "built", "sun", "geoclip"
    image_id: str
    clues: list[Clue]           # empty list = nothing useful visible
    region_scores: dict[str, float] = {}   # optional prior, e.g. from PLONK or GeoCLIP
    localizability: float | None = None    # PLONK only: how locatable the image is; feeds Result.low_confidence

class Hint(BaseModel):          # pasted in by the user
    type: Literal["country","region","city","text","other"]
    value: str                  # always an ISO code after CLI normalisation: "ES", "ES-AN"; free text only for text/other

class Candidate(BaseModel):     # Layer 2 output
    rank: int
    lat: float; lon: float
    radius_km: float            # how precise the guess is
    name: str                   # "Near Ribadeo, Lugo"
    region: str                 # ISO 3166-2: "ES-GA"
    probability: float          # all candidates sum to <= 1
    evidence: list[str]         # short reasons, referencing clues
    verified_by: list[str] = [] # e.g. "overpass: N-634 passes within 2 km"

class Result(BaseModel):        # what the UI / CLI / eval consumes
    image_id: str
    candidates: list[Candidate]
    region_probs: dict[str, float]  # allowlist code -> probability, sums to <= 1; THE authoritative region answer (eval + hint advisor)
    low_confidence: bool = False    # e.g. PLONK and reasoning disagree on country, or PLONK localizability is very low
    hint_advice: Literal["submit","take_hint"]
    suggested_hint: str | None  # "region: splits Galicia vs Asturias"
    hints_used: list[Hint] = []
```
**Rules everyone sticks to:**
- **Region codes come from one allowlist in `regions.py`** and are validated wherever they appear (`Clue.implies`/`excludes`, `Candidate.region`, `region_probs`, `Hint.value`, `dev/eval/labels.csv`):
  - **PT:** the 18 districts `PT-01`…`PT-18`, plus `PT-20` (Azores) and `PT-30` (Madeira).
  - **ES:** the 17 autonomous communities (`ES-AN`, `ES-GA`, …) plus `ES-CE` and `ES-ML`. **No province codes:** normalise `ES-LU` → `ES-GA`.
  - **FR:** the 13 metropolitan régions (`FR-BRE`, `FR-GES`, `FR-20R`, …). Map `FR-6AE` → `FR-GES`.
  - **Countries:** `PT` / `ES` / `FR`, for country-level clues only.
  - Never free-text names like "Galicia" or "Galiza".
- **`confidence` runs from 0 to 1** and means "how much this should move the guess". A clearly read "N-634" is about 0.9; a blurry tree is about 0.3.
- **Candidate `probability` values add up to at most 1.** Whatever is left over means "somewhere else".
- **An empty `clues` list is valid.** Specialists must not invent clues.
- **Country, region and city hints are hard filters.** Candidates outside them are dropped. The CLI/UI turns names into ISO codes ("Andalucía" → `ES-AN`).
- **`text` and `other` hints are not filters.** They become extra clues with high confidence.

**Example `SpecialistReport`:**
```json
{
  "specialist": "road",
  "image_id": "round_07",
  "clues": [{
    "category": "road_number",
    "observation": "white-on-red road sign",
    "raw_text": "N-634",
    "view_id": "yaw135_tile2",
    "implies": ["ES-GA", "ES-AS", "ES-CB", "ES-PV"],
    "excludes": ["PT", "FR"],
    "confidence": 0.9
  }]
}
```

**Example `Hint`:** `{"type": "region", "value": "ES-AS"}`

**Example `Candidate` (inside a `Result`):**
```json
{"rank": 1, "lat": 43.53, "lon": -7.04, "radius_km": 5,
 "name": "Near Ribadeo, Lugo", "region": "ES-GA", "probability": 0.55,
 "evidence": ["N-634 sign", "Galician text 'Concello'", "eucalyptus"],
 "verified_by": ["overpass: N-634 passes within 2 km"]}
```

**Mock files (written on day 1, in `dev/mocks/`):** 2–3 `SpecialistReport` files per specialist and 2–3 `Result` files, so person B can build against fake Layer-1 output and person C against fake Layer-2 output. Every mock must pass schema validation (a test checks this).

## Files
- `schemas.py`: shared data formats (written first), plus `dev/mocks/*.json`
- `regions.py`: region allowlist, name → code `normalise()`, region centroids, and polygons for point-in-polygon lookup (e.g. from Natural Earth admin-1 or GADM)
- `preprocess.py`, `agents.py`, `tools.py`, `aggregator.py`, `hint_advisor.py`, `plonk_engine.py`, `run.py`
- `eval.py` (in the repo root); eval images and `labels.csv` live in `dev/eval/`
- `knowledge/{portugal,spain,france,shared}.md`: knowledge bases for the clues, with sources
- `prompts/`: system prompts for each agent
- `dev/`: everything that isn't the live pipeline, so the repo root stays readable: `dev/tests/` (unit tests, see Verification), `dev/mocks/`, `dev/eval/` (images, `labels.csv`, README), `dev/scripts/` (`build_regions_geojson.py`, `fetch_wikimedia.py`), `dev/day0_plonk.py`
- `data/regions.geojson`: region polygons read by `regions.region_of()` at run time; the one non-code file the live pipeline needs
- Stretch goals: `app.py`, `models/`
- `requirements.txt`: `anthropic`, `pydantic`, `py360convert`, `pillow`, `requests`, `diff-plonk` (brings in `torch`), `shapely`, `pytest`. Stretch goals add `streamlit`, `transformers` and `geoclip`.

## Implementation notes
- Load the `claude-api` skill before writing the SDK code (vision input, parallel calls, tool runner, prompt caching for the large knowledge-base prompts).
- **Nominatim:** at most 1 request/s, an identifying User-Agent, and **cache results on disk** (its usage policy requires this).
- **Overpass:** slot-based limits (HTTP 429 when no slot is free), about 10k requests/day. Set `[timeout:25]` on every query, back off on 429, cache responses, and give the aggregator 2–3 tested query templates rather than letting it write free-form QL.
- Cache the specialist outputs for each image, so that rerunning with a hint is cheap.
- Read the Claude key from the `ANTHROPIC_API_KEY` env var. Never commit it.
- **Cost and latency budget:** before the eval runs, measure the tokens and seconds for one round of each ablation arm and write them in a table here. Then decide how many arms × images you can afford, and cap image count / tile resolution if needed.

**Day-0 gate (b), PLONK on C's laptop (CPU only, no CUDA; torch 2.14 CPU, Python 3.13; measured 2026-10-10 with `dev/day0_plonk.py`):**

| step | library defaults | CPU defaults now in `PlonkBackend` |
|---|---|---|
| load model (once per process) | 24 s | 24 s |
| embed 1 view | 2.8 s | 2.8 s |
| sample 200 points, 1 view | 30 s | 6 s (`num_steps=32`, same sample quality) |
| exact likelihood, per point | ~10 s | ~1.9 s (`atol=rtol=1e-3`, same ranking) |
| localizability (16 MC samples) | 137 s | replaced by the sample-concentration proxy |
| **`run.py --arm plonk`, one panorama, 8 views** | — | **~90 s** |

Consequences: on CPU the 2,000-point likelihood rounds in §4b are not feasible (about an hour each). `PlonkEngine(scorer="auto")` therefore uses a **KDE over PLONK's own samples** for candidate and grid scoring when there's no GPU, and exact likelihood on GPU. Sanity check on a Santiago de Compostela 360° panorama: 58% of samples in ES-GA (correct), pin 25 km from the truth, advice "submit". To use exact scoring, a GPU machine (or a Colab T4) is needed. Install note: `diff-plonk` pins `scipy==1.13.1`, which has no wheel for Python 3.13, so install it with `--no-deps` (see `requirements.txt`).

## Verification
1. **Eval set (C, from Day 1):** collect **60 or more** panoramas with known locations across PT/ES/FR. Weight them toward images that look like the challenge's: your own past challenge rounds first, then Mapillary/Wikimedia 360° images with coordinates. Spread them across regions. Store them as `dev/eval/*.jpg` plus `dev/eval/labels.csv` (with an allowlist region code). With 20–30 images, region accuracy is only known to within about ±18 points, which is too wide to compare setups.
2. `python eval.py` runs the pipeline with no hints.
   - **Main metrics (both reported, with 95% confidence intervals), until the Day-0 gate settles which one the challenge uses:**
     - **region accuracy**: does `argmax(region_probs)` match the true region?
     - **median distance error** of `candidates[0]`.
   - **Invariant:** the aggregator orders candidates so that `candidates[0].region == argmax(region_probs)`. A unit test checks this.
   - Also reported: country accuracy, whether the true region is in the top 3 of `region_probs`, and how often the hint advisor says `take_hint`.
3. **Ablation:** compare (a) one Opus call with no specialists (**the baseline, built first**), (b) the 2-layer pipeline, (c) the 2-layer pipeline plus trained models (stretch goal), (d) PLONK alone (top region by sample share), (e) the hybrid (reasoning and PLONK combined as in §4b, verified clues override). Keep a layer only if it beats the best earlier arm by more than the noise; when the intervals overlap, compare paired results on the same images.
4. Tune the knowledge bases and the hint-advisor threshold τ based on which clues fail.
5. Test it by hand on a live challenge panorama.
6. **Unit tests (`pytest`, deterministic, no live API calls):**
   - every `dev/mocks/*.json` file validates against `schemas.py`
   - the region validator rejects province codes and free-text names; `normalise()` maps "Andalucía" → `ES-AN` and `ES-LU` → `ES-GA`
   - `preprocess` cuts an equirectangular image into the expected number of views at the right yaw/pitch, and folder input passes through unchanged
   - `tools.py` runs against recorded Nominatim/Overpass responses
   - aggregator (with a stubbed LLM): a region hint drops candidates outside that region; a verified clue's coordinates override PLONK's; the coordinate fallback chain works when PLONK is unavailable; probabilities add up to at most 1; `candidates[0].region` equals `argmax(region_probs)`, including when a verified clue lands outside PLONK's favourite region; two conflicting verified clues set `low_confidence`; a low `localizability` sets `low_confidence`
   - hint advisor: margin just above and just below τ, `low_confidence` gives `take_hint`, and the suggested hint is a country hint across countries and a region hint within one
   - `plonk_engine` (with a stubbed pipeline returning fixed samples and likelihoods): samples outside PT/ES/FR are dropped; per-region shares are correct; combining with reasoning probabilities follows the formula; the best-scored candidate wins
   - `eval.py`: the metric maths is correct on a toy `labels.csv`

> **Plan Review:** PROCEED WITH CHANGES — 2026-10-07
