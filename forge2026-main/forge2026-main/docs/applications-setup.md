# Builder applications: Cloudflare setup

Everything to do in the Cloudflare dashboard (and two things in GitHub) before
the application form goes live. Do the parts in order. Tick each box as you go.

- **Who:** someone with the **Super Administrator** role on the Cloudflare
  account that holds `forgehackathon.com`, and admin rights on the
  `unlnovae/forge2026` GitHub repo.
- **Time:** about 45 minutes.
- **Have ready:** the email addresses of everyone on the review team, and
  which one or two of them are admins (admins can export everything and
  delete applications; reviewers can read and review).
- **The Worker** that serves the site is called `forge2026`.

Every value you copy from Cloudflare goes straight into the dashboard or into
this repo. Never paste secret values into chat, email, Slack or a document.

---

## Part 0. Ship the security patch first

The live site uses a version of `seroval` (a library TanStack Start uses to
read every server-function request) with critical published vulnerabilities.
The fix (an upgrade) needs no Cloudflare setup at all.

- [ ] Merge the security-patch pull request on its own, before anything else
      in this guide. Workers Builds deploys it automatically.
- [ ] Open https://forgehackathon.com and click through Home, Builders and
      Partners to check the site still works.

---

## Part A. Lock down the accounts (10 minutes)

The data is only as safe as the accounts that can reach it.

1. [ ] **Two-factor sign-in for you.** Cloudflare dashboard, top right:
       your profile icon > **My Profile** > **Authentication** >
       **Two-Factor Authentication**. Turn it on with an authenticator app or
       a security key.
2. [ ] **Two-factor for everyone.** Left sidebar: **Manage Account** >
       **Members**. If you see **Enforce two-factor authentication** (or
       **Enforce MFA**), turn it on. Everyone without it is asked to set it
       up.
3. [ ] **Remove people who don't need access.** On the same **Members**
       page, remove anyone who no longer works on FORGe, and give everyone
       else the lowest role they need.
4. [ ] **Old API tokens.** Profile icon > **My Profile** > **API Tokens**.
       Delete tokens nobody uses. Keep the one Workers Builds created (its
       name mentions Workers Builds).

---

## Part B. Create the storage, in the EU (10 minutes)

Applicants are mostly in the EU, so their answers and CVs stay in the EU
(GDPR). **The EU setting can only be chosen when you create each one**, so
don't skip it.

Before creating anything, check the account name at the top left of the
dashboard: it must be the account that holds the `forge2026` Worker. A
database or bucket made in another account is invisible to the site, and
the deploy fails with "database … was not found".

### B1. The database (answers)

1. [ ] Open the D1 page:
       https://dash.cloudflare.com/?to=/:account/workers/d1
       (or left sidebar: **Storage & databases** > **D1 SQL database**).
2. [ ] Select **Create Database**.
3. [ ] **Name:** `forge-applications`
4. [ ] **Data location:** select **Specify jurisdiction**, then
       **European Union**.
5. [ ] Select **Create**.
6. [ ] On the new database's page, copy the **Database ID** (it looks like
       `a1b2c3d4-...`). It isn't a secret.
7. [ ] Put it in the repo: `database_id` in `wrangler.jsonc` (or send it to
       whoever is making the change). Done for `forge-applications`.

### B2. The bucket (CVs)

1. [ ] Open the R2 page:
       https://dash.cloudflare.com/?to=/:account/r2/overview
       (or left sidebar: **Storage & databases** > **R2 object storage**).
       If Cloudflare asks you to enable R2 first, accept the free plan. It
       may ask for a payment method; this volume of CVs stays well inside the
       free 10 GB.
2. [ ] Select **Create bucket**.
3. [ ] **Name:** `forge-applications`
4. [ ] **Location:** select **Specify jurisdiction**, then
       **European Union (EU)**.
