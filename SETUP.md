# SETUP — 3C Card Showcase

**Built by Claude (Anthropic) × Chef Anica · 3C Thread To Success**

> Living document. Update this file whenever the architecture changes.
> Last updated: 20 Nov 2026 — owner-only sign-in (GitHub through Supabase), secured Worker, dashboard deployment.

---

## Overview

A cinematic card viewer. Each showcase is a set of cards (images or short videos), an optional cover image and optional ambient music, shown one card at a time. The admin builds a showcase; the public only views it.

| Layer | Tool | Purpose |
|---|---|---|
| Hosting | GitHub Pages | Serves the admin, the landing page and the viewer |
| Storage | Cloudflare R2 (`3c-library-files`, folder `CardShowcase/`) | Showcase JSON, cards, cover, ambient audio |
| API | Cloudflare Worker `3c-card-showcase` | Reads and writes R2 |
| Sign-in | Supabase Auth, GitHub provider (PKCE) | Owner-only admin |
| Database | Supabase table `card_showcases` | Registry and metadata for the admin's archive |

**Supabase project:** "Aurion 3C Mascot" — `cgxjqsbrditbteqhdyus.supabase.co` (shared with the library, quiz, notice board, word search and card games)
**Worker URL:** `https://3c-card-showcase.3c-innertherapy.workers.dev`

---

## Security Summary

| Part | Who can do what |
|---|---|
| Public pages (`landing.html`, `public/index.html`) | Anyone can view. They only read `GET /showcase/:slug`. |
| Admin pages | Hidden until the owner is signed in with GitHub through Supabase. A signed-in account that is not the owner is signed out with a notice. |
| Worker write routes (save, delete, upload) | Owner only. Every call must carry the sign-in token; the Worker asks Supabase's `is_owner()` function and refuses anything but `true` (401 no/invalid sign-in, 403 not the owner, 503 if the check cannot be made). |
| Worker origin | Owner routes are refused for any website other than `https://anica-blip.github.io`. |
| Supabase table `card_showcases` | Row level security on; public read; writes only by the owner. |
| Secrets | None. The Worker has no variables and no secrets; the Supabase address and anon key are public by design. |

Sessions refresh themselves. There is no fixed-length session and no lock-out after a set number of days.

---

## Step 1 — Supabase table

```sql
create table card_showcases (
  id                   bigint generated always as identity primary key,
  showcase_slug        text unique not null,
  title                text not null,
  cards                jsonb default '[]'::jsonb,
  cover_url            text,
  ambient_music_url    text,
  ambient_volume_level smallint not null,
  showcase_url         text,
  r2_key               text,
  is_active            boolean default true,
  created_at           timestamptz default now(),
  updated_at           timestamptz default now()
);
```

**Row level security is ON. Live policies:**

| Policy | Applies to | Rule |
|---|---|---|
| `card_showcases_select_anon_authenticated` | visitors and signed-in users, SELECT | everyone can read the showcase list |
| `card_showcases_owner_write` | signed-in users, ALL (insert, update, delete) | only the owner's account (the policy compares the signed-in account's email with the owner's email; the address is kept out of this public file) |

There is no public insert, update or delete. **Never disable row level security on this table.**

---

## Step 2 — Sign-in (Supabase → Authentication)

- **Providers:** GitHub enabled.
- **URL Configuration → Redirect URLs:** must include `https://anica-blip.github.io/3C-Solo-Card-Showcase/**` (capital letters as written: the repository name is part of the address).
- **Sessions:** "Time-box user sessions" and "Inactivity timeout" must stay **empty**, otherwise they bring back a fixed lock-out.

