// radar-update.js
// Функция обновления радара с фильтрацией
// DataIndex и RenderQueue импортируются напрямую для корректного порядка загрузки в production

import { DOMCache } from '../core/dom-utils.js';
import { DataIndex } from '../core/data-indexing.js';
import { RenderQueue } from '../core/core-utils.js';

'use strict';

  // Ленивая загрузка зависимостей (модули ещё загружаются через loadModule)
  function getFilters() {
    if (typeof window !== 'undefined' && window.Filters) {
      return window.Filters;
    }
    throw new Error('Filters не загружен');
  }

  function getStateAccessors() {
    if (typeof window !== 'undefined' && window.StateAccessors) {
      return window.StateAccessors;
    }
    throw new Error('StateAccessors не загружен');
  }

  function getDOMProxy() {
    if (typeof window !== 'undefined' && window.DOMProxy) {
      return window.DOMProxy;
    }
    throw new Error('DOMProxy не загружен');
  }

  // Внутренняя функция обновления радара (без debounce для синхронных вызовов)
  function updateRadarInternal() {
    const Filters = getFilters();
    const StateAccessors = getStateAccessors();
    const DOMProxy = getDOMProxy();

    const d = Filters.getFilterValues('direction');
    const b = Filters.getFilterValues('block');
    const f = Filters.getFilterValues('function');
    // Фильтр "Тип технологий" удален
    const l = Filters.getFilterValues('level');
    const e = Filters.getFilterValues('enterprise');

    // Получаем searchInput через DOMCache напрямую для чтения value
    const searchInputEl = DOMCache.get("searchInput");
    const q = (searchInputEl && searchInputEl.value ? searchInputEl.value : '').toLowerCase().trim();

    // Оптимизация: предварительно нормализуем данные для поиска, если есть текстовый запрос
    const hasTextSearch = q.length > 0;
    const searchFieldsCache = hasTextSearch ? new Map() : null;

    // Используем DataIndex для быстрой фильтрации
    let filtered = DataIndex.filter((t) => {
      // Проверяем предприятие (может быть в t.company как строка или массив)
      if (e.length > 0) {
        const techCompanies = Array.isArray(t.company) ? t.company : (t.company ? [t.company] : []);
        if (techCompanies.length === 0 || !techCompanies.some(company => e.includes(company))) return false;
      }
      // Проверяем направление (может быть в t.directions или t.direction)
      if (d.length > 0) {
        const techDirections = t.directions && Array.isArray(t.directions) ? t.directions : (t.direction ? [t.direction] : []);
        if (!techDirections.some(direction => d.includes(direction))) return false;
      }
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
      // Фильтр "Тип технологий" удален
      // Проверяем статус (Внедренная/Невнедренная) на основе isImplemented
      if (l.length > 0) {
        // Для технологий с несколькими предприятиями проверяем isImplemented для каждого предприятия
        const companies = Array.isArray(t.company) ? t.company : (t.company ? [t.company] : []);
        let isImplemented = false;

        if (companies.length > 1 && t.companyRatings && typeof t.companyRatings === 'object') {
          // Для нескольких предприятий проверяем, есть ли хотя бы одно с isImplemented = true
          isImplemented = companies.some(company => {
            const ratings = t.companyRatings[company];
            return ratings && ratings.isImplemented === true;
          });
        } else {
          // Для одного предприятия или общего значения
          if (companies.length === 1 && t.companyRatings && typeof t.companyRatings === 'object') {
            const ratings = t.companyRatings[companies[0]];
            isImplemented = ratings && ratings.isImplemented === true;
          } else {
            isImplemented = t.isImplemented === true;
          }
        }

        const statusValue = isImplemented ? 'Внедренная' : 'Невнедренная';
        if (!l.includes(statusValue)) return false;
      }
      return true;
    });

    // Применяем текстовый поиск поверх фильтров
    if (q) {
      filtered = filtered.filter(t => {
        // Используем кэш для нормализованных полей
        let normalizedFields = searchFieldsCache.get(t.id);
        if (!normalizedFields) {
          // Преобразуем все значения в строки перед созданием массива
          const directionsArray = Array.isArray(t.directions)
            ? t.directions.map(d => String(d || ''))
            : [];
          const blocksArray = Array.isArray(t.blocks)
            ? t.blocks.map(b => String(b || ''))
            : [];
          const functionsArray = Array.isArray(t.functions)
            ? t.functions.map(f => String(f || ''))
            : [];

          normalizedFields = [
            String(t.name || ''),
            String(t.description || ''),
            String(t.direction || ''),
            ...directionsArray,
            String(t.block || ''),
            ...blocksArray,
            String(t.func || ''),
            ...functionsArray,
            String(t.techType || ''),
            String(t.level || ''),
            String(t.id || '')
          ].map(fld => String(fld || '').toLowerCase()).filter(fld => fld.length > 0);
          searchFieldsCache.set(t.id, normalizedFields);
        }
        return normalizedFields.some(fld => fld.includes(q));
      });
    }

    // Оптимизация: группируем обновления DOM через RenderQueue
    const isRadarPage =
      window.location.pathname === '/radar/' ||
      window.location.pathname === '/radar' ||
      window.location.pathname.includes('radar.html') ||
      window.location.href.includes('radar.html');
    RenderQueue.schedule(() => {
      // Полный рендер с технологиями только на странице radar.html
      if (isRadarPage && typeof window.renderRadar === 'function') {
        window.renderRadar(filtered);
      }

      // Обновляем сайдбар ТОЛЬКО если есть активный поиск или фильтры
      const hasActiveFilter = e.length > 0 || d.length > 0 || b.length > 0 || f.length > 0 || l.length > 0 || q;
      if (hasActiveFilter) {
        if (typeof window.updateSidebarLists === 'function') {
          window.updateSidebarLists(filtered);
        }
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
    const priorityPanel = DOMCache.get('quadrantPriorityPanel');
    if (priorityPanel &&
        priorityPanel.classList.contains('open') &&
        StateAccessors.getCurrentZoomedQuadrant() != null) {
      if (typeof window.recomputeQuadrantPriorityList === 'function') {
        window.recomputeQuadrantPriorityList(StateAccessors.getCurrentZoomedQuadrant());
      }
    }
  }

  // Debounced версия updateRadar для использования из обработчиков событий
  // Оптимизация производительности: предотвращаем избыточные перерисовки при частых вызовах
  function getDebounce() {
    if (typeof window !== 'undefined' && typeof window.debounce === 'function') {
      return window.debounce;
    }
    // Fallback реализация
    return function(func, wait) {
      let timeout;
      return function executedFunction(...args) {
        const later = () => {
          clearTimeout(timeout);
          func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
      };
    };
  }

  // Создаем debounced версию с задержкой 50мс (баланс между производительностью и отзывчивостью UI)
  const debounceFn = getDebounce();
  const debouncedUpdateRadar = debounceFn(updateRadarInternal, 50);

  // Публичная функция updateRadar - использует debounce для оптимизации
  function updateRadar(immediate) {
    if (immediate === true) {
      // Для критических обновлений (например, при загрузке данных) выполняем сразу
      updateRadarInternal();
    } else {
      // Для обычных обновлений (например, при изменении фильтров) используем debounce
      debouncedUpdateRadar();
    }
  }

  // Экспорт модуля
  const RadarUpdate = {
    updateRadar,
    updateRadarInternal
  };

  if (typeof window !== 'undefined') {
    window.RadarUpdate = RadarUpdate;
    window.updateRadar = updateRadar;
  }

  export default RadarUpdate;
  export { updateRadar, updateRadarInternal };
