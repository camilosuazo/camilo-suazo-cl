const ADMIN_CONTENT_URL = 'data/site-content.json';
const GITHUB_OWNER = 'camilosuazo';
const GITHUB_REPO = 'camilo-suazo-cl';
const GITHUB_BRANCH = 'main';
const GITHUB_CONTENT_PATH = 'data/site-content.json';
const TOKEN_STORAGE_KEY = 'camilo-suazo-admin-token';
const DRAFT_STORAGE_KEY = 'camilo-suazo-admin-draft';
const AUTH_CONFIG_KEY = 'camilo-suazo-admin-auth';
const AUTH_SESSION_KEY = 'camilo-suazo-admin-session';
const ALLOWED_ADMIN_EMAIL = 'csuazo.musico@gmail.com';
const MIN_PASSWORD_LENGTH = 8;

let dom = {};
let authMode = 'login';
let hasUnsavedChanges = false;
let isUnlocked = false;

document.addEventListener('DOMContentLoaded', async () => {
    cacheDom();
    bindEvents();
    restoreStoredToken();
    refreshDraftButton();
    await initializeAuth();
});

function cacheDom() {
    dom = {
        adminApp: document.getElementById('admin-app'),
        authGate: document.getElementById('admin-auth'),
        authForm: document.getElementById('auth-form'),
        authTitle: document.getElementById('auth-title'),
        authMessage: document.getElementById('auth-message'),
        authEmail: document.getElementById('auth-email'),
        authPassword: document.getElementById('auth-password'),
        authConfirmWrap: document.getElementById('auth-confirm-wrap'),
        authPasswordConfirm: document.getElementById('auth-password-confirm'),
        authSubmit: document.getElementById('auth-submit'),
        authStatus: document.getElementById('auth-status'),
        userBadge: document.getElementById('admin-user-badge'),
        logoutAdmin: document.getElementById('logout-admin'),
        changePassword: document.getElementById('change-password'),
        accessCurrentPassword: document.getElementById('access-current-password'),
        accessNewPassword: document.getElementById('access-new-password'),
        accessConfirmPassword: document.getElementById('access-confirm-password'),
        form: document.getElementById('admin-form'),
        status: document.getElementById('admin-status'),
        githubToken: document.getElementById('github-token'),
        rememberToken: document.getElementById('remember-token'),
        reloadLive: document.getElementById('reload-live'),
        restoreDraft: document.getElementById('restore-draft'),
        saveDraft: document.getElementById('save-draft'),
        downloadJson: document.getElementById('download-json'),
        publishContent: document.getElementById('publish-content'),
        addShow: document.getElementById('add-show'),
        addProduct: document.getElementById('add-product'),
        heroSpotifyUrl: document.getElementById('hero-spotify-url'),
        heroYoutubeUrl: document.getElementById('hero-youtube-url'),
        heroYoutubeTitle: document.getElementById('hero-youtube-title'),
        heroYoutubeThumbnail: document.getElementById('hero-youtube-thumbnail'),
        showsEmptyTitle: document.getElementById('shows-empty-title'),
        showsEmptySubtitle: document.getElementById('shows-empty-subtitle'),
        showsEditor: document.getElementById('shows-editor'),
        storeNoteInput: document.getElementById('store-note-input'),
        productsEditor: document.getElementById('products-editor'),
        showTemplate: document.getElementById('show-item-template'),
        productTemplate: document.getElementById('product-item-template')
    };
}

