# SETUP — 3C Card Showcase

**Built by Claude (Anthropic) × Chef Anica · 3C Thread To Success**

Follow these steps in order after cloning the repo.

---

## Step 1 — Supabase Table

Run this SQL in your Supabase SQL editor:

```sql
create table card_showcases (
  id                bigint generated always as identity primary key,
  showcase_slug     text unique not null,
  title             text not null,
  cards             jsonb default '[]'::jsonb,
  cover_url         text,
  ambient_music_url text,
  showcase_url      text,
  r2_key            text,
  is_active         boolean default true,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);
```

Then disable RLS (or add anon insert/update/delete policies matching your word search setup):

```sql
alter table card_showcases disable row level security;
```

---

## Step 2 — Cloudflare Worker

The R2 bucket `3c-library-files` already exists. No new bucket needed.

Deploy the worker:

```bash
cd 3c-card-showcase
wrangler deploy
```

Expected worker name: `3c-card-showcase`
Expected worker URL: `https://3c-card-showcase.3c-innertherapy.workers.dev`

---

## Step 3 — Update config.js

Open `admin/config.js` and confirm:

```js
WORKER_URL:        'https://3c-card-showcase.3c-innertherapy.workers.dev',
SHOWCASE_BASE_URL: 'https://anica-blip.github.io/3c-card-showcase/landing.html',
```

Update `SHOWCASE_BASE_URL` if the GitHub Pages repo name changes.

---

## Step 4 — Update Worker ALLOWED_ORIGINS

In `worker.js`, confirm:

```js
const ALLOWED_ORIGINS = [
  'https://anica-blip.github.io',
];
```

Add any other origins if needed, then redeploy with `wrangler deploy`.

---

## Step 5 — GitHub Pages

Push the repo to GitHub.
Enable GitHub Pages from the repo Settings → Pages → Branch: `main` / root.

Your admin will be at:
`https://anica-blip.github.io/3c-card-showcase/admin/`

Your landing page will be at:
`https://anica-blip.github.io/3c-card-showcase/landing.html?showcase=showcase.01`

---

## Step 6 — First Showcase

1. Open admin: `https://anica-blip.github.io/3c-card-showcase/admin/`
2. Enter a title (e.g. "Quote Cards")
3. Upload a cover image
4. Click `+ Add` to add cards, upload images, set shapes
5. Click `Save Showcase`
6. Copy the generated URL and add it to Aurion Vault

---

## R2 Folder Structure (auto-created on first save)

```
3c-library-files/
└── CardShowcase/
    └── showcase.01/
        ├── showcase.json
        ├── cover.png
        ├── ambient.mp3
        ├── card-001.png
        ├── card-002.png
        └── ...
```
