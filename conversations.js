// conversations.js (hardened)
console.error("💬 CONVERSATIONS.JS LOADED (hardened)");

// Create the module IMMEDIATELY so posts.js never sees it as undefined.
window.Conversations = window.Conversations || {};

function __bfGetSupa() {
  if (window.supa) return window.supa;
  return null;
}

async function getOrCreateConversation({ postId, buyerId, sellerId }) {
  const supa = __bfGetSupa();
  if (!supa) throw new Error("Supabase client not ready (window.supa missing)");
  if (!postId || !buyerId || !sellerId) throw new Error("Missing conversation parameters");

  const { data: existing, error: findErr } = await supa
    .from("conversations")
    .select("*")
    .eq("post_id", postId)
    .eq("buyer_id", buyerId)
    .eq("seller_id", sellerId)
    .maybeSingle();

  if (findErr) throw findErr;
  if (existing) return existing;

  const { data: created, error: insErr } = await supa
    .from("conversations")
    .insert({
      post_id: postId,
      buyer_id: buyerId,
      seller_id: sellerId
    })
    .select("*")
    .single();

  if (insErr) throw insErr;
  return created;
}

async function openConversationFromPost(post) {
  if (!post) throw new Error("Missing post");
  const buyerId = window.currentUser?.id;
  const sellerId = post.user_id;

  if (!buyerId) {
    alert("You must sign in to message.");
    return;
  }
  if (buyerId === sellerId) {
    alert("You can't message yourself.");
    return;
  }

  const convo = await getOrCreateConversation({
    postId: post.id,
    buyerId,
    sellerId
  });

  window.Messages?.loadInbox?.();
  window.Messages?.openConversation?.(convo.id);
  return convo;
}

window.Conversations.getOrCreateConversation = getOrCreateConversation;
window.Conversations.openConversationFromPost = openConversationFromPost;
