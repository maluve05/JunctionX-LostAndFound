# Connecting the website to the geolocation backend

The website (this folder, Vite + React on `127.0.0.1:5173`) currently shows fake data. The backend
(`../Research And Implementation/`) works and is tested, but it only has a command line (`run.py`). This file is the
plan for joining them: a small HTTP API around the backend, then the website calling it.

Demo arm: **`hybrid`** (text and road specialists, the Opus judge, PLONK's prior, OpenStreetMap feature snapping,
the Mapillary street check). It takes **about 2 minutes per panorama** (measured: 113-130 s on 3 warm-up images), so
the website must start a job and poll it. A single request waiting 2 minutes would time out.

---

## 1. The backend API (new file `Research And Implementation/api.py`)

Install once: `pip install fastapi uvicorn python-multipart` (none of them is installed yet).
Run: `cd "Research And Implementation"` then `uvicorn api:app --host 127.0.0.1 --port 8000`.

The machine running it needs:
- Claude Code signed in (every model call is a `claude -p` process on the subscription);
- `MAPILLARY_TOKEN` set (optional: without it the street check is skipped).

### Endpoints

| Method | Path | Body | Returns |
|---|---|---|---|
| `POST` | `/analyze` | multipart: `file` (the panorama), `urban` (`"true"` / `"false"`), optional `cue` (text, ≤1000 chars) | `{"job_id": "…"}` |
| `GET` | `/jobs/{job_id}` | | the job (below) |
| `GET` | `/jobs/{job_id}/log` | | the session log JSON (the challenge requires every interaction logged as JSON) |
| `POST` | `/jobs/{job_id}/answer` | `{"option": 0-3}` or `{"option": null}` | phase 2, see §4 |

### How `api.py` works

1. **Save the upload with its original filename** into a temp folder. The capture time is parsed from the filename
   (`IMG_20260813_115036_00_695.jpg` → 2026-08-13 11:50:36), so do not rename it.
2. **Run the job in a background thread:**
   ```python
   from run import run_session
   result = run_session(path, arm="hybrid", urban=urban, hints=hints, log=job_log)
   ```
   `hints` is `[]`, or `[run.parse_cue(cue)]` when a cue was given (a cue costs ×0.8 on the score).
3. **Run one job at a time.** Each job runs several Claude calls on the subscription, so queue the others.
4. **Get progress for free from the session log.** Subclass `session_log.SessionLog` and override `event()` so that
   every event also updates the job's `stage`:

   | event `kind` | stage shown |
   |---|---|
   | `input` | `Reading the panorama` |
   | `ocr` | `Looking for text, signs and plates` |
   | `specialist` (two of them) | `Checking road markings and vegetation` |
   | `aggregator` | `Weighing the evidence` |
   | `feature_snap`, `street_check`, `plonk` | `Pinpointing the spot` |
   | `result` | done |

   These match `STAGES` in `src/components/AnalyzingView.tsx`, with one stage added.
5. **Allow the website's origin:** add FastAPI's `CORSMiddleware` with `http://127.0.0.1:5173` and
   `http://localhost:5173`. Alternatively, add a proxy for `/api` in `vite.config.ts`.

### The job JSON (`GET /jobs/{id}`)

```jsonc
{
  "job_id": "…",
  "status": "queued" | "running" | "done" | "error",
  "stage": "Weighing the evidence",          // last stage reached
  "stages_done": ["Reading the panorama", "…"],
  "elapsed_s": 74.2,
  "error": null,                             // a message when status == "error"
  "result": null                             // the object below when status == "done"
}
```

### The result JSON (built in `api.py` from `run.Result` + the session log)

```jsonc
{
  "image_id": "IMG_20260813_115036_00_695",
  "urban": true,
  "seconds": 127.0,
  "summary": "The views are taken from the walls of a hilltop castle …",  // the judge's summary (log event "aggregator")
  "answer": [ {"rank": 1, "lat": 39.74718, "lon": -8.80957}, … ],          // THE submission: 10 entries, may repeat
  "top": {"name": "Castelo de Leiria, Leiria", "region": "PT-10", "region_name": "Leiria",
          "probability": 0.85, "lat": 39.74715, "lon": -8.80933, "radius_km": 0.15},
  "countries": {"PT": 0.93, "ES": 0.05, "FR": 0.02},   // region_probs summed per country (regions.country_of)
  "regions": [ {"code": "PT-10", "name": "Leiria", "probability": 0.85}, … ],   // sorted, top 5 is enough
  "candidates": [ {"rank": 1, "name": "…", "lat": …, "lon": …, "radius_km": …, "region": "PT-10",
                   "region_name": "Leiria", "probability": 0.85, "anchor": "castle",
                   "evidence": ["…"], "verified_by": ["find_feature castle: Castelo de Leiria …"]} ],
  "clues": [ {"source": "road", "category": "architecture",
              "observation": "Medieval hilltop castle battlements and keep …", "raw_text": null,
              "view_id": "yaw180", "implies": ["PT-10", "PT"], "confidence": 0.3} ],
  "expected_score": 8794,
  "low_confidence": false,
  "question": null      // or {"text": "In which of these zones …?", "options": ["Leiria", "Santarém", …]}
}
```

