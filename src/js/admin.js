// ===== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ И КОНФИГУРАЦИЯ =====
let users = [];
let auditLogs = [];
let backups = [];
let currentUserId = null;
let currentSection = 'dashboard';

// ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =====
// Безопасное экранирование HTML для предотвращения XSS
// Используем window.escapeHtml из dom-utils.js, если доступен, иначе fallback
const escapeHtml = window.escapeHtml || ((text) => {
  if (text == null) return '';
  const div = document.createElement('div');
  div.textContent = String(text);
  return div.innerHTML;
});

// ===== Пагинация журнала аудита =====
const AUDIT_PAGE_SIZE = 30;
let auditCurrentPage = 1;

// Хранилище данных админ-панели (без моков)
const ADMIN_STORAGE = {
  USERS: 'adminUsers',
  AUDIT: 'adminAuditLogs',
  BACKUPS: 'adminBackups',
  INSTALL_DATE: 'appInstallDate'
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
  try { date = localStorage.getItem(ADMIN_STORAGE.INSTALL_DATE); } catch (_) {}
  if (!date) {
    date = new Date().toISOString().split('T')[0];
    try { localStorage.setItem(ADMIN_STORAGE.INSTALL_DATE, date); } catch (_) {}
  }
  return date;
}

function getDefaultUsers() {
  // "Реальные" системные учётки, которые используются на странице авторизации (auth.js)
  const createdAt = ensureInstallDate();
  const base = [
    { username: 'admin', role: 'admin' },
    { username: 'architect', role: 'architect' },
    { username: 'guest', role: 'guest' }
  ];
  return base.map((u, idx) => ({
    id: idx + 1,
    name: u.username,
    email: `${u.username}@local`,
    role: u.role,
    status: 'active',
    createdAt
  }));
}

function normalizeUsers(list) {
  if (!Array.isArray(list)) return [];
  let nextId = 1;
  const used = new Set();
  return list
    .filter(Boolean)
    .map((u) => {
      const createdAt = (u.createdAt && String(u.createdAt).trim()) || ensureInstallDate();
      let id = Number(u.id);
      if (!Number.isFinite(id) || id <= 0 || used.has(id)) {
        while (used.has(nextId)) nextId += 1;
        id = nextId++;
      }
      used.add(id);
      return {
        id,
        name: (u.name != null ? String(u.name) : '').trim() || `user-${id}`,
        email: (u.email != null ? String(u.email) : '').trim() || `user-${id}@local`,
        role: (u.role != null ? String(u.role) : '').trim() || 'guest',
        status: (u.status === 'inactive' ? 'inactive' : 'active'),
        createdAt
      };
    });
}

function normalizeAuditLogs(list) {
  if (!Array.isArray(list)) return [];
  let didMigrate = false;
  let nextId = 1;
  const used = new Set();

  function pad2(n) {
    const v = Number(n) || 0;
    return v < 10 ? `0${v}` : String(v);
  }

  function formatLocalAuditTimestamp(d) {
    try {
      const y = d.getFullYear();
      const m = pad2(d.getMonth() + 1);
      const day = pad2(d.getDate());
      const hh = pad2(d.getHours());
      const mm = pad2(d.getMinutes());
      const ss = pad2(d.getSeconds());
      return `${y}-${m}-${day} ${hh}:${mm}:${ss}`;
    } catch (_) {
      return '';
    }
  }

  // Старый формат логов был UTC, но записан как "YYYY-MM-DD HH:mm:ss" (без таймзоны).
  // Если tz не указан — считаем, что это старый лог и конвертируем UTC -> local.
  function normalizeAuditDate(raw, tz) {
    const s = (raw != null ? String(raw) : '').trim();
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
    if (m) {
      const y = Number(m[1]);
      const mo = Number(m[2]);
      const d = Number(m[3]);
      const hh = Number(m[4]);
      const mm = Number(m[5]);
      const ss = Number(m[6]);

      if (tz === 'local') {
        // Уже локальное время — просто возвращаем как есть
        return s;
      }

      // Миграция: старые значения трактуем как UTC и переводим в локальное
      const dt = new Date(Date.UTC(y, mo - 1, d, hh, mm, ss));
      const out = formatLocalAuditTimestamp(dt);
      if (out) didMigrate = true;
      return out || s;
    }

    // Если пришёл ISO/другой формат — пробуем распарсить и привести к локальному audit-формату
    const dt = new Date(s);
    if (Number.isFinite(dt.getTime())) {
      const out = formatLocalAuditTimestamp(dt);
      if (out && out !== s) didMigrate = true;
      return out || s;
    }

    // Fallback: текущее локальное время
    return formatLocalAuditTimestamp(new Date()) || s || '';
  }

  return list
    .filter(Boolean)
    .map((l) => {
      let id = Number(l.id);
      if (!Number.isFinite(id) || id <= 0 || used.has(id)) {
        while (used.has(nextId)) nextId += 1;
        id = nextId++;
      }
      used.add(id);
      const tz = (l && l.tz != null ? String(l.tz) : '').trim() || null;
      return {
        id,
        date: normalizeAuditDate(l && l.date, tz),
        user: (l.user != null ? String(l.user) : '').trim() || 'system',
        action: (l.action != null ? String(l.action) : '').trim() || 'update',
        details: (l.details != null ? String(l.details) : '').trim() || '',
        tz: 'local',
        ip: (l.ip != null ? String(l.ip) : '').trim() || 'local'
      };
    });
}

