// matches.js — renders matches + realtime listener (BuyerFinder schema + threshold + actions)
(function () {
  console.error("✨ MATCHES.JS LOADED (BF schema + threshold + actions)");

  const MATCH_THRESHOLD = 35;
  const HIDE_BELOW_THRESHOLD = true;

  function supa() { return window.supa; }

  function ensureListEl() {
    let el = document.getElementById("matches-list");
    if (el) return el;
    const view = document.getElementById("view-matches");
    if (view) {
      el = document.createElement("div");
      el.id = "matches-list";
      view.appendChild(el);
      return el;
    }
    el = document.createElement("div");
    el.id = "matches-list";
    document.body.appendChild(el);
    return el;
  }

  function fmtTime(ts) {
    try { return new Date(ts).toLocaleString(); }
    catch { return ""; }
  }

  function scoreLabel(score) {
    const s = Number(score);
    if (!Number.isFinite(s)) return { tag: "—", cls: "pill" };
    if (s >= 90) return { tag: "Perfect", cls: "pill premium" };
    if (s >= 80) return { tag: "Strong", cls: "pill" };
    if (s >= MATCH_THRESHOLD) return { tag: "Match", cls: "pill" };
    if (s >= 55) return { tag: "Potential", cls: "pill" };
    if (s >= 35) return { tag: "Weak", cls: "pill" };
    return { tag: "Very weak", cls: "pill" };
  }

  async function loadMatches() {
    const client = supa();
    const user = window.currentUser;
    const list = ensureListEl();

    if (!user) {
      list.innerHTML = "<p>Sign in to see matches.</p>";
      return;
    }

    list.innerHTML = "<p>Loading matches...</p>";

    const { data, error } = await client
      .from("matches")
      .select("*")
      .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
      .order("created_at", { ascending: false });

    if (error) {
      list.innerHTML = "<p>Failed to load matches.</p>";
      return;
    }

    let matches = data || [];
    if (HIDE_BELOW_THRESHOLD) {
      matches = matches.filter(m => Number(m.score) >= MATCH_THRESHOLD);
    }

    if (!matches.length) {
      list.innerHTML = "<p>No matches yet.</p>";
      return;
    }

    list.innerHTML = matches.map(m => `
      <div class="match-card">
        <h3>Score: ${m.score}</h3>
        <p>Buy Post: ${m.buy_post_id}</p>
        <p>Sell Post: ${m.sell_post_id}</p>
      </div>
    `).join("");
  }

  function initMatchListener() {
    const client = supa();
    const user = window.currentUser;
    if (!client || !user) return;

    client
      .channel("matches-listener")
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "matches"
      }, payload => {
        const match = payload.new;
        if (match.buyer_id === user.id || match.seller_id === user.id) {
          loadMatches();
        }
      })
      .subscribe();
  }

  window.Matches = { loadMatches, initMatchListener };
})();