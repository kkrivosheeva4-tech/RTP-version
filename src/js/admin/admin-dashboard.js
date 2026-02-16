/**
 * Раздел «Обзор» админ-панели: сводная статистика и графики (Chart.js).
 */
(function () {
  'use strict';

  var usersChart = null;
  var auditChart = null;
  var rolesChart = null;

  function getCommon() {
    return window.AdminCommon;
  }

  function getState() {
    return getCommon().AdminState;
  }

  function withAlpha(color, alpha) {
    var c = String(color || '').trim();
    if (!c) return 'rgba(0,0,0,' + alpha + ')';
    if (c.indexOf('rgba(') === 0) {
      var inner = c.slice(5, -1).split(',').map(function (s) { return s.trim(); });
      if (inner.length >= 3) return 'rgba(' + inner[0] + ', ' + inner[1] + ', ' + inner[2] + ', ' + alpha + ')';
    }
    if (c.indexOf('rgb(') === 0) {
      var inner2 = c.slice(4, -1).split(',').map(function (s) { return s.trim(); });
      if (inner2.length >= 3) return 'rgba(' + inner2[0] + ', ' + inner2[1] + ', ' + inner2[2] + ', ' + alpha + ')';
    }
    if (c.indexOf('#') === 0) {
      var hex = c.slice(1);
      if (hex.length === 3) hex = hex.split('').map(function (ch) { return ch + ch; }).join('');
      if (hex.length === 6) {
        var r = parseInt(hex.slice(0, 2), 16);
        var g = parseInt(hex.slice(2, 4), 16);
        var b = parseInt(hex.slice(4, 6), 16);
        return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + alpha + ')';
      }
    }
    var tmp = document.createElement('span');
    tmp.style.color = c;
    document.body.appendChild(tmp);
    var resolved = getComputedStyle(tmp).color;
    document.body.removeChild(tmp);
    if (resolved && resolved.indexOf('rgb(') === 0) {
      var inner3 = resolved.slice(4, -1).split(',').map(function (s) { return s.trim(); });
      if (inner3.length >= 3) return 'rgba(' + inner3[0] + ', ' + inner3[1] + ', ' + inner3[2] + ', ' + alpha + ')';
    }
    return 'rgba(0,0,0,' + alpha + ')';
  }

  function getChartsThemeColors() {
    var accent = (getComputedStyle(document.documentElement).getPropertyValue('--accent') || '').trim() || '#ce9068';
    var bodyStyles = getComputedStyle(document.body);
    var text = (bodyStyles.getPropertyValue('--text') || bodyStyles.color || '').trim() ||
      (document.body.classList.contains('dark') ? '#ffffff' : '#000000');
    var grid = withAlpha(text, 0.12);
    return { accent: accent, text: text, grid: grid };
  }

  function generateUserRegistrationData() {
    var state = getState();
    var users = state.users || [];
    var labels = [];
    var values = [];
    var today = new Date();
    var createdByDay = {};
    users.forEach(function (u) {
      var d = (u && u.createdAt) ? String(u.createdAt).slice(0, 10) : '';
      if (!d) return;
      createdByDay[d] = (createdByDay[d] || 0) + 1;
    });
    for (var i = 6; i >= 0; i--) {
      var date = new Date(today);
      date.setDate(date.getDate() - i);
      var isoDay = date.toISOString().split('T')[0];
      labels.push(date.toLocaleDateString('ru-RU', { month: 'short', day: 'numeric' }));
      values.push(createdByDay[isoDay] || 0);
    }
    return { labels: labels, values: values };
  }

  function generateAuditData() {
    var state = getState();
    var auditLogs = state.auditLogs || [];
    var common = getCommon();
    var order = ['login', 'logout', 'create', 'update', 'delete', 'export', 'backup'];
    var labels = order.map(function (a) { return common.getActionName(a); });
    var counts = {};
    order.forEach(function (a) { counts[a] = 0; });
    auditLogs.forEach(function (l) {
      var a = (l && l.action) ? String(l.action) : '';
      if (!a) return;
      if (Object.prototype.hasOwnProperty.call(counts, a)) counts[a] += 1;
    });
    var values = order.map(function (a) { return counts[a] || 0; });
    return { labels: labels, values: values };
  }

  function generateRolesData() {
    var state = getState();
    var users = state.users || [];
    var common = getCommon();
    var roleCounts = {};
    users.forEach(function (user) {
      roleCounts[user.role] = (roleCounts[user.role] || 0) + 1;
    });
    var labels = [];
    var values = [];
    Object.keys(roleCounts).forEach(function (role) {
      labels.push(common.getRoleName(role));
      values.push(roleCounts[role]);
    });
    return { labels: labels, values: values };
  }

  function applyChartsTheme() {
    var common = getCommon();
    var colors = getChartsThemeColors();
    var accent = colors.accent;
    var text = colors.text;
    var grid = colors.grid;

    if (usersChart) {
      usersChart.data.datasets[0].borderColor = accent;
      usersChart.data.datasets[0].backgroundColor = withAlpha(accent, 0.12);
      if (usersChart.options && usersChart.options.plugins && usersChart.options.plugins.legend && usersChart.options.plugins.legend.labels) usersChart.options.plugins.legend.labels.color = text;
      if (usersChart.options && usersChart.options.scales && usersChart.options.scales.x && usersChart.options.scales.x.ticks) usersChart.options.scales.x.ticks.color = text;
      if (usersChart.options && usersChart.options.scales && usersChart.options.scales.y && usersChart.options.scales.y.ticks) usersChart.options.scales.y.ticks.color = text;
      if (usersChart.options && usersChart.options.scales && usersChart.options.scales.x && usersChart.options.scales.x.grid) usersChart.options.scales.x.grid.color = grid;
      if (usersChart.options && usersChart.options.scales && usersChart.options.scales.y && usersChart.options.scales.y.grid) usersChart.options.scales.y.grid.color = grid;
      usersChart.update();
    }
    if (auditChart) {
      auditChart.data.datasets[0].backgroundColor = withAlpha(accent, 0.55);
      auditChart.data.datasets[0].borderColor = accent;
      if (auditChart.options && auditChart.options.plugins && auditChart.options.plugins.legend && auditChart.options.plugins.legend.labels) auditChart.options.plugins.legend.labels.color = text;
      if (auditChart.options && auditChart.options.scales && auditChart.options.scales.x && auditChart.options.scales.x.ticks) auditChart.options.scales.x.ticks.color = text;
      if (auditChart.options && auditChart.options.scales && auditChart.options.scales.y && auditChart.options.scales.y.ticks) auditChart.options.scales.y.ticks.color = text;
      if (auditChart.options && auditChart.options.scales && auditChart.options.scales.x && auditChart.options.scales.x.grid) auditChart.options.scales.x.grid.color = grid;
      if (auditChart.options && auditChart.options.scales && auditChart.options.scales.y && auditChart.options.scales.y.grid) auditChart.options.scales.y.grid.color = grid;
      auditChart.update();
    }
    if (rolesChart) {
      rolesChart.data.datasets[0].backgroundColor = [accent, withAlpha(accent, 0.70), withAlpha(accent, 0.55), withAlpha(accent, 0.40)];
      rolesChart.data.datasets[0].borderColor = [accent, accent, accent, accent];
      if (rolesChart.options && rolesChart.options.plugins && rolesChart.options.plugins.legend && rolesChart.options.plugins.legend.labels) rolesChart.options.plugins.legend.labels.color = text;
      rolesChart.update();
    }
  }

  function updateDashboardStats() {
    var state = getState();
    var common = getCommon();
    var elTotalUsers = document.getElementById('totalUsers');
    var elActiveSessions = document.getElementById('activeSessions');
    var elAuditEvents = document.getElementById('auditEvents');
    var elBackupCount = document.getElementById('backupCount');
    if (elTotalUsers) elTotalUsers.textContent = (state.users || []).length;
    var isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    var username = localStorage.getItem('username');
    if (elActiveSessions) elActiveSessions.textContent = (isLoggedIn && username) ? 1 : 0;
    if (elAuditEvents) elAuditEvents.textContent = (state.auditLogs || []).length;
    if (elBackupCount) elBackupCount.textContent = (state.backups || []).length;

    if (usersChart) {
      var usersData = generateUserRegistrationData();
      usersChart.data.labels = usersData.labels;
      usersChart.data.datasets[0].data = usersData.values;
      usersChart.update();
    }
    if (auditChart) {
      var auditData = generateAuditData();
      auditChart.data.labels = auditData.labels;
      auditChart.data.datasets[0].data = auditData.values;
      auditChart.update();
    }
    if (rolesChart) {
      var rolesData = generateRolesData();
      rolesChart.data.labels = rolesData.labels;
      rolesChart.data.datasets[0].data = rolesData.values;
      rolesChart.update();
    }
  }

  function initializeCharts() {
    if (typeof window.Chart === 'undefined') return;
    var colors = getChartsThemeColors();
    var accent = colors.accent;
    var textColor = colors.text;
    var gridColor = colors.grid;
    var dpr = Math.max(1, Math.min(3, (window.devicePixelRatio || 1)));

    var usersCtx = document.getElementById('usersChart');
    if (usersCtx) {
      var usersData = generateUserRegistrationData();
      usersChart = new window.Chart(usersCtx, {
        type: 'line',
        data: {
          labels: usersData.labels,
          datasets: [{
            label: 'Новые пользователи',
            data: usersData.values,
            borderColor: accent,
            backgroundColor: withAlpha(accent, 0.12),
            borderWidth: 2,
            fill: true,
            tension: 0.4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          devicePixelRatio: dpr,
          plugins: { legend: { labels: { color: textColor } } },
          scales: {
            x: { ticks: { color: textColor }, grid: { color: gridColor } },
            y: { ticks: { color: textColor }, grid: { color: gridColor } }
          }
        }
      });
    }

    var auditCtx = document.getElementById('auditChart');
    if (auditCtx) {
      var auditData = generateAuditData();
      auditChart = new window.Chart(auditCtx, {
        type: 'bar',
        data: {
          labels: auditData.labels,
          datasets: [{
            label: 'Количество действий',
            data: auditData.values,
            backgroundColor: withAlpha(accent, 0.55),
            borderColor: accent,
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          devicePixelRatio: dpr,
          plugins: { legend: { labels: { color: textColor } } },
          scales: {
            x: { ticks: { color: textColor }, grid: { color: gridColor } },
            y: { ticks: { color: textColor }, grid: { color: gridColor } }
          }
        }
      });
    }

    var rolesCtx = document.getElementById('rolesChart');
    if (rolesCtx) {
      var rolesData = generateRolesData();
      rolesChart = new window.Chart(rolesCtx, {
        type: 'doughnut',
        data: {
          labels: rolesData.labels,
          datasets: [{
            data: rolesData.values,
            backgroundColor: [accent, withAlpha(accent, 0.70), withAlpha(accent, 0.55), withAlpha(accent, 0.40)],
            borderColor: [accent, accent, accent, accent],
            borderWidth: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          devicePixelRatio: dpr,
          plugins: { legend: { position: 'bottom', labels: { color: textColor, padding: 20 } } }
        }
      });
    }
    applyChartsTheme();
  }

  function init() {
    updateDashboardStats();
    initializeCharts();
  }

  window.AdminDashboard = {
    init: init,
    updateDashboardStats: updateDashboardStats,
    applyChartsTheme: applyChartsTheme
  };
})();
