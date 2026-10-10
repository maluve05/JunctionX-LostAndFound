# Lost & Found — Google Lens Inspection Screen Build Prompt

> **Copy & paste this prompt into any AI coding assistant.** It provides complete specifications, component contracts, layout schematics, and design system tokens to build Screen 2 ("The Inspection & Probability View") of the **Lost & Found** web application.

---

## CONTEXT & HARD SCOPE

- **Project**: "Lost & Found" by **"The Winning Team"**.
- **Hackathon Scope**: **Challenge 4 is the ONLY challenge that matters.** Disregard any other challenge references. The task is to analyze panoramic photos to estimate whether the location is in **Portugal**, **France**, or **Spain**.
- **Workspace Context**: The design tokens, components, and layout architecture are derived directly from the `Website/` repository and the `forge2026-main` industrial design library in the same workspace.
- **Frontend Only**: Build **strictly client-side React code**. No backend APIs, no external models, and no database logistics required. All inspection clues and probability data are client-side demo states.

---

## USER SCHEMATIC LAYOUT

The screen appears immediately after the user uploads a panorama and clicks **"Find My Location"**.

```text
┌────────────────────────────────────────┬────────────────────────────────────────┐
│ LEFT COLUMN                            │ RIGHT COLUMN                           │
│                                        │                                        │
│  ┌──────────────────────────────────┐  │  DETAIL TITLE -                        │
│  │ 1. WHOLE IMAGE                   │  │  (GOOGLE LENS TYPE)                    │
│  │   [ Lens target lock reticle ]   │  │                                        │
│  └──────────────────────────────────┘  │  CHARACTERISTIC:                       │
│                   │                    │  [ Detected physical feature ]         │
│                   ▼                    │                                        │
│  ┌──────────────────────────────────┐  │  EXPLANATION:                          │
│  │ 2. ZOOM OF SPECIFIC DETAIL /     │  │  [ Why it implies Portugal/Spain/FR ]  │
│  │    CHARACTERISTIC                │  │                                        │
│  │    (Magnified optical crop)      │  │  PROBABILITY:                          │
│  └──────────────────────────────────┘  │  PORTUGAL : 55% [=============       ] │
│                                        │  FRANCE   : 12% [===                 ] │
│                                        │  SPAIN    : 73% [==================  ] │
└────────────────────────────────────────┴────────────────────────────────────────┘
```

---

## COMPONENT SPECIFICATION

### 1. Entrance Transition (Forge-Inspired)
- When "Find My Location" is clicked on the landing screen, trigger a brief (350–450ms) cinematic camera shutter lock-on transition (`bg-black/95`, pulsing lime viewfinder reticle, and label `"ACQUIRING OPTICAL TARGET..."`).
- Fade in the Inspection screen smoothly once target lock completes.

### 2. Left Column (Dual Optical Viewfinder)
1. **Whole Image (`1. WHOLE IMAGE`)**:
   - Aspect ratio `21/9` or wide panorama container with 1px border `rgba(255,255,255,0.1)`.
   - Displays the full uploaded panorama image.
   - An animated Google Lens target box (`border-lime`, corner markers) overlaid on the focal coordinate of the currently active clue.
2. **Connecting Arrow**:
   - Subtle vertical downward indicator connecting Step 1 to Step 2.
3. **Detail Magnifier (`2. ZOOM OF SPECIFIC DETAIL / CHARACTERISTIC`)**:
   - Aspect ratio `16/9` container with `border-lime/30` and subtle electric glow.
   - High-magnification (2.4x–3.2x) optical viewport focused on the target coordinates.
   - Optical HUD overlay: Subtle hairline crosshairs, dashed circular reticle, corner viewfinder brackets, and badge `"OPTICAL TARGET ACQUIRED"`.

### 3. Right Column (Google Lens Intelligence Card)
- Dark obsidian glass panel (`#101017`, 1px border `rgba(255,255,255,0.1)`, rounded-2xl).
- **Header**:
  - Badge: `GOOGLE LENS AI DETECTION` with category (e.g. `Road Infrastructure`, `Architecture`, `Biome`).
  - Large headline: Title of detected clue (e.g. `Spanish Roadside Reflector Bollard`).
- **Characteristic**:
  - Monospace label: `CHARACTERISTIC:`
  - Description of what the computer vision model detected.
- **Explanation**:
  - Monospace label: `EXPLANATION:`
  - Clear rationale explaining why the visual feature is tied to Spain / Portugal / France.
- **Probability Breakdown**:
  - Monospace label: `PROBABILITY:`
  - High-contrast horizontal progress bars for all 3 candidate nations:
    - **PORTUGAL** : 55%
    - **FRANCE** : 12%
    - **SPAIN** : 73% (Highlighted with Electric Lime `#d6ff42` and `"TOP MATCH"` badge).
- **Slide Controls**:
  - Stepper navigation (`<  01 / 03  >`) allowing the presenter to click through 3 distinct detected clues during the demo.
  - Top action button: `"← Upload another panorama"` to return to the landing page.

---

## DESIGN SYSTEM TOKENS (PLAIN COLORS, NO AI GRADIENTS)

```css
--color-obsidian: #0b0b0f;
--color-surface:  #101017;
--color-mist:     #e9eaee;
--color-lime:     #d6ff42; /* Electric Lime for primary matches & optical focus */
--color-pt:       #10b981;
--color-fr:       #3b82f6;
--color-es:       #f59e0b;
```

- **Background**: Solid black (`#000000`) with live canvas particle dust. **No grid pattern**, no colorful gradients.
- **Typography**: Space Grotesk for headlines, Inter for body copy, Geist Mono / monospace for HUD coordinates.
- **Accents**: Plain, high-contrast Electric Lime (`#d6ff42`) for active reticles and winning probabilities.
