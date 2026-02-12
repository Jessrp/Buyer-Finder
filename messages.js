// messages.js
console.error("📨 MESSAGES.JS LOADED");

var supa = window.supa;
let activeConversationId = null;
let messageChannel = null;
let seenMessageIds = new Set();

/* ---------- VIEW SWITCH ---------- */
function showView(id) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.getElementById(id)?.classList.add("active");
}

/* ---------- ADD MESSAGE TO UI ---------- */
function addMessageToUI(msg) {
  const list = document.getElementById("chat-messages");
  if (!list || !msg) return;

  if (msg.id && seenMessageIds.has(msg.id)) return;
  if (msg.id) seenMessageIds.add(msg.id);

  const div = document.createElement("div");
  div.className = msg.sender_id === window.currentUser?.id ? "msg me" : "msg them";
  div.textContent = msg.body ?? "";
  list.appendChild(div);
  list.scrollTop = list.scrollHeight;
}

/* ---------- LOAD INBOX ---------- */
async function loadInbox() {
  const user = window.currentUser;
  if (!user) return;

  const { data, error } = await supa
    .from("conversations")
    .select(
      `
      id,
      posts(title),
      messages (
        id,
        body,
        created_at,
        sender_id
      )
    `
    )
    .or(`seller_id.eq.${user.id},buyer_id.eq.${user.id}`)
    .order("created_at", { foreignTable: "messages", ascending: false });

  if (error) {
    console.error("Inbox load error", error);
    return;
  }

  renderInbox(data || []);
}

/* ---------- RENDER INBOX ---------- */
function renderInbox(convos) {
  const list = document.getElementById("inbox-list");
  if (!list) return;

  if (!convos.length) {
    list.innerHTML = "<p class='hint'>No messages yet.</p>";
    return;
  }

  list.innerHTML = convos.map(c => {
    const last = c.messages?.[0];
    return `
      <div class="inbox-item" data-id="${c.id}">
        <strong>${c.posts?.title || "Conversation"}</strong>
        <p>${last?.body || "No messages yet"}</p>
      </div>
    `;
  }).join("");

  list.querySelectorAll(".inbox-item").forEach(el => {
    el.onclick = () => openConversation(el.dataset.id);
  });
}

/* ---------- OPEN CONVERSATION ---------- */
async function openConversation(conversationId) {
  activeConversationId = conversationId;
  showView("view-chat");

  const list = document.getElementById("chat-messages");
  if (!list) return;

  list.innerHTML = "Loading...";
  seenMessageIds = new Set();

  const { data, error } = await supa
    .from("messages")
    .select("id, conversation_id, sender_id, body, created_at, read")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Failed to load messages", error);
    list.innerHTML = "Failed to load messages";
    return;
  }

  list.innerHTML = "";
  (data || []).forEach(addMessageToUI);

  if (messageChannel) supa.removeChannel(messageChannel);

  messageChannel = supa
    .channel("messages-" + conversationId)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
      (payload) => {
        const message = payload?.new;
        if (!message) return;
        if (message.conversation_id !== activeConversationId) return;
        addMessageToUI(message);
      }
    )
    .subscribe();
}

/* ---------- SEND MESSAGE ---------- */
document.getElementById("chat-send-btn")?.addEventListener("click", async () => {
  const input = document.getElementById("chat-text");
  const body = input?.value?.trim();
  if (!body || !activeConversationId) return;

  const { data, error } = await supa
    .from("messages")
    .insert({
      conversation_id: activeConversationId,
      sender_id: window.currentUser.id,
      body,
      read: false
    })
    .select("id, conversation_id, sender_id, body, created_at, read")
    .single();

  if (error) {
    console.error("Message failed:", error);
    alert("Message failed");
    return;
  }

  if (data) addMessageToUI(data);

  // Create DB notification for recipient (requires notify_message SQL function)
  try {
    await supa.rpc("notify_message", {
      p_conversation_id: activeConversationId,
      p_message_body: body
    });
  } catch (e) {
    console.warn("notify_message failed (message still sent):", e);
  }

  input.value = "";
});

/* ---------- EXPOSE ---------- */
window.Messages = { loadInbox, openConversation };
