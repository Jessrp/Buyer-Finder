const { createClient } = require("@supabase/supabase-js");
const supa = createClient(
  "https://hcgwldsslzkppzgfhwws.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjZ3dsZHNzbHprcHB6Z2Zod3dzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDUzMTUxNiwiZXhwIjoyMDc2MTA3NTE2fQ.0np_u6eVCg3oJRtzecpNblgLMO3iYAyEG_5bUGvuiGE"
);
async function fix() {
  // Unfreeze all posts
  const { error: e1 } = await supa.from("posts").update({ frozen: false }).eq("frozen", true);
  console.log("Unfreeze:", e1 ? e1.message : "done");
  // Check post count
  const { data, error: e2 } = await supa.from("posts").select("id");
  console.log("Total posts:", data?.length, e2?.message || "");
}
fix();
