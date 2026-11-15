import { createHmac, timingSafeEqual } from 'crypto';
import { Resend } from 'resend';

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
// Optional:
//   RESEND_API_KEY  sends the golf welcome email and Kevin's signup alert (below).
//                   If it's missing, the signup still works and both emails are
//                   skipped with a log line.
//   GOLF_WAITLIST_NOTIFY_EMAIL  where signup alerts go. Falls back to
//                   CONTACT_TO_EMAIL, then info@khershberger.com.
//
// Golf signups don't get beehiiv's general newsletter welcome. The golf welcome
// email from Resend is built below but paused (SEND_WELCOME_EMAIL), so right now
// signups get no automatic email and Kevin follows up personally.
//
// beehiiv setup (Settings → Custom fields), names must match exactly:
//   "First Name"   text
//   "Last Name"    text
//   "Golf Limiter" text  ← answer to "What's holding your golf game back right now?"
// If a field is missing, beehiiv drops that value and returns a warning,
// which is logged below.
//
// Request body (JSON), signup:
//   { email, first_name, last_name?, limiter?, utm_source?, utm_medium?, utm_campaign?, company? }
//   company is a honeypot field; real visitors never fill it in.
//
// Request body (JSON), answer after signup (the page asks the "what's holding
// your golf game back" question on the success screen):
//   { step: 'answer', email, first_name?, limiter, answer_token }
//   answer_token comes from the signup response, so only the person who just
//   signed up can set their answer.
//
// Responses:
//   200 { ok: true, status: 'joined' | 'already_subscribed', answer_token }
//   200 { ok: true }                                   (answer saved)
//   400 { error: 'invalid_email' | 'missing_name' | 'missing_answer' | 'expired', message }
//   500 { error: 'not_configured', message }
//   502 { error: 'unavailable', message }

const BEEHIIV_BASE = 'https://api.beehiiv.com/v2';
const TIMEOUT_MS = 8000;
const TAG = 'golf-waitlist';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const UTM_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/;
const ACTIVE_STATUSES = new Set(['active', 'validating', 'pending', 'needs_attention']);

const ANSWER_TOKEN_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours to answer after signing up

// Signed with the beehiiv key (server-only), so no extra secret to configure.
function signAnswer(email, ts, secret) {
    return createHmac('sha256', secret).update(`golf-answer:${ts}:${email}`).digest('base64url');
}

function makeAnswerToken(email, secret) {
    const ts = Date.now();
    return `${ts}.${signAnswer(email, ts, secret)}`;
}

function answerTokenValid(token, email, secret) {
    const [tsRaw, sig] = String(token || '').split('.');
    const ts = Number(tsRaw);
    if (!ts || !sig || Date.now() - ts > ANSWER_TOKEN_TTL_MS || ts > Date.now() + 60000) return false;
    const expected = Buffer.from(signAnswer(email, ts, secret));
    const given = Buffer.from(sig);
    return expected.length === given.length && timingSafeEqual(expected, given);
}

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

// Paused 2026-11-13: Kevin is following up with each golf signup personally.
// Set to true to turn the automatic golf welcome email back on.
const SEND_WELCOME_EMAIL = false;

const WARM_UP_PDF = 'https://www.khershberger.com/downloads/golfers-warm-up.pdf';

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Golf welcome email. The "You mentioned" line only appears if they answered the question.
async function sendWelcomeEmail({ email, firstName, limiter }) {
    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) {
        console.warn('golf-waitlist: RESEND_API_KEY not set, skipping welcome email');
        return;
    }

    const name = escapeHtml(firstName);
    const answer = limiter ? escapeHtml(limiter) : '';
    const p = 'margin:0 0 16px;';

    const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6;color:#1A1A1A;max-width:560px;">
  <p style="${p}">Hi ${name},</p>
  <p style="${p}">Thanks for joining the waitlist. I'm Kevin, an orthopedic physical therapist and former college golfer. I'm starting to coach a small number of golfers remotely, and I'll email you as soon as a spot opens.</p>
  ${answer ? `<p style="${p}">You mentioned: &ldquo;${answer}&rdquo;</p>` : ''}
  <p style="margin:0 0 8px;">I'd like to hear a bit more. Just reply to this email and tell me:</p>
  <ul style="margin:0 0 16px;padding-left:22px;">
    <li>How often you play</li>
    <li>Your handicap or usual score</li>
    <li>How long that's been holding your game back</li>
  </ul>
  <p style="${p}">I read every reply.</p>
  <p style="${p}">While you wait, here's my free Golfer's Warm-Up, seven exercises to do before the first tee: <a href="${WARM_UP_PDF}" style="color:#1A1A1A;font-weight:600;">download the PDF</a>.</p>
  <p style="margin:24px 0 0;">Kevin<br>
  <span style="color:#5F6670;">Dr. Kevin Hershberger, DPT, FAAOMPT<br>
  <a href="https://www.khershberger.com" style="color:#5F6670;">khershberger.com</a></span></p>
