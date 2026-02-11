// matching.js
console.error("🧠 MATCHING.JS LOADED");

(function () {
  // Tiny, practical matcher for BuyerFinder:
  // - matches requesting <-> selling
  // - scores by keyword overlap in title/description
  // - no category/price_min/price_max fantasy fields

  const STOPWORDS = new Set([
    "the","a","an","and","or","but","if","then","else","for","to","of","in","on","at","with",
    "i","me","my","we","our","you","your","is","are","was","were","be","been","it","this","that",
    "from","by","as","not","no","yes","do","does","did"
  ]);

  function tokenize(text) {
    return String(text || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter(w => w.length >= 3 && !STOPWORDS.has(w));
  }

  function scorePosts(a, b) {
    const aWords = new Set([...tokenize(a.title), ...tokenize(a.description)]);
    const bWords = new Set([...tokenize(b.title), ...tokenize(b.description)]);

    let overlap = 0;
    for (const w of aWords) if (bWords.has(w)) overlap++;

    // Heavier weight if title overlaps (more meaningful)
    const aTitle = new Set(tokenize(a.title));
    const bTitle = new Set(tokenize(b.title));
    let titleOverlap = 0;
    for (const w of aTitle) if (bTitle.has(w)) titleOverlap++;

    return overlap * 10 + titleOverlap * 15;
  }

  function oppositeType(type) {
    // your DB uses: "selling" / "requesting"
    if (type === "selling") return "requesting";
    if (type === "requesting") return "selling";
    return null;
  }

  function computeMatches({ allPosts, userId, minScore = 25, maxPerMyPost = 10 }) {
    if (!Array.isArray(allPosts) || !userId) return [];

    const mine = allPosts.filter(p => p.user_id === userId);
    const others = allPosts.filter(p => p.user_id && p.user_id !== userId);

    const results = [];

    for (const myPost of mine) {
      const want = oppositeType(myPost.type);
      if (!want) continue;

      const candidates = others
        .filter(p => p.type === want)
        .map(p => ({
          myPost,
          otherPost: p,
          score: scorePosts(myPost, p)
        }))
        .filter(x => x.score >= minScore)
        .sort((a, b) => b.score - a.score)
        .slice(0, maxPerMyPost);

      results.push(...candidates);
    }

    // Sort overall too
    results.sort((a, b) => b.score - a.score);
    return results;
  }

  window.Matching = { computeMatches };
})();
