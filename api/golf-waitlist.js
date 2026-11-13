// Golf coaching waitlist (/golf).
// Adds the person to beehiiv (or finds them if they're already a subscriber),
// tags them "golf-waitlist", and saves their answer in beehiiv custom fields so
// it can be read on their subscriber profile or in an export.
//
// Separate from api/subscribe.js on purpose: the other signup forms keep
// working exactly as before.
//
// Required environment variables (same as api/subscribe.js):
//   BEEHIIV_API_KEY, BEEHIIV_PUBLICATION_ID
//
// beehiiv setup (Settings → Custom fields), names must match exactly:
//   "First Name"   text
//   "Last Name"    text
//   "Golf Limiter" text  ← answer to "What's holding your golf game back right now?"
// If a field is missing, beehiiv drops that value and returns a warning,
// which is logged below.
//
// Request body (JSON):
//   { email, first_name, last_name, limiter?, utm_source?, utm_medium?, utm_campaign?, company? }
//   company is a honeypot field; real visitors never fill it in.
//
// Responses:
//   200 { ok: true, status: 'joined' | 'already_subscribed' }
//   400 { error: 'invalid_email' | 'missing_name', message }

//   500 { error: 'not_configured', message }
//   502 { error: 'unavailable', message }

const BEEHIIV_BASE = 'https://api.beehiiv.com/v2';
const TIMEOUT_MS = 8000;
const TAG = 'golf-waitlist';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const UTM_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/;
const ACTIVE_STATUSES = new Set(['active', 'validating', 'pending', 'needs_attention']);

function unavailable(res) {
    return res.status(502).json({
        error: 'unavailable',
        message: "We couldn't save your spot just now. Please try again in a minute."
    });
}

function cleanUtm(value, fallback) {
    const v = String(value || '').trim();
    return UTM_RE.test(v) ? v.toLowerCase() : fallback;
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

function logWarnings(step, body) {
    if (body && Array.isArray(body.warnings) && body.warnings.length) {
        console.warn(`golf-waitlist: beehiiv ${step} warnings:`, JSON.stringify(body.warnings));
    }
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).end();
    }

    const body = req.body || {};

    // Bots fill every field; pretend success so they don't retry.
    if (body.company) return res.status(200).json({ ok: true, status: 'joined' });

    const email = String(body.email || '').trim().toLowerCase();
    if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
        return res.status(400).json({ error: 'invalid_email', message: 'Please enter a valid email address.' });
    }
    const firstName = String(body.first_name || '').trim().slice(0, 80);
    if (!firstName) {
        return res.status(400).json({ error: 'missing_name', message: 'Please enter your first name.' });
    }
    const lastName = String(body.last_name || '').trim().slice(0, 80);
    if (!lastName) {
        return res.status(400).json({ error: 'missing_name', message: 'Please enter your last name.' });
    }
    const limiter = String(body.limiter || '').replace(/\s+/g, ' ').trim().slice(0, 1000);

    const apiKey = process.env.BEEHIIV_API_KEY;
    const publicationId = process.env.BEEHIIV_PUBLICATION_ID;
    if (!apiKey || !publicationId) {
        const missing = [!apiKey && 'BEEHIIV_API_KEY', !publicationId && 'BEEHIIV_PUBLICATION_ID'].filter(Boolean);
        console.error(`golf-waitlist: missing environment variable(s): ${missing.join(', ')}`);
        return res.status(500).json({
            error: 'not_configured',
            message: 'The waitlist is temporarily unavailable. Please try again later.'
        });
    }

    const pub = encodeURIComponent(publicationId);
    const customFields = [
        { name: 'First Name', value: firstName },
        { name: 'Last Name', value: lastName }
    ];
    if (limiter) customFields.push({ name: 'Golf Limiter', value: limiter });

    try {
        // 1. Already on the list (e.g. a newsletter reader)? Then update instead of creating.
        const lookup = await beehiiv(`/publications/${pub}/subscriptions/by_email/${encodeURIComponent(email)}`, apiKey);
        let existing = null;
        if (lookup.ok) {
            existing = (await lookup.json()).data || null;
        } else if (lookup.status !== 404) {
            console.error(`golf-waitlist: beehiiv lookup failed with ${lookup.status}: ${await lookup.text()}`);
            if (lookup.status >= 500 || lookup.status === 429) return unavailable(res);
        }

        let subscriptionId;
        let status;

        if (existing && ACTIVE_STATUSES.has(existing.status)) {
            // 2a. Existing active subscriber: save their answer, keep their original UTM source.
            subscriptionId = existing.id;
            status = 'already_subscribed';
            const update = await beehiiv(`/publications/${pub}/subscriptions/${encodeURIComponent(subscriptionId)}`, apiKey, {
                method: 'PUT',
                body: JSON.stringify({ custom_fields: customFields })
            });
            if (!update.ok) {
                console.error(`golf-waitlist: beehiiv update failed with ${update.status}: ${await update.text()}`);
                return unavailable(res);
            }
            logWarnings('update', await update.json().catch(() => null));
        } else {
            // 2b. New subscriber, or someone who unsubscribed and is opting back in.
            const reactivating = Boolean(existing);
            const create = await beehiiv(`/publications/${pub}/subscriptions`, apiKey, {
                method: 'POST',
                body: JSON.stringify({
                    email,
                    reactivate_existing: reactivating,
                    send_welcome_email: !reactivating,
                    utm_source: cleanUtm(body.utm_source, 'website'),
                    utm_medium: cleanUtm(body.utm_medium, 'website'),
                    utm_campaign: cleanUtm(body.utm_campaign, 'golf-waitlist'),
                    referring_site: 'https://khershberger.com/golf',
                    custom_fields: customFields
                })
            });
            if (!create.ok) {
                const detail = await create.text();
                console.error(`golf-waitlist: beehiiv create failed with ${create.status}: ${detail}`);
                if (create.status === 400 && /email/i.test(detail)) {
                    return res.status(400).json({
                        error: 'invalid_email',
                        message: 'That email address was not accepted. Please check it and try again.'
                    });
                }
                return unavailable(res);
            }
            const created = await create.json();
            logWarnings('create', created);
            subscriptionId = created.data && created.data.id;
            status = 'joined';
            if (!subscriptionId) {
                console.error('golf-waitlist: beehiiv create returned no subscription id');
                return unavailable(res);
            }
        }

        // 3. Tag them. beehiiv creates the tag the first time it's used.
        const tag = await beehiiv(`/publications/${pub}/subscriptions/${encodeURIComponent(subscriptionId)}/tags`, apiKey, {
            method: 'POST',
            body: JSON.stringify({ tags: [TAG] })
        });
        if (!tag.ok) {
            console.error(`golf-waitlist: beehiiv tag failed with ${tag.status}: ${await tag.text()}`);
            return unavailable(res);
        }

        return res.status(200).json({ ok: true, status });
    } catch (err) {
        console.error('golf-waitlist: request to beehiiv failed:', err);
        return unavailable(res);
    }
}
