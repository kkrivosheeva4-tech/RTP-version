/**
 * Страница настройки 2FA (auth-2fa-setup.html)
 */
import { setup2FA, confirm2FASetup, getAuth2faPending, completeLoginFrom2faPending, mark2faSetupComplete } from './auth-2fa.js';

document.addEventListener('DOMContentLoaded', function () {
  const submitBtn = document.getElementById('submitBtn');
  const qrPlaceholder = document.getElementById('qrPlaceholder');
  const manualSecret = document.getElementById('manualSecret');
  const codeConfirmGroup = document.getElementById('codeConfirmGroup');
  const setupCodeInput = document.getElementById('setupCode');
  const setupCodeError = document.getElementById('setupCodeError');

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

  function showSetupError(msg) {
    if (setupCodeError) {
      setupCodeError.textContent = msg || '';
      setupCodeError.style.display = msg ? 'block' : 'none';
    }
  }

  let currentSecret = null;

  // Если пришли с логина — обновить заголовок
  if (getAuth2faPending()) {
    const subtitle = document.querySelector('.brand__subtitle');
    const intro = document.querySelector('.setup-2fa__intro');
    if (subtitle) subtitle.textContent = 'Подтвердите вход: отсканируйте QR-код и введите код из приложения';
    if (intro) intro.textContent = 'Отсканируйте QR-код в Google Authenticator или другом приложении, затем введите 6-значный код для завершения входа.';
  }

  // Загрузка QR и secret при открытии страницы
  setup2FA().then(function (data) {
    currentSecret = data.secret;
    if (qrPlaceholder && data.qrDataUrl) {
      qrPlaceholder.innerHTML = '<img src="' + data.qrDataUrl + '" alt="QR-код для сканирования" width="200" height="200" style="border-radius:8px">';
    }
    if (manualSecret && data.secret) {
      manualSecret.value = data.secret;
    }
    if (codeConfirmGroup) codeConfirmGroup.style.display = 'block';
  }).catch(function () {
    if (qrPlaceholder) {
      const inner = qrPlaceholder.querySelector('.qr-placeholder__inner');
      if (inner) {
        const text = inner.querySelector('.qr-placeholder__text');
        if (text) text.textContent = 'Ошибка загрузки. Повторите попытку.';
      }
    }
  });

  // Ограничение ввода кода — только цифры
  if (setupCodeInput) {
    setupCodeInput.addEventListener('input', function (e) {
      e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6);
      showSetupError('');
    });
  }

  // Кнопка «Завершить настройку»
  if (submitBtn) {
    submitBtn.addEventListener('click', function () {
      showSetupError('');
      const code = (setupCodeInput?.value || '').trim();
      if (!/^[0-9]{6}$/.test(code)) {
        showSetupError('Введите 6 цифр из приложения');
        setupCodeInput?.focus();
        return;
      }
      submitBtn.classList.add('loading');
      submitBtn.setAttribute('disabled', 'true');
      confirm2FASetup(code, currentSecret).then(function (result) {
        submitBtn.classList.remove('loading');
        submitBtn.removeAttribute('disabled');
        if (result.success) {
          const pending = getAuth2faPending();
          if (pending) {
            mark2faSetupComplete(pending.username);
            completeLoginFrom2faPending();
          }
          window.location.href = '/src/pages/index.html';
        } else {
          showSetupError(result.error || 'Неверный код');
          setupCodeInput?.focus();
        }
      });
    });
  }
});
