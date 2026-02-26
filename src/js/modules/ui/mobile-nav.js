/**
 * Мобильная навигация
 * Модуль для управления бургер-меню и выдвижным меню предприятий на мобильных устройствах
 * ES module
 */

import Logger from '../core/logger.js';

const MobileNav = {
  /**
   * Инициализация мобильной навигации
   */
  init() {
    // Всегда создаем элементы, но они будут скрыты через CSS на больших экранах
    try {
      this.createBurgerMenu();
      this.createMobileMenu();
      this.attachEventListeners();
    } catch (error) {
      Logger.warn('Ошибка инициализации MobileNav:', error);
    }
  },

  /**
   * Создание кнопки бургер-меню
   */
  createBurgerMenu() {
    const header = document.querySelector('header');
    if (!header) {
      Logger.warn('MobileNav: header не найден');
      return;
    }

    const controls = header.querySelector('.controls');
    if (!controls) {
      Logger.warn('MobileNav: .controls не найден в header');
      return;
    }

    // Проверяем, не создана ли уже кнопка
    if (document.getElementById('burgerMenuBtn')) {
      return;
    }

    const burgerBtn = document.createElement('button');
    burgerBtn.id = 'burgerMenuBtn';
    burgerBtn.className = 'burger-menu-btn';
    burgerBtn.setAttribute('aria-label', 'Открыть меню');
    burgerBtn.setAttribute('aria-expanded', 'false');

    const icon = document.createElement('div');
    icon.className = 'burger-menu-icon';
    for (let i = 0; i < 3; i++) {
      const span = document.createElement('span');
      icon.appendChild(span);
    }

    burgerBtn.appendChild(icon);
    controls.insertBefore(burgerBtn, controls.firstChild);
  },

  /**
   * Создание выдвижного меню со всеми элементами
   */
  createMobileMenu() {
    const header = document.querySelector('header');
    if (!header) return;

    // Проверяем, не создано ли уже меню
    if (document.getElementById('mobileEnterpriseMenu')) return;

    const mobileMenu = document.createElement('div');
    mobileMenu.id = 'mobileEnterpriseMenu';
    mobileMenu.className = 'mobile-enterprise-menu';
    mobileMenu.setAttribute('aria-hidden', 'true');

    // Секция «Помощь», «Уведомления» и переключатель темы
    const helpBtn = header.querySelector('#helpBtn');
    const notificationsBtn = header.querySelector('#notificationsBtn');
    const themeToggle = header.querySelector('#themeToggle');
    if (helpBtn || notificationsBtn || themeToggle) {
      const quickSection = document.createElement('div');
      quickSection.className = 'mobile-menu-section';

      if (notificationsBtn) {
        const notifBtn = document.createElement('button');
        notifBtn.type = 'button';
        notifBtn.className = 'mobile-menu-btn mobile-menu-action-btn';
        notifBtn.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
          </svg>
          <span>Уведомления</span>
        `;
        notifBtn.addEventListener('click', (e) => {
          e.preventDefault();
          notificationsBtn.click();
          this.closeMenu();
        });
        quickSection.appendChild(notifBtn);
      }

      if (helpBtn) {
        const isRMKPage = window.location.pathname.includes('radar.html') || window.location.href.includes('radar.html');
        const helpWrapper = document.createElement('div');
        helpWrapper.className = 'mobile-menu-help-wrapper';

        const helpMenuBtn = document.createElement('button');
        helpMenuBtn.type = 'button';
        helpMenuBtn.className = 'mobile-menu-btn mobile-menu-action-btn mobile-menu-help-trigger';
        helpMenuBtn.setAttribute('aria-expanded', 'false');
        helpMenuBtn.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
          <span>Помощь</span>
          <svg class="mobile-menu-help-chevron" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6,9 12,15 18,9"></polyline>
          </svg>
        `;
        helpMenuBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const expanded = helpWrapper.classList.toggle('expanded');
          helpMenuBtn.setAttribute('aria-expanded', String(expanded));
        });
        helpWrapper.appendChild(helpMenuBtn);

        const helpSub = document.createElement('div');
        helpSub.className = 'mobile-menu-help-sub';

        if (isRMKPage) {
          const tourBtn = document.createElement('button');
          tourBtn.type = 'button';
          tourBtn.className = 'mobile-menu-btn mobile-menu-action-btn mobile-menu-help-sub-btn';
          tourBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M12 16v-4"></path>
              <path d="M12 8h.01"></path>
            </svg>
            <span>Интерактивный тур</span>
          `;
          tourBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (window.OnboardingTour && typeof window.OnboardingTour.startTour === 'function') {
              window.OnboardingTour.startTour();
            } else {
              Logger.warn('OnboardingTour модуль не загружен');
              if (window.Toast) {
                window.Toast.error('Модуль обучения не загружен. Пожалуйста, обновите страницу.');
              } else {
                alert('Модуль обучения не загружен. Пожалуйста, обновите страницу.');
              }
            }
            this.closeMenu();
          });
          helpSub.appendChild(tourBtn);
        }

        const helpLinkBtn = document.createElement('button');
        helpLinkBtn.type = 'button';
        helpLinkBtn.className = 'mobile-menu-btn mobile-menu-action-btn mobile-menu-help-sub-btn';
        helpLinkBtn.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
          </svg>
          <span>Справка</span>
        `;
        helpLinkBtn.addEventListener('click', (e) => {
          e.preventDefault();
          window.location.href = '/src/pages/help.html';
          this.closeMenu();
        });
        helpSub.appendChild(helpLinkBtn);

        helpWrapper.appendChild(helpSub);
        quickSection.appendChild(helpWrapper);
      }

      // Переключатель темы
      if (themeToggle) {
        const themeLabel = header.querySelector('label.theme-switch');
        if (themeLabel) {
          const themeBtn = document.createElement('button');
          themeBtn.className = 'mobile-menu-btn mobile-menu-action-btn';
          themeBtn.type = 'button';
          themeBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="5"></circle>
              <line x1="12" y1="1" x2="12" y2="3"></line>
              <line x1="12" y1="21" x2="12" y2="23"></line>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
              <line x1="1" y1="12" x2="3" y2="12"></line>
              <line x1="21" y1="12" x2="23" y2="12"></line>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
            </svg>
            <span>${themeToggle.checked ? 'Светлая тема' : 'Тёмная тема'}</span>
          `;
          themeBtn.addEventListener('click', () => {
            themeToggle.checked = !themeToggle.checked;
            themeToggle.dispatchEvent(new Event('change', { bubbles: true }));
            const span = themeBtn.querySelector('span');
            if (span) {
              span.textContent = themeToggle.checked ? 'Светлая тема' : 'Тёмная тема';
            }
          });
          quickSection.appendChild(themeBtn);
        }
      }

      mobileMenu.appendChild(quickSection);
    }

    // Секция пользователя
    const userSection = document.createElement('div');
    userSection.className = 'mobile-menu-section mobile-menu-user-section';

    // Информация о пользователе
    const authInfo = header.querySelector('#authInfo');
    if (authInfo) {
      const authContent = authInfo.innerHTML.trim();
      if (authContent) {
        const userInfo = document.createElement('div');
        userInfo.className = 'mobile-menu-user-info';
        userInfo.innerHTML = authContent;

        // Добавляем обработчик клика, если есть обработчик на оригинальном элементе
        const originalRoleElement = authInfo.querySelector('.user-role');
        if (originalRoleElement && originalRoleElement.onclick) {
          const roleElement = userInfo.querySelector('.user-role');
          if (roleElement) {
            roleElement.onclick = originalRoleElement.onclick;
            roleElement.style.cursor = 'pointer';
          }
        }

        userSection.appendChild(userInfo);
      }
    }

    // Кнопка выхода
    const logoutContainer = header.querySelector('#logoutContainer');
    if (logoutContainer) {
      const logoutBtn = logoutContainer.querySelector('.logout, button');
      if (logoutBtn) {
        const logoutBtnCopy = document.createElement('button');
        logoutBtnCopy.className = 'mobile-menu-btn mobile-menu-logout-btn';
        logoutBtnCopy.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16,17 21,12 16,7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          <span>Выйти</span>
        `;
        logoutBtnCopy.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          // Вызываем оригинальный обработчик или событие click
          if (logoutBtn.onclick) {
            logoutBtn.onclick(e);
          } else {
            logoutBtn.click();
          }
          this.closeMenu();
        });
        userSection.appendChild(logoutBtnCopy);
      } else {
        // Если кнопка выхода рендерится динамически через innerHTML
        const logoutContent = logoutContainer.innerHTML.trim();
        if (logoutContent) {
          const logoutWrapper = document.createElement('div');
          logoutWrapper.className = 'mobile-menu-logout-wrapper';
          logoutWrapper.innerHTML = logoutContent;

          // Привязываем обработчики событий
          const wrapperLogoutBtn = logoutWrapper.querySelector('.logout, button');
          if (wrapperLogoutBtn) {
            const originalLogoutBtn = logoutContainer.querySelector('.logout, button');
            if (originalLogoutBtn && originalLogoutBtn.onclick) {
              wrapperLogoutBtn.onclick = originalLogoutBtn.onclick;
            }
          }

          userSection.appendChild(logoutWrapper);
        }
      }
    }

    if (userSection.children.length > 0) {
      // Разделитель перед секцией пользователя
      const divider2 = document.createElement('div');
      divider2.className = 'mobile-menu-divider';
      mobileMenu.appendChild(divider2);
      mobileMenu.appendChild(userSection);
    }

    document.body.appendChild(mobileMenu);
  },

  /**
   * Привязка обработчиков событий
   */
  attachEventListeners() {
    const burgerBtn = document.getElementById('burgerMenuBtn');
    const mobileMenu = document.getElementById('mobileEnterpriseMenu');

    let lastTouchTime = 0;
    const handleBurgerActivate = (e) => {
      const btn = e.target?.closest?.('#burgerMenuBtn');
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.type === 'touchend') {
        lastTouchTime = Date.now();
      } else if (e.type === 'click' && Date.now() - lastTouchTime < 400) {
        return; // Игнорируем click после touch (дубликат)
      }
      e.stopImmediatePropagation?.();
      this.toggleMenu();
    };

    document.addEventListener('click', handleBurgerActivate, true);
    document.addEventListener('touchend', handleBurgerActivate, { passive: false, capture: true });

    // Закрытие меню при клике вне его области
    document.addEventListener('click', (e) => {
      if (
        mobileMenu &&
        mobileMenu.classList.contains('active') &&
        !mobileMenu.contains(e.target) &&
        !burgerBtn?.contains(e.target)
      ) {
        this.closeMenu();
      }
    });

    // Закрытие меню при изменении размера окна (с debounce для оптимизации)
    const debounce = window.debounce || ((func, wait) => {
      let timeout;
      return function executedFunction(...args) {
        const later = () => {
          clearTimeout(timeout);
          func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
      };
    });

    const handleResize = debounce(() => {
      if (window.innerWidth > 767) {
        this.closeMenu();
      }
    }, 200);

    window.addEventListener('resize', handleResize);

    // Сохраняем ссылку на обработчик для возможности удаления
    this._resizeHandler = handleResize;

    // Закрытие меню по Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && mobileMenu?.classList.contains('active')) {
        this.closeMenu();
      }
    });
  },

  /**
   * Переключение состояния меню
   */
  toggleMenu() {
    const burgerBtn = document.getElementById('burgerMenuBtn');
    const mobileMenu = document.getElementById('mobileEnterpriseMenu');

    if (!burgerBtn || !mobileMenu) return;

    const isActive = mobileMenu.classList.contains('active');

    if (isActive) {
      this.closeMenu();
    } else {
      this.openMenu();
    }
  },

  /**
   * Открытие меню
   */
  openMenu() {
    const burgerBtn = document.getElementById('burgerMenuBtn');
    let mobileMenu = document.getElementById('mobileEnterpriseMenu');

    if (!burgerBtn) return;

    // Если меню не существует, создаем его
    if (!mobileMenu) {
      this.createMobileMenu();
      mobileMenu = document.getElementById('mobileEnterpriseMenu');
    }

    if (!mobileMenu) return;

    burgerBtn.classList.add('active');
    burgerBtn.setAttribute('aria-expanded', 'true');
    burgerBtn.setAttribute('aria-label', 'Закрыть меню');

    mobileMenu.classList.add('active');
    mobileMenu.setAttribute('aria-hidden', 'false');

    // Блокируем прокрутку body
    document.body.style.overflow = 'hidden';
  },

  /**
   * Закрытие меню
   */
  closeMenu() {
    const burgerBtn = document.getElementById('burgerMenuBtn');
    const mobileMenu = document.getElementById('mobileEnterpriseMenu');

    if (!burgerBtn || !mobileMenu) return;

    burgerBtn.classList.remove('active');
    burgerBtn.setAttribute('aria-expanded', 'false');
    burgerBtn.setAttribute('aria-label', 'Открыть меню');

    mobileMenu.classList.remove('active');
    mobileMenu.setAttribute('aria-hidden', 'true');

    // Восстанавливаем прокрутку body
    document.body.style.overflow = '';
  },

  /**
   * Обновление состояния меню при изменении размера окна
   */
  handleResize() {
    if (window.innerWidth > 767) {
      this.closeMenu();
    } else if (!document.getElementById('burgerMenuBtn')) {
      this.init();
    }
  },

  /**
   * Обновление меню (например, когда обновляется информация о пользователе)
   */
  updateMenu() {
    const mobileMenu = document.getElementById('mobileEnterpriseMenu');
    const isMenuOpen = mobileMenu && mobileMenu.classList.contains('active');

    if (mobileMenu) {
      // Удаляем старое меню и создаем новое
      mobileMenu.remove();
    }

    this.createMobileMenu();

    // Восстанавливаем состояние открытости, если меню было открыто
    if (isMenuOpen) {
      this.openMenu();
    }
  },

  /**
   * Очистка обработчиков событий (для предотвращения утечек памяти)
   */
  destroy() {
    // Удаляем обработчик resize
    if (this._resizeHandler) {
      window.removeEventListener('resize', this._resizeHandler);
      this._resizeHandler = null;
    }

    // Закрываем меню, если оно открыто
    this.closeMenu();

    // Удаляем мобильное меню из DOM
    const mobileMenu = document.getElementById('mobileEnterpriseMenu');
    if (mobileMenu) {
      mobileMenu.remove();
    }

    // Удаляем кнопку бургер-меню
    const burgerBtn = document.getElementById('burgerMenuBtn');
    if (burgerBtn) {
      burgerBtn.remove();
    }
  }
};

// Экспорт для использования в других модулях
if (typeof window !== 'undefined') {
  window.MobileNav = MobileNav;
}
export default MobileNav;
