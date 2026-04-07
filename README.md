# 3C Card Showcase

**Built by Claude (Anthropic) × Chef Anica · 3C Thread To Success Cooking Lab**

A cinematic card viewer — floating, immersive, and designed for the 3C ecosystem.
Each showcase is a curated collection of cards (quotes, affirmations, storytelling) displayed one at a time inside a TV-screen experience.

---

## Architecture

| Layer | Tool | Purpose |
|---|---|---|
| Hosting | GitHub Pages | Serves all HTML/CSS/JS |
| Storage | Cloudflare R2 (`3c-library-files`) | Card images, cover, ambient audio, showcase JSON |
| API | Cloudflare Worker (`3c-card-showcase`) | CRUD routes between admin and R2 |
| Database | Supabase (`card_showcases`) | Showcase registry, metadata, active toggle |

**R2 folder:** `CardShowcase/{slug}/`

---

## File Structure

```
3c-card-showcase/
├── admin/
│   ├── index.html        ← Admin builder (two-panel card navigator)
│   ├── admin.css
│   ├── builder.js
│   ├── config.js         ← WORKER_URL, Supabase keys
│   └── supabaseAPI.js
├── public/
│   └── index.html        ← TV screen card viewer
├── worker.js             ← Cloudflare Worker
├── wrangler.toml         ← R2 binding: SHOWCASE_BUCKET → 3c-library-files
├── landing.html          ← Landing gate (cover image + ENTER)
├── favicon.png
├── LICENSE
├── README.md
└── SETUP.md
```

---

## User Flow

```
landing.html?showcase=showcase.01
  → fetches JSON from R2 via Worker
  → shows cover image + title + ENTER button
  → user taps ENTER
public/index.html?showcase=showcase.01
  → TV screen loads
  → cards float one by one
  → ↓ download any card as PNG
  → ✕ exit at any time (highlights at end)
  → ♪ toggle ambient music
```

---

## Card Shapes Supported

- **Rectangle** — portrait 3:4 (default, for quote / affirmation cards)
- **Square** — 1:1 (for graphic cards)
- **Circle** — circular crop (for profile / avatar cards e.g. Aurion)

---

## Watermark

All public and admin pages carry:
> Built with ♥ by **Claude (Anthropic)** × Chef Anica · 3C Thread To Success Cooking Lab

---

## License

MIT — see `LICENSE`
