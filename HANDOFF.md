# YogaFest 2026 — Project Handoff

**Repo:** [github.com/sandrobetterfly/YogaFest2026](https://github.com/sandrobetterfly/YogaFest2026) (public, `main` branch)
**Live stack:** Cloudflare Worker with static assets, project `yogafest2026` (not Pages — see §2)
**Language:** Georgian (ka), single-page site
**Last updated:** 2026-08-08

---

## 1. What this is

A one-page marketing/lead-gen site for **YogaFest 2026**, a two-day alcohol-free
("Sober Rave") yoga and music festival, 5–6 September 2026 at Zion Garden,
Lisi Lake, Tbilisi. Organized by Yoga Rooms × Zion Garden.

The site's job: communicate the event, show the festival's history/credibility,
list what's on, show the venue on a map, and capture leads (ticket-interest
contacts + potential sponsors/partners) via forms that email the organizers.

## 2. Tech stack & architecture

- **Frontend:** a single static `index.html` — no build step, no framework.
  All CSS is inline `<style>` in the `<head>` plus per-element inline styles;
  all JS is one inline `<script>` block at the end of `<body>`, split into
  small self-contained IIFEs per feature (mobile menu, lead form, partner
  modal, map, video lazy-load — see the `// --- ... ---` comments in the file).
- **Backend:** the project is a **Cloudflare Worker with static assets**
  (`yogafest2026`) — not Cloudflare Pages. `worker.js` is the single entry
  point: it routes `POST /api/lead` to the lead-form handler (validation,
  spam checks, **Zoho SMTP** send) and falls through to
  `env.ASSETS.fetch(request)` (serving `index.html` and every other file)
  for everything else. `wrangler.toml`'s `run_worker_first = ["/api/*"]`
  guarantees `/api/*` always runs `worker.js` rather than being served as
  a static file.
- **Hosting/deploy:** Cloudflare Workers, connected to this GitHub repo.
  Deploy with `npx wrangler deploy` (see `wrangler.toml` for the project
  name, entry point, assets directory, and the `nodejs_compat` compatibility
  flag the email library needs).
- **Third-party services embedded:** Leaflet + OpenStreetMap (location map),
  Google Fonts (Noto Sans Georgian, loaded as a fallback alongside the
  primary `Mersad` font), a YouTube embed (2020 timeline video), Google Tag
  Manager (`GTM-P2NVJ7KT`).
- **No database, no CMS, no auth.** Content is edited directly in `index.html`.

## 3. File structure

```
index.html                        the entire site (markup + CSS + JS)
worker.js                         Worker entry point — routes POST /api/lead to the lead-form
                                   handler (Zoho SMTP), everything else -> env.ASSETS.fetch()
wrangler.toml                     Cloudflare Worker config (project name, entry point, assets
                                   binding, compat flags)
.assetsignore                     keeps dev/config files (worker.js, wrangler.toml, package.json,
                                   lockfiles, README*.md, HANDOFF.md, .git*) out of the publicly
                                   served static assets — gitignore syntax
package.json                      one dependency: worker-mailer (SMTP client for Workers)
README-lead-form.md               setup guide: required env vars, spam protection, etc.
.gitignore                        excludes .DS_Store, node_modules/, local backups, the
                                   uncompressed 2020 video (see §7)

YogaFest web home cover.jpg       hero background photo (also reused in the 2026 timeline card)
Open Graph 1.jpg                  dedicated social-share card image (og:image / twitter:image)
Timeline photos/                  2015, 2022, 2023, 2025 event photos (2020 is a YouTube embed now)
Organizors logo/                  Yoga Rooms + Zion Garden logos (white/mono versions used on site)
Visial Elements/                  brand illustrations, wordmark, icon logo, activity-card art
  └─ ხუთი სივრცე/                 the 5 "activities" section corner illustrations

YogaFest Website.dc.html          ORIGINAL design-tool export, kept only as a visual reference —
                                   not a working page, not linked from anywhere, safe to ignore/delete
```

Unused-but-kept source assets (not referenced by `index.html`, left in place
in case they're wanted later): `Visial Elements/Bird01.png` (superseded by
`Bird02.png`), `Visial Elements/Main Illustration Crop.png` (superseded by
`Key_Visual_Illustration_Main03.png`), `Organizors logo/YogaFest white.png`,
`Organizors logo/wrkn. logo@4x.png` (the original, un-recolored Zion Garden logo).

## 4. Page structure (in order)

