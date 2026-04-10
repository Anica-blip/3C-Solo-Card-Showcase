/**
 * 3C Card Showcase — Admin Builder
 * ─────────────────────────────────────────────────────────────
 * Built by Claude (Anthropic) × Chef Anica · 3C Thread To Success
 *
 * State:
 *   cards[]       — array of card objects (local + saved)
 *   currentIndex  — which card is active in left navigator
 *   currentSlug   — slug being edited
 *   pendingFiles  — map of cardId → File (awaiting upload on save)
 */

import {
  supabase,
  fetchAllShowcases,
  generateNextSlug,
  saveShowcase,
  deleteShowcase,
  toggleShowcaseActive,
  loadShowcase,
} from './supabaseAPI.js';

/* ── STATE ──────────────────────────────────────── */
let cards        = [];   // { id, shape, image_url, r2_key, localPreview }
let currentIndex = 0;
let currentSlug  = null;
let archive      = [];

let pendingCardFiles  = {};   // cardId → File
let pendingCoverFile  = null;
let pendingMusicFile  = null;

const WORKER_URL = window.APP_CONFIG.WORKER_URL;
const BASE_URL   = window.APP_CONFIG.SHOWCASE_BASE_URL;

/* ── INIT ───────────────────────────────────────── */
export async function init() {
  archive = await fetchAllShowcases();
  currentSlug = generateNextSlug(archive);
  updateSlugDisplay();
  renderArchive();
  renderLeft();
  renderGrid();
  bindMetaInputs();
}

function bindMetaInputs() {
  // Cover upload
  document.getElementById('upload-cover').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    pendingCoverFile = file;
    document.getElementById('cover-name').textContent = file.name;
    const reader = new FileReader();
    reader.onload = ev => {
      const prev = document.getElementById('cover-preview');
      if (prev) prev.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });

  // Music upload
  document.getElementById('upload-music').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    pendingMusicFile = file;
    document.getElementById('music-name').textContent = file.name;
  });
}

/* ── SLUG DISPLAY ───────────────────────────────── */
function updateSlugDisplay() {
  document.getElementById('slug-display').textContent = currentSlug || '—';
}

/* ── LEFT PANEL ─────────────────────────────────── */
function renderLeft() {
  const card = cards[currentIndex];

  // Large preview
  const wrap = document.getElementById('card-preview-large');
  wrap.className = 'card-preview-large' + (card ? ` shape-${card.shape}` : '');
  if (card) {
    const src = card.localPreview || card.image_url || '';
    wrap.innerHTML = src
      ? `<img src="${src}" alt="Card ${currentIndex + 1}" />`
      : `<div class="card-preview-empty">No image<br/>Upload below</div>`;
  } else {
    wrap.innerHTML = `<div class="card-preview-empty">No cards yet<br/>Click + Add</div>`;
  }

  // Counter
  document.getElementById('nav-counter').textContent =
    cards.length > 0 ? `${currentIndex + 1} of ${cards.length}` : '0 of 0';

  // Arrows
  document.getElementById('nav-prev').disabled = currentIndex <= 0;
  document.getElementById('nav-next').disabled = currentIndex >= cards.length - 1;

  // Card detail area
  const detail = document.getElementById('card-details');
  if (!card) {
    detail.innerHTML = '';
    return;
  }

  detail.innerHTML = `
    <div class="card-detail-row">
      <label class="field-label">Shape</label>
      <div class="shape-selector">
        <button class="shape-btn ${card.shape === 'rectangle' ? 'active' : ''}"
          onclick="window._builder.setShape('rectangle')">Rect</button>
        <button class="shape-btn ${card.shape === 'square' ? 'active' : ''}"
          onclick="window._builder.setShape('square')">Sq</button>
        <button class="shape-btn ${card.shape === 'circle' ? 'active' : ''}"
          onclick="window._builder.setShape('circle')">Circle</button>
      </div>
    </div>
    <div class="card-detail-row" style="margin-top:8px;">
      <label class="field-label">Display Time (seconds)</label>
      <input type="number" id="card-duration"
        min="3" max="60" step="1"
        value="${card.duration_ms ? Math.round(card.duration_ms / 1000) : 9}"
        style="width:100%;background:var(--surface-2);border:1px solid var(--border-light);
               color:var(--text);border-radius:8px;padding:7px 10px;
               font-family:'Outfit',sans-serif;font-size:13px;outline:none;" />
      <div class="field-hint" style="margin-top:4px;">Default: 9s — increase for text-heavy cards</div>
    </div>
    <div class="card-detail-row" style="margin-top:8px;">
      <label class="field-label">Image</label>
      <label class="upload-btn-green" for="upload-card-img">&#8679; Upload Image</label>
      <input type="file" id="upload-card-img" accept="image/*" style="display:none;" />
    </div>
  `;

  document.getElementById('upload-card-img').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file || !card) return;
    pendingCardFiles[card.id] = file;
    const reader = new FileReader();
    reader.onload = ev => {
      card.localPreview = ev.target.result;
      renderLeft();
      renderGrid();
    };
    reader.readAsDataURL(file);
  });

  // Save duration when changed
  document.getElementById('card-duration').addEventListener('change', e => {
    const secs = parseInt(e.target.value) || 9;
    card.duration_ms = Math.max(3, Math.min(60, secs)) * 1000;
  });
}

