// Subscribes an email to the beehiiv newsletter (v2 subscriptions API).
// Used by every signup form on the site (lead-magnet pages, newsletter page,
// footer forms in script.js) and by /golf-warm-up.
//
// Required environment variables (Vercel → Project → Settings → Environment Variables):
//   BEEHIIV_API_KEY         beehiiv → Settings → Integrations → API
//   BEEHIIV_PUBLICATION_ID  the publication's "pub_…" id
//
// Request body (JSON): { email, first_name?, utm_source?, company? }
//   company is a honeypot field; real visitors never fill it in.
//
// Responses:
//   200 { ok: true, status: 'subscribed' | 'already_subscribed' | 'reactivated' }
//   400 { error: 'invalid_email', message }
//   500 { error: 'not_configured', message }
//   502 { error: 'unavailable', message }

const BEEHIIV_BASE = 'https://api.beehiiv.com/v2';
const TIMEOUT_MS = 8000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const UTM_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;
const ACTIVE_STATUSES = new Set(['active', 'validating', 'pending', 'needs_attention']);

function unavailable(res) {
    return res.status(502).json({
        error: 'unavailable',
        message: "We couldn't reach the newsletter service. Please try again in a minute."
    });
}

async function beehiiv(path, apiKey, init = {}) {
    return fetch(`${BEEHIIV_BASE}${path}`, {
        ...init,
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
            ...(init.headers || {})
        },
        signal: AbortSignal.timeout(TIMEOUT_MS)
    });
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).end();
    }

    const body = req.body || {};

    // Bots fill every field; pretend success so they don't retry.
    if (body.company) return res.status(200).json({ ok: true, status: 'subscribed' });

    const email = String(body.email || '').trim().toLowerCase();
    if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
        return res.status(400).json({
            error: 'invalid_email',
            message: 'Please enter a valid email address.'
        });
    }

    const apiKey = process.env.BEEHIIV_API_KEY;
    const publicationId = process.env.BEEHIIV_PUBLICATION_ID;
    if (!apiKey || !publicationId) {
        const missing = [!apiKey && 'BEEHIIV_API_KEY', !publicationId && 'BEEHIIV_PUBLICATION_ID'].filter(Boolean);
        console.error(`subscribe: missing environment variable(s): ${missing.join(', ')}`);
        return res.status(500).json({
            error: 'not_configured',
            message: 'Signups are temporarily unavailable. Please try again later.'
        });
    }

    const firstName = String(body.first_name || '').trim().slice(0, 80);
    const utmSource = UTM_RE.test(String(body.utm_source || '')) ? body.utm_source : 'website';
    const pub = encodeURIComponent(publicationId);

    try {
        // 1. Already on the list? Then don't create again (no duplicate welcome email,
        //    and their original utm_source stays intact).
        const lookup = await beehiiv(`/publications/${pub}/subscriptions/by_email/${encodeURIComponent(email)}`, apiKey);
        let existing = null;
        if (lookup.ok) {
            existing = (await lookup.json()).data || null;
        } else if (lookup.status !== 404) {
            console.error(`subscribe: beehiiv lookup failed with ${lookup.status}: ${await lookup.text()}`);
            if (lookup.status >= 500 || lookup.status === 429) return unavailable(res);
        }

        if (existing && ACTIVE_STATUSES.has(existing.status)) {
            return res.status(200).json({ ok: true, status: 'already_subscribed' });
        }

        // 2. New subscriber, or someone who unsubscribed and is opting back in.
        const reactivating = Boolean(existing);
        const payload = {
            email,
            reactivate_existing: reactivating,
            send_welcome_email: !reactivating,
            utm_source: utmSource,
            utm_medium: 'website',
            referring_site: 'https://khershberger.com'
        };
        if (firstName) payload.custom_fields = [{ name: 'First Name', value: firstName }];

        const create = await beehiiv(`/publications/${pub}/subscriptions`, apiKey, {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        if (!create.ok) {
            const detail = await create.text();
            console.error(`subscribe: beehiiv create failed with ${create.status}: ${detail}`);
            if (create.status === 400 && /email/i.test(detail)) {
                return res.status(400).json({
                    error: 'invalid_email',
                    message: 'That email address was not accepted. Please check it and try again.'
                });
            }
            return unavailable(res);
        }

        return res.status(200).json({ ok: true, status: reactivating ? 'reactivated' : 'subscribed' });
    } catch (err) {
        console.error('subscribe: request to beehiiv failed:', err);
        return unavailable(res);
    }
}
