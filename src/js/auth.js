// Управление авторизацией (для auth.html)

function pad2(n) {
    const v = Number(n) || 0;
    return v < 10 ? `0${v}` : String(v);
}

function getAuditTimestampLocal() {
    const d = new Date();
    const y = d.getFullYear();
    const m = pad2(d.getMonth() + 1);
    const day = pad2(d.getDate());
    const hh = pad2(d.getHours());
    const mm = pad2(d.getMinutes());
    const ss = pad2(d.getSeconds());
    return `${y}-${m}-${day} ${hh}:${mm}:${ss}`;
}

function getTokenStorageKey() {
    if (typeof window !== 'undefined' && window.ApiConfig && typeof window.ApiConfig.getTokenStorageKey === 'function') {
        return window.ApiConfig.getTokenStorageKey();
    }
    return 'rmk_access_token';
}

function clearLegacyAuthState() {
    try { localStorage.removeItem('isLoggedIn'); } catch (_) {}
    try { localStorage.removeItem('username'); } catch (_) {}
    try { localStorage.removeItem('userName'); } catch (_) {}
    try { localStorage.removeItem('role'); } catch (_) {}
}

function getApiConfig() {
    if (typeof window !== 'undefined' && window.ApiConfig) return window.ApiConfig;
    return null;
}

function isApiAuthEnabled() {
    const cfg = getApiConfig();
    if (!cfg || typeof cfg.getUseApi !== 'function') return true;
    return cfg.getUseApi() === true;
}

function getApiBaseUrl() {
    const cfg = getApiConfig();
    if (cfg && typeof cfg.getBaseUrl === 'function') {
        const url = String(cfg.getBaseUrl() || '').trim();
        if (url) return url.replace(/\/$/, '');
    }
    return '';
}

function getTokenKey() {
    const cfg = getApiConfig();
    if (cfg && typeof cfg.getTokenStorageKey === 'function') return cfg.getTokenStorageKey();
    return 'rmk_access_token';
}

function getRefreshTokenKey() {
    const cfg = getApiConfig();
    if (cfg && typeof cfg.getRefreshTokenStorageKey === 'function') return cfg.getRefreshTokenStorageKey();
    return 'rmk_refresh_token';
}

function isRefreshCookieMode() {
    const cfg = getApiConfig();
    if (!cfg || typeof cfg.getUseRefreshCookieAuth !== 'function') return true;
    return cfg.getUseRefreshCookieAuth() === true;
}

async function apiLogin(username, password) {
    const baseUrl = getApiBaseUrl();
    if (!baseUrl) return { ok: false, error: 'API_BASE_URL не задан' };
    const useRefreshCookieAuth = isRefreshCookieMode();

    try {
        const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: useRefreshCookieAuth ? 'include' : 'same-origin',
            body: JSON.stringify({ username, password })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            return { ok: false, status: response.status, error: data.error || data.detail || 'Ошибка авторизации' };
        }
        return { ok: true, status: response.status, data };
    } catch (e) {
        return { ok: false, status: 0, error: 'Сервер недоступен' };
    }
}

function storeApiTokens(accessToken, refreshToken, remember) {
    void refreshToken;
    void remember;
    if (window.ApiClient && typeof window.ApiClient.setAccessToken === 'function') {
        window.ApiClient.setAccessToken(accessToken);
    }
    const tokenKey = getTokenKey();
    const refreshKey = getRefreshTokenKey();
    const useRefreshCookieAuth = isRefreshCookieMode();
    try {
        localStorage.removeItem(tokenKey);
        localStorage.removeItem(refreshKey);
        sessionStorage.setItem(tokenKey, accessToken);
        sessionStorage.removeItem(refreshKey);
    } catch (_) {}
}

