/**
 * Модуль управления вкладками в форме добавления/редактирования технологии
 * Отвечает за создание динамических вкладок предприятий и переключение между ними
 */

(function (window) {
  'use strict';

  // Хранилище данных вкладок предприятий
  let enterpriseTabs = new Map();
  let activeTab = 'general-info';
  let formData = {};

  /**
   * Инициализация менеджера вкладок
   */
  function initTabs() {
    // Инициализация менеджера вкладок

    // Устанавливаем обработчики на основную вкладку
    const generalTab = document.querySelector('.tab-btn[data-tab="general-info"]');
    if (generalTab) {
      generalTab.addEventListener('click', () => switchTab('general-info'));
    }

    // Отслеживаем изменения в поле выбора предприятий
    initEnterpriseSelection();

    // Отслеживаем изменения галочки "Применима в холдинге"
    initHoldingWideCheckbox();

    // Загружаем состояние из localStorage при открытии формы
    loadFormState();

    // Включаем автосохранение при изменении полей формы
    initAutoSave();
  }

  /**
   * Инициализация автосохранения состояния формы
   */
  function initAutoSave() {
    // Находим форму
    const form = document.getElementById('addTechForm');
    if (!form) return;

    // Дебаунс функция для сохранения
    let saveTimeout = null;
    const debouncedSave = () => {
      if (saveTimeout) {
        clearTimeout(saveTimeout);
      }
      saveTimeout = setTimeout(() => {
        saveFormState();
      }, 1000); // Сохраняем через 1 секунду после последнего изменения
    };

    // Слушаем изменения всех полей формы
    form.addEventListener('input', function () {
      clearValidationErrors();
      debouncedSave();
    });
    form.addEventListener('change', function () {
      clearValidationErrors();
      debouncedSave();
    });
  }

  /**
   * Инициализация отслеживания выбора предприятий
   */
  function initEnterpriseSelection() {
    const techCompanyInput = document.getElementById('techCompany');
    if (!techCompanyInput) return;

    // Создаем MutationObserver для отслеживания изменений
    const observer = new MutationObserver(() => {
      updateEnterpriseTabs();
    });

    observer.observe(techCompanyInput, {
      attributes: true,
      attributeFilter: ['value']
    });

    // Также слушаем событие change
    techCompanyInput.addEventListener('change', () => {
      updateEnterpriseTabs();
    });

    // Слушаем клики на опциях селекта
    const techCompanySelect = document.querySelector('.custom-select-modal[data-field="techCompany"]');
    if (techCompanySelect) {
      const companyOptions = techCompanySelect.querySelector('.select-options');
      if (companyOptions) {
        companyOptions.addEventListener('click', () => {
          setTimeout(() => {
            updateEnterpriseTabs();
          }, 100);
        });
      }
    }
  }

  /**
   * Инициализация отслеживания галочки "Применима в холдинге"
   */
  function initHoldingWideCheckbox() {
    const holdingWideCheckbox = document.getElementById('techHoldingWide');
    if (!holdingWideCheckbox) return;

    holdingWideCheckbox.addEventListener('change', (e) => {
      const techCompanyField = document.getElementById('techCompany');
      const techCompanySelect = document.querySelector('.custom-select-modal[data-field="techCompany"]');

      if (e.target.checked) {
        // Если галочка отмечена, убираем все вкладки предприятий
        clearAllEnterpriseTabs();

        // Очищаем поле выбора предприятий
        if (techCompanyField) {
          techCompanyField.value = '';
        }
        if (techCompanySelect) {
          const selectedText = techCompanySelect.querySelector('.selected-text');
          if (selectedText) {
            selectedText.textContent = 'Выберите';
          }
        }
      }
    });

    // Также отслеживаем изменения в поле предприятий, чтобы снять галочку
    const techCompanyInput = document.getElementById('techCompany');
    if (techCompanyInput) {
      techCompanyInput.addEventListener('change', () => {
        if (techCompanyInput.value && holdingWideCheckbox.checked) {
          holdingWideCheckbox.checked = false;
        }
      });
    }
  }

  /**
   * Обновление вкладок предприятий на основе выбора
   */
  function updateEnterpriseTabs() {
    const techCompanyInput = document.getElementById('techCompany');
    if (!techCompanyInput) return;

    let selectedCompanies = [];
    const value = techCompanyInput.value;

    if (value) {
      try {
        // Пробуем распарсить как JSON
        if (value.trim().startsWith('[')) {
          selectedCompanies = JSON.parse(value);
        } else {
          selectedCompanies = value.split(',').map(c => c.trim()).filter(Boolean);
        }
      } catch (e) {
        // Если не JSON, просто разделяем по запятым
        selectedCompanies = value.split(',').map(c => c.trim()).filter(Boolean);
      }
    }

    // Нормализуем массив компаний
    if (Array.isArray(selectedCompanies)) {
      selectedCompanies = selectedCompanies.map(c =>
        typeof c === 'string' ? c.trim() : c
      ).filter(Boolean);
    }

    // Выбранные предприятия обновлены

    // Удаляем вкладки для невыбранных предприятий
    const currentTabs = Array.from(enterpriseTabs.keys());
    currentTabs.forEach(companyName => {
      if (!selectedCompanies.includes(companyName)) {
        removeEnterpriseTab(companyName);
      }
    });

    // Добавляем вкладки для новых предприятий
    selectedCompanies.forEach(companyName => {
      if (companyName && !enterpriseTabs.has(companyName)) {
        addEnterpriseTab(companyName);
      }
    });
  }

  /**
   * Добавление вкладки предприятия
   * @param {string} enterpriseName - Название предприятия
   */
  function addEnterpriseTab(enterpriseName) {
    if (!enterpriseName || enterpriseTabs.has(enterpriseName)) {
      return;
    }

    // Добавление вкладки для предприятия

    // Создаем вкладку в заголовке
    const tabBtn = createTabButton(enterpriseName);
    const enterpriseTabsContainer = document.getElementById('enterpriseTabsContainer');
    if (enterpriseTabsContainer) {
      enterpriseTabsContainer.appendChild(tabBtn);
    }

    // Создаем контент вкладки
    const tabContent = createTabContent(enterpriseName);
    const enterpriseTabsContentContainer = document.getElementById('enterpriseTabsContent');
    if (enterpriseTabsContentContainer) {
      enterpriseTabsContentContainer.appendChild(tabContent);
    }

    // Сохраняем ссылки
    enterpriseTabs.set(enterpriseName, {
      button: tabBtn,
      content: tabContent,
      data: {
        technologicalReadiness: null,
        organizationalReadiness: null,
        isImplemented: false
      }
    });

    // Инициализируем селекты для этой вкладки
    if (typeof window.initializeCustomSelects === 'function') {
      window.initializeCustomSelects();
    }
  }

  /**
   * Создание кнопки вкладки
   * @param {string} enterpriseName - Название предприятия
   * @returns {HTMLElement}
   */
  function createTabButton(enterpriseName) {
    const tabBtn = document.createElement('button');
    tabBtn.className = 'tab-btn';
    tabBtn.type = 'button';
    tabBtn.setAttribute('data-tab', `enterprise-${enterpriseName}`);

    const span = document.createElement('span');
    span.textContent = enterpriseName;
    tabBtn.appendChild(span);

    // Кнопка закрытия вкладки
    const closeBtn = document.createElement('button');
    closeBtn.className = 'close-tab-btn';
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', 'Удалить вкладку');
    closeBtn.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M9 3L3 9M3 3L9 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;

    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeEnterpriseFromSelection(enterpriseName);
    });

    tabBtn.appendChild(closeBtn);

    // Обработчик клика на вкладку
    tabBtn.addEventListener('click', () => {
      switchTab(`enterprise-${enterpriseName}`);
    });

    return tabBtn;
  }

  /**
   * Создание контента вкладки предприятия
   * @param {string} enterpriseName - Название предприятия
   * @returns {HTMLElement}
   */
  function createTabContent(enterpriseName) {
    const tabContent = document.createElement('div');
    tabContent.className = 'tab-content';
    tabContent.setAttribute('data-tab-content', `enterprise-${enterpriseName}`);

    tabContent.innerHTML = `
      <div class="enterprise-tab-content">
        <h3 style="margin-bottom: 10px; margin-top: 0; color: var(--text-color);">${enterpriseName}</h3>

        <div class="readiness-fields">
          <div class="form-group">
            <label>Технологическая готовность
              <span class="info-tooltip"
                data-tooltip="Уровень технологической готовности предприятия к внедрению технологии (0-3). 0 - не готово, 3 - полностью готово."
                aria-label="Справка о технологической готовности">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 512 512">
                  <path fill="currentColor" d="M464 256a208 208 0 1 0-416 0a208 208 0 1 0 416 0M0 256a256 256 0 1 1 512 0a256 256 0 1 1-512 0m169.8-90.7c7.9-22.3 29.1-37.3 52.8-37.3h58.3c34.9 0 63.1 28.3 63.1 63.1c0 22.6-12.1 43.5-31.7 54.8L280 264.4c-.2 13-10.9 23.6-24 23.6c-13.3 0-24-10.7-24-24v-13.5c0-8.6 4.6-16.5 12.1-20.8l44.3-25.4c4.7-2.7 7.6-7.7 7.6-13.1c0-8.4-6.8-15.1-15.1-15.1h-58.3c-3.4 0-6.4 2.1-7.5 5.3l-.4 1.2c-4.4 12.5-18.2 19-30.6 14.6s-19-18.2-14.6-30.6l.4-1.2zM224 352a32 32 0 1 1 64 0a32 32 0 1 1-64 0"/>
                </svg>
              </span>
            </label>
            <div class="custom-select-modal" data-field="techReadiness_${enterpriseName}" tabindex="0">
              <div class="select-trigger">
                <span class="selected-text">Выберите</span>
                <svg class="arrow" width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M3 5L6 8L9 5" stroke="#666" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </div>
              <ul class="select-options">
                <li data-value="0">0 - Не готово</li>
                <li data-value="1">1 - Начальная готовность</li>
                <li data-value="2">2 - Средняя готовность</li>
                <li data-value="3">3 - Полная готовность</li>
              </ul>
            </div>
            <input type="hidden" id="techReadiness_${enterpriseName}" name="techReadiness_${enterpriseName}" />
          </div>

          <div class="form-group">
            <label>Организационная готовность
              <span class="info-tooltip"
                data-tooltip="Уровень организационной готовности предприятия к внедрению технологии (0-3). 0 - не готово, 3 - полностью готово."
                aria-label="Справка об организационной готовности">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 512 512">
                  <path fill="currentColor" d="M464 256a208 208 0 1 0-416 0a208 208 0 1 0 416 0M0 256a256 256 0 1 1 512 0a256 256 0 1 1-512 0m169.8-90.7c7.9-22.3 29.1-37.3 52.8-37.3h58.3c34.9 0 63.1 28.3 63.1 63.1c0 22.6-12.1 43.5-31.7 54.8L280 264.4c-.2 13-10.9 23.6-24 23.6c-13.3 0-24-10.7-24-24v-13.5c0-8.6 4.6-16.5 12.1-20.8l44.3-25.4c4.7-2.7 7.6-7.7 7.6-13.1c0-8.4-6.8-15.1-15.1-15.1h-58.3c-3.4 0-6.4 2.1-7.5 5.3l-.4 1.2c-4.4 12.5-18.2 19-30.6 14.6s-19-18.2-14.6-30.6l.4-1.2zM224 352a32 32 0 1 1 64 0a32 32 0 1 1-64 0"/>
                </svg>
              </span>
            </label>
            <div class="custom-select-modal" data-field="orgReadiness_${enterpriseName}" tabindex="0">
              <div class="select-trigger">
                <span class="selected-text">Выберите</span>
                <svg class="arrow" width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M3 5L6 8L9 5" stroke="#666" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </div>
              <ul class="select-options">
                <li data-value="0">0 - Не готово</li>
                <li data-value="1">1 - Начальная готовность</li>
                <li data-value="2">2 - Средняя готовность</li>
                <li data-value="3">3 - Полная готовность</li>
              </ul>
            </div>
            <input type="hidden" id="orgReadiness_${enterpriseName}" name="orgReadiness_${enterpriseName}" />
          </div>
        </div>

        <div class="implementation-status">
          <div class="checkbox-group">
            <label class="checkbox-label">
              <input type="checkbox" id="isImplemented_${enterpriseName}" name="isImplemented_${enterpriseName}" />
              <span>Технология внедрена на предприятии</span>
            </label>
          </div>
        </div>
      </div>
    `;

    return tabContent;
  }

  /**
   * Переключение между вкладками
   * @param {string} tabId - ID вкладки
   */
  function switchTab(tabId, options = {}) {
    const scrollToTop = options.scrollToTop !== false;

    // Переключение на вкладку

    // Сохраняем данные текущей вкладки
    saveCurrentTabData();

    // Убираем активный класс со всех вкладок
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.remove('active');
    });

    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.remove('active');
    });

    // Активируем нужную вкладку
    const tabBtn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
    const tabContent = document.querySelector(`.tab-content[data-tab-content="${tabId}"]`);

    if (tabBtn) tabBtn.classList.add('active');
    if (tabContent) {
      tabContent.classList.add('active');

      // Скроллим к верху только при явном переключении вкладки пользователем, не при программном (например, при снятии вкладок предприятий)
      if (scrollToTop) {
        const modalBody = document.querySelector('#addTechPanel .modal-body');
        if (modalBody) {
          modalBody.scrollTop = 0;
        }
      }
    }

    activeTab = tabId;
  }

  /**
   * Удаление вкладки предприятия
   * @param {string} enterpriseName - Название предприятия
   */
  function removeEnterpriseTab(enterpriseName) {
    const tabData = enterpriseTabs.get(enterpriseName);
    if (!tabData) return;

    // Удаление вкладки

    // Удаляем элементы из DOM
    if (tabData.button) tabData.button.remove();
    if (tabData.content) tabData.content.remove();

    // Удаляем из хранилища
    enterpriseTabs.delete(enterpriseName);

    // Если удалили активную вкладку, переключаемся на общую информацию (без сброса прокрутки, чтобы не выкидывать пользователя наверх)
    if (activeTab === `enterprise-${enterpriseName}`) {
      switchTab('general-info', { scrollToTop: false });
    }
  }

  /**
   * Удаление всех вкладок предприятий
   */
  function clearAllEnterpriseTabs() {
    // Удаление всех вкладок предприятий

    const enterpriseNames = Array.from(enterpriseTabs.keys());
    enterpriseNames.forEach(name => {
      removeEnterpriseTab(name);
    });

    // Переключаемся на общую информацию без сброса прокрутки (чтобы не выкидывать пользователя наверх при галочке "применима в холдинге")
    switchTab('general-info', { scrollToTop: false });
  }

  /**
   * Удаление предприятия из выбора (обновляет поле и селект)
   * @param {string} enterpriseName - Название предприятия
   */
  function removeEnterpriseFromSelection(enterpriseName) {
    const techCompanyInput = document.getElementById('techCompany');
    if (!techCompanyInput) return;

    let selectedCompanies = [];
    const value = techCompanyInput.value;

    if (value) {
      try {
        if (value.trim().startsWith('[')) {
          selectedCompanies = JSON.parse(value);
        } else {
          selectedCompanies = value.split(',').map(c => c.trim()).filter(Boolean);
        }
      } catch (e) {
        selectedCompanies = value.split(',').map(c => c.trim()).filter(Boolean);
      }
    }

    // Удаляем предприятие из списка
    selectedCompanies = selectedCompanies.filter(c => c !== enterpriseName);

    // Обновляем поле
    techCompanyInput.value = selectedCompanies.length > 0
      ? JSON.stringify(selectedCompanies)
      : '';

    // Обновляем визуальное отображение селекта
    const techCompanySelect = document.querySelector('.custom-select-modal[data-field="techCompany"]');
    if (techCompanySelect) {
      const selectedText = techCompanySelect.querySelector('.selected-text');
      if (selectedText) {
        selectedText.textContent = selectedCompanies.length > 0
          ? selectedCompanies.join(', ')
          : 'Выберите';
      }

      // Снимаем галочку с опции в селекте
      const option = Array.from(techCompanySelect.querySelectorAll('.select-options li')).find(li =>
        li.textContent.trim() === enterpriseName
      );
      if (option) {
        option.classList.remove('selected');
      }
    }

    // Триггерим событие change
    const event = new Event('change', { bubbles: true });
    techCompanyInput.dispatchEvent(event);
  }

  /**
   * Сохранение данных текущей вкладки
   */
  function saveCurrentTabData() {
    if (activeTab === 'general-info') {
      // Для общей информации данные сохраняются автоматически в полях формы
      return;
    }

    // Извлекаем название предприятия из ID вкладки
    const enterpriseName = activeTab.replace('enterprise-', '');
    const tabData = enterpriseTabs.get(enterpriseName);

    if (!tabData) return;

    // Сохраняем данные из полей вкладки
    const techReadinessInput = document.getElementById(`techReadiness_${enterpriseName}`);
    const orgReadinessInput = document.getElementById(`orgReadiness_${enterpriseName}`);
    const isImplementedCheckbox = document.getElementById(`isImplemented_${enterpriseName}`);

    if (techReadinessInput) {
      tabData.data.technologicalReadiness = techReadinessInput.value || null;
    }
    if (orgReadinessInput) {
      tabData.data.organizationalReadiness = orgReadinessInput.value || null;
    }
    if (isImplementedCheckbox) {
      tabData.data.isImplemented = isImplementedCheckbox.checked;
    }
  }

  /**
   * Получение данных всех вкладок предприятий
   * @returns {Object} Данные предприятий в формате { enterpriseName: { data } }
   */
  function getAllEnterpriseData() {
    // Сохраняем данные текущей вкладки
    saveCurrentTabData();

    const result = {};
    enterpriseTabs.forEach((tabData, enterpriseName) => {
      result[enterpriseName] = {
        ...tabData.data
      };
    });

    return result;
  }

  /**
   * Сохранение состояния формы в localStorage
   */
  function saveFormState() {
    try {
      const state = {
        activeTab: activeTab,
        enterpriseData: getAllEnterpriseData(),
        timestamp: Date.now()
      };
      localStorage.setItem('techFormState', JSON.stringify(state));
      // Состояние формы сохранено
    } catch (e) {
      // Ошибка сохранения состояния
    }
  }

  /**
   * Загрузка состояния формы из localStorage
   */
  function loadFormState() {
    try {
      const stateStr = localStorage.getItem('techFormState');
      if (!stateStr) return;

      const state = JSON.parse(stateStr);

      // Проверяем, не устарело ли состояние (более 1 часа)
      const oneHour = 60 * 60 * 1000;
      if (Date.now() - state.timestamp > oneHour) {
        localStorage.removeItem('techFormState');
        return;
      }

      // Загружено состояние формы из localStorage

      // Восстанавливаем данные предприятий
      if (state.enterpriseData) {
        Object.entries(state.enterpriseData).forEach(([enterpriseName, data]) => {
          const tabData = enterpriseTabs.get(enterpriseName);
          if (tabData) {
            tabData.data = { ...data };

            // Восстанавливаем значения в полях
            const techReadinessInput = document.getElementById(`techReadiness_${enterpriseName}`);
            const orgReadinessInput = document.getElementById(`orgReadiness_${enterpriseName}`);
            const isImplementedCheckbox = document.getElementById(`isImplemented_${enterpriseName}`);

            if (techReadinessInput && data.technologicalReadiness !== null) {
              techReadinessInput.value = data.technologicalReadiness;
            }
            if (orgReadinessInput && data.organizationalReadiness !== null) {
              orgReadinessInput.value = data.organizationalReadiness;
            }
            if (isImplementedCheckbox && data.isImplemented !== undefined) {
              isImplementedCheckbox.checked = data.isImplemented;
            }
          }
        });
      }
    } catch (e) {
      // Ошибка загрузки состояния
    }
  }

  /**
   * Очистка состояния формы из localStorage
   */
  function clearFormState() {
    try {
      localStorage.removeItem('techFormState');
      // Состояние формы очищено
    } catch (e) {
      // Ошибка очистки состояния
    }
  }

  /**
   * Валидация данных формы
   * @returns {Object} { valid: boolean, errors: string[], fieldErrors: Object.<string, string> }
   */
  function validateForm() {
    const errors = [];
    const fieldErrors = {};

    // Проверяем обязательные поля на вкладке "Общая информация"
    const techName = document.getElementById('techName');
    if (!techName || !techName.value.trim()) {
      errors.push('Заполните поле "Название"');
      fieldErrors.techName = 'Заполните поле "Название"';
    }

    const techDirections = document.getElementById('techDirections');
    if (!techDirections || !techDirections.value.trim()) {
      errors.push('Выберите "Направления цифрового развития"');
      fieldErrors.techDirections = 'Выберите "Направления цифрового развития"';
    }

    const techBlock = document.getElementById('techBlock');
    if (!techBlock || !techBlock.value.trim()) {
      errors.push('Выберите "Функциональный блок"');
      fieldErrors.techBlock = 'Выберите "Функциональный блок"';
    }

    const techFunc = document.getElementById('techFunc');
    if (!techFunc || !techFunc.value.trim()) {
      errors.push('Выберите "Функцию"');
      fieldErrors.techFunc = 'Выберите "Функцию"';
    }

    const techTrlStage = document.getElementById('techTrlStage');
    if (!techTrlStage || !techTrlStage.value.trim()) {
      errors.push('Выберите "TRL (стадия готовности технологии)"');
      fieldErrors.techTrlStage = 'Выберите "TRL (стадия готовности технологии)"';
    }

    const techFuncCover = document.getElementById('techFuncCover');
    if (!techFuncCover || !techFuncCover.value.trim() || techFuncCover.value.trim() === '—') {
      errors.push('Выберите "Покрытие функций"');
      fieldErrors.techFuncCover = 'Выберите "Покрытие функций"';
    }

    const techDesc = document.getElementById('techDesc');
    if (!techDesc || !techDesc.value.trim()) {
      errors.push('Заполните поле "Описание"');
      fieldErrors.techDesc = 'Заполните поле "Описание"';
    }

    // Проверяем поле "Область применения"
    const holdingWideCheckbox = document.getElementById('techHoldingWide');
    const techCompanyField = document.getElementById('techCompany');
    const holdingWideChecked = holdingWideCheckbox && holdingWideCheckbox.checked;
    const companiesSelected = techCompanyField && techCompanyField.value && techCompanyField.value.trim();

    if (!holdingWideChecked && !companiesSelected) {
      errors.push('Отметьте "Применима в холдинге" или выберите конкретные предприятия');
      fieldErrors.techCompany = 'Отметьте "Применима в холдинге" или выберите конкретные предприятия';
    }

    return {
      valid: errors.length === 0,
      errors: errors,
      fieldErrors: fieldErrors
    };
  }

  /**
   * Показать подсветку и сообщения об ошибках у незаполненных полей в модальном окне
   * @param {Object.<string, string>} fieldErrors - объект fieldId -> сообщение об ошибке
   */
  function showValidationErrors(fieldErrors) {
    if (!fieldErrors || typeof fieldErrors !== 'object') return;
    clearValidationErrors();
    const addModal = document.getElementById('addTechPanel');
    if (!addModal) return;
    for (const [fieldId, message] of Object.entries(fieldErrors)) {
      const errorElId = fieldId + 'Error';
      const errorEl = document.getElementById(errorElId);
      const fieldEl = document.getElementById(fieldId);
      const formGroup = fieldEl ? fieldEl.closest('.form-group') : addModal.querySelector('[data-field="' + fieldId + '"]');
      const group = formGroup ? formGroup.closest('.form-group') : null;
      const targetGroup = group || (fieldEl && fieldEl.closest('.form-group'));
      if (targetGroup) {
        targetGroup.classList.add('has-error');
      }
      if (errorEl) {
        errorEl.textContent = message;
        errorEl.classList.add('visible');
        errorEl.setAttribute('aria-live', 'polite');
      }
    }
    switchTab('general-info');
  }

  /**
   * Снять подсветку и скрыть сообщения об ошибках валидации
   */
  function clearValidationErrors() {
    const addModal = document.getElementById('addTechPanel');
    if (!addModal) return;
    addModal.querySelectorAll('.form-group.has-error').forEach(function (el) {
      el.classList.remove('has-error');
    });
    addModal.querySelectorAll('.field-error-message.visible').forEach(function (el) {
      el.classList.remove('visible');
      el.textContent = '';
    });
  }

  /**
   * Сброс формы
   */
  function resetForm() {
    // Сброс формы
    clearValidationErrors();

    // Очищаем все вкладки предприятий
    clearAllEnterpriseTabs();

    // Переключаемся на общую информацию
    switchTab('general-info');

    // Очищаем localStorage
    clearFormState();

    // Сбрасываем данные
    formData = {};
  }

  // Публичный API
  window.TechTabsManager = {
    init: initTabs,
    switchTab: switchTab,
    getAllEnterpriseData: getAllEnterpriseData,
    saveFormState: saveFormState,
    loadFormState: loadFormState,
    clearFormState: clearFormState,
    validateForm: validateForm,
    showValidationErrors: showValidationErrors,
    clearValidationErrors: clearValidationErrors,
    resetForm: resetForm,
    getActiveTabs: () => Array.from(enterpriseTabs.keys()),
    getActiveTab: () => activeTab
  };

  // Модуль TechTabsManager загружен

})(window);
