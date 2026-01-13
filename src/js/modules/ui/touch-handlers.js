/**
 * Touch жесты
 * Модуль для обработки touch жестов: swipe, pinch-to-zoom, long press
 */

const TouchHandlers = {
  /**
   * Инициализация touch обработчиков
   */
  init() {
    // Инициализируем только на touch устройствах
    if (!this.isTouchDevice()) {
      return;
    }

    this.initSwipeGestures();
    this.initLongPress();
  },

  /**
   * Проверка, является ли устройство touch
   */
  isTouchDevice() {
    return (
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      navigator.msMaxTouchPoints > 0
    );
  },

  /**
   * Инициализация swipe жестов для модальных окон и сайдбара
   */
  initSwipeGestures() {
    // Swipe для закрытия модальных окон
    const modals = document.querySelectorAll('.modal-panel, .detail-panel');
    modals.forEach((modal) => {
      this.attachSwipeHandler(modal, {
        onSwipeLeft: () => this.closeModal(modal),
        onSwipeRight: () => this.closeModal(modal),
        threshold: 100, // Минимальное расстояние для swipe
        allowedDirections: ['left', 'right']
      });
    });

    // Swipe для сайдбара (только на мобильных)
    const sidebarWrapper = document.querySelector('.sidebar-wrapper');
    if (sidebarWrapper && window.innerWidth <= 767) {
      this.attachSidebarSwipe(sidebarWrapper);
    }

    // Swipe для выдвижного меню предприятий
    const mobileMenu = document.getElementById('mobileEnterpriseMenu');
    if (mobileMenu) {
      this.attachSwipeHandler(mobileMenu, {
        onSwipeUp: () => {
          const MobileNav = window.MobileNav;
          if (MobileNav) MobileNav.closeMenu();
        },
        threshold: 100,
        allowedDirections: ['up']
      });
    }
  },

  /**
   * Привязка swipe обработчика к элементу
   */
  attachSwipeHandler(element, options = {}) {
    if (!element) return;

    const {
      onSwipeLeft,
      onSwipeRight,
      onSwipeUp,
      onSwipeDown,
      threshold = 50,
      allowedDirections = ['left', 'right', 'up', 'down']
    } = options;

    let startX = 0;
    let startY = 0;
    let startTime = 0;
    let isSwipe = false;

    element.addEventListener(
      'touchstart',
      (e) => {
        const touch = e.touches[0];
        startX = touch.clientX;
        startY = touch.clientY;
        startTime = Date.now();
        isSwipe = false;

        // Предотвращаем прокрутку при начале swipe
        if (element.classList.contains('modal-panel') || element.classList.contains('detail-panel')) {
          element.style.overflow = 'hidden';
        }
      },
      { passive: true }
    );

    element.addEventListener(
      'touchmove',
      (e) => {
        if (!startX || !startY) return;

        const touch = e.touches[0];
        const diffX = touch.clientX - startX;
        const diffY = touch.clientY - startY;
        const distance = Math.sqrt(diffX * diffX + diffY * diffY);

        // Определяем направление swipe
        if (distance > 10 && !isSwipe) {
          const absX = Math.abs(diffX);
          const absY = Math.abs(diffY);

          if (absX > absY) {
            // Горизонтальный swipe
            isSwipe = absX > threshold;
            if (isSwipe && diffX < 0 && allowedDirections.includes('left') && onSwipeLeft) {
              onSwipeLeft();
            } else if (isSwipe && diffX > 0 && allowedDirections.includes('right') && onSwipeRight) {
              onSwipeRight();
            }
          } else {
            // Вертикальный swipe
            isSwipe = absY > threshold;
            if (isSwipe && diffY < 0 && allowedDirections.includes('up') && onSwipeUp) {
              onSwipeUp();
            } else if (isSwipe && diffY > 0 && allowedDirections.includes('down') && onSwipeDown) {
              onSwipeDown();
            }
          }
        }
      },
      { passive: true }
    );

    element.addEventListener('touchend', () => {
      startX = 0;
      startY = 0;
      startTime = 0;
      isSwipe = false;

      // Восстанавливаем прокрутку
      if (element.classList.contains('modal-panel') || element.classList.contains('detail-panel')) {
        element.style.overflow = '';
      }
    });
  },

  /**
   * Привязка swipe для сайдбара
   */
  attachSidebarSwipe(sidebarWrapper) {
    let startX = 0;
    let currentX = 0;
    let isDragging = false;

    // Swipe справа налево для открытия сайдбара (на основном контенте)
    const mainContent = document.querySelector('.main-content, .radar-container');
    if (mainContent && window.innerWidth <= 767) {
      mainContent.addEventListener(
        'touchstart',
        (e) => {
          if (sidebarWrapper.classList.contains('collapsed')) {
            startX = e.touches[0].clientX;
            isDragging = true;
          }
        },
        { passive: true }
      );

      mainContent.addEventListener(
        'touchmove',
        (e) => {
          if (!isDragging || !sidebarWrapper.classList.contains('collapsed')) return;

          currentX = e.touches[0].clientX;
          const diffX = startX - currentX;

          // Открываем сайдбар при swipe справа налево
          if (diffX > 100 && startX < 50) {
            sidebarWrapper.classList.remove('collapsed');
            sidebarWrapper.classList.add('expanded');
            isDragging = false;
          }
        },
        { passive: true }
      );

      mainContent.addEventListener('touchend', () => {
        isDragging = false;
      });
    }

    // Swipe слева направо для закрытия сайдбара (на самом сайдбаре)
    this.attachSwipeHandler(sidebarWrapper, {
      onSwipeRight: () => {
        if (sidebarWrapper.classList.contains('expanded')) {
          sidebarWrapper.classList.remove('expanded');
          sidebarWrapper.classList.add('collapsed');
        }
      },
      threshold: 100,
      allowedDirections: ['right']
    });
  },

  /**
   * Инициализация long press для контекстных меню
   */
  initLongPress() {
    const longPressElements = document.querySelectorAll('[data-long-press]');
    longPressElements.forEach((element) => {
      this.attachLongPressHandler(element);
    });
  },

  /**
   * Привязка long press обработчика
   */
  attachLongPressHandler(element, callback) {
    if (!element) return;

    const delay = parseInt(element.dataset.longPressDelay) || 500;
    let pressTimer = null;
    let hasLongPress = false;

    const handleTouchStart = (e) => {
      hasLongPress = false;
      pressTimer = setTimeout(() => {
        hasLongPress = true;
        if (callback) {
          callback(e);
        } else {
          // По умолчанию показываем вибрацию (если доступна)
          if (navigator.vibrate) {
            navigator.vibrate(50);
          }
          element.dispatchEvent(new CustomEvent('longpress', { bubbles: true }));
        }
      }, delay);

      // Предотвращаем контекстное меню
      e.preventDefault();
    };

    const handleTouchEnd = (e) => {
      clearTimeout(pressTimer);
      if (!hasLongPress) {
        // Обычный клик
        element.click();
      }
    };

    const handleTouchMove = () => {
      clearTimeout(pressTimer);
    };

    element.addEventListener('touchstart', handleTouchStart, { passive: false });
    element.addEventListener('touchend', handleTouchEnd);
    element.addEventListener('touchmove', handleTouchMove);
  },

  /**
   * Закрытие модального окна
   */
  closeModal(modal) {
    if (!modal) return;

    // Ищем кнопку закрытия
    const closeBtn = modal.querySelector('.close-btn, [data-close]');
    if (closeBtn) {
      closeBtn.click();
    } else {
      // Если нет кнопки, просто скрываем
      modal.classList.remove('active', 'open');
      modal.style.display = 'none';
    }
  },

  /**
   * Инициализация pinch-to-zoom для радара (опционально)
   */
  initPinchZoom(element) {
    if (!element || !this.isTouchDevice()) return;

    let lastDistance = 0;
    let initialScale = 1;
    let currentScale = 1;

    element.addEventListener(
      'touchstart',
      (e) => {
        if (e.touches.length === 2) {
          const touch1 = e.touches[0];
          const touch2 = e.touches[1];
          lastDistance = Math.hypot(
            touch2.clientX - touch1.clientX,
            touch2.clientY - touch1.clientY
          );
        }
      },
      { passive: true }
    );

    element.addEventListener(
      'touchmove',
      (e) => {
        if (e.touches.length === 2) {
          e.preventDefault();
          const touch1 = e.touches[0];
          const touch2 = e.touches[1];
          const distance = Math.hypot(
            touch2.clientX - touch1.clientX,
            touch2.clientY - touch1.clientY
          );

          if (lastDistance > 0) {
            const scale = distance / lastDistance;
            currentScale = Math.min(Math.max(initialScale * scale, 0.5), 3); // Ограничение масштаба

            // Применяем трансформацию (если нужно)
            // Это зависит от реализации радара
            if (element.tagName === 'svg') {
              const viewBox = element.getAttribute('viewBox');
              // Логика масштабирования SVG
            }
          }
          lastDistance = distance;
        }
      },
      { passive: false }
    );

    element.addEventListener('touchend', () => {
      if (lastDistance > 0) {
        initialScale = currentScale;
        lastDistance = 0;
      }
    });
  }
};

// Экспорт для использования в других модулях
if (typeof window !== 'undefined') {
  window.TouchHandlers = TouchHandlers;
}
