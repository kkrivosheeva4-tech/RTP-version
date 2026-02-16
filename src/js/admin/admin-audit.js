/**
 * Раздел «Журнал аудита» админ-панели: загрузка из localStorage, пагинация, фильтры.
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

  function normalizeAuditLogs(list) {
    if (!Array.isArray(list)) return [];
    var didMigrate = false;
    var nextId = 1;
    var used = {};

    function pad2(n) {
      var v = Number(n) || 0;
      return v < 10 ? '0' + v : String(v);
    }

    function formatLocalAuditTimestamp(d) {
      try {
        var y = d.getFullYear();
        var m = pad2(d.getMonth() + 1);
        var day = pad2(d.getDate());
        var hh = pad2(d.getHours());
        var mm = pad2(d.getMinutes());
        var ss = pad2(d.getSeconds());
        return y + '-' + m + '-' + day + ' ' + hh + ':' + mm + ':' + ss;
      } catch (_) {
        return '';
      }
    }

    function normalizeAuditDate(raw, tz) {
      var s = (raw != null ? String(raw) : '').trim();
      var m = s.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
      if (m) {
        var y = Number(m[1]);
        var mo = Number(m[2]);
        var d = Number(m[3]);
        var hh = Number(m[4]);
        var mm = Number(m[5]);
        var ss = Number(m[6]);
        if (tz === 'local') return s;
        var dt = new Date(Date.UTC(y, mo - 1, d, hh, mm, ss));
        return formatLocalAuditTimestamp(dt) || s;
      }
      var dt2 = new Date(s);
      if (Number.isFinite(dt2.getTime())) return formatLocalAuditTimestamp(dt2) || s;
      return formatLocalAuditTimestamp(new Date()) || s || '';
    }

    return list
      .filter(Boolean)
      .map(function (l) {
        var id = Number(l.id);
        if (!Number.isFinite(id) || id <= 0 || used[id]) {
          while (used[nextId]) nextId += 1;
          id = nextId++;
        }
        used[id] = true;
        var tz = (l && l.tz != null ? String(l.tz) : '').trim() || null;
        return {
          id: id,
          date: normalizeAuditDate(l && l.date, tz),
          user: (l.user != null ? String(l.user) : '').trim() || 'system',
          action: (l.action != null ? String(l.action) : '').trim() || 'update',
          details: (l.details != null ? String(l.details) : '').trim() || '',
          tz: 'local',
          ip: (l.ip != null ? String(l.ip) : '').trim() || 'local'
        };
      });
  }

  /** Парсит строку даты журнала в timestamp (мс). Поддерживает "YYYY-MM-DD HH:mm:ss" и варианты с 1 цифрой. */
  function parseAuditDateToTime(s) {
    if (!s || typeof s !== 'string') return NaN;
    var str = s.trim();
    var m = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{1,2}):(\d{1,2})$/);
    if (m) {
      return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6])).getTime();
    }
    var d = new Date(str);
    return (d && Number.isFinite(d.getTime())) ? d.getTime() : NaN;
  }

  function getAuditDateBoundsFromUi() {
    var elFrom = document.getElementById('auditDateFrom');
    var elTo = document.getElementById('auditDateTo');
    var dateFrom = (elFrom && elFrom.value) ? elFrom.value.trim() : '';
    var dateTo = (elTo && elTo.value) ? elTo.value.trim() : '';
    var lower = dateFrom ? dateFrom + ' 00:00:00' : null;
    var upper = dateTo ? dateTo + ' 23:59:59' : null;
    var lowerTime = lower ? parseAuditDateToTime(lower) : null;
    var upperTime = upper ? parseAuditDateToTime(upper) : null;
    if (upperTime !== null && !Number.isFinite(upperTime)) upperTime = null;
    if (lowerTime !== null && !Number.isFinite(lowerTime)) lowerTime = null;
    return { dateFrom: dateFrom, dateTo: dateTo, lower: lower, upper: upper, lowerTime: lowerTime, upperTime: upperTime };
  }

  function getUserRoleCodeByName(userName) {
    if (!userName) return null;
    var state = getState();
    var users = state.users || [];
    var name = String(userName).trim().toLowerCase();
    for (var i = 0; i < users.length; i++) {
      if (String(users[i].name).trim().toLowerCase() === name) return users[i].role;
    }
    return null;
  }

  function getFilteredAuditLogs() {
    var state = getState();
    var common = getCommon();
    var bounds = getAuditDateBoundsFromUi();
    var lowerTime = bounds.lowerTime;
    var upperTime = bounds.upperTime;
    var userSearch = (document.getElementById('auditUserSearch') && document.getElementById('auditUserSearch').value) ? document.getElementById('auditUserSearch').value.trim().toLowerCase() : '';
    var actionFilter = (document.getElementById('auditActionFilter') && document.getElementById('auditActionFilter').value) ? document.getElementById('auditActionFilter').value.trim() : '';
    var auditLogs = state.auditLogs || [];
    return auditLogs.filter(function (log) {
      var matchesDate = true;
      var matchesUser = true;
      var matchesAction = true;
      if (lowerTime != null || upperTime != null) {
        var logTime = parseAuditDateToTime(log.date);
        if (!Number.isFinite(logTime)) matchesDate = false;
        else {
          if (lowerTime != null && logTime < lowerTime) matchesDate = false;
          if (upperTime != null && logTime > upperTime) matchesDate = false;
        }
      }
      if (userSearch) {
        var userName = String(log.user || '').toLowerCase();
        var roleCode = getUserRoleCodeByName(log.user);
        var roleName = roleCode ? common.getRoleName(roleCode) : '';
        var roleNameLc = String(roleName || '').toLowerCase();
        var roleCodeLc = String(roleCode || '').toLowerCase();
        matchesUser = userName.indexOf(userSearch) !== -1 || roleNameLc.indexOf(userSearch) !== -1 || roleCodeLc.indexOf(userSearch) !== -1;
      }
      if (actionFilter) matchesAction = String(log.action || '') === actionFilter;
      return matchesDate && matchesUser && matchesAction;
    });
  }

  function updateAuditPaginationUi(totalItems) {
    var state = getState();
    var pageSize = state.AUDIT_PAGE_SIZE || 30;
    var pageInfo = document.getElementById('auditPageInfo');
    var recordsInfo = document.getElementById('auditRecordsInfo');
    var prevBtn = document.getElementById('auditPrevPage');
    var nextBtn = document.getElementById('auditNextPage');
    var total = Number(totalItems) || 0;
    var totalPages = Math.max(1, Math.ceil(total / pageSize));
    state.auditCurrentPage = Math.min(Math.max(1, Number(state.auditCurrentPage) || 1), totalPages);
    if (pageInfo) pageInfo.textContent = 'Страница ' + state.auditCurrentPage + ' из ' + totalPages;
    if (recordsInfo) recordsInfo.textContent = 'Показано: ' + Math.min(pageSize, Math.max(0, total - ((state.auditCurrentPage - 1) * pageSize))) + ' из ' + total;
    if (prevBtn) prevBtn.disabled = state.auditCurrentPage <= 1;
    if (nextBtn) nextBtn.disabled = state.auditCurrentPage >= totalPages;
  }

  function clearAuditLogsByPeriod() {
    var common = getCommon();
    var state = getState();
    var bounds = getAuditDateBoundsFromUi();
    var dateFrom = bounds.dateFrom;
    var dateTo = bounds.dateTo;
    var lower = bounds.lower;
    var upper = bounds.upper;
    if (!lower && !upper) {
      common.showNotification('Очистка', 'Укажите "Дата от" и/или "Дата до" для очистки за период', 'error');
      return;
    }
    if (dateFrom && dateTo && dateFrom > dateTo) {
      common.showNotification('Очистка', 'Некорректный период: "Дата от" больше "Дата до"', 'error');
      return;
    }
    var periodLabel = (dateFrom || '...') + ' — ' + (dateTo || '...');
    var lowerTime = bounds.lowerTime;
    var upperTime = bounds.upperTime;
    common.showConfirmModal(
      'Очистка журнала аудита',
      'Очистить журнал аудита за период: ' + periodLabel + '?',
      function () {
        state.auditLogs = normalizeAuditLogs(getCommon().readStorageJson(getCommon().ADMIN_STORAGE.AUDIT, []));
        var before = state.auditLogs.length;
        var kept = state.auditLogs.filter(function (log) {
          var logTime = parseAuditDateToTime(log.date);
          if (!Number.isFinite(logTime)) return true;
          if (lowerTime != null && logTime < lowerTime) return true;
          if (upperTime != null && logTime > upperTime) return true;
          return false;
        });
        var removed = before - kept.length;
        state.auditLogs = kept;
        getCommon().persistAuditLogs();
        state.auditCurrentPage = 1;
        addAuditLog('delete', 'Очищен журнал аудита за период ' + periodLabel + '. Удалено записей: ' + removed);
        common.showNotification('Очистка', 'Удалено записей: ' + removed, 'success');
        loadAuditLogs();
        if (window.AdminDashboard && typeof window.AdminDashboard.updateDashboardStats === 'function') {
          window.AdminDashboard.updateDashboardStats();
        }
      }
    );
  }

  function loadAuditLogs() {
    var state = getState();
    var common = getCommon();
    var tbody = document.getElementById('auditTableBody');
    if (!tbody) return;
    var raw = common.readStorageJson(common.ADMIN_STORAGE.AUDIT, []);
    var normalized = normalizeAuditLogs(raw);
    state.auditLogs = normalized;
    try {
      if (Array.isArray(raw) && raw.some(function (l) { return l && !('tz' in l); })) {
        common.persistAuditLogs();
      }
    } catch (_) { }
    tbody.innerHTML = '';
    var filteredLogs = getFilteredAuditLogs();
    var bounds = getAuditDateBoundsFromUi();
    var hasDateFilter = !!(bounds.dateFrom || bounds.dateTo);
    var pageSize = state.AUDIT_PAGE_SIZE || 30;
    updateAuditPaginationUi(filteredLogs.length);
    var start = (state.auditCurrentPage - 1) * pageSize;
    var pageLogs = filteredLogs.slice(start, start + pageSize);

    if (filteredLogs.length === 0 && hasDateFilter) {
      var emptyRow = document.createElement('tr');
      var emptyCell = document.createElement('td');
      emptyCell.setAttribute('colspan', '5');
      emptyCell.className = 'audit-empty-message';
      emptyCell.textContent = 'Нет данных за выбранный период. Измените даты или очистите фильтр.';
      emptyRow.appendChild(emptyCell);
      tbody.appendChild(emptyRow);
    } else {
      pageLogs.forEach(function (log) {
        var row = document.createElement('tr');
        var tdDate = document.createElement('td');
        tdDate.textContent = common.formatDateTime(log.date);
        row.appendChild(tdDate);
        var tdUser = document.createElement('td');
        tdUser.textContent = log.user;
        row.appendChild(tdUser);
        var tdAction = document.createElement('td');
        var actionBadge = document.createElement('span');
        actionBadge.className = 'status-badge ' + common.getActionClass(log.action);
        actionBadge.textContent = common.getActionName(log.action);
        tdAction.appendChild(actionBadge);
        row.appendChild(tdAction);
        var tdDetails = document.createElement('td');
        tdDetails.textContent = log.details;
        row.appendChild(tdDetails);
        var tdIp = document.createElement('td');
        tdIp.textContent = log.ip;
        row.appendChild(tdIp);
        tbody.appendChild(row);
      });
    }
  }

  function init() {
    var common = getCommon();
    var state = getState();
    var dateFrom = document.getElementById('auditDateFrom');
    var dateTo = document.getElementById('auditDateTo');
    var userSearch = document.getElementById('auditUserSearch');
    var actionFilter = document.getElementById('auditActionFilter');
    var clearAuditPeriodBtn = document.getElementById('clearAuditPeriod');
    var prevPageBtn = document.getElementById('auditPrevPage');
    var nextPageBtn = document.getElementById('auditNextPage');
    function applyAuditDateFilter() {
      state.auditCurrentPage = 1;
      loadAuditLogs();
    }
    if (dateFrom) {
      common.lockDateInputToPicker(dateFrom);
      dateFrom.addEventListener('change', applyAuditDateFilter);
      dateFrom.addEventListener('input', applyAuditDateFilter);
    }
    if (dateTo) {
      common.lockDateInputToPicker(dateTo);
      dateTo.addEventListener('change', applyAuditDateFilter);
      dateTo.addEventListener('input', applyAuditDateFilter);
    }
    if (userSearch) userSearch.addEventListener('input', function () { state.auditCurrentPage = 1; loadAuditLogs(); });
    if (actionFilter) actionFilter.addEventListener('change', function () { state.auditCurrentPage = 1; loadAuditLogs(); });
    if (clearAuditPeriodBtn) clearAuditPeriodBtn.addEventListener('click', function () { clearAuditLogsByPeriod(); });
    if (prevPageBtn) {
      prevPageBtn.addEventListener('click', function () {
        state.auditCurrentPage = Math.max(1, (Number(state.auditCurrentPage) || 1) - 1);
        loadAuditLogs();
      });
    }
    if (nextPageBtn) {
      nextPageBtn.addEventListener('click', function () {
        state.auditCurrentPage = (Number(state.auditCurrentPage) || 1) + 1;
        loadAuditLogs();
      });
    }
    loadAuditLogs();
  }

  window.AdminAudit = {
    init: init,
    loadAuditLogs: loadAuditLogs,
    normalizeAuditLogs: normalizeAuditLogs
  };
})();
