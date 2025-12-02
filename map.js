// map.js

let map;
let markers = [];

async function loadMap() {
    if (!map) {
        map = L.map("mapContainer").setView([37.0902, -95.7129], 4);

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            maxZoom: 19
        }).addTo(map);
    }

    markers.forEach(m => map.removeLayer(m));
    markers = [];

    const { data: posts, error } = await supabase
        .from("posts")
        .select("id, title, lat, lng, type");

    if (error) {
        console.error("Map load error:", error);
        return;
    }

    posts.forEach(post => {
        if (!post.lat || !post.lng) return;

        const color = post.type === "sell" ? "red" : "blue";

        const marker = L.circleMarker([post.lat, post.lng], {
            radius: 8,
            color,
            fillColor: color,
            fillOpacity: 0.9
        }).addTo(map);

        marker.on("click", () => {
            openPostFromMap(post.id);
        });

        markers.push(marker);
    });
}


async function openPostFromMap(postId) {
    const { data, error } = await supabase
        .from("posts")
        .select("*")
        .eq("id", postId)
        .single();

    if (error) {
        console.error("Map-post fetch error:", error);
        return;
    }

    openPostDetails(data);
}
