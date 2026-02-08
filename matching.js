// matching.js
// Handles automatic buy/sell matching

const MATCH_THRESHOLD = 50;

// HARD FILTERS
function hardMatch(a, b) { /* unchanged */ }

// SOFT SCORING
function scoreMatch(a, b) { /* unchanged */ }

// CREATE MATCH
async function createMatch(buy, sell, score) { /* unchanged */ }

// MAIN ENTRY POINT
async function findMatchesForPost(post) { /* unchanged */ }

// ===== ADDITION #1 (HOOK INTO POSTS) =====
function initMatching() {
  if (!window.Posts) {
    setTimeout(initMatching, 50);
    return;
  }

  const originalLoadPosts = window.Posts.loadPosts;
  window.Posts.loadPosts = async function (...args) {
    await originalLoadPosts.apply(this, args);
    
    if (window.allPosts) {
      window.allPosts.forEach(post => {
        if (typeof window.findMatchesForPost === "function") {
          window.findMatchesForPost(post);
        }
      });
    }
  };

  console.log("⚡ Matching system initialized");
}

initMatching();
// ========================================
