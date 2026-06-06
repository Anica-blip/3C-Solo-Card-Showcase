# 3C Card Showcase

> ⚖️ This repository is protected under a binding [Legal Disclaimer](./LEGAL_DISCLAIMER.md) that governs all use, cloning, and forking from the date of inception. Please read before use.

This project is part of the 3C Thread To Success™ ecosystem — a growing digital platform that combines creativity, structure, and real-world application.

The 3C Thread To Success™ brand, including its name, structure, characters (Aurion 3C Mascot), and overall system design, remains the intellectual property of the creator and is not included in this license.

Commercial use of the brand or replication of the ecosystem identity is not permitted without permission.

### 🎭 The 3C Ecosystem

This project is part of a larger system built around three core identities:

Aurion → Engagement & Experience
Caelum → Structure & Direction
Anica (Founder) → Authority & Vision

Together, they create a balanced environment for growth, learning, and progression.

---

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
> Designed and Built with ❤️ by Claude (Anthropic) × Chef Anica · 3C Thread To Success™ Cooking Lab

---

## License

MIT — see `LICENSE`

---

## 👤 Creator

Anica-blip (“Chef”)
Founder of 3C Thread To Success™ ("Cooking Lab")
Independent Creator | Community Builder

---

🧠 Philosophy

“Think it. Do it. Own it.”

This project was built from vision, persistence, and a commitment to creating meaningful and structured experiences — even with minimal resources.
