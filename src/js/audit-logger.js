// audit-logger.js
// Совместимость для старого window.appendAdminAudit.
// Канонический журнал аудита теперь ведется только на backend.
// ES module (шаг 7.5): side-effect only, экспорт в window для обратной совместимости.

const STORAGE_KEY = 'adminAuditLogs';

  function safeJsonParse(raw, fallback) {
    try {
      if (raw == null || raw === '') return fallback;
      const parsed = JSON.parse(raw);
      return parsed == null ? fallback : parsed;
    } catch (_) {
      return fallback;
    }
  }

  function readLogs() {
    return [];
  }

  function writeLogs(list) {
    void list;
    return false;
  }

  function pad2(n) {
    const v = Number(n) || 0;
    return v < 10 ? `0${v}` : String(v);
  }

  // Локальное время в формате YYYY-MM-DD HH:mm:ss (важно: фильтрация в админке сравнивает строки)
  function getTimestampLocal(date = new Date()) {
    const d = date instanceof Date ? date : new Date(date);
    const y = d.getFullYear();
    const m = pad2(d.getMonth() + 1);
    const day = pad2(d.getDate());
    const hh = pad2(d.getHours());
    const mm = pad2(d.getMinutes());
    const ss = pad2(d.getSeconds());
    return `${y}-${m}-${day} ${hh}:${mm}:${ss}`;
  }

  // Старый формат в проекте: new Date().toISOString().slice(0, 19).replace('T', ' ')
  // Это UTC, записанный как строка без TZ. Если tz отсутствует — мигрируем UTC -> local.
  function normalizeLegacyDate(dateStr, tz) {
    const s = (dateStr != null ? String(dateStr) : '').trim();
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
    if (!m) return s;

    if (tz === 'local') return s;

    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    const hh = Number(m[4]);
    const mm = Number(m[5]);
    const ss = Number(m[6]);
    const dt = new Date(Date.UTC(y, mo - 1, d, hh, mm, ss));
    return getTimestampLocal(dt);
  }

  function migrateLogsIfNeeded() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (_) {
      // noop
    }
  }

  function getUsernameFromStorage() {
    if (window.AuthModule && typeof window.AuthModule.getCurrentUsername === 'function') {
      const username = window.AuthModule.getCurrentUsername();
      if (username) return username;
    }
    return 'system';
  }

  function getRoleFromStorage() {
    if (window.AuthModule && typeof window.AuthModule.getCurrentRole === 'function') {
      return String(window.AuthModule.getCurrentRole() || '').trim();
    }
    return '';
  }

  function nextId(list) {
    try {
      if (!Array.isArray(list) || list.length === 0) return 1;
      return Math.max(...list.map((x) => Number(x && x.id) || 0)) + 1;
    } catch (_) {
      return (Array.isArray(list) ? list.length : 0) + 1;
    }
  }

  /**
   * Добавить запись в журнал аудита.
   * @param {string} action - login/logout/create/update/delete/export/backup
   * @param {string} details
   * @param {object} [meta]
   * @param {string} [meta.user] - override user
   * @param {string} [meta.ip] - default 'local'
   * @param {string} [meta.role] - optional
   * @returns {object|null} created log entry
   */
  function append(action, details, meta) {
    void action;
    void details;
    void meta;
    return null;
  }

  // Экспорт API и миграция при загрузке
  if (typeof window !== 'undefined') {
    window.AuditLogger = {
      STORAGE_KEY,
      getTimestampLocal,
      migrateLogsIfNeeded,
      readLogs,
      append
    };
    window.getAuditTimestamp = getTimestampLocal;
    window.appendAdminAudit = function (action, details) {
      return append(action, details);
    };
  }
  migrateLogsIfNeeded();

export {};
