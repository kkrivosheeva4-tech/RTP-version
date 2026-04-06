import './config/api-config-loader.js';

function getPendingPasswordChange() {
  try {
    const raw = sessionStorage.getItem('authPasswordChangePending');
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || !data.session_id) return null;
    return data;
  } catch (_) {
    return null;
  }
}

function getApiConfig() {
  return typeof window !== 'undefined' ? window.ApiConfig || null : null;
}

function getApiBaseUrl(pending) {
  if (pending && typeof pending.api_base_url === 'string' && pending.api_base_url.trim()) {
    return pending.api_base_url.trim().replace(/\/$/, '');
  }
  const cfg = getApiConfig();
  if (cfg && typeof cfg.getBaseUrl === 'function') {
    const url = String(cfg.getBaseUrl() || '').trim();
    if (url) return url.replace(/\/$/, '');
  }
  return '';
}

function isRefreshCookieMode() {
  const cfg = getApiConfig();
  if (!cfg || typeof cfg.getUseRefreshCookieAuth !== 'function') return true;
  return cfg.getUseRefreshCookieAuth() === true;
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

function storeApiTokens(accessToken, refreshToken) {
  void refreshToken;
  if (window.ApiClient && typeof window.ApiClient.setAccessToken === 'function') {
    window.ApiClient.setAccessToken(accessToken);
  }
  const tokenKey = getTokenKey();
  const refreshKey = getRefreshTokenKey();
  try {
    localStorage.removeItem(tokenKey);
    localStorage.removeItem(refreshKey);
    sessionStorage.setItem(tokenKey, accessToken);
    sessionStorage.removeItem(refreshKey);
  } catch (_) {}
}

async function apiLoadMe(accessToken, pending) {
  const baseUrl = getApiBaseUrl(pending);
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

async function submitPasswordChange(sessionId, newPassword, confirmPassword, pending) {
  const baseUrl = getApiBaseUrl(pending);
  if (!baseUrl) {
    return { ok: false, error: 'API_BASE_URL не задан' };
  }
  const useRefreshCookieAuth = isRefreshCookieMode();

  try {
    const response = await fetch(`${baseUrl}/api/v1/auth/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: useRefreshCookieAuth ? 'include' : 'same-origin',
      body: JSON.stringify({
        session_id: sessionId,
        new_password: newPassword,
        new_password_confirm: confirmPassword
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { ok: false, status: response.status, error: data.error || data.detail || 'Не удалось изменить пароль' };
    }
    return { ok: true, status: response.status, data };
  } catch (_) {
    return { ok: false, status: 0, error: 'Сервер недоступен' };
  }
}

function validatePasswordInput(value) {
  const raw = String(value || '');
  if (!raw) return 'Введите новый пароль.';
  if (raw !== raw.trim()) return 'Пароль не должен содержать пробелы в начале или в конце.';
  if (!/^[A-Za-z0-9!@#$%^&*()\-_+=~[\]{}\\:;'\"<>,.?/]{8,20}$/.test(raw)) {
    return 'Пароль должен быть длиной от 8 до 20 символов и содержать только латинские буквы, цифры и допустимые спецсимволы.';
  }
  if (!/[A-Z]/.test(raw) || !/[a-z]/.test(raw) || !/\d/.test(raw)) {
    return 'Пароль должен содержать заглавные и строчные латинские буквы, а также цифры. Спецсимволы разрешены, но не обязательны.';
  }
  return '';
}

function applyTheme() {
  const saved = localStorage.getItem('theme') || 'light';
  const systemDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = saved || (systemDark ? 'dark' : 'light');
  document.body.classList.remove('light', 'dark');
  document.body.classList.add(theme);
  const themeToggleBtn = document.getElementById('themeToggle');
  if (themeToggleBtn) themeToggleBtn.checked = theme === 'dark';
  const sun = document.getElementById('iconSun');
  const moon = document.getElementById('iconMoon');
  if (sun && moon) {
    sun.style.display = theme === 'dark' ? 'none' : 'block';
    moon.style.display = theme === 'dark' ? 'block' : 'none';
  }
}

function bindThemeToggle() {
  const themeToggleBtn = document.getElementById('themeToggle');
  if (!themeToggleBtn) return;
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
      sun.style.display = next === 'dark' ? 'none' : 'block';
      moon.style.display = next === 'dark' ? 'block' : 'none';
    }
  });
}

function setupPasswordToggle(inputId, toggleId, eyeOnId, eyeOffId, showLabel, hideLabel) {
  const input = document.getElementById(inputId);
  const toggle = document.getElementById(toggleId);
  const eyeOn = document.getElementById(eyeOnId);
  const eyeOff = document.getElementById(eyeOffId);
  if (!input || !toggle || !eyeOn || !eyeOff) return;
  toggle.addEventListener('click', () => {
    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';
    toggle.setAttribute('aria-label', isPassword ? hideLabel : showLabel);
    eyeOn.style.display = isPassword ? 'none' : 'block';
    eyeOff.style.display = isPassword ? 'block' : 'none';
  });
}

async function initChangePasswordPage() {
  const pending = getPendingPasswordChange();
  if (!pending) {
    window.location.href = '/auth/login/';
    return;
  }

  applyTheme();
  bindThemeToggle();
  setupPasswordToggle(
    'newPassword',
    'newPasswordToggle',
    'newPasswordEyeOn',
    'newPasswordEyeOff',
    'Показать новый пароль',
    'Скрыть новый пароль'
  );
  setupPasswordToggle(
    'confirmPassword',
    'confirmPasswordToggle',
    'confirmPasswordEyeOn',
    'confirmPasswordEyeOff',
    'Показать подтверждение пароля',
    'Скрыть подтверждение пароля'
  );

  const form = document.getElementById('changePasswordForm');
  const submitBtn = document.getElementById('submitBtn');
  const newPasswordInput = document.getElementById('newPassword');
  const confirmPasswordInput = document.getElementById('confirmPassword');
  const errorEl = document.getElementById('changePasswordError');

  function showError(message) {
    if (!errorEl) return;
    errorEl.textContent = message || '';
    errorEl.style.display = message ? 'block' : 'none';
  }

  if (!form) return;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    showError('');

    const newPassword = String(newPasswordInput?.value || '');
    const confirmPassword = String(confirmPasswordInput?.value || '');
    const passwordError = validatePasswordInput(newPassword);
    if (passwordError) {
      showError(passwordError);
      newPasswordInput?.focus();
      return;
    }
    if (newPassword !== confirmPassword) {
      showError('Пароли не совпадают.');
      confirmPasswordInput?.focus();
      return;
    }

    if (submitBtn) {
      submitBtn.classList.add('loading');
      submitBtn.setAttribute('disabled', 'true');
    }

    const result = await submitPasswordChange(
      pending.session_id,
      newPassword,
      confirmPassword,
      pending
    );

    if (submitBtn) {
      submitBtn.classList.remove('loading');
      submitBtn.removeAttribute('disabled');
    }

    if (!result.ok) {
      showError(result.error || 'Не удалось изменить пароль.');
      return;
    }

    const data = result.data || {};
    try {
      sessionStorage.removeItem('authPasswordChangePending');
    } catch (_) {}

    if (data.requires_2fa && data.session_id) {
      try {
        sessionStorage.setItem('auth2faPending', JSON.stringify({
          username: data.username || pending.username || '',
          role: data.role || pending.role || 'user',
          session_id: data.session_id,
          api_base_url: getApiBaseUrl(pending),
          remember: pending.remember === true,
          isApi: true
        }));
      } catch (_) {}
      window.location.href = data.is_2fa_setup ? '/auth/2fa/verify/' : '/auth/2fa/setup/';
      return;
    }

    if (data.access_token) {
      storeApiTokens(data.access_token, data.refresh_token);
      const me = await apiLoadMe(data.access_token, pending);
      const profile = {
        username: (me && me.username) || pending.username || '',
        role: (me && me.role) || pending.role || 'user',
        is_2fa_enabled: !!(me && me.is_2fa_enabled)
      };
      if (window.AuthModule && typeof window.AuthModule.setAuthSession === 'function') {
        window.AuthModule.setAuthSession(profile, {
          accessToken: data.access_token,
          clearLegacy: true
        });
      }
      window.location.href = '/';
      return;
    }

    showError('Сервер вернул неполный ответ после смены пароля.');
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initChangePasswordPage, { once: true });
} else {
  initChangePasswordPage();
}
