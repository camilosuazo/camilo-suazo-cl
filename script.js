const CONTENT_URL = 'data/site-content.json';
const LANGUAGE_STORAGE_KEY = 'camilo-suazo-site-language';

let siteContentCache = null;
let sectionObserver = null;
let currentLanguage = 'es';
let contactUiState = {
    sendingLabel: 'Enviando...',
    openLabel: 'Abrir',
    readyLabel: 'Preparado'
};

document.addEventListener('DOMContentLoaded', () => {
    initEventModal();
    initNavbar();
    initSmoothScroll();
    initScrollAnimations();
    initContactForm();
    setFooterYear();
    loadAndRenderSiteContent();
});

function initEventModal() {
    const modal = document.getElementById('event-modal');
    const closeButton = document.getElementById('event-modal-close');

    if (!modal || !closeButton) {
        return;
    }

    const closeModal = () => {
        modal.classList.remove('is-open');
        modal.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('modal-open');
    };

    const openModal = () => {
        modal.classList.add('is-open');
        modal.setAttribute('aria-hidden', 'false');
        document.body.classList.add('modal-open');
    };

    closeButton.addEventListener('click', closeModal);

    modal.querySelectorAll('[data-modal-close]').forEach((element) => {
        element.addEventListener('click', closeModal);
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && modal.classList.contains('is-open')) {
            closeModal();
        }
    });

    window.setTimeout(openModal, 250);
}

async function loadAndRenderSiteContent() {
    try {
        const siteContent = await loadSiteContent();
        currentLanguage = resolveInitialLanguage(siteContent);
        renderLanguageSwitch(siteContent);
        renderCurrentLanguage(siteContent);
    } catch (error) {
        console.warn('No se pudo cargar el contenido del sitio.', error);
    }
}

async function loadSiteContent(force = false) {
    if (siteContentCache && !force) {
        return siteContentCache;
    }

    const response = await fetch(CONTENT_URL, { cache: 'no-store' });
    if (!response.ok) {
        throw new Error(`Error cargando contenido: ${response.status}`);
    }

    siteContentCache = await response.json();
    return siteContentCache;
}

function resolveInitialLanguage(siteContent) {
    const availableLanguages = getAvailableLanguages(siteContent);
    const storedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);

    if (storedLanguage && availableLanguages.includes(storedLanguage)) {
        return storedLanguage;
    }

    if (availableLanguages.includes(siteContent.defaultLanguage)) {
        return siteContent.defaultLanguage;
    }

    return availableLanguages[0] || 'es';
}

function getAvailableLanguages(siteContent) {
    if (Array.isArray(siteContent.languages) && siteContent.languages.length) {
        return siteContent.languages;
    }

    if (siteContent.translations && typeof siteContent.translations === 'object') {
        return Object.keys(siteContent.translations);
    }

    return ['es'];
}

function getTranslation(siteContent, language = currentLanguage) {
    if (!siteContent.translations) {
        return siteContent;
    }

    return siteContent.translations[language]
        || siteContent.translations[siteContent.defaultLanguage]
        || siteContent.translations[Object.keys(siteContent.translations)[0]]
        || {};
}

function renderCurrentLanguage(siteContent) {
    const content = getTranslation(siteContent, currentLanguage);

    applySiteMetadata(content.site || {});
    renderLanguageSwitch(siteContent);
    renderNavigation(content.nav || {});
    renderHero(content.hero || {});
    renderAbout(content.about || {});
    renderWork(content.work || {});
    renderStack(content.stack || {});
    renderProjects(content.projects || {});
    renderEducation(content.education || {});
    renderApproach(content.approach || {});
    renderContact(content.contact || {});
    renderFooter(content.footer || {});
    observeAnimatedElements(document);
    window.requestAnimationFrame(() => {
        window.dispatchEvent(new Event('scroll'));
    });
}

