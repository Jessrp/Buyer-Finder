// conversations.js (hardened)
console.error("💬 CONVERSATIONS.JS LOADED (hardened)");

// Create the module IMMEDIATELY so posts.js never sees it as undefined.
window.Conversations = window.Conversations || {};

function getSupa() {
  // Prefer the already-created client (your app uses window.supa)
  if (window.supa) return window.supa;

  // Fallback: try to build one if someone forgot to init it.
  // (Won't work without env values, but at least we fail with a clear error.)
  if (window.supabase?.createClient && window.SUPABASE_URL && window.SUPABASE_ANON_KEY) {
    try {
      window.supa = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
      return window.supa;
    } catch (e) {
      console.error("❌ Failed to create Supabase client in conversations.js", e);
    }
  }
  return null;
}

async function getOrCreateConversation({ postId, buyerId, sellerId }) {
  const supa = getSupa();
  if (!supa) throw new Error("Supabase client not ready (window.supa missing)");

  if (!postId || !buyerId || !sellerId) throw new Error("Missing conversation parameters");

  // 1) Find existing
  const { data: existing, error: findErr } = await supa
    .from("conversations")
    .select("*")
    .eq("post_id", postId)
    .eq("buyer_id", buyerId)
    .eq("seller_id", sellerId)
    .maybeSingle();

  if (findErr) throw findErr;
  if (existing) return existing;

  // 2) Create
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
  if (buyerId === sellerId) return; // talking to yourself is a cry for help

  const convo = await getOrCreateConversation({
    postId: post.id,
    buyerId,
    sellerId
  });

  // Optional hooks if/when you add inbox/chat UI
  window.Messages?.loadInbox?.();
  window.Messages?.openConversation?.(convo.id);

  return convo;
}

// Attach methods (keep the same API your posts.js expects)
window.Conversations.getOrCreateConversation = getOrCreateConversation;
window.Conversations.openConversationFromPost = openConversationFromPost;

// If anything throws at load time, you WILL see it.
window.addEventListener("error", (e) => {
  if ((e?.filename || "").includes("conversations.js")) {
    console.error("🔥 conversations.js runtime error:", e.message, e);
  }
});
