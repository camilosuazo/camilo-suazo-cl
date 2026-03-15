const CONTENT_URL = 'data/site-content.json';

let siteContentCache = null;
let sectionObserver = null;
let lightboxController = null;

document.addEventListener('DOMContentLoaded', () => {
    initNavbar();
    initSmoothScroll();
    initScrollAnimations();
    initContactForm();
    initHeroParallax();
    initLightbox();
    initProductGalleries();
    loadAndRenderSiteContent();
});

async function loadAndRenderSiteContent() {
    try {
        const siteContent = await loadSiteContent();
        renderHeroContent(siteContent.hero || {});
        renderShows(siteContent.shows || {});
        renderStore(siteContent.store || {});
        observeAnimatedElements(document);
    } catch (error) {
        console.warn('No se pudo cargar el contenido editable del sitio.', error);
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

function initNavbar() {
    const navbar = document.getElementById('navbar');
    const navToggle = document.getElementById('nav-toggle');
    const navMenu = document.getElementById('nav-menu');
    const navLinks = document.querySelectorAll('.nav-link');
    const sections = document.querySelectorAll('section[id]');

    window.addEventListener('scroll', () => {
        const currentScroll = window.pageYOffset;

        if (navbar) {
            navbar.classList.toggle('scrolled', currentScroll > 50);
        }

        sections.forEach((section) => {
            const sectionHeight = section.offsetHeight;
            const sectionTop = section.offsetTop - 100;
            const sectionId = section.getAttribute('id');
            const navLink = document.querySelector(`.nav-link[href="#${sectionId}"]`);

            if (!navLink) {
                return;
            }

            const isActive = currentScroll > sectionTop && currentScroll <= sectionTop + sectionHeight;
            navLink.classList.toggle('active', isActive);
        });
    });

    if (navToggle && navMenu) {
        navToggle.addEventListener('click', () => {
            navToggle.classList.toggle('active');
            navMenu.classList.toggle('active');
        });
    }

    navLinks.forEach((link) => {
        link.addEventListener('click', () => {
            if (!navToggle || !navMenu) {
                return;
            }

            navToggle.classList.remove('active');
            navMenu.classList.remove('active');
        });
    });
}

function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
        anchor.addEventListener('click', function onClick(event) {
            const target = document.querySelector(this.getAttribute('href'));
            if (!target) {
                return;
            }

            event.preventDefault();
            const headerOffset = 80;
            const elementPosition = target.offsetTop;
            const offsetPosition = elementPosition - headerOffset;

            window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
            });
        });
    });
}

function initScrollAnimations() {
    sectionObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, {
        root: null,
        rootMargin: '0px',
        threshold: 0.1
    });

    observeAnimatedElements(document);
}

function observeAnimatedElements(scope) {
    if (!sectionObserver) {
        return;
    }

    scope.querySelectorAll('.section-title, .section-subtitle, .band-card, .show-item, .shows-empty, .platform-card, .social-link, .contact-item, .store-product').forEach((element) => {
        if (element.dataset.animatedReady === 'true') {
            return;
        }

        element.dataset.animatedReady = 'true';
        element.classList.add('animate-on-scroll');
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

        submitBtn.textContent = 'Enviando...';
        submitBtn.disabled = true;
    });
}

function initHeroParallax() {
    const heroBackground = document.querySelector('.hero-background');

    window.addEventListener('scroll', () => {
        if (!heroBackground || window.innerWidth <= 768) {
            return;
        }

        const scrolled = window.pageYOffset;
        const rate = scrolled * 0.3;
        heroBackground.style.transform = `translateY(${rate}px)`;
    });
}

