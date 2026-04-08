// seed-posts.js
// Run with: node seed-posts.js
// Inserts ~60 realistic fake posts into BuyrFindr's Supabase posts table

const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL  = "https://hcgwldsslzkppzgfhwws.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjZ3dsZHNzbHprcHB6Z2Zod3dzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA1MzE1MTYsImV4cCI6MjA3NjEwNzUxNn0.fCKpSI2UYHBlgAbus18srgkJ3FuOTAzDCgtw_lH3Yc4";

const supa = createClient(SUPABASE_URL, SUPABASE_ANON);

// ── FAKE USER IDs ─────────────────────────────────────────
// These are placeholder UUIDs for seeded "users" — not real auth users.
// They just populate the user_id field so posts look natural.
const FAKE_USERS = [
  { id: "aaaaaaaa-0001-0001-0001-000000000001", username: "mike_trades",    email: "mike@example.com",    city: "Atlanta, GA",      lat: 33.749,  lng: -84.388  },
  { id: "aaaaaaaa-0001-0001-0001-000000000002", username: "sarah_sells",    email: "sarah@example.com",   city: "Charlotte, NC",    lat: 35.227,  lng: -80.843  },
  { id: "aaaaaaaa-0001-0001-0001-000000000003", username: "dj_nashville",   email: "dj@example.com",      city: "Nashville, TN",    lat: 36.174,  lng: -86.767  },
  { id: "aaaaaaaa-0001-0001-0001-000000000004", username: "columbia_carl",  email: "carl@example.com",    city: "Columbia, SC",     lat: 34.000,  lng: -81.035  },
  { id: "aaaaaaaa-0001-0001-0001-000000000005", username: "raleigh_rita",   email: "rita@example.com",    city: "Raleigh, NC",      lat: 35.779,  lng: -78.638  },
  { id: "aaaaaaaa-0001-0001-0001-000000000006", username: "tampa_tony",     email: "tony@example.com",    city: "Tampa, FL",        lat: 27.948,  lng: -82.458  },
  { id: "aaaaaaaa-0001-0001-0001-000000000007", username: "memphis_maya",   email: "maya@example.com",    city: "Memphis, TN",      lat: 35.149,  lng: -90.048  },
  { id: "aaaaaaaa-0001-0001-0001-000000000008", username: "jacksonville_j", email: "jj@example.com",      city: "Jacksonville, FL", lat: 30.332,  lng: -81.655  },
];

function randUser() {
  return FAKE_USERS[Math.floor(Math.random() * FAKE_USERS.length)];
}

function jitter(coord) {
  return coord + (Math.random() - 0.5) * 0.18;
}

function randPrice(min, max) {
  return (Math.floor(Math.random() * (max - min + 1)) + min).toString();
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - Math.floor(Math.random() * n));
  return d.toISOString();
}

