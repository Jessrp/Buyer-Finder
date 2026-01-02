const authSection = document.getElementById('authSection');
const appSection = document.getElementById('appSection');
const logoutBtn = document.getElementById('logoutBtn');

async function checkAuth() {
  const { data } = await supabaseClient.auth.getSession();
  if (data.session) {
    authSection.classList.add('hidden');
    appSection.classList.remove('hidden');
    logoutBtn.classList.remove('hidden');
    loadPosts();
    initMap();
  }
}

document.getElementById('loginBtn').onclick = async () => {
  await supabaseClient.auth.signInWithPassword({
    email: email.value,
    password: password.value
  });
  checkAuth();
};

document.getElementById('signupBtn').onclick = async () => {
  await supabaseClient.auth.signUp({
    email: email.value,
    password: password.value
  });
  notify('Account created');
};

logoutBtn.onclick = async () => {
  await supabaseClient.auth.signOut();
  location.reload();
};

checkAuth();