// app-rmk.module.js
// Главный модуль приложения - импортирует и инициализирует все модули
// ES Module версия

// Импорт базовых утилит
import { DOMCache, DOMProxy, escapeHtml } from './modules/core/dom-utils.js';
import { ErrorHandler, EventManager, Memoization, ModuleLoader, RenderQueue } from './modules/core/core-utils.js';
import StateManager from './modules/core/state-manager.js';
import { FocusTrap } from './modules/ui/focus-trap.js';
import { renderAuth, checkArchitectRole, safeLogout, initTheme, showHelpMenu, initHelpButton, initCommonUI } from './modules/ui/common-ui.js';
import { showModal, hideModal, showInternalConfirm } from './modules/ui/modals.js';
import Toast from './modules/ui/toast.js';

// Экспорт констант (из RMK2.js)
export const SVG_NS = "http://www.w3.org/2000/svg";
export const CENTER_X = 500;
export const CENTER_Y = 500;
export const RADIUS_STEP = 140;
export const POSITION_PAD = 30;
export const POSITION_ANGLE_PAD = 8;
export const MIN_BLIP_DISTANCE = 28;
export const RING_LABEL_WIDTH = 180;
export const RING_LABEL_HEIGHT = 42;

// Экспорт модулей для использования в других частях приложения
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
  FocusTrap
};

// Экспорт в window для обратной совместимости со старыми скриптами
if (typeof window !== 'undefined') {
  window.DOMCache = DOMCache;
  window.DOMProxy = DOMProxy;
  window.escapeHtml = escapeHtml;
  window.ErrorHandler = ErrorHandler;
  window.EventManager = EventManager;
  window.Memoization = Memoization;
  window.ModuleLoader = ModuleLoader;
  window.RenderQueue = RenderQueue;
  window.StateManager = StateManager;
  window.FocusTrap = FocusTrap;

  // Константы
  window.SVG_NS = SVG_NS;
  window.CENTER_X = CENTER_X;
  window.CENTER_Y = CENTER_Y;
  window.RADIUS_STEP = RADIUS_STEP;
  window.POSITION_PAD = POSITION_PAD;
  window.POSITION_ANGLE_PAD = POSITION_ANGLE_PAD;
  window.MIN_BLIP_DISTANCE = MIN_BLIP_DISTANCE;
  window.RING_LABEL_WIDTH = RING_LABEL_WIDTH;
  window.RING_LABEL_HEIGHT = RING_LABEL_HEIGHT;

  // UI модули
  window.CommonUI = { renderAuth, checkArchitectRole, safeLogout, initTheme, showHelpMenu, initHelpButton, initCommonUI };
  window.renderAuth = renderAuth;
  window.checkArchitectRole = checkArchitectRole;
  window.safeLogout = safeLogout;
  window.showHelpMenu = showHelpMenu;
  window.Modals = { showModal, hideModal, showInternalConfirm };
  window.showModal = showModal;
  window.hideModal = hideModal;
  window.Toast = Toast;
}
