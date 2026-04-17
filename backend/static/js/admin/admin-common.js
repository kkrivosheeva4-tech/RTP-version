/**
 * Общие компоненты админ-панели: хранилище, состояние, модалки, уведомления, кастомные селекты, хелперы.
 * Подключается первым среди админских скриптов.
 */
(function () {
  'use strict';

  const ADMIN_STORAGE = {
    USERS: 'adminUsers',
    AUDIT: 'adminAuditLogs',
    ENTERPRISES: 'adminEnterprises',
    INSTALL_DATE: 'appInstallDate'
  };

  /** Глобальное состояние админки (данные и текущий раздел). Заполняется в admin.js. */
  const AdminState = {
    users: [],
    auditLogs: [],
    enterprises: [],
    currentSection: 'users',
    currentUserId: null,
    currentEnterpriseId: null,
    auditCurrentPage: 1,
    AUDIT_PAGE_SIZE: 30
  };

  const escapeHtml = window.escapeHtml || function (text) {
    if (text == null) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
  };

  function safeJsonParse(raw, fallback) {
    try {
      if (raw == null || raw === '') return fallback;
      const parsed = JSON.parse(raw);
      return parsed == null ? fallback : parsed;
    } catch (_) {
      return fallback;
    }
  }

  function readStorageJson(key, fallback) {
    try {
      return safeJsonParse(localStorage.getItem(key), fallback);
    } catch (_) {
      return fallback;
    }
  }

  function writeStorageJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      if (window.Logger) window.Logger.warn('writeStorageJson failed', key, e);
      return false;
    }
  }

  function ensureInstallDate() {
    let date = null;
    try { date = localStorage.getItem(ADMIN_STORAGE.INSTALL_DATE); } catch (_) { }
    if (!date) {
      date = new Date().toISOString().split('T')[0];
      try { localStorage.setItem(ADMIN_STORAGE.INSTALL_DATE, date); } catch (_) { }
    }
    return date;
  }

  function persistUsers() {
    writeStorageJson(ADMIN_STORAGE.USERS, AdminState.users);
  }

  function persistAuditLogs() {
    writeStorageJson(ADMIN_STORAGE.AUDIT, AdminState.auditLogs);
  }

  function persistEnterprises() {
    writeStorageJson(ADMIN_STORAGE.ENTERPRISES, AdminState.enterprises);
  }

  function getLoggedInUserName() {
    if (window.AuthModule && typeof window.AuthModule.getCurrentUsername === 'function') {
      const username = window.AuthModule.getCurrentUsername();
      if (username) return username;
    }
    return 'system';
  }

  async function safeLogout() {
    if (typeof window.AuthModule !== 'undefined' && typeof window.AuthModule.safeLogout === 'function') {
      await window.AuthModule.safeLogout();
    } else if (typeof window.clearAuthFromStorage === 'function') {
      window.clearAuthFromStorage();
    } else {
      try { localStorage.removeItem('isLoggedIn'); } catch (_) { }
      try { localStorage.removeItem('username'); } catch (_) { }
      try { localStorage.removeItem('userName'); } catch (_) { }
      try { localStorage.removeItem('role'); } catch (_) { }
    }
  }

  function computeBytes(str) {
    try {
      if (typeof TextEncoder !== 'undefined') {
        return new TextEncoder().encode(String(str)).length;
      }
    } catch (_) { }
    return String(str || '').length;
  }

  function formatBytes(bytes) {
    const b = Number(bytes) || 0;
    if (b >= 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(2)} MB`;
    if (b >= 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${b} B`;
  }

  function deepCloneJson(value) {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (_) {
      return null;
    }
  }

  function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU');
  }

  function formatDateTime(dateString) {
    const s = (dateString != null ? String(dateString) : '').trim();
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
    if (m) {
      const d = new Date(
        Number(m[1]),
        Number(m[2]) - 1,
        Number(m[3]),
        Number(m[4]),
        Number(m[5]),
        Number(m[6])
      );
      if (Number.isFinite(d.getTime())) return d.toLocaleString('ru-RU');
      return s;
    }
    const date = new Date(s);
    if (Number.isFinite(date.getTime())) return date.toLocaleString('ru-RU');
    return s;
  }

  function getRoleName(role) {
    if (window.RolesConfig && typeof window.RolesConfig.getRoleLabel === 'function') {
      return window.RolesConfig.getRoleLabel(role);
    }
    return (role != null ? String(role) : '').trim() || 'Пользователь';
  }

  function getRoleClass(role) {
    let normalized = '';
    if (window.RolesConfig && typeof window.RolesConfig.normalizeRole === 'function') {
      normalized = window.RolesConfig.normalizeRole(role);
    } else {
      normalized = (role != null ? String(role) : '').trim().toLowerCase();
    }
    return normalized ? 'status-active' : 'status-inactive';
  }

  function getActionName(action) {
    const actions = {
      'login': 'Вход',
      'logout': 'Выход',
      'create': 'Создание',
      'update': 'Изменение',
      'delete': 'Удаление',
      'export': 'Экспорт',
    };
    return actions[action] || action;
  }

  function getActionClass(action) {
    const classes = {
      'login': 'status-active',
      'logout': 'status-inactive',
      'create': 'status-active',
      'update': 'status-active',
      'delete': 'status-inactive',
      'export': 'status-active',
    };
    return classes[action] || 'status-inactive';
  }

  function lockDateInputToPicker(inputEl) {
    if (!inputEl) return;
    inputEl.addEventListener('keydown', function (e) {
      if (e.key === 'Tab' || e.key === 'Escape' || e.key === 'Enter') return;
      if (e.key === 'Backspace' || e.key === 'Delete') return;
      if (e.key && e.key.length === 1) e.preventDefault();
    });
    inputEl.addEventListener('paste', function (e) { e.preventDefault(); });
    inputEl.addEventListener('drop', function (e) { e.preventDefault(); });
  }

  function cssEscape(value) {
    return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }

  // --- Модальные окна ---
  let confirmCallback = null;

  function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      if (window.FocusTrap && typeof window.FocusTrap.trap === 'function') {
        setTimeout(function () { window.FocusTrap.trap(modal); }, 50);
      }
      modal.classList.add('show');
      modal.style.display = '';
    }
  }

  function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      if (window.FocusTrap && typeof window.FocusTrap.release === 'function') {
        window.FocusTrap.release();
      }
      modal.classList.remove('show');
      modal.style.display = '';
    }
  }

  function showConfirmModal(title, message, callback) {
    const titleEl = document.querySelector('#confirmModal .modal-header h3');
    const msgEl = document.getElementById('confirmMessage');
    if (titleEl) titleEl.textContent = title;
    if (msgEl) msgEl.textContent = message;
    confirmCallback = callback;
    showModal('confirmModal');
  }

  function handleConfirm() {
    if (confirmCallback) {
      confirmCallback();
      confirmCallback = null;
    }
    hideModal('confirmModal');
  }

  function initializeModals() {
    document.querySelectorAll('.modal-close').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const modal = btn.closest('.modal');
        if (modal && modal.id) hideModal(modal.id);
      });
    });
    const confirmCancel = document.getElementById('confirmCancel');
    const confirmOk = document.getElementById('confirmOk');
    if (confirmCancel) confirmCancel.addEventListener('click', function () { hideModal('confirmModal'); });
    if (confirmOk) confirmOk.addEventListener('click', handleConfirm);
    document.addEventListener('click', function (e) {
      if (e.target.classList.contains('modal')) hideModal(e.target.id);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        hideModal('userModal');
        hideModal('confirmModal');
        hideModal('enterpriseModal');
      }
    });
  }

  // --- Уведомления ---
  function showNotification(title, message, type, persistent) {
    type = type || 'info';
    persistent = persistent || false;
    let panel = document.getElementById('notificationPanel');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'notificationPanel';
      panel.className = 'notification-panel';
      document.body.appendChild(panel);
    }
    const notification = document.createElement('div');
    notification.className = 'notification ' + type;
    if (persistent) notification.classList.add('persistent');
    const notificationTitle = document.createElement('div');
    notificationTitle.className = 'notification-title';
    notificationTitle.textContent = title;
    const notificationMessage = document.createElement('div');
    notificationMessage.className = 'notification-message';
    notificationMessage.textContent = message;
    const notificationClose = document.createElement('button');
    notificationClose.className = 'notification-close';
    notificationClose.textContent = '×';
    notificationClose.addEventListener('click', function () { hideNotification(notification); });
    notification.appendChild(notificationTitle);
    notification.appendChild(notificationMessage);
    notification.appendChild(notificationClose);
    const topZ = parseInt(panel.getAttribute('data-top-z') || '2000', 10) + 1;
    panel.setAttribute('data-top-z', String(topZ));
    notification.style.zIndex = String(topZ);
    panel.appendChild(notification);
    if (!persistent) {
      setTimeout(function () { hideNotification(notification); }, 5000);
    }
  }

  function hideNotification(notification) {
    if (notification && notification.parentElement) {
      notification.style.animation = 'slideOutRight 0.3s ease';
      setTimeout(function () {
        if (notification.parentElement) notification.parentElement.removeChild(notification);
      }, 300);
    }
  }

  function initializeNotifications() {
    setInterval(function () {
      document.querySelectorAll('.notification').forEach(function (notification) {
        if (!notification.classList.contains('persistent')) hideNotification(notification);
      });
    }, 5000);
  }

  // --- Кастомные селекты ---
  const enhancedSelects = new Map();

  function closeAllEnhancedSelects() {
    enhancedSelects.forEach(function (api) { api.close(); });
  }

  function rebuildEnhancedSelect(selectId) {
    const api = enhancedSelects.get(selectId);
    if (api) api.rebuild();
  }

  function enhanceSelect(selectEl) {
    if (!selectEl) return;
    if (enhancedSelects.has(selectEl.id)) return;
    const host = selectEl.parentElement;
    if (!host) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'app-select';
    wrapper.setAttribute('data-select-id', selectEl.id || '');

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'app-select__trigger';
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');

    const valueEl = document.createElement('span');
    valueEl.className = 'app-select__value';
    valueEl.textContent = '';

    const arrow = document.createElement('span');
    arrow.className = 'app-select__arrow';
    const arrowSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    arrowSvg.setAttribute('viewBox', '0 0 24 24');
    arrowSvg.setAttribute('fill', 'none');
    arrowSvg.setAttribute('stroke', 'currentColor');
    arrowSvg.setAttribute('stroke-width', '2');
    arrowSvg.setAttribute('aria-hidden', 'true');
    const arrowPolyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    arrowPolyline.setAttribute('points', '6 9 12 15 18 9');
    arrowSvg.appendChild(arrowPolyline);
    arrow.appendChild(arrowSvg);
    trigger.appendChild(valueEl);
    trigger.appendChild(arrow);

    const menu = document.createElement('div');
    menu.className = 'app-select__menu';
    menu.setAttribute('role', 'listbox');
    menu.tabIndex = -1;

    function setOpen(next) {
      wrapper.classList.toggle('open', next);
      trigger.setAttribute('aria-expanded', next ? 'true' : 'false');
      if (next) {
        const active = menu.querySelector('[data-value="' + cssEscape(selectEl.value) + '"]');
        if (active) active.scrollIntoView({ block: 'nearest' });
      }
    }

    function close() { setOpen(false); }

    function syncValue() {
      const opt = selectEl.selectedOptions && selectEl.selectedOptions[0];
      valueEl.textContent = (opt && opt.textContent) ? opt.textContent : '';
      wrapper.classList.toggle('is-placeholder', !selectEl.value);
    }

    function rebuild() {
      menu.innerHTML = '';
      Array.from(selectEl.options).forEach(function (opt) {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'app-select__option';
        item.setAttribute('role', 'option');
        item.dataset.value = opt.value;
        item.textContent = opt.textContent;
        item.addEventListener('click', function (e) {
          e.stopPropagation();
          selectEl.value = opt.value;
          selectEl.dispatchEvent(new Event('change', { bubbles: true }));
          syncValue();
          close();
        });
        menu.appendChild(item);
      });
      syncValue();
    }

    trigger.addEventListener('click', function (e) {
      e.stopPropagation();
      enhancedSelects.forEach(function (api) {
        if (api.select !== selectEl) api.close();
      });
      setOpen(!wrapper.classList.contains('open'));
    });

    trigger.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        setOpen(true);
        const first = menu.querySelector('.app-select__option');
        if (first) first.focus();
      }
    });

    menu.addEventListener('keydown', function (e) {
      const options = Array.from(menu.querySelectorAll('.app-select__option'));
      const idx = options.indexOf(document.activeElement);
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
        trigger.focus();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const next = options[Math.min(options.length - 1, idx + 1)] || options[0];
        if (next) next.focus();
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = options[Math.max(0, idx - 1)] || options[options.length - 1];
        if (prev) prev.focus();
      }
      if (e.key === 'Tab') close();
    });

    selectEl.addEventListener('change', function () { syncValue(); });
    host.insertBefore(wrapper, selectEl);
    wrapper.appendChild(selectEl);
    wrapper.appendChild(trigger);
    wrapper.appendChild(menu);
    rebuild();
    enhancedSelects.set(selectEl.id, { select: selectEl, rebuild: rebuild, close: close });
  }

  function initializeEnhancedSelects() {
    const roleFilter = document.getElementById('roleFilter');
    const auditActionFilter = document.getElementById('auditActionFilter');
    if (roleFilter) enhanceSelect(roleFilter);
    if (auditActionFilter) enhanceSelect(auditActionFilter);
    document.addEventListener('click', function () { closeAllEnhancedSelects(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeAllEnhancedSelects();
    });
  }

  // --- Оболочка (сайдбар, топбар) ---
  function updateCollapsedSidebarTooltips(isCollapsed) {
    document.querySelectorAll('.admin-sidebar .menu-item[data-section]').forEach(function (btn) {
      const label = btn.querySelector('.menu-item__label');
      const tooltipText = (label && label.textContent) ? label.textContent.trim() : '';
      if (isCollapsed) {
        if (tooltipText) btn.setAttribute('data-tooltip', tooltipText);
      } else {
        btn.removeAttribute('data-tooltip');
      }
    });
  }

  function initializeAdminShell(api) {
    if (api && api.updatePageTitle) api.updatePageTitle(AdminState.currentSection);
    try {
      if (window.matchMedia && window.matchMedia('(max-width: 820px)').matches) {
        document.body.classList.add('admin-sidebar-collapsed');
      }
    } catch (_) { }

    const scrollTopBtn = document.getElementById('adminScrollTop');
    if (scrollTopBtn) {
      scrollTopBtn.addEventListener('click', function () {
        const content = document.querySelector('.admin-content');
        if (content) content.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }

    const sidebarToggle = document.getElementById('adminSidebarToggle');
    if (sidebarToggle) {
      const saved = localStorage.getItem('adminSidebarCollapsed') === '1';
      document.body.classList.toggle('admin-sidebar-collapsed', saved);
      sidebarToggle.setAttribute('data-tooltip', saved ? 'Раскрыть меню' : 'Свернуть меню');
      updateCollapsedSidebarTooltips(document.body.classList.contains('admin-sidebar-collapsed'));
      sidebarToggle.addEventListener('click', function () {
        const next = !document.body.classList.contains('admin-sidebar-collapsed');
        document.body.classList.toggle('admin-sidebar-collapsed', next);
        localStorage.setItem('adminSidebarCollapsed', next ? '1' : '0');
        sidebarToggle.setAttribute('data-tooltip', next ? 'Раскрыть меню' : 'Свернуть меню');
        updateCollapsedSidebarTooltips(next);
      });
    }

    const refreshCurrent = document.getElementById('adminRefreshCurrent');
    if (refreshCurrent && api && api.refreshCurrentSection) {
      refreshCurrent.addEventListener('click', function () {
        const icon = refreshCurrent.querySelector('.refresh-icon');
        if (icon) icon.classList.add('spin');
        setTimeout(function () {
          api.refreshCurrentSection();
          if (icon) icon.classList.remove('spin');
          showNotification('Обновлено', 'Раздел обновлён', 'success');
        }, 600);
      });
    }
  }

  function updatePageTitle(sectionId) {
    const titleEl = document.getElementById('adminPageTitle');
    if (!titleEl) return;
    const titles = {
      users: 'Пользователи',
      audit: 'Аудит',
      export: 'Экспорт',
      enterprises: 'Предприятия'
    };
    titleEl.textContent = titles[sectionId] || 'Админ‑панель';
  }

  // Публичный API
  window.AdminCommon = {
    ADMIN_STORAGE: ADMIN_STORAGE,
    AdminState: AdminState,
    escapeHtml: escapeHtml,
    safeJsonParse: safeJsonParse,
    readStorageJson: readStorageJson,
    writeStorageJson: writeStorageJson,
    ensureInstallDate: ensureInstallDate,
    persistUsers: persistUsers,
    persistAuditLogs: persistAuditLogs,
    persistEnterprises: persistEnterprises,
    getLoggedInUserName: getLoggedInUserName,
    safeLogout: safeLogout,
    computeBytes: computeBytes,
    formatBytes: formatBytes,
    deepCloneJson: deepCloneJson,
    formatDate: formatDate,
    formatDateTime: formatDateTime,
    getRoleName: getRoleName,
    getRoleClass: getRoleClass,
    getActionName: getActionName,
    getActionClass: getActionClass,
    lockDateInputToPicker: lockDateInputToPicker,
    showModal: showModal,
    hideModal: hideModal,
    showConfirmModal: showConfirmModal,
    handleConfirm: handleConfirm,
    showNotification: showNotification,
    hideNotification: hideNotification,
    initializeModals: initializeModals,
    initializeNotifications: initializeNotifications,
    enhanceSelect: enhanceSelect,
    closeAllEnhancedSelects: closeAllEnhancedSelects,
    rebuildEnhancedSelect: rebuildEnhancedSelect,
    initializeEnhancedSelects: initializeEnhancedSelects,
    updateCollapsedSidebarTooltips: updateCollapsedSidebarTooltips,
    initializeAdminShell: initializeAdminShell,
    updatePageTitle: updatePageTitle
  };
})();
