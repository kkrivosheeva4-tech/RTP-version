/**
 * Точка входа админ-панели: проверка доступа, тема, навигация, загрузка данных и координация разделов.
 * Разделы: AdminDashboard, AdminUsers, AdminAudit, AdminExport, AdminBackups, AdminEnterprises.
 */
(function () {
  'use strict';

  function getCommon() {
    return window.AdminCommon;
  }

  function getState() {
    return getCommon().AdminState;
  }

  function checkAdminAccess() {
    var roleApi = window.RoleCapabilities || window.RolesConfig || null;
    var rawRole = (window.AuthModule && typeof window.AuthModule.getCurrentRole === 'function')
      ? window.AuthModule.getCurrentRole()
      : '';
    var role = (roleApi && typeof roleApi.normalizeRole === 'function')
      ? roleApi.normalizeRole(rawRole)
      : String(rawRole || '').trim().toLowerCase();
    var hasAccess = Boolean(
      roleApi && typeof roleApi.canAccessAdminPanel === 'function' && roleApi.canAccessAdminPanel(role)
    );
    if (!hasAccess) {
      if (typeof window.AdminCommon !== 'undefined' && window.AdminCommon.showNotification) {
        window.AdminCommon.showNotification(
          'Ошибка доступа',
          'У вас нет прав для доступа к админ панели. Войдите как администратор.',
          'error'
        );
      }
      var isAuthenticated = window.AuthModule && typeof window.AuthModule.isAuthenticated === 'function'
        && window.AuthModule.isAuthenticated();
      var cfg = window.ApiConfig;
      var useApi = cfg && typeof cfg.getUseApi === 'function' && cfg.getUseApi();
      var redirectUrl = '/';
      setTimeout(function () {
        window.location.href = redirectUrl;
      }, 2000);
      return false;
    }
    return true;
  }

  function initializeTheme() {
    if (typeof window.CommonUI !== 'undefined' && typeof window.CommonUI.initTheme === 'function') {
      window.CommonUI.initTheme();
      var themeToggle = document.getElementById('themeToggle');
      if (themeToggle) {
        themeToggle.addEventListener(
          'change',
          function () {
            setTimeout(function () {
              if (
                window.AdminDashboard &&
                typeof window.AdminDashboard.applyChartsTheme === 'function'
              ) {
                window.AdminDashboard.applyChartsTheme();
              }
            }, 100);
          },
          { once: false }
        );
      }
    }
    if (typeof window.renderAuth === 'function') {
      window.renderAuth();
    }
  }

  function refreshCurrentSection() {
    var state = getState();
    var section = state.currentSection;
    if (section === 'users' && window.AdminUsers) {
      if (typeof window.AdminUsers.refreshUsersFromApi === 'function') {
        window.AdminUsers.refreshUsersFromApi().catch(function (error) {
          getCommon().showNotification(
            'Ошибка обновления',
            error && error.message ? error.message : 'Не удалось обновить список пользователей',
            'error',
            true
          );
        });
      } else {
        window.AdminUsers.loadUsers();
      }
    }
    if (section === 'audit' && window.AdminAudit) window.AdminAudit.loadAuditLogs();
    if (section === 'backup' && window.AdminBackups) window.AdminBackups.loadBackups();
    if (section === 'enterprises' && window.AdminEnterprises)
      window.AdminEnterprises.loadEnterprises();
    if (section === 'dashboard' && window.AdminDashboard)
      window.AdminDashboard.updateDashboardStats();
  }

  function showSection(sectionId) {
    document.querySelectorAll('.content-section').forEach(function (section) {
      section.classList.remove('active');
    });
    var targetSection = document.getElementById(sectionId);
    if (targetSection) {
      targetSection.classList.add('active');
      getState().currentSection = sectionId;
      if (sectionId === 'audit' && window.AdminAudit) {
        if (!(window.AdminAudit.isApiMode && window.AdminAudit.isApiMode())) {
          getState().auditLogs = window.AdminAudit.normalizeAuditLogs(
            getCommon().readStorageJson(getCommon().ADMIN_STORAGE.AUDIT, [])
          );
        }
        window.AdminAudit.loadAuditLogs();
      }
      if (sectionId === 'users' && window.AdminUsers) {
        window.AdminUsers.loadUsers();
      }
      if (sectionId === 'dashboard' && window.AdminDashboard) {
        window.AdminDashboard.updateDashboardStats();
      }
      if (sectionId === 'enterprises' && window.AdminEnterprises) {
        window.AdminEnterprises.loadEnterprises();
      }
    }
  }

  function initializeNavigation() {
    var common = getCommon();
    var menuItems = document.querySelectorAll('.menu-item[data-section]');
    menuItems.forEach(function (item) {
      item.addEventListener('click', function () {
        var section = item.getAttribute('data-section');
        showSection(section);
        menuItems.forEach(function (mi) {
          mi.classList.remove('active');
          mi.removeAttribute('aria-current');
        });
        item.classList.add('active');
        item.setAttribute('aria-current', 'page');
        common.updatePageTitle(section);
      });
    });
  }

  function normalizeEnterprisesSafely(rawEnterprises) {
    if (
      window.AdminEnterprises &&
      typeof window.AdminEnterprises.normalizeEnterprises === 'function'
    ) {
      return window.AdminEnterprises.normalizeEnterprises(rawEnterprises);
    }

    if (!Array.isArray(rawEnterprises)) return [];
    return rawEnterprises.filter(Boolean).map(function (item) {
      return {
        id: item && item.id ? Number(item.id) : 0,
        name: (item && item.name != null ? String(item.name) : '').trim(),
        code: (item && item.code != null ? String(item.code) : '').trim(),
        description: (item && item.description != null ? String(item.description) : '').trim()
      };
    });
  }

  async function loadAdminData() {
    var common = getCommon();
    var state = getState();
    if (
      !window.AdminUsers ||
      !window.AdminAudit ||
      !window.AdminBackups ||
      !window.AdminEnterprises
    )
      return;

    if (typeof window.AdminUsers.fetchUsersFromApi === 'function') {
      try {
        state.users = await window.AdminUsers.fetchUsersFromApi();
      } catch (error) {
        state.users = [];
        if (common.showNotification) {
          common.showNotification(
            'Ошибка загрузки',
            error && error.message
              ? error.message
              : 'Не удалось загрузить список пользователей из backend API',
            'error',
            true
          );
        }
      }
    }
    if (window.AdminAudit.isApiMode && window.AdminAudit.isApiMode()) {
      try {
        var auditRes = await window.AdminAudit.fetchAuditFromApi();
        state.auditLogs = auditRes.results || [];
      } catch (_) {
        state.auditLogs = [];
      }
    } else {
      state.auditLogs = window.AdminAudit.normalizeAuditLogs(
        common.readStorageJson(common.ADMIN_STORAGE.AUDIT, [])
      );
    }
    if (window.AdminBackups.isApiMode && window.AdminBackups.isApiMode()) {
      try {
        state.backups = await window.AdminBackups.fetchBackupsFromApi
          ? (await window.AdminBackups.fetchBackupsFromApi())
          : [];
      } catch (_) {
        state.backups = [];
      }
    } else {
      state.backups = window.AdminBackups.normalizeBackups(
        common.readStorageJson(common.ADMIN_STORAGE.BACKUPS, [])
      );
    }
    if (window.AdminEnterprises.isApiMode && window.AdminEnterprises.isApiMode()) {
      try {
        state.enterprises = await window.AdminEnterprises.fetchEnterprisesFromApi
          ? (await window.AdminEnterprises.fetchEnterprisesFromApi())
          : [];
      } catch (_) {
        state.enterprises = [];
      }
    } else {
      state.enterprises = normalizeEnterprisesSafely(
        common.readStorageJson(common.ADMIN_STORAGE.ENTERPRISES, null)
      );
      if (!state.enterprises.length) {
        window.AdminEnterprises.loadEnterprisesFromJson();
      }
    }
  }

  function addAdminAuditLog(action, details) {
    var common = getCommon();
    if (typeof window.appendAdminAudit === 'function') {
      window.appendAdminAudit(action, details);
    } else if (window.AdminAudit && window.AdminAudit.isApiMode && window.AdminAudit.isApiMode()) {
      if (getState().currentSection === 'audit' && window.AdminAudit) {
        window.AdminAudit.loadAuditLogs();
      }
      if (window.AdminDashboard && typeof window.AdminDashboard.updateDashboardStats === 'function') {
        window.AdminDashboard.updateDashboardStats();
      }
    } else {
      var state = getState();
      var currentUser = common.getLoggedInUserName();
      var ts = new Date().toISOString().slice(0, 19).replace('T', ' ');
      state.auditLogs.unshift({
        id: state.auditLogs.length + 1,
        date: ts,
        user: currentUser,
        action: action,
        details: details,
        ip: 'local'
      });
      common.persistAuditLogs();
      getState().auditLogs = window.AdminAudit.normalizeAuditLogs(
        common.readStorageJson(common.ADMIN_STORAGE.AUDIT, [])
      );
      if (getState().currentSection === 'audit' && window.AdminAudit)
        window.AdminAudit.loadAuditLogs();
      if (window.AdminDashboard && typeof window.AdminDashboard.updateDashboardStats === 'function')
        window.AdminDashboard.updateDashboardStats();
    }
  }

  function waitForAuthModule(maxMs) {
    maxMs = maxMs || 5000;
    return new Promise(function (resolve) {
      var start = Date.now();
      function check() {
        var hasAuth = window.AuthModule && typeof window.AuthModule.bootstrapAuthSession === 'function';
        var cfg = window.ApiConfig;
        var useApi = cfg && typeof cfg.getUseApi === 'function' && cfg.getUseApi();
        var needsApi = useApi && (!window.ApiClient || typeof window.ApiClient.get !== 'function');
        if (hasAuth && !needsApi) {
          resolve();
          return;
        }
        if (Date.now() - start >= maxMs) {
          resolve();
          return;
        }
        setTimeout(check, 50);
      }
      check();
    });
  }

  async function initializeApp() {
    // Ждём загрузки AuthModule
    await waitForAuthModule();
    if (!window.AuthModule || typeof window.AuthModule.bootstrapAuthSession !== 'function') {
      if (typeof window.AdminCommon !== 'undefined' && window.AdminCommon.showNotification) {
        window.AdminCommon.showNotification('Ошибка', 'Модуль авторизации не загружен', 'error');
      }
      setTimeout(function () {
        window.location.href = '/';
      }, 2000);
      return;
    }
    // При переходе по ссылке «Администратор» даём время на инициализацию (refresh cookie и т.д.)
    var navTs = 0;
    try {
      navTs = parseInt(sessionStorage.getItem('rmk_admin_nav_ts') || '0', 10);
    } catch (_) {}
    if (navTs && Date.now() - navTs < 15000) {
      await new Promise(function (r) { setTimeout(r, 400); });
    }
    // Bootstrap сессии (восстановление из cookie)
    await window.AuthModule.bootstrapAuthSession();
    // В API-режиме: при неудачном bootstrap пробуем ещё раз (refresh может задержаться)
    var cfg = window.ApiConfig;
    var useApi = cfg && typeof cfg.getUseApi === 'function' && cfg.getUseApi();
    if (useApi && (!window.AuthModule.isAuthenticated || !window.AuthModule.isAuthenticated())) {
      await new Promise(function (r) { setTimeout(r, 400); });
      await window.AuthModule.bootstrapAuthSession(true);
    }
    var hasAccess = checkAdminAccess();
    if (!hasAccess && useApi && navTs && Date.now() - navTs < 15000) {
      try { sessionStorage.removeItem('rmk_admin_nav_ts'); } catch (_) {}
      await new Promise(function (r) { setTimeout(r, 1200); });
      await window.AuthModule.bootstrapAuthSession(true);
      hasAccess = checkAdminAccess();
      if (!hasAccess) {
        await new Promise(function (r) { setTimeout(r, 800); });
        await window.AuthModule.bootstrapAuthSession(true);
        hasAccess = checkAdminAccess();
      }
    }
    if (!hasAccess) return;
    initializeTheme();
    var common = getCommon();
    common.initializeModals();
    common.initializeNotifications();
    common.initializeAdminShell({
      updatePageTitle: common.updatePageTitle,
      refreshCurrentSection: refreshCurrentSection
    });
    common.initializeEnhancedSelects();
    initializeNavigation();
    await loadAdminData();
    window.addAdminAuditLog = addAdminAuditLog;
    if (typeof window.appendAdminAudit === 'function') {
      var originalAppendAdminAudit = window.appendAdminAudit;
      window.appendAdminAudit = function (action, details) {
        originalAppendAdminAudit(action, details);
        getState().auditLogs = window.AdminAudit.normalizeAuditLogs(
          common.readStorageJson(common.ADMIN_STORAGE.AUDIT, [])
        );
        if (getState().currentSection === 'audit' && window.AdminAudit)
          window.AdminAudit.loadAuditLogs();
        if (window.AdminDashboard) window.AdminDashboard.updateDashboardStats();
      };
    }
    if (window.AdminDashboard) window.AdminDashboard.init();
    if (window.AdminUsers) window.AdminUsers.init();
    if (window.AdminAudit) window.AdminAudit.init();
    if (window.AdminExport) window.AdminExport.init();
    if (window.AdminBackups) window.AdminBackups.init();
    if (window.AdminEnterprises) window.AdminEnterprises.init();
    showSection('users');
    common.updatePageTitle('users');
  }

  document.addEventListener('DOMContentLoaded', function () {
    initializeApp();
  });
})();
