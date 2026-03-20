// common-ui.js — ES module
// Общий UI: auth-ui, theme, tooltips, help menu

import Logger from '../core/logger.js';

const COOKIE_NOTICE_STORAGE_KEY = 'rtp3_cookie_notice_ack_v1';

// ===== АУТЕНТИФИКАЦИЯ =====
// Основано на modules/business/auth.js; единый выход — AuthModule.safeLogout / clearAuthFromStorage

async function safeLogout() {
  if (
    typeof window.AuthModule !== 'undefined' &&
    typeof window.AuthModule.safeLogout === 'function'
  ) {
    await window.AuthModule.safeLogout();
  } else if (typeof window.clearAuthFromStorage === 'function') {
    window.clearAuthFromStorage();
  } else {
    try {
      localStorage.removeItem('isLoggedIn');
    } catch (_) {}
    try {
      localStorage.removeItem('username');
    } catch (_) {}
    try {
      localStorage.removeItem('userName');
    } catch (_) {}
    try {
      localStorage.removeItem('role');
    } catch (_) {}
  }
}

function getRoleApi() {
  return window.RoleCapabilities || window.RolesConfig || null;
}

function isMockAuthFallbackAllowed() {
  const apiConfig = typeof window !== 'undefined' ? window.ApiConfig || null : null;
  if (apiConfig && typeof apiConfig.getUseApi === 'function') {
    return apiConfig.getUseApi() !== true;
  }
  return true;
}

function getNormalizedRole() {
  if (window.AuthModule && typeof window.AuthModule.getCurrentRole === 'function') {
    return window.AuthModule.getCurrentRole();
  }
  const roleApi = getRoleApi();
  if (roleApi && typeof roleApi.getCurrentRole === 'function') return roleApi.getCurrentRole();
  if (!isMockAuthFallbackAllowed()) return '';
  if (roleApi && typeof roleApi.normalizeRole === 'function')
    return roleApi.normalizeRole(localStorage.getItem('role'));
  return String(localStorage.getItem('role') || '')
    .trim()
    .toLowerCase();
}

function checkArchitectRole() {
  const roleApi = getRoleApi();
  if (roleApi && typeof roleApi.canManageTechnologies === 'function')
    return roleApi.canManageTechnologies();
  if (roleApi && typeof roleApi.hasCapability === 'function')
    return roleApi.hasCapability('manage_technologies');
  return false;
}

