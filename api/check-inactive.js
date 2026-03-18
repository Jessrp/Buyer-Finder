// api/check-inactive.js
// Vercel cron job — runs daily to notify users inactive for 15+ days
// Schedule is set in vercel.json

import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const resend = new Resend(process.env.RESEND_API_KEY);
const APP_URL = process.env.APP_URL || "https://buyrfindr.com";

export default async function handler(req, res) {
  // Vercel cron passes a secret header — verify it
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    // Get users who need a notification (15+ days inactive, not yet frozen, not yet notified)
    const { data: users, error } = await supabase.rpc("flag_inactive_for_notification");
    if (error) throw error;

    if (!users || users.length === 0) {
      return res.status(200).json({ ok: true, notified: 0 });
    }

    let notified = 0;

    for (const user of users) {
      if (!user.email) continue;

      // Send email
      await resend.emails.send({
        from: `BuyrFindr <${process.env.NOTIFY_FROM_EMAIL}>`,
        to: user.email,
        subject: "⚠️ Your BuyrFindr posts will be paused soon",
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;">
            <h2 style="color:#00dfa2;margin-bottom:8px;">BuyrFindr</h2>
            <p style="font-size:15px;line-height:1.6;color:#333;">
              Hey ${user.username || "there"} 👋
            </p>
            <p style="font-size:15px;line-height:1.6;color:#333;">
              We noticed you haven't logged into BuyrFindr in a while.
              <strong>If you don't log back in within the next 5 days, your posts will be automatically paused</strong>
              so other users aren't waiting around on inactive listings.
            </p>
            <p style="font-size:15px;line-height:1.6;color:#333;">
              Don't worry — your posts won't be deleted. Just log back in and you can reactivate them with one tap.
            </p>
            <a href="${APP_URL}" style="display:inline-block;margin-top:20px;padding:12px 24px;background:#00dfa2;color:#000;font-weight:700;border-radius:999px;text-decoration:none;">
              Log back in →
            </a>
            <p style="margin-top:24px;font-size:11px;color:#999;">
              You're receiving this because you have an account on BuyrFindr.
            </p>
          </div>
        `,
      });

      // Mark as notified so we don't spam them
      await supabase
        .from("profiles")
        .update({ freeze_notified_at: new Date().toISOString() })
        .eq("id", user.user_id);

      notified++;
    }

    return res.status(200).json({ ok: true, notified });

  } catch (err) {
    console.error("check-inactive error:", err);
    return res.status(500).json({ error: err.message });
  }
}
