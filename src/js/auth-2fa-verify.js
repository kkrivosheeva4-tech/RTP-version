/**
 * Страница проверки кода 2FA (auth-2fa-verify.html)
 */
import './config/api-config-loader.js';
import { verify2FACode, getAuth2faPending } from './auth-2fa.js';

function init2FAVerifyPage() {
  const codeInput = document.getElementById('code2fa');
  const form = document.getElementById('verify2faForm');
  const submitBtn = document.getElementById('submitBtn');
  const errorEl = document.getElementById('code2faError');

  // Если нет ожидающей 2FA сессии — на страницу входа
  if (!getAuth2faPending()) {
    window.location.href = '/src/pages/auth.html';
    return;
  }

  // Инициализация темы (как на auth.html)
  (function themeInit() {
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

  function showError(msg) {
    if (errorEl) {
      errorEl.textContent = msg || '';
      errorEl.style.display = msg ? 'block' : 'none';
    }
  }

  function validateCode(value) {
    if (!value || value.length !== 6) return false;
    return /^[0-9]{6}$/.test(value);
  }

  // Ввод только цифр
  if (codeInput) {
    codeInput.addEventListener('input', function (e) {
      const v = e.target.value.replace(/\D/g, '');
      e.target.value = v.slice(0, 6);
      showError('');
    });
    codeInput.addEventListener('paste', function (e) {
      e.preventDefault();
      const pasted = (e.clipboardData?.getData('text') || '').replace(/\D/g, '').slice(0, 6);
      codeInput.value = pasted;
      showError('');
    });
  }

  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      showError('');
      const code = (codeInput?.value || '').trim();
      if (!validateCode(code)) {
        showError('Введите 6 цифр из приложения аутентификатора');
        codeInput?.focus();
        return;
      }
      if (submitBtn) {
        submitBtn.classList.add('loading');
        submitBtn.setAttribute('disabled', 'true');
      }
      verify2FACode(code).then(function (result) {
        if (submitBtn) {
          submitBtn.classList.remove('loading');
          submitBtn.removeAttribute('disabled');
        }
        if (result.success) {
          window.location.href = '/src/pages/index.html';
        } else {
          showError(result.error || 'Неверный код');
          codeInput?.focus();
        }
      });
    });
  }
}

let verifyPageInitialized = false;
function bootstrap2FAVerifyPage() {
  if (verifyPageInitialized) return;
  verifyPageInitialized = true;
  init2FAVerifyPage();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap2FAVerifyPage, { once: true });
}
bootstrap2FAVerifyPage();
