// messages.js
console.error("📨 MESSAGES.JS LOADED");

const supa = window.supa;

/**
 * Minimal, non-crashy Messages module.
 * This app’s current UI sends the first message from the post detail panel.
 * Inbox/chat UI can be added later without breaking production.
 */
async function loadInbox() {
  // No inbox UI in current index.html, so keep this as a no-op for now.
  return;
}

async function openConversation(conversationId) {
  // No chat view in current index.html, so keep this as a no-op for now.
  return;
}

window.Messages = {
  loadInbox,
  openConversation
};

// (Optional) expose for older code paths
window.openConversation = openConversation;