async function apiLoadMe(accessToken) {
    const baseUrl = getApiBaseUrl();
    if (!baseUrl || !accessToken) return null;
    const useRefreshCookieAuth = isRefreshCookieMode();
    try {
        const response = await fetch(`${baseUrl}/api/v1/users/me`, {
            method: 'GET',
            headers: { Authorization: `Bearer ${accessToken}` },
            credentials: useRefreshCookieAuth ? 'include' : 'same-origin'
        });
        if (!response.ok) return null;
        return await response.json().catch(() => null);
    } catch (_) {
        return null;
    }
}

// Проверка состояния авторизации при загрузке
function runAuthInit() {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', runAuthInit);
        return;
    }
    initAuthPage();
}

async function initAuthPage() {
    if (window.AuthModule && typeof window.AuthModule.bootstrapAuthSession === 'function') {
        await window.AuthModule.bootstrapAuthSession();
    }
    if (window.AuthModule && typeof window.AuthModule.isAuthenticated === 'function' && window.AuthModule.isAuthenticated()) {
        try {
            const profile = typeof window.AuthModule.getCurrentProfile === 'function' ? window.AuthModule.getCurrentProfile() : null;
            const role = profile?.role || 'user';
            if (typeof window.appendAdminAudit === 'function') {
                window.appendAdminAudit('login', `Автовход (сессия активна) (${role})`);
            }
        } catch (err) {
            if (window.Logger) window.Logger.warn('Ошибка при логировании автовхода:', err);
        }
        window.location.href = '/';
        return;
    }

    // Если пользователь не авторизован, инициализируем частицы при наличии контейнера
    const particlesContainer = document.getElementById('particles');
    if (particlesContainer && typeof createParticles === 'function') {
        createParticles();
    }

    // Инициализация темы + переключатель (унифицировано с остальными страницами)
    (function themeInit() {
        const saved = localStorage.getItem('theme') || 'light';
        const systemDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        const theme = saved || (systemDark ? 'dark' : 'light');
        // Используем body.light/body.dark вместо data-theme для унификации
        document.body.classList.remove('light', 'dark');
        document.body.classList.add(theme);
        const themeToggleBtn = document.getElementById('themeToggle');
        if (themeToggleBtn) {
            themeToggleBtn.checked = theme === 'dark';
        }
        const sun = document.getElementById('iconSun');
        const moon = document.getElementById('iconMoon');
        if (sun && moon) {
            if (theme === 'dark') { sun.style.display = 'none'; moon.style.display = 'block'; }
            else { sun.style.display = 'block'; moon.style.display = 'none'; }
        }
    })();
    const themeToggleBtn = document.getElementById('themeToggle');
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            const current = document.body.classList.contains('dark') ? 'dark' : 'light';
            const next = current === 'dark' ? 'light' : 'dark';
            document.body.classList.remove('light', 'dark');
            document.body.classList.add(next);
            themeToggleBtn.checked = next === 'dark';
            localStorage.setItem('theme', next);
            const sun = document.getElementById('iconSun');
            const moon = document.getElementById('iconMoon');
            if (sun && moon) {
                if (next === 'dark') { sun.style.display = 'none'; moon.style.display = 'block'; }
                else { sun.style.display = 'block'; moon.style.display = 'none'; }
            }
        });
    }

    // Переключатель видимости пароля
    (function setupPasswordToggle() {
        const input = document.getElementById('password');
        const toggle = document.getElementById('passwordToggle');
        const eyeOn = document.getElementById('eyeOn');
        const eyeOff = document.getElementById('eyeOff');
        if (!input || !toggle || !eyeOn || !eyeOff) return;
        toggle.addEventListener('click', () => {
            const isPwd = input.type === 'password';
            input.type = isPwd ? 'text' : 'password';
            toggle.setAttribute('aria-label', isPwd ? 'Скрыть пароль' : 'Показать пароль');
            eyeOn.style.display = isPwd ? 'none' : 'block';
            eyeOff.style.display = isPwd ? 'block' : 'none';
        });
    })();

    // Обработка формы входа
    const form = document.getElementById('loginForm');
    if (form) {
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            if (!form.checkValidity()) {
                form.reportValidity();
                return;
            }
            const submitBtn = document.getElementById('submitBtn');
            if (submitBtn) {
                submitBtn.classList.add('loading');
                submitBtn.setAttribute('disabled', 'true');
            }

            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            const remember = document.getElementById('remember') ? document.getElementById('remember').checked : false;

            const loginResult = await apiLogin(username, password);
            const cookieMode = isRefreshCookieMode();

            if (
                loginResult.ok &&
                loginResult.data &&
                loginResult.data.access_token
            ) {
                storeApiTokens(loginResult.data.access_token, loginResult.data.refresh_token, remember);

                const me = await apiLoadMe(loginResult.data.access_token);
                const userRole = (me && me.role) || loginResult.data.role || 'user';
                const userName = (me && me.username) || loginResult.data.username || username;
                if (window.AuthModule && typeof window.AuthModule.setAuthSession === 'function') {
                    window.AuthModule.setAuthSession(
                        { username: userName, role: userRole, is_2fa_enabled: true },
                        { accessToken: loginResult.data.access_token, clearLegacy: true }
                    );
                }

                window.location.href = '/';
                return;
            }

            if (loginResult.ok && loginResult.data && loginResult.data.requires_2fa && loginResult.data.session_id) {
                const userRole = loginResult.data.role || 'user';
                const userName = loginResult.data.username || username;
                const is2faSetup = loginResult.data.is_2fa_setup === true;
                try {
                    sessionStorage.setItem('auth2faPending', JSON.stringify({
                        username: userName,
                        role: userRole,
                        session_id: loginResult.data.session_id,
                        api_base_url: getApiBaseUrl(),
                        remember: remember,
                        isApi: true
                    }));
                } catch (err) {
                    if (window.Logger) window.Logger.warn('auth: не удалось сохранить auth2faPending для API', err);
                }
                window.location.href = is2faSetup
                    ? '/auth/2fa/verify/'
                    : '/auth/2fa/setup/';
                return;
            }

            if (submitBtn) {
                submitBtn.classList.remove('loading');
                submitBtn.removeAttribute('disabled');
            }

            showNotification(loginResult.error || 'Ошибка авторизации', 'error');
            return;
        });
    }
}