function renderAuth() {
  // Guard: предотвращаем бесконечную рекурсию
  if (renderAuth._calling) {
    Logger.warn('renderAuth: предотвращена рекурсия');
    return;
  }
  renderAuth._calling = true;
  try {
    const authInfo = document.getElementById('authInfo');
    const logoutContainer = document.getElementById('logoutContainer');
    if (!authInfo || !logoutContainer) {
      renderAuth._calling = false;
      return;
    }

    const roleApi = getRoleApi();
    const role = getNormalizedRole();
    const allowMockAuthFallback = isMockAuthFallbackAllowed();
    const isAuthenticated =
      window.AuthModule && typeof window.AuthModule.isAuthenticated === 'function'
        ? window.AuthModule.isAuthenticated()
        : allowMockAuthFallback &&
          (localStorage.getItem('isLoggedIn') === 'true' ||
            !!(localStorage.getItem('username') || localStorage.getItem('userName') || '').trim());
    const canManageTechnologies =
      roleApi && typeof roleApi.hasCapability === 'function'
        ? roleApi.hasCapability('manage_technologies', role)
        : checkArchitectRole();
    const canSubmitTechnologyChanges =
      roleApi && typeof roleApi.canSubmitTechnologyChanges === 'function'
        ? roleApi.canSubmitTechnologyChanges(role)
        : canManageTechnologies;
    const canExportReports =
      roleApi && typeof roleApi.hasCapability === 'function'
        ? roleApi.hasCapability('export_reports', role)
        : true;
    const canAccessAdminPanel =
      roleApi && typeof roleApi.canAccessAdminPanel === 'function'
        ? roleApi.canAccessAdminPanel(role)
        : role === 'admin';
    const canOpenProposalPanel =
      roleApi && typeof roleApi.hasCapability === 'function'
        ? roleApi.hasCapability('create_proposals', role) ||
          roleApi.hasCapability('review_proposals', role)
        : false;
    const roleLabel =
      roleApi && typeof roleApi.getRoleLabel === 'function' ? roleApi.getRoleLabel(role) : role;
    const exportPdfBtn = document.getElementById('exportPdfBtn');
    const editBtn = document.getElementById('editTechBtn');
    const deleteBtn = document.getElementById('deleteTechBtn');
    const addTechBtn = document.getElementById('addTechBtn');
    const reportIconBtn = document.getElementById('reportIconBtn');
    const addIconBtn = document.getElementById('addIconBtn');
    const proposalBtn = document.getElementById('proposalIconBtn');

    const setButtonsVisibility = (visible) => {
      if (addTechBtn) {
        addTechBtn.style.display = visible ? 'flex' : 'none';
        addTechBtn.classList.toggle('hidden', !visible);
      }
      if (exportPdfBtn) exportPdfBtn.style.display = canExportReports ? 'flex' : 'none';
      if (editBtn) editBtn.style.display = visible ? 'inline-flex' : 'none';
      if (deleteBtn) deleteBtn.style.display = visible ? 'inline-flex' : 'none';
      if (reportIconBtn) {
        reportIconBtn.style.display = canExportReports ? 'flex' : 'none';
        reportIconBtn.classList.toggle('hidden', !canExportReports);
      }
      if (addIconBtn) {
        addIconBtn.style.display = visible ? 'flex' : 'none';
        addIconBtn.classList.toggle('hidden', !visible);
      }
      if (proposalBtn) {
        proposalBtn.style.display = canOpenProposalPanel ? 'flex' : 'none';
        proposalBtn.classList.toggle('hidden', !canOpenProposalPanel);
      }
    };

    document.body.classList.remove('not-authorized');

    if (canManageTechnologies && role !== 'admin') {
      authInfo.innerHTML = `<div class="user-role architect-role">${roleLabel}</div>`;
      logoutContainer.innerHTML = `<button class="logout" data-tooltip="Выйти" aria-label="Выйти">
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16,17 21,12 16,7"/>
      <line x1="21" y1="12" x2="9" y2="12" stroke-dasharray="100"/>
    </svg>
  </button>`;
      setButtonsVisibility(canSubmitTechnologyChanges);
      logoutContainer.querySelector('.logout').onclick = async () => {
        await safeLogout();
        window.location.href = '/src/pages/auth.html';
      };
    } else if (canAccessAdminPanel) {
      authInfo.innerHTML = `<div class="user-role admin-role" data-tooltip="Перейти в админ-панель" style="cursor: pointer;">Администратор</div>`;
      logoutContainer.innerHTML = `<button class="logout" data-tooltip="Выйти" aria-label="Выйти">
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16,17 21,12 16,7"/>
      <line x1="21" y1="12" x2="9" y2="12" stroke-dasharray="100"/>
    </svg>
  </button>`;
      setButtonsVisibility(canSubmitTechnologyChanges);
      const adminRoleElement = authInfo.querySelector('.admin-role');
      if (adminRoleElement) {
        adminRoleElement.onclick = () => {
          try {
            sessionStorage.setItem('rmk_admin_nav_ts', String(Date.now()));
          } catch (_) {}
          window.location.href = '/src/pages/admin.html';
        };
      }
      logoutContainer.querySelector('.logout').onclick = async () => {
        await safeLogout();
        location.reload();
      };
    } else if (isAuthenticated && (role === 'editor' || role === 'guest')) {
      authInfo.innerHTML = `<div class="user-role">${roleLabel}</div>`;
      logoutContainer.innerHTML = `<button class="logout" data-tooltip="Выйти" aria-label="Выйти">
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16,17 21,12 16,7"/>
      <line x1="21" y1="12" x2="9" y2="12" stroke-dasharray="100"/>
    </svg>
  </button>`;
      setButtonsVisibility(canSubmitTechnologyChanges);
      logoutContainer.querySelector('.logout').onclick = async () => {
        await safeLogout();
        location.reload();
      };
    } else {
      authInfo.innerHTML = ``;
      logoutContainer.innerHTML = `<button class="login" data-tooltip="Войти" aria-label="Войти">
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
      <polyline points="10,17 15,12 10,7"/>
      <line x1="15" y1="12" x2="3" y2="12" stroke-dasharray="100"/>
    </svg>
  </button>`;
      setButtonsVisibility(false);
      document.body.classList.add('not-authorized');
      logoutContainer.querySelector('.login').onclick = () => {
        window.location.href = '/src/pages/auth.html';
      };
    }
    if (window.ModerationFlow && typeof window.ModerationFlow.syncUiState === 'function') {
      window.ModerationFlow.syncUiState();
    }
  } finally {
    renderAuth._calling = false;
  }
}

// ===== ТЕМА =====
// Основано на modules/integration/events.js

