// matches.js — renders matches + realtime listener (BuyerFinder schema)
// Non-module script: attaches to window.Matches
(function () {
  console.error("✨ MATCHES.JS LOADED (BF schema + threshold + legend + actions)");

  // Only call something a "Match" at/above this score.
  const MATCH_THRESHOLD = 70;

  // If true: hide items below threshold from the Matches tab.
  const HIDE_BELOW_THRESHOLD = true;

  function supa() { return window.supa; }

  function ensureListEl() {
    let el = document.getElementById("matches-list");
    if (el) return el;

    const view = document.getElementById("view-matches");
    if (view) {
      el = document.createElement("div");
      el.id = "matches-list";
      view.appendChild(el);
      return el;
    }

    el = document.createElement("div");
    el.id = "matches-list";
    document.body.appendChild(el);
    return el;
  }

  function fmtTime(ts) {
    try { return new Date(ts).toLocaleString(); }
    catch { return ""; }
  }

  function scoreLabel(score) {
    const s = Number(score);
    if (!Number.isFinite(s)) return { tag: "—", cls: "pill" };
    if (s >= 90) return { tag: "🔥 Perfect", cls: "pill premium" };
    if (s >= 80) return { tag: "Strong", cls: "pill" };
    if (s >= MATCH_THRESHOLD) return { tag: "Match", cls: "pill" };
    if (s >= 55) return { tag: "Potential", cls: "pill" };
    if (s >= 35) return { tag: "Weak", cls: "pill" };
    return { tag: "Very weak", cls: "pill" };
  }

  function legendHtml() {
    return `
      <div class="card" style="margin:12px 0;padding:10px 12px;border:1px solid rgba(255,255,255,0.10);border-radius:14px;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
          <strong>Match Score Guide</strong>
          <button class="btn small" id="toggle-score-guide">Show/Hide</button>
        </div>
        <div id="score-guide-body" style="margin-top:10px;display:none;">
          <div class="muted" style="opacity:.8;margin-bottom:8px;">
            Score is a rough relevance estimate (keywords + category + location + intent). Higher = closer fit.
          </div>
          <div style="display:grid;grid-template-columns:1fr;gap:6px;">
            <div><span class="pill">90–100</span> 🔥 Perfect (basically the same thing)</div>
            <div><span class="pill">80–89</span> Strong (very likely what they want)</div>
            <div><span class="pill">70–79</span> Match (good enough to notify)</div>
            <div><span class="pill">55–69</span> Potential (maybe, but not guaranteed)</div>
            <div><span class="pill">35–54</span> Weak (loose similarity)</div>
            <div><span class="pill">0–34</span> Very weak (noise)</div>
          </div>
          <div class="muted" style="opacity:.75;margin-top:8px;">
            Current threshold to be called a “Match”: <strong>${MATCH_THRESHOLD}+</strong>
          </div>
        </div>
      </div>
    `;
  }

  function bindLegendToggle(container) {
    const btn = container.querySelector("#toggle-score-guide");
    const body = container.querySelector("#score-guide-body");
    if (!btn || !body || btn.dataset.bound) return;
    btn.dataset.bound = "1";
    btn.addEventListener("click", () => {
      body.style.display = (body.style.display === "none") ? "block" : "none";
    });
  }

  function convKey(postId, buyerId, sellerId) {
    return `${String(postId)}|${String(buyerId)}|${String(sellerId)}`;
  }

  async function getOrCreateConversationId({ postId, buyerId, sellerId }) {
    const client = supa();
    if (!client) throw new Error("Supabase not ready");

    // Prefer your RPC if it exists
    try {
      const { data, error } = await client.rpc("get_or_create_conversation", {
        p_post_id: postId,
        p_buyer_id: buyerId,
        p_seller_id: sellerId
      });
      if (error) throw error;
      if (data) return data;
    } catch (e) {
      // fall through to direct insert
    }

    // Direct approach: try find, then insert
    const { data: existing, error: findErr } = await client
      .from("conversations")
      .select("id")
      .eq("post_id", postId)
      .eq("buyer_id", buyerId)
      .eq("seller_id", sellerId)
      .maybeSingle();

    if (findErr) throw findErr;
    if (existing?.id) return existing.id;

    const { data: created, error: insErr } = await client
      .from("conversations")
      .insert({ post_id: postId, buyer_id: buyerId, seller_id: sellerId })
      .select("id")
      .single();

    if (insErr) throw insErr;
    return created.id;
  }

  function openConversationUI(conversationId) {
    if (window.Messages && typeof window.Messages.openConversation === "function") {
      window.Messages.openConversation(conversationId);
      return;
    }
    window.activeConversationId = conversationId;
    if (typeof window.showView === "function") window.showView("view-chat");
    if (typeof window.setActiveView === "function") window.setActiveView("messages");
  }

  function openPostUI(postId) {
    if (window.Posts) {
      if (typeof window.Posts.openPostById === "function") return window.Posts.openPostById(postId);
      if (typeof window.Posts.openPost === "function") return window.Posts.openPost(postId);
    }

    window.__bf_pending_open_post_id = postId;
    if (typeof window.setActiveView === "function") window.setActiveView("posts");
    const postsView = document.getElementById("view-posts");
    if (postsView) postsView.scrollIntoView({ behavior: "smooth", block: "start" });
    alert("Switched to Posts. If the post doesn't auto-open, tap it in the list.");
  }

  function bindActionButtons(container) {
    if (container.dataset.actionsBound === "1") return;
    container.dataset.actionsBound = "1";

    container.addEventListener("click", async (e) => {
      const btn = e.target?.closest?.("button[data-action]");
      if (!btn) return;

      const action = btn.dataset.action;
      const postId = btn.dataset.postId;
      const convoId = btn.dataset.convoId;
      const buyerId = btn.dataset.buyerId;
      const sellerId = btn.dataset.sellerId;

      if (action === "view-post") {
        if (!postId) return;
        openPostUI(postId);
        return;
      }

      if (action === "chat") {
        const original = btn.textContent;
        try {
          btn.disabled = true;
          btn.textContent = "Opening...";

          let id = convoId;
          if (!id) {
            id = await getOrCreateConversationId({ postId, buyerId, sellerId });
          }
          openConversationUI(id);
        } catch (err) {
          console.error("Open/Start conversation failed:", err);
          alert("Could not open conversation: " + (err?.message || "unknown error"));
        } finally {
          btn.disabled = false;
          btn.textContent = original || (convoId ? "View Conversation" : "Start Conversation");
        }
      }
    });
  }

  async function loadMatches() {
    const client = supa();
    const user = window.currentUser;
    const list = ensureListEl();

    if (!user) { list.innerHTML = "<p class='hint'>Sign in to see matches.</p>"; return; }
    if (!client) { list.innerHTML = "<p class='hint'>Supabase not ready yet.</p>"; return; }

    list.innerHTML = "<p class='hint'>Loading matches...</p>";

    const { data: rows, error } = await client
      .from("matches")
      .select("*")
      .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      console.error("loadMatches error:", error);
      list.innerHTML = "<p class='hint'>Failed to load matches: " + (error.message || "unknown") + "</p>";
      return;
    }

    let matches = rows || [];
    if (!matches.length) { list.innerHTML = "<p class='hint'>No matches yet.</p>"; return; }

    // Fetch post info
    const postIds = Array.from(new Set(matches.flatMap(m => [m.buy_post_id, m.sell_post_id]).filter(Boolean).map(String)));
    let postsById = {};
    if (postIds.length) {
      const { data: posts, error: pErr } = await client
        .from("posts")
        .select("id,title,price,type,user_id")
        .in("id", postIds);
      if (!pErr && posts) postsById = Object.fromEntries(posts.map(p => [String(p.id), p]));
    }


    // Apply threshold filtering using a sanity-checked display score (needs post titles/types)
    if (HIDE_BELOW_THRESHOLD) {
      matches = matches.filter(m => {
        const buy = postsById[String(m.buy_post_id)] || {};
        const sell = postsById[String(m.sell_post_id)] || {};
        const adj = adjustedDisplayScore(m.score, buy, sell);
        return adj >= MATCH_THRESHOLD;
      });

      if (!matches.length) {
        list.innerHTML = legendHtml() + "<p class='hint'>No matches above the threshold yet.</p>";
        bindLegendToggle(list);
        return;
      }
    }

    // Prefetch conversations for these sell posts (so we can label "View" vs "Start")
    const sellPostIds = Array.from(new Set(matches.map(m => m.sell_post_id).filter(Boolean).map(String)));
    let convByKey = {};
    if (sellPostIds.length) {
      const { data: convos, error: cErr } = await client
        .from("conversations")
        .select("id,post_id,buyer_id,seller_id")
        .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
        .in("post_id", sellPostIds)
        .limit(500);
      if (!cErr && convos) {
        convByKey = Object.fromEntries(convos.map(c => [convKey(c.post_id, c.buyer_id, c.seller_id), c.id]));
      }
    }

    // Fetch user names for buyer/seller so matches are clear
    const userIds = Array.from(new Set(matches.flatMap(m => [m.buyer_id, m.seller_id]).filter(Boolean).map(String)));
    let profilesById = {};
    if (userIds.length) {
      const { data: profs, error: uErr } = await client
        .from("profiles")
        .select("id,username")
        .in("id", userIds);
      if (!uErr && profs) {
        profilesById = Object.fromEntries(profs.map(p => [String(p.id), p]));
      }
    }

    let html = legendHtml();
    html += matches.map(m => {
      const buy = postsById[String(m.buy_post_id)] || {};
      const sell = postsById[String(m.sell_post_id)] || {};
      const s = adjustedDisplayScore(m.score, buy, sell);
      const lbl = scoreLabel(s);

      const title = `Match: ${buy.title || "Request"} ↔ ${sell.title || "Sell"}`;
      const when = m.created_at ? fmtTime(m.created_at) : "";
      const buyerName = profilesById[String(m.buyer_id)]?.username || "Buyer";
      const sellerName = profilesById[String(m.seller_id)]?.username || "Seller";
      const reqPrice = (buy.price != null && buy.price !== "") ? String(buy.price) : "";
      const sellPrice = (sell.price != null && sell.price !== "") ? String(sell.price) : "";

      const kind = (Number.isFinite(s) && s >= MATCH_THRESHOLD) ? "match" : "potential";
      const kindText = (kind === "match") ? "Match" : "Potential";

      // "View Post" should take user to the OTHER post (the one they don't own)
      const myId = String(user.id);
      const buyOwner = String(buy.user_id || m.buyer_id || "");
      const sellOwner = String(sell.user_id || m.seller_id || "");

      let viewPostId = m.sell_post_id || m.buy_post_id; // sane fallback
      if (myId === buyOwner) viewPostId = m.sell_post_id || viewPostId;
      else if (myId === sellOwner) viewPostId = m.buy_post_id || viewPostId;

      // Conversations are keyed by SELL post + buyer + seller
      const cKey = convKey(m.sell_post_id, m.buyer_id, m.seller_id);
      const existingConvoId = convByKey[cKey] || "";

      const badgeText = (Number.isFinite(s) ? `${lbl.tag} · ${s}` : lbl.tag);

      return `
        <div class="match-item" data-id="${m.id}" data-kind="${kind}"
             style="padding:10px 12px;border:1px solid rgba(255,255,255,0.10);border-radius:14px;margin:10px 0;">
          <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;">
            <div style="min-width:0;">
              <div style="font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${title}</div>
              <div class="muted" style="opacity:.80;margin-top:4px;line-height:1.35;">
                <div><strong>Request:</strong> ${buy.title || "Request"}${reqPrice ? ` • <strong>Price:</strong> ${reqPrice}` : ""}</div>
                <div><strong>Sell:</strong> ${sell.title || "Sell"}${sellPrice ? ` • <strong>Price:</strong> ${sellPrice}` : ""}</div>
              </div>
              <div class="muted" style="opacity:.72;margin-top:6px;font-size:12px;">
                <strong>Buyer:</strong> ${buyerName} &nbsp;•&nbsp; <strong>Seller:</strong> ${sellerName}
              </div>
            </div>
            <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex:0 0 auto;">
              <span class="${lbl.cls}" title="Score ${s}">${badgeText}</span>
              <span class="muted" style="opacity:.7;font-size:11px;">${when}</span>
            </div>
          </div>

          <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;">
            <button class="btn small" data-action="view-post" data-post-id="${viewPostId}">View Post</button>
            <button class="btn small"
              data-action="chat"
              data-post-id="${m.sell_post_id || ''}"
              data-buyer-id="${m.buyer_id || ''}"
              data-seller-id="${m.seller_id || ''}"
              data-convo-id="${existingConvoId}">
              ${existingConvoId ? "View Conversation" : "Start Conversation"}
            </button>
          </div>

          <div class="muted" style="opacity:.7;font-size:11px;margin-top:8px;">
            Labeled: <strong>${kindText}</strong> (threshold ${MATCH_THRESHOLD}+)
          </div>
        </div>
      `;
    }).join("");

    list.innerHTML = html;
    bindLegendToggle(list);
    bindActionButtons(list);
  }

  let matchChannel = null;
  function initMatchListener() {
    const client = supa();
    const user = window.currentUser;
    if (!client || !user) return;

    if (matchChannel) client.removeChannel(matchChannel);

    matchChannel = client
      .channel("matches-listener")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "matches" }, (payload) => {
        const match = payload.new;
        const isMine = match.buyer_id === user.id || match.seller_id === user.id;
        if (!isMine) return;

        const s = Number(match.score);
        const isRealMatch = Number.isFinite(s) ? (s >= MATCH_THRESHOLD) : true;

        if (isRealMatch) {
          window.showBrowserNotification?.({ title: "New Match", body: "You have a new match." });
          window.Notifications?.notify?.("New Match", "You have a new match.");
        }

        loadMatches();
      })
      .subscribe();
  }

  window.Matches = { loadMatches, initMatchListener };
})();