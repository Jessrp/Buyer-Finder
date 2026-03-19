// api/create-checkout.js
// Creates a Stripe Checkout session for BF+ monthly subscription

const Stripe = require("stripe");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
    const { userId, email } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "Missing userId" });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID,
          quantity: 1,
        },
      ],
      customer_email: email || undefined,

      // ── Pass userId in BOTH session and subscription metadata ──
      // Session metadata (for checkout.session.completed event)
      metadata: {
        supabase_user_id: userId,
      },
      // Subscription metadata (for subscription.created/updated events)
      subscription_data: {
        metadata: {
          supabase_user_id: userId,
        },
      },

      success_url: "https://buyrfindr.com/?upgraded=1",
      cancel_url:  "https://buyrfindr.com/?cancelled=1",
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("Stripe checkout error:", err);
    return res.status(500).json({ error: err.message });
  }
};
