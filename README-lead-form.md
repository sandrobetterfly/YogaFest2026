# Lead form → email notification (Cloudflare Pages + Zoho SMTP)

The "დაგვიტოვე კონტაქტი" form on the homepage posts to `/api/lead`, a
Cloudflare Pages Function (`functions/api/lead.js`) that validates the
submission and emails a notification to **hi@yogafest.ge** via Zoho SMTP.

## One-time setup on Cloudflare

The site already deploys to Cloudflare Pages, so no new infrastructure is
needed — just two things to configure once in the dashboard.

### 1. Enable Node compatibility

The email library (`worker-mailer`) needs the `nodejs_compat` flag. This repo
includes `wrangler.toml` with it already set, which Cloudflare Pages reads
automatically on deploy. If your Pages project doesn't pick it up:
**Pages project → Settings → Functions → Compatibility flags → add
`nodejs_compat`** for both Production and Preview.

### 2. Set environment variables (Secrets)

**Pages project → Settings → Environment variables → Production** (and
Preview, if you want the form to work on preview deploys too). Add these as
**encrypted/secret** values — never commit real credentials to the repo:

| Variable | Required | What it is |
|---|---|---|
| `ZOHO_SMTP_USER` | yes | The full Zoho mailbox address used to authenticate and send, e.g. `hi@yogafest.ge`. |
| `ZOHO_SMTP_PASS` | yes | A Zoho **application-specific password** for that mailbox (Zoho Mail → Settings → Security → App Passwords). Don't use the account's normal login password. |
| `LEAD_NOTIFY_TO` | no | Where notifications are sent. Defaults to `hi@yogafest.ge` if unset. |
| `RECAPTCHA_SECRET` | no | Google reCAPTCHA secret key. If set, the backend verifies a `recaptchaToken` sent from the frontend. If unset (the default right now), reCAPTCHA verification is skipped entirely — see below. |

Zoho SMTP itself needs no separate configuration beyond the app password —
the function connects to `smtp.zoho.com:465` directly.

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
  - *reCAPTCHA hook (inactive by default)* — the backend already has a
    `verifyRecaptcha()` check wired in. It only runs if `RECAPTCHA_SECRET` is
    set. To turn it on: get a site key + secret from
    [google.com/recaptcha/admin](https://www.google.com/recaptcha/admin),
    set `RECAPTCHA_SECRET` in Cloudflare, load the reCAPTCHA script on the
    page, and have the frontend include the token as `recaptchaToken` in the
    POST body (one line to add next to the other fields in the `fetch()`
    call in `index.html`).
- **Frontend UX**: submit button disables + shows "იგზავნება…" while in
  flight; on success the existing thank-you panel replaces the form; on
  failure a red inline message appears above the button (Georgian, specific
  to what went wrong) and the form stays fully usable so the visitor can
  retry — nothing about the page layout breaks either way.

## Recommended, not included here

- **Rate limiting**: a Cloudflare Function has no reliable shared state
  across requests/regions, so this code doesn't fake an in-memory limiter.
  For real abuse protection, add a **Cloudflare Rate Limiting rule** (dashboard
  → Security → WAF → Rate limiting rules) scoped to `POST /api/lead`.
- The partner/sponsor modal ("გახდი პარტნიორი") still uses a `mailto:` link
  rather than this endpoint — it wasn't in scope here, but could be pointed
  at a second Function (or this same one with a different template) using
  the identical pattern if you want it too.

## Local development note

`worker-mailer` relies on `cloudflare:sockets`, which only exists in the
Cloudflare Workers/Pages runtime — it will not work under plain `node` or a
generic static file server. Test the function with `wrangler pages dev`, or
just deploy to a Cloudflare Pages preview environment.
