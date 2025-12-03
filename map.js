// map.js

let map;

async function initMap() {
  if (!google || !google.maps) {
    console.error("Google Maps not loaded");
    return;
  }

  map = new google.maps.Map(document.getElementById("map-canvas"), {
    center: { lat: 37.0902, lng: -95.7129 },
    zoom: 4,
  });

  loadMapPosts();
}

async function loadMapPosts() {
  try {
    const { data: posts, error } = await supabase
      .from("posts")
      .select("id, title, lat, lng, type");

    if (error) {
      console.error("Error loading map posts:", error);
      return;
    }

    posts.forEach(post => {
      if (!post.lat || !post.lng) return;

      new google.maps.Marker({
        position: { lat: post.lat, lng: post.lng },
        map,
        title: post.title,
        icon: post.type === "sell" ? "red-dot.png" : "blue-dot.png",
      });
    });

  } catch (err) {
    console.error("Map loading crashed:", err);
  }
}
