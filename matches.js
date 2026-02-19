// matches.js — renders matches + realtime listener (BuyerFinder schema)
// Non-module script: attaches to window.Matches
(function () {
  console.error("✨ MATCHES.JS LOADED (BF schema + threshold + legend)");

  // Only call something a "Match" at/above this score.
  // Below threshold, we label it as "Potential" (or hide, if you want).
  const MATCH_THRESHOLD = 70;

  // If true: hide items below threshold from the Matches tab.
  // If false: show them but label them "Potential".
  const HIDE_BELOW_THRESHOLD = false;

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
    if (s >= 90) return { tag: "🔥 Perfect", cls: "pill premium" };
    if (s >= 80) return { tag: "Strong", cls: "pill" };
    if (s >= MATCH_THRESHOLD) return { tag: "Match", cls: "pill" };
    if (s >= 55) return { tag: "Potential", cls: "pill" };
    if (s >= 35) return { tag: "Weak", cls: "pill" };
    return { tag: "Very weak", cls: "pill" };
  }

  function legendHtml() {
    return `
      <div class="card" style="margin:12px 0;padding:10px 12px;border:1px solid rgba(255,255,255,0.10);border-radius:14px;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
          <strong>Match Score Guide</strong>
          <button class="btn small" id="toggle-score-guide">Show/Hide</button>
        </div>
        <div id="score-guide-body" style="margin-top:10px;display:none;">
          <div class="muted" style="opacity:.8;margin-bottom:8px;">
            Score is a rough relevance estimate (keywords + category + location + intent). Higher = closer fit.
          </div>
          <div style="display:grid;grid-template-columns:1fr;gap:6px;">
            <div><span class="pill">90–100</span> 🔥 Perfect (basically the same thing)</div>
            <div><span class="pill">80–89</span> Strong (very likely what they want)</div>
            <div><span class="pill">70–79</span> Match (good enough to notify)</div>
            <div><span class="pill">55–69</span> Potential (maybe, but not guaranteed)</div>
            <div><span class="pill">35–54</span> Weak (loose similarity)</div>
            <div><span class="pill">0–34</span> Very weak (noise)</div>
          </div>
          <div class="muted" style="opacity:.75;margin-top:8px;">
            Current threshold to be called a “Match”: <strong>${MATCH_THRESHOLD}+</strong>
          </div>
        </div>
      </div>
    `;
  }

  function bindLegendToggle(container) {
    const btn = container.querySelector("#toggle-score-guide");
    const body = container.querySelector("#score-guide-body");
    if (!btn || !body || btn.dataset.bound) return;
    btn.dataset.bound = "1";
    btn.addEventListener("click", () => {
      body.style.display = (body.style.display === "none") ? "block" : "none";
    });
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

    let matches = rows || [];
    if (!matches.length) { list.innerHTML = "<p class='hint'>No matches yet.</p>"; return; }

    // Optional: filter out low-score items entirely
    if (HIDE_BELOW_THRESHOLD) {
      matches = matches.filter(m => Number(m.score) >= MATCH_THRESHOLD);
      if (!matches.length) {
        list.innerHTML = legendHtml() + "<p class='hint'>No matches above the threshold yet.</p>";
        bindLegendToggle(list);
        return;
      }
    }

    const postIds = Array.from(new Set(matches.flatMap(m => [m.buy_post_id, m.sell_post_id]).filter(Boolean).map(String)));
    let postsById = {};
    if (postIds.length) {
      const { data: posts, error: pErr } = await client
        .from("posts")
        .select("id,title,price,type")
        .in("id", postIds);
      if (!pErr && posts) postsById = Object.fromEntries(posts.map(p => [String(p.id), p]));
    }

    // Render
    let html = legendHtml();
    html += matches.map(m => {
      const buy = postsById[String(m.buy_post_id)] || {};
      const sell = postsById[String(m.sell_post_id)] || {};
      const s = Number(m.score);
      const lbl = scoreLabel(s);

      const title = `${buy.title || "Request"} ↔ ${sell.title || "Sell"}`;
      const when = m.created_at ? fmtTime(m.created_at) : "";

      // Only call it "Match" at/above threshold; otherwise label as "Potential"
      const badgeText = (Number.isFinite(s) ? `${lbl.tag} · ${s}` : lbl.tag);
      const kind = (Number.isFinite(s) && s >= MATCH_THRESHOLD) ? "match" : "potential";
      const kindText = (kind === "match") ? "Match" : "Potential";

      return `
        <div class="match-item" data-id="${m.id}" data-kind="${kind}"
             style="padding:10px 12px;border:1px solid rgba(255,255,255,0.10);border-radius:14px;margin:10px 0;">
          <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;">
            <div style="min-width:0;">
              <div style="font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${title}</div>
              <div class="muted" style="opacity:.75;margin-top:2px;">
                <span style="margin-right:10px;">${buy.price || ""}</span>
                <span>${sell.price || ""}</span>
              </div>
            </div>
            <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex:0 0 auto;">
              <span class="${lbl.cls}" title="Score ${s}">${badgeText}</span>
              <span class="muted" style="opacity:.7;font-size:11px;">${when}</span>
            </div>
          </div>
          <div class="muted" style="opacity:.7;font-size:11px;margin-top:8px;">
            Labeled: <strong>${kindText}</strong> (threshold ${MATCH_THRESHOLD}+)
          </div>
        </div>
      `;
    }).join("");

    list.innerHTML = html;
    bindLegendToggle(list);
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

        const s = Number(match.score);
        const isRealMatch = Number.isFinite(s) ? (s >= MATCH_THRESHOLD) : true;

        // Only notify as a "Match" above threshold. Otherwise keep it quiet (or you can notify as "Potential")
        if (isRealMatch) {
          window.showBrowserNotification?.({ title: "New Match", body: "You have a new match." });
          window.Notifications?.notify?.("New Match", "You have a new match.");
        }

        loadMatches();
      })
      .subscribe();
  }

  window.Matches = { loadMatches, initMatchListener };
})();
