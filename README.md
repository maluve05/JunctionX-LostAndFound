# Lost & Found — Autonomous Panorama Geolocation System
### JunctionX Lisbon 2026 — Albatroz Challenge 04

An autonomous 360° equirectangular panorama geolocation engine solving the Albatroz challenge (*"Am I at a unique place? Where in the world could here be?"*).

Given a dated equirectangular JPG panorama from Portugal, Spain, or France, Lost & Found autonomously identifies, explains, and ranks the **Top 10 Plausible Candidate Locations** according to official Challenge 4 scoring rules.

---

## Architecture

- **Frontend (`Website/`)**:
  - React 19 + TypeScript + Vite + Tailwind CSS v4 + Framer Motion.
  - Features high-end aperture shutter transitions, scanning HUD, clue inspection carousel with zoom panes, Leaflet dark canvas map, and 1-click competition coordinate export.
  - Hosted directly on **Cloudflare Workers with Static Assets** (`wrangler.jsonc` + TypeScript Worker).
- **Backend API (`Research And Implementation/api.py`)**:
  - FastAPI server with asynchronous job queueing, real-time stage progress updates from `SessionLog`, and dynamic competition JSON generation.
  - Hybrid AI pipeline combining:
    - **Sonnet Specialists** (Text, Road infrastructure, Signage).
    - **RapidOCR** (Local Latin text extraction).
    - **Opus Judge** with Overpass OpenStreetMap and Nominatim geodata tools.
    - **PLONK** deep neural prior.
    - **Mapillary Street Checker** (DINOv2 embedding match).
- **Automation (`n8n/`)**:
  - `panorama_geolocation_workflow.json`: Ready-to-import n8n workflow for headless webhook triggering and batch processing.

---

## Quickstart

### 1. Start the Backend API

```bash
cd "Research And Implementation"
uvicorn api:app --host 127.0.0.1 --port 8000 --reload
```

The API will be available at `http://127.0.0.1:8000`:
- Swagger docs: `http://127.0.0.1:8000/docs`
- Health check: `http://127.0.0.1:8000/api/health`

### 2. Start the Frontend (Local Development)

```bash
cd Website
npm install
npm run dev
```

Open `http://localhost:5173` in your browser. The Vite dev server proxies `/api` calls directly to `http://127.0.0.1:8000`.

### 3. Deploy to Cloudflare Workers

Build the production assets and deploy to Cloudflare:

```bash
cd Website
npm run deploy
```

Or preview the worker locally with static assets:

```bash
npm run preview:worker
```

*Note: In `wrangler.jsonc`, set `BACKEND_URL` to your live tunnel or backend endpoint (e.g. via Cloudflare Tunnel `cloudflared` or public IP).*

### 4. Headless Ingestion via n8n

1. Import `n8n/panorama_geolocation_workflow.json` into your n8n instance.
2. Activate the workflow.
3. Send POST requests with image binary data to your n8n webhook URL (`/webhook/geolocate-panorama`) to automatically receive the top 10 ranked coordinates.
