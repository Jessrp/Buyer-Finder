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

  function render(matches) {
    const list = el("matches-list");
    if (!list) return;

    if (!window.currentUser) {
      list.innerHTML = "<p class='hint'>Sign in to see matches.</p>";
      return;
    }

    if (!matches.length) {
      list.innerHTML = "<p class='hint'>No matches yet. Either nobody wants what you’re selling, or nobody is selling what you want. Humanity is cruel.</p>";
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
          <div class="hint" style="margin-top:4px;">
            <div><b>${myLabel}:</b> ${escapeHtml(my.title || "Untitled")}</div>
            <div><b>${otherLabel}:</b> ${escapeHtml(other.title || "Untitled")}</div>
          </div>
        </div>
      `;
    }).join("");
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
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
      window.allPosts = allPosts; // keep your global consistent

      const matches = window.Matching.computeMatches({
        allPosts,
        userId: window.currentUser.id,
        minScore: 25,
        maxPerMyPost: 10
      });

      render(matches);
    } catch (e) {
      console.error("loadMatches failed:", e);
      if (list) list.innerHTML = "<p class='hint'>Failed to load matches. Check console.</p>";
    }
  }

  // Optional: refresh matches when new posts appear
  function initRealtime() {
    const supa = window.supa;
    if (!supa) return;

    supa
      .channel("matches-posts-refresh")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "posts" }, () => {
        // Only refresh if matches view is visible
        const viewMatches = el("view-matches");
        if (viewMatches?.classList.contains("active")) loadMatches();
      })
      .subscribe();
  }

  window.Matches = { loadMatches, initRealtime };
})();
