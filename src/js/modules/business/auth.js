// auth.js
// Модуль аутентификации и управления ролями пользователей

// Экспорт функций в window для использования в RMK2.js и других модулях
window.AuthModule = (function() {
  'use strict';

  function safeLogout() {
    // Важно: не делаем localStorage.clear(), чтобы не стирать данные админ-панели/настройки.
    try {
      const role = localStorage.getItem('role') || '';
      // Логируем выход из системы
      if (typeof window.appendAdminAudit === 'function') {
        window.appendAdminAudit('logout', `Выход из системы${role ? ` (${role})` : ''}`);
      }
    } catch (err) {}
    try { localStorage.removeItem('isLoggedIn'); } catch (_) {}
    try { localStorage.removeItem('username'); } catch (_) {}
    try { localStorage.removeItem('userName'); } catch (_) {}
    try { localStorage.removeItem('role'); } catch (_) {}
  }

  // ===== ФУНКЦИИ ДЛЯ ПРОВЕРКИ ПРАВ ДОСТУПА =====

  /**
   * Проверяет, имеет ли пользователь права на редактирование (архитектор, администратор, директор, РП)
   * @returns {boolean} - true, если пользователь имеет права на редактирование
   */
  function checkArchitectRole() {
    const role = localStorage.getItem("role");
    // Архитекторы, админы, директоры и РП имеют права на редактирование
    return role === "architect" || role === "admin" || role === "director" || role === "project_manager";
  }

  /**
   * Проверяет, имеет ли пользователь роль директора или руководителя проекта
   * @returns {boolean} - true, если пользователь имеет роль директора или руководителя проекта
   */
  function checkDirectorRole() {
    const role = localStorage.getItem("role");
    return role === "director" || role === "project_manager";
  }

  // ===== ФУНКЦИИ ДЛЯ РЕНДЕРИНГА ИНТЕРФЕЙСА АУТЕНТИФИКАЦИИ =====

  /**
   * Рендерит интерфейс аутентификации в зависимости от роли пользователя
   * Управляет видимостью кнопок и отображением информации о пользователе
   */
  function renderAuth() {
    const authInfo = document.getElementById("authInfo");
    const logoutContainer = document.getElementById("logoutContainer");
    if (!authInfo || !logoutContainer) return;

    const role = localStorage.getItem("role");
    const exportPdfBtn = document.getElementById("exportPdfBtn");
    const editBtn = document.getElementById("editTechBtn");
    const deleteBtn = document.getElementById("deleteTechBtn");
    const addTechBtn = document.getElementById("addTechBtn");

    const setButtonsVisibility = (visible) => {
      // addTech visibility remains role-based
      if (addTechBtn) addTechBtn.style.display = visible ? "flex" : "none";
      // Export button — доступна всем пользователям (не зависит от роли)
      if (exportPdfBtn) exportPdfBtn.style.display = "flex";
      if (editBtn) editBtn.style.display = visible ? "inline-flex" : "none";
      if (deleteBtn) deleteBtn.style.display = visible ? "inline-flex" : "none";
    };

    // Удаляем класс неавторизованного пользователя при наличии роли
    document.body.classList.remove('not-authorized');

    if (role === "architect") {
      authInfo.innerHTML = `<div class="user-role architect-role">Архитектор</div>`;
      logoutContainer.innerHTML = `<button class="logout" data-tooltip="Выйти" aria-label="Выйти">
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16,17 21,12 16,7"/>
      <!-- Добавляем stroke-dasharray сюда -->
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
      <!-- Добавляем stroke-dasharray сюда -->
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
    } else if (role === "director" || role === "project_manager") {
      authInfo.innerHTML = `<div class="user-role ${role === "director" ? "director-role" : "project-manager-role"}">${role === "director" ? "Директор" : "Руководитель проекта"}</div>`;
      logoutContainer.innerHTML = `<button class="logout" data-tooltip="Выйти" aria-label="Выйти">
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16,17 21,12 16,7"/>
      <!-- Добавляем stroke-dasharray сюда -->
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
      <!-- И сюда тоже -->
      <line x1="15" y1="12" x2="3" y2="12" stroke-dasharray="100"/>
    </svg>
  </button>`;
      setButtonsVisibility(false);
      // Добавляем класс для неавторизованных пользователей
      document.body.classList.add('not-authorized');
      logoutContainer.querySelector(".login").onclick = () => {
        window.location.href = "auth.html";
      };
      // Редирект на страницу авторизации, если пользователь не авторизован и находится на странице радара
      const isRadarPage = document.body.id === "rmk-director" || window.location.pathname.includes("radar.html");
      if (isRadarPage) {
        window.location.href = "auth.html";
      }
    }
  }

  // Экспорт функций в window для обратной совместимости
  window.checkArchitectRole = checkArchitectRole;
  window.checkDirectorRole = checkDirectorRole;
  window.renderAuth = renderAuth;

  // Возвращаем объект модуля
  return {
    checkArchitectRole,
    checkDirectorRole,
    renderAuth
  };
})();
