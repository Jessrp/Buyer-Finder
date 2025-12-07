/* ---------------------------------------------------
   POSTS.JS — Load feed, load MY posts, filters, render
-----------------------------------------------------*/

async function loadPosts(mode = "global") {
    const container = document.getElementById("posts-grid");
    const status = document.getElementById("posts-status");

    container.innerHTML = "";
    status.textContent = "Loading...";

    let query = supabaseClient.from("posts").select("*").order("created_at", { ascending: false });

    if (mode === "my") {
        if (!window.currentUser) {
            status.textContent = "Sign in to view your posts.";
            return;
        }
        query = query.eq("user_id", window.currentUser.id);
    }

    const { data, error } = await query;

    if (error) {
        status.textContent = "Error loading posts.";
        console.error(error);
        return;
    }

    if (!data || data.length === 0) {
        status.textContent = "No posts found.";
        return;
    }

    status.textContent = "";
    renderPosts(data);
}

/* ---------------------------------------------------
   RENDER POSTS INTO THE GRID
-----------------------------------------------------*/

function renderPosts(posts) {
    const container = document.getElementById("posts-grid");
    container.innerHTML = "";

    posts.forEach(post => {
        const card = document.createElement("div");
        card.className = "post-card";

        const img = document.createElement("img");
        img.src = post.image_url || "https://via.placeholder.com/300x200?text=No+Image";

        const title = document.createElement("div");
        title.className = "post-title";
        title.textContent = post.title || "Untitled";

        const price = document.createElement("div");
        price.className = "post-price";
        price.textContent = post.price ? `$${post.price}` : "";

        card.appendChild(img);
        card.appendChild(title);
        card.appendChild(price);

        container.appendChild(card);
    });
}

/* ---------------------------------------------------
   MY POSTS MODE + FILTERING
-----------------------------------------------------*/

let myPostsMode = false;
let currentFilter = "all";  // all | selling | requesting

document.getElementById("btn-my-posts").addEventListener("click", () => {
    myPostsMode = !myPostsMode;

    if (myPostsMode) {
        loadMyPostsWithFilter();
        document.getElementById("btn-my-posts").style.background = "#555";
    } else {
        loadPosts("global");
        document.getElementById("btn-my-posts").style.background = "";
    }
});

function loadMyPostsWithFilter() {
    if (!window.currentUser) return;

    supabaseClient
        .from("posts")
        .select("*")
        .eq("user_id", window.currentUser.id)
        .order("created_at", { ascending: false })
        .then(({ data, error }) => {
            if (error) {
                console.error(error);
                return;
            }

            let filtered = data;

            if (currentFilter === "selling") {
                filtered = filtered.filter(p => p.type === "sell");
            } else if (currentFilter === "requesting") {
                filtered = filtered.filter(p => p.type === "request");
            }

            document.getElementById("posts-status").textContent =
                filtered.length === 0 ? "No posts found." : "";

            renderPosts(filtered);
        });
}

/* ---------------------------------------------------
   FILTER BUTTONS
-----------------------------------------------------*/

document.getElementById("my-filter-selling").addEventListener("click", () => {
    currentFilter = currentFilter === "selling" ? "all" : "selling";
    updateFilterButtons();
    if (myPostsMode) loadMyPostsWithFilter();
});

document.getElementById("my-filter-request").addEventListener("click", () => {
    currentFilter = currentFilter === "requesting" ? "all" : "requesting";
    updateFilterButtons();
    if (myPostsMode) loadMyPostsWithFilter();
});

function updateFilterButtons() {
    const sellBtn = document.getElementById("my-filter-selling");
    const reqBtn = document.getElementById("my-filter-request");

    sellBtn.classList.remove("active");
    reqBtn.classList.remove("active");

    if (currentFilter === "selling") {
        sellBtn.classList.add("active");
    } else if (currentFilter === "requesting") {
        reqBtn.classList.add("active");
    }
}

/* ---------------------------------------------------
   INITIAL LOAD
-----------------------------------------------------*/

document.addEventListener("DOMContentLoaded", () => {
    loadPosts("global");
});