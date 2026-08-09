// matches.js — renders matches tab (Poor / Good / Great / Perfect)
(function () {
  console.log("✨ MATCHES.JS LOADED");

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

  // Label + color for each tier
  function matchTier(score) {
    const s = Number(score);
    if (!Number.isFinite(s)) return { label: "—", color: "#888", emoji: "" };
    if (s >= 85) return { label: "Perfect",  color: "#f59e0b", emoji: "🏆" }; // gold
    if (s >= 65) return { label: "Great",    color: "#22c55e", emoji: "🔥" }; // green
    if (s >= 40) return { label: "Good",     color: "#3b82f6", emoji: "👍" }; // blue
    return            { label: "Poor",      color: "#9ca3af", emoji: "🔎" }; // grey
  }

  function convKey(postId, buyerId, sellerId) {
    return `${String(postId)}|${String(buyerId)}|${String(sellerId)}`;
  }

  async function getOrCreateConversationId({ postId, buyerId, sellerId }) {
    const client = supa();
    if (!client) throw new Error("Supabase not ready");

    // Try RPC first
    try {
      const { data, error } = await client.rpc("get_or_create_conversation", {
        p_post_id:   postId,
        p_buyer_id:  buyerId,
        p_seller_id: sellerId
      });
      if (!error && data) return data;
    } catch (e) {}

    // Fallback: direct query
    const { data: existing } = await client
      .from("conversations")
      .select("id")
      .eq("post_id",   postId)
      .eq("buyer_id",  buyerId)
      .eq("seller_id", sellerId)
      .maybeSingle();

    if (existing?.id) return existing.id;

    const { data: created, error: insErr } = await client
      .from("conversations")
      .insert({ post_id: postId, buyer_id: buyerId, seller_id: sellerId })
      .select("id")
      .single();

    if (insErr) throw insErr;
    return created.id;
  }

  function openConversationUI(conversationId) {
    if (window.Messages && typeof window.Messages.openConversation === "function") {
      window.Messages.openConversation(conversationId);
      return;
    }
    window.activeConversationId = conversationId;
    if (typeof window.setActiveView === "function") window.setActiveView("chat");
  }

  function openPostUI(postId) {
    if (window.Posts && typeof window.Posts.openPostById === "function") {
      return window.Posts.openPostById(postId);
    }
    window.__bf_pending_open_post_id = postId;
    if (typeof window.setActiveView === "function") window.setActiveView("posts");
  }

  function bindActionButtons(container) {
    if (container.dataset.actionsBound === "1") return;
    container.dataset.actionsBound = "1";

    container.addEventListener("click", async (e) => {
      const btn = e.target?.closest?.("button[data-action]");
      if (!btn) return;

      const action   = btn.dataset.action;
      const postId   = btn.dataset.postId;
      const convoId  = btn.dataset.convoId;
      const buyerId  = btn.dataset.buyerId;
      const sellerId = btn.dataset.sellerId;

      if (action === "view-post") {
        if (postId) openPostUI(postId);
        return;
      }

      if (action === "chat") {
        const original = btn.textContent;
        try {
          btn.disabled = true;
          btn.textContent = "Opening...";
          let id = convoId;
          if (!id) id = await getOrCreateConversationId({ postId, buyerId, sellerId });
          openConversationUI(id);
        } catch (err) {
          console.error("Open conversation failed:", err);
          alert("Could not open conversation: " + (err?.message || "unknown error"));
        } finally {
          btn.disabled = false;
          btn.textContent = original || (convoId ? "View Conversation" : "Start Conversation");
        }
      }
    });
  }

  async function loadMatches() {
    const client = supa();
    const user   = window.currentUser;
    const list   = ensureListEl();

    if (!user)   { list.innerHTML = "<p class='hint'>Sign in to see your matches.</p>"; return; }
    if (!client) { list.innerHTML = "<p class='hint'>Supabase not ready yet.</p>"; return; }

    list.innerHTML = "<p class='hint'>Loading matches...</p>";

    const { data: rows, error } = await client
      .from("matches")
      .select("*")
      .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
      .order("score", { ascending: false })   // best matches first
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      console.error("loadMatches error:", error);
      list.innerHTML = "<p class='hint'>Failed to load matches: " + (error.message || "unknown") + "</p>";
      return;
    }

    const matches = rows || [];
    if (!matches.length) {
      list.innerHTML = "<p class='hint'>No matches yet. Post something to get matched!</p>";
      return;
    }

    // Fetch post details
    const postIds = Array.from(new Set(
      matches.flatMap(m => [m.buy_post_id, m.sell_post_id]).filter(Boolean).map(String)
    ));
    let postsById = {};
    if (postIds.length) {
      const { data: posts } = await client
        .from("posts")
        .select("id,title,price,type,user_id")
        .in("id", postIds);
      if (posts) postsById = Object.fromEntries(posts.map(p => [String(p.id), p]));
    }

    // Fetch existing conversations so we can show "View Conversation" vs "Start Conversation"
    const sellPostIds = Array.from(new Set(matches.map(m => m.sell_post_id).filter(Boolean).map(String)));
    let convByKey = {};
    if (sellPostIds.length) {
      const { data: convos } = await client
        .from("conversations")
        .select("id,post_id,buyer_id,seller_id")
        .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
        .in("post_id", sellPostIds)
        .limit(500);
      if (convos) {
        convByKey = Object.fromEntries(
          convos.map(c => [convKey(c.post_id, c.buyer_id, c.seller_id), c.id])
        );
      }
    }

    list.innerHTML = matches.map(m => {
      const buy  = postsById[String(m.buy_post_id)]  || {};
      const sell = postsById[String(m.sell_post_id)] || {};
      const s    = Number(m.score);
      const tier = matchTier(s);

      const requestTitle = buy.title  || "(post no longer available)";
      const sellTitle    = sell.title || "(post no longer available)";
      const scoreDisplay = Number.isFinite(s) ? `${s}%` : "";

      const myId      = String(user.id);
      const buyOwner  = String(buy.user_id  || m.buyer_id  || "");
      const sellOwner = String(sell.user_id || m.seller_id || "");

      // Show the OTHER person's post when tapping "View Post"
      let viewPostId = m.sell_post_id || m.buy_post_id;
      if (myId === buyOwner)  viewPostId = m.sell_post_id || viewPostId;
      else if (myId === sellOwner) viewPostId = m.buy_post_id || viewPostId;

      const cKey           = convKey(m.sell_post_id, m.buyer_id, m.seller_id);
      const existingConvoId = convByKey[cKey] || "";
      const when           = m.created_at ? fmtTime(m.created_at) : "";

      return `
        <div class="match-item" data-id="${m.id}" style="
          padding: 12px 14px;
          border: 1px solid rgba(255,255,255,0.10);
          border-left: 4px solid ${tier.color};
          border-radius: 14px;
          margin: 10px 0;
        ">
          <!-- Match quality badge -->
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <span style="
              background: ${tier.color}22;
              color: ${tier.color};
              border: 1px solid ${tier.color}66;
              border-radius: 20px;
              padding: 2px 10px;
              font-size: 12px;
              font-weight: 700;
              letter-spacing: 0.5px;
            ">${tier.emoji} ${tier.label} Match${scoreDisplay ? " · " + scoreDisplay : ""}</span>
            <span style="opacity:.5; font-size:11px;">${when}</span>
          </div>

          <!-- Post titles -->
          <div style="margin-bottom:8px;">
            <div style="font-size:13px; opacity:.6; margin-bottom:2px;">📥 Requesting</div>
            <div style="font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${requestTitle}</div>
            ${buy.price ? `<div style="opacity:.7; font-size:13px;">Budget: ${buy.price}</div>` : ""}
          </div>
          <div style="margin-bottom:10px;">
            <div style="font-size:13px; opacity:.6; margin-bottom:2px;">🏷 Selling</div>
            <div style="font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${sellTitle}</div>
            ${sell.price ? `<div style="opacity:.7; font-size:13px;">Price: ${sell.price}</div>` : ""}
          </div>

          <!-- Action buttons -->
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <button class="btn small" data-action="view-post" data-post-id="${viewPostId}">
              View Post
            </button>
            <button class="btn small"
              data-action="chat"
              data-post-id="${m.sell_post_id || ''}"
              data-buyer-id="${m.buyer_id   || ''}"
              data-seller-id="${m.seller_id  || ''}"
              data-convo-id="${existingConvoId}">
              ${existingConvoId ? "View Conversation" : "Start Conversation"}
            </button>
          </div>
        </div>
      `;
    }).join("");

    bindActionButtons(list);
  }

  // Realtime listener — reload matches tab when a new match is inserted
  let matchChannel = null;
  function initMatchListener() {
    const client = supa();
    const user   = window.currentUser;
    if (!client || !user) return;

    if (matchChannel) client.removeChannel(matchChannel);

    matchChannel = client
      .channel("matches-listener")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "matches" }, (payload) => {
        const match = payload.new;
        const isMine = match.buyer_id === user.id || match.seller_id === user.id;
        if (!isMine) return;

        const tier = matchTier(Number(match.score));
        window.showBrowserNotification?.({ title: "New Match!", body: `${tier.emoji} ${tier.label} match found.` });
        window.Notifications?.notify?.("New Match!", `${tier.emoji} ${tier.label} match found.`);
        loadMatches();
      })
      .subscribe();
  }

  window.Matches = { loadMatches, initMatchListener };
})();
  
