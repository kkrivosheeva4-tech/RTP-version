// Модуль управления ARIA атрибутами
// ES module — поддержка screen readers через ARIA атрибуты и роли

'use strict';

  // Инициализация ARIA атрибутов для существующих элементов
  function init() {
    // Добавляем ARIA атрибуты для основных элементов
    enhanceHeader();
    enhanceNavigation();
    enhanceButtons();
    enhanceForms();
    enhanceModals();
    enhanceDynamicContent();

    // Устанавливаем aria-live регионы для динамического контента
    setupAriaLiveRegions();
  }

  // Улучшение header
  function enhanceHeader() {
    const header = document.querySelector('header');
    if (header && !header.getAttribute('role')) {
      header.setAttribute('role', 'banner');
    }
  }

  // Улучшение навигации
  function enhanceNavigation() {
    // Основная навигация
    const navElements = document.querySelectorAll('nav');
    navElements.forEach(nav => {
      if (!nav.getAttribute('role')) {
        nav.setAttribute('role', 'navigation');
      }
      if (!nav.getAttribute('aria-label')) {
        nav.setAttribute('aria-label', 'Основная навигация');
      }
    });

    // Мобильное меню
    const mobileMenu = document.querySelector('.mobile-menu');
    if (mobileMenu && !mobileMenu.getAttribute('role')) {
      mobileMenu.setAttribute('role', 'navigation');
      mobileMenu.setAttribute('aria-label', 'Мобильное меню');
      if (!mobileMenu.getAttribute('aria-expanded')) {
        mobileMenu.setAttribute('aria-expanded', 'false');
      }
    }
  }

  // Улучшение кнопок
  function enhanceButtons() {
    // Кнопки без текста должны иметь aria-label
    const iconButtons = document.querySelectorAll('button:not([aria-label]):not([aria-labelledby])');
    iconButtons.forEach(btn => {
      const tooltip = btn.getAttribute('data-tooltip');
      if (tooltip) {
        btn.setAttribute('aria-label', tooltip);
      } else {
        // Пытаемся найти текст в SVG или иконке
        const svg = btn.querySelector('svg[aria-label]');
        if (svg) {
          btn.setAttribute('aria-label', svg.getAttribute('aria-label'));
        } else {
          // Используем title или data-tooltip из родителя
          const title = btn.getAttribute('title') || btn.textContent.trim();
          if (title) {
            btn.setAttribute('aria-label', title);
          }
        }
      }
    });

    // Кнопки переключения должны иметь aria-pressed
    const toggleButtons = document.querySelectorAll('button[data-toggle], button[aria-pressed]');
    toggleButtons.forEach(btn => {
      if (!btn.hasAttribute('aria-pressed')) {
        const isPressed = btn.classList.contains('active') || btn.getAttribute('aria-pressed') === 'true';
        btn.setAttribute('aria-pressed', isPressed.toString());
      }
    });

    // Кнопки с выпадающими меню
    const dropdownButtons = document.querySelectorAll('.custom-select, .custom-select-modal');
    dropdownButtons.forEach(btn => {
      if (!btn.getAttribute('role')) {
        btn.setAttribute('role', 'combobox');
      }
      if (!btn.hasAttribute('aria-expanded')) {
        btn.setAttribute('aria-expanded', 'false');
      }
      if (!btn.hasAttribute('aria-haspopup')) {
        btn.setAttribute('aria-haspopup', 'listbox');
      }
    });
  }

  // Улучшение форм
  function enhanceForms() {
    // Поля ввода
    const inputs = document.querySelectorAll('input, textarea, select');
    inputs.forEach(input => {
      // Связываем label с input через id
      if (input.id && !input.getAttribute('aria-labelledby')) {
        const label = document.querySelector(`label[for="${input.id}"]`);
        if (label && !label.id) {
          label.id = `${input.id}-label`;
        }
        if (label && label.id) {
          input.setAttribute('aria-labelledby', label.id);
        }
      }

      // Добавляем aria-required для обязательных полей
      if (input.hasAttribute('required') && !input.hasAttribute('aria-required')) {
        input.setAttribute('aria-required', 'true');
      }

      // Добавляем aria-invalid для невалидных полей
      if (input.hasAttribute('aria-invalid')) {
        // Уже установлено
      } else if (input.validity && !input.validity.valid) {
        input.setAttribute('aria-invalid', 'true');
      }
    });

    // Группы полей
    const fieldGroups = document.querySelectorAll('.form-group');
    fieldGroups.forEach(group => {
      if (!group.getAttribute('role')) {
        group.setAttribute('role', 'group');
      }
    });
  }

  // Улучшение модальных окон
  function enhanceModals() {
    const modals = document.querySelectorAll('.modal-panel, .detail-panel');
    modals.forEach(modal => {
      if (!modal.getAttribute('role')) {
        modal.setAttribute('role', 'dialog');
      }
      if (!modal.getAttribute('aria-modal')) {
        modal.setAttribute('aria-modal', 'true');
      }
      if (!modal.getAttribute('aria-labelledby')) {
        const title = modal.querySelector('h2, .modal-header h2, .detail-header h2');
        if (title) {
          if (!title.id) {
            title.id = `${modal.id || 'modal'}-title`;
          }
          modal.setAttribute('aria-labelledby', title.id);
        }
      }
    });

    // Кнопки закрытия модальных окон
    const closeButtons = document.querySelectorAll('.close-btn, [aria-label*="Закрыть"]');
    closeButtons.forEach(btn => {
      if (!btn.getAttribute('aria-label')) {
        btn.setAttribute('aria-label', 'Закрыть');
      }
    });
  }

  // Улучшение динамического контента
  function enhanceDynamicContent() {
    // Сайдбар
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
      if (!sidebar.getAttribute('role')) {
        sidebar.setAttribute('role', 'complementary');
      }
      if (!sidebar.getAttribute('aria-label')) {
        sidebar.setAttribute('aria-label', 'Боковая панель');
      }
      if (!sidebar.hasAttribute('aria-expanded')) {
        sidebar.setAttribute('aria-expanded', sidebar.classList.contains('open') ? 'true' : 'false');
      }
    }

    // Детальная панель
    const detailPanel = document.getElementById('detailPanel');
    if (detailPanel) {
      if (!detailPanel.getAttribute('role')) {
        detailPanel.setAttribute('role', 'dialog');
      }
      if (!detailPanel.getAttribute('aria-label')) {
        detailPanel.setAttribute('aria-label', 'Детальная информация о технологии');
      }
    }

    // Радар
    const radar = document.getElementById('techRadar');
    if (radar) {
      if (!radar.getAttribute('role')) {
        radar.setAttribute('role', 'img');
      }
      if (!radar.getAttribute('aria-label')) {
        radar.setAttribute('aria-label', 'Интерактивный радар технологий');
      }
    }

    // Main контент
    const main = document.querySelector('main, .main-content');
    if (main && !main.getAttribute('role')) {
      main.setAttribute('role', 'main');
    }
  }

  // Настройка aria-live регионов для динамического контента
  function setupAriaLiveRegions() {
    // Создаем скрытые регионы для уведомлений
    let statusRegion = document.getElementById('aria-live-status');
    if (!statusRegion) {
      statusRegion = document.createElement('div');
      statusRegion.id = 'aria-live-status';
      statusRegion.setAttribute('role', 'status');
      statusRegion.setAttribute('aria-live', 'polite');
      statusRegion.setAttribute('aria-atomic', 'true');
      statusRegion.className = 'sr-only';
      document.body.appendChild(statusRegion);
    }

    // Создаем регион для важных алертов
    let alertRegion = document.getElementById('aria-live-alert');
    if (!alertRegion) {
      alertRegion = document.createElement('div');
      alertRegion.id = 'aria-live-alert';
      alertRegion.setAttribute('role', 'alert');
      alertRegion.setAttribute('aria-live', 'assertive');
      alertRegion.setAttribute('aria-atomic', 'true');
      alertRegion.className = 'sr-only';
      document.body.appendChild(alertRegion);
    }
  }

  // Обновление ARIA атрибутов для динамически добавленных элементов
  function updateAriaAttributes(element) {
    if (!element) return;

    // Проверяем тип элемента и применяем соответствующие улучшения
    if (element.matches('button, [role="button"]')) {
      enhanceButtons.call({}, [element]);
    } else if (element.matches('input, textarea, select')) {
      enhanceForms.call({}, [element]);
    } else if (element.matches('.modal-panel, .detail-panel')) {
      enhanceModals.call({}, [element]);
    } else if (element.matches('nav')) {
      enhanceNavigation.call({}, [element]);
    }
  }

  // Обновление aria-expanded для выпадающих элементов
  function updateAriaExpanded(element, isExpanded) {
    if (element) {
      element.setAttribute('aria-expanded', isExpanded.toString());
    }
  }

  // Обновление aria-selected для элементов списка
  function updateAriaSelected(element, isSelected) {
    if (element) {
      element.setAttribute('aria-selected', isSelected.toString());
    }
  }

  // Обновление aria-pressed для кнопок переключения
  function updateAriaPressed(element, isPressed) {
    if (element) {
      element.setAttribute('aria-pressed', isPressed.toString());
    }
  }

  // Объявление для screen readers
  function announceToScreenReader(message, priority = 'polite') {
    const regionId = priority === 'assertive' ? 'aria-live-alert' : 'aria-live-status';
    const region = document.getElementById(regionId);
    if (region) {
      region.textContent = message;
      // Очищаем после объявления для возможности повторного объявления того же сообщения
      setTimeout(() => {
        region.textContent = '';
      }, 1000);
    }
  }

  // Экспорт функций (базовые функции)
  const AriaManager = {
    init,
    updateAriaAttributes,
    updateAriaExpanded,
    updateAriaSelected,
    updateAriaPressed,
    announceToScreenReader
  };

  if (typeof window !== 'undefined') {
    window.AriaManager = AriaManager;
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Обновление ARIA при изменении DOM (MutationObserver)
  if (window.MutationObserver) {
    let pendingMutations = [];
    let rafScheduled = false;
    let isExportModalLoading = false;
    let exportModalLoadTimeout = null;

    // Функция для проверки, нужно ли пропустить обработку элемента
    function shouldSkipElement(node) {
      if (!node || node.nodeType !== 1) return true;

      // Пропускаем обработку элементов внутри .select-options (фильтры)
      // так как они обрабатываются отдельно и часто пересоздаются массово
      if (node.closest && node.closest('.select-options')) {
        return true;
      }

      // Пропускаем обработку элементов внутри #exportPdfModal во время его загрузки
      if (isExportModalLoading) {
        const exportModal = document.getElementById('exportPdfModal');
        if (exportModal && (node === exportModal || exportModal.contains(node))) {
          return true;
        }
      }

      return false;
    }

    // Обработка узлов батчами с ограничением времени выполнения
    const processBatch = (nodes, startIndex, batchSize = 50) => {
      const endIndex = Math.min(startIndex + batchSize, nodes.length);
      const startTime = performance.now();
      const MAX_TIME = 8; // Максимальное время обработки батча в миллисекундах

      for (let i = startIndex; i < endIndex; i++) {
        // Проверяем время выполнения и прерываем, если превысили лимит
        if (performance.now() - startTime > MAX_TIME) {
          // Планируем обработку оставшихся узлов в следующем кадре
          if (i < nodes.length) {
            requestAnimationFrame(() => processBatch(nodes, i, batchSize));
          }
          return;
        }

        const node = nodes[i];
        if (shouldSkipElement(node)) {
          continue;
        }

        updateAriaAttributes(node);

        // Также проверяем дочерние элементы (но не внутри .select-options)
        if (node.querySelectorAll && !shouldSkipElement(node)) {
          // Используем более эффективный селектор - только прямые дочерние элементы
          const directChildren = Array.from(node.children || []);
          directChildren.forEach(el => {
            if (!shouldSkipElement(el)) {
              updateAriaAttributes(el);
            }
          });
        }
      }

      // Если есть еще узлы для обработки, планируем следующий батч
      if (endIndex < nodes.length) {
        requestAnimationFrame(() => processBatch(nodes, endIndex, batchSize));
      }
    };

    const processPendingMutations = () => {
      // Собираем все добавленные узлы из всех pending мутаций
      const nodesToProcess = new Set();
      pendingMutations.forEach(mutations => {
        mutations.forEach(mutation => {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === 1) { // Element node
              nodesToProcess.add(node);
            }
          });
        });
      });

      // Преобразуем Set в массив для более эффективной обработки
      const nodesArray = Array.from(nodesToProcess);

      // Очищаем pending мутации
      pendingMutations = [];
      rafScheduled = false;

      // Если узлов много, обрабатываем батчами
      if (nodesArray.length > 0) {
        processBatch(nodesArray, 0);
      }
    };

    // Дебаунсинг для обработки мутаций - накапливаем изменения и обрабатываем их батчами
    let debounceTimer = null;
    const scheduleProcessing = () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      debounceTimer = setTimeout(() => {
        if (!rafScheduled) {
          rafScheduled = true;
          requestAnimationFrame(processPendingMutations);
        }
        debounceTimer = null;
      }, 16); // ~60fps
    };

    const observer = new MutationObserver(mutations => {
      pendingMutations.push(mutations);
      scheduleProcessing();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Отслеживание загрузки модального окна экспорта
    AriaManager.setExportModalLoading = (loading) => {
      isExportModalLoading = loading;
      if (loading) {
        // Автоматически сбрасываем флаг через 2 секунды (достаточно для загрузки)
        if (exportModalLoadTimeout) {
          clearTimeout(exportModalLoadTimeout);
        }
        exportModalLoadTimeout = setTimeout(() => {
          isExportModalLoading = false;
        }, 2000);
      } else {
        if (exportModalLoadTimeout) {
          clearTimeout(exportModalLoadTimeout);
          exportModalLoadTimeout = null;
        }
        // Обрабатываем накопленные мутации после загрузки модального окна
        if (pendingMutations.length > 0) {
          requestAnimationFrame(processPendingMutations);
        }
      }
    };
  }

export default AriaManager;
