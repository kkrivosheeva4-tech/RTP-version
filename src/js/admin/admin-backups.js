/**
 * Раздел «Резервные копии» админ-панели: создание, восстановление, удаление.
 */
(function () {
  'use strict';

  function getCommon() {
    return window.AdminCommon;
  }

  function getState() {
    return getCommon().AdminState;
  }

  function addAuditLog(action, details) {
    if (typeof window.addAdminAuditLog === 'function') {
      window.addAdminAuditLog(action, details);
    }
  }

  function normalizeBackups(list) {
    if (!Array.isArray(list)) return [];
    var nextId = 1;
    var used = {};
    var backupDate = (typeof window.getAuditTimestamp === 'function')
      ? window.getAuditTimestamp()
      : new Date().toISOString().slice(0, 19).replace('T', ' ');
    return list
      .filter(Boolean)
      .map(function (b) {
        var id = Number(b.id);
        if (!Number.isFinite(id) || id <= 0 || used[id]) {
          while (used[nextId]) nextId += 1;
          id = nextId++;
        }
        used[id] = true;
        return {
          id: id,
          name: (b.name != null ? String(b.name) : '').trim() || ('backup_' + id),
          date: (b.date != null ? String(b.date) : '').trim() || backupDate,
          size: (b.size != null ? String(b.size) : '').trim() || '',
          sizeBytes: Number.isFinite(Number(b.sizeBytes)) ? Number(b.sizeBytes) : null,
          snapshot: (b.snapshot && typeof b.snapshot === 'object') ? b.snapshot : null
        };
      });
  }

  function loadBackups() {
    var state = getState();
    var common = getCommon();
    var backupList = document.getElementById('backupList');
    if (!backupList) return;
    backupList.innerHTML = '';
    var backups = state.backups || [];
    backups.forEach(function (backup) {
      var template = document.getElementById('backupTemplate');
      if (!template) return;
      var backupItem = template.cloneNode(true);
      backupItem.style.display = 'flex';
      backupItem.id = 'backup-' + backup.id;
      var nameEl = backupItem.querySelector('.backup-name');
      var dateEl = backupItem.querySelector('.backup-date');
      var sizeEl = backupItem.querySelector('.backup-size');
      var restoreBtn = backupItem.querySelector('.backup-restore-btn');
      var deleteBtn = backupItem.querySelector('.backup-delete-btn');
      if (nameEl) nameEl.textContent = backup.name;
      if (dateEl) dateEl.textContent = common.formatDateTime(backup.date);
      if (sizeEl) sizeEl.textContent = backup.size;
      if (restoreBtn) restoreBtn.addEventListener('click', function () { restoreBackup(backup.id); });
      if (deleteBtn) deleteBtn.addEventListener('click', function () { deleteBackup(backup.id); });
      backupList.appendChild(backupItem);
    });
  }

  function createBackup() {
    var state = getState();
    var common = getCommon();
    var backupName = 'backup_' + new Date().toISOString().replace(/[-:]/g, '_').split('.')[0];
    var backupDate = (typeof window.getAuditTimestamp === 'function')
      ? window.getAuditTimestamp()
      : new Date().toISOString().slice(0, 19).replace('T', ' ');
    var snapshot = {
      users: common.deepCloneJson(state.users) || [],
      auditLogs: common.deepCloneJson(state.auditLogs) || []
    };
    var snapshotStr = JSON.stringify(snapshot);
    var sizeBytes = common.computeBytes(snapshotStr);
    var backupSize = common.formatBytes(sizeBytes);
    var backups = state.backups || [];
    var maxId = 0;
    backups.forEach(function (b) {
      var id = Number(b && b.id) || 0;
      if (id > maxId) maxId = id;
    });
    var newBackup = {
      id: maxId + 1,
      name: backupName,
      date: backupDate,
      size: backupSize,
      sizeBytes: sizeBytes,
      snapshot: snapshot
    };
    state.backups.unshift(newBackup);
    common.persistBackups();
    loadBackups();
    if (window.AdminDashboard && typeof window.AdminDashboard.updateDashboardStats === 'function') {
      window.AdminDashboard.updateDashboardStats();
    }
    addAuditLog('backup', 'Создана резервная копия: ' + backupName);
    common.showNotification('Резервная копия', 'Резервная копия успешно создана', 'success');
  }

  function restoreBackup(backupId) {
    var state = getState();
    var common = getCommon();
    var backups = state.backups || [];
    var backup = backups.filter(function (b) { return b.id === backupId; })[0];
    if (!backup) return;
    common.showConfirmModal(
      'Восстановление из резервной копии',
      'Вы уверены, что хотите восстановить систему из копии "' + backup.name + '"?',
      function () {
        if (backup.snapshot && typeof backup.snapshot === 'object') {
          var nextUsers = window.AdminUsers && typeof window.AdminUsers.normalizeUsers === 'function'
            ? window.AdminUsers.normalizeUsers(backup.snapshot.users || [])
            : (backup.snapshot.users || []);
          var nextAudit = window.AdminAudit && typeof window.AdminAudit.normalizeAuditLogs === 'function'
            ? window.AdminAudit.normalizeAuditLogs(backup.snapshot.auditLogs || [])
            : (backup.snapshot.auditLogs || []);
          if (nextUsers.length) state.users = nextUsers;
          if (Array.isArray(nextAudit)) state.auditLogs = nextAudit;
          common.persistUsers();
          common.persistAuditLogs();
        }
        if (window.AdminUsers && typeof window.AdminUsers.loadUsers === 'function') window.AdminUsers.loadUsers();
        if (window.AdminAudit && typeof window.AdminAudit.loadAuditLogs === 'function') window.AdminAudit.loadAuditLogs();
        if (window.AdminDashboard && typeof window.AdminDashboard.updateDashboardStats === 'function') {
          window.AdminDashboard.updateDashboardStats();
        }
        addAuditLog('backup', 'Восстановление из резервной копии: ' + backup.name);
        common.showNotification('Восстановление', 'Данные восстановлены из резервной копии', 'success');
      }
    );
  }

  function deleteBackup(backupId) {
    var state = getState();
    var common = getCommon();
    var backups = state.backups || [];
    var backup = backups.filter(function (b) { return b.id === backupId; })[0];
    if (!backup) return;
    common.showConfirmModal(
      'Удаление резервной копии',
      'Вы уверены, что хотите удалить копию "' + backup.name + '"?',
      function () {
        state.backups = backups.filter(function (b) { return b.id !== backupId; });
        common.persistBackups();
        loadBackups();
        if (window.AdminDashboard && typeof window.AdminDashboard.updateDashboardStats === 'function') {
          window.AdminDashboard.updateDashboardStats();
        }
        addAuditLog('backup', 'Удалена резервная копия: ' + backup.name);
        common.showNotification('Удаление', 'Резервная копия удалена', 'success');
      }
    );
  }

  function init() {
    var common = getCommon();
    var createBackupBtn = document.getElementById('createBackupBtn');
    if (createBackupBtn) createBackupBtn.addEventListener('click', createBackup);
    var clearVfsCacheBtn = document.getElementById('clearVfsCacheBtn');
    if (clearVfsCacheBtn) {
      clearVfsCacheBtn.addEventListener('click', function () {
        if (confirm('Вы уверены, что хотите сбросить все локальные правки данных? Это действие нельзя отменить.')) {
          if (typeof window.clearVfsCache === 'function') {
            window.clearVfsCache();
            common.showNotification('Успешно', 'Локальные правки данных сброшены', 'success');
            addAuditLog('backup', 'Сброшены локальные правки данных (VFS)');
          } else {
            common.showNotification('Ошибка', 'Функция сброса недоступна', 'error');
          }
        }
      });
    }
    loadBackups();
  }

  window.AdminBackups = {
    init: init,
    loadBackups: loadBackups,
    normalizeBackups: normalizeBackups
  };
})();
