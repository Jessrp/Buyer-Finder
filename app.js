// BuyerFinder App - Fixed Version
// Critical fixes: type field mapping, post loading, and database queries

let currentUser = null;
let currentView = 'sell'; // 'sell' or 'requests'
let allPosts = [];
let userProfile = null;

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
    
    // Check for existing session
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session) {
        currentUser = session.user;
        await loadUserProfile();
        showMainApp();
        await loadPosts();
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
        } else if (event === 'SIGNED_OUT') {
            currentUser = null;
            userProfile = null;
            showAuthScreen();
        }
    });
    
    setupEventListeners();
}

// Set up all event listeners
function setupEventListeners() {
    // Auth buttons
    document.getElementById('signInGoogle')?.addEventListener('click', signInWithGoogle);
    document.getElementById('signInEmail')?.addEventListener('click', showEmailSignIn);
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
    
    const password = prompt('Enter your password:');
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
            // Try to sign up if sign in fails
            const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
                email,
                password
            });
            
            if (signUpError) throw signUpError;
            alert('Account created! Please check your email to verify.');
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
            // Create profile if it doesn't exist
            await createUserProfile();
        }
        
        updateProfileDisplay();
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
                <img src="${userProfile.avatar_url || 'default-avatar.png'}" alt="Profile" class="profile-avatar">
                <div class="profile-details">
                    <h3>${userProfile.username || 'User'}</h3>
                    <p>${userProfile.bf_plus ? 'BF+ Member' : 'Free'}</p>
                </div>
            </div>
        `;
    } else {
        profileSection.innerHTML = `
            <div class="guest-info">
                <h3>Guest</h3>
                <p>Not signed in</p>
                <button onclick="showAuthScreen()">Sign in</button>
            </div>
        `;
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
                <button onclick="loadPosts()">Retry</button>
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
                <p>No ${currentView === 'sell' ? 'items for sale' : 'requests'} yet.</p>
                <p>Be the first to post!</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = posts.map(post => createPostCard(post)).join('');
}

function createPostCard(post) {
    const profileInfo = post.profiles || {};
    const isPremium = profileInfo.bf_plus || false;
    const images = post.images || post.image_urls || [];
    const firstImage = Array.isArray(images) && images.length > 0 ? images[0] : null;
    
    return `
        <div class="post-card ${isPremium ? 'premium' : ''}" data-post-id="${post.id}">
            ${isPremium ? '<div class="premium-badge">BF+</div>' : ''}
            ${firstImage ? `<img src="${firstImage}" alt="${post.title}" class="post-image">` : ''}
            <div class="post-content">
                <h3>${post.title}</h3>
                <p class="post-description">${post.description || ''}</p>
                <div class="post-meta">
                    <span class="post-price">$${post.price}</span>
                    ${post.category ? `<span class="post-category">${post.category}</span>` : ''}
                    ${post.location_text ? `<span class="post-location">📍 ${post.location_text}</span>` : ''}
                </div>
                <div class="post-footer">
                    <div class="post-author">
                        <img src="${profileInfo.avatar_url || 'default-avatar.png'}" alt="${profileInfo.username || 'User'}" class="author-avatar">
                        <span>${profileInfo.username || 'User'}</span>
                    </div>
                    <span class="post-date">${formatDate(post.created_at)}</span>
                </div>
            </div>
        </div>
    `;
}

// Post creation with FIXED type setting
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
        alert('Please enter a title.');
        return;
    }
    
    if (!price || price <= 0) {
        alert('Please enter a valid price.');
        return;
    }
    
    try {
        // Get uploaded image URLs
        const images = await getUploadedImageUrls();
        
        // Map current view to database type
        const dbType = getDbType(currentView);
        
        const postData = {
            user_id: currentUser.id,
            title,
            description,
            price,
            type: dbType, // FIXED: Now correctly sets 'selling' or 'requesting'
            category: category || null,
            condition: condition || null,
            location_text: locationText || null,
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
        alert('Error creating post: ' + error.message);
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
            post.category?.toLowerCase().includes(searchTerm)
        );
    });
    
    displayPosts(filtered);
}

// Matching system - finds opposite type posts with similar content
async function checkForMatches(newPost) {
    try {
        // Get the opposite type
        const oppositeType = newPost.type === 'selling' ? 'requesting' : 'selling';
        
        // Find potential matches
        const { data: potentialMatches, error } = await supabase
            .from('posts')
            .select('*')
            .eq('type', oppositeType)
            .eq('status', 'active')
            .neq('user_id', currentUser.id);
        
        if (error) throw error;
        
        if (!potentialMatches || potentialMatches.length === 0) return;
        
        // Simple matching: look for similar titles or categories
        const matches = potentialMatches.filter(post => {
            const titleMatch = post.title?.toLowerCase().includes(newPost.title?.toLowerCase()) ||
                              newPost.title?.toLowerCase().includes(post.title?.toLowerCase());
            const categoryMatch = post.category === newPost.category;
            
            return titleMatch || categoryMatch;
        });
        
        // Create match records and notifications
        for (const match of matches) {
            await createMatch(newPost.id, match.id);
            await notifyUsers(newPost, match);
        }
        
    } catch (error) {
        console.error('Error checking for matches:', error);
    }
}

async function createMatch(postA, postB) {
    try {
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
        // Notify user of post2 about post1
        await supabase
            .from('notifications')
            .insert([{
                user_id: post2.user_id,
                message: `Found a match! Someone is ${post1.type === 'selling' ? 'selling' : 'requesting'}: ${post1.title}`,
                seen: false
            }]);
        
        // Notify user of post1 about post2
        await supabase
            .from('notifications')
            .insert([{
                user_id: post1.user_id,
                message: `Found a match! Someone is ${post2.type === 'selling' ? 'selling' : 'requesting'}: ${post2.title}`,
                seen: false
            }]);
    } catch (error) {
        console.error('Error creating notifications:', error);
    }
}

// Image upload handling
let uploadedImages = [];

async function handleImageUpload(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    uploadedImages = [];
    
    for (const file of files) {
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${currentUser.id}/${Date.now()}_${Math.random()}.${fileExt}`;
            
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
        }
    }
    
    updateImagePreview();
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
            <button onclick="removeImage(${index})" class="remove-image">×</button>
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
    document.getElementById('newPostModal')?.classList.add('active');
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
}

