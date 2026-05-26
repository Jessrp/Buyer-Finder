// api/customer-portal.js
// Opens Stripe customer portal so users can manage or cancel BF+ subscription

const Stripe = require("stripe");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Missing email" });
    }

    // Find the Stripe customer by email
    const customers = await stripe.customers.list({ email, limit: 1 });

    if (!customers.data.length) {
      return res.status(404).json({ error: "No Stripe customer found for this email." });
    }

    const customerId = customers.data[0].id;

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: "https://buyrfindr.com/?portal=1",
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("Customer portal error:", err);
    return res.status(500).json({ error: err.message });
  }
};
