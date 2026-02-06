// matches.js

async function runRetroactiveMatchCheck() {
  const user = window.currentUser;
  if (!user) return;

  // Get all posts by this user
  const { data: myPosts, error } = await supa
    .from("posts")
    .select("*")
    .eq("user_id", user.id);

  if (error) {
    console.log("retro match fetch error", error.message);
    return;
  }

  for (const post of myPosts) {
    await checkForMatches(post);
  }
}

window.runRetroactiveMatchCheck = runRetroactiveMatchCheck;

export function initMatchListener() {
  if (!window.currentUser) return;

  supa
    .channel("matches-listener")
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "matches",
      },
      (payload) => {
        const match = payload.new;

        const isMine =
          match.buyer_id === window.currentUser.id ||
          match.seller_id === window.currentUser.id;

        if (!isMine) return;

        // Notification
        if (window.showBrowserNotification) {
          window.showBrowserNotification({
            title: "New Match",
            body: "You have a new buyer/seller match",
          });
        }

        // UI hook (optional)
        if (window.addMatchToUI) {
          window.addMatchToUI(match);
        }
      }
    )
    .subscribe();
}
