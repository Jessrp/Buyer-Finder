// matches.js — renders matches + realtime listener (BuyerFinder schema)
// Non-module script: attaches to window.Matches
(function () {
  console.error("✨ MATCHES.JS LOADED (BF schema)");

  function supa() { return window.supa; }

  function ensureListEl() {
    // prefer a dedicated list
    let el = document.getElementById("matches-list");
    if (el) return el;

    const view = document.getElementById("view-matches");
    if (view) {
      el = document.createElement("div");
      el.id = "matches-list";
      view.appendChild(el);
      return el;
    }

    // fallback: create
    el = document.createElement("div");
    el.id = "matches-list";
    document.body.appendChild(el);
    return el;
  }

  async function loadMatches() {
    const client = supa();
    const user = window.currentUser;
    const list = ensureListEl();

    if (!user) { list.innerHTML = "<p class='hint'>Sign in to see matches.</p>"; return; }
    if (!client) { list.innerHTML = "<p class='hint'>Supabase not ready yet.</p>"; return; }

    list.innerHTML = "<p class='hint'>Loading matches...</p>";

    const { data: rows, error } = await client
      .from("matches")
      .select("*")
      .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      console.error("loadMatches error:", error);
      list.innerHTML = "<p class='hint'>Failed to load matches: " + (error.message || "unknown") + "</p>";
      return;
    }

    const matches = rows || [];
    if (!matches.length) { list.innerHTML = "<p class='hint'>No matches yet.</p>"; return; }

    const postIds = Array.from(new Set(matches.flatMap(m => [m.buy_post_id, m.sell_post_id]).filter(Boolean).map(String)));
    let postsById = {};
    if (postIds.length) {
      const { data: posts, error: pErr } = await client.from("posts").select("id,title,price,type").in("id", postIds);
      if (!pErr && posts) postsById = Object.fromEntries(posts.map(p => [String(p.id), p]));
    }

    list.innerHTML = matches.map(m => {
      const buy = postsById[String(m.buy_post_id)] || {};
      const sell = postsById[String(m.sell_post_id)] || {};
      const score = m.score != null ? `<span class="pill">Score ${m.score}</span>` : "";
      const title = `${buy.title || "Request"} ↔ ${sell.title || "Sell"}`;
      return `
        <div class="match-item" data-id="${m.id}">
          <div><strong>${title}</strong> ${score}</div>
          <div class="muted">${buy.price || ""} ${sell.price || ""}</div>
        </div>
      `;
    }).join("");
  }

  let matchChannel = null;
  function initMatchListener() {
    const client = supa();
    const user = window.currentUser;
    if (!client || !user) return;

    if (matchChannel) client.removeChannel(matchChannel);

    matchChannel = client
      .channel("matches-listener")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "matches" }, (payload) => {
        const match = payload.new;
        const isMine = match.buyer_id === user.id || match.seller_id === user.id;
        if (!isMine) return;

        window.showBrowserNotification?.({ title: "New Match", body: "You have a new match." });
        loadMatches();
      })
      .subscribe();
  }

  window.Matches = { loadMatches, initMatchListener };
})();
