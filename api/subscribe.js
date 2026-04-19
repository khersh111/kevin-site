export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();

    const { email, first_name } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });

    const response = await fetch(
        'https://api.beehiiv.com/v2/publications/pub_a2ec6133-bbc5-463e-a855-f393a1b74db6/subscriptions',
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer S7trGaco7Ub1RaRdz28DzkGEVZFVNBrgIZKz2j2dQhsUtPFHqY7mxGNTtYskKgnf'
            },
            body: JSON.stringify({
                email,
                first_name,
                reactivate_existing: false,
                send_welcome_email: true
            })
        }
    );

    const data = await response.json();
    return res.status(response.ok ? 200 : response.status).json(data);
}
