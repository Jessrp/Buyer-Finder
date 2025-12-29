// BuyerFinder App - Complete Version with All Features
// Phase 3: Enhanced matching, notifications, map, and premium features

let currentUser = null;
let currentView = 'sell';
let allPosts = [];
let userProfile = null;
let notificationInterval = null;

// Helper function to map view to database type
function getDbType(view) {
    return view === 'sell' ? 'selling' : 'requesting';
}

// Helper function to map database type to view
function getViewFromDbType(dbType) {
    return dbType === 'selling' ? 'sell' : 'requests';
}

// Initialize the app
async function initApp() {
    console.log('Initializing BuyerFinder...');
    
    // Set up event listeners first
    setupEventListeners();
    
    // Check for existing session
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session) {
        currentUser = session.user;
        await loadUserProfile();
        showMainApp();
        await loadPosts();
        startNotificationPolling();
    } else {
        showAuthScreen();
    }
    
    // Set up auth state listener
    supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN') {
            currentUser = session.user;
            await loadUserProfile();
            showMainApp();
            await loadPosts();
            startNotificationPolling();
        } else if (event === 'SIGNED_OUT') {
            currentUser = null;
            userProfile = null;
            stopNotificationPolling();
            showAuthScreen();
        }
    });
}

// Set up all event listeners
function setupEventListeners() {
    console.log('Setting up event listeners...');
    
    // Auth buttons - auth screen
    const signInGoogleAuth = document.getElementById('signInGoogleAuth');
    const signInEmailAuth = document.getElementById('signInEmailAuth');
    const continueGuestBtn = document.getElementById('continueGuestBtn');
    
    if (signInGoogleAuth) {
        console.log('Found Google auth button');
        signInGoogleAuth.addEventListener('click', signInWithGoogle);
    } else {
        console.error('Google auth button not found!');
    }
    
    if (signInEmailAuth) {
        console.log('Found Email auth button');
        signInEmailAuth.addEventListener('click', showEmailSignIn);
    } else {
        console.error('Email auth button not found!');
    }
    
    if (continueGuestBtn) {
        console.log('Found Guest button');
        continueGuestBtn.addEventListener('click', continueAsGuest);
    } else {
        console.error('Guest button not found!');
    }
    
    // Auth buttons - main screen (old buttons for backward compatibility)
    document.getElementById('signInGoogle')?.addEventListener('click', signInWithGoogle);
    document.getElementById('signInEmail')?.addEventListener('click', showEmailSignIn);
    
    // Auth buttons - top bar
    document.getElementById('signInGoogleMain')?.addEventListener('click', signInWithGoogle);
    document.getElementById('signInEmailMain')?.addEventListener('click', showEmailSignIn);
    document.getElementById('signOut')?.addEventListener('click', signOut);
    
    // Navigation
    document.getElementById('sellTab')?.addEventListener('click', () => switchView('sell'));
    document.getElementById('requestsTab')?.addEventListener('click', () => switchView('requests'));
    document.getElementById('matchesTab')?.addEventListener('click', showMatches);
    document.getElementById('alertsTab')?.addEventListener('click', showAlerts);
    document.getElementById('mapTab')?.addEventListener('click', showMap);
    document.getElementById('settingsTab')?.addEventListener('click', showSettings);
    
    // Post creation
    document.getElementById('newPostBtn')?.addEventListener('click', showNewPostModal);
    document.getElementById('cancelPost')?.addEventListener('click', hideNewPostModal);
    document.getElementById('savePost')?.addEventListener('click', savePost);
    
    // Search
    document.getElementById('searchBtn')?.addEventListener('click', searchPosts);
    document.getElementById('searchInput')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') searchPosts();
    });
    
    // Image upload
    document.getElementById('imageUpload')?.addEventListener('change', handleImageUpload);
    
    console.log('Event listeners setup complete');
}

// Authentication functions
async function signInWithGoogle() {
    try {
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin
            }
        });
        if (error) throw error;
    } catch (error) {
        console.error('Error signing in with Google:', error);
        alert('Error signing in. Please try again.');
    }
}

function showEmailSignIn() {
    const email = prompt('Enter your email:');
    if (!email) return;
    
    const password = prompt('Enter your password (min 6 characters):');
    if (!password) return;
    
    signInWithEmail(email, password);
}

async function signInWithEmail(email, password) {
    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });
        
        if (error) {
            if (error.message.includes('Invalid login')) {
                const signUp = confirm('No account found. Would you like to create one?');
                if (signUp) {
                    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
                        email,
                        password
                    });
                    
                    if (signUpError) throw signUpError;
                    alert('Account created! Please check your email to verify.');
                }
            } else {
                throw error;
            }
        }
    } catch (error) {
        console.error('Error with email auth:', error);
        alert('Error: ' + error.message);
    }
}