function normalizeBackups(list) {
  if (!Array.isArray(list)) return [];
  let nextId = 1;
  const used = new Set();
  return list
    .filter(Boolean)
    .map((b) => {
      let id = Number(b.id);
      if (!Number.isFinite(id) || id <= 0 || used.has(id)) {
        while (used.has(nextId)) nextId += 1;
        id = nextId++;
      }
      used.add(id);
      return {
        id,
        name: (b.name != null ? String(b.name) : '').trim() || `backup_${id}`,
        date: (b.date != null ? String(b.date) : '').trim() || (typeof window.getAuditTimestamp === 'function' ? window.getAuditTimestamp() : new Date().toISOString().slice(0, 19).replace('T', ' ')),
        size: (b.size != null ? String(b.size) : '').trim() || '',
        sizeBytes: Number.isFinite(Number(b.sizeBytes)) ? Number(b.sizeBytes) : null,
        snapshot: (b.snapshot && typeof b.snapshot === 'object') ? b.snapshot : null
      };
    });
}

function persistUsers() {
  writeStorageJson(ADMIN_STORAGE.USERS, users);
}

function persistAuditLogs() {
  writeStorageJson(ADMIN_STORAGE.AUDIT, auditLogs);
}

function persistBackups() {
  writeStorageJson(ADMIN_STORAGE.BACKUPS, backups);
}

function loadAdminDataFromStorage() {
  users = normalizeUsers(readStorageJson(ADMIN_STORAGE.USERS, null));
  if (!users.length) {
    users = normalizeUsers(getDefaultUsers());
    persistUsers();
  }

  auditLogs = normalizeAuditLogs(readStorageJson(ADMIN_STORAGE.AUDIT, []));
  backups = normalizeBackups(readStorageJson(ADMIN_STORAGE.BACKUPS, []));
}

function getLoggedInUserName() {
  // Основной ключ в auth.js / приложении — username. Поддержим и legacy userName.
  const u1 = localStorage.getItem('username');
  const u2 = localStorage.getItem('userName');
  return (u1 || u2 || '').trim() || 'system';
}

function safeLogout() {
  // Не делаем localStorage.clear() — иначе стираются данные админ-панели и настройки приложения.
  try { localStorage.removeItem('isLoggedIn'); } catch (_) {}
  try { localStorage.removeItem('username'); } catch (_) {}
  try { localStorage.removeItem('userName'); } catch (_) {}
  try { localStorage.removeItem('role'); } catch (_) {}
}

