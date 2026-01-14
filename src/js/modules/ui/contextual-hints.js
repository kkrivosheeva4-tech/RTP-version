// contextual-hints.js
// Модуль контекстных подсказок для элементов интерфейса

(function() {
  'use strict';

  const STORAGE_KEY = 'rmk_contextual_hints';
  const STORAGE_ENABLED_KEY = 'rmk_contextual_hints_enabled';
  const DEFAULT_ENABLED = true;

  // Определение подсказок для элементов
  const HINTS = {
    // Кнопки навигации
    'searchIconBtn': {
      message: 'Используйте поиск для быстрого нахождения технологий по названию',
      position: 'bottom',
      showOnce: true
    },
    'filterIconBtn': {
      message: 'Фильтруйте технологии по различным критериям: блоки, функции, типы, статусы',
      position: 'bottom',
      showOnce: true
    },
    'resetIconBtn': {
      message: 'Сбросьте все примененные фильтры одним кликом',
      position: 'bottom',
      showOnce: true
    },
    'chartIconBtn': {
      message: 'Откройте график перспективных технологий для визуального анализа',
      position: 'bottom',
      showOnce: true
    },
    'reportIconBtn': {
      message: 'Экспортируйте данные радара в PDF для дальнейшего анализа',
      position: 'bottom',
      showOnce: true,
      conditional: () => {
        const btn = document.getElementById('reportIconBtn');
        return btn && !btn.classList.contains('hidden');
      }
    },
    'addIconBtn': {
      message: 'Добавьте новую технологию в радар (доступно для архитекторов)',
      position: 'bottom',
      showOnce: true,
      conditional: () => {
        const btn = document.getElementById('addIconBtn');
        return btn && !btn.classList.contains('hidden');
      }
    },
    // Фильтры
    'filter_block': {
      message: 'Выберите функциональные блоки для фильтрации технологий',
      position: 'right',
      showOnce: true
    },
    'filter_function': {
      message: 'Выберите функции для более точной фильтрации',
      position: 'right',
      showOnce: true
    },
    'filter_techType': {
      message: 'Фильтруйте по типу технологии: базовые, интегрированные, платформенные решения, ML/AI',
      position: 'right',
      showOnce: true
    },
    'filter_level': {
      message: 'Фильтруйте по статусу: используемые, внедряемые, перспективные',
      position: 'right',
      showOnce: true
    },
    // Радар
    'techRadar': {
      message: 'Кликните на любую технологию на радаре, чтобы увидеть детальную информацию',
      position: 'center',
      showOnce: true,
      delay: 2000 // Показываем через 2 секунды после загрузки
    },
    // Детальная панель
    'detailPanel': {
      message: 'Здесь отображается подробная информация о выбранной технологии',
      position: 'left',
      showOnce: true,
      waitForElement: true
    },
    // Модальные окна
    'exportPdfModal': {
      message: 'Выберите поля, которые хотите включить в экспорт PDF',
      position: 'center',
      showOnce: true,
      waitForElement: true
    },
    'addTechPanel': {
      message: 'Заполните форму для добавления новой технологии в радар',
      position: 'center',
      showOnce: true,
      waitForElement: true
    }
  };

  let enabled = DEFAULT_ENABLED;
  let seenHints = new Set();
  let activeHint = null;

  /**
   * Загружает настройки подсказок
   */
  function loadSettings() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        seenHints = new Set(JSON.parse(stored));
      } catch (e) {
        if (window.Logger) window.Logger.warn('Ошибка при загрузке настроек подсказок:', e);
        seenHints = new Set();
      }
    }

    const storedEnabled = localStorage.getItem(STORAGE_ENABLED_KEY);
    if (storedEnabled !== null) {
      enabled = storedEnabled === 'true';
    }
  }

  /**
   * Сохраняет настройки подсказок
   */
  function saveSettings() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(seenHints)));
    localStorage.setItem(STORAGE_ENABLED_KEY, enabled.toString());
  }

  /**
   * Проверяет, нужно ли показывать подсказку
   */
  function shouldShowHint(hintId) {
    if (!enabled) return false;
    const hint = HINTS[hintId];
    if (!hint) return false;
    if (hint.showOnce && seenHints.has(hintId)) return false;
    if (hint.conditional && !hint.conditional()) return false;
    return true;
  }

  /**
   * Отмечает подсказку как просмотренную
   */
  function markAsSeen(hintId) {
    seenHints.add(hintId);
    saveSettings();
  }

  /**
   * Создает элемент подсказки
   */
  function createHintElement(message, position = 'bottom') {
    const hint = document.createElement('div');
    hint.className = 'contextual-hint';
    hint.setAttribute('role', 'tooltip');
    hint.setAttribute('aria-live', 'polite');
    hint.innerHTML = `
      <div class="contextual-hint-content">
        <p class="contextual-hint-message">${message}</p>
        <button class="contextual-hint-close" aria-label="Закрыть подсказку">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
    `;
    return hint;
  }

  /**
   * Позиционирует подсказку относительно элемента
   */
  function positionHint(hint, element, position = 'bottom') {
    if (!element) {
      // Центрированное позиционирование
      hint.style.top = '50%';
      hint.style.left = '50%';
      hint.style.transform = 'translate(-50%, -50%)';
      return;
    }

    const rect = element.getBoundingClientRect();
    const hintRect = hint.getBoundingClientRect();
    const spacing = 12;
    let top, left;

    switch (position) {
      case 'top':
        top = rect.top - hintRect.height - spacing;
        left = rect.left + rect.width / 2 - hintRect.width / 2;
        break;
      case 'bottom':
        top = rect.bottom + spacing;
        left = rect.left + rect.width / 2 - hintRect.width / 2;
        break;
      case 'left':
        top = rect.top + rect.height / 2 - hintRect.height / 2;
        left = rect.left - hintRect.width - spacing;
        break;
      case 'right':
        top = rect.top + rect.height / 2 - hintRect.height / 2;
        left = rect.right + spacing;
        break;
      case 'center':
        top = window.innerHeight / 2 - hintRect.height / 2;
        left = window.innerWidth / 2 - hintRect.width / 2;
        break;
      default:
        top = rect.bottom + spacing;
        left = rect.left + rect.width / 2 - hintRect.width / 2;
    }

    // Проверяем границы экрана
    if (top < 10) top = 10;
    if (left < 10) left = 10;
    if (top + hintRect.height > window.innerHeight - 10) {
      top = window.innerHeight - hintRect.height - 10;
    }
    if (left + hintRect.width > window.innerWidth - 10) {
      left = window.innerWidth - hintRect.width - 10;
    }

    hint.style.top = `${top + window.scrollY}px`;
    hint.style.left = `${left + window.scrollX}px`;
    hint.style.transform = 'none';
  }

  /**
   * Показывает подсказку для элемента
   */
  function showHint(hintId, element = null) {
    if (!shouldShowHint(hintId)) return;

    const hintConfig = HINTS[hintId];
    if (!hintConfig) return;

    // Скрываем предыдущую подсказку
    hideHint();

    const hint = createHintElement(hintConfig.message, hintConfig.position);
    document.body.appendChild(hint);

    // Позиционируем подсказку
    const targetElement = element || (hintConfig.target ? document.querySelector(hintConfig.target) : null);
    setTimeout(() => {
      positionHint(hint, targetElement, hintConfig.position);
      hint.classList.add('visible');
    }, 10);

    // Добавляем обработчик закрытия
    const closeBtn = hint.querySelector('.contextual-hint-close');
    if (closeBtn) {
      closeBtn.onclick = () => {
        markAsSeen(hintId);
        hideHint();
      };
    }

    // Автоматическое скрытие через 5 секунд
    const autoHideTimeout = setTimeout(() => {
      markAsSeen(hintId);
      hideHint();
    }, 5000);

    // Сохраняем ссылку на активную подсказку и таймер
    activeHint = {
      element: hint,
      timeout: autoHideTimeout,
      hintId: hintId
    };

    // Прокручиваем к элементу, если нужно
    if (targetElement) {
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    }
  }

  /**
   * Скрывает активную подсказку
   */
  function hideHint() {
    if (activeHint) {
      if (activeHint.timeout) {
        clearTimeout(activeHint.timeout);
      }
      if (activeHint.element && activeHint.element.parentNode) {
        activeHint.element.classList.remove('visible');
        setTimeout(() => {
          if (activeHint.element && activeHint.element.parentNode) {
            activeHint.element.remove();
          }
        }, 300);
      }
      activeHint = null;
    }
  }

  /**
   * Показывает подсказку при первом использовании функции
   */
  function showHintOnFirstUse(hintId, element = null) {
    if (!enabled) return;
    if (seenHints.has(hintId)) return;

    const hintConfig = HINTS[hintId];
    if (!hintConfig) return;

    // Проверяем условие
    if (hintConfig.conditional && !hintConfig.conditional()) return;

    // Ждем появления элемента, если нужно
    if (hintConfig.waitForElement) {
      const checkElement = () => {
        const targetElement = element || (hintConfig.target ? document.querySelector(hintConfig.target) : null);
        if (targetElement && targetElement.offsetParent !== null) {
          setTimeout(() => showHint(hintId, targetElement), hintConfig.delay || 0);
        } else {
          setTimeout(checkElement, 100);
        }
      };
      checkElement();
    } else {
      setTimeout(() => showHint(hintId, element), hintConfig.delay || 0);
    }
  }

  /**
   * Включает/выключает подсказки
   */
  function setEnabled(value) {
    enabled = value;
    saveSettings();
    if (!enabled) {
      hideHint();
    }
  }

  /**
   * Сбрасывает все просмотренные подсказки
   */
  function resetSeenHints() {
    seenHints.clear();
    saveSettings();
  }

  /**
   * Инициализирует подсказки для элементов
   */
  function initHints() {
    loadSettings();

    // Подсказки для кнопок при первом клике
    const buttonHints = ['searchIconBtn', 'filterIconBtn', 'resetIconBtn', 'chartIconBtn', 'reportIconBtn', 'addIconBtn'];
    buttonHints.forEach(buttonId => {
      const button = document.getElementById(buttonId);
      if (button) {
        button.addEventListener('click', function() {
          showHintOnFirstUse(buttonId, button);
        }, { once: true });
      }
    });

    // Подсказка для радара после загрузки
    if (shouldShowHint('techRadar')) {
      const radar = document.getElementById('techRadar');
      if (radar) {
        setTimeout(() => {
          showHintOnFirstUse('techRadar', radar);
        }, 2000);
      }
    }

    // Подсказки для фильтров при первом открытии - отключены
    // const filterIds = ['filter_block', 'filter_function', 'filter_techType', 'filter_level'];
    // filterIds.forEach(filterId => {
    //   const filter = document.getElementById(filterId);
    //   if (filter) {
    //     const parent = filter.closest('.custom-select');
    //     if (parent) {
    //       parent.addEventListener('click', function() {
    //         showHintOnFirstUse(filterId, parent);
    //       }, { once: true });
    //     }
    //   }
    // });
  }

  // Экспорт модуля
  const ContextualHints = {
    init: initHints,
    show: showHint,
    hide: hideHint,
    showOnFirstUse: showHintOnFirstUse,
    markAsSeen,
    shouldShow: shouldShowHint,
    setEnabled,
    isEnabled: () => enabled,
    resetSeenHints
  };

  if (typeof window !== 'undefined') {
    window.ContextualHints = ContextualHints;
  }

  // Автоматическая инициализация - ОТКЛЮЧЕНА
  // if (document.readyState === 'loading') {
  //   document.addEventListener('DOMContentLoaded', initHints);
  // } else {
  //   setTimeout(initHints, 500); // Небольшая задержка для загрузки элементов
  // }
})();