// ── SELLING POSTS ─────────────────────────────────────────
const SELLING = [
  { title: "Fender Stratocaster Electric Guitar", description: "Sunburst finish, plays great, minor cosmetic scratches on body. Comes with gig bag.", category: "Music", price: randPrice(280, 420) },
  { title: "55\" Samsung 4K Smart TV", description: "2022 model, works perfectly. Selling because we upgraded. Remote included.", category: "Electronics", price: randPrice(180, 320) },
  { title: "Trek 7.2 FX Hybrid Bike", description: "Size medium, barely used. Great for commuting or weekend rides. Lock included.", category: "Sports", price: randPrice(200, 350) },
  { title: "PlayStation 5 Console + 2 Controllers", description: "Disc edition, comes with Spider-Man 2 and God of War Ragnarok.", category: "Gaming", price: randPrice(380, 480) },
  { title: "Vintage Leather Couch", description: "Brown leather sectional, very comfortable, minor wear on armrests. Must pick up.", category: "Furniture", price: randPrice(180, 350) },
  { title: "iPhone 14 Pro 256GB", description: "Deep purple, unlocked, no cracks. Battery health 91%. Comes with original box.", category: "Electronics", price: randPrice(520, 680) },
  { title: "Weber Spirit II Gas Grill", description: "3 burner, used two summers. Clean and in great shape. Propane tank not included.", category: "Outdoors", price: randPrice(160, 260) },
  { title: "Craftsman 200-Piece Tool Set", description: "Full socket and wrench set in hard case. Missing 2 pieces. Otherwise complete.", category: "Tools", price: randPrice(60, 110) },
  { title: "Acoustic Guitar — Yamaha FG800", description: "Great beginner/intermediate guitar. Excellent condition, no cracks or buzzing.", category: "Music", price: randPrice(120, 200) },
  { title: "GoPro Hero 11 Black", description: "Like new, used twice. Includes 2 batteries, 64GB card, chest mount and head strap.", category: "Electronics", price: randPrice(220, 300) },
  { title: "Dining Table with 4 Chairs", description: "Solid wood farmhouse style, seats 4-6. Small chip on one corner, barely noticeable.", category: "Furniture", price: randPrice(140, 280) },
  { title: "Lawnmower — Honda HRX217", description: "Self-propelled, runs perfectly. Oil changed this season. Blade sharpened.", category: "Outdoors", price: randPrice(200, 320) },
  { title: "Vitamix 5200 Blender", description: "Professional grade, used regularly but in excellent shape. All original parts.", category: "Kitchen", price: randPrice(180, 260) },
  { title: "Nintendo Switch OLED + Games", description: "White model, comes with Mario Kart 8, Zelda TOTK, and Animal Crossing.", category: "Gaming", price: randPrice(280, 380) },
  { title: "Mountain Bike — Specialized Rockhopper", description: "29er, medium frame, recently tuned up. New rear tire. Great trail bike.", category: "Sports", price: randPrice(380, 520) },
  { title: "Canon EOS Rebel SL3 Camera Kit", description: "18-55mm kit lens, 2 batteries, 128GB card and bag. Under 3k shutter count.", category: "Electronics", price: randPrice(480, 620) },
  { title: "Baby Crib + Mattress", description: "Convertible 4-in-1 crib, whitewash finish. Mattress included, very clean.", category: "Baby", price: randPrice(100, 180) },
  { title: "KitchenAid Stand Mixer", description: "Artisan 5qt, empire red. Used for baking, works flawlessly. Bowl and attachments included.", category: "Kitchen", price: randPrice(200, 300) },
  { title: "Kayak — Pelican Argo 100X", description: "10ft sit-in kayak, yellow. Used a handful of times. Paddle included.", category: "Sports", price: randPrice(280, 420) },
  { title: "Air Compressor — Porter Cable 6 Gallon", description: "Works great, used for tires and nailing. Oil-free pump.", category: "Tools", price: randPrice(60, 100) },
  { title: "Sectional Sofa — Gray Microfiber", description: "L-shaped, seats 5-6, chaise lounge end. Small stain on one cushion. Very comfy.", category: "Furniture", price: randPrice(260, 420) },
  { title: "iPad Air 5th Gen 64GB", description: "Space gray, WiFi only. No scratches, comes with Apple Pencil 1st gen.", category: "Electronics", price: randPrice(380, 500) },
  { title: "Dewalt 20V Drill + Impact Driver Combo", description: "Two batteries, charger, and case. Lightly used on one project.", category: "Tools", price: randPrice(100, 160) },
  { title: "Dog Crate — Large 42 inch", description: "Heavy duty wire crate with divider panel and tray. Folds flat for storage.", category: "Pets", price: randPrice(40, 70) },
  { title: "Treadmill — NordicTrack T6.5S", description: "Works great, folds up. Located in garage, buyer must load and haul.", category: "Sports", price: randPrice(300, 480) },
  { title: "Breville Espresso Machine", description: "Barista Express BES870XL with grinder. Includes all accessories. Excellent condition.", category: "Kitchen", price: randPrice(380, 520) },
  { title: "65\" LG OLED TV C2", description: "Stunning picture quality. No scratches, wall mount included. Moving so must sell.", category: "Electronics", price: randPrice(800, 1100) },
  { title: "Vintage Record Player + 40 Vinyl Records", description: "Crosley turntable plus curated vinyl collection — classic rock, soul, jazz.", category: "Music", price: randPrice(100, 180) },
  { title: "Power Wheels Jeep — Kids Ride On", description: "12V, works great. Battery holds charge. Minor scuffs from outdoor use.", category: "Toys", price: randPrice(60, 100) },
  { title: "Roomba i3+ Robot Vacuum", description: "Self-emptying base included. Works great on hardwood and carpet. Barely used.", category: "Home", price: randPrice(180, 280) },
];