function initTheme() {
  // Guard: предотвращаем повторную инициализацию
  if (window.__themeInitialized) {
    Logger.debug('Theme уже инициализирован, пропускаем повторную инициализацию');
    return;
  }
  window.__themeInitialized = true;

  const themeToggle = document.getElementById('themeToggle');
  if (!themeToggle) return;

  // ВАЖНО: index.html стартует с <body class="dark">, поэтому если theme не сохранена,
  // нельзя по умолчанию считать "light" — иначе переключатель и фактическая тема расходятся.
  let savedTheme = null;
  try {
    savedTheme = localStorage.getItem('theme');
  } catch (e) {
    Logger.warn('common-ui: theme localStorage getItem', e);
  }

  if (!savedTheme) {
    savedTheme = document.body.classList.contains('dark') ? 'dark' : 'light';
    try {
      localStorage.setItem('theme', savedTheme);
    } catch (e) {
      Logger.warn('common-ui: theme localStorage setItem', e);
    }
  }

  const isDark = savedTheme === 'dark';
  // Убеждаемся, что есть правильный класс для темы
  document.body.classList.remove('light', 'dark');
  document.body.classList.add(isDark ? 'dark' : 'light');
  themeToggle.checked = isDark;

  themeToggle.addEventListener('change', (e) => {
    e.stopPropagation(); // Останавливаем всплытие события
    const isDarkNow = themeToggle.checked;
    // Убираем оба класса и добавляем нужный
    document.body.classList.remove('light', 'dark');
    document.body.classList.add(isDarkNow ? 'dark' : 'light');
    const newTheme = isDarkNow ? 'dark' : 'light';
    localStorage.setItem('theme', newTheme);
  });
  // Также обрабатываем клик на label или обертку переключателя темы
  themeToggle.addEventListener('click', (e) => {
    e.stopPropagation(); // Останавливаем всплытие события
  });
}

// ===== HELP MENU =====
// Основано на modules/core/app-init.js

function showHelpMenu(button) {
  // Проверяем, находимся ли мы на странице радара (radar.html)
  const isRMKPage =
    window.location.pathname.includes('radar.html') || window.location.href.includes('radar.html');

  // Удаляем существующее меню, если есть
  const existingMenu = document.querySelector('.help-menu');
  if (existingMenu) {
    existingMenu.remove();
  }

  // Создаем выпадающее меню
  const menu = document.createElement('div');
  menu.className = 'help-menu';
  menu.setAttribute('role', 'menu');

  // Создаем элементы меню через createElement (безопаснее)
  if (isRMKPage) {
    const tourBtn = document.createElement('button');
    tourBtn.className = 'help-menu-item';
    tourBtn.setAttribute('data-action', 'tour');
    tourBtn.setAttribute('role', 'menuitem');

    const tourSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    tourSvg.setAttribute('width', '18');
    tourSvg.setAttribute('height', '18');
    tourSvg.setAttribute('viewBox', '0 0 24 24');
    tourSvg.setAttribute('fill', 'none');
    tourSvg.setAttribute('stroke', 'currentColor');
    tourSvg.setAttribute('stroke-width', '2');

    const tourCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    tourCircle.setAttribute('cx', '12');
    tourCircle.setAttribute('cy', '12');
    tourCircle.setAttribute('r', '10');

    const tourPath1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    tourPath1.setAttribute('d', 'M12 16v-4');

    const tourPath2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    tourPath2.setAttribute('d', 'M12 8h.01');

    tourSvg.appendChild(tourCircle);
    tourSvg.appendChild(tourPath1);
    tourSvg.appendChild(tourPath2);

    const tourSpan = document.createElement('span');
    tourSpan.textContent = 'Интерактивный тур';

    tourBtn.appendChild(tourSvg);
    tourBtn.appendChild(tourSpan);

    tourBtn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      menu.remove();
      if (window.OnboardingTour && typeof window.OnboardingTour.startTour === 'function') {
        window.OnboardingTour.startTour();
      } else {
        Logger.warn('OnboardingTour модуль не загружен');
        if (window.Toast) {
          window.Toast.error('Модуль обучения не загружен. Пожалуйста, обновите страницу.');
        } else {
          alert('Модуль обучения не загружен. Пожалуйста, обновите страницу.');
        }
      }
    });

    menu.appendChild(tourBtn);
  }

  const helpLink = document.createElement('a');
  helpLink.href = 'help.html';
  helpLink.className = 'help-menu-item';
  helpLink.setAttribute('role', 'menuitem');

  const helpSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  helpSvg.setAttribute('width', '18');
  helpSvg.setAttribute('height', '18');
  helpSvg.setAttribute('viewBox', '0 0 24 24');
  helpSvg.setAttribute('fill', 'none');
  helpSvg.setAttribute('stroke', 'currentColor');
  helpSvg.setAttribute('stroke-width', '2');

  const helpPath1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  helpPath1.setAttribute('d', 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20');

  const helpPath2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  helpPath2.setAttribute('d', 'M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z');

  helpSvg.appendChild(helpPath1);
  helpSvg.appendChild(helpPath2);

  const helpSpan = document.createElement('span');
  helpSpan.textContent = 'Справка';

  helpLink.appendChild(helpSvg);
  helpLink.appendChild(helpSpan);
  menu.appendChild(helpLink);

  // Позиционируем меню
  const rect = button.getBoundingClientRect();
  menu.style.position = 'fixed';
  menu.style.top = `${rect.bottom + 8}px`;
  menu.style.right = `${window.innerWidth - rect.right}px`;
  menu.style.zIndex = '10001';

  document.body.appendChild(menu);

  // Закрываем меню при клике вне его
  const closeMenu = (e) => {
    if (!menu.contains(e.target) && e.target !== button) {
      menu.remove();
      document.removeEventListener('click', closeMenu);
    }
  };
  setTimeout(() => document.addEventListener('click', closeMenu), 0);
}

