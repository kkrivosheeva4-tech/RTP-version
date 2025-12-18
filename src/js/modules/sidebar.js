// Модуль работы с сайдбаром
// Экспортирует функции в window.Sidebar для использования в RMK2.js
// Использует глобальные переменные из RMK2.js и функции из других модулей

(function() {
  'use strict';

  // Получаем зависимости из других модулей и глобальных переменных (ленивая загрузка)
  const getAllQuadrantsForTech = (...args) => {
    const fn = window.getAllQuadrantsForTech;
    return fn ? fn(...args) : [];
  };
  const getTechnologies = () => {
    if (window.StateManager) {
      return window.StateManager.get('technologies') || [];
    }
    return [];
  };
  const getTechById = (id) => {
    if (window.StateManager) {
      const technologiesById = window.StateManager.get('technologiesById');
      if (technologiesById && technologiesById instanceof Map) {
        return technologiesById.get(id) || null;
      }
    }
    return null;
  };
  const getFilterValues = (key) => {
    const fn = window.Filters?.getFilterValues;
    return fn ? fn(key) : [];
  };
  const getQuadrantIdForBlock = (block) => {
    const fn = window.Positioning?.getQuadrantIdForBlock;
    return fn ? fn(block) : null;
  };
  const setSelectedBlipId = (value) => {
    if (window.StateManager) {
      window.StateManager.set('selectedBlipId', value);
    }
  };
  const setCurrentTech = (tech) => {
    const fn = window.setCurrentTech;
    if (fn) fn(tech);
  };
  const showDetail = (...args) => {
    const fn = window.showDetail;
    if (fn) fn(...args);
  };
  const debouncedHover = (...args) => {
    const fn = window.debouncedHover;
    if (fn) fn(...args);
  };

  // Получаем DOM элементы через DOMCache или напрямую
  const getSvg = () => {
    if (window.DOMCache) {
      return window.DOMCache.get('techRadar');
    }
    return document.getElementById('techRadar');
  };
  const getHoverLabel = () => {
    if (window.DOMCache) {
      return window.DOMCache.get('hoverLabel');
    }
    return document.getElementById('hoverLabel');
  };

  // Получаем QUADRANTS из глобальной переменной
  const getQuadrants = () => {
    return window.QUADRANTS || [];
  };

  /**
   * Обновляет списки технологий в сайдбаре на основе отфильтрованных технологий
   * @param {Array} filteredTechs - Массив отфильтрованных технологий
   */
  function updateSidebarLists(filteredTechs) {
    // Группируем технологии по квадрантам
    // Технология может попасть в несколько квадрантов, если она имеет блоки в разных секторах
    const techsByQuadrant = {};
    filteredTechs.forEach(t => {
      const techQuadrants = getAllQuadrantsForTech(t);
      techQuadrants.forEach(qId => {
        if (qId == null) return;
        if (!techsByQuadrant[qId]) techsByQuadrant[qId] = [];
        techsByQuadrant[qId].push(t);
      });
    });

    // Оптимизация: кэшируем селекторы sectorItem
    const sectorItemsCache = {};
    const QUADRANTS = getQuadrants();
    QUADRANTS.forEach(q => {
      if (!sectorItemsCache[q.id]) {
        sectorItemsCache[q.id] = document.querySelector(`.sector-item[data-quadrant="${q.id}"]`);
      }
      const sectorItem = sectorItemsCache[q.id];
      if (!sectorItem) return;

      const hasMatches = techsByQuadrant[q.id]?.length > 0;
      const existingList = sectorItem.nextElementSibling;

      // Скрыть список, если нет совпадений
      if (!hasMatches) {
        if (existingList && existingList.classList.contains('tech-list')) {
          existingList.classList.remove('open');
          setTimeout(() => existingList.remove(), 260);
        }
        return;
      }

      // Есть совпадения → создать или обновить список
      if (!existingList || !existingList.classList.contains('tech-list')) {
        createTechListForSector(sectorItem, q.id, filteredTechs);
        sectorItem.classList.add('active');
      } else {
        updateTechListItems(q.id, techsByQuadrant[q.id]);
      }
    });
  }

  /**
   * Создает список технологий для сектора в сайдбаре
   * @param {HTMLElement} sectorItem - Элемент сектора
   * @param {string|number} quadrantId - ID квадранта
   * @param {Array} allTechnologies - Массив всех технологий
   */
  function createTechListForSector(sectorItem, quadrantId, allTechnologies) {
    // Удаляем старый список, если есть
    const oldList = sectorItem.nextElementSibling;
    if (oldList && oldList.classList.contains('tech-list')) {
      oldList.remove();
    }

    const list = document.createElement('div');
    list.className = 'tech-list';
    const svg = getSvg();
    const hoverLabel = getHoverLabel();

    // Проверяем все квадранты технологии, а не только первый блок
    const techs = allTechnologies.filter(t => {
      const techQuadrants = getAllQuadrantsForTech(t);
      return techQuadrants.includes(quadrantId);
    });

    techs.forEach(t => {
      const ti = document.createElement('div');
      ti.className = 'tech-list-item';
      ti.dataset.techId = t.id;
      ti.textContent = t.name;

      // Hover
      ti.addEventListener('mouseenter', () => {
        const tech = allTechnologies.find(tt => tt.id == t.id);
        if (tech && svg && hoverLabel) {
          const blip = svg.querySelector(`.blip[data-id="${t.id}"]`);
          if (blip) blip.classList.add('highlighted');
          debouncedHover(tech, true);
          const svgRect = svg.getBoundingClientRect();
          const bRect = blip.getBoundingClientRect();
          hoverLabel.style.left = `${bRect.left + bRect.width/2 - svgRect.left}px`;
          hoverLabel.style.top = `${bRect.top + bRect.height/2 - svgRect.top}px`;
        }
      });
      ti.addEventListener('mouseleave', () => {
        debouncedHover(null, false);
        if (svg) {
          svg.querySelectorAll('.blip').forEach(el => el.classList.remove('highlighted'));
        }
      });

      // Click
      ti.addEventListener('click', (e) => {
        e.stopPropagation();
        const blip = svg ? svg.querySelector(`.blip[data-id="${t.id}"]`) : null;
        if (blip) {
          blip.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        } else {
          showDetail(t);
        }
        list.querySelectorAll('.tech-list-item').forEach(el => el.classList.remove('selected'));
        ti.classList.add('selected');
        setSelectedBlipId(t.id);
      });

      list.appendChild(ti);
    });

    sectorItem.parentNode.insertBefore(list, sectorItem.nextSibling);
    requestAnimationFrame(() => list.classList.add('open'));
  }

  /**
   * Обновляет элементы списка технологий для квадранта
   * @param {string|number} quadrantId - ID квадранта
   * @param {Array} matchedTechs - Массив совпавших технологий
   */
  function updateTechListItems(quadrantId, matchedTechs) {
    const list = document.querySelector(`.sector-item[data-quadrant="${quadrantId}"] + .tech-list`);
    if (!list) return;

    const matchedIds = new Set(matchedTechs.map(t => t.id));

    list.querySelectorAll('.tech-list-item').forEach(item => {
      const techId = Number(item.dataset.techId);
      if (matchedIds.has(techId)) {
        item.classList.add('matched');
      } else {
        item.classList.remove('matched');
      }
    });
  }

  /**
   * Рендерит список технологий сектора, отфильтрованный по текущим фильтрам
   * @param {string|number} quadrantId - ID квадранта
   */
  function renderSectorTechListFilteredByCurrentFilters(quadrantId) {
    // удалить существующие
    document.querySelectorAll('.tech-list').forEach(tl => tl.parentNode?.removeChild(tl));
    const sectorItem = document.querySelector(`.sector-item[data-quadrant="${quadrantId}"]`);
    if (!sectorItem) return;

    const blockVals = getFilterValues('block'); // Получаем массив выбранных блоков
    const blockValsSet = blockVals.length > 0 ? new Set(blockVals) : null;
    const technologies = getTechnologies();
    const svg = getSvg();
    const hoverLabel = getHoverLabel();

    const techs = technologies.filter(t => {
      if (getQuadrantIdForBlock(t.block) !== quadrantId) return false;
      if (blockValsSet) {
        const techBlocks = t.blocks && Array.isArray(t.blocks) ? t.blocks : (t.block ? [t.block] : []);
        if (!techBlocks.some(block => blockValsSet.has(block))) return false;
      }
      return true;
    });

    const list = document.createElement('div');
    list.className = 'tech-list';

    techs.forEach(t => {
      const ti = document.createElement('div');
      ti.className = 'tech-list-item';
      ti.dataset.techId = t.id;
      ti.textContent = t.name;

      ti.addEventListener('mouseenter', () => {
        const tech = getTechById(t.id);
        if (tech && svg && hoverLabel) {
          const blip = svg.querySelector(`.blip[data-id="${t.id}"]`);
          if (blip) blip.classList.add('highlighted');
          debouncedHover(tech, true);
          const svgRect = svg.getBoundingClientRect();
          const bRect = blip?.getBoundingClientRect?.() || { left: 0, top: 0, width: 0, height: 0 };
          hoverLabel.style.left = `${bRect.left + bRect.width/2 - svgRect.left}px`;
          hoverLabel.style.top = `${bRect.top + bRect.height/2 - svgRect.top}px`;
        }
      });

      ti.addEventListener('mouseleave', () => {
        debouncedHover(null, false);
        if (svg) {
          svg.querySelectorAll('.blip').forEach(el => el.classList.remove('highlighted'));
        }
      });

      ti.addEventListener('click', (e) => {
        e.stopPropagation();
        const blip = svg ? svg.querySelector(`.blip[data-id="${t.id}"]`) : null;
        if (blip) {
          blip.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        } else {
          // Открываем детали из списка сектора (не из панели приоритета)
          // showDetail сам выделит все blip'ы технологии
          showDetail(t, 'sector-list');
        }
        list.querySelectorAll('.tech-list-item').forEach(el => el.classList.remove('selected'));
        ti.classList.add('selected');
        setSelectedBlipId(t.id);
      });

      list.appendChild(ti);
    });

    sectorItem.parentNode.insertBefore(list, sectorItem.nextSibling);
    requestAnimationFrame(() => list.classList.add('open'));
    document.querySelectorAll('.sector-item').forEach(i => i.classList.remove('active'));
    sectorItem.classList.add('active');
  }

  // Экспортируем функции в window.Sidebar и window для обратной совместимости
  window.Sidebar = {
    updateSidebarLists,
    createTechListForSector,
    updateTechListItems,
    renderSectorTechListFilteredByCurrentFilters
  };

  // Экспортируем также в window для прямого доступа (обратная совместимость)
  window.updateSidebarLists = updateSidebarLists;
  window.createTechListForSector = createTechListForSector;
  window.updateTechListItems = updateTechListItems;
  window.renderSectorTechListFilteredByCurrentFilters = renderSectorTechListFilteredByCurrentFilters;

})();
