// matches.js
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

        if (window.showBrowserNotification) {
          window.showBrowserNotification({
            title: "New Match",
            body: "You have a new buyer/seller match",
          });
        }

        if (window.addMatchToUI) {
          window.addMatchToUI(match);
        }
      }
    )
    .subscribe();
}
