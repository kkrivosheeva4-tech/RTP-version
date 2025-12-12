// ===== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ И КОНФИГУРАЦИЯ =====
let users = [];
let auditLogs = [];
let backups = [];
let currentUserId = null;
let currentSection = 'dashboard';
// Mock данные
const mockUsers = [
  { id: 1, name: "Иван Петров", email: "ivan@example.com", role: "admin", status: "active", createdAt: "2024-01-15" },
  { id: 2, name: "Мария Сидорова", email: "maria@example.com", role: "architect", status: "active", createdAt: "2024-01-20" },
  { id: 3, name: "Алексей Козлов", email: "alexey@example.com", role: "user", status: "active", createdAt: "2024-02-01" },
  { id: 4, name: "Елена Новикова", email: "elena@example.com", role: "user", status: "inactive", createdAt: "2024-02-10" }
];
const mockAuditLogs = [
  { id: 1, date: "2024-03-15 10:30:00", user: "Иван Петров", action: "login", details: "Успешный вход в систему", ip: "192.168.1.100" },
  { id: 2, date: "2024-03-16 10:35:00", user: "Мария Сидорова", action: "create", details: "Создан новый пользователь", ip: "192.168.1.101" },
  { id: 3, date: "2024-03-17 11:00:00", user: "Алексей Козлов", action: "update", details: "Изменены настройки профиля", ip: "192.168.1.102" },
  { id: 4, date: "2024-03-18 11:15:00", user: "Иван Петров", action: "delete", details: "Удален пользователь #5", ip: "192.168.1.100" },
  { id: 5, date: "2024-03-19 11:30:00", user: "Елена Новикова", action: "logout", details: "Выход из системы", ip: "192.168.1.103" }
];
const mockBackups = [
  { id: 1, name: "backup_2024_03_15_120000", date: "2024-03-15 12:00:00", size: "2.5 MB" },
  { id: 2, name: "backup_2024_03_14_120000", date: "2024-03-14 12:00:00", size: "2.3 MB" },
  { id: 3, name: "backup_2024_03_13_120000", date: "2024-03-13 12:00:00", size: "2.1 MB" }
];
// ===== ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ =====
document.addEventListener('DOMContentLoaded', function() {
  initializeApp();
});

