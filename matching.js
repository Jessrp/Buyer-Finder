// matching.js — creates matches between "requesting" (buyer) and "selling" (seller)
(function () {
  console.error("🧠 MATCHING.JS LOADED (fixed)");

  function getSupa() { return window.supa; }

  const MATCH_THRESHOLD = 30;

  function normText(s) {
    return String(s || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function tokensFromPost(p) {
    const t = normText(p.title);
    const d = normText(p.description);
    const all = (t + " " + d).trim();
    if (!all) return [];
    return all.split(" ").filter(Boolean);
  }

  function parsePrice(p) {
    const raw = String(p.price ?? "").replace(/[^0-9.]/g, "");
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }

  function hardMatch(a, b) {
    if (!a || !b) return false;
    if (a.user_id && b.user_id && a.user_id === b.user_id) return false;

    const ta = a.type, tb = b.type;
    if (ta === tb) return false;

    const okTypes = new Set(["selling", "requesting"]);
    if (!okTypes.has(ta) || !okTypes.has(tb)) return false;

    const pa = parsePrice(a), pb = parsePrice(b);
    if (pa != null && pb != null) {
      const ratio = Math.max(pa, pb) / Math.max(1, Math.min(pa, pb));
      if (ratio > 5) return false;
    }
    return true;
  }

  function scoreMatch(a, b) {
    let score = 0;
    const A = tokensFromPost(a), B = tokensFromPost(b);
    if (A.length && B.length) {
      const setB = new Set(B);
      let overlap = 0;
      for (const w of A) if (setB.has(w)) overlap++;
      score += Math.min(60, overlap * 10);
    }

    const pa = parsePrice(a), pb = parsePrice(b);
    if (pa != null && pb != null) {
      const diff = Math.abs(pa - pb);
      const denom = Math.max(1, Math.max(pa, pb));
      const closeness = 1 - diff / denom;
      if (closeness > 0) score += Math.round(closeness * 20);
    }
    return score;
  }

  async function insertMatchRow(buyPost, sellPost, score) {
    const supa = getSupa();
    if (!supa) throw new Error("Supabase client not ready (window.supa missing)");

    const row = {
      buy_post_id: buyPost.id,
      sell_post_id: sellPost.id,
      buyer_id: buyPost.user_id,
      seller_id: sellPost.user_id,
      score: score,
    };

    const { error } = await supa.from("matches").insert(row);
    if (error) {
      if (String(error.code) === "23505" || String(error.message || "").toLowerCase().includes("duplicate")) return;
      console.error("Match insert error:", error);
    }
  }

  async function findMatchesForPost(post) {
    const supa = getSupa();
    if (!supa) return;
    if (!post || !post.id) return;

    const oppositeType = post.type === "requesting" ? "selling" : "requesting";

    const { data: candidates, error } = await supa
      .from("posts")
      .select("id,user_id,title,description,price,type,created_at")
      .eq("type", oppositeType)
      .order("created_at", { ascending: false })
      .limit(200);

    if (error || !candidates) { console.error("Match query failed:", error); return; }

    for (const candidate of candidates) {
      if (!hardMatch(post, candidate)) continue;
      const score = scoreMatch(post, candidate);
      if (score < MATCH_THRESHOLD) continue;

      const buy = post.type === "requesting" ? post : candidate;
      const sell = post.type === "selling" ? post : candidate;
      await insertMatchRow(buy, sell, score);
    }
  }

  async function scanAndCreateMatchesForUser() {
    const supa = getSupa();
    const user = window.currentUser;
    if (!supa || !user) return;

    const { data: mine, error } = await supa
      .from("posts")
      .select("id,user_id,title,description,price,type,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error || !mine) { console.error("scanAndCreateMatchesForUser failed:", error); return; }

    for (const p of mine) {
      if (p.type !== "selling" && p.type !== "requesting") continue;
      await findMatchesForPost(p);
    }
  }

  window.Matching = { findMatchesForPost, scanAndCreateMatchesForUser };
})();
