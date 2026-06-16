import { Redis } from '@upstash/redis';
import { readFileSync } from 'fs';
import { join } from 'path';

const redis = Redis.fromEnv();

const COOKIE_NAME = 'blueprint_token';
const SALES_PAGE = '/blueprint-info';

function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;
  cookieHeader.split(';').forEach((cookie) => {
    const [key, ...rest] = cookie.trim().split('=');
    cookies[key.trim()] = rest.join('=').trim();
  });
  return cookies;
}

export default async function handler(req, res) {
  // Get token from query string first, then fall back to cookie
  const cookies = parseCookies(req.headers.cookie);
  const token = req.query.token || cookies[COOKIE_NAME];

  if (!token) {
    return res.redirect(302, SALES_PAGE);
  }

  // Validate token against Redis
  const data = await redis.get(`token:${token}`);

  if (!data) {
    // Invalid token — clear any bad cookie and send to sales page
    res.setHeader('Set-Cookie', `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`);
    return res.redirect(302, SALES_PAGE);
  }

  // Valid — set a long-lived cookie so they don't need the link next time
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=${token}; Path=/; Max-Age=${60 * 60 * 24 * 365}; HttpOnly; Secure; SameSite=Lax`
  );

  // Serve the guide HTML directly — never exposed as a static file
  try {
    const html = readFileSync(join(process.cwd(), 'blueprint-content.html'), 'utf8');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'private, no-store');
    return res.status(200).send(html);
  } catch (err) {
    console.error('Failed to read blueprint content:', err.message);
    return res.status(500).send('Something went wrong. Please try your access link again.');
  }
}
