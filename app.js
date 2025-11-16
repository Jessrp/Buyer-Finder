async function uploadPostImage() {
    const file = document.getElementById("postImageInput").files[0];
    if (!file) return null;

    const fileName = `post-${Date.now()}-${file.name}`;

    const { error } = await supabase.storage
        .from("images")
        .upload(fileName, file);

    if (error) {
        console.error(error);
        return null;
    }

    return `${supabaseUrl}/storage/v1/object/public/images/${fileName}`;
}

document.getElementById("submitPostBtn").addEventListener("click", async () => {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) {
        alert("You must sign in first.");
        return;
    }

    const title = document.getElementById("postTitle").value.trim();
    const description = document.getElementById("postDesc").value.trim();
    const price = document.getElementById("postPrice").value.trim();

    const imgUrl = await uploadPostImage();  // Upload picture

    const { error } = await supabase.from("posts").insert({
        title,
        description,
        price,
        image_url: imgUrl,
        user_id: user.id
    });

    if (error) {
        console.error(error);
        alert("Post creation failed");
    } else {
        loadPosts();
    }
});

// LOAD POSTS
async function loadPosts() {
    const { data: posts, error } = await supabase
        .from("posts")
        .select("*")
        .order("id", { ascending: false });

    if (error) {
        console.error(error);
        return;
    }

    const container = document.getElementById("postsContainer");
    container.innerHTML = "";

    posts.forEach(post => {
        const div = document.createElement("div");
        div.classList.add("postCard");

        let html = `
        <h3>${post.title}</h3>
        <p>${post.description}</p>
        <p><b>$${post.price}</b></p>
        `;

        if (post.image_url) {
            html += `<img src="${post.image_url}" class="postImage">`;
        }

        div.innerHTML = html;
        container.appendChild(div);
    });
}

loadPosts();
