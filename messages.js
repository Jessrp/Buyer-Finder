// messages.js
let activeConversationId = null;

function showView(id) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.getElementById(id)?.classList.add("active");
}
async function loadInbox() {
  const user = window.currentUser;
  if (!user) return;

  const { data, error } = await supa
    .from("conversations")
    .select(`
      id,
      post_id,
      seller_id,
      buyer_id,
      created_at,
      posts ( title )
    `)
    .or(`seller_id.eq.${user.id},buyer_id.eq.${user.id}`)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Inbox load error", error);
    return;
  }

  const inbox = document.getElementById("inbox-list");
  inbox.innerHTML = "";

  if (!data.length) {
    inbox.innerHTML = "<p class='hint'>No messages yet.</p>";
    return;
  }

  data.forEach(convo => {
    const div = document.createElement("div");
    div.className = "list-item";
    div.textContent = convo.posts?.title || "Conversation";

    div.onclick = () => openConversation(convo.id);
    inbox.appendChild(div);
  });
}
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
    console.error("Message load error", error);
    list.innerHTML = "Failed to load messages";
    return;
  }

  list.innerHTML = "";

  data.forEach(msg => {
    const div = document.createElement("div");
    div.className =
      msg.sender_id === window.currentUser.id
        ? "msg me"
        : "msg them";

    div.textContent = msg.body;
    list.appendChild(div);
  });
}
(function () {
  console.error("📨 MESSAGES.JS LOADED");

  const supa = window.supa;

  // STEP 3 — load inbox
  async function loadInbox() {
    const user = window.currentUser;
    if (!user) return;

    const { data, error } = await supa
      .from("conversations")
      .select(`
        id,
        post_id,
        seller_id,
        buyer_id,
        posts(title),
        messages (
          body,
          created_at
        )
      `)
      .or(`seller_id.eq.${user.id},buyer_id.eq.${user.id}`)
      .order("created_at", { foreignTable: "messages", ascending: false });

    if (error) {
      console.error("Inbox load failed", error);
      return;
    }

    renderInbox(data);
  }

  // STEP 4 — render inbox
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
          <strong>${c.posts?.title || "Post"}</strong>
          <p>${last?.body || "No messages yet"}</p>
          <small>
            ${last ? new Date(last.created_at).toLocaleString() : ""}
          </small>
        </div>
      `;
    }).join("");

    list.querySelectorAll(".inbox-item").forEach(el => {
      el.onclick = () => openChat(el.dataset.id);
    });
  }

  // expose loader
  window.Messages = {
    loadInbox
  };
})();

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
  openConversation(activeConversationId);
});

window.Messages = {
  loadInbox
};
