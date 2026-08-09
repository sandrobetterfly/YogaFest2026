// Cloudflare Worker (with static assets) — entry point for yogafest2026.
//
// Routing:
//   POST /api/lead   -> handleLead() below
//   *    /api/lead    (any other method) -> 405
//   everything else  -> served as a static asset via env.ASSETS.fetch()
//
// This does not change the site's layout or the lead form's frontend
// behavior at all — index.html already POSTs to the relative path
// "/api/lead", which resolves identically here as it did before.
//
// Leads are appended to a Google Sheet via a Google Apps Script Web App
// (see google-apps-script/Code.gs) — no email notification is sent.
//
// Required environment variable (set as a Worker "Secret", never committed
// to the repo — see README-lead-form.md for details):
//   GAS_WEB_APP_URL   The deployed Google Apps Script Web App URL
//                      (https://script.google.com/macros/s/.../exec)
// Optional:
//   RECAPTCHA_SECRET  Google reCAPTCHA v3/v2 secret — if set, server verifies
//                      the token the frontend sends; if unset, this check is
//                      skipped entirely (no placeholder keys are faked here).

const MAX_LEN = { name: 100, email: 200, message: 3000, honeypot: 200 };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Minimum seconds between the form rendering and the submit landing here.
// Bots that fill + submit instantly are almost always spam.
const MIN_FILL_SECONDS = 2;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/lead') {
      if (request.method === 'POST') {
        return handleLead(request, env);
      }
      // Reject anything that isn't a POST (GET/PUT/etc. on this route).
      return json({ ok: false, error: 'method_not_allowed' }, 405);
    }

    // Everything else (index.html, images, etc.) is a static asset.
    return env.ASSETS.fetch(request);
  },
};

async function handleLead(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'invalid_request' }, 400);
  }

  // --- Honeypot: real visitors never see/fill this field (hidden via CSS). ---
  // Bots that auto-fill every input will trip it. Respond as if it succeeded
  // so the bot gets no signal that it was caught, but skip writing the row.
  const honeypot = clean(body.company, MAX_LEN.honeypot);
  if (honeypot) {
    return json({ ok: true }, 200);
  }

  // --- Time-trap: reject submissions that happened implausibly fast. ---
  const loadedAt = Number(body.loadedAt);
  if (Number.isFinite(loadedAt)) {
    const elapsedSeconds = (Date.now() - loadedAt) / 1000;
    if (elapsedSeconds < MIN_FILL_SECONDS) {
      return json({ ok: false, error: 'try_again' }, 400);
    }
  }

  // --- Optional reCAPTCHA verification (only runs if a secret is configured). ---
  if (env.RECAPTCHA_SECRET) {
    const token = typeof body.recaptchaToken === 'string' ? body.recaptchaToken : '';
    const passed = await verifyRecaptcha(token, env.RECAPTCHA_SECRET, request);
    if (!passed) {
      return json({ ok: false, error: 'recaptcha_failed' }, 400);
    }
  }

  // --- Validate + sanitize the real fields. ---
  const name = clean(body.name, MAX_LEN.name);
  const email = clean(body.email, MAX_LEN.email);
  const message = clean(body.message, MAX_LEN.message);

  if (!name || !email || !EMAIL_RE.test(email)) {
    return json({ ok: false, error: 'invalid_fields' }, 400);
  }

  if (!env.GAS_WEB_APP_URL) {
    console.error('lead form: missing GAS_WEB_APP_URL env var');
    return json({ ok: false, error: 'server_not_configured' }, 500);
  }

  try {
    const resp = await fetch(env.GAS_WEB_APP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, message }),
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      console.error('lead form: Google Sheet write failed', {
        status: resp.status,
        body: redact(text, [env.GAS_WEB_APP_URL]).slice(0, 500),
      });
      return json({ ok: false, error: 'send_failed' }, 502);
    }

    // Apps Script's doPost() returns { ok: true/false, ... } as JSON — surface
    // an explicit ok:false from the script itself as a failure too.
    let result = null;
    try {
      result = await resp.json();
    } catch {
      // Non-JSON 200 response — treat as success; the row write already
      // happened before Apps Script formats its reply.
    }
    if (result && result.ok === false) {
      console.error('lead form: Apps Script reported failure', result);
      return json({ ok: false, error: 'send_failed' }, 502);
    }
  } catch (err) {
    // Diagnostic only: goes to Cloudflare Workers Logs (console.error / Live
    // Logs), never to the client. The public response below stays generic.
    // Message is scrubbed in case the URL (treated as sensitive, since it's
    // an unauthenticated write endpoint) ever appears in an error string.
    console.error('lead form: Google Sheet write failed', {
      name: err && err.name,
      message: redact(err && err.message, [env.GAS_WEB_APP_URL]),
    });
    return json({ ok: false, error: 'send_failed' }, 502);
  }

  return json({ ok: true }, 200);
}

// ---------- helpers ----------

// Strips any of the given secret values out of a string before it's logged,
// in case an error message ever echoes the Apps Script URL back verbatim.
function redact(text, secrets) {
  if (typeof text !== 'string') return text;
  let out = text;
  for (const secret of secrets) {
    if (secret) out = out.split(secret).join('[REDACTED]');
  }
  return out;
}

function clean(value, maxLen) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[\r\n]+/g, ' ') // no header/line injection in single-line fields
    .trim()
    .slice(0, maxLen);
}

async function verifyRecaptcha(token, secret, request) {
  if (!token) return false;
  try {
    const resp = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret,
        response: token,
        remoteip: request.headers.get('CF-Connecting-IP') || '',
      }),
    });
    const data = await resp.json();
    // reCAPTCHA v3 returns a score 0..1; v2 only returns success. Handle both.
    if (typeof data.score === 'number') return data.success && data.score >= 0.5;
    return Boolean(data.success);
  } catch (err) {
    console.error('lead form: recaptcha verify failed', err);
    return false;
  }
}

function json(payload, status) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
