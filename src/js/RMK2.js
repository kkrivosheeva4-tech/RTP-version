// RMK2.js
// ===== ЗАГРУЗКА МОДУЛЕЙ =====
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
    '/src/js/modules/core/dom-utils.js',  // dom-cache + dom-proxy
    '/src/js/modules/core/core-utils.js',  // error-handler + event-manager + memoization + module-loader + render-queue
    '/src/js/modules/core/state-manager.js',
    '/src/js/modules/core/data-loader.js',
    '/src/js/modules/core/state-utils.js',  // state-accessors + state-subscriptions
    '/src/js/modules/core/data-indexing.js',  // data-index + tech-index

    // UI модули (detail-panel должен быть загружен до radar-wrappers, так как использует showDetail)
    '/src/js/modules/ui/detail-panel.js',

    // Radar модули
    '/src/js/modules/radar/positioning.js',
    '/src/js/modules/radar/radar-renderer.js',
    '/src/js/modules/radar/quadrant-cache.js',
    '/src/js/modules/radar/quadrants.js',
    '/src/js/modules/radar/prospects-chart.js',
    '/src/js/modules/radar/radar-wrappers.js',
    '/src/js/modules/radar/radar-update.js',

    // UI модули (остальные)
    '/src/js/modules/ui/filters.js',
    '/src/js/modules/ui/modals.js',
    '/src/js/modules/ui/forms.js',
    '/src/js/modules/ui/sidebar.js',
    '/src/js/modules/ui/modal-forms.js',
    '/src/js/modules/ui/report-status.js',
    '/src/js/modules/ui/tooltips.js',  // tooltip + hover
    '/src/js/modules/ui/form-management.js',  // form-events + form-handlers
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

    // Business модули
    '/src/js/modules/business/export.js',
    '/src/js/modules/business/auth.js',
    '/src/js/modules/business/priorities.js',

    // Integration модули (events должен быть загружен после всех зависимостей)
    // Новые модули обработчиков событий (загружаются перед events.js)
    '/src/js/modules/ui/select-events.js',  // теперь включает select-positioning
    '/src/js/modules/radar/radar-events.js',
    '/src/js/modules/integration/events.js',  // теперь включает utils

    // App init (должен быть загружен последним перед RMK2.js)
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

// ===== КОНСТАНТЫ =====
const SVG_NS = "http://www.w3.org/2000/svg";
const CENTER_X = 500;
const CENTER_Y = 500;
const RADIUS_STEP = 140;
// Отступы и минимальное расстояние между технологиями на радаре
const POSITION_PAD = 30;           // отступ от границ колец
const POSITION_ANGLE_PAD = 8;      // отступ от границ секторов (в градусах)
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
window.RING_LABEL_WIDTH = RING_LABEL_WIDTH;
window.RING_LABEL_HEIGHT = RING_LABEL_HEIGHT;
// Соответствие techType → форма
const TECHTYPE_TO_SHAPE = {
  "Базовые": "triangle",
  "Интегрированные": "circle",
  "Платформенные решения": "square",
  "Управление с ML и AI": "star",
};
// Экспорт TECHTYPE_TO_SHAPE в window для использования модулями
window.TECHTYPE_TO_SHAPE = TECHTYPE_TO_SHAPE;