function computeBytes(str) {
  try {
    if (typeof TextEncoder !== 'undefined') {
      return new TextEncoder().encode(String(str)).length;
    }
  } catch (_) {}
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
// ===== ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ =====
document.addEventListener('DOMContentLoaded', function() {
  initializeApp();
});

function initializeApp() {
  // Проверка авторизации
  checkAdminAccess();
  // Инициализация темы
  initializeTheme();
  // Инициализация оболочки (сайдбар/топбар)
  initializeAdminShell();
  // Кастомные селекты (под стилистику приложения)
  initializeEnhancedSelects();
  // Инициализация навигации
  initializeNavigation();
  // Инициализация модальных окон
  initializeModals();
  // Инициализация уведомлений
  initializeNotifications();

  // Инициализация мобильной навигации
  if (window.MobileNav && typeof window.MobileNav.init === 'function') {
    window.MobileNav.init();
    window.addEventListener('resize', () => {
      if (window.MobileNav && typeof window.MobileNav.handleResize === 'function') {
        window.MobileNav.handleResize();
      }
    });
  }

  // Загрузка данных (реальные данные из localStorage)
  loadAdminDataFromStorage();

  // Переопределяем appendAdminAudit, чтобы она обновляла локальную переменную auditLogs
  if (typeof window.appendAdminAudit === 'function') {
    const originalAppendAdminAudit = window.appendAdminAudit;
    window.appendAdminAudit = function(action, details) {
      // Вызываем оригинальную функцию для записи в localStorage
      originalAppendAdminAudit(action, details);
      // Обновляем локальную переменную auditLogs
      auditLogs = normalizeAuditLogs(readStorageJson(ADMIN_STORAGE.AUDIT, []));
      // Обновляем журнал аудита если он открыт
      if (currentSection === 'audit') {
        loadAuditLogs();
      }
      // Обновляем статистику дашборда
      updateDashboardStats();
    };
  }

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
// initializeTheme теперь в common-ui.js
// Используем функцию из common-ui.js через window
function initializeTheme() {
  if (typeof window.CommonUI !== 'undefined' && typeof window.CommonUI.initTheme === 'function') {
    window.CommonUI.initTheme();
    // Обновляем графики при смене темы (специфичная логика для admin.js)
    const themeToggle = document.getElementById("themeToggle");
    if (themeToggle) {
      themeToggle.addEventListener("change", () => {
        setTimeout(() => {
          applyChartsTheme();
        }, 100);
      }, { once: false });
    }
  }
  // Рендер информации об авторизации
  if (typeof window.renderAuth === 'function') {
    window.renderAuth();
  }
}

function initializeAdminShell() {
  // Заголовок текущего раздела в топбаре
  updatePageTitle(currentSection);

  // На узких экранах — по умолчанию компактная боковая панель
  try {
    if (window.matchMedia && window.matchMedia('(max-width: 820px)').matches) {
      document.body.classList.add('admin-sidebar-collapsed');
    }
  } catch (_) {}

  // Прокрутка вверх
  const scrollTopBtn = document.getElementById('adminScrollTop');
  if (scrollTopBtn) {
    scrollTopBtn.addEventListener('click', () => {
      const content = document.querySelector('.admin-content');
      if (content) content.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // Сворачивание сайдбара (с сохранением)
  const sidebarToggle = document.getElementById('adminSidebarToggle');
  if (sidebarToggle) {
    const saved = localStorage.getItem('adminSidebarCollapsed') === '1';
    document.body.classList.toggle('admin-sidebar-collapsed', saved);
    sidebarToggle.setAttribute('data-tooltip', saved ? 'Раскрыть меню' : 'Свернуть меню');
    updateCollapsedSidebarTooltips(document.body.classList.contains('admin-sidebar-collapsed'));

    sidebarToggle.addEventListener('click', () => {
      const next = !document.body.classList.contains('admin-sidebar-collapsed');
      document.body.classList.toggle('admin-sidebar-collapsed', next);
      localStorage.setItem('adminSidebarCollapsed', next ? '1' : '0');
      sidebarToggle.setAttribute('data-tooltip', next ? 'Раскрыть меню' : 'Свернуть меню');
      updateCollapsedSidebarTooltips(next);
    });
  }

  // Обновить текущий раздел
  const refreshCurrent = document.getElementById('adminRefreshCurrent');
  if (refreshCurrent) {
    refreshCurrent.addEventListener('click', () => {
      const icon = refreshCurrent.querySelector('.refresh-icon');
      if (icon) icon.classList.add('spin');
      setTimeout(() => {
        if (currentSection === 'users') loadUsers();
        if (currentSection === 'audit') loadAuditLogs();
        if (currentSection === 'backup') loadBackups();
        if (currentSection === 'dashboard') updateDashboardStats();
        if (icon) icon.classList.remove('spin');
        showNotification('Обновлено', 'Раздел обновлён', 'success');
      }, 600);
    });
  }
}

function updateCollapsedSidebarTooltips(isCollapsed) {
  // Подсказки для иконок меню при свернутом сайдбаре
  document.querySelectorAll('.admin-sidebar .menu-item[data-section]').forEach((btn) => {
    const label = btn.querySelector('.menu-item__label');
    const tooltipText = (label && label.textContent) ? label.textContent.trim() : '';
    if (isCollapsed) {
      if (tooltipText) btn.setAttribute('data-tooltip', tooltipText);
    } else {
      // Убираем, чтобы не мелькало в раскрытом виде
      btn.removeAttribute('data-tooltip');
    }
  });
}
// renderAuth теперь в common-ui.js
// Используем функцию из common-ui.js напрямую через window.renderAuth
// Локальная обертка удалена, чтобы избежать бесконечной рекурсии

// ===== КАСТОМНЫЕ СЕЛЕКТЫ (для админ-панели) =====
const enhancedSelects = new Map();

function initializeEnhancedSelects() {
  enhanceSelect(document.getElementById('roleFilter'));
  enhanceSelect(document.getElementById('auditActionFilter'));

  // Закрытие по клику вне
  document.addEventListener('click', () => {
    closeAllEnhancedSelects();
  });
  // Закрытие по Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAllEnhancedSelects();
  });
}

function closeAllEnhancedSelects() {
  enhancedSelects.forEach((api) => api.close());
}

function rebuildEnhancedSelect(selectId) {
  const api = enhancedSelects.get(selectId);
  if (api) api.rebuild();
}

function enhanceSelect(selectEl) {
  if (!selectEl) return;
  if (enhancedSelects.has(selectEl.id)) return;

  // Оборачиваем select и прячем нативный
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
      // Подсветим текущий выбранный элемент
      const active = menu.querySelector(`[data-value="${cssEscape(selectEl.value)}"]`);
      if (active) active.scrollIntoView({ block: 'nearest' });
    }
  }

  function close() { setOpen(false); }

  function syncValue() {
    const opt = selectEl.selectedOptions && selectEl.selectedOptions[0];
    valueEl.textContent = (opt && opt.textContent) ? opt.textContent : '';
    // Плейсхолдер (пустое значение) отображаем приглушенно
    wrapper.classList.toggle('is-placeholder', !selectEl.value);
  }

  function rebuild() {
    menu.innerHTML = '';
    Array.from(selectEl.options).forEach((opt) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'app-select__option';
      item.setAttribute('role', 'option');
      item.dataset.value = opt.value;
      item.textContent = opt.textContent;
      item.addEventListener('click', (e) => {
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

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    // Закрываем остальные
    enhancedSelects.forEach((api) => {
      if (api.select !== selectEl) api.close();
    });
    setOpen(!wrapper.classList.contains('open'));
  });

  // Клавиатура
  trigger.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      setOpen(true);
      const first = menu.querySelector('.app-select__option');
      if (first) first.focus();
    }
  });

  menu.addEventListener('keydown', (e) => {
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
    if (e.key === 'Tab') {
      close();
    }
  });

  // Слушаем изменение нативного select (например, при обновлении списка пользователей)
  selectEl.addEventListener('change', () => syncValue());

  // Вставляем в DOM: wrapper перед select, затем select внутрь wrapper (скрытый)
  host.insertBefore(wrapper, selectEl);
  wrapper.appendChild(selectEl);
  wrapper.appendChild(trigger);
  wrapper.appendChild(menu);

  rebuild();

  enhancedSelects.set(selectEl.id, { select: selectEl, rebuild, close });
}

function cssEscape(value) {
  // Небольшой safe-escape для использования в querySelector
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
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
      menuItems.forEach(mi => mi.removeAttribute('aria-current'));
      item.setAttribute('aria-current', 'page');
      updatePageTitle(section);
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

    // При открытии раздела аудита перезагружаем данные из localStorage
    if (sectionId === 'audit') {
      auditLogs = normalizeAuditLogs(readStorageJson(ADMIN_STORAGE.AUDIT, []));
      loadAuditLogs();
    }
    // При открытии дашборда обновляем статистику
    if (sectionId === 'dashboard') {
      updateDashboardStats();
    }
  }
}

