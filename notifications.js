// notifications.js
function initNotifications() {
  if (!window.Posts) {
    setTimeout(initNotifications, 50);
    return;
  }

  if (window.Posts.loadMatches) window.Posts.loadMatches();

  console.log("🔔 Notifications initialized");
}

initNotifications();
