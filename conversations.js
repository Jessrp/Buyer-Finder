// conversations.js — get or create conversations for posts
(function () {
  console.error("💬 CONVERSATIONS.JS LOADED (fixed)");

  function supa() { return window.supa; }

  async function getOrCreateConversation({ postId, buyerId, sellerId }) {
    if (!postId || !buyerId || !sellerId) throw new Error("Missing conversation parameters");

    const client = supa();
    if (!client) throw new Error("Supabase not ready");

    // 1) find existing
    const { data: existing, error: findError } = await client
      .from("conversations")
      .select("*")
      .eq("post_id", postId)
      .eq("buyer_id", buyerId)
      .eq("seller_id", sellerId)
      .maybeSingle();

    if (findError) throw findError;
    if (existing) return existing;

    // 2) create
    const { data: created, error: createError } = await client
      .from("conversations")
      .insert({ post_id: postId, buyer_id: buyerId, seller_id: sellerId })
      .select()
      .single();

    if (createError) throw createError;
    return created;
  }

  async function openConversationFromPost(post) {
    const user = window.currentUser;
    if (!user || !post) return;

    const buyerId = user.id;
    const sellerId = post.user_id;
    if (buyerId === sellerId) return;

    const convo = await getOrCreateConversation({ postId: post.id, buyerId, sellerId });
    window.Messages?.loadInbox?.();
    window.Messages?.openConversation?.(convo.id);
  }

  window.Conversations = { getOrCreateConversation, openConversationFromPost };
})();
