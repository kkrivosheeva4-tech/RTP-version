// export.js
// Модуль экспорта PDF отчетов

import Logger from '../core/logger.js';
import ExportFieldsConfig from './export-fields-config.js';
import { applyFiltersToTechnologies as applyExportFilters } from './export-filters.js';
import { generatePdf } from './export-pdf.js';

'use strict';

  // ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =====

  // Helper для безопасных вызовов window функций
  function safeGet(fnName, defaultValue = null) {
    return typeof window[fnName] === 'function' ? window[fnName]() : defaultValue;
  }

  function canExportReports() {
    const roleApi = window.RoleCapabilities || window.RolesConfig || null;
    if (roleApi && typeof roleApi.canExportReports === 'function') {
      return roleApi.canExportReports();
    }
    if (roleApi && typeof roleApi.hasCapability === 'function') {
      return roleApi.hasCapability('export_reports');
    }
    if (window.AuthModule && typeof window.AuthModule.isAuthenticated === 'function') {
      return window.AuthModule.isAuthenticated();
    }
    try {
      return String(localStorage.getItem('role') || '').trim() !== '';
    } catch (_) {
      return false;
    }
  }

  // Универсальная функция для установки значений в multi-select
  function setMultiSelectFilter(fieldName, values, placeholder) {
    const container = document.getElementById(`filter_${fieldName}_container`);
    if (!container) return;

    const checkbox = document.getElementById(`field_${fieldName}`);
    if (checkbox) {
      checkbox.checked = true;
      container.classList.remove('disabled');
    }

    const hiddenInput = container.querySelector('input[type="hidden"]');
    if (!hiddenInput) return;

    hiddenInput.value = JSON.stringify(values);
    const selectAllCheckbox = container.querySelector('input[data-select-all="true"]');
    const regularCheckboxes = container.querySelectorAll('.export-multi-select-option:not(.select-all-option) input[type="checkbox"]');

    regularCheckboxes.forEach(cb => {
      cb.checked = values.includes(cb.value);
    });

    if (selectAllCheckbox) {
      const allChecked = Array.from(regularCheckboxes).every(cb => cb.checked);
      const someChecked = Array.from(regularCheckboxes).some(cb => cb.checked);
      selectAllCheckbox.checked = allChecked;
      selectAllCheckbox.indeterminate = someChecked && !allChecked;
    }

    updateMultiSelectValue(container, placeholder);
  }

  // Универсальная функция очистки ошибок поля
  function clearFieldError(fieldName, container) {
    const fieldCheckbox = document.getElementById(`field_${fieldName}`);
    if (fieldCheckbox && fieldCheckbox.checked) {
      const fieldItem = fieldCheckbox.closest('.export-field-item');
      if (fieldItem) {
        fieldItem.classList.remove('has-error');
      }
      if (container) {
        container.classList.remove('has-error');
      }
    }
    const errorMessage = document.getElementById('exportFieldsError');
    if (errorMessage) {
      errorMessage.style.display = 'none';
    }
  }

  function applyFiltersToTechnologies(sourceList, filters) {
    return applyExportFilters(sourceList || [], filters || {});
  }

  // ===== ФУНКЦИИ РАБОТЫ С MULTI-SELECT =====

  // Функция для заполнения множественного выбора
  function populateMultiSelect(containerId, items, placeholder) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const optionsContainer = container.querySelector('.export-multi-select-options');
    const hiddenInput = container.querySelector('input[type="hidden"]');
    const textElement = container.querySelector('.export-multi-select-text');

    if (!optionsContainer || !hiddenInput || !textElement) return;

    // Сохраняем placeholder для использования в updateMultiSelectValue
    container.setAttribute('data-placeholder', placeholder);

    // Очистка существующих опций
    optionsContainer.innerHTML = '';

    // Используем DocumentFragment для оптимизации создания DOM элементов
    const fragment = document.createDocumentFragment();

    // Добавляем опцию "Выбрать все" в начало списка
    const selectAllOption = document.createElement('div');
    selectAllOption.className = 'export-multi-select-option select-all-option';
    const selectAllId = `${containerId}_select_all`;
    selectAllOption.innerHTML = `
      <input type="checkbox" value="__SELECT_ALL__" id="${selectAllId}" data-select-all="true">
      <label for="${selectAllId}">Выбрать все</label>
    `;
    fragment.appendChild(selectAllOption);

    // Заполнение опций - используем DocumentFragment для пакетной вставки
    items.forEach(item => {
      const option = document.createElement('div');
      option.className = 'export-multi-select-option';
      const safeId = `${containerId}_${item.replace(/[^a-zA-Z0-9_]/g, '_')}`;
      option.innerHTML = `
        <input type="checkbox" value="${item.replace(/"/g, '&quot;')}" id="${safeId}">
        <label for="${safeId}">${item}</label>
      `;
      fragment.appendChild(option);
    });

    // Вставляем все элементы за один раз
    optionsContainer.appendChild(fragment);

    // Инициализация обработчиков для этого селекта (после добавления опций)
    setTimeout(() => {
      initMultiSelect(container, placeholder);
    }, 0);
  }

  // Функция для обновления значения множественного выбора
  function updateMultiSelectValue(container, placeholder) {
    // Исключаем опцию "Выбрать все" из подсчета
    const checkboxes = container.querySelectorAll('.export-multi-select-option:not(.select-all-option) input[type="checkbox"]:checked');
    const hiddenInput = container.querySelector('input[type="hidden"]');
    const textElement = container.querySelector('.export-multi-select-text');

    if (!hiddenInput || !textElement) return;

    const selectedValues = Array.from(checkboxes).map(cb => cb.value);

    // Получаем общее количество опций (без "Выбрать все")
    const totalOptions = container.querySelectorAll('.export-multi-select-option:not(.select-all-option)').length;

    // Если выбраны ВСЕ опции, сохраняем пустой массив (означает "без фильтрации")
    if (selectedValues.length === totalOptions) {
      hiddenInput.value = '[]';
    } else {
      hiddenInput.value = JSON.stringify(selectedValues);
    }

    if (selectedValues.length === 0) {
      textElement.textContent = placeholder || 'Все';
    } else if (selectedValues.length === totalOptions) {
      textElement.textContent = placeholder || 'Все';
    } else if (selectedValues.length === 1) {
      textElement.textContent = selectedValues[0];
    } else {
      textElement.textContent = `Выбрано: ${selectedValues.length}`;
    }

    // Очищаем ошибки при выборе значения
    const allSelected = totalOptions > 0 && selectedValues.length === totalOptions;
    const hasSelection = selectedValues.length > 0 || allSelected;

    const fieldName = container.getAttribute('data-field');
    if (fieldName && hasSelection) {
      const fieldCheckbox = document.getElementById(`field_${fieldName}`);
      if (fieldCheckbox && fieldCheckbox.checked) {
        const fieldItem = fieldCheckbox.closest('.export-field-item');
        if (fieldItem) {
          fieldItem.classList.remove('has-error');
        }
        container.classList.remove('has-error');
      }
    }

    // Также очищаем общее сообщение об ошибке, если есть выбранные значения
    if (hasSelection) {
      const errorMessage = document.getElementById('exportFieldsError');
      if (errorMessage) {
        errorMessage.style.display = 'none';
      }
    }
  }

  // Функция для получения значений множественного выбора
  function getMultiSelectValues(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return [];

    const hiddenInput = container.querySelector('input[type="hidden"]');
    if (!hiddenInput || !hiddenInput.value) return [];

    try {
      return JSON.parse(hiddenInput.value);
    } catch (e) {
      return [];
    }
  }

  // Функция для инициализации множественного выбора
  function initMultiSelect(container, placeholder) {
    // Используем делегирование событий вместо cloneNode/replaceChild
    // Это более эффективно и работает даже при динамическом обновлении опций

    // Если уже инициализирован, просто обновляем значение
    if (container.dataset.initialized === 'true') {
      updateMultiSelectValue(container, placeholder);
      return;
    }

    const trigger = container.querySelector('.export-multi-select-trigger');
    const dropdown = container.querySelector('.export-multi-select-dropdown');
    const searchInput = container.querySelector('.export-multi-select-search input');
    const hiddenInput = container.querySelector('input[type="hidden"]');
    const textElement = container.querySelector('.export-multi-select-text');

    if (!trigger || !dropdown || !hiddenInput || !textElement) return;

    // Открытие/закрытие выпадающего списка
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      container.classList.toggle('open');
    });

    // Закрытие при клике вне
    const closeHandler = (e) => {
      if (!container.contains(e.target)) {
        container.classList.remove('open');
      }
    };
    document.addEventListener('click', closeHandler);

    // Поиск (для blocks, functions, vendors, integrators, status, techRead, organRead, trlStage)
    const fieldName = container.getAttribute('data-field');
    const hasSearch = fieldName === 'blocks' || fieldName === 'functions' || fieldName === 'vendors' || fieldName === 'integrators' || fieldName === 'status' || fieldName === 'techRead' || fieldName === 'organRead' || fieldName === 'trlStage';

    if (searchInput && hasSearch) {
      searchInput.addEventListener('input', (e) => {
        const searchText = e.target.value.toLowerCase();
        const options = container.querySelectorAll('.export-multi-select-option');
        options.forEach(option => {
          if (option.classList.contains('select-all-option')) {
            option.classList.remove('hidden');
            return;
          }
          const label = option.querySelector('label');
          if (label) {
            const text = label.textContent.toLowerCase();
            if (text.includes(searchText)) {
              option.classList.remove('hidden');
            } else {
              option.classList.add('hidden');
            }
          }
        });
      });
    } else if (searchInput && !hasSearch) {
      const searchContainer = container.querySelector('.export-multi-select-search');
      if (searchContainer) {
        searchContainer.style.display = 'none';
      }
    }

    // Делегирование событий на контейнере (более эффективно)
    // Один обработчик для всех чекбоксов вместо множества отдельных
    container.addEventListener('change', (e) => {
      const target = e.target;
      if (target.type !== 'checkbox') return;

      if (target.dataset.selectAll === 'true') {
        // Обработка "Выбрать все"
        const isChecked = target.checked;
        const checkboxes = container.querySelectorAll('.export-multi-select-option:not(.select-all-option) input[type="checkbox"]');
        checkboxes.forEach(cb => cb.checked = isChecked);
        updateMultiSelectValue(container, placeholder);
        if (isChecked) {
          const fieldName = container.getAttribute('data-field');
          if (fieldName) {
            clearFieldError(fieldName, container);
          }
        }
      } else {
        // Обработка обычных чекбоксов
        const checkboxes = container.querySelectorAll('.export-multi-select-option:not(.select-all-option) input[type="checkbox"]');
        const selectAllCheckbox = container.querySelector('input[data-select-all="true"]');
        const allChecked = Array.from(checkboxes).every(cb => cb.checked);
        const someChecked = Array.from(checkboxes).some(cb => cb.checked);

        if (selectAllCheckbox) {
          selectAllCheckbox.checked = allChecked;
          selectAllCheckbox.indeterminate = someChecked && !allChecked;
        }

        updateMultiSelectValue(container, placeholder);

        const fieldName = container.getAttribute('data-field');
        if (fieldName) {
          const values = getMultiSelectValues(container.id);
          const allCheckboxes = container.querySelectorAll('.export-multi-select-option:not(.select-all-option) input[type="checkbox"]');
          const checkedBoxes = container.querySelectorAll('.export-multi-select-option:not(.select-all-option) input[type="checkbox"]:checked');
          const isAllSelected = allCheckboxes.length > 0 && checkedBoxes.length === allCheckboxes.length;

          if (values.length > 0 || isAllSelected) {
            clearFieldError(fieldName, container);
          }
        }
      }
    });

    // Инициализация начального состояния "Выбрать все"
    const initialSelectAllCheckbox = container.querySelector('input[data-select-all="true"]');
    const initialRegularCheckboxes = container.querySelectorAll('.export-multi-select-option:not(.select-all-option) input[type="checkbox"]');
    if (initialSelectAllCheckbox && initialRegularCheckboxes.length > 0) {
      const allChecked = Array.from(initialRegularCheckboxes).every(cb => cb.checked);
      const someChecked = Array.from(initialRegularCheckboxes).some(cb => cb.checked);
      initialSelectAllCheckbox.checked = allChecked;
      initialSelectAllCheckbox.indeterminate = someChecked && !allChecked;
    }

    // Обновление текста при загрузке
    updateMultiSelectValue(container, placeholder);

    // Отмечаем как инициализированный
    container.dataset.initialized = 'true';
  }

  // ===== ФУНКЦИИ ВАЛИДАЦИИ И ОШИБОК =====

  // Функции для работы с ошибками валидации
  function clearAllErrors() {
    document.querySelectorAll('.export-field-item').forEach(item => {
      item.classList.remove('has-error');
    });
    document.querySelectorAll('.export-multi-select').forEach(select => {
      select.classList.remove('has-error');
    });
    const errorMessage = document.getElementById('exportFieldsError');
    if (errorMessage) {
      errorMessage.style.display = 'none';
    }
  }

  function showFieldError(fieldName) {
    const fieldCheckbox = document.getElementById(`field_${fieldName}`);
    if (!fieldCheckbox) return;

    const fieldItem = fieldCheckbox.closest('.export-field-item');
    if (fieldItem) {
      fieldItem.classList.add('has-error');
    }

    const multiSelectFields = (ExportFieldsConfig && ExportFieldsConfig.MULTI_SELECT_FIELDS) || ['company', 'blocks', 'functions', 'status', 'costProm', 'techRead', 'organRead', 'trlStage', 'priority', 'vendors', 'integrators'];
    if (multiSelectFields.includes(fieldName)) {
      const container = document.getElementById(`filter_${fieldName}_container`);
      if (container) {
        container.classList.add('has-error');
      }
    }
  }

  // ===== ОСНОВНЫЕ ФУНКЦИИ ЭКСПОРТА =====
  // prepareSelectedFieldsList, preparePreviewData, calculateColumnWidths, determinePageOrientation, mmToPx, wrapText и генерация PDF перенесены в export-pdf.js (этап 3)

  // Подготовка списка технологий для экспорта (оркестрация: state + ExportFilters.applyFiltersToTechnologies)
  function prepareSourceList(filters, selectedFields) {
    const enterpriseData = safeGet('getEnterpriseData', {});
    const currentEnterprise = safeGet('getCurrentEnterprise');
    const technologies = safeGet('getTechnologies', []);
    let sourceList = [];
    let enterpriseName = currentEnterprise || 'Предприятие';
    const isCompanyFieldSelected = selectedFields.company === true;

    if (filters.company && Array.isArray(filters.company) && filters.company.length > 0) {
      filters.company.forEach(company => {
        if (enterpriseData && enterpriseData[company]) {
          sourceList = sourceList.concat(enterpriseData[company]);
        }
      });
      if (filters.company.length === 1) {
        enterpriseName = filters.company[0];
      } else {
        enterpriseName = filters.company.join(', ');
      }
    } else if (isCompanyFieldSelected) {
      const allCompanies = Object.keys(enterpriseData || {}).filter(c => c);
      allCompanies.forEach(company => {
        if (enterpriseData && enterpriseData[company]) {
          sourceList = sourceList.concat(enterpriseData[company]);
        }
      });
      enterpriseName = 'Все предприятия';
    } else {
      sourceList = (enterpriseData && enterpriseData[enterpriseName])
        ? enterpriseData[enterpriseName]
        : (Array.isArray(technologies) ? technologies : []);
    }

    // Дедупликация технологий по ID
    const seenIds = new Set();
    sourceList = sourceList.filter(tech => {
      const techId = tech.id;
      if (seenIds.has(techId)) {
        return false;
      }
      seenIds.add(techId);
      return true;
    });

    // Применяем фильтры к списку технологий
    if (Object.keys(filters).length > 0) {
      const filtersWithoutCompany = { ...filters };
      delete filtersWithoutCompany.company;
      if (Object.keys(filtersWithoutCompany).length > 0) {
        sourceList = applyFiltersToTechnologies(sourceList, filtersWithoutCompany);
      }
    }

    return { sourceList, enterpriseName };
  }

  // Основная функция экспорта PDF (оркестрация: prepareSourceList + ExportPdf.generatePdf)
  async function performPdfExport(selectedFields, filters = {}) {
    if (typeof window !== 'undefined' && typeof window.showReportLoading === 'function') {
      window.showReportLoading();
    }

    try {
      if (!canExportReports()) {
        throw new Error('Недостаточно прав для экспорта отчета');
      }

      const { sourceList, enterpriseName } = prepareSourceList(filters, selectedFields);
      const companyFilterForDisplay = filters.company && Array.isArray(filters.company) && filters.company.length > 0
        ? filters.company
        : null;

      const { enterpriseName: name, fieldsCount } = await generatePdf(sourceList, enterpriseName, selectedFields, companyFilterForDisplay);

      if (typeof window !== 'undefined' && typeof window.showReportSuccess === 'function') {
        window.showReportSuccess();
      }
      if (typeof window !== 'undefined' && window.Toast) {
        window.Toast.success('PDF отчет успешно сгенерирован и сохранен');
      }
      try {
        if (typeof window.appendAdminAudit === 'function') {
          window.appendAdminAudit('export', `Экспорт PDF отчета для предприятия "${name}" (полей: ${fieldsCount})`);
        } else {
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
            action: 'export',
            details: `Экспорт PDF отчета для предприятия "${name}" (полей: ${fieldsCount})`,
            tz: 'local',
            ip: 'local'
          });
          localStorage.setItem(key, JSON.stringify(arr));
        }
      } catch (err) {
        if (Logger && typeof Logger.warn === 'function') Logger.warn('Ошибка при логировании экспорта:', err);
      }
    } catch (error) {
      if (typeof window !== 'undefined' && typeof window.showReportError === 'function') {
        window.showReportError(error && error.message ? error.message : 'Ошибка при генерации отчета');
      }
      if (typeof window.reportError === 'function') {
        window.reportError(error, 'Экспорт PDF отчета');
      } else if (typeof window !== 'undefined' && window.Toast) {
        window.Toast.error(error.message || 'Ошибка при генерации отчета');
      }
      throw error;
    }
  }

  // ===== ФУНКЦИИ ЗАПОЛНЕНИЯ И НАСТРОЙКИ ФИЛЬТРОВ =====

  function normalizeRefName(item) {
    if (item == null) return '';
    if (typeof item === 'string') return item.trim();
    if (typeof item === 'object') {
      const name = item.name ?? item.vendor_name ?? item.integrator_name ?? item.title ?? item.id;
      return String(name ?? '').trim();
    }
    return String(item).trim();
  }

  function getStateReferenceList(key) {
    try {
      if (window.StateManager && typeof window.StateManager.get === 'function') {
        const list = window.StateManager.get(key) || [];
        if (!Array.isArray(list)) return [];
        const seen = new Set();
        return list
          .map(normalizeRefName)
          .filter(Boolean)
          .filter(name => {
            const k = name.toLowerCase();
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
          });
      }
    } catch (e) {
      if (Logger && typeof Logger.warn === 'function') Logger.warn(`Ошибка чтения ${key} из state`, e);
    }
    return [];
  }

  // Конфигурация фильтров для заполнения
  const FILTER_CONFIG = [
    {
      field: 'company',
      source: () => {
        const enterpriseData = safeGet('getEnterpriseData', {});
        return Object.keys(enterpriseData).filter(c => c);
      },
      placeholder: 'Все предприятия'
    },
    {
      field: 'blocks',
      source: () => {
        const list = safeGet('getBlocksList', []);
        return Array.isArray(list) ? list : [];
      },
      placeholder: 'Все блоки'
    },
    {
      field: 'functions',
      source: () => {
        const list = safeGet('getFunctions', []);
        return Array.isArray(list) ? list : [];
      },
      placeholder: 'Все функции'
    },
    {
      field: 'status',
      source: () => (ExportFieldsConfig && ExportFieldsConfig.STATUS_OPTIONS) || ['Внедренные', 'Невнедренные'],
      placeholder: 'Все статусы'
    },
    {
      field: 'vendors',
      source: async () => {
        const vendorSet = new Set();

        // 1. Берем вендоров из state (backend reference)
        const stateVendors = getStateReferenceList('vendorsList');
        stateVendors.forEach(name => vendorSet.add(name));

        // 2. Собираем вендоры из всех технологий
        const technologies = safeGet('getTechnologies', []);
        technologies.forEach(tech => {
          if (tech.vendors && Array.isArray(tech.vendors)) {
            tech.vendors.forEach(vendor => {
              // Вендор может быть объектом с полем name или строкой
              const vendorName = typeof vendor === 'object' && vendor !== null
                ? (vendor.name || vendor.id || String(vendor))
                : String(vendor);
              if (vendorName && vendorName.trim()) {
                vendorSet.add(vendorName.trim());
              }
            });
          }
        });

        // 3. Добавляем вендоры из JSON/state через VendorsFiles
        if (typeof window.VendorsFiles !== 'undefined' && typeof window.VendorsFiles.loadVendorsList === 'function') {
          try {
            const jsonVendors = await window.VendorsFiles.loadVendorsList();
            if (Array.isArray(jsonVendors)) {
              jsonVendors.forEach(vendor => {
                const vendorName = normalizeRefName(vendor);
                if (vendorName) vendorSet.add(vendorName);
              });
            }
          } catch (e) {
            if (Logger && typeof Logger.warn === 'function') Logger.warn('Ошибка при загрузке вендоров из JSON', e);
          }
        }

        // 4. Добавляем вендоры из localStorage
        try {
          const stored = localStorage.getItem('rmk_vendors_list');
          if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed)) {
              parsed.forEach(vendor => {
                const vendorName = normalizeRefName(vendor);
                if (vendorName) vendorSet.add(vendorName);
              });
            }
          }
        } catch (e) {
          // Игнорируем ошибки
        }

        return Array.from(vendorSet).sort();
      },
      placeholder: 'Все вендоры'
    },
    {
      field: 'integrators',
      source: async () => {
        const integratorSet = new Set();

        // 1. Берем интеграторов из state (backend reference)
        const stateIntegrators = getStateReferenceList('integratorsList');
        stateIntegrators.forEach(name => integratorSet.add(name));

        // 2. Собираем интеграторы из всех технологий
        const technologies = safeGet('getTechnologies', []);
        technologies.forEach(tech => {
          if (tech.vendors && Array.isArray(tech.vendors)) {
            tech.vendors.forEach(vendor => {
              if (vendor && typeof vendor === 'object' && vendor.integrators && Array.isArray(vendor.integrators)) {
                vendor.integrators.forEach(integrator => {
                  // Интегратор может быть объектом с полем name или строкой
                  const integratorName = typeof integrator === 'object' && integrator !== null
                    ? (integrator.name || integrator.id || String(integrator))
                    : String(integrator);
                  if (integratorName && integratorName.trim()) {
                    integratorSet.add(integratorName.trim());
                  }
                });
              }
            });
          }
        });

        // 3. Добавляем интеграторы из JSON/state через VendorsFiles
        if (typeof window.VendorsFiles !== 'undefined' && typeof window.VendorsFiles.loadIntegratorsList === 'function') {
          try {
            const jsonIntegrators = await window.VendorsFiles.loadIntegratorsList();
            if (Array.isArray(jsonIntegrators)) {
              jsonIntegrators.forEach(integrator => {
                const integratorName = normalizeRefName(integrator);
                if (integratorName) integratorSet.add(integratorName);
              });
            }
          } catch (e) {
            if (Logger && typeof Logger.warn === 'function') Logger.warn('Ошибка при загрузке интеграторов из JSON', e);
          }
        }

        // 4. Добавляем интеграторы из localStorage
        try {
          const stored = localStorage.getItem('rmk_integrators_list');
          if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed)) {
              parsed.forEach(integrator => {
                const integratorName = normalizeRefName(integrator);
                if (integratorName) integratorSet.add(integratorName);
              });
            }
          }
        } catch (e) {
          // Игнорируем ошибки
        }

        return Array.from(integratorSet).sort();
      },
      placeholder: 'Все интеграторы'
    }
  ];

  // Функция для заполнения списков фильтров
  async function populateExportFilters() {
    // Создаем очередь задач для обработки фильтров по одному
    const tasks = [];

    // Добавляем основные фильтры из конфигурации
    for (const { field, source, placeholder } of FILTER_CONFIG) {
      tasks.push(async () => {
        const data = await (typeof source === 'function' ? source() : Promise.resolve(source()));
        if (Array.isArray(data) && data.length > 0) {
          populateMultiSelect(`filter_${field}_container`, data, placeholder);
        }
      });
    }

    const costPromOptions = (ExportFieldsConfig && ExportFieldsConfig.COST_PROM_OPTIONS) || ['0 - 1 000 000', '1 000 000 - 5 000 000', '5 000 000 - 10 000 000', 'Более 10 000 000'];
    tasks.push(() => {
      populateMultiSelect('filter_costProm_container', costPromOptions, 'Все значения');
    });

    const ratingOptions = (ExportFieldsConfig && ExportFieldsConfig.RATING_OPTIONS) || ['0', '1', '2', '3'];
    ['techRead', 'organRead'].forEach(fieldName => {
      tasks.push(() => {
        populateMultiSelect(`filter_${fieldName}_container`, ratingOptions, 'Все значения');
      });
    });

    const trlOptions = (ExportFieldsConfig && ExportFieldsConfig.TRL_OPTIONS) || ['1', '2', '3'];
    tasks.push(() => {
      populateMultiSelect('filter_trlStage_container', trlOptions, 'Все значения');
    });

    const priorityOptions = (ExportFieldsConfig && ExportFieldsConfig.PRIORITY_OPTIONS) || ['Высокий (60-100%)', 'Средний (30-60%)', 'Низкий (0-30%)'];
    tasks.push(() => {
      populateMultiSelect('filter_priority_container', priorityOptions, 'Все приоритеты');
    });

    // Обрабатываем задачи по одной, используя requestAnimationFrame для разбиения работы
    let currentTaskIndex = 0;
    const processNextTask = async () => {
      if (currentTaskIndex < tasks.length) {
        await tasks[currentTaskIndex]();
        currentTaskIndex++;
        // Планируем следующую задачу в следующем кадре
        requestAnimationFrame(processNextTask);
      }
    };

    // Начинаем обработку
    processNextTask();
  }

  function setupExportFilterToggles() {
    const multiSelectFields = (ExportFieldsConfig && ExportFieldsConfig.MULTI_SELECT_FIELDS) || ['company', 'blocks', 'functions', 'status', 'costProm', 'techRead', 'organRead', 'trlStage', 'priority', 'vendors', 'integrators'];
    const singleSelectFields = [];
    const textFields = (ExportFieldsConfig && ExportFieldsConfig.TEXT_FIELDS) || ['description', 'exampleDesc'];

    // Множественный выбор
    multiSelectFields.forEach(field => {
      const checkbox = document.getElementById(`field_${field}`);
      const container = document.getElementById(`filter_${field}_container`);

      if (checkbox && container) {
        // Установка начального состояния
        if (!checkbox.checked) {
          container.classList.add('disabled');
        }

        // Обработчик изменения чекбокса
        checkbox.addEventListener('change', () => {
          if (checkbox.checked) {
            container.classList.remove('disabled');
          } else {
            container.classList.add('disabled');
            // Сброс значения фильтра при отключении
            const hiddenInput = container.querySelector('input[type="hidden"]');
            if (hiddenInput) {
              hiddenInput.value = '[]';
              const checkboxes = container.querySelectorAll('input[type="checkbox"]');
              checkboxes.forEach(cb => {
                cb.checked = false;
                cb.indeterminate = false;
              });
              const placeholder = container.getAttribute('data-placeholder') || 'Все';
              updateMultiSelectValue(container, placeholder);
            }
          }
          clearAllErrors();
        });

        // Обработчик изменений в выпадающем списке для скрытия ошибок
        const hiddenInput = container.querySelector('input[type="hidden"]');
        if (hiddenInput) {
          const observer = new MutationObserver(() => {
            if (checkbox.checked) {
              const values = getMultiSelectValues(`filter_${field}_container`);
              const allCheckboxes = container.querySelectorAll('.export-multi-select-option:not(.select-all-option) input[type="checkbox"]');
              const checkedBoxes = container.querySelectorAll('.export-multi-select-option:not(.select-all-option) input[type="checkbox"]:checked');
              const isAllSelected = allCheckboxes.length > 0 && checkedBoxes.length === allCheckboxes.length;
              if (values.length > 0 || isAllSelected) {
                clearFieldError(field, container);
              }
            }
          });
          observer.observe(hiddenInput, { attributes: true, attributeFilter: ['value'] });
        }
      }
    });

    // Одиночный выбор
    singleSelectFields.forEach(field => {
      const checkbox = document.getElementById(`field_${field}`);
      const filterElement = document.getElementById(`filter_${field}`);
      const customSelect = document.querySelector(`.custom-select-modal[data-field="filter_${field}"]`);

      if (checkbox && filterElement && customSelect) {
        if (!checkbox.checked) {
          customSelect.classList.add('disabled');
          customSelect.style.pointerEvents = 'none';
          customSelect.style.opacity = '0.5';
        }

        checkbox.addEventListener('change', () => {
          if (checkbox.checked) {
            customSelect.classList.remove('disabled');
            customSelect.style.pointerEvents = '';
            customSelect.style.opacity = '';
          } else {
            customSelect.classList.add('disabled');
            customSelect.style.pointerEvents = 'none';
            customSelect.style.opacity = '0.5';
            filterElement.value = '';
            const selectedText = customSelect.querySelector('.selected-text');
            const placeholder = customSelect.getAttribute('data-placeholder') || 'Все значения';
            if (selectedText) {
              selectedText.textContent = placeholder;
            }
            customSelect.setAttribute('data-value', '');
            customSelect.querySelectorAll('.select-options li').forEach(li => {
              li.classList.remove('selected');
            });
          }
          clearAllErrors();
        });
      }
    });

    // Текстовые поля
    textFields.forEach(field => {
      const checkbox = document.getElementById(`field_${field}`);
      const filterElement = document.getElementById(`filter_${field}`);

      if (checkbox && filterElement) {
        filterElement.disabled = !checkbox.checked;

        checkbox.addEventListener('change', () => {
          filterElement.disabled = !checkbox.checked;
          if (!checkbox.checked) {
            filterElement.value = '';
          }
          clearAllErrors();
        });
      }
    });

    // Обработчик для всех основных чекбоксов полей
    const fieldCheckboxes = document.querySelectorAll('#exportPdfModal .export-field-item > label input[type="checkbox"], #exportPdfModal .export-field-row > label input[type="checkbox"]');
    fieldCheckboxes.forEach(cb => {
      cb.addEventListener('change', () => {
        const hasAnyFieldSelected = Array.from(fieldCheckboxes).some(checkbox => checkbox.checked);
        if (hasAnyFieldSelected) {
          const errorMessage = document.getElementById('exportFieldsError');
          if (errorMessage) {
            errorMessage.style.display = 'none';
          }
        }
      });
    });
  }

  // ===== ФУНКЦИИ МОДАЛЬНОГО ОКНА =====

  // Функция для показа модального окна выбора полей
  function showExportPdfModal() {
    if (!canExportReports()) return;

    const modal = document.getElementById('exportPdfModal');
    if (!modal) return;

    // Устанавливаем флаг загрузки модального окна для пропуска обработки ARIA
    if (window.AriaManager && typeof window.AriaManager.setExportModalLoading === 'function') {
      window.AriaManager.setExportModalLoading(true);
    }

    // Очищаем все ошибки при открытии модального окна
    clearAllErrors();

    const defaultFields = (ExportFieldsConfig && ExportFieldsConfig.DEFAULT_EXPORT_FIELDS) || {
      name: true, company: true, blocks: true, functions: false, techTypes: false, status: true,
      costProm: false, description: false, exampleDesc: false, techRead: false, organRead: false,
      trlStage: false, priority: false, vendors: false, integrators: false
    };

    Object.keys(defaultFields).forEach(field => {
      const checkbox = document.getElementById(`field_${field}`);
      if (checkbox) {
        checkbox.checked = defaultFields[field];
      }
    });

    // ПОКАЗЫВАЕМ МОДАЛЬНОЕ ОКНО СРАЗУ - это критично для восприятия скорости
    if (typeof window.showModal === 'function') {
      window.showModal('exportPdfModal');
    }

    // Выполняем тяжелые операции асинхронно после показа модального окна
    // Используем requestAnimationFrame для разбиения работы на части и избежания блокировки UI
    requestAnimationFrame(() => {
      // Заполнение и обновление фильтров
      populateExportFilters();

      // Откладываем setupExportFilterToggles на следующий кадр для лучшей производительности
      requestAnimationFrame(() => {
        setupExportFilterToggles();

        // Автоматическая установка параметров из текущих фильтров
        requestAnimationFrame(() => {
          const currentEnterprise = safeGet('getCurrentEnterprise');
          if (currentEnterprise && currentEnterprise !== "all") {
            setMultiSelectFilter('company', [currentEnterprise], 'Все предприятия');
          }

          // Сектор (если есть зум)
          // ОБНОВЛЕНО (2026-01-29): Блоки больше не фильтруются по квадрантам
          // Все блоки доступны для всех квадрантов, так как они являются отдельными критериями технологии
          const currentZoomedQuadrant = safeGet('getCurrentZoomedQuadrant');
          // При зуме на квадрант все блоки остаются доступными

          // Функциональный блок (из фильтра)
          if (typeof window.getFilterValues === 'function') {
            const filterBlocks = window.getFilterValues('block');
            if (filterBlocks && filterBlocks.length > 0) {
              setMultiSelectFilter('blocks', filterBlocks, 'Все блоки');
            }

            // Функция (из фильтра)
            const filterFunctions = window.getFilterValues('function');
            if (filterFunctions && filterFunctions.length > 0) {
              setMultiSelectFilter('functions', filterFunctions, 'Все функции');
            }

            // Тип технологии (из фильтра)
            const filterTechTypes = window.getFilterValues('techType');
            if (filterTechTypes && filterTechTypes.length > 0) {
              setMultiSelectFilter('techTypes', filterTechTypes, 'Все типы');
            }

            // Статус (из фильтра)
            const filterStatus = window.getFilterValues('level');
            if (filterStatus && filterStatus.length > 0) {
              setMultiSelectFilter('status', filterStatus, 'Все статусы');
            }
          }

          // Обновляем состояние кнопки переключения после открытия модального окна
          setTimeout(() => {
            const toggleBtn = document.getElementById('toggleAllFields');
            if (toggleBtn) {
              const checkboxes = document.querySelectorAll('#exportPdfModal input[type="checkbox"]');
              const allSelected = checkboxes.length > 0 && Array.from(checkboxes).every(cb => cb.checked);
              const icon = toggleBtn.querySelector('.toggle-all-icon');
              const text = toggleBtn.querySelector('.toggle-all-text');

              if (allSelected && icon && text) {
                icon.innerHTML = '<path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>';
                text.textContent = 'Снять все';
                toggleBtn.setAttribute('data-state', 'all-selected');
              } else if (icon && text) {
                icon.innerHTML = '<path d="M9 11l3 3L22 4"></path><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>';
                text.textContent = 'Выбрать все';
                toggleBtn.setAttribute('data-state', 'not-all-selected');
              }
            }

            // Сбрасываем флаг загрузки модального окна после завершения инициализации
            if (window.AriaManager && typeof window.AriaManager.setExportModalLoading === 'function') {
              window.AriaManager.setExportModalLoading(false);
            }
          }, 50);
        });
      });
    });
  }

  // Функция валидации полей экспорта
  function validateExportFields() {
    clearAllErrors();

    const selectedFields = {};
    const multiSelectFields = ['company', 'blocks', 'functions', 'techTypes', 'status'];
    let hasAnyFieldSelected = false;
    let hasErrors = false;
    const errorMessages = [];

    // Собираем выбранные поля
    document.querySelectorAll('#exportPdfModal .export-field-item > label input[type="checkbox"], #exportPdfModal .export-field-row > label input[type="checkbox"]').forEach(cb => {
      const field = cb.getAttribute('data-field');
      if (field) {
        selectedFields[field] = cb.checked;
        if (cb.checked) {
          hasAnyFieldSelected = true;
        }
      }
    });

    // Если не выбрано ни одно поле
    if (!hasAnyFieldSelected) {
      const errorMessage = document.getElementById('exportFieldsError');
      if (errorMessage) {
        errorMessage.textContent = 'Выберите хотя бы одно поле для экспорта';
        errorMessage.style.display = 'inline-block';
      }
      return false;
    }

    const allMultiSelectFields = (ExportFieldsConfig && ExportFieldsConfig.MULTI_SELECT_FIELDS) || ['company', 'blocks', 'functions', 'techTypes', 'status', 'costProm', 'techRead', 'organRead', 'trlStage', 'priority', 'vendors', 'integrators'];
    const fieldLabels = (ExportFieldsConfig && ExportFieldsConfig.EXPORT_FIELD_LABELS) || { company: 'Предприятия', blocks: 'Функциональный блок', functions: 'Функции', techTypes: 'Тип технологии', status: 'Статус', costProm: 'Стоимость внедрения', techRead: 'Технологическая готовность', organRead: 'Организационная готовность', trlStage: 'TRL-стадия', priority: 'Приоритет', vendors: 'Вендору', integrators: 'Интеграторы' };

    allMultiSelectFields.forEach(field => {
      const checkbox = document.getElementById(`field_${field}`);
      if (checkbox && checkbox.checked) {
        const container = document.getElementById(`filter_${field}_container`);
        if (container && !container.classList.contains('disabled')) {
          const values = getMultiSelectValues(`filter_${field}_container`);
          const regularCheckboxes = container.querySelectorAll('.export-multi-select-option:not(.select-all-option) input[type="checkbox"]');
          const checkedCount = container.querySelectorAll('.export-multi-select-option:not(.select-all-option) input[type="checkbox"]:checked').length;
          const allChecked = regularCheckboxes.length > 0 && checkedCount === regularCheckboxes.length;

          if (values.length === 0 && !allChecked) {
            showFieldError(field);
            hasErrors = true;
            errorMessages.push(`Выберите значение для поля "${fieldLabels[field] || field}"`);
          }
        }
      }
    });

    if (hasErrors) {
      const errorMessage = document.getElementById('exportFieldsError');
      if (errorMessage) {
        errorMessage.textContent = errorMessages.join('. ');
        errorMessage.style.display = 'inline-block';
      }
      return false;
    }

    return true;
  }

  // Инициализация обработчиков модального окна экспорта
  function initExportPdfModalHandlers() {
    // Обработчик для кнопки экспорта PDF
    const exportPdfBtn = document.getElementById('exportPdfBtn');
    if (exportPdfBtn) {
      exportPdfBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        showExportPdfModal();
      });
    }

    // Функция для проверки состояния всех чекбоксов
    function areAllFieldsSelected() {
      const checkboxes = document.querySelectorAll('#exportPdfModal .export-field-item > label input[type="checkbox"], #exportPdfModal .export-field-row > label input[type="checkbox"]');
      if (checkboxes.length === 0) return false;
      return Array.from(checkboxes).every(cb => cb.checked);
    }

    // Функция для обновления состояния кнопки переключения
    function updateToggleAllButton() {
      const toggleBtn = document.getElementById('toggleAllFields');
      if (!toggleBtn) return;

      const allSelected = areAllFieldsSelected();
      const icon = toggleBtn.querySelector('.toggle-all-icon');
      const text = toggleBtn.querySelector('.toggle-all-text');

      if (allSelected) {
        icon.innerHTML = '<path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>';
        if (text) text.textContent = 'Снять все';
        toggleBtn.setAttribute('data-state', 'all-selected');
      } else {
        icon.innerHTML = '<path d="M9 11l3 3L22 4"></path><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>';
        if (text) text.textContent = 'Выбрать все';
        toggleBtn.setAttribute('data-state', 'not-all-selected');
      }
    }

    // Обработчик переключения "Выбрать все" / "Снять все"
    const toggleAllBtn = document.getElementById('toggleAllFields');
    if (toggleAllBtn) {
      toggleAllBtn.addEventListener('click', () => {
        const allSelected = areAllFieldsSelected();
        const shouldSelectAll = !allSelected;

        const allMultiSelectFields = (ExportFieldsConfig && ExportFieldsConfig.MULTI_SELECT_FIELDS) || ['company', 'blocks', 'functions', 'techTypes', 'status', 'costProm', 'techRead', 'organRead', 'trlStage', 'priority', 'vendors', 'integrators'];
        document.querySelectorAll('#exportPdfModal .export-field-item > label input[type="checkbox"], #exportPdfModal .export-field-row > label input[type="checkbox"]').forEach(cb => {
          cb.checked = shouldSelectAll;
          const field = cb.getAttribute('data-field');

          if (allMultiSelectFields.includes(field)) {
            const container = document.getElementById(`filter_${field}_container`);
            if (container) {
              if (shouldSelectAll) {
                container.classList.remove('disabled');
                const selectAllCheckbox = container.querySelector('input[data-select-all="true"]');
                if (selectAllCheckbox) {
                  selectAllCheckbox.checked = true;
                  const regularCheckboxes = container.querySelectorAll('.export-multi-select-option:not(.select-all-option) input[type="checkbox"]');
                  regularCheckboxes.forEach(cb => {
                    cb.checked = true;
                  });
                  const placeholder = container.getAttribute('data-placeholder') || 'Все';
                  updateMultiSelectValue(container, placeholder);
                } else {
                  const regularCheckboxes = container.querySelectorAll('.export-multi-select-option:not(.select-all-option) input[type="checkbox"]');
                  regularCheckboxes.forEach(cb => {
                    cb.checked = true;
                  });
                  const placeholder = container.getAttribute('data-placeholder') || 'Все';
                  updateMultiSelectValue(container, placeholder);
                }
              } else {
                container.classList.add('disabled');
                const hiddenInput = container.querySelector('input[type="hidden"]');
                if (hiddenInput) {
                  hiddenInput.value = '[]';
                  const checkboxes = container.querySelectorAll('input[type="checkbox"]');
                  checkboxes.forEach(cb => {
                    cb.checked = false;
                    cb.indeterminate = false;
                  });
                  const placeholder = container.getAttribute('data-placeholder') || 'Все';
                  updateMultiSelectValue(container, placeholder);
                }
              }
            }
          } else {
            const filterElement = document.getElementById(`filter_${field}`);
            if (filterElement) {
              if (shouldSelectAll) {
                filterElement.disabled = false;
              } else {
                filterElement.disabled = true;
                if (filterElement.tagName === 'SELECT') {
                  filterElement.value = '';
                } else if (filterElement.tagName === 'INPUT') {
                  filterElement.value = '';
                }
              }
            }
          }
        });

        clearAllErrors();
        setTimeout(updateToggleAllButton, 10);
      });
    }

    // Обработчики изменений чекбоксов для обновления состояния кнопки
    const exportModal = document.getElementById('exportPdfModal');
    if (exportModal) {
      exportModal.addEventListener('change', (e) => {
        if (e.target.type === 'checkbox' && e.target.closest('#exportPdfModal')) {
          updateToggleAllButton();
        }
      });
    }

    // Обновляем состояние кнопки при открытии модального окна
    const modalObserver = new MutationObserver(() => {
      if (exportModal && exportModal.style.display !== 'none') {
        updateToggleAllButton();
      }
    });

    if (exportModal) {
      modalObserver.observe(exportModal, {
        attributes: true,
        attributeFilter: ['style', 'class']
      });
    }

    // Инициализируем состояние кнопки при загрузке
    updateToggleAllButton();

    // Обработчик "Экспортировать"
    const exportBtn = document.getElementById('exportPdfConfirm');
    if (exportBtn) {
      exportBtn.addEventListener('click', async () => {
        if (!validateExportFields()) {
          return;
        }

        const selectedFields = {};
        const filters = {};

        document.querySelectorAll('#exportPdfModal input[type="checkbox"]').forEach(cb => {
          const field = cb.getAttribute('data-field');
          if (field) {
            selectedFields[field] = cb.checked;
          }
        });

        const multiSelectFields = (ExportFieldsConfig && ExportFieldsConfig.MULTI_SELECT_FIELDS) || ['company', 'blocks', 'functions', 'techTypes', 'status', 'costProm', 'techRead', 'organRead', 'trlStage', 'priority', 'vendors', 'integrators'];
        const textFields = (ExportFieldsConfig && ExportFieldsConfig.TEXT_FIELDS) || ['description', 'exampleDesc'];

        // Множественный выбор
        multiSelectFields.forEach(field => {
          const checkbox = document.getElementById(`field_${field}`);
          const container = document.getElementById(`filter_${field}_container`);
          // Проверяем, что чекбокс выбран И контейнер не отключен
          if (checkbox && checkbox.checked && container && !container.classList.contains('disabled')) {
            const values = getMultiSelectValues(`filter_${field}_container`);
            if (values.length > 0) {
              filters[field] = values;
            }
          }
        });

        // Текстовые поля
        textFields.forEach(field => {
          const filterElement = document.getElementById(`filter_${field}`);
          if (filterElement && !filterElement.disabled && filterElement.value) {
            filters[field] = filterElement.value;
          }
        });

        const setButtonLoading = typeof window.setButtonLoading === 'function' ? window.setButtonLoading : function () {};
        setButtonLoading(exportBtn, true, 'Экспорт…');

        if (typeof window.hideModal === 'function') {
          window.hideModal('exportPdfModal');
        }

        try {
          await performPdfExport(selectedFields, filters);
          // Успех обрабатывается внутри performPdfExport
        } catch (error) {
          // Ошибка обрабатывается внутри performPdfExport
        } finally {
          setButtonLoading(exportBtn, false);
        }
      });
    }

    // Обработчик "Отмена"
    const cancelBtn = document.getElementById('cancelExportPdf');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        if (typeof window.hideModal === 'function') {
          window.hideModal('exportPdfModal');
        }
      });
    }
  }

  // Инициализация обработчиков при загрузке DOM
  function initWhenReady() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initExportPdfModalHandlers);
    } else {
      initExportPdfModalHandlers();
    }
  }

  // Вызываем инициализацию сразу и также при полной загрузке
  initWhenReady();

  // Дополнительная инициализация при полной загрузке страницы (на случай, если кнопка создается динамически)
  if (window.addEventListener) {
    window.addEventListener('load', () => {
      const exportPdfBtn = document.getElementById('exportPdfBtn');
      if (exportPdfBtn && !exportPdfBtn.dataset.handlerAttached) {
        exportPdfBtn.dataset.handlerAttached = 'true';
        exportPdfBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          showExportPdfModal();
        });
      }
    });
  }

  // Экспорт функций в window для использования в RMK2.js
  window.performPdfExport = performPdfExport;
  window.showExportPdfModal = showExportPdfModal;
  window.populateExportFilters = populateExportFilters;
  window.setupExportFilterToggles = setupExportFilterToggles;
  window.validateExportFields = validateExportFields;

  const ExportModule = {
    performPdfExport,
    populateMultiSelect,
    initMultiSelect,
    updateMultiSelectValue,
    getMultiSelectValues,
    clearAllErrors,
    showFieldError,
    applyFiltersToTechnologies,
    populateExportFilters,
    setupExportFilterToggles,
    showExportPdfModal,
    validateExportFields
  };

  window.ExportModule = ExportModule;

  export default ExportModule;
  export {
    performPdfExport,
    populateMultiSelect,
    initMultiSelect,
    updateMultiSelectValue,
    getMultiSelectValues,
    clearAllErrors,
    showFieldError,
    applyFiltersToTechnologies,
    populateExportFilters,
    setupExportFilterToggles,
    showExportPdfModal,
    validateExportFields,
  };
