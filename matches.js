// matches.js — renders matches + realtime listener
(function () {
  console.error("✨ MATCHES.JS LOADED (fixed)");

  function getSupa() { return window.supa; }

  function ensureContainer() {
    let root =
      document.getElementById("matches-list") ||
      document.getElementById("matches-container") ||
      document.getElementById("view-matches");

    if (!root) {
      root = document.createElement("div");
      root.id = "matches-container";
      document.body.appendChild(root);
    }

    if (root.id === "view-matches" && !document.getElementById("matches-list")) {
      const list = document.createElement("div");
      list.id = "matches-list";
      root.appendChild(list);
      return list;
    }

    return root.id === "matches-list" ? root : (document.getElementById("matches-list") || root);
  }

  async function loadMatches() {
    const supa = getSupa();
    const user = window.currentUser;
    const list = ensureContainer();

    if (!user) { list.innerHTML = "<p class='hint'>Sign in to see matches.</p>"; return; }
    if (!supa) { list.innerHTML = "<p class='hint'>Supabase not ready yet.</p>"; return; }

    list.innerHTML = "<p class='hint'>Loading matches...</p>";

    const { data: rows, error } = await supa
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

    const postIds = Array.from(new Set(matches.flatMap((m) => [m.buy_post_id, m.sell_post_id]).filter(Boolean).map(String)));
    let postsById = {};
    if (postIds.length) {
      const { data: posts, error: pErr } = await supa.from("posts").select("id,title,price,type").in("id", postIds);
      if (!pErr && posts) postsById = Object.fromEntries(posts.map((p) => [String(p.id), p]));
    }

    list.innerHTML = matches.map((m) => {
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

    list.querySelectorAll(".match-item").forEach((el) => {
      el.onclick = () => el.classList.toggle("active");
    });
  }

  let matchChannel = null;
  function initMatchListener() {
    const supa = getSupa();
    const user = window.currentUser;
    if (!supa || !user) return;

    if (matchChannel) supa.removeChannel(matchChannel);

    matchChannel = supa
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