Where each field comes from:
- `answer`, `candidates`, `region_probs`, `expected_score`, `low_confidence` and `next_question` are on the `Result`.
- Region names: `regions.REGIONS[code][0]`.
- `clues` come from the session log: events with `kind == "specialist"` carry `name` (the source) and `clues`
  (a list, possibly empty or `None`).
- `summary` comes from the event with `kind == "aggregator"`.

Text is UTF-8 everywhere (accents such as "Praça do Comércio"); keep `ensure_ascii=False` or FastAPI's default.

---

## 2. The website changes

### a. Upload screen (`UploadZone.tsx`)
- **Add an Urban / non-Urban toggle.** The organisers give this label with every panorama, and it changes the
  answer: it picks the 100 m or the 10 km scoring scale.
- **Add an optional cue field** (free text, ≤1000 characters, no place names; it costs ×0.8).
- **"Analyze" sends `POST /analyze`** with the file, `urban` and `cue`.

### b. Analysing screen (`AnalyzingView.tsx`, which exists but nothing navigates to it yet)
- **Show it between upload and inspection** (`App.tsx`: add a `"analyzing"` screen).
- **Poll `GET /jobs/{id}` every 2 s.** Drive the stage list from `stages_done` / `stage` instead of the fixed
  1.5 s timer, and show the elapsed time (a run takes about 2 minutes).
- **On `done`, go to the inspection screen** with the result. On `error`, show the message and a "try again" button.

### c. Inspection screen (`InspectionView.tsx`): replace the fake `CLUE_SLIDES`
Build the slides from `result.clues`, or, when there are none (common: many panoramas have no text or road signs),
from the top candidates' `evidence`.

| slide field | from |
|---|---|
| `category` | `` `${clue.source} · ${clue.category}` ``. Drop the "Google Lens" label: we do not use Google Lens |
| `title` | `clue.raw_text` if any, else the first few words of `clue.observation` |
| `characteristic` | `clue.observation` |
| `explanation` | `"Points to " + implies.map(region name).join(", ")` |
| `probabilities` | `result.countries` as percentages, the same on every slide (the real overall estimate) |
| `box` | from `clue.view_id` (below) |

**Box from `view_id`.** A `view_id` is `yaw{deg}` (a 90° view centred `deg` degrees right of the image's centre
column), `yaw{deg}_tile{0-3}` (a quarter of that view: 0 top-left, 1 top-right, 2 bottom-left, 3 bottom-right),
`down` or `up`. In fractions of the panorama image:
- horizon view: `x = ((0.5 + deg / 360 - 0.125) mod 1)`, `w = 0.25`, `y = 0.25`, `h = 0.5`;
- a tile halves that: `w = 0.125`, `h = 0.25`, plus `0.125` on x for tiles 1 and 3 and `0.25` on y for tiles 2 and 3;
- `down`: `x = 0.375, w = 0.25, y = 0.75, h = 0.25`; `up`: the same with `y = 0`.

Two corrections:
- **Wrap-around.** A box at `yaw180` straddles the image's left and right edges. Clamp it to one side, or draw two
  boxes.
- **The pane's crop.** The pane is 21:9 and the image is 2:1 with `object-cover`, so about 7% of the image height is
  cut off at the top and the bottom. Convert with `paneY = (y - 0.0714) / 0.857` and `paneH = h / 0.857`; x is
  unchanged.

### d. The answer, which nothing on the site shows yet (it is what gets scored)
Add a results panel to the inspection screen:
- **The answer list:** the 10 ranked coordinates with a copy button, and one button that copies all 10 as
  `lat, lng` lines. Entries often repeat: that is intended, since repeating the best point maximises the expected
  score.
- **A map:** the simplest option is an `<iframe>` of `https://www.openstreetmap.org/export/embed.html?bbox=…&marker=lat,lon`,
  or Leaflet with OSM tiles if there is time. Draw `top` and the other candidates as circles of `radius_km`.
- **The top hypothesis:** name, probability, `evidence` and `verified_by` (the facts confirmed by tools).
- **The judge's `summary`** as a short paragraph.
- **The expected score** (the maximum is about 16 050: all 10 entries exact, no hints), and a warning badge when `low_confidence`.

---

## 3. Testing it

Use the warm-up panoramas in `../Research And Implementation/challenges/Data/Panorama Warm-Up/` (the backend's
results from the last check are in `../Research And Implementation/logs/final_*.json`):

| image | label | expected result |
|---|---|---|
| `IMG_20260813_115036_00_695.jpg` | Urban | Leiria castle, about 46 m from the truth |
| `IMG_20250125_144630_00_319.jpg` | Urban | Praça do Comércio, Lisbon |
| `IMG_20241213_120841_00_059.jpg` | non-Urban | spread over the Beira interior granite villages (no exact answer) |

To build the frontend before the API exists, serve one of those `logs/final_*.json` files as a fake result. That is
the `Result` shape, so map it with the same function the API will use.

---

## 4. Phase 2, only if time is left: the quiz

When `result.question` is set, the agent wants to ask a multiple-choice question, which costs ×0.95 on every entry.
Show the options. `POST /jobs/{id}/answer` with the chosen index re-runs the prediction with that answer as a hint:
in `api.py`, use `run_session`'s `ask` callback, which returns the chosen index or `None`, and wait on the HTTP
answer. `{"option": null}` means "submit without asking".
