// Модуль загрузки данных
// Экспортирует функции в window.DataLoader для использования в RMK2.js
// Использует глобальные переменные из RMK2.js и функции из других модулей

(function () {
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
  async function loadJsonPreferVfs(filename, forceReload = false) {
    // Если forceReload = true, очищаем кэш для этого файла перед загрузкой
    if (forceReload) {
      const paths = [`/src/data/ru/${filename}`, `/src/data/${filename}`];
      paths.forEach(p => fetchCache.delete(p));
    }

    // Всегда пытаемся сначала загрузить из data/ru
    const paths = [`/src/data/ru/${filename}`, `/src/data/${filename}`];
    for (const p of paths) {
      try {
        // Если forceReload, используем fetch напрямую без кэша
        let json;
        if (forceReload) {
          const response = await fetch(p, { cache: 'no-store' });
          if (!response || !response.ok) {
            throw new Error(`HTTP ${response ? response.status : 'no response'}`);
          }
          json = await response.json();
        } else {
          json = await fetchJsonWithCache(p, { ttl: FETCH_CACHE_TTL_MS, timeout: DEFAULT_FETCH_TIMEOUT_MS });
        }
        if (json) {
          if (window.Logger) window.Logger.debug(`Загружены данные из файла ${p}:`, json);
          // Обновляем кэш даже при forceReload, чтобы последующие запросы использовали свежие данные
          if (forceReload) {
            fetchCache.set(p, { data: json, expiresAt: Date.now() + FETCH_CACHE_TTL_MS });
          }
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
    const escapedMessage = window.escapeHtml ? window.escapeHtml(message) : String(message).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]);
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

      // Load blocks list (prefer VFS, но принудительно перезагружаем с диска)
      const b1 = await loadJsonPreferVfs('bloks.json', true); // forceReload = true
      let blocks = b1.data;
      if (!blocks) {
        const alt = await loadJsonPreferVfs('blocks.json', true); // forceReload = true
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
        'functionToBlock.json',
        'technologies.json',
        'blockToQuadrant.json',
        'digitalDirections.json',
        'directionToQuadrant.json',
        'vendors.json',
        'integrators.json',
        'enterprises.json',
      ];

      // Принудительно перезагружаем данные с диска, игнорируя кэш
      // Это гарантирует, что изменения в JSON файлах будут видны сразу после обновления страницы
      const fetched = {};
      for (const fn of fileNames) {
        fetched[fn] = await loadJsonPreferVfs(fn, true); // forceReload = true
      }

      // Соберём список отсутствующих/непреобразованных файлов
      const missing = [];
      if (!blocks) missing.push('bloks.json|blocks.json');
      // technologies.json - опциональный файл, не добавляем в missing если его нет
      const optionalFiles = ['technologies.json'];
      for (const fn of fileNames) {
        // Пропускаем опциональные файлы
        if (optionalFiles.includes(fn)) continue;
        if (!fetched[fn].data) missing.push(fn);
      }

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
      // techTypes - используем значения по умолчанию из window.TECHTYPE_TO_SHAPE
      window.techTypes = Object.keys(window.TECHTYPE_TO_SHAPE || {});
      // statusList - используем значения по умолчанию
      const statusList = ["Используемые", "Внедряемые", "Перспективные"];
      // sector.json больше не используется - квадранты генерируются из направлений
      setState('functionToBlockMap', ensureObject('functionToBlock.json', fetched['functionToBlock.json'].data));
      if (validationErrors.length) {
        if (window.Logger) window.Logger.warn('Валидация данных: обнаружены проблемы', validationErrors);
        showNotification(`Проверка данных: ${validationErrors.join('; ')}`, false);
      }
      setState('blockToQuadrant', fetched['blockToQuadrant.json'].data || {});
      // Загружаем направления цифрового развития
      const digitalDirections = ensureArray('digitalDirections.json', fetched['digitalDirections.json'].data);
      setState('digitalDirections', digitalDirections);
      // Экспортируем в window для использования в positioning.js и других модулях
      window.digitalDirections = digitalDirections;
      // Загружаем маппинг направлений на квадранты
      const directionToQuadrant = ensureObject('directionToQuadrant.json', fetched['directionToQuadrant.json'].data);
      setState('directionToQuadrant', directionToQuadrant);
      // Экспортируем в window для использования в positioning.js и других модулях
      window.directionToQuadrant = directionToQuadrant;
      // Сохраняем список вендоров
      const vendorsList = ensureArray('vendors.json', fetched['vendors.json'].data);
      setState('vendorsList', vendorsList);
      // Сохраняем список интеграторов
      const integratorsList = ensureArray('integrators.json', fetched['integrators.json'].data);
      setState('integratorsList', integratorsList);
      // Инвалидируем кэш квадрантов при изменении данных
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
      // Генерируем QUADRANTS из направлений цифрового развития
      // Если направления загружены, используем их; иначе fallback на сектора или дефолтные значения
      let QUADRANTS = [];
      if (Array.isArray(digitalDirections) && digitalDirections.length > 0) {
        // Сортируем направления по id и создаем квадранты
        const sortedDirections = digitalDirections.slice().sort((a, b) => {
          const aId = (a && typeof a === 'object' && a.id) ? a.id : 0;
          const bId = (b && typeof b === 'object' && b.id) ? b.id : 0;
          return aId - bId;
        });
        QUADRANTS = sortedDirections.map(dir => {
          const id = (dir && typeof dir === 'object' && dir.id) ? dir.id : 0;
          const name = (dir && typeof dir === 'object' && dir.name) ? dir.name : `Направление ${id}`;
          const startAngle = (id - 1) * 90;
          return { id, name, startAngle };
        });
      } else {
        // Дефолтные квадранты (старые названия для обратной совместимости)
        QUADRANTS = [
          { id: 1, name: "Корпоративное управление и администрация", startAngle: 0 },
          { id: 2, name: "Основное производство", startAngle: 90 },
          { id: 3, name: "Производственная поддержка и безопасность", startAngle: 180 },
          { id: 4, name: "Внешние бизнесы", startAngle: 270 },
        ];
      }
      window.QUADRANTS = QUADRANTS;

      // Загружаем список предприятий из enterprises.json
      let enterprisesList = [];
      const enterprisesData = fetched['enterprises.json']?.data || [];
      if (Array.isArray(enterprisesData)) {
        enterprisesList = enterprisesData.map(ent => ent.name || ent).filter(Boolean);
      }
      setState('enterprisesList', enterprisesData);

      // Функция преобразования технологии из нового формата в формат приложения
      function normalizeTechnologyFromNewFormat(tech, blockIdToName, enterprisesData) {
        // Преобразуем block ID в имя
        const blockId = typeof tech.block === 'number' ? tech.block : null;
        const blockName = blockId && blockIdToName[blockId] ? blockIdToName[blockId] : (typeof tech.block === 'string' ? tech.block : '');

        // Преобразуем enterprises в company и companyRatings
        const companies = [];
        const companyRatings = {};

        if (Array.isArray(tech.enterprises) && tech.enterprises.length > 0) {
          tech.enterprises.forEach(ent => {
            const enterpriseId = ent.enterpriseId;
            // Находим предприятие по ID в полном списке предприятий
            const enterprise = Array.isArray(enterprisesData)
              ? enterprisesData.find(e => (typeof e === 'object' && e.id) ? e.id === enterpriseId : false)
              : null;
            const companyName = enterprise
              ? (typeof enterprise === 'object' ? enterprise.name : enterprise)
              : (enterprisesData[enterpriseId - 1]
                ? (typeof enterprisesData[enterpriseId - 1] === 'object' ? enterprisesData[enterpriseId - 1].name : enterprisesData[enterpriseId - 1])
                : `Предприятие ${enterpriseId}`);

            if (companyName) {
              companies.push(companyName);
              // Нормализуем значения готовности из диапазона 1-9 в диапазон 0-3
              // Формула: если значение <= 3, оставляем как есть, иначе нормализуем
              const normalizeReadiness = (value) => {
                if (value == null || value === undefined) return null;
                const num = Number(value);
                if (Number.isNaN(num)) return null;
                // Если значение уже в диапазоне 0-3, возвращаем как есть
                if (num >= 0 && num <= 3) return num;
                // Если значение в диапазоне 1-9, нормализуем: (value - 1) / 8 * 3
                if (num >= 1 && num <= 9) {
                  return Math.round(((num - 1) / 8) * 3);
                }
                // Иначе ограничиваем диапазоном 0-3
                return Math.max(0, Math.min(3, num));
              };

              // Сохраняем индивидуальные рейтинги для предприятия
              // Если оценки не указаны (undefined/null), сохраняем null явно
              const techReadValue = ent.technologicalReadiness !== undefined
                ? normalizeReadiness(ent.technologicalReadiness)
                : null;
              const organReadValue = ent.organizationalReadiness !== undefined
                ? normalizeReadiness(ent.organizationalReadiness)
                : null;

              companyRatings[companyName] = {
                techRead: techReadValue,
                organRead: organReadValue,
                isImplemented: ent.status === 'Внедрена'
              };
            }
          });
        }

        // Если у технологии одно предприятие, устанавливаем общие techRead и organRead
        // из первого предприятия для обратной совместимости
        let techRead = null;
        let organRead = null;
        if (companies.length === 1 && Object.keys(companyRatings).length > 0) {
          const firstCompanyName = companies[0];
          const firstCompanyRatings = companyRatings[firstCompanyName];
          if (firstCompanyRatings) {
            techRead = firstCompanyRatings.techRead;
            organRead = firstCompanyRatings.organRead;
          }
        } else if (tech.enterprises && tech.enterprises.length > 0) {
          // Если нет companyRatings, но есть enterprises, берем из первого
          const normalizeReadiness = (value) => {
            if (value == null || value === undefined) return null;
            const num = Number(value);
            if (Number.isNaN(num)) return null;
            if (num >= 0 && num <= 3) return num;
            if (num >= 1 && num <= 9) {
              return Math.round(((num - 1) / 8) * 3);
            }
            return Math.max(0, Math.min(3, num));
          };
          const firstEnt = tech.enterprises[0];
          techRead = normalizeReadiness(firstEnt.technologicalReadiness);
          organRead = normalizeReadiness(firstEnt.organizationalReadiness);
        }

        // Преобразуем functionCoverage (массив) в funcCover (число 0-3)
        // Используем новую логику с учетом процентного покрытия блока
        let funcCover = null;

        // Определяем блоки технологии
        const techBlockIds = tech.block
          ? (typeof tech.block === 'number' ? [tech.block] : [])
          : [];

        // ВАЖНО: funcCover будет рассчитан асинхронно позже
        // Для начальной загрузки используем старую логику как fallback
        if (Array.isArray(tech.functionCoverage) && tech.functionCoverage.length > 0) {
          const funcCount = tech.functionCoverage.length;
          if (funcCount === 1) {
            funcCover = 1;
          } else if (funcCount >= 2 && funcCount <= 3) {
            funcCover = 2;
          } else if (funcCount >= 4) {
            funcCover = 3;
          }

          // Асинхронно пересчитываем funcCover с учетом блоков
          // Это обновит значение после загрузки данных
          if (window.FuncCoverUtils && typeof window.FuncCoverUtils.calculateFuncCover === 'function') {
            window.FuncCoverUtils.calculateFuncCover(tech.functionCoverage, techBlockIds)
              .then(calculatedFuncCover => {
                // Обновляем значение в уже созданном объекте
                if (normalized && normalized.id === tech.id) {
                  normalized.funcCover = calculatedFuncCover;
                  console.log(`[DataLoader] Обновлен funcCover для технологии ${tech.id}: ${calculatedFuncCover}`);
                }
              })
              .catch(err => {
                console.error('[DataLoader] Ошибка расчета funcCover:', err);
              });
          }
        }

        // Преобразуем documentationFiles в files
        const files = Array.isArray(tech.documentationFiles)
          ? tech.documentationFiles.map(path => ({ path, name: path.split('/').pop() }))
          : [];

        // Создаем нормализованный объект технологии
        const normalized = {
          id: tech.id,
          name: tech.name || '',
          description: tech.description || '',
          exampleDesc: tech.marketExamples ? (Array.isArray(tech.marketExamples) ? tech.marketExamples.join('\n') : tech.marketExamples) : '',
          block: blockName,
          blocks: blockName ? [blockName] : [],
          func: tech.function || '',
          functions: Array.isArray(tech.functionCoverage) && tech.functionCoverage.length > 0
            ? tech.functionCoverage
            : (tech.function ? [tech.function] : []),
          directions: Array.isArray(tech.directions) ? tech.directions : [],
          direction: Array.isArray(tech.directions) && tech.directions.length > 0 ? tech.directions[0] : '',
          company: companies.length > 0 ? (companies.length === 1 ? companies[0] : companies) : [],
          companyRatings: Object.keys(companyRatings).length > 0 ? companyRatings : undefined,
          techRead: techRead,
          organRead: organRead,
          funcCover: funcCover,
          // Нормализуем TRL из диапазона 1-9 в диапазон 1-3 по стандартной шкале TRL:
          // Если значение уже в диапазоне 1-3, оставляем как есть
          // TRL 1-3 → 1-3 (оставляем без изменений), TRL 4-6 → 2 (Прототип), TRL 7-9 → 3 (Готова к внедрению)
          trlStage: tech.trlStage != null ? (() => {
            const trl = Number(tech.trlStage);
            if (Number.isNaN(trl)) return null;
            // Если значение уже в диапазоне 1-3, оставляем как есть
            if (trl >= 1 && trl <= 3) return trl;
            // Если значение в диапазоне 4-9, преобразуем в диапазон 1-3
            if (trl >= 4 && trl <= 6) return 2;
            if (trl >= 7 && trl <= 9) return 3;
            // Для других значений ограничиваем диапазоном 1-3
            return Math.max(1, Math.min(3, trl));
          })() : null,
          // Преобразуем статус в формат, ожидаемый приложением
          // "Внедрена" -> "Используемые", "Невнедренна" -> зависит от TRL
          status: tech.status || '',
          level: (() => {
            if (tech.status === 'Внедрена') {
              return 'Используемые';
            } else if (tech.status === 'Невнедренна') {
              // Для невнедренных технологий определяем уровень по TRL
              const trl = tech.trlStage != null ? Number(tech.trlStage) : null;
              if (trl != null && !Number.isNaN(trl)) {
                if (trl >= 7 && trl <= 9) {
                  return 'Внедряемые'; // Готова к внедрению
                } else {
                  return 'Перспективные'; // Еще в разработке
                }
              } else {
                return 'Перспективные'; // По умолчанию
              }
            } else {
              return tech.status || 'Перспективные';
            }
          })(),
          vendors: Array.isArray(tech.vendors) ? tech.vendors : [],
          integrators: Array.isArray(tech.integrators) ? tech.integrators : [],
          files: files,
          techType: '',
          // Сохраняем оригинальные данные для обратной совместимости
          technologicalReadiness: tech.enterprises && tech.enterprises.length > 0 ? tech.enterprises[0].technologicalReadiness : null,
          organizationalReadiness: tech.enterprises && tech.enterprises.length > 0 ? tech.enterprises[0].organizationalReadiness : null
        };

        return normalized;
      }

      // Загружаем технологии из technologies.json
      // Сначала проверяем VFS (localStorage) - если там есть сохраненные технологии, используем их
      let allTechnologies = [];
      const enterpriseData = {};
      let technologiesFromVfs = null;

      // Проверяем VFS на наличие сохраненных технологий
      try {
        technologiesFromVfs = vfsRead('technologies.json');
        if (technologiesFromVfs && Array.isArray(technologiesFromVfs) && technologiesFromVfs.length > 0) {
          if (window.Logger) window.Logger.debug('loadData: Загружены технологии из VFS (localStorage)', technologiesFromVfs.length);
          // Используем технологии из VFS напрямую (они уже в нормализованном формате)
          allTechnologies = technologiesFromVfs;

          // Восстанавливаем структуру enterpriseData из VFS или создаем заново
          const enterpriseDataFromVfs = vfsRead('enterpriseData.json');
          if (enterpriseDataFromVfs && typeof enterpriseDataFromVfs === 'object') {
            Object.assign(enterpriseData, enterpriseDataFromVfs);
          } else {
            // Если enterpriseData нет в VFS, создаем из технологий
            allTechnologies.forEach(tech => {
              const companies = Array.isArray(tech.company) ? tech.company : (tech.company ? [tech.company] : []);
              companies.forEach(company => {
                if (!enterpriseData[company]) enterpriseData[company] = [];
                enterpriseData[company].push(tech);
              });
            });
          }
        }
      } catch (e) {
        if (window.Logger) window.Logger.warn('Ошибка при загрузке технологий из VFS', e);
      }

      // Если в VFS нет технологий, загружаем из файла
      if (!technologiesFromVfs && fetched['technologies.json'] && Array.isArray(fetched['technologies.json'].data)) {
        if (window.Logger) window.Logger.debug('loadData: Загружаем технологии из файла technologies.json');
        fetched['technologies.json'].data.forEach(tech => {
          const normalized = normalizeTechnologyFromNewFormat(tech, blockIdToName, enterprisesData);
          allTechnologies.push(normalized);

          // Добавляем в структуру по предприятиям для обратной совместимости
          const companies = Array.isArray(normalized.company) ? normalized.company : (normalized.company ? [normalized.company] : []);
          companies.forEach(company => {
            if (!enterpriseData[company]) enterpriseData[company] = [];
            enterpriseData[company].push(normalized);
          });
        });
      }

      // Сохраняем объединенный массив технологий
      if (allTechnologies.length > 0) {
        setState('technologies', allTechnologies);
        // Сохраняем структуру по предприятиям для обратной совместимости
        setState('enterpriseData', enterpriseData);

        // Извлекаем список предприятий из загруженных технологий
        const enterpriseSet = new Set();
        allTechnologies.forEach(tech => {
          const companies = Array.isArray(tech.company) ? tech.company : (tech.company ? [tech.company] : []);
          companies.forEach(company => {
            if (company) enterpriseSet.add(company);
          });
        });
        const enterpriseList = enterprisesList.length > 0
          ? enterprisesList
          : Array.from(enterpriseSet).sort();
        setState('enterpriseList', enterpriseList);

        // Инициализируем индекс с загруженными данными
        const DataIndex = getDataIndex();
        if (DataIndex) {
          try {
            DataIndex.build(allTechnologies);
          } catch (e) {
            if (window.Logger) window.Logger.warn('DataIndex.build failed after loading technologies.json', e);
          }
        }
      }

      // Заполнение фильтров - отложим до полной готовности DOM
      // Фильтры будут заполнены в функции initFiltersWithRetry ниже

      // Модальные окна
      // Список секторов: используем названия квадрантов из направлений
      let sectorNames = [];
      if (Array.isArray(QUADRANTS) && QUADRANTS.length) {
        sectorNames = QUADRANTS.map(q => q && q.name).filter(Boolean);
      }
      // Объявляем trlOptions и addTrlTooltips ПЕРЕД использованием, чтобы они были доступны всегда
      const trlOptions = ['1-Исследовательская', '2-Прототип', '3-Технология готова к внедрению'];
      const addTrlTooltips = (fieldId) => {
        const trlSelect = document.querySelector(`.custom-select-modal[data-field="${fieldId}"]`);
        if (trlSelect) {
          const options = trlSelect.querySelectorAll('.select-options li[data-value]');
          const tooltips = {
            '1-Исследовательская': 'Ранняя исследовательская стадия: технология находится на начальном этапе разработки, концепция только формируется',
            '2-Прототип': 'Стадия разработки и прототипирования: технология проходит активную разработку, создаются прототипы',
            '3-Технология готова к внедрению': 'Зрелая стадия: технология готова к внедрению и использованию в производстве'
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
        const enterprisesListData = getState('enterprisesList') || [];
        const enterpriseListForModal = enterprisesListData.length > 0
          ? enterprisesListData.map(ent => typeof ent === 'string' ? ent : (ent.name || ent))
          : Object.keys(enterpriseData || {});
        // Поле techSector удалено из форм
        // Получаем список направлений цифрового развития
        const digitalDirections = getState('digitalDirections') || [];
        const directionsList = Array.isArray(digitalDirections) && digitalDirections.length > 0
          ? digitalDirections.map(d => (d && typeof d === 'object' && d.name) ? d.name : String(d || '')).filter(Boolean)
          : [];
        if (directionsList.length > 0) {
          Filters.populateSelectForModal('techDirections', directionsList, 'Выберите');
          Filters.populateSelectForModal('editDirections', directionsList, 'Выберите');
        }
        Filters.populateSelectForModal('techBlock', blocksList, 'Выберите');
        Filters.populateSelectForModal('techFunc', functions, 'Выберите');
        // Поля "Тип технологии" и "Статус" удалены из формы добавления
        // Заполняем список предприятий
        Filters.populateSelectForModal('techCompany', enterpriseListForModal, 'Выберите');
        // Заполняем список TRL с подсказками (объявляем один раз для обеих форм)
        Filters.populateSelectForModal('techTrlStage', trlOptions, 'Выберите стадию');
        // Заполняем списки оценок готовности
        Filters.populateSelectForModal('techTechRead', ratingOptions, 'Выберите оценку');
        Filters.populateSelectForModal('techOrganRead', ratingOptions, 'Выберите оценку');
        Filters.populateSelectForModal('techFuncCover', ratingOptions, 'Выберите оценку');
      } else {
        console.error('Filters не загружен, модальные фильтры не будут заполнены');
      }
      // Инициализируем селект вендоров с возможностью добавления новых (вне блока Filters)
      // Вызываем с небольшой задержкой, чтобы убедиться, что DOM готов
      setTimeout(() => {
        if (typeof window.initVendorsSelect === 'function') {
          window.initVendorsSelect();
        } else if (typeof initVendorsSelect === 'function') {
          initVendorsSelect();
        }
      }, 200);
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
        addTechForm.onsubmit = function (e) {
          e.preventDefault();
          const formData = new FormData(this);

          // Поля "Тип технологии" и "Статус" удалены из формы добавления
          // Используем значения по умолчанию
          const selectedStatus = (Array.isArray(RINGS) && RINGS.length ? RINGS[0] : 'Используемые');

          const nextId = getState('nextId') || 1;

          // Получаем directions из скрытого поля
          let directions = [];
          try {
            const directionsValue = formData.get('techDirections');
            if (directionsValue) {
              directions = JSON.parse(directionsValue);
              if (!Array.isArray(directions)) {
                directions = [directions];
              }
            }
          } catch (e) {
            console.warn('Ошибка парсинга directions:', e);
          }

          const tech = {
            id: nextId,
            name: formData.get('techName'),
            directions: directions,
            block: parseInt(formData.get('techBlock'), 10),
            blocks: [parseInt(formData.get('techBlock'), 10)],
            functions: [formData.get('techFunc')],
            functionCoverage: [formData.get('techFunc')],
            techType: '', // Поле удалено из формы
            // Явно сохраняем и status, и level, чтобы фильтры и приоритеты
            // всегда использовали одну и ту же строку статуса.
            status: selectedStatus,
            level: selectedStatus,
            trlStage: formData.get('techTrlStage'),
            funcCover: parseInt(formData.get('techFuncCover'), 10) || 0,
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
          // Обновляем enterpriseData для обратной совместимости
          const enterpriseData = getState('enterpriseData');
          const currentEnterprise = getState('currentEnterprise');
          if (enterpriseData && currentEnterprise) {
            enterpriseData[currentEnterprise] = [...getState('technologies')];
            setState('enterpriseData', { ...enterpriseData });
          }

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
        editTechForm.onsubmit = function (e) {
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

          // Получаем directions из скрытого поля
          let directions = currentTech.directions || [];
          try {
            const directionsValue = formData.get('editDirections');
            if (directionsValue) {
              directions = JSON.parse(directionsValue);
              if (!Array.isArray(directions)) {
                directions = [directions];
              }
            }
          } catch (e) {
            console.warn('Ошибка парсинга directions:', e);
          }

          const updatedTech = {
            ...currentTech,
            name: formData.get('editName'),
            directions: directions,
            block: parseInt(formData.get('editBlock'), 10),
            blocks: [parseInt(formData.get('editBlock'), 10)],
            functions: [formData.get('editFunc')],
            functionCoverage: [formData.get('editFunc')],
            techType: formData.get('editTechType') || currentTech.techType || '',
            status: selectedStatus,
            level: selectedStatus,
            trlStage: formData.get('editTrlStage') || currentTech.trlStage,
            funcCover: parseInt(formData.get('editFuncCover'), 10) || currentTech.funcCover || 0,
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
            // Обновляем enterpriseData для обратной совместимости
            const enterpriseData = getState('enterpriseData');
            const currentEnterprise = getState('currentEnterprise');
            if (enterpriseData && currentEnterprise) {
              enterpriseData[currentEnterprise] = [...getState('technologies')];
              setState('enterpriseData', { ...enterpriseData });
            }

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

      // Вычисляем nextId на основе загруженных технологий
      const allTechs = getState('technologies') || [];
      if (allTechs.length > 0) {
        const maxId = Math.max(...allTechs.map(t => Number(t.id) || 0));
        setState('nextId', maxId + 1);
      } else {
        setState('nextId', 1);
      }
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


          // Получаем sectorNames для модальных фильтров из QUADRANTS
          let sectorNames = [];
          if (Array.isArray(QUADRANTS) && QUADRANTS.length) {
            sectorNames = QUADRANTS.map(q => q && q.name).filter(Boolean);
          }

          // Получаем список предприятий для фильтра
          const enterpriseData = getState('enterpriseData') || {};
          const enterprisesListData = getState('enterprisesList') || [];
          const enterpriseList = enterprisesListData.length > 0
            ? enterprisesListData.map(ent => typeof ent === 'string' ? ent : (ent.name || ent)).filter(Boolean)
            : Object.keys(enterpriseData).filter(Boolean);

          // Проверяем наличие элементов DOM
          const sidebarEnterpriseSelect = document.querySelector('.custom-select[data-filter="enterprise"]');
          const sidebarBlockSelect = document.querySelector('.custom-select[data-filter="block"]');
          const sidebarFunctionSelect = document.querySelector('.custom-select[data-filter="function"]');
          // Фильтр "Тип технологий" удален из боковой панели
          const sidebarLevelSelect = document.querySelector('.custom-select[data-filter="level"]');

          if (!sidebarEnterpriseSelect || !sidebarBlockSelect || !sidebarFunctionSelect || !sidebarLevelSelect) {
            if (window.Logger) window.Logger.warn(`Попытка ${attempt + 1}: не все элементы DOM найдены`, {
              enterprise: !!sidebarEnterpriseSelect,
              block: !!sidebarBlockSelect,
              function: !!sidebarFunctionSelect,
              level: !!sidebarLevelSelect
            });
            if (attempt < maxAttempts - 1) {
              initFiltersWithRetry(attempt + 1);
            }
            return;
          }

          // Заполняем фильтры sidebar принудительно
          if (enterpriseList.length > 0) {
            Filters.populateSelect('enterprise', enterpriseList, 'Предприятия: Все');
          }
          if (blocksList.length > 0) {
            Filters.populateSelect('block', blocksList, 'Функциональные блоки: Все');
          }
          if (functions.length > 0) {
            Filters.populateSelect('function', functions, 'Функции: Все');
          }
          // Фильтр "Тип технологий" удален из боковой панели
          // Заменяем значения фильтра "Статус" на "Внедренная/Невнедренная"
          const statusOptions = ['Внедренная', 'Невнедренная'];
          if (statusOptions.length > 0) {
            Filters.populateSelect('level', statusOptions, 'Статус: Все');
          }

          // Заполняем модальные фильтры
          // enterpriseData уже объявлена выше
          const modalEnterpriseList = enterprisesListData.length > 0
            ? enterprisesListData.map(ent => typeof ent === 'string' ? ent : (ent.name || ent))
            : Object.keys(enterpriseData || {});
          const vendorsList = getState('vendorsList') || [];
          const integratorsList = getState('integratorsList') || [];
          const modalSelects = [
            // Поля techSector, techIntegrators удалены из форм
            { id: 'techBlock', items: blocksList, placeholder: 'Выберите' },
            { id: 'techFunc', items: functions, placeholder: 'Выберите' },
            // Поля "Тип технологии" и "Статус" удалены из формы добавления
            { id: 'techCompany', items: modalEnterpriseList, placeholder: 'Выберите' },
            { id: 'techVendors', items: vendorsList, placeholder: 'Выберите' },
            { id: 'editBlock', items: blocksList, placeholder: 'Выберите' },
            { id: 'editFunc', items: functions, placeholder: 'Выберите' },
            // Поля editTechType, editStatus, editIntegrators удалены из форм
            { id: 'editCompany', items: modalEnterpriseList, placeholder: 'Выберите' },
            { id: 'editVendors', items: vendorsList, placeholder: 'Выберите' }
          ];

          modalSelects.forEach(({ id, items, placeholder }) => {
            if (Array.isArray(items) && items.length > 0) {
              Filters.populateSelectForModal(id, items, placeholder);
            }
          });

          // Заполняем TRL фильтры
          const trlOptions = ['1-Исследовательская', '2-Прототип', '3-Технология готова к внедрению'];
          Filters.populateSelectForModal('techTrlStage', trlOptions, 'Выберите стадию');
          Filters.populateSelectForModal('editTrlStage', trlOptions, 'Выберите стадию');

          // Заполняем списки оценок готовности
          const ratingOptions = ['0 — Не готова', '1 — Низкая', '2 — Средняя', '3 — Высокая'];
          // Поля techTechRead, techOrganRead удалены из формы добавления
          Filters.populateSelectForModal('techFuncCover', ratingOptions, 'Выберите оценку');
          // Поля editTechRead, editOrganRead удалены из формы редактирования
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

      // Пересчитываем funcCover для всех технологий с использованием нового алгоритма
      // Это делается синхронно перед первым рендерингом, чтобы избежать изменения позиций
      const technologiesForRecalc = getState('technologies');
      if (technologiesForRecalc && technologiesForRecalc.length > 0) {
        // Пересчитываем funcCover синхронно (await)
        await recalculateFuncCoverForAllTechnologies(technologiesForRecalc);

        console.log('[DataLoader] Пересчет funcCover завершен успешно');

        // Пересчитываем координаты для всех технологий после обновления funcCover
        // Это необходимо, так как funcCover влияет на позиционирование
        const Positioning = getPositioning();
        if (Positioning && typeof Positioning.computeCoordinates === 'function') {
          technologiesForRecalc.forEach(tech => {
            Positioning.computeCoordinates(tech);
          });
          console.log('[DataLoader] Координаты пересчитаны для всех технологий после обновления funcCover');
        }

        // После пересчета обновляем state
        setState('technologies', [...technologiesForRecalc]);
        // Обновляем индекс после пересчета
        const DataIndex = getDataIndex();
        if (DataIndex) {
          try {
            DataIndex.build(technologiesForRecalc);
          } catch (e) {
            if (window.Logger) window.Logger.warn('DataIndex.build failed after recalculating funcCover', e);
          }
        }
      }

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
            const escapedBk = window.escapeHtml ? window.escapeHtml(bk) : String(bk).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]);
            li.innerHTML = `<label class="option-label"><input type="checkbox" class="option-checkbox" /><span>${escapedBk}</span></label>`;
            opts.appendChild(li);
          }
        });
        const blocksList = getState('blocksList');
        if (!blocksList.includes(bk)) {
          setState('blocksList', [...blocksList, bk]);
        }
        setState('blockToQuadrant', { ...blockToQuadrant });
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

      // Сохраняем technologies в VFS (localStorage) для сохранения между перезагрузками
      try {
        vfsWrite('technologies.json', technologies);
        if (window.Logger) window.Logger.debug('ensureAndPersistNewTech: technologies saved to VFS', technologies.length);
      } catch (e) {
        if (window.Logger) window.Logger.warn('vfs write technologies.json failed', e);
      }

      // Обновляем enterpriseData для обратной совместимости
      try {
        const enterpriseData = getState('enterpriseData');
        const currentEnterprise = getState('currentEnterprise');
        if (enterpriseData && currentEnterprise) {
          enterpriseData[currentEnterprise] = [...getState('technologies')];
          setState('enterpriseData', { ...enterpriseData });
          // Сохраняем enterpriseData в VFS
          vfsWrite('enterpriseData.json', enterpriseData);
          if (window.Logger) window.Logger.debug('ensureAndPersistNewTech: enterpriseData updated for', currentEnterprise, 'total techs:', getState('technologies').length);
        }
      } catch (e) { if (window.Logger) window.Logger.warn('update enterpriseData failed', e); }
    } catch (err) { if (window.Logger) window.Logger.warn('ensureAndPersistNewTech error', err); }
  }

  // ===== ФУНКЦИЯ ПЕРЕКЛЮЧЕНИЯ ПРЕДПРИЯТИЯ (упрощенная версия - только обновляет фильтр) =====
  function switchEnterprise(enterpriseName) {
    // Теперь все технологии объединены в один массив, поэтому просто обновляем фильтр предприятий
    try {
      setState('currentEnterprise', enterpriseName);

      // Сохраняем технологии в VFS при переключении предприятий для надежности
      try {
        const technologies = getState('technologies');
        if (technologies && Array.isArray(technologies)) {
          vfsWrite('technologies.json', technologies);
          const enterpriseData = getState('enterpriseData');
          if (enterpriseData) {
            vfsWrite('enterpriseData.json', enterpriseData);
          }
        }
      } catch (e) {
        if (window.Logger) window.Logger.warn('Не удалось сохранить technologies при переключении предприятия', e);
      }

      // Обновляем фильтр предприятий
      const Filters = getFilters();
      if (Filters && enterpriseName) {
        const enterpriseSelect = document.querySelector('.custom-select[data-filter="enterprise"]');
        if (enterpriseSelect) {
          // Устанавливаем выбранное предприятие в фильтре
          const hiddenInput = document.getElementById('filter_enterprise');
          if (hiddenInput) {
            hiddenInput.value = JSON.stringify([enterpriseName]);
            // Обновляем визуальное отображение
            Filters.renderMultiSelectTags(enterpriseSelect);
          }
        }
      }

      // Обновляем радар с учетом фильтра
      if (typeof window.updateRadar === 'function') {
        window.updateRadar();
      }
    } catch (error) {
      console.error('Ошибка переключения предприятия:', error);
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
    const digitalDirections = getState('digitalDirections') || [];

    // Получаем sectorNames из QUADRANTS (направления цифрового развития)
    let sectorNames = [];
    if (Array.isArray(QUADRANTS) && QUADRANTS.length) {
      sectorNames = QUADRANTS.map(q => q && q.name).filter(Boolean);
    }

    // Получаем список названий направлений
    const directionsList = Array.isArray(digitalDirections) && digitalDirections.length > 0
      ? digitalDirections.map(d => (d && typeof d === 'object' && d.name) ? d.name : String(d || '')).filter(Boolean)
      : [];

    // Получаем список предприятий для фильтра
    const enterpriseData = getState('enterpriseData') || {};
    const enterprisesListData = getState('enterprisesList') || [];
    const enterpriseList = enterprisesListData.length > 0
      ? enterprisesListData.map(ent => typeof ent === 'string' ? ent : (ent.name || ent)).filter(Boolean)
      : Object.keys(enterpriseData).filter(Boolean);

    // Заполняем sidebar фильтры
    if (enterpriseList.length > 0) {
      Filters.populateSelect('enterprise', enterpriseList, 'Предприятия: Все');
    }
    if (directionsList.length > 0) {
      Filters.populateSelect('direction', directionsList, 'Направления цифрового развития: Все');
    }
    if (blocksList.length > 0) {
      Filters.populateSelect('block', blocksList, 'Функциональные блоки: Все');
    }
    if (functions.length > 0) {
      Filters.populateSelect('function', functions, 'Функции: Все');
    }
    // Фильтр "Тип технологий" удален из боковой панели
    // Заменяем значения фильтра "Статус" на "Внедренная/Невнедренная"
    const statusOptions = ['Внедренная', 'Невнедренная'];
    if (statusOptions.length > 0) {
      Filters.populateSelect('level', statusOptions, 'Статус: Все');
    }

    // Заполняем модальные фильтры
    const enterpriseListForInit = enterprisesListData.length > 0
      ? enterprisesListData.map(ent => typeof ent === 'string' ? ent : (ent.name || ent))
      : Object.keys(enterpriseData || {});
    const vendorsList = getState('vendorsList') || [];
    const integratorsList = getState('integratorsList') || [];
    const trlOptions = ['1-Исследовательская', '2-Прототип', '3-Технология готова к внедрению'];

    const ratingOptions = ['0 — Не готова', '1 — Низкая', '2 — Средняя', '3 — Высокая'];
    const modalSelects = [
      { id: 'techSector', items: sectorNames, placeholder: 'Выберите' },
      { id: 'techDirections', items: directionsList, placeholder: 'Выберите' },
      { id: 'techBlock', items: blocksList, placeholder: 'Выберите' },
      { id: 'techFunc', items: functions, placeholder: 'Выберите' },
      // Поля "Тип технологии" и "Статус" удалены из формы добавления
      { id: 'techCompany', items: enterpriseListForInit, placeholder: 'Выберите' },
      { id: 'techVendors', items: vendorsList, placeholder: 'Выберите' },
      { id: 'techIntegrators', items: integratorsList, placeholder: 'Выберите' },
      { id: 'techTrlStage', items: trlOptions, placeholder: 'Выберите стадию' },
      { id: 'techTechRead', items: ratingOptions, placeholder: 'Выберите оценку' },
      { id: 'techOrganRead', items: ratingOptions, placeholder: 'Выберите оценку' },
      { id: 'techFuncCover', items: ratingOptions, placeholder: 'Выберите оценку' },
      { id: 'editDirections', items: directionsList, placeholder: 'Выберите' },
      { id: 'editBlock', items: blocksList, placeholder: 'Выберите' },
      { id: 'editFunc', items: functions, placeholder: 'Выберите' },
      // Поля "Тип технологии" и "Статус" удалены из формы редактирования
      { id: 'editCompany', items: enterpriseListForInit, placeholder: 'Выберите' },
      { id: 'editVendors', items: vendorsList, placeholder: 'Выберите' },
      { id: 'editIntegrators', items: integratorsList, placeholder: 'Выберите' },
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

  /**
   * Пересчет funcCover для всех технологий с использованием нового алгоритма
   * на основе процентного покрытия функций в блоках
   * @param {Array} technologies - Массив технологий для обновления
   * @returns {Promise<void>}
   */
  async function recalculateFuncCoverForAllTechnologies(technologies) {
    if (!Array.isArray(technologies) || technologies.length === 0) {
      console.warn('[DataLoader] Нет технологий для пересчета funcCover');
      return;
    }

    console.log('[DataLoader] Начинаем пересчет funcCover для всех технологий...');

    // Проверяем наличие модуля FuncCoverUtils
    if (!window.FuncCoverUtils || typeof window.FuncCoverUtils.calculateFuncCover !== 'function') {
      console.warn('[DataLoader] Модуль FuncCoverUtils не загружен, пересчет невозможен');
      return;
    }

    let updatedCount = 0;
    const promises = technologies.map(async (tech) => {
      // Получаем покрытые функции
      const coveredFunctions = Array.isArray(tech.functionCoverage)
        ? tech.functionCoverage
        : (Array.isArray(tech.functions) ? tech.functions : []);

      if (coveredFunctions.length === 0) {
        return; // Пропускаем технологии без функций
      }

      // Получаем блоки технологии
      const blockIds = Array.isArray(tech.blocks) && tech.blocks.length > 0
        ? tech.blocks.map(b => typeof b === 'number' ? b : parseInt(b)).filter(n => !isNaN(n))
        : (tech.block ? [typeof tech.block === 'number' ? tech.block : parseInt(tech.block)] : []);

      if (blockIds.length === 0) {
        return; // Пропускаем технологии без блоков
      }

      try {
        // Рассчитываем новое значение funcCover
        const newFuncCover = await window.FuncCoverUtils.calculateFuncCover(coveredFunctions, blockIds);

        // Обновляем только если значение изменилось
        if (tech.funcCover !== newFuncCover) {
          const oldValue = tech.funcCover;
          tech.funcCover = newFuncCover;
          updatedCount++;
          console.log(`[DataLoader] Технология "${tech.name}" (ID: ${tech.id}): funcCover ${oldValue} → ${newFuncCover}`);
        }
      } catch (error) {
        console.error(`[DataLoader] Ошибка при пересчете funcCover для технологии ${tech.id}:`, error);
      }
    });

    await Promise.all(promises);
    console.log(`[DataLoader] Пересчет funcCover завершен. Обновлено технологий: ${updatedCount} из ${technologies.length}`);
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
    initFilters,
    recalculateFuncCoverForAllTechnologies
  };

  // Экспорт функции initFilters для ручного вызова
  window.initFilters = initFilters;

  // Экспорт функций напрямую в window для обратной совместимости
  window.vfsRead = vfsRead;
  window.vfsWrite = vfsWrite;
  window.fetchJsonWithCache = fetchJsonWithCache;
  // Инициализация селекта вендоров с возможностью добавления новых
  function initVendorsSelect() {
    const customSelect = document.querySelector('.custom-select-modal[data-field="techVendors"]');
    if (!customSelect) {
      // Не логируем предупреждение, так как это нормально, если модальное окно закрыто
      return;
    }
    // Если это мультиселект (чекбоксы), то управление выполняется через Filters/select-events
    if (customSelect.getAttribute('data-multi') === 'true') {
      return;
    }

    // Убеждаемся, что селект виден
    customSelect.style.display = 'block';
    customSelect.style.visibility = 'visible';
    customSelect.style.opacity = '1';
    customSelect.style.minHeight = '40px';

    const selectTrigger = customSelect.querySelector('.select-trigger');
    if (selectTrigger) {
      selectTrigger.style.display = 'flex';
      selectTrigger.style.minHeight = '40px';
    }

    const optionsList = customSelect.querySelector('.select-options');
    if (!optionsList) {
      if (window.Logger) window.Logger.warn('initVendorsSelect: optionsList не найден');
      return;
    }

    const hiddenInput = document.getElementById('techVendors');
    if (!hiddenInput) {
      if (window.Logger) window.Logger.warn('initVendorsSelect: hiddenInput не найден');
      return;
    }

    // Получаем список вендоров из state
    let vendorsList = getState('vendorsList') || [];

    // Также проверяем localStorage для новых вендоров
    try {
      const storedVendors = localStorage.getItem('rmk_vendors_list');
      if (storedVendors) {
        const parsed = JSON.parse(storedVendors);
        if (Array.isArray(parsed)) {
          // Объединяем списки, убирая дубликаты
          vendorsList = [...new Set([...vendorsList, ...parsed])];
        }
      }
    } catch (e) {
      if (window.Logger) window.Logger.warn('Ошибка при чтении вендоров из localStorage', e);
    }

    // Заполняем селект опциями
    optionsList.innerHTML = '';

    // Сначала добавляем опцию для добавления нового вендора (в начало списка)
    const addNewOption = document.createElement('li');
    addNewOption.className = 'add-new-vendor-option';
    addNewOption.innerHTML = `
      <input type="text" class="new-vendor-input" placeholder="Введите название нового вендора" />
      <button type="button" class="add-new-vendor-btn btn-primary btn-with-icon">
        <svg class="btn-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M8 3V13M3 8H13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span>Добавить</span>
      </button>
    `;
    optionsList.appendChild(addNewOption);

    // Затем добавляем все опции вендоров
    vendorsList.forEach(vendor => {
      const li = document.createElement('li');
      li.textContent = vendor;
      li.setAttribute('data-value', vendor);
      optionsList.appendChild(li);
    });

    // Обработчик добавления нового вендора
    const addNewVendorBtn = addNewOption.querySelector('.add-new-vendor-btn');
    const newVendorInput = addNewOption.querySelector('.new-vendor-input');

    if (addNewVendorBtn && newVendorInput) {
      const addNewVendor = () => {
        const newVendorName = newVendorInput.value.trim();
        if (!newVendorName) return;

        // Проверяем, нет ли уже такого вендора
        if (vendorsList.includes(newVendorName)) {
          if (window.showNotification) {
            window.showNotification('Такой вендор уже существует', false);
          }
          return;
        }

        // Добавляем в список
        vendorsList.push(newVendorName);

        // Сохраняем новый вендор в localStorage
        try {
          // Получаем текущий список из localStorage
          let localVendors = [];
          try {
            const stored = localStorage.getItem('rmk_vendors_list');
            if (stored) {
              localVendors = JSON.parse(stored);
              if (!Array.isArray(localVendors)) {
                localVendors = [];
              }
            }
          } catch (e) {
            localVendors = [];
          }

          // Добавляем новый вендор, если его еще нет
          if (!localVendors.includes(newVendorName)) {
            localVendors.push(newVendorName);
            localStorage.setItem('rmk_vendors_list', JSON.stringify(localVendors));
            if (window.Logger) {
              window.Logger.debug('Сохранен новый вендор в localStorage:', newVendorName);
            }
          }
        } catch (e) {
          if (window.Logger) window.Logger.warn('Ошибка при сохранении вендора в localStorage', e);
        }

        // Обновляем state
        setState('vendorsList', vendorsList);

        // Создаем новую опцию и вставляем после опции добавления (опция добавления должна быть первой)
        const newOption = document.createElement('li');
        newOption.textContent = newVendorName;
        newOption.setAttribute('data-value', newVendorName);
        if (addNewOption.nextSibling) {
          optionsList.insertBefore(newOption, addNewOption.nextSibling);
        } else {
          optionsList.appendChild(newOption);
        }

        // Устанавливаем значение в селекте используя setCustomSelectValue для правильного обновления UI
        const fieldId = customSelect.getAttribute('data-field');
        if (fieldId && typeof window.setCustomSelectValue === 'function') {
          window.setCustomSelectValue(fieldId, newVendorName);
        } else {
          // Fallback на ручную установку
          hiddenInput.value = newVendorName;
          const selectedText = customSelect.querySelector('.selected-text');
          if (selectedText) {
            selectedText.textContent = newVendorName;
          }

          // Выделяем выбранную опцию
          optionsList.querySelectorAll('li').forEach(li => {
            li.classList.remove('selected');
            if (li.dataset.value === newVendorName) {
              li.classList.add('selected');
            }
          });

          // Триггерим событие change
          hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
        }

        // Закрываем селект
        customSelect.classList.remove('open');

        // Очищаем поле ввода
        newVendorInput.value = '';

        // Обновляем все селекты вендоров на странице (и модальные, и обычные)
        document.querySelectorAll('.custom-select-modal[data-field="techVendors"], .vendor-select').forEach(select => {
          const otherOptionsList = select.querySelector('.select-options');
          if (otherOptionsList && select !== customSelect) {
            // Проверяем, нет ли уже такой опции
            const existingOption = Array.from(otherOptionsList.querySelectorAll('li')).find(
              li => li.dataset.value === newVendorName && !li.classList.contains('add-new-vendor-option')
            );
            if (!existingOption) {
              const otherAddNewOption = otherOptionsList.querySelector('.add-new-vendor-option');
              const newOptionClone = document.createElement('li');
              newOptionClone.textContent = newVendorName;
              newOptionClone.setAttribute('data-value', newVendorName);
              // Вставляем после опции добавления (опция добавления должна быть первой)
              if (otherAddNewOption && otherAddNewOption.nextSibling) {
                otherOptionsList.insertBefore(newOptionClone, otherAddNewOption.nextSibling);
              } else if (otherAddNewOption) {
                otherOptionsList.appendChild(newOptionClone);
              } else {
                otherOptionsList.appendChild(newOptionClone);
              }
            }
          }
        });

        if (window.showNotification) {
          window.showNotification(`Вендор "${newVendorName}" добавлен`, true);
        }
      };

      addNewVendorBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        addNewVendor();
      });

      newVendorInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          e.stopPropagation();
          addNewVendor();
        }
      });
    }

    // Устанавливаем placeholder
    const selectedText = customSelect.querySelector('.selected-text');
    if (selectedText && !hiddenInput.value) {
      selectedText.textContent = 'Выберите';
    }
  }

  window.clearFetchCache = clearFetchCache;
  window.clearVfsCache = clearVfsCache;
  window.loadJsonPreferVfs = loadJsonPreferVfs;
  window.loadData = loadData;
  window.ensureAndPersistNewTech = ensureAndPersistNewTech;
  window.switchEnterprise = switchEnterprise;
  window.showNotification = showNotification;
  window.initVendorsSelect = initVendorsSelect;

})();
