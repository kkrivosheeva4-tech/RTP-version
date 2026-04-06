/**
 * Пример локальной конфигурации API (шаг 10.1).
 *
 * ИНСТРУКЦИЯ:
 * 1. Скопируйте этот файл в api-config.local.js
 * 2. Измените API_BASE_URL на адрес вашего backend
 * 3. При необходимости настройте cookie-auth и таймауты запросов
 *
 * Файл api-config.local.js добавлен в .gitignore — локальные настройки не попадут в репозиторий.
 */

if (typeof window !== 'undefined') {
  /** Базовый URL backend API (без слэша в конце). */
  window.API_BASE_URL = 'http://localhost:8000'; // например: 'http://localhost:8000'

  /** Опционально: таймаут запросов (мс) */
  // window.DEFAULT_TIMEOUT_MS = 8000;

  /** Опционально: таймаут для тяжёлых запросов (экспорт и т.д.), мс */
  // window.HEAVY_REQUEST_TIMEOUT_MS = 30000;

  /**
   * Cookie auth для refresh-токена:
   * true — refresh в HttpOnly cookie (рекомендуется для staging/prod);
   * false — legacy хранение refresh в storage.
   */
  // window.USE_REFRESH_COOKIE_AUTH = true;
}

export {};
