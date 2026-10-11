# Lost & Found — Analyzing Screen Fixes — MASTER PROMPT

> **How to use this file.** The analyzing screen (`src/components/AnalyzingView.tsx`) already exists and is
> wired into `src/App.tsx` as the `"analyzing"` screen: it uploads the panorama to `/api/analyze`, polls the
> job while the staged pipeline animates, and hands the result to the inspection screen. This is a
> **surgical fix pass**, not a rebuild. Paste **everything below the horizontal rule** into Freebuff with
> this repository open. Everything you need is in this document and on disk — do not re-derive the design
> language, do not redesign anything.
>
> **Two fixes, nothing else:** (1) the screen's top bar drops the uploaded file name; (2) the failure card
> keeps a single red action — the outline `Retry` button — and that action routes `onBack` (back to the
> landing screen) instead of reloading the document.

---

## ROLE

You are a senior frontend engineer on **Lost & Found** by *The Winning Team* (Junction 2026). The analyzing
screen is **already built and working**. Your job in this task is **exactly the two fixes in §2 and §3** to
[`src/components/AnalyzingView.tsx`](src/components/AnalyzingView.tsx) — and nothing else.

**The whole change is surgical: `src/components/AnalyzingView.tsx` only.** [`src/App.tsx`](src/App.tsx)
already passes the correct callbacks and must not be touched.

A few minutes of restraint beats a tidy-up: apply the two hunks byte-for-byte as written, and if a decision
is ambiguous, choose the smaller diff.

---

## 0. GUARDRAILS THAT STILL BIND

> **⛔ CHALLENGE 4 IS THE ONLY CHALLENGE.** Ignore Challenges 1, 2, and 3 completely. Do not read them, do
> not mention them, do not support them. Our only task is Challenge 4 (estimating Portugal, France, or Spain
> from a 360° panorama).

- **Frontend only.** No new dependencies, no new state, no new request, no storage, no router, no URL
  changes. Two deletions and one `onClick` swap — that is the entire pass.
- **Read before you write.** [`src/components/AnalyzingView.tsx`](src/components/AnalyzingView.tsx) is the
  code on disk and the ground truth. The line numbers in this document are as of this writing; if they
  drift, locate the snippets by their text, never by guessing.
- **`onBack` is the correct exit.** In `App.tsx`, `AnalyzingView` is rendered as
  `<AnalyzingView panorama={panorama} onBack={handleBackToLanding} onDone={handleAnalysisDone} />` —
  `handleBackToLanding` plays the existing aperture shutter back to Screen 1, clears the panorama and result,
  and revokes the panorama's object URL through App's existing effect. It is the same callback the Esc key
  and the footer's `Return to upload` button already call. Use it; do not write a new handler.
- **TypeScript gates:** `npm run typecheck` must exit 0 with **no output**. `noUnusedLocals` is on — but note
  that **no import becomes unused in this pass**: `RefreshCw` stays on the red `Retry` button, and
  `ArrowLeft` stays on the footer button. Do not remove either one.

---

## 1. WHAT CHANGES — SUMMARY

| # | Fix | File | What happens |
|---|---|---|---|
| 1 | **Drop the uploaded file name** | `AnalyzingView.tsx` | Delete the `<p>{panorama.name}</p>` at the right end of the top bar. The "Analyzing" label and the URBAN/RURAL badge on the left stay exactly as they are. |
| 2 | **One red action, routed `onBack`** | `AnalyzingView.tsx` | Delete the ghost `Return to upload` button from the error card; change the red outline `Retry` button's `onClick` from `() => window.location.reload()` to `onBack`. Label, icon and classes stay. |

**No other file changes. No new files. No import changes.**

---

## 2. FIX 1 — REMOVE THE UPLOADED FILE NAME

**Where:** the top bar of the screen, inside
`<motion.div variants={fadeUp} className="flex items-baseline justify-between gap-6">` (line ~140). Today it
renders the left badges group and, at the right end, the uploaded file's name (line ~147).

**Before:**