function renderHeroContent(hero) {
    const spotifyPlayer = document.getElementById('hero-spotify-player');
    const spotifyEmbed = document.getElementById('hero-spotify-embed');
    const videoLink = document.getElementById('hero-video-link');
    const videoThumb = document.getElementById('hero-video-thumb');

    if (spotifyPlayer && spotifyEmbed) {
        const embedUrl = normalizeSpotifyEmbedUrl(hero.spotifyEmbedUrl || spotifyEmbed.src);
        spotifyPlayer.hidden = !embedUrl;

        if (embedUrl) {
            spotifyEmbed.src = embedUrl;
        }
    }

    if (videoLink && videoThumb) {
        const videoUrl = hero.youtubeUrl || videoLink.href;
        const videoTitle = hero.youtubeTitle || videoThumb.alt || 'Video destacado de Camilo Suazo';
        const videoThumbnailUrl = hero.youtubeThumbnailUrl || buildYouTubeThumbnail(videoUrl) || videoThumb.src;

        videoLink.hidden = !videoUrl;

        if (videoUrl) {
            videoLink.href = videoUrl;
        }

        if (videoThumbnailUrl) {
            videoThumb.src = videoThumbnailUrl;
        }

        videoThumb.alt = videoTitle;
    }
}

function renderShows(shows) {
    const showsContent = document.getElementById('shows-content');
    if (!showsContent) {
        return;
    }

    const visibleShows = (shows.items || []).filter((item) => item && item.visible !== false);

    if (!visibleShows.length) {
        showsContent.innerHTML = `
            <div class="shows-empty">
                <p class="shows-empty-text">${escapeHtml(shows.emptyTitle || 'Fechas por confirmar')}</p>
                <p class="shows-empty-subtext">${escapeHtml(shows.emptySubtitle || 'Pronto anunciaremos nuevas presentaciones')}</p>
            </div>
        `;
        return;
    }

    showsContent.innerHTML = `
        <div class="shows-list">
            ${visibleShows.map(renderShowItem).join('')}
        </div>
    `;
}

function renderShowItem(show) {
    const formattedDate = formatShowDate(show.date);
    const actions = [];

    if (show.mapUrl) {
        actions.push(`
            <a href="${escapeAttr(show.mapUrl)}" class="btn-tickets" target="_blank" rel="noopener noreferrer">Ver mapa</a>
        `);
    }

    if (show.postUrl) {
        actions.push(`
            <a href="${escapeAttr(show.postUrl)}" class="btn-tickets" target="_blank" rel="noopener noreferrer">${escapeHtml(show.postLabel || 'Ver publicacion')}</a>
        `);
    }

    const noteMarkup = show.note ? `<p class="show-note">${escapeHtml(show.note)}</p>` : '';

    return `
        <article class="show-item">
            <div class="show-date">
                <span class="show-month">${escapeHtml(formattedDate.month)}</span>
                <span class="show-day">${escapeHtml(formattedDate.day)}</span>
                <span class="show-year">${escapeHtml(formattedDate.year)}</span>
            </div>
            <div class="show-info">
                <h3 class="show-venue">${escapeHtml(show.venue || 'Show')}</h3>
                <p class="show-location">${escapeHtml(show.location || '')}</p>
                ${noteMarkup}
            </div>
            <div class="show-actions">
                ${actions.length ? actions.join('') : '<span class="btn-coming-soon">Proximamente</span>'}
            </div>
        </article>
    `;
}

function renderStore(store) {
    const storeGrid = document.getElementById('store-grid');
    const storeNote = document.getElementById('store-note');

    if (!storeGrid) {
        return;
    }

    const visibleProducts = (store.products || []).filter((product) => product && product.visible !== false);

    if (!visibleProducts.length) {
        storeGrid.innerHTML = `
            <div class="store-empty">
                <div class="store-empty-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                        <path d="M6 7h12l-1 13H7L6 7z"/>
                        <path d="M9 7a3 3 0 0 1 6 0"/>
                    </svg>
                </div>
                <h3 class="store-empty-title">Tienda en actualizacion</h3>
                <p class="store-empty-text">Muy pronto publicaremos nuevos productos.</p>
                <p class="store-empty-subtext">Mientras tanto, revisa las redes sociales para novedades.</p>
            </div>
        `;
    } else {
        storeGrid.innerHTML = visibleProducts.map(renderStoreProduct).join('');
    }

    if (storeNote) {
        storeNote.textContent = store.note || '';
    }

    initProductGalleries();
}

