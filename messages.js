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
        sender_id
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
  list.innerHTML = "Loading...";

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
  data.forEach(msg => {
    const div = document.createElement("div");
    div.className =
      msg.sender_id === window.currentUser.id ? "msg me" : "msg them";
    div.textContent = msg.body;
    list.appendChild(div);
  });

  /* ---- REALTIME LISTENER (THIS IS THE “END OF FUNCTION”) ---- */
  if (messageChannel) {
    supa.removeChannel(messageChannel);
  }

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
        const msg = payload.new;
        if (msg.sender_id === window.currentUser.id) return;

        const div = document.createElement("div");
        div.className = "msg them";
        div.textContent = msg.body;
        document.getElementById("chat-messages").appendChild(div);
      }
    )
    .subscribe();
}

/* ---------- SEND MESSAGE ---------- */
document.getElementById("chat-send-btn")?.addEventListener("click", async () => {
  const input = document.getElementById("chat-text");
  const body = input.value.trim();
  if (!body || !activeConversationId) return;

  const { error } = await supa.from("messages").insert({
    conversation_id: activeConversationId,
    sender_id: window.currentUser.id,
    body
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
