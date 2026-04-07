/**
 * 3C Card Showcase — Cloudflare Worker
 * ─────────────────────────────────────────────────────────────
 * Built by Claude (Anthropic) × Chef Anica · 3C Thread To Success
 *
 * Binding : SHOWCASE_BUCKET → 3c-library-files (R2)
 * Folder  : CardShowcase/
 *
 * Routes:
 *   GET    /showcase/:slug         → fetch  CardShowcase/{slug}/showcase.json
 *   PUT    /showcase/:slug         → save   CardShowcase/{slug}/showcase.json
 *   DELETE /showcase/:slug         → delete CardShowcase/{slug}/showcase.json
 *   PUT    /card/:slug/:filename   → save binary card image
 *   PUT    /music/:slug            → save ambient audio (X-File-Extension header)
 *   PUT    /cover/:slug            → save cover image   (X-File-Extension header)
 *
 * R2 key conventions:
 *   CardShowcase/{slug}/showcase.json
 *   CardShowcase/{slug}/cover.{ext}
 *   CardShowcase/{slug}/ambient.{ext}
 *   CardShowcase/{slug}/card-001.png
 *   CardShowcase/{slug}/card-002.png  ...
 */

const ALLOWED_ORIGINS = [
  'https://anica-blip.github.io',
];

/* ── CORS headers ─────────────────────────────────── */
function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin)
    ? origin
    : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin':  allowed,
    'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-File-Extension',
  };
}

function respond(body, status, origin, extraHeaders = {}) {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(origin),
      ...extraHeaders,
    },
  });
}

/* ── MIME type map ────────────────────────────────── */
const MIME_TYPES = {
  png:  'image/png',
  jpg:  'image/jpeg',
  jpeg: 'image/jpeg',
  gif:  'image/gif',
  webp: 'image/webp',
  mp3:  'audio/mpeg',
  ogg:  'audio/ogg',
  wav:  'audio/wav',
  mp4:  'video/mp4',
  webm: 'video/webm',
};

function getMimeType(ext) {
  return MIME_TYPES[ext.toLowerCase()] || 'application/octet-stream';
}

