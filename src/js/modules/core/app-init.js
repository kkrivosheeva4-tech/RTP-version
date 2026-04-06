// app-init.js
// Инициализация приложения. ES module (шаг 7.5). Инициализация вызывается из main.js bootstrap().

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

  function rebuildEnterpriseDataMap(technologies) {
    return (Array.isArray(technologies) ? technologies : []).reduce((acc, technology) => {
      const companies = Array.isArray(technology && technology.company)
        ? technology.company
        : (technology && technology.company ? [technology.company] : []);
      companies.forEach((company) => {
        const name = String(company || '').trim();
        if (!name) return;
        if (!acc[name]) {
          acc[name] = [];
        }
        acc[name].push(technology);
      });
      return acc;
    }, {});
  }

  function isApiModeEnabled() {
    try {
      return !!(
        typeof window !== 'undefined' &&
        window.ApiConfig &&
        typeof window.ApiConfig.getUseApi === 'function' &&
        window.ApiConfig.getUseApi() === true
      );
    } catch (_) {
      return false;
    }
  }

  function isPublicLandingPage() {
    if (typeof window === 'undefined' || !window.location) {
      return false;
    }

    const pathname = String(window.location.pathname || '');
    return pathname === '/' || pathname === '/src/pages/index.html';
  }

  async function loadPublicLandingPreview(StateAccessors, StateManager) {
    const loadJsonPreferVfs = typeof window !== 'undefined' ? window.loadJsonPreferVfs : null;
    const buildBlockMaps = typeof window !== 'undefined' ? window.buildBlockMaps : null;
    const normalizeTechnologyFromNewFormat =
      typeof window !== 'undefined' ? window.normalizeTechnologyFromNewFormat : null;
    const buildEnterpriseDataFromTechnologies =
      typeof window !== 'undefined' ? window.buildEnterpriseDataFromTechnologies : null;

    if (
      typeof loadJsonPreferVfs !== 'function' ||
      typeof buildBlockMaps !== 'function' ||
      typeof normalizeTechnologyFromNewFormat !== 'function' ||
      typeof buildEnterpriseDataFromTechnologies !== 'function'
    ) {
      return false;
    }

    const [blocksLoaded, enterprisesLoaded, directionsLoaded, directionMapLoaded, functionsLoaded, functionToBlockLoaded, technologiesLoaded] =
      await Promise.all([
        loadJsonPreferVfs('blocks.json'),
        loadJsonPreferVfs('enterprises.json'),
        loadJsonPreferVfs('digitalDirections.json'),
        loadJsonPreferVfs('directionToQuadrant.json'),
        loadJsonPreferVfs('functions.json'),
        loadJsonPreferVfs('functionToBlock.json'),
        loadJsonPreferVfs('technologies.json')
      ]);

    const blocks = Array.isArray(blocksLoaded?.data) ? blocksLoaded.data : [];
    const enterprises = Array.isArray(enterprisesLoaded?.data) ? enterprisesLoaded.data : [];
    const digitalDirections = Array.isArray(directionsLoaded?.data) ? directionsLoaded.data : [];
    const directionToQuadrant =
      directionMapLoaded?.data && typeof directionMapLoaded.data === 'object'
        ? directionMapLoaded.data
        : {};
    const functionsData = Array.isArray(functionsLoaded?.data) ? functionsLoaded.data : [];
    const functionToBlockMap =
      functionToBlockLoaded?.data && typeof functionToBlockLoaded.data === 'object'
        ? functionToBlockLoaded.data
        : {};
    const rawTechnologies = Array.isArray(technologiesLoaded?.data) ? technologiesLoaded.data : [];

    const { blockIdToName, nameToBlockId, blocksList } = buildBlockMaps(blocks);
    const technologies = rawTechnologies.map((tech) =>
      normalizeTechnologyFromNewFormat(tech, blockIdToName, enterprises)
    );
    const enterpriseData = buildEnterpriseDataFromTechnologies(technologies);
    const enterpriseList = enterprises
      .map((ent) => (typeof ent === 'string' ? ent : ent?.name))
      .filter(Boolean);

    StateManager.set('nameToBlockId', nameToBlockId);
    StateManager.set('blocksList', blocksList);
    StateManager.set(
      'functions',
      functionsData
        .map((item) => (item && typeof item === 'object' ? item.name : item))
        .filter(Boolean)
    );
    StateManager.set('functionToBlockMap', functionToBlockMap);
    StateManager.set('digitalDirections', digitalDirections);
    StateManager.set('directionToQuadrant', directionToQuadrant);
    StateManager.set('enterprisesList', enterprises);
    StateManager.set('enterpriseList', enterpriseList);
    StateManager.set('technologies', technologies);
    StateManager.set('enterpriseData', enterpriseData);

    window.blockIdToName = blockIdToName;
    window.digitalDirections = digitalDirections;
    window.directionToQuadrant = directionToQuadrant;
    window.techTypes = Object.keys(window.TECHTYPE_TO_SHAPE || {});

    const rings = ['Используемые', 'Внедряемые', 'Перспективные'];
    window.RINGS = rings;
    const levelToRing = {};
    rings.forEach((ringName, idx) => {
      levelToRing[ringName] = idx;
      if (typeof ringName === 'string' && ringName.endsWith('ые')) {
        levelToRing[ringName.slice(0, -2) + 'ая'] = idx;
      }
    });
    window.levelToRing = levelToRing;

    window.QUADRANTS =
      digitalDirections.length > 0
        ? digitalDirections
            .slice()
            .sort((a, b) => Number(a?.id || 0) - Number(b?.id || 0))
            .map((direction) => ({
              id: Number(direction?.id || 0),
              name: String(direction?.name || '').trim() || `Направление ${direction?.id || ''}`,
              startAngle: (Number(direction?.id || 1) - 1) * 90
            }))
        : [
            { id: 1, name: 'Корпоративное управление и администрация', startAngle: 0 },
            { id: 2, name: 'Основное производство', startAngle: 90 },
            { id: 3, name: 'Производственная поддержка и безопасность', startAngle: 180 },
            { id: 4, name: 'Внешние бизнесы', startAngle: 270 }
          ];

    const selectedEnterprise = localStorage.getItem('selectedEnterprise') || 'РМК';
    const enterpriseToSwitch = enterpriseList.includes(selectedEnterprise)
      ? selectedEnterprise
      : (enterpriseList[0] || 'РМК');
    if (StateAccessors && typeof StateAccessors.setCurrentEnterprise === 'function') {
      StateAccessors.setCurrentEnterprise(enterpriseToSwitch);
    }

    if (typeof window.rebuildTechnologiesIndex === 'function') {
      window.rebuildTechnologiesIndex();
    } else if (window.DataIndex && typeof window.DataIndex.build === 'function') {
      window.DataIndex.build(technologies);
    }

    return technologies.length > 0;
  }

  // Инициализация приложения
  async function initApp() {
    // Обработчики событий (events.js загружен как ES module; вызываем после загрузки core-utils)
    if (typeof window.initEventHandlers === 'function') {
      window.initEventHandlers();
      setTimeout(() => {
        if (typeof window.initSearchHandler === 'function') {
          if (!window.initSearchHandler()) setTimeout(() => window.initSearchHandler(), 500);
        }
      }, 100);
    }

    const DOMCache = getDOMCache();
    const StateAccessors = getStateAccessors();

    // Мобильная навигация — инициализируем до loadData, чтобы бургер работал даже при ошибках загрузки
    if (window.MobileNav && typeof window.MobileNav.init === 'function') {
      window.MobileNav.init();
      window.addEventListener('resize', () => {
        if (window.MobileNav && typeof window.MobileNav.handleResize === 'function') {
          window.MobileNav.handleResize();
        }
      });
    }

    // Ждем загрузки DataLoader
    let DataLoader = getDataLoader();
    let attempts = 0;
    while (!DataLoader && attempts < 10) {
      await new Promise(resolve => setTimeout(resolve, 100));
      DataLoader = getDataLoader();
      attempts++;
    }
    if (!DataLoader) {
      // DataLoader не загружен после ожидания
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

    // Сначала показываем auth-состояние, затем — API загрузку.
    // force=true: всегда проверяем сессию с сервером, чтобы не загружать данные при устаревшем/пустом состоянии
    if (isApiModeEnabled() && window.AuthModule && typeof window.AuthModule.bootstrapAuthSession === 'function') {
      await window.AuthModule.bootstrapAuthSession(true);
    }
    if (window.AuthModule && typeof window.AuthModule.renderAuth === 'function') {
      window.AuthModule.renderAuth();
    } else if (typeof window.renderAuth === 'function') {
      window.renderAuth();
    }
    if (
      isPublicLandingPage() &&
      window.AuthModule &&
      typeof window.AuthModule.isAuthenticated === 'function' &&
      !window.AuthModule.isAuthenticated()
    ) {
      await loadPublicLandingPreview(StateAccessors, StateManager);
      if (typeof window.renderRadarBackground === 'function') {
        window.renderRadarBackground({ showSectorLabels: false });
      }
      return;
    }
    // Загрузка данных
    await DataLoader.loadData();

    // Синхронизируем локальные переменные с window после загрузки данных
    window.RINGS = window.RINGS || [];
    window.QUADRANTS = window.QUADRANTS || [];
    window.levelToRing = window.levelToRing || {};

    // Теперь все технологии объединены в один массив, поэтому просто устанавливаем фильтр предприятий
    const selectedEnterprise = localStorage.getItem("selectedEnterprise") || "РМК";
    const rawList = StateAccessors.getEnterpriseList ? StateAccessors.getEnterpriseList() : Object.keys(StateAccessors.getEnterpriseData() || {});
    const enterpriseList = Array.isArray(rawList) ? rawList : [];
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

    // Рендер радара: полный радар с технологиями только на radar.html; на главной — только фон
    const isRadarPage =
      window.location.pathname === '/radar/' ||
      window.location.pathname === '/radar' ||
      window.location.pathname.includes('radar.html') ||
      window.location.href.includes('radar.html');
    const hasRadarCanvas = !!document.getElementById('techRadar');
    if (isRadarPage && hasRadarCanvas && typeof window.renderRadar === 'function') {
      window.renderRadar();
    } else if (hasRadarCanvas && typeof window.renderRadarBackground === 'function') {
      window.renderRadarBackground({ showSectorLabels: false });
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

    // Обновление меню после загрузки данных (предприятия и т.д.)
    if (window.MobileNav && typeof window.MobileNav.updateMenu === 'function') {
      window.MobileNav.updateMenu();
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

    if (window.ModerationFlow && typeof window.ModerationFlow.init === 'function') {
      window.ModerationFlow.init();
    }

    // Инициализация интерактивного тура
    if (window.OnboardingTour && typeof window.OnboardingTour.init === 'function') {
      window.OnboardingTour.init();
    }

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
    // Проверяем, находимся ли мы на странице радара (radar.html)
    const isRMKPage =
      window.location.pathname === '/radar/' ||
      window.location.pathname === '/radar' ||
      window.location.pathname.includes('radar.html') ||
      window.location.href.includes('radar.html');

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
      <a href="/help/" class="help-menu-item" role="menuitem">
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
      confirmDeleteBtn.onclick = async () => {
        const currentTech = StateAccessors.getCurrentTech();
        if (!currentTech) return;
        if (
          window.ModerationFlow &&
          typeof window.ModerationFlow.isProposalOnlyMode === 'function' &&
          window.ModerationFlow.isProposalOnlyMode()
        ) {
          try {
            await window.ModerationFlow.createProposal('delete', {
              technologyId: currentTech.id
            });
            window.hideModal('deleteConfirmModal');
          } catch (err) {
            if (window.Logger) window.Logger.warn('Не удалось отправить предложение на удаление', err);
            if (DataLoader && typeof DataLoader.showNotification === 'function') {
              DataLoader.showNotification((err && err.message) ? err.message : 'Не удалось отправить предложение на модерацию', false);
            }
          }
          return;
        }
        const DataService = typeof window !== 'undefined' && window.DataService ? window.DataService : null;
        try {
          if (DataService && typeof DataService.deleteTech === 'function') {
            await DataService.deleteTech(currentTech.id);
          }
        } catch (err) {
          if (window.Logger) window.Logger.warn('Не удалось удалить технологию', err);
          return;
        }
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
          const technologies = StateAccessors.getTechnologies();
          StateAccessors.setEnterpriseData(rebuildEnterpriseDataMap(technologies));
        } catch (err) { if (window.Logger) window.Logger.warn('Не удалось обновить enterpriseData после удаления', err); }

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
          if (typeof window.appendAdminAudit === 'function') {
            window.appendAdminAudit('delete', details);
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

  // Экспорт модуля (инициализация вызывается из main.js)
  const AppInit = {
    initApp,
    initDeleteHandlers,
    initDetailBackButton,
    initFormHandlers,
    initReportHandlers
  };

  if (typeof window !== 'undefined') {
    window.AppInit = AppInit;
  }

  export { initApp };
  export default AppInit;
