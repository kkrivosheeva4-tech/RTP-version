/**
 * Модуль управления вкладками в форме редактирования технологии
 * Отвечает за создание динамических вкладок предприятий и переключение между ними
 * ES module
 */

import { escapeHtml } from '../core/escape-utils.js';

'use strict';

    // Хранилище данных вкладок предприятий
    let enterpriseTabs = new Map();
    let activeTab = 'edit-general-info';
    let formData = {};

    /**
     * Инициализация менеджера вкладок
     */
    function initTabs() {
        // Инициализация менеджера вкладок

        // Устанавливаем обработчики на основную вкладку
        const generalTab = document.querySelector('.tab-btn[data-tab="edit-general-info"]');
        if (generalTab) {
            generalTab.addEventListener('click', () => switchTab('edit-general-info'));
        }

        // Отслеживаем изменения в поле выбора предприятий
        initEnterpriseSelection();

        // Отслеживаем изменения галочки "Применима в холдинге"
        initHoldingWideCheckbox();
    }

    /**
     * Инициализация отслеживания выбора предприятий
     */
    function initEnterpriseSelection() {
        const editCompanyInput = document.getElementById('editCompany');
        if (!editCompanyInput) return;

        // Создаем MutationObserver для отслеживания изменений
        const observer = new MutationObserver(() => {
            updateEnterpriseTabs();
        });

        observer.observe(editCompanyInput, {
            attributes: true,
            attributeFilter: ['value']
        });

        // Также слушаем событие change
        editCompanyInput.addEventListener('change', () => {
            updateEnterpriseTabs();
        });

        // Слушаем клики на опциях селекта
        const editCompanySelect = document.querySelector('.custom-select-modal[data-field="editCompany"]');
        if (editCompanySelect) {
            const companyOptions = editCompanySelect.querySelector('.select-options');
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
        const holdingWideCheckbox = document.getElementById('editHoldingWide');
        if (!holdingWideCheckbox) return;

        holdingWideCheckbox.addEventListener('change', (e) => {
            const editCompanyField = document.getElementById('editCompany');
            const editCompanySelect = document.querySelector('.custom-select-modal[data-field="editCompany"]');

            if (e.target.checked) {
                // Если галочка отмечена, убираем все вкладки предприятий
                clearAllEnterpriseTabs();

                // Очищаем поле выбора предприятий
                if (editCompanyField) {
                    editCompanyField.value = '';
                }
                if (editCompanySelect) {
                    const selectedText = editCompanySelect.querySelector('.selected-text');
                    if (selectedText) {
                        selectedText.textContent = 'Выберите';
                    }
                }
            }
        });

        // Также отслеживаем изменения в поле предприятий, чтобы снять галочку
        const editCompanyInput = document.getElementById('editCompany');
        if (editCompanyInput) {
            editCompanyInput.addEventListener('change', () => {
                if (editCompanyInput.value && holdingWideCheckbox.checked) {
                    holdingWideCheckbox.checked = false;
                }
            });
        }
    }

    /**
     * Обновление вкладок предприятий на основе выбора
     */
    function updateEnterpriseTabs() {
        // updateEnterpriseTabs вызвана
        const editCompanyInput = document.getElementById('editCompany');
        if (!editCompanyInput) {
            // Поле editCompany не найдено
            return;
        }

        let selectedCompanies = [];
        const value = editCompanyInput.value;
        // Значение поля editCompany обновлено

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
        const enterpriseTabsContainer = document.getElementById('editEnterpriseTabsContainer');
        if (enterpriseTabsContainer) {
            enterpriseTabsContainer.appendChild(tabBtn);
            // Кнопка вкладки добавлена
        } else {
            // Контейнер editEnterpriseTabsContainer не найден
        }

        // Создаем контент вкладки
        const tabContent = createTabContent(enterpriseName);
        const enterpriseTabsContentContainer = document.getElementById('editEnterpriseTabsContent');
        if (enterpriseTabsContentContainer) {
            enterpriseTabsContentContainer.appendChild(tabContent);
            // Контент вкладки добавлен
        } else {
            // Контейнер editEnterpriseTabsContent не найден
        }

        // Сохраняем ссылки
        enterpriseTabs.set(enterpriseName, {
            button: tabBtn,
            content: tabContent,
            data: {
                technologicalReadiness: null,
                organizationalReadiness: null,
                functionalCoverage: null,
                trlStage: null,
                status: null,
                isImplemented: undefined
            }
        });

        // Инициализируем селекты для этой вкладки
        if (typeof window.initializeCustomSelects === 'function') {
            window.initializeCustomSelects();
        }

        // Добавляем обработчики для скрытия предупреждения при заполнении полей
        setTimeout(() => {
            const techReadInput = document.getElementById(`editTechReadiness_${enterpriseName}`);
            const orgReadInput = document.getElementById(`editOrgReadiness_${enterpriseName}`);
            const isImplementedCheckbox = document.getElementById(`editIsImplemented_${enterpriseName}`);
            const warningBlock = document.getElementById(`ratingWarning_${enterpriseName}`);

            const updateWarning = () => {
                if (warningBlock && techReadInput && orgReadInput) {
                    const hasTechRead = techReadInput.value !== '' && techReadInput.value !== null;
                    const hasOrganRead = orgReadInput.value !== '' && orgReadInput.value !== null;

                    if (hasTechRead && hasOrganRead) {
                        warningBlock.style.display = 'none';
                    } else {
                        warningBlock.style.display = 'block';
                    }
                }
            };

            if (techReadInput) {
                techReadInput.addEventListener('change', updateWarning);
            }
            if (orgReadInput) {
                orgReadInput.addEventListener('change', updateWarning);
            }
            if (isImplementedCheckbox) {
                isImplementedCheckbox.dataset.userTouched = '0';
                isImplementedCheckbox.addEventListener('change', () => {
                    isImplementedCheckbox.dataset.userTouched = '1';
                });
            }

            // Показываем предупреждение по умолчанию (данные еще не загружены)
            if (warningBlock) {
                warningBlock.style.display = 'block';
            }
        }, 100);
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
        tabBtn.setAttribute('data-tab', `edit-enterprise-${enterpriseName}`);

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
            switchTab(`edit-enterprise-${enterpriseName}`);
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
        tabContent.setAttribute('data-tab-content', `edit-enterprise-${enterpriseName}`);

        const escapedName = escapeHtml(enterpriseName);

        tabContent.innerHTML = `
      <div class="enterprise-tab-content">
        <h3 style="margin-bottom: 10px; margin-top: 0; color: var(--text-color);">${escapedName}</h3>

        <!-- Блок уведомления о незаполненных оценках -->
        <div class="rating-warning" id="ratingWarning_${escapedName}" style="display: none; background-color: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ff9800" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <div style="flex: 1;">
              <strong style="color: #856404;">Внимание!</strong>
              <p style="margin: 5px 0 0 0; color: #856404; font-size: 14px;">Оценки для предприятия "${escapedName}" не заполнены. Пожалуйста, укажите технологическую и организационную готовность.</p>
            </div>
          </div>
        </div>

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
            <div class="custom-select-modal" data-field="editTechReadiness_${escapedName}" tabindex="0">
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
            <input type="hidden" id="editTechReadiness_${escapedName}" name="editTechReadiness_${escapedName}" />
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
            <div class="custom-select-modal" data-field="editOrgReadiness_${escapedName}" tabindex="0">
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
            <input type="hidden" id="editOrgReadiness_${escapedName}" name="editOrgReadiness_${escapedName}" />
          </div>
        </div>

        <div class="implementation-status">
          <div class="checkbox-group">
            <label class="checkbox-label">
              <input type="checkbox" id="editIsImplemented_${escapedName}" name="editIsImplemented_${escapedName}" />
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
        document.querySelectorAll('#editTechPanel .tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        document.querySelectorAll('#editTechPanel .tab-content').forEach(content => {
            content.classList.remove('active');
        });

        // Активируем нужную вкладку
        const tabBtn = document.querySelector(`#editTechPanel .tab-btn[data-tab="${tabId}"]`);
        const tabContent = document.querySelector(`#editTechPanel .tab-content[data-tab-content="${tabId}"]`);

        if (tabBtn) tabBtn.classList.add('active');
        if (tabContent) {
            tabContent.classList.add('active');

            // Скроллим к верху только при явном переключении вкладки пользователем, не при программном (например, при снятии вкладок предприятий)
            if (scrollToTop) {
                const modalBody = document.querySelector('#editTechPanel .modal-body');
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
        if (activeTab === `edit-enterprise-${enterpriseName}`) {
            switchTab('edit-general-info', { scrollToTop: false });
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
        switchTab('edit-general-info', { scrollToTop: false });
    }

    /**
     * Удаление предприятия из выбора (обновляет поле и селект)
     * @param {string} enterpriseName - Название предприятия
     */
    function removeEnterpriseFromSelection(enterpriseName) {
        const editCompanyInput = document.getElementById('editCompany');
        if (!editCompanyInput) return;

        let selectedCompanies = [];
        const value = editCompanyInput.value;

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
        editCompanyInput.value = selectedCompanies.length > 0
            ? JSON.stringify(selectedCompanies)
            : '';

        // Обновляем визуальное отображение селекта
        const editCompanySelect = document.querySelector('.custom-select-modal[data-field="editCompany"]');
        if (editCompanySelect) {
            const selectedText = editCompanySelect.querySelector('.selected-text');
            if (selectedText) {
                selectedText.textContent = selectedCompanies.length > 0
                    ? selectedCompanies.join(', ')
                    : 'Выберите';
            }

            // Снимаем галочку с опции в селекте
            const option = Array.from(editCompanySelect.querySelectorAll('.select-options li')).find(li =>
                li.textContent.trim() === enterpriseName
            );
            if (option) {
                option.classList.remove('selected');
            }
        }

        // Триггерим событие change
        const event = new Event('change', { bubbles: true });
        editCompanyInput.dispatchEvent(event);
    }

    /**
     * Сохранение данных текущей вкладки
     */
    function saveCurrentTabData() {
        if (activeTab === 'edit-general-info') {
            // Для общей информации данные сохраняются автоматически в полях формы
            return;
        }

        // Извлекаем название предприятия из ID вкладки
        const enterpriseName = activeTab.replace('edit-enterprise-', '');
        const tabData = enterpriseTabs.get(enterpriseName);

        if (!tabData) return;

        // Сохраняем данные из полей вкладки
        const techReadInput = document.getElementById(`editTechReadiness_${enterpriseName}`);
        const orgReadInput = document.getElementById(`editOrgReadiness_${enterpriseName}`);
        const isImplementedCheckbox = document.getElementById(`editIsImplemented_${enterpriseName}`);

        if (techReadInput) {
            const val = techReadInput.value;
            tabData.data.technologicalReadiness = (val !== '' && val !== null) ? parseInt(val, 10) : null;
        }
        if (orgReadInput) {
            const val = orgReadInput.value;
            tabData.data.organizationalReadiness = (val !== '' && val !== null) ? parseInt(val, 10) : null;
        }
        if (isImplementedCheckbox) {
            const hasStoredBoolean = typeof tabData.data.isImplemented === 'boolean';
            const isTouched = isImplementedCheckbox.dataset.userTouched === '1';
            if (hasStoredBoolean || isTouched || isImplementedCheckbox.checked === true) {
                tabData.data.isImplemented = isImplementedCheckbox.checked;
            } else {
                delete tabData.data.isImplemented;
            }
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
     * Загрузка данных предприятий в вкладки
     * @param {Object} companyRatings - Объект с данными по предприятиям
     */
    function loadEnterpriseData(companyRatings) {
        // Загрузка данных предприятий

        if (!companyRatings || typeof companyRatings !== 'object') {
            // Нет данных для загрузки
            return;
        }

        // Проходим по каждому предприятию
        enterpriseTabs.forEach((tabData, enterpriseName) => {
            const data = companyRatings[enterpriseName] || {};

            // Загрузка данных для предприятия

            let hasTechRead = false;
            let hasOrganRead = false;

            // Технологическая готовность
            if (data.techRead !== undefined && data.techRead !== null) {
                const techReadInput = document.getElementById(`editTechReadiness_${enterpriseName}`);
                if (techReadInput) {
                    techReadInput.value = data.techRead.toString();
                    const customSelect = document.querySelector(`[data-field="editTechReadiness_${enterpriseName}"]`);
                    if (customSelect) {
                        const selectedText = customSelect.querySelector('.selected-text');
                        const optionText = customSelect.querySelector(`[data-value="${data.techRead}"]`)?.textContent;
                        if (selectedText && optionText) {
                            selectedText.textContent = optionText;
                        }
                    }
                    hasTechRead = true;
                }
            }

            // Организационная готовность
            if (data.organRead !== undefined && data.organRead !== null) {
                const orgReadInput = document.getElementById(`editOrgReadiness_${enterpriseName}`);
                if (orgReadInput) {
                    orgReadInput.value = data.organRead.toString();
                    const customSelect = document.querySelector(`[data-field="editOrgReadiness_${enterpriseName}"]`);
                    if (customSelect) {
                        const selectedText = customSelect.querySelector('.selected-text');
                        const optionText = customSelect.querySelector(`[data-value="${data.organRead}"]`)?.textContent;
                        if (selectedText && optionText) {
                            selectedText.textContent = optionText;
                        }
                    }
                    hasOrganRead = true;
                }
            }

            // Статус внедрения
            if (data.isImplemented !== undefined) {
                const isImplementedCheckbox = document.getElementById(`editIsImplemented_${enterpriseName}`);
                if (isImplementedCheckbox) {
                    isImplementedCheckbox.checked = data.isImplemented;
                    isImplementedCheckbox.dataset.userTouched = '0';
                }
            }

            // Показываем/скрываем предупреждение о незаполненных оценках
            const warningBlock = document.getElementById(`ratingWarning_${enterpriseName}`);
            if (warningBlock) {
                if (!hasTechRead || !hasOrganRead) {
                    warningBlock.style.display = 'block';
                } else {
                    warningBlock.style.display = 'none';
                }
            }

            // Сохраняем данные в enterpriseTabs
            tabData.data = {
                technologicalReadiness: data.techRead !== undefined ? data.techRead : null,
                organizationalReadiness: data.organRead !== undefined ? data.organRead : null,
                isImplemented: typeof data.isImplemented === 'boolean' ? data.isImplemented : undefined
            };
        });

        // Данные успешно загружены
    }

    /**
     * Сброс формы
     */
    function resetForm() {
        // Сброс формы

        // Очищаем все вкладки предприятий
        clearAllEnterpriseTabs();

        // Переключаемся на общую информацию
        switchTab('edit-general-info');

        // Сбрасываем данные
        formData = {};
    }

    // Публичный API
    const EditTechTabsManager = {
        init: initTabs,
        switchTab: switchTab,
        getAllEnterpriseData: getAllEnterpriseData,
        loadEnterpriseData: loadEnterpriseData,
        resetForm: resetForm,
        updateTabs: updateEnterpriseTabs,
        getActiveTabs: () => Array.from(enterpriseTabs.keys()),
        getActiveTab: () => activeTab
    };

    if (typeof window !== 'undefined') {
        window.EditTechTabsManager = EditTechTabsManager;
    }

    export default EditTechTabsManager;
