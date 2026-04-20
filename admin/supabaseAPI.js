/**
 * 3C Card Showcase — Supabase API
 * ─────────────────────────────────────────────────────
 * Built by Claude (Anthropic) × Chef Anica · 3C Thread To Success
 *
 * Table: card_showcases
 * Columns:
 *   id, showcase_slug, title, cards (jsonb),
 *   cover_url, ambient_music_url,
 *   showcase_url, r2_key,
 *   is_active, created_at, updated_at
 */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

/* ── CONNECTION ─────────────────────────────────────── */
const SUPABASE_URL = window.APP_CONFIG.SUPABASE_URL;
const SUPABASE_KEY = window.APP_CONFIG.SUPABASE_ANON_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/* ── Fetch all showcases ────────────────────────────── */
export async function fetchAllShowcases() {
  const { data, error } = await supabase
    .from('card_showcases')
    .select('showcase_slug, title, cover_url, showcase_url, r2_key, is_active, created_at')
    .order('id', { ascending: false });

  if (error) { console.error('supabaseAPI.fetchAllShowcases:', error.message); return []; }
  return data || [];
}

/* ── Generate next slug ─────────────────────────────── */
export function generateNextSlug(archive) {
  const used = archive.map(s => {
    const m = s.showcase_slug.match(/^showcase\.(\d+)$/);
    return m ? parseInt(m[1]) : null;
  }).filter(n => n !== null);

  let n = 1;
  while (used.includes(n)) n++;
  return `showcase.${String(n).padStart(2, '0')}`;
}

/* ── Save showcase (upsert) ─────────────────────────── */
/*
  row shape:
  {
    showcase_slug:    'showcase.01',
    title:            'Quote Cards',
    cards:            [...],
    cover_url:        'https://...',
    ambient_music_url:'https://...',
    showcase_url:     'https://anica-blip.github.io/3c-card-showcase/landing.html?showcase=showcase.01',
    r2_key:           'CardShowcase/showcase.01/showcase.json',
    is_active:        true,
  }
*/
export async function saveShowcase(row) {
  const { data, error } = await supabase
    .from('card_showcases')
    .upsert([{ ...row, updated_at: new Date().toISOString() }], {
      onConflict: 'showcase_slug',
    })
    .select();

  if (error) console.error('supabaseAPI.saveShowcase:', error.message);
  return { data, error };
}

/* ── Update cover URL only (used by landing-upload) ─── */
// Keeps Supabase in sync when the cover is replaced via the landing upload tool
// without going through the full builder save flow.
export async function updateShowcaseCoverUrl(slug, coverUrl) {
  const { error } = await supabase
    .from('card_showcases')
    .update({ cover_url: coverUrl, updated_at: new Date().toISOString() })
    .eq('showcase_slug', slug);

  if (error) console.error('supabaseAPI.updateShowcaseCoverUrl:', error.message);
  return { error };
}

/* ── Delete showcase ────────────────────────────────── */
export async function deleteShowcase(slug) {
  const { error } = await supabase
    .from('card_showcases')
    .delete()
    .eq('showcase_slug', slug);

  if (error) console.error('supabaseAPI.deleteShowcase:', error.message);
  return { error };
}

/* ── Toggle active state ────────────────────────────── */
export async function toggleShowcaseActive(slug, isActive) {
  const { error } = await supabase
    .from('card_showcases')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('showcase_slug', slug);

  if (error) console.error('toggleShowcaseActive:', error.message);
  return { error };
}

/* ── Load single showcase for editing ──────────────── */
export async function loadShowcase(slug) {
  const { data, error } = await supabase
    .from('card_showcases')
    .select('*')
    .eq('showcase_slug', slug)
    .single();

  if (error) console.error('supabaseAPI.loadShowcase:', error.message);
  return { data, error };
}
