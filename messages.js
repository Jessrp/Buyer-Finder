// messages.js
console.error("📨 MESSAGES.JS LOADED");

const supa = window.supa;
let activeConversationId = null;
let messageChannel = null;

/* ---------- VIEW SWITCH ---------- */
function showView(id) {
  document.querySelectorAll(".view").forEach(v =>
    v.classList.remove("active")
  );
  document.getElementById(id)?.classList.add("active");
}

/* ---------- LOAD INBOX ---------- */
async function loadInbox() {
  const user = window.currentUser;
  if (!user) return;

  const { data, error } = await supa
    .from("conversations")
    .select(`
      id,
      posts(title),
      messages (
        body,
        created_at,
        sender_id,
        read
      )
    `)
    .or(`seller_id.eq.${user.id},buyer_id.eq.${user.id}`)
    .order("created_at", { foreignTable: "messages", ascending: false });

  if (error) {
    console.error("Inbox load error", error);
    return;
  }

  renderInbox(data);
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
    const unread = c.messages?.some(
      m => !m.read && m.sender_id !== window.currentUser.id
    );

    return `
      <div class="inbox-item ${unread ? "unread" : ""}" data-id="${c.id}">
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
  list.innerHTML = "Loading...";

  // kill previous realtime channel
  if (messageChannel) {
    supa.removeChannel(messageChannel);
    messageChannel = null;
  }

  const { data, error } = await supa
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at");

  if (error) {
    list.innerHTML = "Failed to load messages";
    return;
  }

  list.innerHTML = "";
  data.forEach(msg => appendMessage(msg));

  // mark messages as read
  await supa
    .from("messages")
    .update({ read: true })
    .eq("conversation_id", conversationId)
    .neq("sender_id", window.currentUser.id);

  // realtime listener for this conversation
  messageChannel = supa
    .channel("messages-" + conversationId)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `conversation_id=eq.${conversationId}`
      },
      payload => {
        appendMessage(payload.new);
      }
    )
    .subscribe();
}

/* ---------- APPEND MESSAGE ---------- */
function appendMessage(msg) {
  const list = document.getElementById("chat-messages");
  if (!list) return;

  const div = document.createElement("div");
  div.className =
    msg.sender_id === window.currentUser.id ? "msg me" : "msg them";

  div.textContent = msg.body;
  list.appendChild(div);
  list.scrollTop = list.scrollHeight;
}

/* ---------- SEND MESSAGE ---------- */
document.getElementById("chat-send-btn")?.addEventListener("click", async () => {
  const input = document.getElementById("chat-text");
  const body = input.value.trim();
  if (!body || !activeConversationId) return;

  const { error } = await supa.from("messages").insert({
    conversation_id: activeConversationId,
    sender_id: window.currentUser.id,
    body,
    read: false
  });

  if (error) {
    alert("Message failed");
    return;
  }

  input.value = "";
});

/* ---------- EXPOSE ---------- */
window.Messages = {
  loadInbox
};
