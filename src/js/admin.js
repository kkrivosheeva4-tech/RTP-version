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
    var role = localStorage.getItem('role');
    if (role !== 'admin') {
      if (typeof window.AdminCommon !== 'undefined' && window.AdminCommon.showNotification) {
        window.AdminCommon.showNotification('Ошибка доступа', 'У вас нет прав для доступа к админ панели', 'error');
      }
      setTimeout(function () {
        window.location.href = '/src/pages/index.html';
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
        themeToggle.addEventListener('change', function () {
          setTimeout(function () {
            if (window.AdminDashboard && typeof window.AdminDashboard.applyChartsTheme === 'function') {
              window.AdminDashboard.applyChartsTheme();
            }
          }, 100);
        }, { once: false });
      }
    }
    if (typeof window.renderAuth === 'function') {
      window.renderAuth();
    }
  }

  function refreshCurrentSection() {
    var state = getState();
    var section = state.currentSection;
    if (section === 'users' && window.AdminUsers) window.AdminUsers.loadUsers();
    if (section === 'audit' && window.AdminAudit) window.AdminAudit.loadAuditLogs();
    if (section === 'backup' && window.AdminBackups) window.AdminBackups.loadBackups();
    if (section === 'enterprises' && window.AdminEnterprises) window.AdminEnterprises.loadEnterprises();
    if (section === 'dashboard' && window.AdminDashboard) window.AdminDashboard.updateDashboardStats();
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
        getState().auditLogs = window.AdminAudit.normalizeAuditLogs(getCommon().readStorageJson(getCommon().ADMIN_STORAGE.AUDIT, []));
        window.AdminAudit.loadAuditLogs();
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

  function loadAdminDataFromStorage() {
    var common = getCommon();
    var state = getState();
    if (!window.AdminUsers || !window.AdminAudit || !window.AdminBackups || !window.AdminEnterprises) return;
    state.users = window.AdminUsers.normalizeUsers(common.readStorageJson(common.ADMIN_STORAGE.USERS, null));
    if (!state.users.length) {
      state.users = window.AdminUsers.getDefaultUsers();
      common.persistUsers();
    }
    state.auditLogs = window.AdminAudit.normalizeAuditLogs(common.readStorageJson(common.ADMIN_STORAGE.AUDIT, []));
    state.backups = window.AdminBackups.normalizeBackups(common.readStorageJson(common.ADMIN_STORAGE.BACKUPS, []));
    state.enterprises = window.AdminEnterprises.normalizeEnterprises(common.readStorageJson(common.ADMIN_STORAGE.ENTERPRISES, null));
    if (!state.enterprises.length) {
      window.AdminEnterprises.loadEnterprisesFromJson();
    }
  }

  function addAdminAuditLog(action, details) {
    var common = getCommon();
    if (typeof window.appendAdminAudit === 'function') {
      window.appendAdminAudit(action, details);
    } else {
      var state = getState();
      var currentUser = common.getLoggedInUserName();
      var ts = new Date().toISOString().slice(0, 19).replace('T', ' ');
      state.auditLogs.unshift({
        id: (state.auditLogs.length + 1),
        date: ts,
        user: currentUser,
        action: action,
        details: details,
        ip: 'local'
      });
      common.persistAuditLogs();
      getState().auditLogs = window.AdminAudit.normalizeAuditLogs(common.readStorageJson(common.ADMIN_STORAGE.AUDIT, []));
      if (getState().currentSection === 'audit' && window.AdminAudit) window.AdminAudit.loadAuditLogs();
      if (window.AdminDashboard && typeof window.AdminDashboard.updateDashboardStats === 'function') window.AdminDashboard.updateDashboardStats();
    }
  }

  function initializeApp() {
    if (!checkAdminAccess()) return;
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
    loadAdminDataFromStorage();
    window.addAdminAuditLog = addAdminAuditLog;
    if (typeof window.appendAdminAudit === 'function') {
      var originalAppendAdminAudit = window.appendAdminAudit;
      window.appendAdminAudit = function (action, details) {
        originalAppendAdminAudit(action, details);
        getState().auditLogs = window.AdminAudit.normalizeAuditLogs(common.readStorageJson(common.ADMIN_STORAGE.AUDIT, []));
        if (getState().currentSection === 'audit' && window.AdminAudit) window.AdminAudit.loadAuditLogs();
        if (window.AdminDashboard) window.AdminDashboard.updateDashboardStats();
      };
    }
    if (window.AdminDashboard) window.AdminDashboard.init();
    if (window.AdminUsers) window.AdminUsers.init();
    if (window.AdminAudit) window.AdminAudit.init();
    if (window.AdminExport) window.AdminExport.init();
    if (window.AdminBackups) window.AdminBackups.init();
    if (window.AdminEnterprises) window.AdminEnterprises.init();
    showSection('dashboard');
    common.updatePageTitle('dashboard');
  }

  document.addEventListener('DOMContentLoaded', function () {
    initializeApp();
  });
})();
