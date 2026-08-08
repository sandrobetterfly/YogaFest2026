// Cloudflare Pages Function — POST /api/lead
//
// Receives the "დაგვიტოვე კონტაქტი" lead form, validates + sanitizes it,
// runs lightweight spam checks, and emails a notification to hi@yogafest.ge
// via Zoho SMTP.
//
// Required environment variables (set as Cloudflare Pages "Secrets", never
// committed to the repo — see README-lead-form.md for details):
//   ZOHO_SMTP_USER    Zoho mailbox used to authenticate + send (e.g. hi@yogafest.ge)
//   ZOHO_SMTP_PASS    Zoho application-specific password for that mailbox
// Optional:
//   LEAD_NOTIFY_TO    Notification recipient (defaults to hi@yogafest.ge)
//   RECAPTCHA_SECRET  Google reCAPTCHA v3/v2 secret — if set, server verifies
//                      the token the frontend sends; if unset, this check is
//                      skipped entirely (no placeholder keys are faked here).

import { WorkerMailer } from 'worker-mailer';

const DEFAULT_NOTIFY_TO = 'hi@yogafest.ge';

const MAX_LEN = { name: 100, email: 200, message: 3000, honeypot: 200 };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Minimum seconds between the form rendering and the submit landing here.
// Bots that fill + submit instantly are almost always spam.
const MIN_FILL_SECONDS = 2;

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'invalid_request' }, 400);
  }

  // --- Honeypot: real visitors never see/fill this field (hidden via CSS). ---
  // Bots that auto-fill every input will trip it. Respond as if it succeeded
  // so the bot gets no signal that it was caught, but skip sending mail.
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

  if (!env.ZOHO_SMTP_USER || !env.ZOHO_SMTP_PASS) {
    console.error('lead form: missing ZOHO_SMTP_USER / ZOHO_SMTP_PASS env vars');
    return json({ ok: false, error: 'server_not_configured' }, 500);
  }

  const notifyTo = env.LEAD_NOTIFY_TO || DEFAULT_NOTIFY_TO;

  try {
    await WorkerMailer.send(
      {
        host: 'smtp.zoho.com',
        port: 465,
        secure: true,
        credentials: {
          username: env.ZOHO_SMTP_USER,
          password: env.ZOHO_SMTP_PASS,
        },
        authType: 'plain',
      },
      {
        from: { name: 'YogaFest 2026 — ვებგვერდი', email: env.ZOHO_SMTP_USER },
        to: { email: notifyTo },
        reply: { name, email }, // lets hi@yogafest.ge hit "reply" straight to the lead
        subject: `ბილეთის მოთხოვნა — ${name}`,
        text: plainTextBody({ name, email, message }),
        html: htmlBody({ name, email, message }),
      },
    );
  } catch (err) {
    console.error('lead form: email send failed', err);
    return json({ ok: false, error: 'send_failed' }, 502);
  }

  return json({ ok: true }, 200);
}

// Reject anything that isn't a POST (GET/PUT/etc. on this route).
export async function onRequestGet() {
  return json({ ok: false, error: 'method_not_allowed' }, 405);
}

// ---------- helpers ----------

function clean(value, maxLen) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[\r\n]+/g, ' ') // no header/line injection in single-line fields
    .trim()
    .slice(0, maxLen);
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function plainTextBody({ name, email, message }) {
  return [
    `სახელი: ${name}`,
    `ელფოსტა: ${email}`,
    '',
    message || '(შეტყობინება არ დაწერილა)',
  ].join('\n');
}

function htmlBody({ name, email, message }) {
  return `
    <div style="font-family:sans-serif;font-size:15px;line-height:1.6;color:#222">
      <p><strong>სახელი:</strong> ${escapeHtml(name)}</p>
      <p><strong>ელფოსტა:</strong> ${escapeHtml(email)}</p>
      <p><strong>შეტყობინება:</strong><br>${escapeHtml(message || '(შეტყობინება არ დაწერილა)').replace(/\n/g, '<br>')}</p>
    </div>
  `;
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
