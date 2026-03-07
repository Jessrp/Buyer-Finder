// api/save-push-subscription.js
// Called from the frontend after the user grants push permission.
// Saves their push subscription object to their profile in Supabase.

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { userId, subscription } = req.body;

  if (!userId || !subscription) {
    return res.status(400).json({ error: "Missing userId or subscription" });
  }

  try {
    // Get existing subscriptions array
    const { data: profile } = await supabase
      .from("profiles")
      .select("push_subscriptions")
      .eq("id", userId)
      .single();

    const existing = profile?.push_subscriptions || [];

    // Avoid duplicates by endpoint
    const filtered = existing.filter(s => s.endpoint !== subscription.endpoint);
    const updated  = [...filtered, subscription];

    await supabase
      .from("profiles")
      .update({ push_subscriptions: updated })
      .eq("id", userId);

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("save-push-subscription error:", err);
    return res.status(500).json({ error: err.message });
  }
}