function updatePageTitle(sectionId) {
  const titleEl = document.getElementById('adminPageTitle');
  if (!titleEl) return;
  const titles = {
    dashboard: 'Обзор',
    users: 'Пользователи',
    audit: 'Аудит',
    export: 'Экспорт',
    backup: 'Бэкапы'
  };
  titleEl.textContent = titles[sectionId] || 'Админ‑панель';
}
// ===== ЗАГРУЗКА ДАННЫХ =====
// (реализовано через loadAdminDataFromStorage)
// ===== ДАШБОРД =====
let usersChart, auditChart, rolesChart;
function initializeDashboard() {
  updateDashboardStats();
  initializeCharts();
}
function updateDashboardStats() {
  // Перезагружаем данные из localStorage для актуальной статистики
  auditLogs = normalizeAuditLogs(readStorageJson(ADMIN_STORAGE.AUDIT, []));

  document.getElementById('totalUsers').textContent = users.length;
  const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
  const username = localStorage.getItem('username');
  document.getElementById('activeSessions').textContent = (isLoggedIn && username) ? 1 : 0;
  document.getElementById('auditEvents').textContent = auditLogs.length;
  document.getElementById('backupCount').textContent = backups.length;
  // Обновляем графики если они существуют
  if (usersChart) {
    const usersData = generateUserRegistrationData();
    usersChart.data.labels = usersData.labels;
    usersChart.data.datasets[0].data = usersData.values;
    usersChart.update();
  }
  if (auditChart) {
    const auditData = generateAuditData();
    auditChart.data.labels = auditData.labels;
    auditChart.data.datasets[0].data = auditData.values;
    auditChart.update();
  }
  if (rolesChart) {
    const rolesData = generateRolesData();
    rolesChart.data.labels = rolesData.labels;
    rolesChart.data.datasets[0].data = rolesData.values;
    rolesChart.update();
  }
}
function initializeCharts() {
  // Цвета из common.css
  const accent = (getComputedStyle(document.documentElement).getPropertyValue('--accent') || '').trim() || '#ce9068';
  // Важно: --text объявлен на body.light/body.dark (а не на :root),
  // поэтому читаем переменную именно с body. Иначе в тёмной теме получаем пусто
  // и Chart.js рисует подписи чёрным по умолчанию.
  const bodyStyles = getComputedStyle(document.body);
  const textColor = (bodyStyles.getPropertyValue('--text') || bodyStyles.color || '').trim()
    || (document.body.classList.contains('dark') ? '#ffffff' : '#000000');
  const gridColor = withAlpha(textColor, 0.12);
  const dpr = Math.max(1, Math.min(3, (window.devicePixelRatio || 1)));
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
              color: textColor
            },
            grid: {
              color: gridColor
            }
          },
          y: {
            ticks: {
              color: textColor
            },
            grid: {
              color: gridColor
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
          backgroundColor: withAlpha(accent, 0.55),
          borderColor: accent,
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        devicePixelRatio: dpr,
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
              color: textColor
            },
            grid: {
              color: gridColor
            }
          },
          y: {
            ticks: {
              color: textColor
            },
            grid: {
              color: gridColor
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
            accent,
            withAlpha(accent, 0.70),
            withAlpha(accent, 0.55),
            withAlpha(accent, 0.40)
          ],
          borderColor: [
            accent,
            accent,
            accent,
            accent
          ],
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        devicePixelRatio: dpr,
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

  // Применяем цвета (важно для светлой темы и при будущих переключениях)
  applyChartsTheme();
}

function withAlpha(color, alpha) {
  // Supports: #rgb, #rrggbb, rgb(), rgba()
  const c = String(color || '').trim();
  if (!c) return `rgba(0,0,0,${alpha})`;
  if (c.startsWith('rgba(')) {
    const inner = c.slice(5, -1).split(',').map(s => s.trim());
    if (inner.length >= 3) return `rgba(${inner[0]}, ${inner[1]}, ${inner[2]}, ${alpha})`;
  }
  if (c.startsWith('rgb(')) {
    const inner = c.slice(4, -1).split(',').map(s => s.trim());
    if (inner.length >= 3) return `rgba(${inner[0]}, ${inner[1]}, ${inner[2]}, ${alpha})`;
  }
  if (c.startsWith('#')) {
    let hex = c.slice(1);
    if (hex.length === 3) hex = hex.split('').map(ch => ch + ch).join('');
    if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
  }
  // Fallback: let browser parse into rgb via temporary element
  const tmp = document.createElement('span');
  tmp.style.color = c;
  document.body.appendChild(tmp);
  const resolved = getComputedStyle(tmp).color;
  document.body.removeChild(tmp);
  if (resolved && resolved.startsWith('rgb(')) {
    const inner = resolved.slice(4, -1).split(',').map(s => s.trim());
    if (inner.length >= 3) return `rgba(${inner[0]}, ${inner[1]}, ${inner[2]}, ${alpha})`;
  }
  return `rgba(0,0,0,${alpha})`;
}

function getChartsThemeColors() {
  const accent = (getComputedStyle(document.documentElement).getPropertyValue('--accent') || '').trim() || '#ce9068';
  // --text задаётся на body.light/body.dark → читаем с body, иначе на тёмной теме будет пусто
  // и все подписи/оси станут чёрными.
  const bodyStyles = getComputedStyle(document.body);
  const text = (bodyStyles.getPropertyValue('--text') || bodyStyles.color || '').trim()
    || (document.body.classList.contains('dark') ? '#ffffff' : '#000000');
  const grid = withAlpha(text, 0.12);
  return { accent, text, grid };
}

