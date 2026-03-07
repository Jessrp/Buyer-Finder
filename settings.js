  // ── SETTINGS HELPERS ─────────────────────────────────────────────

  function toggleSettingsEdit(field) {
    const wrap = document.getElementById('edit-' + field);
    if (!wrap) return;
    // close all others first
    document.querySelectorAll('.settings-edit-wrap.open').forEach(w => {
      if (w !== wrap) w.classList.remove('open');
    });
    wrap.classList.toggle('open');
  }

  // Called by auth.js after profile loads
  function populateSettingsFields() {
    const profile = window.currentProfile;
    const user    = window.currentUser;
    if (!user) return;

    const name      = profile?.username || 'User';
    const email     = profile?.email || user?.email || '';
    const isPremium = typeof window.isBFPlus === 'function'
      ? window.isBFPlus(profile) : !!profile?.premium;

    // Profile header
    document.getElementById('settings-name').textContent  = name;
    document.getElementById('settings-email').textContent = email || 'No email set';
    const planEl = document.getElementById('settings-plan');
    if (planEl) { planEl.textContent = isPremium ? 'BF+' : 'Free'; planEl.className = 'badge' + (isPremium ? ' premium' : ''); }

    // Avatar
    const avatarEl   = document.getElementById('settings-avatar');
    const initialsEl = document.getElementById('settings-avatar-initials');
    if (profile?.avatar_url) {
      if (avatarEl) avatarEl.innerHTML = `<img src="${profile.avatar_url}" alt="avatar"/>`;
    } else if (initialsEl) {
      initialsEl.textContent = name.slice(0,2).toUpperCase();
    }

    // Row sub-labels
    const dName  = document.getElementById('display-username');
    const dEmail = document.getElementById('display-email');
    if (dName)  dName.textContent  = name;
    if (dEmail) dEmail.textContent = email || 'Not set';

    // Pre-fill inputs
    const iName  = document.getElementById('profile-username');
    const iEmail = document.getElementById('profile-email');
    if (iName)  iName.value  = name;
    if (iEmail) iEmail.value = email;

    // BF+ card
    const cardTitle  = document.getElementById('bfplus-card-title');
    const cardSub    = document.getElementById('bfplus-card-sub');
    const upgradeBtn = document.getElementById('btn-upgrade-premium');
    if (isPremium) {
      if (cardTitle)  cardTitle.textContent  = "You're BF+ ⚡";
      if (cardSub)    cardSub.textContent    = 'Unlimited posts, map & more. Thanks for supporting BuyerFinder!';
      if (upgradeBtn) { upgradeBtn.textContent = 'Active ✓'; upgradeBtn.disabled = true; upgradeBtn.style.cssText = 'background:rgba(0,223,162,0.15);color:var(--accent);'; }
    } else {
      if (cardTitle)  cardTitle.textContent  = 'Upgrade to BF+';
      if (cardSub)    cardSub.textContent    = 'Unlimited posts, map access & more — $4.99/mo';
      if (upgradeBtn) { upgradeBtn.textContent = 'Upgrade'; upgradeBtn.disabled = false; upgradeBtn.style.cssText = ''; }
    }
  }

  // Avatar change
  document.getElementById('settings-avatar-edit-btn')?.addEventListener('click', () => {
    document.getElementById('profile-avatar-input')?.click();
  });
  document.getElementById('settings-avatar')?.addEventListener('click', () => {
    document.getElementById('profile-avatar-input')?.click();
  });
  document.getElementById('profile-avatar-input')?.addEventListener('change', async () => {
    if (typeof uploadAvatar === 'function') {
      await uploadAvatar();
      populateSettingsFields();
    }
  });

  // Save username
  document.getElementById('btn-save-username')?.addEventListener('click', async () => {
    if (typeof saveUsername === 'function') {
      await saveUsername();
      toggleSettingsEdit('username');
      populateSettingsFields();
    }
  });

  // Save email
  document.getElementById('btn-save-email')?.addEventListener('click', async () => {
    if (typeof saveProfileEmail === 'function') {
      await saveProfileEmail();
      toggleSettingsEdit('email');
      populateSettingsFields();
    }
  });

  // Refresh settings when tab opens
  document.getElementById('nav-settings')?.addEventListener('click', () => {
    setTimeout(populateSettingsFields, 150);
    setTimeout(loadTransactionHistory, 300);
  });

  // ── TRANSACTION HISTORY ─────────────────────────────────────────
  async function loadTransactionHistory() {
    const user   = window.currentUser;
    const client = window.supa;
    const list   = document.getElementById('transactions-list');
    if (!list || !user || !client) {
      if (list) list.innerHTML = '<div style="padding:14px 16px;font-size:13px;color:var(--muted);">Sign in to see your history.</div>';
      return;
    }

    const { data, error } = await client
      .from('transactions')
      .select('*')
      .or(`seller_id.eq.${user.id},buyer_id.eq.${user.id}`)
      .order('sold_at', { ascending: false });

    if (error || !data || data.length === 0) {
      list.innerHTML = '<div style="padding:14px 16px;font-size:13px;color:var(--muted);">No transactions yet.</div>';
      return;
    }

    // Fetch profiles for buyers/sellers
    const ids = [...new Set(data.flatMap(t => [t.seller_id, t.buyer_id]).filter(Boolean))];
    const { data: profiles } = await client.from('profiles').select('id, username').in('id', ids);
    const pMap = {};
    (profiles || []).forEach(p => pMap[p.id] = p.username);

    list.innerHTML = data.map(t => {
      const isSeller  = t.seller_id === user.id;
      const role      = isSeller ? '🏷 Sold' : '📥 Bought';
      const roleColor = isSeller ? 'var(--sell)' : 'var(--req)';
      const other     = isSeller
        ? (t.buyer_id  ? (pMap[t.buyer_id]  || 'Unknown buyer')  : 'No buyer recorded')
        : (pMap[t.seller_id] || 'Unknown seller');
      const otherLabel = isSeller ? `To: ${other}` : `From: ${other}`;
      const date = new Date(t.sold_at).toLocaleDateString([], { month:'short', day:'numeric', year:'numeric' });
      return `
        <div style="display:flex;align-items:center;gap:12px;padding:13px 16px;border-top:1px solid var(--border);">
          <div style="width:36px;height:36px;border-radius:10px;background:rgba(0,223,162,0.1);display:flex;align-items:center;justify-content:center;font-size:17px;flex-shrink:0;">
            ${isSeller ? '🏷' : '📥'}
          </div>
          <div style="flex:1;min-width:0;">
            <div style="font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${t.title || 'Unknown item'}</div>
            <div style="font-size:11px;color:var(--muted);margin-top:2px;">${otherLabel} · ${date}</div>
          </div>
          <div style="font-family:'Space Grotesk',sans-serif;font-size:13px;font-weight:700;color:var(--accent);flex-shrink:0;">
            ${t.price || '-'}
          </div>
        </div>`;
    }).join('');
  }

  window.loadTransactionHistory = loadTransactionHistory;

  // Expose globally so auth.js updateSettingsUI can call it
  window.populateSettingsFields = populateSettingsFields;
  
