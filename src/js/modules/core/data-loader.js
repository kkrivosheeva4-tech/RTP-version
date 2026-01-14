// Модуль загрузки данных
// Экспортирует функции в window.DataLoader для использования в RMK2.js
// Использует глобальные переменные из RMK2.js и функции из других модулей

(function() {
  'use strict';

  // ===== VFS: virtual file system using localStorage =====
  function vfsKey(filename) {
    return `vfs:${filename}`;
  }

  function vfsRead(filename) {
    try {
      const raw = localStorage.getItem(vfsKey(filename));
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      if (window.Logger) window.Logger.warn('vfsRead parse error', e);
      return null;
    }
  }

  function vfsWrite(filename, data) {
    try {
      localStorage.setItem(vfsKey(filename), JSON.stringify(data));
      if (window.Logger) window.Logger.debug(`vfsWrite: ${filename} saved to localStorage`);
      return true;
    } catch (e) {
      console.error('vfsWrite error', e);
      return false;
    }
  }

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

  // Функция для ручного сброса VFS (локальных изменений пользователя)
  function clearVfsCache() {
    try {
      const vfsKeys = Object.keys(localStorage).filter(key => key.startsWith('vfs:'));
      vfsKeys.forEach(key => localStorage.removeItem(key));
      if (window.Logger) window.Logger.debug(`Очищено ${vfsKeys.length} ключей VFS из localStorage`);
      return vfsKeys.length;
    } catch (e) {
      console.error('Ошибка при очистке VFS:', e);
      return 0;
    }
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

  // ===== ЗАГРУЗКА JSON С ПРИОРИТЕТОМ VFS =====
  async function loadJsonPreferVfs(filename) {
    // Всегда пытаемся сначала загрузить из data/ru
    const paths = [`/src/data/ru/${filename}`, `/src/data/${filename}`];
    for (const p of paths) {
      try {
        const json = await fetchJsonWithCache(p, { ttl: FETCH_CACHE_TTL_MS, timeout: DEFAULT_FETCH_TIMEOUT_MS });
        if (json) {
          if (window.Logger) window.Logger.debug(`Загружены данные из файла ${p}:`, json);
          return { path: p, data: json };
        }
      } catch (err) {
        if (window.Logger) window.Logger.warn(`Ошибка загрузки ${p}:`, err);
      }
    }

    // Только если не удалось загрузить с диска, пробуем из VFS
    const fromVfs = vfsRead(filename);
    if (fromVfs !== null) {
      if (window.Logger) window.Logger.debug(`Загружены данные из VFS для ${filename}:`, fromVfs);
      return { path: `local:${filename}`, data: fromVfs };
    }

    return { path: null, data: null };
  }

  // Получаем зависимости из других модулей и глобальных переменных (ленивая загрузка)
  const getStateManager = () => {
    if (window.StateManager) {
      return window.StateManager;
    }
    throw new Error('StateManager не загружен');
  };

  const getState = (key) => {
    const sm = getStateManager();
    return sm.get(key);
  };

  const setState = (key, value) => {
    const sm = getStateManager();
    sm.set(key, value);
    // Синхронизация с window для обратной совместимости
    if (key === 'technologies') window.technologies = value;
    if (key === 'enterpriseData') window.enterpriseData = value;
    if (key === 'currentEnterprise') window.currentEnterprise = value;
    if (key === 'blocksList') window.blocksList = value;
    if (key === 'functions') window.functions = value;
    if (key === 'nameToBlockId') window.nameToBlockId = value;
    if (key === 'functionToBlockMap') window.functionToBlockMap = value;
    if (key === 'blockToQuadrant') window.blockToQuadrant = value;
  };

  const getDOMCache = () => {
    if (window.DOMCache) {
      return window.DOMCache;
    }
    throw new Error('DOMCache не загружен');
  };

  const getEventManager = () => {
    if (window.EventManager) {
      return window.EventManager;
    }
    throw new Error('EventManager не загружен');
  };

  const getFilters = () => {
    if (window.Filters) {
      return window.Filters;
    }
    if (window.Logger) window.Logger.warn('Filters не загружен, попытка повторной инициализации фильтров будет пропущена');
    return null;
  };

  const getPositioning = () => {
    if (window.Positioning) {
      return window.Positioning;
    }
    if (window.Logger) window.Logger.warn('Positioning не загружен, вычисление координат будет пропущено');
    return null;
  };

  const getDataIndex = () => {
    if (window.DataIndex) {
      return window.DataIndex;
    }
    if (window.Logger) window.Logger.warn('DataIndex не загружен, индексация будет пропущена');
    return null;
  };

  const showNotification = (message, isSuccess = false) => {
    // Используем Toast, если доступен, иначе fallback на старую реализацию
    if (typeof window !== 'undefined' && window.Toast) {
      if (isSuccess) {
        window.Toast.success(message);
      } else {
        window.Toast.info(message);
      }
      return;
    }

    // Fallback на старую реализацию
    const DOMCache = getDOMCache();
    const EventManager = getEventManager();

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
    const escapedMessage = window.escapeHtml ? window.escapeHtml(message) : String(message).replace(/[&<>"']/g, m => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[m]);
    notification.innerHTML = `
      <div class="notification-title">${isSuccess ? 'Успешно' : 'Уведомление'}</div>
      <div class="notification-message">${escapedMessage}</div>
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
  };

  // ===== ОСНОВНАЯ ФУНКЦИЯ ЗАГРУЗКИ ДАННЫХ =====
  async function loadData() {
    // Показываем индикатор загрузки
    let loaderId = null;
    if (typeof window !== 'undefined' && window.LoadingManager) {
      loaderId = window.LoadingManager.show('Загрузка данных...');
    }

    try {
      // Очищаем только fetch-кэш при загрузке
      // VFS (vfs:*) НЕ очищаем автоматически, чтобы сохранить пользовательские правки
      // Для сброса локальных изменений используйте функцию clearVfsCache() или кнопку в UI
      clearFetchCache();

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
      setState('nameToBlockId', {});
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
        setState('nameToBlockId', nameToBlockId);
      }
      setState('blocksList', Array.isArray(blocks) ? blocks.map(b => (b && b.name) ? b.name : b).filter(Boolean) : []);

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
      setState('functions', functionsData
        .map(f => (f && typeof f === 'object' && f.name) ? f.name : String(f || '')).filter(Boolean));
      const techTypes = ensureArray('techTypes.json', fetched['techTypes.json'].data);
      // Экспорт techTypes в window для использования модулями (обрабатываем как массив строк или объектов)
      window.techTypes = Array.isArray(techTypes) && techTypes.length > 0
        ? techTypes.map(t => (t && typeof t === 'object' && t.name) ? t.name : String(t || '')).filter(Boolean)
        : Object.keys(window.TECHTYPE_TO_SHAPE || {});
      const statusList = ensureArray('status.json', fetched['status.json'].data);
      const sectors = ensureArray('sector.json', fetched['sector.json'].data);
      setState('sectors', sectors); // Сохраняем sectors для использования в initFilters
      setState('functionToBlockMap', ensureObject('functionToBlock.json', fetched['functionToBlock.json'].data));
      // enterpriseData may come from VFS (path startsWith 'local:') or from disk
      setState('enterpriseData', ensureObject('enterpriseData.json', fetched['enterpriseData.json'].data));
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
              let enterpriseData = getState('enterpriseData');
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
                setState('enterpriseData', {...enterpriseData}); // Сохраняем изменения обратно в StateManager
                try { vfsWrite('enterpriseData.json', enterpriseData); } catch (e) { if (window.Logger) window.Logger.warn('vfs write failed during merge', e); }
              }
              break; // whether merged or not, we've checked disk
            } catch (err) { /* ignore fetch parse errors for this path */ }
          }
        }
      } catch (err) { if (window.Logger) window.Logger.warn('Error while attempting to merge enterpriseData from disk into VFS', err); }
      if (validationErrors.length) {
        if (window.Logger) window.Logger.warn('Валидация данных: обнаружены проблемы', validationErrors);
        showNotification(`Проверка данных: ${validationErrors.join('; ')}`, false);
      }
      setState('blockToQuadrant', fetched['blockToQuadrant.json'].data || {});
      // Инвалидируем кэш квадрантов при изменении blockToQuadrant
      const quadrantsCache = getState('quadrantsCache');
      if (quadrantsCache && typeof quadrantsCache.clear === 'function') {
        quadrantsCache.clear();
      }
      const currentVersion = getState('quadrantsCacheVersion') || 0;
      setState('quadrantsCacheVersion', currentVersion + 1);
      // Установим RINGS и QUADRANTS из JSON
      const RINGS = Array.isArray(statusList) ? statusList.slice() : ["Используемые", "Внедряемые", "Перспективные"];
      window.RINGS = RINGS;
      let levelToRing = {};
      RINGS.forEach((rName, idx) => {
        levelToRing[rName] = idx;
        if (typeof rName === 'string' && rName.endsWith('ые')) {
          levelToRing[rName.slice(0, -2) + 'ая'] = idx;
        }
      });
      window.levelToRing = levelToRing;
      const QUADRANTS = Array.isArray(sectors)
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
        setState('enterpriseData', grouped);
      }

      // Заполнение фильтров - отложим до полной готовности DOM
      // Фильтры будут заполнены в функции initFiltersWithRetry ниже

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
      // Объявляем trlOptions и addTrlTooltips ПЕРЕД использованием, чтобы они были доступны всегда
      const trlOptions = ['1 — Ранняя стадия (исследование)', '2 — Разработка (прототип)', '3 — Зрелость (готовность к внедрению)'];
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
      // Опции для оценок готовности (0-3)
      const ratingOptions = ['0 — Не готова', '1 — Низкая', '2 — Средняя', '3 — Высокая'];
      const addRatingTooltips = (fieldId, tooltipMap) => {
        const ratingSelect = document.querySelector(`.custom-select-modal[data-field="${fieldId}"]`);
        if (ratingSelect) {
          const options = ratingSelect.querySelectorAll('.select-options li[data-value]');
          options.forEach(li => {
            const value = li.getAttribute('data-value');
            if (value && tooltipMap[value]) {
              li.setAttribute('title', tooltipMap[value]);
            }
          });
        }
      };
      // Маппинг tooltips для различных полей оценок
      const techReadTooltips = {
        '0 — Не готова': 'Технология находится на начальной стадии, не применима',
        '1 — Низкая': 'Начальная стадия разработки, требуется значительная доработка',
        '2 — Средняя': 'Технология частично готова, требуется доработка',
        '3 — Высокая': 'Технология готова к применению'
      };
      const organReadTooltips = {
        '0 — Не готова': 'Организация не готова к внедрению',
        '1 — Низкая': 'Начальный этап подготовки, требуется значительная работа',
        '2 — Средняя': 'Частичная готовность, требуется дополнительная подготовка',
        '3 — Высокая': 'Организация полностью готова к внедрению'
      };
      const funcCoverTooltips = {
        '0 — Не готова': 'Функции не покрыты технологией',
        '1 — Низкая': 'Покрыта небольшая часть функций',
        '2 — Средняя': 'Покрыта значительная часть функций',
        '3 — Высокая': 'Покрыты все необходимые функции'
      };
      if (Filters) {
        const blocksList = getState('blocksList');
        const functions = getState('functions');
        const enterpriseData = getState('enterpriseData');
        const enterpriseList = Object.keys(enterpriseData || {});
        Filters.populateSelectForModal('techSector', sectorNames, 'Выберите');
        Filters.populateSelectForModal('techBlock', blocksList, 'Выберите');
        Filters.populateSelectForModal('techFunc', functions, 'Выберите');
        Filters.populateSelectForModal('techTechType', Array.isArray(techTypes) ? techTypes : Object.keys(window.TECHTYPE_TO_SHAPE || {}), 'Выберите');
        Filters.populateSelectForModal('techStatus', RINGS, 'Выберите');
        // Заполняем список предприятий
        Filters.populateSelectForModal('techCompany', enterpriseList, 'Выберите');
        // Заполняем список TRL с подсказками (объявляем один раз для обеих форм)
        Filters.populateSelectForModal('techTrlStage', trlOptions, 'Выберите стадию');
        // Заполняем списки оценок готовности
        Filters.populateSelectForModal('techTechRead', ratingOptions, 'Выберите оценку');
        Filters.populateSelectForModal('techOrganRead', ratingOptions, 'Выберите оценку');
        Filters.populateSelectForModal('techFuncCover', ratingOptions, 'Выберите оценку');
      } else {
        console.error('Filters не загружен, модальные фильтры не будут заполнены');
      }
      // Добавляем подсказки для опций TRL и оценок после создания опций
      if (Filters) {
        setTimeout(() => {
          addTrlTooltips('techTrlStage');
          addRatingTooltips('techTechRead', techReadTooltips);
          addRatingTooltips('techOrganRead', organReadTooltips);
          addRatingTooltips('techFuncCover', funcCoverTooltips);
        }, 50);
      }
      // Поле стоимости внедрения теперь доступно для всех статусов
      function setupCostToggle(prefix) {
        const group = document.getElementById(`${prefix}CostGroup`);
        if (!group) return;
        // Поле всегда видно для всех статусов
        group.style.display = '';
      }
      setupCostToggle('tech');

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

          const nextId = getState('nextId') || 1;
          const tech = {
            id: nextId,
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
          const technologies = getState('technologies');
          technologies.push(tech);
          setState('technologies', [...technologies]);
          setState('nextId', nextId + 1);
          // Инвалидируем кэш квадрантов при добавлении технологии
          const quadrantsCache = getState('quadrantsCache');
          if (quadrantsCache && typeof quadrantsCache.clear === 'function') {
            quadrantsCache.clear();
          }
          const currentVersion = getState('quadrantsCacheVersion') || 0;
          setState('quadrantsCacheVersion', currentVersion + 1);
          // Пересобираем индекс
          const DataIndex = getDataIndex();
          if (DataIndex) {
            try { DataIndex.build(getState('technologies')); } catch (e) { if (window.Logger) window.Logger.warn('DataIndex.build failed', e); }
          }
          const enterpriseData = getState('enterpriseData');
          const currentEnterprise = getState('currentEnterprise');
          enterpriseData[currentEnterprise] = [...getState('technologies')];
          setState('enterpriseData', {...enterpriseData});

          // Сохраняем в VFS
          vfsWrite('enterpriseData.json', enterpriseData);

          // Обновляем радар
          const Positioning = getPositioning();
          if (Positioning) {
            Positioning.computeCoordinates(tech);
          }
          if (typeof window.updateRadar === 'function') {
            window.updateRadar();
          }

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
          const currentTech = getState('currentTech');
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
          const technologies = getState('technologies');
          const index = technologies.findIndex(t => t.id === currentTech.id);
          if (index !== -1) {
            technologies[index] = updatedTech;
            setState('technologies', [...technologies]);
            // Пересобираем индекс
            const DataIndex = getDataIndex();
            if (DataIndex) {
              try { DataIndex.build(getState('technologies')); } catch (e) { if (window.Logger) window.Logger.warn('DataIndex.build failed', e); }
            }
            const enterpriseData = getState('enterpriseData');
            const currentEnterprise = getState('currentEnterprise');
            enterpriseData[currentEnterprise] = [...getState('technologies')];
            setState('enterpriseData', {...enterpriseData});

            // Сохраняем в VFS
            vfsWrite('enterpriseData.json', enterpriseData);

            // Обновляем координаты и радар
            const Positioning = getPositioning();
            if (Positioning) {
              Positioning.computeCoordinates(updatedTech);
            }
            if (typeof window.updateRadar === 'function') {
              window.updateRadar();
            }

            // Обновляем панель деталей (источник — редактирование)
            if (typeof window.showDetail === 'function') {
              window.showDetail(updatedTech, 'edit');
            }
          }

          // Закрываем модальное окно
          const modal = document.getElementById('editTechPanel');
          if (modal) modal.style.display = 'none';

          showNotification('Технология успешно обновлена', true);
          return false;
        };
      }

      // Фильтры формы редактирования также будут заполнены в initFiltersWithRetry
      // Но добавим tooltips для TRL и оценок если Filters доступен
      if (Filters) {
        setTimeout(() => {
          addTrlTooltips('editTrlStage');
          addRatingTooltips('editTechRead', techReadTooltips);
          addRatingTooltips('editOrganRead', organReadTooltips);
          addRatingTooltips('editFuncCover', funcCoverTooltips);
        }, 50);
      }
      setupCostToggle('edit');

      // --- Нормализация данных: вычислим и закрепим зрелости, форму и координаты для каждой технологии ---
      function normalizeEnterpriseData() {
        let updated = false;
        const enterpriseData = getState('enterpriseData');
        const Positioning = getPositioning();
        let nextId = getState('nextId') || 1;
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
            const computeShapeByTechType = (techType) => {
              if (!techType) return 'circle';
              const shapeMap = window.TECHTYPE_TO_SHAPE || {};
              return shapeMap[techType] || 'circle';
            };
            const newShape = computeShapeByTechType(t.techType) || 'circle';
            if (t.shape !== newShape) { t.shape = newShape; updated = true; }
            // Вычислим координаты
            if (Positioning) {
              const prevX = t.x, prevY = t.y;
              Positioning.computeCoordinates(t);
              if (t.x !== prevX || t.y !== prevY) updated = true;
            }
            return t;
          });
        });
        if (updated) {
          try { vfsWrite('enterpriseData.json', enterpriseData); } catch (e) { if (window.Logger) window.Logger.warn('Не удалось сохранить enterpriseData после нормализации', e); }
        }
        setState('nextId', nextId);
      }
      normalizeEnterpriseData();
      // Обновим заголовки секторов в сайдбаре
      try {
        const QUADRANTS = window.QUADRANTS || [];
        if (Array.isArray(QUADRANTS) && QUADRANTS.length > 0) {
          QUADRANTS.forEach(q => {
            if (q && q.id) {
              const el = document.querySelector(`.sector-item[data-quadrant="${q.id}"]`);
              if (el) {
                const title = el.querySelector('.sector-title') || el;
                if (title && q.name) title.textContent = q.name;
              }
            }
          });
        }
      } catch (e) {
        if (window.Logger) window.Logger.warn('Ошибка при обновлении заголовков секторов:', e);
      }

      // Убеждаемся, что фильтры заполнены после полной загрузки DOM
      // Используем несколько попыток с задержками для гарантии, что все элементы созданы
      const initFiltersWithRetry = (attempt = 0) => {
        const maxAttempts = 5;
        const delay = 100 * (attempt + 1);

        setTimeout(() => {
          const Filters = getFilters();
          if (!Filters) {
            if (window.Logger) window.Logger.warn(`Попытка ${attempt + 1}: Filters не загружен`);
            if (attempt < maxAttempts - 1) {
              initFiltersWithRetry(attempt + 1);
            }
            return;
          }

          const blocksList = getState('blocksList') || [];
          const functions = getState('functions') || [];
          const techTypes = window.techTypes || Object.keys(window.TECHTYPE_TO_SHAPE || {});
          const RINGS = window.RINGS || [];
          const QUADRANTS = window.QUADRANTS || [];


          // Получаем sectorNames для модальных фильтров
          const sectorsData = getState('sectors') || sectors || [];
          let sectorNames = [];
          if (Array.isArray(sectorsData) && sectorsData.length) {
            sectorNames = sectorsData.map(s => s && s.name).filter(Boolean);
          }
          if ((!Array.isArray(sectorNames) || sectorNames.length === 0) && Array.isArray(QUADRANTS) && QUADRANTS.length) {
            sectorNames = QUADRANTS.map(q => q && q.name).filter(Boolean);
          }

          // Проверяем наличие элементов DOM
          const sidebarBlockSelect = document.querySelector('.custom-select[data-filter="block"]');
          const sidebarFunctionSelect = document.querySelector('.custom-select[data-filter="function"]');
          const sidebarTechTypeSelect = document.querySelector('.custom-select[data-filter="techType"]');
          const sidebarLevelSelect = document.querySelector('.custom-select[data-filter="level"]');

          if (!sidebarBlockSelect || !sidebarFunctionSelect || !sidebarTechTypeSelect || !sidebarLevelSelect) {
            if (window.Logger) window.Logger.warn(`Попытка ${attempt + 1}: не все элементы DOM найдены`, {
              block: !!sidebarBlockSelect,
              function: !!sidebarFunctionSelect,
              techType: !!sidebarTechTypeSelect,
              level: !!sidebarLevelSelect
            });
            if (attempt < maxAttempts - 1) {
              initFiltersWithRetry(attempt + 1);
            }
            return;
          }

          // Заполняем фильтры sidebar принудительно
          if (blocksList.length > 0) {
            Filters.populateSelect('block', blocksList, 'Функциональные блоки: Все');
          }
          if (functions.length > 0) {
            Filters.populateSelect('function', functions, 'Функции: Все');
          }
          if (techTypes.length > 0) {
            Filters.populateSelect('techType', techTypes, 'Тип технологий: Все');
          }
          if (RINGS.length > 0) {
            Filters.populateSelect('level', RINGS, 'Статус: Все');
          }

          // Заполняем модальные фильтры
          const enterpriseData = getState('enterpriseData');
          const enterpriseList = Object.keys(enterpriseData || {});
          const modalSelects = [
            { id: 'techSector', items: sectorNames, placeholder: 'Выберите' },
            { id: 'techBlock', items: blocksList, placeholder: 'Выберите' },
            { id: 'techFunc', items: functions, placeholder: 'Выберите' },
            { id: 'techTechType', items: techTypes, placeholder: 'Выберите' },
            { id: 'techStatus', items: RINGS, placeholder: 'Выберите' },
            { id: 'techCompany', items: enterpriseList, placeholder: 'Выберите' },
            { id: 'editBlock', items: blocksList, placeholder: 'Выберите' },
            { id: 'editFunc', items: functions, placeholder: 'Выберите' },
            { id: 'editTechType', items: techTypes, placeholder: 'Выберите' },
            { id: 'editStatus', items: RINGS, placeholder: 'Выберите' },
            { id: 'editCompany', items: enterpriseList, placeholder: 'Выберите' }
          ];

          modalSelects.forEach(({ id, items, placeholder }) => {
            if (Array.isArray(items) && items.length > 0) {
              Filters.populateSelectForModal(id, items, placeholder);
            }
          });

          // Заполняем TRL фильтры
          const trlOptions = ['1 — Ранняя стадия (исследование)', '2 — Разработка (прототип)', '3 — Зрелость (готовность к внедрению)'];
          Filters.populateSelectForModal('techTrlStage', trlOptions, 'Выберите стадию');
          Filters.populateSelectForModal('editTrlStage', trlOptions, 'Выберите стадию');

          // Заполняем списки оценок готовности
          const ratingOptions = ['0 — Не готова', '1 — Низкая', '2 — Средняя', '3 — Высокая'];
          Filters.populateSelectForModal('techTechRead', ratingOptions, 'Выберите оценку');
          Filters.populateSelectForModal('techOrganRead', ratingOptions, 'Выберите оценку');
          Filters.populateSelectForModal('techFuncCover', ratingOptions, 'Выберите оценку');
          Filters.populateSelectForModal('editTechRead', ratingOptions, 'Выберите оценку');
          Filters.populateSelectForModal('editOrganRead', ratingOptions, 'Выберите оценку');
          Filters.populateSelectForModal('editFuncCover', ratingOptions, 'Выберите оценку');

          // Добавляем tooltips для TRL
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
          // Добавляем tooltips для оценок готовности
          const addRatingTooltips = (fieldId, tooltipMap) => {
            const ratingSelect = document.querySelector(`.custom-select-modal[data-field="${fieldId}"]`);
            if (ratingSelect) {
              const options = ratingSelect.querySelectorAll('.select-options li[data-value]');
              options.forEach(li => {
                const value = li.getAttribute('data-value');
                if (value && tooltipMap[value]) {
                  li.setAttribute('title', tooltipMap[value]);
                }
              });
            }
          };
          const techReadTooltips = {
            '0 — Не готова': 'Технология находится на начальной стадии, не применима',
            '1 — Низкая': 'Начальная стадия разработки, требуется значительная доработка',
            '2 — Средняя': 'Технология частично готова, требуется доработка',
            '3 — Высокая': 'Технология готова к применению'
          };
          const organReadTooltips = {
            '0 — Не готова': 'Организация не готова к внедрению',
            '1 — Низкая': 'Начальный этап подготовки, требуется значительная работа',
            '2 — Средняя': 'Частичная готовность, требуется дополнительная подготовка',
            '3 — Высокая': 'Организация полностью готова к внедрению'
          };
          const funcCoverTooltips = {
            '0 — Не готова': 'Функции не покрыты технологией',
            '1 — Низкая': 'Покрыта небольшая часть функций',
            '2 — Средняя': 'Покрыта значительная часть функций',
            '3 — Высокая': 'Покрыты все необходимые функции'
          };
          setTimeout(() => {
            addTrlTooltips('techTrlStage');
            addTrlTooltips('editTrlStage');
            addRatingTooltips('techTechRead', techReadTooltips);
            addRatingTooltips('techOrganRead', organReadTooltips);
            addRatingTooltips('techFuncCover', funcCoverTooltips);
            addRatingTooltips('editTechRead', techReadTooltips);
            addRatingTooltips('editOrganRead', organReadTooltips);
            addRatingTooltips('editFuncCover', funcCoverTooltips);
          }, 50);

        }, delay);
      };

      // Запускаем первую попытку
      initFiltersWithRetry(0);

      // Скрываем индикатор загрузки при успешной загрузке
      if (loaderId && typeof window !== 'undefined' && window.LoadingManager) {
        window.LoadingManager.hide(loaderId);
      }
    } catch (error) {
      console.error('Ошибка загрузки данных:', error);
      console.error('Стек ошибки:', error?.stack);

      // Скрываем индикатор загрузки при ошибке
      if (loaderId && typeof window !== 'undefined' && window.LoadingManager) {
        window.LoadingManager.hide(loaderId);
      }

      // Используем ErrorDisplay, если доступен
      const msg = error?.message || String(error) || 'Неизвестная ошибка';
      const detailedMsg = msg + '\n\nЕсли вы открываете страницу по протоколу file://, запустите локальный HTTP-сервер и откройте по http://localhost.';

      if (typeof window !== 'undefined' && window.ErrorDisplay) {
        window.ErrorDisplay.show(error, 'Загрузка данных приложения', () => {
          // Retry callback
          loadData();
        });
      } else {
        // Fallback на alert
        alert('Не удалось загрузить данные приложения. ' + detailedMsg);
      }
    }
  }

  // ===== ФУНКЦИЯ ДОБАВЛЕНИЯ НОВОЙ ТЕХНОЛОГИИ =====
  function ensureAndPersistNewTech(newTech) {
    try {
      if (!newTech) return;
      // Trim block and level
      if (newTech.block && typeof newTech.block === 'string') newTech.block = newTech.block.trim();
      if (newTech.level && typeof newTech.level === 'string') newTech.level = newTech.level.trim();
      if (!newTech.level) newTech.level = 'Существующие';
      // Ensure mapping exists
      const blockToQuadrant = getState('blockToQuadrant');
      const bk = (newTech.blocks && newTech.blocks.length) ? (typeof newTech.blocks[0] === 'string' ? newTech.blocks[0].trim() : newTech.blocks[0]) : (typeof newTech.block === 'string' ? newTech.block : newTech.block);
      newTech.block = bk;
      if (!blockToQuadrant.hasOwnProperty(bk) || blockToQuadrant[bk] == null) {
        blockToQuadrant[bk] = 1;
        // add to selects
        const sidebarOptionsList = document.querySelector('.custom-select[data-filter="block"] .select-options');
        if (sidebarOptionsList) {
          const Filters = getFilters();
          const li = typeof Filters.createCheckboxOptionLi === 'function'
            ? Filters.createCheckboxOptionLi(bk, bk)
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
            const escapedBk = window.escapeHtml ? window.escapeHtml(bk) : String(bk).replace(/[&<>"']/g, m => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[m]);
            li.innerHTML = `<label class="option-label"><input type="checkbox" class="option-checkbox" /><span>${escapedBk}</span></label>`;
            opts.appendChild(li);
          }
        });
        const blocksList = getState('blocksList');
        if (!blocksList.includes(bk)) {
          setState('blocksList', [...blocksList, bk]);
        }
        setState('blockToQuadrant', {...blockToQuadrant});
        try { vfsWrite('bloks.json', getState('blocksList')); vfsWrite('blockToQuadrant.json', blockToQuadrant); } catch (e) { if (window.Logger) window.Logger.warn('vfs write failed', e); }
      }
      // Ensure level mapping exists
      const levelToRing = window.levelToRing || {};
      if (!levelToRing || !Object.prototype.hasOwnProperty.call(levelToRing, newTech.level)) {
        // fallback to default
        newTech.level = newTech.level || 'Существующие';
        if (!levelToRing[newTech.level]) newTech.level = 'Существующие';
      }

      // Compute coordinates taking into account existing technologies (technologies may include newTech)
      if (window.Logger) window.Logger.debug('ensureAndPersistNewTech: computing coordinates for', { id: newTech.id, block: newTech.block, level: newTech.level });
      const Positioning = getPositioning();
      if (Positioning) {
        Positioning.computeCoordinates(newTech);
        if (window.Logger) window.Logger.debug('ensureAndPersistNewTech: coords computed', { id: newTech.id, x: newTech.x, y: newTech.y });
      }

      // Ensure technologies array contains the tech (if not, add it)
      const technologies = getState('technologies');
      const existsIdx = technologies.findIndex(t => t.id === newTech.id);
      if (existsIdx === -1) {
        technologies.push(newTech);
      } else {
        technologies[existsIdx] = Object.assign({}, technologies[existsIdx], newTech);
      }
      setState('technologies', [...technologies]);

      // Synchronize enterpriseData for current enterprise before persisting
      try {
        const enterpriseData = getState('enterpriseData');
        const currentEnterprise = getState('currentEnterprise');
        enterpriseData[currentEnterprise] = Array.isArray(enterpriseData[currentEnterprise]) ? [...getState('technologies')] : [...getState('technologies')];
        setState('enterpriseData', {...enterpriseData});
        vfsWrite('enterpriseData.json', enterpriseData);
        if (window.Logger) window.Logger.debug('ensureAndPersistNewTech: enterpriseData persisted for', currentEnterprise, 'total techs:', getState('technologies').length);
      } catch (e) { if (window.Logger) window.Logger.warn('persist enterpriseData failed', e); }
    } catch (err) { if (window.Logger) window.Logger.warn('ensureAndPersistNewTech error', err); }
  }

  // ===== ФУНКЦИЯ ПЕРЕКЛЮЧЕНИЯ ПРЕДПРИЯТИЯ =====
  function switchEnterprise(enterpriseName) {
    // Не показываем индикатор загрузки для быстрого переключения предприятий
    // чтобы избежать размытия фона и мигания интерфейса

    try {
      // --- Preserve detail panel + zoom state (if possible) ---
      const prevZoomedQuadrant = getState('currentZoomedQuadrant');
      const prevSelectedBlipId = getState('selectedBlipId');
      const prevCurrentTech = getState('currentTech');
      const prevTechId =
        (prevSelectedBlipId !== undefined && prevSelectedBlipId !== null)
          ? prevSelectedBlipId
          : (prevCurrentTech && prevCurrentTech.id != null ? prevCurrentTech.id : null);

      let detailPanelEl = null;
      try {
        detailPanelEl = document.getElementById('detailPanel');
      } catch (e) { /* ignore */ }
      const wasDetailPanelActive = !!(detailPanelEl && detailPanelEl.classList && detailPanelEl.classList.contains('active'));

      const enterpriseData = getState('enterpriseData');
      if (!enterpriseData[enterpriseName]) {
        console.error(`Данные для предприятия "${enterpriseName}" не найдены`);
        if (typeof window !== 'undefined' && window.ErrorDisplay) {
          window.ErrorDisplay.show(`Данные для предприятия "${enterpriseName}" не найдены`, 'Переключение предприятия');
        }
        return;
      }
      setState('currentEnterprise', enterpriseName);
      setState('technologies', [...enterpriseData[enterpriseName]]);
      // Инвалидируем кэш квадрантов при смене предприятия
      const quadrantsCache = getState('quadrantsCache');
      if (quadrantsCache && typeof quadrantsCache.clear === 'function') {
        quadrantsCache.clear();
      }
      const currentVersion = getState('quadrantsCacheVersion') || 0;
      setState('quadrantsCacheVersion', currentVersion + 1);
      // Пересобираем индекс
      const DataIndex = getDataIndex();
      if (DataIndex) {
        try { DataIndex.build(getState('technologies')); } catch (e) { if (window.Logger) window.Logger.warn('DataIndex.build failed', e); }
      }
      const technologies = getState('technologies');
      let nextId = technologies.length > 0 ? Math.max(...technologies.map((t) => t.id)) + 1 : 1;
      setState('nextId', nextId);

      // If detail panel was open, try to find the same technology in the next enterprise
      const nextTech =
        (prevTechId !== undefined && prevTechId !== null)
          ? (technologies.find(t => t && t.id == prevTechId) || null)
          : null;

      const shouldRefreshDetailPanel = wasDetailPanelActive && !!nextTech;
      const shouldPreserveZoom =
        shouldRefreshDetailPanel &&
        (prevZoomedQuadrant !== undefined && prevZoomedQuadrant !== null);

      // Keep/clear currentTech depending on whether we can refresh the panel
      setState('currentTech', shouldRefreshDetailPanel ? nextTech : null);
      // Keep/clear selectedBlipId so highlight can be restored
      try {
        const sm = getStateManager();
        sm.set('selectedBlipId', shouldRefreshDetailPanel ? (nextTech ? nextTech.id : null) : null);
      } catch (e) { /* ignore */ }

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
      const searchInput = document.getElementById('searchInput');
      if (searchInput) searchInput.value = "";
      document.querySelectorAll(".sector-item").forEach(i => i.classList.remove("active"));
      if (typeof window.updateRadar === 'function') {
        window.updateRadar();
      }

      // If we cannot keep zoom (or there is no matching technology), behave as before
      if (!shouldPreserveZoom) {
        if (typeof window.unzoom === 'function') {
          window.unzoom();
        }
      }

      // If detail panel was open:
      // - refresh it with the technology object from the new enterprise (so ratings update)
      // - preserve the zoomed sector when possible by forcing the same quadrant
      if (wasDetailPanelActive) {
        if (shouldRefreshDetailPanel && typeof window.showDetail === 'function') {
          const q = shouldPreserveZoom ? prevZoomedQuadrant : null;
          // Defer until after radar re-render
          setTimeout(() => {
            try {
              window.showDetail(nextTech, 'blip', q);
            } catch (e) {
              if (window.Logger) window.Logger.warn('switchEnterprise: failed to refresh detail panel', e);
            }
          }, 0);
        } else {
          // No matching technology in the new enterprise — close the panel to avoid stale data
          try {
            if (detailPanelEl && detailPanelEl.classList) {
              // Сбрасываем inline-стили, которые могли быть принудительно выставлены при показе панели
              detailPanelEl.style.removeProperty('visibility');
              detailPanelEl.style.removeProperty('opacity');
              detailPanelEl.style.removeProperty('transform');
              detailPanelEl.style.removeProperty('position');
              detailPanelEl.style.removeProperty('z-index');
              detailPanelEl.style.removeProperty('display');
              detailPanelEl.classList.remove('active');
              // По умолчанию панель скрыта через CSS, но подстрахуемся
              detailPanelEl.style.display = 'none';
            }
          } catch (e) { /* ignore */ }
        }
      }

      // Уведомление показывается в обработчике события enterpriseChanged,
      // чтобы не показывать его при программном переключении (например, при инициализации)
    } catch (error) {
      console.error('Ошибка переключения предприятия:', error);

      // Показываем ошибку
      if (typeof window !== 'undefined' && window.ErrorDisplay) {
        window.ErrorDisplay.show(error, 'Переключение предприятия');
      }
    }
  }

  // Функция для ручного заполнения фильтров (для отладки и повторной инициализации)
  function initFilters() {
    const Filters = getFilters();
    if (!Filters) {
      console.error('Filters не загружен, невозможно заполнить фильтры');
      return false;
    }

    const blocksList = getState('blocksList') || [];
    const functions = getState('functions') || [];
    const techTypes = window.techTypes || Object.keys(window.TECHTYPE_TO_SHAPE || {});
    const RINGS = window.RINGS || [];
    const QUADRANTS = window.QUADRANTS || [];

    // Получаем sectorNames
    const sectorsData = getState('sectors') || [];
    let sectorNames = [];
    if (Array.isArray(sectorsData) && sectorsData.length) {
      sectorNames = sectorsData.map(s => s && s.name).filter(Boolean);
    }
    if ((!Array.isArray(sectorNames) || sectorNames.length === 0) && Array.isArray(QUADRANTS) && QUADRANTS.length) {
      sectorNames = QUADRANTS.map(q => q && q.name).filter(Boolean);
    }

    // Заполняем sidebar фильтры
    if (blocksList.length > 0) {
      Filters.populateSelect('block', blocksList, 'Функциональные блоки: Все');
    }
    if (functions.length > 0) {
      Filters.populateSelect('function', functions, 'Функции: Все');
    }
    if (techTypes.length > 0) {
      Filters.populateSelect('techType', techTypes, 'Тип технологий: Все');
    }
    if (RINGS.length > 0) {
      Filters.populateSelect('level', RINGS, 'Статус: Все');
    }

    // Заполняем модальные фильтры
    const enterpriseData = getState('enterpriseData');
    const enterpriseList = Object.keys(enterpriseData || {});
    const trlOptions = ['1 — Ранняя стадия (исследование)', '2 — Разработка (прототип)', '3 — Зрелость (готовность к внедрению)'];

    const ratingOptions = ['0 — Не готова', '1 — Низкая', '2 — Средняя', '3 — Высокая'];
    const modalSelects = [
      { id: 'techSector', items: sectorNames, placeholder: 'Выберите' },
      { id: 'techBlock', items: blocksList, placeholder: 'Выберите' },
      { id: 'techFunc', items: functions, placeholder: 'Выберите' },
      { id: 'techTechType', items: techTypes, placeholder: 'Выберите' },
      { id: 'techStatus', items: RINGS, placeholder: 'Выберите' },
      { id: 'techCompany', items: enterpriseList, placeholder: 'Выберите' },
      { id: 'techTrlStage', items: trlOptions, placeholder: 'Выберите стадию' },
      { id: 'techTechRead', items: ratingOptions, placeholder: 'Выберите оценку' },
      { id: 'techOrganRead', items: ratingOptions, placeholder: 'Выберите оценку' },
      { id: 'techFuncCover', items: ratingOptions, placeholder: 'Выберите оценку' },
      { id: 'editBlock', items: blocksList, placeholder: 'Выберите' },
      { id: 'editFunc', items: functions, placeholder: 'Выберите' },
      { id: 'editTechType', items: techTypes, placeholder: 'Выберите' },
      { id: 'editStatus', items: RINGS, placeholder: 'Выберите' },
      { id: 'editCompany', items: enterpriseList, placeholder: 'Выберите' },
      { id: 'editTrlStage', items: trlOptions, placeholder: 'Выберите стадию' },
      { id: 'editTechRead', items: ratingOptions, placeholder: 'Выберите оценку' },
      { id: 'editOrganRead', items: ratingOptions, placeholder: 'Выберите оценку' },
      { id: 'editFuncCover', items: ratingOptions, placeholder: 'Выберите оценку' }
    ];

    modalSelects.forEach(({ id, items, placeholder }) => {
      if (Array.isArray(items) && items.length > 0) {
        Filters.populateSelectForModal(id, items, placeholder);
      }
    });

    return true;
  }

  // Экспорт функций в window для обратной совместимости
  window.DataLoader = {
    vfsRead,
    vfsWrite,
    fetchJsonWithCache,
    clearFetchCache,
    clearVfsCache,
    loadJsonPreferVfs,
    loadData,
    ensureAndPersistNewTech,
    switchEnterprise,
    showNotification,
    initFilters
  };

  // Экспорт функции initFilters для ручного вызова
  window.initFilters = initFilters;

  // Экспорт функций напрямую в window для обратной совместимости
  window.vfsRead = vfsRead;
  window.vfsWrite = vfsWrite;
  window.fetchJsonWithCache = fetchJsonWithCache;
  window.clearFetchCache = clearFetchCache;
  window.clearVfsCache = clearVfsCache;
  window.loadJsonPreferVfs = loadJsonPreferVfs;
  window.loadData = loadData;
  window.ensureAndPersistNewTech = ensureAndPersistNewTech;
  window.switchEnterprise = switchEnterprise;
  window.showNotification = showNotification;

})();
