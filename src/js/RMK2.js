// RMK2.js
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
// Координаты вычисляются детерминированно на основе id, blocks и level
// ===== VFS: virtual file system using localStorage =====
function vfsKey(filename) { return `vfs:${filename}`; }
function vfsRead(filename) {
  try {
    const raw = localStorage.getItem(vfsKey(filename));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) { console.warn('vfsRead parse error', e); return null; }
}
function vfsWrite(filename, data) {
  try {
    localStorage.setItem(vfsKey(filename), JSON.stringify(data));
    console.debug(`vfsWrite: ${filename} saved to localStorage`);
    return true;
  } catch (e) { console.error('vfsWrite error', e); return false; }
}

// ===== ПОДКЛЮЧЕНИЕ МОДУЛЕЙ (без fallback) =====
function toKebab(name) {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/_/g, '-')
    .toLowerCase();
}
function requireGlobalModule(name) {
  if (typeof window === 'undefined' || !window[name]) {
    const file = toKebab(name);
    throw new Error(`Модуль ${name} не загружен. Подключите src/js/modules/${file}.js перед RMK2.js`);
  }
  return window[name];
}

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

// ===== СЕТЬ И КЭШ ОТВЕТОВ =====
// Кэшируем ответы fetch и дедуплицируем параллельные запросы, чтобы сократить трафик
const FETCH_CACHE_TTL_MS = 5 * 60 * 1000; // 5 минут
const DEFAULT_FETCH_TIMEOUT_MS = 8000;
const fetchCache = new Map();
const inflightFetches = new Map();

function clearFetchCache() {
  fetchCache.clear();
  inflightFetches.clear();
}

async function fetchJsonWithCache(url, { ttl = FETCH_CACHE_TTL_MS, timeout = DEFAULT_FETCH_TIMEOUT_MS } = {}) {
  const now = Date.now();
  const cached = fetchCache.get(url);
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  if (inflightFetches.has(url)) {
    return inflightFetches.get(url);
  }

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timerId = timeout ? setTimeout(() => controller?.abort(), timeout) : null;

  const promise = fetch(url, controller ? { signal: controller.signal } : undefined)
    .then(async (r) => {
      if (!r || !r.ok) {
        throw new Error(`HTTP ${r ? r.status : 'no response'}`);
      }
      return r.json();
    })
    .then((json) => {
      fetchCache.set(url, { data: json, expiresAt: now + ttl });
      return json;
    })
    .finally(() => {
      inflightFetches.delete(url);
      if (timerId) clearTimeout(timerId);
    });

  inflightFetches.set(url, promise);
  return promise;
}
async function loadJsonPreferVfs(filename) {
  const fromVfs = vfsRead(filename);
  if (fromVfs !== null) return { path: `local:${filename}`, data: fromVfs };
  const paths = [`/src/data/${filename}`, `/src/data/ru/${filename}`];
  for (const p of paths) {
    try {
      const json = await fetchJsonWithCache(p);
      if (json) return { path: p, data: json };
    } catch (err) { /* ignore fetch errors */ }
  }
  return { path: null, data: null };
}

// ===== УВЕДОМЛЕНИЯ =====
function showNotification(message, isSuccess = false) {
  let panel = DOMCache.get('notificationPanel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'notificationPanel';
    panel.className = 'notification-panel';
    document.body.appendChild(panel);
    DOMCache.refresh('notificationPanel');
  }
  const notification = document.createElement('div');
  notification.className = `notification ${isSuccess ? 'success' : 'info'}`;
  notification.innerHTML = `
    <div class="notification-title">${isSuccess ? 'Успешно' : 'Уведомление'}</div>
    <div class="notification-message">${message}</div>
    <button class="notification-close" aria-label="Закрыть">&times;</button>
  `;
  const topZ = parseInt(panel.getAttribute('data-top-z') || '2000', 10) + 1;
  panel.setAttribute('data-top-z', String(topZ));
  notification.style.zIndex = String(topZ);
  panel.appendChild(notification);

  const closeBtn = DOMCache.find(notification, '.notification-close');
  const hide = () => {
    notification.style.animation = 'slideOutRight 0.28s ease forwards';
    setTimeout(() => panel.contains(notification) && panel.removeChild(notification), 300);
  };
  if (closeBtn) EventManager.on('.notification-close', 'click', hide);
  EventManager.on('.notification', 'click', hide);
  setTimeout(hide, 4000);
}

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

// Геттеры для обратной совместимости (синхронизируются с StateManager)
function getTechnologies() { return StateManager.get('technologies'); }
function setTechnologies(value) {
  StateManager.set('technologies', value);
  window.technologies = value; // Синхронизация с window для модулей
}
function getEnterpriseData() { return StateManager.get('enterpriseData'); }
function setEnterpriseData(value) {
  StateManager.set('enterpriseData', value);
  window.enterpriseData = value;
}
function getCurrentEnterprise() { return StateManager.get('currentEnterprise'); }
function setCurrentEnterprise(value) {
  StateManager.set('currentEnterprise', value);
  window.currentEnterprise = value;
}
function getCurrentZoomedQuadrant() { return StateManager.get('currentZoomedQuadrant'); }
function setCurrentZoomedQuadrant(value) {
  StateManager.set('currentZoomedQuadrant', value);
  window.currentZoomedQuadrant = value;
}
function getSelectedBlipId() { return StateManager.get('selectedBlipId'); }
function setSelectedBlipId(value) { StateManager.set('selectedBlipId', value); }
function getCurrentTech() { return StateManager.get('currentTech'); }
function setCurrentTech(value) { StateManager.set('currentTech', value); }
function getBlocksList() { return StateManager.get('blocksList'); }
function setBlocksList(value) {
  StateManager.set('blocksList', value);
  window.blocksList = value;
}
function getFunctions() { return StateManager.get('functions'); }
function setFunctions(value) {
  StateManager.set('functions', value);
  window.functions = value;
}
function getNameToBlockId() { return StateManager.get('nameToBlockId'); }
function setNameToBlockId(value) {
  StateManager.set('nameToBlockId', value);
  window.nameToBlockId = value;
}
function getFunctionToBlockMap() { return StateManager.get('functionToBlockMap'); }
function setFunctionToBlockMap(value) {
  StateManager.set('functionToBlockMap', value);
  window.functionToBlockMap = value;
}
function getBlockToQuadrant() { return StateManager.get('blockToQuadrant'); }
function setBlockToQuadrant(value) {
  StateManager.set('blockToQuadrant', value);
  window.blockToQuadrant = value;
}
function getTechnologiesById() { return StateManager.get('technologiesById'); }
function getQuadrantsCache() { return StateManager.get('quadrantsCache'); }
function getQuadrantsCacheVersion() { return StateManager.get('quadrantsCacheVersion'); }
function setQuadrantsCacheVersion(value) { StateManager.set('quadrantsCacheVersion', value); }

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

// Подписки на изменения состояния для синхронизации window
StateManager.subscribeToKey('blockToQuadrant', (value) => { window.blockToQuadrant = value; });
StateManager.subscribeToKey('technologies', (value) => { window.technologies = value; });
StateManager.subscribeToKey('enterpriseData', (value) => { window.enterpriseData = value; });
StateManager.subscribeToKey('currentEnterprise', (value) => { window.currentEnterprise = value; });
StateManager.subscribeToKey('currentZoomedQuadrant', (value) => { window.currentZoomedQuadrant = value; });
StateManager.subscribeToKey('blocksList', (value) => { window.blocksList = value; });
StateManager.subscribeToKey('functions', (value) => { window.functions = value; });
StateManager.subscribeToKey('nameToBlockId', (value) => { window.nameToBlockId = value; });
StateManager.subscribeToKey('functionToBlockMap', (value) => { window.functionToBlockMap = value; });

// Подписки на изменения состояния для автоматического обновления UI
// При изменении technologies - обновляем радар и индекс
StateManager.subscribeToKey('technologies', (newValue, oldValue) => {
  rebuildTechnologiesIndex();
  // Не обновляем радар, если открыто модальное окно редактирования или добавления
  // Это предотвращает закрытие модального окна из-за перерисовки DOM
  const editPanel = document.getElementById('editTechPanel');
  const addPanel = document.getElementById('addTechPanel');
  const isModalOpen = (editPanel && (editPanel.style.display === 'block' || editPanel.classList.contains('open'))) ||
                      (addPanel && (addPanel.style.display === 'block' || addPanel.classList.contains('open')));

  if (isModalOpen) {
    // Если модальное окно открыто, пропускаем обновление радара
    return;
  }

  // Обновляем радар, если он уже отрисован (проверяем через DOMCache)
  const svgEl = DOMCache.get('techRadar');
  if (svgEl && svgEl.children && svgEl.children.length > 0) {
    // Используем debounce для избежания множественных обновлений
    if (typeof updateRadar === 'function') {
      requestAnimationFrame(() => {
        try {
          updateRadar();
        } catch (e) {
          console.warn('Ошибка при автоматическом обновлении радара:', e);
        }
      });
    }
  }
});

// При изменении currentEnterprise - обновляем фильтры и радар
StateManager.subscribeToKey('currentEnterprise', (newValue, oldValue) => {
  // Не обновляем радар, если открыто модальное окно редактирования или добавления
  const editPanel = document.getElementById('editTechPanel');
  const addPanel = document.getElementById('addTechPanel');
  const isModalOpen = (editPanel && (editPanel.style.display === 'block' || editPanel.classList.contains('open'))) ||
                      (addPanel && (addPanel.style.display === 'block' || addPanel.classList.contains('open')));

  // Обновляем фильтры предприятий, если они доступны
  const enterpriseData = getEnterpriseData();
  if (enterpriseData && Object.keys(enterpriseData).length > 0) {
    const companies = Object.keys(enterpriseData).filter(c => c);
    // Обновляем селект предприятий, если он существует
    const companySelect = document.querySelector('.enterprise-nav');
    if (companySelect) {
      // Обновление кнопок предприятий происходит через другие механизмы
      // Здесь можно добавить дополнительную логику при необходимости
    }
  }

  // Обновляем радар при смене предприятия только если модальное окно не открыто
  if (!isModalOpen) {
    const svgEl = DOMCache.get('techRadar');
    if (svgEl && svgEl.children && svgEl.children.length > 0) {
      if (typeof updateRadar === 'function') {
        requestAnimationFrame(() => {
          try {
            updateRadar();
          } catch (e) {
            console.warn('Ошибка при автоматическом обновлении радара при смене предприятия:', e);
          }
        });
      }
    }
  }
});

// При изменении selectedBlipId - обновляем подсветку blip'ов
StateManager.subscribeToKey('selectedBlipId', (newValue, oldValue) => {
  const svgEl = DOMCache.get('techRadar');
  if (!svgEl) return;

  // Снимаем подсветку со старого blip'а
  if (oldValue) {
    const oldBlip = svgEl.querySelector(`[data-tech-id="${oldValue}"]`);
    if (oldBlip) {
      oldBlip.classList.remove('selected');
    }
  }
  // Подсвечиваем новый blip
  if (newValue) {
    const newBlip = svgEl.querySelector(`[data-tech-id="${newValue}"]`);
    if (newBlip) {
      newBlip.classList.add('selected');
    }
  }
});

// При изменении currentZoomedQuadrant - обновляем отображение квадрантов
StateManager.subscribeToKey('currentZoomedQuadrant', (newValue, oldValue) => {
  // Обновление зума квадранта происходит через другие функции
  // Здесь можно добавить дополнительную логику при необходимости
});

// Обновить индекс технологий по id
function rebuildTechnologiesIndex() {
  const technologiesById = getTechnologiesById();
  technologiesById.clear();
  getTechnologies().forEach(tech => {
    if (tech && tech.id != null) {
      technologiesById.set(tech.id, tech);
    }
  });
  try { DataIndex.build(getTechnologies()); } catch (e) { console.warn('DataIndex.build failed', e); }
}

// Быстрый поиск технологии по id (O(1) вместо O(n))
function getTechById(id) {
  const technologiesById = getTechnologiesById();
  return technologiesById.get(id) || null;
}

// DOM - используем DOMCache для получения элементов
// Создаем функции-геттеры, которые возвращают элементы через DOMCache
function createDOMGetter(id) {
  return function() {
    return DOMCache.get(id);
  };
}

// Для элементов, которые используются как объекты (svg, detailPanel), создаем Proxy
function createDOMProxy(id) {
  return new Proxy({}, {
    get(target, prop) {
      const el = DOMCache.get(id);
      if (!el) {
        // Безопасные значения для отсутствующих элементов
        if (prop === 'querySelector') return () => null;
        if (prop === 'querySelectorAll') return () => [];
        if (prop === 'appendChild') return () => null;
        if (prop === 'getBoundingClientRect') return () => ({ top: 0, left: 0, width: 0, height: 0 });
        return null;
      }
      const value = el[prop];
      return typeof value === 'function' ? value.bind(el) : value;
    },
    set(target, prop, value) {
      const el = DOMCache.get(id);
      if (el) {
        el[prop] = value;
        return true;
      }
      return false;
    }
  });
}

// Создаем helper для создания Proxy с правильной обработкой отсутствующих элементов
function createElementProxy(id) {
  return new Proxy({}, {
    get(target, prop) {
      const el = DOMCache.get(id);
      if (!el) {
        // Для отсутствующих элементов возвращаем безопасные значения
        if (prop === 'addEventListener' || prop === 'removeEventListener') {
          // Возвращаем функцию, которая ничего не делает
          return function() {};
        }
        if (prop === 'checked') return false;
        if (prop === 'value') return '';
        if (prop === 'style') return {};
        if (prop === 'classList') return { add: () => {}, remove: () => {}, toggle: () => {} };
        if (prop === 'textContent') return '';
        if (prop === 'innerHTML') return '';
        return null;
      }
      const value = el[prop];
      // Привязываем методы к элементу
      if (typeof value === 'function') {
        return value.bind(el);
      }
      return value;
    },
    set(target, prop, value) {
      const el = DOMCache.get(id);
      if (el) {
        el[prop] = value;
        return true;
      }
      return false;
    }
  });
}

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
const quadrantGroupsCache = new Map();
function getQuadrantGroup(quadrantId) {
  if (!quadrantGroupsCache.has(quadrantId)) {
    const group = svg.querySelector(`.quadrant-group.q${quadrantId}`);
    if (group) {
      quadrantGroupsCache.set(quadrantId, group);
    } else {
      return null;
    }
  }
  return quadrantGroupsCache.get(quadrantId) || null;
}

// Очистить кэш групп квадрантов (при изменении структуры SVG)
function clearQuadrantGroupsCache() {
  quadrantGroupsCache.clear();
}

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

// Форма по типу технологии (используем модуль RadarRenderer)
function computeShapeByTechType(techType) {
  return RadarRenderer.computeShapeByTechType(techType, TECHTYPE_TO_SHAPE);
}

