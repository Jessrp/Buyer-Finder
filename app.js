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
    document.getElementById('closeModalBtn')?.addEventListener('click', hideNewPostModal);
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
    const supabase = getSupabase();
    if (!supabase) {
        alert('Supabase is not configured. Please check your supabase.js file.');
        return;
    }
    
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
}'seen' : 'unseen'}">
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