// ===== ИНИЦИАЛИЗАЦИЯ RMK2 =====
// Функция инициализации RMK2 (вызывается после загрузки всех модулей)
function initRMK2() {
// Координаты вычисляются детерминированно на основе id, blocks и level
// ===== ПОДКЛЮЧЕНИЕ МОДУЛЕЙ (без fallback) =====
// Функции toKebab и requireGlobalModule находятся в модулях events.js (utils) и core-utils.js (module-loader)
const requireGlobalModule = window.requireGlobalModule || ((name) => {
  if (typeof window === 'undefined' || !window[name]) {
    const file = window.toKebab ? window.toKebab(name) : name.toLowerCase();
    throw new Error(`Модуль ${name} не загружен. Подключите src/js/modules/${file}.js перед RMK2.js`);
  }
  return window[name];
});

const DOMCache = requireGlobalModule('DOMCache');
const EventManager = requireGlobalModule('EventManager');
const RenderQueue = requireGlobalModule('RenderQueue');
const DataIndex = requireGlobalModule('DataIndex');
const Memoization = requireGlobalModule('Memoization');
const StateManager = requireGlobalModule('StateManager');
const ErrorHandler = requireGlobalModule('ErrorHandler');
const Positioning = requireGlobalModule('Positioning');
const RadarRenderer = requireGlobalModule('RadarRenderer');
const Filters = requireGlobalModule('Filters');
const Modals = requireGlobalModule('Modals');
const DataLoader = requireGlobalModule('DataLoader');
const DOMProxy = requireGlobalModule('DOMProxy');
const QuadrantCache = requireGlobalModule('QuadrantCache');
const Utils = requireGlobalModule('Utils');
const ModalForms = requireGlobalModule('ModalForms');
const Hover = requireGlobalModule('Hover');
const ReportStatus = requireGlobalModule('ReportStatus');
const SelectPositioning = requireGlobalModule('SelectPositioning');
// Новые модули
const StateAccessors = requireGlobalModule('StateAccessors');
const StateSubscriptions = requireGlobalModule('StateSubscriptions');
const TechIndex = requireGlobalModule('TechIndex');
const RadarWrappers = requireGlobalModule('RadarWrappers');
const RadarUpdate = requireGlobalModule('RadarUpdate');
const FormHandlers = requireGlobalModule('FormHandlers');
const AppInit = requireGlobalModule('AppInit');

// Используем функции из модуля data-loader.js
const vfsRead = DataLoader.vfsRead;
const vfsWrite = DataLoader.vfsWrite;
const fetchJsonWithCache = DataLoader.fetchJsonWithCache;
const clearFetchCache = DataLoader.clearFetchCache;
const loadJsonPreferVfs = DataLoader.loadJsonPreferVfs;
const loadData = DataLoader.loadData;
const ensureAndPersistNewTech = DataLoader.ensureAndPersistNewTech;
const switchEnterprise = DataLoader.switchEnterprise;
const showNotification = DataLoader.showNotification;

// ===== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ =====
// Переменные состояния перенесены в StateManager
// Для обратной совместимости создаем геттеры/сеттеры, которые синхронизируются с StateManager

// Инициализация состояния в StateManager
StateManager.set('technologies', []);
StateManager.set('enterpriseData', {});
StateManager.set('blockToQuadrant', {});
StateManager.set('currentEnterprise', "РМК");
StateManager.set('nextId', 1);
StateManager.set('currentTech', null);
StateManager.set('selectedBlipId', null);
StateManager.set('blocksList', []);
StateManager.set('functions', []);
StateManager.set('nameToBlockId', {});
StateManager.set('functionToBlockMap', {});
StateManager.set('currentZoomedQuadrant', null);
StateManager.set('quadrantsCache', new Map());
StateManager.set('quadrantsCacheVersion', 0);
StateManager.set('technologiesById', new Map());

// Геттеры для обратной совместимости находятся в модуле state-utils.js
// Используем функции из модуля
const getTechnologies = StateAccessors.getTechnologies;
const setTechnologies = StateAccessors.setTechnologies;
const getEnterpriseData = StateAccessors.getEnterpriseData;
const setEnterpriseData = StateAccessors.setEnterpriseData;
const getCurrentEnterprise = StateAccessors.getCurrentEnterprise;
const setCurrentEnterprise = StateAccessors.setCurrentEnterprise;
const getCurrentZoomedQuadrant = StateAccessors.getCurrentZoomedQuadrant;
const setCurrentZoomedQuadrant = StateAccessors.setCurrentZoomedQuadrant;
const getSelectedBlipId = StateAccessors.getSelectedBlipId;
const setSelectedBlipId = StateAccessors.setSelectedBlipId;
const getCurrentTech = StateAccessors.getCurrentTech;
const setCurrentTech = StateAccessors.setCurrentTech;
const getBlocksList = StateAccessors.getBlocksList;
const setBlocksList = StateAccessors.setBlocksList;
const getFunctions = StateAccessors.getFunctions;
const setFunctions = StateAccessors.setFunctions;
const getNameToBlockId = StateAccessors.getNameToBlockId;
const setNameToBlockId = StateAccessors.setNameToBlockId;
const getFunctionToBlockMap = StateAccessors.getFunctionToBlockMap;
const setFunctionToBlockMap = StateAccessors.setFunctionToBlockMap;
const getBlockToQuadrant = StateAccessors.getBlockToQuadrant;
const setBlockToQuadrant = StateAccessors.setBlockToQuadrant;
const getTechnologiesById = StateAccessors.getTechnologiesById;
const getQuadrantsCache = StateAccessors.getQuadrantsCache;
const getQuadrantsCacheVersion = StateAccessors.getQuadrantsCacheVersion;
const setQuadrantsCacheVersion = StateAccessors.setQuadrantsCacheVersion;

// Временные переменные (не переносятся в state-manager, т.к. не являются состоянием приложения)
let nextId = 1;
let ignoreOutsideClickUntil = 0;

// Экспорт переменных в window для использования модулями
window.RINGS = RINGS;
window.QUADRANTS = QUADRANTS;
window.levelToRing = levelToRing;
// Синхронизация с StateManager при инициализации
window.blockToQuadrant = getBlockToQuadrant();
window.technologies = StateManager.get('technologies');
window.enterpriseData = StateManager.get('enterpriseData');
window.currentEnterprise = StateManager.get('currentEnterprise');
window.currentZoomedQuadrant = StateManager.get('currentZoomedQuadrant');
window.blocksList = StateManager.get('blocksList');
window.functions = StateManager.get('functions');
window.nameToBlockId = StateManager.get('nameToBlockId');
window.functionToBlockMap = StateManager.get('functionToBlockMap');

// Подписки на изменения состояния находятся в модуле state-utils.js
// Инициализация подписок происходит автоматически при загрузке модуля StateSubscriptions

// Функции работы с индексом технологий находятся в модуле data-indexing.js
const rebuildTechnologiesIndex = TechIndex.rebuildTechnologiesIndex;
const getTechById = TechIndex.getTechById;

// DOM - используем DOMCache для получения элементов
// Функции создания DOM прокси находятся в модуле dom-utils.js
// Используем функции из модуля
const createDOMGetter = DOMProxy.createDOMGetter;
const createDOMProxy = DOMProxy.createDOMProxy;
const createElementProxy = DOMProxy.createElementProxy;

// Создаем прокси для элементов, используемых как объекты (с методами querySelector и т.д.)
const svg = createDOMProxy("techRadar");
const detailPanel = createDOMProxy("detailPanel");

// Создаем прокси для остальных DOM-элементов
const hoverLabel = createElementProxy("hoverLabel");
const searchInput = createElementProxy("searchInput");
const themeToggle = createElementProxy("themeToggle");

// authInfo и logoutContainer больше не используются в RMK2.js
// Они используются в модуле auth.js
const addTechBtn = createElementProxy("addTechBtn");

// Кэш для групп квадрантов (оптимизация DOM-запросов)
// Функции getQuadrantGroup и clearQuadrantGroupsCache вынесены в модуль quadrant-cache.js
const getQuadrantGroup = QuadrantCache.getQuadrantGroup;
const clearQuadrantGroupsCache = QuadrantCache.clearQuadrantGroupsCache;

// ===== ПОЗИЦИОНИРОВАНИЕ ТОЧЕК =====
// Функции позиционирования вынесены в модуль positioning.js
// Используем алиасы для обратной совместимости
const frac = Positioning.frac;
const getQuadrantIdForBlock = Positioning.getQuadrantIdForBlock;
const getQuadrantsForBlock = Positioning.getQuadrantsForBlock;
const getAllQuadrantsForTech = Positioning.getAllQuadrantsForTech;
const assignFixedPosition = Positioning.assignFixedPosition;
const assignFixedPositionForQuadrant = Positioning.assignFixedPositionForQuadrant;
const computeCoordinates = Positioning.computeCoordinates;
const applyNonOverlappingLayout = Positioning.applyNonOverlappingLayout;
const avoidRingLabelOverlap = Positioning.avoidRingLabelOverlap;

// ===== ФИЛЬТРЫ =====
// Функции фильтрации вынесены в модуль filters.js
// Используем алиасы для обратной совместимости
const createCheckboxOptionLi = Filters.createCheckboxOptionLi;
const createSelectAllLi = Filters.createSelectAllLi;
const getFilterValues = Filters.getFilterValues;
const populateSelect = Filters.populateSelect;
const populateSelectForModal = Filters.populateSelectForModal;
const renderMultiSelectTags = Filters.renderMultiSelectTags;
const updateFunctionFilterForBlock = Filters.updateFunctionFilterForBlock;
const updateBlockFilterForZoomedQuadrant = Filters.updateBlockFilterForZoomedQuadrant;
const setCustomSelectValue = Filters.setCustomSelectValue;
const resetCustomSelects = Filters.resetCustomSelects;

// ===== МОДАЛЬНЫЕ ОКНА =====
// Функции модальных окон вынесены в модуль modals.js
// Используем обертки для обратной совместимости с дополнительной логикой
// showModal и hideModal определены ниже как обертки с дополнительной логикой
const showInternalConfirm = Modals.showInternalConfirm;

// Функции рендеринга вынесены в модуль radar-wrappers.js
const computeShapeByTechType = RadarWrappers.computeShapeByTechType;
const renderRadarBackground = RadarWrappers.renderRadarBackground;
const renderLegend = RadarWrappers.renderLegend;
const renderRadar = RadarWrappers.renderRadar;
const createBlipWrapper = RadarWrappers.createBlipWrapper;
const createBlip = RadarWrappers.createBlip;

// Функция для проверки, заполнена ли оценка
// Функция isRatingFilled находится в модуле events.js (utils)
const isRatingFilled = Utils.isRatingFilled;

// Функция обновления радара вынесена в модуль radar-update.js
const updateRadar = RadarUpdate.updateRadar;

// Функции работы с сайдбаром вынесены в модуль sidebar.js
// updateSidebarLists, createTechListForSector, updateTechListItems, renderSectorTechListFilteredByCurrentFilters
// доступны через window из модуля sidebar.js

// ===== ПРЕДПРИЯТИЯ =====
// Функция switchEnterprise вынесена в модуль data-loader.js

// Элементы правой панели приоритета сектора (используем DOMCache)
const quadrantPriorityPanel = createElementProxy('quadrantPriorityPanel');
const qpTitleEl = createElementProxy('qpTitle');
const qpListEl = createElementProxy('qpList');
const qpSearchInput = createElementProxy('qpSearchInput');

// Функции работы с квадрантами вынесены в модуль quadrants.js
// getTechStatus, getQuadrantName, getTechnologiesForQuadrant, zoomQuadrant, unzoom
// доступны через window из модуля quadrants.js

// Функции приоритетов вынесены в модуль priorities.js
// recomputeQuadrantPriorityList, openQuadrantPriorityPanel, closeQuadrantPriorityPanel
// доступны через window из модуля priorities.js

// renderSectorTechListFilteredByCurrentFilters вынесена в модуль sidebar.js
// ===== ХОВЕР =====
// Функции getHoverText и debouncedHover находятся в модуле tooltips.js
const getHoverText = Hover.getHoverText;
const debouncedHover = window.debouncedHover; // Создается в tooltips.js при загрузке

// Функция attachBlipHoverHandlers перенесена в модуль events.js
// Используем версию из events.js (модуль загружается перед RMK2.js)
function attachBlipHoverHandlers() {
  if (typeof window.attachBlipHoverHandlers === 'function') {
    window.attachBlipHoverHandlers();
  } else {
    console.warn('attachBlipHoverHandlers не найдена в events.js');
  }
}


  // ===== АВТОРИЗАЦИЯ =====
  // Функции аутентификации вынесены в модуль auth.js
  // Используем функции из модуля для обратной совместимости
  const checkArchitectRole = window.checkArchitectRole || (() => {
    console.warn('AuthModule не загружен. Используется fallback для checkArchitectRole.');
    const role = localStorage.getItem("role");
    return role === "architect" || role === "admin";
  });
  const renderAuth = window.renderAuth || (() => {
    console.warn('AuthModule не загружен. Используется fallback для renderAuth.');
  });


// ===== МОДАЛЬНЫЕ ОКНА =====
// Функции модальных окон вынесены в модуль modals.js
// Используем обертки для обратной совместимости с дополнительной логикой

// Функции модальных окон вынесены в модуль modals.js
// Используем функции из модуля (они уже экспортированы в window)
const showModal = window.showModal;
const hideModal = window.hideModal;

// Проверка, были ли изменения в форме модалки (сравнение текущих значений с исходными)
// Функции resetCustomSelects и setCustomSelectValue вынесены в модуль filters.js
// Используем алиасы для обратной совместимости (определены выше)

// Функции работы с формами вынесены в модуль forms.js
// Используем алиасы для обратной совместимости
const isFormDirty = window.FormsModule ? window.FormsModule.isFormDirty : (formEl) => {
  console.warn('FormsModule not loaded, isFormDirty fallback');
  return false;
};
const snapshotFormInitial = window.FormsModule ? window.FormsModule.snapshotFormInitial : (formEl) => {
  console.warn('FormsModule not loaded, snapshotFormInitial fallback');
};
const createCompanyRatingsFields = window.FormsModule ? window.FormsModule.createCompanyRatingsFields : (companies, containerId, prefix) => {
  console.warn('FormsModule not loaded, createCompanyRatingsFields fallback');
};
const updateTechRatingsVisibility = window.FormsModule ? window.FormsModule.updateTechRatingsVisibility : () => {
  console.warn('FormsModule not loaded, updateTechRatingsVisibility fallback');
};
const updateEditTechRatingsVisibility = window.FormsModule ? window.FormsModule.updateEditTechRatingsVisibility : (tech) => {
  console.warn('FormsModule not loaded, updateEditTechRatingsVisibility fallback');
};

// ===== ИНИЦИАЛИЗАЦИЯ =====
// Инициализация приложения вынесена в модуль app-init.js
// Модуль app-init.js инициализируется автоматически при загрузке DOM

// Обработчики форм находятся в модуле form-management.js
const getFormFieldValue = FormHandlers.getFormFieldValue;
const handleAddTechFormSubmit = FormHandlers.handleAddTechFormSubmit;
const handleEditTechFormSubmit = FormHandlers.handleEditTechFormSubmit;

// Экспорт функций для использования в других модулях
// Функции isNumericField, getReadinessColor, isReadinessField находятся в модуле events.js (utils)
const isNumericField = Utils.isNumericField;
const getReadinessColor = Utils.getReadinessColor;
const isReadinessField = Utils.isReadinessField;

// Экспорт функций в window для обратной совместимости
window.isNumericField = isNumericField;
window.getFilterValues = Filters.getFilterValues;
window.getEnterpriseData = getEnterpriseData;
window.getCurrentEnterprise = getCurrentEnterprise;
window.getCurrentZoomedQuadrant = getCurrentZoomedQuadrant;
window.getTechnologies = getTechnologies;
window.setCurrentTech = setCurrentTech;
window.getAllQuadrantsForTech = Positioning.getAllQuadrantsForTech;

// Экспорт функций для использования в events.js и других модулях
window.updateRadar = updateRadar;
window.getTechById = getTechById;
window.rebuildTechnologiesIndex = rebuildTechnologiesIndex;
window.getQuadrantIdForBlock = Positioning.getQuadrantIdForBlock;
window.setSelectedBlipId = setSelectedBlipId;
window.getCurrentTech = getCurrentTech;
window.setTechnologies = setTechnologies;
window.getQuadrantsCache = getQuadrantsCache;
window.setQuadrantsCacheVersion = setQuadrantsCacheVersion;
window.setEnterpriseData = setEnterpriseData;
window.handleAddTechFormSubmit = handleAddTechFormSubmit;
window.handleEditTechFormSubmit = handleEditTechFormSubmit;
window.getFormFieldValue = getFormFieldValue;
window.renderRadar = renderRadar;
window.computeShapeByTechType = computeShapeByTechType;
window.renderRadarBackground = renderRadarBackground;
window.renderLegend = renderLegend;
window.createBlip = createBlip;
} // Конец функции initRMK2

// Загрузка модулей и инициализация приложения
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', async () => {
    try {
      await loadAllModules();
      initRMK2();
    } catch (error) {
      console.error('Ошибка инициализации приложения:', error);
    }
  });
} else {
  // DOM уже загружен
  (async () => {
    try {
      await loadAllModules();
      initRMK2();
    } catch (error) {
      console.error('Ошибка инициализации приложения:', error);
    }
  })();
}
