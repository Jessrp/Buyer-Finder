// api/referral-notify.js
const { createClient } = require("@supabase/supabase-js");
const nodemailer = require("nodemailer");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { newUserId, referralCode } = req.body;

  if (!newUserId || !referralCode) {
    return res.status(400).json({ error: "Missing newUserId or referralCode" });
  }

  const supa = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    const { error: updateErr } = await supa
      .from("profiles")
      .update({ referred_by: referralCode })
      .eq("id", newUserId)
      .is("referred_by", null);

    if (updateErr) console.error("referred_by update error:", updateErr.message);

    const { data: referrer, error: refErr } = await supa
      .from("profiles")
      .select("id, username, email, referral_code")
      .eq("referral_code", referralCode)
      .maybeSingle();

    if (refErr || !referrer) {
      return res.status(404).json({ error: "Referral code not found" });
    }

    const { count, error: countErr } = await supa
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("referred_by", referralCode);

    if (countErr) return res.status(500).json({ error: countErr.message });

    const referralCount = count || 0;
    console.log(`Referral tracked: ${referrer.username} now has ${referralCount} referrals`);

    if (referralCount === 3 || referralCount === 5) {
      await sendAlert(referrer, referralCount);
    }

    return res.status(200).json({ success: true, referralCount, qualified: referralCount >= 5 });

  } catch (err) {
    console.error("Referral notify error:", err);
    return res.status(500).json({ error: err.message });
  }
};

async function sendAlert(referrer, count) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.NOTIFY_EMAIL_USER,
      pass: process.env.NOTIFY_EMAIL_PASS,
    },
  });

  const qualified = count >= 5;
  const subject = qualified
    ? `🎉 BuyrFindr: ${referrer.username} just hit 5 referrals — BF+ for life!`
    : `📊 BuyrFindr: ${referrer.username} has ${count} referrals so far`;

  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;">
      <h2 style="color:#00dfa2;">${qualified ? "🎉 Referral Goal Hit!" : "📊 Referral Update"}</h2>
      <p style="font-size:16px;color:#333;">
        <strong>${referrer.username}</strong>
        ${qualified
          ? "has hit <strong>5 referrals</strong> and qualifies for <strong>BF+ for life</strong>!"
          : `now has <strong>${count} referral${count !== 1 ? "s" : ""}</strong> — getting close!`}
      </p>
      <table style="margin-top:16px;border-collapse:collapse;width:100%;">
        <tr><td style="padding:8px;background:#f5f5f5;font-weight:bold;">Username</td><td style="padding:8px;background:#f5f5f5;">${referrer.username}</td></tr>
        <tr><td style="padding:8px;font-weight:bold;">Email</td><td style="padding:8px;">${referrer.email || "not set"}</td></tr>
        <tr><td style="padding:8px;background:#f5f5f5;font-weight:bold;">Referral Code</td><td style="padding:8px;background:#f5f5f5;">${referrer.referral_code}</td></tr>
        <tr><td style="padding:8px;font-weight:bold;">Referrals</td><td style="padding:8px;">${count}</td></tr>
      </table>
      ${qualified ? `<div style="margin-top:20px;padding:16px;background:#e6fff8;border-radius:8px;border:1px solid #00dfa2;"><strong>Action needed:</strong> Grant this user BF+ for life in Supabase. Set <code>premium = true</code> and clear <code>bfplus_expires_at</code>.</div>` : ""}
    </div>
  `;

  await transporter.sendMail({
    from: process.env.NOTIFY_EMAIL_USER,
    to: "gessep033@gmail.com",
    subject,
    html,
  });

  console.log(`Alert email sent for ${referrer.username} (${count} referrals)`);
}