function applySiteMetadata(site) {
    if (site.title) {
        document.title = site.title;
        updateMetaTag('meta[property="og:title"]', site.title);
        updateMetaTag('meta[name="twitter:title"]', site.title);
    }

    if (site.description) {
        updateMetaTag('meta[name="description"]', site.description);
        updateMetaTag('meta[property="og:description"]', site.description);
        updateMetaTag('meta[name="twitter:description"]', site.description);
    }

    if (site.keywords) {
        updateMetaTag('meta[name="keywords"]', site.keywords);
    }

    if (site.applicationName) {
        updateMetaTag('meta[name="application-name"]', site.applicationName);
    }

    if (site.themeColor) {
        updateMetaTag('meta[name="theme-color"]', site.themeColor);
    }

    if (site.locale) {
        updateMetaTag('meta[property="og:locale"]', site.locale);
    }

    if (site.siteUrl) {
        updateMetaTag('meta[property="og:url"]', site.siteUrl);
        const canonicalLink = document.querySelector('link[rel="canonical"]');
        if (canonicalLink) {
            canonicalLink.href = site.siteUrl;
        }
    }

    if (site.ogImage) {
        updateMetaTag('meta[property="og:image"]', site.ogImage);
    }

    if (site.htmlLang) {
        document.documentElement.lang = site.htmlLang;
    }
}

function updateMetaTag(selector, value) {
    const element = document.querySelector(selector);
    if (element && value) {
        element.setAttribute('content', value);
    }
}

function renderLanguageSwitch(siteContent) {
    const languageSwitch = document.getElementById('lang-switch');
    if (!languageSwitch) {
        return;
    }

    const availableLanguages = getAvailableLanguages(siteContent);
    const content = getTranslation(siteContent, currentLanguage);
    const label = content.nav?.languageSwitchLabel || 'Language switch';

    languageSwitch.setAttribute('aria-label', label);
    languageSwitch.innerHTML = availableLanguages.map((language) => `
        <button
            type="button"
            class="lang-button${language === currentLanguage ? ' is-active' : ''}"
            data-language="${escapeAttr(language)}"
            aria-pressed="${language === currentLanguage ? 'true' : 'false'}"
        >
            ${escapeHtml(language.toUpperCase())}
        </button>
    `).join('');

    languageSwitch.querySelectorAll('.lang-button').forEach((button) => {
        button.addEventListener('click', () => {
            const nextLanguage = button.dataset.language;
            if (!nextLanguage || nextLanguage === currentLanguage) {
                return;
            }

            currentLanguage = nextLanguage;
            window.localStorage.setItem(LANGUAGE_STORAGE_KEY, currentLanguage);
            renderCurrentLanguage(siteContentCache);
        });
    });
}

function initNavbar() {
    const navbar = document.getElementById('navbar');
    const navToggle = document.getElementById('nav-toggle');
    const navMenu = document.getElementById('nav-menu');
    const navLinks = document.querySelectorAll('.nav-link');

    function updateActiveSection() {
        const sections = document.querySelectorAll('section[id]');
        const currentScroll = window.pageYOffset;

        if (navbar) {
            navbar.classList.toggle('scrolled', currentScroll > 24);
        }

        sections.forEach((section) => {
            const sectionTop = section.offsetTop - 140;
            const sectionBottom = sectionTop + section.offsetHeight;
            const sectionId = section.getAttribute('id');
            const navLink = document.querySelector(`.nav-link[href="#${sectionId}"]`);

            if (!navLink) {
                return;
            }

            const isActive = currentScroll >= sectionTop && currentScroll < sectionBottom;
            navLink.classList.toggle('active', isActive);
        });
    }

    window.addEventListener('scroll', updateActiveSection);
    window.addEventListener('resize', updateActiveSection);
    window.addEventListener('load', updateActiveSection);
    updateActiveSection();

    if (navToggle && navMenu) {
        navToggle.addEventListener('click', () => {
            const isOpen = navMenu.classList.toggle('active');
            navToggle.classList.toggle('active', isOpen);
            navToggle.setAttribute('aria-expanded', String(isOpen));
            document.body.classList.toggle('menu-open', isOpen);
        });
    }

    navLinks.forEach((link) => {
        link.addEventListener('click', () => {
            if (!navToggle || !navMenu) {
                return;
            }

            navToggle.classList.remove('active');
            navMenu.classList.remove('active');
            navToggle.setAttribute('aria-expanded', 'false');
            document.body.classList.remove('menu-open');
        });
    });
}

