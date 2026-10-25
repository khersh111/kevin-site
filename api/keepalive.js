import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

// Daily Vercel Cron ping so the free Upstash database never goes idle
// long enough to be archived (which breaks Blueprint access + purchases).
export default async function handler(req, res) {
  // If CRON_SECRET is set in Vercel, only accept calls from Vercel Cron
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).end();
  }

  try {
    const now = new Date().toISOString();
    await redis.set('keepalive:last', now);
    return res.status(200).json({ ok: true, at: now });
  } catch (err) {
    console.error('Keepalive failed:', err.message);
    return res.status(500).json({ ok: false });
  }
}