function applyChartsTheme() {
  const { accent, text, grid } = getChartsThemeColors();

  if (usersChart) {
    usersChart.data.datasets[0].borderColor = accent;
    usersChart.data.datasets[0].backgroundColor = withAlpha(accent, 0.12);
    if (usersChart.options?.plugins?.legend?.labels) usersChart.options.plugins.legend.labels.color = text;
    if (usersChart.options?.scales?.x?.ticks) usersChart.options.scales.x.ticks.color = text;
    if (usersChart.options?.scales?.y?.ticks) usersChart.options.scales.y.ticks.color = text;
    if (usersChart.options?.scales?.x?.grid) usersChart.options.scales.x.grid.color = grid;
    if (usersChart.options?.scales?.y?.grid) usersChart.options.scales.y.grid.color = grid;
    usersChart.update();
  }

  if (auditChart) {
    auditChart.data.datasets[0].backgroundColor = withAlpha(accent, 0.55);
    auditChart.data.datasets[0].borderColor = accent;
    if (auditChart.options?.plugins?.legend?.labels) auditChart.options.plugins.legend.labels.color = text;
    if (auditChart.options?.scales?.x?.ticks) auditChart.options.scales.x.ticks.color = text;
    if (auditChart.options?.scales?.y?.ticks) auditChart.options.scales.y.ticks.color = text;
    if (auditChart.options?.scales?.x?.grid) auditChart.options.scales.x.grid.color = grid;
    if (auditChart.options?.scales?.y?.grid) auditChart.options.scales.y.grid.color = grid;
    auditChart.update();
  }

  if (rolesChart) {
    rolesChart.data.datasets[0].backgroundColor = [
      accent,
      withAlpha(accent, 0.70),
      withAlpha(accent, 0.55),
      withAlpha(accent, 0.40)
    ];
    rolesChart.data.datasets[0].borderColor = [accent, accent, accent, accent];
    if (rolesChart.options?.plugins?.legend?.labels) rolesChart.options.plugins.legend.labels.color = text;
    rolesChart.update();
  }
}
function generateUserRegistrationData() {
  const labels = [];
  const values = [];
  const today = new Date();
  // Считаем реальные регистрации по users.createdAt за последние 7 дней
  const createdByDay = new Map(); // YYYY-MM-DD -> count
  users.forEach((u) => {
    const d = (u && u.createdAt) ? String(u.createdAt).slice(0, 10) : '';
    if (!d) return;
    createdByDay.set(d, (createdByDay.get(d) || 0) + 1);
  });
  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const isoDay = date.toISOString().split('T')[0];
    labels.push(date.toLocaleDateString('ru-RU', { month: 'short', day: 'numeric' }));
    values.push(createdByDay.get(isoDay) || 0);
  }
  return { labels, values };
}
function generateAuditData() {
  const order = ['login', 'logout', 'create', 'update', 'delete', 'export', 'backup'];
  const labels = order.map((a) => getActionName(a));
  const counts = Object.fromEntries(order.map((a) => [a, 0]));
  auditLogs.forEach((l) => {
    const a = (l && l.action) ? String(l.action) : '';
    if (!a) return;
    if (Object.prototype.hasOwnProperty.call(counts, a)) counts[a] += 1;
  });
  const values = order.map((a) => counts[a] || 0);
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
  if (userSearch) {
    userSearch.addEventListener('input', () => filterUsers());
  }
  if (roleFilter) {
    roleFilter.addEventListener('change', () => filterUsers());
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

    // ID
    const tdId = document.createElement('td');
    tdId.textContent = user.id;
    row.appendChild(tdId);

    // Имя
    const tdName = document.createElement('td');
    tdName.textContent = user.name;
    row.appendChild(tdName);

    // Email
    const tdEmail = document.createElement('td');
    tdEmail.textContent = user.email;
    row.appendChild(tdEmail);

    // Роль
    const tdRole = document.createElement('td');
    const roleBadge = document.createElement('span');
    roleBadge.className = `status-badge ${getRoleClass(user.role)}`;
    roleBadge.textContent = getRoleName(user.role);
    tdRole.appendChild(roleBadge);
    row.appendChild(tdRole);

    // Дата регистрации
    const tdDate = document.createElement('td');
    tdDate.textContent = formatDate(user.createdAt);
    row.appendChild(tdDate);

    // Статус
    const tdStatus = document.createElement('td');
    const statusBadge = document.createElement('span');
    statusBadge.className = `status-badge ${user.status === 'active' ? 'status-active' : 'status-inactive'}`;
    statusBadge.textContent = user.status === 'active' ? 'Активен' : 'Неактивен';
    tdStatus.appendChild(statusBadge);
    row.appendChild(tdStatus);

    // Действия
    const tdActions = document.createElement('td');
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'action-buttons';

    // Кнопка редактирования
    const editBtn = document.createElement('button');
    editBtn.className = 'action-btn edit-btn';
    editBtn.setAttribute('data-tooltip', 'Редактировать');
    editBtn.setAttribute('data-user-id', user.id);
    editBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
      </svg>
    `;
    editBtn.addEventListener('click', () => editUser(user.id));
    actionsDiv.appendChild(editBtn);

    // Кнопка удаления
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'action-btn delete-btn';
    deleteBtn.setAttribute('data-tooltip', 'Удалить');
    deleteBtn.setAttribute('data-user-id', user.id);
    deleteBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="3,6 5,6 21,6"></polyline>
        <path d="M19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"></path>
        <line x1="10" y1="11" x2="10" y2="17"></line>
        <line x1="14" y1="11" x2="14" y2="17"></line>
      </svg>
    `;
    deleteBtn.addEventListener('click', () => deleteUser(user.id));
    actionsDiv.appendChild(deleteBtn);

    tdActions.appendChild(actionsDiv);
    row.appendChild(tdActions);

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
    'director': 'Директор',
    'analyst': 'Аналитик',
    'guest': 'Гость'
  };
  return roles[role] || role;
}
function getRoleClass(role) {
  const classes = {
    'admin': 'status-active',
    'architect': 'status-active',
    'director': 'status-active',
    'analyst': 'status-active'
  };
  return classes[role] || 'status-inactive';
}

