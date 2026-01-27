// tooltips.js
// Объединенный модуль для работы с подсказками (tooltip и hover)
// Объединяет функциональность tooltip.js и hover.js

(function() {
  'use strict';

  // ===== TOOLTIP =====
  // Модуль для tooltip на элементах с классом .required-star

  const MIN_OFFSET = 5;
  const TOOLTIP_OFFSET = 10;

  function createTooltip(text) {
    const tooltip = document.createElement('div');
    tooltip.className = 'tooltip-global';
    tooltip.textContent = text;
    document.body.appendChild(tooltip);
    return tooltip;
  }

  function positionTooltip(tooltip, starRect) {
    const tooltipRect = tooltip.getBoundingClientRect();
    const top = starRect.top - tooltipRect.height - TOOLTIP_OFFSET;
    const left = starRect.left + starRect.width / 2 - tooltipRect.width / 2;

    tooltip.style.top = `${Math.max(top, MIN_OFFSET)}px`;
    tooltip.style.left = `${Math.max(left, MIN_OFFSET)}px`;

    requestAnimationFrame(() => {
      tooltip.style.opacity = '1';
      tooltip.style.transform = 'translateY(0)';
    });
  }

  function removeTooltip(tooltip) {
    if (tooltip) {
      tooltip.style.opacity = '0';
      tooltip.remove();
    }
  }

  function initTooltips() {
    document.querySelectorAll('.required-star').forEach(star => {
      let tooltip = null;

      star.addEventListener('mouseenter', () => {
        const text = star.dataset.tooltip;
        if (!text) return;

        tooltip = createTooltip(text);
        positionTooltip(tooltip, star.getBoundingClientRect());
      });

      star.addEventListener('mouseleave', () => {
        removeTooltip(tooltip);
        tooltip = null;
      });
    });
  }

  // ===== HOVER =====
  // Модуль для работы с hover-подсказками

  // Ленивая загрузка зависимостей
  function getDOMCache() {
    if (typeof window !== 'undefined' && window.DOMCache) {
      return window.DOMCache;
    }
    throw new Error('DOMCache не загружен');
  }

  function debounce(func, wait) {
    if (typeof window !== 'undefined' && window.debounce) {
      return window.debounce(func, wait);
    }
    // Простая реализация debounce, если не загружена из radar-utils.js
    let timeout;
    return function(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }

  // Функция для получения текста подсказки с учетом незаполненных полей
  function getHoverText(tech) {
    if (!tech) return '';

    // Получаем зависимости из window
    const isRatingFilled = window.isRatingFilled || (() => false);
    const computePriority = window.computePriority || (() => null);
    const getPriorityCategory = window.getPriorityCategory || (() => ({ key: 'none', label: '' }));
    const getPriorityWeakLinkComment = window.getPriorityWeakLinkComment || (() => '');

    // Получаем текущее предприятие для проверки индивидуальных оценок
    let currentEnterprise = null;
    if (typeof window !== 'undefined') {
      if (window.StateAccessors && typeof window.StateAccessors.getCurrentEnterprise === 'function') {
        currentEnterprise = window.StateAccessors.getCurrentEnterprise();
      } else if (typeof window.getCurrentEnterprise === 'function') {
        currentEnterprise = window.getCurrentEnterprise();
      } else if (typeof window.currentEnterprise !== 'undefined') {
        currentEnterprise = window.currentEnterprise;
      }
    }

    // Проверяем оценки с учетом индивидуальных оценок для предприятий
    const companies = Array.isArray(tech.company) ? tech.company : (tech.company ? [tech.company] : []);
    let techRead, organRead;

    if (companies.length > 1 && tech.companyRatings && typeof tech.companyRatings === 'object' &&
        currentEnterprise && companies.includes(currentEnterprise) && tech.companyRatings[currentEnterprise]) {
      const ratings = tech.companyRatings[currentEnterprise];
      techRead = ratings.techRead !== undefined ? ratings.techRead : tech.techRead;
      organRead = ratings.organRead !== undefined ? ratings.organRead : tech.organRead;
    } else {
      techRead = tech.techRead;
      organRead = tech.organRead;
    }

    const techReadFilled = isRatingFilled(techRead);
    const organReadFilled = isRatingFilled(organRead);
    const hasReadinessRatings = techReadFilled && organReadFilled;

    // Если базовые оценки не заполнены — показываем текущее предупреждение.
    if (!hasReadinessRatings) {
      return `${tech.name}\nНеобходимо заполнить поля оценок!`;
    }

    const priority = computePriority(tech, 'mult');
    const category = getPriorityCategory(priority);

    if (priority == null || category.key === 'none') {
      return `${tech.name}\nНедостаточно данных для расчёта приоритета.`;
    }

    const percent = Math.round(priority * 100);
    const weakLinkComment = getPriorityWeakLinkComment(tech);

    // Многострочный hover: название → приоритет → краткий комментарий.
    return `${tech.name}\nПриоритет: ${percent}% (${category.label})\n${weakLinkComment}`;
  }

  function createDebouncedHover() {
    const DOMCache = getDOMCache();

    return debounce((tech, visible) => {
      const hoverLabel = DOMCache.get('hoverLabel');
      if (!hoverLabel) return;

      if (visible) {
        const text = tech ? getHoverText(tech) : '';
        hoverLabel.textContent = text;
        // Цвет подсказки один, классы категорий не используем
        hoverLabel.classList.remove('priority-low', 'priority-medium', 'priority-high');
        hoverLabel.style.opacity = "1";
      } else {
        hoverLabel.style.opacity = "0";
      }
    }, 100);
  }

  // Экспорт в window для обратной совместимости
  if (typeof window !== 'undefined') {
    // Tooltip exports
    window.TooltipModule = { init: initTooltips };

    // Hover exports
    window.Hover = {
      getHoverText,
      createDebouncedHover
    };
    window.getHoverText = getHoverText;
    window.debouncedHover = createDebouncedHover();

    // Инициализация tooltips
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initTooltips);
    } else {
      initTooltips();
    }
  }
})();
