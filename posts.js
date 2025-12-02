// posts.js

// Load all posts (selling + requesting)
async function loadPosts() {
    try {
        const { data, error } = await supabase
            .from('posts')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error("Error loading posts:", error);
            return;
        }

        const postsContainer = document.getElementById("postsContainer");
        postsContainer.innerHTML = "";

        data.forEach(post => {
            const div = document.createElement("div");
            div.classList.add("post-item");

            div.innerHTML = `
                <h3>${post.title}</h3>
                <p>${post.description}</p>
                <p><strong>$${post.price}</strong></p>
                ${post.image_url ? `<img src="${post.image_url}" class="post-img">` : ""}
            `;

            div.onclick = () => openPostDetails(post);
            postsContainer.appendChild(div);
        });

    } catch (err) {
        console.error("loadPosts() crashed:", err);
    }
}



// Create a post
async function createPost(newPost) {
    const { data, error } = await supabase.from("posts").insert(newPost);

    if (error) {
        console.error("Post create error:", error);
        return false;
    }

    return true;
}



// Search posts
async function searchPosts(query) {
    const { data, error } = await supabase
        .from("posts")
        .select("*")
        .ilike("title", `%${query}%`);

    if (error) {
        console.error("Search error:", error);
        return [];
    }

    return data;
}



// Open post details
function openPostDetails(post) {
    const panel = document.getElementById("postDetailPanel");

    panel.innerHTML = `
        <h2>${post.title}</h2>
        <p>${post.description}</p>
        <p><strong>$${post.price}</strong></p>
        ${post.image_url ? `<img src="${post.image_url}" class="post-img-large">` : ""}
    `;

    panel.style.display = "block";
}
