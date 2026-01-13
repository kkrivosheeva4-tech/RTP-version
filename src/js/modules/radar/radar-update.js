// radar-update.js
// Функция обновления радара с фильтрацией

(function() {
  'use strict';

  // Ленивая загрузка зависимостей
  function getFilters() {
    if (typeof window !== 'undefined' && window.Filters) {
      return window.Filters;
    }
    throw new Error('Filters не загружен');
  }

  function getDataIndex() {
    if (typeof window !== 'undefined' && window.DataIndex) {
      return window.DataIndex;
    }
    throw new Error('DataIndex не загружен');
  }

  function getRenderQueue() {
    if (typeof window !== 'undefined' && window.RenderQueue) {
      return window.RenderQueue;
    }
    throw new Error('RenderQueue не загружен');
  }

  function getDOMCache() {
    if (typeof window !== 'undefined' && window.DOMCache) {
      return window.DOMCache;
    }
    throw new Error('DOMCache не загружен');
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

  // Функция обновления радара
  function updateRadar() {
    const Filters = getFilters();
    const DataIndex = getDataIndex();
    const RenderQueue = getRenderQueue();
    const DOMCache = getDOMCache();
    const StateAccessors = getStateAccessors();
    const DOMProxy = getDOMProxy();

    const b = Filters.getFilterValues('block');
    const f = Filters.getFilterValues('function');
    const tt = Filters.getFilterValues('techType');
    const l = Filters.getFilterValues('level');

    // Получаем searchInput через DOMProxy
    const searchInput = DOMProxy.createElementProxy("searchInput");
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
      // Вызываем renderRadar из модуля radar-wrappers
      if (typeof window.renderRadar === 'function') {
        window.renderRadar(filtered);
      }

      // Обновляем сайдбар ТОЛЬКО если есть активный поиск или фильтры
      const hasActiveFilter = b.length > 0 || f.length > 0 || tt.length > 0 || l.length > 0 || q;
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

  // Экспорт модуля
  const RadarUpdate = {
    updateRadar
  };

  if (typeof window !== 'undefined') {
    window.RadarUpdate = RadarUpdate;
    // Экспорт функции в window для обратной совместимости
    window.updateRadar = updateRadar;
  }
})();
