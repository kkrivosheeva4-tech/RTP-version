/**
 * Настройка API-режима до загрузки api-config.
 * Должен импортироваться первым в тестах с mock API.
 */
if (typeof global !== 'undefined') {
  global.window = global.window || {};
  // Loopback host avoids slow DNS resolution in Node/MSW on Windows.
  global.window.API_BASE_URL = 'http://127.0.0.1';
  global.window.USE_API = true;
}
