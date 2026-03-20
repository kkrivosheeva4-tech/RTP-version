/**
 * Раздел «Резервные копии» админ-панели: загрузка из backend API, создание, восстановление, удаление.
 */
(function () {
  'use strict';

  var BACKUPS_API_PATH = '/api/v1/admin-panel/backups';

  function getCommon() {
    return window.AdminCommon;
  }

  function getState() {
    return getCommon().AdminState;
  }

  function getApiClient() {
    return window.ApiClient || null;
  }

  function isApiMode() {
    var client = getApiClient();
    var cfg = window.ApiConfig;
    return !!(client && typeof client.get === 'function' && cfg && typeof cfg.getUseApi === 'function' && cfg.getUseApi());
  }

  function addAuditLog(action, details) {
    if (typeof window.addAdminAuditLog === 'function') {
      window.addAdminAuditLog(action, details);
    }
  }

  function mapApiBackupToLocal(b) {
    var date = (b && b.created_at) ? String(b.created_at) : '';
    if (date && date.indexOf('T') !== -1) date = date.replace('T', ' ').slice(0, 19);
    var size = (b && b.size_bytes != null) ? getCommon().formatBytes(Number(b.size_bytes)) : '';
    return {
      id: b && b.id ? Number(b.id) : 0,
      name: (b && b.name != null ? String(b.name) : '').trim() || 'backup',
      date: date,
      size: size,
      sizeBytes: (b && b.size_bytes != null) ? Number(b.size_bytes) : null,
      snapshot: null,
      downloadUrl: (b && b.download_url) ? String(b.download_url) : ''
    };
  }

  async function fetchBackupsFromApi() {
    var client = getApiClient();
    if (!client || typeof client.get !== 'function') {
      throw new Error('ApiClient недоступен для загрузки бэкапов');
    }
    var response = await client.get(BACKUPS_API_PATH);
    if (!response || response.ok === false) {
      throw new Error((response && response.error) || 'Не удалось загрузить список бэкапов');
    }
    var data = Array.isArray(response.data) ? response.data : [];
    return data.map(mapApiBackupToLocal);
  }

  async function createBackupViaApi(name, description) {
    var client = getApiClient();
    if (!client || typeof client.post !== 'function') {
      throw new Error('ApiClient недоступен для создания бэкапа');
    }
    var response = await client.post(BACKUPS_API_PATH, { name: name, description: description || '' });
    if (!response || response.ok === false) {
      throw new Error((response && response.error) || 'Не удалось создать бэкап');
    }
    return mapApiBackupToLocal(response.data || {});
  }

  async function restoreBackupViaApi(backupId) {
    var client = getApiClient();
    if (!client || typeof client.post !== 'function') {
      throw new Error('ApiClient недоступен для восстановления');
    }
    var response = await client.post(BACKUPS_API_PATH + '/' + backupId + '/restore', {});
    if (!response || response.ok === false) {
      throw new Error((response && response.error) || 'Не удалось восстановить из бэкапа');
    }
    return response.data;
  }

  async function deleteBackupViaApi(backupId) {
    var client = getApiClient();
    if (!client || typeof client.delete !== 'function') {
      throw new Error('ApiClient недоступен для удаления бэкапа');
    }
    var response = await client.delete(BACKUPS_API_PATH + '/' + backupId);
    if (!response || response.ok === false) {
      throw new Error((response && response.error) || 'Не удалось удалить бэкап');
    }
  }

  function loadBackups() {
    var state = getState();
    if (isApiMode()) {
      fetchBackupsFromApi()
        .then(function (data) {
          state.backups = data || [];
          renderBackupList(state.backups);
        })
        .catch(function (err) {
          state.backups = [];
          renderBackupList([]);
          if (getCommon().showNotification) {
            getCommon().showNotification('Ошибка', (err && err.message) || 'Не удалось загрузить бэкапы', 'error', true);
          }
        });
      return;
    }
    var backups = state.backups || [];
    renderBackupList(backups);
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

  function renderBackupList(backups) {
    var state = getState();
    var common = getCommon();
    var backupList = document.getElementById('backupList');
    if (!backupList) return;
    backupList.innerHTML = '';
    (backups || []).forEach(function (backup) {
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
    if (isApiMode()) {
      createBackupViaApi(backupName, '')
        .then(function (newBackup) {
          state.backups.unshift(newBackup);
          loadBackups();
          addAuditLog('backup', 'Создана резервная копия: ' + backupName);
          common.showNotification('Резервная копия', 'Резервная копия успешно создана', 'success');
        })
        .catch(function (err) {
          common.showNotification('Ошибка', (err && err.message) || 'Не удалось создать бэкап', 'error', true);
        });
      return;
    }
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
        if (isApiMode()) {
          restoreBackupViaApi(backupId)
            .then(function () {
              if (window.AdminUsers && typeof window.AdminUsers.refreshUsersFromApi === 'function') {
                window.AdminUsers.refreshUsersFromApi();
              }
              if (window.AdminAudit && typeof window.AdminAudit.loadAuditLogs === 'function') {
                window.AdminAudit.loadAuditLogs();
              }
              loadBackups();
              if (window.AdminDashboard && typeof window.AdminDashboard.updateDashboardStats === 'function') {
                window.AdminDashboard.updateDashboardStats();
              }
              addAuditLog('backup', 'Восстановление из резервной копии: ' + backup.name);
              common.showNotification('Восстановление', 'Данные восстановлены из резервной копии', 'success');
            })
            .catch(function (err) {
              common.showNotification('Ошибка', (err && err.message) || 'Не удалось восстановить', 'error', true);
            });
          return;
        }
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
        if (isApiMode()) {
          deleteBackupViaApi(backupId)
            .then(function () {
              state.backups = backups.filter(function (b) { return b.id !== backupId; });
              loadBackups();
              if (window.AdminDashboard && typeof window.AdminDashboard.updateDashboardStats === 'function') {
                window.AdminDashboard.updateDashboardStats();
              }
              addAuditLog('backup', 'Удалена резервная копия: ' + backup.name);
              common.showNotification('Удаление', 'Резервная копия удалена', 'success');
            })
            .catch(function (err) {
              common.showNotification('Ошибка', (err && err.message) || 'Не удалось удалить бэкап', 'error', true);
            });
          return;
        }
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
    normalizeBackups: normalizeBackups,
    fetchBackupsFromApi: fetchBackupsFromApi,
    isApiMode: isApiMode
  };
})();
