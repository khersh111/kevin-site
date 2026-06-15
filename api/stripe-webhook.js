import Stripe from 'stripe';
import { Redis } from '@upstash/redis';
import { Resend } from 'resend';
import { randomBytes } from 'crypto';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const redis = Redis.fromEnv();
const resend = new Resend(process.env.RESEND_API_KEY);

// Vercel doesn't parse the raw body for us — we need it for Stripe signature verification
export const config = {
  api: {
    bodyParser: false,
  },
};

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const rawBody = await getRawBody(req);
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  // Idempotency: skip if we've already processed this event
  const processed = await redis.get(`processed:${event.id}`);
  if (processed) {
    console.log(`Event ${event.id} already processed, skipping.`);
    return res.status(200).json({ received: true });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const email = session.customer_details?.email;

    if (!email) {
      console.error('No email found in session:', session.id);
      return res.status(200).json({ received: true }); // Return 200 so Stripe doesn't retry
    }

    // Generate a secure random token
    const token = randomBytes(32).toString('hex');

    // Store token → email mapping (no expiry — persistent access)
    await redis.set(`token:${token}`, JSON.stringify({ email, createdAt: new Date().toISOString() }));

    // Store email → token mapping (so we can look up by email if needed)
    await redis.set(`email:${email}`, token);

    // Send access email via Resend
    const accessLink = `${process.env.SITE_URL}/blueprint?token=${token}`;

    await resend.emails.send({
      from: 'Kevin <info@khershberger.com>',
      to: email,
      subject: 'Your Blueprint access link',
      html: `
        <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto;">
          <h2>You're in!</h2>
          <p>Thanks for your purchase. Click the link below to access the Blueprint guide:</p>
          <p style="margin: 32px 0;">
            <a href="${accessLink}" style="background: #000; color: #fff; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold;">
              Open the Blueprint →
            </a>
          </p>
          <p>Or copy this link into your browser:</p>
          <p style="color: #666; word-break: break-all;">${accessLink}</p>
          <p style="color: #999; font-size: 0.85rem; margin-top: 40px;">
            This link is personal to you. Bookmark it — it gives you permanent access.
            Questions? Reply to this email.
          </p>
        </div>
      `,
    });

    // Mark this event as processed (keep for 30 days)
    await redis.set(`processed:${event.id}`, '1', { ex: 60 * 60 * 24 * 30 });

    console.log(`Access granted and email sent to ${email}`);
  }

  return res.status(200).json({ received: true });
}
