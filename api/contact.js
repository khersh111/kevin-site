import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();

    const { name, email, message, company } = req.body;

    // Honeypot — bots fill every field; humans never see this one
    if (company) return res.status(200).json({ ok: true });

    if (!name?.trim() || !email?.trim() || !message?.trim()) {
        return res.status(400).json({ error: 'Name, email, and message are all required.' });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: "That email address doesn't look right." });
    }

    if (message.length > 5000) {
        return res.status(400).json({ error: 'Message is too long. Keep it under 5,000 characters.' });
    }

    const { error } = await resend.emails.send({
        from: process.env.CONTACT_FROM_EMAIL,
        to: [process.env.CONTACT_TO_EMAIL],
        replyTo: email,
        subject: `New message from ${name} — khershberger.com`,
        text: [`Name:  ${name}`, `Email: ${email}`, ``, message].join('\n'),
    });

    if (error) {
        console.error('Resend error:', error);
        return res.status(502).json({ error: "Couldn't send the message. Try again in a moment." });
    }

    return res.status(200).json({ ok: true });
}
