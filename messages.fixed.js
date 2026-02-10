// messages.js
console.error("📨 MESSAGES.JS LOADED");

const supa = window.supa;

let activeConversationId = null;
let messageChannel = null;

/* ---------- VIEW HELPERS ---------- */
function showView(id) {
  // if your app.js is also managing views, this still works because it just toggles the same class
  document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
  document.getElementById(id)?.classList.add("active");
}

function safeEl(id) {
  return document.getElementById(id);
}

/* ---------- UI HELPERS ---------- */
function addMessageToUI(msg) {
  const list = safeEl("chat-messages");
  if (!list || !msg) return;

  const div = document.createElement("div");
  const me = msg.sender_id === window.currentUser?.id;
  div.className = me ? "msg me" : "msg them";
  div.textContent = msg.body || "";
  list.appendChild(div);
  // scroll to bottom
  try {
    list.scrollTop = list.scrollHeight;
  } catch {}
}

/* ---------- LOAD INBOX ---------- */
async function loadInbox() {
  const user = window.currentUser;
  if (!user) return;

  const list = safeEl("inbox-list");
  if (list) list.innerHTML = "Loading...";

  const { data, error } = await supa
    .from("conversations")
    .select(
      `
      id,
      post_id,
      buyer_id,
      seller_id,
      posts(title),
      messages ( body, created_at, sender_id )
    `
    )
    .or(`seller_id.eq.${user.id},buyer_id.eq.${user.id}`)
    .order("created_at", { foreignTable: "messages", ascending: false });

  if (error) {
    console.error("Inbox load error", error);
    if (list) list.innerHTML = "<p class='hint'>Failed to load inbox.</p>";
    return;
  }

  renderInbox(data || []);
}

/* ---------- RENDER INBOX ---------- */
function renderInbox(convos) {
  const list = safeEl("inbox-list");
  if (!list) return;

  if (!convos.length) {
    list.innerHTML = "<p class='hint'>No messages yet.</p>";
    return;
  }

  list.innerHTML = convos
    .map((c) => {
      const last = c.messages?.[0];
      const lastText = last?.body ? last.body : "No messages yet";
      return `
        <div class="inbox-item" data-id="${c.id}">
          <strong>${c.posts?.title || "Conversation"}</strong>
          <p>${escapeHtml(lastText)}</p>
        </div>
      `;
    })
    .join("");

  list.querySelectorAll(".inbox-item").forEach((el) => {
    el.onclick = () => openConversation(el.dataset.id);
  });
}

function escapeHtml(str) {
  return String(str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

/* ---------- OPEN CONVERSATION ---------- */
async function openConversation(conversationId) {
  if (!conversationId) return;
  activeConversationId = conversationId;

  showView("view-chat");

  const list = safeEl("chat-messages");
  if (list) list.innerHTML = "Loading...";

  const { data, error } = await supa
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at");

  if (error) {
    console.error("Failed to load messages", error);
    if (list) list.innerHTML = "Failed to load messages";
    return;
  }

  if (list) list.innerHTML = "";
  (data || []).forEach(addMessageToUI);

  // realtime listener (clean + not broken)
  if (messageChannel) {
    supa.removeChannel(messageChannel);
    messageChannel = null;
  }

  messageChannel = supa
    .channel("messages-" + conversationId)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => {
        const message = payload?.new;
        if (!message) return;

        // Avoid double-adding your own message if you just appended it
        // (Still safe if it happens. Humans cope.)
        addMessageToUI(message);

        if (message.sender_id !== window.currentUser?.id) {
          if (typeof window.showBrowserNotification === "function") {
            window.showBrowserNotification(message);
          } else if (window.Notifications?.notify) {
            window.Notifications.notify("New message", message.body || "");
          }
        }
      }
    )
    .subscribe();
}

/* ---------- SEND MESSAGE ---------- */
async function sendCurrentMessage() {
  const input = safeEl("chat-text");
  const body = (input?.value || "").trim();
  if (!body || !activeConversationId) return;

  const { error } = await supa.from("messages").insert({
    conversation_id: activeConversationId,
    sender_id: window.currentUser?.id,
    body,
  });

  if (error) {
    console.error("Message insert failed", error);
    alert("Message failed: " + (error.message || "unknown error"));
    return;
  }

  if (input) input.value = "";
}

safeEl("chat-send-btn")?.addEventListener("click", sendCurrentMessage);
safeEl("chat-text")?.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendCurrentMessage();
  }
});

safeEl("chat-back-btn")?.addEventListener("click", () => {
  // back to inbox if present, otherwise back to posts
  if (safeEl("view-inbox")) {
    showView("view-inbox");
    loadInbox();
  } else {
    showView("view-posts");
  }
});

/* ---------- EXPOSE ---------- */
window.Messages = {
  loadInbox,
  openConversation,
};
