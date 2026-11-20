/**
 * 3C Card Showcase — Cloudflare Worker
 * ─────────────────────────────────────────────────────────────
 * Built by Claude (Anthropic) × Chef Anica · 3C Thread To Success
 *
 * ROUTE TABLE
 *   PUBLIC — no sign-in, read only (the public showcase pages need this)
 *     GET    /showcase/:slug           → fetch CardShowcase/{slug}/showcase.json
 *   OWNER ONLY — Supabase GitHub sign-in, then rpc/is_owner must return true
 *     PUT    /showcase/:slug           → save   CardShowcase/{slug}/showcase.json
 *     DELETE /showcase/:slug           → delete CardShowcase/{slug}/showcase.json
 *     PUT    /card/:slug/:filename     → save a card image or video
 *                                        stored at CardShowcase/{slug}/{filename}
 *     PUT    /cover/:slug              → save the cover image
 *                                        (extension in the X-File-Extension header)
 *                                        stored at CardShowcase/{slug}/cover.{ext}
 *     PUT    /music/:slug              → save the ambient audio
 *                                        (extension in the X-File-Extension header)
 *                                        stored at CardShowcase/{slug}/ambient.{ext}
 *   Anything else: 404 (unknown address) or 405 (wrong method).
 *
 * LOGIN
 *   There is no login code in this Worker. The admin pages sign in with GitHub
 *   through Supabase (project "Aurion 3C Mascot") and send the sign-in token as
 *   "Authorization: Bearer <token>". The Worker asks Supabase's is_owner()
 *   function whether that token belongs to the owner. Only "true" passes.
 *   Signing in alone is never enough. If the check cannot be made, the Worker
 *   refuses (fails closed). No secrets and no variables are needed here: the
 *   Supabase address and the anon key below are public by design.
 *
 * STORAGE
 *   R2 binding SHOWCASE_BUCKET → bucket 3c-library-files, folder CardShowcase/
 *   Allowed files:
 *     cover : png, jpg, jpeg, gif, webp
 *     music : mp3, ogg, wav
 *     card  : png, jpg, jpeg, gif, webp, mp4, webm, mov
 *
 * DEPLOY
 *   Pasted into the Cloudflare dashboard editor (Workers & Pages → the Worker →
 *   Edit code). Every version in its Deployments list carries the Dashboard
 *   badge. This file in the repo is the record of what is live; the Worker is
 *   never deployed with Wrangler, so the two methods are never mixed.
 */

const SUPABASE_URL      = 'https://cgxjqsbrditbteqhdyus.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNneGpxc2JyZGl0YnRlcWhkeXVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTExMTY1ODEsImV4cCI6MjA2NjY5MjU4MX0.xUDy5ic-r52kmRtocdcW8Np9-lczjMZ6YKPXc03rIG4';

// Websites allowed to call the owner-only routes from a browser.
const ALLOWED_ORIGINS = ['https://anica-blip.github.io'];

const PUBLIC_BASE = 'https://files.3c-public-library.org/';

// Limits
const MAX_JSON_BYTES   = 1000000;            // one showcase file
const MAX_UPLOAD_BYTES = 90 * 1024 * 1024;   // one media file

/* ── MIME type map ────────────────────────────────── */
const MIME_TYPES = {
  png:  'image/png',
  jpg:  'image/jpeg',
  jpeg: 'image/jpeg',
  gif:  'image/gif',
  webp: 'image/webp',
  mp4:  'video/mp4',
  webm: 'video/webm',
  mov:  'video/quicktime',
  mp3:  'audio/mpeg',
  ogg:  'audio/ogg',
  wav:  'audio/wav',
};