function initHelpButton() {
  // Guard: предотвращаем повторную инициализацию
  if (window.__helpButtonInitialized) {
    Logger.debug('Help button уже инициализирован, пропускаем повторную инициализацию');
    return;
  }
  window.__helpButtonInitialized = true;

  const helpBtn = document.getElementById('helpBtn');
  if (!helpBtn) return;

  helpBtn.addEventListener('click', function () {
    showHelpMenu(helpBtn);
  });
}

function hasAcknowledgedCookieNotice() {
  try {
    return localStorage.getItem(COOKIE_NOTICE_STORAGE_KEY) === 'true';
  } catch (e) {
    Logger.warn('common-ui: cookie notice localStorage getItem', e);
    return false;
  }
}

function acknowledgeCookieNotice() {
  try {
    localStorage.setItem(COOKIE_NOTICE_STORAGE_KEY, 'true');
  } catch (e) {
    Logger.warn('common-ui: cookie notice localStorage setItem', e);
  }
}

function hideCookieNotice(notice) {
  if (!notice) return;
  notice.classList.remove('visible');
  notice.classList.add('hiding');
  setTimeout(() => {
    if (notice.parentNode) {
      notice.parentNode.removeChild(notice);
    }
  }, 250);
}

function showCookieNotice() {
  if (typeof document === 'undefined') return;
  if (hasAcknowledgedCookieNotice()) return;
  if (document.getElementById('cookieNoticeBanner')) return;

  const notice = document.createElement('aside');
  notice.id = 'cookieNoticeBanner';
  notice.className = 'cookie-notice';
  notice.setAttribute('role', 'dialog');
  notice.setAttribute('aria-live', 'polite');
  notice.setAttribute('aria-label', 'Уведомление об использовании cookie');

  notice.innerHTML = `
    <div class="cookie-notice__content">
      <div class="cookie-notice__text">
        Приложение использует cookie, как и обычные сайты: для входа в систему, поддержки сессии и корректной работы защищенных функций.
      </div>
      <button type="button" class="cookie-notice__button" aria-label="Подтвердить уведомление">
        Понятно
      </button>
    </div>
  `;

  const acknowledgeBtn = notice.querySelector('.cookie-notice__button');
  if (acknowledgeBtn) {
    acknowledgeBtn.addEventListener('click', () => {
      acknowledgeCookieNotice();
      hideCookieNotice(notice);
    });
  }

  document.body.appendChild(notice);
  requestAnimationFrame(() => {
    notice.classList.add('visible');
  });
}

// ===== ИНИЦИАЛИЗАЦИЯ =====

function initCommonUI() {
  initTheme();
  initHelpButton();
  renderAuth();
  showCookieNotice();
}

const CommonUI = {
  renderAuth,
  checkArchitectRole,
  safeLogout,
  initTheme,
  showHelpMenu,
  initHelpButton,
  showCookieNotice,
  initCommonUI
};

if (typeof window !== 'undefined') {
  window.CommonUI = CommonUI;
  window.renderAuth = renderAuth;
  window.checkArchitectRole = checkArchitectRole;
  window.safeLogout = safeLogout;
  window.showHelpMenu = showHelpMenu;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCommonUI);
  } else {
    initCommonUI();
  }
}

export default CommonUI;
export {
  renderAuth,
  checkArchitectRole,
  safeLogout,
  initTheme,
  showHelpMenu,
  initHelpButton,
  showCookieNotice,
  initCommonUI
};