function bindEvents() {
    dom.authForm.addEventListener('submit', handleAuthSubmit);
    dom.logoutAdmin.addEventListener('click', handleLogout);
    dom.changePassword.addEventListener('click', handlePasswordChange);

    dom.reloadLive.addEventListener('click', async () => {
        if (hasUnsavedChanges && !window.confirm('Tienes cambios sin guardar. Quieres recargar el contenido publicado y descartarlos?')) {
            return;
        }

        await loadPublishedContent();
    });

    dom.restoreDraft.addEventListener('click', () => {
        if (hasUnsavedChanges && !window.confirm('Tienes cambios sin guardar. Quieres reemplazarlos por el borrador local?')) {
            return;
        }

        restoreDraft();
    });

    dom.saveDraft.addEventListener('click', () => {
        saveDraft();
        setStatus('Borrador guardado en este navegador.', 'success');
    });

    dom.downloadJson.addEventListener('click', downloadJson);
    dom.publishContent.addEventListener('click', publishContent);

    dom.addShow.addEventListener('click', () => {
        appendShowEditor(createEmptyShow());
        markDirty();
    });

    dom.addProduct.addEventListener('click', () => {
        appendProductEditor(createEmptyProduct());
        markDirty();
    });

    dom.githubToken.addEventListener('input', persistTokenPreference);
    dom.rememberToken.addEventListener('change', persistTokenPreference);

    dom.form.addEventListener('input', (event) => {
        if (!isContentEditorField(event.target)) {
            return;
        }

        const card = event.target.closest('.admin-item-card');
        if (card) {
            updateCardTitle(card);
        }

        markDirty();
    });

    dom.form.addEventListener('change', (event) => {
        if (!isContentEditorField(event.target)) {
            return;
        }

        markDirty();
    });

    dom.form.addEventListener('click', (event) => {
        const button = event.target.closest('button');
        if (!button) {
            return;
        }

        const card = button.closest('.admin-item-card');
        if (!card) {
            return;
        }

        if (button.classList.contains('js-remove-item')) {
            card.remove();
            refreshEditorEmptyState(dom.showsEditor, 'No hay shows cargados aun. Usa "Agregar show".');
            refreshEditorEmptyState(dom.productsEditor, 'No hay productos cargados aun. Usa "Agregar producto".');
            markDirty();
            return;
        }

        if (button.classList.contains('js-move-up') && card.previousElementSibling) {
            card.parentElement.insertBefore(card, card.previousElementSibling);
            markDirty();
            return;
        }

        if (button.classList.contains('js-move-down') && card.nextElementSibling) {
            card.parentElement.insertBefore(card.nextElementSibling, card);
            markDirty();
        }
    });
}

async function initializeAuth() {
    dom.authEmail.value = ALLOWED_ADMIN_EMAIL;
    dom.userBadge.textContent = ALLOWED_ADMIN_EMAIL;

    const authConfig = getAuthConfig();
    setAuthMode(authConfig ? 'login' : 'create');

    if (hasActiveSession()) {
        await unlockAdmin();
        return;
    }

    lockAdmin();
}

function setAuthMode(mode) {
    authMode = mode;

    if (mode === 'create') {
        dom.authTitle.textContent = 'Crear acceso al admin';
        dom.authMessage.innerHTML = `El unico correo permitido es <strong>${ALLOWED_ADMIN_EMAIL}</strong>. Crea una contrasena local para este navegador.`;
        dom.authConfirmWrap.hidden = false;
        dom.authSubmit.textContent = 'Crear contrasena';
        dom.authPassword.autocomplete = 'new-password';
        setAuthStatus(`No hay contrasena configurada aun. Crea una de al menos ${MIN_PASSWORD_LENGTH} caracteres.`, 'warning');
        return;
    }

    dom.authTitle.textContent = 'Ingresar al admin';
    dom.authMessage.innerHTML = `Ingresa con <strong>${ALLOWED_ADMIN_EMAIL}</strong> y la contrasena guardada en este navegador.`;
    dom.authConfirmWrap.hidden = true;
    dom.authPasswordConfirm.value = '';
    dom.authSubmit.textContent = 'Entrar';
    dom.authPassword.autocomplete = 'current-password';
    setAuthStatus('Escribe tu correo autorizado y tu contrasena.', 'warning');
}

async function handleAuthSubmit(event) {
    event.preventDefault();

    const email = dom.authEmail.value.trim().toLowerCase();
    const password = dom.authPassword.value;
    const confirmPassword = dom.authPasswordConfirm.value;

    if (email !== ALLOWED_ADMIN_EMAIL) {
        setAuthStatus(`Solo esta autorizado el correo ${ALLOWED_ADMIN_EMAIL}.`, 'error');
        return;
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
        setAuthStatus(`La contrasena debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`, 'error');
        return;
    }

    if (authMode === 'create') {
        if (password !== confirmPassword) {
            setAuthStatus('La confirmacion de contrasena no coincide.', 'error');
            return;
        }

        await saveAuthConfig(password);
        setActiveSession();
        clearAuthInputs();
        setStatus('Acceso local creado. Ya puedes usar el admin en este navegador.', 'success');
        await unlockAdmin();
        return;
    }

    const authConfig = getAuthConfig();
    if (!authConfig) {
        setAuthMode('create');
        return;
    }

    const passwordHash = await hashSecret(password, authConfig.salt);
    if (passwordHash !== authConfig.passwordHash) {
        setAuthStatus('Contrasena incorrecta.', 'error');
        return;
    }

    setActiveSession();
    clearAuthInputs();
    setStatus('Sesion iniciada.', 'success');
    await unlockAdmin();
}

