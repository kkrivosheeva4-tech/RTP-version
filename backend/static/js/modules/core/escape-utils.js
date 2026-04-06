/**
 * escape-utils.js — ES module
 * Экранирование HTML для безопасной вставки пользовательского текста.
 * Использовать везде, где в innerHTML попадают данные из форм/JSON (уведомления, карточки, панели).
 */

const charMap = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/**
 * Экранирует спецсимволы HTML в строке (защита от XSS при вставке в innerHTML).
 * @param {string} str — строка (в т.ч. из пользовательского ввода или JSON)
 * @returns {string} экранированная строка
 */
export function escapeHtml(str) {
  if (str == null) return '';
  return String(str).replace(/[&<>"']/g, (m) => charMap[m] || m);
}

// Обратная совместимость
if (typeof window !== 'undefined') {
  window.escapeHtml = escapeHtml;
}