5. [ ] **Default storage class:** Standard.
6. [ ] Select **Create bucket**.
7. [ ] Open the bucket > **Settings**. Check that **Public access** is
       off: **R2.dev subdomain** shows **Not allowed**, and there are no
       **Custom Domains**. Leave it that way. Don't create R2 API tokens:
       the site reaches the bucket through its binding, not through keys.
8. [ ] (Recommended) Still in **Settings**, under **Object lifecycle
       rules**, add a rule: **Delete objects** after **180 days** (or
       whatever retention the team agrees). CVs then delete themselves after
       the event.

---

## Part C. Turnstile, the "are you a person" check (5 minutes)

1. [ ] Open the Turnstile page:
       https://dash.cloudflare.com/?to=/:account/turnstile
2. [ ] Select **Add widget**.
3. [ ] **Widget name:** `FORGe applications`
4. [ ] **Hostname management:** add `forgehackathon.com` (only this one).
5. [ ] **Widget mode:** **Managed**.
6. [ ] **Pre-clearance:** leave it off.
7. [ ] Select **Create**.
8. [ ] Keep this page open. You need the **Site Key** and the
       **Secret Key** in Part E. The secret key is a secret: paste it only
       into the Worker's settings.

---

## Part D. Cloudflare Access, the lock on /review (15 minutes)

Access makes everyone sign in before they can even see `/review`. Team
members sign in with a one-time code sent to their email, so there are no
passwords to leak.

### D1. Set up Zero Trust (first time only)

1. [ ] In the dashboard's left sidebar, select **Zero Trust**.
2. [ ] Choose a **team name**, for example `forge-novae`. Your **team
       domain** becomes `forge-novae.cloudflareaccess.com`. Write it down
       for Part E.
3. [ ] Choose the **Free** plan. Cloudflare asks for payment details even
       for the free plan; you won't be charged (it's free for up to 50 users).

(Already set up? Your team domain is under **Zero Trust** > **Settings**.)

### D2. Add the one-time code sign-in

1. [ ] **Zero Trust** > **Integrations** > **Identity providers**.
2. [ ] **Add new identity provider** > **One-time PIN**, then save.

### D3. Create the application

1. [ ] **Zero Trust** > **Access controls** > **Applications**.
2. [ ] **Create new application** > **Self-hosted and private**.
3. [ ] **Application name:** `FORGe review`
4. [ ] Select **Add public hostname**:
       **Domain:** `forgehackathon.com`, **Path:** `review`
       (leave Subdomain empty).
5. [ ] Select **Add public hostname** again:
       **Domain:** `forgehackathon.com`, **Path:** `review/*`
       (the first covers the page, the second everything under it).
6. [ ] **Access policies:** create a new policy:
   - **Policy name:** `FORGe team`
   - **Action:** **Allow**
   - **Session duration:** 8 hours
   - **Include** rule: selector **Emails**, then add every team
     member's email, one by one.
   - Save the policy and make sure it's selected for this application.
7. [ ] **Login methods / identity providers:** select **One-time PIN**
       only. If **Cloudflare** (sign in with a Cloudflare account) is
       listed, untick it. Then turn on **Apply instant authentication**.
