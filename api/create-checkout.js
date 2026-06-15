import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  // Accept GET (direct link) or POST (form submit)
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).end();
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID,
          quantity: 1,
        },
      ],
      // Stripe replaces {CHECKOUT_SESSION_ID} automatically
      success_url: `${process.env.SITE_URL}/blueprint-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.SITE_URL}/blueprint-info`,
      // Ask for billing address country (helps with tax)
      billing_address_collection: 'auto',
    });

    // Redirect the user to the Stripe-hosted checkout page
    return res.redirect(303, session.url);
  } catch (err) {
    console.error('Stripe checkout error:', err.message);
    return res.status(500).json({ error: 'Failed to create checkout session' });
  }
}