</div>`;

    const text = [
        `Hi ${firstName},`,
        '',
        "Thanks for joining the waitlist. I'm Kevin, an orthopedic physical therapist and former college golfer. I'm starting to coach a small number of golfers remotely, and I'll email you as soon as a spot opens.",
        '',
        ...(limiter ? [`You mentioned: "${limiter}"`, ''] : []),
        "I'd like to hear a bit more. Just reply to this email and tell me:",
        '- How often you play',
        '- Your handicap or usual score',
        "- How long that's been holding your game back",
        '',
        'I read every reply.',
        '',
        "While you wait, here's my free Golfer's Warm-Up, seven exercises to do before the first tee:",
        WARM_UP_PDF,
        '',
        'Kevin',
        'Dr. Kevin Hershberger, DPT, FAAOMPT',
        'khershberger.com'
    ].join('\n');

    try {
        const resend = new Resend(resendKey);
        const { error } = await resend.emails.send({
            from: 'Kevin <info@khershberger.com>',
            to: email,
            replyTo: 'info@khershberger.com',
            subject: "You're on the wait list!",
            html,
            text
        });
        // A failed welcome email shouldn't fail the signup; the person is already on the list.
        if (error) console.error('golf-waitlist: welcome email failed:', JSON.stringify(error));
    } catch (err) {
        console.error('golf-waitlist: welcome email failed:', err);
    }
}

// Emails Kevin every time someone joins the waitlist. Reply goes straight to the golfer.
async function notifyKevin({ email, firstName, lastName, limiter, status, utmSource, utmCampaign }) {
    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) {
        console.warn('golf-waitlist: RESEND_API_KEY not set, skipping signup alert');
        return;
    }

    const to = process.env.GOLF_WAITLIST_NOTIFY_EMAIL || process.env.CONTACT_TO_EMAIL || 'info@khershberger.com';
    const fullName = `${firstName} ${lastName}`.trim();
    const who = status === 'already_subscribed' ? 'Existing newsletter subscriber' : 'New subscriber';

    const text = [
        `${fullName} just joined the golf coaching waitlist.`,
        '',
        `Name:   ${fullName}`,
        `Email:  ${email}`,
        `Status: ${who}`,
        `Source: ${utmSource || 'unknown'}${utmCampaign ? ` / ${utmCampaign}` : ''}`,
        '',
        "What's holding their golf game back:",
        limiter || "(asked right after signup. If they answer, you'll get a second email with it.)",
        '',
        'Reply to this email to write back to them directly.'
    ].join('\n');

    try {
        const resend = new Resend(resendKey);
        const { error } = await resend.emails.send({
            from: 'Golf Waitlist <info@khershberger.com>',
            to: [to],
            replyTo: email,
            subject: `New golf waitlist signup: ${fullName}`,
            text
        });
        // A failed alert shouldn't fail the signup; the person is already on the list.
        if (error) console.error('golf-waitlist: signup alert failed:', JSON.stringify(error));
    } catch (err) {
        console.error('golf-waitlist: signup alert failed:', err);
    }
}

// Emails Kevin the answer someone gave on the success screen after signing up.
async function notifyKevinAnswer({ email, firstName, limiter }) {
    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) {
        console.warn('golf-waitlist: RESEND_API_KEY not set, skipping answer alert');
        return;
    }
    const to = process.env.GOLF_WAITLIST_NOTIFY_EMAIL || process.env.CONTACT_TO_EMAIL || 'info@khershberger.com';
    const who = firstName || email;
    const text = [
        `${who} (${email}) answered the waitlist question.`,
        '',
        "What's holding their golf game back:",
        limiter,
        '',
        'Reply to this email to write back to them directly.'
    ].join('\n');
    try {
        const resend = new Resend(resendKey);
        const { error } = await resend.emails.send({
            from: 'Golf Waitlist <info@khershberger.com>',
            to: [to],
            replyTo: email,
            subject: `Golf waitlist answer: ${who}`,
            text
        });
        if (error) console.error('golf-waitlist: answer alert failed:', JSON.stringify(error));
    } catch (err) {
        console.error('golf-waitlist: answer alert failed:', err);
    }
}

// Saves the answer given after signup to the "Golf Limiter" field.
async function saveAnswer(req, res, body, email, apiKey, publicationId) {
    if (!answerTokenValid(body.answer_token, email, apiKey)) {
        return res.status(400).json({ error: 'expired', message: 'This page has expired. Please reload and sign up again to send your answer.' });
    }
    const limiter = String(body.limiter || '').replace(/\s+/g, ' ').trim().slice(0, 1000);
    if (!limiter) {
        return res.status(400).json({ error: 'missing_answer', message: 'Type your answer first.' });
    }
    const firstName = String(body.first_name || '').trim().slice(0, 80);
    const pub = encodeURIComponent(publicationId);
    try {
        const lookup = await beehiiv(`/publications/${pub}/subscriptions/by_email/${encodeURIComponent(email)}`, apiKey);
        if (!lookup.ok) {
            console.error(`golf-waitlist: answer lookup failed with ${lookup.status}: ${await lookup.text()}`);
            return unavailable(res);
        }
        const sub = (await lookup.json()).data;
        if (!sub || !sub.id) return unavailable(res);
        const update = await beehiiv(`/publications/${pub}/subscriptions/${encodeURIComponent(sub.id)}`, apiKey, {
            method: 'PUT',
            body: JSON.stringify({ custom_fields: [{ name: 'Golf Limiter', value: limiter }] })
        });
        if (!update.ok) {
            console.error(`golf-waitlist: answer update failed with ${update.status}: ${await update.text()}`);
            return unavailable(res);
        }
        logWarnings('answer update', await update.json().catch(() => null));
        await notifyKevinAnswer({ email, firstName, limiter });
        return res.status(200).json({ ok: true });
    } catch (err) {
        console.error('golf-waitlist: saving answer failed:', err);
        return unavailable(res);
    }
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

    // Answer to the follow-up question on the success screen.
    if (body.step === 'answer') return saveAnswer(req, res, body, email, apiKey, publicationId);

    const firstName = String(body.first_name || '').trim().slice(0, 80);
    if (!firstName) {
        return res.status(400).json({ error: 'missing_name', message: 'Please enter your first name.' });
    }
    // Last name is optional (the form only asks for first name and email).
    const lastName = String(body.last_name || '').trim().slice(0, 80);
    const limiter = String(body.limiter || '').replace(/\s+/g, ' ').trim().slice(0, 1000);

    const pub = encodeURIComponent(publicationId);
    const customFields = [{ name: 'First Name', value: firstName }];
    if (lastName) customFields.push({ name: 'Last Name', value: lastName });
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
                    send_welcome_email: false, // no general newsletter welcome for golf signups
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

        // 4. Golf welcome email (currently paused, see SEND_WELCOME_EMAIL).
        if (SEND_WELCOME_EMAIL) await sendWelcomeEmail({ email, firstName, limiter });

        // 5. Let Kevin know someone joined.
        await notifyKevin({
            email,
            firstName,
            lastName,
            limiter,
            status,
            utmSource: cleanUtm(body.utm_source, 'website'),
            utmCampaign: cleanUtm(body.utm_campaign, '')
        });

        return res.status(200).json({ ok: true, status, answer_token: makeAnswerToken(email, apiKey) });
    } catch (err) {
        console.error('golf-waitlist: request to beehiiv failed:', err);
        return unavailable(res);
    }
}
