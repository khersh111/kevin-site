// ==================== SHARED LAYOUT ====================
// Injects nav + footer into every page for consistency

function getNavHTML(activePage) {
    return `
    <nav class="nav" id="nav">
        <div class="nav-inner">
            <a href="/" class="nav-logo" id="nav-logo">KH<span class="nav-logo-dot">.</span></a>
            <div class="nav-links" id="nav-links">
                <a href="/about.html" class="nav-link ${activePage === 'about' ? 'active' : ''}" data-num="01">About</a>
                <a href="/free-guides.html" class="nav-link ${activePage === 'guides' ? 'active' : ''}" data-num="02">Free Guides</a>
                <a href="/articles.html" class="nav-link ${activePage === 'articles' ? 'active' : ''}" data-num="03">Articles</a>
                <a href="/newsletter.html" class="nav-link ${activePage === 'newsletter' ? 'active' : ''}" data-num="04">Newsletter</a>
            </div>
            <div class="nav-actions">
                <form class="nav-search-form" action="/search.html" method="get">
                    <span class="nav-search-icon">⌕</span>
                    <input type="text" name="q" class="nav-search-input" placeholder="Search..." aria-label="Search" required>
                </form>
                <button class="nav-theme-toggle" id="theme-toggle" aria-label="Toggle dark mode"></button>
                <a href="/contact.html" class="nav-cta" id="nav-cta">Contact →</a>
            </div>
            <button class="nav-toggle" id="nav-toggle" aria-label="Toggle navigation">
                <span></span>
                <span></span>
            </button>
        </div>
    </nav>`;
}

function getFooterHTML() {
    return `
    <footer class="footer" id="footer">
        <div class="footer-top">
            <div class="footer-brand">
                <span class="footer-logo">KH<span class="nav-logo-dot">.</span></span>
                <p class="footer-tagline">Dr. Kevin Hershberger<br>Physical Therapist · DPT, FAAOMPT<br>Chicago, Illinois</p>
            </div>
            <div class="footer-links-group">
                <div class="footer-col">
                    <span class="footer-col-label">Site</span>
                    <a href="/about.html">About</a>
                    <a href="/free-guides.html">Free Guides</a>
                    <a href="/articles.html">Articles</a>
                </div>
                <div class="footer-col">
                    <span class="footer-col-label">Connect</span>
                    <a href="https://www.instagram.com/dr.kevinhershberger/" target="_blank" rel="noopener">Instagram</a>
                    <a href="https://www.linkedin.com/in/kevinhershberger/" target="_blank" rel="noopener">LinkedIn</a>
                    <a href="https://www.goodreads.com/user/show/Kevin-Hershberger" target="_blank" rel="noopener">Goodreads</a>
                </div>
                <div class="footer-col">
                    <span class="footer-col-label">Legal</span>
                    <a href="/privacy-policy.html">Privacy</a>
                    <a href="/disclaimer.html">Disclaimer</a>
                </div>
            </div>
        </div>
        <div class="footer-bottom">
            <span>&copy; ${new Date().getFullYear()} Kevin Hershberger</span>
            <span class="footer-bottom-right">Chicago, IL</span>
        </div>
    </footer>`;
}

function initSharedLayout(activePage) {
    // ---- Inject favicon + OG tags if not already in head ----
    if (!document.querySelector('link[rel="icon"]')) {
        const head = document.head;
        const fav = document.createElement('link');
        fav.rel = 'icon'; fav.type = 'image/png'; fav.sizes = '32x32'; fav.href = '/favicon-32.png';
        head.appendChild(fav);

        const apple = document.createElement('link');
        apple.rel = 'apple-touch-icon'; apple.href = '/apple-touch-icon.png';
        head.appendChild(apple);
    }
    if (!document.querySelector('meta[property="og:image"]')) {
        const og = document.createElement('meta');
        og.setAttribute('property', 'og:image');
        og.content = '/og-image.png';
        document.head.appendChild(og);

        const ogType = document.createElement('meta');
        ogType.setAttribute('property', 'og:type');
        ogType.content = 'website';
        document.head.appendChild(ogType);
    }

    // ---- Apply saved theme ----
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        document.documentElement.setAttribute('data-theme', savedTheme);
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.documentElement.setAttribute('data-theme', 'dark');
    }

    // Inject nav at top of body
    const navPlaceholder = document.getElementById('nav-placeholder');
    const footerPlaceholder = document.getElementById('footer-placeholder');
    
    if (navPlaceholder) navPlaceholder.innerHTML = getNavHTML(activePage);
    if (footerPlaceholder) footerPlaceholder.innerHTML = getFooterHTML();

    // ---- Navbar scroll effect ----
    const nav = document.getElementById('nav');
    if (nav) {
        window.addEventListener('scroll', () => {
            nav.classList.toggle('scrolled', window.scrollY > 50);
        }, { passive: true });
    }

    // ---- Mobile menu ----
    const navToggle = document.getElementById('nav-toggle');
    const navLinks = document.getElementById('nav-links');

    if (navToggle && navLinks) {
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
            navLinks.classList.contains('open') ? closeMenu() : openMenu();
        });

        menuOverlay.addEventListener('click', closeMenu);

        navLinks.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', closeMenu);
        });
    }

    // ---- Scroll animations ----
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

    // ---- Smooth scroll for anchor links ----
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                window.scrollTo({
                    top: target.getBoundingClientRect().top + window.scrollY - 80,
                    behavior: 'smooth'
                });
            }
        });
    });

    // ---- Scroll-to-top button ----
    const scrollBtn = document.createElement('button');
    scrollBtn.className = 'scroll-top';
    scrollBtn.innerHTML = '↑';
    scrollBtn.setAttribute('aria-label', 'Scroll to top');
    document.body.appendChild(scrollBtn);

    window.addEventListener('scroll', () => {
        scrollBtn.classList.toggle('visible', window.scrollY > 400);
    }, { passive: true });

    scrollBtn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // ---- Dark mode toggle logic ----
    const themeBtn = document.getElementById('theme-toggle');
    const sunIcon = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>';
    const moonIcon = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>';
    
    if (themeBtn) {
        themeBtn.innerHTML = document.documentElement.getAttribute('data-theme') === 'dark' ? sunIcon : moonIcon;

        themeBtn.addEventListener('click', () => {
            const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
            const newTheme = isDark ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
            themeBtn.innerHTML = newTheme === 'dark' ? sunIcon : moonIcon;
        });
    }

    // ---- Reading time estimate ----
    const articleBody = document.getElementById('article-body') || document.getElementById('book-body');
    if (articleBody) {
        // Wait a tick for content to be injected
        setTimeout(() => {
            const text = articleBody.textContent || '';
            const words = text.trim().split(/\s+/).length;
            const mins = Math.max(1, Math.ceil(words / 230));
            const badge = document.createElement('div');
            badge.className = 'reading-time';
            badge.innerHTML = `<span class="reading-time-icon">⏱</span> ${mins} min read`;
            
            const header = document.querySelector('.article-header');
            if (header) header.appendChild(badge);
        }, 50);
    }
}
