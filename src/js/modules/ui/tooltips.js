// tooltips.js — ES module
// Подсказки (tooltip и hover)

import { DOMCache } from '../core/dom-utils.js';

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

  // Функция для получения текста подсказки
  function getHoverText(tech) {
    if (!tech) return '';

    // Показываем название и описание технологии
    const description = tech.description ? `\n${tech.description.substring(0, 100)}${tech.description.length > 100 ? '...' : ''}` : '';
    return `${tech.name}${description}`;
  }

  function createDebouncedHover() {
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

  if (typeof window !== 'undefined') {
    window.TooltipModule = { init: initTooltips };
    window.Hover = { getHoverText, createDebouncedHover };
    window.getHoverText = getHoverText;
    window.debouncedHover = createDebouncedHover();
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initTooltips);
    } else {
      initTooltips();
    }
  }

  export { initTooltips, getHoverText, createDebouncedHover };
  export default { init: initTooltips, getHoverText, createDebouncedHover };
