// api/notify.js
// Called by Supabase Database Webhooks when a new match or message is inserted.
// Sends: 1) Email via Resend  2) Web Push notification

import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { Resend } from "resend";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const resend = new Resend(process.env.RESEND_API_KEY);

webpush.setVapidDetails(
  "mailto:" + process.env.NOTIFY_FROM_EMAIL,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  // Verify the shared secret Supabase sends as a header
  const secret = req.headers["x-webhook-secret"];
  if (secret !== process.env.WEBHOOK_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { type, record, table } = req.body;

  // We only care about INSERT events
  if (type !== "INSERT") return res.status(200).json({ ok: true });

  try {
    if (table === "messages") {
      await handleNewMessage(record);
    } else if (table === "matches") {
      await handleNewMatch(record);
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("notify error:", err);
    return res.status(500).json({ error: err.message });
  }
}

// ── NEW MESSAGE ──────────────────────────────────────────────────────
async function handleNewMessage(message) {
  // Get conversation to find the recipient
  const { data: convo } = await supabase
    .from("conversations")
    .select("buyer_id, seller_id, posts(title)")
    .eq("id", message.conversation_id)
    .single();

  if (!convo) return;

  // Recipient is whoever DIDN'T send the message
  const recipientId = convo.buyer_id === message.sender_id
    ? convo.seller_id
    : convo.buyer_id;

  const { data: sender }    = await supabase.from("profiles").select("username").eq("id", message.sender_id).single();
  const { data: recipient } = await supabase.from("profiles").select("username, email, push_subscriptions").eq("id", recipientId).single();

  if (!recipient) return;

  const senderName  = sender?.username   || "Someone";
  const postTitle   = convo.posts?.title || "a post";
  const subject     = `💬 New message from ${senderName}`;
  const body        = `${senderName} sent you a message about "${postTitle}":\n\n"${message.body.slice(0, 200)}"`;
  const appUrl      = process.env.APP_URL || "https://buyrfindr.com";

  await Promise.allSettled([
    sendEmail({ to: recipient.email, subject, body, appUrl }),
    sendPush({
      subscriptions: recipient.push_subscriptions || [],
      title: subject,
      body: `"${message.body.slice(0, 100)}"`,
      url: appUrl,
    }),
  ]);
}

// ── NEW MATCH ────────────────────────────────────────────────────────
async function handleNewMatch(match) {
  // Notify both buyer and seller
  const { data: buyerProfile }  = await supabase.from("profiles").select("username, email, push_subscriptions").eq("id", match.buyer_id).single();
  const { data: sellerProfile } = await supabase.from("profiles").select("username, email, push_subscriptions").eq("id", match.seller_id).single();

  const { data: buyPost }  = await supabase.from("posts").select("title").eq("id", match.buy_post_id).single();
  const { data: sellPost } = await supabase.from("posts").select("title").eq("id", match.sell_post_id).single();

  const appUrl = process.env.APP_URL || "https://buyrfindr.com";
  const score  = Math.round(match.score || 0);

  const notifications = [];

  if (buyerProfile?.email) {
    notifications.push(
      sendEmail({
        to: buyerProfile.email,
        subject: `✨ New match found! (${score}% match)`,
        body: `Great news! Your request "${buyPost?.title}" matched with a listing "${sellPost?.title}" at ${score}% compatibility.\n\nHead to BuyrFindr to check it out.`,
        appUrl,
      }),
      sendPush({
        subscriptions: buyerProfile.push_subscriptions || [],
        title: `✨ New match! ${score}%`,
        body: `Your request "${buyPost?.title}" matched with "${sellPost?.title}"`,
        url: appUrl,
      })
    );
  }

  if (sellerProfile?.email) {
    notifications.push(
      sendEmail({
        to: sellerProfile.email,
        subject: `✨ Someone wants what you're selling! (${score}% match)`,
        body: `Your listing "${sellPost?.title}" matched with a buyer looking for "${buyPost?.title}" — ${score}% compatibility.\n\nHead to BuyrFindr to connect.`,
        appUrl,
      }),
      sendPush({
        subscriptions: sellerProfile.push_subscriptions || [],
        title: `✨ Buyer match! ${score}%`,
        body: `Your listing "${sellPost?.title}" matched with a buyer`,
        url: appUrl,
      })
    );
  }

  await Promise.allSettled(notifications);
}

// ── HELPERS ──────────────────────────────────────────────────────────
async function sendEmail({ to, subject, body, appUrl }) {
  if (!to) return;
  await resend.emails.send({
    from: `BuyrFindr <${process.env.NOTIFY_FROM_EMAIL}>`,
    to,
    subject,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;">
        <h2 style="color:#00dfa2;margin-bottom:8px;">BuyrFindr</h2>
        <p style="font-size:15px;line-height:1.6;color:#333;">${body.replace(/\n/g, "<br/>")}</p>
        <a href="${appUrl}" style="display:inline-block;margin-top:20px;padding:12px 24px;background:#00dfa2;color:#000;font-weight:700;border-radius:999px;text-decoration:none;">
          Open BuyrFindr
        </a>
        <p style="margin-top:24px;font-size:11px;color:#999;">
          You're receiving this because you have an account on BuyrFindr.<br/>
          <a href="${appUrl}/unsubscribe" style="color:#999;">Unsubscribe</a>
        </p>
      </div>
    `,
  });
}

async function sendPush({ subscriptions, title, body, url }) {
  if (!subscriptions || subscriptions.length === 0) return;
  const payload = JSON.stringify({ title, body, url });
  await Promise.allSettled(
    subscriptions.map(sub =>
      webpush.sendNotification(sub, payload).catch(err => {
        // 410 = subscription expired/invalid, remove it
        if (err.statusCode === 410) {
          supabase.rpc("remove_push_subscription", { sub_endpoint: sub.endpoint }).catch(() => {});
        }
      })
    )
  );
}
