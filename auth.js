// auth.js - Firebase version

// Make sure Firebase SDKs are included in your HTML before this script
// <script src="https://www.gstatic.com/firebasejs/10.1.0/firebase-app.js"></script>
// <script src="https://www.gstatic.com/firebasejs/10.1.0/firebase-auth.js"></script>

// Firebase config (replace with your project's config)
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();

// DOM elements
const loginForm = document.getElementById('loginForm');
const signupForm = document.getElementById('signupForm');
const logoutBtn = document.getElementById('logoutBtn');
const errorMessage = document.getElementById('errorMessage');

function showError(msg) {
    if (errorMessage) {
        errorMessage.innerText = msg;
        errorMessage.style.display = 'block';
    } else {
        alert(msg);
    }
}

function hideError() {
    if (errorMessage) errorMessage.style.display = 'none';
}

// Login
function login(email, password) {
    hideError();
    auth.signInWithEmailAndPassword(email, password)
        .then(() => {
            window.location.href = 'index.html';
        })
        .catch(err => showError(err.message));
}

// Signup
function signup(name, email, password) {
    hideError();
    auth.createUserWithEmailAndPassword(email, password)
        .then(userCredential => {
            // Optional: Save display name
            return userCredential.user.updateProfile({ displayName: name });
        })
        .then(() => window.location.href = 'index.html')
        .catch(err => showError(err.message));
}

// Logout
function logout() {
    auth.signOut()
        .then(() => window.location.href = 'login.html')
        .catch(err => showError(err.message));
}

// Event listeners
if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = loginForm.email.value.trim();
        const password = loginForm.password.value.trim();
        login(email, password);
    });
}

if (signupForm) {
    signupForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = signupForm.name.value.trim();
        const email = signupForm.email.value.trim();
        const password = signupForm.password.value.trim();
        signup(name, email, password);
    });
}

if (logoutBtn) {
    logoutBtn.addEventListener('click', logout);
}

// Auto redirect if already logged in
auth.onAuthStateChanged(user => {
    if (user && (window.location.pathname.includes('login') || window.location.pathname.includes('signup'))) {
        window.location.href = 'index.html';
    }
});