function handleLogout() {
    if (hasUnsavedChanges && !window.confirm('Tienes cambios sin publicar. Quieres cerrar sesion igual?')) {
        return;
    }

    clearActiveSession();
    clearSensitiveInputs();
    hasUnsavedChanges = false;
    lockAdmin();
}

async function handlePasswordChange() {
    const currentPassword = dom.accessCurrentPassword.value;
    const newPassword = dom.accessNewPassword.value;
    const confirmPassword = dom.accessConfirmPassword.value;
    const authConfig = getAuthConfig();

    if (!authConfig) {
        setStatus('No hay una contrasena local configurada aun.', 'error');
        return;
    }

    if (!currentPassword || !newPassword || !confirmPassword) {
        setStatus('Completa la contrasena actual, la nueva y la confirmacion.', 'error');
        return;
    }

    const currentHash = await hashSecret(currentPassword, authConfig.salt);
    if (currentHash !== authConfig.passwordHash) {
        setStatus('La contrasena actual no coincide.', 'error');
        return;
    }

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
        setStatus(`La nueva contrasena debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`, 'error');
        return;
    }

    if (newPassword !== confirmPassword) {
        setStatus('La confirmacion de la nueva contrasena no coincide.', 'error');
        return;
    }

    await saveAuthConfig(newPassword);
    setActiveSession();
    dom.accessCurrentPassword.value = '';
    dom.accessNewPassword.value = '';
    dom.accessConfirmPassword.value = '';
    setStatus('Contrasena actualizada en este navegador.', 'success');
}

function lockAdmin() {
    isUnlocked = false;
    dom.adminApp.hidden = true;
    dom.authGate.hidden = false;
    dom.authEmail.value = ALLOWED_ADMIN_EMAIL;
    dom.authPassword.value = '';
    dom.authPasswordConfirm.value = '';

    const authConfig = getAuthConfig();
    setAuthMode(authConfig ? 'login' : 'create');
}

async function unlockAdmin() {
    isUnlocked = true;
    dom.authGate.hidden = true;
    dom.adminApp.hidden = false;
    dom.userBadge.textContent = ALLOWED_ADMIN_EMAIL;
    await loadPublishedContent();
}

function getAuthConfig() {
    const rawConfig = window.localStorage.getItem(AUTH_CONFIG_KEY);
    if (!rawConfig) {
        return null;
    }

    try {
        const config = JSON.parse(rawConfig);
        if (
            config &&
            config.email === ALLOWED_ADMIN_EMAIL &&
            typeof config.passwordHash === 'string' &&
            typeof config.salt === 'string'
        ) {
            return config;
        }
    } catch (error) {
        return null;
    }

    return null;
}

async function saveAuthConfig(password) {
    const salt = generateSalt();
    const passwordHash = await hashSecret(password, salt);

    window.localStorage.setItem(AUTH_CONFIG_KEY, JSON.stringify({
        email: ALLOWED_ADMIN_EMAIL,
        salt,
        passwordHash,
        updatedAt: new Date().toISOString()
    }));
}

function hasActiveSession() {
    return window.localStorage.getItem(AUTH_SESSION_KEY) === ALLOWED_ADMIN_EMAIL && Boolean(getAuthConfig());
}

function setActiveSession() {
    window.localStorage.setItem(AUTH_SESSION_KEY, ALLOWED_ADMIN_EMAIL);
}

function clearActiveSession() {
    window.localStorage.removeItem(AUTH_SESSION_KEY);
}

function clearAuthInputs() {
    dom.authPassword.value = '';
    dom.authPasswordConfirm.value = '';
}

function clearSensitiveInputs() {
    clearAuthInputs();
    dom.accessCurrentPassword.value = '';
    dom.accessNewPassword.value = '';
    dom.accessConfirmPassword.value = '';
}

async function hashSecret(value, salt) {
    const payload = new TextEncoder().encode(`${salt}:${value}`);
    const digest = await crypto.subtle.digest('SHA-256', payload);
    return Array.from(new Uint8Array(digest))
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');
}

