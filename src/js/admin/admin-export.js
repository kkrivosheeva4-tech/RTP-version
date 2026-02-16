/**
 * Раздел «Экспорт» админ-панели: выгрузка пользователей и журнала аудита в JSON/CSV.
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

  function exportData(type, format) {
    var state = getState();
    var common = getCommon();
    var data;
    var filename;
    if (type === 'users') {
      data = state.users || [];
      filename = 'users_' + new Date().toISOString().split('T')[0];
    } else if (type === 'audit') {
      data = state.auditLogs || [];
      filename = 'audit_logs_' + new Date().toISOString().split('T')[0];
    } else {
      return;
    }
    if (format === 'json') {
      exportToJSON(data, filename, type);
    } else if (format === 'excel') {
      exportToExcel(data, filename, type);
    }
    addAuditLog('export', 'Экспорт ' + type + ' в формате ' + format);
    common.showNotification('Экспорт', 'Данные экспортированы в формате ' + format.toUpperCase(), 'success');
  }

  function exportToJSON(data, filename, type) {
    var common = getCommon();
    var payload = data;
    try {
      var isAudit = String(filename || '').toLowerCase().indexOf('audit') !== -1;
      var isUsers = String(filename || '').toLowerCase().indexOf('users') !== -1;
      if (isUsers && Array.isArray(data)) {
        payload = data.map(function (u) {
          return {
            'ID': u.id,
            'Имя': u.name,
            'Email': u.email,
            'Роль': common.getRoleName(u.role),
            'Дата регистрации': u.createdAt,
            'Статус': (u.status === 'active' ? 'Активен' : 'Неактивен')
          };
        });
      } else if (isAudit && Array.isArray(data)) {
        payload = data.map(function (l) {
          return {
            'Дата': l.date,
            'Пользователь': l.user,
            'Действие': common.getActionName(l.action),
            'Детали': l.details,
            'IP адрес': l.ip
          };
        });
      }
    } catch (_) {
      payload = data;
    }
    var jsonString = JSON.stringify(payload, null, 2);
    var BOM = '\uFEFF';
    var blob = new Blob([BOM, jsonString], { type: 'application/json;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function exportToExcel(data, filename, type) {
    var common = getCommon();
    var csv = '';
    if (type === 'users') {
      csv = 'ID,Имя,Email,Роль,Дата регистрации,Статус\n';
      data.forEach(function (user) {
        var statusRu = user.status === 'active' ? 'Активен' : 'Неактивен';
        csv += user.id + ',"' + user.name + '","' + user.email + '","' + common.getRoleName(user.role) + '","' + user.createdAt + '","' + statusRu + '"\n';
      });
    } else if (type === 'audit') {
      csv = 'Дата,Пользователь,Действие,Детали,IP адрес\n';
      data.forEach(function (log) {
        csv += '"' + log.date + '","' + log.user + '","' + common.getActionName(log.action) + '","' + log.details + '","' + log.ip + '"\n';
      });
    }
    var BOM = '\uFEFF';
    var blob = new Blob([BOM, csv], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function init() {
    var exportButtons = document.querySelectorAll('[data-export]');
    exportButtons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var exportType = btn.getAttribute('data-export');
        var format = btn.getAttribute('data-format');
        exportData(exportType, format);
      });
    });
  }

  window.AdminExport = {
    init: init,
    exportData: exportData
  };
})();