// ===== ЗАГРУЗКА ДАННЫХ =====
async function loadData() {
  // Очищаем кэш при загрузке
  Object.keys(localStorage).forEach(key => {
    if (key.startsWith('vfs:')) {
      localStorage.removeItem(key);
    }
  });
  clearFetchCache();

  // Helper: try to load JSON from VFS first, then from disk via fetch
  async function loadJsonPreferVfs(filename) {
    // Всегда пытаемся сначала загрузить из data/ru
    const paths = [`/src/data/ru/${filename}`, `/src/data/${filename}`];
    for (const p of paths) {
      try {
        const json = await fetchJsonWithCache(p, { ttl: FETCH_CACHE_TTL_MS, timeout: DEFAULT_FETCH_TIMEOUT_MS });
        if (json) {
          console.debug(`Загружены данные из файла ${p}:`, json);
          return { path: p, data: json };
        }
      } catch (err) {
        console.warn(`Ошибка загрузки ${p}:`, err);
      }
    }

    // Только если не удалось загрузить с диска, пробуем из VFS
    const fromVfs = vfsRead(filename);
    if (fromVfs !== null) {
      console.debug(`Загружены данные из VFS для ${filename}:`, fromVfs);
      return { path: `local:${filename}`, data: fromVfs };
    }

    return { path: null, data: null };
  }
  // Попытаться загрузить и распарсить JSON по наборам путей (data/ и data/ru/). Возвращает { path, data, errors }
  async function tryFetchAndParse(filename) {
    const paths = [`/src/data/${filename}`, `/src/data/ru/${filename}`];
    const errors = [];
    for (const p of paths) {
      try {
        const json = await fetchJsonWithCache(p, { ttl: FETCH_CACHE_TTL_MS, timeout: DEFAULT_FETCH_TIMEOUT_MS });
        if (json) {
          return { path: p, data: json };
        }
        errors.push(`${p} ответ: нет данных`);
      } catch (err) {
        errors.push(`Ошибка fetch(${p}): ${err?.message || err}`);
      }
    }
    return { path: null, data: null, errors };
  }

  try {
    // Load blocks list (prefer VFS)
    const b1 = await loadJsonPreferVfs('bloks.json');
    let blocks = b1.data;
    if (!blocks) {
      const alt = await loadJsonPreferVfs('blocks.json');
      if (alt.data) blocks = alt.data;
    }
    // Справочники блоков и список имен для селектов
    const blockIdToName = {};
    // Используем глобальную переменную nameToBlockId
    setNameToBlockId({});
    if (Array.isArray(blocks)) {
      const nameToBlockId = {};
      blocks.forEach(b => {
        const id = b?.id;
        const nm = b?.name || b;
        if (nm) {
          blockIdToName[id] = nm;
          nameToBlockId[nm] = id;
        }
      });
      setNameToBlockId(nameToBlockId);
    }
    setBlocksList(Array.isArray(blocks) ? blocks.map(b => (b && b.name) ? b.name : b).filter(Boolean) : []);

    const fileNames = [
      'functions.json',
      'techTypes.json',
      'status.json',
      'sector.json',
      'functionToBlock.json',
      'enterpriseData.json',
      'blockToQuadrant.json',
    ];

    const fetched = {};
    for (const fn of fileNames) {
      fetched[fn] = await loadJsonPreferVfs(fn);
    }

    // Соберём список отсутствующих/непреобразованных файлов
    const missing = [];
    if (!blocks) missing.push('bloks.json|blocks.json');
    for (const fn of fileNames) if (!fetched[fn].data) missing.push(fn);

    if (missing.length) {
      console.error('Ошибка загрузки данных. Подробности:', { fetched });
      const hint = missing.join(', ');
      throw new Error(`Не удалось загрузить файлы: ${hint}`);
    }

    // Базовая валидация полученных данных
    const validationErrors = [];
    const ensureArray = (name, value) => {
      if (!Array.isArray(value)) {
        validationErrors.push(`${name} не является массивом`);
        return [];
      }
      return value;
    };
    const ensureObject = (name, value) => {
      if (!value || typeof value !== 'object') {
        validationErrors.push(`${name} не является объектом`);
        return {};
      }
      return value;
    };

    // Присваиваем распаршенные данные
    const functionsData = ensureArray('functions.json', fetched['functions.json'].data);
    setFunctions(functionsData
      .map(f => (f && typeof f === 'object' && f.name) ? f.name : String(f || '')).filter(Boolean));
    const techTypes = ensureArray('techTypes.json', fetched['techTypes.json'].data);
    // Экспорт techTypes в window для использования модулями (обрабатываем как массив строк или объектов)
    window.techTypes = Array.isArray(techTypes) && techTypes.length > 0
      ? techTypes.map(t => (t && typeof t === 'object' && t.name) ? t.name : String(t || '')).filter(Boolean)
      : Object.keys(TECHTYPE_TO_SHAPE);
    const statusList = ensureArray('status.json', fetched['status.json'].data);
    const sectors = ensureArray('sector.json', fetched['sector.json'].data);
    setFunctionToBlockMap(ensureObject('functionToBlock.json', fetched['functionToBlock.json'].data));
    // enterpriseData may come from VFS (path startsWith 'local:') or from disk
    setEnterpriseData(ensureObject('enterpriseData.json', fetched['enterpriseData.json'].data));
    // If enterpriseData was loaded from VFS, attempt to read disk copy and merge any new entries (helps when user edited JSON on disk)
    try {
      if (fetched['enterpriseData.json'].path && String(fetched['enterpriseData.json'].path).startsWith('local:')) {
        // try disk locations
        const diskPaths = ['/src/data/enterpriseData.json', '/src/data/ru/enterpriseData.json'];
        for (const p of diskPaths) {
          try {
            const diskJson = await fetchJsonWithCache(p, { ttl: FETCH_CACHE_TTL_MS, timeout: DEFAULT_FETCH_TIMEOUT_MS });
            if (!diskJson) continue;
            // Merge: for each enterprise, add technologies with ids not present in VFS
            let merged = false;
            let enterpriseData = getEnterpriseData();
            Object.keys(diskJson).forEach(ent => {
              const arrDisk = Array.isArray(diskJson[ent]) ? diskJson[ent] : [];
              if (!enterpriseData[ent]) {
                enterpriseData[ent] = [];
                merged = merged || arrDisk.length > 0;
              }
              const existingIds = new Set((enterpriseData[ent] || []).map(t => Number(t.id)));
              arrDisk.forEach(t => {
                const tid = Number(t.id);
                if (!existingIds.has(tid)) {
                  enterpriseData[ent].push(t);
                  existingIds.add(tid);
                  merged = true;
                }
              });
            });
            if (merged) {
              console.info('VFS enterpriseData merged with disk copy from', p);
              setEnterpriseData({...enterpriseData}); // Сохраняем изменения обратно в StateManager
              try { vfsWrite('enterpriseData.json', enterpriseData); } catch (e) { console.warn('vfs write failed during merge', e); }
            }
            break; // whether merged or not, we've checked disk
          } catch (err) { /* ignore fetch parse errors for this path */ }
        }
      }
    } catch (err) { console.warn('Error while attempting to merge enterpriseData from disk into VFS', err); }
    if (validationErrors.length) {
      console.warn('Валидация данных: обнаружены проблемы', validationErrors);
      showNotification(`Проверка данных: ${validationErrors.join('; ')}`, false);
    }
    setBlockToQuadrant(fetched['blockToQuadrant.json'].data || {});
    // Инвалидируем кэш квадрантов при изменении blockToQuadrant
    const quadrantsCache = getQuadrantsCache();
    quadrantsCache.clear();
    setQuadrantsCacheVersion(getQuadrantsCacheVersion() + 1);
    // Установим RINGS и QUADRANTS из JSON
    RINGS = Array.isArray(statusList) ? statusList.slice() : ["Используемые", "Внедряемые", "Перспективные"];
    window.RINGS = RINGS;
    levelToRing = {};
    RINGS.forEach((rName, idx) => {
      levelToRing[rName] = idx;
      if (typeof rName === 'string' && rName.endsWith('ые')) {
        levelToRing[rName.slice(0, -2) + 'ая'] = idx;
      }
    });
    window.levelToRing = levelToRing;
    QUADRANTS = Array.isArray(sectors)
      ? sectors.map(s => ({ id: s.quadrant, name: s.name, startAngle: (s.quadrant - 1) * 90 }))
      : [
          { id: 1, name: "Корпоративное управление и администрация", startAngle: 0 },
          { id: 2, name: "Основное производство", startAngle: 90 },
          { id: 3, name: "Производственная поддержка и безопасность", startAngle: 180 },
          { id: 4, name: "Внешние бизнесы", startAngle: 270 },
        ];
    window.QUADRANTS = QUADRANTS;
    // Преобразуем enterpriseData к объекту по предприятиям, если пришел массив
    if (Array.isArray(fetched['enterpriseData.json'].data)) {
      const grouped = {};
      (fetched['enterpriseData.json'].data || []).forEach(item => {
        // Обрабатываем company как массив или строку
        const companies = Array.isArray(item.company) ? item.company : (item.company ? [item.company] : ['РМК']);
        // Преобразуем блоки (id → имя)
        const blockNames = Array.isArray(item.blocks)
          ? item.blocks.map(bid => (blockIdToName && blockIdToName[bid]) || '').filter(Boolean)
          : [];
        const normalized = Object.assign({}, item, {
          block: blockNames.length ? blockNames[0] : (typeof item.block === 'number' ? ((blockIdToName && blockIdToName[item.block]) || '') : (item.block || '')),
          blocks: blockNames.length ? blockNames : (Array.isArray(item.blocks) ? item.blocks : []),
          techType: item.techTypes || item.techType || '',
          level: item.status || item.level || '',
        });
        // Добавляем технологию во все указанные компании
        companies.forEach(company => {
          if (!grouped[company]) grouped[company] = [];
          grouped[company].push(normalized);
        });
      });
      setEnterpriseData(grouped);
    }

    // Заполнение фильтров
    populateSelect('block', getBlocksList(), 'Функциональные блоки: Все');
    populateSelect('function', getFunctions(), 'Функции: Все');
    populateSelect('techType', Array.isArray(techTypes) ? techTypes : Object.keys(TECHTYPE_TO_SHAPE), 'Тип технологий: Все');
    populateSelect('level', RINGS, 'Статус: Все');

    // Модальные окна
    // Список секторов: сначала пробуем взять из sector.json, если по какой-то причине
    // данные не загрузились — используем имена из QUADRANTS (дефолтные сектора радара).
    let sectorNames = [];
    if (Array.isArray(sectors) && sectors.length) {
      sectorNames = sectors.map(s => s && s.name).filter(Boolean);
    }
    if ((!Array.isArray(sectorNames) || sectorNames.length === 0) && Array.isArray(QUADRANTS) && QUADRANTS.length) {
      sectorNames = QUADRANTS.map(q => q && q.name).filter(Boolean);
    }
    populateSelectForModal('techSector', sectorNames, 'Выберите');
    populateSelectForModal('techBlock', getBlocksList(), 'Выберите');
    populateSelectForModal('techFunc', getFunctions(), 'Выберите');
    populateSelectForModal('techTechType', Array.isArray(techTypes) ? techTypes : Object.keys(TECHTYPE_TO_SHAPE), 'Выберите');
    populateSelectForModal('techStatus', RINGS, 'Выберите');
    // Заполняем список предприятий
    const enterpriseList = Object.keys(getEnterpriseData());
    populateSelectForModal('techCompany', enterpriseList, 'Выберите');
    // Заполняем список TRL с подсказками (объявляем один раз для обеих форм)
    const trlOptions = ['1 — Ранняя стадия (исследование)', '2 — Разработка (прототип)', '3 — Зрелость (готовность к внедрению)'];
    populateSelectForModal('techTrlStage', trlOptions, 'Выберите стадию');
    // Добавляем подсказки для опций TRL после создания опций
    const addTrlTooltips = (fieldId) => {
      const trlSelect = document.querySelector(`.custom-select-modal[data-field="${fieldId}"]`);
      if (trlSelect) {
        const options = trlSelect.querySelectorAll('.select-options li[data-value]');
        const tooltips = {
          '1 — Ранняя стадия (исследование)': 'Ранняя исследовательская стадия: технология находится на начальном этапе разработки, концепция только формируется',
          '2 — Разработка (прототип)': 'Стадия разработки и прототипирования: технология проходит активную разработку, создаются прототипы',
          '3 — Зрелость (готовность к внедрению)': 'Зрелая стадия: технология готова к внедрению и использованию в производстве'
        };
        options.forEach(li => {
          const value = li.getAttribute('data-value');
          if (value && tooltips[value]) {
            li.setAttribute('title', tooltips[value]);
          }
        });
      }
    };
    setTimeout(() => addTrlTooltips('techTrlStage'), 50);
    // Поле стоимости внедрения теперь доступно для всех статусов
    function setupCostToggle(prefix) {
      const group = document.getElementById(`${prefix}CostGroup`);
      if (!group) return;
      // Поле всегда видно для всех статусов
      group.style.display = '';
    }
    setupCostToggle('tech');
    // removed: digitalizationLevel, process (techLevel), ref

    // Настройка обработчиков форм
    const addTechForm = document.getElementById('addTechForm');
    if (addTechForm) {
      addTechForm.onsubmit = function(e) {
        e.preventDefault();
        const formData = new FormData(this);

        // Статус технологии выбирается из поля techStatus и
        // должен напрямую задавать уровень (кольцо) радара.
        const rawStatus = formData.get('techStatus');
        const selectedStatus =
          (rawStatus && rawStatus.toString().trim()) ||
          (Array.isArray(RINGS) && RINGS.length ? RINGS[0] : 'Используемые');

        const tech = {
          id: nextId++,
          name: formData.get('techName'),
          blocks: [formData.get('techBlock')],
          functions: [formData.get('techFunc')],
          techType: formData.get('techTechType'),
          // Явно сохраняем и status, и level, чтобы фильтры и приоритеты
          // всегда использовали одну и ту же строку статуса.
          status: selectedStatus,
          level: selectedStatus,
          description: formData.get('techDescription')
        };

        // Добавляем в массив технологий
        const technologies = getTechnologies();
        technologies.push(tech);
        setTechnologies([...technologies]);
        // Инвалидируем кэш квадрантов при добавлении технологии
        const quadrantsCache = getQuadrantsCache();
        quadrantsCache.clear();
        setQuadrantsCacheVersion(getQuadrantsCacheVersion() + 1);
        rebuildTechnologiesIndex();
        const enterpriseData = getEnterpriseData();
        const currentEnterprise = getCurrentEnterprise();
        enterpriseData[currentEnterprise] = [...technologies];
        setEnterpriseData({...enterpriseData});

        // Сохраняем в VFS
        vfsWrite('enterpriseData.json', enterpriseData);

        // Обновляем радар
        computeCoordinates(tech);
        updateRadar();

        // Закрываем модальное окно
        const modal = document.getElementById('addTechPanel');
        if (modal) modal.style.display = 'none';

        showNotification('Технология успешно добавлена', true);
        return false;
      };
    }

    const editTechForm = document.getElementById('editTechForm');
    if (editTechForm) {
      editTechForm.onsubmit = function(e) {
        e.preventDefault();
        if (!currentTech) return false;

        const formData = new FormData(this);

        // Новый статус при редактировании берём из поля editStatus.
        // Если пользователь не менял статус, оставляем прежний.
        const rawStatus = formData.get('editStatus');
        const selectedStatus =
          (rawStatus && rawStatus.toString().trim()) ||
          (currentTech.status && currentTech.status.toString().trim()) ||
          (currentTech.level && currentTech.level.toString().trim()) ||
          (Array.isArray(RINGS) && RINGS.length ? RINGS[0] : 'Используемые');

        const updatedTech = {
          ...currentTech,
          name: formData.get('editName'),
          blocks: [formData.get('editBlock')],
          functions: [formData.get('editFunc')],
          techType: formData.get('editTechType'),
          status: selectedStatus,
          level: selectedStatus,
          description: formData.get('editDescription')
        };

        // Обновляем в массиве
        const technologies = getTechnologies();
        const currentTech = getCurrentTech();
        const index = technologies.findIndex(t => t.id === currentTech.id);
        if (index !== -1) {
          technologies[index] = updatedTech;
          setTechnologies([...technologies]);
          rebuildTechnologiesIndex();
          const enterpriseData = getEnterpriseData();
          const currentEnterprise = getCurrentEnterprise();
          enterpriseData[currentEnterprise] = [...technologies];
          setEnterpriseData({...enterpriseData});

          // Сохраняем в VFS
          vfsWrite('enterpriseData.json', enterpriseData);

          // Обновляем координаты и радар
          computeCoordinates(updatedTech);
          updateRadar();

          // Обновляем панель деталей (источник — редактирование)
          showDetail(updatedTech, 'edit');
        }

        // Закрываем модальное окно
        const modal = document.getElementById('editTechPanel');
        if (modal) modal.style.display = 'none';

        showNotification('Технология успешно обновлена', true);
        return false;
      };
    }

    populateSelectForModal('editBlock', getBlocksList(), 'Выберите');
    populateSelectForModal('editFunc', getFunctions(), 'Выберите');
    populateSelectForModal('editTechType', techTypes, 'Выберите');
    populateSelectForModal('editStatus', RINGS, 'Выберите');
    // Используем уже объявленный trlOptions и addTrlTooltips для формы редактирования
    populateSelectForModal('editTrlStage', trlOptions, 'Выберите стадию');
    setTimeout(() => addTrlTooltips('editTrlStage'), 50);
    setupCostToggle('edit');

    // removed: editDigitalizationLevel, editLevel, editRef
    // --- Нормализация данных: вычислим и закрепим зрелости, форму и координаты для каждой технологии ---
    function normalizeEnterpriseData() {
      let updated = false;
      const enterpriseData = getEnterpriseData();
      Object.keys(enterpriseData).forEach(ent => {
        enterpriseData[ent] = enterpriseData[ent].map(t => {
          // Приведём id к числу
          t.id = Number(t.id) || nextId++;
          // Преобразуем блоки: числа → строки (страховка; основное преобразование делаем при загрузке)
          if (Array.isArray(t.blocks) && t.blocks.length && typeof t.blocks[0] === 'number') {
            try {
              t.blocks = t.blocks.map(b => String(b));
              t.block = t.blocks[0] || t.block;
            } catch (e) { /* ignore */ }
          }
          if (typeof t.block === 'number') t.block = String(t.block);
          // Нормализуем функции в массив строк
          if (t.functions && !Array.isArray(t.functions)) {
            t.functions = [String(t.functions)];
          }
          // level берём из статуса, если он указан
          if (t.status && !t.level) t.level = t.status;
          // Тип технологии: возможное поле techTypes → techType
          if (t.techTypes && !t.techType) t.techType = t.techTypes;
          // Вычислим форму строго по techType
          const newShape = computeShapeByTechType(t.techType) || 'circle';
          if (t.shape !== newShape) { t.shape = newShape; updated = true; }
          // Вычислим координаты
          const prevX = t.x, prevY = t.y;
          computeCoordinates(t);
          if (t.x !== prevX || t.y !== prevY) updated = true;
          return t;
        });
      });
      if (updated) {
        try { vfsWrite('enterpriseData.json', enterpriseData); } catch (e) { console.warn('Не удалось сохранить enterpriseData после нормализации', e); }
      }
    }
    normalizeEnterpriseData();
    // Обновим заголовки секторов в сайдбаре
    try {
      QUADRANTS.forEach(q => {
        const el = document.querySelector(`.sector-item[data-quadrant="${q.id}"]`);
        if (el) {
          const title = el.querySelector('.sector-title') || el;
          if (title) title.textContent = q.name;
        }
      });
    } catch (e) { /* ignore */ }
  } catch (error) {
    console.error('Ошибка загрузки данных:', error);
    // Добавим подсказку о возможной причине (локальное открытие файла без сервера)
    const msg = error?.message || '';
    alert('Не удалось загрузить данные приложения. ' + msg + '\nЕсли вы открываете страницу по протоколу file://, запустите локальный HTTP-сервер и откройте по http://localhost.');
  }
}

// ===== ФИЛЬТРЫ =====
// Функции фильтрации вынесены в модуль filters.js
// Используем алиасы для обратной совместимости (определены выше)

// Старые функции удалены - используются из модуля Filters
// Оставляем только функции, специфичные для модалок (updateModalBlocksForSectors, updateModalFunctionsForBlocks)

// Обновление списка функциональных блоков в модалке добавления/редактирования технологии
// в зависимости от выбранных секторов
function updateModalBlocksForSectors(sectorNames) {
  if (!functions || functions.length === 0) return;
  if (!functionToBlockMap || Object.keys(functionToBlockMap).length === 0) return;

  const select = document.querySelector('.custom-select[data-filter="function"]');
  if (!select) return;

  const optionsList = select.querySelector('.select-options');
  if (!optionsList) return;
  const hiddenInput = document.getElementById('filter_function');

  // Сохраняем текущие выбранные значения (множественный выбор)
  const currentSelected = getFilterValues('function');

  // Очищаем список опций
  optionsList.innerHTML = '';

  // Добавляем поиск
  const searchWrap = document.createElement('li');
  searchWrap.className = 'select-search';
  searchWrap.innerHTML = `<input type="text" placeholder="Поиск..." autocomplete="off" />`;
  optionsList.appendChild(searchWrap);

  // Добавляем "Выбрать все"
  optionsList.appendChild(createSelectAllLi());

  // Фильтруем функции по выбранным блокам
  let filteredFunctions = functions;
  const blockNamesArray = Array.isArray(blockNames) ? blockNames : (blockNames ? [blockNames] : []);
  if (blockNamesArray.length > 0 && nameToBlockId) {
    const selectedBlockIds = blockNamesArray
      .map(blockName => nameToBlockId[blockName])
      .filter(id => id != null);
    if (selectedBlockIds.length > 0) {
      filteredFunctions = functions.filter(funcName => {
        const blockIds = functionToBlockMap[funcName];
        if (!blockIds) return false;
        // blockIds может быть числом или массивом чисел
        const funcBlockIds = Array.isArray(blockIds) ? blockIds : [blockIds];
        return funcBlockIds.some(id => selectedBlockIds.includes(id));
      });
    }
  }

  // Добавляем отфильтрованные функции
  filteredFunctions.forEach(funcName => {
    const li = createCheckboxOptionLi(funcName, funcName);
    // Восстанавливаем выделение, если функция была выбрана и все еще доступна
    if (currentSelected.includes(funcName)) {
      li.classList.add('selected');
      const checkbox = li.querySelector('input[type="checkbox"]');
      if (checkbox) checkbox.checked = true;
    }
    optionsList.appendChild(li);
  });

  // Обновляем скрытое поле и отображение, оставляя только доступные выбранные функции
  const validSelected = currentSelected.filter(func => filteredFunctions.includes(func));
  if (hiddenInput) hiddenInput.value = JSON.stringify(validSelected);
  select.setAttribute('data-value', hiddenInput ? hiddenInput.value : JSON.stringify(validSelected));
  renderMultiSelectTags(select);

  // Если какие-то выбранные функции стали недоступны, обновляем радар
  if (validSelected.length !== currentSelected.length) {
    updateRadar();
  }
}

// Обновление списка функциональных блоков в модалке добавления/редактирования технологии
// в зависимости от выбранных секторов
function updateModalBlocksForSectors(sectorNames) {
  const blocksList = getBlocksList();
  if (!Array.isArray(blocksList) || blocksList.length === 0) return;
  if (!Array.isArray(QUADRANTS) || QUADRANTS.length === 0) return;
  const blockToQuadrant = getBlockToQuadrant();
  if (!blockToQuadrant || Object.keys(blockToQuadrant).length === 0) return;

  const blockSelect = document.querySelector('.custom-select-modal[data-field="techBlock"]');
  if (!blockSelect) return;
  const optionsList = blockSelect.querySelector('.select-options');
  if (!optionsList) return;
  const hiddenInput = document.getElementById('techBlock');

  // Текущий выбор блоков (множественный выбор)
  let currentSelected = [];
  if (hiddenInput && hiddenInput.value) {
    try {
      const parsed = JSON.parse(hiddenInput.value);
      if (Array.isArray(parsed)) currentSelected = parsed;
    } catch (e) {
      currentSelected = [];
    }
  }

  const sectorArray = Array.isArray(sectorNames)
    ? sectorNames
    : (sectorNames ? [sectorNames] : []);

  let allowedBlocks = blocksList.slice();

  if (sectorArray.length > 0) {
    // Маппинг "имя сектора" -> id квадранта
    const sectorNameToId = {};
    QUADRANTS.forEach(q => {
      if (q && q.name != null && q.id != null) {
        sectorNameToId[String(q.name).trim()] = q.id;
      }
    });
    const selectedQuadrantIds = sectorArray
      .map(name => sectorNameToId[String(name).trim()])
      .filter(id => id != null);

    if (selectedQuadrantIds.length > 0) {
      allowedBlocks = blocksList.filter(blockName => {
        const m = blockToQuadrant[blockName];
        if (m == null) return false;
        const arr = Array.isArray(m) ? m : [m];
        return arr.some(id => selectedQuadrantIds.includes(id));
      });
    }
  }

  // Перестраиваем список опций в модальном селекте блоков
  const existingSearch = optionsList.querySelector('.select-search');
  optionsList.innerHTML = '';
  if (existingSearch) optionsList.appendChild(existingSearch);

  // Добавляем опцию "Выбрать все" для блоков с чекбоксами
  const selectAllLi = document.createElement('li');
  selectAllLi.className = 'select-all-option';
  selectAllLi.innerHTML = `
    <label class="option-label">
      <input type="checkbox" class="select-all-checkbox" />
      <span>Выбрать все</span>
    </label>
  `;
  optionsList.appendChild(selectAllLi);

  // Оставляем только те выбранные блоки, которые доступны после фильтрации
  const validSelectedBlocks = currentSelected.filter(b => allowedBlocks.includes(b));

  allowedBlocks.forEach(blockName => {
    const li = document.createElement('li');
    li.classList.add('select-option-item');
    li.setAttribute('data-value', blockName);
    const isSelected = validSelectedBlocks.includes(blockName);
    li.innerHTML = `
      <label class="option-label">
        <input type="checkbox" class="option-checkbox" ${isSelected ? 'checked' : ''} />
        <span>${blockName}</span>
      </label>
    `;
    if (isSelected) {
      li.classList.add('selected');
    }
    optionsList.appendChild(li);
  });

  if (hiddenInput) {
    hiddenInput.value = validSelectedBlocks.length ? JSON.stringify(validSelectedBlocks) : '';
  }

  // Обновляем состояние чекбокса "Выбрать все"
  const allCheckbox = selectAllLi.querySelector('input[type="checkbox"]');
  if (allCheckbox && allowedBlocks.length > 0) {
    allCheckbox.checked = validSelectedBlocks.length === allowedBlocks.length;
  }

  // Обновляем отображение тегов
  renderMultiSelectTags(blockSelect);

  // После изменения доступных блоков, обновим функции в модалке
  updateModalFunctionsForBlocks(validSelectedBlocks, 'techFunc');
}

// Обновление списка функций в модалке добавления/редактирования технологии
// в зависимости от выбранных функциональных блоков
function updateModalFunctionsForBlocks(blockNames, fieldId) {
  if (!Array.isArray(functions) || functions.length === 0) return;
  if (!functionToBlockMap || Object.keys(functionToBlockMap).length === 0) return;
  if (!nameToBlockId || Object.keys(nameToBlockId).length === 0) return;

  const targetField = fieldId || 'techFunc';
  const funcSelect = document.querySelector(`.custom-select-modal[data-field="${targetField}"]`);
  if (!funcSelect) return;
  const optionsList = funcSelect.querySelector('.select-options');
  if (!optionsList) return;
  const hiddenInput = document.getElementById(targetField);

  // Текущее значение (множественный выбор)
  let currentSelected = [];
  if (hiddenInput && hiddenInput.value) {
    try {
      const parsed = JSON.parse(hiddenInput.value);
      if (Array.isArray(parsed)) currentSelected = parsed;
    } catch (e) {
      currentSelected = [];
    }
  }

  const blockNamesArray = Array.isArray(blockNames)
    ? blockNames
    : (blockNames ? [blockNames] : []);

  let allowedFunctions = functions.slice();

  if (blockNamesArray.length > 0) {
    const selectedBlockIds = blockNamesArray
      .map(blockName => nameToBlockId[blockName])
      .filter(id => id != null);

    if (selectedBlockIds.length > 0) {
      allowedFunctions = functions.filter(funcName => {
        const blockIds = functionToBlockMap[funcName];
        if (!blockIds) return false;
        const funcBlockIds = Array.isArray(blockIds) ? blockIds : [blockIds];
        return funcBlockIds.some(id => selectedBlockIds.includes(id));
      });
    }
  }

  // Перестраиваем список опций в модальном селекте функций
  const existingSearch = optionsList.querySelector('.select-search');
  optionsList.innerHTML = '';
  if (existingSearch) optionsList.appendChild(existingSearch);

  // Добавляем опцию "Выбрать все" для функций с чекбоксами
  const selectAllLi = document.createElement('li');
  selectAllLi.className = 'select-all-option';
  selectAllLi.innerHTML = `
    <label class="option-label">
      <input type="checkbox" class="select-all-checkbox" />
      <span>Выбрать все</span>
    </label>
  `;
  optionsList.appendChild(selectAllLi);

  // Оставляем только доступные выбранные функции
  const validSelectedFunctions = currentSelected.filter(f => allowedFunctions.includes(f));

  allowedFunctions.forEach(funcName => {
    const li = document.createElement('li');
    li.classList.add('select-option-item');
    li.setAttribute('data-value', funcName);
    const isSelected = validSelectedFunctions.includes(funcName);
    li.innerHTML = `
      <label class="option-label">
        <input type="checkbox" class="option-checkbox" ${isSelected ? 'checked' : ''} />
        <span>${funcName}</span>
      </label>
    `;
    if (isSelected) {
      li.classList.add('selected');
    }
    optionsList.appendChild(li);
  });

  if (hiddenInput) {
    hiddenInput.value = validSelectedFunctions.length ? JSON.stringify(validSelectedFunctions) : '';
  }

  // Обновляем состояние чекбокса "Выбрать все"
  const allCheckbox = selectAllLi.querySelector('input[type="checkbox"]');
  if (allCheckbox && allowedFunctions.length > 0) {
    allCheckbox.checked = validSelectedFunctions.length === allowedFunctions.length;
  }

  renderMultiSelectTags(funcSelect);
}

// Функция для обновления фильтра блоков при зуме/анзуме
// Вынесена в модуль filters.js - используется через алиас updateBlockFilterForZoomedQuadrant

// Функция для заполнения селекта в модальном окне
// Вынесена в модуль filters.js - используется через алиас populateSelectForModal

// Старая функция populateSelectForModal удалена - используется из модуля Filters
// Оставляем только функции, специфичные для модалок (updateModalBlocksForSectors, updateModalFunctionsForBlocks)

// Визуализация выбранных элементов для множественного выбора: теги с крестиком
// Вынесена в модуль filters.js - используется через алиас renderMultiSelectTags

// Функции рендеринга вынесены в модуль radar-renderer.js
// Используем обертки для обратной совместимости
function renderRadarBackground() {
  RadarRenderer.renderRadarBackground({
    SVG_NS,
    CENTER_X,
    CENTER_Y,
    RADIUS_STEP,
    RINGS,
    QUADRANTS,
    RING_LABEL_WIDTH,
    RING_LABEL_HEIGHT,
    svg,
    clearQuadrantGroupsCache,
    polarToCartesian: window.polarToCartesian,
    describeArc: window.describeArc,
    describeWedge: window.describeWedge
  });
}

// Легенда фигур технологий по типам (используем модуль)
function renderLegend() {
  RadarRenderer.renderLegend({
    SVG_NS,
    starPath: window.starPath
  });
}