runAuthInit();

// Создание частиц
function createParticles() {
    const particlesContainer = document.getElementById('particles');
    particlesContainer.innerHTML = '';
    const particleCount = 20;
    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.classList.add('particle');
        const size = Math.random() * 10 + 5;
        const posX = Math.random() * 100;
        const duration = Math.random() * 20 + 10;
        const delay = Math.random() * 5;
        const opacity = Math.random() * 0.5 + 0.1;
        particle.style.width = `${size}px`;
        particle.style.height = `${size}px`;
        particle.style.left = `${posX}%`;
        particle.style.bottom = `-${size}px`;
        particle.style.animationDuration = `${duration}s`;
        particle.style.animationDelay = `${delay}s`;
        particle.style.opacity = opacity;
        const colors = ['#c0c0c0', '#b87333'];
        particle.style.background = colors[Math.floor(Math.random() * colors.length)];
        particlesContainer.appendChild(particle);
    }
}

// Уведомления
function showNotification(message, type) {
    // Создаем панель уведомлений если её нет
    let panel = document.getElementById('notificationPanel');
    if (!panel) {
        panel = document.createElement('div');
        panel.id = 'notificationPanel';
        panel.className = 'notification-panel';
        document.body.appendChild(panel);
    }

    // Создаем новое уведомление
    const notification = document.createElement('div');
    notification.className = 'notification ' + type;
    notification.textContent = message;

    // Добавляем в начало панели (новые уведомления сверху)
    panel.insertBefore(notification, panel.firstChild);

    // Показываем уведомление
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);

    // Автоматически скрываем через 3 секунды
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}