/* ── Main fetch handler ───────────────────────────── */
export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const method = request.method.toUpperCase();
    const url    = new URL(request.url);

    /* ── CORS preflight ─────────────────────────── */
    if (method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(origin),
      });
    }

    /* ── Route: /showcase/:slug ──────────────────── */
    const showcaseMatch = url.pathname.match(/^\/showcase\/([a-z0-9.\-]+)$/i);
    if (showcaseMatch) {
      const slug  = showcaseMatch[1];
      const r2Key = `CardShowcase/${slug}/showcase.json`;

      /* GET /showcase/:slug */
      if (method === 'GET') {
        try {
          const obj = await env.SHOWCASE_BUCKET.get(r2Key);
          if (!obj) {
            return respond(
              JSON.stringify({ error: `Showcase not found: ${slug}` }),
              404, origin
            );
          }
          const text = await obj.text();
          return new Response(text, {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders(origin),
            },
          });
        } catch (err) {
          return respond(
            JSON.stringify({ error: 'R2 read failed', detail: err.message }),
            500, origin
          );
        }
      }

      /* PUT /showcase/:slug */
      if (method === 'PUT') {
        try {
          const body = await request.text();
          JSON.parse(body); // validate JSON before storing
          await env.SHOWCASE_BUCKET.put(r2Key, body, {
            httpMetadata: { contentType: 'application/json' },
          });
          return respond(
            JSON.stringify({ ok: true, r2_key: r2Key }),
            200, origin
          );
        } catch (err) {
          const isJsonErr = err instanceof SyntaxError;
          return respond(
            JSON.stringify({
              error:  isJsonErr ? 'Invalid JSON body' : 'R2 write failed',
              detail: err.message,
            }),
            isJsonErr ? 400 : 500,
            origin
          );
        }
      }

      /* DELETE /showcase/:slug */
      if (method === 'DELETE') {
        try {
          await env.SHOWCASE_BUCKET.delete(r2Key);
          return respond(
            JSON.stringify({ ok: true, deleted: r2Key }),
            200, origin
          );
        } catch (err) {
          return respond(
            JSON.stringify({ error: 'R2 delete failed', detail: err.message }),
            500, origin
          );
        }
      }

      return respond(
        JSON.stringify({ error: 'Method not allowed' }),
        405, origin
      );
    }

    /* ── Route: /card/:slug/:filename ────────────── */
    const cardMatch = url.pathname.match(/^\/card\/([a-z0-9.\-]+)\/(.+)$/i);
    if (cardMatch) {
      const slug     = cardMatch[1];
      const filename = decodeURIComponent(cardMatch[2]);

      if (method !== 'PUT') {
        return respond(
          JSON.stringify({ error: 'Only PUT is supported on /card/:slug/:filename' }),
          405, origin
        );
      }

      try {
        const ext        = filename.split('.').pop().toLowerCase();
        const mimeType   = getMimeType(ext);
        const r2Key      = `CardShowcase/${slug}/${filename}`;
        const publicUrl  = `https://files.3c-public-library.org/${r2Key}`;
        const arrayBuffer = await request.arrayBuffer();

        if (arrayBuffer.byteLength === 0) {
          return respond(JSON.stringify({ error: 'Empty file body' }), 400, origin);
        }

        await env.SHOWCASE_BUCKET.put(r2Key, arrayBuffer, {
          httpMetadata: { contentType: mimeType },
        });

        return respond(
          JSON.stringify({ ok: true, r2_key: r2Key, public_url: publicUrl }),
          200, origin
        );
      } catch (err) {
        return respond(
          JSON.stringify({ error: 'Card upload failed', detail: err.message }),
          500, origin
        );
      }
    }

    /* ── Route: /music/:slug ─────────────────────── */
    const musicMatch = url.pathname.match(/^\/music\/([a-z0-9.\-]+)$/i);
    if (musicMatch) {
      const slug = musicMatch[1];

      if (method !== 'PUT') {
        return respond(
          JSON.stringify({ error: 'Only PUT is supported on /music/:slug' }),
          405, origin
        );
      }

      try {
        const ext       = (request.headers.get('X-File-Extension') || 'mp3')
          .toLowerCase().replace(/^\./, '');
        const r2Key     = `CardShowcase/${slug}/ambient.${ext}`;
        const mimeType  = getMimeType(ext);
        const publicUrl = `https://files.3c-public-library.org/${r2Key}`;
        const arrayBuffer = await request.arrayBuffer();

        if (arrayBuffer.byteLength === 0) {
          return respond(JSON.stringify({ error: 'Empty file body' }), 400, origin);
        }

        await env.SHOWCASE_BUCKET.put(r2Key, arrayBuffer, {
          httpMetadata: { contentType: mimeType },
        });

        return respond(
          JSON.stringify({ ok: true, r2_key: r2Key, public_url: publicUrl }),
          200, origin
        );
      } catch (err) {
        return respond(
          JSON.stringify({ error: 'Music upload failed', detail: err.message }),
          500, origin
        );
      }
    }

    /* ── Route: /cover/:slug ─────────────────────── */
    const coverMatch = url.pathname.match(/^\/cover\/([a-z0-9.\-]+)$/i);
    if (coverMatch) {
      const slug = coverMatch[1];

      if (method !== 'PUT') {
        return respond(
          JSON.stringify({ error: 'Only PUT is supported on /cover/:slug' }),
          405, origin
        );
      }

      try {
        const ext       = (request.headers.get('X-File-Extension') || 'png')
          .toLowerCase().replace(/^\./, '');
        const r2Key     = `CardShowcase/${slug}/cover.${ext}`;
        const mimeType  = getMimeType(ext);
        const publicUrl = `https://files.3c-public-library.org/${r2Key}`;
        const arrayBuffer = await request.arrayBuffer();

        if (arrayBuffer.byteLength === 0) {
          return respond(JSON.stringify({ error: 'Empty file body' }), 400, origin);
        }

        await env.SHOWCASE_BUCKET.put(r2Key, arrayBuffer, {
          httpMetadata: { contentType: mimeType },
        });

        return respond(
          JSON.stringify({ ok: true, r2_key: r2Key, public_url: publicUrl }),
          200, origin
        );
      } catch (err) {
        return respond(
          JSON.stringify({ error: 'Cover upload failed', detail: err.message }),
          500, origin
        );
      }
    }

    /* ── No route matched ───────────────────────── */
    return respond(
      JSON.stringify({
        error: 'Not found',
        routes: [
          'GET/PUT/DELETE /showcase/:slug',
          'PUT /card/:slug/:filename',
          'PUT /music/:slug',
          'PUT /cover/:slug',
        ],
      }),
      404, origin
    );
  },
};
