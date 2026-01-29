// export.js
// Модуль экспорта PDF отчетов

// Экспорт функций в window для использования в RMK2.js и других модулях
window.ExportModule = (function() {
  'use strict';

  // ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =====

  // Helper для безопасных вызовов window функций
  function safeGet(fnName, defaultValue = null) {
    return typeof window[fnName] === 'function' ? window[fnName]() : defaultValue;
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

  // Функция для применения фильтров к списку технологий
  function applyFiltersToTechnologies(sourceList, filters) {
    if (!sourceList || sourceList.length === 0) return sourceList;

    return sourceList.filter(tech => {
      // Фильтр по предприятию (массив значений)
      if (filters.company && Array.isArray(filters.company) && filters.company.length > 0) {
        const techCompanies = Array.isArray(tech.company) ? tech.company : (tech.company ? [tech.company] : []);
        const hasMatchingCompany = techCompanies.some(comp => filters.company.includes(comp));
        if (!hasMatchingCompany) return false;
      }

      // Фильтр по блоку (массив значений)
      if (filters.blocks && Array.isArray(filters.blocks) && filters.blocks.length > 0) {
        const techBlocks = Array.isArray(tech.blocks)
          ? tech.blocks.map(b => {
              if (typeof b === 'number' && typeof window.blockIdToName !== 'undefined' && window.blockIdToName[b]) {
                return window.blockIdToName[b];
              }
              return String(b || '');
            })
          : [tech.block || tech.blocks].filter(Boolean);
        const hasMatchingBlock = techBlocks.some(block => filters.blocks.includes(block));
        if (!hasMatchingBlock) return false;
      }

      // Фильтр по функциям (массив значений)
      if (filters.functions && Array.isArray(filters.functions) && filters.functions.length > 0) {
        const techFunctions = Array.isArray(tech.functions) ? tech.functions : [tech.func || tech.functions].filter(Boolean);
        const hasMatchingFunction = techFunctions.some(func => filters.functions.includes(func));
        if (!hasMatchingFunction) return false;
      }

      // Фильтр по типу технологии удален (все технологии отображаются кругами)

      // Фильтр по статусу (Внедренная/Невнедренная) на основе isImplemented
      if (filters.status && Array.isArray(filters.status) && filters.status.length > 0) {
        // Для технологий с несколькими предприятиями проверяем isImplemented для каждого предприятия
        const companies = Array.isArray(tech.company) ? tech.company : (tech.company ? [tech.company] : []);
        let isImplemented = false;

        if (companies.length > 1 && tech.companyRatings && typeof tech.companyRatings === 'object') {
          // Для нескольких предприятий проверяем, есть ли хотя бы одно с isImplemented = true
          isImplemented = companies.some(company => {
            const ratings = tech.companyRatings[company];
            return ratings && ratings.isImplemented === true;
          });
        } else {
          // Для одного предприятия или общего значения
          if (companies.length === 1 && tech.companyRatings && typeof tech.companyRatings === 'object') {
            const ratings = tech.companyRatings[companies[0]];
            isImplemented = ratings && ratings.isImplemented === true;
          } else {
            isImplemented = tech.isImplemented === true;
          }
        }

        const statusValue = isImplemented ? 'Внедренная' : 'Невнедренная';
        if (!filters.status.includes(statusValue)) return false;
      }

      // Фильтр по стоимости (только для перспективных) - множественный выбор
      if (filters.costProm && Array.isArray(filters.costProm) && filters.costProm.length > 0) {
        const isPerspective = tech.status === 'Перспективные' || tech.level === 'Перспективные';
        if (!isPerspective) return false;

        const cost = Number(tech.costProm) || 0;
        let matchesAnyRange = false;

        filters.costProm.forEach(range => {
          if (range === '0 - 1 000 000' && cost >= 0 && cost <= 1000000) matchesAnyRange = true;
          if (range === '1 000 000 - 5 000 000' && cost > 1000000 && cost <= 5000000) matchesAnyRange = true;
          if (range === '5 000 000 - 10 000 000' && cost > 5000000 && cost <= 10000000) matchesAnyRange = true;
          if (range === 'Более 10 000 000' && cost > 10000000) matchesAnyRange = true;
        });

        if (!matchesAnyRange) return false;
      }

      // Фильтр по описанию (поиск подстроки)
      if (filters.description && filters.description !== '') {
        const desc = (tech.description || '').toLowerCase();
        const searchText = filters.description.toLowerCase();
        if (!desc.includes(searchText)) return false;
      }

      // Фильтр по технологической готовности - множественный выбор
      if (filters.techRead && Array.isArray(filters.techRead) && filters.techRead.length > 0) {
        const techRead = String(tech.techRead || '');
        if (!filters.techRead.includes(techRead)) return false;
      }

      // Фильтр по организационной готовности - множественный выбор
      if (filters.organRead && Array.isArray(filters.organRead) && filters.organRead.length > 0) {
        const organRead = String(tech.organRead || '');
        if (!filters.organRead.includes(organRead)) return false;
      }

      // Фильтр по покрытию функций - множественный выбор
      if (filters.funcCover && Array.isArray(filters.funcCover) && filters.funcCover.length > 0) {
        const funcCover = String(tech.funcCover || '');
        if (!filters.funcCover.includes(funcCover)) return false;
      }

      // Фильтр по вендорам (массив значений)
      if (filters.vendors && Array.isArray(filters.vendors) && filters.vendors.length > 0) {
        if (!tech.vendors || !Array.isArray(tech.vendors) || tech.vendors.length === 0) return false;

        // Извлекаем имена вендоров из технологии
        const techVendorNames = tech.vendors.map(v => {
          if (typeof v === 'object' && v !== null) {
            return v.name || v.id || String(v);
          }
          return String(v);
        }).map(name => String(name).trim()).filter(Boolean);

        // Проверяем, есть ли совпадение (без учета регистра)
        const hasMatchingVendor = techVendorNames.some(vendorName => {
          return filters.vendors.some(filterVendor => {
            return String(vendorName).toLowerCase() === String(filterVendor).toLowerCase();
          });
        });

        if (!hasMatchingVendor) return false;
      }

      // Фильтр по интеграторам (массив значений)
      if (filters.integrators && Array.isArray(filters.integrators) && filters.integrators.length > 0) {
        if (!tech.vendors || !Array.isArray(tech.vendors) || tech.vendors.length === 0) return false;

        // Собираем все интеграторы из всех вендоров технологии
        const allIntegrators = [];
        tech.vendors.forEach(vendor => {
          if (vendor && typeof vendor === 'object' && vendor.integrators && Array.isArray(vendor.integrators)) {
            vendor.integrators.forEach(integrator => {
              const integratorName = typeof integrator === 'object' && integrator !== null
                ? (integrator.name || integrator.id || String(integrator))
                : String(integrator);
              const normalizedName = String(integratorName).trim();
              if (normalizedName && !allIntegrators.includes(normalizedName)) {
                allIntegrators.push(normalizedName);
              }
            });
          }
        });

        // Проверяем, есть ли совпадение (без учета регистра)
        const hasMatchingIntegrator = allIntegrators.some(integratorName => {
          return filters.integrators.some(filterIntegrator => {
            return String(integratorName).toLowerCase() === String(filterIntegrator).toLowerCase();
          });
        });

        if (!hasMatchingIntegrator) return false;
      }

      return true;
    });
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

    // Поиск (для blocks, functions, vendors, integrators)
    const fieldName = container.getAttribute('data-field');
    const hasSearch = fieldName === 'blocks' || fieldName === 'functions' || fieldName === 'vendors' || fieldName === 'integrators';

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

    // Если это поле с множественным выбором, подсвечиваем и его контейнер
    const multiSelectFields = ['company', 'blocks', 'functions', 'status', 'costProm', 'techRead', 'organRead', 'funcCover', 'priority', 'vendors', 'integrators'];
    if (multiSelectFields.includes(fieldName)) {
      const container = document.getElementById(`filter_${fieldName}_container`);
      if (container) {
        container.classList.add('has-error');
      }
    }
  }

  // ===== ОСНОВНЫЕ ФУНКЦИИ ЭКСПОРТА =====

  // Подготовка списка выбранных полей в правильном порядке
  function prepareSelectedFieldsList(selectedFields) {
    const columnOrder = ['company', 'blocks', 'functions', 'name'];
    const selectedFieldsKeys = Object.keys(selectedFields).filter(f => selectedFields[f] === true);
    const selectedFieldsList = [];

    columnOrder.forEach(field => {
      if (selectedFieldsKeys.includes(field)) {
        selectedFieldsList.push(field);
      }
    });
    selectedFieldsKeys.forEach(field => {
      if (!columnOrder.includes(field)) {
        selectedFieldsList.push(field);
      }
    });

    if (selectedFieldsList.length === 0) {
      throw new Error('Не выбрано ни одного поля');
    }

    return selectedFieldsList;
  }

  // Подготовка данных для предпросмотра (для расчета ширины колонок)
  function preparePreviewData(filters, selectedFields, pxPerMM) {
    const enterpriseData = safeGet('getEnterpriseData', {});
    const currentEnterprise = safeGet('getCurrentEnterprise');
    let previewData = [];

    if (filters.company && Array.isArray(filters.company) && filters.company.length > 0) {
      filters.company.forEach(company => {
        if (enterpriseData && enterpriseData[company]) {
          previewData = previewData.concat(enterpriseData[company].slice(0, 10));
        }
      });
    } else if (selectedFields.company === true) {
      const allCompanies = Object.keys(enterpriseData || {}).filter(c => c);
      allCompanies.forEach(company => {
        if (enterpriseData && enterpriseData[company]) {
          previewData = previewData.concat(enterpriseData[company].slice(0, 10));
        }
      });
    } else {
      const currentEnt = currentEnterprise || 'Предприятие';
      if (enterpriseData && enterpriseData[currentEnt]) {
        previewData = enterpriseData[currentEnt].slice(0, 10);
      } else {
        const technologies = safeGet('getTechnologies', []);
        if (Array.isArray(technologies)) {
          previewData = technologies.slice(0, 10);
        }
      }
    }

    return previewData;
  }

  // Расчет минимальных ширин колонок
  function calculateColumnWidths(selectedFieldsList, previewData, companyFilterForDisplay, pxPerMM) {
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    const tempFontSize = Math.round(12 * pxPerMM / 3.78);
    const tempFont = `${tempFontSize}px Segoe UI, Roboto, Arial, sans-serif`;
    const tempBoldFont = `bold ${tempFontSize}px Segoe UI, Roboto, Arial, sans-serif`;
    tempCtx.font = tempFont;

    return selectedFieldsList.map(field => {
      const label = (typeof window.getFieldLabel === 'function' ? window.getFieldLabel(field) : field);
      tempCtx.font = tempBoldFont;
      const labelWidthPx = tempCtx.measureText(label).width;
      tempCtx.font = tempFont;

      let maxContentWidthPx = labelWidthPx;
      previewData.forEach(tech => {
        const value = typeof window.getFieldValue === 'function'
          ? window.getFieldValue(tech, field, { companyFilter: companyFilterForDisplay })
          : String(tech[field] || '');
        const valueStr = String(value || '');
        const words = valueStr.split(/\s+/);
        let line = '';
        words.forEach(word => {
          const testLine = line ? line + ' ' + word : word;
          const testWidth = tempCtx.measureText(testLine).width;
          if (testWidth > maxContentWidthPx) {
            maxContentWidthPx = testWidth;
          }
          if (testWidth > 200) {
            line = word;
          } else {
            line = testLine;
          }
        });
      });

      const cellPadding = 4;
      const minWidthPx = Math.max(labelWidthPx, maxContentWidthPx) + (cellPadding * 2) + 10;
      const minWidthMm = minWidthPx / pxPerMM;
      return Math.max(minWidthMm, 20);
    });
  }

  // Определение ориентации страницы
  function determinePageOrientation(minColWidths, selectedFieldsList, margin, pxPerMM) {
    const cellPadding = 4;
    const cellPaddingMm = cellPadding / pxPerMM;
    const totalMinWidth = minColWidths.reduce((sum, w) => sum + w, 0) + (selectedFieldsList.length - 1) * cellPaddingMm;
    const availableWidthPortrait = 210 - (margin * 2);
    return totalMinWidth > availableWidthPortrait ? 'landscape' : 'portrait';
  }

  // Вспомогательные функции для работы с текстом и размерами
  function mmToPx(mm, pxPerMM) {
    return Math.round(mm * pxPerMM);
  }

  function wrapText(ctx, text, maxWidthPx) {
    const words = String(text || '').split(/\s+/);
    const lines = [];
    let line = '';

    function breakLongWord(word, maxWidth) {
      const result = [];
      let currentPart = '';

      for (let i = 0; i < word.length; i++) {
        const testPart = currentPart + word[i];
        const testWidth = ctx.measureText(testPart + '-').width;

        if (testWidth > maxWidth && currentPart.length > 1) {
          result.push(currentPart + '-');
          currentPart = word[i];
        } else {
          currentPart = testPart;
        }
      }

      if (currentPart) {
        result.push(currentPart);
      }

      return result;
    }

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const test = line ? line + ' ' + word : word;
      const w = ctx.measureText(test).width;

      if (w > maxWidthPx) {
        if (line) {
          lines.push(line);
          line = '';
        }

        const wordWidth = ctx.measureText(word).width;
        if (wordWidth > maxWidthPx) {
          const wordParts = breakLongWord(word, maxWidthPx);
          for (let j = 0; j < wordParts.length; j++) {
            if (j === wordParts.length - 1) {
              line = wordParts[j];
            } else {
              lines.push(wordParts[j]);
            }
          }
        } else {
          line = word;
        }
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  // Подготовка списка технологий для экспорта
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

  // Основная функция экспорта PDF с поддержкой выбора полей
  async function performPdfExport(selectedFields, filters = {}) {
    // Показываем индикатор загрузки
    let loaderId = null;
    if (typeof window !== 'undefined' && window.LoadingManager) {
      loaderId = window.LoadingManager.show('Генерация PDF отчета...');
    }

    try {
      // Используем функции из RMK2.js (будут доступны после загрузки)
      if (typeof window.checkArchitectRole === 'function' && !window.checkArchitectRole()) {
        throw new Error('Недостаточно прав для экспорта отчета');
      }

      // Проверка, что выбрано хотя бы одно поле
      const hasSelectedFields = Object.values(selectedFields).some(v => v === true);
      if (!hasSelectedFields) {
        throw new Error('Выберите хотя бы одно поле для экспорта');
      }
      const { jsPDF } = window.jspdf;

      // Настройки формата A4 (мм)
      const margin = 14; // mm
      const DPI = 150;
      const pxPerMM = DPI / 25.4;

      // Подготовка данных
      const selectedFieldsList = prepareSelectedFieldsList(selectedFields);
      const companyFilterForDisplay = filters.company && Array.isArray(filters.company) && filters.company.length > 0
        ? filters.company
        : null;
      const previewData = preparePreviewData(filters, selectedFields, pxPerMM);
      const minColWidths = calculateColumnWidths(selectedFieldsList, previewData, companyFilterForDisplay, pxPerMM);
      const orientation = determinePageOrientation(minColWidths, selectedFieldsList, margin, pxPerMM);
      const { sourceList, enterpriseName } = prepareSourceList(filters, selectedFields);

      // Создаем PDF с правильной ориентацией
      const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: orientation });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();


      // Render a single page to canvas and return PNG dataURL
      async function renderPagesToImages() {
        const images = [];
        const cw = mmToPx(pageWidth, pxPerMM);
        const ch = mmToPx(pageHeight, pxPerMM);

        // styles
        const headerFont = `${Math.round(14 * pxPerMM / 3.78)}px Segoe UI, Roboto, Arial, sans-serif`;
        const normalFont = `${Math.round(12 * pxPerMM / 3.78)}px Segoe UI, Roboto, Arial, sans-serif`;
        const smallFont = `${Math.round(11 * pxPerMM / 3.78)}px Segoe UI, Roboto, Arial, sans-serif`;
        const boldFont = `bold ${Math.round(12 * pxPerMM / 3.78)}px Segoe UI, Roboto, Arial, sans-serif`;

        let canvas = document.createElement('canvas');
        canvas.width = cw;
        canvas.height = ch;
        let ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, cw, ch);

        const marginPx = mmToPx(margin, pxPerMM);
        const contentW = cw - marginPx * 2;
        const cellPadding = 4;
        const rowSpacing = 2;
        const baseHeaderHeight = 20;

        let y = marginPx;

        function newPage() {
          images.push(canvas.toDataURL('image/png'));
          canvas = document.createElement('canvas');
          canvas.width = cw; canvas.height = ch;
          const cctx = canvas.getContext('2d');
          cctx.fillStyle = '#ffffff';
          cctx.fillRect(0, 0, cw, ch);
          return cctx;
        }

        const nowStr = new Date().toLocaleString('ru-RU');

        function drawHeader(cctx) {
          cctx.fillStyle = '#000';
          cctx.textBaseline = 'top';
          cctx.font = headerFont;
          const title = `Технологический отчёт: ${enterpriseName}`;
          const titleW = cctx.measureText(title).width;
          cctx.fillText(title, Math.round((cw - titleW) / 2), y);
          cctx.font = smallFont;
          cctx.fillText(`Дата формирования отчёта: ${nowStr}`, marginPx, y + Math.round(16 * pxPerMM / 3.78));
          y += Math.round(26 * pxPerMM / 3.78);
        }

        ctx.fillStyle = '#000';
        ctx.textBaseline = 'top';
        drawHeader(ctx);

        if (!sourceList || sourceList.length === 0) {
          ctx.font = normalFont;
          ctx.fillText('На предприятии не зарегистрировано технологий', marginPx, y + 6);
          images.push(canvas.toDataURL('image/png'));
          return images;
        }

        // Вычисляем ширину колонок
        const numCols = selectedFieldsList.length;
        const availableWidthPx = contentW;
        const totalPadding = (numCols - 1) * cellPadding;
        const availableWidthForCols = availableWidthPx - totalPadding;

        const minColWidthsPx = minColWidths.map(w => mmToPx(w));
        const totalMinWidthPx = minColWidthsPx.reduce((sum, w) => sum + w, 0);

        let colWidths;
        if (totalMinWidthPx > availableWidthForCols) {
          const scale = availableWidthForCols / totalMinWidthPx;
          colWidths = minColWidthsPx.map(w => Math.max(Math.floor(w * scale), 10));
        } else {
          const scale = availableWidthForCols / totalMinWidthPx;
          colWidths = minColWidthsPx.map(w => Math.floor(w * scale));
          colWidths = colWidths.map((w, idx) => Math.max(w, minColWidthsPx[idx]));
          const totalWidth = colWidths.reduce((sum, w) => sum + w, 0);
          if (totalWidth > availableWidthForCols) {
            const correction = availableWidthForCols / totalWidth;
            colWidths = colWidths.map(w => Math.max(Math.floor(w * correction), 10));
          }
        }

        let totalWidth = colWidths.reduce((sum, w) => sum + w, 0);
        if (totalWidth > availableWidthForCols) {
          const finalCorrection = availableWidthForCols / totalWidth;
          colWidths = colWidths.map(w => Math.floor(w * finalCorrection));
        }

        const colWidth = Math.floor(availableWidthForCols / numCols);

        // Вычисляем необходимую высоту заголовка
        ctx.font = boldFont;
        let maxHeaderLines = 1;
        selectedFieldsList.forEach((field, idx) => {
          const label = typeof window.getFieldLabel === 'function' ? window.getFieldLabel(field) : field;
          const currentColWidth = colWidths[idx] || colWidth;
          const availableWidth = currentColWidth - cellPadding * 2;
          const headerLines = wrapText(ctx, label, availableWidth);
          maxHeaderLines = Math.max(maxHeaderLines, headerLines.length);
        });
        const headerHeight = Math.max(baseHeaderHeight, maxHeaderLines * Math.round(12 * pxPerMM / 3.78) + cellPadding * 2);

        // Рисуем заголовок таблицы
        const headerY = y;
        ctx.fillStyle = '#e0e0e0';
        ctx.fillRect(marginPx, headerY, contentW, headerHeight);
        ctx.fillStyle = '#000';
        ctx.font = boldFont;
        ctx.textBaseline = 'top';
        ctx.textAlign = 'left';

        let x = marginPx + cellPadding;
        selectedFieldsList.forEach((field, idx) => {
          const label = typeof window.getFieldLabel === 'function' ? window.getFieldLabel(field) : field;
          const currentColWidth = colWidths[idx] || colWidth;
          const availableWidth = currentColWidth - cellPadding * 2;

          ctx.font = boldFont;
          let headerLines = wrapText(ctx, label, availableWidth);
          const lineHeight = Math.round(12 * pxPerMM / 3.78);

          headerLines = headerLines.map(line => {
            let displayLine = line;
            if (ctx.measureText(displayLine).width > availableWidth) {
              while (displayLine.length > 0 && ctx.measureText(displayLine + '...').width > availableWidth) {
                displayLine = displayLine.slice(0, -1);
              }
              displayLine = displayLine + '...';
            }
            return displayLine;
          });

          const totalHeaderHeight = headerLines.length * lineHeight;
          const startY = headerY + Math.max(0, (headerHeight - totalHeaderHeight) / 2);

          headerLines.forEach((line, lineIdx) => {
            ctx.fillText(line, x, startY + lineIdx * lineHeight);
          });

          x += currentColWidth + cellPadding;
        });

        y += headerHeight + rowSpacing;

        // Рисуем строки данных
        for (let i = 0; i < sourceList.length; i++) {
          const tech = sourceList[i];
          const isEvenRow = i % 2 === 0;

          ctx.font = normalFont;
          let maxLines = 1;
          const cellValues = selectedFieldsList.map((field, idx) => {
            const value = typeof window.getFieldValue === 'function'
              ? window.getFieldValue(tech, field, { companyFilter: companyFilterForDisplay })
              : String(tech[field] || '');
            const currentColWidth = colWidths[idx] || colWidth;
            const lines = wrapText(ctx, value, currentColWidth - cellPadding * 2);
            maxLines = Math.max(maxLines, lines.length);
            return lines;
          });

          const rowHeight = Math.max(headerHeight, maxLines * Math.round(12 * pxPerMM / 3.78) + cellPadding * 2);

          // Проверка на перенос страницы
          if (y + rowHeight + marginPx > ch - marginPx) {
            const cctx = newPage();
            y = marginPx;
            drawHeader(cctx);
            const newHeaderY = y;
            cctx.fillStyle = '#e0e0e0';
            cctx.fillRect(marginPx, newHeaderY, contentW, headerHeight);
            cctx.fillStyle = '#000';
            cctx.font = boldFont;
            cctx.textBaseline = 'top';
            cctx.textAlign = 'left';
            let newX = marginPx + cellPadding;
            selectedFieldsList.forEach((field, idx) => {
              const label = typeof window.getFieldLabel === 'function' ? window.getFieldLabel(field) : field;
              const currentColWidth = colWidths[idx] || colWidth;
              const availableWidth = currentColWidth - cellPadding * 2;

              cctx.font = boldFont;
              let headerLines = wrapText(cctx, label, availableWidth);
              const lineHeight = Math.round(12 * pxPerMM / 3.78);

              headerLines = headerLines.map(line => {
                let displayLine = line;
                if (cctx.measureText(displayLine).width > availableWidth) {
                  while (displayLine.length > 0 && cctx.measureText(displayLine + '...').width > availableWidth) {
                    displayLine = displayLine.slice(0, -1);
                  }
                  displayLine = displayLine + '...';
                }
                return displayLine;
              });

              const totalHeaderHeight = headerLines.length * lineHeight;
              const startY = newHeaderY + Math.max(0, (headerHeight - totalHeaderHeight) / 2);

              headerLines.forEach((line, lineIdx) => {
                cctx.fillText(line, newX, startY + lineIdx * lineHeight);
              });

              newX += currentColWidth + cellPadding;
            });
            y += headerHeight + rowSpacing;
            ctx = cctx;
          }

          // Фон строки
          if (isEvenRow) {
            ctx.fillStyle = '#f9f9f9';
            ctx.fillRect(marginPx, y, contentW, rowHeight);
          }

          // Границы ячеек
          ctx.strokeStyle = '#d0d0d0';
          ctx.lineWidth = 0.5;
          x = marginPx;
          for (let col = 0; col <= numCols; col++) {
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x, y + rowHeight);
            ctx.stroke();
            if (col < numCols) {
              const currentColWidth = colWidths[col] || colWidth;
              x += currentColWidth + cellPadding;
            }
          }
          ctx.beginPath();
          ctx.moveTo(marginPx, y);
          ctx.lineTo(marginPx + contentW, y);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(marginPx, y + rowHeight);
          ctx.lineTo(marginPx + contentW, y + rowHeight);
          ctx.stroke();

          // Текст в ячейках
          ctx.font = normalFont;
          ctx.textBaseline = 'top';
          ctx.textAlign = 'left';
          x = marginPx + cellPadding;
          selectedFieldsList.forEach((field, colIdx) => {
            const lines = cellValues[colIdx];
            const isNumeric = typeof window.isNumericField === 'function' ? window.isNumericField(field) : false;
            const currentColWidth = colWidths[colIdx] || colWidth;
            const availableTextWidth = currentColWidth - cellPadding * 2;
            const textX = isNumeric ? x + currentColWidth - cellPadding : x;
            ctx.textAlign = isNumeric ? 'right' : 'left';
            const lineHeight = Math.round(12 * pxPerMM / 3.78);

            ctx.fillStyle = '#000';

            lines.forEach((line, lineIdx) => {
              let displayLine = line;
              if (ctx.measureText(displayLine).width > availableTextWidth) {
                while (displayLine.length > 0 && ctx.measureText(displayLine + '...').width > availableTextWidth) {
                  displayLine = displayLine.slice(0, -1);
                }
                displayLine = displayLine + '...';
              }
              ctx.fillText(displayLine, textX, y + cellPadding + lineIdx * lineHeight);
            });

            x += currentColWidth + cellPadding;
            ctx.textAlign = 'left';
          });

          y += rowHeight + rowSpacing;
        }

        images.push(canvas.toDataURL('image/png'));
        return images;
      }

      // Generate images and put them into pdf
      const imgs = await renderPagesToImages();
      if (!imgs || imgs.length === 0) {
        throw new Error('Не удалось подготовить страницы отчёта');
      }

      for (let i = 0; i < imgs.length; i++) {
        if (i > 0) pdf.addPage();
        pdf.addImage(imgs[i], 'PNG', 0, 0, pageWidth, pageHeight);
      }

      const filename = `Технологический_отчёт_${enterpriseName.replace(/\s+/g, '_')}.pdf`;
      pdf.save(filename);

      // Скрываем индикатор загрузки при успешном экспорте
      if (loaderId && typeof window !== 'undefined' && window.LoadingManager) {
        window.LoadingManager.hide(loaderId);
      }

      // Показываем уведомление об успехе
      if (typeof window !== 'undefined' && window.Toast) {
        window.Toast.success('PDF отчет успешно сгенерирован и сохранен');
      }

      // Логируем экспорт PDF (enterpriseName уже определен выше из prepareSourceList)
      try {
        const fieldsCount = Object.values(selectedFields).filter(v => v === true).length;
        if (typeof window.appendAdminAudit === 'function') {
          window.appendAdminAudit('export', `Экспорт PDF отчета для предприятия "${enterpriseName}" (полей: ${fieldsCount})`);
        } else {
          // Fallback: прямое логирование в localStorage если функция недоступна
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
            details: `Экспорт PDF отчета для предприятия "${enterpriseName}" (полей: ${fieldsCount})`,
            tz: 'local',
            ip: 'local'
          });
          localStorage.setItem(key, JSON.stringify(arr));
        }
      } catch (err) {
        if (window.Logger) window.Logger.warn('Ошибка при логировании экспорта:', err);
      }
    } catch (error) {
      console.error('Ошибка при генерации отчёта (canvas flow):', error);

      // Скрываем индикатор загрузки при ошибке
      if (loaderId && typeof window !== 'undefined' && window.LoadingManager) {
        window.LoadingManager.hide(loaderId);
      }

      // Показываем ошибку
      if (typeof window !== 'undefined' && window.ErrorDisplay) {
        window.ErrorDisplay.show(error, 'Экспорт PDF отчета');
      } else if (typeof window !== 'undefined' && window.Toast) {
        window.Toast.error(error.message || 'Ошибка при генерации отчета');
      }

      throw error;
    }
  }

  // ===== ФУНКЦИИ ЗАПОЛНЕНИЯ И НАСТРОЙКИ ФИЛЬТРОВ =====

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
      source: () => (typeof window.blocksList !== 'undefined' && Array.isArray(window.blocksList)) ? window.blocksList : [],
      placeholder: 'Все блоки'
    },
    {
      field: 'functions',
      source: () => (typeof window.functions !== 'undefined' && Array.isArray(window.functions)) ? window.functions : [],
      placeholder: 'Все функции'
    },
    {
      field: 'status',
      source: () => (typeof window.RINGS !== 'undefined' && Array.isArray(window.RINGS)) ? window.RINGS : [],
      placeholder: 'Все статусы'
    },
    {
      field: 'vendors',
      source: async () => {
        const vendorSet = new Set();

        // 1. Собираем вендоры из всех технологий
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

        // 2. Добавляем вендоры из JSON файла (если доступен модуль VendorsFiles)
        if (typeof window.VendorsFiles !== 'undefined' && typeof window.VendorsFiles.loadVendorsList === 'function') {
          try {
            const jsonVendors = await window.VendorsFiles.loadVendorsList();
            if (Array.isArray(jsonVendors)) {
              jsonVendors.forEach(vendor => {
                const vendorName = String(vendor).trim();
                if (vendorName) vendorSet.add(vendorName);
              });
            }
          } catch (e) {
            if (window.Logger) window.Logger.warn('Ошибка при загрузке вендоров из JSON', e);
          }
        }

        // 3. Добавляем вендоры из localStorage
        try {
          const stored = localStorage.getItem('rmk_vendors_list');
          if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed)) {
              parsed.forEach(vendor => {
                const vendorName = String(vendor).trim();
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

        // 1. Собираем интеграторы из всех технологий
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

        // 2. Добавляем интеграторы из JSON файла (если доступен модуль VendorsFiles)
        if (typeof window.VendorsFiles !== 'undefined' && typeof window.VendorsFiles.loadIntegratorsList === 'function') {
          try {
            const jsonIntegrators = await window.VendorsFiles.loadIntegratorsList();
            if (Array.isArray(jsonIntegrators)) {
              jsonIntegrators.forEach(integrator => {
                const integratorName = String(integrator).trim();
                if (integratorName) integratorSet.add(integratorName);
              });
            }
          } catch (e) {
            if (window.Logger) window.Logger.warn('Ошибка при загрузке интеграторов из JSON', e);
          }
        }

        // 3. Добавляем интеграторы из localStorage
        try {
          const stored = localStorage.getItem('rmk_integrators_list');
          if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed)) {
              parsed.forEach(integrator => {
                const integratorName = String(integrator).trim();
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

    // Добавляем заполнение множественного выбора для стоимости внедрения
    const costPromOptions = [
      '0 - 1 000 000',
      '1 000 000 - 5 000 000',
      '5 000 000 - 10 000 000',
      'Более 10 000 000'
    ];
    tasks.push(() => {
      populateMultiSelect('filter_costProm_container', costPromOptions, 'Все значения');
    });

    // Добавляем заполнение множественного выбора для технологической готовности, организационной готовности, покрытия функций
    const ratingOptions = ['0', '1', '2', '3'];
    ['techRead', 'organRead', 'funcCover'].forEach(fieldName => {
      tasks.push(() => {
        populateMultiSelect(`filter_${fieldName}_container`, ratingOptions, 'Все значения');
      });
    });

    // Добавляем заполнение множественного выбора для приоритета технологии
    const priorityOptions = [
      'Высокий (60-100%)',
      'Средний (30-60%)',
      'Низкий (0-30%)'
    ];
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

  // Функция для включения/отключения фильтров при изменении чекбоксов
  function setupExportFilterToggles() {
    const multiSelectFields = ['company', 'blocks', 'functions', 'status', 'costProm', 'techRead', 'organRead', 'funcCover', 'priority', 'vendors', 'integrators'];
    const singleSelectFields = [];
    const textFields = ['description'];

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
    if (typeof window.checkArchitectRole === 'function' && !window.checkArchitectRole()) return;

    const modal = document.getElementById('exportPdfModal');
    if (!modal) return;

    // Устанавливаем флаг загрузки модального окна для пропуска обработки ARIA
    if (window.AriaManager && typeof window.AriaManager.setExportModalLoading === 'function') {
      window.AriaManager.setExportModalLoading(true);
    }

    // Очищаем все ошибки при открытии модального окна
    clearAllErrors();

    // Дефолтные значения полей
    const defaultFields = {
      name: true,
      company: true,
      blocks: true,
      functions: false,
      techTypes: false,
      status: true,
      costProm: false,
      description: false,
      techRead: false,
      organRead: false,
      funcCover: false,
      priority: false,
      vendors: false,
      integrators: false
    };

    // Инициализация чекбоксов
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
          const currentZoomedQuadrant = safeGet('getCurrentZoomedQuadrant');
          if (currentZoomedQuadrant !== null) {
            const blocksInQuadrant = [];
            if (typeof window.blockToQuadrant !== 'undefined') {
              Object.keys(window.blockToQuadrant).forEach(blockName => {
                const qId = Array.isArray(window.blockToQuadrant[blockName])
                  ? window.blockToQuadrant[blockName][0]
                  : window.blockToQuadrant[blockName];
                if (qId === currentZoomedQuadrant) {
                  blocksInQuadrant.push(blockName);
                }
              });
            }
            if (blocksInQuadrant.length > 0) {
              setMultiSelectFilter('blocks', blocksInQuadrant, 'Все блоки');
            }
          }

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

    // Проверяем поля с множественным выбором
    const allMultiSelectFields = ['company', 'blocks', 'functions', 'techTypes', 'status', 'costProm', 'techRead', 'organRead', 'funcCover', 'priority', 'vendors', 'integrators'];
    const fieldLabels = {
      'company': 'Предприятия',
      'blocks': 'Функциональный блок',
      'functions': 'Функции',
      'techTypes': 'Тип технологии',
      'status': 'Статус',
      'costProm': 'Стоимость внедрения',
      'techRead': 'Технологическая готовность',
      'organRead': 'Организационная готовность',
      'funcCover': 'Покрытие функций',
      'priority': 'Приоритет',
      'vendors': 'Вендору',
      'integrators': 'Интеграторы'
    };

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

        document.querySelectorAll('#exportPdfModal .export-field-item > label input[type="checkbox"], #exportPdfModal .export-field-row > label input[type="checkbox"]').forEach(cb => {
          cb.checked = shouldSelectAll;
          const field = cb.getAttribute('data-field');
          const multiSelectFields = ['company', 'blocks', 'functions', 'techTypes', 'status', 'costProm', 'techRead', 'organRead', 'funcCover', 'priority', 'vendors', 'integrators'];

          if (multiSelectFields.includes(field)) {
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

        // Собираем выбранные поля
        document.querySelectorAll('#exportPdfModal input[type="checkbox"]').forEach(cb => {
          const field = cb.getAttribute('data-field');
          if (field) {
            selectedFields[field] = cb.checked;
          }
        });

        // Собираем значения фильтров
        const multiSelectFields = ['company', 'blocks', 'functions', 'techTypes', 'status', 'costProm', 'techRead', 'organRead', 'funcCover', 'priority', 'vendors', 'integrators'];
        const textFields = ['description'];

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

        if (typeof window.hideModal === 'function') {
          window.hideModal('exportPdfModal');
        }

        try {
          await performPdfExport(selectedFields, filters);
          // Успех обрабатывается внутри performPdfExport
        } catch (error) {
          // Ошибка обрабатывается внутри performPdfExport
          console.error('Ошибка экспорта PDF:', error);
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

  return {
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
})();