function generateSalt() {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    return Array.from(bytes)
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');
}

function isContentEditorField(target) {
    if (!(target instanceof HTMLElement)) {
        return false;
    }

    return ![
        'access-current-password',
        'access-new-password',
        'access-confirm-password'
    ].includes(target.id);
}

async function loadPublishedContent() {
    if (!isUnlocked) {
        return;
    }

    setStatus('Cargando contenido publicado...', 'warning');

    try {
        const response = await fetch(ADMIN_CONTENT_URL, { cache: 'no-store' });
        if (!response.ok) {
            throw new Error(`No se pudo cargar ${ADMIN_CONTENT_URL} (${response.status})`);
        }

        const content = await response.json();
        populateForm(content);
        setStatus('Contenido publicado cargado.', 'success');
        hasUnsavedChanges = false;
    } catch (error) {
        setStatus(`Error cargando contenido: ${error.message}`, 'error');
    }
}

function populateForm(content) {
    const hero = content.hero || {};
    const shows = content.shows || {};
    const store = content.store || {};

    dom.heroSpotifyUrl.value = hero.spotifyEmbedUrl || '';
    dom.heroYoutubeUrl.value = hero.youtubeUrl || '';
    dom.heroYoutubeTitle.value = hero.youtubeTitle || '';
    dom.heroYoutubeThumbnail.value = hero.youtubeThumbnailUrl || '';

    dom.showsEmptyTitle.value = shows.emptyTitle || '';
    dom.showsEmptySubtitle.value = shows.emptySubtitle || '';
    dom.storeNoteInput.value = store.note || '';

    dom.showsEditor.innerHTML = '';
    (shows.items || []).forEach((show) => appendShowEditor(show));
    refreshEditorEmptyState(dom.showsEditor, 'No hay shows cargados aun. Usa "Agregar show".');

    dom.productsEditor.innerHTML = '';
    (store.products || []).forEach((product) => appendProductEditor(product));
    refreshEditorEmptyState(dom.productsEditor, 'No hay productos cargados aun. Usa "Agregar producto".');
}

function appendShowEditor(show) {
    removeEmptyState(dom.showsEditor);
    const card = createCardFromTemplate(dom.showTemplate);

    card.dataset.itemId = show.id || '';
    setFieldValue(card, 'date', show.date || '');
    setFieldValue(card, 'venue', show.venue || '');
    setFieldValue(card, 'location', show.location || '');
    setFieldValue(card, 'mapUrl', show.mapUrl || '');
    setFieldValue(card, 'postUrl', show.postUrl || '');
    setFieldValue(card, 'postLabel', show.postLabel || '');
    setFieldValue(card, 'note', show.note || '');
    setCheckboxValue(card, 'visible', show.visible !== false);
    updateCardTitle(card);

    dom.showsEditor.appendChild(card);
}

function appendProductEditor(product) {
    removeEmptyState(dom.productsEditor);
    const card = createCardFromTemplate(dom.productTemplate);

    card.dataset.itemId = product.id || '';
    setFieldValue(card, 'name', product.name || '');
    setFieldValue(card, 'variant', product.variant || '');
    setFieldValue(card, 'priceLabel', product.priceLabel || '');
    setFieldValue(card, 'availabilityLabel', product.availabilityLabel || '');
    setFieldValue(card, 'ctaLabel', product.ctaLabel || '');
    setFieldValue(card, 'ctaUrl', product.ctaUrl || '');
    setFieldValue(card, 'images', (product.images || []).join('\n'));
    setCheckboxValue(card, 'available', Boolean(product.available));
    setCheckboxValue(card, 'visible', product.visible !== false);
    updateCardTitle(card);

    dom.productsEditor.appendChild(card);
}

function createCardFromTemplate(template) {
    const fragment = template.content.cloneNode(true);
    return fragment.querySelector('.admin-item-card');
}

function setFieldValue(card, fieldName, value) {
    const field = card.querySelector(`[data-field="${fieldName}"]`);
    if (field) {
        field.value = value;
    }
}

function setCheckboxValue(card, fieldName, checked) {
    const field = card.querySelector(`[data-field="${fieldName}"]`);
    if (field) {
        field.checked = checked;
    }
}

