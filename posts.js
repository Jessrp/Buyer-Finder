// posts.js

import { supabase } from "./auth.js";

// Load posts on page load
document.addEventListener("DOMContentLoaded", () => {
    loadPosts();
});

// Submit post
document.getElementById("submitPost").addEventListener("click", async () => {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;

    if (!userId) {
        alert("You must be signed in to post.");
        return;
    }

    const title = document.getElementById("title").value.trim();
    const description = document.getElementById("description").value.trim();
    const price = document.getElementById("price").value.trim();
    const file = document.getElementById("image").files[0];

    if (!title) {
        alert("Title is required.");
        return;
    }

    let image_url = null;

    // Upload image if provided
    if (file) {
        const filePath = `${userId}/${Date.now()}-${file.name}`;

        let { error: uploadError } = await supabase.storage
            .from("post-images")
            .upload(filePath, file, { upsert: true });

        if (uploadError) {
            console.error(uploadError);
            alert("Image upload failed.");
            return;
        }

        const { data: urlData } = supabase.storage
            .from("post-images")
            .getPublicUrl(filePath);

        image_url = urlData.publicUrl;
    }

    // Insert post
    let { error } = await supabase.from("posts").insert({
        title,
        description,
        price,
        image_url,
        user_id: userId,
    });

    if (error) {
        console.error(error);
        alert("Error saving post.");
        return;
    }

    alert("Post added!");
    loadPosts();
});

// Load all posts
async function loadPosts() {
    const postsContainer = document.getElementById("postsList");
    postsContainer.innerHTML = "";

    let { data: posts, error } = await supabase
        .from("posts")
        .select("*")
        .order("id", { ascending: false });

    if (error) {
        console.error(error);
        return;
    }

    posts.forEach((post) => {
        const item = document.createElement("div");
        item.className = "post-item";

        item.innerHTML = `
            <h3>${post.title}</h3>
            ${post.image_url ? `<img src="${post.image_url}" class="post-img">` : ""}
            <p>${post.description || ""}</p>
            <p><strong>$${post.price || ""}</strong></p>
        `;

        // When clicked → show post detail (future feature)
        item.addEventListener("click", () => {
            localStorage.setItem("selectedPost", post.id);
            window.location.href = "post.html";
        });

        postsContainer.appendChild(item);
    });
}
