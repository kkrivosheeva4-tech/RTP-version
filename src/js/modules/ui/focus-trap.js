// focus-trap.js — ES module
// Управление фокусом в модальных окнах и диалогах

let savedFocusElement = null;
let activeTrap = null;

  /**
   * Получает все фокусируемые элементы внутри контейнера
   */
  function getFocusableElements(container) {
    if (!container) return [];

    const focusableSelectors = [
      'a[href]',
      'button:not([disabled])',
      'textarea:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      '[tabindex]:not([tabindex="-1"])'
    ].join(', ');

    return Array.from(container.querySelectorAll(focusableSelectors))
      .filter(el => {
        // Фильтруем скрытые элементы
        const style = window.getComputedStyle(el);
        return style.display !== 'none' &&
               style.visibility !== 'hidden' &&
               style.opacity !== '0';
      });
  }

  /**
   * Активирует focus trap для модального окна
   */
  function trapFocus(container) {
    if (!container) return;

    // Сохраняем текущий активный элемент
    savedFocusElement = document.activeElement;

    // Получаем фокусируемые элементы
    const focusableElements = getFocusableElements(container);

    if (focusableElements.length === 0) {
      // Если нет фокусируемых элементов, фокусируем сам контейнер
      container.setAttribute('tabindex', '-1');
      container.focus();
      activeTrap = container;
      return;
    }

    // Фокусируем первый элемент
    const firstElement = focusableElements[0];
    firstElement.focus();
    activeTrap = container;

    // Обработчик для Tab
    const handleTab = (e) => {
      if (e.key !== 'Tab') return;

      const focusable = getFocusableElements(container);
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        // Shift + Tab
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        // Tab
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    // Обработчик для Escape
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        // Позволяем обработчикам модалки обработать Escape
        // Если модалка не закрывается, это не наша ответственность
        return;
      }
    };

    container.addEventListener('keydown', handleTab);
    container.addEventListener('keydown', handleEscape);

    // Сохраняем обработчики для последующего удаления
    container._focusTrapHandlers = { handleTab, handleEscape };
  }

  /**
   * Деактивирует focus trap и восстанавливает фокус
   */
  function releaseFocus() {
    if (activeTrap && activeTrap._focusTrapHandlers) {
      const { handleTab, handleEscape } = activeTrap._focusTrapHandlers;
      activeTrap.removeEventListener('keydown', handleTab);
      activeTrap.removeEventListener('keydown', handleEscape);
      delete activeTrap._focusTrapHandlers;

      if (activeTrap.hasAttribute('tabindex')) {
        activeTrap.removeAttribute('tabindex');
      }
    }

    // Восстанавливаем фокус на сохраненный элемент
    if (savedFocusElement && savedFocusElement.focus) {
      try {
        savedFocusElement.focus();
      } catch (e) {
        // Игнорируем ошибки фокусировки (элемент может быть удален)
        if (typeof window !== 'undefined' && window.Logger) window.Logger.debug('Не удалось восстановить фокус:', e);
      }
    }

    savedFocusElement = null;
    activeTrap = null;
  }

  const FocusTrap = { trap: trapFocus, release: releaseFocus };
  if (typeof window !== 'undefined') window.FocusTrap = FocusTrap;
  export default FocusTrap;
