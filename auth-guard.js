/**
 * auth-guard.js — 3C Tools Auth Guard v1.0
 * ─────────────────────────────────────────────────────────────────────────────
 * Reusable across ALL anica-blip GitHub Pages repos.
 * Session is shared — log in once, protected everywhere under anica-blip.github.io
 *
 * HOW TO ADD TO ANY PROTECTED PAGE:
 * Paste these two lines at the very top of <head> — before ALL other scripts:
 *
 *   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
 *   <script src="/3C-Solo-Card-Showcase/auth-guard.js"></script>
 *
 * For pages inside subfolders (e.g. /admin/), adjust the path:
 *   <script src="../auth-guard.js"></script>
 *
 * For other repos, update AUTH_CONFIG.loginPage to that repo's login.html URL.
 * ─────────────────────────────────────────────────────────────────────────────
 * Designed and Built with ❤️ by Claude (Anthropic) × Chef Anica
 * 3C Thread To Success™ Cooking Lab 🧪👨‍🍳
 */

// ─── CONFIG — update loginPage per repo ──────────────────────────────────────
const AUTH_CONFIG = {
  supabaseUrl:   'https://cgxjqsbrditbteqhdyus.supabase.co',
  supabaseKey:   'YOUR_SUPABASE_ANON_KEY',   // ← Supabase → Settings → API → anon public
  allowedEmails: ['YOUR_GITHUB_EMAIL'],        // ← Your GitHub account email address
  loginPage:     'https://anica-blip.github.io/3C-Solo-Card-Showcase/login.html'
};
// ─────────────────────────────────────────────────────────────────────────────

// Immediately hide page to prevent flash of protected content
document.documentElement.style.visibility = 'hidden';

(async function guardPage() {
  try {
    const client = supabase.createClient(AUTH_CONFIG.supabaseUrl, AUTH_CONFIG.supabaseKey);
    const { data: { session } } = await client.auth.getSession();

    // No session — send to login
    if (!session) {
      redirectToLogin();
      return;
    }

    // Session exists — check whitelist
    const email = session.user?.email;
    if (!AUTH_CONFIG.allowedEmails.includes(email)) {
      // Valid GitHub login but not authorised — sign out and redirect
      await client.auth.signOut();
      redirectToLogin('unauthorized');
      return;
    }

    // ✅ Authorised — reveal the page
    document.documentElement.style.visibility = 'visible';

  } catch (err) {
    console.error('[auth-guard] Error:', err);
    redirectToLogin();
  }

  function redirectToLogin(reason) {
    const next = encodeURIComponent(window.location.href);
    const sep  = AUTH_CONFIG.loginPage.includes('?') ? '&' : '?';
    window.location.replace(
      `${AUTH_CONFIG.loginPage}${sep}next=${next}${reason ? '&reason=' + reason : ''}`
    );
  }
})();