function lockDateInputToPicker(inputEl) {
  // Запрещаем ручной ввод даты — только выбор календарём.
  // Разрешаем очистку (Backspace/Delete) и навигацию.
  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Tab' || e.key === 'Escape' || e.key === 'Enter') return;
    if (e.key === 'Backspace' || e.key === 'Delete') return;
    if (e.key && e.key.length === 1) e.preventDefault();
  });
  inputEl.addEventListener('paste', (e) => e.preventDefault());
  inputEl.addEventListener('drop', (e) => e.preventDefault());
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
      persistUsers();
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
  showModal('userModal');
}
// ===== ЖУРНАЛ АУДИТА =====
function initializeAudit() {
  const dateFrom = document.getElementById('auditDateFrom');
  const dateTo = document.getElementById('auditDateTo');
  const userSearch = document.getElementById('auditUserSearch');
  const actionFilter = document.getElementById('auditActionFilter');
  const clearAuditPeriodBtn = document.getElementById('clearAuditPeriod');
  const prevPageBtn = document.getElementById('auditPrevPage');
  const nextPageBtn = document.getElementById('auditNextPage');

  if (dateFrom) {
    lockDateInputToPicker(dateFrom);
    dateFrom.addEventListener('change', () => { auditCurrentPage = 1; filterAuditLogs(); });
  }
  if (dateTo) {
    lockDateInputToPicker(dateTo);
    dateTo.addEventListener('change', () => { auditCurrentPage = 1; filterAuditLogs(); });
  }
  if (userSearch) userSearch.addEventListener('input', () => { auditCurrentPage = 1; filterAuditLogs(); });
  if (actionFilter) actionFilter.addEventListener('change', () => { auditCurrentPage = 1; filterAuditLogs(); });

  if (clearAuditPeriodBtn) {
    clearAuditPeriodBtn.addEventListener('click', () => {
      clearAuditLogsByPeriod();
    });
  }

  if (prevPageBtn) {
    prevPageBtn.addEventListener('click', () => {
      auditCurrentPage = Math.max(1, (Number(auditCurrentPage) || 1) - 1);
      loadAuditLogs();
    });
  }
  if (nextPageBtn) {
    nextPageBtn.addEventListener('click', () => {
      auditCurrentPage = (Number(auditCurrentPage) || 1) + 1;
      loadAuditLogs();
    });
  }

  loadAuditLogs();
}

function getAuditDateBoundsFromUi() {
  const dateFrom = (document.getElementById('auditDateFrom')?.value || '').trim();
  const dateTo = (document.getElementById('auditDateTo')?.value || '').trim();
  const lower = dateFrom ? `${dateFrom} 00:00:00` : null;
  const upper = dateTo ? `${dateTo} 23:59:59` : null;
  return { dateFrom, dateTo, lower, upper };
}

function getFilteredAuditLogs() {
  const { lower, upper } = getAuditDateBoundsFromUi();
  const userSearch = (document.getElementById('auditUserSearch')?.value || '').trim().toLowerCase();
  const actionFilter = (document.getElementById('auditActionFilter')?.value || '').trim();

  return auditLogs.filter((log) => {
    let matchesDate = true;
    let matchesUser = true;
    let matchesAction = true;

    if (lower) matchesDate = String(log.date || '') >= lower;
    if (upper) matchesDate = matchesDate && String(log.date || '') <= upper;

    if (userSearch) {
      const userName = String(log.user || '').toLowerCase();
      const roleCode = getUserRoleCodeByName(log.user);
      const roleName = roleCode ? getRoleName(roleCode) : '';
      const roleNameLc = String(roleName || '').toLowerCase();
      const roleCodeLc = String(roleCode || '').toLowerCase();
      matchesUser = userName.includes(userSearch) || roleNameLc.includes(userSearch) || roleCodeLc.includes(userSearch);
    }

    if (actionFilter) matchesAction = String(log.action || '') === actionFilter;

    return matchesDate && matchesUser && matchesAction;
  });
}

function updateAuditPaginationUi(totalItems) {
  const pageInfo = document.getElementById('auditPageInfo');
  const recordsInfo = document.getElementById('auditRecordsInfo');
  const prevBtn = document.getElementById('auditPrevPage');
  const nextBtn = document.getElementById('auditNextPage');

  const total = Number(totalItems) || 0;
  const totalPages = Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE));
  auditCurrentPage = Math.min(Math.max(1, Number(auditCurrentPage) || 1), totalPages);

  if (pageInfo) pageInfo.textContent = `Страница ${auditCurrentPage} из ${totalPages}`;
  if (recordsInfo) recordsInfo.textContent = `Показано: ${Math.min(AUDIT_PAGE_SIZE, Math.max(0, total - ((auditCurrentPage - 1) * AUDIT_PAGE_SIZE)))} из ${total}`;
  if (prevBtn) prevBtn.disabled = auditCurrentPage <= 1;
  if (nextBtn) nextBtn.disabled = auditCurrentPage >= totalPages;
}

