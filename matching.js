// matching.js
// Handles automatic buy/sell matching

const MATCH_THRESHOLD = 50;

// HARD FILTERS
function hardMatch(a, b) {
  if (a.type === b.type) return false;
  if (a.category !== b.category) return false;

  // price overlap
  if (a.type === "buy") {
    if (b.price_min > a.price_max) return false;
  } else {
    if (a.price_min > b.price_max) return false;
  }

  return true;
}

// SOFT SCORING
function scoreMatch(a, b) {
  let score = 0;

  if (a.category === b.category) score += 30;

  const wordsA = (a.keywords || "").toLowerCase().split(/\s+/);
  const wordsB = (b.keywords || "").toLowerCase().split(/\s+/);

  const overlap = wordsA.filter(w => wordsB.includes(w)).length;
  score += overlap * 10;

  return score;
}

// CREATE MATCH
async function createMatch(buy, sell, score) {
  const { error } = await supa.from("matches").insert({
    buy_post_id: buy.id,
    sell_post_id: sell.id,
    buyer_id: buy.user_id,
    seller_id: sell.user_id,
    score
  });

  if (error && !error.message.includes("duplicate")) {
    console.error("Match insert error:", error);
  }
}

// MAIN ENTRY POINT
export async function findMatchesForPost(post) {
  const oppositeType = post.type === "buy" ? "sell" : "buy";

  const { data: candidates, error } = await supa
    .from("posts")
    .select("*")
    .eq("type", oppositeType)
    .eq("category", post.category);

  if (error || !candidates) {
    console.error("Match query failed:", error);
    return;
  }

  for (const candidate of candidates) {
    if (!hardMatch(post, candidate)) continue;

    const score = scoreMatch(post, candidate);
    if (score < MATCH_THRESHOLD) continue;

    const buy = post.type === "buy" ? post : candidate;
    const sell = post.type === "sell" ? post : candidate;

    await createMatch(buy, sell, score);
  }
}
