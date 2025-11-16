// auth.js
window.BF = window.BF || {};

(function (BF) {
  BF.auth = BF.auth || {};

  BF.auth.checkUser = async function () {
    const supa = BF.supa;
    if (!supa) return;

    const { data } = await supa.auth.getUser();
    BF.state.currentUser = data.user || null;

    const hasUser = !!BF.state.currentUser;
    const ui = BF.ui;

    ui.loginBtn.style.display = hasUser ? "none" : "inline-block";
    ui.logoutBtn.style.display = hasUser ? "inline-block" : "none";
    ui.userCardSignin.style.display = hasUser ? "none" : "inline-block";

    if (hasUser) {
      await BF.auth.loadOrCreateProfile();
    } else {
      BF.state.currentProfile = null;
      BF.auth.renderUserCard();
      BF.auth.syncSettingsUI();
    }
  };

  BF.auth.loginWithEmail = async function () {
    const supa = BF.supa;
    const email = prompt("Enter your email for a login link:");
    if (!email) return;

    const { error } = await supa.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: "https://buyerfinder.vercel.app",
      },
    });

    if (error) alert(error.message);
    else alert("Check your email for the login link.");
  };

  BF.auth.logout = async function () {
    const supa = BF.supa;
    await supa.auth.signOut();
    alert("Signed out.");
    BF.state.currentUser = null;
    BF.state.currentProfile = null;
    BF.auth.renderUserCard();
    await BF.auth.checkUser();
    await BF.posts.loadPosts();
  };

  BF.auth.loadOrCreateProfile = async function () {
    const supa = BF.supa;
    const user = BF.state.currentUser;
    if (!user) return;

    let { data, error } = await supa
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (error) console.log("Profile fetch error:", error.message);

    if (!data) {
      const username = (user.email || "user").split("@")[0].slice(0, 20);

      const { data: inserted, error: insertError } = await supa
        .from("profiles")
        .insert({
          id: user.id,
          email: user.email,
          username,
          premium: false,
          created_at: new Date().toISOString(),
        })
        .select()
        .maybeSingle();

      if (!insertError && inserted) {
        BF.state.currentProfile = inserted;
      } else {
        BF.state.currentProfile = {
          id: user.id,
          email: user.email,
          username,
          premium: false,
        };
      }
    } else {
      BF.state.currentProfile = data;
    }

    BF.auth.renderUserCard();
    BF.auth.syncSettingsUI();
  };

  BF.auth.renderUserCard = function () {
    const user = BF.state.currentUser;
    const profile = BF.state.currentProfile;
    const ui = BF.ui;

    if (!user) {
      ui.userNameEl.textContent = "Guest";
      ui.userEmailEl.textContent = "Not signed in";
      ui.userPlanEl.textContent = "Free (guest)";
      ui.userPlanEl.className = "badge";
      ui.userAvatarEl.innerHTML = "";
      const ph = document.createElement("div");
      ph.style.width = "100%";
      ph.style.height = "100%";
      ph.style.background = "linear-gradient(135deg,#333,#555)";
      ui.userAvatarEl.appendChild(ph);
    } else {
      ui.userNameEl.textContent = (profile && profile.username) || "User";
      ui.userEmailEl.textContent = user.email || "";
      const isPremium = !!(profile && profile.premium);
      ui.userPlanEl.textContent = isPremium ? "Premium" : "Free";
      ui.userPlanEl.className = "badge" + (isPremium ? " premium" : "");
      ui.userAvatarEl.innerHTML = "";
      const img = document.createElement("img");
      if (profile && profile.avatar_url) {
        img.src = profile.avatar_url;
      } else {
        img.src =
          "data:image/svg+xml;base64," +
          btoa(
            '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="#222"/><text x="50%" y="55%" fill="#00eaff" font-size="28" text-anchor="middle">BF</text></svg>'
          );
      }
      ui.userAvatarEl.appendChild(img);
    }
  };

  BF.auth.syncSettingsUI = function () {
    const user = BF.state.currentUser;
    const profile = BF.state.currentProfile;
    const ui = BF.ui;

    if (!user) {
      ui.profileEmail.value = "";
      ui.profileUsername.value = "";
      ui.premiumStatusText.textContent = "You’re not signed in.";
      return;
    }

    ui.profileEmail.value = user.email || "";
    ui.profileUsername.value = (profile && profile.username) || "";

    const isPremium = !!(profile && profile.premium);
    ui.premiumStatusText.textContent = isPremium
      ? "You are a premium user. Map is fully enabled."
      : "You are on the free plan. Map is locked.";
  };

  BF.auth.saveUsername = async function () {
    const supa = BF.supa;
    const user = BF.state.currentUser;
    const profile = BF.state.currentProfile;
    const ui = BF.ui;

    if (!user) return alert("Sign in first.");

    const newName = ui.profileUsername.value.trim();
    if (!newName) return;

    const { error } = await supa
      .from("profiles")
      .update({ username: newName })
      .eq("id", user.id);

    if (error) alert(error.message);
    else {
      if (profile) profile.username = newName;
      BF.auth.renderUserCard();
      alert("Username updated.");
    }
  };

  BF.auth.uploadAvatar = async function () {
    const supa = BF.supa;
    const user = BF.state.currentUser;
    const profile = BF.state.currentProfile;
    const ui = BF.ui;

    if (!user) return alert("Sign in first.");

    const file = ui.profileAvatarInput.files[0];
    if (!file) return alert("Choose a file first.");

    const ext = file.name.split(".").pop() || "jpg";
    const path = `avatars/${user.id}-${Date.now()}.${ext}`;

    const { error } = await supa.storage
      .from("post_images")
      .upload(path, file, { upsert: true });

    if (error) {
      alert("Upload failed: " + error.message);
      return;
    }

    const { data: urlData } = supa.storage
      .from("post_images")
      .getPublicUrl(path);

    const publicUrl = urlData.publicUrl;
    await supa
      .from("profiles")
      .update({ avatar_url: publicUrl })
      .eq("id", user.id)
      .catch(() => {});

    if (profile) profile.avatar_url = publicUrl;
    BF.auth.renderUserCard();
    alert("Avatar updated.");
  };

  BF.auth.fakeUpgradePremium = function () {
    alert(
      "Premium upgrade would normally go to a payment / checkout page.\nRight now this is just a stub button."
    );
  };

  BF.auth.fakeDeleteAccount = function () {
    alert(
      "Real account deletion must be done from a secure backend using the service role key.\nWe’re not doing that with the public anon key in the browser."
    );
  };
})(window.BF);