// ===== РАДАР =====
// Функция рендеринга радара (используем модуль)
function renderRadar(data = getTechnologies()) {
  RadarRenderer.renderRadar(data, {
    technologies: getTechnologies(),
    levelToRing,
    QUADRANTS,
    svg,
    selectedBlipId: getSelectedBlipId(),
    attachBlipHoverHandlers,
    getAllQuadrantsForTech,
    assignFixedPositionForQuadrant,
    applyNonOverlappingLayout,
    avoidRingLabelOverlap,
    getQuadrantGroup,
    computeShapeByTechType,
    TECHTYPE_TO_SHAPE,
    createBlip: createBlipWrapper,
    renderRadarBackground,
    renderLegend
  });
}

// Обертка для createBlip из модуля
function createBlipWrapper(tech, pos, quadrant) {
  RadarRenderer.createBlip(tech, pos, quadrant, {
    SVG_NS,
    svg,
    getQuadrantGroup,
    computeShapeByTechType,
    TECHTYPE_TO_SHAPE,
    starPath: window.starPath,
    isRatingFilled,
    currentEnterprise: getCurrentEnterprise(),
    getTechById,
    showDetail
  });
}

// Ensure fields, compute coordinates and persist enterpriseData for a newly added tech
function ensureAndPersistNewTech(newTech) {
  try {
    if (!newTech) return;
    // Trim block and level
    if (newTech.block && typeof newTech.block === 'string') newTech.block = newTech.block.trim();
    if (newTech.level && typeof newTech.level === 'string') newTech.level = newTech.level.trim();
    if (!newTech.level) newTech.level = 'Существующие';
    // Ensure mapping exists
    const bk = (newTech.blocks && newTech.blocks.length) ? (typeof newTech.blocks[0] === 'string' ? newTech.blocks[0].trim() : newTech.blocks[0]) : (typeof newTech.block === 'string' ? newTech.block : newTech.block);
    newTech.block = bk;
    if (!blockToQuadrant.hasOwnProperty(bk) || blockToQuadrant[bk] == null) {
      blockToQuadrant[bk] = 1;
      // add to selects
      const sidebarOptionsList = document.querySelector('.custom-select[data-filter="block"] .select-options');
      if (sidebarOptionsList) {
        const li = typeof createCheckboxOptionLi === 'function'
          ? createCheckboxOptionLi(bk, bk)
          : (function () {
              const tmpLi = document.createElement('li');
              tmpLi.classList.add('select-option-item');
              tmpLi.setAttribute('data-value', bk);
              tmpLi.textContent = bk;
              return tmpLi;
            })();
        sidebarOptionsList.appendChild(li);
      }
      document.querySelectorAll('.custom-select-modal[data-field="techBlock"], .custom-select-modal[data-field="editBlock"]').forEach(ms => {
        const opts = ms.querySelector('.select-options');
        if (opts) {
          const li = document.createElement('li');
          li.classList.add('select-option-item');
          li.setAttribute('data-value', bk);
          li.innerHTML = `<label class="option-label"><input type="checkbox" class="option-checkbox" /><span>${bk}</span></label>`;
          opts.appendChild(li);
        }
      });
      if (!blocksList.includes(bk)) blocksList.push(bk);
      try { vfsWrite('bloks.json', blocksList); vfsWrite('blockToQuadrant.json', blockToQuadrant); } catch (e) { console.warn('vfs write failed', e); }
    }
    // Ensure level mapping exists
    if (!levelToRing || !Object.prototype.hasOwnProperty.call(levelToRing, newTech.level)) {
      // fallback to default
      newTech.level = newTech.level || 'Существующие';
      if (!levelToRing[newTech.level]) newTech.level = 'Существующие';
    }

    // Compute coordinates taking into account existing technologies (technologies may include newTech)
    console.debug('ensureAndPersistNewTech: computing coordinates for', { id: newTech.id, block: newTech.block, level: newTech.level });
    computeCoordinates(newTech);
    console.debug('ensureAndPersistNewTech: coords computed', { id: newTech.id, x: newTech.x, y: newTech.y });

    // Ensure technologies array contains the tech (if not, add it)
    const technologies = getTechnologies();
    const existsIdx = technologies.findIndex(t => t.id === newTech.id);
    if (existsIdx === -1) {
      technologies.push(newTech);
    } else {
      technologies[existsIdx] = Object.assign({}, technologies[existsIdx], newTech);
    }
    setTechnologies([...technologies]);

    // Synchronize enterpriseData for current enterprise before persisting
    try {
      const enterpriseData = getEnterpriseData();
      const currentEnterprise = getCurrentEnterprise();
      enterpriseData[currentEnterprise] = Array.isArray(enterpriseData[currentEnterprise]) ? [...technologies] : [...technologies];
      setEnterpriseData({...enterpriseData});
      vfsWrite('enterpriseData.json', enterpriseData);
      console.debug('ensureAndPersistNewTech: enterpriseData persisted for', currentEnterprise, 'total techs:', technologies.length);
    } catch (e) { console.warn('persist enterpriseData failed', e); }
  } catch (err) { console.warn('ensureAndPersistNewTech error', err); }
}

// Функция для проверки, заполнена ли оценка (вынесена на уровень модуля)
function isRatingFilled(rating) {
  if (rating === undefined || rating === null) return false;
  const str = String(rating).trim();
  return str !== '' && str !== 'null' && str !== 'undefined';
}

// ===== Приоритет технологии на основе TRL / готовностей =====
// Функции приоритетов вынесены в модуль priorities.js
// Используем функции из модуля через window (экспортированы из priorities.js)

// Функция создания blip'а (используем модуль)
function createBlip(tech, pos, quadrant = null) {
  createBlipWrapper(tech, pos, quadrant);
}

// Показ панели подробной информации для заданной технологии
// source:
//  - 'priority'  → открыто из панели приоритетов сектора
//  - 'blip'      → клик по точке на радаре
//  - другие/по умолчанию → из списка, формы и т.п.
// sourceQuadrant: опциональный квадрант, в котором был клик (для зума в правильный сектор)
function showDetail(t, source = 'unknown', sourceQuadrant = null) {
  if (!t) return;

  // Если сектор зуммирован и был совершен клик по blip на радаре при открытом модальном окне приоритетных технологий,
  // то модальное окно приоритетных технологий скрывается, чтобы панель детальной информации не открывалась под ним
  if (source === 'blip' &&
      currentZoomedQuadrant != null &&
      quadrantPriorityPanel &&
      quadrantPriorityPanel.classList.contains('open')) {
    closeQuadrantPriorityPanel();
  }

  currentTech = t;
  setSelectedBlipId(t.id);
  // Снять выделение со всех других blip
  svg.querySelectorAll('.blip.selected').forEach(el => el.classList.remove('selected'));

  // Всегда выделяем ВСЕ blip'ы этой технологии (подсветка и пульсация на всех экземплярах)
  // Квадрант используется только для зума, но подсветка должна быть везде
  svg.querySelectorAll(`.blip[data-id="${t.id}"]`).forEach(blipEl => {
    blipEl.classList.add('selected');
  });

  if (detailPanel) {
    console.debug('showDetail: показываем детали для', { id: t.id, name: t.name, data: t });

    detailPanel.querySelector('#panelTitle').textContent = t.name || 'Без названия';

    // Теги предприятий (company)
    const companyWrap = detailPanel.querySelector('#panelCompanyTags');
    if (companyWrap) {
      const companies = Array.isArray(t.company) ? t.company : (t.company ? [t.company] : []);
      companyWrap.innerHTML = companies.length
        ? companies.map(c => `<span class="multi-tag">${c}</span>`).join(' ')
        : '<span style="opacity:0.7">Не указано</span>';
    }

    // Теги блоков
    const blockWrap = detailPanel.querySelector('#panelBlock');
    const blocksArr = Array.isArray(t.blocks) && t.blocks.length ? t.blocks : (t.block ? [t.block] : []);
    const blockText = blocksArr.length ? blocksArr.join(', ') : 'Не указано';
    if (blockWrap) {
      blockWrap.innerHTML = blocksArr.length
        ? blocksArr.map(b => `<span class="multi-tag">${b}</span>`).join(' ')
        : '<span style="opacity:0.7">Не указано</span>';
    }

    // Теги функций
    const funcWrap = detailPanel.querySelector('#panelFunction');
    const functionsArr = Array.isArray(t.functions) && t.functions.length ? t.functions : (t.func ? [t.func] : []);
    const funcText = functionsArr.length ? functionsArr.join(', ') : 'Не указано';
    if (funcWrap) {
      funcWrap.innerHTML = functionsArr.length
        ? functionsArr.map(f => `<span class="multi-tag">${f}</span>`).join(' ')
        : '<span style="opacity:0.7">Не указано</span>';
    }

    const techTypeText = t.techType || 'Не указано';
    const descText = t.description || 'Описание отсутствует';

    detailPanel.querySelector('#panelTechType').textContent = techTypeText;
    detailPanel.querySelector('#panelDescription').textContent = descText;

    // Оценки 0-3
    const techReadEl = detailPanel.querySelector('#panelTechRead');
    const organReadEl = detailPanel.querySelector('#panelOrganRead');
    const funcCoverEl = detailPanel.querySelector('#panelFuncCover');
    const trlStageEl = detailPanel.querySelector('#panelTrlStage');

    // Проверяем, есть ли индивидуальные оценки по предприятиям
    const companies = Array.isArray(t.company) ? t.company : (t.company ? [t.company] : []);
    if (companies.length > 1 && t.companyRatings && typeof t.companyRatings === 'object') {
      // Несколько предприятий с индивидуальными оценками - показываем для текущего предприятия или все
      if (currentEnterprise && companies.includes(currentEnterprise) && t.companyRatings[currentEnterprise]) {
        const ratings = t.companyRatings[currentEnterprise];
        if (techReadEl) techReadEl.textContent = (ratings.techRead !== undefined && ratings.techRead !== null && ratings.techRead !== '') ? String(ratings.techRead) : '—';
        if (organReadEl) organReadEl.textContent = (ratings.organRead !== undefined && ratings.organRead !== null && ratings.organRead !== '') ? String(ratings.organRead) : '—';
      } else {
        // Показываем общие значения или значения первого предприятия
        const firstCompany = companies[0];
        const ratings = t.companyRatings[firstCompany] || {};
        if (techReadEl) techReadEl.textContent = (ratings.techRead !== undefined && ratings.techRead !== null && ratings.techRead !== '') ? String(ratings.techRead) : ((t.techRead ?? '') !== '' ? String(t.techRead) : '—');
        if (organReadEl) organReadEl.textContent = (ratings.organRead !== undefined && ratings.organRead !== null && ratings.organRead !== '') ? String(ratings.organRead) : ((t.organRead ?? '') !== '' ? String(t.organRead) : '—');
      }
    } else {
      // Одно предприятие или нет индивидуальных оценок - показываем общие значения
      if (techReadEl) techReadEl.textContent = (t.techRead ?? '') !== '' ? String(t.techRead) : '—';
      if (organReadEl) organReadEl.textContent = (t.organRead ?? '') !== '' ? String(t.organRead) : '—';
    }

    // Отображаем funcCover с учетом индивидуальных оценок
    if (funcCoverEl) {
      if (companies.length > 1 && t.companyRatings && typeof t.companyRatings === 'object') {
        if (currentEnterprise && companies.includes(currentEnterprise) && t.companyRatings[currentEnterprise]) {
          const ratings = t.companyRatings[currentEnterprise];
          funcCoverEl.textContent = (ratings.funcCover !== undefined && ratings.funcCover !== null && ratings.funcCover !== '') ? String(ratings.funcCover) : '—';
        } else {
          // Показываем общие значения или значения первого предприятия
          const firstCompany = companies[0];
          const ratings = t.companyRatings[firstCompany] || {};
          funcCoverEl.textContent = (ratings.funcCover !== undefined && ratings.funcCover !== null && ratings.funcCover !== '') ? String(ratings.funcCover) : ((t.funcCover ?? '') !== '' ? String(t.funcCover) : '—');
        }
      } else {
        funcCoverEl.textContent = (t.funcCover ?? '') !== '' ? String(t.funcCover) : '—';
      }
    }

    // Отображаем TRL (общий для всех предприятий)
    if (trlStageEl) {
      trlStageEl.textContent = (t.trlStage !== undefined && t.trlStage !== null && t.trlStage !== '') ? String(t.trlStage) : '—';
    }

    // Проверяем заполненность оценок и подсвечиваем кнопку/блок оценок при их отсутствии
    // Для технологий с несколькими предприятиями проверяем оценки текущего предприятия
    let techReadFilled = false;
    let organReadFilled = false;
    if (companies.length > 1 && t.companyRatings && typeof t.companyRatings === 'object') {
      if (currentEnterprise && companies.includes(currentEnterprise) && t.companyRatings[currentEnterprise]) {
        const ratings = t.companyRatings[currentEnterprise];
        techReadFilled = isRatingFilled(ratings.techRead);
        organReadFilled = isRatingFilled(ratings.organRead);
      } else {
        // Используем общие значения
        techReadFilled = isRatingFilled(t.techRead);
        organReadFilled = isRatingFilled(t.organRead);
      }
    } else {
      techReadFilled = isRatingFilled(t.techRead);
      organReadFilled = isRatingFilled(t.organRead);
    }
    const hasReadinessRatings = techReadFilled && organReadFilled;

    const editBtn = detailPanel.querySelector('#editTechBtn');
    const ratingsSection = detailPanel.querySelector('#panelRatingsSection');
    const ratingsHint = detailPanel.querySelector('#panelRatingsHint');

    if (!hasReadinessRatings) {
      if (editBtn) editBtn.classList.add('highlight-missing-ratings');
      if (ratingsSection) ratingsSection.classList.add('highlight-missing-ratings');
      if (ratingsHint) {
        ratingsHint.textContent = 'Заполните поля оценок';
        ratingsHint.style.display = 'block';
      }
    } else {
      if (editBtn) editBtn.classList.remove('highlight-missing-ratings');
      if (ratingsSection) ratingsSection.classList.remove('highlight-missing-ratings');
      if (ratingsHint) {
        ratingsHint.textContent = '';
        ratingsHint.style.display = 'none';
      }
    }

    // Приоритет технологии (0–1 → 0–100%)
    const prioritySection = detailPanel.querySelector('#panelPrioritySection');
    const priorityValueEl = detailPanel.querySelector('#panelPriorityValue');
    const priorityCommentEl = detailPanel.querySelector('#panelPriorityComment');
    if (prioritySection && priorityValueEl && priorityCommentEl) {
      // Используем текущее предприятие для вычисления приоритета, если технология с несколькими предприятиями
      const companies = Array.isArray(t.company) ? t.company : (t.company ? [t.company] : []);
      const companyForPriority = (companies.length > 1 && currentEnterprise && companies.includes(currentEnterprise)) ? currentEnterprise : null;
      const priority = computePriority(t, 'mult', companyForPriority);
      const category = getPriorityCategory(priority);

      prioritySection.classList.remove('priority-low', 'priority-medium', 'priority-high', 'priority-none');

      if (priority == null || category.key === 'none') {
        priorityValueEl.textContent = 'Приоритет: —';
        priorityCommentEl.textContent = category.description;
        prioritySection.classList.add('priority-none');
      } else {
        const percent = Math.round(priority * 100);
        priorityValueEl.textContent = `Приоритет: ${percent}% (${category.label})`;
        priorityCommentEl.textContent = getPriorityWeakLinkComment(t, companyForPriority);
        if (category.key === 'low') prioritySection.classList.add('priority-low');
        else if (category.key === 'medium') prioritySection.classList.add('priority-medium');
        else if (category.key === 'high') prioritySection.classList.add('priority-high');
      }
    }

    // Пример внедрения
    const exampleEl = detailPanel.querySelector('#panelExampleDesc');
    if (exampleEl) exampleEl.textContent = t.exampleDesc || '—';

    // Управление кнопкой «Назад к списку технологий» в шапке панели:
    // показываем её только если панель открыта из списка приоритетов сектора
    const backBtn = detailPanel.querySelector('#detailBackFromPriorityBtn');
    if (backBtn) {
      if (source === 'priority') {
        backBtn.style.display = 'inline-flex';
        backBtn.setAttribute('aria-hidden', 'false');
      } else {
        backBtn.style.display = 'none';
        backBtn.setAttribute('aria-hidden', 'true');
      }
    }

    // Добавляем дополнительный вывод для отладки
    console.debug('Отображаемые значения:', {
      block: blockText,
      function: funcText,
      techType: techTypeText,
      source,
    });

    detailPanel.style.display = 'block';
    detailPanel.classList.add('active');
  } else {
    console.warn('showDetail: detailPanel не найден');
  }

  // Определяем квадрант для отображения: используем переданный квадрант или вычисляем из первого блока
  // Если источник - 'priority', используем текущий зуммированный квадрант, если он есть
  const q = sourceQuadrant != null
    ? sourceQuadrant
    : (source === 'priority' && currentZoomedQuadrant != null)
      ? currentZoomedQuadrant
      : (() => {
          const blockKey = (t.blocks && t.blocks.length) ? t.blocks[0] : t.block;
          return getQuadrantIdForBlock(blockKey);
        })();

  // Попытаемся найти и выделить соответствующий сектор в сайдбаре
  // Индикаторы зрелости заменены на оценки (techRead, organRead, funcCover) и выводятся выше
  if (q != null) {
    try {
      const sectorItem = document.querySelector(`.sector-item[data-quadrant="${q}"]`);
      if (sectorItem) {
        // Если сектор пустой — не подсвечиваем, показываем уведомление
        const gEl = document.querySelector(`.quadrant-group.q${q}`);
        if (gEl && gEl.classList.contains('empty')) {
          showNotification('На данный момент в данном секторе отсутствуют технологии, но мы активно работаем над внедрением новых технологий.', false);
        } else {
          document.querySelectorAll('.sector-item').forEach(i => i.classList.remove('active'));
          sectorItem.classList.add('active');
          try {
            const existing = sectorItem.nextElementSibling;
            if (existing && existing.classList.contains('tech-list')) {
              const listItem = existing.querySelector(`.tech-list-item[data-tech-id="${t.id}"]`);
              if (listItem) {
                existing.querySelectorAll('.tech-list-item').forEach(li => li.classList.remove('selected'));
                listItem.classList.add('selected');
                listItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
              }
            } else {
              // Создаём список технологий в секторе
              document.querySelectorAll('.tech-list').forEach(tl => tl.parentNode?.removeChild(tl));
              createTechListForSector(sectorItem, q, getTechnologies());
              const newList = sectorItem.nextElementSibling;
              if (newList && newList.classList.contains('tech-list')) {
                const listItem = newList.querySelector(`.tech-list-item[data-tech-id="${t.id}"]`);
                if (listItem) {
                  newList.querySelectorAll('.tech-list-item').forEach(li => li.classList.remove('selected'));
                  listItem.classList.add('selected');
                  listItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                }
              }
            }
          } catch (errInner) {
            console.warn('showDetail: не удалось раскрыть список сектора:', errInner);
          }
        }
      }
    } catch (err) {
      console.warn('showDetail: Не удалось открыть сектор в сайдбаре:', err);
    }
  }

  // Выполним зум в квадрант, из которого был клик (или в первый доступный)
  // Если источник - 'priority' и сектор уже зуммирован, не применяем зум повторно
  if (q != null) {
    if (source === 'priority' && getCurrentZoomedQuadrant() === q) {
      // Сектор уже зуммирован, просто убедимся, что он правильно отображается
      const g = document.querySelector(`.quadrant-group.q${q}`);
      if (g && !g.classList.contains('zoomed-in')) {
        zoomQuadrant(q, { source: 'priority' });
      }
    } else {
      zoomQuadrant(q, { source: source === 'priority' ? 'priority' : 'blip' });
    }
  }
}

// ===== ФИЛЬТРАЦИЯ =====
// Вспомогательная функция для получения значений фильтра (массив для множественного выбора)
// Вынесена в модуль filters.js - используется через алиас getFilterValues

function updateRadar() {
  const b = getFilterValues('block');
  const f = getFilterValues('function');
  const tt = getFilterValues('techType');
  const l = getFilterValues('level');
  const q = (searchInput.value || '').toLowerCase().trim();

  // Оптимизация: предварительно нормализуем данные для поиска, если есть текстовый запрос
  const hasTextSearch = q.length > 0;
  const searchFieldsCache = hasTextSearch ? new Map() : null;

  // Используем DataIndex для быстрой фильтрации
  let filtered = DataIndex.filter((t) => {
    // Проверяем блок (может быть в t.block или t.blocks)
    if (b.length > 0) {
      const techBlocks = t.blocks && Array.isArray(t.blocks) ? t.blocks : (t.block ? [t.block] : []);
      if (!techBlocks.some(block => b.includes(block))) return false;
    }
    // Проверяем функцию (может быть в t.func или t.functions)
    if (f.length > 0) {
      const techFunctions = t.functions && Array.isArray(t.functions) ? t.functions : (t.func ? [t.func] : []);
      if (!techFunctions.some(func => f.includes(func))) return false;
    }
    // Проверяем тип технологии
    if (tt.length > 0 && !tt.includes(t.techType)) return false;
    // Проверяем статус
    if (l.length > 0 && !l.includes(t.level)) return false;
    return true;
  });

  // Применяем текстовый поиск поверх фильтров
  if (q) {
    filtered = filtered.filter(t => {
      // Используем кэш для нормализованных полей
      let normalizedFields = searchFieldsCache.get(t.id);
      if (!normalizedFields) {
        normalizedFields = [
          String(t.name || ''),
          String(t.description || ''),
          String(t.block || ''),
          ...(t.blocks || []),
          String(t.func || ''),
          ...(t.functions || []),
          String(t.techType || ''),
          String(t.level || ''),
          String(t.id || '')
        ].map(fld => fld.toLowerCase());
        searchFieldsCache.set(t.id, normalizedFields);
      }
      return normalizedFields.some(fld => fld.includes(q));
    });
  }

  // Оптимизация: группируем обновления DOM через RenderQueue
  RenderQueue.schedule(() => {
    renderRadar(filtered);

    // 🔥 Обновляем сайдбар ТОЛЬКО если есть активный поиск или фильтры
    const hasActiveFilter = b.length > 0 || f.length > 0 || tt.length > 0 || l.length > 0 || q;
    if (hasActiveFilter) {
      updateSidebarLists(filtered);
    } else {
      // Сбрасываем сайдбар: скрываем все списки
      // Оптимизация: собираем все элементы в один список перед операциями
      const techLists = DOMCache.queryAll('.tech-list');
      const sectorItems = DOMCache.queryAll('.sector-item');
      techLists.forEach(el => {
        el.classList.remove('open');
        setTimeout(() => el.remove(), 260);
      });
      sectorItems.forEach(el => {
        el.classList.remove('active');
      });
    }
  });

  // Если открыт модал приоритета сектора и есть зуммированный сектор,
  // обновляем список технологий в панели с учётом текущих фильтров
  if (quadrantPriorityPanel &&
      quadrantPriorityPanel.classList.contains('open') &&
      currentZoomedQuadrant != null) {
    recomputeQuadrantPriorityList(currentZoomedQuadrant);
  }
}