```tsx
        <motion.div variants={fadeUp} className="flex items-baseline justify-between gap-6">
          <div className="flex items-center gap-3">
            <p className="text-[11px] font-medium tracking-[0.32em] text-white/40 uppercase">Analyzing</p>
            <span className="rounded bg-lime/10 px-2 py-0.5 font-mono text-[10px] text-lime">
              {panorama.urban ? "URBAN 100M" : "RURAL 10KM"}
            </span>
          </div>
          <p className="truncate text-[13px] text-white/50">{panorama.name}</p>
        </motion.div>
```

**After** — the `<p>{panorama.name}</p>` line is deleted:

```tsx
        <motion.div variants={fadeUp} className="flex items-baseline justify-between gap-6">
          <div className="flex items-center gap-3">
            <p className="text-[11px] font-medium tracking-[0.32em] text-white/40 uppercase">Analyzing</p>
            <span className="rounded bg-lime/10 px-2 py-0.5 font-mono text-[10px] text-lime">
              {panorama.urban ? "URBAN 100M" : "RURAL 10KM"}
            </span>
          </div>
        </motion.div>
```

**Rules:**

- Delete **exactly that one `<p>` element**. The wrapper's `justify-between gap-6` classes **stay** — the
  left badges group simply owns the row now. Do not re-centre it, re-space it, or touch the "Analyzing"
  label or the urban/rural badge.
- **The file name is still sent to the backend.** It is used by
  `formData.append("file", panorama.file, panorama.name)` in the upload effect (line ~46), and the backend
  parses the capture time from the original filename — so **do not** remove that usage, the `name` field, or
  the `PanoramaInput` type.
- Do **not** replace the name with anything else: no placeholder, no upload status, no hint text, no
  `title`/`aria-label` re-showing it. It is removed from this screen, period.

---

## 3. FIX 2 — ONE RED ACTION IN THE FAILURE CARD, ROUTED `onBack`

**Where:** the error alert card's action row (around lines 193–207). Today it renders **two** buttons: a red
outline `Retry` that reloads the whole document, and a ghost `Return to upload` that calls `onBack`. The
card renders whenever `error` is set — both the upload-failure path and the backend's `status: "error"`
path — so this one card is the only failure UI.

**Before:**

```tsx
            <div className="mt-4 flex gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => window.location.reload()}
                className="gap-2 border-red-500/30 text-red-200 hover:bg-red-500/10"
              >
                <RefreshCw className="size-3.5" />
                Retry
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={onBack}>
                Return to upload
              </Button>
            </div>
```

**After** — the ghost button is deleted, and the red button's `onClick` changes:

```tsx
            <div className="mt-4 flex gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onBack}
                className="gap-2 border-red-500/30 text-red-200 hover:bg-red-500/10"
              >
                <RefreshCw className="size-3.5" />
                Retry
              </Button>
            </div>
```

**Why exactly this shape:**

- `window.location.reload()` is a **full document reload**: it throws away all SPA state, re-downloads the
  bundle, and cannot revoke the panorama's object URL. `onBack` (wired to `handleBackToLanding`) plays the
  existing aperture shutter back to the landing screen, clears `panorama` and `result`, and revokes the
  object URL cleanly — matching the behaviour of the ghost button that is being deleted.
- The red button **keeps its `Retry` label, its `RefreshCw` icon, `variant="outline"`, `size="sm"` and its
  exact `className` string** — only `onClick` changes. Do not rename it, restyle it, change its variant, add
  `disabled`, or split it into two actions. **Do not remove `RefreshCw`** — this button uses it.
- Delete the ghost button and nothing else: keep the wrapper `<div className="mt-4 flex gap-3">` (a
  single-child flex row is fine), the `AlertCircle` icon, the "Analysis Error" title and the message
  paragraph.
- **The footer bar is a different element.** At the bottom of the screen there is still a `Return to upload`
  button next to the "Pipeline stalled" readout (around line 257) which calls `onBack`. That one is
  **untouched** — and `ArrowLeft` must stay imported for it.
- After the change, `window.location.reload()` must appear **nowhere** in the file.

---

## 4. THE COMPLETE HUNK LIST