function renderNavigation(nav) {
    setText('nav-home', nav.home);
    setText('nav-about', nav.about);
    setText('nav-work', nav.work);
    setText('nav-stack', nav.stack);
    setText('nav-projects', nav.projects);
    setText('nav-education', nav.education);
    setText('nav-contact', nav.contact);

    setAttributeValue('nav-logo', 'aria-label', nav.logoAriaLabel);
    setAttributeValue('nav-toggle', 'aria-label', nav.menuAriaLabel);
}

function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
        anchor.addEventListener('click', function onClick(event) {
            const targetSelector = this.getAttribute('href');
            const target = document.querySelector(targetSelector);

            if (!target) {
                return;
            }

            event.preventDefault();
            const headerOffset = 88;
            const offsetPosition = target.offsetTop - headerOffset;

            window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
            });
        });
    });
}

function initScrollAnimations() {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion || typeof IntersectionObserver === 'undefined') {
        document.querySelectorAll('.reveal').forEach((element) => {
            element.classList.add('visible');
        });
        return;
    }

    sectionObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                sectionObserver.unobserve(entry.target);
            }
        });
    }, {
        rootMargin: '0px 0px -8% 0px',
        threshold: 0.12
    });

    observeAnimatedElements(document);
}

function observeAnimatedElements(scope) {
    const elements = scope.querySelectorAll('.reveal');
    if (!elements.length) {
        return;
    }

    elements.forEach((element) => {
        if (element.dataset.animatedReady === 'true') {
            return;
        }

        element.dataset.animatedReady = 'true';
        element.classList.add('animate-on-scroll');

        if (!sectionObserver) {
            element.classList.add('visible');
            return;
        }

        sectionObserver.observe(element);
    });
}

function initContactForm() {
    const contactForm = document.getElementById('contact-form');
    if (!contactForm) {
        return;
    }

    contactForm.addEventListener('submit', function onSubmit() {
        const submitBtn = this.querySelector('button[type="submit"]');
        if (!submitBtn) {
            return;
        }

        submitBtn.textContent = contactUiState.sendingLabel;
        submitBtn.disabled = true;
    });
}

function setFooterYear() {
    const footerYear = document.getElementById('footer-year');
    if (footerYear) {
        footerYear.textContent = String(new Date().getFullYear());
    }
}

function renderHero(hero) {
    setText('hero-eyebrow', hero.eyebrow);
    setText('hero-title', hero.name);
    setText('hero-headline', hero.headline);
    setText('hero-summary', hero.summary);
    setText('hero-photo-caption', hero.photoCaption);
    setText('hero-current-role', hero.currentRole);
    setText('hero-current-company', hero.currentCompany);
    setText('hero-current-summary', hero.currentSummary);
    setText('hero-signals-title', hero.signalsTitle);
    setAttributeValue('hero-panel', 'aria-label', hero.panelAriaLabel);
    setImage('hero-photo', hero.photoUrl, hero.photoAlt || hero.name || 'Camilo Suazo');

    const actions = document.getElementById('hero-actions');
    if (actions) {
        actions.innerHTML = (hero.actions || []).map(renderActionButton).join('');
    }

    const focus = document.getElementById('hero-focus');
    if (focus) {
        focus.innerHTML = (hero.focus || [])
            .map((item) => `<li class="chip">${escapeHtml(item)}</li>`)
            .join('');
    }

    const signals = document.getElementById('hero-signals');
    if (signals) {
        signals.innerHTML = (hero.signals || [])
            .map((signal) => `
                <article class="signal-card reveal">
                    <span class="signal-label">${escapeHtml(signal.label || '')}</span>
                    <p class="signal-value">${escapeHtml(signal.value || '')}</p>
                </article>
            `)
            .join('');
    }
}

function renderAbout(about) {
    setText('about-eyebrow', about.eyebrow);
    setText('about-title', about.title);
    setText('about-summary-title', about.summaryTitle);
    setText('about-growth-title', about.growthTitle);

    const aboutCopy = document.getElementById('about-copy');
    if (aboutCopy) {
        aboutCopy.innerHTML = (about.paragraphs || [])
            .map((paragraph) => `<p class="reveal">${escapeHtml(paragraph)}</p>`)
            .join('');
    }

    const aboutHighlights = document.getElementById('about-highlights');
    if (aboutHighlights) {
        aboutHighlights.innerHTML = (about.highlights || [])
            .map((item) => `
                <div class="detail-item reveal">
                    <span class="detail-label">${escapeHtml(item.label || '')}</span>
                    <span class="detail-value">${escapeHtml(item.value || '')}</span>
                </div>
            `)
            .join('');
    }

    const growthList = document.getElementById('growth-list');
    if (growthList) {
        growthList.innerHTML = (about.growthInterests || [])
            .map((item) => `<li class="reveal">${escapeHtml(item)}</li>`)
            .join('');
    }
}

