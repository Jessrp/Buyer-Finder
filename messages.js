// messages.js — inbox + chat overlay (BuyrFindr)
(function () {
  console.error("📨 MESSAGES.JS LOADED");

  function supa() { return window.supa; }

  let activeConversationId = null;
  let messageChannel = null;
  const seenIds = new Set();

  function ensureUI() {
    var overlay = document.getElementById("bf-chat-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "bf-chat-overlay";
      overlay.style.cssText = "position:fixed;left:0;top:0;width:100vw;height:100vh;background:rgba(0,0,0,0.55);z-index:9999;display:none;box-sizing:border-box;padding:16px;align-items:center;justify-content:center;";
      overlay.addEventListener("click", function(e) { if (e.target === overlay) hide(); });
      document.body.appendChild(overlay);
    }

    var panel = document.getElementById("bf-chat-panel");
    if (!panel) {
      panel = document.createElement("div");
      panel.id = "bf-chat-panel";
      panel.style.cssText = "width:100%;height:85vh;background:var(--card,#111);border-radius:16px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 12px 40px rgba(0,0,0,0.5);box-sizing:border-box;";
      overlay.appendChild(panel);
    }

    var header = document.getElementById("bf-chat-header");
    if (!header) {
      header = document.createElement("div");
      header.id = "bf-chat-header";
      header.style.cssText = "display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-bottom:1px solid rgba(255,255,255,0.08);flex-shrink:0;";
      header.innerHTML = '<div style="font-weight:700;" id="bf-chat-title">Messages</div><div style="display:flex;gap:8px;"><button id="bf-chat-inbox-btn" class="btn small">Inbox</button><button id="bf-chat-close-btn" class="btn small">✕</button></div>';
      panel.appendChild(header);
    }

    var body = document.getElementById("bf-chat-body");
    if (!body) {
      body = document.createElement("div");
      body.id = "bf-chat-body";
      body.style.cssText = "flex:1;overflow:hidden;display:flex;min-height:0;";
      panel.appendChild(body);
    }

    var inbox = document.getElementById("inbox-list");
    if (!inbox) {
      inbox = document.createElement("div");
      inbox.id = "inbox-list";
      inbox.style.cssText = "overflow-y:auto;-webkit-overflow-scrolling:touch;padding:12px;width:100%;touch-action:pan-y;";
      body.appendChild(inbox);
    }

    var chatWrap = document.getElementById("bf-chat-wrap");
    if (!chatWrap) {
      chatWrap = document.createElement("div");
      chatWrap.id = "bf-chat-wrap";
      chatWrap.style.cssText = "display:none;flex:1;flex-direction:column;min-height:0;width:100%;";
      body.appendChild(chatWrap);
    }

    var chatMessages = document.getElementById("chat-messages");
    if (!chatMessages) {
      chatMessages = document.createElement("div");
      chatMessages.id = "chat-messages";
      chatMessages.style.cssText = "flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:12px;display:flex;flex-direction:column;gap:8px;touch-action:pan-y;min-height:0;";
      chatWrap.appendChild(chatMessages);
    }

    var composer = document.getElementById("bf-chat-composer");
    if (!composer) {
      composer = document.createElement("div");
      composer.id = "bf-chat-composer";
      composer.style.cssText = "display:flex;gap:8px;padding:10px 12px;border-top:1px solid rgba(255,255,255,0.08);flex-shrink:0;";
      composer.innerHTML = '<input id="chat-text" placeholder="Type a message…" style="flex:1;padding:10px;border-radius:10px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.06);color:inherit;min-width:0;" /><button id="chat-send-btn" class="btn small">Send</button>';
      chatWrap.appendChild(composer);
    }

    var closeBtn = document.getElementById("bf-chat-close-btn");
    if (closeBtn && !closeBtn.dataset.bound) {
      closeBtn.dataset.bound = "1";
      closeBtn.addEventListener("click", hide);
    }
    var inboxBtn = document.getElementById("bf-chat-inbox-btn");
    if (inboxBtn && !inboxBtn.dataset.bound) {
      inboxBtn.dataset.bound = "1";
      inboxBtn.addEventListener("click", function() { loadInbox(); });
    }
    var sendBtn = document.getElementById("chat-send-btn");
    if (sendBtn && !sendBtn.dataset.bound) {
      sendBtn.dataset.bound = "1";
      sendBtn.addEventListener("click", sendActiveMessage);
    }
    var input = document.getElementById("chat-text");
    if (input && !input.dataset.bound) {
      input.dataset.bound = "1";
      input.addEventListener("keydown", function(e) {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          sendActiveMessage();
        }
      });
    }
  }

  function show() {
    ensureUI();
    var o = document.getElementById("bf-chat-overlay");
    o.style.display = "flex";
  }

  function hide() {
    var o = document.getElementById("bf-chat-overlay");
    if (o) o.style.display = "none";
  }

  function switchToChat() {
    ensureUI();
    document.getElementById("inbox-list").style.display = "none";
    document.getElementById("bf-chat-wrap").style.display = "flex";
  }

  function switchToInbox() {
    ensureUI();
    document.getElementById("bf-chat-wrap").style.display = "none";
    document.getElementById("inbox-list").style.display = "block";
  }

  function fmtTime(ts) {
    try { return new Date(ts).toLocaleString(); } catch(e) { return ""; }
  }

  function lastSeenLabel(ts) {
    if (!ts) return "Unknown";
    var diff = Date.now() - new Date(ts).getTime();
    var mins  = Math.floor(diff / 60000);
    var hours = Math.floor(diff / 3600000);
    var days  = Math.floor(diff / 86400000);
    if (mins < 2)    return "Active now";
    if (mins < 60)   return "Active " + mins + "m ago";
    if (hours < 3)   return "Active earlier today";
    if (hours < 24)  return "Active today";
    if (days === 1)  return "Last seen yesterday";
    if (days < 7)    return "Last seen " + days + " days ago";
    if (days < 14)   return "Last seen over a week ago";
    if (days < 30)   return "Last seen a few weeks ago";
    return "Last seen a long time ago";
  }

  async function loadInbox() {
    show();
    switchToInbox();

    var client = supa();
    var user = window.currentUser;
    var list = document.getElementById("inbox-list");

    if (!user) { list.innerHTML = "<p class='hint'>Sign in to see messages.</p>"; return; }
    if (!client) { list.innerHTML = "<p class='hint'>Supabase not ready yet.</p>"; return; }

    list.innerHTML = "<p class='hint'>Loading inbox…</p>";

    var res = await client
      .from("conversations")
      .select("id, post_id, buyer_id, seller_id, posts(title), messages(body, created_at, sender_id, read_at)")
      .or("seller_id.eq." + user.id + ",buyer_id.eq." + user.id)
      .order("created_at", { foreignTable: "messages", ascending: false });

    if (res.error) {
      console.error("Inbox load error", res.error);
      list.innerHTML = "<p class='hint'>Failed to load inbox.</p>";
      return;
    }

    var convos = res.data || [];
    if (!convos.length) {
      list.innerHTML = "<p class='hint'>No messages yet.</p>";
      return;
    }

    var otherIds = [...new Set(convos.map(function(c) {
      return c.buyer_id === user.id ? c.seller_id : c.buyer_id;
    }))];

    var profRes = await client
      .from("public_profiles")
      .select("id, username, avatar_url, last_seen")
      .in("id", otherIds);

    var profileMap = {};
    (profRes.data || []).forEach(function(p) { profileMap[p.id] = p; });

    list.innerHTML = convos.map(function(c) {
      var otherId   = c.buyer_id === user.id ? c.seller_id : c.buyer_id;
      var other     = profileMap[otherId] || {};
      var otherName = other.username || "Unknown";
      var title     = c.posts && c.posts.title ? c.posts.title : "Conversation";
      var msgs      = c.messages || [];
      var latest    = msgs.sort(function(a, b) { return new Date(b.created_at) - new Date(a.created_at); })[0];
      var snippet   = latest && latest.body ? latest.body : "No messages yet";
      var isMe      = latest && latest.sender_id === user.id;
      var time      = latest && latest.created_at ? fmtTime(latest.created_at) : "";
      var lastSeen  = lastSeenLabel(other.last_seen);
      var unreadCount = msgs.filter(function(m) { return m.sender_id !== user.id && !m.read_at; }).length;
      var unreadBadge = unreadCount > 0
        ? '<span style="background:#ff3b30;color:#fff;border-radius:999px;font-size:11px;padding:1px 7px;margin-left:6px;">' + unreadCount + '</span>'
        : "";
      var initials   = otherName.slice(0, 2).toUpperCase();
      var avatarHtml = other.avatar_url
        ? '<img src="' + other.avatar_url + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">'
        : initials;

      return '<div class="inbox-item" data-id="' + c.id + '" style="padding:12px;border:1px solid rgba(255,255,255,0.10);border-radius:12px;margin-bottom:10px;cursor:pointer;display:flex;gap:12px;align-items:center;">'
        + '<div style="width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,var(--accent2),var(--accent));display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;flex-shrink:0;overflow:hidden;">' + avatarHtml + '</div>'
        + '<div style="flex:1;min-width:0;">'
        + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px;">'
        + '<div style="font-weight:700;font-size:14px;">' + otherName + unreadBadge + '</div>'
        + '<small style="color:var(--muted);font-size:10px;flex-shrink:0;margin-left:8px;">' + time + '</small>'
        + '</div>'
        + '<div style="font-size:11px;color:var(--muted);margin-bottom:3px;">📝 ' + title + '</div>'
        + '<div style="font-size:12px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + (isMe ? '<span style="color:var(--accent);font-size:11px;">You: </span>' : "") + snippet + '</div>'
        + '<div style="font-size:10px;color:var(--muted);margin-top:3px;opacity:0.6;">🕐 ' + lastSeen + '</div>'
        + '</div></div>';
    }).join("");

    list.querySelectorAll(".inbox-item").forEach(function(el) {
      el.addEventListener("click", function() { openConversation(el.dataset.id); });
    });
  }

  function addMessageToUI(msg) {
    if (!msg) return;
    if (msg.id && seenIds.has(msg.id)) return;
    if (msg.id) seenIds.add(msg.id);

    ensureUI();
    var list = document.getElementById("chat-messages");
    var mine = msg.sender_id === (window.currentUser && window.currentUser.id);

    var wrap = document.createElement("div");
    wrap.dataset.msgId = msg.id || "";
    wrap.style.cssText = "display:flex;flex-direction:column;align-items:" + (mine ? "flex-end" : "flex-start") + ";";

    var bubble = document.createElement("div");
    bubble.style.cssText = "max-width:80%;padding:10px 12px;border-radius:14px;background:" + (mine ? "rgba(0,223,162,0.18)" : "rgba(255,255,255,0.08)") + ";color:inherit;word-break:break-word;overflow-wrap:break-word;white-space:pre-wrap;";
    bubble.textContent = msg.body || "";

    var stamp = document.createElement("div");
    stamp.style.cssText = "opacity:.55;font-size:11px;margin-top:3px;display:flex;align-items:center;gap:4px;";
    stamp.textContent = msg.created_at ? fmtTime(msg.created_at) : "";

    if (mine && msg.read_at) {
      var seen = document.createElement("span");
      seen.style.cssText = "color:#00dfa2;font-size:10px;";
      seen.textContent = "✓ Seen";
      stamp.appendChild(seen);
    }

    wrap.appendChild(bubble);
    wrap.appendChild(stamp);
    list.appendChild(wrap);
  }

  function updateReadReceiptsInUI(messages) {
    var list = document.getElementById("chat-messages");
    if (!list) return;
    messages.forEach(function(msg) {
      if (!msg.read_at) return;
      var wrap = list.querySelector('[data-msg-id="' + msg.id + '"]');
      if (!wrap) return;
      var stamp = wrap.querySelector("div:last-child");
      if (!stamp) return;
      if (!stamp.querySelector(".seen-label")) {
        var seen = document.createElement("span");
        seen.className = "seen-label";
        seen.style.cssText = "color:#00dfa2;font-size:10px;";
        seen.textContent = "✓ Seen";
        stamp.appendChild(seen);
      }
    });
  }

  function scrollToBottom() {
    var list = document.getElementById("chat-messages");
    if (!list) return;
    requestAnimationFrame(function() { list.scrollTop = list.scrollHeight; });
  }

  async function openConversation(conversationId) {
    show();
    switchToChat();

    activeConversationId = conversationId;
    seenIds.clear();

    var client = supa();
    var user   = window.currentUser;
    var list   = document.getElementById("chat-messages");
    list.innerHTML = "<div class='hint'>Loading…</div>";

    var msgRes = await client
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at");

    if (msgRes.error) {
      list.innerHTML = "<div class='hint'>Failed to load messages.</div>";
      return;
    }

    var convoRes = await client
      .from("conversations")
      .select("buyer_id, seller_id")
      .eq("id", conversationId)
      .single();

    var otherProfile = null;
    if (convoRes.data) {
      var otherId = convoRes.data.buyer_id === user.id ? convoRes.data.seller_id : convoRes.data.buyer_id;
      var profRes = await client
        .from("public_profiles")
        .select("username, last_seen")
        .eq("id", otherId)
        .single();
      otherProfile = profRes.data;
    }

    var titleEl = document.getElementById("bf-chat-title");
    if (titleEl && otherProfile) {
      titleEl.innerHTML = '<div style="line-height:1.2;"><div style="font-weight:700;">' + (otherProfile.username || "Chat") + '</div><div style="font-size:10px;color:var(--muted);font-weight:400;">' + lastSeenLabel(otherProfile.last_seen) + '</div></div>';
    }

    await client.rpc("mark_messages_read", {
      p_conversation_id: conversationId,
      p_user_id: user.id,
    });

    list.innerHTML = "";
    (msgRes.data || []).forEach(function(msg) { addMessageToUI(msg); });
    scrollToBottom();

    var input = document.getElementById("chat-text");
    if (input) setTimeout(function() { input.focus(); }, 50);

    if (messageChannel) client.removeChannel(messageChannel);

    messageChannel = client
      .channel("messages-" + conversationId)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: "conversation_id=eq." + conversationId },
        async function(payload) {
          var msg = payload.new;
          if (!msg) return;
          addMessageToUI(msg);
          scrollToBottom();
          if (msg.sender_id !== user.id) {
            await client.rpc("mark_messages_read", {
              p_conversation_id: conversationId,
              p_user_id: user.id,
            });
            if (window.Notifications && window.Notifications.notify) {
              window.Notifications.notify("New Message", msg.body || "You have a new message.");
            }
          }
        }
      )
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: "conversation_id=eq." + conversationId },
        function(payload) {
          if (payload.new && payload.new.read_at) {
            updateReadReceiptsInUI([payload.new]);
          }
        }
      )
      .subscribe();
  }

  async function sendActiveMessage() {
    var client = supa();
    var me    = window.currentUser && window.currentUser.id;
    var input = document.getElementById("chat-text");
    var body  = (input && input.value || "").trim();
    if (!body || !activeConversationId) return;
    if (input) input.value = "";

    var res = await client
      .from("messages")
      .insert({ conversation_id: activeConversationId, sender_id: me, body: body })
      .select("*")
      .single();

    if (res.error) {
      console.error("Message insert failed", res.error);
      alert("Message failed.");
      return;
    }

    addMessageToUI(res.data || { conversation_id: activeConversationId, sender_id: me, body: body, created_at: new Date().toISOString() });
    scrollToBottom();
  }

  window.Messages = { loadInbox: loadInbox, openConversation: openConversation };
  window.openConversation = openConversation;
})();