function updateCardTitle(card) {
    const titleElement = card.querySelector('.admin-item-title');
    if (!titleElement) {
        return;
    }

    if (card.dataset.itemType === 'show') {
        const venue = getFieldValue(card, 'venue');
        const date = getFieldValue(card, 'date');
        titleElement.textContent = venue || date || 'Nueva fecha';
        return;
    }

    const productName = getFieldValue(card, 'name');
    titleElement.textContent = productName || 'Nuevo producto';
}

function getFieldValue(card, fieldName) {
    const field = card.querySelector(`[data-field="${fieldName}"]`);
    return field ? field.value.trim() : '';
}

function getCheckboxValue(card, fieldName) {
    const field = card.querySelector(`[data-field="${fieldName}"]`);
    return Boolean(field && field.checked);
}

function refreshEditorEmptyState(container, message) {
    const hasCards = Array.from(container.children).some((child) => child.classList.contains('admin-item-card'));
    removeEmptyState(container);

    if (hasCards) {
        return;
    }

    const emptyState = document.createElement('div');
    emptyState.className = 'admin-empty-editor';
    emptyState.textContent = message;
    container.appendChild(emptyState);
}

function removeEmptyState(container) {
    const placeholder = container.querySelector('.admin-empty-editor');
    if (placeholder) {
        placeholder.remove();
    }
}

function markDirty() {
    hasUnsavedChanges = true;
}

function createEmptyShow() {
    return {
        id: '',
        date: '',
        venue: '',
        location: '',
        mapUrl: '',
        postUrl: '',
        postLabel: '',
        note: '',
        visible: true
    };
}

function createEmptyProduct() {
    return {
        id: '',
        name: '',
        variant: '',
        priceLabel: '',
        availabilityLabel: '',
        available: false,
        visible: true,
        images: [],
        ctaLabel: '',
        ctaUrl: ''
    };
}

function serializeForm() {
    const hero = {
        spotifyEmbedUrl: normalizeSpotifyEmbedUrl(dom.heroSpotifyUrl.value.trim()),
        youtubeUrl: dom.heroYoutubeUrl.value.trim(),
        youtubeTitle: dom.heroYoutubeTitle.value.trim(),
        youtubeThumbnailUrl: dom.heroYoutubeThumbnail.value.trim()
    };

    if (!hero.youtubeThumbnailUrl) {
        hero.youtubeThumbnailUrl = buildYouTubeThumbnail(hero.youtubeUrl);
    }

    const shows = Array.from(dom.showsEditor.querySelectorAll('.admin-item-card')).map((card, index) => {
        const venue = getFieldValue(card, 'venue');
        const date = getFieldValue(card, 'date');
        const location = getFieldValue(card, 'location');
        const mapUrl = getFieldValue(card, 'mapUrl');
        const postUrl = getFieldValue(card, 'postUrl');
        const postLabel = getFieldValue(card, 'postLabel');
        const note = getFieldValue(card, 'note');

        return {
            id: card.dataset.itemId || slugify(`${date}-${venue}`) || `show-${index + 1}`,
            date,
            venue,
            location,
            mapUrl,
            postUrl,
            postLabel,
            note,
            visible: getCheckboxValue(card, 'visible')
        };
    }).filter((show) => {
        return Boolean(show.date || show.venue || show.location || show.mapUrl || show.postUrl || show.note);
    });

    const products = Array.from(dom.productsEditor.querySelectorAll('.admin-item-card')).map((card, index) => {
        const name = getFieldValue(card, 'name');
        const available = getCheckboxValue(card, 'available');
        const availabilityLabel = getFieldValue(card, 'availabilityLabel') || (available ? 'Disponible' : 'No disponible');

        return {
            id: card.dataset.itemId || slugify(name) || `product-${index + 1}`,
            name,
            variant: getFieldValue(card, 'variant'),
            priceLabel: getFieldValue(card, 'priceLabel'),
            availabilityLabel,
            available,
            visible: getCheckboxValue(card, 'visible'),
            images: getFieldValue(card, 'images')
                .split('\n')
                .map((value) => value.trim())
                .filter(Boolean),
            ctaLabel: getFieldValue(card, 'ctaLabel'),
            ctaUrl: getFieldValue(card, 'ctaUrl')
        };
    }).filter((product) => {
        return Boolean(product.name || product.variant || product.priceLabel || product.images.length);
    });

    return {
        hero,
        shows: {
            emptyTitle: dom.showsEmptyTitle.value.trim() || 'Fechas por confirmar',
            emptySubtitle: dom.showsEmptySubtitle.value.trim() || 'Pronto anunciaremos nuevas presentaciones',
            items: shows
        },
        store: {
            note: dom.storeNoteInput.value.trim(),
            products
        }
    };
}

