// ==================== SHARED LAYOUT ====================
// Injects nav + footer into every page for consistency

function getNavHTML(activePage) {
    return `
    <nav class="nav" id="nav">
        <div class="nav-inner">
            <a href="/" class="nav-logo" id="nav-logo">KH<span class="nav-logo-dot">.</span></a>
            <div class="nav-links" id="nav-links">
                <a href="/about" class="nav-link ${activePage === 'about' ? 'active' : ''}">About</a>
                <div class="nav-dropdown-wrap" id="nav-resources-wrap">
                    <button class="nav-dropdown-trigger ${['articles', 'guides', 'booknotes'].includes(activePage) ? 'active' : ''}" id="nav-resources-btn" aria-haspopup="true" aria-expanded="false">Free Resources<span class="nav-dropdown-caret">▾</span></button>
                    <div class="nav-dropdown" id="nav-dropdown" role="menu">
                        <a href="/articles" class="nav-dropdown-item ${activePage === 'articles' ? 'active' : ''}" role="menuitem">Articles</a>
                        <a href="/free-guides" class="nav-dropdown-item ${activePage === 'guides' ? 'active' : ''}" role="menuitem">Free Guides</a>
                        <a href="/book-notes" class="nav-dropdown-item ${activePage === 'booknotes' ? 'active' : ''}" role="menuitem">Book Notes</a>
                    </div>
                </div>
                <div class="nav-mobile-resources" id="nav-mobile-resources">
                    <button class="nav-mobile-resources-toggle" id="nav-mobile-resources-toggle" aria-expanded="false">Free Resources<span class="nav-mobile-resources-caret">▾</span></button>
                    <div class="nav-mobile-resources-list">
                        <a href="/articles" class="nav-link nav-link-sub ${activePage === 'articles' ? 'active' : ''}">Articles</a>
                        <a href="/free-guides" class="nav-link nav-link-sub ${activePage === 'guides' ? 'active' : ''}">Free Guides</a>
                        <a href="/book-notes" class="nav-link nav-link-sub ${activePage === 'booknotes' ? 'active' : ''}">Book Notes</a>
                    </div>
                </div>
                <a href="/newsletter" class="nav-link ${activePage === 'newsletter' ? 'active' : ''}">Newsletter</a>
                <a href="/blueprint-info" class="nav-link ${activePage === 'programs' ? 'active' : ''}">Programs</a>
                <!-- ARCHIVED: coaching page taken down 2026-08-31 -->
                <!-- <a href="/coaching" class="nav-link ${activePage === 'coaching' ? 'active' : ''}">Coaching</a> -->
                <a href="/contact" class="nav-cta mobile-only">Contact →</a>
            </div>
            <div class="nav-actions">
                <form class="nav-search-form" action="/search" method="get">
                    <span class="nav-search-icon">⌕</span>
                    <input type="text" name="q" class="nav-search-input" placeholder="Search..." aria-label="Search" required>
                </form>
                <a href="/search" class="nav-search-mobile-btn" aria-label="Search">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                </a>
                <a href="/contact" class="nav-cta" id="nav-cta">Contact →</a>
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
                    <a href="/about">About</a>
                    <a href="/free-resources">Free Resources</a>
                    <a href="/newsletter">Newsletter</a>
                    <a href="/blueprint-info">Programs</a>
                    <a href="/contact">Contact</a>
                </div>
                <div class="footer-col">
                    <span class="footer-col-label">Connect</span>
                    <a href="https://www.instagram.com/dr.kevinhershberger/" target="_blank" rel="noopener">Instagram</a>
                    <a href="https://www.linkedin.com/in/kevinhershberger/" target="_blank" rel="noopener">LinkedIn</a>
                    <a href="https://www.goodreads.com/user/show/Kevin-Hershberger" target="_blank" rel="noopener">Goodreads</a>
                </div>
                <div class="footer-col">
                    <span class="footer-col-label">Legal</span>
                    <a href="/privacy-policy">Privacy</a>
                    <a href="/disclaimer">Disclaimer</a>
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

    // Theme is fixed per page via a static data-theme attribute on <html>
    // (dark on About and Newsletter; light everywhere else). No runtime toggle.

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

        navToggle.addEventListener('click', (e) => {
            e.preventDefault();
            if (navLinks.classList.contains('open')) {
                closeMenu();
            } else {
                if (document.activeElement) document.activeElement.blur();
                openMenu();
            }
        });

        menuOverlay.addEventListener('click', closeMenu);

        navLinks.querySelectorAll('.nav-link:not(.nav-dropdown-trigger), .nav-dropdown-item').forEach(link => {
            link.addEventListener('click', closeMenu);
        });
    }

    // ---- Mobile "Free Resources" accordion ----
    const mobileResToggle = document.getElementById('nav-mobile-resources-toggle');
    const mobileResWrap = document.getElementById('nav-mobile-resources');
    if (mobileResToggle && mobileResWrap) {
        mobileResToggle.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const isOpen = mobileResWrap.classList.toggle('open');
            mobileResToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        });
    }

    // ---- Desktop dropdown: Free Resources ----
    const resourcesBtn = document.getElementById('nav-resources-btn');
    const resourcesDropdown = document.getElementById('nav-dropdown');
    const resourcesWrap = document.getElementById('nav-resources-wrap');

    if (resourcesBtn && resourcesDropdown) {
        function openDropdown() {
            resourcesBtn.setAttribute('aria-expanded', 'true');
            resourcesWrap.classList.add('open');
        }
        function closeDropdown() {
            resourcesBtn.setAttribute('aria-expanded', 'false');
            resourcesWrap.classList.remove('open');
        }

        resourcesBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = resourcesWrap.classList.contains('open');
            isOpen ? closeDropdown() : openDropdown();
        });

        // Close on outside click
        document.addEventListener('click', (e) => {
            if (!resourcesWrap.contains(e.target)) closeDropdown();
        });

        // Close on Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeDropdown();
        });

        // Hover on desktop
        resourcesWrap.addEventListener('mouseenter', openDropdown);
        resourcesWrap.addEventListener('mouseleave', closeDropdown);
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