function renderWork(work) {
    setText('work-eyebrow', work.eyebrow);
    setText('work-title', work.title);
    setText('work-intro', work.intro);

    const workGrid = document.getElementById('work-grid');
    if (!workGrid) {
        return;
    }

    workGrid.innerHTML = (work.items || []).map((item, index) => `
        <article class="feature-card reveal">
            <span class="feature-index">${String(index + 1).padStart(2, '0')}</span>
            <h3 class="feature-title">${escapeHtml(item.title || '')}</h3>
            <p class="feature-description">${escapeHtml(item.description || '')}</p>
        </article>
    `).join('');
}

function renderStack(stack) {
    setText('stack-eyebrow', stack.eyebrow);
    setText('stack-title', stack.title);
    setText('stack-intro', stack.intro);

    const stackGrid = document.getElementById('stack-grid');
    if (!stackGrid) {
        return;
    }

    stackGrid.innerHTML = (stack.groups || []).map((group) => `
        <article class="stack-card reveal">
            <p class="card-eyebrow">${escapeHtml(group.title || '')}</p>
            <div class="tag-list">
                ${(group.items || []).map((item) => `<span class="tag">${escapeHtml(item)}</span>`).join('')}
            </div>
        </article>
    `).join('');
}

function renderProjects(projects) {
    setText('projects-eyebrow', projects.eyebrow);
    setText('projects-title', projects.title);
    setText('projects-intro', projects.intro);

    const projectsGrid = document.getElementById('projects-grid');
    if (!projectsGrid) {
        return;
    }

    projectsGrid.innerHTML = (projects.items || []).map((project) => `
        <article class="project-card reveal">
            <div class="project-card-header">
                <span class="project-status">${escapeHtml(project.status || '')}</span>
                ${renderInlineAction(project)}
            </div>
            <h3 class="project-title">${escapeHtml(project.title || '')}</h3>
            <p class="project-description">${escapeHtml(project.description || '')}</p>
            <div class="tag-list">
                ${(project.tech || []).map((item) => `<span class="tag tag-soft">${escapeHtml(item)}</span>`).join('')}
            </div>
        </article>
    `).join('');
}

function renderInlineAction(item) {
    const label = escapeHtml(item.ctaLabel || 'More');
    const url = item.ctaUrl || '';

    if (!url) {
        return `<span class="inline-action is-disabled">${label}</span>`;
    }

    const externalAttrs = isExternalHttpUrl(url) ? ' target="_blank" rel="noopener noreferrer"' : '';
    return `<a href="${escapeAttr(url)}" class="inline-action"${externalAttrs}>${label}</a>`;
}

function renderEducation(education) {
    setText('education-eyebrow', education.eyebrow);
    setText('education-title', education.title);
    setText('education-intro', education.intro);

    const educationGrid = document.getElementById('education-grid');
    if (!educationGrid) {
        return;
    }

    educationGrid.innerHTML = (education.items || []).map((item) => `
        <article class="timeline-item reveal">
            <span class="timeline-meta">${escapeHtml(item.meta || '')}</span>
            <h3 class="timeline-title">${escapeHtml(item.title || '')}</h3>
            <p class="timeline-description">${escapeHtml(item.description || '')}</p>
        </article>
    `).join('');
}

function renderApproach(approach) {
    setText('approach-eyebrow', approach.eyebrow);
    setText('approach-title', approach.title);
    setText('approach-intro', approach.intro);

    const approachGrid = document.getElementById('approach-grid');
    if (!approachGrid) {
        return;
    }

    approachGrid.innerHTML = (approach.items || []).map((item) => `
        <article class="principle-card reveal">
            <h3 class="principle-title">${escapeHtml(item.title || '')}</h3>
            <p class="principle-description">${escapeHtml(item.description || '')}</p>
        </article>
    `).join('');
}

