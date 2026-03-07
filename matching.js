// matching.js — creates matches between "requesting" and "selling" posts (BuyerFinder)
// Scoring: 70% title keyword overlap, 30% price closeness
// Labels: Poor / Good / Great / Perfect
(function () {
  console.log("🧠 MATCHING.JS LOADED");

  function supa() { return window.supa; }

  const BF_MATCH_DEBUG = true;

  // Minimum score to save a match to the database at all (Poor threshold)
  const INSERT_THRESHOLD = 10;

  // Stop words — ignored when comparing titles
  const STOP = new Set([
    "a","an","and","or","the","to","for","of","in","on","at","with","from",
    "i","im","its","it","is","are","was","were","be","been","being",
    "this","that","these","those","my","your","yours","our","ours",
    "want","wanted","need","needed","looking","searching","buy","buying","sell","selling",
    "request","requesting","please","help","any","some","stuff","thing","things"
  ]);

  function normText(s) {
    return String(s || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function tokensFromPost(p) {
    // Use title only for primary matching (description is secondary)
    const titleTokens = normText(p.title).split(" ");
    const descTokens  = normText(p.description || "").split(" ");
    // Title words count double by including them twice
    const all = [...titleTokens, ...titleTokens, ...descTokens];
    return all
      .map(t => t.trim())
      .filter(Boolean)
      .filter(t => t.length >= 1)  // allow single letters e.g. "U"
      .filter(t => !STOP.has(t))
      .filter(t => !/^\d+$/.test(t));
  }

  function titleTokensOnly(p) {
    return normText(p.title)
      .split(" ")
      .map(t => t.trim())
      .filter(Boolean)
      .filter(t => t.length >= 1)  // allow single letters e.g. "U"
      .filter(t => !STOP.has(t))
      .filter(t => !/^\d+$/.test(t));
  }

  function parsePrice(p) {
    const raw = String(p.price ?? "").replace(/[^0-9.]/g, "");
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  // Hard gate: must be different users, opposite types, and have real title words
  function hardMatch(a, b) {
    if (!a || !b) return false;
    if (a.user_id && b.user_id && a.user_id === b.user_id) return false;
    if (!["selling","requesting"].includes(a.type)) return false;
    if (!["selling","requesting"].includes(b.type)) return false;
    if (a.type === b.type) return false;
    if (titleTokensOnly(a).length === 0 || titleTokensOnly(b).length === 0) return false;
    return true;
  }

  // Score 0–100:
  //   70 points max from title keyword overlap
  //   30 points max from price closeness (if both prices exist; full 30 if either is missing)
  function scoreMatch(a, b) {
    const A = tokensFromPost(a);
    const B = tokensFromPost(b);
    if (!A.length || !B.length) return 0;

    // --- Title score (70%) ---
    const setA = new Set(titleTokensOnly(a));
    const setB = new Set(titleTokensOnly(b));
    if (setA.size === 0 || setB.size === 0) return 0;

    let overlap = 0;
    for (const w of setA) if (setB.has(w)) overlap++;

    // No title overlap = no match at all
    if (overlap === 0) return 0;

    // Jaccard-style: overlap / union, scaled to 70
    const union = new Set([...setA, ...setB]).size;
    const titleScore = Math.round((overlap / union) * 70);

    // --- Price score (30%) ---
    const pa = parsePrice(a);
    const pb = parsePrice(b);

    let priceScore = 30; // default full points if price info is missing
    if (pa !== null && pb !== null) {
      const diff = Math.abs(pa - pb);
      const larger = Math.max(pa, pb);
      const closeness = Math.max(0, 1 - diff / larger);
      priceScore = Math.round(closeness * 30);
    }

    return Math.min(100, titleScore + priceScore);
  }

  // Convert numeric score to label
  function matchLabel(score) {
    if (score >= 85) return "Perfect";
    if (score >= 65) return "Great";
    if (score >= 40) return "Good";
    return "Poor";
  }

  async function insertMatchRow(buyPost, sellPost, score) {
    const client = supa();
    if (!client) throw new Error("Supabase not ready");

    const row = {
      buy_post_id:  buyPost.id,
      sell_post_id: sellPost.id,
      buyer_id:     buyPost.user_id,
      seller_id:    sellPost.user_id,
      score
    };

    const { error } = await client.from("matches").insert(row);
    if (error) {
      const msg = String(error.message || "").toLowerCase();
      if (String(error.code) === "23505" || msg.includes("duplicate")) return; // already exists
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
      .limit(250);

    if (error || !candidates) {
      console.error("Match query failed:", error);
      return;
    }

    for (const candidate of candidates) {
      if (!hardMatch(post, candidate)) continue;

      const score = scoreMatch(post, candidate);
      if (score < INSERT_THRESHOLD) continue;

      const buy  = post.type === "requesting" ? post : candidate;
      const sell = post.type === "selling"    ? post : candidate;

      if (BF_MATCH_DEBUG) {
        console.log(`BF Match [${matchLabel(score)} · ${score}]:`, buy.title, "↔", sell.title);
      }

      await insertMatchRow(buy, sell, score);
    }
  }

  async function scanAndCreateMatchesForUser() {
    const client = supa();
    const user = window.currentUser;
    if (!client || !user) return;

    if (BF_MATCH_DEBUG) console.log("BF Matching: scan start for user", user.id);

    const { data: mine, error } = await client
      .from("posts")
      .select("id,user_id,title,description,price,type,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(75);

    if (error || !mine) {
      console.error("scanAndCreateMatchesForUser failed:", error);
      return;
    }

    for (const p of mine) {
      if (p.type !== "selling" && p.type !== "requesting") continue;
      await findMatchesForPost(p);
    }

    if (BF_MATCH_DEBUG) console.log("BF Matching: scan complete. Posts scanned:", mine.length);
  }

  // Expose matchLabel so matches.js can use it for display
  window.Matching = { findMatchesForPost, scanAndCreateMatchesForUser, matchLabel };
})();
                              