// Функции работы с сайдбаром вынесены в модуль sidebar.js
// updateSidebarLists, createTechListForSector, updateTechListItems, renderSectorTechListFilteredByCurrentFilters
// доступны через window из модуля sidebar.js

// ===== ПРЕДПРИЯТИЯ =====
function switchEnterprise(enterpriseName) {
  const enterpriseData = getEnterpriseData();
  if (!enterpriseData[enterpriseName]) {
    console.error(`Данные для предприятия "${enterpriseName}" не найдены`);
    return;
  }
  setCurrentEnterprise(enterpriseName);
  setTechnologies([...enterpriseData[enterpriseName]]);
  // Инвалидируем кэш квадрантов при смене предприятия
  const quadrantsCache = getQuadrantsCache();
  quadrantsCache.clear();
  setQuadrantsCacheVersion(getQuadrantsCacheVersion() + 1);
  rebuildTechnologiesIndex();
  const technologies = getTechnologies();
  nextId = technologies.length > 0 ? Math.max(...technologies.map((t) => t.id)) + 1 : 1;
  setCurrentTech(null);
  document.querySelectorAll('.custom-select').forEach(select => {
    const filterKey = select.getAttribute('data-filter');
    const hiddenInput = filterKey ? document.getElementById(`filter_${filterKey}`) : null;
    select.setAttribute('data-value', '');
    if (hiddenInput) hiddenInput.value = '';
    const placeholder = select.getAttribute('data-placeholder') || 'Выберите';
    const selectedText = select.querySelector('.selected-text');
    if (selectedText) {
      selectedText.textContent = placeholder;
      selectedText.innerHTML = placeholder; // Очищаем теги
    }
    // Снимаем выделение со всех элементов
    select.querySelectorAll('.select-options li').forEach(li => li.classList.remove('selected'));
  });
  searchInput.value = "";
  document.querySelectorAll(".sector-item").forEach(i => i.classList.remove("active"));
  updateRadar();
  unzoom();
}

// Глобальная переменная для хранения текущего зуммированного квадранта
let currentZoomedQuadrant = null;

// Элементы правой панели приоритета сектора
const quadrantPriorityPanel = document.getElementById('quadrantPriorityPanel');
const qpTitleEl = quadrantPriorityPanel ? quadrantPriorityPanel.querySelector('#qpTitle') : null;
const qpListEl = quadrantPriorityPanel ? quadrantPriorityPanel.querySelector('#qpList') : null;
const qpSearchInput = document.getElementById('qpSearchInput');

function getTechStatus(tech) {
  return (tech.status || tech.level || '').toString();
}

function getQuadrantName(qId) {
  try {
    const q = QUADRANTS.find(q => q.id === qId || q.quadrant === qId);
    return q ? (q.name || q.title || `Сектор ${qId}`) : `Сектор ${qId}`;
  } catch (e) {
    return `Сектор ${qId}`;
  }
}

function getTechnologiesForQuadrant(qId) {
  return getTechnologies().filter(t => {
    // Проверяем все квадранты технологии, а не только первый блок
    const techQuadrants = getAllQuadrantsForTech(t);
    return techQuadrants.includes(qId);
  });
}

// Функции приоритетов вынесены в модуль priorities.js
// recomputeQuadrantPriorityList, openQuadrantPriorityPanel, closeQuadrantPriorityPanel
// доступны через window из модуля priorities.js

// Функция для перемещения кнопки "Сбросить выбор" под фильтры при раскрытии панели
function moveResetButtonToFilterPanel() {
  const resetBtn = document.getElementById('resetIconBtn');
  const sidebarButtons = document.getElementById('sidebarButtons');
  const resetButtonContainer = document.getElementById('resetButtonContainer');

  if (!resetBtn || !sidebarButtons || !resetButtonContainer) return;

  // Проверяем, что кнопка еще не в контейнере фильтров
  if (resetBtn.parentNode === resetButtonContainer) return;

  // Добавляем класс для анимации
  resetBtn.classList.add('moving');

  // Используем requestAnimationFrame для плавного перехода
  requestAnimationFrame(() => {
    // Перемещаем в filterPanel
    resetButtonContainer.appendChild(resetBtn);
    // Обновляем tooltip
    resetBtn.removeAttribute('data-tooltip');

    // Убираем класс анимации после завершения перехода
    setTimeout(() => {
      resetBtn.classList.remove('moving');
    }, 400);
  });
}

function zoomQuadrant(qId, opts = {}) {
  const g = document.querySelector(`.quadrant-group.q${qId}`);
  if (!g) return;
  if (g.classList.contains('empty')) {
    showNotification('На данный момент в данном секторе отсутствуют технологии, но мы активно работаем над внедрением новых технологий.', false);
    return;
  }
  // Сначала снимаем зум со всех квадрантов, чтобы избежать множественного зума
  document.querySelectorAll(".quadrant-group").forEach(g2 => {
    g2.classList.remove("zoomed-in", "hidden");
  });
  // Затем применяем зум к нужному квадранту
  document.querySelectorAll(".quadrant-group").forEach(g2 => {
    if (+g2.dataset.quadrant !== qId) g2.classList.add("hidden");
    else g2.classList.add("zoomed-in");
  });

  // Показываем подписи колец при зуме (не скрываем их)
  const legendEl = document.querySelector(".legend");
  if (legendEl) legendEl.classList.add("hidden");

  // Применяем трансформацию через CSS
  const ringLabelsGroup = document.getElementById("ringLabelsGroup");
  if (ringLabelsGroup) {
    ringLabelsGroup.classList.remove("hidden");
    ringLabelsGroup.setAttribute("data-zoomed-quadrant", qId);
  }

  // Сохраняем текущий зуммированный квадрант
  currentZoomedQuadrant = qId;

  // Раскрываем боковую панель
  const sidebarWrapper = document.querySelector(".sidebar-wrapper");
  if (sidebarWrapper) {
    sidebarWrapper.classList.remove("collapsed");
    sidebarWrapper.classList.add("expanded");
    // Перемещаем кнопку "Сбросить выбор" под фильтры
    moveResetButtonToFilterPanel();
  }

  // Обновляем фильтр блоков, чтобы показывать только блоки этого сектора
  updateBlockFilterForZoomedQuadrant(qId);

  // Открываем правую панель приоритета сектора только,
  // если зум инициирован явно с сектора/его названия.
  if (opts && opts.source === 'sector') {
    openQuadrantPriorityPanel(qId);
  }
}

function unzoom() {
  document.querySelectorAll(".quadrant-group").forEach(g => {
    g.classList.remove("hidden", "zoomed-in");
  });

  // Восстанавливаем видимость легенды
  const legendEl = document.querySelector(".legend");
  if (legendEl) legendEl.classList.remove("hidden");

  // Убираем атрибут с информацией о зуме
  const ringLabelsGroup = document.getElementById("ringLabelsGroup");
  if (ringLabelsGroup) {
    ringLabelsGroup.removeAttribute("data-zoomed-quadrant");
  }

  // Сбрасываем текущий зуммированный квадрант
  setCurrentZoomedQuadrant(null);

  // Восстанавливаем фильтр блоков (показываем все блоки)
  updateBlockFilterForZoomedQuadrant(null);

  // Закрываем правую панель приоритета
  closeQuadrantPriorityPanel();
}

// renderSectorTechListFilteredByCurrentFilters вынесена в модуль sidebar.js
// ===== ХОВЕР =====
// Функция для получения текста подсказки с учетом незаполненных полей
const getHoverText = (tech) => {
  if (!tech) return '';

  const techReadFilled = isRatingFilled(tech.techRead);
  const organReadFilled = isRatingFilled(tech.organRead);
  const hasReadinessRatings = techReadFilled && organReadFilled;

  // Если базовые оценки не заполнены — показываем текущее предупреждение.
  if (!hasReadinessRatings) {
    return `${tech.name}\nНеобходимо заполнить поля оценок!`;
  }

  const priority = computePriority(tech, 'mult');
  const category = getPriorityCategory(priority);

  if (priority == null || category.key === 'none') {
    return `${tech.name}\nНедостаточно данных для расчёта приоритета.`;
  }

  const percent = Math.round(priority * 100);
  const weakLinkComment = getPriorityWeakLinkComment(tech);

  // Многострочный hover: название → приоритет → краткий комментарий.
  return `${tech.name}\nПриоритет: ${percent}% (${category.label})\n${weakLinkComment}`;
};

const debouncedHover = debounce((tech, visible) => {
  if (visible) {
    const text = tech ? getHoverText(tech) : '';
    hoverLabel.textContent = text;
    // Цвет подсказки один, классы категорий не используем
    hoverLabel.classList.remove('priority-low', 'priority-medium', 'priority-high');
    hoverLabel.style.opacity = "1";
  } else {
    hoverLabel.style.opacity = "0";
  }
}, 100);

function attachBlipHoverHandlers() {
  svg.querySelectorAll('.blip').forEach(b => {
    b.replaceWith(b.cloneNode(true));
  });
  svg.querySelectorAll('.blip').forEach(b => {
    b.addEventListener('mouseenter', () => {
      const id = +b.dataset.id;
      const tech = getTechById(id);
      if (!tech) return;
      b.classList.add('highlighted');

      // Подсвечиваем соответствующий элемент в модальном окне приоритетных технологий (если открыто)
      if (quadrantPriorityPanel && quadrantPriorityPanel.classList.contains('open') && qpListEl) {
        qpListEl.querySelectorAll('.qp-item').forEach(el => el.classList.remove('highlighted'));
        const priorityItem = qpListEl.querySelector(`.qp-item[data-tech-id="${id}"]`);
        if (priorityItem) {
          priorityItem.classList.add('highlighted');
          // Прокручиваем к элементу, если он не виден
          priorityItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }

      const rect = b.getBoundingClientRect();
      const svgRect = svg.getBoundingClientRect();
      const text = getHoverText(tech);
      hoverLabel.textContent = text;
      hoverLabel.classList.remove('priority-low', 'priority-medium', 'priority-high');
      // Точное позиционирование подсказки над blip по центру
      hoverLabel.style.left = `${rect.left + rect.width / 2 - svgRect.left}px`;
      hoverLabel.style.top = `${rect.top - svgRect.top}px`;
      hoverLabel.classList.add('visible');
    });

    b.addEventListener('mouseleave', () => {
      // Подсветка бордером только при ховере
      b.classList.remove('highlighted');
      hoverLabel.classList.remove('visible');
      // Убираем подсветку с элемента в модальном окне
      if (qpListEl) {
        qpListEl.querySelectorAll('.qp-item').forEach(el => el.classList.remove('highlighted'));
      }
    });

    // Надёжный обработчик клика на каждом blip, добавляем после клонирования.
    // Примечание: после клонирования blip теряет обработчики из createBlip, поэтому добавляем здесь
    b.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const id = +b.dataset.id;
      const blipQuadrant = b.dataset.quadrant ? +b.dataset.quadrant : null;
      const tech = getTechById(id);
      if (!tech) return;
      // Установим как текущую технологию
      setCurrentTech(tech);
      b.classList.remove('highlighted'); // убрать бордер, он только для hover

      // Обновим панель деталей, передавая квадрант blip'а
      // showDetail сам выделит все blip'ы технологии (подсветка и пульсация) и выполнит зум
      showDetail(tech, 'blip', blipQuadrant);
    });
  });
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

// Обертка для showModal с дополнительной логикой
function showModal(panelId) {
  Modals.showModal(panelId);
  const panel = typeof panelId === 'string' ? document.getElementById(panelId) : panelId;
  if (!panel) return;
  // Дополнительная логика: установка ignoreOutsideClickUntil и snapshotFormInitial
  // (это делается в модуле, но для совместимости оставляем здесь)
  // ignoreOutsideClickUntil устанавливается в модуле modals.js
  // snapshotFormInitial вызывается в модуле modals.js
}

