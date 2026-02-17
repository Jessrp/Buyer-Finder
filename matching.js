// matching.js — creates matches between "requesting" and "selling" posts (BuyerFinder schema)
// Non-module script: attaches to window.Matching
(function () {
  console.error("🧠 MATCHING.JS LOADED (BF schema)");

  function supa() { return window.supa; }

  const MATCH_THRESHOLD = 30; // keyword/price score threshold

  function normText(s) {
    return String(s || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function tokensFromPost(p) {
    const all = (normText(p.title) + " " + normText(p.description)).trim();
    return all ? all.split(" ").filter(Boolean) : [];
  }

  function parsePrice(p) {
    const raw = String(p.price ?? "").replace(/[^0-9.]/g, "");
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }

  function hardMatch(a, b) {
    if (!a || !b) return false;
    if (a.user_id && b.user_id && a.user_id === b.user_id) return false;

    const ok = new Set(["selling", "requesting"]);
    if (!ok.has(a.type) || !ok.has(b.type)) return false;
    if (a.type === b.type) return false;

    // crude price sanity: reject ridiculous ratios when both prices exist
    const pa = parsePrice(a), pb = parsePrice(b);
    if (pa != null && pb != null) {
      const ratio = Math.max(pa, pb) / Math.max(1, Math.min(pa, pb));
      if (ratio > 5) return false;
    }
    return true;
  }

  function scoreMatch(a, b) {
    let score = 0;

    // keyword overlap
    const A = tokensFromPost(a);
    const B = tokensFromPost(b);
    if (A.length && B.length) {
      const setB = new Set(B);
      let overlap = 0;
      for (const w of A) if (setB.has(w)) overlap++;
      score += Math.min(60, overlap * 10);
    }

    // price closeness
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
    const client = supa();
    if (!client) throw new Error("window.supa is missing (Supabase client not initialized)");

    const row = {
      buy_post_id: buyPost.id,
      sell_post_id: sellPost.id,
      buyer_id: buyPost.user_id,
      seller_id: sellPost.user_id,
      score
    };

    const { error } = await client.from("matches").insert(row);
    if (error) {
      // ignore duplicates if you have a unique constraint
      const msg = String(error.message || "").toLowerCase();
      if (String(error.code) === "23505" || msg.includes("duplicate")) return;
      console.error("Match insert error:", error);
    }
  }

  async function findMatchesForPost(post) {
    const client = supa();
    if (!client || !post?.id) return;

    const oppositeType = post.type === "requesting" ? "selling" : "requesting";

    const { data: candidates, error } = await client
      .from("posts")
      .select("id,user_id,title,description,price,type,created_at")
      .eq("type", oppositeType)
      .order("created_at", { ascending: false })
      .limit(200);

    if (error || !candidates) {
      console.error("Match query failed:", error);
      return;
    }

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
    const client = supa();
    const user = window.currentUser;
    if (!client || !user) return;

    const { data: mine, error } = await client
      .from("posts")
      .select("id,user_id,title,description,price,type,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error || !mine) {
      console.error("scanAndCreateMatchesForUser failed:", error);
      return;
    }

    for (const p of mine) {
      if (p.type !== "selling" && p.type !== "requesting") continue;
      await findMatchesForPost(p);
    }
  }

  window.Matching = { findMatchesForPost, scanAndCreateMatchesForUser };
})();
