# Security model

What the site protects, how, and what is left to people. Setup steps are in
[applications-setup.md](applications-setup.md).

## What needs protecting

1. **Applicants' data:** names, emails, phone numbers, dates of birth,
   written answers and CVs. The most sensitive thing the site holds.
2. **The team's review access:** whoever can open `/review` can read all of
   it.
3. **The site itself:** what every visitor's browser runs, and the secrets
   the Worker holds (the Brevo key, the Turnstile secret).

## The layers

### Every page

- **Content Security Policy** (`src/lib/security.ts`, mirrored for static
  files in `public/_headers`): scripts only from this site and only with the
  per-request nonce (never `unsafe-inline`, never `eval`); no plugins, no
  framing, no `<base>`, forms post only to this site. Per page
  (`pagePolicy`): `/apply` may embed Turnstile's iframe; `/review` also
  enforces Trusted Types, so no code on it can turn a string into HTML or
  script.
- HSTS, `nosniff`, `X-Frame-Options: DENY`, COOP/CORP same-origin, a strict
  Permissions-Policy. Pages with personal data are `no-store` and `noindex`,
  and `/review` sends no referrer.
- The site answers only on its own domain: `workers_dev` and `preview_urls`
  are off in `wrangler.jsonc`, and the form and review API refuse other
  hostnames in code too (`onSiteHost`).

### The application form (`/api/apply`)

- Only this site's pages can send (`Origin` / `Sec-Fetch-Site` must match).
- Turnstile proves a person sent it (`turnstile.server.ts`): one-use token,
  checked with Cloudflare for this site and this form. Without keys in
  production the form takes nothing. Cloudflare's test keys only work on
  `localhost`.
- Rate limits: the Workers rate limiting binding per address, plus an
  in-memory floor.
- The body is read with a hard cap (5 MB CV plus a little), however it's sent.
- Answers: the same zod schema as the form (`fields.ts`), with control
  characters and bidirectional overrides stripped, so no name or file name
  can disguise itself.
- CVs (`pdf.server.ts`): must really be PDFs; refused if they carry
  JavaScript, launch actions, embedded files, media, XFA, form submission, or
  links to local files, network shares or `javascript:`, including inside
  compressed object streams and behind `#xx` name escapes. Encrypted PDFs
  are refused. Tested against crafted attack files (`npm run check:pdf`) and
  real PDFs from macOS and Chrome.
- One application per email, answered the same way as a first one, so the
  form can't be used to find out who applied.
- Drafts live in the tab (`sessionStorage`), never on the device after it
  closes. The CV is never stored in the browser.

### The review page (`/review`, `/review/api/*`)

Three locks, each enough on its own (`access.server.ts`):

1. **Cloudflare Access** in front of `/review` and `/review/*` (one-time
   code by email, binding cookie, cookie path, 8-hour sessions).
2. **The Worker verifies the Access JWT itself** from the
   `Cf-Access-Jwt-Assertion` header: RS256 only, signature against the
   team's keys, issuer, audience tag, expiry. A request that didn't pass
   Access gets nothing.
3. **The email must be on `REVIEWER_EMAILS` or `REVIEW_ADMIN_EMAILS`**, a
   Worker secret, so a too-wide Access policy still doesn't let anyone in.

And on top:

- Admins only: CSV export, deleting applications, the activity log.
- A decision for a whole team (`POST /review/api/team`) is one batch: every
  status change and its audit entry land together, or none do.
- Sources (`GET /review/api/sources`) returns counts only: applications per
  day, "how did you hear" answer and review status, with no names, emails or
  typed answers. That's why the page can refresh it every 30 seconds without
  an audit entry each time; it still needs the same sign-in as everything
  else under `/review`.
- Cross-site requests are refused; changes need a same-origin `Origin`.
- Every read of personal data and every change is written to `audit_log`
  (who, what, when).
- CVs are served as downloads with `Content-Security-Policy: sandbox` and
  `nosniff`: a file from a stranger never runs on the page that holds
  everyone's data.
- CSV cells that start with `= + - @` are prefixed, so a spreadsheet never
  runs an applicant's formula.
- Applicants' links are shown only when they're `http(s)`, with their site
  name visible.

### Data at rest

- D1 and R2 are created with the **EU jurisdiction**; Cloudflare encrypts
  both at rest. The bucket has no public access.
- The EU database's ID is pinned in `wrangler.jsonc`, so a deploy never
  creates a database of its own elsewhere.

### Code and supply chain

- `bun.lock` with a 24-hour minimum release age (`bunfig.toml`): a freshly
  published (possibly hijacked) package version is never installed.
- `overrides` in `package.json` pin patched versions of `seroval` (critical
  deserialization advisories; it decodes every server-function request) and
  `sharp`.
- Unused packages were removed (the old UI kit pulled in about 40).
- No secret has ever been committed (checked across the full git history).
  Secrets live only as Worker secrets; `VITE_*` variables are public by
  design and never hold secrets.
- The dev server listens on `localhost` only; the review page's development
  shortcut works only on `localhost`.

## What is left to people

- Reviewers' own computers: a compromised laptop that is signed in can read
  what that reviewer can read. Keep devices updated, use two-factor sign-in
  everywhere, sign out on shared machines.
- Opening CVs: the scan removes the active-content attacks, but a PDF reader
  bug could still exist. Open CVs in Preview or Chrome (both sandboxed).
- Exports: once downloaded, the CSV is outside the site's protection.
- Who can merge to `main`: every merge deploys. Branch protection and
  two-factor on GitHub are what stop a bad change.
- Phishing aimed at applicants ("you're in, pay here"): DMARC on the domain
  helps; the team should say publicly that FORGe never charges builders.

## Checking it

- `npx bun audit`: known vulnerabilities in dependencies (two dev-only ones
  remain, in Lovable's component tagger, with no fix published yet).
- `npm run check:pdf`: the CV scan against 23 crafted attack and ordinary
  PDFs. Run it after any change to `pdf.server.ts`; add real PDFs as
  arguments to check them too.
- Headers: open any page with the browser's network panel and check
  `Content-Security-Policy`; `/apply` and `/review` should be `no-store`.