// Обертка для hideModal с дополнительной логикой сброса форм
function hideModal(panelIdOrEl) {
  Modals.hideModal(panelIdOrEl);
  const panel = typeof panelIdOrEl === 'string' ? document.getElementById(panelIdOrEl) : panelIdOrEl;
  if (!panel) return;
  // Дополнительная логика сброса форм после закрытия
  if (panel.id === 'addTechPanel') {
    document.getElementById('addTechForm')?.reset();
    resetCustomSelects('add');
    document.getElementById('functionsContainer').innerHTML = '';
    // Сбрасываем видимость полей оценок
    if (typeof updateTechRatingsVisibility === 'function') {
      setTimeout(() => {
        updateTechRatingsVisibility();
      }, 50);
    }
  }
  if (panel.id === 'editTechPanel') {
    document.getElementById('editTechForm')?.reset();
    resetCustomSelects('edit');
  }
  if (panel.id === 'addBlockPanel') {
    document.getElementById('addBlockForm')?.reset();
    document.getElementById('functionsContainer').innerHTML = '';
    // Сброс кастомных выпадающих списков
    const sectorSelect = document.querySelector('.custom-select-modal[data-field="blockSector"]');
    if (sectorSelect) {
      const hiddenInput = document.getElementById('blockSector');
      if (hiddenInput) hiddenInput.value = '';
      const selectedTextEl = sectorSelect.querySelector('.selected-text');
      if (selectedTextEl) selectedTextEl.textContent = 'Выберите';
      sectorSelect.classList.remove('open');
      sectorSelect.querySelectorAll('.select-options li').forEach(li => li.classList.remove('selected'));
    }
  }
}

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
document.addEventListener("DOMContentLoaded", async () => {
  const savedTheme = localStorage.getItem("theme") || "light";
  if (savedTheme === "dark") {
    document.body.classList.add("dark");
    if (themeToggle) themeToggle.checked = true;
  }
  if (themeToggle) {
    themeToggle.addEventListener("change", () => {
      document.body.classList.toggle("dark", themeToggle.checked);
      localStorage.setItem("theme", themeToggle.checked ? "dark" : "light");
    });
  }

  await loadData();
  const selectedEnterprise = localStorage.getItem("selectedEnterprise") || "РМК";
  const enterpriseData = getEnterpriseData();
  const enterpriseToSwitch = enterpriseData && enterpriseData[selectedEnterprise] ? selectedEnterprise : "РМК";
  setCurrentEnterprise(enterpriseToSwitch);
  switchEnterprise(enterpriseToSwitch);
  renderAuth();
  // Первый рендер не оборачиваем в requestAnimationFrame, так как он выполняется при загрузке
  renderRadar();
  const debouncedSearch = debounce(() => updateRadar(), 300);
  if (searchInput) searchInput.addEventListener("input", debouncedSearch);
  // Фильтры
  const filterBtn = DOMCache.get('filterBtn');
  const filterPanel = DOMCache.get('filterPanel');
  if (filterBtn && filterPanel) {
    filterBtn.onclick = (e) => {
      e.stopPropagation();
      document.querySelectorAll('.custom-select').forEach(s => s.classList.remove('open'));
      const opening = !filterPanel.classList.contains('open');
      if (opening) {
        filterPanel.classList.remove('closing');
        filterPanel.classList.add('open');
      } else {
        filterPanel.classList.remove('open');
        filterPanel.classList.add('closing');
        setTimeout(() => filterPanel.classList.remove('closing'), 450);
      }
    };
  }

  // Предотвращаем стандартное поведение label при клике на span
  document.addEventListener('mousedown', (e) => {
    if (e.target.tagName === 'SPAN' && e.target.closest('.option-label span')) {
      const label = e.target.closest('.option-label');
      const li = label ? label.closest('.select-options li') : null;
      if (li && li.closest('.custom-select')) {
        // Предотвращаем стандартное поведение label, которое переключает чекбокс
        e.preventDefault();
      }
    }
  }, true); // Используем capture phase, чтобы перехватить событие до label

  // Обработчики кастомных селектов (sidebar)
  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('.custom-select .select-trigger');
    if (trigger) {
      const select = trigger.closest('.custom-select');
      document.querySelectorAll('.custom-select').forEach(s => {
        if (s !== select) s.classList.remove('open');
      });
      select.classList.toggle('open');
      if (select.classList.contains('open')) positionOptions(select);
      const searchInputInside = select.querySelector('.select-search input');
      if (searchInputInside) setTimeout(() => searchInputInside.focus(), 0);
      return;
    }

    // Пропускаем клики непосредственно на чекбокс (он обработается через change)
    if (e.target.type === 'checkbox') {
      return;
    }

    // Обработка клика на span внутри option-label - делаем его кликабельным
    // Находим li через span, чтобы обработать клик так же, как клик на li
    let li = null;
    const isClickOnSpan = e.target.tagName === 'SPAN' && e.target.closest('.option-label span');

    if (isClickOnSpan) {
      const label = e.target.closest('.option-label');
      li = label ? label.closest('.select-options li') : null;
      // Если кликнули на span, предотвращаем стандартное поведение label
      if (li) {
        e.preventDefault();
        e.stopPropagation();
        // Обрабатываем выбор напрямую, как будто кликнули на li
        // (продолжим обработку ниже, но li уже найден)
      }
    }

    // Если li не найден через span, ищем обычным способом
    if (!li) {
      li = e.target.closest('.select-options li');
    }

    if (li) {
      const select = li.closest('.custom-select');
      if (!select) return;
      const isMulti = select.getAttribute('data-multi') === 'true';
      const key = select.getAttribute('data-filter');
      const hiddenInput = key ? document.getElementById(`filter_${key}`) : null;

      // Пропускаем клики по элементам поиска
      if (li.classList.contains('select-search')) return;

      // Обработка "Выбрать все" для мультиселектов
      if (li.classList.contains('select-all-option') && isMulti) {
        const allCheckbox = li.querySelector('input[type="checkbox"]');
        // Если кликнули на span, инвертируем текущее состояние
        // Иначе используем текущее состояние чекбокса
        let shouldSelectAll;
        if (isClickOnSpan && allCheckbox) {
          shouldSelectAll = !allCheckbox.checked;
        } else {
          shouldSelectAll = allCheckbox ? allCheckbox.checked : true;
        }

        const optionLis = Array.from(select.querySelectorAll('.select-options li.select-option-item'));
        optionLis.forEach(optLi => {
          optLi.classList.toggle('selected', shouldSelectAll);
          const cb = optLi.querySelector('input[type="checkbox"]');
          if (cb) cb.checked = shouldSelectAll;
        });

        if (allCheckbox) allCheckbox.checked = shouldSelectAll;

        const selectedValues = shouldSelectAll
          ? optionLis
              .map(optLi => optLi.getAttribute('data-value'))
              .filter(v => v && v.length > 0)
          : [];

        if (hiddenInput) hiddenInput.value = JSON.stringify(selectedValues);
        select.setAttribute('data-value', hiddenInput ? hiddenInput.value : JSON.stringify(selectedValues));

        renderMultiSelectTags(select);
        positionOptions(select);

        if (key === 'block') {
          updateFunctionFilterForBlock(selectedValues);
        }
        updateRadar();
        return;
      }

      const value = li.getAttribute('data-value');

      if (isMulti) {
        // Множественный выбор: переключаем выделение
        li.classList.toggle('selected');
        const checkbox = li.querySelector('input[type="checkbox"]');
        if (checkbox) {
          checkbox.checked = li.classList.contains('selected');
        }

        const selected = Array.from(select.querySelectorAll('.select-options li.select-option-item.selected'))
          .map(x => x.getAttribute('data-value'))
          .filter(v => v && v.length > 0);

        if (hiddenInput) hiddenInput.value = JSON.stringify(selected);
        select.setAttribute('data-value', hiddenInput ? hiddenInput.value : JSON.stringify(selected));

        // Синхронизация состояния чекбокса "Выбрать все"
        const allLi = select.querySelector('.select-all-option');
        const allCheckbox = allLi ? allLi.querySelector('input[type="checkbox"]') : null;
        if (allCheckbox) {
          const optionLis = Array.from(select.querySelectorAll('.select-options li.select-option-item'));
          const allSelected = optionLis.length > 0 && optionLis.every(optLi => optLi.classList.contains('selected'));
          allCheckbox.checked = allSelected;
        }

        renderMultiSelectTags(select);
        positionOptions(select);

        if (key === 'block') {
          updateFunctionFilterForBlock(selected);
        }

        updateRadar();
        return;
      }

      // Одиночный выбор (старое поведение для обратной совместимости)
      const text = li.textContent;
      // Если выбран placeholder/пустое значение — сбросим селект
      if (!value) {
        select.setAttribute('data-value', '');
        const textEl = select.querySelector('.selected-text');
        if (textEl) {
          textEl.textContent = select.getAttribute('data-placeholder') || text;
        }
        select.querySelectorAll('.select-options li').forEach(opt => opt.classList.remove('selected'));
        select.classList.remove('open');
        if (hiddenInput) hiddenInput.value = '';
        updateRadar();
        if (key === 'block') {
          // При сбросе блока показываем все функции
          updateFunctionFilterForBlock(null);
        }
        return;
      }

      select.setAttribute('data-value', value);
      const textEl = select.querySelector('.selected-text');
      if (textEl) {
        textEl.textContent = text;
      }
      select.querySelectorAll('.select-options li').forEach(opt => opt.classList.toggle('selected', opt === li));
      select.classList.remove('open');
      if (hiddenInput) hiddenInput.value = value;

      // Если выбран блок, обновляем фильтр функций
      if (key === 'block') {
        updateFunctionFilterForBlock(value);
      }

      updateRadar();
      return;
    }

    if (!e.target.closest('.custom-select')) {
      document.querySelectorAll('.custom-select').forEach(s => s.classList.remove('open'));
    }
  });

  // Обработчик для синхронизации состояния чекбоксов при прямом клике на них
  document.addEventListener('change', (e) => {
    if (e.target.type === 'checkbox' && e.target.closest('.custom-select .select-options')) {
      const checkbox = e.target;
      const li = checkbox.closest('.select-options li');
      if (!li) return;

      const select = li.closest('.custom-select');
      if (!select) return;
      const isMulti = select.getAttribute('data-multi') === 'true';
      if (!isMulti) return;

      const key = select.getAttribute('data-filter');
      const hiddenInput = key ? document.getElementById(`filter_${key}`) : null;

      // Обработка "Выбрать все"
      if (li.classList.contains('select-all-option')) {
        const shouldSelectAll = checkbox.checked;
        const optionLis = Array.from(select.querySelectorAll('.select-options li.select-option-item'));
        optionLis.forEach(optLi => {
          optLi.classList.toggle('selected', shouldSelectAll);
          const cb = optLi.querySelector('input[type="checkbox"]');
          if (cb) cb.checked = shouldSelectAll;
        });

        const selectedValues = shouldSelectAll
          ? optionLis.map(optLi => optLi.getAttribute('data-value')).filter(v => v && v.length > 0)
          : [];

        if (hiddenInput) hiddenInput.value = JSON.stringify(selectedValues);
        select.setAttribute('data-value', hiddenInput ? hiddenInput.value : JSON.stringify(selectedValues));

        renderMultiSelectTags(select);
        positionOptions(select);

        if (key === 'block') {
          updateFunctionFilterForBlock(selectedValues);
        }
        updateRadar();
        return;
      }

      // Обычные элементы списка
      // Синхронизируем класс selected с состоянием чекбокса
      if (checkbox.checked) {
        li.classList.add('selected');
      } else {
        li.classList.remove('selected');
      }

      // Обновляем скрытое поле
      const selected = Array.from(select.querySelectorAll('.select-options li.select-option-item.selected'))
        .map(x => x.getAttribute('data-value'))
        .filter(v => v && v.length > 0);

      if (hiddenInput) hiddenInput.value = JSON.stringify(selected);
      select.setAttribute('data-value', hiddenInput ? hiddenInput.value : JSON.stringify(selected));

      // Синхронизация состояния чекбокса "Выбрать все"
      const allLi = select.querySelector('.select-all-option');
      const allCheckbox = allLi ? allLi.querySelector('input[type="checkbox"]') : null;
      if (allCheckbox) {
        const optionLis = Array.from(select.querySelectorAll('.select-options li.select-option-item'));
        const allSelected = optionLis.length > 0 && optionLis.every(optLi => optLi.classList.contains('selected'));
        allCheckbox.checked = allSelected;
      }

      renderMultiSelectTags(select);

      if (key === 'block') {
        updateFunctionFilterForBlock(selected);
      }

      updateRadar();
    }
  });

  // Обработчик закрытия панели приоритета сектора
  const closeQuadrantPriorityPanelBtn = document.getElementById('closeQuadrantPriorityPanel');
  if (closeQuadrantPriorityPanelBtn) {
    closeQuadrantPriorityPanelBtn.addEventListener('click', (e) => {
      e.preventDefault();
      // При клике на крестик считаем, что пользователь завершил просмотр сектора:
      // сбрасываем зум (unzoom сам закроет панель приоритета).
      unzoom();
    });
  }

  // Обработчики фильтров по статусам в панели приоритета
  if (quadrantPriorityPanel) {
    quadrantPriorityPanel.addEventListener('click', (e) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.classList.contains('qp-filter-btn')) {
        target.classList.toggle('active');
        if (currentZoomedQuadrant != null) {
          recomputeQuadrantPriorityList(currentZoomedQuadrant);
        }
      }
    });
  }

  // Обработчик поиска в панели приоритетов
  if (qpSearchInput) {
    const debouncedQpSearch = debounce(() => {
      if (currentZoomedQuadrant != null) {
        recomputeQuadrantPriorityList(currentZoomedQuadrant);
      }
    }, 300);
    qpSearchInput.addEventListener('input', debouncedQpSearch);
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.custom-select').forEach(s => s.classList.remove('open'));
    }
    const active = document.activeElement?.closest('.custom-select');
    if (!active || !active.classList.contains('open')) return;
    const items = Array.from(active.querySelectorAll('.select-options li'));
    if (items.length === 0) return;
    let idx = parseInt(active.getAttribute('data-kb-index') || '-1', 10);
    if (e.key === 'ArrowDown') idx = Math.min(idx + 1, items.length - 1);
    if (e.key === 'ArrowUp') idx = Math.max(idx - 1, 0);
    if (['ArrowDown', 'ArrowUp'].includes(e.key)) {
      e.preventDefault();
      active.setAttribute('data-kb-index', String(idx));
      items.forEach((el, i) => el.classList.toggle('selected', i === idx));
      items[idx].scrollIntoView({ block: 'nearest' });
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const sel = active.querySelector('.select-options li.selected') || items[0];
      if (sel) sel.click();
    }
  });

  // Поиск в фильтрах
  document.addEventListener('input', (e) => {
    const wrap = e.target.closest('.select-search');
    if (!wrap) return;
    const select = wrap.closest('.custom-select') || wrap.closest('.custom-select-modal');
    const list = select?.querySelector('.select-options');
    if (!list) return;
    const query = (e.target.value || '').toLowerCase();
    const items = Array.from(list.querySelectorAll('li[data-value]'));
    const starts = [];
    const contains = [];
    items.forEach(li => {
      const txt = (li.textContent || '').toLowerCase();
      if (!query) { starts.push(li); return; }
      if (txt.startsWith(query)) starts.push(li);
      else if (txt.includes(query)) contains.push(li);
      else li.style.display = 'none';
    });
    let idx = 0;
    [...starts, ...contains].forEach(li => {
      li.style.display = '';
      li.style.order = String(idx++);
    });
  });

  // Обработчики модальных селектов
  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('.custom-select-modal .select-trigger');
    if (trigger) {
      const select = trigger.closest('.custom-select-modal');
      document.querySelectorAll('.custom-select-modal').forEach(s => {
        if (s !== select) s.classList.remove('open');
      });
      select.classList.toggle('open');
      if (select.classList.contains('open')) positionOptions(select);
      const searchInputInside = select.querySelector('.select-search input');
      if (searchInputInside) setTimeout(() => searchInputInside.focus(), 0);
      return;
    }
    // Обработка клика на span внутри option-label - делаем его кликабельным
    // Находим li через span, чтобы обработать клик так же, как клик на li
    let li = null;
    const span = e.target.closest('.custom-select-modal .option-label span');
    if (span) {
      const label = span.closest('.option-label');
      li = label ? label.closest('.custom-select-modal .select-options li') : null;
    }

    // Если li не найден через span, ищем обычным способом
    if (!li) {
      li = e.target.closest('.custom-select-modal .select-options li');
    }
    if (li) {
      const select = li.closest('.custom-select-modal');
      const hiddenInputId = select.dataset.field;
      const hiddenInput = document.getElementById(hiddenInputId);
      const isMulti = select.getAttribute('data-multi') === 'true';

      // Пропускаем клики по элементам поиска
      if (li.classList.contains('select-search')) return;

      // Определяем, есть ли чекбоксы в этом селекте
      const hasCheckboxes = ['techBlock', 'techFunc', 'editBlock', 'editFunc'].includes(hiddenInputId);

      // Обработка "Выбрать все" для селектов с чекбоксами
      if (li.classList.contains('select-all-option') && isMulti && hasCheckboxes) {
        const allCheckbox = li.querySelector('input[type="checkbox"]');
        // Переключаем состояние (если кликнули не на сам чекбокс, переключаем его)
        if (e.target !== allCheckbox) {
          allCheckbox.checked = !allCheckbox.checked;
        }
        const shouldSelectAll = allCheckbox.checked;

        const optionLis = Array.from(select.querySelectorAll('.select-options li.select-option-item'));
        optionLis.forEach(optLi => {
          optLi.classList.toggle('selected', shouldSelectAll);
          const cb = optLi.querySelector('input[type="checkbox"]');
          if (cb) cb.checked = shouldSelectAll;
        });

        const selectedValues = shouldSelectAll
          ? optionLis.map(optLi => optLi.getAttribute('data-value')).filter(v => v && v.length > 0)
          : [];

        if (hiddenInput) hiddenInput.value = JSON.stringify(selectedValues);
        select.setAttribute('data-value', hiddenInput ? hiddenInput.value : JSON.stringify(selectedValues));

        renderMultiSelectTags(select);
        positionOptions(select);

        // Динамическая фильтрация
        if (hiddenInputId === 'techBlock') {
          updateModalFunctionsForBlocks(selectedValues, 'techFunc');
        } else if (hiddenInputId === 'editBlock') {
          updateModalFunctionsForBlocks(selectedValues, 'editFunc');
        }
        return;
      }

      const value = li.getAttribute('data-value');
      const text = li.textContent;

      if (isMulti) {
        // toggle selected
        li.classList.toggle('selected');

        // Обновляем состояние чекбокса, если он есть
        if (hasCheckboxes) {
          const checkbox = li.querySelector('input[type="checkbox"]');
          if (checkbox && e.target !== checkbox) {
            checkbox.checked = li.classList.contains('selected');
          } else if (checkbox && e.target === checkbox) {
            // Если кликнули на сам чекбокс, синхронизируем класс с его состоянием
            li.classList.toggle('selected', checkbox.checked);
          }
        }

        // Получаем выбранные значения (для селектов с чекбоксами используем select-option-item)
        const selectedSelector = hasCheckboxes
          ? '.select-options li.select-option-item.selected'
          : '.select-options li.selected';
        const selected = Array.from(select.querySelectorAll(selectedSelector))
          .map(x => x.getAttribute('data-value'))
          .filter(v => v && v.length > 0);

        if (hiddenInput) hiddenInput.value = JSON.stringify(selected);
        select.setAttribute('data-value', hiddenInput ? hiddenInput.value : JSON.stringify(selected));

        // Синхронизация состояния чекбокса "Выбрать все"
        if (hasCheckboxes) {
          const allLi = select.querySelector('.select-all-option');
          const allCheckbox = allLi ? allLi.querySelector('input[type="checkbox"]') : null;
          if (allCheckbox) {
            const optionLis = Array.from(select.querySelectorAll('.select-options li.select-option-item'));
            const allSelected = optionLis.length > 0 && optionLis.every(optLi => optLi.classList.contains('selected'));
            allCheckbox.checked = allSelected;
          }
        }

        // render tags for multi-selects
        renderMultiSelectTags(select);
        // keep the dropdown open for multi-select
        positionOptions(select);
        // Если это поле techCompany, обновляем видимость полей оценок
        if (hiddenInputId === 'techCompany') {
          setTimeout(() => {
            updateTechRatingsVisibility();
          }, 50);
        }
        // Динамическая фильтрация блоков и функций в модалке добавления технологии
        if (hiddenInputId === 'techSector') {
          // При изменении сектора пересчитываем доступные блоки и функции
          updateModalBlocksForSectors(selected);
        } else if (hiddenInputId === 'techBlock') {
          // При изменении блока(ов) пересчитываем функции для модалки добавления технологии
          updateModalFunctionsForBlocks(selected, 'techFunc');
        } else if (hiddenInputId === 'editBlock') {
          // Аналогично для модалки редактирования технологии
          updateModalFunctionsForBlocks(selected, 'editFunc');
        }
        return;
      }
      // single-select (existing behavior)
      // Если выбран placeholder (пустое значение) — полностью сбросим
      if (!value) {
        if (hiddenInput) hiddenInput.value = '';
        select.setAttribute('data-value', '');
        select.querySelector('.selected-text').textContent = select.getAttribute('data-placeholder') || 'Выберите';
        select.querySelectorAll('.select-options li').forEach(opt => opt.classList.remove('selected'));
        select.classList.remove('open');
        return;
      }
      if (hiddenInput) hiddenInput.value = value;
      select.setAttribute('data-value', value);
      select.querySelector('.selected-text').textContent = text;
      select.querySelectorAll('.select-options li').forEach(opt => opt.classList.toggle('selected', opt === li));
      select.classList.remove('open');
      return;
    }
    if (!e.target.closest('.custom-select-modal')) {
      document.querySelectorAll('.custom-select-modal').forEach(s => s.classList.remove('open'));
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.custom-select-modal').forEach(s => s.classList.remove('open'));
    }
    const active = e.target.closest('.custom-select-modal');
    if (!active || !active.classList.contains('open')) return;
    const items = Array.from(active.querySelectorAll('.select-options li'));
    if (items.length === 0) return;
    let idx = parseInt(active.getAttribute('data-kb-index') || '-1', 10);
    if (e.key === 'ArrowDown') idx = Math.min(idx + 1, items.length - 1);
    if (e.key === 'ArrowUp') idx = Math.max(idx - 1, 0);
    if (['ArrowDown', 'ArrowUp'].includes(e.key)) {
      e.preventDefault();
      active.setAttribute('data-kb-index', String(idx));
      items.forEach((el, i) => el.classList.toggle('selected', i === idx));
      items[idx].scrollIntoView({ block: 'nearest' });
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const sel = active.querySelector('.select-options li.selected') || items[0];
      if (sel) sel.click();
    }
  });

  // Поиск в модальных селектах
  document.addEventListener('input', (e) => {
    const wrap = e.target.closest('.select-search');
    if (!wrap) return;
    const select = wrap.closest('.custom-select-modal');
    const list = select?.querySelector('.select-options');
    if (!list) return;
    const query = (e.target.value || '').toLowerCase();
    const items = Array.from(list.querySelectorAll('li[data-value]'));
    const starts = [];
    const contains = [];
    items.forEach(li => {
      const txt = (li.textContent || '').toLowerCase();
      if (!query) { starts.push(li); return; }
      if (txt.startsWith(query)) starts.push(li);
      else if (txt.includes(query)) contains.push(li);
      else li.style.display = 'none';
    });
    let idx = 0;
    [...starts, ...contains].forEach(li => {
      li.style.display = '';
      li.style.order = String(idx++);
    });
  });

  // Предприятия
  const enterpriseButtons = document.querySelectorAll(".enterprise-nav button");
  enterpriseButtons.forEach(button => {
    if (button.textContent.trim() === currentEnterprise) {
      button.classList.add("active");
    }
  });
  enterpriseButtons.forEach(button => {
  button.addEventListener("click", () => {
    const selectedEnterprise = button.textContent.trim();
    if (selectedEnterprise === currentEnterprise) return;

    // Обновляем UI кнопок
    document.querySelectorAll(".enterprise-nav button").forEach(b => b.classList.remove("active"));
    button.classList.add("active");
    localStorage.setItem("selectedEnterprise", selectedEnterprise);

    // Immediately switch enterprise (use current in-memory enterpriseData which may come from VFS)
    try { switchEnterprise(selectedEnterprise); } catch (err) { console.warn('switchEnterprise failed', err); }

    // Генерируем событие для плавного перехода
    window.dispatchEvent(new CustomEvent('enterpriseChanged', {
      detail: { enterprise: selectedEnterprise }
    }));
  });
  });

  // Плавный локальный переход между предприятиями через событие enterpriseChanged
  // Если событие пришло (например, из script.js), выполним плавную смену без перезагрузки
  window.addEventListener('enterpriseChanged', (ev) => {
    try {
      const ent = ev?.detail?.enterprise || localStorage.getItem('selectedEnterprise');
      if (!ent || ent === currentEnterprise) return;
      // Лёгкая анимация: затемнение контейнера радара и сайдбара
      const main = document.querySelector('main') || document.body;
      main.style.transition = 'opacity 260ms ease';
      main.style.opacity = '1';

      setTimeout(() => {
    switchEnterprise(ent);
        renderAuth();
        updateRadar(); // теперь это не перерисовывает фон → нет скачков

        requestAnimationFrame(() => {
          main.style.opacity = '1';
          setTimeout(() => {
            main.style.transition = '';
          }, 300);
        });
      }, 260);
    } catch (e) {
      console.error('Ошибка в обработчике enterpriseChanged:', e);
    }
  });

  // Сброс
  // Функция сброса фильтров и выбора
  const resetFiltersAndSelection = () => {
    document.querySelectorAll(".sector-item").forEach(i => i.classList.remove("active"));
    document.querySelectorAll('.tech-list').forEach(tl => tl.remove());
    document.querySelectorAll('.custom-select').forEach(select => {
      const filterKey = select.getAttribute('data-filter');
      const hiddenInput = filterKey ? document.getElementById(`filter_${filterKey}`) : null;
      select.setAttribute('data-value', '');
      if (hiddenInput) hiddenInput.value = '';
      const placeholder = select.getAttribute('data-placeholder') || 'Выберите';
      const selectedText = select.querySelector('.selected-text');
      if (selectedText) {
        selectedText.textContent = placeholder;
        selectedText.innerHTML = placeholder; // Очищаем теги
      }
      // Снимаем выделение со всех элементов
      select.querySelectorAll('.select-options li').forEach(li => li.classList.remove('selected'));
    });
    document.querySelectorAll('.custom-select .select-search input').forEach(inp => { inp.value = ''; inp.dispatchEvent(new Event('input')); });
    searchInput.value = "";
    updateRadar();
    setSelectedBlipId(null);
    svg.querySelectorAll('.blip.highlighted').forEach(el => el.classList.remove('highlighted'));
    svg.querySelectorAll('.blip.selected').forEach(el => el.classList.remove('selected'));
    currentTech = null;
    if (detailPanel.classList.contains('active')) {
      detailPanel.classList.remove('active');
      detailPanel.style.display = 'none';
    }
    unzoom();
    showNotification('Выбор сброшен!', true);
  };

  document.getElementById("resetSectorBtn").addEventListener("click", resetFiltersAndSelection);

  // Обработчик для кнопки "Сбросить выбор" (работает как в sidebar-buttons, так и в filterPanel)
  const resetIconBtn = document.getElementById('resetIconBtn');
  if (resetIconBtn) {
    resetIconBtn.addEventListener('click', (e) => {
      // Если кнопка находится в sidebar-buttons, вызываем resetSectorBtn
      // Если в filterPanel - вызываем функцию напрямую
      const resetSectorBtn = document.getElementById("resetSectorBtn");
      if (resetSectorBtn) {
        resetSectorBtn.click();
      } else {
        resetFiltersAndSelection();
      }

      // Анимация иконки
      const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!prefersReduced) {
        const svg = resetIconBtn.querySelector('.icon-broom-leaf');
        if (svg) {
          svg.classList.remove('animate');
          void svg.offsetWidth;
          svg.classList.add('animate');
          setTimeout(() => svg.classList.remove('animate'), 1500);
        }
      }
    });
  }

  // --- Microinteraction handlers for bottom buttons and filter ---
  // Utility: respect prefers-reduced-motion
  const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Broom animation (reset button) — applied to inline SVG with class .icon-broom
  const resetBtn = document.getElementById('resetSectorBtn');
