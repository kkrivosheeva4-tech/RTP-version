// help.js
// Логика страницы справки

(function() {
  'use strict';

  /**
   * Инициализация темы
   */
  function initTheme() {
    const themeToggle = document.getElementById('themeToggle');
    if (!themeToggle) return;

    const savedTheme = localStorage.getItem('theme') || 'light';
    if (savedTheme === 'dark') {
      document.body.classList.add('dark');
      document.body.classList.remove('light');
      themeToggle.checked = true;
    } else {
      document.body.classList.add('light');
      document.body.classList.remove('dark');
    }

    themeToggle.addEventListener('change', function() {
      const newTheme = this.checked ? 'dark' : 'light';
      if (this.checked) {
        document.body.classList.add('dark');
        document.body.classList.remove('light');
        localStorage.setItem('theme', 'dark');
      } else {
        document.body.classList.add('light');
        document.body.classList.remove('dark');
        localStorage.setItem('theme', 'light');
      }
    });
  }

  /**
   * Инициализация навигации по предприятиям (для шапки на странице справки)
   * На странице справки нет радара, поэтому по клику просто сохраняем выбор и переходим на RMK.html.
   */
  function initEnterpriseNav() {
    const nav = document.querySelector('.enterprise-nav');
    if (!nav) return;

    const buttons = nav.querySelectorAll('button');
    if (!buttons.length) return;

    buttons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const text = (btn.textContent || '').trim();
        if (!text) return;
        localStorage.setItem('selectedEnterprise', text);

        try {
          sessionStorage.setItem('silentEnterpriseNav', '1');
        } catch (err) {}

        window.location.href = 'RMK.html';
      });
    });

    function markActive() {
      const selected = localStorage.getItem('selectedEnterprise');
      buttons.forEach((b) => b.classList.remove('active'));
      if (!selected) return;
      const activeBtn = Array.from(buttons).find(
        (b) => (b.textContent || '').trim() === selected
      );
      if (activeBtn) activeBtn.classList.add('active');
    }

    markActive();
    window.addEventListener('popstate', markActive);
  }

  /**
   * Инициализация поиска по справке
   */
  function initSearch() {
    const searchInput = document.getElementById('helpSearch');
    if (!searchInput) return;

    const sections = document.querySelectorAll('.help-section');
    const navItems = document.querySelectorAll('.help-nav-item');

    searchInput.addEventListener('input', function() {
      const query = this.value.toLowerCase().trim();

      if (query === '') {
        // Показываем все разделы
        sections.forEach(section => {
          section.style.display = 'block';
        });
        navItems.forEach(item => {
          item.style.display = 'block';
        });
        return;
      }

      // Ищем по содержимому разделов
      sections.forEach(section => {
        const text = section.textContent.toLowerCase();
        const matches = text.includes(query);
        section.style.display = matches ? 'block' : 'none';

        // Подсвечиваем найденный текст
        if (matches) {
          highlightText(section, query);
        }
      });

      // Показываем/скрываем пункты навигации
      navItems.forEach(item => {
        const sectionId = item.getAttribute('data-section');
        const section = document.getElementById(sectionId);
        if (section && section.style.display !== 'none') {
          item.style.display = 'block';
        } else {
          item.style.display = 'none';
        }
      });
    });
  }

  /**
   * Подсветка найденного текста
   */
  function highlightText(element, query) {
    // Удаляем предыдущие подсветки
    const highlights = element.querySelectorAll('.help-search-highlight');
    highlights.forEach(highlight => {
      const parent = highlight.parentNode;
      parent.replaceChild(document.createTextNode(highlight.textContent), highlight);
      parent.normalize();
    });

    // Подсвечиваем новый текст
    if (query.length < 2) return;

    function highlightNode(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent;
        const index = text.toLowerCase().indexOf(query);
        if (index !== -1) {
          const span = document.createElement('mark');
          span.className = 'help-search-highlight';
          span.textContent = text.substring(index, index + query.length);

          const before = document.createTextNode(text.substring(0, index));
          const after = document.createTextNode(text.substring(index + query.length));

          const parent = node.parentNode;
          parent.insertBefore(before, node);
          parent.insertBefore(span, node);
          parent.insertBefore(after, node);
          parent.removeChild(node);
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        // Пропускаем элементы с подсветкой
        if (node.classList.contains('help-search-highlight')) return;

        const children = Array.from(node.childNodes);
        children.forEach(child => highlightNode(child));
      }
    }

    highlightNode(element);
  }

  /**
   * Инициализация навигации по разделам
   */
  function initNavigation() {
    const navItems = document.querySelectorAll('.help-nav-item');
    const sections = document.querySelectorAll('.help-section');
    const scrollContainer = document.querySelector('.help-content');

    // Обработка кликов по пунктам навигации
    navItems.forEach(item => {
      item.addEventListener('click', function(e) {
        e.preventDefault();
        const sectionId = this.getAttribute('data-section');
        const section = document.getElementById(sectionId);

        if (section) {
          // Убираем активный класс со всех пунктов
          navItems.forEach(nav => nav.classList.remove('active'));
          // Добавляем активный класс текущему пункту
          this.classList.add('active');

          // Прокручиваем к разделу
          section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });

    // Обновление активного пункта при прокрутке
    function updateActiveNav() {
      // Страница "Справка" скроллится внутри .help-content (как админ-панель),
      // поэтому определяем активный раздел по видимости в контейнере.
      if (!scrollContainer) return;

      const containerRect = scrollContainer.getBoundingClientRect();
      const anchorY = containerRect.top + 120; // контрольная точка внутри видимой области

      let activeSectionId = null;
      sections.forEach(section => {
        const rect = section.getBoundingClientRect();
        if (rect.top <= anchorY && rect.bottom > anchorY) {
          activeSectionId = section.id;
        }
      });

      if (!activeSectionId) return;
      navItems.forEach(item => {
        item.classList.toggle('active', item.getAttribute('data-section') === activeSectionId);
      });
    }

    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', updateActiveNav);
    }
    updateActiveNav(); // Инициализация при загрузке
  }

  /**
   * Инициализация авторизации
   */
  function initAuth() {
    // Проверяем наличие функции renderAuth
    if (typeof window.renderAuth === 'function') {
      window.renderAuth();
    } else {
      // Загружаем модуль авторизации, если он не загружен
      const script = document.createElement('script');
      script.src = '/src/js/modules/business/auth.js';
      script.onload = () => {
        if (typeof window.renderAuth === 'function') {
          window.renderAuth();
        }
      };
      document.head.appendChild(script);
    }
  }

  /**
   * Инициализация кнопки помощи
   */
  function initHelpButton() {
    const helpBtn = document.getElementById('helpBtn');
    if (helpBtn) {
      helpBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        // Используем глобальную функцию showHelpMenu, если она доступна
        if (typeof window.showHelpMenu === 'function') {
          window.showHelpMenu(helpBtn);
        } else {
          // Если функция не загружена, используем локальную реализацию
          const existingMenu = document.querySelector('.help-menu');
          if (existingMenu) {
            existingMenu.remove();
          }

          // Проверяем, находимся ли мы на странице RMK.html
          const isRMKPage = window.location.pathname.includes('RMK.html') || window.location.href.includes('RMK.html');

          const menu = document.createElement('div');
          menu.className = 'help-menu';
          menu.setAttribute('role', 'menu');

          // Формируем HTML меню в зависимости от страницы
          let menuHTML = '';
          if (isRMKPage) {
            menuHTML = `
              <button class="help-menu-item" data-action="tour" role="menuitem">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <path d="M12 16v-4M12 8h.01"></path>
                </svg>
                <span>Интерактивный тур</span>
              </button>
            `;
          }
          menuHTML += `
            <a href="help.html" class="help-menu-item" role="menuitem">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
              </svg>
              <span>Справка</span>
            </a>
          `;
          menu.innerHTML = menuHTML;

          const rect = helpBtn.getBoundingClientRect();
          menu.style.position = 'fixed';
          menu.style.top = `${rect.bottom + 8}px`;
          menu.style.right = `${window.innerWidth - rect.right}px`;
          menu.style.zIndex = '10001';

          const tourBtn = menu.querySelector('[data-action="tour"]');
          if (tourBtn && isRMKPage) {
            tourBtn.addEventListener('click', function(e) {
              e.preventDefault();
              e.stopPropagation();
              menu.remove();
              if (window.OnboardingTour && typeof window.OnboardingTour.startTour === 'function') {
                window.OnboardingTour.startTour();
              }
            });
          }

          const closeMenu = (e) => {
            if (!menu.contains(e.target) && e.target !== helpBtn) {
              menu.remove();
              document.removeEventListener('click', closeMenu);
            }
          };
          setTimeout(() => document.addEventListener('click', closeMenu), 0);
          document.body.appendChild(menu);
        }
      });
    }
  }

  /**
   * Инициализация приложения
   */
  function init() {
    initTheme();
    initEnterpriseNav();
    initSearch();
    initNavigation();
    initAuth();
    initHelpButton();
  }

  // Запуск инициализации
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