async function signOut() {
    try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
    } catch (error) {
        console.error('Error signing out:', error);
        alert('Error signing out. Please try again.');
    }
}

// Continue as guest
function continueAsGuest() {
    console.log('Continue as guest clicked');
    showMainApp();
    loadPosts();
}

// Test function - you can call this from browser console
window.testButtons = function() {
    console.log('Testing buttons...');
    console.log('Google Auth button:', document.getElementById('signInGoogleAuth'));
    console.log('Email Auth button:', document.getElementById('signInEmailAuth'));
    console.log('Guest button:', document.getElementById('continueGuestBtn'));
};

// User profile functions
async function loadUserProfile() {
    if (!currentUser) return;
    
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', currentUser.id)
            .single();
        
        if (error && error.code !== 'PGRST116') throw error;
        
        if (data) {
            userProfile = data;
        } else {
            await createUserProfile();
        }
        
        updateProfileDisplay();
        updateAuthButtons();
    } catch (error) {
        console.error('Error loading profile:', error);
    }
}

async function createUserProfile() {
    if (!currentUser) return;
    
    try {
        const { data, error } = await supabase
            .from('profiles')
            .insert([{
                id: currentUser.id,
                email: currentUser.email,
                username: currentUser.email.split('@')[0],
                bf_plus: false
            }])
            .select()
            .single();
        
        if (error) throw error;
        userProfile = data;
    } catch (error) {
        console.error('Error creating profile:', error);
    }
}

function updateProfileDisplay() {
    const profileSection = document.getElementById('profileSection');
    if (!profileSection) return;
    
    if (currentUser && userProfile) {
        profileSection.innerHTML = `
            <div class="profile-info">
                <img src="${userProfile.avatar_url || 'https://via.placeholder.com/50'}" alt="Profile" class="profile-avatar">
                <div class="profile-details">
                    <h3>${userProfile.username || 'User'}</h3>
                    <p>${userProfile.bf_plus ? '⭐ BF+ Member' : '🆓 Free'}</p>
                </div>
            </div>
        `;
    } else {
        profileSection.innerHTML = `
            <div class="guest-info">
                <h3>👤 Guest</h3>
                <p>Not signed in</p>
                <button onclick="showAuthScreen()" class="btn btn-primary">Sign in</button>
            </div>
        `;
    }
}

function updateAuthButtons() {
    const signOutBtn = document.getElementById('signOut');
    const signInGoogleMain = document.getElementById('signInGoogleMain');
    const signInEmailMain = document.getElementById('signInEmailMain');
    
    if (currentUser) {
        signOutBtn?.classList.remove('hidden');
        signInGoogleMain?.classList.add('hidden');
        signInEmailMain?.classList.add('hidden');
    } else {
        signOutBtn?.classList.add('hidden');
        signInGoogleMain?.classList.remove('hidden');
        signInEmailMain?.classList.remove('hidden');
    }
}

// View switching
function switchView(view) {
    currentView = view;
    
    // Update tab styling
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    if (view === 'sell') {
        document.getElementById('sellTab')?.classList.add('active');
    } else if (view === 'requests') {
        document.getElementById('requestsTab')?.classList.add('active');
    }
    
    loadPosts();
}

// Post loading with FIXED type mapping
async function loadPosts() {
    try {
        const dbType = getDbType(currentView);
        
        let query = supabase
            .from('posts')
            .select(`
                *,
                profiles:user_id (username, avatar_url, bf_plus)
            `)
            .eq('type', dbType)
            .eq('status', 'active')
            .order('is_premium', { ascending: false })
            .order('created_at', { ascending: false });
        
        const { data, error } = await query;
        
        if (error) throw error;
        
        allPosts = data || [];
        displayPosts(allPosts);
    } catch (error) {
        console.error('Error loading posts:', error);
        document.getElementById('postsContainer').innerHTML = `
            <div class="error-message">
                <p>Error loading posts: ${error.message}</p>
                <button onclick="loadPosts()" class="btn btn-primary">Retry</button>
            </div>
        `;
    }
}