// Which file types each upload route accepts.
const COVER_TYPES = ['png', 'jpg', 'jpeg', 'gif', 'webp'];
const MUSIC_TYPES = ['mp3', 'ogg', 'wav'];
const CARD_TYPES  = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'mp4', 'webm', 'mov'];

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/* ── Main fetch handler ───────────────────────────── */
export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    const originAllowed = !!origin && ALLOWED_ORIGINS.includes(origin);

    // Browser pre-flight: only the allowed website gets an answer.
    if (request.method === 'OPTIONS') {
      if (!originAllowed) return new Response(null, { status: 403 });
      const res = new Response(null, { status: 204 });
      res.headers.set('Access-Control-Allow-Origin', origin);
      res.headers.append('Vary', 'Origin');
      res.headers.set('Access-Control-Allow-Methods', 'GET, PUT, DELETE, OPTIONS');
      res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-File-Extension');
      res.headers.set('Access-Control-Max-Age', '86400');
      return res;
    }

    let isPublic = true;
    let response;

    try {
      const url   = new URL(request.url);
      const route = matchRoute(url.pathname, request.method);
      isPublic = route.isPublic;

      if (!isPublic) {
        // A browser from any other website is refused before anything else.
        if (origin && !originAllowed) throw new HttpError(403, 'Origin not allowed');
        await requireOwner(request);
      }

      response = await route.run(request, env);
    } catch (err) {
      if (err instanceof HttpError) {
        response = json({ error: err.message }, err.status);
      } else {
        console.error('showcase error:', err && err.message ? err.message : err);
        response = json({ error: 'Server error' }, 500);
      }
    }

    return withCors(response, origin, originAllowed, isPublic);
  },
};

/* ── Routing ──────────────────────────────────────── */

function validSlug(slug) {
  return /^[a-z0-9][a-z0-9.\-]{0,63}$/i.test(slug) && !slug.includes('..');
}

function matchRoute(path, method) {
  const allow = (list) => {
    if (!list.includes(method)) throw new HttpError(405, 'Method not allowed');
  };

  let m = path.match(/^\/showcase\/([^/]+)$/);
  if (m) {
    const slug = m[1];
    if (!validSlug(slug)) throw new HttpError(404, 'Not found');
    allow(['GET', 'PUT', 'DELETE']);
    if (method === 'GET')    return { isPublic: true,  run: (req, env) => getShowcase(slug, env) };
    if (method === 'PUT')    return { isPublic: false, run: (req, env) => putShowcase(slug, req, env) };
    return                          { isPublic: false, run: (req, env) => deleteShowcase(slug, env) };
  }

  m = path.match(/^\/card\/([^/]+)\/([^/]+)$/);
  if (m) {
    const slug = m[1];
    let filename;
    try { filename = decodeURIComponent(m[2]); } catch { throw new HttpError(404, 'Not found'); }
    if (!validSlug(slug)) throw new HttpError(404, 'Not found');
    allow(['PUT']);
    return { isPublic: false, run: (req, env) => putCard(slug, filename, req, env) };
  }

  m = path.match(/^\/cover\/([^/]+)$/);
  if (m) {
    const slug = m[1];
    if (!validSlug(slug)) throw new HttpError(404, 'Not found');
    allow(['PUT']);
    return { isPublic: false, run: (req, env) => putCover(slug, req, env) };
  }

  m = path.match(/^\/music\/([^/]+)$/);
  if (m) {
    const slug = m[1];
    if (!validSlug(slug)) throw new HttpError(404, 'Not found');
    allow(['PUT']);
    return { isPublic: false, run: (req, env) => putMusic(slug, req, env) };
  }

  throw new HttpError(404, 'Not found');
}

/* ── Owner check (Supabase is_owner) ──────────────── */

