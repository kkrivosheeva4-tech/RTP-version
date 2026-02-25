// main.js — точка входа приложения (этап 7.2, 7.4)
// Основная страница радара для всех ролей (архитекторы, директоры, РП, администраторы)

import Logger from './js/modules/core/logger.js';
import './js/modules/core/escape-utils.js';
import './js/modules/core/dom-utils.js';
import StateManager from './js/modules/core/state-manager.js';
import './js/modules/core/validators.js';
import './js/modules/core/error-handler.js';
import './js/modules/core/data-source.js';
import './js/modules/core/data-normalize.js';
import './js/modules/core/data-service.js';
import './js/modules/core/data-loader.js';
import './js/modules/core/state-utils.js';

// UI модули (шаг 7.4 — вторая группа)
import './js/modules/ui/toast.js';
import './js/modules/ui/loading.js';
import './js/modules/ui/error-display.js';
import './js/modules/ui/detail-panel.js';
import './js/modules/ui/filters.js';
import './js/modules/ui/filter-init.js';
import './js/modules/ui/modals.js';
import './js/modules/ui/form-management.js';
import './js/modules/ui/focus-trap.js';
import './js/modules/ui/skeleton.js';
import './js/modules/ui/tooltips.js';
import './js/modules/ui/notifications.js';
import './js/modules/ui/report-status.js';
import './js/modules/ui/modal-forms.js';
import './js/modules/ui/sidebar.js';
import './js/modules/ui/forms.js';
import './js/modules/ui/common-ui.js';
import './js/modules/ui/tech-tabs-manager.js';
import './js/modules/ui/edit-tech-tabs-manager.js';
import './js/modules/ui/func-cover-calculator.js';
import './js/modules/ui/auto-func-cover.js';
import './js/modules/ui/mobile-nav.js';
import './js/modules/ui/touch-handlers.js';
import './js/modules/ui/keyboard-nav.js';
import './js/modules/ui/aria-manager.js';
import './js/modules/ui/offline-handler.js';
import './js/modules/ui/onboarding.js';
import './js/modules/ui/select-events.js';
import './js/modules/ui/vendors-files.js';

// Radar модули (шаг 7.4 — третья группа)
import './js/modules/radar/positioning.js';
import './js/modules/radar/quadrant-cache.js';
import './js/modules/radar/quadrants.js';
import './js/modules/radar/radar-renderer.js';
import './js/modules/radar/radar-wrappers.js';
import './js/modules/radar/radar-update.js';
import './js/modules/radar/spatial-index.js';
import './js/modules/radar/radar-events.js';

// Business модули (шаг 7.4 — четвёртая группа)
import './js/modules/business/export-fields-config.js';
import './js/modules/business/export-filters.js';
import './js/modules/business/export-pdf.js';
import './js/modules/business/export.js';
import './js/modules/business/auth.js';
import './js/modules/business/priorities.js';

// Analytics модули (шаг 7.4 — пятая группа)
import './js/modules/analytics/model-analytics.js';
import './js/modules/analytics/weight-optimizer.js';
import './js/modules/analytics/missing-data-predictor.js';
import './js/modules/analytics/temporal-dynamics.js';
import './js/modules/analytics/adaptive-calibration.js';

// Integration (шаг 7.4 — шестая группа): core-utils до events, т.к. initEventHandlers зависит от EventManager
import './js/modules/core/core-utils.js';
import './js/modules/integration/events.js';

// Оставшиеся модули (шаг 7.5 — статическая загрузка вместо loadModule)
import './js/audit-logger.js';
import './js/script.js';
import './js/radar-utils.js';
import './js/config/api-config.js';
import './js/modules/core/api-client.js';
import './js/modules/core/data-indexing.js';
import './js/modules/utils/func-cover-utils.js';
import './js/config/form-field-options.js';
import AppInit from './js/modules/core/app-init.js';

if (typeof window !== 'undefined') {
  window.Logger = Logger;
  window.StateManager = StateManager;
}

// Константы радара (экспорт в window для модулей)
const SVG_NS = 'http://www.w3.org/2000/svg';
const CENTER_X = 500;
const CENTER_Y = 500;
const RADIUS_STEP = 140;
const POSITION_PAD = 30;
const POSITION_ANGLE_PAD = 2;
const MIN_BLIP_DISTANCE = 28;
const RING_LABEL_WIDTH = 180;
const RING_LABEL_HEIGHT = 42;
let RINGS = [];
let QUADRANTS = [];
let levelToRing = {};

window.CENTER_X = CENTER_X;
window.CENTER_Y = CENTER_Y;
window.RADIUS_STEP = RADIUS_STEP;
window.POSITION_PAD = POSITION_PAD;
window.POSITION_ANGLE_PAD = POSITION_ANGLE_PAD;
window.MIN_BLIP_DISTANCE = MIN_BLIP_DISTANCE;
window.TECHTYPE_TO_SHAPE = {
  'Базовые': 'circle',
  'Интегрированные': 'circle',
  'Платформенные решения': 'circle',
  'Управление с ML и AI': 'circle',
};
window.RINGS = RINGS;
window.QUADRANTS = QUADRANTS;
window.levelToRing = levelToRing;

function bootstrap() {
  AppInit.initApp().catch((err) => {
    if (window.Logger) {
      window.Logger.error('Ошибка инициализации приложения:', err);
    } else {
      console.error('Ошибка инициализации приложения:', err);
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
