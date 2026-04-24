// ==================== NEWSLETTER FORM ====================
async function handleNewsletterSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('newsletter-submit');
    const email = document.getElementById('newsletter-email').value;
    const firstName = document.getElementById('newsletter-first').value;

    btn.textContent = 'Subscribing...';
    btn.disabled = true;

    try {
        const res = await fetch('/api/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, first_name: firstName })
        });

        if (res.ok) {
            btn.textContent = '✓ Success!';
            e.target.reset();
            setTimeout(() => {
                btn.textContent = 'Subscribe — it\'s free →';
                btn.disabled = false;
            }, 4000);
        } else {
            throw new Error('API error');
        }
    } catch {
        btn.textContent = 'Something went wrong — try again';
        btn.disabled = false;
    }
}

// ==================== GUIDE ROW HOVER SOUND (subtle) ====================
document.querySelectorAll('.guide-row').forEach(row => {
    row.addEventListener('click', () => {
        const link = row.querySelector('.guide-link');
        if (link) link.click();
    });
});

// ==================== PARALLAX ON HERO IMAGE ====================
const heroImage = document.querySelector('.hero-image');
if (heroImage && window.innerWidth > 900) {
    window.addEventListener('scroll', () => {
        const scrolled = window.scrollY;
        if (scrolled < window.innerHeight) {
            heroImage.style.transform = `scale(${1 + scrolled * 0.0002}) translateY(${scrolled * 0.08}px)`;
        }
    }, { passive: true });
}
