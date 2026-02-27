// matching.js — creates matches between "requesting" and "selling" posts (BuyerFinder schema)
// Non-module script: attaches to window.Matching
(function () {
  console.error("🔥 MATCHING.JS LOADED (BF schema)");

  function supa() {
    return window.supa;
  }

  const BF_MATCH_DEBUG = true;

  // Inserts stored matches at/above this score
  const INSERT_THRESHOLD = 70;

  const STOP = new Set([
    "a","an","and","or","the","to","for","of","in","on","at","with","from",
    "i","im","its","it","is","are","was","were","be","been","being",
    "this","that","these","those","my","your","yours","our","ours",
    "want","wanted","need","needed","looking","searching","buy","buying","sell","selling",
    "request","requesting","please","help","any","some","stuff","thing","things"
  ]);

  // Keep a small set of 2-char tokens that matter in marketplace items
  const ALLOW2 = new Set(["tv","pc","vr","ps","xs","xl","sr","hd","4k"]);

  function normText(s) {
    return String(s || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function keepToken(t) {
    if (!t) return false;
    if (STOP.has(t)) return false;
    if (/^\d+$/.test(t)) return false; // pure numbers are rarely useful alone

    // Keep normal tokens
    if (t.length >= 3) return true;

    // Keep 2-char tokens only if they contain a digit (e.g. "4k") OR are in allowlist
    if (t.length === 2) {
      if (/\d/.test(t)) return true;
      if (ALLOW2.has(t)) return true;
      return false;
    }

    return false;
  }

  function tokensFromPost(p) {
    const all = (normText(p.title) + " " + normText(p.description)).trim();
    if (!all) return [];
    return all
      .split(" ")
      .map(t => t.trim())
      .filter(Boolean)
      .filter(keepToken);
  }

  function tokensFromTitle(p) {
    const t = normText(p?.title);
    if (!t) return [];
    return t
      .split(" ")
      .map(x => x.trim())
      .filter(Boolean)
      .filter(keepToken);
  }

  function parsePrice(p) {
    const raw = String(p.price ?? "").replace(/[^0-9.]/g, "");
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }

  function jaccard(aTokens, bTokens) {
    if (!aTokens.length || !bTokens.length) return 0;
    const A = new Set(aTokens);
    const B = new Set(bTokens);
    let inter = 0;
    for (const t of A) if (B.has(t)) inter++;
    const union = A.size + B.size - inter;
    return union ? inter / union : 0;
  }

  function hardMatch(a, b) {
    if (!a || !b) return false;

    // NO self matching (per your request)
    if (a.user_id && b.user_id && a.user_id === b.user_id) return false;

    const ok = new Set(["selling", "requesting"]);
    if (!ok.has(a.type) || !ok.has(b.type)) return false;
    if (a.type === b.type) return false;

    const A = tokensFromPost(a);
    const B = tokensFromPost(b);
    if (A.length === 0 || B.length === 0) return false;

    // crude price sanity: reject ridiculous ratios when both prices exist
    const pa = parsePrice(a), pb = parsePrice(b);
    if (pa != null && pb != null) {
      const ratio = Math.max(pa, pb) / Math.max(1, Math.min(pa, pb));
      if (ratio > 5) return false;
    }

    return true;
  }

  function scoreMatch(a, b) {
    const A = tokensFromPost(a);
    const B = tokensFromPost(b);
    if (!A.length || !B.length) return 0;

    const ta = normText(a.title);
    const tb = normText(b.title);

    // ✅ HARD 100%: exact normalized title match
    if (ta && tb && ta === tb) return 100;

    const setB = new Set(B);
    let overlap = 0;
    for (const w of A) if (setB.has(w)) overlap++;

    // no overlap = no match (keeps spam down)
    if (overlap === 0) return 0;

    let score = 0;

    // overlap weight (less stingy than overlap*18)
    score += Math.min(80, overlap * 22);

    // title similarity bonuses
    if (ta && tb) {
      if (ta.includes(tb) || tb.includes(ta)) {
        const jt = jaccard(tokensFromTitle(a), tokensFromTitle(b));
        if (jt >= 0.80) return 98; // basically perfect
        score += 18;
      } else {
        const jt = jaccard(tokensFromTitle(a), tokensFromTitle(b));
        if (jt > 0.6) score += 14;
        else if (jt > 0.4) score += 8;
      }
    }

    // price closeness booster (only boosts, never creates matches)
    const pa = parsePrice(a), pb = parsePrice(b);
    if (pa != null && pb != null) {
      const diff = Math.abs(pa - pb);
      const denom = Math.max(1, Math.max(pa, pb));
      const closeness = 1 - diff / denom;
      if (closeness > 0) score += Math.round(closeness * 20);
    }

    // description similarity booster
    const jd = jaccard(A, B);
    if (jd > 0.45) score += 8;
    else if (jd > 0.30) score += 4;

    return Math.min(100, score);
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
      const msg = String(error.message || "").toLowerCase();
      if (String(error.code) === "23505" || msg.includes("duplicate")) return;
      console.error("Match insert error:", error, "row:", row);
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

      if (BF_MATCH_DEBUG) {
        console.log("BF Matching: scored", {
          a: post.title,
          b: candidate.title,
          score,
          aTokens: tokensFromPost(post),
          bTokens: tokensFromPost(candidate),
        });
      }

      if (score < INSERT_THRESHOLD) continue;

      const buy = post.type === "requesting" ? post : candidate;
      const sell = post.type === "selling" ? post : candidate;

      if (BF_MATCH_DEBUG) {
        console.log("BF Matching: insert", { buy: buy.title, sell: sell.title, score });
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

    if (BF_MATCH_DEBUG) console.log("BF Matching: scan complete. Mine:", mine.length);
  }

  window.Matching = { findMatchesForPost, scanAndCreateMatchesForUser };
})();