function renderStoreProduct(product) {
    const images = normalizeImageList(product.images);
    const imageData = escapeAttr(JSON.stringify(images));
    const galleryMarkup = images.length > 1 ? `
        <div class="store-product-gallery">
            <button class="gallery-arrow gallery-prev" aria-label="Anterior">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="15 18 9 12 15 6"/>
                </svg>
            </button>
            <div class="store-product-image" data-images="${imageData}" style="background-image: url('${escapeAttr(images[0])}');"></div>
            <button class="gallery-arrow gallery-next" aria-label="Siguiente">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="9 18 15 12 9 6"/>
                </svg>
            </button>
            <div class="gallery-dots">
                ${images.map((_, index) => `<span class="gallery-dot${index === 0 ? ' active' : ''}" data-index="${index}"></span>`).join('')}
            </div>
        </div>
    ` : renderStoreImage(images, imageData);
    const availabilityLabel = product.availabilityLabel || (product.available ? 'Disponible' : 'No disponible');
    const badgeClass = product.available ? 'store-product-badge is-available' : 'store-product-badge';
    const actionMarkup = product.available && product.ctaUrl ? `
        <div class="store-product-actions">
            <a href="${escapeAttr(product.ctaUrl)}" class="btn btn-primary btn-store" target="_blank" rel="noopener noreferrer">${escapeHtml(product.ctaLabel || 'Comprar')}</a>
        </div>
    ` : '';
    const priceMarkup = product.priceLabel ? `<p class="store-product-price">${escapeHtml(product.priceLabel)}</p>` : '';

    return `
        <article class="store-product">
            ${galleryMarkup}
            <div class="store-product-info">
                <h3 class="store-product-name">${escapeHtml(product.name || 'Producto')}</h3>
                <p class="store-product-variant">${escapeHtml(product.variant || '')}</p>
                ${priceMarkup}
                <span class="${badgeClass}">${escapeHtml(availabilityLabel)}</span>
                ${actionMarkup}
            </div>
        </article>
    `;
}

function renderStoreImage(images, imageData) {
    if (!images.length) {
        return `
            <div class="store-product-image store-product-placeholder" data-images="${imageData}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                    <rect x="3" y="4" width="18" height="16" rx="2"/>
                    <circle cx="9" cy="10" r="1.5"/>
                    <path d="M21 16l-5-5-4 4-2-2-5 5"/>
                </svg>
            </div>
        `;
    }

    return `
        <div class="store-product-image" data-images="${imageData}" style="background-image: url('${escapeAttr(images[0])}');"></div>
    `;
}

function initProductGalleries() {
    document.querySelectorAll('.store-product-gallery').forEach((gallery) => {
        if (gallery.dataset.galleryReady === 'true') {
            return;
        }

        const imageEl = gallery.querySelector('.store-product-image');
        if (!imageEl || !imageEl.dataset.images) {
            return;
        }

        let images = [];
        try {
            images = JSON.parse(imageEl.dataset.images);
        } catch (error) {
            console.warn('No se pudieron leer las imagenes de la galeria.', error);
            return;
        }

        if (!images.length) {
            return;
        }

        const dots = gallery.querySelectorAll('.gallery-dot');
        const prevBtn = gallery.querySelector('.gallery-prev');
        const nextBtn = gallery.querySelector('.gallery-next');
        let currentIndex = 0;

        function updateImage(index) {
            currentIndex = ((index % images.length) + images.length) % images.length;
            imageEl.style.backgroundImage = `url('${images[currentIndex]}')`;

            dots.forEach((dot, dotIndex) => {
                dot.classList.toggle('active', dotIndex === currentIndex);
            });
        }

        if (prevBtn) {
            prevBtn.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                updateImage(currentIndex - 1);
            });
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                updateImage(currentIndex + 1);
            });
        }

        dots.forEach((dot) => {
            dot.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                updateImage(parseInt(dot.dataset.index || '0', 10));
            });
        });

        gallery.dataset.galleryReady = 'true';
    });
}

