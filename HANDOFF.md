# YogaFest 2026 — Project Handoff

**Repo:** [github.com/sandrobetterfly/YogaFest2026](https://github.com/sandrobetterfly/YogaFest2026) (public, `main` branch)
**Live stack:** Cloudflare Worker with static assets, project `yogafest2026` (not Pages — see §2)
**Language:** Georgian (ka), single-page site
**Last updated:** 2026-08-15

---

## 1. What this is

A one-page marketing/lead-gen site for **YogaFest 2026**, a two-day alcohol-free
("Sober Rave") yoga and music festival, 5–6 September 2026 at Zion Garden,
Lisi Lake, Tbilisi. Organized by Yoga Rooms × Zion Garden.

The site's job: communicate the event, show the festival's history/credibility,
list what's on, show the venue on a map, and capture leads (ticket-interest
contacts + potential sponsors/partners) via forms.

## 2. Tech stack & architecture

- **Frontend:** a single static `index.html` — no build step, no framework.
  All CSS is inline `<style>` in the `<head>` plus per-element inline styles;
  all JS is one inline `<script>` block at the end of `<body>`, split into
  small self-contained IIFEs per feature (mobile menu, lead form, partner
  modal, map, video lazy-load — see the `// --- ... ---` comments in the file).
- **Backend:** the project is a **Cloudflare Worker with static assets**
  (`yogafest2026`) — not Cloudflare Pages. `worker.js` is the single entry
  point: it routes `POST /api/lead` to the lead-form handler (validation,
  spam checks, forwards to a **Google Apps Script Web App** that appends
  the lead to a **Google Sheet**) and falls through to
  `env.ASSETS.fetch(request)` (serving `index.html` and every other file)
  for everything else. `wrangler.toml`'s `run_worker_first = ["/api/*"]`
  guarantees `/api/*` always runs `worker.js` rather than being served as
  a static file. No email is sent anywhere in this project (an earlier
  Zoho SMTP notification was replaced by the Sheet — see §6).
- **Hosting/deploy:** Cloudflare Workers, connected to this GitHub repo.
  Deploy with `npx wrangler deploy` (see `wrangler.toml` for the project
  name, entry point, and assets directory).
- **Third-party services embedded:** Leaflet + OpenStreetMap (location map),
  Google Fonts (Noto Sans Georgian, loaded as a fallback alongside the
  primary `Mersad` font), a YouTube embed (2020 timeline video), Google Tag
  Manager (`GTM-P2NVJ7KT`).
- **No database, no CMS, no auth.** Content is edited directly in `index.html`.

## 3. File structure

```
index.html                        the entire site (markup + CSS + JS)
worker.js                         Worker entry point — routes POST /api/lead to the lead-form
                                   handler (forwards to Google Apps Script -> Google Sheet),
                                   everything else -> env.ASSETS.fetch()
google-apps-script/Code.gs        source for the Google Apps Script Web App that appends leads
                                   to a Google Sheet — deployed manually via script.google.com,
                                   not by this repo (see README-lead-form.md)
wrangler.toml                     Cloudflare Worker config (project name, entry point, assets
                                   binding, compat flags)
.assetsignore                     keeps dev/config files (worker.js, wrangler.toml, package.json,
                                   lockfiles, README*.md, HANDOFF.md, .git*) out of the publicly
                                   served static assets — gitignore syntax
package.json                      no dependencies — worker.js uses only standard fetch()
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
| — | `<header>` | Sticky nav — wordmark logo, jump links, "ბილეთები" button linking to the live ticket shop; collapses to a hamburger menu ≤760px |
| 1 | `#top` (Hero) | Full-bleed cover photo, "Sober Rave" eyebrow, big "YOGAFEST 2026" `<h1>`, subtitle, date/venue, single ticket CTA |
| 2 | `#mission` | "ჩვენი მისია" mission statement, 3 cards (გარემო / პრობლემა / შესაძლებლობა — environment/problem/opportunity), full-bleed brand illustration bridging into the next section |
| 3 | `#history` | Green-background timeline, 2015 → 2026, one entry per year with a photo (or the 2020 YouTube embed, or no image for the 2024 "paused" year) |
| 4 | `#activities` | "ხუთი სივრცე" — 5 cards (practices, Sober Rave, talks, kids' space, food) each with a corner illustration, plus a dashed ticket-CTA card |
| 5 | `#location` | Zion Garden description, parking/map info, live Leaflet map with a custom branded pin, "ლოკაცია" CTA linking to Google Maps |
| 6 | `#lead` | "დაგვიტოვე კონტაქტი" lead-capture form → posts to `/api/lead` (see §6) |
| — | `<footer>` | Partnership pitch card (with bird illustration + modal-triggering CTA) → org badge/contact/nav/organizer logos → copyright bar |
| — | Partner modal | Hidden by default; the footer's "გახდი პარტნიორი" button opens it. No form anymore — just clickable `tel:`/`mailto:` contact links (see §8, superseded item) |

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
  strips newlines to block header injection)