function initializeApp() {
  // Проверка авторизации
  checkAdminAccess();
  // Инициализация темы
  initializeTheme();
  // Инициализация навигации
  initializeNavigation();
  // Инициализация модальных окон
  initializeModals();
  // Инициализация уведомлений
  initializeNotifications();
  // Загрузка данных
  loadMockData();
  // Инициализация всех секций
  initializeDashboard();
  initializeUsers();
  initializeAudit();
  initializeExport();
  initializeBackup();
  // Показать дашборд по умолчанию
  showSection('dashboard');
}
// ===== ПРОВЕРКА АВТОРИЗАЦИИ =====
function checkAdminAccess() {
  const role = localStorage.getItem("role");
  if (role !== "admin" && role !== "architect") {
    showNotification("Ошибка доступа", "У вас нет прав для доступа к админ панели", "error");
    setTimeout(() => {
      window.location.href = "index.html";
    }, 2000);
    return false;
  }
  return true;
}
// ===== ТЕМА =====
function initializeTheme() {
  const themeToggle = document.getElementById("themeToggle");
  const savedTheme = localStorage.getItem("theme") || "light";
  document.body.className = savedTheme;
  if (themeToggle) {
    themeToggle.checked = savedTheme === "dark";
    themeToggle.addEventListener("change", () => {
      const theme = themeToggle.checked ? "dark" : "light";
      document.body.className = theme;
      localStorage.setItem("theme", theme);
      // Обновляем графики при смене темы
      setTimeout(() => {
        if (usersChart) usersChart.update();
        if (auditChart) auditChart.update();
        if (rolesChart) rolesChart.update();
      }, 100);
    });
  }
  // Рендер информации об авторизации
  renderAuth();
}
function renderAuth() {
  const authInfo = document.getElementById("authInfo");
  const logoutContainer = document.getElementById("logoutContainer");
  const role = localStorage.getItem("role");
  if (role === "admin" || role === "architect") {
    const roleName = role === "admin" ? "Администратор" : "Архитектор";
    if (authInfo) {
      authInfo.innerHTML = `<div class="user-role">${roleName}</div>`;
    }
    if (logoutContainer) {
      logoutContainer.innerHTML = `<button class="logout" data-tooltip="Выйти" aria-label="Выйти">
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
        <polyline points="16,17 21,12 16,7"/>
        <line x1="21" y1="12" x2="9" y2="12"/>
      </svg>
    </button>`;
      logoutContainer.querySelector(".logout").onclick = () => {
        const theme = localStorage.getItem('theme');
        localStorage.clear();
        if (theme) localStorage.setItem('theme', theme);
        window.location.href = "index.html";
      };
    }
  }
}
// ===== НАВИГАЦИЯ =====
function initializeNavigation() {
  const menuItems = document.querySelectorAll('.menu-item');
  menuItems.forEach(item => {
    item.addEventListener('click', () => {
      const section = item.dataset.section;
      showSection(section);
      // Обновляем активный элемент меню
      menuItems.forEach(mi => mi.classList.remove('active'));
      item.classList.add('active');
    });
  });
  // Навигация по предприятиям
  const nav = document.querySelector('.enterprise-nav');
  if (nav) {
    nav.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        const text = btn.textContent.trim();
        if (text === 'РМК') {
          window.location.href = 'RMK.html';
        }
      });
    });
  }
}
function showSection(sectionId) {
  // Скрыть все секции
  document.querySelectorAll('.content-section').forEach(section => {
    section.classList.remove('active');
  });
  // Показать нужную секцию
  const targetSection = document.getElementById(sectionId);
  if (targetSection) {
    targetSection.classList.add('active');
    currentSection = sectionId;
  }
}
// ===== ЗАГРУЗКА ДАННЫХ =====
function loadMockData() {
  users = [...mockUsers];
  auditLogs = [...mockAuditLogs];
  backups = [...mockBackups];
}
// ===== ДАШБОРД =====
let usersChart, auditChart, rolesChart;
function initializeDashboard() {
  updateDashboardStats();
  initializeCharts();
}
function updateDashboardStats() {
  document.getElementById('totalUsers').textContent = users.length;
  document.getElementById('activeSessions').textContent = Math.floor(Math.random() * 50) + 10;
  document.getElementById('auditEvents').textContent = auditLogs.length;
  document.getElementById('backupCount').textContent = backups.length;
  // Обновляем графики если они существуют
  if (rolesChart) {
    const rolesData = generateRolesData();
    rolesChart.data.labels = rolesData.labels;
    rolesChart.data.datasets[0].data = rolesData.values;
    rolesChart.update();
  }
}
function initializeCharts() {
  // Получаем цвета из CSS переменных
  const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--primary-color').trim();
  const textColor = getComputedStyle(document.documentElement).getPropertyValue('--text-color').trim();
  const textSecondary = getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim();
  // График динамики регистрации пользователей
  const usersCtx = document.getElementById('usersChart');
  if (usersCtx) {
    const usersData = generateUserRegistrationData();
    usersChart = new Chart(usersCtx, {
      type: 'line',
      data: {
        labels: usersData.labels,
        datasets: [{
          label: 'Новые пользователи',
          data: usersData.values,
          borderColor: primaryColor,
          backgroundColor: primaryColor + '20',
          borderWidth: 2,
          fill: true,
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        aspectRatio: 2,
        plugins: {
          legend: {
            labels: {
              color: textColor
            }
          }
        },
        scales: {
          x: {
            ticks: {
              color: textSecondary
            },
            grid: {
              color: textSecondary + '20'
            }
          },
          y: {
            ticks: {
              color: textSecondary
            },
            grid: {
              color: textSecondary + '20'
            }
          }
        }
      }
    });
  }
  // График действий в журнале аудита
  const auditCtx = document.getElementById('auditChart');
  if (auditCtx) {
    const auditData = generateAuditData();
    auditChart = new Chart(auditCtx, {
      type: 'bar',
      data: {
        labels: auditData.labels,
        datasets: [{
          label: 'Количество действий',
          data: auditData.values,
          backgroundColor: primaryColor + '80',
          borderColor: primaryColor,
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        aspectRatio: 2,
        plugins: {
          legend: {
            labels: {
              color: textColor
            }
          }
        },
        scales: {
          x: {
            ticks: {
              color: textSecondary
            },
            grid: {
              color: textSecondary + '20'
            }
          },
          y: {
            ticks: {
              color: textSecondary
            },
            grid: {
              color: textSecondary + '20'
            }
          }
        }
      }
    });
  }
  // Пироговая диаграмма распределения ролей
  const rolesCtx = document.getElementById('rolesChart');
  if (rolesCtx) {
    const rolesData = generateRolesData();
    rolesChart = new Chart(rolesCtx, {
      type: 'doughnut',
      data: {
        labels: rolesData.labels,
        datasets: [{
          data: rolesData.values,
          backgroundColor: [
            primaryColor,
            primaryColor + '80',
            primaryColor + '60',
            primaryColor + '40'
          ],
          borderColor: [
            primaryColor,
            primaryColor,
            primaryColor,
            primaryColor
          ],
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        aspectRatio: 2,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: textColor,
              padding: 20
            }
          }
        }
      }
    });
  }
}
function generateUserRegistrationData() {
  const labels = [];
  const values = [];
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    labels.push(date.toLocaleDateString('ru-RU', { month: 'short', day: 'numeric' }));
    values.push(Math.floor(Math.random() * 10) + 1);
  }
  return { labels, values };
}
function generateAuditData() {
  const labels = ['Вход', 'Выход', 'Создание', 'Изменение', 'Удаление'];
  const values = [25, 15, 8, 12, 3];
  return { labels, values };
}
function generateRolesData() {
  const roleCounts = users.reduce((acc, user) => {
    acc[user.role] = (acc[user.role] || 0) + 1;
    return acc;
  }, {});
  const labels = [];
  const values = [];
  Object.entries(roleCounts).forEach(([role, count]) => {
    labels.push(getRoleName(role));
    values.push(count);
  });
  return { labels, values };
}
// ===== УПРАВЛЕНИЕ ПОЛЬЗОВАТЕЛЯМИ =====
function initializeUsers() {
  const userSearch = document.getElementById('userSearch');
  const roleFilter = document.getElementById('roleFilter');
  const refreshUsers = document.getElementById('refreshUsers');
  if (userSearch) {
    userSearch.addEventListener('input', () => filterUsers());
  }
  if (roleFilter) {
    roleFilter.addEventListener('change', () => filterUsers());
  }
  if (refreshUsers) {
    refreshUsers.addEventListener('click', () => {
      const icon = refreshUsers.querySelector('.refresh-icon');
      icon.classList.add('spin');
      // Имитация задержки обновления
      setTimeout(() => {
        loadUsers();
        icon.classList.remove('spin');
        showNotification("Успешно", "Данные успешно обновлены", "success");
      }, 1000); // 1 секунда задержка
    });
  }
  loadUsers();
}
function loadUsers() {
  const tbody = document.getElementById('usersTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';
  const search = document.getElementById('userSearch').value.toLowerCase();
  const roleFilter = document.getElementById('roleFilter').value;
  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(search) ||
                         user.email.toLowerCase().includes(search);
    const matchesRole = !roleFilter || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });
  filteredUsers.forEach(user => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${user.id}</td>
      <td>${user.name}</td>
      <td>${user.email}</td>
      <td><span class="status-badge ${getRoleClass(user.role)}">${getRoleName(user.role)}</span></td>
      <td>${formatDate(user.createdAt)}</td>
      <td><span class="status-badge ${user.status === 'active' ? 'status-active' : 'status-inactive'}">${user.status === 'active' ? 'Активен' : 'Неактивен'}</span></td>
      <td>
        <div class="action-buttons">
          <button class="action-btn edit-btn" onclick="editUser(${user.id})" data-tooltip="Редактировать">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
          </button>
          <button class="action-btn delete-btn" onclick="deleteUser(${user.id})" data-tooltip="Удалить">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3,6 5,6 21,6"></polyline>
              <path d="M19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"></path>
              <line x1="10" y1="11" x2="10" y2="17"></line>
              <line x1="14" y1="11" x2="14" y2="17"></line>
            </svg>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(row);
  });
}
function filterUsers() {
  // Фильтрация теперь происходит в loadUsers
  loadUsers();
}
function getRoleName(role) {
  const roles = {
    'admin': 'Администратор',
    'architect': 'Архитектор',
    'user': 'Пользователь'
  };
  return roles[role] || role;
}
function getRoleClass(role) {
  const classes = {
    'admin': 'status-active',
    'architect': 'status-active',
    'user': 'status-inactive'
  };
  return classes[role] || 'status-inactive';
}
function editUser(userId) {
  const user = users.find(u => u.id === userId);
  if (!user) return;
  currentUserId = userId;
  document.getElementById('userModalTitle').textContent = 'Редактировать пользователя';
  document.getElementById('userName').value = user.name;
  document.getElementById('userEmail').value = user.email;
  document.getElementById('userRole').value = user.role;
  showModal('userModal');
}
function deleteUser(userId) {
  const user = users.find(u => u.id === userId);
  if (!user) return;
  showConfirmModal(
    'Удаление пользователя',
    `Вы уверены, что хотите удалить пользователя "${user.name}"?`,
    () => {
      users = users.filter(u => u.id !== userId);
      loadUsers();
      updateDashboardStats();
      addAuditLog('delete', `Удален пользователь "${user.name}"`);
      showNotification("Успешно", "Пользователь удален", "success");
    }
  );
}
function openUserModal() {
  currentUserId = null;
  document.getElementById('userModalTitle').textContent = 'Добавить пользователя';
  document.getElementById('userForm').reset();
  document.getElementById('userPassword').required = true;
  showModal('userModal');
}
// ===== ЖУРНАЛ АУДИТА =====
function initializeAudit() {
  const dateFrom = document.getElementById('auditDateFrom');
  const dateTo = document.getElementById('auditDateTo');
  const userFilter = document.getElementById('auditUserFilter');
  const actionFilter = document.getElementById('auditActionFilter');
  const refreshAudit = document.getElementById('refreshAudit');

  if (dateFrom) dateFrom.addEventListener('change', () => filterAuditLogs());
  if (dateTo) dateTo.addEventListener('change', () => filterAuditLogs());
  if (userFilter) userFilter.addEventListener('change', () => filterAuditLogs());
  if (actionFilter) actionFilter.addEventListener('change', () => filterAuditLogs());

  if (refreshAudit) {
    refreshAudit.addEventListener('click', () => {
      const icon = refreshAudit.querySelector('.refresh-icon');
      icon.classList.add('spin');
      // Имитация задержки обновления
      setTimeout(() => {
        loadAuditLogs();
        icon.classList.remove('spin');
        showNotification("Успешно", "Данные успешно обновлены", "success");
      }, 1000); // 1 секунда задержка
    });
  }
  // Заполняем фильтр пользователей
  populateUserFilter();
  loadAuditLogs();
}
function populateUserFilter() {
  const userFilter = document.getElementById('auditUserFilter');
  if (!userFilter) return;
  const uniqueUsers = [...new Set(auditLogs.map(log => log.user))];
  userFilter.innerHTML = '<option value="">Все пользователи</option>'; // Очищаем и добавляем опцию "Все"
  uniqueUsers.forEach(user => {
    const option = document.createElement('option');
    option.value = user;
    option.textContent = user;
    userFilter.appendChild(option);
  });
}
function loadAuditLogs() {
  const tbody = document.getElementById('auditTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';
  const dateFrom = document.getElementById('auditDateFrom').value;
  const dateTo = document.getElementById('auditDateTo').value;
  const userFilter = document.getElementById('auditUserFilter').value;
  const actionFilter = document.getElementById('auditActionFilter').value;

  const filteredLogs = auditLogs.filter(log => {
    let matchesDate = true;
    let matchesUser = true;
    let matchesAction = true;

    if (dateFrom) {
      matchesDate = log.date >= `${dateFrom} 00:00:00`;
    }
    if (dateTo) {
      matchesDate = matchesDate && log.date <= `${dateTo} 23:59:59`;
    }
    if (userFilter) {
      matchesUser = log.user === userFilter;
    }
    if (actionFilter) {
      matchesAction = log.action === actionFilter;
    }

    return matchesDate && matchesUser && matchesAction;
  });

  filteredLogs.forEach(log => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${formatDateTime(log.date)}</td>
      <td>${log.user}</td>
      <td><span class="status-badge ${getActionClass(log.action)}">${getActionName(log.action)}</span></td>
      <td>${log.details}</td>
      <td>${log.ip}</td>
    `;
    tbody.appendChild(row);
  });
}
function filterAuditLogs() {
  // Фильтрация теперь происходит в loadAuditLogs
  loadAuditLogs();
}
function getActionName(action) {
  const actions = {
    'login': 'Вход',
    'logout': 'Выход',
    'create': 'Создание',
    'update': 'Изменение',
    'delete': 'Удаление'
  };
  return actions[action] || action;
}
function getActionClass(action) {
  const classes = {
    'login': 'status-active',
    'logout': 'status-inactive',
    'create': 'status-active',
    'update': 'status-active',
    'delete': 'status-inactive'
  };
  return classes[action] || 'status-inactive';
}
// ===== ЭКСПОРТ =====
function initializeExport() {
  const exportButtons = document.querySelectorAll('[data-export]');
  exportButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const exportType = btn.dataset.export;
      const format = btn.dataset.format;
      exportData(exportType, format);
    });
  });
}
function exportData(type, format) {
  let data, filename;
  if (type === 'users') {
    data = users;
    filename = `users_${new Date().toISOString().split('T')[0]}`;
  } else if (type === 'audit') {
    data = auditLogs;
    filename = `audit_logs_${new Date().toISOString().split('T')[0]}`;
  }
  if (format === 'json') {
    exportToJSON(data, filename);
  } else if (format === 'excel') {
    exportToExcel(data, filename, type);
  }
  addAuditLog('export', `Экспорт ${type} в формате ${format}`);
  showNotification("Экспорт", `Данные экспортированы в формате ${format.toUpperCase()}`, "success");
}
function exportToJSON(data, filename) {
  const jsonString = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
function exportToExcel(data, filename, type) {
  // Простая реализация экспорта в CSV (как Excel)
  let csv = '';
  if (type === 'users') {
    csv = 'ID,Имя,Email,Роль,Дата регистрации,Статус\n';
    data.forEach(user => {
      csv += `${user.id},"${user.name}","${user.email}","${getRoleName(user.role)}","${user.createdAt}","${user.status}"\n`;
    });
  } else if (type === 'audit') {
    csv = 'Дата,Пользователь,Действие,Детали,IP адрес\n';
    data.forEach(log => {
      csv += `"${log.date}","${log.user}","${getActionName(log.action)}","${log.details}","${log.ip}"\n`;
    });
  }
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
// ===== РЕЗЕРВНЫЕ КОПИИ =====
function initializeBackup() {
  const createBackupBtn = document.getElementById('createBackupBtn');
  if (createBackupBtn) {
    createBackupBtn.addEventListener('click', createBackup);
  }
  loadBackups();
}
function loadBackups() {
  const backupList = document.getElementById('backupList');
  if (!backupList) return;
  backupList.innerHTML = '';
  backups.forEach(backup => {
    const template = document.getElementById('backupTemplate');
    const backupItem = template.cloneNode(true);
    backupItem.style.display = 'flex';
    backupItem.id = `backup-${backup.id}`;
    backupItem.querySelector('.backup-name').textContent = backup.name;
    backupItem.querySelector('.backup-date').textContent = formatDateTime(backup.date);
    backupItem.querySelector('.backup-size').textContent = backup.size;
    backupItem.querySelector('.backup-restore-btn').addEventListener('click', () => restoreBackup(backup.id));
    backupItem.querySelector('.backup-delete-btn').addEventListener('click', () => deleteBackup(backup.id));
    backupList.appendChild(backupItem);
  });
}
function createBackup() {
  const backupName = `backup_${new Date().toISOString().replace(/[-:]/g, '_').split('.')[0]}`;
  const backupDate = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const backupSize = `${(Math.random() * 3 + 1).toFixed(1)} MB`;
  const newBackup = {
    id: backups.length + 1,
    name: backupName,
    date: backupDate,
    size: backupSize
  };
  backups.unshift(newBackup);
  loadBackups();
  updateDashboardStats();
  addAuditLog('create', `Создана резервная копия: ${backupName}`);
  showNotification("Резервная копия", "Резервная копия успешно создана", "success");
}
function restoreBackup(backupId) {
  const backup = backups.find(b => b.id === backupId);
  if (!backup) return;
  showConfirmModal(
    'Восстановление из резервной копии',
    `Вы уверены, что хотите восстановить систему из копии "${backup.name}"?`,
    () => {
      addAuditLog('update', `Восстановление из резервной копии: ${backup.name}`);
      showNotification("Восстановление", "Система восстановлена из резервной копии", "success");
    }
  );
}
function deleteBackup(backupId) {
  const backup = backups.find(b => b.id === backupId);
  if (!backup) return;
  showConfirmModal(
    'Удаление резервной копии',
    `Вы уверены, что хотите удалить копию "${backup.name}"?`,
    () => {
      backups = backups.filter(b => b.id !== backupId);
      loadBackups();
      updateDashboardStats();
      addAuditLog('delete', `Удалена резервная копия: ${backup.name}`);
      showNotification("Удаление", "Резервная копия удалена", "success");
    }
  );
}
// ===== МОДАЛЬНЫЕ ОКНА =====
function initializeModals() {
  // Модальное окно пользователя
  const userModal = document.getElementById('userModal');
  const userForm = document.getElementById('userForm');
  const cancelUser = document.getElementById('cancelUser');
  if (userForm) {
    userForm.addEventListener('submit', handleUserSubmit);
  }
  if (cancelUser) {
    cancelUser.addEventListener('click', () => hideModal('userModal'));
  }
  // Модальное окно подтверждения
  const confirmModal = document.getElementById('confirmModal');
  const confirmCancel = document.getElementById('confirmCancel');
  const confirmOk = document.getElementById('confirmOk');
  if (confirmCancel) {
    confirmCancel.addEventListener('click', () => hideModal('confirmModal'));
  }
  if (confirmOk) {
    confirmOk.addEventListener('click', handleConfirm);
  }
  // Закрытие модальных окон по клику вне области
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
      hideModal(e.target.id);
    }
  });
  // Закрытие по Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      hideModal('userModal');
      hideModal('confirmModal');
    }
  });
}
function showModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('show');
    modal.style.display = 'flex';
  }
}
function hideModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('show');
    modal.style.display = 'none';
  }
}
function handleUserSubmit(e) {
  e.preventDefault();
  const formData = {
    name: document.getElementById('userName').value,
    email: document.getElementById('userEmail').value,
    role: document.getElementById('userRole').value,
    password: document.getElementById('userPassword').value
  };
  // Валидация
  if (!formData.name || !formData.email || !formData.role) {
    showNotification("Ошибка", "Заполните все обязательные поля", "error");
    return;
  }
  if (currentUserId) {
    // Редактирование - только роль
    const userIndex = users.findIndex(u => u.id === currentUserId);
    if (userIndex !== -1) {
      const oldRole = users[userIndex].role;
      users[userIndex].role = formData.role;
      localStorage.setItem('adminUsers', JSON.stringify(users));
      loadUsers();
      addAuditLog('update', `Изменена роль пользователя: ${users[userIndex].name} (${oldRole} -> ${formData.role})`);
      showNotification("Успешно", "Роль пользователя обновлена", "success");
    }
  } else {
    // Создание
    const newUser = {
      id: Math.max(...users.map(u => u.id)) + 1,
      name: formData.name,
      email: formData.email,
      role: formData.role,
      status: 'active',
      createdAt: new Date().toISOString().split('T')[0]
    };
    users.push(newUser);
    addAuditLog('create', `Создан новый пользователь: ${formData.name}`);
    showNotification("Успешно", "Пользователь создан", "success");
  }
  hideModal('userModal');
  loadUsers();
  updateDashboardStats();
}
let confirmCallback = null;
function showConfirmModal(title, message, callback) {
  document.querySelector('#confirmModal .modal-header h3').textContent = title;
  document.getElementById('confirmMessage').textContent = message;
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
// ===== УВЕДОМЛЕНИЯ =====
function initializeNotifications() {
  // Автоматическое скрытие уведомлений через 5 секунд
  setInterval(() => {
    const notifications = document.querySelectorAll('.notification');
    notifications.forEach(notification => {
      if (!notification.classList.contains('persistent')) {
        hideNotification(notification);
      }
    });
  }, 5000);
}
function showNotification(title, message, type = 'info', persistent = false) {
  let panel = document.getElementById('notificationPanel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'notificationPanel';
    panel.className = 'notification-panel';
    document.body.appendChild(panel);
  }
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  if (persistent) notification.classList.add('persistent');
  notification.innerHTML = `
    <div class="notification-title">${title}</div>
    <div class="notification-message">${message}</div>
    <button class="notification-close" onclick="hideNotification(this.parentElement)">&times;</button>
  `;
  // Новые уведомления накладываются поверх старых: appendChild + управляем z-index
  const topZ = parseInt(panel.getAttribute('data-top-z') || '2000', 10) + 1;
  panel.setAttribute('data-top-z', String(topZ));
  notification.style.zIndex = String(topZ);
  panel.appendChild(notification);
  // Автоматическое скрытие через 5 секунд
  if (!persistent) {
    setTimeout(() => hideNotification(notification), 5000);
  }
}
function hideNotification(notification) {
  if (notification && notification.parentElement) {
    notification.style.animation = 'slideOutRight 0.3s ease';
    setTimeout(() => {
      if (notification.parentElement) {
        notification.parentElement.removeChild(notification);
      }
    }, 300);
  }
}
// ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =====
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('ru-RU');
}
function formatDateTime(dateString) {
  const date = new Date(dateString);
  return date.toLocaleString('ru-RU');
}
function addAuditLog(action, details) {
  const currentUser = localStorage.getItem('userName') || 'Администратор';
  const newLog = {
    id: auditLogs.length + 1,
    date: new Date().toISOString().slice(0, 19).replace('T', ' '),
    user: currentUser,
    action: action,
    details: details,
    ip: '192.168.1.100' // Mock IP
  };
  auditLogs.unshift(newLog);
  // Обновляем журнал аудита если он открыт
  if (currentSection === 'audit') {
    loadAuditLogs();
  }
  updateDashboardStats();
}
// Добавляем CSS для анимации скрытия уведомлений
const style = document.createElement('style');
style.textContent = `
  @keyframes slideOutRight {
    from { opacity: 1; transform: translateX(0); }
    to { opacity: 0; transform: translateX(100%); }
  }
`;
document.head.appendChild(style);