function initLightbox() {
    if (lightboxController) {
        return;
    }

    const lightbox = document.createElement('div');
    lightbox.className = 'lightbox';
    lightbox.innerHTML = `
        <button class="lightbox-close" aria-label="Cerrar">&times;</button>
        <button class="lightbox-prev" aria-label="Anterior">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="15 18 9 12 15 6"/>
            </svg>
        </button>
        <img class="lightbox-image" src="" alt="Imagen del producto">
        <button class="lightbox-next" aria-label="Siguiente">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="9 18 15 12 9 6"/>
            </svg>
        </button>
    `;
    document.body.appendChild(lightbox);

    const lightboxImage = lightbox.querySelector('.lightbox-image');
    const closeBtn = lightbox.querySelector('.lightbox-close');
    const prevBtn = lightbox.querySelector('.lightbox-prev');
    const nextBtn = lightbox.querySelector('.lightbox-next');

    lightboxController = {
        currentImages: [],
        currentIndex: 0,
        open(images, index) {
            this.currentImages = images;
            this.currentIndex = index;
            this.update();
            lightbox.classList.add('active');
            document.body.style.overflow = 'hidden';

            const hasMultiple = images.length > 1;
            prevBtn.style.display = hasMultiple ? 'flex' : 'none';
            nextBtn.style.display = hasMultiple ? 'flex' : 'none';
        },
        close() {
            lightbox.classList.remove('active');
            document.body.style.overflow = '';
        },
        update() {
            lightboxImage.src = this.currentImages[this.currentIndex];
        },
        prev() {
            this.currentIndex = (this.currentIndex - 1 + this.currentImages.length) % this.currentImages.length;
            this.update();
        },
        next() {
            this.currentIndex = (this.currentIndex + 1) % this.currentImages.length;
            this.update();
        }
    };

    closeBtn.addEventListener('click', () => lightboxController.close());
    prevBtn.addEventListener('click', () => lightboxController.prev());
    nextBtn.addEventListener('click', () => lightboxController.next());

    lightbox.addEventListener('click', (event) => {
        if (event.target === lightbox) {
            lightboxController.close();
        }
    });

    document.addEventListener('keydown', (event) => {
        if (!lightbox.classList.contains('active')) {
            return;
        }

        if (event.key === 'Escape') {
            lightboxController.close();
        }

        if (event.key === 'ArrowLeft') {
            lightboxController.prev();
        }

        if (event.key === 'ArrowRight') {
            lightboxController.next();
        }
    });

    document.addEventListener('click', (event) => {
        const imageEl = event.target.closest('.store-product-image');
        if (!imageEl || event.target.closest('.gallery-arrow')) {
            return;
        }

        let images = [];
        try {
            images = JSON.parse(imageEl.dataset.images || '[]');
        } catch (error) {
            console.warn('No se pudieron abrir las imagenes del producto.', error);
            return;
        }

        if (!images.length) {
            return;
        }

        const currentBackground = imageEl.style.backgroundImage;
        let startIndex = 0;
        images.forEach((image, index) => {
            if (currentBackground.includes(image)) {
                startIndex = index;
            }
        });

        lightboxController.open(images, startIndex);
    });
}

function normalizeImageList(images) {
    if (!Array.isArray(images)) {
        return [];
    }

    return images.filter(Boolean);
}

function normalizeSpotifyEmbedUrl(url) {
    if (!url) {
        return '';
    }

    if (url.includes('/embed/')) {
        return url;
    }

    const match = url.match(/open\.spotify\.com\/(track|album|playlist|artist)\/([A-Za-z0-9]+)/);
    if (!match) {
        return url;
    }

    return `https://open.spotify.com/embed/${match[1]}/${match[2]}?utm_source=generator&theme=0`;
}

function buildYouTubeThumbnail(url) {
    const videoId = extractYouTubeId(url);
    if (!videoId) {
        return '';
    }

    return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
}

function extractYouTubeId(url) {
    if (!url) {
        return '';
    }

    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{6,})/);
    return match ? match[1] : '';
}

function formatShowDate(dateString) {
    if (!dateString) {
        return {
            day: '--',
            month: 'SIN FECHA',
            year: ''
        };
    }

    const date = new Date(`${dateString}T12:00:00`);
    if (Number.isNaN(date.getTime())) {
        return {
            day: '--',
            month: 'SIN FECHA',
            year: ''
        };
    }

    const month = new Intl.DateTimeFormat('es-CL', {
        month: 'short'
    }).format(date).replace('.', '').toUpperCase();

    return {
        day: new Intl.DateTimeFormat('es-CL', { day: '2-digit' }).format(date),
        month,
        year: new Intl.DateTimeFormat('es-CL', { year: 'numeric' }).format(date)
    };
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
