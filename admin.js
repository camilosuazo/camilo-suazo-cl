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
        contentEditor: document.getElementById('content-editor'),
        status: document.getElementById('admin-status'),
        githubToken: document.getElementById('github-token'),
        rememberToken: document.getElementById('remember-token'),
        reloadLive: document.getElementById('reload-live'),
        restoreDraft: document.getElementById('restore-draft'),
        saveDraft: document.getElementById('save-draft'),
        downloadJson: document.getElementById('download-json'),
        publishContent: document.getElementById('publish-content')
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
    dom.githubToken.addEventListener('input', persistTokenPreference);
    dom.rememberToken.addEventListener('change', persistTokenPreference);

    dom.contentEditor.addEventListener('input', () => {
        hasUnsavedChanges = true;
    });

    window.addEventListener('beforeunload', (event) => {
        if (!hasUnsavedChanges) {
            return;
        }

        event.preventDefault();
        event.returnValue = '';
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
        dom.authMessage.innerHTML = `El único correo permitido es <strong>${ALLOWED_ADMIN_EMAIL}</strong>. Crea una contraseña local para este navegador.`;
        dom.authConfirmWrap.hidden = false;
        dom.authPassword.autocomplete = 'new-password';
        dom.authSubmit.textContent = 'Crear contraseña';
        setAuthStatus(`No hay contraseña configurada aún. Crea una de al menos ${MIN_PASSWORD_LENGTH} caracteres.`, 'warning');
        return;
    }

    dom.authTitle.textContent = 'Ingresar al admin';
    dom.authMessage.innerHTML = `Ingresa con <strong>${ALLOWED_ADMIN_EMAIL}</strong> y la contraseña guardada en este navegador.`;
    dom.authConfirmWrap.hidden = true;
    dom.authPassword.autocomplete = 'current-password';
    dom.authPasswordConfirm.value = '';
    dom.authSubmit.textContent = 'Entrar';
    setAuthStatus('Escribe tu correo autorizado y tu contraseña.', 'warning');
}