**How the admin signs in:**
- `login.html` → GitHub through Supabase (PKCE). Own session name `sb-3c-card-showcase-login` (all of Chef's GitHub Pages apps share one address, so each app needs its own name). `auth-guard.js` and `admin/supabaseAPI.js` use the same name.
- `auth-guard.js` hides every admin page until the owner check (`is_owner`) passes. No session → sent to `login.html`. Signed in but not the owner → signed out with a notice. If the owner check cannot be made (for example no network), nobody is signed out.
- After sign-in, the page you came from is opened again, but only if it is inside this app; any other address falls back to the admin page.
- GitHub returns to `https://anica-blip.github.io/3C-Solo-Card-Showcase/login.html`.

---

## Step 3 — Cloudflare Worker (dashboard paste)

This Worker is deployed by **pasting `worker.js` into the Cloudflare dashboard editor**:
Workers & Pages → `3c-card-showcase` → **Edit code** → replace everything → **Deploy**.
Every version in its Deployments list carries the **Dashboard** badge. **Never deploy it with Wrangler**; the two methods are never mixed (a Wrangler deploy replaces what the dashboard holds). `wrangler.toml` in this repo only records the live settings.

- **R2 binding:** `SHOWCASE_BUCKET` → `3c-library-files` (set in the dashboard: Settings → Bindings).
- **Variables and secrets:** none. If any appear under Settings → Variables and Secrets, remove them.
- **workers.dev address:** Production on (the admin and the public pages call it); Preview off.
- To check how a Worker was deployed, open its **Deployments** tab and read the coloured badge (**Dashboard** or **Wrangler**). The italic words "Manually deployed" appear for both and say nothing about the method.
- After a deploy, an unsigned `DELETE` on a name that does not exist must answer **401**:
  in the browser Console, `fetch('https://3c-card-showcase.3c-innertherapy.workers.dev/showcase/zz-check',{method:'DELETE'}).then(r=>console.log(r.status))`

### Worker routes

| Method | Route | Who | Purpose |
|---|---|---|---|
| GET | `/showcase/:slug` | Public | Fetch the showcase JSON from R2 |
| PUT | `/showcase/:slug` | Owner only | Save the showcase JSON to R2 |
| DELETE | `/showcase/:slug` | Owner only | Delete the showcase JSON from R2 |
| PUT | `/card/:slug/:filename` | Owner only | Save a card image or video |
| PUT | `/cover/:slug` | Owner only | Save the cover image (`X-File-Extension` header) |
| PUT | `/music/:slug` | Owner only | Save the ambient audio (`X-File-Extension` header) |

**Headers:** `Authorization: Bearer <token>` on every owner route; `Content-Type`; `X-File-Extension` on cover and music.

**Answers:** 401 no/invalid sign-in · 403 not the owner or wrong website · 404 unknown address or missing showcase · 405 wrong method · 413 too large · 415 file type not allowed · 503 owner check unavailable · generic "Server error" for anything unexpected (details go to the Worker log, never to the visitor).

**Limits (enforced by the Worker):**
- Showcase JSON: a JSON object, up to 1 MB.
- Cover: png, jpg, jpeg, gif, webp.
- Music: mp3, ogg, wav.
- Card: png, jpg, jpeg, gif, webp, mp4, webm, mov.
- Up to 90 MB per file; empty files are refused.
- Showcase slugs and file names must be safe names (letters, numbers, dot, dash, underscore).

---

## Step 4 — config.js

`admin/config.js` holds the public addresses the admin uses:

```js
SUPABASE_URL:      'https://cgxjqsbrditbteqhdyus.supabase.co',
SUPABASE_ANON_KEY: '<public anon key>',   // public by design
WORKER_URL:        'https://3c-card-showcase.3c-innertherapy.workers.dev',
SHOWCASE_BASE_URL: 'https://anica-blip.github.io/3C-Solo-Card-Showcase/landing.html',
```

---

## Step 5 — GitHub Pages

- Repository: `Anica-blip/3C-Solo-Card-Showcase`
- Pages source: `main` branch, root `/`

**Live URLs:**
```
Admin login:    https://anica-blip.github.io/3C-Solo-Card-Showcase/login.html
Admin builder:  https://anica-blip.github.io/3C-Solo-Card-Showcase/admin/index.html
Cover upload:   https://anica-blip.github.io/3C-Solo-Card-Showcase/admin/landing-upload.html
Shared URL:     https://anica-blip.github.io/3C-Solo-Card-Showcase/landing.html?showcase={slug}
```

---

## Admin workflow

1. Open the admin builder → sign in with GitHub if asked.
2. New showcase → the next slug (`showcase.01`, `showcase.02` …) is chosen automatically.
3. Enter a title; add cards (image or video; shape rectangle, square or circle); optionally a cover image, ambient music and a volume level.
4. **Save Showcase**. In this order the admin sends, with the sign-in token:
   card files → cover → music → the showcase JSON to R2 through the Worker, then the registry row to Supabase. The shareable URL is shown at the end.
5. `admin/landing-upload.html` replaces the cover image of a saved showcase on its own (it updates the JSON in R2 and the Supabase row).
6. **Delete** removes the registry row and the showcase JSON. The cards, cover and audio files stay in R2 (delete them in the R2 dashboard if wanted). If the JSON file could not be removed, the admin says so.
7. The toggle sets the showcase active or inactive in the registry.

---

## Public flow

```
landing.html?showcase=showcase.01
  → GET /showcase/showcase.01 (Worker → R2)
  → cover image + title + ENTER
public/consent.html?showcase=…   (pass-through, keeps old links working)
public/index.html?showcase=showcase.01
  → consent screen, then the TV screen
  → cards float one by one; ambient music; exit at any time
```

---

## R2 folder structure

```
3c-library-files/
└── CardShowcase/
    └── showcase.01/
        ├── showcase.json        ← saved by the Worker on Save Showcase
        ├── cover.{ext}          ← PUT /cover
        ├── ambient.{ext}        ← PUT /music
        ├── card-001-{time}.{ext}← PUT /card (one file per card)
        └── ...
```

Public files are served from `https://files.3c-public-library.org/CardShowcase/{slug}/…`.

---

*Architecture designed and documented by Claude · Built for Chef Anica · 3C Thread To Success*
