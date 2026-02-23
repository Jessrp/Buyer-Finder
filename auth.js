// auth.js — Supabase auth + profile (BuyerFinder)

const SUPABASE_URL = "https://hcgwldsslzkppzgfhwws.supabase.co";
const SUPABASE_ANON = "YOUR_ANON_KEY_HERE";

const supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
window.supa = supa;
window.currentUser = null;
window.currentProfile = null;

document.addEventListener("DOMContentLoaded", () => {
  checkUser();
  supa.auth.onAuthStateChange(() => {
    checkUser();
  });
});

async function checkUser() {
  const { data } = await supa.auth.getUser();
  const user = data?.user || null;
  window.currentUser = user;

  if (!user) return;

  if (window.Posts?.loadPosts) {
    await window.Posts.loadPosts();
  }

  try { await window.Matching?.scanAndCreateMatchesForUser?.(); }
  catch (e) { console.warn("Match scan failed", e); }

  try { await window.Matches?.loadMatches?.(); }
  catch (e) { console.warn("Match load failed", e); }

  try { window.Matches?.initMatchListener?.(); }
  catch (e) { console.warn("Match listener failed", e); }
}

window.Auth = { checkUser };