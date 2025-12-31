// BuyerFinder App - UI + Data Logic ONLY
// AUTH IS HANDLED EXCLUSIVELY BY auth.js

let currentUser = null;
let currentView = 'sell';
let allPosts = [];
let userProfile = null;
let notificationInterval = null;

// === SUPABASE ACCESS (READ-ONLY) ===
function getSupabase() {
    return window.supa || window.supabaseClient;
}

// === TYPE HELPERS ===
function getDbType(view) {
    return view === 'sell' ? 'selling' : 'requesting';
}

function getViewFromDbType(dbType) {
    return dbType === 'selling' ? 'sell' : 'requests';
}

// === INIT ===
async function initApp() {
    console.log('Initializing BuyerFinder (AUTH DISABLED HERE)');
    setupEventListeners();
    showAuthScreen(); // auth.js will override this when ready
}

// === EVENTS ===
function setupEventListeners() {
    console.log('Setting up NON-AUTH event listeners');

    // 🔕 AUTH BUTTONS ARE PRESENT BUT DO NOTHING HERE
    document.getElementById('signInGoogleAuth')?.addEventListener('click', () => {});
    document.getElementById('signInEmailAuth')?.addEventListener('click', () => {});
    document.getElementById('continueGuestBtn')?.addEventListener('click', continueAsGuest);

    document.getElementById('signInGoogleMain')?.addEventListener('click', () => {});
    document.getElementById('signInEmailMain')?.addEventListener('click', () => {});
    document.getElementById('signOut')?.addEventListener('click', () => {});

    // Navigation
    document.getElementById('sellTab')?.addEventListener('click', () => switchView('sell'));
    document.getElementById('requestsTab')?.addEventListener('click', () => switchView('requests'));
    document.getElementById('matchesTab')?.addEventListener('click', showMatches);
    document.getElementById('alertsTab')?.addEventListener('click', showAlerts);
    document.getElementById('mapTab')?.addEventListener('click', showMap);
    document.getElementById('settingsTab')?.addEventListener('click', showSettings);

    // Posts
    document.getElementById('newPostBtn')?.addEventListener('click', showNewPostModal);
    document.getElementById('cancelPost')?.addEventListener('click', hideNewPostModal);
    document.getElementById('closeModalBtn')?.addEventListener('click', hideNewPostModal);
    document.getElementById('savePost')?.addEventListener('click', savePost);

    // Search
    document.getElementById('searchBtn')?.addEventListener('click', searchPosts);
    document.getElementById('searchInput')?.addEventListener('keypress', e => {
        if (e.key === 'Enter') searchPosts();
    });

    document.getElementById('imageUpload')?.addEventListener('change', handleImageUpload);
}

// === GUEST MODE ===
function continueAsGuest() {
    currentUser = null;
    userProfile = null;
    showMainApp();
    loadPosts();
}

// === AUTH STATE SYNC (CALLED BY auth.js) ===
window.setBuyerFinderUser = async function (user) {
    currentUser = user;

    if (!user) {
        userProfile = null;
        showAuthScreen();
        return;
    }

    await loadUserProfile();
    showMainApp();
    loadPosts();
};

// === PROFILE ===
async function loadUserProfile() {
    if (!currentUser) return;
    const supabase = getSupabase();
    if (!supabase) return;

    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single();

    if (data) {
        userProfile = data;
    } else {
        const { data: created } = await supabase.from('profiles').insert([{
            id: currentUser.id,
            email: currentUser.email,
            username: currentUser.email.split('@')[0],
            bf_plus: false
        }]).select().single();
        userProfile = created;
    }

    updateProfileDisplay();
    updateAuthButtons();
}

// === UI ===
function updateProfileDisplay() {
    const el = document.getElementById('profileSection');
    if (!el) return;

    if (!currentUser || !userProfile) {
        el.innerHTML = `<h3>👤 Guest</h3><p>Not signed in</p>`;
        return;
    }

    el.innerHTML = `
        <h3>${userProfile.username}</h3>
        <p>${userProfile.bf_plus ? '⭐ BF+' : '🆓 Free'}</p>
    `;
}

function updateAuthButtons() {
    document.getElementById('signOut')?.classList.toggle('hidden', !currentUser);
}

// === VIEWS ===
function switchView(view) {
    currentView = view;
    loadPosts();
}

// === POSTS (UNCHANGED LOGIC) ===
async function loadPosts() {
    const supabase = getSupabase();
    const container = document.getElementById('postsContainer');
    if (!supabase || !container) return;

    const { data, error } = await supabase
        .from('posts')
        .select(`*, profiles:user_id (username, avatar_url, bf_plus)`)
        .eq('type', getDbType(currentView))
        .eq('status', 'active')
        .order('is_premium', { ascending: false })
        .order('created_at', { ascending: false });

    if (error) {
        container.innerHTML = `<p>Error loading posts</p>`;
        return;
    }

    allPosts = data || [];
    displayPosts(allPosts);
}

// === EVERYTHING ELSE BELOW THIS POINT IS UNCHANGED ===
// createPostCard, showPostDetails, savePost, deletePost, etc.
// (leave exactly as you already have them)

initApp();
