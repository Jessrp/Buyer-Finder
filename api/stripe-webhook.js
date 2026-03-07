// api/stripe-webhook.js
// Listens for Stripe subscription events and updates Supabase profile

const Stripe = require("stripe");
const { createClient } = require("@supabase/supabase-js");

// Required to read raw body for Stripe signature verification
export const config = {
  api: { bodyParser: false },
};

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", chunk => chunks.push(chunk));
    req.on("end",  () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const stripe    = Stripe(process.env.STRIPE_SECRET_KEY);
  const supabase  = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  let event;
  try {
    const rawBody = await getRawBody(req);
    const sig     = req.headers["stripe-signature"];
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signature failed:", err.message);
    return res.status(400).json({ error: "Webhook Error: " + err.message });
  }

  const subscription = event.data.object;

  // Get the Supabase user ID we stored in metadata at checkout
  let userId = subscription.metadata?.supabase_user_id;

  // If not in metadata, look up by stripe customer id
  if (!userId && subscription.customer) {
    const { data } = await supabase
      .from("profiles")
      .select("id")
      .eq("stripe_customer_id", subscription.customer)
      .maybeSingle();
    if (data) userId = data.id;
  }

  if (!userId) {
    console.warn("No user found for subscription event", event.type);
    return res.status(200).json({ received: true });
  }

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const isActive = ["active", "trialing"].includes(subscription.status);
      const expiresAt = isActive
        ? new Date(subscription.current_period_end * 1000).toISOString()
        : null;

      await supabase.from("profiles").update({
        subscription_status:  subscription.status,
        subscription_id:      subscription.id,
        stripe_customer_id:   subscription.customer,
        bfplus_expires_at:    expiresAt,
        premium:              isActive,
      }).eq("id", userId);

      console.log(`Subscription ${event.type} for user ${userId}: ${subscription.status}`);
      break;
    }

    case "customer.subscription.deleted": {
      await supabase.from("profiles").update({
        subscription_status: "cancelled",
        subscription_id:     null,
        bfplus_expires_at:   null,
        premium:             false,
      }).eq("id", userId);

      console.log(`Subscription cancelled for user ${userId}`);
      break;
    }

    default:
      console.log("Unhandled event type:", event.type);
  }

  return res.status(200).json({ received: true });
};
