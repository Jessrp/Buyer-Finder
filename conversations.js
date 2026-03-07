// conversations.js — get or create conversations, and load inbox
(function () {
  console.error("💬 CONVERSATIONS.JS LOADED (fixed)");

  function supa() { return window.supa; }

  async function getOrCreateConversation({ postId, buyerId, sellerId }) {
    if (!postId || !buyerId || !sellerId) throw new Error("Missing conversation parameters");
    const client = supa();
    if (!client) throw new Error("Supabase not ready");

    const { data: existing, error: findError } = await client
      .from("conversations")
      .select("*")
      .eq("post_id", postId)
      .eq("buyer_id", buyerId)
      .eq("seller_id", sellerId)
      .maybeSingle();

    if (findError) throw findError;
    if (existing) return existing;

    const { data: created, error: createError } = await client
      .from("conversations")
      .insert({ post_id: postId, buyer_id: buyerId, seller_id: sellerId })
      .select()
      .single();

    if (createError) throw createError;
    return created;
  }

  async function openConversationFromPost(post) {
    const user = window.currentUser;
    if (!user || !post) return;
    const buyerId  = user.id;
    const sellerId = post.user_id;
    if (buyerId === sellerId) return;
    const convo = await getOrCreateConversation({ postId: post.id, buyerId, sellerId });
    window.Messages?.openConversation?.(convo.id);
  }

  // ─── LOAD INBOX ─────────────────────────────────────────────────
  async function load() {
    const user   = window.currentUser;
    const client = supa();
    const list   = document.getElementById("conversations-list");
    if (!list) return;

    if (!user || !client) {
      list.innerHTML = `<div class="list-item" style="text-align:center;color:var(--muted);">Sign in to see your messages.</div>`;
      return;
    }

    list.innerHTML = `<div class="list-item" style="text-align:center;color:var(--muted);">Loading…</div>`;

    try {
      // Fetch all conversations where user is buyer OR seller
      const { data: convos, error } = await client
        .from("conversations")
        .select(`
          id,
          post_id,
          buyer_id,
          seller_id,
          posts ( title, type ),
          messages ( body, created_at, sender_id )
        `)
        .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
        .order("id", { ascending: false });

      if (error) throw error;

      if (!convos || convos.length === 0) {
        list.innerHTML = `<div class="list-item" style="text-align:center;color:var(--muted);">No conversations yet.<br><small>Send a message on a post to get started.</small></div>`;
        return;
      }

      // Collect all other-user IDs to fetch their usernames
      const otherIds = [...new Set(convos.map(c =>
        c.buyer_id === user.id ? c.seller_id : c.buyer_id
      ))];

      const { data: profiles } = await client
        .from("profiles")
        .select("id, username, avatar_url")
        .in("id", otherIds);

      const profileMap = {};
      (profiles || []).forEach(p => profileMap[p.id] = p);

      list.innerHTML = convos.map(c => {
        const otherId   = c.buyer_id === user.id ? c.seller_id : c.buyer_id;
        const other     = profileMap[otherId] || {};
        const otherName = other.username || "Unknown user";
        const postTitle = c.posts?.title || "Unknown post";
        const postType  = c.posts?.type  || "";

        // Get latest message (messages come back unsorted, find max created_at)
        const msgs      = c.messages || [];
        const latest    = msgs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
        const preview   = latest ? latest.body : "No messages yet";
        const isMe      = latest?.sender_id === user.id;
        const timeStr   = latest ? timeAgo(latest.created_at) : "";

        // Avatar initials
        const initials  = otherName.slice(0, 2).toUpperCase();
        const avatarUrl = other.avatar_url;
        const avatarHtml = avatarUrl
          ? `<img src="${avatarUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
          : initials;

        const typeColor = postType === "requesting" ? "var(--req)" : "var(--sell)";
        const typeDot   = `<span style="width:6px;height:6px;border-radius:50%;background:${typeColor};display:inline-block;margin-right:4px;"></span>`;

        return `
          <div class="list-item" style="display:flex;align-items:center;gap:12px;cursor:pointer;padding:12px;"
               onclick="window.Conversations.openById('${c.id}')">
            <div style="width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,var(--accent2),var(--accent));display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;flex-shrink:0;overflow:hidden;">
              ${avatarHtml}
            </div>
            <div style="flex:1;min-width:0;">
              <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:2px;">
                <strong style="font-size:14px;">${otherName}</strong>
                <small style="color:var(--muted);font-size:10px;flex-shrink:0;margin-left:8px;">${timeStr}</small>
              </div>
              <div style="font-size:11px;color:var(--muted);margin-bottom:3px;">${typeDot}${postTitle}</div>
              <div style="font-size:12px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                ${isMe ? '<span style="color:var(--accent);font-size:11px;">You: </span>' : ""}${escHtml(preview)}
              </div>
            </div>
          </div>`;
      }).join("");

    } catch (err) {
      console.error("Conversations.load error:", err);
      list.innerHTML = `<div class="list-item" style="color:var(--danger);">Failed to load conversations: ${err.message}</div>`;
    }
  }

  // ─── OPEN CONVERSATION BY ID ─────────────────────────────────────
  async function openById(convoId) {
    if (window.Messages && typeof window.Messages.openConversation === "function") {
      window.Messages.openConversation(convoId);
    }
  }

  // ─── HELPERS ────────────────────────────────────────────────────
  function timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1)   return "now";
    if (m < 60)  return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24)  return `${h}h`;
    const d = Math.floor(h / 24);
    if (d < 7)   return `${d}d`;
    return new Date(dateStr).toLocaleDateString([], { month: "short", day: "numeric" });
  }

  function escHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  window.Conversations = { getOrCreateConversation, openConversationFromPost, load, openById };
})();
        