Only two hunks; nothing else in the file is edited:

1. **Top bar** — delete `<p className="truncate text-[13px] text-white/50">{panorama.name}</p>`.
2. **Error card** — delete the ghost `<Button type="button" variant="ghost" size="sm" onClick={onBack}>Return to upload</Button>` block; change the `Retry` button's `onClick={() => window.location.reload()}` to `onClick={onBack}`.

---

## 5. VERIFICATION

### Automated

1. `npm run typecheck` → exits 0, **no output**.
2. `npm run build` → succeeds.
3. `grep -n "window.location.reload" src/components/AnalyzingView.tsx` → **no matches**.
4. `grep -n "panorama.name" src/components/AnalyzingView.tsx` → exactly **one** match, the
   `formData.append("file", panorama.file, panorama.name)` line — proving the name is still uploaded, just no
   longer displayed.
5. `grep -c "Return to upload" src/components/AnalyzingView.tsx` → **1** (the footer button only).

### Manual — success path

6. `npm run dev`, upload a panorama. On the analyzing screen the top bar shows **only** "Analyzing" and the
   URBAN/RURAL badge — **no file name on the right**. The scanning image, elapsed HUD, stage list and footer
   are unchanged.
7. The footer `Return to upload` and the Esc key still return to the landing screen (untouched).

### Manual — failure path (the point of Fix 2)

8. To force the error card, run `npm run dev` **without the backend** — Vite proxies `/api` to
   `http://127.0.0.1:8000`, so with nothing listening the upload fails and the red card appears. Upload any
   image. (Alternative: let the backend return `status: "error"` for a job — same card.)
9. The card shows **exactly one button**: the red outline `Retry` with the `RefreshCw` icon. There is no
   ghost `Return to upload` beside it.
10. **Prove it is a client-side return, not a reload:** in the console run `window.__spa = true`, then click
    `Retry`. Expected: the aperture shutter plays and Screen 1 (the landing upload) appears with an empty
    upload zone; `window.__spa` is still `true` and the Network tab shows **no new document request**. With
    `window.location.reload()` the marker would be gone and the document would reload.
11. Console free of errors and warnings across both paths.
12. Optional: with `prefers-reduced-motion: reduce` emulated, `Retry` swaps instantly back to Screen 1 (no
    blades) — inherited from `App.tsx`, unchanged by this pass.

---

## 6. DEFINITION OF DONE

1. `npm run typecheck` exits 0 with no output; `npm run build` succeeds; `npm run dev` console is clean.
2. The top bar shows only "Analyzing" + the URBAN/RURAL badge; the file name appears nowhere on the screen,
   while still being sent as the upload's filename.
3. The error card has exactly one action — the red outline `Retry` — and clicking it returns to the landing
   screen through the existing shutter, with SPA state proven intact (`window.__spa` survives; no document
   reload).
4. `window.location.reload()` appears nowhere in `src/components/AnalyzingView.tsx`.
5. No file other than `src/components/AnalyzingView.tsx` changed; no import removed; `App.tsx` untouched.

---

## 7. DO NOT

- Do not rename the `Retry` button, restyle it, change its variant, or move it out of the error card.
- Do not remove `RefreshCw`, `ArrowLeft`, or any other import.
- Do not touch `App.tsx`, the upload/polling effects, the Esc handler, the stage list, the scanning line,
  the elapsed HUD, or the footer bar.
- Do not add a confirmation dialog, toast, new state, retry counter, or dependency.
- Do not change the error copy ("Analysis Error" / the message) or the alert card's styling.
- Do not "rescue" the removed file name anywhere (tooltip, `title`, `aria-label`, a badge) — it is deleted
  from this screen.

---

## 8. DELIVERABLE

Report back with:

1. The file changed and a one-line summary of the two hunks.
2. The exact commands run (`typecheck`, `build`, the three greps) and their results.
3. Confirmation of §5's checks, explicitly including the `window.__spa` marker check and the visual
   confirmation that no file name is shown and only one button sits in the error card.
4. Anything in this spec you could **not** satisfy, and why — never a silent substitution.