function clearAuditLogsByPeriod() {
  const { dateFrom, dateTo, lower, upper } = getAuditDateBoundsFromUi();

  if (!lower && !upper) {
    showNotification('Очистка', 'Укажите "Дата от" и/или "Дата до" для очистки за период', 'error');
    return;
  }
  if (dateFrom && dateTo && dateFrom > dateTo) {
    showNotification('Очистка', 'Некорректный период: "Дата от" больше "Дата до"', 'error');
    return;
  }

  const title = 'Очистка журнала аудита';
  const periodLabel = `${dateFrom || '...'} — ${dateTo || '...'}`;
  showConfirmModal(
    title,
    `Очистить журнал аудита за период: ${periodLabel}?`,
    () => {
      // Всегда берем актуальные данные из localStorage
      auditLogs = normalizeAuditLogs(readStorageJson(ADMIN_STORAGE.AUDIT, []));

      const before = auditLogs.length;
      const kept = auditLogs.filter((log) => {
        const d = String(log.date || '');
        if (lower && d < lower) return true;
        if (upper && d > upper) return true;
        return false; // внутри диапазона -> удаляем
      });

      const removed = before - kept.length;
      auditLogs = kept;
      persistAuditLogs();

      auditCurrentPage = 1;

      // Логируем факт очистки (останется как новая запись в журнале)
      addAuditLog('delete', `Очищен журнал аудита за период ${periodLabel}. Удалено записей: ${removed}`);

      showNotification('Очистка', `Удалено записей: ${removed}`, 'success');
      loadAuditLogs();
      updateDashboardStats();
    }
  );
}
function loadAuditLogs() {
  const tbody = document.getElementById('auditTableBody');
  if (!tbody) return;

  // Перезагружаем логи из localStorage перед отображением, чтобы получить актуальные данные
  const raw = readStorageJson(ADMIN_STORAGE.AUDIT, []);
  const normalized = normalizeAuditLogs(raw);
  auditLogs = normalized;
  // Если были старые записи без tz / с неконсистентным форматом — закрепим миграцию
  try {
    const needsPersist = Array.isArray(raw) && raw.some((l) => l && !('tz' in l));
    if (needsPersist) {
      persistAuditLogs();
    }
  } catch (_) {}

  tbody.innerHTML = '';
  const filteredLogs = getFilteredAuditLogs();
  updateAuditPaginationUi(filteredLogs.length);

  const start = (auditCurrentPage - 1) * AUDIT_PAGE_SIZE;
  const pageLogs = filteredLogs.slice(start, start + AUDIT_PAGE_SIZE);

  pageLogs.forEach(log => {
    const row = document.createElement('tr');

    // Дата
    const tdDate = document.createElement('td');
    tdDate.textContent = formatDateTime(log.date);
    row.appendChild(tdDate);

    // Пользователь
    const tdUser = document.createElement('td');
    tdUser.textContent = log.user;
    row.appendChild(tdUser);

    // Действие
    const tdAction = document.createElement('td');
    const actionBadge = document.createElement('span');
    actionBadge.className = `status-badge ${getActionClass(log.action)}`;
    actionBadge.textContent = getActionName(log.action);
    tdAction.appendChild(actionBadge);
    row.appendChild(tdAction);

    // Детали
    const tdDetails = document.createElement('td');
    tdDetails.textContent = log.details;
    row.appendChild(tdDetails);

    // IP адрес
    const tdIp = document.createElement('td');
    tdIp.textContent = log.ip;
    row.appendChild(tdIp);

    tbody.appendChild(row);
  });
}
function filterAuditLogs() {
  // Фильтрация теперь происходит в loadAuditLogs
  loadAuditLogs();
}

