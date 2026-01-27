// common-ui.js
// Общий модуль для UI-функций, используемых на всех страницах
// Включает: auth-ui, theme, tooltips, help menu

(function() {
  'use strict';

  // ===== АУТЕНТИФИКАЦИЯ =====
  // Основано на modules/business/auth.js

  function safeLogout() {
    try {
      const role = localStorage.getItem('role') || '';
      if (typeof window.appendAdminAudit === 'function') {
        window.appendAdminAudit('logout', `Выход из системы${role ? ` (${role})` : ''}`);
      }
    } catch (err) {}
    try { localStorage.removeItem('isLoggedIn'); } catch (_) {}
    try { localStorage.removeItem('username'); } catch (_) {}
    try { localStorage.removeItem('userName'); } catch (_) {}
    try { localStorage.removeItem('role'); } catch (_) {}
  }

  function checkArchitectRole() {
    const role = localStorage.getItem("role");
    // Архитекторы, админы, директоры и РП имеют права на редактирование
    return role === "architect" || role === "admin" || role === "director" || role === "project_manager";
  }

  function renderAuth() {
    // Guard: предотвращаем бесконечную рекурсию
    if (renderAuth._calling) {
      if (window.Logger) window.Logger.warn('renderAuth: предотвращена рекурсия');
      return;
    }
    renderAuth._calling = true;
    try {
      const authInfo = document.getElementById("authInfo");
      const logoutContainer = document.getElementById("logoutContainer");
      if (!authInfo || !logoutContainer) {
        renderAuth._calling = false;
        return;
      }

    const role = localStorage.getItem("role");
    const exportPdfBtn = document.getElementById("exportPdfBtn");
    const editBtn = document.getElementById("editTechBtn");
    const deleteBtn = document.getElementById("deleteTechBtn");
    const addTechBtn = document.getElementById("addTechBtn");
    const reportIconBtn = document.getElementById("reportIconBtn");
    const addIconBtn = document.getElementById("addIconBtn");

    const setButtonsVisibility = (visible) => {
      if (addTechBtn) {
        addTechBtn.style.display = visible ? "flex" : "none";
        addTechBtn.classList.toggle("hidden", !visible);
      }
      if (exportPdfBtn) exportPdfBtn.style.display = "flex";
      if (editBtn) editBtn.style.display = visible ? "inline-flex" : "none";
      if (deleteBtn) deleteBtn.style.display = visible ? "inline-flex" : "none";
      if (reportIconBtn) {
        reportIconBtn.style.display = visible ? "flex" : "none";
        reportIconBtn.classList.toggle("hidden", !visible);
      }
      if (addIconBtn) {
        addIconBtn.style.display = visible ? "flex" : "none";
        addIconBtn.classList.toggle("hidden", !visible);
      }
    };

    document.body.classList.remove('not-authorized');

    if (role === "architect") {
      authInfo.innerHTML = `<div class="user-role architect-role">Архитектор</div>`;
      logoutContainer.innerHTML = `<button class="logout" data-tooltip="Выйти" aria-label="Выйти">
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16,17 21,12 16,7"/>
      <line x1="21" y1="12" x2="9" y2="12" stroke-dasharray="100"/>
    </svg>
  </button>`;
      setButtonsVisibility(true);
      logoutContainer.querySelector(".logout").onclick = () => {
        safeLogout();
        window.location.href = 'auth.html';
      };
    } else if (role === "admin") {
      authInfo.innerHTML = `<div class="user-role admin-role" data-tooltip="Перейти в админ-панель" style="cursor: pointer;">Администратор</div>`;
      logoutContainer.innerHTML = `<button class="logout" data-tooltip="Выйти" aria-label="Выйти">
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16,17 21,12 16,7"/>
      <line x1="21" y1="12" x2="9" y2="12" stroke-dasharray="100"/>
    </svg>
  </button>`;
      setButtonsVisibility(true);
      const adminRoleElement = authInfo.querySelector('.admin-role');
      if (adminRoleElement) {
        adminRoleElement.onclick = () => window.location.href = 'admin.html';
      }
      logoutContainer.querySelector(".logout").onclick = () => {
        safeLogout();
        location.reload();
      };
      // Показываем кнопку переключения между страницами для админа
      const switchViewBtn = document.getElementById('switchViewBtn');
      if (switchViewBtn) {
        switchViewBtn.style.display = 'flex';
        const isRMKDirectorPage = document.body.id === 'rmk-director' ||
                                   window.location.pathname.includes('RMK-director.html') ||
                                   window.location.href.includes('RMK-director.html');
        if (isRMKDirectorPage) {
          switchViewBtn.setAttribute('data-tooltip', 'Переключить на страницу для архитекторов');
          switchViewBtn.setAttribute('aria-label', 'Переключить на страницу для архитекторов');
          // Кнопка переключения между страницами больше не нужна - все работают на RMK-director.html
          // Оставляем для обратной совместимости, но редирект теперь не требуется
          switchViewBtn.onclick = () => {
            const selectedEnterprise = localStorage.getItem('selectedEnterprise');
            if (selectedEnterprise) {
              sessionStorage.setItem('silentEnterpriseNav', '1');
            }
            window.location.href = 'RMK-director.html';
          };
        } else {
          switchViewBtn.setAttribute('data-tooltip', 'Переключить на страницу для директоров');
          switchViewBtn.setAttribute('aria-label', 'Переключить на страницу для директоров');
          switchViewBtn.onclick = () => {
            const selectedEnterprise = localStorage.getItem('selectedEnterprise');
            if (selectedEnterprise) {
              sessionStorage.setItem('silentEnterpriseNav', '1');
            }
            window.location.href = 'RMK-director.html';
          };
        }
      }
    } else if (role === "director" || role === "project_manager") {
      authInfo.innerHTML = `<div class="user-role ${role === "director" ? "director-role" : "project-manager-role"}">${role === "director" ? "Директор" : "Руководитель проекта"}</div>`;
      logoutContainer.innerHTML = `<button class="logout" data-tooltip="Выйти" aria-label="Выйти">
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16,17 21,12 16,7"/>
      <line x1="21" y1="12" x2="9" y2="12" stroke-dasharray="100"/>
    </svg>
  </button>`;
      // Директоры и РП теперь имеют доступ к добавлению/редактированию/удалению технологий и экспорту
      setButtonsVisibility(true);
      logoutContainer.querySelector(".logout").onclick = () => {
        safeLogout();
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
      logoutContainer.querySelector(".login").onclick = () => {
        window.location.href = "auth.html";
      };
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
      if (window.Logger) window.Logger.debug('Theme уже инициализирован, пропускаем повторную инициализацию');
      return;
    }
    window.__themeInitialized = true;

    const themeToggle = document.getElementById("themeToggle");
    if (!themeToggle) return;

    // ВАЖНО: index.html стартует с <body class="dark">, поэтому если theme не сохранена,
    // нельзя по умолчанию считать "light" — иначе переключатель и фактическая тема расходятся.
    let savedTheme = null;
    try {
      savedTheme = localStorage.getItem("theme");
    } catch (_) {}

    if (!savedTheme) {
      savedTheme = document.body.classList.contains("dark") ? "dark" : "light";
      try {
        localStorage.setItem("theme", savedTheme);
      } catch (_) {}
    }

    const isDark = savedTheme === "dark";
    // Убеждаемся, что есть правильный класс для темы
    document.body.classList.remove("light", "dark");
    document.body.classList.add(isDark ? "dark" : "light");
    themeToggle.checked = isDark;

    themeToggle.addEventListener("change", (e) => {
      e.stopPropagation(); // Останавливаем всплытие события
      const isDarkNow = themeToggle.checked;
      // Убираем оба класса и добавляем нужный
      document.body.classList.remove("light", "dark");
      document.body.classList.add(isDarkNow ? "dark" : "light");
      const newTheme = isDarkNow ? "dark" : "light";
      localStorage.setItem("theme", newTheme);
    });
    // Также обрабатываем клик на label или обертку переключателя темы
    themeToggle.addEventListener("click", (e) => {
      e.stopPropagation(); // Останавливаем всплытие события
    });
  }

  // ===== HELP MENU =====
  // Основано на modules/core/app-init.js

  function showHelpMenu(button) {
    // Проверяем, находимся ли мы на странице радара (RMK-director.html или RMK.html для обратной совместимости)
    const isRMKPage = window.location.pathname.includes('RMK-director.html') || window.location.pathname.includes('RMK.html') || window.location.href.includes('RMK-director.html') || window.location.href.includes('RMK.html');

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

      tourBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        menu.remove();
        if (window.OnboardingTour && typeof window.OnboardingTour.startTour === 'function') {
          window.OnboardingTour.startTour();
        } else {
          if (window.Logger) window.Logger.warn('OnboardingTour модуль не загружен');
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
      if (window.Logger) window.Logger.debug('Help button уже инициализирован, пропускаем повторную инициализацию');
      return;
    }
    window.__helpButtonInitialized = true;

    const helpBtn = document.getElementById('helpBtn');
    if (!helpBtn) return;

    helpBtn.addEventListener('click', function() {
      showHelpMenu(helpBtn);
    });
  }

  // ===== ИНИЦИАЛИЗАЦИЯ =====

  function initCommonUI() {
    initTheme();
    initHelpButton();
    renderAuth();
  }

  // Экспорт в window для обратной совместимости
  if (typeof window !== 'undefined') {
    window.CommonUI = {
      renderAuth,
      checkArchitectRole,
      safeLogout,
      initTheme,
      showHelpMenu,
      initHelpButton,
      initCommonUI
    };

    // Экспорт отдельных функций для обратной совместимости
    window.renderAuth = renderAuth;
    window.checkArchitectRole = checkArchitectRole;
    window.safeLogout = safeLogout;
    window.showHelpMenu = showHelpMenu;

    // Автоматическая инициализация при загрузке DOM
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initCommonUI);
    } else {
      initCommonUI();
    }
  }
})();