8. [ ] **Session duration** for the application (if offered): 8 hours.
9. [ ] Open **Advanced settings** > **Cookie settings**:
   - **SameSite Attribute:** **Lax**
   - **HttpOnly:** on
   - **Binding cookie:** on (a stolen sign-in cookie can't be reused)
   - **Cookie path attribute:** on (the sign-in only travels to /review)
10. [ ] Save the application.

### D4. Copy its audience tag

1. [ ] **Access controls** > **Applications** > `FORGe review` >
       **Configure**.
2. [ ] Under **Additional settings**, copy the
       **Application Audience (AUD) Tag** (a long hex string). It never
       changes unless the application is deleted.

---

## Part E. Give the Worker its settings (5 minutes)

1. [ ] Open https://dash.cloudflare.com/?to=/:account/workers-and-pages
       and select the Worker **forge2026**.
2. [ ] **Settings** > **Variables and Secrets** (the section near the top
       of Settings) > **Add**. Not the **Variables and secrets** box inside
       **Builds** further down: those exist only while the site is being
       built, and the running site never sees them.
3. [ ] Add each of these with **Type: Secret** (secrets are encrypted,
       hidden from everyone after saving, and survive every deploy):

| Variable name           | Value                                                                                |
| ----------------------- | ------------------------------------------------------------------------------------ |
| `CF_ACCESS_TEAM_DOMAIN` | your team domain from D1, like `forge-novae.cloudflareaccess.com`                    |
| `CF_ACCESS_AUD`         | the AUD tag from D4                                                                  |
| `REVIEWER_EMAILS`       | the review team's emails, separated by commas (the same people as the Access policy) |
| `REVIEW_ADMIN_EMAILS`   | the one or two admins' emails, separated by commas                                   |
| `TURNSTILE_SITE_KEY`    | the Site Key from Part C                                                             |
| `TURNSTILE_SECRET_KEY`  | the Secret Key from Part C                                                           |
| `APPLICATIONS_OPEN`     | `false` (until launch day)                                                           |

4. [ ] Select **Deploy**.
5. [ ] In the same list, check `BREVO_API_KEY` shows as a **Secret**
       (value hidden). If it shows as plain **Text**, delete it and add it
       again as a **Secret**.

Why the emails are in two places: the Access policy decides who can reach
`/review` at all, and `REVIEWER_EMAILS` is checked again by the site's own
code. If someone ever widens the Access policy by mistake, the list still
holds.

---

## Part F. Deploy and check (10 minutes)

1. [ ] Merge the applications pull request (with the database ID from B1
       in `wrangler.jsonc`). Workers Builds deploys it.
2. [ ] Worker > **Settings** > **Domains & Routes**: `forgehackathon.com`
       is listed, and **workers.dev** and **Preview URLs** both show as
       disabled (the repo turns them off on every deploy).
3. [ ] In a private window, open https://forgehackathon.com/review. You
       should see the Cloudflare Access sign-in page, not the review page.
4. [ ] Sign in with a team email. A code arrives by email; enter it. The
       review page opens with your email in the top bar.
5. [ ] In another private window, try an email that isn't on the list. Access
       must refuse it.
6. [ ] In a private window, open
       https://forgehackathon.com/review/api/list. You must get the sign-in
       page, never data.
7. [ ] Open https://forgehackathon.com/apply. It says applications aren't
       open yet.

If anything here doesn't match, stop and fix it before opening.

---

## Part G. Open applications (launch day)

1. [ ] Worker > **Settings** > **Variables and Secrets**: edit
       `APPLICATIONS_OPEN` to `true`, then **Deploy**.
2. [ ] Send one real test application with your own email and a real CV.
3. [ ] Find it on `/review`, download the CV, then delete it (admins see
       **Delete** at the bottom of an application).
4. [ ] Point the site's Apply buttons at `/apply` (a small code change).

To close applications again, set `APPLICATIONS_OPEN` back to `false`.

---

## Part H. Extra protection (recommended)

The site already rate-limits and runs Turnstile itself. These add more locks
at Cloudflare's edge.

1. [ ] **Rate limiting rule.** Zone `forgehackathon.com` >
       **Security** > **Security rules** > **Create rule** >
       **Rate limiting rules**:
   - **Rule name:** `Applications`
   - **If incoming requests match:** **URI Path** equals `/api/apply`
     **and** **Request Method** equals `POST`
   - **With the same characteristics:** **IP**
   - **When rate exceeds:** 10 requests per 10 seconds
   - **Then take action:** **Block**, for 10 seconds (the longest the
     free plan offers)
   - **Deploy**.
2. [ ] **Stop people pretending to be FORGe.** Applicants will be the
       target of fake "you've been accepted, pay here" emails. In the
       zone: **Email** > **DMARC Management**, turn it on. If you send
       email from `forgehackathon.com` (for example through Brevo), set up
       SPF and DKIM as Brevo describes, then move DMARC to `p=reject`.
3. [ ] **Always Use HTTPS** (zone > **SSL/TLS** > **Edge Certificates**)
       on, and **Minimum TLS Version** 1.2. The site already redirects,
       but this does it before the Worker is even reached.

---

## Part I. GitHub (10 minutes)

Every merge to `main` deploys straight to the live site. Whoever can push to
`main` decides what the site does with applicants' data.

1. [ ] Repo **Settings** > **Rules** > **Rulesets** (or **Branches**):
       protect `main`: require a pull request with at least one approval,
       and block force pushes and deletion.
2. [ ] Organisation **Settings** > **Authentication security**: **Require
       two-factor authentication** for everyone in `unlnovae`.
3. [ ] Repo **Settings** > **GitHub Apps** (and organisation
       **Third-party access**): remove apps nobody uses. If the team no
       longer edits the site in Lovable, disconnect Lovable: an app with
       write access can push to `main`.
4. [ ] Repo **Settings** > **Code security**: turn on **Dependabot
       alerts** and **Secret scanning**.

---

## Part J. Rules for the review team

The strongest locks don't help if data leaves through people. Share these
with everyone who reviews.

- **CVs are files from strangers.** The review page downloads them instead of
  opening them, and the form refuses PDFs with scripts, attachments or risky
  links. Still: open CVs only on your own up-to-date computer, in **Preview**
  (Mac) or by dragging the file into **Chrome** (both keep PDFs in a
  sandbox). Never click "enable editing" or "allow scripts" in a PDF.
- **Exports stay private.** The CSV export is everyone's personal data. Keep
  it in a folder only the team can open (never "anyone with the link"),
  don't email or message it, and delete local copies when you're done.
  Every export is recorded in the activity log.
- **No AI tools on applicant data.** Don't paste applications, CVs or exports
  into ChatGPT, Claude, Gemini or similar, and don't use AI browser agents
  while signed in to `/review`. It's personal data under GDPR, and an
  applicant's text could carry instructions written to trick an AI.
- **Applicants' links can be traps.** Portfolio links are typed by strangers.
  The review page shows each link's site name; be as careful as with any
  link in an email, and never sign in to anything a link opens.
- **Shared computer?** Use **Sign out** in the top bar when you're done.
- **Someone leaves the team:** remove them from the Access policy **and** from
  `REVIEWER_EMAILS` (and `REVIEW_ADMIN_EMAILS`). The second takes effect on
  their very next click. To end their sign-in at once:
  **Zero Trust** > **Team & Resources** > **Users** > the user >
  **Revoke session**.
- **Someone asks to be deleted (GDPR):** an admin opens their application and
  selects **Delete**. That removes the answers and the CV for good.
- **After the event:** agree how long applications are kept (for example six
  months). Then an admin deletes them: export first if your policy needs an
  archive, then in **D1** > `forge-applications` > **Console** run
  `DELETE FROM applications;`, and let the R2 lifecycle rule (B2 step 8)
  clear the CVs, or delete them in the bucket.
- **Check the activity log** (admins: **Activity** in the top bar) now and
  then: it shows who opened the list, downloaded CVs, exported or deleted.

---

## Running it on your computer

```bash
npx bun install
```

```bash
npm run dev
```

Then open http://localhost:8080/apply and http://localhost:8080/review.

- On your own computer you're automatically a review admin, with no
  Cloudflare sign-in, and Turnstile uses Cloudflare's test key, which always
  passes. None of that works anywhere but `localhost`.
- Test applications live in `.wrangler/state` on your computer only. Delete
  that folder to start fresh.
- To try the form on a phone on the same Wi-Fi, run `npm run dev -- --host`.
  The review page still only opens on the computer itself.
