// ==================== SCROLL ANIMATIONS ====================
const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
        }
    });
}, {
    threshold: 0.1,
    rootMargin: '0px 0px -40px 0px'
});

document.querySelectorAll('.anim-in').forEach((el) => observer.observe(el));

// ==================== NAVBAR SCROLL ====================
const nav = document.getElementById('nav');

window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 50);
}, { passive: true });

// ==================== MOBILE MENU ====================
const navToggle = document.getElementById('nav-toggle');
const navLinks = document.getElementById('nav-links');

// Create overlay for click-outside-to-close
const menuOverlay = document.createElement('div');
menuOverlay.className = 'nav-overlay';
document.body.appendChild(menuOverlay);

function closeMenu() {
    navToggle.classList.remove('active');
    navLinks.classList.remove('open');
    menuOverlay.classList.remove('open');
    document.body.style.overflow = '';
}

function openMenu() {
    navToggle.classList.add('active');
    navLinks.classList.add('open');
    menuOverlay.classList.add('open');
    document.body.style.overflow = 'hidden';
}

navToggle.addEventListener('click', () => {
    if (navLinks.classList.contains('open')) {
        closeMenu();
    } else {
        openMenu();
    }
});

// Close menu when clicking the overlay (outside the menu)
menuOverlay.addEventListener('click', closeMenu);

// Close menu when clicking a nav link
navLinks.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', closeMenu);
});

// ==================== SMOOTH SCROLL ====================
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            const offset = 80;
            window.scrollTo({
                top: target.getBoundingClientRect().top + window.scrollY - offset,
                behavior: 'smooth'
            });
        }
    });
});

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
