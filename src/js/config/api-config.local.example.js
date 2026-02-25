/**
 * Пример локальной конфигурации API (шаг 10.1).
 *
 * ИНСТРУКЦИЯ:
 * 1. Скопируйте этот файл в api-config.local.js
 * 2. Измените API_BASE_URL на адрес вашего backend
 * 3. При необходимости установите USE_API (true = использовать API, false = mock)
 *
 * Файл api-config.local.js добавлен в .gitignore — локальные настройки не попадут в репозиторий.
 */

if (typeof window !== 'undefined') {
  /** Базовый URL backend API (без слэша в конце). Пусто — mock-режим. */
  window.API_BASE_URL = ''; // например: 'http://localhost:8000'

  /**
   * Флаг источника данных: true — API, false — mock (JSON + VFS).
   * Если не задан, определяется по API_BASE_URL (не пустой → true).
   */
  // window.USE_API = true;

  /** Опционально: таймаут запросов (мс) */
  // window.DEFAULT_TIMEOUT_MS = 8000;

  /** Опционально: таймаут для тяжёлых запросов (экспорт и т.д.), мс */
  // window.HEAVY_REQUEST_TIMEOUT_MS = 30000;
}

export {};
