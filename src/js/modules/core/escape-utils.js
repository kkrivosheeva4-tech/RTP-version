/**
 * escape-utils.js — экранирование HTML для безопасной вставки пользовательского текста.
 * Использовать везде, где в innerHTML попадают данные из форм/JSON (уведомления, карточки, панели).
 */
(function (global) {
  'use strict';

  var charMap = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

  /**
   * Экранирует спецсимволы HTML в строке (защита от XSS при вставке в innerHTML).
   * @param {string} str — строка (в т.ч. из пользовательского ввода или JSON)
   * @returns {string} экранированная строка
   */
  function escapeHtml(str) {
    if (str == null) return '';
    return String(str).replace(/[&<>"']/g, function (m) { return charMap[m] || m; });
  }

  global.escapeHtml = escapeHtml;
})(typeof window !== 'undefined' ? window : this);
