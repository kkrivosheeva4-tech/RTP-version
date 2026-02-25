// data-loader.js — ES module
// Оркестрация загрузки данных. Шаг 9.4: загрузка через DataService.

import StateManager from './state-manager.js';
import DataService from './data-service.js';
import { vfsRead, vfsWrite, loadJsonPreferVfs, clearFetchCache, clearVfsCache, fetchJsonWithCache } from './data-source.js';
import { buildBlockMaps, normalizeTechnologyFromNewFormat, buildEnterpriseDataFromTechnologies } from './data-normalize.js';
import { reportError } from './error-handler.js';
import { escapeHtml } from './escape-utils.js';
import { normalizeForComparison } from './validators.js';
import Logger from './logger.js';

const getState = (key) => StateManager.get(key);
const setState = (key, value) => StateManager.set(key, value);

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
    Logger.warn('Filters не загружен, попытка повторной инициализации фильтров будет пропущена');
    return null;
  };

  const getPositioning = () => {
    if (window.Positioning) {
      return window.Positioning;
    }
    Logger.warn('Positioning не загружен, вычисление координат будет пропущено');
    return null;
  };

  const getDataIndex = () => {
    if (window.DataIndex) {
      return window.DataIndex;
    }
    Logger.warn('DataIndex не загружен, индексация будет пропущена');
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
    const escapedMessage = escapeHtml(message);
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
    // Показываем индикатор загрузки только на странице radar.html (на главной не показываем)
    const isRadarPage = typeof window !== 'undefined' && (window.location.pathname.includes('radar.html') || window.location.href.includes('radar.html'));
    let loaderId = null;
    if (isRadarPage && typeof window !== 'undefined' && window.LoadingManager) {
      loaderId = window.LoadingManager.show('Загрузка данных...');
    }

    try {
      DataService.clearFetchCache();

      // Загрузка через DataService (шаг 9.4)
      const refNames = ['functions', 'functionToBlock', 'digitalDirections', 'directionToQuadrant', 'vendors', 'integrators', 'enterprises'];
      const fileNames = ['functions.json', 'functionToBlock.json', 'digitalDirections.json', 'directionToQuadrant.json', 'vendors.json', 'integrators.json', 'enterprises.json'];

      const [blocksData, ...refResults] = await Promise.all([
        DataService.loadReference('blocks'),
        ...refNames.map(n => DataService.loadReference(n))
      ]);

      const blocks = Array.isArray(blocksData) ? blocksData : [];
      const fetched = {};
      fetched['blocks.json'] = { data: blocks };
      refNames.forEach((name, i) => {
        fetched[fileNames[i]] = { data: refResults[i] };
      });

      const missing = [];
      if (!blocks) missing.push('blocks.json');
      refNames.forEach((name, i) => {
        const val = refResults[i];
        if (val === null || val === undefined) missing.push(fileNames[i]);
        else if (['functionToBlock', 'directionToQuadrant'].includes(name) && (typeof val !== 'object' || val === null)) missing.push(fileNames[i]);
      });
      if (missing.length) {
        throw new Error(`Не удалось загрузить файлы: ${missing.join(', ')}`);
      }

      const { blockIdToName, nameToBlockId, blocksList } = buildBlockMaps(blocks);
      setState('nameToBlockId', nameToBlockId);
      setState('blocksList', blocksList);

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
        Logger.warn('Валидация данных: обнаружены проблемы', validationErrors);
        showNotification(`Проверка данных: ${validationErrors.join('; ')}`, false);
      }
      // УДАЛЕНО (2026-01-29): blockToQuadrant больше не загружается
      // Блоки не привязаны к квадрантам, они являются отдельными критериями технологии
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

      // Загрузка технологий через DataService (шаг 9.4)
      const allTechnologies = await DataService.loadTechnologies();
      const enterpriseData = buildEnterpriseDataFromTechnologies(allTechnologies);

      setState('technologies', allTechnologies);
      setState('enterpriseData', enterpriseData);

      if (allTechnologies.length > 0) {
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
      } else {
        const emptyEnterpriseList = (getState('enterprisesList') || []).map(ent => typeof ent === 'string' ? ent : (ent?.name || ent)).filter(Boolean);
        setState('enterpriseList', emptyEnterpriseList);
      }

      // Инициализируем индекс с загруженными данными
      const DataIndex = getDataIndex();
      if (DataIndex) {
        try {
          DataIndex.build(allTechnologies);
        } catch (e) {
          Logger.warn('DataIndex.build failed after loading technologies.json', e);
        }
      }

      // Инициализация фильтров и модальных селектов — из filter-init.js
      const directionsList = Array.isArray(digitalDirections) && digitalDirections.length > 0
        ? digitalDirections.map(d => (d && typeof d === 'object' && d.name) ? d.name : String(d || '')).filter(Boolean)
        : [];
      const enterprisesListData = getState('enterprisesList') || [];
      const enterpriseListForModal = enterprisesListData.length > 0
        ? enterprisesListData.map(ent => typeof ent === 'string' ? ent : (ent.name || ent))
        : Object.keys(getState('enterpriseData') || {});
      if (window.FilterInit && typeof window.FilterInit.initModalSelectsWithDirections === 'function') {
        window.FilterInit.initModalSelectsWithDirections(
          directionsList, getState('blocksList') || [], getState('functions') || [],
          enterpriseListForModal, getState('vendorsList') || []
        );
      }
      setTimeout(() => {
        if (typeof window.initVendorsSelect === 'function') window.initVendorsSelect();
      }, 200);
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
            // Ошибка парсинга directions
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
            try { DataIndex.build(getState('technologies')); } catch (e) { Logger.warn('DataIndex.build failed', e); }
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
            // Ошибка парсинга directions
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
              try { DataIndex.build(getState('technologies')); } catch (e) { Logger.warn('DataIndex.build failed', e); }
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
        Logger.warn('Ошибка при обновлении заголовков секторов:', e);
      }

      if (typeof window.initFiltersWithRetry === 'function') {
        // Инициализируем фильтры только на странице радара, где есть сайдбар с селектами
        const hasFilterSidebar = document.querySelector('.custom-select[data-filter="enterprise"]');
        if (hasFilterSidebar) {
          window.initFiltersWithRetry(0);
        }
      }

      // Пересчитываем funcCover для всех технологий с использованием нового алгоритма
      // Это делается синхронно перед первым рендерингом, чтобы избежать изменения позиций
      const technologiesForRecalc = getState('technologies');
      if (technologiesForRecalc && technologiesForRecalc.length > 0) {
        // Пересчитываем funcCover синхронно (await)
        await recalculateFuncCoverForAllTechnologies(technologiesForRecalc);

        // Пересчет funcCover завершен успешно

        // Пересчитываем координаты для всех технологий после обновления funcCover
        // Это необходимо, так как funcCover влияет на позиционирование
        const Positioning = getPositioning();
        if (Positioning && typeof Positioning.computeCoordinates === 'function') {
          technologiesForRecalc.forEach(tech => {
            Positioning.computeCoordinates(tech);
          });
          // Координаты пересчитаны для всех технологий после обновления funcCover
        }

        // После пересчета обновляем state
        setState('technologies', [...technologiesForRecalc]);
        // Обновляем индекс после пересчета
        const DataIndex = getDataIndex();
        if (DataIndex) {
          try {
            DataIndex.build(technologiesForRecalc);
          } catch (e) {
            Logger.warn('DataIndex.build failed after recalculating funcCover', e);
          }
        }
      }

      // Скрываем индикатор загрузки при успешной загрузке
      if (loaderId && typeof window !== 'undefined' && window.LoadingManager) {
        window.LoadingManager.hide(loaderId);
      }
    } catch (error) {
      // Скрываем индикатор загрузки при ошибке (П.11: показ через ErrorDisplay с кнопкой «Повторить» — в reportError)
      if (loaderId && typeof window !== 'undefined' && window.LoadingManager) {
        window.LoadingManager.hide(loaderId);
      }
      reportError(error, 'Загрузка данных', { retryCallback: loadData });
    }
  }

  // ===== ФУНКЦИЯ ДОБАВЛЕНИЯ НОВОЙ ТЕХНОЛОГИИ =====
  async function ensureAndPersistNewTech(newTech) {
    try {
      if (!newTech) return;
      // Trim block and level
      if (newTech.block && typeof newTech.block === 'string') newTech.block = newTech.block.trim();
      if (newTech.level && typeof newTech.level === 'string') newTech.level = newTech.level.trim();
      if (!newTech.level) newTech.level = 'Существующие';
      // ОБНОВЛЕНО (2026-01-29): Убрана привязка блоков к квадрантам
      // Блоки теперь являются отдельными критериями технологии и могут быть в любом квадранте
      const bk = (newTech.blocks && newTech.blocks.length) ? (typeof newTech.blocks[0] === 'string' ? newTech.blocks[0].trim() : newTech.blocks[0]) : (typeof newTech.block === 'string' ? newTech.block : newTech.block);
      newTech.block = bk;

      // Добавляем блок в список блоков, если его там нет
      const blocksList = getState('blocksList');
      if (!blocksList.includes(bk)) {
        setState('blocksList', [...blocksList, bk]);
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
            const escapedBk = escapeHtml(bk);
            li.innerHTML = `<label class="option-label"><input type="checkbox" class="option-checkbox" /><span>${escapedBk}</span></label>`;
            opts.appendChild(li);
          }
        });
        try { vfsWrite('blocks.json', getState('blocksList')); } catch (e) { Logger.warn('vfs write failed', e); }
      }
      // Ensure level mapping exists
      const levelToRing = window.levelToRing || {};
      if (!levelToRing || !Object.prototype.hasOwnProperty.call(levelToRing, newTech.level)) {
        // fallback to default
        newTech.level = newTech.level || 'Существующие';
        if (!levelToRing[newTech.level]) newTech.level = 'Существующие';
      }

      // Compute coordinates taking into account existing technologies (technologies may include newTech)
      Logger.debug('ensureAndPersistNewTech: computing coordinates for', { id: newTech.id, block: newTech.block, level: newTech.level });
      const Positioning = getPositioning();
      if (Positioning) {
        Positioning.computeCoordinates(newTech);
        Logger.debug('ensureAndPersistNewTech: coords computed', { id: newTech.id, x: newTech.x, y: newTech.y });
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

      try {
        if (existsIdx === -1) {
          await DataService.createTech(newTech);
        } else {
          await DataService.updateTech(newTech.id, newTech);
        }
        Logger.debug('ensureAndPersistNewTech: technology saved via DataService', newTech.id);
      } catch (e) {
        Logger.warn('ensureAndPersistNewTech: DataService persist failed', e);
        throw e;
      }

      try {
        const enterpriseData = getState('enterpriseData');
        const currentEnterprise = getState('currentEnterprise');
        if (enterpriseData && currentEnterprise) {
          enterpriseData[currentEnterprise] = [...getState('technologies')];
          setState('enterpriseData', { ...enterpriseData });
        }
      } catch (e) { Logger.warn('update enterpriseData failed', e); }
    } catch (err) {
      reportError(err, 'Сохранение технологии');
      Logger.warn('ensureAndPersistNewTech error', err);
    }
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
        reportError(e, 'Сохранение данных при переключении предприятия');
        Logger.warn('Не удалось сохранить technologies при переключении предприятия', e);
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
      reportError(error, 'Переключение предприятия');
    }
  }

  function initFilters() {
    return typeof window.initFilters === 'function' ? window.initFilters() : false;
  }

  /**
   * Пересчет funcCover для всех технологий с использованием нового алгоритма
   * на основе процентного покрытия функций в блоках
   * @param {Array} technologies - Массив технологий для обновления
   * @returns {Promise<void>}
   */
  async function recalculateFuncCoverForAllTechnologies(technologies) {
    if (!Array.isArray(technologies) || technologies.length === 0) {
      // Нет технологий для пересчета funcCover
      return;
    }

    // Начинаем пересчет funcCover для всех технологий

    // Проверяем наличие модуля FuncCoverUtils
    if (!window.FuncCoverUtils || typeof window.FuncCoverUtils.calculateFuncCover !== 'function') {
      // Модуль FuncCoverUtils не загружен, пересчет невозможен
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
          // Технология обновлена
        }
      } catch (error) {
        // Ошибка при пересчете funcCover для технологии
      }
    });

    await Promise.all(promises);
    // Пересчет funcCover завершен
  }

  // ===== CRUD ВЕНДОРОВ (шаги 2.2, 2.3, 2.4) =====
  const VENDORS_STORAGE_KEY = 'rmk_vendors_list';

  function getVendorsList() {
    let list = getState('vendorsList') || [];
    try {
      const stored = localStorage.getItem(VENDORS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          list = [...new Set([...list, ...parsed])];
        }
      }
    } catch (e) { /* ignore */ }
    return list;
  }

  function saveVendorsList(list) {
    setState('vendorsList', list);
    try {
      localStorage.setItem(VENDORS_STORAGE_KEY, JSON.stringify(list));
    } catch (e) {
      Logger.warn('Ошибка сохранения вендоров в localStorage', e);
    }
  }

  function isVendorUsedInTechnologies(vendorName) {
    const nf = normalizeForComparison;
    const norm = nf(vendorName);
    if (!norm) return false;
    const technologies = getState('technologies') || [];
    return technologies.some(tech => {
      const vendors = Array.isArray(tech.vendors) ? tech.vendors : [];
      return vendors.some(v => {
        const name = (v && typeof v === 'object') ? v.name : v;
        return name && nf(name) === norm;
      });
    });
  }

  function renameVendorInTechnologies(oldName, newName) {
    const nf = normalizeForComparison;
    const normOld = nf(oldName);
    if (!normOld) return;
    const technologies = getState('technologies') || [];
    let changed = false;
    technologies.forEach(tech => {
      const vendors = Array.isArray(tech.vendors) ? tech.vendors : [];
      vendors.forEach(v => {
        const name = (v && typeof v === 'object') ? v.name : v;
        if (name && nf(name) === normOld) {
          if (v && typeof v === 'object') v.name = newName;
          changed = true;
        }
      });
    });
    if (changed) {
      setState('technologies', [...technologies]);
      try {
        vfsWrite('technologies.json', technologies);
      } catch (e) {
        Logger.warn('Ошибка записи technologies.json', e);
      }
    }
  }

  function removeVendorFromTechnologies(vendorName) {
    const nf = normalizeForComparison;
    const norm = nf(vendorName);
    if (!norm) return;
    const technologies = getState('technologies') || [];
    let changed = false;
    technologies.forEach(tech => {
      if (!Array.isArray(tech.vendors)) return;
      const before = tech.vendors.length;
      tech.vendors = tech.vendors.filter(v => {
        const name = (v && typeof v === 'object') ? v.name : v;
        return !(name && nf(name) === norm);
      });
      if (tech.vendors.length !== before) changed = true;
    });
    if (changed) {
      setState('technologies', [...technologies]);
      try {
        vfsWrite('technologies.json', technologies);
      } catch (e) {
        Logger.warn('Ошибка записи technologies.json', e);
      }
    }
  }

  function renameVendorInFormSelections(oldName, newName, nf) {
    ['techVendors', 'editVendors'].forEach(fieldId => {
      const el = document.getElementById(fieldId);
      if (!el || !el.value) return;
      try {
        let vals = [];
        if (el.value.trim().startsWith('[')) {
          vals = JSON.parse(el.value);
          if (!Array.isArray(vals)) vals = [vals];
        } else {
          vals = [el.value.trim()];
        }
        const normOld = nf(oldName);
        vals = vals.map(v => (v && nf(v) === normOld) ? newName : v);
        el.value = vals.length ? JSON.stringify(vals) : '';
      } catch (e) { /* ignore */ }
    });
  }

  function renameVendor(oldName, newName) {
    const list = getVendorsList();
    const nf = normalizeForComparison;
    const normOld = nf(oldName);
    const normNew = nf(newName);
    if (!normOld || !normNew) return false;
    const idx = list.findIndex(v => nf(v) === normOld);
    if (idx === -1) return false;
    const otherDup = list.some((v, i) => i !== idx && nf(v) === normNew);
    if (otherDup) return false;
    list[idx] = newName;
    saveVendorsList(list);
    renameVendorInTechnologies(oldName, newName);
    renameVendorInFormSelections(oldName, newName, nf);
    refreshAllVendorSelects(list, { vendorRenameMap: { oldName, newName } });
    return true;
  }

  function deleteVendor(vendorName) {
    const list = getVendorsList();
    const nf = normalizeForComparison;
    const norm = nf(vendorName);
    if (!norm) return false;
    const newList = list.filter(v => nf(v) !== norm);
    if (newList.length === list.length) return false;
    saveVendorsList(newList);
    removeVendorFromTechnologies(vendorName);
    removeVendorFromFormSelections(vendorName, nf);
    refreshAllVendorSelects(newList);
    return true;
  }

  function removeVendorFromFormSelections(vendorName, nf) {
    ['techVendors', 'editVendors'].forEach(fieldId => {
      const el = document.getElementById(fieldId);
      if (!el || !el.value) return;
      try {
        let vals = [];
        if (el.value.trim().startsWith('[')) {
          vals = JSON.parse(el.value);
          if (!Array.isArray(vals)) vals = [vals];
        } else {
          vals = [el.value.trim()];
        }
        const norm = nf(vendorName);
        const filtered = vals.filter(v => !(v && nf(v) === norm));
        el.value = Array.isArray(filtered) ? JSON.stringify(filtered) : '';
      } catch (e) { /* ignore */ }
    });
  }

  function refreshAllVendorSelects(vendorsListOverride, options) {
    if (window.VendorsFiles) {
      if (typeof window.VendorsFiles.clearVendorsCache === 'function') {
        window.VendorsFiles.clearVendorsCache();
      }
      if (typeof window.VendorsFiles.updateVendorsSelects === 'function') {
        window.VendorsFiles.updateVendorsSelects(vendorsListOverride, options?.vendorRenameMap);
      }
    }
    document.querySelectorAll('.vendor-select').forEach(select => {
      const optionsList = select.querySelector('.select-options');
      if (!optionsList) return;
      const addOpt = optionsList.querySelector('.add-new-vendor-option, .add-new-option[data-add-new="vendor"]');
      const list = getVendorsList();
      const vendorOpts = optionsList.querySelectorAll('li[data-value]:not(.add-new-vendor-option):not(.add-new-option)');
      const currentValues = new Set(Array.from(vendorOpts).map(li => li.getAttribute('data-value')).filter(Boolean));
      list.forEach(v => {
        if (currentValues.has(v)) return;
        const li = document.createElement('li');
        li.textContent = v;
        li.setAttribute('data-value', v);
        li.style.cursor = 'pointer';
        if (addOpt && addOpt.nextSibling) {
          optionsList.insertBefore(li, addOpt.nextSibling);
        } else if (addOpt) {
          optionsList.appendChild(li);
        } else {
          optionsList.appendChild(li);
        }
      });
      const nf = normalizeForComparison;
      const listNorm = new Set(list.map(v => nf(v)));
      vendorOpts.forEach(li => {
        const val = li.getAttribute('data-value');
        if (val && !listNorm.has(nf(val))) li.remove();
      });
    });
    if (typeof window.initVendorsSelect === 'function') {
      window.initVendorsSelect();
    }
    if (typeof window.updateRadar === 'function') {
      window.updateRadar();
    }
  }

  // ===== CRUD ИНТЕГРАТОРОВ (шаг 2.6) =====
  const INTEGRATORS_STORAGE_KEY = 'rmk_integrators_list';

  async function getIntegratorsList() {
    let list = getState('integratorsList') || [];
    try {
      const jsonData = await DataService.loadReference('integrators');
      if (Array.isArray(jsonData)) {
        list = [...new Set([...list, ...jsonData])];
      }
    } catch (e) { /* ignore */ }
    try {
      const stored = localStorage.getItem(INTEGRATORS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          list = [...new Set([...list, ...parsed])];
        }
      }
    } catch (e) { /* ignore */ }
    return list;
  }

  async function saveIntegratorsList(list) {
    setState('integratorsList', list);
    try {
      let jsonIntegrators = [];
      try {
        const jsonData = await DataService.loadReference('integrators');
        if (Array.isArray(jsonData)) {
          jsonIntegrators = jsonData;
        }
      } catch (e) { /* ignore */ }
      
      // Фильтруем список: оставляем только те интеграторы, которых нет в JSON
      // Это пользовательские интеграторы, которые нужно сохранить в localStorage
      const nf = normalizeForComparison;
      const jsonNormSet = new Set(jsonIntegrators.map(i => nf(String(i))));
      const userIntegrators = list.filter(i => !jsonNormSet.has(nf(String(i))));
      
      // Сохраняем только пользовательские интеграторы в localStorage
      localStorage.setItem(INTEGRATORS_STORAGE_KEY, JSON.stringify(userIntegrators));
      
      // Очищаем кэш после сохранения
      if (window.VendorsFiles && typeof window.VendorsFiles.clearIntegratorsCache === 'function') {
        window.VendorsFiles.clearIntegratorsCache();
      }
    } catch (e) {
      Logger.warn('Ошибка сохранения интеграторов в localStorage', e);
    }
  }

  function isIntegratorUsedInTechnologies(integratorName) {
    const nf = normalizeForComparison;
    const norm = nf(integratorName);
    if (!norm) return false;
    const technologies = getState('technologies') || [];
    return technologies.some(tech => {
      const vendors = Array.isArray(tech.vendors) ? tech.vendors : [];
      return vendors.some(v => {
        const integrators = Array.isArray(v.integrators) ? v.integrators : [];
        return integrators.some(i => {
          const name = (i && typeof i === 'object') ? i.name : i;
          return name && nf(name) === norm;
        });
      });
    });
  }

  function renameIntegratorInTechnologies(oldName, newName) {
    const nf = normalizeForComparison;
    const normOld = nf(oldName);
    if (!normOld) return;
    const technologies = getState('technologies') || [];
    let changed = false;
    technologies.forEach(tech => {
      const vendors = Array.isArray(tech.vendors) ? tech.vendors : [];
      vendors.forEach(v => {
        const integrators = Array.isArray(v.integrators) ? v.integrators : [];
        integrators.forEach(i => {
          const name = (i && typeof i === 'object') ? i.name : i;
          if (name && nf(name) === normOld) {
            if (i && typeof i === 'object') i.name = newName;
            else if (typeof i === 'string') {
              const idx = integrators.indexOf(i);
              if (idx !== -1) integrators[idx] = newName;
            }
            changed = true;
          }
        });
      });
    });
    if (changed) {
      setState('technologies', [...technologies]);
      try {
        vfsWrite('technologies.json', technologies);
      } catch (e) {
        Logger.warn('Ошибка записи technologies.json', e);
      }
    }
  }

  function removeIntegratorFromTechnologies(integratorName) {
    const nf = normalizeForComparison;
    const norm = nf(integratorName);
    if (!norm) return;
    const technologies = getState('technologies') || [];
    let changed = false;
    technologies.forEach(tech => {
      const vendors = Array.isArray(tech.vendors) ? tech.vendors : [];
      vendors.forEach(v => {
        if (!Array.isArray(v.integrators)) return;
        const before = v.integrators.length;
        v.integrators = v.integrators.filter(i => {
          const name = (i && typeof i === 'object') ? i.name : i;
          return !(name && nf(name) === norm);
        });
        if (v.integrators.length !== before) changed = true;
      });
    });
    if (changed) {
      setState('technologies', [...technologies]);
      try {
        vfsWrite('technologies.json', technologies);
      } catch (e) {
        Logger.warn('Ошибка записи technologies.json', e);
      }
    }
  }

  function renameIntegratorInFormSelections(oldName, newName, nf) {
    // Обновляем основные селекты интеграторов
    ['techIntegrators', 'editIntegrators'].forEach(fieldId => {
      const el = document.getElementById(fieldId);
      if (!el || !el.value) return;
      try {
        let vals = [];
        if (el.value.trim().startsWith('[')) {
          vals = JSON.parse(el.value);
          if (!Array.isArray(vals)) vals = [vals];
        } else {
          vals = [el.value.trim()];
        }
        const normOld = nf(oldName);
        const hasOld = vals.some(v => v && nf(v) === normOld);
        vals = vals.map(v => (v && nf(v) === normOld) ? newName : v);
        el.value = vals.length ? JSON.stringify(vals) : '';
        // Обновляем визуальное отображение
        if (hasOld && typeof window.setCustomSelectValue === 'function') {
          const customSelect = document.querySelector(`.custom-select-modal[data-field="${fieldId}"]`);
          if (customSelect) {
            requestAnimationFrame(() => {
              window.setCustomSelectValue(fieldId, el.value);
            });
          }
        }
      } catch (e) { /* ignore */ }
    });

    // Обновляем селекты интеграторов по вендорам
    document.querySelectorAll('input[type="hidden"][id^="techVendorIntegrators__"], input[type="hidden"][id^="editVendorIntegrators__"]').forEach(el => {
      if (!el || !el.value) return;
      try {
        let vals = [];
        if (el.value.trim().startsWith('[')) {
          vals = JSON.parse(el.value);
          if (!Array.isArray(vals)) vals = [vals];
        } else {
          vals = [el.value.trim()];
        }
        const normOld = nf(oldName);
        const hasOld = vals.some(v => v && nf(v) === normOld);
        vals = vals.map(v => (v && nf(v) === normOld) ? newName : v);
        el.value = vals.length ? JSON.stringify(vals) : '';
        // Обновляем визуальное отображение
        if (hasOld && typeof window.setCustomSelectValue === 'function') {
          const fieldId = el.id;
          const customSelect = document.querySelector(`.custom-select-modal[data-field="${fieldId}"]`);
          if (customSelect) {
            requestAnimationFrame(() => {
              window.setCustomSelectValue(fieldId, el.value);
            });
          }
        }
      } catch (e) { /* ignore */ }
    });
  }

  async function renameIntegrator(oldName, newName) {
    // Очищаем кэш перед получением списка, чтобы получить актуальные данные
    if (window.VendorsFiles && typeof window.VendorsFiles.clearIntegratorsCache === 'function') {
      window.VendorsFiles.clearIntegratorsCache();
    }
    const list = await getIntegratorsList();
    const nf = normalizeForComparison;
    const normOld = nf(oldName);
    const normNew = nf(newName);
    if (!normOld || !normNew) return false;
    const idx = list.findIndex(i => nf(i) === normOld);
    if (idx === -1) {
      // Интегратор не найден в основном списке - возможно, он только что добавлен и еще не синхронизирован
      // Попробуем обновить напрямую в localStorage
      try {
        const stored = localStorage.getItem(INTEGRATORS_STORAGE_KEY);
        if (stored) {
          let localList = JSON.parse(stored);
          if (Array.isArray(localList)) {
            const localIdx = localList.findIndex(i => nf(String(i)) === normOld);
            if (localIdx !== -1) {
              const otherDup = localList.some((i, iIdx) => iIdx !== localIdx && nf(String(i)) === normNew);
              if (otherDup) return false;
              localList[localIdx] = newName;
              localStorage.setItem(INTEGRATORS_STORAGE_KEY, JSON.stringify(localList));
              // Очищаем кэш после сохранения
              if (window.VendorsFiles && typeof window.VendorsFiles.clearIntegratorsCache === 'function') {
                window.VendorsFiles.clearIntegratorsCache();
              }
              renameIntegratorInTechnologies(oldName, newName);
              renameIntegratorInFormSelections(oldName, newName, nf);
              // Получаем обновленный список для обновления селектов
              const updatedList = await getIntegratorsList();
              refreshAllIntegratorSelects(updatedList, { integratorRenameMap: { oldName, newName } });
              return true;
            }
          }
        }
      } catch (e) {
        Logger.warn('Ошибка при переименовании интегратора в localStorage', e);
      }
      return false;
    }
    const otherDup = list.some((i, iIdx) => iIdx !== idx && nf(i) === normNew);
    if (otherDup) return false;
    list[idx] = newName;
    await saveIntegratorsList(list);
    renameIntegratorInTechnologies(oldName, newName);
    renameIntegratorInFormSelections(oldName, newName, nf);
    refreshAllIntegratorSelects(list, { integratorRenameMap: { oldName, newName } });
    return true;
  }

  async function deleteIntegrator(integratorName) {
    // Очищаем кэш перед получением списка, чтобы получить актуальные данные
    if (window.VendorsFiles && typeof window.VendorsFiles.clearIntegratorsCache === 'function') {
      window.VendorsFiles.clearIntegratorsCache();
    }
    const list = await getIntegratorsList();
    const nf = normalizeForComparison;
    const norm = nf(integratorName);
    if (!norm) return false;
    const newList = list.filter(i => nf(i) !== norm);
    if (newList.length === list.length) {
      // Интегратор не найден в списке - возможно, он только что добавлен и еще не синхронизирован
      // Попробуем удалить напрямую из localStorage
      try {
        const stored = localStorage.getItem(INTEGRATORS_STORAGE_KEY);
        if (stored) {
          let localList = JSON.parse(stored);
          if (Array.isArray(localList)) {
            const beforeLength = localList.length;
            localList = localList.filter(i => nf(String(i)) !== norm);
            if (localList.length !== beforeLength) {
              localStorage.setItem(INTEGRATORS_STORAGE_KEY, JSON.stringify(localList));
              // Очищаем кэш
              if (window.VendorsFiles && typeof window.VendorsFiles.clearIntegratorsCache === 'function') {
                window.VendorsFiles.clearIntegratorsCache();
              }
              removeIntegratorFromTechnologies(integratorName);
              removeIntegratorFromFormSelections(integratorName, nf);
              refreshAllIntegratorSelects(localList);
              return true;
            }
          }
        }
      } catch (e) {
        Logger.warn('Ошибка при удалении интегратора из localStorage', e);
      }
      return false;
    }
    saveIntegratorsList(newList);
    // Очищаем кэш после сохранения
    if (window.VendorsFiles && typeof window.VendorsFiles.clearIntegratorsCache === 'function') {
      window.VendorsFiles.clearIntegratorsCache();
    }
    removeIntegratorFromTechnologies(integratorName);
    removeIntegratorFromFormSelections(integratorName, nf);
    refreshAllIntegratorSelects(newList);
    return true;
  }

  function removeIntegratorFromFormSelections(integratorName, nf) {
    // Удаляем из основных селектов интеграторов
    ['techIntegrators', 'editIntegrators'].forEach(fieldId => {
      const el = document.getElementById(fieldId);
      if (!el || !el.value) return;
      try {
        let vals = [];
        if (el.value.trim().startsWith('[')) {
          vals = JSON.parse(el.value);
          if (!Array.isArray(vals)) vals = [vals];
        } else {
          vals = [el.value.trim()];
        }
        const norm = nf(integratorName);
        const beforeLength = vals.length;
        const filtered = vals.filter(v => !(v && nf(v) === norm));
        el.value = Array.isArray(filtered) ? JSON.stringify(filtered) : '';
        // Обновляем визуальное отображение, если значение изменилось
        if (beforeLength !== filtered.length && typeof window.setCustomSelectValue === 'function') {
          const customSelect = document.querySelector(`.custom-select-modal[data-field="${fieldId}"]`);
          if (customSelect) {
            requestAnimationFrame(() => {
              window.setCustomSelectValue(fieldId, el.value);
            });
          }
        }
      } catch (e) { /* ignore */ }
    });

    // Удаляем из селектов интеграторов по вендорам
    document.querySelectorAll('input[type="hidden"][id^="techVendorIntegrators__"], input[type="hidden"][id^="editVendorIntegrators__"]').forEach(el => {
      if (!el || !el.value) return;
      try {
        let vals = [];
        if (el.value.trim().startsWith('[')) {
          vals = JSON.parse(el.value);
          if (!Array.isArray(vals)) vals = [vals];
        } else {
          vals = [el.value.trim()];
        }
        const norm = nf(integratorName);
        const beforeLength = vals.length;
        const filtered = vals.filter(v => !(v && nf(v) === norm));
        el.value = Array.isArray(filtered) ? JSON.stringify(filtered) : '';
        // Обновляем визуальное отображение, если значение изменилось
        if (beforeLength !== filtered.length && typeof window.setCustomSelectValue === 'function') {
          const fieldId = el.id;
          const customSelect = document.querySelector(`.custom-select-modal[data-field="${fieldId}"]`);
          if (customSelect) {
            requestAnimationFrame(() => {
              window.setCustomSelectValue(fieldId, el.value);
            });
          }
        }
      } catch (e) { /* ignore */ }
    });
  }

  function refreshAllIntegratorSelects(integratorsListOverride, options) {
    // НЕ вызываем updateIntegratorsSelects здесь, так как это приводит к появлению элементов под полем добавления
    // при редактировании вендора. Селекты интеграторов по вендорам обновляются через renderVendorIntegrators
    // Обновляем только основные селекты интеграторов (techIntegrators, editIntegrators)
    // и селекты интеграторов по вендорам, которые уже существуют в DOM
    document.querySelectorAll('.custom-select-modal[data-field="techIntegrators"], .custom-select-modal[data-field="editIntegrators"]').forEach(select => {
      const optionsList = select.querySelector('.select-options');
      if (!optionsList) return;
      const addOpt = optionsList.querySelector('.add-new-integrator-option, .add-new-option[data-add-new="integrator"]');
      const list = integratorsListOverride || getState('integratorsList') || [];
      const nf = normalizeForComparison;
      let integratorOpts = Array.from(optionsList.querySelectorAll('li.select-option-item[data-value]:not(.add-new-integrator-option):not(.add-new-option)'));
      
      // СНАЧАЛА обновляем названия в существующих опциях при переименовании
      if (options && options.integratorRenameMap) {
        const { oldName, newName } = options.integratorRenameMap;
        integratorOpts.forEach(li => {
          const val = li.getAttribute('data-value');
          if (val && nf(val) === nf(oldName)) {
            // Обновляем data-value и текст
            li.setAttribute('data-value', newName);
            const textSpan = li.querySelector('.integrator-option-text');
            if (textSpan) {
              textSpan.textContent = newName;
            }
            // Также обновляем текст в label, если есть
            const labelSpan = li.querySelector('label span:not(.integrator-option-text)');
            if (labelSpan) {
              labelSpan.textContent = newName;
            }
          }
        });
        // Обновляем визуальное отображение выбранных значений
        const customSelectEl = select.closest('.custom-select-modal') || select;
        const fieldId = customSelectEl.getAttribute('data-field');
        if (fieldId && typeof window.renderMultiSelectTags === 'function') {
          requestAnimationFrame(() => {
            window.renderMultiSelectTags(customSelectEl);
          });
        }
        // Обновляем список опций после переименования
        integratorOpts = Array.from(optionsList.querySelectorAll('li.select-option-item[data-value]:not(.add-new-integrator-option):not(.add-new-option)'));
      }
      
      // ПОТОМ проверяем, какие элементы нужно добавить
      const currentValues = new Set(integratorOpts.map(li => {
        const val = li.getAttribute('data-value');
        return val ? nf(val) : null;
      }).filter(Boolean));
      
      list.forEach(i => {
        const normI = nf(i);
        if (currentValues.has(normI)) return; // Элемент уже есть (возможно, после переименования)
        
        const li = document.createElement('li');
        li.className = 'select-option-item';
        li.setAttribute('data-value', i);
        const escaped = escapeHtml(i);
        li.innerHTML = `
          <label class="option-label">
            <input type="checkbox" class="option-checkbox" />
            <span class="integrator-option-text">${escaped}</span>
          </label>
          <div class="integrator-option-actions">
            <button type="button" class="edit-integrator-btn" title="Редактировать" aria-label="Редактировать">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button type="button" class="delete-integrator-btn" title="Удалить" aria-label="Удалить">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
            </button>
          </div>
        `;
        li.classList.add('integrator-option-item');
        const editBtn = li.querySelector('.edit-integrator-btn');
        const deleteBtn = li.querySelector('.delete-integrator-btn');
        if (editBtn && window.Filters && typeof window.Filters.startIntegratorEdit === 'function') {
          editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            const customSelectEl = select.closest('.custom-select-modal') || select;
            const fieldId = customSelectEl.getAttribute('data-field') || '';
            const hiddenInputEl = document.getElementById(fieldId);
            const isMultiEl = customSelectEl.getAttribute('data-multi') === 'true';
            const currentName = li.getAttribute('data-value') || i;
            window.Filters.startIntegratorEdit(li, currentName, optionsList, customSelectEl, hiddenInputEl, fieldId, isMultiEl);
          });
        }
        if (deleteBtn && window.Filters && typeof window.Filters.handleIntegratorDelete === 'function') {
          deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            const customSelectEl = select.closest('.custom-select-modal') || select;
            const fieldId = customSelectEl.getAttribute('data-field') || '';
            const hiddenInputEl = document.getElementById(fieldId);
            const isMultiEl = customSelectEl.getAttribute('data-multi') === 'true';
            const currentName = li.getAttribute('data-value') || i;
            window.Filters.handleIntegratorDelete(currentName, li, optionsList, customSelectEl, hiddenInputEl, fieldId, isMultiEl, true);
          });
        }
        if (addOpt && addOpt.nextSibling) {
          optionsList.insertBefore(li, addOpt.nextSibling);
        } else if (addOpt) {
          optionsList.appendChild(li);
        } else {
          optionsList.appendChild(li);
        }
      });
      
      const listNorm = new Set(list.map(i => nf(i)));
      integratorOpts.forEach(li => {
        const val = li.getAttribute('data-value');
        if (val && !listNorm.has(nf(val))) {
          // Если удаляемая опция была выбрана, нужно обновить визуальное отображение
          const checkbox = li.querySelector('input[type="checkbox"]');
          if (checkbox && checkbox.checked) {
            const customSelectEl = select.closest('.custom-select-modal') || select;
            const fieldId = customSelectEl.getAttribute('data-field');
            if (fieldId) {
              const hiddenInputEl = document.getElementById(fieldId);
              if (hiddenInputEl && typeof window.setCustomSelectValue === 'function') {
                // Значение уже обновлено в removeIntegratorFromFormSelections, просто обновляем визуально
                requestAnimationFrame(() => {
                  window.setCustomSelectValue(fieldId, hiddenInputEl.value);
                });
              }
            }
          }
          li.remove();
        }
      });
    });
    if (typeof window.updateRadar === 'function') {
      window.updateRadar();
    }
  }

  const DataLoader = {
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
    recalculateFuncCoverForAllTechnologies,
    isVendorUsedInTechnologies,
    renameVendor,
    deleteVendor,
    isIntegratorUsedInTechnologies,
    renameIntegrator,
    deleteIntegrator
  };

  // initFilters экспортируется из filter-init.js; data-loader оставляет обёртку для совместимости
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
      Logger.warn('initVendorsSelect: optionsList не найден');
      return;
    }

    const hiddenInput = document.getElementById('techVendors');
    if (!hiddenInput) {
      Logger.warn('initVendorsSelect: hiddenInput не найден');
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
      Logger.warn('Ошибка при чтении вендоров из localStorage', e);
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
      <span class="field-error-message" id="newVendorError"></span>
    `;
    optionsList.appendChild(addNewOption);

    // Проверка дубликата вендора по нормализованному имени (с учётом омоглифов, регистра)
    function isVendorDuplicate(name, list) {
      const nf = normalizeForComparison;
      const normalized = nf(name);
      if (!normalized) return false;
      return (list || []).some(v => nf(v) === normalized);
    }

    function showVendorError(msg) {
      const errEl = addNewOption.querySelector('#newVendorError');
      if (errEl) {
        errEl.textContent = msg || '';
        errEl.classList.toggle('visible', !!msg);
      }
      newVendorInput?.classList.toggle('duplicate-name-error', !!msg);
      addNewVendorBtn?.toggleAttribute('disabled', !!msg);
    }

    function runVendorLiveValidation() {
      const val = (newVendorInput?.value || '').trim();
      if (!val) {
        showVendorError('');
        return;
      }
      const dup = isVendorDuplicate(val, vendorsList);
      showVendorError(dup ? 'Такой вендор уже существует' : '');
    }

    let vendorValidationTimer = null;
    function scheduleVendorValidation() {
      if (vendorValidationTimer) clearTimeout(vendorValidationTimer);
      vendorValidationTimer = setTimeout(runVendorLiveValidation, 400);
    }

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

        // Проверяем дубликат по нормализованному имени (с учётом омоглифов, регистра)
        if (isVendorDuplicate(newVendorName, vendorsList)) {
          showVendorError('Такой вендор уже существует');
          return;
        }
        showVendorError('');

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
            Logger.debug('Сохранен новый вендор в localStorage:', newVendorName);
          }
        } catch (e) {
          Logger.warn('Ошибка при сохранении вендора в localStorage', e);
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

      // Живая проверка при вводе и при потере фокуса
      newVendorInput.addEventListener('blur', runVendorLiveValidation);
      newVendorInput.addEventListener('input', scheduleVendorValidation);
    }

    // Устанавливаем placeholder
    const selectedText = customSelect.querySelector('.selected-text');
    if (selectedText && !hiddenInput.value) {
      selectedText.textContent = 'Выберите';
    }
  }

  if (typeof window !== 'undefined') {
    window.DataLoader = DataLoader;
    window.loadData = loadData;
    window.ensureAndPersistNewTech = ensureAndPersistNewTech;
    window.switchEnterprise = switchEnterprise;
    window.showNotification = showNotification;
    window.initVendorsSelect = initVendorsSelect;
  }

  export default DataLoader;
  export {
    loadData,
    ensureAndPersistNewTech,
    switchEnterprise,
    showNotification,
    initVendorsSelect,
    recalculateFuncCoverForAllTechnologies,
    isVendorUsedInTechnologies,
    renameVendor,
    deleteVendor,
    isIntegratorUsedInTechnologies,
    renameIntegrator,
    deleteIntegrator
  };
