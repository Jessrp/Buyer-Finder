(function () {
// notifications.js
console.error("🔔 NOTIFICATIONS.JS LOADED");

let notificationsEnabled = false;

/* ---------- INIT ---------- */
function initNotifications() {
  if (!("Notification" in window)) {
    console.warn("Notifications not supported");
    return;
  }

  if (Notification.permission === "granted") {
    notificationsEnabled = true;
  } else if (Notification.permission !== "denied") {
    Notification.requestPermission().then(permission => {
      notificationsEnabled = permission === "granted";
    });
  }
}

/* ---------- SHOW ---------- */
function notify(title, body) {
  if (!notificationsEnabled) return;
  if (document.hasFocus()) return;

  try {
    new Notification(title, { body });
  } catch (e) {
    console.warn("Notification failed", e);
  }
}

/* ---------- EXPOSE ---------- */
window.Notifications = {
  init: initNotifications,
  notify
};

})();