function renderContact(contact) {
    contactUiState = {
        sendingLabel: contact.sendingLabel || 'Sending...',
        openLabel: contact.openLabel || 'Open',
        readyLabel: contact.readyLabel || 'Prepared'
    };

    setText('contact-eyebrow', contact.eyebrow);
    setText('contact-title', contact.title);
    setText('contact-text', contact.text);
    setText('contact-form-title', contact.formTitle);
    setText('contact-name-label', contact.fields?.nameLabel);
    setText('contact-email-label', contact.fields?.emailLabel);
    setText('contact-message-label', contact.fields?.messageLabel);
    setText('contact-submit', contact.submitLabel);

    setPlaceholder('contact-name', contact.fields?.namePlaceholder);
    setPlaceholder('contact-email', contact.fields?.emailPlaceholder);
    setPlaceholder('contact-message', contact.fields?.messagePlaceholder);

    const contactForm = document.getElementById('contact-form');
    if (contactForm && contact.formAction) {
        contactForm.action = contact.formAction;
    }

    const contactSubject = document.getElementById('contact-subject');
    if (contactSubject && contact.formSubject) {
        contactSubject.value = contact.formSubject;
    }

    const contactLinks = document.getElementById('contact-links');
    if (contactLinks) {
        contactLinks.innerHTML = (contact.links || []).map((link) => renderContactLink(link, contact)).join('');
    }
}

function renderContactLink(link, contact) {
    const label = escapeHtml(link.label || '');
    const description = escapeHtml(link.description || '');
    const href = link.href || '';
    const downloadAttr = isDownloadableAsset(href) ? ' download' : '';

    if (!href) {
        return `
            <article class="contact-link-card is-disabled reveal" aria-disabled="true">
                <span class="contact-link-label">${label}</span>
                <p class="contact-link-description">${description}</p>
                <span class="contact-link-meta">${escapeHtml(contact.readyLabel || 'Prepared')}</span>
            </article>
        `;
    }

    const externalAttrs = isExternalHttpUrl(href) ? ' target="_blank" rel="noopener noreferrer"' : '';
    return `
        <a href="${escapeAttr(href)}" class="contact-link-card reveal"${externalAttrs}${downloadAttr}>
            <span class="contact-link-label">${label}</span>
            <p class="contact-link-description">${description}</p>
            <span class="contact-link-meta">${escapeHtml(contact.openLabel || 'Open')}</span>
        </a>
    `;
}

function renderFooter(footer) {
    setText('footer-text', footer.text);
}

function renderActionButton(action) {
    const label = escapeHtml(action.label || '');
    const href = action.href || '';
    const variant = action.variant === 'primary' ? 'btn-primary' : 'btn-secondary';
    const downloadAttr = isDownloadableAsset(href) ? ' download' : '';

    if (!href) {
        return `<span class="btn ${variant} is-disabled" aria-disabled="true">${label}</span>`;
    }

    const externalAttrs = isExternalHttpUrl(href) ? ' target="_blank" rel="noopener noreferrer"' : '';
    return `<a href="${escapeAttr(href)}" class="btn ${variant}"${externalAttrs}${downloadAttr}>${label}</a>`;
}

function setText(id, value) {
    const element = document.getElementById(id);
    if (element && typeof value === 'string' && value.trim()) {
        element.textContent = value;
    }
}

function setAttributeValue(id, attribute, value) {
    const element = document.getElementById(id);
    if (element && typeof value === 'string' && value.trim()) {
        element.setAttribute(attribute, value);
    }
}

function setPlaceholder(id, value) {
    const element = document.getElementById(id);
    if (element && typeof value === 'string' && value.trim()) {
        element.setAttribute('placeholder', value);
    }
}

function setImage(id, src, alt) {
    const image = document.getElementById(id);
    if (!image || !src) {
        return;
    }

    image.src = src;
    if (alt) {
        image.alt = alt;
    }
}

function isExternalHttpUrl(value) {
    return /^https?:\/\//i.test(value);
}

function isDownloadableAsset(value) {
    return /\.(pdf|doc|docx)$/i.test(value || '');
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function escapeAttr(value) {
    return escapeHtml(value).replace(/`/g, '&#96;');
}
