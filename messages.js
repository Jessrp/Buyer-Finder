// messages.js — inbox + chat overlay (BuyrFindr)
(function () {
  console.error("📨 MESSAGES.JS LOADED");

  function supa() { return window.supa; }

  let activeConversationId = null;
  let messageChannel = null;
  const seenIds = new Set();

  function ensureUI() {
    let overlay = document.getElementById("bf-chat-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "bf-chat-overlay";
      overlay.style.position = "fixed";
      overlay.style.inset = "0";
      overlay.style.background = "rgba(0,0,0,0.55)";
      overlay.style.zIndex = "9999";
      overlay.style.display = "none";
      overlay.style.padding = "16px";
      overlay.style.touchAction = "pan-y";
      overlay.addEventListener("click", (e) => { if (e.target === overlay) hide(); });
      document.body.appendChild(overlay);
    }

    let panel = document.getElementById("bf-chat-panel");
    if (!panel) {
      panel = document.createElement("div");
      panel.id = "bf-chat-panel";
      panel.style.maxWidth = "720px";
      panel.style.height = "85vh";
      panel.style.margin = "0 auto";
      panel.style.background = "var(--card, #111)";
      panel.style.borderRadius = "16px";
      panel.style.overflow = "hidden";
      panel.style.display = "flex";
      panel.style.flexDirection = "column";
      panel.style.boxShadow = "0 12px 40px rgba(0,0,0,0.5)";
      overlay.appendChild(panel);
    }

    let header = document.getElementById("bf-chat-header");
    if (!header) {
      header = document.createElement("div");
      header.id = "bf-chat-header";
      header.style.display = "flex";
      header.style.alignItems = "center";
      header.style.justifyContent = "space-between";
      header.style.padding = "10px 12px";
      header.style.borderBottom = "1px solid rgba(255,255,255,0.08)";
      header.innerHTML = `
        <div style="font-weight:700;" id="bf-chat-title">Messages</div>
        <div style="display:flex;gap:8px;">
          <button id="bf-chat-inbox-btn" class="btn small">Inbox</button>
          <button id="bf-chat-close-btn" class="btn small">✕</button>
        </div>
      `;
      panel.appendChild(header);
    }

    let body = document.getElementById("bf-chat-body");
    if (!body) {
      body = document.createElement("div");
      body.id = "bf-chat-body";
      body.style.flex = "1";
      body.style.overflow = "hidden";
      body.style.display = "flex";
      panel.appendChild(body);
    }

    let inbox = document.getElementById("inbox-list");
    if (!inbox) {
      inbox = document.createElement("div");
      inbox.id = "inbox-list";
      inbox.style.overflowY = "auto";
      inbox.style.webkitOverflowScrolling = "touch";
      inbox.style.padding = "12px";
      inbox.style.height = "100%";
      inbox.style.touchAction = "pan-y";
      body.appendChild(inbox);
    }

    let chatWrap = document.getElementById("bf-chat-wrap");
    if (!chatWrap) {
      chatWrap = document.createElement("div");
      chatWrap.id = "bf-chat-wrap";
      chatWrap.style.display = "none";
      chatWrap.style.height = "100%";
      chatWrap.style.flex = "1";
      chatWrap.style.flexDirection = "column";
      body.appendChild(chatWrap);
    }

    let chatMessages = document.getElementById("chat-messages");
    if (!chatMessages) {
      chatMessages = document.createElement("div");
      chatMessages.id = "chat-messages";
      chatMessages.style.flex = "1";
      chatMessages.style.overflowY = "auto";
      chatMessages.style.webkitOverflowScrolling = "touch";
      chatMessages.style.padding = "12px";
      chatMessages.style.display = "flex";
      chatMessages.style.flexDirection = "column";
      chatMessages.style.gap = "8px";
      chatMessages.style.touchAction = "pan-y";
      chatWrap.appendChild(chatMessages);
    }

    let composer = document.getElementById("bf-chat-composer");
    if (!composer) {
      composer = document.createElement("div");
      composer.id = "bf-chat-composer";
      composer.style.display = "flex";
      composer.style.gap = "8px";
      composer.style.padding = "10px 12px";
      composer.style.borderTop = "1px solid rgba(255,255,255,0.08)";
      composer.innerHTML = `
        <input id="chat-text" placeholder="Type a message…"
          style="flex:1;padding:10px;border-radius:10px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.06);color:inherit;" />
        <button id="chat-send-btn" class="btn small">Send</button>
      `;
      chatWrap.appendChild(composer);
    }

    const closeBtn = document.getElementById("bf-chat-close-btn");
    if (closeBtn && !closeBtn.dataset.bound) {
      closeBtn.dataset.bound = "1";
      closeBtn.addEventListener("click", hide);
    }
    const inboxBtn = document.getElementById("bf-chat-inbox-btn");
    if (inboxBtn && !inboxBtn.dataset.bound) {
      inboxBtn.dataset.bound = "1";
      inboxBtn.addEventListener("click", () => loadInbox());
    }
    const sendBtn = document.getElementById("chat-send-btn");
    if (sendBtn && !sendBtn.dataset.bound) {
      sendBtn.dataset.bound = "1";
      sendBtn.addEventListener("click", sendActiveMessage);
    }
    const input = document.getElementById("chat-text");
    if (input && !input.dataset.bound) {
      input.dataset.bound = "1";
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          sendActiveMessage();
        }
      });
    }
  }

  function show() { ensureUI(); document.getElementById("bf-chat-overlay").style.display = "block"; }
  function hide() { const o = document.getElementById("bf-chat-overlay"); if (o) o.style.display = "none"; }

  function switchToChat() {
    ensureUI();
    document.getElementById("inbox-list").style.display = "none";
    document.getElementById("bf-chat-wrap").style.display = "flex";
  }
  function switchToInbox() {
    ensureUI();
    document.getElementById("bf-chat-wrap").style.display = "none";
    document.getElementById("inbox-list").style.display = "block";
  }

  function fmtTime(ts) {
    try { return new Date(ts).toLocaleString(); } catch { return ""; }
  }

  // ── LAST SEEN LABEL ─────────────────────────────────────────────
  function lastSeenLabel(ts) {
    if (!ts) return "Unknown";
    const diff = Date.now() - new Date(ts).getTime();
    const mins  = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days  = Math.floor(diff / 86400000);

    if (mins < 2)    return "Active now";
    if (mins < 60)   return `Active ${mins}m ago`;
    if (hours < 3)   return "Active earlier today";
    if (hours < 24)  return "Active today";
    if (days === 1)  return "Last seen yesterday";
    if (days < 7)    return `Last seen ${days} days ago`;
    if (days < 14)   return "Last seen over a week ago";
    if (days < 30)   return "Last seen a few weeks ago";
    return "Last seen a long time ago";
  }

  // ── LOAD INBOX ──────────────────────────────────────────────────
  async function loadInbox() {
    show();
    switchToInbox();

    const client = supa();
    const user = window.currentUser;
    const list = document.getElementById("inbox-list");

    if (!user) { list.innerHTML = "<p class='hint'>Sign in to see messages.</p>"; return; }
    if (!client) { list.innerHTML = "<p class='hint'>Supabase not ready yet.</p>"; return; }

    list.innerHTML = "<p class='hint'>Loading inbox…</p>";

    const { data, error } = await client
      .from("conversations")
      .select(`
        id, post_id, buyer_id, seller_id,
        posts(title),
        messages(body, created_at, sender_id, read_at)
      `)
      .or(`seller_id.eq.${user.id},buyer_id.eq.${user.id}`)
      .order("created_at", { foreignTable: "messages", ascending: false });

    if (error) {
      console.error("Inbox load error", error);
      list.innerHTML = "<p class='hint'>Failed to load inbox.</p>";
      return;
    }

    const convos = data || [];
    if (!convos.length) {
      list.innerHTML = "<p class='hint'>No messages yet.</p>";
      return;
    }

    // Fetch other users' profiles including last_seen
    const otherIds = [...new Set(convos.map(c =>
      c.buyer_id === user.id ? c.seller_id : c.buyer_id
    ))];
    const { data: profiles } = await client
      .from("profiles")
      .select("id, username, avatar_url, last_seen")
      .in("id", otherIds);

    const profileMap = {};
    (profiles || []).forEach(p => profileMap[p.id] = p);

    list.innerHTML = convos.map(c => {
      const otherId   = c.buyer_id === user.id ? c.seller_id : c.buyer_id;
      const other     = profileMap[otherId] || {};
      const otherName = other.username || "Unknown";
      const title     = c.posts?.title || "Conversation";
      const msgs      = c.messages || [];
      const latest    = msgs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
      const snippet   = latest?.body || "No messages yet";
      const isMe      = latest?.sender_id === user.id;
      const time      = latest?.created_at ? fmtTime(latest.created_at) : "";
      const lastSeen  = lastSeenLabel(other.last_seen);

      // Unread count — messages not from me that have no read_at
      const unreadCount = msgs.filter(m => m.sender_id !== user.id && !m.read_at).length;
      const unreadBadge = unreadCount > 0
        ? `<span style="background:#ff3b30;color:#fff;border-radius:999px;font-size:11px;padding:1px 7px;margin-left:6px;">${unreadCount}</span>`
        : "";

      const initials   = otherName.slice(0, 2).toUpperCase();
      const avatarHtml = other.avatar_url
        ? `<img src="${other.avatar_url}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
        : initials;

      return `
        <div class="inbox-item" data-id="${c.id}"
             style="padding:12px;border:1px solid rgba(255,255,255,0.10);border-radius:12px;margin-bottom:10px;cursor:pointer;display:flex;gap:12px;align-items:center;">
          <div style="width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,var(--accent2),var(--accent));display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;flex-shrink:0;overflow:hidden;">
            ${avatarHtml}
          </div>
          <div style="flex:1;min-width:0;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px;">
              <div style="font-weight:700;font-size:14px;">${otherName}${unreadBadge}</div>
              <small style="color:var(--muted);font-size:10px;flex-shrink:0;margin-left:8px;">${time}</small>
            </div>
            <div style="font-size:11px;color:var(--muted);margin-bottom:3px;">📝 ${title}</div>
            <div style="font-size:12px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
              ${isMe ? '<span style="color:var(--accent);font-size:11px;">You: </span>' : ""}${snippet}
            </div>
            <div style="font-size:10px;color:var(--muted);margin-top:3px;opacity:0.6;">🕐 ${lastSeen}</div>
          </div>
        </div>
      `;
    }).join("");

    list.querySelectorAll(".inbox-item").forEach(el => {
      el.addEventListener("click", () => openConversation(el.dataset.id));
    });
  }

  // ── ADD MESSAGE TO UI ───────────────────────────────────────────
  function addMessageToUI(msg, otherLastSeen) {
    if (!msg) return;
    if (msg.id && seenIds.has(msg.id)) return;
    if (msg.id) seenIds.add(msg.id);

    ensureUI();
    const list = document.getElementById("chat-messages");
    const mine = msg.sender_id === window.currentUser?.id;

    const wrap = document.createElement("div");
    wrap.dataset.msgId = msg.id || "";
    wrap.style.display = "flex";
    wrap.style.flexDirection = "column";
    wrap.style.alignItems = mine ? "flex-end" : "flex-start";

    const bubble = document.createElement("div");
    bubble.style.maxWidth = "80%";
    bubble.style.padding = "10px 12px";
    bubble.style.borderRadius = "14px";
    bubble.style.background = mine ? "rgba(0,223,162,0.18)" : "rgba(255,255,255,0.08)";
    bubble.style.color = "inherit";
    bubble.textContent = msg.body || "";

    const stamp = document.createElement("div");
    stamp.style.opacity = ".55";
    stamp.style.fontSize = "11px";
    stamp.style.marginTop = "3px";
    stamp.style.display = "flex";
    stamp.style.alignItems = "center";
    stamp.style.gap = "4px";

    const timeStr = msg.created_at ? fmtTime(msg.created_at) : "";
    stamp.textContent = timeStr;

    // Read receipt — show "Seen" if this is my message and it has been read
    if (mine && msg.read_at) {
      const seen = document.createElement("span");
      seen.style.color = "#00dfa2";
      seen.style.fontSize = "10px";
      seen.textContent = "✓ Seen";
      stamp.appendChild(seen);
    }

    wrap.appendChild(bubble);
    wrap.appendChild(stamp);
    list.appendChild(wrap);
  }

  // ── UPDATE READ RECEIPTS IN UI ──────────────────────────────────
  function updateReadReceiptsInUI(messages) {
    const list = document.getElementById("chat-messages");
    if (!list) return;
    messages.forEach(msg => {
      if (!msg.read_at) return;
      const wrap = list.querySelector(`[data-msg-id="${msg.id}"]`);
      if (!wrap) return;
      const stamp = wrap.querySelector("div:last-child");
      if (!stamp) return;
      if (!stamp.querySelector(".seen-label")) {
        const seen = document.createElement("span");
        seen.className = "seen-label";
        seen.style.color = "#00dfa2";
        seen.style.fontSize = "10px";
        seen.textContent = "✓ Seen";
        stamp.appendChild(seen);
      }
    });
  }

  function scrollToBottom() {
    const list = document.getElementById("chat-messages");
    if (!list) return;
    requestAnimationFrame(() => { list.scrollTop = list.scrollHeight; });
  }

  // ── OPEN CONVERSATION ───────────────────────────────────────────
  async function openConversation(conversationId) {
    show();
    switchToChat();

    activeConversationId = conversationId;
    seenIds.clear();

    const client = supa();
    const user   = window.currentUser;
    const list   = document.getElementById("chat-messages");
    list.innerHTML = "<div class='hint'>Loading…</div>";

    // Load messages
    const { data, error } = await client
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at");

    if (error) {
      list.innerHTML = "<div class='hint'>Failed to load messages.</div>";
      return;
    }

    // Get the other user's profile for last seen display
    const { data: convo } = await client
      .from("conversations")
      .select("buyer_id, seller_id")
      .eq("id", conversationId)
      .single();

    let otherProfile = null;
    if (convo) {
      const otherId = convo.buyer_id === user.id ? convo.seller_id : convo.buyer_id;
      const { data: profile } = await client
        .from("profiles")
        .select("username, last_seen")
        .eq("id", otherId)
        .single();
      otherProfile = profile;
    }

    // Update header with other user's name and last seen
    const titleEl = document.getElementById("bf-chat-title");
    if (titleEl && otherProfile) {
      titleEl.innerHTML = `
        <div style="line-height:1.2;">
          <div style="font-weight:700;">${otherProfile.username || "Chat"}</div>
          <div style="font-size:10px;color:var(--muted);font-weight:400;">${lastSeenLabel(otherProfile.last_seen)}</div>
        </div>
      `;
    }

    // Mark incoming messages as read
    await client.rpc("mark_messages_read", {
      p_conversation_id: conversationId,
      p_user_id: user.id,
    });

    list.innerHTML = "";
    (data || []).forEach(msg => addMessageToUI(msg));
    scrollToBottom();

    const input = document.getElementById("chat-text");
    if (input) setTimeout(() => input.focus(), 50);

    if (messageChannel) client.removeChannel(messageChannel);

    messageChannel = client
      .channel("messages-" + conversationId)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        async (payload) => {
          const msg = payload.new;
          if (!msg) return;
          addMessageToUI(msg);
          scrollToBottom();

          // If incoming message, mark it read immediately since window is open
          if (msg.sender_id !== user.id) {
            await client.rpc("mark_messages_read", {
              p_conversation_id: conversationId,
              p_user_id: user.id,
            });
            window.Notifications?.notify?.("New Message", msg.body || "You have a new message.");
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          // Update read receipts in real time when the other side reads our messages
          if (payload.new?.read_at) {
            updateReadReceiptsInUI([payload.new]);
          }
        }
      )
      .subscribe();
  }

  // ── SEND MESSAGE ────────────────────────────────────────────────
  async function sendActiveMessage() {
    const client = supa();
    const me    = window.currentUser?.id;
    const input = document.getElementById("chat-text");
    const body  = (input?.value || "").trim();
    if (!body || !activeConversationId) return;

    if (input) input.value = "";

    const insertPayload = { conversation_id: activeConversationId, sender_id: me, body };

    const { data, error } = await client
      .from("messages")
      .insert(insertPayload)
      .select("*")
      .single();

    if (error) {
      console.error("Message insert failed", error);
      alert("Message failed.");
      return;
    }

    addMessageToUI(data || { ...insertPayload, created_at: new Date().toISOString() });
    scrollToBottom();
  }

  window.Messages = { loadInbox, openConversation };
  window.openConversation = openConversation;
})();
 