- Spam defense: a honeypot field (`company`, invisible to real users) + a
  time-trap (rejects submissions completed in <2s) + an optional reCAPTCHA
  hook that only activates if `RECAPTCHA_SECRET` is set
- Forwards the clean data server-to-server (plain `fetch()`, no library
  needed) to a **Google Apps Script Web App**
  (`google-apps-script/Code.gs`), which appends it as a row in a **Google
  Sheet** — timestamp, name, email, message. **No email is sent anywhere**;
  this replaced an earlier Zoho SMTP notification.
- Returns clean JSON; the frontend (`index.html`) shows a disabled/"იგზავნება…"
  state while sending, the existing thank-you panel on success, or a red
  inline error message (specific per failure type) without breaking layout

**Required before this works in production** — one Worker Secret (set via
`npx wrangler secret put GAS_WEB_APP_URL` or the dashboard, never in the
repo): the deployed Apps Script Web App URL. Until it's set, the form
fails gracefully with a "temporary technical issue" message. The Apps
Script side is deployed manually (not via this repo/git) — see
[README-lead-form.md](README-lead-form.md) for the steps, and remember
that editing `Code.gs` requires a **new deployment version** to go live
on the same URL.

## 7. Performance work

- All images were originally 5–40x larger than their display size; resized
  and recompressed in place (originals preserved in `.originals-backup/`,
  gitignored). Total delivered image weight went from ~31MB to ~5MB.
- The 2020 timeline video was a 39.2MB local file that broke Cloudflare's
  25MiB per-asset limit — replaced with a YouTube embed
  (`youtube-nocookie.com/embed/jrHr-OovhlI`), autoplaying muted+looped.
  The original file is `.gitignore`'d, not deployed. It was initially
  lazy-loaded (`loading="lazy"`, only starting once scrolled into view);
  later changed to load and autoplay immediately on page load instead
  (explicit request — trades a little initial-load weight for the video
  always being playing by the time a visitor reaches it).
- `loading="lazy"` + `decoding="async"` on every other below-the-fold
  image; the hero photo uses `fetchpriority="high"` (it's the page's LCP
  element).
- Leaflet's JS is `defer`red so it doesn't block initial render.

## 8. Known open items / not done

- **Ticket purchase link**: resolved — all five "ბილეთები" / "ბილეთის
  აღება" CTAs (header, hero, activities dashed card, footer nav, 2026
  timeline entry) now link to `https://biletebi.ge/concerts/yogafest`
  (`target="_blank" rel="noopener noreferrer"`). The earlier
  "coming soon" tooltip placeholder was removed entirely.
- **Partner modal**: no longer a form — just clickable `tel:`/`mailto:`
  contact links, so there's nothing left to wire to `/api/lead`. (This
  superseded the earlier plan to reuse the lead-form backend pattern here.)
