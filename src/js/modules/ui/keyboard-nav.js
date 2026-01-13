// Модуль клавиатурной навигации
// Обеспечивает полную навигацию с клавиатуры и keyboard shortcuts
// Экспортирует функции в window.KeyboardNav для использования в других модулях

(function() {
  'use strict';

  // Конфигурация keyboard shortcuts
  const shortcuts = {
    escape: {
      keys: ['Escape'],
      handler: handleEscape,
      description: 'Закрыть модальное окно или меню'
    },
    search: {
      keys: ['f', 'F'],
      modifiers: ['ctrlKey', 'metaKey'],
      handler: handleSearch,
      description: 'Фокус на поиск'
    },
    save: {
      keys: ['s', 'S'],
      modifiers: ['ctrlKey', 'metaKey'],
      handler: handleSave,
      description: 'Сохранить изменения (если применимо)'
    }
  };

  // Обработчик Escape
  function handleEscape(e) {
    // Закрыть модальные окна
    const openModals = document.querySelectorAll('.modal-panel.open, .modal-panel:not(.hidden)[style*="block"]');
    if (openModals.length > 0) {
      const lastModal = openModals[openModals.length - 1];
      if (window.hideModal) {
        window.hideModal(lastModal.id || lastModal);
        e.preventDefault();
        return true;
      }
    }

    // Закрыть детальную панель
    const detailPanel = document.getElementById('detailPanel');
    if (detailPanel && detailPanel.classList.contains('open')) {
      const closeBtn = detailPanel.querySelector('#closeDetailPanel');
      if (closeBtn) {
        closeBtn.click();
        e.preventDefault();
        return true;
      }
    }

    // Закрыть сайдбар на мобильных
    const sidebar = document.getElementById('sidebar');
    if (sidebar && sidebar.classList.contains('open')) {
      const toggleBtn = document.getElementById('toggleSidebarBtn');
      if (toggleBtn) {
        toggleBtn.click();
        e.preventDefault();
        return true;
      }
    }

    // Закрыть мобильное меню
    const mobileMenu = document.querySelector('.mobile-menu.open');
    if (mobileMenu) {
      const closeBtn = mobileMenu.querySelector('.mobile-menu-close');
      if (closeBtn) {
        closeBtn.click();
        e.preventDefault();
        return true;
      }
    }

    return false;
  }

  // Обработчик поиска (Ctrl+F / Cmd+F)
  function handleSearch(e) {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      searchInput.focus();
      searchInput.select();
      e.preventDefault();
      return true;
    }
    return false;
  }

  // Обработчик сохранения (Ctrl+S / Cmd+S)
  function handleSave(e) {
    // Проверяем, есть ли активная форма для сохранения
    const activeModal = document.querySelector('.modal-panel.open form');
    if (activeModal) {
      const submitBtn = activeModal.querySelector('button[type="submit"]');
      if (submitBtn && !submitBtn.disabled) {
        // Проверяем, можно ли сохранить (форма валидна)
        if (activeModal.checkValidity && activeModal.checkValidity()) {
          submitBtn.click();
          e.preventDefault();
          return true;
        }
      }
    }
    return false;
  }

  // Основной обработчик клавиатуры
  function handleKeyDown(e) {
    // Обработка Escape
    if (e.key === 'Escape') {
      if (handleEscape(e)) return;
    }

    // Обработка Ctrl+F / Cmd+F для поиска
    if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F')) {
      if (handleSearch(e)) return;
    }

    // Обработка Ctrl+S / Cmd+S для сохранения
    if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
      if (handleSave(e)) return;
    }

    // Обработка Enter и Space для активации элементов
    if (e.key === 'Enter' || e.key === ' ') {
      const activeElement = document.activeElement;

      // Если фокус на кнопке без обработчика клика или на элементе с role="button"
      if (activeElement && (
        activeElement.tagName === 'BUTTON' ||
        activeElement.getAttribute('role') === 'button' ||
        activeElement.classList.contains('custom-select') ||
        activeElement.classList.contains('custom-select-modal')
      )) {
        // Предотвращаем стандартное поведение только для Space
        if (e.key === ' ') {
          e.preventDefault();
        }
        // Симулируем клик
        if (activeElement.click && typeof activeElement.click === 'function') {
          activeElement.click();
        }
        return;
      }
    }

    // Навигация по выпадающим спискам
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const activeElement = document.activeElement;
      if (activeElement && (
        activeElement.classList.contains('custom-select') ||
        activeElement.classList.contains('custom-select-modal')
      )) {
        // Если список не открыт, открываем его
        if (!activeElement.classList.contains('open')) {
          e.preventDefault();
          activeElement.click();
          return;
        }
        // Если список открыт, навигация обрабатывается в forms.js
      }
    }
  }

  // Инициализация модуля
  function init() {
    // Добавляем глобальный обработчик клавиатуры
    document.addEventListener('keydown', handleKeyDown);

    // Улучшаем табуляцию: добавляем tabindex для интерактивных элементов без него
    enhanceTabNavigation();

    // Улучшаем визуальную индикацию фокуса
    enhanceFocusIndicators();
  }

  // Улучшение навигации Tab
  function enhanceTabNavigation() {
    // Добавляем tabindex="0" для интерактивных элементов без него
    const interactiveElements = document.querySelectorAll(
      'button:not([tabindex]), ' +
      'a:not([tabindex]), ' +
      'input:not([tabindex]), ' +
      'select:not([tabindex]), ' +
      'textarea:not([tabindex]), ' +
      '[role="button"]:not([tabindex]), ' +
      '.custom-select:not([tabindex]), ' +
      '.custom-select-modal:not([tabindex])'
    );

    interactiveElements.forEach(el => {
      // Пропускаем скрытые элементы
      if (el.offsetParent === null || el.classList.contains('hidden')) {
        return;
      }

      // Если элемент не имеет tabindex, добавляем tabindex="0"
      if (!el.hasAttribute('tabindex')) {
        el.setAttribute('tabindex', '0');
      }
    });

    // Устанавливаем tabindex="-1" для элементов, которые не должны быть доступны через Tab
    const skipTabElements = document.querySelectorAll(
      '.hidden, [aria-hidden="true"]:not([role="dialog"]), .blip'
    );
    skipTabElements.forEach(el => {
      if (el.hasAttribute('tabindex') && el.getAttribute('tabindex') === '0') {
        el.setAttribute('tabindex', '-1');
      }
    });
  }

  // Улучшение визуальной индикации фокуса
  function enhanceFocusIndicators() {
    // Добавляем класс для отслеживания использования клавиатуры
    let usingKeyboard = false;

    // Отслеживаем использование мыши
    document.addEventListener('mousedown', () => {
      usingKeyboard = false;
      document.body.classList.remove('keyboard-navigation');
    });

    // Отслеживаем использование клавиатуры
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        usingKeyboard = true;
        document.body.classList.add('keyboard-navigation');
      }
    });

    // Добавляем визуальную индикацию для элементов с фокусом
    document.addEventListener('focusin', (e) => {
      const target = e.target;
      if (usingKeyboard && target) {
        target.classList.add('keyboard-focused');
      }
    });

    document.addEventListener('focusout', (e) => {
      const target = e.target;
      if (target) {
        target.classList.remove('keyboard-focused');
      }
    });
  }

  // Обновление tabindex при динамическом добавлении элементов
  function updateTabNavigation() {
    enhanceTabNavigation();
  }

  // Экспорт функций
  window.KeyboardNav = {
    init,
    handleEscape,
    handleSearch,
    handleSave,
    updateTabNavigation
  };

  // Инициализация при загрузке DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
