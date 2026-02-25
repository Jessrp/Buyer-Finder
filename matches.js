// matches.js — renders matches + realtime listener (BuyerFinder schema)
// Non-module script: attaches to window.Matches
(function () {
  console.error("✨ MATCHES.JS LOADED (BF schema)");

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
    try { return new Date(ts).toLocaleString(); } catch { return ""; }
  }

  // NEW: focus/highlight a specific match in the list
  function focusMatchInDOM(matchId) {
    if (!matchId) return false;
    const el =
      document.getElementById("match-" + matchId) ||
      document.querySelector(`.match-item[data-id="${matchId}"]`);

    if (!el) return false;

    el.scrollIntoView({ behavior: "smooth", block: "start" });
    el.classList.add("bf-focus");

    // remove highlight after a bit
    setTimeout(() => el.classList.remove("bf-focus"), 1800);
    return true;
  }

  // NEW: public helper called from alerts
  async function openMatch(matchId) {
    window.__bf_pending_match_id = matchId || null;

    // Ensure view is visible
    window.setActiveView?.("matches");

    // Reload, then focus once rendered
    await loadMatches();

    // Try focusing now (in case loadMatches finished rendering)
    focusMatchInDOM(window.__bf_pending_match_id);
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
      .limit(200);

    if (error) {
      console.error("loadMatches error:", error);
      list.innerHTML = "<p class='hint'>Failed to load matches: " + (error.message || "unknown") + "</p>";
      return;
    }

    const matches = rows || [];
    if (!matches.length) { list.innerHTML = "<p class='hint'>No matches yet.</p>"; return; }

    // Pull post titles for nice display (keep your existing schema)
    const postIds = Array.from(new Set(matches.flatMap(m => [m.buy_post_id, m.sell_post_id]).filter(Boolean).map(String)));
    let postsById = {};
    if (postIds.length) {
      const { data: posts, error: pErr } = await client
        .from("posts")
        .select("id,title,price,type,user_id")
        .in("id", postIds);
      if (!pErr && posts) postsById = Object.fromEntries(posts.map(p => [String(p.id), p]));
    }

    // Render
    list.innerHTML = matches.map(m => {
      const buy = postsById[String(m.buy_post_id)] || {};
      const sell = postsById[String(m.sell_post_id)] || {};
      const when = m.created_at ? fmtTime(m.created_at) : "";

      const title = `${buy.title || "Request"} ↔ ${sell.title || "Sell"}`;
      const score = (m.score != null) ? `<span class="pill">Score ${m.score}</span>` : "";

      return `
        <div class="match-item" id="match-${m.id}" data-id="${m.id}"
             style="padding:10px 12px;border:1px solid rgba(255,255,255,0.10);border-radius:14px;margin:10px 0;">
          <div style="display:flex;justify-content:space-between;gap:10px;">
            <div style="min-width:0;">
              <div style="font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${title}</div>
              <div class="muted" style="opacity:.75;margin-top:4px;">
                <span><strong>Request price:</strong> ${buy.price ?? ""}</span>
                &nbsp;|&nbsp;
                <span><strong>Sell price:</strong> ${sell.price ?? ""}</span>
              </div>
            </div>
            <div style="text-align:right;flex:0 0 auto;">
              ${score}
              <div class="muted" style="opacity:.7;font-size:11px;margin-top:6px;">${when}</div>
            </div>
          </div>
        </div>
      `;
    }).join("");

    // NEW: auto-focus if alerts asked for a specific match
    if (window.__bf_pending_match_id) {
      const ok = focusMatchInDOM(window.__bf_pending_match_id);
      if (ok) window.__bf_pending_match_id = null;
    }

    // NEW: tiny CSS for highlight (injected once, no HTML changes needed)
    if (!document.getElementById("bf-focus-style")) {
      const s = document.createElement("style");
      s.id = "bf-focus-style";
      s.textContent = `
        .bf-focus { outline: 2px solid rgba(0, 255, 255, 0.65); box-shadow: 0 0 0 4px rgba(0,255,255,0.12); }
      `;
      document.head.appendChild(s);
    }
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

  window.Matches = { loadMatches, initMatchListener, openMatch };
})();
