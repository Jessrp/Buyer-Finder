// messages.js — inbox + chat overlay (BuyerFinder)
(function () {
  console.error("📨 MESSAGES.JS LOADED (polished)");

  function supa() { return window.supa; }

  let activeConversationId = null;
  let messageChannel = null;

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
        <div style="font-weight:700;">Messages</div>
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
        <input id="chat-text" placeholder="Type a message…" style="flex:1;padding:10px;border-radius:10px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.06);color:inherit;" />
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
  }

  function show() { ensureUI(); document.getElementById("bf-chat-overlay").style.display = "block"; }
  function hide() { const o=document.getElementById("bf-chat-overlay"); if (o) o.style.display = "none"; }

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
    try { return new Date(ts).toLocaleString(); }
    catch { return ""; }
  }

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
        id,
        post_id,
        buyer_id,
        seller_id,
        posts(title),
        messages ( body, created_at, sender_id )
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

    list.innerHTML = convos.map(c => {
      const last = c.messages?.[0];
      const title = c.posts?.title || "Conversation";
      const snippet = last?.body || "No messages yet";
      const time = last?.created_at ? fmtTime(last.created_at) : "";
      return `
        <div class="inbox-item" data-id="${c.id}" style="padding:10px 12px;border:1px solid rgba(255,255,255,0.10);border-radius:12px;margin-bottom:10px;cursor:pointer;">
          <div style="display:flex;justify-content:space-between;gap:12px;">
            <div style="font-weight:700;">${title}</div>
            <div class="muted" style="opacity:.7;white-space:nowrap;">${time}</div>
          </div>
          <div class="muted" style="opacity:.75;">${snippet}</div>
          <div style="margin-top:6px;">
            <button class="btn small" data-open="${c.id}">View conversation</button>
          </div>
        </div>
      `;
    }).join("");

    list.querySelectorAll(".inbox-item").forEach(el => {
      el.addEventListener("click", (e) => {
        const btn = e.target?.closest?.("button[data-open]");
        const id = btn?.dataset?.open || el.dataset.id;
        openConversation(id);
      });
    });
  }

  function addMessageToUI(msg) {
    ensureUI();
    const list = document.getElementById("chat-messages");
    const mine = msg.sender_id === window.currentUser?.id;

    const wrap = document.createElement("div");
    wrap.style.display = "flex";
    wrap.style.flexDirection = "column";
    wrap.style.alignItems = mine ? "flex-end" : "flex-start";

    const bubble = document.createElement("div");
    bubble.className = mine ? "msg me" : "msg them";
    bubble.style.maxWidth = "80%";
    bubble.style.padding = "10px 12px";
    bubble.style.borderRadius = "14px";
    bubble.style.background = mine ? "rgba(0,180,255,0.20)" : "rgba(255,255,255,0.08)";
    bubble.textContent = msg.body || "";

    const stamp = document.createElement("div");
    stamp.className = "muted";
    stamp.style.opacity = ".65";
    stamp.style.fontSize = "11px";
    stamp.style.marginTop = "4px";
    stamp.textContent = msg.created_at ? fmtTime(msg.created_at) : "";

    wrap.appendChild(bubble);
    if (stamp.textContent) wrap.appendChild(stamp);

    list.appendChild(wrap);
  }

  function scrollToBottom() {
    const list = document.getElementById("chat-messages");
    if (!list) return;
    requestAnimationFrame(() => {
      list.scrollTop = list.scrollHeight;
    });
  }

  async function openConversation(conversationId) {
    show();
    switchToChat();

    activeConversationId = conversationId;
    const client = supa();
    const list = document.getElementById("chat-messages");
    list.innerHTML = "<div class='hint'>Loading…</div>";

    const { data, error } = await client
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at");

    if (error) {
      console.error("Failed to load messages", error);
      list.innerHTML = "<div class='hint'>Failed to load messages.</div>";
      return;
    }

    list.innerHTML = "";
    (data || []).forEach(addMessageToUI);
    scrollToBottom();

    const input = document.getElementById("chat-text");
    if (input) setTimeout(() => input.focus(), 50);

    if (messageChannel) client.removeChannel(messageChannel);

    messageChannel = client
      .channel("messages-" + conversationId)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const msg = payload.new;
          if (!msg) return;
          addMessageToUI(msg);
          scrollToBottom();

          if (msg.sender_id !== window.currentUser?.id) {
            window.Notifications?.notify?.("New Message", msg.body || "You have a new message.");
          }
        }
      )
      .subscribe();
  }

  async function sendActiveMessage() {
    const client = supa();
    const me = window.currentUser?.id;
    const input = document.getElementById("chat-text");
    const body = (input?.value || "").trim();
    if (!body || !activeConversationId) return;

    const { error } = await client.from("messages").insert({
      conversation_id: activeConversationId,
      sender_id: me,
      body
    });

    if (error) {
      console.error("Message insert failed", error);
      alert("Message failed.");
      return;
    }

    if (input) input.value = "";
  }

  window.Messages = { loadInbox, openConversation };
  window.openConversation = openConversation;
})();