- **No Content-Security-Policy** is set (no `<meta>` CSP, no CSP response
  header from the Worker). Not implemented in this pass — building one
  correctly means enumerating every real external origin the page loads
  (GTM, Google Fonts, unpkg/Leaflet, youtube-nocookie.com iframe,
  tile.openstreetmap.org) and testing it doesn't break any of them, which
  felt like its own separate piece of work rather than a quick add-on to
  a general bug pass. Worth doing deliberately if this ever matters more.
- **`fest svg icons/`** (source files for the floating background icons)
  is untracked in git (`git status` shows `??`). The icons are fully
  inlined into `index.html` as an SVG sprite now, so the site doesn't
  depend on that folder being deployed — it's just kept locally for
  reference/future edits. Add it to `.gitignore` if you don't want it
  showing up as untracked, or `git add` it if you'd rather have the
  source files archived in the repo. Neither has been decided yet.
- **Worker secret** (`GAS_WEB_APP_URL`) needs to be set via
  `npx wrangler secret put GAS_WEB_APP_URL` (or the dashboard) for the lead
  form to actually write to the Sheet — not something committable to the
  repo, must be done by whoever owns the Cloudflare account. The Apps
  Script Web App itself also needs to be deployed once (see §6 / README).
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
- `worker.js` itself now only uses standard `fetch()` (no Cloudflare-only
  APIs), since email/SMTP was dropped — but static-asset serving via
  `env.ASSETS` still only exists inside the real Workers runtime. Test the
  whole thing (routing + static assets + the Sheet write) with
  `npx wrangler dev`.
- The Apps Script endpoint itself can be smoke-tested directly with `curl`
  (`GET` the `/exec` URL for a `{"ok":true,...}` health check, or `POST`
  JSON `{name,email,message}` to it) independent of the Worker — useful for
  isolating "is the Sheet write broken" from "is the Worker broken."
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
7. Lead form: copy updates, then a full real backend — Cloudflare Pages
   Function → Cloudflare Worker (item 15) → Google Sheet via Apps Script
   (item 16), always with the same validation/spam protection, see §6.
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
    `/api/lead` to the same validation/spam/send logic, everything else
    falls through to `env.ASSETS.fetch()`), rewrote `wrangler.toml` for
    that model (`main`, `[assets]` binding, `run_worker_first`), added
    `.assetsignore`, enabled Workers observability, and updated the docs
    accordingly. `index.html` needed no changes — it already called the
    relative `/api/lead` path.
16. Replaced the Zoho SMTP email notification with a direct Google Sheet
    write: added `google-apps-script/Code.gs` (a Web App that appends
    each lead as a row), rewrote `worker.js` to forward validated/spam-
    checked submissions to it via plain `fetch()` instead of sending
    email, dropped the now-unused `worker-mailer` dependency entirely.
    Tested the deployed Apps Script endpoint directly with `curl` (GET
    health check + POST) before wiring it in. `index.html` again needed
    no changes.
17. Small follow-up polish: swapped the mission section's card order
    (გარემო now before პრობლემა), rewrote the lead-form thank-you
    message to drop the ticket-sales framing in favor of "our team will
    be in touch soon," and made the 2020 timeline video autoplay
    immediately on page load instead of waiting until scrolled into view.
18. Partner modal: removed the duplicate lead-capture form entirely,
    replacing it with clickable `tel:`/`mailto:` contact links (retitled
    "გახდი პარტნიორი") and dropping the now-dead submit/success JS.
19. Ticket CTAs: since there's still no real ticketing URL, converted the
    four "ბილეთები" buttons from `<a href="#lead">` links into inert
    `<button>`s — clicking one now shows a small "ბილეთები მალე
    გახდება ხელმისაწვდომი" tooltip instead of jumping to the contact
    form. The unrelated "ბილეთის აღება" CTA on the 2026 timeline entry
    still links to the working `#lead` form. *(Superseded by item 21 —
    tickets went on sale shortly after.)*
20. Added a cookie/marketing consent banner: Google Consent Mode v2
    defaults set in `<head>` before GTM loads (all signals default
    "denied"), a bottom banner that initially had Accept/Decline buttons,
    then was reworked per feedback into a plain informational notice —
    just a close (✕) button, dismissible any way (✕ or a click anywhere
    else on the page), visually a translucent gray/frosted-glass bar. Any
    dismissal grants consent and is remembered in `localStorage`.
