// skeleton.js — ES module
// Skeleton screens (заглушки загрузки)

import Logger from '../core/logger.js';

  /**
   * Создает skeleton элемент для списка технологий
   * @param {number} count - Количество элементов
   * @returns {HTMLElement} Контейнер со skeleton элементами
   */
  function createTechListSkeleton(count = 5) {
    const container = document.createElement('div');
    container.className = 'skeleton-tech-list';

    for (let i = 0; i < count; i++) {
      const item = document.createElement('div');
      item.className = 'skeleton-tech-item';
      item.innerHTML = `
        <div class="skeleton-shape skeleton-circle"></div>
        <div class="skeleton-content">
          <div class="skeleton-line skeleton-title"></div>
          <div class="skeleton-line skeleton-subtitle"></div>
        </div>
      `;
      container.appendChild(item);
    }

    return container;
  }

  /**
   * Создает skeleton для детальной панели
   * @returns {HTMLElement} Skeleton элемент
   */
  function createDetailPanelSkeleton() {
    const container = document.createElement('div');
    container.className = 'skeleton-detail-panel';

    container.innerHTML = `
      <div class="skeleton-header">
        <div class="skeleton-line skeleton-title-large"></div>
        <div class="skeleton-line skeleton-subtitle"></div>
      </div>
      <div class="skeleton-body">
        <div class="skeleton-line"></div>
        <div class="skeleton-line"></div>
        <div class="skeleton-line skeleton-short"></div>
        <div class="skeleton-section">
          <div class="skeleton-line skeleton-title"></div>
          <div class="skeleton-line"></div>
          <div class="skeleton-line"></div>
        </div>
        <div class="skeleton-section">
          <div class="skeleton-line skeleton-title"></div>
          <div class="skeleton-line"></div>
        </div>
      </div>
    `;

    return container;
  }

  /**
   * Создает skeleton для графика
   * @param {string} type - Тип графика ('bar', 'line', 'pie')
   * @returns {HTMLElement} Skeleton элемент
   */
  function createChartSkeleton(type = 'bar') {
    const container = document.createElement('div');
    container.className = `skeleton-chart skeleton-chart-${type}`;

    if (type === 'bar') {
      container.innerHTML = `
        <div class="skeleton-chart-header">
          <div class="skeleton-line skeleton-title"></div>
        </div>
        <div class="skeleton-chart-bars">
          ${Array.from({ length: 5 }, () => '<div class="skeleton-bar"></div>').join('')}
        </div>
      `;
    } else if (type === 'line') {
      container.innerHTML = `
        <div class="skeleton-chart-header">
          <div class="skeleton-line skeleton-title"></div>
        </div>
        <div class="skeleton-chart-line">
          <svg viewBox="0 0 400 200" xmlns="http://www.w3.org/2000/svg">
            <path class="skeleton-line-path" d="M 0,200 Q 100,150 200,100 T 400,50" fill="none" stroke="currentColor" stroke-width="2" opacity="0.3"/>
          </svg>
        </div>
      `;
    } else if (type === 'pie') {
      container.innerHTML = `
        <div class="skeleton-chart-header">
          <div class="skeleton-line skeleton-title"></div>
        </div>
        <div class="skeleton-chart-pie">
          <div class="skeleton-circle-large"></div>
        </div>
      `;
    }

    return container;
  }

  /**
   * Создает skeleton для таблицы
   * @param {number} rows - Количество строк
   * @param {number} cols - Количество колонок
   * @returns {HTMLElement} Skeleton элемент
   */
  function createTableSkeleton(rows = 5, cols = 4) {
    const container = document.createElement('div');
    container.className = 'skeleton-table';

    // Заголовок таблицы
    const header = document.createElement('div');
    header.className = 'skeleton-table-header';
    header.innerHTML = Array.from({ length: cols }, () =>
      '<div class="skeleton-line skeleton-title"></div>'
    ).join('');
    container.appendChild(header);

    // Строки таблицы
    for (let i = 0; i < rows; i++) {
      const row = document.createElement('div');
      row.className = 'skeleton-table-row';
      row.innerHTML = Array.from({ length: cols }, () =>
        '<div class="skeleton-line"></div>'
      ).join('');
      container.appendChild(row);
    }

    return container;
  }

  /**
   * Показывает skeleton и скрывает контент
   * @param {HTMLElement|string} contentEl - Элемент с контентом или его селектор
   * @param {Function} skeletonFactory - Функция, создающая skeleton элемент
   */
  function show(contentEl, skeletonFactory) {
    const element = typeof contentEl === 'string'
      ? document.querySelector(contentEl)
      : contentEl;

    if (!element) {
      Logger.warn('[Skeleton] Element not found:', contentEl);
      return null;
    }

    // Сохраняем оригинальный контент
    const originalContent = element.innerHTML;
    element.dataset.originalContent = originalContent;

    // Создаем skeleton
    const skeleton = skeletonFactory();
    if (!skeleton) {
      Logger.warn('[Skeleton] Skeleton factory returned null');
      return null;
    }

    // Заменяем контент на skeleton
    element.innerHTML = '';
    element.appendChild(skeleton);
    element.classList.add('skeleton-active');

    return skeleton;
  }

  /**
   * Скрывает skeleton и показывает контент
   * @param {HTMLElement|string} contentEl - Элемент с контентом или его селектор
   * @param {boolean} useOriginal - Использовать сохраненный оригинальный контент
   */
  function hide(contentEl, useOriginal = false) {
    const element = typeof contentEl === 'string'
      ? document.querySelector(contentEl)
      : contentEl;

    if (!element) {
      Logger.warn('[Skeleton] Element not found:', contentEl);
      return;
    }

    element.classList.remove('skeleton-active');
    element.classList.add('skeleton-hiding');

    setTimeout(() => {
      if (useOriginal && element.dataset.originalContent) {
        element.innerHTML = element.dataset.originalContent;
        delete element.dataset.originalContent;
      }

      // Удаляем skeleton элементы
      const skeletons = element.querySelectorAll('.skeleton-tech-list, .skeleton-detail-panel, .skeleton-chart, .skeleton-table');
      skeletons.forEach(skeleton => {
        if (skeleton.parentNode) {
          skeleton.parentNode.removeChild(skeleton);
        }
      });

      element.classList.remove('skeleton-hiding');
    }, 200);
  }

  /**
   * Заменяет skeleton на новый контент с плавным переходом
   * @param {HTMLElement|string} contentEl - Элемент с контентом
   * @param {string|HTMLElement} newContent - Новый контент
   */
  function replace(contentEl, newContent) {
    const element = typeof contentEl === 'string'
      ? document.querySelector(contentEl)
      : contentEl;

    if (!element) {
      Logger.warn('[Skeleton] Element not found:', contentEl);
      return;
    }

    element.classList.remove('skeleton-active');
    element.classList.add('skeleton-hiding');

    setTimeout(() => {
      if (typeof newContent === 'string') {
        element.innerHTML = newContent;
      } else if (newContent instanceof HTMLElement) {
        element.innerHTML = '';
        element.appendChild(newContent);
      }

      element.classList.remove('skeleton-hiding');
    }, 200);
  }

  const Skeleton = {
    createTechListSkeleton,
    createDetailPanelSkeleton,
    createChartSkeleton,
    createTableSkeleton,
    show,
    hide,
    replace
  };
  if (typeof window !== 'undefined') window.Skeleton = Skeleton;
  export default Skeleton;
  export { createTechListSkeleton, createDetailPanelSkeleton, createChartSkeleton, createTableSkeleton, show, hide, replace };
