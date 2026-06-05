// matching.js — BuyrFindr smart matching
// Philosophy: quality over quantity. A match should mean something.
// Requirements to even attempt scoring:
//   1. Opposite types (one selling, one requesting)
//   2. Different users
//   3. Same or related category (if both have one set)
//   4. At least 1 meaningful title word in common
// Scoring: 60% title overlap, 20% category match, 20% price closeness
// Labels: Poor / Good / Great / Perfect
// Minimum score to save: 35 (no noise matches)

(function () {
  console.log("🧠 MATCHING.JS LOADED");

  function supa() { return window.supa; }

  const BF_MATCH_DEBUG = true;

  // Minimum score to save to DB — raised to cut out noise
  const INSERT_THRESHOLD = 35;

  // Stop words
  const STOP = new Set([
    "a","an","and","or","the","to","for","of","in","on","at","with","from",
    "i","im","its","it","is","are","was","were","be","been","being",
    "this","that","these","those","my","your","yours","our","ours",
    "want","wanted","need","needed","looking","searching","buy","buying","sell","selling",
    "request","requesting","please","help","any","some","stuff","thing","things",
    "iso","wtb","wts","used","good","great","nice","condition","new","old",
    "get","got","have","has","had","would","could","can","will","just","also"
  ]);

  // Category groups — categories in the same group can match each other
  // Categories NOT in the same group will NOT match at all
  const CAT_GROUPS = {
    tech:        ["tech", "appliances"],
    gaming:      ["gaming"],
    vehicles:    ["vehicles"],
    furniture:   ["furniture"],
    tools:       ["tools"],
    clothing:    ["clothing"],
    sports:      ["sports", "outdoors"],
    music:       ["music"],
    baby:        ["baby", "toys"],
    pets:        ["pets"],
    kitchen:     ["kitchen", "appliances"],
    outdoors:    ["outdoors", "sports"],
    appliances:  ["appliances", "tech", "kitchen"],
    toys:        ["toys", "baby"],
    other:       ["other"],
  };

  function categoriesCompatible(catA, catB) {
    // If either post has no category set, allow matching (don't block uncategorized posts)
    if (!catA || !catB) return true;
    const a = catA.toLowerCase().trim();
    const b = catB.toLowerCase().trim();
    // Exact match always ok
    if (a === b) return true;
    // Check if they're in the same group
    const groupA = CAT_GROUPS[a] || [a];
    return groupA.includes(b);
  }

  function normText(s) {
    return String(s || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function titleTokens(p) {
    return normText(p.title)
      .split(" ")
      .map(t => stem(t.trim()))
      .filter(t => t.length >= 2)
      .filter(t => !STOP.has(t))
      .filter(t => !/^\d+$/.test(t));
  }

  function descTokens(p) {
    return normText(p.description || "")
      .split(" ")
      .map(t => stem(t.trim()))
      .filter(t => t.length >= 2)
      .filter(t => !STOP.has(t))
      .filter(t => !/^\d+$/.test(t));
  }

  // Simple suffix stemmer — handles plurals and common suffixes
  function stem(word) {
    if (word.length < 4) return word;
    if (word.endsWith("ing")) return word.slice(0, -3);
    if (word.endsWith("ings")) return word.slice(0, -4);
    if (word.endsWith("tion")) return word.slice(0, -4);
    if (word.endsWith("tions")) return word.slice(0, -5);
    if (word.endsWith("er")) return word.slice(0, -2);
    if (word.endsWith("ers")) return word.slice(0, -3);
    if (word.endsWith("ed")) return word.slice(0, -2);
    if (word.endsWith("ies")) return word.slice(0, -3) + "y";
    if (word.endsWith("es") && word.length > 4) return word.slice(0, -2);
    if (word.endsWith("s") && word.length > 3) return word.slice(0, -1);
    return word;
  }

  function parsePrice(p) {
    const raw = String(p.price ?? "").replace(/[^0-9.]/g, "");
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  // Hard gate — must pass ALL of these before we even attempt scoring
  function hardMatch(a, b) {
    if (!a || !b) return false;
    // Must be different users
    if (a.user_id && b.user_id && a.user_id === b.user_id) return false;
    // Must be valid opposite types
    if (a.type !== "requesting" && a.type !== "selling") return false;
    if (b.type !== "requesting" && b.type !== "selling") return false;
    if (a.type === b.type) return false;
    // Must have real title words
    if (titleTokens(a).length === 0 || titleTokens(b).length === 0) return false;
    // Categories must be compatible
    if (!categoriesCompatible(a.category, b.category)) return false;
    return true;
  }

  // Score 0–100:
  //   60 points — title keyword overlap (Jaccard)
  //   20 points — category exact match bonus
  //   20 points — price closeness
  function scoreMatch(a, b) {
    const tA = titleTokens(a);
    const tB = titleTokens(b);
    if (!tA.length || !tB.length) return 0;

    // ── Title score (60 pts) ──────────────────────────────
    const setA = new Set(tA);
    const setB = new Set(tB);
    let overlap = 0;
    for (const w of setA) if (setB.has(w)) overlap++;

    // Zero title overlap = zero score, no match
    if (overlap === 0) return 0;

    const union = new Set([...setA, ...setB]).size;
    const titleScore = Math.round((overlap / union) * 60);

    // ── Description bonus (up to 10 extra pts on top of title) ──
    const dA = new Set(descTokens(a));
    const dB = new Set(descTokens(b));
    let descOverlap = 0;
    for (const w of dA) if (dB.has(w)) descOverlap++;
    const descBonus = Math.min(10, descOverlap * 2);

    // ── Category score (20 pts) ───────────────────────────
    let catScore = 0;
    const catA = (a.category || "").toLowerCase().trim();
    const catB = (b.category || "").toLowerCase().trim();
    if (catA && catB) {
      if (catA === catB) catScore = 20;          // exact match
      else if (categoriesCompatible(catA, catB)) catScore = 10; // related
    } else {
      catScore = 10; // one or both uncategorized — partial credit
    }

    // ── Price score (20 pts) ──────────────────────────────
    const pa = parsePrice(a);
    const pb = parsePrice(b);
    let priceScore = 10; // default partial if missing
    if (pa !== null && pb !== null) {
      const diff = Math.abs(pa - pb);
      const larger = Math.max(pa, pb);
      // Within 20% of each other = full points
      const closeness = Math.max(0, 1 - diff / larger);
      priceScore = Math.round(closeness * 20);
    }

    const total = titleScore + descBonus + catScore + priceScore;
    return Math.min(100, total);
  }

  function matchLabel(score) {
    if (score >= 85) return "Perfect";
    if (score >= 65) return "Great";
    if (score >= 45) return "Good";
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
      if (String(error.code) === "23505" || msg.includes("duplicate")) return;
      console.error("Match insert error:", error);
    }
  }

  async function findMatchesForPost(post) {
    const client = supa();
    if (!client || !post?.id) return;

    const oppositeType = post.type === "requesting" ? "selling" : "requesting";

    // Only fetch posts in the same or compatible category if post has a category
    let query = client
      .from("posts")
      .select("id,user_id,title,description,price,type,category,created_at")
      .eq("type", oppositeType)
      .or("sold.is.null,sold.eq.false")
      .eq("frozen", false)
      .order("created_at", { ascending: false })
      .limit(100); // reduced from 250 — quality over quantity

    // If post has a category, filter candidates to compatible categories only
    if (post.category) {
      const cat = post.category.toLowerCase().trim();
      const compatible = CAT_GROUPS[cat] || [cat];
      if (compatible.length === 1) {
        query = query.eq("category", compatible[0]);
      } else {
        query = query.in("category", compatible);
      }
    }

    const { data: candidates, error } = await query;

    if (error || !candidates) {
      console.error("Match query failed:", error);
      return;
    }

    let matchCount = 0;
    for (const candidate of candidates) {
      if (!hardMatch(post, candidate)) continue;

      const score = scoreMatch(post, candidate);
      if (score < INSERT_THRESHOLD) continue;

      const buy  = post.type === "requesting" ? post : candidate;
      const sell = post.type === "selling"    ? post : candidate;

      if (BF_MATCH_DEBUG) {
        console.log(`✅ BF Match [${matchLabel(score)} · ${score}]: "${buy.title}" ↔ "${sell.title}"`);
      }

      await insertMatchRow(buy, sell, score);
      matchCount++;
    }

    if (BF_MATCH_DEBUG) console.log(`BF Matching: ${matchCount} matches found for "${post.title}"`);
  }

  async function scanAndCreateMatchesForUser() {
    const client = supa();
    const user = window.currentUser;
    if (!client || !user) return;

    if (BF_MATCH_DEBUG) console.log("BF Matching: scan start for user", user.id);

    const { data: mine, error } = await client
      .from("posts")
      .select("id,user_id,title,description,price,type,category,created_at")
      .eq("user_id", user.id)
      .or("sold.is.null,sold.eq.false")
      .eq("frozen", false)
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

    if (BF_MATCH_DEBUG) console.log("BF Matching: scan complete. Posts scanned:", mine.length);
  }

  window.Matching = { findMatchesForPost, scanAndCreateMatchesForUser, matchLabel };
})();