// Screen management
function showAuthScreen() {
    document.getElementById('authScreen')?.classList.remove('hidden');
    document.getElementById('mainApp')?.classList.add('hidden');
}

function showMainApp() {
    document.getElementById('authScreen')?.classList.add('hidden');
    document.getElementById('mainApp')?.classList.remove('hidden');
}

// Navigation functions
async function showMatches() {
    if (!currentUser) {
        alert('Please sign in to view matches.');
        return;
    }
    
    try {
        // Get all matches for current user's posts
        const { data: userPosts } = await supabase
            .from('posts')
            .select('id')
            .eq('user_id', currentUser.id);
        
        const postIds = userPosts?.map(p => p.id) || [];
        
        if (postIds.length === 0) {
            displayMatches([]);
            return;
        }
        
        const { data: matches, error } = await supabase
            .from('matches')
            .select(`
                *,
                post_a:posts!matches_post_a_fkey(*),
                post_b:posts!matches_post_b_fkey(*)
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
                <h2>No matches yet</h2>
                <p>When someone posts something that matches your listings, they'll appear here!</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = `
        <div class="matches-container">
            ${matches.map(match => `
                <div class="match-card">
                    <div class="match-posts">
                        ${createPostCard(match.post_a)}
                        <div class="match-indicator">⚡ MATCH ⚡</div>
                        ${createPostCard(match.post_b)}
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

async function showAlerts() {
    if (!currentUser) {
        alert('Please sign in to view alerts.');
        return;
    }
    
    try {
        const { data: notifications, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
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
                <h2>No notifications</h2>
                <p>You'll be notified when there are matches or important updates!</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = `
        <div class="notifications-container">
            ${notifications.map(notif => `
                <div class="notification-card ${notif.seen ? 'seen' : 'unseen'}">
                    <p>${notif.message}</p>
                    <span class="notification-date">${formatDate(notif.created_at)}</span>
                </div>
            `).join('')}
        </div>
    `;
}

function showMap() {
    if (!userProfile?.bf_plus) {
        alert('Map feature is only available for BF+ members. Upgrade to access!');
        return;
    }
    
    const container = document.getElementById('postsContainer');
    if (!container) return;
    
    container.innerHTML = `
        <div class="map-container">
            <div id="map" style="width: 100%; height: 500px;">
                <p>Map feature coming soon! This will show all posts on an interactive map.</p>
            </div>
        </div>
    `;
}

function showSettings() {
    const container = document.getElementById('postsContainer');
    if (!container) return;
    
    container.innerHTML = `
        <div class="settings-container">
            <h2>Settings</h2>
            <div class="settings-section">
                <h3>Account</h3>
                <p>Email: ${currentUser?.email || 'Not signed in'}</p>
                <p>Username: ${userProfile?.username || 'Not set'}</p>
                <p>Membership: ${userProfile?.bf_plus ? 'BF+ Premium' : 'Free'}</p>
                ${!userProfile?.bf_plus ? `
                    <button onclick="upgradeToBFPlus()" class="upgrade-btn">Upgrade to BF+ - $5/month</button>
                ` : ''}
            </div>
            <div class="settings-section">
                <h3>Notifications</h3>
                <label>
                    <input type="checkbox" checked> Email notifications
                </label>
                <label>
                    <input type="checkbox" checked> Match alerts
                </label>
            </div>
        </div>
    `;
}

async function upgradeToBFPlus() {
    if (!currentUser) {
        alert('Please sign in to upgrade.');
        return;
    }
    
    // This would integrate with a payment processor like Stripe
    // For now, just a placeholder
    alert('Payment integration coming soon! Contact support to upgrade to BF+.');
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
    
    return date.toLocaleDateString();
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
