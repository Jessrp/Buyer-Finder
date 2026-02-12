// matches.js
console.error("✨ MATCHES.JS LOADED");

(function () {
  function el(id) { return document.getElementById(id); }

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

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
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

      const myLabel = my.type === "selling" ? "You're selling" : "You're requesting";
      const otherLabel = other.type === "selling" ? "They're selling" : "They're requesting";

      return `
        <div class="inbox-item" style="cursor:default;">
          <strong>${Math.round(m.score)} Match</strong>
          <div class="hint" style="margin-top:4px;">
            <div><b>${myLabel}:</b> ${escapeHtml(my.title || "Untitled")}</div>
            <div><b>${otherLabel}:</b> ${escapeHtml(other.title || "Untitled")}</div>
          </div>
        </div>
      `;
    }).join("");
  }

  async function maybeNotifyNewMatches(matches) {
    // For now: only notify the current user (in-app) about new matches.
    // We de-dupe locally so you don't get spammed every time you open Matches.
    if (!window.currentUser || !window.supa) return;
    const key = `bf_seen_matches_${window.currentUser.id}`;
    const seen = new Set(JSON.parse(localStorage.getItem(key) || "[]"));

    const fresh = [];
    for (const m of matches) {
      const id = `${m.myPost.id}:${m.otherPost.id}`;
      if (!seen.has(id)) {
        fresh.push({ id, m });
        seen.add(id);
      }
    }

    if (!fresh.length) return;

    // persist seen ids (cap size)
    const arr = Array.from(seen).slice(-500);
    localStorage.setItem(key, JSON.stringify(arr));

    // insert notifications for current user
    try {
      const rows = fresh.slice(0, 10).map(x => ({
        user_id: window.currentUser.id,
        type: "match",
        title: "New match",
        body: `${x.m.otherPost.title || "Item"} looks like a match`,
        data: { my_post_id: x.m.myPost.id, other_post_id: x.m.otherPost.id }
      }));
      await window.supa.from("notifications").insert(rows);
    } catch (e) {
      console.warn("Match notifications insert failed:", e);
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
      if (list) list.innerHTML = "<p class='hint'>Matching engine not loaded.</p>";
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
      // best-effort: create in-app alerts for NEW matches (current user)
      await maybeNotifyNewMatches(matches);
    } catch (e) {
      console.error("loadMatches failed:", e);
      if (list) list.innerHTML = "<p class='hint'>Failed to load matches. Check console.</p>";
    }
  }

  window.Matches = { loadMatches };
})();
