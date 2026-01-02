function notify(msg) {
  const n = document.createElement('div');
  n.className = 'toast';
  n.textContent = msg;
  notificationsContainer.appendChild(n);
  setTimeout(() => n.remove(), 3000);
}