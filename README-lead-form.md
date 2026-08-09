# Lead form → Google Sheet (Cloudflare Worker + Google Apps Script)

The "დაგვიტოვე კონტაქტი" form on the homepage posts to `/api/lead`. That
route is handled by `worker.js` — a Cloudflare **Worker with static
assets** (the `yogafest2026` project). The same Worker serves the rest of
the site (`index.html` and everything else) directly from the static
assets binding; only `/api/lead` runs actual JS logic.

`worker.js` validates + sanitizes the submission, runs the spam checks
(honeypot, time-trap, optional reCAPTCHA), then forwards the clean data
**server-to-server** to a **Google Apps Script Web App**
(`google-apps-script/Code.gs`), which appends it as a row in a Google
Sheet. **No email is sent** — this replaced an earlier Zoho SMTP
notification, which is no longer used anywhere in this project.

> Why go through the Worker instead of having the browser call Apps Script
> directly? Two reasons: the spam checks (honeypot/time-trap) stay
> server-side and actually mean something — a bot calling Apps Script
> directly would bypass them entirely — and the Apps Script URL (an
> unauthenticated write endpoint) never appears in the page's public
> source.

## One-time setup

### 1. Deploy the Google Apps Script Web App

Full instructions are in the comment header of
[`google-apps-script/Code.gs`](google-apps-script/Code.gs). Short version:
open the target Google Sheet → Extensions → Apps Script → paste in
`Code.gs`'s contents → Deploy → New deployment → Web app (Execute as: Me,
Who has access: Anyone) → copy the resulting `.../exec` URL.

Whenever you edit that script later, you must create a **new deployment
version** (Deploy → Manage deployments → edit → New version → Deploy) for
the change to take effect on the same URL — just saving the file isn't enough.

### 2. Deploy the Worker

```
npx wrangler deploy
```

`wrangler.toml` already points at the right project (`name = "yogafest2026"`),
entry point (`main = "worker.js"`), and static assets directory. `.assetsignore`
keeps dev/config files out of the publicly served assets.

### 3. Set the environment variable (Secret)

```
npx wrangler secret put GAS_WEB_APP_URL
```

(or Cloudflare dashboard → Workers → `yogafest2026` → Settings → Variables
and Secrets)

| Variable | Required | What it is |
|---|---|---|
| `GAS_WEB_APP_URL` | yes | The deployed Apps Script Web App URL from step 1, e.g. `https://script.google.com/macros/s/AKfycb.../exec`. Treated as sensitive (it's an unauthenticated write endpoint) — set as a Secret, never committed to the repo. |
| `RECAPTCHA_SECRET` | no | Google reCAPTCHA secret key. If set, the backend verifies a `recaptchaToken` sent from the frontend. If unset (the default right now), reCAPTCHA verification is skipped entirely — see below. |

## What's already handled

- **Validation & sanitization**: name/email required, email format checked,
  every field length-capped, newlines stripped from single-line fields.
- **Spam protection**:
  - *Honeypot* — a hidden `company` field real users never see or fill.
    Bots that auto-fill every input trip it; the form silently reports
    success back to them (no signal they were caught) but nothing is written.
  - *Time-trap* — the form records when it loaded; submissions completed in
    under ~2 seconds are rejected as implausibly fast (typical bot behavior).
  - *reCAPTCHA hook (inactive by default)* — `worker.js` already has a
    `verifyRecaptcha()` check wired in. It only runs if `RECAPTCHA_SECRET` is
    set. To turn it on: get a site key + secret from
    [google.com/recaptcha/admin](https://www.google.com/recaptcha/admin),
    set the `RECAPTCHA_SECRET` secret, load the reCAPTCHA script on the
    page, and have the frontend include the token as `recaptchaToken` in the
    POST body (one line to add next to the other fields in the `fetch()`
    call in `index.html`).
- **Frontend UX** (unchanged by this migration): submit button disables +
  shows "იგზავნება…" while in flight; on success the existing thank-you
  panel replaces the form; on failure a red inline message appears above
  the button and the form stays fully usable so the visitor can retry.
  `index.html` still just does `fetch('/api/lead', { method: 'POST', ... })`
  — no frontend changes were needed for this migration.
- **Diagnostics**: failures are logged server-side (Cloudflare dashboard →
  Workers → `yogafest2026` → Logs — `[observability] enabled = true` in
  `wrangler.toml` keeps these queryable) with the Apps Script URL redacted
  from the log text, never sent to the browser.

## Recommended, not included here

- **Rate limiting**: a Worker invocation has no reliable shared state across
  requests/regions, so this code doesn't fake an in-memory limiter. For real
  abuse protection, add a **Cloudflare Rate Limiting rule** (dashboard →
  Security → WAF → Rate limiting rules) scoped to `POST /api/lead`.
- The partner/sponsor modal ("გახდი პარტნიორი") still uses a `mailto:` link
  rather than this endpoint — it wasn't in scope here, but could be pointed
  at `/api/lead` (with a small tweak to distinguish the two form types) using
  the identical pattern if you want it too.

## Local development note

`worker.js` now only uses standard `fetch()` — no Cloudflare-specific APIs
— so unlike the earlier Zoho/`worker-mailer` version, the lead-form logic
itself isn't tied to the Workers runtime. Static-asset serving still is,
though, so test the whole thing (routing + assets + the Sheet write) with:

```
npx wrangler dev
```
