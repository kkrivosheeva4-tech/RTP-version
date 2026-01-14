// help.js
// Логика страницы справки

(function() {
  'use strict';

  // initTheme теперь в common-ui.js
  // Используем функцию из common-ui.js через window
  function initTheme() {
    if (typeof window.CommonUI !== 'undefined' && typeof window.CommonUI.initTheme === 'function') {
      window.CommonUI.initTheme();
    }
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

  // initHelpButton теперь в common-ui.js
  // Используем функцию из common-ui.js через window
  function initHelpButton() {
    if (typeof window.CommonUI !== 'undefined' && typeof window.CommonUI.initHelpButton === 'function') {
      window.CommonUI.initHelpButton();
    } else {
      // Fallback для обратной совместимости
      const helpBtn = document.getElementById('helpBtn');
      if (helpBtn) {
        helpBtn.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
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

            // Формируем меню через createElement (безопаснее чем innerHTML)
            if (isRMKPage) {
              const tourBtn = document.createElement('button');
              tourBtn.className = 'help-menu-item';
              tourBtn.setAttribute('data-action', 'tour');
              tourBtn.setAttribute('role', 'menuitem');
              const tourSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
              tourSvg.setAttribute('width', '18');
              tourSvg.setAttribute('height', '18');
              tourSvg.setAttribute('viewBox', '0 0 24 24');
              tourSvg.setAttribute('fill', 'none');
              tourSvg.setAttribute('stroke', 'currentColor');
              tourSvg.setAttribute('stroke-width', '2');
              const tourCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
              tourCircle.setAttribute('cx', '12');
              tourCircle.setAttribute('cy', '12');
              tourCircle.setAttribute('r', '10');
              const tourPath1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
              tourPath1.setAttribute('d', 'M12 16v-4');
              const tourPath2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
              tourPath2.setAttribute('d', 'M12 8h.01');
              tourSvg.appendChild(tourCircle);
              tourSvg.appendChild(tourPath1);
              tourSvg.appendChild(tourPath2);
              const tourSpan = document.createElement('span');
              tourSpan.textContent = 'Интерактивный тур';
              tourBtn.appendChild(tourSvg);
              tourBtn.appendChild(tourSpan);
              menu.appendChild(tourBtn);
            }

            const helpLink = document.createElement('a');
            helpLink.href = 'help.html';
            helpLink.className = 'help-menu-item';
            helpLink.setAttribute('role', 'menuitem');
            const helpSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            helpSvg.setAttribute('width', '18');
            helpSvg.setAttribute('height', '18');
            helpSvg.setAttribute('viewBox', '0 0 24 24');
            helpSvg.setAttribute('fill', 'none');
            helpSvg.setAttribute('stroke', 'currentColor');
            helpSvg.setAttribute('stroke-width', '2');
            const helpPath1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            helpPath1.setAttribute('d', 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20');
            const helpPath2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            helpPath2.setAttribute('d', 'M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z');
            helpSvg.appendChild(helpPath1);
            helpSvg.appendChild(helpPath2);
            const helpSpan = document.createElement('span');
            helpSpan.textContent = 'Справка';
            helpLink.appendChild(helpSvg);
            helpLink.appendChild(helpSpan);
            menu.appendChild(helpLink);

            const rect = helpBtn.getBoundingClientRect();
            menu.style.position = 'fixed';
            menu.style.top = `${rect.bottom + 8}px`;
            menu.style.right = `${window.innerWidth - rect.right}px`;
            menu.style.zIndex = '10001';

            const tourBtnEl = menu.querySelector('[data-action="tour"]');
            if (tourBtnEl && isRMKPage) {
              tourBtnEl.addEventListener('click', function(e) {
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
