/**
 * Настройка API-режима до загрузки api-config.
 * Должен импортироваться первым в тестах с mock API.
 */
if (typeof global !== 'undefined') {
  global.window = global.window || {};
  global.window.API_BASE_URL = 'http://test.local';
  global.window.USE_API = true;
}