function saveDraft() {
    window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(serializeForm()));
    refreshDraftButton();
}

function restoreDraft() {
    const rawDraft = window.localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!rawDraft) {
        setStatus('No hay borrador guardado en este navegador.', 'warning');
        refreshDraftButton();
        return;
    }

    try {
        const draft = JSON.parse(rawDraft);
        populateForm(draft);
        hasUnsavedChanges = true;
        setStatus('Borrador restaurado. Revisa y publica cuando quieras.', 'success');
    } catch (error) {
        setStatus(`No se pudo leer el borrador: ${error.message}`, 'error');
    }
}

function refreshDraftButton() {
    const hasDraft = Boolean(window.localStorage.getItem(DRAFT_STORAGE_KEY));
    dom.restoreDraft.disabled = !hasDraft;
}

function downloadJson() {
    const content = serializeForm();
    const jsonString = `${JSON.stringify(content, null, 2)}\n`;
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'site-content.json';
    link.click();
    URL.revokeObjectURL(url);
    setStatus('JSON descargado.', 'success');
}

async function publishContent() {
    const token = dom.githubToken.value.trim();
    if (!token) {
        setStatus('Necesitas pegar un GitHub token para publicar.', 'error');
        return;
    }

    const content = serializeForm();
    const jsonString = `${JSON.stringify(content, null, 2)}\n`;

    setStatus('Publicando cambios en GitHub...', 'warning');

    try {
        const currentFile = await fetchGithubFile(token);
        const response = await fetch(buildGithubContentUrl(), {
            method: 'PUT',
            headers: buildGithubHeaders(token),
            body: JSON.stringify({
                message: `Update site content via admin (${new Date().toISOString()})`,
                content: toBase64(jsonString),
                sha: currentFile.sha,
                branch: GITHUB_BRANCH
            })
        });

        if (!response.ok) {
            throw new Error(await readGithubError(response));
        }

        const result = await response.json();
        persistTokenPreference();
        saveDraft();
        hasUnsavedChanges = false;

        setStatus(
            `Cambios publicados. Commit ${result.commit.sha.slice(0, 7)} creado en ${GITHUB_BRANCH}. El deploy deberia reflejarse en 1 o 2 minutos.`,
            'success'
        );
    } catch (error) {
        setStatus(`No se pudo publicar: ${error.message}`, 'error');
    }
}

async function fetchGithubFile(token) {
    const response = await fetch(buildGithubContentUrl(), {
        headers: buildGithubHeaders(token)
    });

    if (!response.ok) {
        throw new Error(await readGithubError(response));
    }

    return response.json();
}

function buildGithubContentUrl() {
    return `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_CONTENT_PATH}`;
}

function buildGithubHeaders(token) {
    return {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28'
    };
}

async function readGithubError(response) {
    try {
        const payload = await response.json();
        return payload.message || `GitHub respondio con ${response.status}`;
    } catch (error) {
        return `GitHub respondio con ${response.status}`;
    }
}

function persistTokenPreference() {
    if (dom.rememberToken.checked && dom.githubToken.value.trim()) {
        window.localStorage.setItem(TOKEN_STORAGE_KEY, dom.githubToken.value.trim());
        return;
    }

    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
}

function restoreStoredToken() {
    const savedToken = window.localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!savedToken) {
        return;
    }

    dom.githubToken.value = savedToken;
    dom.rememberToken.checked = true;
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

function slugify(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function toBase64(value) {
    const bytes = new TextEncoder().encode(value);
    let binary = '';
    bytes.forEach((byte) => {
        binary += String.fromCharCode(byte);
    });
    return btoa(binary);
}

function setAuthStatus(message, type = 'info') {
    setStatusElement(dom.authStatus, message, type);
}

function setStatus(message, type = 'info') {
    setStatusElement(dom.status, message, type);
}

function setStatusElement(element, message, type = 'info') {
    element.textContent = message;
    element.classList.remove('is-success', 'is-error', 'is-warning');

    if (type === 'success') {
        element.classList.add('is-success');
    }

    if (type === 'error') {
        element.classList.add('is-error');
    }

    if (type === 'warning') {
        element.classList.add('is-warning');
    }
}
