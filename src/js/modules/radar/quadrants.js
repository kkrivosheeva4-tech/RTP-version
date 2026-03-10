// Модуль работы с квадрантами
// Экспортирует функции в window для использования в RMK2.js
// Использует глобальные переменные из RMK2.js и функции из других модулей

'use strict';

// Получаем зависимости из других модулей (StateAccessors — основной источник; window.* устарел)
const getTechnologies = () => {
    if (window.StateAccessors && typeof window.StateAccessors.getTechnologies === 'function') {
      const techs = window.StateAccessors.getTechnologies();
      if (Array.isArray(techs) && techs.length > 0) return techs;
    }
    if (window.StateManager && typeof window.StateManager.get === 'function') {
      const techs = window.StateManager.get('technologies');
      if (Array.isArray(techs) && techs.length > 0) return techs;
    }
    if (typeof window.getTechnologies === 'function') {
      const techs = window.getTechnologies();
      if (Array.isArray(techs) && techs.length > 0) return techs;
    }
    return [];
  };

  const getAllQuadrantsForTech = (...args) => {
    // Используем функцию из window.Positioning, если она доступна
    const fn = (window.Positioning && typeof window.Positioning.getAllQuadrantsForTech === 'function')
      ? window.Positioning.getAllQuadrantsForTech
      : (typeof window.getAllQuadrantsForTech === 'function' ? window.getAllQuadrantsForTech : null);
    return fn ? fn(...args) : [];
  };

  const setCurrentZoomedQuadrant = (value) => {
    if (window.setCurrentZoomedQuadrant) {
      window.setCurrentZoomedQuadrant(value);
    }
  };

  const openQuadrantPriorityPanel = (qId) => {
    const fn = window.openQuadrantPriorityPanel;
    if (fn) fn(qId);
  };

  const closeQuadrantPriorityPanel = () => {
    const fn = window.closeQuadrantPriorityPanel;
    if (fn) fn();
  };

  const showNotification = (message, isSuccess = false) => {
    const fn = window.showNotification;
    if (fn) fn(message, isSuccess);
  };

  // Получаем QUADRANTS из глобальной переменной
  const getQuadrants = () => {
    return window.QUADRANTS || [];
  };

  /**
   * Получает статус технологии
   * @param {Object} tech - Объект технологии
   * @returns {string} Статус технологии
   */
  function getTechStatus(tech) {
    return (tech.status || tech.level || '').toString();
  }

  /**
   * Получает название квадранта по его ID
   * @param {string|number} qId - ID квадранта
   * @returns {string} Название квадранта
   */
  function getQuadrantName(qId) {
    try {
      const QUADRANTS = getQuadrants();
      const q = QUADRANTS.find(q => q.id === qId || q.quadrant === qId);
      return q ? (q.name || q.title || `Сектор ${qId}`) : `Сектор ${qId}`;
    } catch (e) {
      return `Сектор ${qId}`;
    }
  }

  /**
   * Получает все технологии для указанного квадранта
   * @param {string|number} qId - ID квадранта
   * @returns {Array} Массив технологий
   */
  function getTechnologiesForQuadrant(qId) {
    // Нормализуем qId к числу для корректного сравнения
    const normalizedQId = typeof qId === 'string' ? parseInt(qId, 10) : Number(qId);
    if (isNaN(normalizedQId)) return [];

    return getTechnologies().filter(t => {
      // Проверяем все квадранты технологии, а не только первый блок
      const techQuadrants = getAllQuadrantsForTech(t);
      if (!Array.isArray(techQuadrants) || techQuadrants.length === 0) return false;
      // Нормализуем квадранты к числам для корректного сравнения
      return techQuadrants.some(q => {
        const normalizedQ = typeof q === 'string' ? parseInt(q, 10) : Number(q);
        return !isNaN(normalizedQ) && normalizedQ === normalizedQId;
      });
    });
  }

  /**
   * Перемещает кнопку "Сбросить выбор" под фильтры при раскрытии панели
   */
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

  function syncSidebarIconButtonsVisibility() {
    const sidebarWrapper = document.querySelector(".sidebar-wrapper");
    const isExpanded = !!(sidebarWrapper && sidebarWrapper.classList.contains("expanded"));
    const searchIconBtn = document.getElementById("searchIconBtn");
    const filterIconBtn = document.getElementById("filterIconBtn");

    if (searchIconBtn) {
      searchIconBtn.style.display = isExpanded ? "none" : "";
    }
    if (filterIconBtn) {
      filterIconBtn.style.display = isExpanded ? "none" : "";
    }
  }

  /**
   * Увеличивает масштаб (зум) квадранта
   * @param {string|number} qId - ID квадранта
   * @param {Object} opts - Опции (например, {source: 'sector'})
   */
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


    // Сохраняем текущий зуммированный квадрант через StateManager
    setCurrentZoomedQuadrant(qId);

    // Раскрываем боковую панель только на десктопе (не на мобильных)
    // На мобильных панель управляется кнопкой, а не автоматически при зуме
    const sidebarWrapper = document.querySelector(".sidebar-wrapper");
    if (sidebarWrapper && window.innerWidth > 767) {
      sidebarWrapper.classList.remove("collapsed");
      sidebarWrapper.classList.add("expanded");
      // Перемещаем кнопку "Сбросить выбор" под фильтры
      moveResetButtonToFilterPanel();
      // При раскрытой панели иконки поиска/фильтра должны быть скрыты.
      syncSidebarIconButtonsVisibility();
    }

    // Открываем правую панель приоритета сектора при зуме
    // НО НЕ открываем, если источник - клик по blip (source === 'blip' или skipPriorityPanel === true)
    const shouldSkipPriorityPanel = opts.skipPriorityPanel === true || opts.source === 'blip';
    if (!shouldSkipPriorityPanel) {
      openQuadrantPriorityPanel(qId);
    }
  }

  /**
   * Сбрасывает зум (показывает все квадранты)
   */
  function unzoom() {
    document.querySelectorAll(".quadrant-group").forEach(g => {
      g.classList.remove("hidden", "zoomed-in");
    });

    // Восстанавливаем видимость легенды
    const legendEl = document.querySelector(".legend");
    if (legendEl) legendEl.classList.remove("hidden");

    // Сбрасываем текущий зуммированный квадрант
    setCurrentZoomedQuadrant(null);

    // Актуализируем видимость кнопок поиска/фильтра в зависимости от состояния панели.
    syncSidebarIconButtonsVisibility();

    // Закрываем правую панель приоритета
    closeQuadrantPriorityPanel();
  }

  const Quadrants = {
    getTechStatus,
    getQuadrantName,
    getTechnologiesForQuadrant,
    zoomQuadrant,
    unzoom
  };

  // Экспорт функций напрямую в window для обратной совместимости
  if (typeof window !== 'undefined') {
    window.Quadrants = Quadrants;
    window.getTechStatus = getTechStatus;
    window.getQuadrantName = getQuadrantName;
    window.getTechnologiesForQuadrant = getTechnologiesForQuadrant;
    window.zoomQuadrant = zoomQuadrant;
    window.unzoom = unzoom;
  }

  export default Quadrants;
  export { getTechStatus, getQuadrantName, getTechnologiesForQuadrant, zoomQuadrant, unzoom };
