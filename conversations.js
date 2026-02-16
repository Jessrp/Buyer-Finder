// conversations.js
console.error("💬 CONVERSATIONS.JS LOADED");

const supa = window.supa;

/* ---------- GET OR CREATE CONVERSATION ---------- */
async function getOrCreateConversation({ postId, buyerId, sellerId }) {
  if (!postId || !buyerId || !sellerId) {
    throw new Error("Missing conversation parameters");
  }

  // 1. Try to find existing conversation
  const { data: existing, error: findError } = await supa
    .from("conversations")
    .select("*")
    .eq("post_id", postId)
    .eq("buyer_id", buyerId)
    .eq("seller_id", sellerId)
    .maybeSingle();

  if (findError) {
    console.error("Conversation lookup failed", findError);
    throw findError;
  }

  if (existing) {
    return existing;
  }

  // 2. Create conversation if none exists
  const { data: created, error: createError } = await supa
    .from("conversations")
    .insert({
      post_id: postId,
      buyer_id: buyerId,
      seller_id: sellerId
    })
    .select()
    .single();

  if (createError) {
    console.error("Conversation creation failed", createError);
    throw createError;
  }

  return created;
}

/* ---------- OPEN FROM POST ---------- */
async function openConversationFromPost(post) {
  const user = window.currentUser;
  if (!user) return;

  const buyerId = user.id;
  const sellerId = post.user_id;

  if (buyerId === sellerId) return; // talking to yourself is a cry for help

  const convo = await getOrCreateConversation({
    postId: post.id,
    buyerId,
    sellerId
  });

  if (window.Messages?.loadInbox) {
    window.Messages.loadInbox();
  }

  if (window.openConversation) {
    window.openConversation(convo.id);
  }
}

/* ---------- EXPOSE ---------- */
window.Conversations = {
  getOrCreateConversation,
  openConversationFromPost
};
