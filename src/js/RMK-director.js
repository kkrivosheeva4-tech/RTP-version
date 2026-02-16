// RMK-director.js
// ===== ЗАГРУЗКА МОДУЛЕЙ ДЛЯ ОСНОВНОЙ СТРАНИЦЫ РАДАРА =====
// Основная страница радара для всех ролей (архитекторы, директоры, РП, администраторы)
// Функция для динамической загрузки модулей
function loadModule(src) {
  return new Promise((resolve, reject) => {
    // Проверяем, не загружен ли уже модуль
    const script = document.createElement('script');
    script.src = src;
    script.async = false; // Загружаем синхронно для сохранения порядка
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Не удалось загрузить модуль: ${src}`));
    document.head.appendChild(script);
  });
}

// Функция для загрузки всех модулей в правильном порядке
async function loadAllModules() {
  const modules = [
    // Базовые утилиты (должны быть загружены первыми)
    '/src/js/audit-logger.js',
    '/src/js/script.js',
    '/src/js/radar-utils.js',

    // Core модули (в порядке зависимостей)
    // Объединенные модули
    '/src/js/modules/core/logger.js',  // logger wrapper для dev/prod
    '/src/js/modules/core/dom-utils.js',  // dom-cache + dom-proxy
    '/src/js/modules/core/core-utils.js',  // error-handler + event-manager + memoization + module-loader + render-queue
    '/src/js/modules/core/error-handler.js',  // reportError — единая точка логирования и показа ошибок
    '/src/js/config/api-config.js',  // базовый URL API, таймауты (заглушка для бэкенда)
    '/src/js/modules/core/state-manager.js',
    '/src/js/modules/core/api-client.js',  // заглушка запросов к API (Authorization, 401, таймауты)
    '/src/js/modules/core/data-source.js',  // VFS + fetch + loadJsonPreferVfs (этап 2)
    '/src/js/modules/core/data-normalize.js',  // normalizeTechnologyFromNewFormat, buildBlockMaps (этап 2)
    '/src/js/modules/core/data-loader.js',
    '/src/js/modules/core/state-utils.js',  // state-accessors + state-subscriptions
    '/src/js/modules/core/data-indexing.js',  // data-index + tech-index

    // UI модули (detail-panel должен быть загружен до radar-wrappers, так как использует showDetail)
    '/src/js/modules/ui/detail-panel.js',

    // Utils модули (должны быть загружены до radar модулей)
    '/src/js/modules/utils/func-cover-utils.js',  // ОБНОВЛЕНО: Учет важности функций в funcCover

    // Radar модули
    '/src/js/modules/radar/positioning.js',
    '/src/js/modules/radar/radar-renderer.js',
    '/src/js/modules/radar/quadrant-cache.js',
    '/src/js/modules/radar/quadrants.js',
    // prospects-chart.js НЕ загружается для директорской страницы
    '/src/js/modules/radar/radar-wrappers.js',
    '/src/js/modules/radar/radar-update.js',

    // UI модули (остальные)
    '/src/js/modules/ui/filters.js',
    '/src/js/config/form-field-options.js',  // TRL, рейтинги, статусы, tooltips (этап 7)
    '/src/js/modules/ui/filter-init.js',  // initFiltersWithRetry, initModalSelects (этап 2)
    '/src/js/modules/ui/focus-trap.js',
    '/src/js/modules/ui/modals.js',
    '/src/js/modules/ui/forms.js',
    '/src/js/modules/ui/sidebar.js',
    '/src/js/modules/ui/modal-forms.js',
    '/src/js/modules/ui/report-status.js',
    '/src/js/modules/ui/tooltips.js',  // tooltip + hover
    '/src/js/modules/ui/notifications.js',  // система уведомлений
    '/src/js/modules/ui/form-management.js',  // form-events + form-handlers
    '/src/js/modules/ui/vendors-files.js',  // управление вендорами и файлами
    '/src/js/modules/ui/loading.js',
    '/src/js/modules/ui/error-display.js',
    '/src/js/modules/ui/toast.js',
    '/src/js/modules/ui/skeleton.js',
    '/src/js/modules/ui/mobile-nav.js',
    '/src/js/modules/ui/touch-handlers.js',
    '/src/js/modules/ui/keyboard-nav.js',
    '/src/js/modules/ui/aria-manager.js',
    '/src/js/modules/ui/onboarding.js',
    '/src/js/modules/ui/contextual-hints.js',
    '/src/js/modules/ui/offline-handler.js',

    // Business модули (этап 3: конфиг полей, фильтры и PDF до export.js)
    '/src/js/modules/business/export-fields-config.js',
    '/src/js/modules/business/export-filters.js',
    '/src/js/modules/business/export-pdf.js',
    '/src/js/modules/business/export.js',
    '/src/js/modules/business/auth.js',
    '/src/js/modules/business/priorities.js',

    // Analytics модули (аналитика модели)
    '/src/js/modules/analytics/model-analytics.js',
    '/src/js/modules/analytics/weight-optimizer.js',  // ОБНОВЛЕНО: Автоматическая оптимизация весов
    '/src/js/modules/analytics/missing-data-predictor.js',  // ОБНОВЛЕНО: Улучшенная обработка отсутствующих данных
    '/src/js/modules/analytics/temporal-dynamics.js',  // ОБНОВЛЕНО: Учет временной динамики
    '/src/js/modules/analytics/adaptive-calibration.js',  // ОБНОВЛЕНО: Адаптивная калибровка параметров

    // Radar модули (оптимизация)
    '/src/js/modules/radar/spatial-index.js',  // ОБНОВЛЕНО: Пространственные индексы для оптимизации разведения

    // Integration модули (events должен быть загружен после всех зависимостей)
    // Новые модули обработчиков событий (загружаются перед events.js)
    '/src/js/modules/ui/select-events.js',  // теперь включает select-positioning
    '/src/js/modules/radar/radar-events.js',
    '/src/js/modules/integration/events.js',  // теперь включает utils

    // App init (должен быть загружен последним перед RMK-director.js)
    '/src/js/modules/core/app-init.js'
  ];

  try {
    for (const module of modules) {
      await loadModule(module);
    }
  } catch (error) {
    // Ошибка при загрузке модулей
    throw error;
  }
}

// ===== КОНСТАНТЫ =====
const SVG_NS = "http://www.w3.org/2000/svg";
const CENTER_X = 500;
const CENTER_Y = 500;
const RADIUS_STEP = 140;
// Отступы и минимальное расстояние между технологиями на радаре
const POSITION_PAD = 30;           // отступ от границ колец
const POSITION_ANGLE_PAD = 2;      // отступ от границ секторов (в градусах)
const MIN_BLIP_DISTANCE = 28;      // минимальная дистанция между центрами технологий
// Размеры прямоугольников фона подписей колец (должны совпадать с renderRadarBackground)
const RING_LABEL_WIDTH = 180;
const RING_LABEL_HEIGHT = 42;
// Будут загружены из JSON
let RINGS = [];
let QUADRANTS = [];
let levelToRing = {};

// Экспорт констант в window для использования модулями
window.CENTER_X = CENTER_X;
window.CENTER_Y = CENTER_Y;
window.RADIUS_STEP = RADIUS_STEP;
window.POSITION_PAD = POSITION_PAD;
window.POSITION_ANGLE_PAD = POSITION_ANGLE_PAD;
window.MIN_BLIP_DISTANCE = MIN_BLIP_DISTANCE;
// Для директорской страницы все технологии отображаются как круги
// Экспорт TECHTYPE_TO_SHAPE в window для использования модулями (для совместимости)
window.TECHTYPE_TO_SHAPE = {
  "Базовые": "circle",
  "Интегрированные": "circle",
  "Платформенные решения": "circle",
  "Управление с ML и AI": "circle",
};

// ===== ИНИЦИАЛИЗАЦИЯ =====
// Инициализация приложения происходит в модуле app-init.js
// Здесь только загрузка модулей и экспорт констант

// Экспорт переменных в window для использования модулями (инициализируются в app-init.js)
// Эти переменные будут установлены после загрузки данных в app-init.js
// Временные значения для обратной совместимости
window.RINGS = RINGS;
window.QUADRANTS = QUADRANTS;
window.levelToRing = levelToRing;

// Загрузка модулей и инициализация приложения
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', async () => {
    try {
      await loadAllModules();
      // Инициализация происходит автоматически в app-init.js при загрузке DOM
    } catch (error) {
      // Ошибка инициализации приложения
    }
  });
} else {
  // DOM уже загружен
  (async () => {
    try {
      await loadAllModules();
      // Инициализация происходит автоматически в app-init.js при загрузке DOM
    } catch (error) {
      // Ошибка инициализации приложения
    }
  })();
}
