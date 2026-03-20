/**
 * Страница настройки 2FA (auth-2fa-setup.html)
 */
import './config/api-config-loader.js';
import { setup2FA, confirm2FASetup, getAuth2faPending, completeLoginFrom2faPending, mark2faSetupComplete } from './auth-2fa.js';

function init2FASetupPage() {
  const submitBtn = document.getElementById('submitBtn');
  const cancelBtn = document.querySelector('a.btn.btn--secondary[href="/src/pages/auth.html"]');
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
  let loadingQr = false;

  function renderQrImage(primaryUrl, fallbackUrl) {
    if (!qrPlaceholder) return;
    const img = document.createElement('img');
    img.alt = 'QR-код для сканирования';
    img.width = 200;
    img.height = 200;
    img.style.borderRadius = '8px';
    img.referrerPolicy = 'no-referrer';
    img.src = primaryUrl;
    img.onerror = function () {
      if (fallbackUrl && img.src !== fallbackUrl) {
        img.src = fallbackUrl;
        return;
      }
      qrPlaceholder.innerHTML =
        '<div class="qr-placeholder__inner"><span class="qr-placeholder__text">QR не загрузился. Используйте секретный ключ ниже или нажмите «Повторить загрузку QR».</span></div>';
    };
    qrPlaceholder.innerHTML = '';
    qrPlaceholder.appendChild(img);
  }

  function showQrUnavailable(message) {
    if (!qrPlaceholder) return;
    qrPlaceholder.innerHTML =
      '<div class="qr-placeholder__inner"><span class="qr-placeholder__text">' + message + '</span></div>';
  }

  function loadQrData() {
    if (loadingQr) return;
    loadingQr = true;
    setup2FA().then(function (data) {
      currentSecret = data.secret;
      if (qrPlaceholder && data.qrSvg) {
        qrPlaceholder.innerHTML = data.qrSvg;
      } else if (data.qrDataUrl) {
        renderQrImage(data.qrDataUrl, '');
      } else if (data.qrImageUrl) {
        renderQrImage(data.qrImageUrl, data.qrImageUrlFallback || '');
      } else if (qrPlaceholder) {
        showQrUnavailable('QR недоступен. Используйте секретный ключ ниже.');
      }
      if (manualSecret && data.secret) {
        manualSecret.value = data.secret;
      }
      if (codeConfirmGroup) codeConfirmGroup.style.display = 'block';
    }).catch(function (err) {
      if (qrPlaceholder) {
        const inner = qrPlaceholder.querySelector('.qr-placeholder__inner');
        if (inner) {
          const text = inner.querySelector('.qr-placeholder__text');
          if (text) text.textContent = (err && err.message) ? err.message : 'Ошибка загрузки. Повторите попытку.';
        }
      }
    }).finally(function () {
      loadingQr = false;
    });
  }

  // Если пришли с логина — обновить заголовок
  if (getAuth2faPending()) {
    const subtitle = document.querySelector('.brand__subtitle');
    const intro = document.querySelector('.setup-2fa__intro');
    if (subtitle) subtitle.textContent = 'Подтвердите вход: отсканируйте QR-код и введите код из приложения';
    if (intro) intro.textContent = 'Отсканируйте QR-код в Google Authenticator или другом приложении, затем введите 6-значный код для завершения входа.';
  }

  // Загрузка QR и secret при открытии страницы
  loadQrData();

  const retryQrBtn = document.getElementById('retryQrBtn');
  if (retryQrBtn) {
    retryQrBtn.addEventListener('click', function () {
      loadQrData();
    });
  }

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
          if (pending && !pending.isApi) {
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

  // Горячие клавиши:
  // Enter -> завершить настройку
  // Esc -> отмена и возврат на страницу входа
  // Alt+R -> повторить загрузку QR
  document.addEventListener('keydown', function (e) {
    if (e.isComposing) return;
    if (e.repeat) return;
    const target = e.target;
    const isTextInput = !!(target && (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable
    ));

    if (e.key === 'Enter') {
      // Enter обрабатываем только в поле кода 2FA.
      if (target !== setupCodeInput) return;
      e.preventDefault();
      submitBtn?.click();
      return;
    }

    if (e.key === 'Escape') {
      // Не перехватываем Esc во время ввода текста.
      if (isTextInput) return;
      e.preventDefault();
      if (cancelBtn) {
        window.location.href = cancelBtn.getAttribute('href') || '/src/pages/auth.html';
      } else {
        window.location.href = '/src/pages/auth.html';
      }
      return;
    }

    if (e.altKey && !e.ctrlKey && !e.shiftKey && (e.key === 'r' || e.key === 'R' || e.key === 'к' || e.key === 'К')) {
      if (isTextInput) return;
      e.preventDefault();
      retryQrBtn?.click();
    }
  });
}

let setupPageInitialized = false;
function bootstrap2FASetupPage() {
  if (setupPageInitialized) return;
  setupPageInitialized = true;
  init2FASetupPage();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap2FASetupPage, { once: true });
}
bootstrap2FASetupPage();
