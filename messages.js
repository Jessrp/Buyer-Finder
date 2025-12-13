// messages.js — threaded inbox + unread badges + BF+ read locks

(function () {
  const supa = window.supa;

  const panel = document.getElementById("messages-panel");
  const list = document.getElementById("messages-list");
  const empty = document.getElementById("messages-empty");
  const closeBtn = document.getElementById("messages-close");

  if (!panel || !list) {
    console.warn("messages.js: inbox elements missing");
    return;
  }

  window.isPremiumUser =
    window.isPremiumUser || (() => !!window.currentProfile?.premium);

  let activeThreadKey = null;

  /* ---------------- LOAD THREADS ---------------- */

  async function loadThreads() {
    const user = window.currentUser;
    if (!user) {
      empty.textContent = "Sign in to view messages.";
      list.innerHTML = "";
      return;
    }

    empty.textContent = "Loading…";
    list.innerHTML = "";

    const { data: messages, error } = await supa
      .from("messages")
      .select("id, body, created_at, from_user, to_user, post_id")
      .or(`from_user.eq.${user.id},to_user.eq.${user.id}`)
      .order("created_at", { ascending: false });

    if (error) {
      empty.textContent = "Failed to load messages.";
      return;
    }

    if (!messages?.length) {
      empty.textContent = "No messages yet.";
      return;
    }

    const threads = {};
    messages.forEach((m) => {
      const other =
        m.from_user === user.id ? m.to_user : m.from_user;
      const key = `${other}:${m.post_id || "nopost"}`;
      threads[key] = threads[key] || [];
      threads[key].push(m);
    });

    empty.textContent = "";

    const { data: counter } = await supa
      .from("message_counters")
      .select("received_count")
      .eq("user_id", user.id)
      .maybeSingle();

    const readLocked =
      !window.isPremiumUser() && (counter?.received_count || 0) >= 3;

    list.innerHTML = Object.entries(threads)
      .map(([key, msgs]) => {
        const last = msgs[0];
        const incoming = last.to_user === user.id;

        const preview =
          readLocked && incoming
            ? "🔒 Upgrade to BF+ to read"
            : escape(last.body).slice(0, 60);

        return `
          <div class="thread-item" data-key="${key}">
            <div class="thread-preview">${preview}</div>
            <small>${new Date(last.created_at).toLocaleString()}</small>
          </div>
        `;
      })
      .join("");

    attachThreadHandlers(threads, readLocked);
  }

  /* ---------------- THREAD VIEW ---------------- */

  function attachThreadHandlers(threads, readLocked) {
    list.querySelectorAll(".thread-item").forEach((el) => {
      el.onclick = () => {
        const key = el.dataset.key;
        openThread(key, threads[key], readLocked);
      };
    });
  }

  function openThread(key, messages, readLocked) {
    const user = window.currentUser;
    activeThreadKey = key;

    list.innerHTML = messages
      .slice()
      .reverse()
      .map((m) => {
        const incoming = m.to_user === user.id;
        const body =
          readLocked && incoming
            ? "🔒 Upgrade to BF+ to read this message."
            : escape(m.body);

        return `
          <div class="bubble ${incoming ? "incoming" : "outgoing"}">
            ${body}
          </div>
        `;
      })
      .join("");

    if (!readLocked) injectReplyBox(messages[0]);
  }

  /* ---------------- REPLY ---------------- */

  function injectReplyBox(lastMsg) {
    if (!window.isPremiumUser()) return;

    const box = document.createElement("div");
    box.className = "reply-box";
    box.innerHTML = `
      <input id="reply-input" placeholder="Type a message…" />
      <button id="reply-send">Send</button>
    `;

    list.appendChild(box);

    document.getElementById("reply-send").onclick = async () => {
      const input = document.getElementById("reply-input");
      const body = input.value.trim();
      if (!body) return;

      const user = window.currentUser;
      const to =
        lastMsg.from_user === user.id
          ? lastMsg.to_user
          : lastMsg.from_user;

      await supa.from("messages").insert({
        body,
        from_user: user.id,
        to_user: to,
        post_id: lastMsg.post_id || null,
      });

      input.value = "";
      loadThreads();
    };
  }

  /* ---------------- API ---------------- */

  window.Messages = {
    open() {
      panel.classList.add("active");
      loadThreads();
    },
    close() {
      panel.classList.remove("active");
    },
    reload() {
      loadThreads();
    },
  };

  closeBtn?.addEventListener("click", () => panel.classList.remove("active"));

  /* ---------------- UTIL ---------------- */

  function escape(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }
})();