21. Ticket CTAs, part 2: tickets went on sale, so all five "ბილეთები" /
    "ბილეთის აღება" CTAs (header, hero, activities card, footer nav, 2026
    timeline entry) now link to `https://biletebi.ge/concerts/yogafest`
    (new tab). The item-19 placeholder tooltip — `#tickets-tooltip`, its
    CSS, and the `js-tickets-cta` click handling — was removed entirely.
22. Visual polish pass: hero cover photo gets a subtle bounded parallax
    drift on scroll (implemented via a wrapper `<div>` around the `<img>`
    rather than transforming the image itself, to avoid a known WebKit
    bug where `object-fit` + `transform` on the same element can fail to
    render); hero CTAs fade in fast on page load; every section-eyebrow
    star now rotates continuously like the hero's "Sober Rave" star. A
    matching parallax + history-section-overlap effect was also added to
    the mission illustration, then fully reverted after reports it wasn't
    rendering reliably on some devices — that illustration is back to a
    plain full-bleed image with no wrapper/transform/overlap.
23. Floating background icons: built a reusable framework first
    (`.floating-icon` CSS class + one scroll-bound bob/rotate animation,
    `prefers-reduced-motion` respected, no JS beyond reading each
    element's own inline position) using placeholder star icons, then
    swapped in the real artwork from `fest svg icons/` — 8 icons (dots,
    horus-eye, orb, sparkle, sparkle2, spiral, starburst, sun) defined
    once as an SVG sprite (`<symbol>`/`<use>`, see near the top of
    `<body>`) so the path data isn't duplicated per instance. Colored
    per-instance to fit each section's background. Started at 2 icons
    per section (14 total), then added 6 more horus-eye and 4 more
    sparkle instances per request (24 total).
24. Lead form polish: submit button label shortened from "დააკლიკე და
    გამოაგზავნე" to "გაგზავნა" and resized from a full-width stretched
    button to a compact left-aligned one. Separately, fixed a real mobile
    layout bug: the form is a single-column CSS grid, and the submit
    button's old long label — kept on one line by the site-wide
    `.btn{white-space:nowrap}` rule — was the widest item, forcing the
    whole grid column (and therefore every field) wider than its card,
    crowding them against the right edge. Fixed with `white-space:normal`
    + `min-width:0` on the button, and `min-width:0` defensively on the
    other fields/labels against the same class of bug recurring later.
25. Full code review + GTM audit pass: fixed a `.history-overlap`
    `clamp()` with its min/max arguments backwards (was silently stuck at
    a flat value instead of scaling with viewport — moot now since that
    class was removed in item 22, but was a real bug while it existed);
    moved the GTM `<noscript>` fallback to be the true first element
    after `<body>` (Google's own placement guidance — it had ended up
    after the icon sprite); added Subresource Integrity hashes (computed
    directly from the fetched files, not guessed) to the Leaflet CDN
    `<link>`/`<script>` tags, since they were loading with no integrity
    check; fixed a stale comment describing the lead form as posting to
    a "Cloudflare Pages Function -> Zoho email" (inaccurate for a while —
    it's Worker -> Google Sheet); and added explicit `dataLayer.push()`
    events (`lead_form_submit_success`, `lead_form_submit_error` with an
    `error_type`, `ticket_cta_click` with a `cta_location`,
    `partner_modal_open`) for the interactions GTM's automatic triggers
    can't reliably capture on their own — the lead form uses `fetch()`
    with no real page navigation, so GTM's built-in Form Submission
    trigger fires on click regardless of whether the submission actually
    succeeded. Verified end-to-end in-browser: Consent Mode defaults land
    in `dataLayer` before GTM's own init events, all four custom events
    fire correctly, and GTM's own native auto-tracking (`gtm.linkClick`,
    `gtm.formSubmit`) still fires alongside them.
