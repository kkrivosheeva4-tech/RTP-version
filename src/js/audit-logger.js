// audit-logger.js
// Централизованное логирование важных действий в журнал аудита (localStorage: adminAuditLogs).
// Должен быть подключен на ВСЕХ страницах (auth / RMK / admin).

(function () {
  'use strict';

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
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = safeJsonParse(raw, []);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }

  function writeLogs(list) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      return true;
    } catch (_) {
      return false;
    }
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
    const list = readLogs();
    if (!list.length) return;

    let changed = false;
    const migrated = list.map((l) => {
      if (!l || typeof l !== 'object') return l;
      if (l.tz === 'local') return l;
      if (!('tz' in l)) {
        const next = Object.assign({}, l);
        const migratedDate = normalizeLegacyDate(next.date, next.tz);
        if (migratedDate && migratedDate !== next.date) {
          next.date = migratedDate;
          changed = true;
        }
        next.tz = 'local';
        changed = true;
        return next;
      }
      // Если tz есть, но не local — тоже приводим к local (без конвертации, т.к. неизвестно)
      const next = Object.assign({}, l, { tz: 'local' });
      changed = true;
      return next;
    });

    if (changed) writeLogs(migrated);
  }

  function getUsernameFromStorage() {
    try {
      const u = localStorage.getItem('username') || localStorage.getItem('userName') || '';
      return String(u).trim() || 'system';
    } catch (_) {
      return 'system';
    }
  }

  function getRoleFromStorage() {
    try {
      return String(localStorage.getItem('role') || '').trim() || '';
    } catch (_) {
      return '';
    }
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
    try {
      migrateLogsIfNeeded();
      const list = readLogs();
      const entry = {
        id: nextId(list),
        date: getTimestampLocal(),
        user: (meta && meta.user) ? String(meta.user).trim() : getUsernameFromStorage(),
        action: String(action || '').trim() || 'update',
        details: (details != null ? String(details) : '').trim(),
        tz: 'local',
        ip: (meta && meta.ip) ? String(meta.ip).trim() : 'local'
      };

      // role пишем только если передали или есть в storage (для диагностики)
      const role = (meta && meta.role) ? String(meta.role).trim() : getRoleFromStorage();
      if (role) entry.role = role;

      list.unshift(entry);
      if (!writeLogs(list)) return null;
      return entry;
    } catch (_) {
      return null;
    }
  }

  // Экспорт API
  window.AuditLogger = {
    STORAGE_KEY,
    getTimestampLocal,
    migrateLogsIfNeeded,
    readLogs,
    append
  };

  // Backward-compatible alias used across the codebase
  window.getAuditTimestamp = getTimestampLocal;
  window.appendAdminAudit = function (action, details) {
    return append(action, details);
  };

  // Миграцию делаем сразу при загрузке скрипта
  migrateLogsIfNeeded();
})();

