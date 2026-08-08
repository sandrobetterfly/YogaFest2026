# Lead form → email notification (Cloudflare Worker + static assets + Zoho SMTP)

The "დაგვიტოვე კონტაქტი" form on the homepage posts to `/api/lead`. That
route is handled by `worker.js` — a Cloudflare **Worker with static
assets** (the `yogafest2026` project). The same Worker serves the rest of
the site (`index.html` and everything else) directly from the static
assets binding; only `/api/lead` runs actual JS logic, which validates the
submission and emails a notification to **hi@yogafest.ge** via Zoho SMTP.

> This project was originally built as a Cloudflare Pages project. It has
> since been converted to a plain Worker with static assets (`yogafest2026`
> is a Worker, not a Pages project) — see `wrangler.toml` and `worker.js`.
> If you're looking for the old `functions/api/lead.js` Pages Function, it
> no longer exists; its logic now lives in `worker.js`.

## One-time setup on Cloudflare

### 1. Deploy command

```
npx wrangler deploy
```

**If your Cloudflare Pages dashboard build/deploy command was previously
changed to `npx wrangler pages deploy . --project-name yogafest2026`
(the Pages-specific variant, set during an earlier version of this
project), change it back to `npx wrangler deploy` now** — Workers → Settings
→ Build (or wherever your CI/dashboard runs the deploy step). The Pages
command won't work correctly against a plain Worker project.

`wrangler.toml` already points at the right project (`name = "yogafest2026"`),
entry point (`main = "worker.js"`), and static assets directory
(`[assets] directory = "."`), and sets the `nodejs_compat` flag the email
library needs. `.assetsignore` (gitignore-syntax, lives at the repo root)
keeps dev/config files — `worker.js`, `wrangler.toml`, `package.json`,
lockfiles, README files, `HANDOFF.md`, `.git*` — out of the publicly served
assets, without touching anything the site actually needs. Routing itself is
handled by `run_worker_first = ["/api/*"]` in `wrangler.toml`: requests
under `/api/*` always run `worker.js`; everything else is served directly
from static assets.

### 2. Set environment variables (Secrets)

Set these as **Worker Secrets** — never commit real credentials to the repo.
Either via the dashboard (**Workers & Pages → yogafest2026 → Settings →
Variables and Secrets**) or the CLI:

```
npx wrangler secret put ZOHO_SMTP_USER
npx wrangler secret put ZOHO_SMTP_PASS
npx wrangler secret put LEAD_NOTIFY_TO      # optional
npx wrangler secret put RECAPTCHA_SECRET    # optional
```

| Variable | Required | What it is |
|---|---|---|
| `ZOHO_SMTP_USER` | yes | The full Zoho mailbox address used to authenticate and send, e.g. `hi@yogafest.ge`. |
| `ZOHO_SMTP_PASS` | yes | A Zoho **application-specific password** for that mailbox (Zoho Mail → Settings → Security → App Passwords). Don't use the account's normal login password. |
| `LEAD_NOTIFY_TO` | no | Where notifications are sent. Defaults to `hi@yogafest.ge` if unset. |
| `RECAPTCHA_SECRET` | no | Google reCAPTCHA secret key. If set, the backend verifies a `recaptchaToken` sent from the frontend. If unset (the default right now), reCAPTCHA verification is skipped entirely — see below. |

Zoho SMTP itself needs no separate configuration beyond the app password —
the Worker connects to `smtp.zoho.com:465` directly.

## What's already handled

- **Validation & sanitization**: name/email required, email format checked,
  every field length-capped, newlines stripped from single-line fields
  (blocks header-injection attempts), HTML-escaped before going into the
  notification email body.
- **Spam protection**:
  - *Honeypot* — a hidden `company` field real users never see or fill.
    Bots that auto-fill every input trip it; the form silently reports
    success back to them (no signal they were caught) but no email is sent.
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
  the button (Georgian, specific to what went wrong) and the form stays
  fully usable so the visitor can retry — nothing about the page layout
  breaks either way. `index.html` still just does
  `fetch('/api/lead', { method: 'POST', ... })`, which resolves identically
  under this Worker as it did under the old Pages Function — no frontend
  changes were needed for this migration.

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

`worker-mailer` relies on `cloudflare:sockets`, which only exists in the
Cloudflare Workers runtime — it will not work under plain `node` or a
generic static file server. Test the whole thing (including static asset
serving) with:

```
npx wrangler dev
```