if (resetBtn) {
  resetBtn.addEventListener('click', () => {
    if (prefersReduced) return;

    const svg = resetBtn.querySelector('.icon-broom-leaf');
    if (!svg) return;

    svg.classList.remove('animate');
    void svg.offsetWidth;
    svg.classList.add('animate');

    setTimeout(() => svg.classList.remove('animate'), 1500);
  });
}

  // Export PDF animation — lines draw sequentially + pop
  const exportBtn = document.getElementById('exportPdfBtn');
  if (exportBtn) {
    exportBtn.addEventListener('click', (ev) => {
      if (prefersReduced) return;
      const svg = exportBtn.querySelector('.icon-pdf');
      if (!svg) return;
      svg.classList.remove('animate'); void svg.offsetWidth; svg.classList.add('animate');
      // Remove after 900ms (animation length)
      setTimeout(() => svg.classList.remove('animate'), 950);
    });
  }

  // Add tech button pulse
  const addBtn = document.getElementById('addTechBtn');
  if (addBtn) {
    addBtn.addEventListener('click', (ev) => {
      if (prefersReduced) return;
      const svgWrap = addBtn.querySelector('.icon-add');
      if (!svgWrap) return;
      svgWrap.classList.remove('animate'); void svgWrap.offsetWidth; svgWrap.classList.add('animate');
      setTimeout(() => svgWrap.classList.remove('animate'), 650);
    });
  }

  // Filter button: toggle animation
  if (filterBtn && filterPanel) {
    let wasOpen = filterPanel.classList.contains('open');

    const updateIconState = () => {
      const icon = filterBtn.querySelector('svg') || filterBtn.querySelector('.icon-filter');
      if (!icon) return;
      if (prefersReduced) return;

      const isOpen = filterPanel.classList.contains('open');

      // Если состояние изменилось, запускаем анимацию
      if (isOpen !== wasOpen) {
        // Удаляем все классы анимации
        icon.classList.remove('toggle', 'filter-reset');
        // Принудительно перерисовываем, чтобы сбросить предыдущую анимацию
        void icon.offsetWidth;

        if (isOpen) {
          // Открываем - запускаем анимацию вращения
          icon.classList.add('toggle');
        } else {
          // Закрываем - запускаем анимацию возврата
          icon.classList.add('filter-reset');
        }

        wasOpen = isOpen;
      }
    };

    // Следим за изменениями класса open на filterPanel
    const observer = new MutationObserver(updateIconState);
    observer.observe(filterPanel, { attributes: true, attributeFilter: ['class'] });

    // Инициализируем начальное состояние
    updateIconState();
  }

  // ===== Анимации для кнопок боковой панели =====
  // Reset button animation уже обрабатывается выше в обработчике resetIconBtn

  // Filter icon button animation (filterIconBtn)
  const filterIconBtn = document.getElementById('filterIconBtn');
  if (filterIconBtn && filterPanel) {
    let filterIconWasOpen = filterPanel.classList.contains('open');
    const updateFilterIconState = () => {
      const icon = filterIconBtn.querySelector('.icon-filter');
      if (!icon) return;
      if (prefersReduced) return;
      const isOpen = filterPanel.classList.contains('open');
      if (isOpen !== filterIconWasOpen) {
        icon.classList.remove('toggle', 'filter-reset');
        void icon.offsetWidth;
        if (isOpen) {
          icon.classList.add('toggle');
        } else {
          icon.classList.add('filter-reset');
        }
        filterIconWasOpen = isOpen;
      }
    };
    const filterObserver = new MutationObserver(updateFilterIconState);
    filterObserver.observe(filterPanel, { attributes: true, attributeFilter: ['class'] });
    updateFilterIconState();
  }

  // Add icon button animation (addIconBtn)
  const addIconBtn = document.getElementById('addIconBtn');
  if (addIconBtn) {
    addIconBtn.addEventListener('click', (ev) => {
      if (prefersReduced) return;
      const svgWrap = addIconBtn.querySelector('.icon-add');
      if (!svgWrap) return;
      svgWrap.classList.remove('animate');
      void svgWrap.offsetWidth;
      svgWrap.classList.add('animate');
      setTimeout(() => svgWrap.classList.remove('animate'), 650);
    });
  }

  // Report/Export PDF icon button animation (reportIconBtn)
  const reportIconBtn = document.getElementById('reportIconBtn');
  if (reportIconBtn) {
    reportIconBtn.addEventListener('click', (ev) => {
      if (prefersReduced) return;
      const svg = reportIconBtn.querySelector('.icon-pdf');
      if (!svg) return;
      svg.classList.remove('animate');
      void svg.offsetWidth;
      svg.classList.add('animate');
      setTimeout(() => svg.classList.remove('animate'), 950);
    });
  }

  // Клик по радару
  svg.addEventListener("click", (e) => {
    const blip = e.target.closest(".blip");
    const sector = e.target.closest(".quadrant-group");
      if (blip) {
      const id = +blip.dataset.id;
      currentTech = DataIndex.getById(id) || getTechById(id);
      if (!currentTech) return;
      setSelectedBlipId(id);
      svg.querySelectorAll('.blip.selected').forEach(el => el.classList.remove('selected'));
      blip.classList.remove('highlighted'); // бордер только для hover
      blip.classList.add('selected');
      if (detailPanel) {
        console.debug('Открытие панели подробной информации (по клику на блип)', { id: currentTech.id, name: currentTech.name });
        showDetail(currentTech);
      } else {
        console.warn('detailPanel не найден в DOM, не могу показать подробности', currentTech);
      }
      const blockKeyZoom = (currentTech.blocks && currentTech.blocks.length) ? currentTech.blocks[0] : currentTech.block;
      zoomQuadrant(getQuadrantIdForBlock(blockKeyZoom));

      try {
    const q = getQuadrantIdForBlock(blockKeyZoom);
        const sectorItem = document.querySelector(`.sector-item[data-quadrant="${q}"]`);
        if (sectorItem) {
          document.querySelectorAll(".sector-item").forEach(i => i.classList.remove("active"));
          sectorItem.classList.add("active");
          const existing = sectorItem.nextElementSibling;
          if (existing && existing.classList.contains('tech-list')) {
            const listItem = existing.querySelector(`.tech-list-item[data-tech-id="${currentTech.id}"]`);
            if (listItem) {
              existing.querySelectorAll('.tech-list-item').forEach(li => li.classList.remove('selected'));
              listItem.classList.add('selected');
              listItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
          } else {
            // Открыть список сектора и подсветить технологию
            document.querySelectorAll('.tech-list').forEach(tl => tl.parentNode?.removeChild(tl));
            createTechListForSector(sectorItem, q, technologies);
            const newList = sectorItem.nextElementSibling;
            if (newList && newList.classList.contains('tech-list')) {
              const listItem = newList.querySelector(`.tech-list-item[data-tech-id="${currentTech.id}"]`);
              if (listItem) {
                newList.querySelectorAll('.tech-list-item').forEach(li => li.classList.remove('selected'));
                listItem.classList.add('selected');
                listItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
              }
            }
          }
        }
      } catch (err) {
        console.warn('Не удалось открыть сектор в сайдбаре:', err);
      }
    } else if (sector) {
        const qId = +sector.dataset.quadrant;
        // Проверяем, есть ли технологии в этом секторе
        const hasTechs = getTechnologies().some(t => getQuadrantIdForBlock(t.block) === qId);
        if (!hasTechs) {
          showNotification('На данный момент в данном секторе отсутствуют технологии, но мы активно работаем над внедрением новых технологий.', false);
          return;
        }
        unzoom();
        setTimeout(() => zoomQuadrant(qId, { source: 'sector' }), 50);

        // Подсветка и раскрытие в сайдбаре — эмулируем клик, чтобы раскрыть список
        const sidebarItem = document.querySelector(`.sector-item[data-quadrant="${qId}"]`);
        if (sidebarItem) {
          // Закроем другие и откроем нужный — сработает логика в обработчике click на секторе
          sidebarItem.click();
        }
      } else {
      if (detailPanel.classList.contains("active")) {
        detailPanel.classList.remove('active');
        detailPanel.style.display = 'none';
      }
      setSelectedBlipId(null);
      svg.querySelectorAll('.blip.highlighted').forEach(el => el.classList.remove('highlighted'));
      svg.querySelectorAll('.blip.selected').forEach(el => el.classList.remove('selected'));
      document.querySelectorAll('.tech-list').forEach(tl => tl.parentNode?.removeChild(tl));
      document.querySelectorAll('.sector-item').forEach(i => i.classList.remove('active'));
      document.querySelectorAll('.tech-list-item.selected').forEach(li => li.classList.remove('selected'));
      setCurrentTech(null);
      unzoom();
    }
  });

  // Общий сброс по клику вне:
  // считаем "пустым местом" всё, что не относится к модальным окнам, радару или левой панели.
  document.addEventListener('click', (e) => {
    // Проверяем, был ли клик на элементы левой панели / фильтров
    const clickedOnSidebarInteractive = e.target.closest('.sidebar-wrapper') ||
                                        e.target.closest('.sector-item') ||
                                        e.target.closest('.tech-list-item') ||
                                        e.target.closest('.search-box') ||
                                        e.target.closest('.filter-toggle-btn') ||
                                        e.target.closest('.custom-select') ||
                                        e.target.closest('.filter-panel-sidebar');

    // Клики внутри модалок, попапов, хэдера, блока управлений, радара и панели приоритетов не считаем "пустым местом"
    if (clickedOnSidebarInteractive ||
        e.target.closest('.modal-panel') ||
        e.target.closest('.popover-menu') ||
        e.target.closest('header') ||
        e.target.closest('.controls') ||
        e.target.closest('#techRadar') ||
        e.target.closest('.detail-panel') ||
        e.target.closest('#quadrantPriorityPanel')) {
      return;
    }

    document.querySelectorAll('.sector-item').forEach(i => i.classList.remove('active'));
    document.querySelectorAll('.tech-list').forEach(tl => tl.parentNode?.removeChild(tl));
    document.querySelectorAll('.custom-select').forEach(s => s.classList.remove('open'));
    document.querySelectorAll('.tech-list-item.selected').forEach(li => li.classList.remove('selected'));
    setSelectedBlipId(null);
    svg.querySelectorAll('.blip.highlighted').forEach(el => el.classList.remove('highlighted'));
    svg.querySelectorAll('.blip.selected').forEach(el => el.classList.remove('selected'));
    currentTech = null;
    if (detailPanel.classList.contains('active')) {
      detailPanel.classList.remove('active');
      detailPanel.style.display = 'none';
    }
    unzoom();
    // Сбрасываем активные фильтры и поиск
    document.querySelectorAll('.custom-select').forEach(select => {
      select.setAttribute('data-value', '');
      const placeholder = select.getAttribute('data-placeholder') || 'Выберите';
      const st = select.querySelector('.selected-text');
      if (st) st.textContent = placeholder;
    });
    document.querySelectorAll('.custom-select .select-search input').forEach(inp => { inp.value = ''; inp.dispatchEvent(new Event('input')); });
    if (typeof searchInput !== 'undefined' && searchInput) searchInput.value = "";
    updateRadar();
  });
  const closeDetailEl = document.getElementById("closeDetailPanel");
  if (closeDetailEl) {
    closeDetailEl.addEventListener("click", () => {
      detailPanel.classList.remove("active");
      detailPanel.style.display = "none";
    });
  } else {
    console.warn('RMK2.js: #closeDetailPanel not found in DOM — cannot bind close detail action');
  }

  // Кнопка «Назад» в панели подробной информации:
  // закрывает детали и, если сектор всё ещё в зуме, возвращает панель приоритета
  if (detailPanel) {
    const detailHeader = detailPanel.querySelector('.detail-header');
    if (detailHeader) {
      let backBtn = detailPanel.querySelector('#detailBackFromPriorityBtn');
      if (!backBtn) {
        backBtn = document.createElement('button');
        backBtn.type = 'button';
        backBtn.id = 'detailBackFromPriorityBtn';
        backBtn.className = 'detail-back-btn';
        backBtn.setAttribute('aria-label', 'Назад к списку технологий');
        backBtn.setAttribute('data-tooltip', 'Назад к списку технологий');
        backBtn.title = 'Назад к списку технологий';
        backBtn.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M15.5 19.5L8 12l7.5-7.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        `;
        // По умолчанию скрыта — будет показана только при открытии из панели приоритетов
        backBtn.style.display = 'none';
        // Вставляем слева от заголовка
        detailHeader.insertBefore(backBtn, detailHeader.firstChild);
      }

      backBtn.addEventListener('click', (ev) => {
        // Не даём клику всплыть до документа, чтобы не сработал
        // глобальный обработчик клика "по пустому месту" с unzoom()
        ev.stopPropagation();

        // Скрываем панель подробной информации
        detailPanel.classList.remove('active');
        detailPanel.style.display = 'none';
        // Если по‑прежнему есть зуммированный сектор — возвращаем панель приоритета
        if (currentZoomedQuadrant != null) {
          // Убедимся, что зум сохранен и панель приоритета откроется с правильным списком
          const g = document.querySelector(`.quadrant-group.q${currentZoomedQuadrant}`);
          if (g && !g.classList.contains('zoomed-in')) {
            // Если зум был потерян, восстанавливаем его
            zoomQuadrant(currentZoomedQuadrant, { source: 'priority' });
          }
          // Открываем панель приоритета и явно обновляем список
          openQuadrantPriorityPanel(currentZoomedQuadrant);
          // Явно пересчитываем список, чтобы убедиться, что все технологии отображаются
          recomputeQuadrantPriorityList(currentZoomedQuadrant);
        }
      });
    }
  }

  // Секторы
  document.querySelectorAll(".sector-item").forEach(item => {
    item.addEventListener("mouseenter", () => {
      const q = parseInt(item.dataset.quadrant, 10);
      const g = document.querySelector(`.quadrant-group.q${q}`);
      if (g) g.classList.add("highlight");
    });
    item.addEventListener("mouseleave", () => {
      const q = parseInt(item.dataset.quadrant, 10);
      const g = document.querySelector(`.quadrant-group.q${q}`);
      if (g) g.classList.remove("highlight");
    });
    item.addEventListener("click", (ev) => {
      ev.stopPropagation();
      // Если сектор пустой — показываем уведомление и не раскрываем
      if (item.classList.contains('empty')) {
        showNotification('На данный момент в данном секторе отсутствуют технологии, но мы активно работаем над внедрением новых технологий.', false);
        return;
      }
      const q = parseInt(item.dataset.quadrant, 10);
      // закрыть открытые списки и отметить активный сектор
      document.querySelectorAll('.tech-list').forEach(tl => tl.parentNode?.removeChild(tl));
      document.querySelectorAll(".sector-item").forEach(i => i.classList.remove("active"));
      item.classList.add("active");

      unzoom();
    if (!Number.isNaN(q)) setTimeout(() => zoomQuadrant(q, { source: 'sector' }), 50);
    });
  });

  // Модальные окна
  const addBtnEl = document.getElementById("addTechBtn");
  if (addBtnEl) {
    addBtnEl.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!checkArchitectRole()) return;
      const pop = document.getElementById('addChoicePopover');
      if (!pop) return;
      if (pop.style.display === 'block' || pop.classList.contains('open')) {
        pop.classList.remove('open');
        pop.style.display = 'none';
        return;
      }
      const rect = addBtnEl.getBoundingClientRect();
      pop.style.display = 'block';
      pop.style.position = 'fixed';
      pop.style.top = `${rect.bottom + 8}px`;
      pop.style.left = `${Math.max(8, rect.left)}px`;
      requestAnimationFrame(() => {
        pop.classList.add('open');
        const pw = pop.offsetWidth;
        const ph = pop.offsetHeight;
        let top = rect.bottom + 8;
        let left = rect.left;
        if (top + ph + 8 > window.innerHeight) {
          const spaceRight = window.innerWidth - rect.right - 8;
          const spaceLeft = rect.left - 8;
          if (spaceRight >= pw) {
            top = rect.top + rect.height / 2 - ph / 2;
            top = Math.max(8, Math.min(top, window.innerHeight - ph - 8));
            left = rect.right + 8;
          } else if (spaceLeft >= pw) {
            top = rect.top + rect.height / 2 - ph / 2;
            top = Math.max(8, Math.min(top, window.innerHeight - ph - 8));
            left = rect.left - pw - 8;
          } else {
            top = Math.max(8, window.innerHeight - ph - 8);
            left = rect.left;
            if (left + pw + 8 > window.innerWidth) left = window.innerWidth - pw - 8;
            if (left < 8) left = 8;
          }
        } else {
          if (left + pw + 8 > window.innerWidth) left = window.innerWidth - pw - 8;
          if (left < 8) left = 8;
        }
        pop.style.top = `${Math.round(top)}px`;
        pop.style.left = `${Math.round(left)}px`;
      });
    });
  } else {
    console.warn('RMK2.js: #addTechBtn not found — cannot bind add-popup');
  }

  document.querySelectorAll(".close-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const panelId = e.currentTarget.dataset.close;
      const panel = panelId ? document.getElementById(panelId) : e.currentTarget.closest('.modal-panel');
      if (!panel) return;
      // Для модального окна подтверждения удаления не проверяем форму
      if (panel.id === 'deleteConfirmModal') {
        hideModal(panel);
        return;
      }
      const form = panel.querySelector('form');
      if (isFormDirty(form)) {
        showInternalConfirm('Вы заполнили/изменили некоторые поля. Уверены, что хотите закрыть? Все изменения будут потеряны.', () => {
          form?.reset();
          if (panel.id === 'addTechPanel') resetCustomSelects('add');
          if (panel.id === 'editTechPanel') resetCustomSelects('edit');
        }, panel);
      } else {
        hideModal(panel);
      }
    });
  });

  const chooseAddTechBtn = document.getElementById("chooseAddTech");
  if (chooseAddTechBtn) {
    chooseAddTechBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const pop = document.getElementById('addChoicePopover');
      if (pop) pop.style.display = 'none';
      showModal('addTechPanel');
      // Устанавливаем текущее предприятие по умолчанию
      setCustomSelectValue('techCompany', [currentEnterprise]);
      // Обновляем видимость полей оценок
      setTimeout(() => {
        updateTechRatingsVisibility();
      }, 100);
      snapshotFormInitial(document.getElementById('addTechForm'));
    });
  } else console.warn('RMK2.js: #chooseAddTech not found');

  // Обработчик изменения выбора предприятий в форме добавления технологии
  const techCompanyInput = document.getElementById('techCompany');
  if (techCompanyInput) {
    // Используем MutationObserver для отслеживания изменений значения
    const companyObserver = new MutationObserver(() => {
      updateTechRatingsVisibility();
    });
    companyObserver.observe(techCompanyInput, { attributes: true, attributeFilter: ['value'] });

    // Также слушаем события изменения через кастомный селект
    const techCompanySelect = document.querySelector('.custom-select-modal[data-field="techCompany"]');
    if (techCompanySelect) {
      // Отслеживаем изменения в скрытом поле через события
      techCompanyInput.addEventListener('change', updateTechRatingsVisibility);
      techCompanyInput.addEventListener('input', updateTechRatingsVisibility);

      // Отслеживаем клики по опциям в выпадающем списке
      const companyOptions = techCompanySelect.querySelector('.select-options');
      if (companyOptions) {
        companyOptions.addEventListener('click', (e) => {
          // Небольшая задержка, чтобы значение успело обновиться
          setTimeout(() => {
            updateTechRatingsVisibility();
          }, 50);
        });
      }
    }
  }
  const chooseAddBlockBtn = document.getElementById("chooseAddBlock");
  if (chooseAddBlockBtn) {
    chooseAddBlockBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const pop = document.getElementById('addChoicePopover');
      if (pop) pop.style.display = 'none';
      showModal('addBlockPanel');
      snapshotFormInitial(document.getElementById('addBlockForm'));
    });
  } else console.warn('RMK2.js: #chooseAddBlock not found');

  // Закрытие popover
  document.addEventListener('click', (e) => {
    const pop = document.getElementById('addChoicePopover');
    if (!pop) return;
    const isInside = e.target.closest && (e.target.closest('#addChoicePopover') || e.target.closest('#addTechBtn') || e.target.closest('#addIconBtn'));
    if (!isInside && (pop.style.display === 'block' || pop.classList.contains('open'))) {
      pop.classList.remove('open');
      pop.style.display = 'none';
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const pop = document.getElementById('addChoicePopover');
      if (pop && (pop.style.display === 'block' || pop.classList.contains('open'))) {
        pop.classList.remove('open');
        pop.style.display = 'none';
      }
      // Закрытие модального окна подтверждения удаления по Escape
      const deleteConfirmModal = document.getElementById('deleteConfirmModal');
      if (deleteConfirmModal && deleteConfirmModal.classList.contains('open')) {
        hideModal('deleteConfirmModal');
      }
    }
  });

  // Встроенное модальное подтверждение (создаётся динамически при необходимости)
  function showInternalConfirm(message, onCloseConfirmed) {
    let confirmEl = document.getElementById('internalConfirm');
    if (!confirmEl) {
      confirmEl = document.createElement('div');
      confirmEl.id = 'internalConfirm';
      confirmEl.className = 'modal-panel confirm-panel';
      confirmEl.innerHTML = `
        <div class="modal-header"><h2>Подтвердите действие</h2></div>
        <div class="modal-body"><p class="confirm-message"></p>
          <div class="form-actions" style="margin-top:12px; display:flex; gap:8px; justify-content:flex-end">
            <button class="btn-secondary" data-action="cancel">Отмена</button>
            <button class="btn-primary" data-action="close">Закрыть</button>
          </div>
        </div>`;
      document.body.appendChild(confirmEl);
      confirmEl.querySelector('[data-action="cancel"]').addEventListener('click', () => {
        confirmEl.classList.remove('open');
        setTimeout(() => confirmEl.style.display = 'none', 220);
      });
      confirmEl.querySelector('[data-action="close"]').addEventListener('click', (ev) => {
        ev.stopPropagation();
        confirmEl.classList.remove('open');
        // Сначала скрываем окно подтверждения, затем выполняем callback и гарантированно закрываем целевую панель
        setTimeout(() => {
          confirmEl.style.display = 'none';
          try { if (typeof confirmEl._onClose === 'function') confirmEl._onClose(); } catch(e) { console.error(e); }
          try {
            const related = confirmEl._relatedPanel;
            if (related) hideModal(related);
          } catch(e) { /* ignore */ }
        }, 220);
      });
    }
    confirmEl.querySelector('.confirm-message').textContent = message;
    // store callback and related panel on element for safe later invocation
    confirmEl._onClose = onCloseConfirmed;
    confirmEl._relatedPanel = arguments[2] || null;
    confirmEl.style.display = 'block';
    requestAnimationFrame(() => confirmEl.classList.add('open'));
  }

  // Закрытие модалей по клику вне: если форма изменилась — показать подтверждение
  document.addEventListener('click', (e) => {
    // Если это быстро после открытия модалки — игнорируем (предотвращаем мгновенное закрытие)
    if (Date.now() < ignoreOutsideClickUntil) return;
    // Игнорируем клики внутри модалей или по кнопкам открытия
    const mod = e.target.closest('.modal-panel');
    if (mod) {
      // Не закрываем модальное окно загрузки при клике вне его
      if (mod.id === 'reportLoadingModal') return;
      return;
    }

    // Проверяем, открыто ли модальное окно загрузки - не закрываем его при клике вне
    const loadingModal = document.getElementById('reportLoadingModal');
    if (loadingModal && (loadingModal.style.display === 'block' || loadingModal.classList.contains('open'))) {
      return;
    }
    // Закрываем popup выбора
    const pop = document.getElementById('addChoicePopover');
    if (pop && !e.target.closest('#addTechBtn') && !e.target.closest('#addIconBtn')) {
      if (pop.style.display === 'block' || pop.classList.contains('open')) { pop.classList.remove('open'); pop.style.display = 'none'; }
    }
    // Для каждой открытой модалки проверим dirty
    ['addTechPanel','editTechPanel','addBlockPanel'].forEach(id => {
      const panel = document.getElementById(id);
      if (!panel) return;
      // Проверяем, что модальное окно действительно открыто
      const isOpen = panel.style.display === 'block' || panel.classList.contains('open');
      if (!isOpen) return;

      // Дополнительная проверка: если модальное окно только что открылось, не закрываем его
      // Это предотвращает закрытие при клике, который открыл модальное окно
      if (Date.now() < ignoreOutsideClickUntil) return;

      // найдём форму внутри
      const form = panel.querySelector('form');
      // Проверяем, что форма существует и snapshot был сделан
      if (!form || !form.dataset.initial) {
        // Если snapshot не был сделан, просто закрываем без проверки dirty
        hideModal(panel);
        return;
      }
      const wasDirty = isFormDirty(form);
      if (!wasDirty) {
        hideModal(panel);
      } else {
        showInternalConfirm('Вы заполнили/изменили некоторые поля. Уверены, что хотите закрыть? Все изменения будут потеряны.', () => {
          // закрыть панель без сохранения
          // сбросим форму
          form?.reset();
          if (id === 'addTechPanel') resetCustomSelects('add');
          if (id === 'editTechPanel') resetCustomSelects('edit');
          if (id === 'addBlockPanel') {/* nothing extra */}
        }, panel);
      }
    });
  });

  // Функции в блоке
  function updateFunctionPlaceholders() {
    const rows = document.getElementById("functionsContainer").querySelectorAll('.function-row');
    rows.forEach((r, i) => {
      const inp = r.querySelector('input');
      if (inp) inp.placeholder = `Функция ${i + 1}`;
    });
  }
  document.getElementById("addFunctionRow").onclick = () => {
    const container = document.getElementById("functionsContainer");
    const count = container.querySelectorAll('.function-row').length;
    if (count >= 20) return;
  const row = document.createElement('div');
  row.className = 'function-row';
  row.style.display = 'flex';
  row.style.gap = '8px';
  row.style.alignItems = 'center';
  row.style.marginTop = '6px';
  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = `Функция ${count + 1}`;
  input.style.flex = '1';
  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'remove-fn-btn';
  // Используем кастомную подсказку (data-tooltip) вместо native title
  removeBtn.setAttribute('data-tooltip', 'Удалить функцию');
  removeBtn.setAttribute('aria-label', 'Удалить функцию');
  removeBtn.textContent = '×';
  // Остановим всплытие клика, чтобы глобальные document.click обработчики
  // не закрывали панель при удалении строки. Удаление должно влиять
  // только на конкретный элемент.
  removeBtn.addEventListener('click', (ev) => { ev.stopPropagation(); ev.preventDefault(); row.remove(); updateFunctionPlaceholders(); });
  row.appendChild(input);
  row.appendChild(removeBtn);
  container.appendChild(row);
  };


  // Формы
  document.getElementById("cancelAdd").onclick = () => hideModal('addTechPanel');
  document.getElementById("cancelEdit").onclick = () => hideModal('editTechPanel');
  document.getElementById("cancelAddBlock").onclick = () => hideModal('addBlockPanel');

  // Обработчики для модального окна подтверждения удаления
  const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");
  const cancelDeleteBtn = document.getElementById("cancelDeleteBtn");
  const closeDeleteConfirm = document.getElementById("closeDeleteConfirm");

  if (confirmDeleteBtn) {
    confirmDeleteBtn.onclick = () => {
      const currentTech = getCurrentTech();
      if (!currentTech) return;
      const technologies = getTechnologies();
      setTechnologies(technologies.filter(t => t.id !== currentTech.id));
      // Инвалидируем кэш квадрантов при удалении технологии
      const quadrantsCache = getQuadrantsCache();
      quadrantsCache.clear();
      setQuadrantsCacheVersion(getQuadrantsCacheVersion() + 1);
      detailPanel.classList.remove("active");
      detailPanel.style.display = "none";
      unzoom();
      updateRadar();
      try {
        const enterpriseData = getEnterpriseData();
        const currentEnterprise = getCurrentEnterprise();
        const technologies = getTechnologies();
        enterpriseData[currentEnterprise] = [...technologies];
        setEnterpriseData({...enterpriseData});
        vfsWrite('enterpriseData.json', enterpriseData);
      } catch (err) { console.warn('Не удалось сохранить enterpriseData после удаления', err); }
      showNotification('Технология удалена!', true);
      hideModal('deleteConfirmModal');
    };
  }

  if (cancelDeleteBtn) {
    cancelDeleteBtn.onclick = () => hideModal('deleteConfirmModal');
  }

  if (closeDeleteConfirm) {
    closeDeleteConfirm.onclick = () => hideModal('deleteConfirmModal');
  }

  // Обработчик добавления нового функционального блока
  const addBlockForm = document.getElementById('addBlockForm');
  if (addBlockForm) {
    addBlockForm.onsubmit = async (e) => {
      e.preventDefault();
      const nameInput = document.getElementById('blockName');
      const sectorInput = document.getElementById('blockSector');
      if (!nameInput) { showNotification('Не найдено поле имени блока (blockName)', false); return; }
      if (!sectorInput) { showNotification('Не найдено поле выбора сектора (blockSector)', false); return; }
      const blockName = (nameInput.value || '').trim();
      const sectorName = (sectorInput.value || '').trim();
      if (!blockName) { showNotification('Введите имя блока', false); return; }
      if (!sectorName) { showNotification('Выберите сектор', false); return; }
      // Найдём id квадранта по имени сектора
      const quad = QUADRANTS.find(q => q.name === sectorName) || QUADRANTS[0];
      const qId = quad ? quad.id : 1;
      // Обновим маппинг
      blockToQuadrant[blockName] = qId;
      // Добавим опцию в селекты (sidebar и модалки)
      const sidebarSelect = document.querySelector('.custom-select[data-filter="block"] .select-options');
      if (sidebarSelect) {
        const li = document.createElement('li'); li.textContent = blockName; li.setAttribute('data-value', blockName);
        sidebarSelect.appendChild(li);
      }
      const modalSelects = document.querySelectorAll('.custom-select-modal[data-field="techBlock"], .custom-select-modal[data-field="editBlock"]');
      modalSelects.forEach(ms => {
        const opts = ms.querySelector('.select-options');
        if (opts) {
          const li = document.createElement('li');
          li.classList.add('select-option-item');
          li.setAttribute('data-value', blockName);
          li.innerHTML = `<label class="option-label"><input type="checkbox" class="option-checkbox" /><span>${blockName}</span></label>`;
          opts.appendChild(li);
        }
      });
      // Разблокируем квадрант и подсвечиваем сектор
  // const qId already set above
      if (qId != null) {
        const g = document.querySelector(`.quadrant-group.q${qId}`);
        if (g) g.classList.remove('empty');
        const sidebarItem = document.querySelector(`.sector-item[data-quadrant="${qId}"]`);
        if (sidebarItem) {
          sidebarItem.classList.remove('empty');
          document.querySelectorAll('.sector-item').forEach(i => i.classList.remove('active'));
          sidebarItem.classList.add('active');
        }
      }
      // persist updated blocks list and mapping to VFS
      try {
        if (!blocksList.includes(blockName)) blocksList.push(blockName);
        vfsWrite('bloks.json', blocksList);
        vfsWrite('blockToQuadrant.json', blockToQuadrant);
      } catch (err) { console.warn('Не удалось сохранить блоки в VFS', err); }
      hideModal('addBlockPanel');
      showNotification('Функциональный блок добавлен и сектор разблокирован', true);
    };
  }

  document.getElementById("addTechForm").onsubmit = (e) => {
    e.preventDefault();
    const rawSector = document.getElementById("techSector")?.value || '';
    let sectorVal = rawSector;
    try {
      if (rawSector && rawSector.trim().startsWith('[')) {
        sectorVal = JSON.parse(rawSector);
      }
    } catch (err) {
      // ignore parse error, оставим исходное значение
      sectorVal = rawSector;
    }
    const sectorArray = Array.isArray(sectorVal)
      ? sectorVal.map(s => (typeof s === 'string' ? s.trim() : s)).filter(Boolean)
      : ((typeof sectorVal === 'string' && sectorVal.trim()) ? [sectorVal.trim()] : []);
    const sectorName = sectorArray.length > 0 ? sectorArray[0] : '';
    const rawBlock = document.getElementById("techBlock").value;
    const rawFunc = document.getElementById("techFunc").value;
    const selStatus = (document.getElementById("techStatus")?.value || '').trim();
    let blocksVal = rawBlock;
    let functionsVal = rawFunc;
    try {
      if (rawBlock && rawBlock.trim().startsWith('[')) blocksVal = JSON.parse(rawBlock);
    } catch (err) { /* ignore */ }
    try {
      if (rawFunc && rawFunc.trim().startsWith('[')) functionsVal = JSON.parse(rawFunc);
    } catch (err) { /* ignore */ }

    // Нормализуем входные значения блоков/функций (обрезаем пробелы)
    const rawBlockVal = Array.isArray(blocksVal)
      ? blocksVal.map(b => (typeof b === 'string' ? b.trim() : b))
      : (typeof blocksVal === 'string' ? blocksVal.trim() : blocksVal);
    const rawFuncVal = Array.isArray(functionsVal)
      ? functionsVal.map(f => (typeof f === 'string' ? f.trim() : f))
      : (typeof functionsVal === 'string' ? functionsVal.trim() : functionsVal);

    // Обработка выбранных предприятий
    const rawCompany = document.getElementById("techCompany")?.value || '';
    let companiesVal = [];
    try {
      if (rawCompany && rawCompany.trim().startsWith('[')) {
        companiesVal = JSON.parse(rawCompany);
      } else if (rawCompany) {
        companiesVal = [rawCompany];
      }
    } catch (err) {
      if (rawCompany) companiesVal = [rawCompany];
    }
    // Если предприятия не выбраны, используем текущее предприятие
    if (companiesVal.length === 0) {
      companiesVal = [currentEnterprise];
    }

    const t = {
      id: nextId++,
      name: (document.getElementById("techName").value || '').trim(),
      // Если выбран несколько секторов, в поле sector сохраняем массив,
      // при одном секторе — строку (обратная совместимость)
      sector: sectorArray.length > 1 ? sectorArray : sectorName,
      block: Array.isArray(rawBlockVal) ? (rawBlockVal[0] || '') : (rawBlockVal || ''),
      blocks: Array.isArray(rawBlockVal) ? rawBlockVal : (rawBlockVal ? [rawBlockVal] : []),
      func: Array.isArray(rawFuncVal) ? (rawFuncVal[0] || '') : (rawFuncVal || ''),
      functions: Array.isArray(rawFuncVal) ? rawFuncVal : (rawFuncVal ? [rawFuncVal] : []),
      techType: '',
      level: '',
      company: companiesVal.length === 1 ? companiesVal[0] : companiesVal,
      description: (document.getElementById("techDesc").value || '').trim(),
      exampleDesc: (document.getElementById('techExampleDesc')?.value || '').trim(),
    };
    // Уровень (статус)
    t.level = selStatus || ((RINGS && RINGS.length) ? RINGS[0] : 'Используемые');
    t.status = t.level;
    // Стоимость внедрения — для всех статусов
    const costVal = Number(document.getElementById('techCostProm')?.value);
    if (!Number.isNaN(costVal)) t.costProm = costVal; else delete t.costProm;
    // Оценки (0–3) - сохраняем только если значение заполнено
    const clamp03 = (n) => Math.max(0, Math.min(3, Number(n)));
    const clamp13 = (n) => Math.max(1, Math.min(3, Number(n)));
    const fc = document.getElementById('techFuncCover')?.value;
    if (fc !== undefined && fc !== null && fc !== '' && String(fc).trim() !== '') {
      t.funcCover = clamp03(fc);
    }
    // TRL (1–3) - сохраняем только если значение заполнено
    // Получаем значение из hidden input и извлекаем число из строки
    const trlValue = document.getElementById('techTrlStage')?.value;
    if (trlValue !== undefined && trlValue !== null && trlValue !== '' && String(trlValue).trim() !== '') {
      // Извлекаем число из строки вида "1 — Ранняя стадия..."
      const trlMatch = String(trlValue).match(/^(\d+)/);
      if (trlMatch) {
        const trlNum = parseInt(trlMatch[1], 10);
        if (trlNum >= 1 && trlNum <= 3) {
          t.trlStage = trlNum;
        }
      }
    }

    // Обработка оценок готовности в зависимости от количества предприятий
    if (companiesVal.length === 1) {
      // Одно предприятие - сохраняем как обычно
      const tr = document.getElementById('techTechRead')?.value;
      const or = document.getElementById('techOrganRead')?.value;
      if (tr !== undefined && tr !== null && tr !== '' && String(tr).trim() !== '') {
        t.techRead = clamp03(tr);
      }
      if (or !== undefined && or !== null && or !== '' && String(or).trim() !== '') {
        t.organRead = clamp03(or);
      }
    } else if (companiesVal.length > 1) {
      // Несколько предприятий - собираем оценки из динамических полей
      const companyRatings = {};
      let hasAnyRatings = false;
      companiesVal.forEach(company => {
        const techReadInput = document.getElementById(`techTechRead_${company}`);
        const organReadInput = document.getElementById(`techOrganRead_${company}`);
        const techReadVal = techReadInput?.value;
        const organReadVal = organReadInput?.value;

        const ratings = {};
        if (techReadVal !== undefined && techReadVal !== null && techReadVal !== '' && String(techReadVal).trim() !== '') {
          ratings.techRead = clamp03(techReadVal);
          hasAnyRatings = true;
        }
        if (organReadVal !== undefined && organReadVal !== null && organReadVal !== '' && String(organReadVal).trim() !== '') {
          ratings.organRead = clamp03(organReadVal);
          hasAnyRatings = true;
        }

        if (Object.keys(ratings).length > 0) {
          companyRatings[company] = ratings;
        }
      });

      if (hasAnyRatings) {
        t.companyRatings = companyRatings;
      }
      // Также сохраняем общие значения, если они были заполнены (для обратной совместимости)
      // Но приоритет будет отдаваться companyRatings
    }
    t.techType = document.getElementById('techTechType')?.value || '';
    // Определим форму по techType, если указана
    const shapeFromType = computeShapeByTechType(t.techType);
    if (shapeFromType) t.shape = shapeFromType;
    // Детеминированное расположение
    // Если блок не сопоставлен с квадрантом — добавим маппинг по умолчанию и опцию в селекты
    // Гарантируем канонический ключ для поиска квадранта и запишем обратно в t.block
    const blockKeyForLookup = (t.blocks && t.blocks.length) ? (typeof t.blocks[0] === 'string' ? t.blocks[0].trim() : t.blocks[0]) : (typeof t.block === 'string' ? t.block.trim() : t.block);
    t.block = blockKeyForLookup;
    if (!blockToQuadrant.hasOwnProperty(blockKeyForLookup) || blockToQuadrant[blockKeyForLookup] == null) {
      blockToQuadrant[blockKeyForLookup] = 1;
      const sidebarSelect = document.querySelector('.custom-select[data-filter="block"] .select-options');
      if (sidebarSelect) {
        const li = document.createElement('li'); li.textContent = blockKeyForLookup; li.setAttribute('data-value', blockKeyForLookup);
        sidebarSelect.appendChild(li);
      }
      const modalSelects = document.querySelectorAll('.custom-select-modal[data-field="techBlock"], .custom-select-modal[data-field="editBlock"]');
      modalSelects.forEach(ms => {
        const opts = ms.querySelector('.select-options');
        if (opts) {
          const li = document.createElement('li');
          li.classList.add('select-option-item');
          li.setAttribute('data-value', blockKeyForLookup);
          li.innerHTML = `<label class="option-label"><input type="checkbox" class="option-checkbox" /><span>${blockKeyForLookup}</span></label>`;
          opts.appendChild(li);
        }
      });
      // persist new block and mapping
      try {
        if (!blocksList.includes(blockKeyForLookup)) blocksList.push(blockKeyForLookup);
        vfsWrite('bloks.json', blocksList);
        vfsWrite('blockToQuadrant.json', blockToQuadrant);
      } catch (err) { console.warn('Не удалось сохранить новый блок в VFS', err); }
    }
    // Ensure block mapping exists before computing coords
    const bk = t.block;
    if (!bk || !blockToQuadrant || !Object.prototype.hasOwnProperty.call(blockToQuadrant, bk) || blockToQuadrant[bk] == null) {
      console.warn('addTech: block mapping missing for', bk, '— defaulting to quadrant 1 and adding option');
      blockToQuadrant[bk] = 1;
      const sidebarSelect = document.querySelector('.custom-select[data-filter="block"] .select-options');
      if (sidebarSelect) { const li = document.createElement('li'); li.textContent = bk; li.setAttribute('data-value', bk); sidebarSelect.appendChild(li); }
      document.querySelectorAll('.custom-select-modal[data-field="techBlock"], .custom-select-modal[data-field="editBlock"]').forEach(ms => {
        const opts = ms.querySelector('.select-options');
        if (opts) {
          const li = document.createElement('li');
          li.classList.add('select-option-item');
          li.setAttribute('data-value', bk);
          li.innerHTML = `<label class="option-label"><input type="checkbox" class="option-checkbox" /><span>${bk}</span></label>`;
          opts.appendChild(li);
        }
      });
      if (!blocksList.includes(bk)) blocksList.push(bk);
      try { vfsWrite('bloks.json', blocksList); vfsWrite('blockToQuadrant.json', blockToQuadrant); } catch (err) { console.warn('vfs write failed for new block', err); }
    }

    // Ensure level mapping exists
    if (!levelToRing || !Object.prototype.hasOwnProperty.call(levelToRing, t.level)) {
      console.warn('addTech: level mapping missing for', t.level, '— defaulting to "Существующие"');
      t.level = (RINGS && RINGS.length) ? RINGS[0] : 'Используемые';
    }

    // Рассчитаем координаты с учётом коллизий
    computeCoordinates(t);
    // Debug: логируем ключевые значения, чтобы диагностировать проблемы с рендером
    try {
      console.debug('addTech: new tech BEFORE persist', { id: t.id, name: t.name, block: t.block, quadrant: getQuadrantIdForBlock(t.block), level: t.level, ring: levelToRing[t.level], x: t.x, y: t.y });
    } catch (e) { /* ignore */ }

    // Добавляем в основной массив и сохраняем
    technologies.push(t);
    // Инвалидируем кэш квадрантов при добавлении технологии
    const quadrantsCache = getQuadrantsCache();
    quadrantsCache.clear();
    setQuadrantsCacheVersion(getQuadrantsCacheVersion() + 1);
    rebuildTechnologiesIndex();
    // Ensure fields, compute coords and persist before rendering
    ensureAndPersistNewTech(t);
    hideModal('addTechPanel');

    const q = getQuadrantIdForBlock(t.block);
    if (q != null) {
      const g = document.querySelector(`.quadrant-group.q${q}`);
      if (g) g.classList.remove('empty');
    }

    // Force re-render and ensure updated data used
    try { updateRadar(); } catch (err) { console.warn('updateRadar failed after add', err); }
    // Разблокируем квадрант, подсветим сектор в сайдбаре и делаем зум на сектор
    if (q != null) {
      const g = document.querySelector(`.quadrant-group.q${q}`);
      if (g) g.classList.remove('empty');
      const sidebarItem = document.querySelector(`.sector-item[data-quadrant="${q}"]`);
      if (sidebarItem) {
        // удалим класс empty и откроем список для быстрого просмотра
        sidebarItem.classList.remove('empty');
        // Создаем список технологий напрямую
        const existing = sidebarItem.nextElementSibling;
        if (!(existing && existing.classList.contains('tech-list'))) {
          document.querySelectorAll('.tech-list').forEach(tl => tl.parentNode?.removeChild(tl));
          createTechListForSector(sidebarItem, q, technologies);
        }
        // пометим как активный
        document.querySelectorAll('.sector-item').forEach(i => i.classList.remove('active'));
        sidebarItem.classList.add('active');
      }
      // Делаем зум на сектор, в который добавлена технология
      setTimeout(() => {
        zoomQuadrant(q);
      }, 100);
    }
    // Сохраняем технологию во все выбранные предприятия
    try {
      let enterpriseData = getEnterpriseData();
      const currentEnterprise = getCurrentEnterprise();
      const technologies = getTechnologies();
      companiesVal.forEach(company => {
        if (!enterpriseData[company]) {
          enterpriseData[company] = [];
        }
        // Проверяем, нет ли уже технологии с таким id в этом предприятии
        const existingIndex = enterpriseData[company].findIndex(tech => tech.id === t.id);
        if (existingIndex === -1) {
          enterpriseData[company].push(t);
        } else {
          enterpriseData[company][existingIndex] = t;
        }
      });
      // Обновляем текущее предприятие
      enterpriseData[currentEnterprise] = [...technologies];
      setEnterpriseData({...enterpriseData});
      vfsWrite('enterpriseData.json', enterpriseData);
    } catch (err) { console.warn('Не удалось сохранить enterpriseData в VFS', err); }
    showNotification('Технология добавлена!', true);
  };

  document.getElementById("editTechForm").onsubmit = (e) => {
    e.preventDefault();
    const id = +document.getElementById("editId").value;
    const technologies = getTechnologies();
    const idx = technologies.findIndex(t => t.id === id);
    if (idx === -1) return;
    const existing = technologies[idx];
    const newTechTypeVal = document.getElementById('editTechType')?.value || existing.techType;
    const newStatus = (document.getElementById('editStatus')?.value || existing.level || existing.status || '').trim();
    const newShape = computeShapeByTechType(newTechTypeVal) || 'circle';
    // parse blocks/functions from hidden inputs (can be JSON arrays)
    const rawBlockE = document.getElementById("editBlock").value;
    const rawFuncE = document.getElementById("editFunc").value;
    let blocksValE = rawBlockE;
    let functionsValE = rawFuncE;
    try { if (rawBlockE && rawBlockE.trim().startsWith('[')) blocksValE = JSON.parse(rawBlockE); } catch (err) {}
    try { if (rawFuncE && rawFuncE.trim().startsWith('[')) functionsValE = JSON.parse(rawFuncE); } catch (err) {}

    technologies[idx] = Object.assign({}, existing, {
      name: document.getElementById("editName").value,
      block: Array.isArray(blocksValE) ? (blocksValE[0] || '') : blocksValE,
      blocks: Array.isArray(blocksValE) ? blocksValE : (blocksValE ? [blocksValE] : []),
      func: Array.isArray(functionsValE) ? (functionsValE[0] || '') : functionsValE,
      functions: Array.isArray(functionsValE) ? functionsValE : (functionsValE ? [functionsValE] : []),
      techType: newTechTypeVal,
      level: newStatus || existing.level || (RINGS && RINGS.length ? RINGS[0] : 'Используемые'),
      status: newStatus || existing.status || existing.level,
      shape: newShape,
      description: document.getElementById("editDesc").value,
      exampleDesc: (document.getElementById('editExampleDesc')?.value || '').trim(),
    });
    // Стоимость внедрения — для всех статусов
    const costEdit = Number(document.getElementById('editCostProm')?.value);
    if (!Number.isNaN(costEdit)) technologies[idx].costProm = costEdit;
    else delete technologies[idx].costProm;
    // Оценки
    const clamp03 = (n) => Math.max(0, Math.min(3, Number(n)));
    const clamp13 = (n) => Math.max(1, Math.min(3, Number(n)));
    const fc = document.getElementById('editFuncCover')?.value;
    if (fc !== undefined && fc !== null && fc !== '' && String(fc).trim() !== '') {
      technologies[idx].funcCover = clamp03(fc);
    }
    // TRL (1–3) - сохраняем только если значение заполнено, иначе удаляем
    // Получаем значение из hidden input и извлекаем число из строки
    const trlValue = document.getElementById('editTrlStage')?.value;
    if (trlValue !== undefined && trlValue !== null && trlValue !== '' && String(trlValue).trim() !== '') {
      // Извлекаем число из строки вида "1 — Ранняя стадия..."
      const trlMatch = String(trlValue).match(/^(\d+)/);
      if (trlMatch) {
        const trlNum = parseInt(trlMatch[1], 10);
        if (trlNum >= 1 && trlNum <= 3) {
          technologies[idx].trlStage = trlNum;
        } else {
          delete technologies[idx].trlStage;
        }
      } else {
        delete technologies[idx].trlStage;
      }
    } else {
      delete technologies[idx].trlStage;
    }

    // Обработка оценок готовности в зависимости от количества предприятий
    const companies = Array.isArray(existing.company) ? existing.company : (existing.company ? [existing.company] : []);
    if (companies.length === 1) {
      // Одно предприятие - сохраняем как обычно
      const tr = document.getElementById('editTechRead')?.value;
      const or = document.getElementById('editOrganRead')?.value;
      if (tr !== undefined && tr !== null && tr !== '' && String(tr).trim() !== '') {
        technologies[idx].techRead = clamp03(tr);
      }
      if (or !== undefined && or !== null && or !== '' && String(or).trim() !== '') {
        technologies[idx].organRead = clamp03(or);
      }
      // Удаляем companyRatings, если было одно предприятие
      if (technologies[idx].companyRatings) {
        delete technologies[idx].companyRatings;
      }
    } else if (companies.length > 1) {
      // Несколько предприятий - собираем оценки из динамических полей
      const companyRatings = {};
      let hasAnyRatings = false;
      companies.forEach(company => {
        const techReadInput = document.getElementById(`editTechRead_${company}`);
        const organReadInput = document.getElementById(`editOrganRead_${company}`);
        const techReadVal = techReadInput?.value;
        const organReadVal = organReadInput?.value;

        const ratings = {};
        if (techReadVal !== undefined && techReadVal !== null && techReadVal !== '' && String(techReadVal).trim() !== '') {
          ratings.techRead = clamp03(techReadVal);
          hasAnyRatings = true;
        }
        if (organReadVal !== undefined && organReadVal !== null && organReadVal !== '' && String(organReadVal).trim() !== '') {
          ratings.organRead = clamp03(organReadVal);
          hasAnyRatings = true;
        }

        if (Object.keys(ratings).length > 0) {
          companyRatings[company] = ratings;
        }
      });

      if (hasAnyRatings) {
        technologies[idx].companyRatings = companyRatings;
      } else {
        // Если не заполнено ни одно поле, удаляем companyRatings
        if (technologies[idx].companyRatings) {
          delete technologies[idx].companyRatings;
        }
      }
      // Также сохраняем общие значения, если они были заполнены (для обратной совместимости)
      // Но приоритет будет отдаваться companyRatings
    }
    // Сохраняем изменения обратно в StateManager
    setTechnologies([...technologies]);
    rebuildTechnologiesIndex();

    hideModal('editTechPanel');
    updateRadar();
    try {
      const enterpriseData = getEnterpriseData();
      const currentEnterprise = getCurrentEnterprise();
      enterpriseData[currentEnterprise] = [...technologies];
      setEnterpriseData({...enterpriseData});
      vfsWrite('enterpriseData.json', enterpriseData);
    } catch (err) { console.warn('Не удалось сохранить enterpriseData после редактирования', err); }
    showNotification('Изменения сохранены!', true);
  };

  document.getElementById("editTechBtn").onclick = () => {
    if (!checkArchitectRole() || !currentTech) return;
    const f = document.getElementById("editTechForm");
    // Сбрасываем предыдущий snapshot, если он был
    if (f.dataset.initial) delete f.dataset.initial;

    f.querySelector("#editId").value = currentTech.id;
    f.querySelector("#editName").value = currentTech.name;
    setCustomSelectValue("editBlock", (currentTech.blocks && currentTech.blocks.length) ? currentTech.blocks : (currentTech.block ? [currentTech.block] : []));
    setCustomSelectValue("editFunc", (currentTech.functions && currentTech.functions.length) ? currentTech.functions : (currentTech.func ? [currentTech.func] : []));
    setCustomSelectValue("editTechType", currentTech.techType || "");
    setCustomSelectValue("editStatus", currentTech.level || currentTech.status || "");
    // ratings
    const tr = document.getElementById('editTechRead'); if (tr) tr.value = (currentTech.techRead ?? '');
    const or = document.getElementById('editOrganRead'); if (or) or.value = (currentTech.organRead ?? '');
    const fc = document.getElementById('editFuncCover'); if (fc) fc.value = (currentTech.funcCover ?? '');
    // Устанавливаем значение TRL в кастомный селект
    if (currentTech.trlStage !== undefined && currentTech.trlStage !== null) {
      const trlOptions = {
        1: '1 — Ранняя стадия (исследование)',
        2: '2 — Разработка (прототип)',
        3: '3 — Зрелость (готовность к внедрению)'
      };
      const trlValue = trlOptions[currentTech.trlStage];
      if (trlValue) {
        setCustomSelectValue('editTrlStage', trlValue);
      } else {
        setCustomSelectValue('editTrlStage', '');
      }
    } else {
      setCustomSelectValue('editTrlStage', '');
    }
    // cost + toggle visibility
    const costGroup = document.getElementById('editCostGroup');
    const costInput = document.getElementById('editCostProm');
    if (costInput) costInput.value = (currentTech.costProm ?? '');
    if (costGroup) costGroup.style.display = '';
    f.querySelector("#editDesc").value = currentTech.description;
    const exampleDescEl = document.getElementById('editExampleDesc');
    if (exampleDescEl) exampleDescEl.value = currentTech.exampleDesc || '';
    // Обновляем видимость полей оценок в зависимости от количества предприятий
    updateEditTechRatingsVisibility(currentTech);

    // Делаем snapshot ПОСЛЕ заполнения всех полей, но ДО открытия модального окна
    // Используем setTimeout, чтобы убедиться, что все DOM-обновления завершены
    setTimeout(() => {
      snapshotFormInitial(f);
      // Увеличиваем время игнорирования кликов, чтобы предотвратить закрытие при открытии
      ignoreOutsideClickUntil = Date.now() + 500;
      showModal('editTechPanel');
    }, 0);
  };

  document.getElementById("deleteTechBtn").onclick = () => {
    if (!checkArchitectRole() || !currentTech) return;
    // Показываем модальное окно подтверждения
    const modal = document.getElementById('deleteConfirmModal');
    const messageEl = document.getElementById('deleteConfirmMessage');
    if (modal && messageEl && currentTech) {
      messageEl.textContent = `Вы уверены что хотите удалить технологию ${currentTech.name}?`;
      showModal('deleteConfirmModal');
    }
  };

  // Функция для получения значения поля технологии
  // filters - опциональный параметр для фильтрации отображаемых значений
  // companyFilter - опциональный параметр для ограничения списка предприятий в отчёте
  function getFieldValue(tech, fieldName, options = {}) {
    const { companyFilter = null } = options;

    switch (fieldName) {
      case 'name':
        return tech.name || 'Не указано';
      case 'company':
        if (Array.isArray(tech.company)) {
          let companies = tech.company;
          // Если указан фильтр по предприятиям, показываем только отфильтрованные
          if (companyFilter && Array.isArray(companyFilter) && companyFilter.length > 0) {
            companies = tech.company.filter(c => companyFilter.includes(c));
          }
          return companies.length > 0 ? companies.join(', ') : 'Не указано';
        }
        return tech.company || 'Не указано';
      case 'blocks':
        if (Array.isArray(tech.blocks)) {
          return tech.blocks.map(b => {
            if (typeof b === 'number' && typeof blockIdToName !== 'undefined' && blockIdToName[b]) {
              return blockIdToName[b];
            }
            return String(b || '');
          }).filter(Boolean).join(', ') || 'Не указано';
        }
        return tech.block || tech.blocks || 'Не указано';
      case 'functions':
        if (Array.isArray(tech.functions)) {
          return tech.functions.join(', ') || 'Не указано';
        }
        return tech.func || tech.functions || 'Не указано';
      case 'techTypes':
        return tech.techTypes || tech.techType || 'Не указано';
      case 'status':
        return tech.status || tech.level || 'Не указано';
      case 'costProm':
        if (tech.status === 'Перспективные' || tech.level === 'Перспективные') {
          return tech.costProm !== undefined && tech.costProm !== null ? String(tech.costProm) : '—';
        }
        return '—';
      case 'description':
        return tech.description || (tech.ref ? `Референс: ${tech.ref}` : '—');
      case 'priority':
        try {
          // Для технологий с несколькими предприятиями показываем приоритет для каждого
          if (Array.isArray(tech.company) && tech.company.length > 1) {
            // Получаем список предприятий для отображения приоритета
            let companiesToShow = tech.company;
            if (companyFilter && Array.isArray(companyFilter) && companyFilter.length > 0) {
              companiesToShow = tech.company.filter(c => companyFilter.includes(c));
            }

            // Если есть данные по предприятиям с индивидуальными оценками
            if (tech.companyRatings && typeof tech.companyRatings === 'object') {
              const priorityLines = [];
              companiesToShow.forEach(company => {
                const p = computePriority(tech, 'mult', company);
                if (p != null && !Number.isNaN(p)) {
                  const percent = Math.round(p * 100);
                  const cat = getPriorityCategory(p);
                  priorityLines.push(`${company}: ${percent}% (${cat.label})`);
                } else {
                  priorityLines.push(`${company}: —`);
                }
              });
              return priorityLines.join('\n');
            } else {
              // Нет индивидуальных оценок - показываем общий приоритет для всех предприятий
              const p = computePriority(tech, 'mult');
              if (p == null || Number.isNaN(p)) return '—';
              const percent = Math.round(p * 100);
              const cat = getPriorityCategory(p);
              // Показываем для каждого предприятия одинаковый приоритет
              const priorityLines = companiesToShow.map(company => `${company}: ${percent}% (${cat.label})`);
              return priorityLines.join('\n');
            }
          } else {
            // Одно предприятие - стандартное отображение
            const p = computePriority(tech, 'mult');
            if (p == null || Number.isNaN(p)) return '—';
            const percent = Math.round(p * 100);
            const cat = getPriorityCategory(p);
            return `${percent}% (${cat.label})`;
          }
        } catch (e) {
          return '—';
        }
      case 'techRead':
        // Для технологий с несколькими предприятиями показываем значения для каждого
        if (Array.isArray(tech.company) && tech.company.length > 1) {
          let companiesToShow = tech.company;
          if (companyFilter && Array.isArray(companyFilter) && companyFilter.length > 0) {
            companiesToShow = tech.company.filter(c => companyFilter.includes(c));
          }

          // Если есть данные по предприятиям с индивидуальными оценками
          if (tech.companyRatings && typeof tech.companyRatings === 'object') {
            const techReadLines = [];
            companiesToShow.forEach(company => {
              const ratings = tech.companyRatings[company];
              if (ratings && ratings.techRead !== undefined && ratings.techRead !== null) {
                techReadLines.push(`${company}: ${ratings.techRead}`);
              } else {
                // Используем общие значения
                const value = tech.techRead !== undefined && tech.techRead !== null ? String(tech.techRead) : '—';
                techReadLines.push(`${company}: ${value}`);
              }
            });
            return techReadLines.length > 0 ? techReadLines.join('\n') : '—';
          } else {
            // Нет индивидуальных оценок - показываем общее значение для всех предприятий
            const value = tech.techRead !== undefined && tech.techRead !== null ? String(tech.techRead) : '—';
            const techReadLines = companiesToShow.map(company => `${company}: ${value}`);
            return techReadLines.join('\n');
          }
        } else {
          // Одно предприятие - стандартное отображение
          return tech.techRead !== undefined && tech.techRead !== null ? String(tech.techRead) : '—';
        }
      case 'organRead':
        // Для технологий с несколькими предприятиями показываем значения для каждого
        if (Array.isArray(tech.company) && tech.company.length > 1) {
          let companiesToShow = tech.company;
          if (companyFilter && Array.isArray(companyFilter) && companyFilter.length > 0) {
            companiesToShow = tech.company.filter(c => companyFilter.includes(c));
          }

          // Если есть данные по предприятиям с индивидуальными оценками
          if (tech.companyRatings && typeof tech.companyRatings === 'object') {
            const organReadLines = [];
            companiesToShow.forEach(company => {
              const ratings = tech.companyRatings[company];
              if (ratings && ratings.organRead !== undefined && ratings.organRead !== null) {
                organReadLines.push(`${company}: ${ratings.organRead}`);
              } else {
                // Используем общие значения
                const value = tech.organRead !== undefined && tech.organRead !== null ? String(tech.organRead) : '—';
                organReadLines.push(`${company}: ${value}`);
              }
            });
            return organReadLines.length > 0 ? organReadLines.join('\n') : '—';
          } else {
            // Нет индивидуальных оценок - показываем общее значение для всех предприятий
            const value = tech.organRead !== undefined && tech.organRead !== null ? String(tech.organRead) : '—';
            const organReadLines = companiesToShow.map(company => `${company}: ${value}`);
            return organReadLines.join('\n');
          }
        } else {
          // Одно предприятие - стандартное отображение
          return tech.organRead !== undefined && tech.organRead !== null ? String(tech.organRead) : '—';
        }
      case 'funcCover':
        return tech.funcCover !== undefined && tech.funcCover !== null ? String(tech.funcCover) : '—';
      case 'exampleDesc':
        return tech.exampleDesc || '—';
      default:
        return '—';
    }
  }

  // Функция для получения заголовка поля
  function getFieldLabel(fieldName) {
    const labels = {
      'name': 'Название',
      'company': 'Предприятия',
      'blocks': 'Функциональный блок',
      'functions': 'Функции',
      'techTypes': 'Тип технологии',
      'status': 'Статус',
      'costProm': 'Стоимость внедрения',
      'description': 'Описание',
      'priority': 'Приоритет технологии',
      'techRead': 'Технологическая готовность',
      'organRead': 'Организационная готовность',
      'funcCover': 'Покрытие функций'
    };
    return labels[fieldName] || fieldName;
  }

  // Функция для проверки, является ли поле числовым
  function isNumericField(fieldName) {
    return ['techRead', 'organRead', 'funcCover', 'costProm'].includes(fieldName);
  }

  // Функция для получения цвета на основе значения готовности (0-3)
  function getReadinessColor(value) {
    const numValue = Number(value);
    if (isNaN(numValue)) return '#000000'; // Черный для нечисловых значений

    switch (numValue) {
      case 0:
        return '#E74C3C'; // Красный
      case 1:
        return '#FF8C00'; // Оранжевый
      case 2:
        return '#FFD700'; // Желтый
      case 3:
        return '#28A745'; // Зеленый
      default:
        return '#000000'; // Черный для значений вне диапазона
    }
  }

  // Функция для проверки, является ли поле полем готовности
  function isReadinessField(fieldName) {
    return ['techRead', 'organRead', 'funcCover'].includes(fieldName);
  }

  // Экспорт функций в window для использования в модуле export.js
  window.getFieldLabel = getFieldLabel;
  window.getFieldValue = getFieldValue;
  window.isNumericField = isNumericField;
  // checkArchitectRole экспортируется из модуля auth.js
  // Функции приоритетов экспортируются из модуля priorities.js
  window.getFilterValues = getFilterValues;
  window.getEnterpriseData = getEnterpriseData;
  window.getCurrentEnterprise = getCurrentEnterprise;
  window.getCurrentZoomedQuadrant = getCurrentZoomedQuadrant;
  window.getTechnologies = getTechnologies;
  // Экспорт функций для использования в модуле priorities.js
  window.getTechnologiesForQuadrant = getTechnologiesForQuadrant;
  window.getQuadrantName = getQuadrantName;
  window.getTechStatus = getTechStatus;
  window.getHoverText = getHoverText;
  window.showDetail = showDetail;
  window.setCurrentTech = setCurrentTech;
  window.getAllQuadrantsForTech = getAllQuadrantsForTech;

  // ===== Функции управления индикатором загрузки отчета =====
  function showReportLoading() {
    const modal = document.getElementById('reportLoadingModal');
    const spinner = document.getElementById('loadingSpinner');
    const success = document.getElementById('loadingSuccess');
    const error = document.getElementById('loadingError');
    const text = document.getElementById('loadingText');
    const errorMessage = document.getElementById('loadingErrorMessage');

    if (!modal) return;

    // Сбрасываем состояние
    if (spinner) spinner.style.display = 'block';
    if (success) success.style.display = 'none';
    if (error) error.style.display = 'none';
    if (text) text.textContent = 'Загрузка...';
    if (errorMessage) {
      errorMessage.style.display = 'none';
      errorMessage.textContent = '';
    }

    // Показываем модальное окно
    showModal('reportLoadingModal');
  }

  function showReportSuccess() {
    const modal = document.getElementById('reportLoadingModal');
    const spinner = document.getElementById('loadingSpinner');
    const success = document.getElementById('loadingSuccess');
    const text = document.getElementById('loadingText');

    if (!modal) return;

    // Скрываем спиннер, показываем галочку
    if (spinner) spinner.style.display = 'none';
    if (success) success.style.display = 'flex';
    if (text) text.textContent = 'Отчет успешно сформирован!';

    // Автоматически закрываем через 2 секунды
    setTimeout(() => {
      hideModal('reportLoadingModal');
    }, 2000);
  }

  function showReportError(message) {
    const modal = document.getElementById('reportLoadingModal');
    const spinner = document.getElementById('loadingSpinner');
    const error = document.getElementById('loadingError');
    const text = document.getElementById('loadingText');
    const errorMessage = document.getElementById('loadingErrorMessage');

    if (!modal) return;

    // Скрываем спиннер, показываем крестик
    if (spinner) spinner.style.display = 'none';
    if (error) error.style.display = 'flex';
    if (text) text.textContent = 'Ошибка при генерации отчета';
    if (errorMessage) {
      errorMessage.textContent = message || 'Произошла неизвестная ошибка';
      errorMessage.style.display = 'block';
    }

    // Автоматически закрываем через 5 секунд
    setTimeout(() => {
      hideModal('reportLoadingModal');
    }, 5000);
  }

  // Экспорт функций управления отчетом в window для использования в модуле export.js
  window.showReportLoading = showReportLoading;
  window.showReportSuccess = showReportSuccess;
  window.showReportError = showReportError;

  // Основная функция экспорта PDF с поддержкой выбора полей
  // ПЕРЕМЕЩЕНА В МОДУЛЬ export.js
  // Используем функцию из модуля export.js
  // Основная функция экспорта PDF - ПЕРЕМЕЩЕНА В МОДУЛЬ export.js
  async function performPdfExport(selectedFields, filters = {}) {
    // Делегируем вызов модулю export.js
    if (typeof window.ExportModule !== 'undefined' && window.ExportModule.performPdfExport) {
      return window.ExportModule.performPdfExport(selectedFields, filters);
    }
    // Fallback для обратной совместимости
    throw new Error('Модуль экспорта не загружен');
  }

  // Экспорт функции performPdfExport в window для обратной совместимости
  window.performPdfExport = performPdfExport;

  // Все остальные функции экспорта ПЕРЕМЕЩЕНЫ В МОДУЛЬ export.js
  // Используем функции из модуля export.js через window

  // Обработчик кнопки экспорта PDF - используем функцию из модуля export.js
  // Инициализация обработчика перенесена в модуль export.js (initExportPdfModalHandlers)
  // Обработчик кнопки также инициализируется в модуле export.js

  // Позиционирование выпадающих списков
  function positionOptions(select) {
    if (!select) return;
    // Для структуры с select-dropdown позиционируем dropdown, иначе позиционируем select-options
    const dropdown = select.querySelector('.select-dropdown');
    const list = dropdown || select.querySelector('.select-options');
    if (!list) return;
    // требуется, чтобы .custom-select (и .custom-select-modal) имели position: relative (это задано в CSS)
    if (dropdown) {
      // Для select-dropdown позиционирование уже задано в CSS, но можно обновить ширину
      dropdown.style.minWidth = `${select.offsetWidth}px`;
      dropdown.style.width = `${select.offsetWidth}px`;
    } else {
      // Для обычного select-options позиционируем список
      const selectRect = select.getBoundingClientRect();
      const listRect = list.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const spaceBelow = viewportHeight - selectRect.bottom;
      const spaceAbove = selectRect.top;

      if (spaceBelow < listRect.height && spaceAbove > spaceBelow) {
        // Показываем список сверху
        list.style.bottom = `${select.offsetHeight}px`;
        list.style.top = 'auto';
      } else {
        // Показываем список снизу (по умолчанию)
        list.style.top = `${select.offsetHeight}px`;
        list.style.bottom = 'auto';
      }
    }
  }

  // Позиционирование выпадающих списков
  function positionOptions(select) {
    if (!select) return;
    // Для структуры с select-dropdown позиционируем dropdown, иначе позиционируем select-options
    const dropdown = select.querySelector('.select-dropdown');
    const list = dropdown || select.querySelector('.select-options');
    if (!list) return;
    // Простое и предсказуемое позиционирование: всегда позиционируем список относительно самого .custom-select
    // требуется, чтобы .custom-select (и .custom-select-modal) имели position: relative (это задано в CSS)
    if (dropdown) {
      // Для select-dropdown позиционирование уже задано в CSS, но можно обновить ширину
      dropdown.style.minWidth = `${select.offsetWidth}px`;
      dropdown.style.width = `${select.offsetWidth}px`;
    } else {
      // Для обычного select-options позиционируем список
      const selectRect = select.getBoundingClientRect();
      const listRect = list.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const spaceBelow = viewportHeight - selectRect.bottom;
      const spaceAbove = selectRect.top;

      if (spaceBelow < listRect.height && spaceAbove > spaceBelow) {
        // Показываем список сверху
        list.style.bottom = `${select.offsetHeight}px`;
        list.style.top = 'auto';
      } else {
        // Показываем список снизу (по умолчанию)
        list.style.top = `${select.offsetHeight}px`;
        list.style.bottom = 'auto';
      }
    }
  }

  // Позиционирование выпадающих списков
  function positionOptions(select) {
    if (!select) return;
    // Для структуры с select-dropdown позиционируем dropdown, иначе позиционируем select-options
    const dropdown = select.querySelector('.select-dropdown');
    const list = dropdown || select.querySelector('.select-options');
    if (!list) return;
    // Простое и предсказуемое позиционирование: всегда позиционируем список относительно самого .custom-select
    // требуется, чтобы .custom-select (и .custom-select-modal) имели position: relative (это задано в CSS)
    if (dropdown) {
      // Для select-dropdown позиционирование уже задано в CSS, но можно обновить ширину
      dropdown.style.minWidth = `${select.offsetWidth}px`;
      dropdown.style.width = `${select.offsetWidth}px`;
    } else {
      // Для обычного select-options позиционируем список
      const selectRect = select.getBoundingClientRect();
      const listRect = list.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const spaceBelow = viewportHeight - selectRect.bottom;
      const spaceAbove = selectRect.top;

      if (spaceBelow < listRect.height && spaceAbove > spaceBelow) {
        // Показываем список сверху
        list.style.bottom = `${select.offsetHeight}px`;
        list.style.top = 'auto';
      } else {
        // Показываем список снизу (по умолчанию)
        list.style.top = `${select.offsetHeight}px`;
        list.style.bottom = 'auto';
      }
    }
  }

  // Все функции экспорта ПЕРЕМЕЩЕНЫ В МОДУЛЬ export.js
  // Старый код экспорта удален

  // Все функции экспорта ПЕРЕМЕЩЕНЫ В МОДУЛЬ export.js
  // Старый код экспорта удален (функции populateMultiSelect, initMultiSelect, updateMultiSelectValue,
  // getMultiSelectValues, populateExportFilters, setupExportFilterToggles, showExportPdfModal,
  // validateExportFields, applyFiltersToTechnologies и все обработчики экспорта)

  // Позиционирование выпадающих списков
  function positionOptions(select) {
    if (!select) return;
    // Для структуры с select-dropdown позиционируем dropdown, иначе позиционируем select-options
    const dropdown = select.querySelector('.select-dropdown');
    const list = dropdown || select.querySelector('.select-options');
    if (!list) return;
    // Простое и предсказуемое позиционирование: всегда позиционируем список относительно самого .custom-select
    // требуется, чтобы .custom-select (и .custom-select-modal) имели position: relative (это задано в CSS)
    if (dropdown) {
      // Для select-dropdown позиционирование уже задано в CSS, но можно обновить ширину
      dropdown.style.minWidth = `${select.offsetWidth}px`;
      dropdown.style.width = `${select.offsetWidth}px`;
    } else {
      // Для обычного select-options позиционируем список
      const selectRect = select.getBoundingClientRect();
      const listRect = list.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const spaceBelow = viewportHeight - selectRect.bottom;
      const spaceAbove = selectRect.top;

      if (spaceBelow < listRect.height && spaceAbove > spaceBelow) {
        // Показываем список сверху
        list.style.bottom = `${select.offsetHeight}px`;
        list.style.top = 'auto';
      } else {
        // Показываем список снизу (по умолчанию)
        list.style.top = `${select.offsetHeight}px`;
        list.style.bottom = 'auto';
      }
    }
  }

  // Все функции экспорта ПЕРЕМЕЩЕНЫ В МОДУЛЬ export.js
  // Старый код экспорта удален (функции populateMultiSelect, initMultiSelect, updateMultiSelectValue,
  // getMultiSelectValues, populateExportFilters, setupExportFilterToggles, showExportPdfModal,
  // validateExportFields, applyFiltersToTechnologies и все обработчики экспорта)

  // Позиционирование выпадающих списков
  function positionOptions(select) {
    if (!select) return;
    // Для структуры с select-dropdown позиционируем dropdown, иначе позиционируем select-options
    const dropdown = select.querySelector('.select-dropdown');
    const list = dropdown || select.querySelector('.select-options');
    if (!list) return;
    // Простое и предсказуемое позиционирование: всегда позиционируем список относительно самого .custom-select
    // требуется, чтобы .custom-select (и .custom-select-modal) имели position: relative (это задано в CSS)
    if (dropdown) {
      // Для select-dropdown позиционирование уже задано в CSS, но можно обновить ширину
      dropdown.style.minWidth = `${select.offsetWidth}px`;
      dropdown.style.width = `${select.offsetWidth}px`;
    } else {
      // Для обычного select-options позиционируем список
      const selectRect = select.getBoundingClientRect();
      const listRect = list.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const spaceBelow = viewportHeight - selectRect.bottom;
      const spaceAbove = selectRect.top;

      if (spaceBelow < listRect.height && spaceAbove > spaceBelow) {
        // Показываем список сверху
        list.style.bottom = `${select.offsetHeight}px`;
        list.style.top = 'auto';
      } else {
        // Показываем список снизу (по умолчанию)
        list.style.top = `${select.offsetHeight}px`;
        list.style.bottom = 'auto';
      }
    }
  }

  // Функции экспорта PDF вынесены в модуль export.js
  // Используем функции из модуля через window.ExportModule или window

  // Позиционирование выпадающих списков
  function positionOptions(select) {
    if (!select) return;
    // Для структуры с select-dropdown позиционируем dropdown, иначе позиционируем select-options
    const dropdown = select.querySelector('.select-dropdown');
    const list = dropdown || select.querySelector('.select-options');
    if (!list) return;
    // Простое и предсказуемое позиционирование: всегда позиционируем список относительно самого .custom-select
    // требуется, чтобы .custom-select (и .custom-select-modal) имели position: relative (это задано в CSS)
    if (dropdown) {
      // Для select-dropdown позиционирование уже задано в CSS, но можно обновить ширину
      dropdown.style.minWidth = `${select.offsetWidth}px`;
      dropdown.style.width = `${select.offsetWidth}px`;
    } else {
      // Для обычного select-options позиционируем список
      const selectRect = select.getBoundingClientRect();
      const listRect = list.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const spaceBelow = viewportHeight - selectRect.bottom;
      const spaceAbove = selectRect.top;

      if (spaceBelow < listRect.height && spaceAbove > spaceBelow) {
        // Показываем список сверху
        list.style.bottom = `${select.offsetHeight}px`;
        list.style.top = 'auto';
      } else {
        // Показываем список снизу (по умолчанию)
        list.style.top = `${select.offsetHeight}px`;
        list.style.bottom = 'auto';
      }
    }
    // Высоту и прокрутку списка оставляем на уровне CSS, чтобы размер выпадающего
    // списка был стабильным и не «прыгал» при открытии/фильтрации.
  }

});
