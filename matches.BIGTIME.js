// matches.js
console.error("✨ MATCHES.JS LOADED");

(function () {
  const STORAGE_KEY = "bf_seen_match_keys_v1";

  function el(id) { return document.getElementById(id); }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function getSeenKeys() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return new Set(Array.isArray(arr) ? arr : []);
    } catch {
      return new Set();
    }
  }

  function saveSeenKeys(set) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...set].slice(-500)));
    } catch {}
  }

  async function fetchAllPosts() {
    const supa = window.supa;
    if (!supa) throw new Error("Supabase client not ready (window.supa missing).");

    const { data, error } = await supa
      .from("posts")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
  }

  function render(matches) {
    const list = el("matches-list");
    if (!list) return;

    if (!window.currentUser) {
      list.innerHTML = "<p class='hint'>Sign in to see matches.</p>";
      return;
    }

    if (!matches.length) {
      list.innerHTML = "<p class='hint'>No matches yet.</p>";
      return;
    }

    list.innerHTML = matches.map(m => {
      const my = m.myPost;
      const other = m.otherPost;

      const myLabel = my.type === "selling" ? "You’re selling" : "You’re requesting";
      const otherLabel = other.type === "selling" ? "They’re selling" : "They’re requesting";

      return `
        <div class="inbox-item" style="cursor:default;">
          <strong>${Math.round(m.score)}% Match</strong>
          <div class="hint" style="margin-top:6px;">
            <div><b>${myLabel}:</b> ${escapeHtml(my.title || "Untitled")}</div>
            <div><b>${otherLabel}:</b> ${escapeHtml(other.title || "Untitled")}</div>
          </div>
        </div>
      `;
    }).join("");
  }

  async function notifyNewMatches(matches) {
    const user = window.currentUser;
    const supa = window.supa;
    if (!user || !supa || !Array.isArray(matches) || !matches.length) return;

    const seen = getSeenKeys();
    const rows = [];

    for (const m of matches) {
      const myId = m.myPost?.id;
      const otherId = m.otherPost?.id;
      if (!myId || !otherId) continue;

      const key = `match:${myId}:${otherId}`;
      if (seen.has(key)) continue;

      seen.add(key);
      rows.push({
        user_id: user.id,
        type: "match",
        title: "New match",
        body: `${m.otherPost?.title || "Someone"} matches your ${m.myPost?.title || "post"}`,
        data: { key, my_post_id: myId, other_post_id: otherId }
      });
    }

    if (!rows.length) return;

    saveSeenKeys(seen);

    const { error } = await supa.from("notifications").insert(rows);
    if (error) {
      console.warn("match notification insert failed:", error);
      return;
    }

    if (window.Notifications && typeof window.Notifications.toast === "function") {
      window.Notifications.toast(rows[0]);
    }
  }

  async function loadMatches() {
    const list = el("matches-list");
    if (list) list.innerHTML = "<p class='hint'>Loading matches…</p>";

    if (!window.currentUser) {
      render([]);
      return;
    }

    if (!window.Matching || typeof window.Matching.computeMatches !== "function") {
      if (list) list.innerHTML = "<p class='hint'>Matching engine not loaded (matching.js missing).</p>";
      return;
    }

    try {
      const allPosts = await fetchAllPosts();
      window.allPosts = allPosts;

      const matches = window.Matching.computeMatches({
        allPosts,
        userId: window.currentUser.id,
        minScore: 25,
        maxPerMyPost: 10
      });

      render(matches);
      notifyNewMatches(matches);
    } catch (e) {
      console.error("loadMatches failed:", e);
      if (list) list.innerHTML = "<p class='hint'>Failed to load matches. Check console.</p>";
    }
  }

  window.Matches = { loadMatches };
})();
