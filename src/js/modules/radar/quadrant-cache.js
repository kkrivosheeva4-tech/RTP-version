// quadrant-cache.js
// Модуль для кэширования групп квадрантов

(function() {
  'use strict';

  // Ленивая загрузка зависимостей
  function getDOMCache() {
    if (typeof window !== 'undefined' && window.DOMCache) {
      return window.DOMCache;
    }
    throw new Error('DOMCache не загружен');
  }

  // Кэш для групп квадрантов (оптимизация DOM-запросов)
  const quadrantGroupsCache = new Map();

  function getQuadrantGroup(quadrantId) {
    const DOMCache = getDOMCache();
    const svg = DOMCache.get('techRadar');

    if (!svg) return null;

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

  // Экспорт функций
  window.QuadrantCache = {
    getQuadrantGroup,
    clearQuadrantGroupsCache
  };

  // Глобальные алиасы для обратной совместимости
  window.getQuadrantGroup = getQuadrantGroup;
  window.clearQuadrantGroupsCache = clearQuadrantGroupsCache;
})();
