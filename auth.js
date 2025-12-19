const SUPABASE_URL = "YOUR_URL";
const SUPABASE_KEY = "YOUR_PUBLIC_KEY";

window.supa = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const authBtn = document.getElementById("auth-btn");
const premiumBtn = document.getElementById("btn-upgrade-premium");

async function refreshAuth() {
  const { data } = await supa.auth.getSession();
  authBtn.textContent = data.session ? "Sign Out" : "Sign In";
}

authBtn.onclick = async () => {
  const { data } = await supa.auth.getSession();
  if (data.session) {
    await supa.auth.signOut();
  } else {
    window.location.href = "success.html";
  }
  refreshAuth();
};

premiumBtn?.addEventListener("click", () => {
  alert("Premium upgrade coming soon");
});

refreshAuth();
