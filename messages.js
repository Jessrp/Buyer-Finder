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
