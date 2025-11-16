import { supabase } from "./supabaseClient.js";

const postForm = document.getElementById("post-form");
const postsContainer = document.getElementById("posts-container");

async function uploadImage(file, userId) {
    if (!file) return null;

    const fileExt = file.name.split(".").pop();
    const fileName = `${userId}_${Date.now()}.${fileExt}`;
    const filePath = `posts/${fileName}`;

    const { error: uploadError } = await supabase.storage
        .from("post-images")
        .upload(filePath, file);

    if (uploadError) {
        console.error(uploadError);
        alert("Image upload failed");
        return null;
    }

    const { data: urlData } = supabase.storage
        .from("post-images")
        .getPublicUrl(filePath);

    return urlData.publicUrl;
}

postForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const user = (await supabase.auth.getUser()).data.user;
    if (!user) {
        alert("You must be signed in.");
        return;
    }

    const title = document.getElementById("post-title").value.trim();
    const description = document.getElementById("post-description").value.trim();
    const price = document.getElementById("post-price").value.trim();
    const imageFile = document.getElementById("post-image").files[0];

    let image_url = null;

    if (imageFile) {
        image_url = await uploadImage(imageFile, user.id);
    }

    const { data, error } = await supabase
        .from("posts")
        .insert([
            {
                user_id: user.id,
                title,
                description,
                price,
                image_url
            }
        ]);

    if (error) {
        console.error("Insert error:", error);
        alert("Error saving post: " + error.message);
        return;
    }

    postForm.reset();
    loadPosts();
});

async function loadPosts() {
    postsContainer.innerHTML = "<p>Loading...</p>";

    const { data: posts, error } = await supabase
        .from("posts")
        .select("*")
        .order("id", { ascending: false });

    if (error) {
        console.error(error);
        postsContainer.innerHTML = "<p>Error loading posts.</p>";
        return;
    }

    postsContainer.innerHTML = "";

    posts.forEach((post) => {
        const div = document.createElement("div");
        div.className = "post-box";

        div.innerHTML = `
            <h3>${post.title}</h3>
            <p>${post.description}</p>
            <p><strong>$${post.price}</strong></p>
            ${post.image_url ? `<img src="${post.image_url}" class="post-img" />` : ""}
        `;

        postsContainer.appendChild(div);
    });
}

loadPosts();
