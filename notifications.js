// notifications.js — in-app alerts list + realtime
// Non-module script: attaches to window.Notifications
(function () {
  console.error("🔔 NOTIFICATIONS.JS LOADED (alerts list + click-to-focus)");

  function supa() { return window.supa; }
  function ensureNavBadge(navId, badgeId) {
    const nav = document.getElementById(navId);
    if (!nav) return null;
    let b = document.getElementById(badgeId);
    if (!b) {
      b = document.createElement("span");
      b.id = badgeId;
      b.className = "nav-badge";
      b.textContent = "";
      nav.style.position = nav.style.position || "relative";
      nav.appendChild(b);
    }
    return b;
  }


  function ensureListEl() {
    let el = document.getElementById("notifications-list");
    if (el) return el;

    const view = document.getElementById("view-notifications") || document.getElementById("view-alerts");
    if (view) {
      el = document.createElement("div");
      el.id = "notifications-list";
      view.appendChild(el);
      return el;
    }

    el = document.createElement("div");
    el.id = "notifications-list";
    document.body.appendChild(el);
    return el;
  }

  function fmtTime(ts) {
    try { return new Date(ts).toLocaleString(); }
    catch { return ""; }
  }

  function coerceMeta(m) {
    if (!m) return {};
    if (typeof m === "object") return m;
    if (typeof m === "string") {
      try { return JSON.parse(m); } catch { return {}; }
    }
    return {};
  }

  async function load() {
    const client = supa();
    const user = window.currentUser;
    const list = ensureListEl();

    if (!user) { list.innerHTML = "<p class='hint'>Sign in to see alerts.</p>"; return; }
    if (!client) { list.innerHTML = "<p class='hint'>Supabase not ready yet.</p>"; return; }

    list.innerHTML = "<p class='hint'>Loading alerts...</p>";

    const { data: rows, error } = await client
      .from("alerts")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      console.error("alerts load error:", error);
      list.innerHTML = "<p class='hint'>Failed to load alerts: " + (error.message || "unknown") + "</p>";
      return;
    }

    const alerts = rows || [];
    if (!alerts.length) { list.innerHTML = "<p class='hint'>No alerts yet.</p>"; return; }

    list.innerHTML = alerts.map(a => {
      const meta = coerceMeta(a.meta);
      const when = a.created_at ? fmtTime(a.created_at) : "";
      const unread = (a.read_at == null) ? "unread" : "";
      const matchId = meta.match_id || meta.matchId || meta.match || "";
      const convoId = meta.conversation_id || meta.conversationId || "";
      const postId  = meta.post_id || meta.postId || "";
      return `
        <div class="alert-item bf-card ${unread}"
             data-alert-id="${a.id}"
             data-type="${a.type || ""}"
             data-match-id="${matchId}"
             data-conversation-id="${convoId}"
             data-post-id="${postId}">
          <div class="bf-card-head">
            <div class="bf-card-title">
              <div class="bf-title-line"><strong>${a.title || a.type || "Alert"}</strong></div>
              <div class="muted">${a.body || ""}</div>
            </div>
            <div class="bf-card-meta">
              <span class="muted bf-time">${when}</span>
            </div>
          </div>
        </div>
      `;
    }).join("");

    bindClicks(list);
    refreshBadge();
  }

  async function markRead(alertId) {
    const client = supa();
    const user = window.currentUser;
    if (!client || !user || !alertId) return;

    // best-effort
    try {
      await client
        .from("alerts")
        .update({ read_at: new Date().toISOString() })
        .eq("id", alertId)
        .eq("user_id", user.id);
    } catch {}
  }

  function bindClicks(container) {
    if (container.dataset.boundClicks === "1") return;
    container.dataset.boundClicks = "1";

    container.addEventListener("click", async (e) => {
      const item = e.target?.closest?.(".alert-item");
      if (!item) return;

      const alertId = item.dataset.alertId;
      const type = (item.dataset.type || "").toLowerCase();
      const matchId = item.dataset.matchId;
      const convoId = item.dataset.conversationId;

      // mark read instantly in UI
      item.classList.remove("unread");
      markRead(alertId);

      // Route:
      // - match alert -> jump to Matches tab and focus that match
      // - message alert -> open conversation if available
      if (matchId) {
        if (window.setActiveView) window.setActiveView("matches");
        window.__bf_focus_match_id = matchId;
        window.Matches?.loadMatches?.({ focusMatchId: matchId });
        return;
      }

      if (convoId) {
        if (window.setActiveView) window.setActiveView("messages");
        window.Messages?.openConversation?.(convoId);
        return;
      }

      // fallback: go to matches for match-ish, else stay
      if (type.includes("match")) {
        if (window.setActiveView) window.setActiveView("matches");
        window.Matches?.loadMatches?.();
      }
    });
  }

  let chan = null;
  function initRealtime() {
    const client = supa();
    const user = window.currentUser;
    if (!client || !user) return;

    if (chan) client.removeChannel(chan);

    chan = client
      .channel("alerts-listener")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "alerts", filter: `user_id=eq.${user.id}` }, () => {
        load();
      })
      .subscribe();

    console.log("BOOT: Notifications realtime started");
  }

  
async function refreshBadge() {
    const client = supa();
    const user = window.currentUser;
    const alertsBadge = ensureNavBadge("nav-notifications", "nav-alerts-badge");
    const matchesBadge = ensureNavBadge("nav-matches", "nav-matches-badge");
    if (!client || !user) {
      if (alertsBadge) alertsBadge.textContent = "";
      if (matchesBadge) matchesBadge.textContent = "";
      return;
    }

    // Total unread alerts
    const { count: totalUnread, error: e1 } = await client
      .from("alerts")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("read", false);

    // Unread match alerts (used for Matches badge)
    const { count: matchUnread, error: e2 } = await client
      .from("alerts")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("read", false)
      .eq("type", "match");

    const a = (!e1 && Number.isFinite(totalUnread) ? totalUnread : 0);
    const mCount = (!e2 && Number.isFinite(matchUnread) ? matchUnread : 0);

    if (alertsBadge) {
      alertsBadge.textContent = a > 0 ? String(a) : "";
      alertsBadge.style.display = a > 0 ? "inline-flex" : "none";
    }
    if (matchesBadge) {
      matchesBadge.textContent = mCount > 0 ? String(mCount) : "";
      matchesBadge.style.display = mCount > 0 ? "inline-flex" : "none";
    }
  }

    const { data, error } = await client
      .from("alerts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("read_at", null);

    if (error) return;

    const count = (data && data.length) ? data.length : 0;
    if (count > 0) {
      badge.textContent = String(count);
      badge.classList.remove("hidden");
    } else {
      badge.textContent = "";
      badge.classList.add("hidden");
    }
  }

  function notify(title, body) {
    // in-app only; browser notification handled elsewhere
    console.log("NOTIFY:", title, body);
  }

  window.Notifications = { load, initRealtime, refreshBadge, notify };
})();