| # | Section (`id`) | Content |
|---|---|---|
| — | `<header>` | Sticky nav — wordmark logo, jump links, "ბილეთები" button; collapses to a hamburger menu ≤760px |
| 1 | `#top` (Hero) | Full-bleed cover photo, "Sober Rave" eyebrow, big "YOGAFEST 2026" `<h1>`, subtitle, date/venue, single ticket CTA |
| 2 | `#mission` | "ჩვენი მისია" mission statement, 3 cards (პრობლემა / გარემო / შესაძლებლობა — problem/environment/opportunity), full-bleed brand illustration bridging into the next section |
| 3 | `#history` | Green-background timeline, 2015 → 2026, one entry per year with a photo (or the 2020 YouTube embed, or no image for the 2024 "paused" year) |
| 4 | `#activities` | "ხუთი სივრცე" — 5 cards (practices, Sober Rave, talks, kids' space, food) each with a corner illustration, plus a dashed ticket-CTA card |
| 5 | `#location` | Zion Garden description, parking/map info, live Leaflet map with a custom branded pin, "ლოკაცია" CTA linking to Google Maps |
| 6 | `#lead` | "დაგვიტოვე კონტაქტი" lead-capture form → posts to `/api/lead` (see §6) |
| — | `<footer>` | Partnership pitch card (with bird illustration + modal-triggering CTA) → org badge/contact/nav/organizer logos → copyright bar |
| — | Partner modal | Hidden by default; the footer's "გახდი პარტნიორი" button opens it. Same field set as the lead form, still submits via `mailto:` (not wired to the backend — see §8) |

## 5. Design system

Defined as CSS custom properties at the top of `index.html`:

| Token | Hex | Use |
|---|---|---|
| `--maroon` / `--bg` | `#360522` | primary dark background, primary text-on-light |
| `--bg-footer` | `#250216` | footer background |
| `--chartreuse` | `#DADA7A` | brand accent — headings, primary buttons, history section bg |
| `--coral` | `#F47C6C` | eyebrow labels, secondary accents |
| `--red` | `#F52528` | timeline "current year" marker, solid-button shadow |
| `--sky` | `#8DD8F8` | mission section eyebrow |
| `--cream` / `--bg-light` | `#F4E1BB` | light section backgrounds (location, history text) |

Font: `Mersad` (primary display/body font, assumed self-hosted or system —
not loaded via `<link>`) with `Noto Sans Georgian` as a Google Fonts fallback
for Georgian glyph coverage, then `system-ui, sans-serif`.

Reusable component classes: `.btn` (+ `.btn-primary` / `.btn-secondary` /
`.btn-solid`, sizes `.btn-sm/md/lg`, `.btn-sticker` for the rotated "sticker"
look) and `.card` (+ `.card-dark` / `.card-brand` / `.card-green`,
`.card-illus` for corner illustrations, `.card-sticker`).

## 6. Lead form backend

**Full details in [README-lead-form.md](README-lead-form.md) — this is a summary.**

`worker.js` (`POST /api/lead` route, part of the `yogafest2026` Worker):

- Validates + sanitizes name/email/message (length caps, email format,
  strips newlines to block header injection, HTML-escapes before embedding
  in the notification email)
- Spam defense: a honeypot field (`company`, invisible to real users) + a
  time-trap (rejects submissions completed in <2s) + an optional reCAPTCHA
  hook that only activates if `RECAPTCHA_SECRET` is set
- Sends the notification to **hi@yogafest.ge** via **Zoho SMTP**
  (`smtp.zoho.com:465`) using the `worker-mailer` library — the only SMTP
  client that works from Cloudflare's edge runtime — with `reply-to` set to
  the visitor's own email so replying goes straight to them
- Returns clean JSON; the frontend (`index.html`) shows a disabled/"იგზავნება…"
  state while sending, the existing thank-you panel on success, or a red
  inline error message (specific per failure type) without breaking layout

**Required before this works in production** — two Worker Secrets (set via
`npx wrangler secret put <NAME>` or the dashboard, never in the repo):
`ZOHO_SMTP_USER` (the sending mailbox) and `ZOHO_SMTP_PASS` (a Zoho
app-specific password, not the account password). Until these are set, the
form fails gracefully with a "temporary technical issue" message.

## 7. Performance work

- All images were originally 5–40x larger than their display size; resized
  and recompressed in place (originals preserved in `.originals-backup/`,
  gitignored). Total delivered image weight went from ~31MB to ~5MB.
- The 2020 timeline video was a 39.2MB local file that broke Cloudflare's
  25MiB per-asset limit — replaced with a YouTube embed
  (`youtube-nocookie.com/embed/jrHr-OovhlI`), autoplaying muted+looped,
  lazy-loaded. The original file is `.gitignore`'d, not deployed.
- `loading="lazy"` + `decoding="async"` on every below-the-fold image; the
  hero photo uses `fetchpriority="high"` (it's the page's LCP element).
- Leaflet's JS is `defer`red so it doesn't block initial render.

## 8. Known open items / not done

- **Ticket purchase link**: every "ბილეთები" button still points to `#lead`
  (the contact form) — there's no real ticketing platform/URL yet. Update
  the `href="#lead"` occurrences once one exists.
- **Partner modal still uses `mailto:`**, not the `/api/lead` backend. Same
  pattern could be reused (another route branch in `worker.js`, or a `type`
  field on the existing one) if you want it to send silently like the lead
  form does.
- **Worker secrets** (`ZOHO_SMTP_USER`/`ZOHO_SMTP_PASS`) need to be set via
  `npx wrangler secret put <NAME>` (or the dashboard) for the lead form to
  actually send email — not something committable to the repo, must be done
  by whoever owns the Cloudflare account.
- **Dashboard deploy command**: if it's still set to the Pages-specific
  `npx wrangler pages deploy . --project-name yogafest2026` (from when this
  was briefly configured as a Pages project), change it back to plain
  `npx wrangler deploy` — Workers → Settings → Build. This is a manual
  dashboard step, nothing in the repo can do it.
- **No real rate limiting** on `/api/lead` beyond the honeypot/time-trap (a
  Worker invocation can't reliably rate-limit across requests/regions on its
  own). Recommended: a Cloudflare WAF Rate Limiting rule on that route.
- **`og:url`/canonical** were never set to a live domain (placeholder/absent)
  since no production domain was confirmed during this build — add once one exists.
- Social links (Instagram/Facebook) point to real handles
  (`yoga.fest.ge`) — already correct, no action needed.

## 9. Local development / testing notes

- This is a static file — open `index.html` directly, or serve it with
  anything (`python3 -m http.server`, etc.) for basic layout work.
- **The lead form will not work under a plain static server.**
  `worker-mailer` depends on `cloudflare:sockets`, which only exists inside
  the actual Cloudflare Workers runtime. Test the whole thing (routing +
  static assets + email) with `npx wrangler dev`.
- YouTube embeds (the 2020 video) don't load correctly from a `file://` URL
  in some browsers — serve over `http://localhost` if testing that section.

## 10. Completed work (chronological)

1. Rebuilt the original design-tool export (`YogaFest Website.dc.html`, a
   non-functional prototype missing its runtime/assets) into a real,
   self-contained, working `index.html`.
2. Hero: full-bleed cover photo, simplified copy/CTAs, restored big heading
   as a proper `<h1>`.
3. Mission section: rewritten copy (problem/environment/opportunity
   framing), responsive 2-up card layout, full-bleed brand illustration
   bridging seamlessly into the next section.
4. Activities section: replaced placeholder icons with the 5 real brand
   illustrations, added corner-illustration treatment to every card.
5. History timeline: wired in all real event photos, the 2020 video (later
   swapped to a YouTube embed), changed section background to brand green.
6. Location: corrected map coordinates (resolved from a Google Maps share
   link), custom branded map pin, rewritten copy, real map-linking CTA.
7. Lead form: copy updates, then a full real backend (originally a
   Cloudflare Pages Function, later migrated to a Cloudflare Worker with
   static assets — see item 15 — Zoho SMTP, validation, spam protection,
   see §6).
8. Footer: partnership pitch card with bird illustration and a modal-based
   contact flow (green modal card, brown CTA), real organizer logos
   (one recolored to white), real social links.
9. Mobile hamburger menu (caught and fixed a bug where it was rendering
   permanently open due to a CSS specificity conflict).
10. SEO: single `<h1>`, Open Graph + Twitter Card tags with a dedicated
    share-card image, JSON-LD `Event` structured data, favicon, robots/theme-color meta.
11. Performance pass: image optimization (~31MB → ~5MB), lazy-loading,
    resolved the Cloudflare 25MiB asset-limit deploy failure.
12. Bug fixes: invisible button text on `:hover` (CSS specificity issue),
    YouTube video letterboxing (now fills its frame edge-to-edge).
13. Installed Google Tag Manager (`GTM-P2NVJ7KT`).
14. Set up the GitHub repo and initial Cloudflare Pages deployment from scratch.
15. Migrated the backend off Cloudflare Pages: the real Cloudflare project
    (`yogafest2026`) turned out to be a Worker with static assets, not
    Pages. Converted `functions/api/lead.js` into `worker.js` (routes
    `/api/lead` to the same validation/spam/Zoho-send logic, everything
    else falls through to `env.ASSETS.fetch()`), rewrote `wrangler.toml`
    for that model (`main`, `[assets]` binding, `run_worker_first`), and
    updated the docs accordingly. `index.html` needed no changes — it
    already called the relative `/api/lead` path.
