// quadrant-cache.js
// Модуль для кэширования групп квадрантов

import { DOMCache } from '../core/dom-utils.js';

// Кэш для групп квадрантов (оптимизация DOM-запросов)
const quadrantGroupsCache = new Map();

function getQuadrantGroup(quadrantId) {
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

// Экспорт модуля
const QuadrantCache = {
  getQuadrantGroup,
  clearQuadrantGroupsCache
};

if (typeof window !== 'undefined') {
  window.QuadrantCache = QuadrantCache;
  window.getQuadrantGroup = getQuadrantGroup;
  window.clearQuadrantGroupsCache = clearQuadrantGroupsCache;
}

export { getQuadrantGroup, clearQuadrantGroupsCache };
export default QuadrantCache;