// ── REQUESTING POSTS ──────────────────────────────────────
const REQUESTING = [
  { title: "Looking for a used road bike", description: "Need a road bike, size 54-56cm. Budget around $300. Any brand considered.", category: "Sports", price: "300" },
  { title: "ISO: Dresser or chest of drawers", description: "Moving into new place, need a dresser. Prefer wood, nothing too beat up. Budget $80.", category: "Furniture", price: "80" },
  { title: "Wanted: iPhone 13 or newer, unlocked", description: "Doesn't need to be perfect. Budget up to $400. Must be unlocked for T-Mobile.", category: "Electronics", price: "400" },
  { title: "Looking for a used lawn mower", description: "Doesn't need to be fancy. Push or self-propelled both fine. Under $150.", category: "Outdoors", price: "150" },
  { title: "ISO: Baby gear — bouncer, swing, or bassinet", description: "Expecting in 2 months, on a budget. Clean condition only please.", category: "Baby", price: "60" },
  { title: "Wanted: Acoustic or electric guitar for beginner", description: "Buying for my 12 year old. Budget $100-$150. Any condition as long as it plays.", category: "Music", price: "150" },
  { title: "Looking for a small desk for home office", description: "Apartment is small so nothing huge. 48 inches wide or less. Budget around $75.", category: "Furniture", price: "75" },
  { title: "ISO: PS4 or PS5 console", description: "Either works. Budget is $200 for PS4 or $350 for PS5. Must include at least one controller.", category: "Gaming", price: "350" },
  { title: "Wanted: Kayak or canoe", description: "Looking for something to take on flatwater lakes. Budget around $300-$400.", category: "Sports", price: "400" },
  { title: "ISO: Chest freezer, any size", description: "Moving to a house with a garage. Need a chest freezer. Budget $100-$150.", category: "Appliances", price: "150" },
  { title: "Looking for a used MacBook", description: "Any model from 2019 or newer. Budget $500. Must be in working condition.", category: "Electronics", price: "500" },
  { title: "Wanted: Treadmill or elliptical", description: "Home gym setup. Doesn't need to be fancy, just functional. Budget $200.", category: "Sports", price: "200" },
  { title: "ISO: Kids bedroom furniture set", description: "Twin bed frame, dresser, maybe nightstand. Budget $200 for the set.", category: "Furniture", price: "200" },
  { title: "Looking for a pressure washer", description: "Electric is fine. Need it for driveway and deck cleaning. Budget around $100.", category: "Tools", price: "100" },
  { title: "Wanted: Stand mixer or food processor", description: "Starting to bake more. KitchenAid preferred but open to others. Budget $150.", category: "Kitchen", price: "150" },
  { title: "ISO: Dog kennel or large crate", description: "Have a 70lb lab mix. Need a sturdy crate, 42\" or larger. Budget $50.", category: "Pets", price: "50" },
  { title: "Looking for patio furniture set", description: "Table + chairs for a small deck. 4 seats minimum. Budget $150.", category: "Outdoors", price: "150" },
  { title: "Wanted: Camera — DSLR or mirrorless", description: "Getting into photography. Budget $400. Any brand, just needs to work well.", category: "Electronics", price: "400" },
  { title: "ISO: Air fryer in good condition", description: "Anything 5qt or larger. Budget $40. Name brand preferred.", category: "Kitchen", price: "40" },
  { title: "Looking for a truck bed toolbox", description: "Full size truck, 6.5ft bed. Any brand. Budget around $100.", category: "Tools", price: "100" },
];

async function seedProfiles() {
  console.log("Seeding fake profiles...");
  for (const u of FAKE_USERS) {
    const { error } = await supa.from("profiles").upsert({
      id:       u.id,
      username: u.username,
      email:    u.email,
      premium:  false,
      lat:      u.lat,
      lng:      u.lng,
      location_text: u.city,
    }, { onConflict: "id" });
    if (error && !error.message.includes("violates")) {
      console.warn("Profile upsert warning:", u.username, error.message);
    }
  }
  console.log("Profiles done.");
}

async function seedPosts() {
  console.log("Seeding posts...");
  const posts = [];

  // Build selling posts
  for (const p of SELLING) {
    const user = randUser();
    posts.push({
      user_id:       user.id,
      title:         p.title,
      description:   p.description,
      price:         p.price,
      category:      p.category,
      type:          "selling",
      lat:           jitter(user.lat),
      lng:           jitter(user.lng),
      location_text: user.city,
      sold:          false,
      frozen:        false,
      image_urls:    [],
      created_at:    daysAgo(30),
    });
  }

  // Build requesting posts
  for (const p of REQUESTING) {
    const user = randUser();
    posts.push({
      user_id:       user.id,
      title:         p.title,
      description:   p.description,
      price:         p.price,
      category:      p.category,
      type:          "requesting",
      lat:           jitter(user.lat),
      lng:           jitter(user.lng),
      location_text: user.city,
      sold:          false,
      frozen:        false,
      image_urls:    [],
      created_at:    daysAgo(30),
    });
  }

  // Shuffle so they appear mixed
  posts.sort(() => Math.random() - 0.5);

  const { data, error } = await supa.from("posts").insert(posts).select("id");
  if (error) {
    console.error("Post insert error:", error.message);
  } else {
    console.log(`✅ Inserted ${data.length} posts successfully.`);
  }
}

(async () => {
  await seedProfiles();
  await seedPosts();
  console.log("🎉 Seed complete!");
})();
