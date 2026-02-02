// app-init.js
// Инициализация приложения

(function () {
  'use strict';

  // Ленивая загрузка зависимостей
  function getDOMCache() {
    if (typeof window !== 'undefined' && window.DOMCache) {
      return window.DOMCache;
    }
    throw new Error('DOMCache не загружен');
  }

  function getStateAccessors() {
    if (typeof window !== 'undefined' && window.StateAccessors) {
      return window.StateAccessors;
    }
    throw new Error('StateAccessors не загружен');
  }

  function getDataLoader() {
    if (typeof window !== 'undefined' && window.DataLoader) {
      return window.DataLoader;
    }
    // Если DataLoader еще не загружен, ждем немного и пробуем снова
    if (window.Logger) window.Logger.warn('DataLoader не загружен, ожидание...');
    return null;
  }

  function getStateManager() {
    if (typeof window !== 'undefined' && window.StateManager) {
      return window.StateManager;
    }
    throw new Error('StateManager не загружен');
  }

  function getDOMProxy() {
    if (typeof window !== 'undefined' && window.DOMProxy) {
      return window.DOMProxy;
    }
    throw new Error('DOMProxy не загружен');
  }

  // Инициализация приложения
  async function initApp() {
    const DOMCache = getDOMCache();
    const StateAccessors = getStateAccessors();

    // Ждем загрузки DataLoader
    let DataLoader = getDataLoader();
    let attempts = 0;
    while (!DataLoader && attempts < 10) {
      await new Promise(resolve => setTimeout(resolve, 100));
      DataLoader = getDataLoader();
      attempts++;
    }
    if (!DataLoader) {
      console.error('DataLoader не загружен после ожидания');
      return;
    }

    const StateManager = getStateManager();
    const DOMProxy = getDOMProxy();

    // Инициализация темы (обработчик переключения вынесен в events.js)
    const savedTheme = localStorage.getItem("theme") || "light";
    const isDark = savedTheme === "dark";
    // Убеждаемся, что есть правильный класс для темы
    document.body.classList.remove("light", "dark");
    document.body.classList.add(isDark ? "dark" : "light");
    const themeToggle = DOMCache.get('themeToggle');
    if (themeToggle) themeToggle.checked = isDark;

    // Загрузка данных
    await DataLoader.loadData();

    // Синхронизируем локальные переменные с window после загрузки данных
    window.RINGS = window.RINGS || [];
    window.QUADRANTS = window.QUADRANTS || [];
    window.levelToRing = window.levelToRing || {};

    // Теперь все технологии объединены в один массив, поэтому просто устанавливаем фильтр предприятий
    const selectedEnterprise = localStorage.getItem("selectedEnterprise") || "РМК";
    const enterpriseList = StateAccessors.getEnterpriseList ? StateAccessors.getEnterpriseList() : Object.keys(StateAccessors.getEnterpriseData() || {});
    const enterpriseToSwitch = enterpriseList.includes(selectedEnterprise) ? selectedEnterprise : (enterpriseList.length > 0 ? enterpriseList[0] : "РМК");
    StateAccessors.setCurrentEnterprise(enterpriseToSwitch);

    // Устанавливаем фильтр предприятий
    const Filters = window.Filters;
    if (Filters && enterpriseToSwitch) {
      const enterpriseSelect = document.querySelector('.custom-select[data-filter="enterprise"]');
      if (enterpriseSelect) {
        const hiddenInput = document.getElementById('filter_enterprise');
        if (hiddenInput) {
          hiddenInput.value = JSON.stringify([enterpriseToSwitch]);
          Filters.renderMultiSelectTags(enterpriseSelect);
        }
      }
    }

    // Вычисляем nextId из объединенного массива технологий
    const technologies = StateAccessors.getTechnologies();
    const nextId = technologies.length > 0 ? Math.max(...technologies.map(t => Number(t.id) || 0)) + 1 : 1;
    StateManager.set('nextId', nextId);

    // Инициализация авторизации
    if (typeof window.renderAuth === 'function') {
      window.renderAuth();
    }

    // Первый рендер не оборачиваем в requestAnimationFrame, так как он выполняется при загрузке
    if (typeof window.renderRadar === 'function') {
      window.renderRadar();
    }

    // Функция positionOptions находится в модуле select-events.js
    if (window.SelectPositioning && window.SelectPositioning.positionOptions) {
      window.positionOptions = window.SelectPositioning.positionOptions;
    }

    // Инициализация обработчиков удаления
    initDeleteHandlers();

    // Создание кнопки "Назад" в панели деталей
    initDetailBackButton();

    // Присваивание обработчиков формам
    initFormHandlers();

    // Инициализация функций управления отчетом
    initReportHandlers();

    // Инициализация мобильной навигации
    if (window.MobileNav && typeof window.MobileNav.init === 'function') {
      window.MobileNav.init();
      // Обновление при изменении размера окна
      window.addEventListener('resize', () => {
        if (window.MobileNav && typeof window.MobileNav.handleResize === 'function') {
          window.MobileNav.handleResize();
        }
      });
    }

    // Инициализация touch жестов
    if (window.TouchHandlers && typeof window.TouchHandlers.init === 'function') {
      window.TouchHandlers.init();
    }

    // Инициализация клавиатурной навигации
    if (window.KeyboardNav && typeof window.KeyboardNav.init === 'function') {
      window.KeyboardNav.init();
    }

    // Инициализация ARIA менеджера
    if (window.AriaManager && typeof window.AriaManager.init === 'function') {
      window.AriaManager.init();
    }

    // Инициализация интерактивного тура
    if (window.OnboardingTour && typeof window.OnboardingTour.init === 'function') {
      window.OnboardingTour.init();
    }

    // Инициализация контекстных подсказок - ОТКЛЮЧЕНА
    // if (window.ContextualHints && typeof window.ContextualHints.init === 'function') {
    //   window.ContextualHints.init();
    // }

    // Инициализация кнопки помощи
    initHelpButton();
  }

  /**
   * Инициализация кнопки помощи
   */
  function initHelpButton() {
    // Guard: предотвращаем повторную инициализацию
    if (window.__appInitHelpButtonInitialized) {
      if (window.Logger) window.Logger.debug('AppInit help button уже инициализирован, пропускаем повторную инициализацию');
      return;
    }
    window.__appInitHelpButtonInitialized = true;

    const DOMCache = getDOMCache();
    const helpBtn = DOMCache.get('helpBtn');

    if (helpBtn) {
      helpBtn.addEventListener('click', function () {
        // Показываем меню помощи с опциями
        showHelpMenu(helpBtn);
      });
    }
  }

  /**
   * Показывает меню помощи
   */
  function showHelpMenu(button) {
    // Проверяем, находимся ли мы на странице радара (RMK-director.html)
    const isRMKPage = window.location.pathname.includes('RMK-director.html') || window.location.href.includes('RMK-director.html');

    // Создаем выпадающее меню
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

    // Позиционируем меню
    const rect = button.getBoundingClientRect();
    menu.style.position = 'fixed';
    menu.style.top = `${rect.bottom + 8}px`;
    menu.style.right = `${window.innerWidth - rect.right}px`;
    menu.style.zIndex = '10001';

    // Добавляем обработчики (только если кнопка тура существует)
    const tourBtn = menu.querySelector('[data-action="tour"]');
    if (tourBtn && isRMKPage) {
      tourBtn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        menu.remove();
        // Проверяем наличие модуля и запускаем тур
        if (window.OnboardingTour && typeof window.OnboardingTour.startTour === 'function') {
          window.OnboardingTour.startTour();
        } else {
          if (window.Logger) window.Logger.warn('OnboardingTour модуль не загружен');
          // Показываем сообщение пользователю
          if (window.Toast) {
            window.Toast.error('Модуль обучения не загружен. Пожалуйста, обновите страницу.');
          } else {
            alert('Модуль обучения не загружен. Пожалуйста, обновите страницу.');
          }
        }
      });
    }

    // Закрытие меню при клике вне его
    const closeMenu = (e) => {
      if (!menu.contains(e.target) && e.target !== button) {
        menu.remove();
        document.removeEventListener('click', closeMenu);
      }
    };
    setTimeout(() => document.addEventListener('click', closeMenu), 0);

    document.body.appendChild(menu);
  }

  // Инициализация обработчиков удаления
  function initDeleteHandlers() {
    const DOMCache = getDOMCache();
    const StateAccessors = getStateAccessors();
    const DataLoader = getDataLoader();

    const confirmDeleteBtn = DOMCache.get("confirmDeleteBtn");
    if (confirmDeleteBtn) {
      confirmDeleteBtn.onclick = () => {
        const currentTech = StateAccessors.getCurrentTech();
        if (!currentTech) return;
        const technologies = StateAccessors.getTechnologies();
        StateAccessors.setTechnologies(technologies.filter(t => t.id !== currentTech.id));

        // Инвалидируем кэш квадрантов при удалении технологии
        let quadrantsCache = StateAccessors.getQuadrantsCache();
        if (!quadrantsCache) {
          // Создаем новый Map если кэш не существует
          quadrantsCache = new Map();
          const StateManager = getStateManager();
          if (StateManager && StateManager.set) {
            StateManager.set('quadrantsCache', quadrantsCache);
          }
        }
        if (quadrantsCache && typeof quadrantsCache.clear === 'function') {
          quadrantsCache.clear();
        }
        const currentVersion = StateAccessors.getQuadrantsCacheVersion() || 0;
        StateAccessors.setQuadrantsCacheVersion(currentVersion + 1);

        // Сначала сбрасываем выбранную технологию, чтобы панель не переоткрылась при обновлении радара
        StateAccessors.setSelectedBlipId(null);
        StateAccessors.setCurrentTech(null);

        // Полностью закрываем панель подробной информации
        const detailPanelEl = DOMCache.get('detailPanel');
        if (detailPanelEl) {
          // Очищаем все inline стили, которые были установлены
          detailPanelEl.style.removeProperty('visibility');
          detailPanelEl.style.removeProperty('opacity');
          detailPanelEl.style.removeProperty('transform');
          detailPanelEl.style.removeProperty('position');
          detailPanelEl.style.removeProperty('z-index');
          detailPanelEl.style.removeProperty('display');
          // Деактивируем focus trap перед закрытием
          if (window.FocusTrap && typeof window.FocusTrap.release === 'function') {
            window.FocusTrap.release();
          }
          // Удаляем класс active
          detailPanelEl.classList.remove("active");
          // Снимаем выделение с blip'ов
          const svg = DOMCache.get('techRadar');
          if (svg) {
            svg.querySelectorAll('.blip.selected').forEach(el => el.classList.remove('selected'));
          }
        }

        if (typeof window.unzoom === 'function') {
          window.unzoom();
        }

        if (typeof window.updateRadar === 'function') {
          window.updateRadar();
        }

        try {
          const enterpriseData = StateAccessors.getEnterpriseData();
          const currentEnterprise = StateAccessors.getCurrentEnterprise();
          const technologies = StateAccessors.getTechnologies();
          enterpriseData[currentEnterprise] = [...technologies];
          StateAccessors.setEnterpriseData({ ...enterpriseData });
          DataLoader.vfsWrite('enterpriseData.json', enterpriseData);
        } catch (err) { if (window.Logger) window.Logger.warn('Не удалось сохранить enterpriseData после удаления', err); }

        DataLoader.showNotification('Технология удалена!', true);

        // Добавляем уведомление в систему уведомлений
        if (window.Notifications && typeof window.Notifications.add === 'function') {
          const techName = currentTech?.name || 'Неизвестная технология';
          // Сохраняем копию технологии перед удалением для отображения в подробностях
          const oldTech = currentTech ? JSON.parse(JSON.stringify(currentTech)) : null;
          window.Notifications.add(window.Notifications.TYPES.DELETE, techName, currentTech?.id, {
            oldTech: oldTech
          });
        }

        // Логируем удаление технологии (важное действие → должно попадать в журнал аудита)
        try {
          const details = `Удалена технология: "${currentTech.name}" (ID: ${currentTech.id})`;
          // Основной путь — через централизованный логгер
          let ok = false;
          if (typeof window.appendAdminAudit === 'function') {
            ok = !!window.appendAdminAudit('delete', details);
          }
          // Fallback: прямое логирование в localStorage, если по какой-то причине appendAdminAudit не сработал
          if (!ok) {
            const key = 'adminAuditLogs';
            const raw = localStorage.getItem(key);
            const list = raw ? (JSON.parse(raw) || []) : [];
            const arr = Array.isArray(list) ? list : [];
            const username = (localStorage.getItem('username') || localStorage.getItem('userName') || 'system').trim() || 'system';
            const now = (typeof window.getAuditTimestamp === 'function')
              ? window.getAuditTimestamp()
              : new Date().toISOString().slice(0, 19).replace('T', ' ');
            const nextId = arr.length > 0 ? (Math.max(...arr.map(x => Number(x && x.id) || 0)) + 1) : 1;
            arr.unshift({
              id: nextId,
              date: now,
              user: username,
              action: 'delete',
              details,
              tz: 'local',
              ip: 'local'
            });
            localStorage.setItem(key, JSON.stringify(arr));
          }
        } catch (e) {
          // silent
        }

        if (typeof window.hideModal === 'function') {
          window.hideModal('deleteConfirmModal');
        }
      };
    }

    const cancelDeleteBtn = DOMCache.get('cancelDeleteBtn');
    if (cancelDeleteBtn) {
      cancelDeleteBtn.onclick = () => {
        if (typeof window.hideModal === 'function') {
          window.hideModal('deleteConfirmModal');
        }
      };
    }

    const closeDeleteConfirm = DOMCache.get('closeDeleteConfirm');
    if (closeDeleteConfirm) {
      closeDeleteConfirm.onclick = () => {
        if (typeof window.hideModal === 'function') {
          window.hideModal('deleteConfirmModal');
        }
      };
    }
  }

  // Создание кнопки "Назад" в панели деталей
  function initDetailBackButton() {
    const DOMProxy = getDOMProxy();
    const detailPanel = DOMProxy.createDOMProxy("detailPanel");

    if (detailPanel) {
      const detailHeader = detailPanel.querySelector('.detail-header');
      if (detailHeader) {
        let backBtn = detailPanel.querySelector('#detailBackFromPriorityBtn');
        if (!backBtn) {
          backBtn = document.createElement('button');
          backBtn.type = 'button';
          backBtn.id = 'detailBackFromPriorityBtn';
          backBtn.className = 'detail-back-btn';
          backBtn.setAttribute('aria-label', 'Назад к списку технологий');
          backBtn.setAttribute('data-tooltip', 'Назад к списку технологий');
          backBtn.title = 'Назад к списку технологий';
          backBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M15.5 19.5L8 12l7.5-7.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          `;
          // По умолчанию скрыта — будет показана только при открытии из панели приоритетов
          backBtn.style.display = 'none';
          // Вставляем слева от заголовка
          detailHeader.insertBefore(backBtn, detailHeader.firstChild);
        }
        // Обработчик клика на кнопку "Назад" перенесен в events.js
        // Здесь только создаем элемент, если его еще нет
      }
    }
  }

  // Присваивание обработчиков формам
  function initFormHandlers() {
    const DOMCache = getDOMCache();

    const addTechForm = DOMCache.get("addTechForm");
    if (addTechForm && typeof window.handleAddTechFormSubmit === 'function') {
      addTechForm.onsubmit = window.handleAddTechFormSubmit;
    }

    const editTechForm = DOMCache.get("editTechForm");
    if (editTechForm && typeof window.handleEditTechFormSubmit === 'function') {
      editTechForm.onsubmit = window.handleEditTechFormSubmit;
    }
  }

  // Инициализация функций управления отчетом
  function initReportHandlers() {
    if (window.ReportStatus) {
      const showReportLoading = window.ReportStatus.showReportLoading;
      const showReportSuccess = window.ReportStatus.showReportSuccess;
      const showReportError = window.ReportStatus.showReportError;

      // Экспорт функций управления отчетом в window для использования в модуле export.js
      window.showReportLoading = showReportLoading;
      window.showReportSuccess = showReportSuccess;
      window.showReportError = showReportError;
    }

    // Основная функция экспорта PDF с поддержкой выбора полей
    async function performPdfExport(selectedFields, filters = {}) {
      // Делегируем вызов модулю export.js
      if (typeof window.ExportModule !== 'undefined' && window.ExportModule.performPdfExport) {
        return window.ExportModule.performPdfExport(selectedFields, filters);
      }
      // Fallback для обратной совместимости
      throw new Error('Модуль экспорта не загружен');
    }

    // Экспорт функции performPdfExport в window для обратной совместимости
    window.performPdfExport = performPdfExport;
  }

  // Экспорт модуля
  const AppInit = {
    initApp,
    initDeleteHandlers,
    initDetailBackButton,
    initFormHandlers,
    initReportHandlers
  };

  if (typeof window !== 'undefined') {
    window.AppInit = AppInit;

    // Автоматическая инициализация при загрузке DOM
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => initApp(), 0);
      });
    } else {
      setTimeout(() => initApp(), 0);
    }
  }
})();