function displayPosts(posts) {
    const container = document.getElementById('postsContainer');
    if (!container) return;
    
    if (!posts || posts.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <h2>No ${currentView === 'sell' ? 'items for sale' : 'requests'} yet</h2>
                <p>Be the first to post!</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = posts.map(post => createPostCard(post)).join('');
    
    // Add click handlers to post cards
    document.querySelectorAll('.post-card').forEach(card => {
        card.addEventListener('click', () => {
            const postId = card.dataset.postId;
            showPostDetails(postId);
        });
    });
}

function createPostCard(post) {
    const profileInfo = post.profiles || {};
    const isPremium = post.is_premium || false;
    const images = post.images || [];
    const firstImage = Array.isArray(images) && images.length > 0 ? images[0] : null;
    
    return `
        <div class="post-card ${isPremium ? 'premium' : ''}" data-post-id="${post.id}">
            ${isPremium ? '<div class="premium-badge">BF+</div>' : ''}
            ${firstImage ? `<img src="${firstImage}" alt="${post.title}" class="post-image">` : '<div class="post-image-placeholder">📦</div>'}
            <div class="post-content">
                <h3>${escapeHtml(post.title)}</h3>
                <p class="post-description">${escapeHtml(post.description || '')}</p>
                <div class="post-meta">
                    <span class="post-price">$${post.price.toFixed(2)}</span>
                    ${post.category ? `<span class="post-category">${escapeHtml(post.category)}</span>` : ''}
                    ${post.condition ? `<span class="post-condition">${escapeHtml(post.condition)}</span>` : ''}
                </div>
                ${post.location_text ? `<p class="post-location">📍 ${escapeHtml(post.location_text)}</p>` : ''}
                <div class="post-footer">
                    <div class="post-author">
                        <img src="${profileInfo.avatar_url || 'https://via.placeholder.com/30'}" alt="${profileInfo.username || 'User'}" class="author-avatar">
                        <span>${escapeHtml(profileInfo.username || 'User')}</span>
                    </div>
                    <span class="post-date">${formatDate(post.created_at)}</span>
                </div>
            </div>
        </div>
    `;
}

// Show post details
function showPostDetails(postId) {
    const post = allPosts.find(p => p.id === postId);
    if (!post) return;
    
    const profileInfo = post.profiles || {};
    const images = post.images || [];
    
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>${escapeHtml(post.title)}</h2>
                <button class="btn-close" onclick="this.closest('.modal').remove()">×</button>
            </div>
            <div class="modal-body">
                ${images.length > 0 ? `
                    <div class="post-images-gallery">
                        ${images.map(img => `<img src="${img}" alt="${post.title}">`).join('')}
                    </div>
                ` : ''}
                <div class="post-detail-price">$${post.price.toFixed(2)}</div>
                <p class="post-detail-description">${escapeHtml(post.description || '')}</p>
                <div class="post-detail-info">
                    ${post.category ? `<p><strong>Category:</strong> ${escapeHtml(post.category)}</p>` : ''}
                    ${post.condition ? `<p><strong>Condition:</strong> ${escapeHtml(post.condition)}</p>` : ''}
                    ${post.location_text ? `<p><strong>Location:</strong> ${escapeHtml(post.location_text)}</p>` : ''}
                </div>
                <div class="post-detail-author">
                    <img src="${profileInfo.avatar_url || 'https://via.placeholder.com/50'}" alt="${profileInfo.username || 'User'}">
                    <div>
                        <h4>${escapeHtml(profileInfo.username || 'User')}</h4>
                        <p>Posted ${formatDate(post.created_at)}</p>
                    </div>
                </div>
                ${currentUser && currentUser.id !== post.user_id ? `
                    <button onclick="contactSeller('${post.id}')" class="btn btn-primary">Contact Seller</button>
                ` : ''}
                ${currentUser && currentUser.id === post.user_id ? `
                    <button onclick="deletePost('${post.id}')" class="btn btn-secondary">Delete Post</button>
                ` : ''}
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// Contact seller
function contactSeller(postId) {
    if (!currentUser) {
        alert('Please sign in to contact sellers.');
        return;
    }
    alert('Messaging feature coming soon! For now, matches will notify both parties.');
}

// Delete post
async function deletePost(postId) {
    if (!confirm('Are you sure you want to delete this post?')) return;
    
    try {
        const { error } = await supabase
            .from('posts')
            .update({ status: 'deleted' })
            .eq('id', postId);
        
        if (error) throw error;
        
        document.querySelector('.modal')?.remove();
        await loadPosts();
        alert('Post deleted successfully!');
    } catch (error) {
        console.error('Error deleting post:', error);
        alert('Error deleting post: ' + error.message);
    }
}

// Post creation with FIXED type setting and geolocation
async function savePost() {
    if (!currentUser) {
        alert('Please sign in to create a post.');
        return;
    }
    
    const title = document.getElementById('postTitle')?.value?.trim();
    const description = document.getElementById('postDescription')?.value?.trim();
    const price = parseFloat(document.getElementById('postPrice')?.value);
    const category = document.getElementById('postCategory')?.value;
    const condition = document.getElementById('postCondition')?.value;
    const locationText = document.getElementById('postLocation')?.value?.trim();
    
    if (!title) {
        showError('Please enter a title.');
        return;
    }
    
    if (!price || price <= 0) {
        showError('Please enter a valid price.');
        return;
    }
    
    try {
        showError('Saving post...', 'info');
        
        // Get uploaded image URLs
        const images = await getUploadedImageUrls();
        
        // Try to get geolocation if user allows
        let lat = null;
        let lng = null;
        
        if (navigator.geolocation && locationText) {
            try {
                const position = await new Promise((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(resolve, reject);
                });
                lat = position.coords.latitude;
                lng = position.coords.longitude;
            } catch (geoError) {
                console.log('Geolocation not available:', geoError);
            }
        }
        
        // Map current view to database type
        const dbType = getDbType(currentView);
        
        const postData = {
            user_id: currentUser.id,
            title,
            description,
            price,
            type: dbType,
            category: category || null,
            condition: condition || null,
            location_text: locationText || null,
            lat: lat,
            lng: lng,
            images: images,
            status: 'active',
            is_premium: userProfile?.bf_plus || false
        };
        
        const { data, error } = await supabase
            .from('posts')
            .insert([postData])
            .select();
        
        if (error) throw error;
        
        // Clear form and close modal
        clearPostForm();
        hideNewPostModal();
        
        // Reload posts
        await loadPosts();
        
        // Check for matches if this is a new post
        if (data && data[0]) {
            await checkForMatches(data[0]);
        }
        
        alert('Post created successfully!');
    } catch (error) {
        console.error('Error saving post:', error);
        showError('Error creating post: ' + error.message);
    }
}

function showError(message, type = 'error') {
    const errorDiv = document.getElementById('postError');
    if (!errorDiv) return;
    
    errorDiv.textContent = message;
    errorDiv.className = type === 'error' ? 'error-message' : 'info-message';
    errorDiv.classList.remove('hidden');
    
    if (type === 'info') {
        setTimeout(() => errorDiv.classList.add('hidden'), 3000);
    }
}

// ENHANCED MATCHING SYSTEM
async function checkForMatches(newPost) {
    try {
        const oppositeType = newPost.type === 'selling' ? 'requesting' : 'selling';
        
        const { data: potentialMatches, error } = await supabase
            .from('posts')
            .select('*, profiles:user_id(username, email)')
            .eq('type', oppositeType)
            .eq('status', 'active')
            .neq('user_id', currentUser.id);
        
        if (error) throw error;
        if (!potentialMatches || potentialMatches.length === 0) return;
        
        // Enhanced matching algorithm
        const matches = potentialMatches.filter(post => {
            let score = 0;
            
            // Title similarity (keywords)
            const newTitleWords = newPost.title.toLowerCase().split(' ');
            const postTitleWords = post.title.toLowerCase().split(' ');
            const commonWords = newTitleWords.filter(word => 
                postTitleWords.includes(word) && word.length > 3
            );
            score += commonWords.length * 3;
            
            // Category match (high weight)
            if (post.category === newPost.category && post.category) {
                score += 10;
            }
            
            // Price range match (within 20%)
            const priceDiff = Math.abs(post.price - newPost.price) / newPost.price;
            if (priceDiff < 0.2) {
                score += 5;
            }
            
            // Location proximity (if both have location)
            if (post.lat && post.lng && newPost.lat && newPost.lng) {
                const distance = calculateDistance(
                    post.lat, post.lng, 
                    newPost.lat, newPost.lng
                );
                if (distance < 50) score += 7; // Within 50km
            }
            
            return score >= 8; // Threshold for a match
        });
        
        // Create match records and notifications
        for (const match of matches) {
            await createMatch(newPost.id, match.id);
            await notifyUsers(newPost, match);
        }
        
        if (matches.length > 0) {
            alert(`🎉 Found ${matches.length} potential match${matches.length > 1 ? 'es' : ''}! Check the Matches tab.`);
        }
        
    } catch (error) {
        console.error('Error checking for matches:', error);
    }
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of Earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

async function createMatch(postA, postB) {
    try {
        // Check if match already exists
        const { data: existing } = await supabase
            .from('matches')
            .select('*')
            .or(`and(post_a.eq.${postA},post_b.eq.${postB}),and(post_a.eq.${postB},post_b.eq.${postA})`);
        
        if (existing && existing.length > 0) return;
        
        const { error } = await supabase
            .from('matches')
            .insert([{
                post_a: postA,
                post_b: postB
            }]);
        
        if (error) throw error;
    } catch (error) {
        console.error('Error creating match:', error);
    }
}

async function notifyUsers(post1, post2) {
    try {
        const notifications = [
            {
                user_id: post2.user_id,
                message: `🎯 Match found! Someone is ${post1.type === 'selling' ? 'selling' : 'looking for'}: "${post1.title}" for $${post1.price}`,
                seen: false
            },
            {
                user_id: post1.user_id,
                message: `🎯 Match found! Someone is ${post2.type === 'selling' ? 'selling' : 'looking for'}: "${post2.title}" for $${post2.price}`,
                seen: false
            }
        ];
        
        await supabase
            .from('notifications')
            .insert(notifications);
            
    } catch (error) {
        console.error('Error creating notifications:', error);
    }
}

// NOTIFICATION POLLING
function startNotificationPolling() {
    if (notificationInterval) return;
    
    checkNotifications(); // Check immediately
    notificationInterval = setInterval(checkNotifications, 30000); // Check every 30 seconds
}

function stopNotificationPolling() {
    if (notificationInterval) {
        clearInterval(notificationInterval);
        notificationInterval = null;
    }
}

async function checkNotifications() {
    if (!currentUser) return;
    
    try {
        const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', currentUser.id)
            .eq('seen', false)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        if (data && data.length > 0) {
            updateNotificationBadge(data.length);
        } else {
            updateNotificationBadge(0);
        }
    } catch (error) {
        console.error('Error checking notifications:', error);
    }
}

function updateNotificationBadge(count) {
    const alertsTab = document.getElementById('alertsTab');
    if (!alertsTab) return;
    
    let badge = alertsTab.querySelector('.notification-badge');
    
    if (count > 0) {
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'notification-badge';
            alertsTab.style.position = 'relative';
            alertsTab.appendChild(badge);
        }
        badge.textContent = count > 9 ? '9+' : count;
    } else {
        badge?.remove();
    }
}

// Search posts
async function searchPosts() {
    const searchTerm = document.getElementById('searchInput')?.value?.trim().toLowerCase();
    
    if (!searchTerm) {
        displayPosts(allPosts);
        return;
    }
    
    const filtered = allPosts.filter(post => {
        return (
            post.title?.toLowerCase().includes(searchTerm) ||
            post.description?.toLowerCase().includes(searchTerm) ||
            post.category?.toLowerCase().includes(searchTerm) ||
            post.condition?.toLowerCase().includes(searchTerm) ||
            post.location_text?.toLowerCase().includes(searchTerm)
        );
    });
    
    displayPosts(filtered);
}

// MATCHES VIEW
async function showMatches() {
    if (!currentUser) {
        alert('Please sign in to view matches.');
        return;
    }
    
    // Update active tab
    document.querySelectorAll('.nav-tab').forEach(tab => tab.classList.remove('active'));
    document.getElementById('matchesTab')?.classList.add('active');
    
    try {
        const { data: userPosts } = await supabase
            .from('posts')
            .select('id')
            .eq('user_id', currentUser.id)
            .eq('status', 'active');
        
        const postIds = userPosts?.map(p => p.id) || [];
        
        if (postIds.length === 0) {
            displayMatches([]);
            return;
        }
        
        const { data: matches, error } = await supabase
            .from('matches')
            .select(`
                *,
                post_a:posts!matches_post_a_fkey(*, profiles:user_id(username, avatar_url)),
                post_b:posts!matches_post_b_fkey(*, profiles:user_id(username, avatar_url))
            `)
            .or(`post_a.in.(${postIds.join(',')}),post_b.in.(${postIds.join(',')})`);
        
        if (error) throw error;
        
        displayMatches(matches || []);
    } catch (error) {
        console.error('Error loading matches:', error);
    }
}

function displayMatches(matches) {
    const container = document.getElementById('postsContainer');
    if (!container) return;
    
    if (matches.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <h2>✨ No matches yet</h2>
                <p>When someone posts something that matches your listings, they'll appear here!</p>
                <p>Try posting more items to increase your chances of finding matches.</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = `
        <div class="matches-container">
            ${matches.map(match => `
                <div class="match-card">
                    <h3>⚡ Match Found!</h3>
                    <div class="match-posts">
                        <div class="match-post-wrapper">
                            ${createPostCard(match.post_a)}
                        </div>
                        <div class="match-indicator">
                            <div class="match-icon">⚡</div>
                            <div class="match-text">MATCH</div>
                        </div>
                        <div class="match-post-wrapper">
                            ${createPostCard(match.post_b)}
                        </div>
                    </div>
                    <p class="match-date">Matched ${formatDate(match.created_at)}</p>
                </div>
            `).join('')}
        </div>
    `;
}

// ALERTS/NOTIFICATIONS VIEW
async function showAlerts() {
    if (!currentUser) {
        alert('Please sign in to view alerts.');
        return;
    }
    
    // Update active tab
    document.querySelectorAll('.nav-tab').forEach(tab => tab.classList.remove('active'));
    document.getElementById('alertsTab')?.classList.add('active');
    
    try {
        const { data: notifications, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: false })
            .limit(50);
        
        if (error) throw error;
        
        // Mark all as seen
        if (notifications && notifications.length > 0) {
            await supabase
                .from('notifications')
                .update({ seen: true })
                .eq('user_id', currentUser.id)
                .eq('seen', false);
            
            updateNotificationBadge(0);
        }
        
        displayNotifications(notifications || []);
    } catch (error) {
        console.error('Error loading notifications:', error);
    }
}

function displayNotifications(notifications) {
    const container = document.getElementById('postsContainer');
    if (!container) return;
    
    if (notifications.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <h2>🔔 No notifications</h2>
                <p>You'll be notified when there are matches or important updates!</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = `
        <div class="notifications-container">
            ${notifications.map(notif => `
                <div class="notification-card ${notif.seen ? 'seen' : 'unseen'}">
                    <p>${escapeHtml(notif.message)}</p>
                    <span class="notification-date">${formatDate(notif.created_at)}</span>
                </div>
            `).join('')}
        </div>
    `;
}

// MAP VIEW (BF+ Feature)
async function showMap() {
    // Update active tab
    document.querySelectorAll('.nav-tab').forEach(tab => tab.classList.remove('active'));
    document.getElementById('mapTab')?.classList.add('active');
    
    if (!userProfile?.bf_plus) {
        showBFPlusUpgrade();
        return;
    }
    
    const container = document.getElementById('postsContainer');
    if (!container) return;
    
    try {
        // Get all posts with location data
        const { data: allPostsWithLocation, error } = await supabase
            .from('posts')
            .select(`
                *,
                profiles:user_id (username, avatar_url)
            `)
            .eq('status', 'active')
            .not('lat', 'is', null)
            .not('lng', 'is', null);
        
        if (error) throw error;
        
        displayMap(allPostsWithLocation || []);
    } catch (error) {
        console.error('Error loading map data:', error);
        container.innerHTML = `
            <div class="error-message">
                <p>Error loading map: ${error.message}</p>
            </div>
        `;
    }
}

function displayMap(posts) {
    const container = document.getElementById('postsContainer');
    if (!container) return;
    
    if (posts.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <h2>🗺️ Map View</h2>
                <p>No posts with location data yet.</p>
                <p>Posts with location information will appear on the map!</p>
            </div>
        `;
        return;
    }
    
    // Simple map visualization (in a real app, you'd use Google Maps or Mapbox)
    container.innerHTML = `
        <div class="map-view">
            <div class="map-controls">
                <button id="showSelling" class="btn btn-primary active">🔴 Selling</button>
                <button id="showRequesting" class="btn btn-primary active">🔵 Requesting</button>
            </div>
            <div class="map-container">
                <div class="map-placeholder">
                    <h3>🗺️ Map View (BF+ Feature)</h3>
                    <p>Found ${posts.length} posts with location data</p>
                    <div class="map-legend">
                        <div><span class="legend-dot red"></span> Selling</div>
                        <div><span class="legend-dot blue"></span> Requesting</div>
                    </div>
                    <p class="map-note">Note: Full interactive map integration coming soon!</p>
                </div>
            </div>
            <div class="map-posts-list">
                <h3>Posts on Map</h3>
                ${posts.map(post => createPostCard(post)).join('')}
            </div>
        </div>
    `;
    
    // Add filter functionality
    document.getElementById('showSelling')?.addEventListener('click', function() {
        this.classList.toggle('active');
        filterMapPosts();
    });
    
    document.getElementById('showRequesting')?.addEventListener('click', function() {
        this.classList.toggle('active');
        filterMapPosts();
    });
}

function filterMapPosts() {
    const showSelling = document.getElementById('showSelling')?.classList.contains('active');
    const showRequesting = document.getElementById('showRequesting')?.classList.contains('active');
    
    document.querySelectorAll('.map-posts-list .post-card').forEach(card => {
        const postId = card.dataset.postId;
        const post = allPosts.find(p => p.id === postId);
        
        if (!post) return;
        
        const shouldShow = (
            (showSelling && post.type === 'selling') ||
            (showRequesting && post.type === 'requesting')
        );
        
        card.style.display = shouldShow ? 'block' : 'none';
    });
}

// SETTINGS VIEW
function showSettings() {
    // Update active tab
    document.querySelectorAll('.nav-tab').forEach(tab => tab.classList.remove('active'));
    document.getElementById('settingsTab')?.classList.add('active');
    
    const container = document.getElementById('postsContainer');
    if (!container) return;
    
    container.innerHTML = `
        <div class="settings-container">
            <h2>⚙️ Settings</h2>
            
            <div class="settings-section">
                <h3>👤 Account</h3>
                ${currentUser ? `
                    <p><strong>Email:</strong> ${escapeHtml(currentUser.email)}</p>
                    <p><strong>Username:</strong> ${escapeHtml(userProfile?.username || 'Not set')}</p>
                    <p><strong>Membership:</strong> ${userProfile?.bf_plus ? '⭐ BF+ Premium' : '🆓 Free'}</p>
                    ${!userProfile?.bf_plus ? `
                        <button onclick="showBFPlusUpgrade()" class="btn btn-premium upgrade-btn">
                            ⭐ Upgrade to BF+ - $5/month
                        </button>
                    ` : `
                        <div class="premium-benefits">
                            <h4>Your BF+ Benefits:</h4>
                            <ul>
                                <li>✅ Boosted posts appear first</li>
                                <li>✅ Map view access</li>
                                <li>✅ Priority matching</li>
                                <li>✅ Advanced filters</li>
                            </ul>
                        </div>
                    `}
                ` : `
                    <p>Not signed in</p>
                    <button onclick="showAuthScreen()" class="btn btn-primary">Sign In</button>
                `}
            </div>
            
            ${currentUser ? `
                <div class="settings-section">
                    <h3>🔔 Notifications</h3>
                    <label class="settings-toggle">
                        <input type="checkbox" id="emailNotifications" checked>
                        <span>Email notifications</span>
                    </label>
                    <label class="settings-toggle">
                        <input type="checkbox" id="matchAlerts" checked>
                        <span>Match alerts</span>
                    </label>
                    <label class="settings-toggle">
                        <input type="checkbox" id="priceAlerts">
                        <span>Price drop alerts</span>
                    </label>
                </div>
                
                <div class="settings-section">
                    <h3>📊 My Posts</h3>
                    <button onclick="showMyPosts()" class="btn btn-secondary">View My Posts</button>
                </div>
            ` : ''}
            
            <div class="settings-section">
                <h3>ℹ️ About</h3>
                <p><strong>BuyerFinder</strong> - Connect buyers and sellers instantly</p>
                <p>Version 1.0</p>
                <p><a href="#" onclick="alert('Support: support@buyerfinder.com')">Contact Support</a></p>
            </div>
        </div>
    `;
}

async function showMyPosts() {
    if (!currentUser) return;
    
    try {
        const { data: myPosts, error } = await supabase
            .from('posts')
            .select(`
                *,
                profiles:user_id (username, avatar_url)
            `)
            .eq('user_id', currentUser.id)
            .eq('status', 'active')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        const container = document.getElementById('postsContainer');
        if (!container) return;
        
        container.innerHTML = `
            <div class="my-posts-container">
                <div class="my-posts-header">
                    <h2>📦 My Posts</h2>
                    <button onclick="showSettings()" class="btn btn-secondary">Back to Settings</button>
                </div>
                ${myPosts && myPosts.length > 0 ? `
                    <div class="posts-container">
                        ${myPosts.map(post => createPostCard(post)).join('')}
                    </div>
                ` : `
                    <div class="empty-state">
                        <h2>No posts yet</h2>
                        <p>Create your first post to get started!</p>
                        <button onclick="showNewPostModal()" class="btn btn-primary">Create Post</button>
                    </div>
                `}
            </div>
        `;
    } catch (error) {
        console.error('Error loading my posts:', error);
    }
}

// BF+ UPGRADE
function showBFPlusUpgrade() {
    const container = document.getElementById('postsContainer');
    if (!container) return;
    
    container.innerHTML = `
        <div class="upgrade-container">
            <div class="upgrade-hero">
                <h1>⭐ Upgrade to BF+ Premium</h1>
                <p class="upgrade-tagline">Get the most out of BuyerFinder</p>
            </div>
            
            <div class="upgrade-benefits">
                <div class="benefit-card">
                    <span class="benefit-icon">🚀</span>
                    <h3>Boosted Posts</h3>
                    <p>Your posts appear first in search results</p>
                </div>
                <div class="benefit-card">
                    <span class="benefit-icon">🗺️</span>
                    <h3>Map View</h3>
                    <p>See all posts on an interactive map</p>
                </div>
                <div class="benefit-card">
                    <span class="benefit-icon">⚡</span>
                    <h3>Priority Matching</h3>
                    <p>Get matched with buyers/sellers faster</p>
                </div>
                <div class="benefit-card">
                    <span class="benefit-icon">🔍</span>
                    <h3>Advanced Filters</h3>
                    <p>Find exactly what you're looking for</p>
                </div>
            </div>
            
            <div class="upgrade-pricing">
                <div class="pricing-card">
                    <h3>Monthly</h3>
                    <div class="price">$5<span>/month</span></div>
                    <button onclick="processUpgrade('monthly')" class="btn btn-premium">Upgrade Now</button>
                </div>
                <div class="pricing-card featured">
                    <div class="popular-badge">Most Popular</div>
                    <h3>Annual</h3>
                    <div class="price">$50<span>/year</span></div>
                    <p class="savings">Save $10!</p>
                    <button onclick="processUpgrade('annual')" class="btn btn-premium">Upgrade Now</button>
                </div>
            </div>
            
            <p class="upgrade-note">Cancel anytime. No questions asked.</p>
        </div>
    `;
}

async function processUpgrade(plan) {
    if (!currentUser) {
        alert('Please sign in to upgrade.');
        return;
    }
    
    // In a real app, this would integrate with Stripe or another payment processor
    alert(`Payment integration coming soon!\n\nPlan: ${plan}\nPrice: ${plan === 'monthly' ? '$5/month' : '$50/year'}\n\nFor now, contact support@buyerfinder.com to upgrade.`);
}

// Image upload handling
let uploadedImages = [];

async function handleImageUpload(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    if (files.length > 5) {
        alert('Maximum 5 images allowed per post.');
        return;
    }
    
    uploadedImages = [];
    showError('Uploading images...', 'info');
    
    for (const file of files) {
        if (file.size > 5 * 1024 * 1024) {
            alert(`File ${file.name} is too large. Maximum size is 5MB.`);
            continue;
        }
        
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${currentUser.id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
            
            const { data, error } = await supabase.storage
                .from('post_images')
                .upload(fileName, file);
            
            if (error) throw error;
            
            const { data: urlData } = supabase.storage
                .from('post_images')
                .getPublicUrl(fileName);
            
            uploadedImages.push(urlData.publicUrl);
        } catch (error) {
            console.error('Error uploading image:', error);
            alert(`Error uploading ${file.name}: ${error.message}`);
        }
    }
    
    updateImagePreview();
    document.getElementById('postError')?.classList.add('hidden');
}

function updateImagePreview() {
    const preview = document.getElementById('imagePreview');
    if (!preview) return;
    
    if (uploadedImages.length === 0) {
        preview.innerHTML = '';
        return;
    }
    
    preview.innerHTML = uploadedImages.map((url, index) => `
        <div class="image-preview-item">
            <img src="${url}" alt="Upload ${index + 1}">
            <button onclick="removeImage(${index})" class="remove-image" type="button">×</button>
        </div>
    `).join('');
}

function removeImage(index) {
    uploadedImages.splice(index, 1);
    updateImagePreview();
}

async function getUploadedImageUrls() {
    return uploadedImages;
}

// Modal controls
function showNewPostModal() {
    if (!currentUser) {
        alert('Please sign in to create a post.');
        return;
    }
    
    document.getElementById('newPostModal')?.classList.add('active');
    document.getElementById('postError')?.classList.add('hidden');
}

function hideNewPostModal() {
    document.getElementById('newPostModal')?.classList.remove('active');
    clearPostForm();
}

function clearPostForm() {
    document.getElementById('postTitle').value = '';
    document.getElementById('postDescription').value = '';
    document.getElementById('postPrice').value = '';
    document.getElementById('postCategory').value = '';
    document.getElementById('postCondition').value = '';
    document.getElementById('postLocation').value = '';
    document.getElementById('imageUpload').value = '';
    uploadedImages = [];
    updateImagePreview();
    document.getElementById('postError')?.classList.add('hidden');
}

// Screen management
function showAuthScreen() {
    document.getElementById('authScreen')?.classList.remove('hidden');
    document.getElementById('mainApp')?.classList.add('hidden');
}

function showMainApp() {
    document.getElementById('authScreen')?.classList.add('hidden');
    document.getElementById('mainApp')?.classList.remove('hidden');
    updateAuthButtons();
}

// Utility functions
function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    
    return date.toLocaleDateString();
}

function escapeHtml(text) {
    if (!text) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
