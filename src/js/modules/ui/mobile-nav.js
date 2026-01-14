/**
 * Мобильная навигация
 * Модуль для управления бургер-меню и выдвижным меню предприятий на мобильных устройствах
 */

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
      console.error('Ошибка инициализации MobileNav:', error);
    }
  },

  /**
   * Создание кнопки бургер-меню
   */
  createBurgerMenu() {
    const header = document.querySelector('header');
    if (!header) {
      if (window.Logger) window.Logger.warn('MobileNav: header не найден');
      return;
    }

    const controls = header.querySelector('.controls');
    if (!controls) {
      if (window.Logger) window.Logger.warn('MobileNav: .controls не найден в header');
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

    // Секция предприятий
    const enterpriseNav = header.querySelector('.enterprise-nav');
    if (enterpriseNav) {
      const enterpriseSection = document.createElement('div');
      enterpriseSection.className = 'mobile-menu-section';

      const enterpriseTitle = document.createElement('h3');
      enterpriseTitle.className = 'mobile-menu-title';
      enterpriseTitle.textContent = 'Предприятия';
      enterpriseSection.appendChild(enterpriseTitle);

      const buttons = enterpriseNav.querySelectorAll('button');
      buttons.forEach((btn) => {
        const newBtn = btn.cloneNode(true);
        newBtn.className = 'mobile-menu-btn';
        // Сохраняем активное состояние
        if (btn.classList.contains('active')) {
          newBtn.classList.add('active');
        }
        newBtn.addEventListener('click', (e) => {
          e.preventDefault();
          btn.click(); // Вызываем оригинальный обработчик
          // Обновляем активное состояние в меню
          enterpriseSection.querySelectorAll('.mobile-menu-btn').forEach(b => b.classList.remove('active'));
          newBtn.classList.add('active');
          this.closeMenu();
        });
        enterpriseSection.appendChild(newBtn);
      });

      mobileMenu.appendChild(enterpriseSection);
    }

    // Секция действий
    const actionsSection = document.createElement('div');
    actionsSection.className = 'mobile-menu-section';

    // Переключатель темы
    const themeToggle = header.querySelector('#themeToggle');
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
          // Обновляем текст кнопки
          const span = themeBtn.querySelector('span');
          if (span) {
            span.textContent = themeToggle.checked ? 'Светлая тема' : 'Тёмная тема';
          }
        });
        actionsSection.appendChild(themeBtn);
      }
    }

    // Добавляем разделитель только если есть элементы в actionsSection
    if (actionsSection.children.length > 0) {
      // Разделитель перед секцией действий (если есть предприятия)
      if (enterpriseNav && enterpriseNav.querySelectorAll('button').length > 0) {
        const divider1 = document.createElement('div');
        divider1.className = 'mobile-menu-divider';
        mobileMenu.appendChild(divider1);
      }
      mobileMenu.appendChild(actionsSection);
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

    if (burgerBtn) {
      burgerBtn.addEventListener('click', () => {
        this.toggleMenu();
      });
    }

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

    // Обновляем активное состояние перед открытием
    this.updateActiveEnterprise();

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
   * Обновление активного состояния кнопок предприятий в меню
   */
  updateActiveEnterprise() {
    const mobileMenu = document.getElementById('mobileEnterpriseMenu');
    if (!mobileMenu) return;

    const header = document.querySelector('header');
    if (!header) return;

    const enterpriseNav = header.querySelector('.enterprise-nav');
    if (!enterpriseNav) return;

    const activeBtn = enterpriseNav.querySelector('button.active');
    if (!activeBtn) return;

    const activeText = (activeBtn.textContent || '').trim();
    const menuButtons = mobileMenu.querySelectorAll('.mobile-menu-section:first-child .mobile-menu-btn');

    menuButtons.forEach(btn => {
      btn.classList.remove('active');
      if ((btn.textContent || '').trim() === activeText) {
        btn.classList.add('active');
      }
    });
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