function getUserRoleCodeByName(userName) {
  if (!userName) return null;
  const name = String(userName).trim().toLowerCase();
  const user = users.find(u => String(u.name).trim().toLowerCase() === name);
  return user ? user.role : null;
}
function getActionName(action) {
  const actions = {
    'login': 'Вход',
    'logout': 'Выход',
    'create': 'Создание',
    'update': 'Изменение',
    'delete': 'Удаление',
    'export': 'Экспорт',
    'backup': 'Бэкап'
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
    'backup': 'status-active'
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
  // Экспортируем в JSON с русскими ключами (требование: отчеты на русском)
  let payload = data;
  try {
    const type = String(filename || '').toLowerCase().includes('audit') ? 'audit'
      : String(filename || '').toLowerCase().includes('users') ? 'users'
      : null;

    if (type === 'users' && Array.isArray(data)) {
      payload = data.map(u => ({
        'ID': u.id,
        'Имя': u.name,
        'Email': u.email,
        'Роль': getRoleName(u.role),
        'Дата регистрации': u.createdAt,
        'Статус': (u.status === 'active' ? 'Активен' : 'Неактивен')
      }));
    } else if (type === 'audit' && Array.isArray(data)) {
      payload = data.map(l => ({
        'Дата': l.date,
        'Пользователь': l.user,
        'Действие': getActionName(l.action),
        'Детали': l.details,
        'IP адрес': l.ip
      }));
    }
  } catch (_) {
    payload = data;
  }

  const jsonString = JSON.stringify(payload, null, 2);
  // BOM для корректного открытия в Windows/Excel/Блокноте
  const BOM = '\uFEFF';
  const blob = new Blob([BOM, jsonString], { type: 'application/json;charset=utf-8' });
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
      const statusRu = user.status === 'active' ? 'Активен' : 'Неактивен';
      csv += `${user.id},"${user.name}","${user.email}","${getRoleName(user.role)}","${user.createdAt}","${statusRu}"\n`;
    });
  } else if (type === 'audit') {
    csv = 'Дата,Пользователь,Действие,Детали,IP адрес\n';
    data.forEach(log => {
      csv += `"${log.date}","${log.user}","${getActionName(log.action)}","${log.details}","${log.ip}"\n`;
    });
  }
  // BOM для корректного открытия в Windows/Excel
  const BOM = '\uFEFF';
  const blob = new Blob([BOM, csv], { type: 'text/csv;charset=utf-8;' });
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

  // Кнопка сброса локальных правок (VFS)
  const clearVfsCacheBtn = document.getElementById('clearVfsCacheBtn');
  if (clearVfsCacheBtn) {
    clearVfsCacheBtn.addEventListener('click', () => {
      if (confirm('Вы уверены, что хотите сбросить все локальные правки данных? Это действие нельзя отменить.')) {
        if (typeof window.clearVfsCache === 'function') {
          window.clearVfsCache();
          showNotification("Успешно", "Локальные правки данных сброшены", "success");
          addAuditLog('backup', 'Сброшены локальные правки данных (VFS)');
        } else {
          showNotification("Ошибка", "Функция сброса недоступна", "error");
        }
      }
    });
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
  const backupDate = (typeof window.getAuditTimestamp === 'function')
    ? window.getAuditTimestamp()
    : new Date().toISOString().slice(0, 19).replace('T', ' ');
  const snapshot = {
    users: deepCloneJson(users) || [],
    auditLogs: deepCloneJson(auditLogs) || []
  };
  const snapshotStr = JSON.stringify(snapshot);
  const sizeBytes = computeBytes(snapshotStr);
  const backupSize = formatBytes(sizeBytes);
  const nextBackupId = backups.length ? (Math.max(...backups.map(b => Number(b && b.id) || 0)) + 1) : 1;
  const newBackup = {
    id: nextBackupId,
    name: backupName,
    date: backupDate,
    size: backupSize,
    sizeBytes,
    snapshot
  };
  backups.unshift(newBackup);
  persistBackups();
  loadBackups();
  updateDashboardStats();
  addAuditLog('backup', `Создана резервная копия: ${backupName}`);
  showNotification("Резервная копия", "Резервная копия успешно создана", "success");
}
function restoreBackup(backupId) {
  const backup = backups.find(b => b.id === backupId);
  if (!backup) return;
  showConfirmModal(
    'Восстановление из резервной копии',
    `Вы уверены, что хотите восстановить систему из копии "${backup.name}"?`,
    () => {
      if (backup.snapshot && typeof backup.snapshot === 'object') {
        const nextUsers = normalizeUsers(backup.snapshot.users || []);
        const nextAudit = normalizeAuditLogs(backup.snapshot.auditLogs || []);
        if (nextUsers.length) users = nextUsers;
        if (Array.isArray(nextAudit)) auditLogs = nextAudit;
        persistUsers();
        persistAuditLogs();
      }
      loadUsers();
      loadAuditLogs();
      updateDashboardStats();
      addAuditLog('backup', `Восстановление из резервной копии: ${backup.name}`);
      showNotification("Восстановление", "Данные восстановлены из резервной копии", "success");
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
      persistBackups();
      loadBackups();
      updateDashboardStats();
      addAuditLog('backup', `Удалена резервная копия: ${backup.name}`);
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
  // Кнопки закрытия (крестик)
  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => {
      const modal = btn.closest('.modal');
      if (modal && modal.id) hideModal(modal.id);
    });
  });
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
    // Активируем focus trap для модалок в админке
    if (window.FocusTrap && typeof window.FocusTrap.trap === 'function') {
      setTimeout(() => {
        window.FocusTrap.trap(modal);
      }, 50);
    }
    modal.classList.add('show');
    modal.style.display = '';
  }
}
function hideModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    // Деактивируем focus trap перед закрытием
    if (window.FocusTrap && typeof window.FocusTrap.release === 'function') {
      window.FocusTrap.release();
    }
    modal.classList.remove('show');
    modal.style.display = '';
  }
}
function handleUserSubmit(e) {
  e.preventDefault();
  const formData = {
    name: document.getElementById('userName').value,
    email: document.getElementById('userEmail').value,
    role: document.getElementById('userRole').value
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
      persistUsers();
      loadUsers();
      addAuditLog('update', `Изменена роль пользователя: ${users[userIndex].name} (${oldRole} -> ${formData.role})`);
      showNotification("Успешно", "Роль пользователя обновлена", "success");
    }
  } else {
    // Создание
    const newUser = {
      id: users.length ? (Math.max(...users.map(u => Number(u && u.id) || 0)) + 1) : 1,
      name: formData.name,
      email: formData.email,
      role: formData.role,
      status: 'active',
      createdAt: new Date().toISOString().split('T')[0]
    };
    users.push(newUser);
    persistUsers();
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
    // Создаем структуру уведомления через createElement (безопаснее чем innerHTML)
    const notificationTitle = document.createElement('div');
    notificationTitle.className = 'notification-title';
    notificationTitle.textContent = title;

    const notificationMessage = document.createElement('div');
    notificationMessage.className = 'notification-message';
    notificationMessage.textContent = message;

    const notificationClose = document.createElement('button');
    notificationClose.className = 'notification-close';
    notificationClose.textContent = '×';
    notificationClose.addEventListener('click', () => hideNotification(notification));

    notification.appendChild(notificationTitle);
    notification.appendChild(notificationMessage);
    notification.appendChild(notificationClose);
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
function addAuditLog(action, details) {
  // Централизованное логирование: единая функция для всех страниц
  if (typeof window.appendAdminAudit === 'function') {
    window.appendAdminAudit(action, details);
  } else {
    // Fallback (на всякий случай)
    const currentUser = getLoggedInUserName();
    const ts = new Date().toISOString().slice(0, 19).replace('T', ' ');
    auditLogs.unshift({
      id: auditLogs.length + 1,
      date: ts,
      user: currentUser,
      action: action,
      details: details,
      ip: 'local'
    });
    persistAuditLogs();
  }

  // Перезагрузим из localStorage, чтобы UI точно увидел новые записи
  auditLogs = normalizeAuditLogs(readStorageJson(ADMIN_STORAGE.AUDIT, []));
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
