# FORGe 2026 website

Marketing site for FORGe 2026 (forgehackathon.com). TanStack Start + React 19, Vite, Tailwind CSS v4, three.js, GSAP (ScrollTrigger, SplitText), Lenis, Phosphor icons. Deployed with Cloudflare Workers Builds (`cloudflare-module` Nitro preset in `vite.config.ts`; the README's "Pages" is out of date).

## Setup

- `bun.lock` is the lockfile of record. Install or add packages with Bun (`npx bun install`, `npx bun add <pkg>` if Bun isn't installed). npm hits a peer-dependency conflict on `nitro`, and `package-lock.json` must not be committed.
- Dev server: `npm run dev` (port 8080). Build: `npm run build`.

## How the site is built

There are two builds of the site in one app (`src/components/layout.ts`, `src/components/Split.tsx`):

- **The phone build** (`src/components/phone`, styled by `src/phone.css`), under 768px wide.
- **The wide build** (`src/components/story`), for tablets and desktops: the 3D story below.

The server renders both builds and CSS shows the one that fits (`.only-phone` / `.only-wide`). In the browser, only the build on screen hydrates; the other keeps its server HTML untouched and hidden. Each route renders `<Split phone={…} wide={…} />`, and the root renders the chrome with `<Only mode="…" of={…} />`. The wide build's modules are loaded on demand (`onDemand` in `layout.ts`, wired up in `story/wide.ts`): static on the server, and in the browser a separate chunk that phones never download. Keep it that way: nothing the phone build imports may import `stage.ts`, GSAP, Lenis, `fx.ts`, `interact.ts` or three.js. If the window crosses 768px later (a phone turned sideways, a desktop window narrowed), the other build wakes then. The route loaders (`wideReady`) make a wide page change wait for its chunk, so it never flashes empty.

### The phone build

A calm, tap-first story. It has no WebGL, sparks layer or custom cursor, and it doesn't run GSAP or Lenis, so it stays smooth on budget Android phones and every mobile browser.

- **The way in** (`phone/Intro.tsx`, phone.css "The way in"): the anvil rises, the hammer comes down, the shards burst out of the blow, the wordmark lands, and the screen lifts away. It runs on CSS alone (transforms and opacity), so it plays from the first paint and stays smooth while the page hydrates. It plays once per full load, a tap skips it, and reduced motion skips it.

- **Pages:** `PhoneHome` (a cover and seven chapters), `PhoneBuilders` and `PhonePartners`. Their parts are in `phone/sections.tsx` and `phone/parts.tsx`.
- **Chrome** (`phone/chrome.tsx`):
  - A top bar with the wordmark and the chapter you are in. Tap the chapter to open a sheet listing every chapter, what you've read, and a jump to any of them.
  - A bottom bar with three tabs and the Next button. The Next button moves the story on one chapter at a time, and a line along the top of the bar fills as you read, in the colour of the chapter you are in.
- **Chapter colours:** every `Chapter` takes a `tone` (lime, sky, coral or lilac). Its number, the words marked `ph-tone` in its headline, the chapter button in the top bar and the progress line all wear it.
- **Markup:** `data-ph-chapter="Label"` makes a chapter; `data-ph-rise` makes a block settle in once (a fade and a lift, whole blocks only). Add the class `ph-stagger` too, and the block's children step in one after another instead (lists, grids, FAQs). Keep information in small, tappable pieces: the partners' outcomes are six one-word tiles that turn over to explain themselves (a flat `scaleX` turn, no 3D layers). Don't use long stacks of text cards. `phone/story.ts` follows the scroll with one passive listener and measures chapters only when the page changes size.
- **Ids:** phone ids start with `m-` (`m-apply`, `m-tiers`) because the hidden wide build keeps the plain ones. `HashJump` sends `#apply` to `#m-apply`.
- **The cover's anvil** (`phone/Anvil.tsx`) is drawn from the mark's traced paths (`scene/mark.ts`), so it stays sharp at any size. Tapping it swings the hammer, knocks the shards loose and throws cold sparks and a ring. It uses only the Web Animations API on transforms and opacity, with a haptic tap (`phone/haptic.ts`).
- **Memory, on the device:**
  - The strike count (`forge:strikes`) sets the line under the anvil.
  - Chapters read and where you stopped (`forge:story`) drive the "Welcome back, pick up at…" row and the ticks in the sheet.
- **Small secrets on phones** (`phone/eggs.ts`): the wide build's, in the phone's manner, with one-off motion on transforms and opacity and nothing left running.
  - Tap the lime e in "Built by NOVAe." and it becomes NOVAe's pixel e, block by block, then turns back.
  - Tap "Lisbon" in the footer and a tram runs along the footer's top line.
  - Every 150th tap on the cover's anvil changes shift (phone.css), colours only: the night comes on at 150, goes at 300, comes back at 450, and so on. The count (`forge:strikes`) carries on across visits but the night doesn't, so after a reload the next multiple of 150 brings it back.
  - The drawings are shared with the wide build through `story/eggArt.ts`, which is free of three.js and GSAP.
- **Type never animates on phones:** no split text, rolling letters or shaking headlines. Motion is transform or opacity only. Don't add frosted glass, endless animations or repainting shadows to the phone build.
- **Photographs** show at their own shape (3:2 frames, never cropped to full-screen portrait).
  - `Photo` serves the `-800.webp` copy beside each original to phones.
  - Crew portraits use `public/team/sm/` (400px).
  - Add both sizes for any new photograph.
- **Styles:** `phone.css` is linked with `media="(max-width: 767px)"`, so wide screens never wait for it. It is self-contained (its own `--ph-*` tokens and `ph-` classes); keep phone styles there, not in `styles.css`.

### The wide build

Every page is a story told by one 3D scene: 500 shards that re-form chapter by chapter. 500 is a drawing budget, not a headcount (see "No headcount" below).

- **Transitions stay smooth at every size, even paused halfway** (`StoryScene.ts`; the team found the old ones glitchy, October 2026):
  - A shard's place is a smooth function of the scroll. Transit roads never flip on a sign (`split` heads for the side of the shard's destination with a `tanh`; `blast` pushes out along a softened direction), and nothing uses `Math.random()` per frame except the hammer's own blow.
  - The formations' own motion runs on `anim`, a clock that holds still while shards travel (`HOLD_EDGE`). Looping motions (the hero's sparks, the rising streaks, the fork's streams) wrap back to their start, and a wrap mid-flight teleported shards across the screen. A looping formation must also fade a shard to nothing at its wrap.
  - Sideways throws and camera moves scale with `across` (the screen's width against 16:9), so a narrow or upright window keeps its shards on screen. Scroll speed is measured in pixels per second (the same at 60 and 120 Hz) and eased slowly. The pointer field's spring is damped just short of critical, and it softens while shards travel.
  - To check: in dev, `window.__forgeDev.advance(seconds)` returns the scene's `debug()`, whose `maxStep` is the furthest any visible shard moved in one frame since the last call. Paused halfway through any move (`__forgeDev.go(y)`, then `advance(2)`), it stays around 0.001 (the slow float). Before the fix, a looping formation mid-move gave jumps of up to 17 units.
- **A page opens on its first formation, whole:**
  - The stage doesn't draw the scene (or mark it `data-stage="live"`) until the page has declared its formations (`declared`, `reveal()` in `stage.ts`). A scene that loaded first used to draw the home page's forge and then morph into the page's own formation, which looked half built.
  - For its first second on screen, and while a carry runs, the story follows the scroll exactly (`settleUntil`), so a page reloaded halfway down doesn't race through every formation on the way.
  - A move never starts above the top of the page (`moved` in `useStoryPage.ts`). On a tall window, a short hero can leave the next chapter's marker on screen at load; its move then begins with the first scroll instead of opening half done.
- `src/components/story/stage.ts` owns everything that moves: Lenis, GSAP's ticker (the only animation loop) and the lazily loaded scene. Never start a second `requestAnimationFrame` loop or another smooth-scroll library.
- `src/components/story/scene/` is the WebGL scene. `StoryScene.ts` (renderer, forge, shards, morphing, the strike), `formations.ts` (one function per formation, laid out in viewport-relative units so each works on a phone and a monitor), `mark.ts` (the mark's traced vector paths, free of three.js), `logo.ts` (3D geometry from those paths), `names.ts` (formation names, also free of three.js). Anything in the first load imports from `mark.ts` or `names.ts`, never `logo.ts` or `StoryScene.ts`.
- `StoryCanvas`, `SiteHeader`, `ForgeIntro`, `FxLayer`, button scenes and `Cursor` live in `WideChrome.tsx`, rendered by `src/routes/__root.tsx`, so the scene and chrome survive page changes. The wide pages themselves are `home/WideHome.tsx`, `builders/WideBuilders.tsx` and `partners/WidePartners.tsx`.
- Loading intro (`ForgeIntro.tsx` + `intro.ts`): on every full load the forge heats while the scene loads, the hammer strikes, the logo is forged out of the blow and an iris opens from the anvil onto the page. It is server-rendered (a CSS failsafe removes it if scripts never run), skipped for reduced motion and when the page opened on a phone, and `?intro=0` skips it while developing. It holds the hero's CSS entrances (`html[data-intro="on"]`) and the scene's opening (`stage.holdIntro`) until the reveal.
- FX layer (`fx.ts` over the page, engine in `particles.ts`): sparks, shards, rings and flashes in 2D. Only the anvil throws sparks (`fx.strike`, the blow). A press on open space sends one ring (`fx.ripple`) and a wave through the 3D shards (`stage.burst`), with no sparks. There is no fire anywhere: the team removed it. Strikes throw cold sparks in white, lilac and lime, and struck metal flashes white-lilac, never orange or amber. The strike itself: `stage.strike()` counts combos (quick blows land harder), the scene reports the moment of contact through `onImpact`, and the stage fires the FX and a `forge:impact` window event (the hero's swing chip shows the run's heat; the headline stays still).
- Pages call `useStoryPage(ref)` and declare the story in markup: `data-scene="<formation>"` starts a formation, `data-chapter="<label>"` feeds the chapter rail, `data-split` headlines settle in line by line (whole lines, a short fade and lift), `data-rise` blocks rise in on scroll, `data-enter` marks a chapter that fades and lifts into place (`transitions.ts`; the kinds are kept but all make the same calm entrance now), and `<Seam label="…" />` marks a chapter boundary.
- The hero's open space (above the headline, left of the forge) starts empty, and every third swing of the hammer forges a doodle into it (`home/doodles.ts`, `home/HeroDoodles.tsx`, styles.css "Hero doodles"). Each doodle flies out of the blow and lands in the emptiest spot, hand-drawn in the four signal colours, with its own idle loop. There is no limit: later ones shrink to fit the gaps, and past 140 the oldest fade out. Swings count as clicks (`forge:strike`, sent by `stage.strike`), so a blow cut short by the next swing still counts; a doodle leaves with the next impact (`forge:impact`). A quiet line of small mono type at the space's right edge, level with the anvil (`.forge-chip`), asks for the swings. Its three diamonds fill one per swing; it says "Swing the hammer", "Two more swings", "One more swing", then "Three swings forge a doodle", then a count. It also shows a run's heat (it replaced the combo chip; overload turns it lime). Keep it subtle: no box, no big type. Every 150th swing changes shift: the night comes on at 150, goes at 300, and so on. Landed doodles step aside from the cursor (arrows point at it), hop when the anvil is struck, and are pushed by a click on open space (`forge:ripple`). They last across page changes and reset on a reload. Each is layered (place, flight, kick, body, drawing) so GSAP never shares an element with a CSS animation or a CSS `translate`/`scale`. They show only where that space exists (1024px and wider, not upright). The team wanted doodles earned by swinging, not there from the start, and no "Click the anvil" hint.
- **The night shift** (`theme.ts`, styles.css "The night shift") is a second look, earned with 150 swings (every 150 more switch it off, then on again) or toggled with the Konami code. It lasts until a reload.
  - `html[data-theme="night"]` swaps the four signal colours for neon and deepens the background. The signal colours live in a plain `@theme` block (not `inline`), so utilities like `text-lime` read the variables and follow.
  - The shards recolour through `stage.setPalette` (they fade across with the scene's carry) and pulse on a 120 bpm beat (`stage.setBeat`). The doodles bounce on the same beat, and the accents and light buttons cycle through the night's colours.
  - Sparks switch too (`fx.setNight`). The forge (the mark) keeps its own colours.
- Small secrets (`eggs.ts`), which nothing on the page points to:
  - Circle the cursor round the anvil three times and it turns once round (`stage.twirl`).
  - Click the lime e in "Built by NOVAe." and the shards' e bursts and reforms.
  - Click "Lisbon" in the footer and a tram runs along the footer's rule.
  - The Konami code toggles the night shift, which is handy for demos.
  - Keep new ones just as quiet: no hints beyond a tiny hover response.
- NOVAe's chapter sets the shards in NOVAe's own e (`novae` in `formations.ts`): the logo's pixel e and the cursor line under it, traced cell by cell from `/brand/novae/logo-long-white.webp`, the line in lime and blinking softly.
- The partners' hero draws a handshake in shards (`handshake` in `formations.ts`; it replaced the orbit ring, which read as unfinished). It is Phosphor's handshake (thin weight, `HANDSHAKE`), sampled along its outline (`sampleOutline`) rather than filled: filled, 500 shards lose the fingers. Each shard lies along its line, and a spark runs the length of the drawing about every six seconds. Arriving from another page, the shards land in the order they run along the outline (the formation's `order`), so the handshake traces itself in.
- Each formation declares how shards travel into it (`transit`: warp, blast, drop, rise, vortex, depth, orbit, split) and the camera moves with it; give a new formation its own so no two chapter changes look alike.
- `src/components/story/interact.ts` makes the page answer the pointer: the custom cursor (a 3D crystal shard drawn in `shardCursor.ts`, tip on the pointer; `data-cursor="Label"` names what a click does), magnetic buttons (a lean of 6px at most, so a button never reaches the one 12px beside it), ripples, and the in-button scenes. Kept calm: clicks don't throw sparks, only a press on open space (nothing you can press or type in) ripples, and no headline letters move (`data-proximity` and `interactions.shock` still exist, but nothing uses them). Hover effects run only with a mouse; nothing runs with reduced motion. The page's own flag is `data-shard-cursor` on `<html>`; never put `data-cursor` there, or empty space reads as a control and the cursor tag says "on".
- Never put a clickable element inside a `transform-style: preserve-3d` parent. Its children can end up behind the parent's (invisible) box and the parent swallows the clicks. That is what broke the crew's LinkedIn links. Give 3D effects to each element with `perspective()` in its own transform instead.
- "Who we're looking for" (`builders/WhoCanApply.tsx`) is the partners' tier picker in this chapter's lime: a numbered tab list of the nine profiles (arrow keys, Home and End move through it) and a panel with where that one fits, a 2025 photograph, the early-access button and a share button. Nothing plays on its own. The team dropped the stories version (bubbles, progress bars) as corny: don't bring it back.
- Stories (wide build): `Stories.tsx` is the full-screen story viewer; the 2025 photo flight opens as stories (`highlights.ts`). Use real FORGe photographs for imagery, not icons standing in for pictures. No photograph appears twice in a build, so no visitor sees the same one twice: `PHOTOS_2025` is the home page's 2025 chapter, and each `MORE_2025` photo (content.ts) has one place per build, listed beside it; the phone's per-page picks are `PAGE_PHOTOS` in `phone/sections.tsx`. Add new photos to `public/photos/2025` as a 1400px webp plus an `-800` copy (the phone's `<Photo>` serves that one).
- Performance tiers (`perf.ts`, `html[data-tier]`), wide build only: high (desktop), mid (touch tablets), low (weak GPUs, data saver). Tiers set the scene's resolution, glow, camera calm and idle frame rate, and FX particle counts. A governor in the stage steps down when frames run late. The scene stops drawing while something covers the screen (`stage.cover`, including a window narrowed to phone width), builds formations ahead of time and compiles shaders at load.
- Button labels that matter use `<Roll>` (letters roll over on hover); the "Button details" section of styles.css adds the light sweep, arrow loops and icon nudges. The light that follows the cursor inside a button is for dark buttons only; on lime, lilac or white it reads as a smudge.
- Every wide-build button has its own scene, played inside the button (`Glyphs.tsx`, styles.css "Button scenes"): mark it `data-glyph="build|partner|novae|access|apply|email|call|tier|recap|photos|linkedin|share|connect|ship"`. While hovered, the label rolls up out of the way (`data-playing` on the host) and a scene about what the button does plays in the pill (a builder stacking blocks, two hands shaking, a nova bursting into the NOVAe logo…), with a finale on click. Card-shaped buttons mark the pill inside them that hosts the scene with `data-glyph-host`. Labels in hosts must be `<Roll>` so they can roll away. Pick the kind by meaning; add a new scene when a button means something new. Desktop only (lazy-loaded; phones never download it). Note `data-scene` is taken: it marks 3D formations.
- NOVAe's own photographs (public/novae/story, from unlnovae.org's about page) illustrate its timeline on phones.
- Page changes by link start at the top of the new page (`stage.enterPage` on wide screens, the router's own scroll reset on phones); Back and Forward keep their place.
- The site should feel like an app: prefer things you tap (steps, chips, swipeable rows, strikes) over passive text. On phones, keep it calm: one idea per screen, and nothing that moves on its own.
- FORGe's socials (`SOCIALS`, `SOCIAL_HANDLE` in content.ts) sit at the top of every page: in the wide header (Instagram with the handle, then LinkedIn) and in a Follow row on each phone cover (`Follow` in phone/parts.tsx). They are in both footers too.
- "Who can apply" should feel selective without putting anyone off: limited places, "Where you fit" for each profile, never a blanket "Yes." for everyone.
- **No headcount.** The team dropped the 500-builder target in October 2026, so the site states no number of builders or places (the 2025 record of 120 builders stays). FORGe sells on who comes (developers, designers, founders and students from Portugal and beyond, every one of whom applied), when (one weekend in Lisbon during Web Summit week) and what happens (real partner challenges, a public demo). The closing line is "One room. One weekend. Your move.", the Idea chapter's shards spell the year (the `year` formation), and the share card (`public/og/forge-2026-v2.png`) reads "Lisbon · November 2026 · Web Summit week".
- NOVAe is presented by its three pillars (`NOVAE_VALUES`), not its timeline. Photo captions say plainly what the photograph shows.
- Content (team, sponsors, tiers, FAQs, dates, numbers) lives in `src/components/story/content.ts`. Do not add dates or venue details until they are confirmed.
- No prices anywhere on the site. The partner tiers are a catalog of what each one includes, and their one button is "Book a call" (`CALL_URL`); pricing comes up on the call. The team asked for this in October 2026.
- Dev only: `window.__forgeDev.go(y)` (wide build) jumps to a scroll position and steps the scene and animations there, which works even in a background tab; `advance(s)` also steps the FX layer and the cursor.
- A hidden preview pane runs no rendering steps: scroll, resize and media-query `change` events don't fire, and Web Animations don't advance. Take a screenshot to force a frame. To see a hover state, hover with the browser tool, then `finish()` the element's CSS transitions and set its animations' `currentTime` (from `document.getAnimations()`) before the screenshot. To test a phone turned sideways, change the viewport, then dispatch a `change` event on `layout`'s MediaQueryList. In dev the phone still downloads the wide modules (Vite serves every static import); the production build doesn't. Check `dist/client/assets` after `npm run build` to confirm GSAP stays out of the main chunk. For the intro, set `window.__forgeIntro.paused = true` and step it with `frame(dt, true)`. A running scene keeps its old code across hot reloads; reload the page after editing `scene/`. Editing `stage.ts` (or anything the stage pulls in) while `npm run dev` runs can leave two copies of the stage in the browser: the page talks to one and the canvas to the other, so the scene shows the wrong formation or nothing. Restart the dev server after such edits. Editing `styles.css` reloads the whole page.

## Builder applications

- `/apply` is the builder application, `/review` the team's page for reading and judging them. Both are tools, not chapters: `PLAIN` in `__root.tsx` gives them no 3D scene, intro or phone bars. They have their own look (`src/apply.css`, `ap-` and `rv-` classes, linked only by those routes): the site's identity turned up, ink, flat clipped blocks, and one of six colours per step or review status (the four signal colours plus sun and rose). Link to them with plain `<a href>` (a full load), never `<Link>`.
- The questions, options and limits live once in `src/lib/apply/fields.ts`, shared by the form (`components/apply/ApplyForm.tsx`) and the server (`routes/api.apply.ts`). Cross-field checks are `crossChecks()`, a plain function, because zod skips refinements while any field is invalid. Every answer goes through `cleanText` (control characters and bidi overrides stripped). Answers to new questions go in the `extra` column until they earn one.
  - The date of birth is three pickers (day, month, year), stored as `extra.birthDate`; `age` is worked out from it when they apply.
  - "What's the last thing you built?" is optional for first-timers (`lastBuiltOptional`), with no minimum.
  - Emails are refused when their ending doesn't exist (`lib/apply/email.ts` against IANA's list in `tlds.ts`), and a likely slip ("gmial.com") stops Continue once to offer the fix, without refusing it.
  - "How did you hear about FORGe?" lists 22 places in four groups (`HEARD`, `HEARD_GROUPS`), picked once: where they heard first. Codes are stored, so never rename one; add new places with new codes.
- `/review` has a live Sources view (`components/apply/Sources.tsx`): where applicants heard about FORGe, ranked, by kind of place, per day, and the places no one came from yet. It reads `GET /review/api/sources` (counts only, no audit entry) every 30 seconds while the tab is in view, which also tells the list when new applications arrived. Picking a place lists its applicants. Its charts carry one series: sky marks, grey for the rest when one is picked.
- `/review` groups teammates into one block (`components/apply/teams.ts`): linked when either lists the other's email, or both give the same team name (placeholders like "Team" join nobody). Doubtful links are flagged, never hidden. A team opens on its own with one decision for everyone (`POST /review/api/team`), which changes statuses only, never anyone's score or notes.
- Storage: D1 (`APPLICATIONS_DB`) and R2 (`APPLICATION_FILES`), both in the EU jurisdiction, declared in `wrangler.jsonc` (merged into the build by Nitro). Keep the D1 ID there: without one, a deploy would create a new database outside the EU. In `npm run dev` they come from wrangler's local emulation (`.wrangler/state`).
- Setting it up in Cloudflare: `docs/applications-setup.md`. The security model: `docs/security.md`. Read the latter before changing anything under `src/lib/apply`, `src/lib/security.ts` or the review API.

## Security rules

Applicants' personal data is the most sensitive thing this site holds. These are not optional.

- Never weaken the CSP: no `'unsafe-inline'` or `'unsafe-eval'` for scripts, no new origins. Per-page needs go through `pagePolicy` in `src/lib/security.ts` (only `/apply` may frame Turnstile; `/review` enforces Trusted Types, so never write HTML strings there).
- Anything that changes data needs `isSameOriginStrict`; anything that reads personal data needs `reviewer()` (Access JWT and the reviewer list) and an `audit_log` entry. Admin-only actions check `me.admin`.
- The form fails closed: no Turnstile keys, no storage, or `APPLICATIONS_OPEN` not `true` means no applications. Cloudflare's Turnstile test keys only work under `npm run dev` on localhost; keep it that way.
- CVs: every upload goes through `inspectPdf` (`src/lib/apply/pdf.server.ts`); run `npm run check:pdf` after touching it. The review API serves CVs only as downloads with `sandbox`. Never render an uploaded file on the site.
- No enumeration: the form and the newsletter answer the same whether or not an email is already known.
- Never log applicant data. Never put secrets in `VITE_*` variables (they ship to every browser). Secrets are Worker secrets only.
- Dependencies: install with Bun (the 24-hour minimum release age in `bunfig.toml` stays), keep `overrides` for `seroval`, and run `npx bun audit` before shipping. Don't add packages the site doesn't import.
- The dev server listens on localhost only (`vite.config.ts`); the review page's development shortcut (no sign-in) works only on localhost.

## Design rules

- Use the `redesign-existing-projects` skill to audit before changing a section, and `design-taste-frontend` for new UI.
- The FORGe logo (wordmark and anvil mark artwork) is used exactly as supplied. The 3D forge is built from the mark's own paths; don't redraw the logo.
- The team confirmed the old Visual Identity Manual is not binding. Geist / Geist Mono stay. The 2026 identity (the header comments of `styles.css` and `phone.css`):
  - **Colour:** ink and white carry the page. Four signal colours carry the energy, for an international crowd: lime, lilac, coral and sky, one per chapter, in words and flat blocks, never in glows. Lime is the one colour for "do this"; lilac is the partners'. The mark's saturated iris stays in the mark and the 3D forge (the team felt the old iris UI looked like default Tailwind).
  - **Shape:** nothing is round. Controls, panels and photographs are flat blocks with one corner clipped off, like the shards in the mark (`clip-path`; `--cut` sets the size). No frosted glass, and no borders on clipped shapes. Focus shows as an inset ring, because a clipped shape clips its own outline.
  - **Motion:** calm, in the background. Type never animates letter by letter; chapters fade and lift into place; clicks don't throw sparks (a click on open space sends one quiet ripple). The 3D scene runs with a gentle camera and glow only on hot metal, and its shards wear the four signal colours.
  - **Copy:** plain, confident and international (Portugal and beyond, Web Summit week). No cute lines or puns.
- One dark theme; the night shift is an earned variant of it, never the default. Buttons are sentence case, not monospace capitals; small labels and numbers stay in Geist Mono.
- Formations still have a `mobile` layout (for narrow wide-build windows). Check every change at desktop width, at phone width (the phone build), and with `prefers-reduced-motion`.
- No em dashes in visible copy.

## Security (CSP)

The CSP in `src/lib/security.ts` and `public/_headers` allows scripts, fonts, images and network requests from `'self'` only (images also `data:` / `blob:`). So:

- Self-host every font and image under `public/`; no Google Fonts, Unsplash or CDN URLs.
- No third-party scripts or embeds, and no inline `<script>`.
- If a change genuinely needs a new origin, update both CSP files together and call it out.

## Components from 21st.dev

When a 21st.dev component is pasted in: rebuild it with our tokens and fonts, replace placeholder copy with FORGe copy, swap remote images for local assets, and convert any `framer-motion` / `motion` usage to GSAP on the stage's ticker or plain CSS.