/* ── RIGHT PANEL ─────────────────────────────────── */
function renderGrid() {
  const grid = document.getElementById('card-grid');

  // Update count badge
  document.getElementById('card-count').textContent = `${cards.length} cards`;

  if (cards.length === 0) {
    grid.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:40px;
        font-size:13px;color:var(--text-muted);">
        No cards added yet. Click + Add to start.
      </div>`;
    return;
  }

  grid.innerHTML = '';
  cards.forEach((card, idx) => {
    const src  = card.localPreview || card.image_url || '';
    const isSelected = idx === currentIndex;

    const div = document.createElement('div');
    div.className = `grid-card${isSelected ? ' selected' : ''}`;
    div.title = `Card ${idx + 1} — click to select`;

    div.innerHTML = `
      <span class="card-number">${idx + 1}</span>
      ${src
        ? `<img class="grid-card-thumb shape-${card.shape}" src="${src}" alt="Card ${idx + 1}" />`
        : `<div class="grid-card-empty shape-${card.shape}">&#9635;</div>`
      }
      <div class="card-reorder">
        <button class="reorder-btn" title="Move up"
          onclick="event.stopPropagation();window._builder.moveCard(${idx},'up')">&#8679;</button>
        <button class="reorder-btn" title="Move down"
          onclick="event.stopPropagation();window._builder.moveCard(${idx},'down')">&#8681;</button>
      </div>
      <button class="card-remove" title="Remove card"
        onclick="event.stopPropagation();window._builder.removeCardAt(${idx})">&#10005;</button>
    `;

    div.addEventListener('click', () => {
      currentIndex = idx;
      renderLeft();
      renderGrid();
    });

    grid.appendChild(div);
  });
}

/* ── ADD CARD ────────────────────────────────────── */
export function addCard() {
  const id = Date.now();
  cards.push({ id, shape: 'rectangle', image_url: '', r2_key: '', localPreview: '' });
  currentIndex = cards.length - 1;
  renderLeft();
  renderGrid();
}

/* ── REMOVE CARD (current) ───────────────────────── */
export function removeCard() {
  if (cards.length === 0) return;
  removeCardAt(currentIndex);
}

export function removeCardAt(idx) {
  const card = cards[idx];
  if (card) delete pendingCardFiles[card.id];
  cards.splice(idx, 1);
  if (currentIndex >= cards.length) currentIndex = Math.max(0, cards.length - 1);
  renderLeft();
  renderGrid();
}

/* ── MOVE CARD ───────────────────────────────────── */
export function moveCard(idx, dir) {
  const targetIdx = dir === 'up' ? idx - 1 : idx + 1;
  if (targetIdx < 0 || targetIdx >= cards.length) return;
  [cards[idx], cards[targetIdx]] = [cards[targetIdx], cards[idx]];
  currentIndex = targetIdx;
  renderLeft();
  renderGrid();
}

/* ── SET SHAPE (for current card) ────────────────── */
export function setShape(shape) {
  if (!cards[currentIndex]) return;
  cards[currentIndex].shape = shape;
  renderLeft();
  renderGrid();
}

/* ── NAV ─────────────────────────────────────────── */
export function navPrev() {
  if (currentIndex > 0) { currentIndex--; renderLeft(); renderGrid(); }
}
export function navNext() {
  if (currentIndex < cards.length - 1) { currentIndex++; renderLeft(); renderGrid(); }
}

/* ── NEW SHOWCASE ────────────────────────────────── */
export function newShowcase() {
  cards           = [];
  currentIndex    = 0;
  pendingCardFiles = {};
  pendingCoverFile = null;
  pendingMusicFile = null;

  document.getElementById('showcase-title').value = '';
  document.getElementById('cover-name').textContent  = 'No file';
  document.getElementById('music-name').textContent  = 'No file';
  document.getElementById('showcase-url-wrap').classList.remove('visible');

  archive = archive; // keep archive loaded
  currentSlug = generateNextSlug(archive);
  updateSlugDisplay();
  renderLeft();
  renderGrid();
  showStatus('New showcase ready.', 'info');
}

/* ── SAVE HANDLER ────────────────────────────────── */
export async function saveShowcaseHandler() {
  const title = document.getElementById('showcase-title').value.trim();
  if (!title) { showStatus('Please enter a showcase title.', 'warning'); return; }
  if (cards.length === 0) { showStatus('Add at least one card before saving.', 'warning'); return; }

  showStatus('Uploading cards...', 'info');

  try {
    /* 1. Upload new card images */
    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      const file = pendingCardFiles[card.id];
      if (!file) continue; // already in R2 or no image

      const ext      = file.name.split('.').pop().toLowerCase();
      const filename = `card-${String(i + 1).padStart(3, '0')}.${ext}`;

      const res = await fetch(`${WORKER_URL}/card/${currentSlug}/${filename}`, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!res.ok) throw new Error(`Card ${i + 1} upload failed`);
      const { public_url } = await res.json();

      card.image_url = public_url;
      card.r2_key    = `CardShowcase/${currentSlug}/${filename}`;
      delete pendingCardFiles[card.id];
    }

    /* 2. Upload cover image */
    let coverUrl = document.getElementById('cover-preview')?.src || '';
    if (pendingCoverFile) {
      showStatus('Uploading cover image...', 'info');
      const ext = pendingCoverFile.name.split('.').pop().toLowerCase();
      const res = await fetch(`${WORKER_URL}/cover/${currentSlug}`, {
        method: 'PUT',
        headers: {
          'Content-Type': pendingCoverFile.type,
          'X-File-Extension': ext,
        },
        body: pendingCoverFile,
      });
      if (!res.ok) throw new Error('Cover upload failed');
      const { public_url } = await res.json();
      coverUrl = public_url;
      pendingCoverFile = null;
    }

    /* 3. Upload ambient music */
    let musicUrl = '';
    if (pendingMusicFile) {
      showStatus('Uploading ambient music...', 'info');
      const ext = pendingMusicFile.name.split('.').pop().toLowerCase();
      const res = await fetch(`${WORKER_URL}/music/${currentSlug}`, {
        method: 'PUT',
        headers: {
          'Content-Type': pendingMusicFile.type,
          'X-File-Extension': ext,
        },
        body: pendingMusicFile,
      });
      if (!res.ok) throw new Error('Music upload failed');
      const { public_url } = await res.json();
      musicUrl = public_url;
      pendingMusicFile = null;
    }

    /* 4. Build showcase JSON and PUT to R2 */
    showStatus('Saving showcase JSON...', 'info');
    const showcaseData = {
      title,
      cover_url:         coverUrl,
      ambient_music_url: musicUrl,
      cards: cards.map((c, i) => ({
        id:          i + 1,
        shape:       c.shape,
        image_url:   c.image_url,
        r2_key:      c.r2_key,
        duration_ms: c.duration_ms || 9000,
      })),
    };

    const r2Res = await fetch(`${WORKER_URL}/showcase/${currentSlug}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(showcaseData),
    });
    if (!r2Res.ok) throw new Error('R2 showcase save failed');

    /* 5. Upsert to Supabase */
    const showcaseUrl = `${BASE_URL}?showcase=${currentSlug}`;
    const r2Key       = `CardShowcase/${currentSlug}/showcase.json`;

    const { error } = await saveShowcase({
      showcase_slug:    currentSlug,
      title,
      cards:            showcaseData.cards,
      cover_url:        coverUrl,
      ambient_music_url: musicUrl,
      showcase_url:     showcaseUrl,
      r2_key:           r2Key,
      is_active:        true,
    });

    if (error) throw new Error(error.message);

    /* 6. Show URL */
    const urlField = document.getElementById('showcase-url-display');
    const openBtn  = document.getElementById('open-url-btn');
    urlField.value = showcaseUrl;
    openBtn.href   = showcaseUrl;
    document.getElementById('showcase-url-wrap').classList.add('visible');

    // Refresh archive
    archive = await fetchAllShowcases();
    renderArchive();
    showStatus(`Showcase "${title}" saved successfully!`, 'success');

  } catch (err) {
    console.error(err);
    showStatus(`Save failed: ${err.message}`, 'error');
  }
}

