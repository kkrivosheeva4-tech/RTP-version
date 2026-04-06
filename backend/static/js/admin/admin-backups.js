/**
 * Section "Backups" in the admin panel.
 * Uses backend API as the only runtime source of truth.
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
    return !!(
      client &&
      typeof client.get === 'function' &&
      cfg &&
      typeof cfg.getUseApi === 'function' &&
      cfg.getUseApi()
    );
  }

  function addAuditLog(action, details) {
    if (typeof window.addAdminAuditLog === 'function') {
      window.addAdminAuditLog(action, details);
    }
  }

  function mapApiBackupToLocal(item) {
    var date = item && item.created_at ? String(item.created_at) : '';
    if (date && date.indexOf('T') !== -1) {
      date = date.replace('T', ' ').slice(0, 19);
    }

    return {
      id: item && item.id ? Number(item.id) : 0,
      name: (item && item.name != null ? String(item.name) : '').trim() || 'backup',
      date: date,
      size: item && item.size_bytes != null ? getCommon().formatBytes(Number(item.size_bytes)) : '',
      sizeBytes: item && item.size_bytes != null ? Number(item.size_bytes) : null,
      snapshot: null,
      downloadUrl: item && item.download_url ? String(item.download_url) : ''
    };
  }

  function normalizeBackups(list) {
    if (!Array.isArray(list)) return [];
    return list.filter(Boolean).map(function (item) {
      if (
        item &&
        (Object.prototype.hasOwnProperty.call(item, 'created_at') ||
          Object.prototype.hasOwnProperty.call(item, 'size_bytes') ||
          Object.prototype.hasOwnProperty.call(item, 'download_url'))
      ) {
        return mapApiBackupToLocal(item);
      }

      return {
        id: item && item.id ? Number(item.id) : 0,
        name: (item && item.name != null ? String(item.name) : '').trim() || 'backup',
        date: (item && item.date != null ? String(item.date) : '').trim(),
        size: (item && item.size != null ? String(item.size) : '').trim(),
        sizeBytes: item && item.sizeBytes != null ? Number(item.sizeBytes) : null,
        snapshot: item && Object.prototype.hasOwnProperty.call(item, 'snapshot') ? item.snapshot : null,
        downloadUrl: (item && item.downloadUrl != null ? String(item.downloadUrl) : '').trim()
      };
    });
  }

  async function fetchBackupsFromApi() {
    var client = getApiClient();
    if (!client || typeof client.get !== 'function') {
      throw new Error('ApiClient недоступен для загрузки резервных копий');
    }

    var response = await client.get(BACKUPS_API_PATH);
    if (!response || response.ok === false) {
      throw new Error((response && response.error) || 'Не удалось загрузить список резервных копий');
    }

    return (Array.isArray(response.data) ? response.data : []).map(mapApiBackupToLocal);
  }

  async function createBackupViaApi(name, description) {
    var client = getApiClient();
    if (!client || typeof client.post !== 'function') {
      throw new Error('ApiClient недоступен для создания резервной копии');
    }

    var response = await client.post(BACKUPS_API_PATH, { name: name, description: description || '' });
    if (!response || response.ok === false) {
      throw new Error((response && response.error) || 'Не удалось создать резервную копию');
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
      throw new Error((response && response.error) || 'Не удалось восстановить из резервной копии');
    }

    return response.data;
  }

  async function deleteBackupViaApi(backupId) {
    var client = getApiClient();
    if (!client || typeof client.delete !== 'function') {
      throw new Error('ApiClient недоступен для удаления резервной копии');
    }

    var response = await client.delete(BACKUPS_API_PATH + '/' + backupId);
    if (!response || response.ok === false) {
      throw new Error((response && response.error) || 'Не удалось удалить резервную копию');
    }
  }

  function loadBackups() {
    var state = getState();

    fetchBackupsFromApi()
      .then(function (data) {
        state.backups = data || [];
        renderBackupList(state.backups);
      })
      .catch(function (err) {
        state.backups = [];
        renderBackupList([]);
        if (getCommon().showNotification) {
          getCommon().showNotification('Ошибка', (err && err.message) || 'Не удалось загрузить резервные копии', 'error', true);
        }
      });
  }

  function renderBackupList(backups) {
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
      if (restoreBtn) {
        restoreBtn.addEventListener('click', function () {
          restoreBackup(backup.id);
        });
      }
      if (deleteBtn) {
        deleteBtn.addEventListener('click', function () {
          deleteBackup(backup.id);
        });
      }

      backupList.appendChild(backupItem);
    });
  }

  function createBackup() {
    var state = getState();
    var common = getCommon();
    var backupName = 'backup_' + new Date().toISOString().replace(/[-:]/g, '_').split('.')[0];

    createBackupViaApi(backupName, '')
      .then(function (newBackup) {
        state.backups.unshift(newBackup);
        loadBackups();
        addAuditLog('backup', 'Создана резервная копия: ' + backupName);
        common.showNotification('Резервная копия', 'Резервная копия успешно создана', 'success');
      })
      .catch(function (err) {
        common.showNotification('Ошибка', (err && err.message) || 'Не удалось создать резервную копию', 'error', true);
      });
  }

  function restoreBackup(backupId) {
    var state = getState();
    var common = getCommon();
    var backups = state.backups || [];
    var backup = backups.filter(function (item) {
      return item.id === backupId;
    })[0];

    if (!backup) return;

    common.showConfirmModal(
      'Восстановление из резервной копии',
      'Вы уверены, что хотите восстановить систему из копии "' + backup.name + '"?',
      function () {
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
            common.showNotification('Ошибка', (err && err.message) || 'Не удалось восстановить данные', 'error', true);
          });
      }
    );
  }

  function deleteBackup(backupId) {
    var state = getState();
    var common = getCommon();
    var backups = state.backups || [];
    var backup = backups.filter(function (item) {
      return item.id === backupId;
    })[0];

    if (!backup) return;

    common.showConfirmModal(
      'Удаление резервной копии',
      'Вы уверены, что хотите удалить копию "' + backup.name + '"?',
      function () {
        deleteBackupViaApi(backupId)
          .then(function () {
            state.backups = backups.filter(function (item) {
              return item.id !== backupId;
            });
            loadBackups();
            if (window.AdminDashboard && typeof window.AdminDashboard.updateDashboardStats === 'function') {
              window.AdminDashboard.updateDashboardStats();
            }
            addAuditLog('backup', 'Удалена резервная копия: ' + backup.name);
            common.showNotification('Удаление', 'Резервная копия удалена', 'success');
          })
          .catch(function (err) {
            common.showNotification('Ошибка', (err && err.message) || 'Не удалось удалить резервную копию', 'error', true);
          });
      }
    );
  }

  function init() {
    var common = getCommon();
    var createBackupBtn = document.getElementById('createBackupBtn');
    var clearVfsCacheBtn = document.getElementById('clearVfsCacheBtn');

    if (createBackupBtn) createBackupBtn.addEventListener('click', createBackup);
    if (clearVfsCacheBtn) {
      clearVfsCacheBtn.addEventListener('click', function () {
        common.showNotification('Информация', 'Локальный VFS-кэш больше не используется в рабочем контуре.', 'info');
      });
    }

    loadBackups();
  }

  window.AdminBackups = {
    init: init,
    loadBackups: loadBackups,
    fetchBackupsFromApi: fetchBackupsFromApi,
    isApiMode: isApiMode,
    normalizeBackups: normalizeBackups
  };
})();