async function requireOwner(request) {
  const header = request.headers.get('Authorization') || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) throw new HttpError(401, 'Sign in required');

  let res;
  try {
    res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/is_owner`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new HttpError(503, 'Sign-in check unavailable');
  }

  if (res.status === 401 || res.status === 403) throw new HttpError(401, 'Sign in required');
  if (!res.ok) throw new HttpError(503, 'Sign-in check unavailable');

  let answer;
  try { answer = await res.json(); } catch { throw new HttpError(503, 'Sign-in check unavailable'); }

  if (answer !== true) throw new HttpError(403, 'Not allowed');
}

/* ── Showcase JSON ────────────────────────────────── */

async function getShowcase(slug, env) {
  const obj = await env.SHOWCASE_BUCKET.get(`CardShowcase/${slug}/showcase.json`);
  if (!obj) throw new HttpError(404, `Showcase not found: ${slug}`);
  return new Response(await obj.text(), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function putShowcase(slug, request, env) {
  const declared = parseInt(request.headers.get('Content-Length') || '0', 10);
  if (declared > MAX_JSON_BYTES) throw new HttpError(413, 'Request too large');

  const body = await request.text();
  if (body.length > MAX_JSON_BYTES) throw new HttpError(413, 'Request too large');

  let value;
  try { value = JSON.parse(body); } catch { throw new HttpError(400, 'Invalid JSON body'); }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new HttpError(400, 'Invalid JSON body');
  }

  const r2Key = `CardShowcase/${slug}/showcase.json`;
  await env.SHOWCASE_BUCKET.put(r2Key, body, {
    httpMetadata: { contentType: 'application/json' },
  });
  return json({ ok: true, r2_key: r2Key });
}

async function deleteShowcase(slug, env) {
  const r2Key = `CardShowcase/${slug}/showcase.json`;
  await env.SHOWCASE_BUCKET.delete(r2Key);
  return json({ ok: true, deleted: r2Key });
}

/* ── Media uploads ────────────────────────────────── */

async function storeBinary(request, env, r2Key, ext, allowedTypes) {
  const mimeType = MIME_TYPES[ext];
  if (!mimeType || !allowedTypes.includes(ext)) {
    throw new HttpError(415, `Allowed files: ${allowedTypes.join(', ')}`);
  }

  const declared = parseInt(request.headers.get('Content-Length') || '0', 10);
  if (declared > MAX_UPLOAD_BYTES) throw new HttpError(413, 'File too large');

  const buffer = await request.arrayBuffer();
  if (buffer.byteLength === 0) throw new HttpError(400, 'Empty file body');
  if (buffer.byteLength > MAX_UPLOAD_BYTES) throw new HttpError(413, 'File too large');

  await env.SHOWCASE_BUCKET.put(r2Key, buffer, {
    httpMetadata: { contentType: mimeType },
  });

  return json({ ok: true, r2_key: r2Key, public_url: `${PUBLIC_BASE}${r2Key}` });
}

function headerExtension(request, fallback) {
  return (request.headers.get('X-File-Extension') || fallback)
    .toLowerCase()
    .replace(/^\./, '');
}

async function putCover(slug, request, env) {
  const ext = headerExtension(request, 'png');
  return storeBinary(request, env, `CardShowcase/${slug}/cover.${ext}`, ext, COVER_TYPES);
}

async function putMusic(slug, request, env) {
  const ext = headerExtension(request, 'mp3');
  return storeBinary(request, env, `CardShowcase/${slug}/ambient.${ext}`, ext, MUSIC_TYPES);
}

async function putCard(slug, filename, request, env) {
  if (!/^[A-Za-z0-9_-][A-Za-z0-9._-]{0,99}$/.test(filename) || filename.includes('..')) {
    throw new HttpError(400, 'Invalid file name');
  }
  const ext = filename.split('.').pop().toLowerCase();
  return storeBinary(request, env, `CardShowcase/${slug}/${filename}`, ext, CARD_TYPES);
}

/* ── CORS / JSON ──────────────────────────────────── */

// Showcase reads are open to every website. Owner-only routes answer only the
// allowed website (and say so with Vary: Origin).
function withCors(response, origin, originAllowed, isPublic) {
  const res = new Response(response.body, response);
  if (isPublic) {
    res.headers.set('Access-Control-Allow-Origin', '*');
  } else if (originAllowed) {
    res.headers.set('Access-Control-Allow-Origin', origin);
    res.headers.append('Vary', 'Origin');
  }
  return res;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
