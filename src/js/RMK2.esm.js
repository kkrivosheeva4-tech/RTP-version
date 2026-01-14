// RMK2.esm.js
// ES Module версия RMK2.js
// Импортирует базовые модули через ES modules, остальные загружаются динамически для обратной совместимости

// Импорт базовых модулей через ES modules
import {
  DOMCache,
  DOMProxy,
  escapeHtml,
  ErrorHandler,
  EventManager,
  Memoization,
  ModuleLoader,
  RenderQueue,
  StateManager,
  FocusTrap,
  SVG_NS,
  CENTER_X,
  CENTER_Y,
  RADIUS_STEP,
  POSITION_PAD,
  POSITION_ANGLE_PAD,
  MIN_BLIP_DISTANCE,
  RING_LABEL_WIDTH,
  RING_LABEL_HEIGHT
} from './app-rmk.module.js';

// ===== КОНСТАНТЫ =====
// Константы уже экспортированы из app-rmk.module.js, но дублируем для обратной совместимости
const TECHTYPE_TO_SHAPE = {
  "Базовые": "triangle",
  "Интегрированные": "circle",
  "Платформенные решения": "square",
  "Управление с ML и AI": "star",
};

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
window.RING_LABEL_WIDTH = RING_LABEL_WIDTH;
window.RING_LABEL_HEIGHT = RING_LABEL_HEIGHT;
window.TECHTYPE_TO_SHAPE = TECHTYPE_TO_SHAPE;
window.RINGS = RINGS;
window.QUADRANTS = QUADRANTS;
window.levelToRing = levelToRing;

// ===== ДИНАМИЧЕСКАЯ ЗАГРУЗКА ОСТАЛЬНЫХ МОДУЛЕЙ =====
// Функция для динамической загрузки модулей (для обратной совместимости со старыми IIFE модулями)
function loadModule(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = false;
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

    // Core модули (базовые уже загружены через ES modules)
    '/src/js/modules/core/data-loader.js',
    '/src/js/modules/core/state-utils.js',
    '/src/js/modules/core/data-indexing.js',

    // UI модули
    '/src/js/modules/ui/detail-panel.js',
    '/src/js/modules/ui/filters.js',
    '/src/js/modules/ui/modals.js',
    '/src/js/modules/ui/forms.js',
    '/src/js/modules/ui/sidebar.js',
    '/src/js/modules/ui/modal-forms.js',
    '/src/js/modules/ui/report-status.js',
    '/src/js/modules/ui/tooltips.js',
    '/src/js/modules/ui/form-management.js',
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

    // Radar модули
    '/src/js/modules/radar/positioning.js',
    '/src/js/modules/radar/radar-renderer.js',
    '/src/js/modules/radar/quadrant-cache.js',
    '/src/js/modules/radar/quadrants.js',
    '/src/js/modules/radar/prospects-chart.js',
    '/src/js/modules/radar/radar-wrappers.js',
    '/src/js/modules/radar/radar-update.js',

    // Business модули
    '/src/js/modules/business/export.js',
    '/src/js/modules/business/auth.js',
    '/src/js/modules/business/priorities.js',

    // Integration модули
    '/src/js/modules/ui/select-events.js',
    '/src/js/modules/radar/radar-events.js',
    '/src/js/modules/integration/events.js',

    // App init
    '/src/js/modules/core/app-init.js'
  ];

  try {
    for (const module of modules) {
      await loadModule(module);
    }
  } catch (error) {
    console.error('Ошибка при загрузке модулей:', error);
    throw error;
  }
}

// Экспорт для использования в других модулях
export {
  DOMCache,
  DOMProxy,
  escapeHtml,
  ErrorHandler,
  EventManager,
  Memoization,
  ModuleLoader,
  RenderQueue,
  StateManager,
  FocusTrap,
  SVG_NS,
  CENTER_X,
  CENTER_Y,
  RADIUS_STEP,
  POSITION_PAD,
  POSITION_ANGLE_PAD,
  MIN_BLIP_DISTANCE,
  RING_LABEL_WIDTH,
  RING_LABEL_HEIGHT,
  TECHTYPE_TO_SHAPE,
  loadAllModules
};

// Загрузка модулей и инициализация приложения
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', async () => {
    try {
      await loadAllModules();
    } catch (error) {
      console.error('Ошибка инициализации приложения:', error);
    }
  });
} else {
  (async () => {
    try {
      await loadAllModules();
    } catch (error) {
      console.error('Ошибка инициализации приложения:', error);
    }
  })();
}