/* ── COPY URL ────────────────────────────────────── */
export function copyShowcaseUrl() {
  const val = document.getElementById('showcase-url-display').value;
  if (!val) return;
  navigator.clipboard.writeText(val).then(() => {
    showStatus('URL copied to clipboard!', 'success');
  });
}

/* ── LOAD SHOWCASE FOR EDIT ──────────────────────── */
export async function editShowcase(slug) {
  showStatus('Loading showcase...', 'info');
  const { data, error } = await loadShowcase(slug);
  if (error || !data) { showStatus('Could not load showcase.', 'error'); return; }

  currentSlug  = slug;
  cards        = (data.cards || []).map(c => ({
    id:           c.id || Date.now() + Math.random(),
    shape:        c.shape || 'rectangle',
    image_url:    c.image_url || '',
    r2_key:       c.r2_key || '',
    localPreview: '',
  }));
  currentIndex    = 0;
  pendingCardFiles = {};
  pendingCoverFile = null;
  pendingMusicFile = null;

  document.getElementById('showcase-title').value = data.title || '';
  document.getElementById('cover-name').textContent = data.cover_url ? 'Saved in R2' : 'No file';

  const prev = document.getElementById('cover-preview');
  if (prev && data.cover_url) prev.src = data.cover_url;

  document.getElementById('music-name').textContent = data.ambient_music_url ? 'Saved in R2' : 'No file';

  updateSlugDisplay();
  renderLeft();
  renderGrid();

  const urlField = document.getElementById('showcase-url-display');
  const openBtn  = document.getElementById('open-url-btn');
  if (data.showcase_url) {
    urlField.value = data.showcase_url;
    openBtn.href   = data.showcase_url;
    document.getElementById('showcase-url-wrap').classList.add('visible');
  }

  showStatus(`Showcase "${data.title}" loaded for editing.`, 'info');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ── DELETE SHOWCASE ─────────────────────────────── */
export async function deleteShowcaseHandler(slug) {
  if (!confirm(`Delete showcase "${slug}"? This cannot be undone.`)) return;

  await fetch(`${WORKER_URL}/showcase/${slug}`, { method: 'DELETE' });
  await deleteShowcase(slug);

  archive = await fetchAllShowcases();
  renderArchive();
  showStatus(`Showcase ${slug} deleted.`, 'warning');
}

/* ── TOGGLE ACTIVE ───────────────────────────────── */
export async function toggleActive(slug, current) {
  await toggleShowcaseActive(slug, !current);
  archive = await fetchAllShowcases();
  renderArchive();
}

/* ── RENDER ARCHIVE TABLE ────────────────────────── */
function renderArchive() {
  const wrap = document.getElementById('showcase-archive');
  if (!archive || archive.length === 0) {
    wrap.innerHTML = `
      <p style="color:var(--text-muted);font-size:13px;">No showcases saved yet.</p>`;
    return;
  }

  const rows = archive.map(s => `
    <tr>
      <td><span class="slug-badge">${s.showcase_slug}</span></td>
      <td>${s.title || '—'}</td>
      <td>
        <span style="color:${s.is_active ? 'var(--success)' : 'var(--text-muted)'};">
          ${s.is_active ? '● Active' : '○ Inactive'}
        </span>
      </td>
      <td>${new Date(s.created_at).toLocaleDateString()}</td>
      <td style="display:flex;gap:6px;flex-wrap:wrap;">
        <button class="btn-toolbar" onclick="window._builder.editShowcase('${s.showcase_slug}')">Edit</button>
        <button class="btn-toolbar" onclick="window._builder.toggleActive('${s.showcase_slug}',${s.is_active})">
          ${s.is_active ? 'Deactivate' : 'Activate'}
        </button>
        <a class="btn-toolbar" href="${s.showcase_url || '#'}" target="_blank" rel="noopener">Open ↗</a>
        <button class="btn-toolbar btn-danger"
          onclick="window._builder.deleteShowcaseHandler('${s.showcase_slug}')">Delete</button>
      </td>
    </tr>
  `).join('');

  wrap.innerHTML = `
    <h2>Showcase Archive</h2>
    <table>
      <thead>
        <tr>
          <th>Slug</th>
          <th>Title</th>
          <th>Status</th>
          <th>Created</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

/* ── STATUS MESSAGES ─────────────────────────────── */
function showStatus(msg, type = 'info') {
  const el = document.getElementById('status-msg');
  el.textContent = msg;
  el.className = `show ${type}`;
  if (type === 'success') {
    setTimeout(() => { el.className = ''; }, 4000);
  }
}