async function handleAuthSubmit(event) {
    event.preventDefault();

    const email = dom.authEmail.value.trim().toLowerCase();
    const password = dom.authPassword.value;
    const confirmPassword = dom.authPasswordConfirm.value;

    if (email !== ALLOWED_ADMIN_EMAIL) {
        setAuthStatus(`Solo está autorizado el correo ${ALLOWED_ADMIN_EMAIL}.`, 'error');
        return;
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
        setAuthStatus(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`, 'error');
        return;
    }

    if (authMode === 'create') {
        if (password !== confirmPassword) {
            setAuthStatus('La confirmación de contraseña no coincide.', 'error');
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
        setAuthStatus('Contraseña incorrecta.', 'error');
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
    const authConfig = getAuthConfig();
    if (!authConfig) {
        setStatus('Primero debes crear una contraseña local.', 'error');
        setAuthMode('create');
        return;
    }

    const currentPassword = dom.accessCurrentPassword.value;
    const newPassword = dom.accessNewPassword.value;
    const confirmPassword = dom.accessConfirmPassword.value;

    if (!currentPassword || !newPassword || !confirmPassword) {
        setStatus('Completa todos los campos para cambiar la contraseña.', 'error');
        return;
    }

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
        setStatus(`La nueva contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`, 'error');
        return;
    }

    if (newPassword !== confirmPassword) {
        setStatus('La confirmación de la nueva contraseña no coincide.', 'error');
        return;
    }

    const currentHash = await hashSecret(currentPassword, authConfig.salt);
    if (currentHash !== authConfig.passwordHash) {
        setStatus('La contraseña actual es incorrecta.', 'error');
        return;
    }

    await saveAuthConfig(newPassword);
    clearSensitiveInputs();
    setStatus('Contraseña actualizada correctamente.', 'success');
}

function lockAdmin() {
    dom.adminApp.hidden = true;
    dom.authGate.hidden = false;
}

async function unlockAdmin() {
    dom.authGate.hidden = true;
    dom.adminApp.hidden = false;
    await loadPublishedContent();
}

function getAuthConfig() {
    try {
        const rawConfig = window.localStorage.getItem(AUTH_CONFIG_KEY);
        if (!rawConfig) {
            return null;
        }

        const parsedConfig = JSON.parse(rawConfig);
        if (!parsedConfig.passwordHash || !parsedConfig.salt) {
            return null;
        }

        return parsedConfig;
    } catch (error) {
        console.warn('No se pudo leer la configuracion del admin.', error);
        return null;
    }
}

async function saveAuthConfig(password) {
    const salt = generateSalt();
    const passwordHash = await hashSecret(password, salt);
    window.localStorage.setItem(AUTH_CONFIG_KEY, JSON.stringify({ salt, passwordHash }));
    setAuthMode('login');
}

function hasActiveSession() {
    return window.sessionStorage.getItem(AUTH_SESSION_KEY) === 'true';
}

function setActiveSession() {
    window.sessionStorage.setItem(AUTH_SESSION_KEY, 'true');
}

function clearActiveSession() {
    window.sessionStorage.removeItem(AUTH_SESSION_KEY);
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

    if (!dom.rememberToken.checked) {
        dom.githubToken.value = '';
    }
}

async function hashSecret(value, salt) {
    const encoder = new TextEncoder();
    const data = encoder.encode(`${salt}:${value}`);
    const digest = await window.crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function generateSalt() {
    const randomArray = new Uint8Array(16);
    window.crypto.getRandomValues(randomArray);
    return Array.from(randomArray).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function loadPublishedContent() {
    setStatus('Cargando contenido publicado...', 'warning');

    try {
        const response = await fetch(ADMIN_CONTENT_URL, { cache: 'no-store' });
        if (!response.ok) {
            throw new Error(`No se pudo leer el archivo publicado (${response.status}).`);
        }

        const content = await response.json();
        const serialized = `${JSON.stringify(content, null, 2)}\n`;
        dom.contentEditor.value = serialized;
        hasUnsavedChanges = false;
        refreshDraftButton();
        setStatus('Contenido publicado cargado.', 'success');
    } catch (error) {
        console.error(error);
        setStatus(error.message || 'No se pudo cargar el contenido publicado.', 'error');
    }
}

function parseEditorContent() {
    const rawContent = dom.contentEditor.value.trim();
    if (!rawContent) {
        throw new Error('El editor esta vacio.');
    }

    let parsedContent;
    try {
        parsedContent = JSON.parse(rawContent);
    } catch (error) {
        throw new Error(`JSON inválido: ${error.message}`);
    }

    validateContentShape(parsedContent);
    return parsedContent;
}

function validateContentShape(content) {
    if (content.translations) {
        if (!Array.isArray(content.languages) || !content.languages.length) {
            throw new Error('languages debe ser un arreglo con al menos un idioma.');
        }

        if (!content.defaultLanguage || typeof content.defaultLanguage !== 'string') {
            throw new Error('defaultLanguage es obligatorio.');
        }

        if (typeof content.translations !== 'object') {
            throw new Error('translations debe ser un objeto.');
        }

        content.languages.forEach((language) => {
            if (!content.translations[language]) {
                throw new Error(`Falta la traducción para "${language}".`);
            }

            validateTranslationShape(content.translations[language], language);
        });

        return;
    }

    validateTranslationShape(content);
}

function validateTranslationShape(content, language = 'base') {
    const requiredKeys = ['site', 'nav', 'hero', 'about', 'work', 'stack', 'projects', 'education', 'approach', 'contact', 'footer'];

    requiredKeys.forEach((key) => {
        if (!content[key] || typeof content[key] !== 'object') {
            throw new Error(`Falta la sección obligatoria "${key}" en ${language}.`);
        }
    });

    if (!Array.isArray(content.hero.actions)) {
        throw new Error(`hero.actions debe ser un arreglo en ${language}.`);
    }

    if (!Array.isArray(content.hero.focus)) {
        throw new Error(`hero.focus debe ser un arreglo en ${language}.`);
    }

    if (!Array.isArray(content.hero.signals)) {
        throw new Error(`hero.signals debe ser un arreglo en ${language}.`);
    }

    if (!Array.isArray(content.about.paragraphs)) {
        throw new Error(`about.paragraphs debe ser un arreglo en ${language}.`);
    }

    if (!Array.isArray(content.about.highlights)) {
        throw new Error(`about.highlights debe ser un arreglo en ${language}.`);
    }

    if (!Array.isArray(content.about.growthInterests)) {
        throw new Error(`about.growthInterests debe ser un arreglo en ${language}.`);
    }

    if (!Array.isArray(content.work.items)) {
        throw new Error(`work.items debe ser un arreglo en ${language}.`);
    }

    if (!Array.isArray(content.stack.groups)) {
        throw new Error(`stack.groups debe ser un arreglo en ${language}.`);
    }

    if (!Array.isArray(content.projects.items)) {
        throw new Error(`projects.items debe ser un arreglo en ${language}.`);
    }

    if (!Array.isArray(content.education.items)) {
        throw new Error(`education.items debe ser un arreglo en ${language}.`);
    }

    if (!Array.isArray(content.approach.items)) {
        throw new Error(`approach.items debe ser un arreglo en ${language}.`);
    }

    if (!Array.isArray(content.contact.links)) {
        throw new Error(`contact.links debe ser un arreglo en ${language}.`);
    }

    if (!content.contact.fields || typeof content.contact.fields !== 'object') {
        throw new Error(`contact.fields es obligatorio en ${language}.`);
    }
}

function saveDraft() {
    window.localStorage.setItem(DRAFT_STORAGE_KEY, dom.contentEditor.value);
    refreshDraftButton();
}

function restoreDraft() {
    const draft = window.localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!draft) {
        setStatus('No hay borrador guardado en este navegador.', 'warning');
        refreshDraftButton();
        return;
    }

    dom.contentEditor.value = draft;
    hasUnsavedChanges = true;
    refreshDraftButton();
    setStatus('Borrador restaurado.', 'success');
}

function refreshDraftButton() {
    dom.restoreDraft.disabled = !window.localStorage.getItem(DRAFT_STORAGE_KEY);
}

function downloadJson() {
    try {
        const content = parseEditorContent();
        const serialized = `${JSON.stringify(content, null, 2)}\n`;
        const blob = new Blob([serialized], { type: 'application/json' });
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = objectUrl;
        link.download = 'site-content.json';
        link.click();
        URL.revokeObjectURL(objectUrl);
        setStatus('JSON descargado correctamente.', 'success');
    } catch (error) {
        setStatus(error.message, 'error');
    }
}

async function publishContent() {
    const token = dom.githubToken.value.trim();
    if (!token) {
        setStatus('Necesitas pegar un GitHub token para publicar.', 'error');
        return;
    }

    let serializedContent = '';

    try {
        const content = parseEditorContent();
        serializedContent = `${JSON.stringify(content, null, 2)}\n`;
    } catch (error) {
        setStatus(error.message, 'error');
        return;
    }

    setStatus('Publicando cambios en GitHub...', 'warning');

    try {
        const currentFile = await fetchGithubFile(token);
        const response = await fetch(buildGithubContentUrl(), {
            method: 'PUT',
            headers: buildGithubHeaders(token),
            body: JSON.stringify({
                message: 'Update portfolio content',
                content: toBase64(serializedContent),
                sha: currentFile.sha,
                branch: GITHUB_BRANCH
            })
        });

        if (!response.ok) {
            throw new Error(await readGithubError(response));
        }

        const result = await response.json();
        hasUnsavedChanges = false;
        window.localStorage.removeItem(DRAFT_STORAGE_KEY);
        refreshDraftButton();
        setStatus(`Cambios publicados. Commit ${result.commit.sha.slice(0, 7)} creado en ${GITHUB_BRANCH}.`, 'success');
    } catch (error) {
        console.error(error);
        setStatus(error.message || 'No se pudieron publicar los cambios.', 'error');
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
        dom.rememberToken.checked = false;
        return;
    }

    dom.githubToken.value = savedToken;
    dom.rememberToken.checked = true;
}

function toBase64(value) {
    const encoded = new TextEncoder().encode(value);
    let binary = '';
    encoded.forEach((byte) => {
        binary += String.fromCharCode(byte);
    });
    return window.btoa(binary);
}

function setAuthStatus(message, type = 'info') {
    setStatusElement(dom.authStatus, message, type);
}

function setStatus(message, type = 'info') {
    setStatusElement(dom.status, message, type);
}

function setStatusElement(element, message, type = 'info') {
    if (!element) {
        return;
    }

    element.textContent = message;
    element.className = 'admin-status';

    if (type === 'success') {
        element.classList.add('is-success');
    }

    if (type === 'warning') {
        element.classList.add('is-warning');
    }

    if (type === 'error') {
        element.classList.add('is-error');
    }
}
