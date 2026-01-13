// Модуль фильтрации
// Экспортирует функции в window.Filters для использования в RMK2.js
// Использует глобальные переменные из RMK2.js и функции из других модулей

(function() {
  'use strict';

  // Вспомогательные функции для создания элементов списка
  function createCheckboxOptionLi(value, labelText) {
    const li = document.createElement('li');
    li.classList.add('select-option-item');
    li.setAttribute('data-value', value);
    li.innerHTML = `
      <label class="option-label">
        <input type="checkbox" class="option-checkbox" />
        <span>${labelText}</span>
      </label>
    `;
    return li;
  }

  function createSelectAllLi() {
    const li = document.createElement('li');
    li.className = 'select-all-option';
    li.innerHTML = `
      <label class="option-label">
        <input type="checkbox" class="select-all-checkbox" />
        <span>Выбрать все</span>
      </label>
    `;
    return li;
  }

  // Получить значения фильтра
  function getFilterValues(key) {
    const select = document.querySelector(`.custom-select[data-filter="${key}"]`);
    if (!select) return [];
    const hiddenInput = document.getElementById(`filter_${key}`);
    if (hiddenInput && hiddenInput.value) {
      try {
        const parsed = JSON.parse(hiddenInput.value);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {
        // Если не JSON, проверяем data-value
      }
    }
    // Fallback: читаем из data-value или из выбранных li
    const dataValue = select.getAttribute('data-value') || '';
    if (dataValue && dataValue.trim().startsWith('[')) {
      try {
        const parsed = JSON.parse(dataValue);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {
        // Игнорируем ошибки парсинга
      }
    }
    // Читаем из выбранных элементов списка
    const selected = Array.from(select.querySelectorAll('.select-options li.selected'))
      .map(li => li.getAttribute('data-value'))
      .filter(v => v && v.length > 0);
    if (selected.length > 0) return selected;
    // Если ничего не выбрано, возвращаем пустой массив
    return [];
  }

  // Заполнить селект фильтра
  function populateSelect(filterKey, items, placeholderText) {
    const select = document.querySelector(`.custom-select[data-filter="${filterKey}"]`);
    if (!select) {
      console.warn(`populateSelect: селект с data-filter="${filterKey}" не найден`);
      return;
    }
    if (!Array.isArray(items) || items.length === 0) {
      console.warn(`populateSelect: для "${filterKey}" передан пустой массив или не массив:`, items);
    }
    const optionsList = select.querySelector('.select-options');
    if (!optionsList) {
      console.error(`populateSelect: не найден .select-options для "${filterKey}"`);
      return;
    }
    const selectedText = select.querySelector('.selected-text');
    if (!selectedText) {
      console.error(`populateSelect: не найден .selected-text для "${filterKey}"`);
      return;
    }
    const hiddenInput = document.getElementById(`filter_${filterKey}`);

    // Сохраняем плейсхолдер и "базовый" заголовок без ": Все"
    select.setAttribute('data-placeholder', placeholderText);
    const baseLabel = placeholderText.includes(':')
      ? placeholderText.split(':')[0].trim()
      : placeholderText;
    select.setAttribute('data-label', baseLabel);

    // Все фильтры sidebar работают в режиме множественного выбора
    select.setAttribute('data-multi', 'true');
    optionsList.innerHTML = '';

    // Поиск для блоков и функций
    if (filterKey === 'block' || filterKey === 'function') {
      const searchWrap = document.createElement('li');
      searchWrap.className = 'select-search';
      searchWrap.innerHTML = `<input type="text" placeholder="Поиск..." autocomplete="off" />`;
      optionsList.appendChild(searchWrap);
    }

    // "Выбрать все"
    optionsList.appendChild(createSelectAllLi());

    // Если это фильтр блоков и есть зуммированный квадрант, фильтруем блоки
    let filteredItems = items;
    if (filterKey === 'block' && typeof window.currentZoomedQuadrant !== 'undefined' && window.currentZoomedQuadrant != null) {
      const getQuadrantIdForBlock = window.Positioning?.getQuadrantIdForBlock;
      if (getQuadrantIdForBlock) {
        filteredItems = items.filter(blockName => {
          const quadrantId = getQuadrantIdForBlock(blockName);
          return quadrantId === window.currentZoomedQuadrant;
        });
      }
    }

    // Если это фильтр функций и выбран блок, фильтруем функции
    if (filterKey === 'function') {
      const selectedBlocks = getFilterValues('block'); // Получаем массив выбранных блоков
      if (selectedBlocks.length > 0 && typeof window.nameToBlockId !== 'undefined' && window.nameToBlockId && typeof window.functionToBlockMap !== 'undefined' && window.functionToBlockMap) {
        const selectedBlockIds = selectedBlocks
          .map(blockName => window.nameToBlockId[blockName])
          .filter(id => id != null);
        if (selectedBlockIds.length > 0) {
          filteredItems = items.filter(funcName => {
            const blockIds = window.functionToBlockMap[funcName];
            if (!blockIds) return false;
            // blockIds может быть числом или массивом чисел
            const funcBlockIds = Array.isArray(blockIds) ? blockIds : [blockIds];
            return funcBlockIds.some(id => selectedBlockIds.includes(id));
          });
        }
      }
    }

    filteredItems.forEach(item => {
      const li = createCheckboxOptionLi(item, item);
      optionsList.appendChild(li);
    });

    // Инициализируем отображение (по умолчанию ничего не выбрано)
    if (hiddenInput) hiddenInput.value = '';
    renderMultiSelectTags(select);

  }

  // Визуализация выбранных элементов для множественного выбора: теги с крестиком
  function renderMultiSelectTags(customSelect) {
    if (!customSelect) return;
    const selectedTextEl = customSelect.querySelector('.selected-text');
    if (!selectedTextEl) return;

    // Определяем скрытое поле: для модальных селектов используется data-field, для фильтров - data-filter
    const hiddenInputId = customSelect.dataset.field || `filter_${customSelect.dataset.filter}`;
    const hiddenInput = document.getElementById(hiddenInputId);
    let selected = [];

    // Предпочитаем читать из li.selected, иначе парсим скрытое поле
    // Для полей с чекбоксами используем правильный селектор
    const hasCheckboxes = customSelect.querySelector('.select-options li.select-option-item') !== null;
    const selectedSelector = hasCheckboxes
      ? '.select-options li.select-option-item.selected'
      : '.select-options li.selected';
    const selLis = Array.from(customSelect.querySelectorAll(selectedSelector))
      .map(li => li.getAttribute('data-value'))
      .filter(v => v && v.length > 0);
    if (selLis.length) selected = selLis;
    else if (hiddenInput && hiddenInput.value) {
      try { selected = JSON.parse(hiddenInput.value); } catch (e) { selected = []; }
    }

    if (!selected || selected.length === 0) {
      selectedTextEl.innerHTML = customSelect.getAttribute('data-placeholder') || 'Выберите';
      customSelect.setAttribute('data-value', '');
      if (hiddenInput) hiddenInput.value = '';
      // Если это фильтр (не модальное окно), обновляем радар при очистке
      const filterKey = customSelect.getAttribute('data-filter');
      if (filterKey) {
        // Если это фильтр блоков, обновляем фильтр функций
        if (filterKey === 'block') {
          const updateFunctionFilterForBlock = window.Filters?.updateFunctionFilterForBlock;
          if (updateFunctionFilterForBlock) updateFunctionFilterForBlock([]);
        }
        // Обновляем радар
        if (typeof window.updateRadar === 'function') {
          window.updateRadar();
        }
      }
      return;
    }

    const isSidebarFilter = !!customSelect.getAttribute('data-filter') && !customSelect.classList.contains('custom-select-modal');

    if (isSidebarFilter) {
      // Для фильтров в левой панели показываем только счётчик, без перечисления выбранных пунктов
      const baseLabel = customSelect.getAttribute('data-label') || customSelect.getAttribute('data-placeholder') || 'Выберите';
      const count = selected.length;
      selectedTextEl.textContent = `${baseLabel}: выбрано ${count}`;
      customSelect.setAttribute('data-value', hiddenInput ? hiddenInput.value : JSON.stringify(selected));
    } else {
      // Соберём теги (поведение для модальных мультиселектов и др.)
      selectedTextEl.innerHTML = '';
      selected.forEach(val => {
        const span = document.createElement('span');
        span.className = 'multi-tag';
        span.setAttribute('data-value', val);
        span.innerHTML = `${val} <button type="button" class="multi-tag-remove" aria-label="Удалить">&times;</button>`;
        // Предотвращаем открытие выпадающего списка при клике на тег
        span.addEventListener('click', (ev) => {
          // Разрешаем только клики на кнопку удаления
          if (!ev.target.classList.contains('multi-tag-remove') && !ev.target.closest('.multi-tag-remove')) {
            ev.stopPropagation();
          }
        });
        // обработчик удаления
        const removeBtn = span.querySelector('.multi-tag-remove');
        if (removeBtn) {
          removeBtn.addEventListener('click', (ev) => {
            ev.stopPropagation();
            ev.preventDefault();
            // снять выделение в списке
            const li = customSelect.querySelector(`.select-options li[data-value="${val}"]`);
            if (li) {
              li.classList.remove('selected');
              // Также снимаем отметку с чекбокса, если он есть
              const checkbox = li.querySelector('input[type="checkbox"]');
              if (checkbox) {
                checkbox.dataset.programmaticChange = 'true';
                checkbox.checked = false;
                setTimeout(() => {
                  delete checkbox.dataset.programmaticChange;
                }, 100);
              }
            }
            // обновить скрытое поле - используем правильный селектор для полей с чекбоксами
            const hasCheckboxes = customSelect.querySelector('.select-options li.select-option-item') !== null;
            const selectedSelector = hasCheckboxes
              ? '.select-options li.select-option-item.selected'
              : '.select-options li.selected';
            const remaining = Array.from(customSelect.querySelectorAll(selectedSelector))
              .map(x => x.getAttribute('data-value'))
              .filter(v => v && v.length > 0);
            if (hiddenInput) hiddenInput.value = JSON.stringify(remaining);
            customSelect.setAttribute('data-value', hiddenInput ? hiddenInput.value : JSON.stringify(remaining));

            // Обновляем чекбокс "Выбрать все", если он есть
            if (hasCheckboxes) {
              const allLi = customSelect.querySelector('.select-all-option');
              const allCheckbox = allLi ? allLi.querySelector('input[type="checkbox"]') : null;
              if (allCheckbox) {
                const optionLis = Array.from(customSelect.querySelectorAll('.select-options li.select-option-item'));
                const allSelected = optionLis.length > 0 && optionLis.every(optLi => optLi.classList.contains('selected'));
                allCheckbox.dataset.programmaticChange = 'true';
                allCheckbox.checked = allSelected;
                setTimeout(() => {
                  delete allCheckbox.dataset.programmaticChange;
                }, 100);
              }
            }

            // повторно отрисуем теги
            renderMultiSelectTags(customSelect);
            // удерживать фокус на select
            if (typeof window.positionOptions === 'function') {
              window.positionOptions(customSelect);
            }

            // Если это фильтр блоков, обновляем фильтр функций
            const filterKeyInner = customSelect.getAttribute('data-filter');
            if (filterKeyInner === 'block') {
              const updateFunctionFilterForBlock = window.Filters?.updateFunctionFilterForBlock;
              if (updateFunctionFilterForBlock) updateFunctionFilterForBlock(remaining);
            }

            // Если это поле techCompany или editCompany, обновляем видимость полей оценок
            const fieldId = customSelect.getAttribute('data-field');
            if (fieldId === 'techCompany' && typeof window.updateTechRatingsVisibility === 'function') {
              setTimeout(() => {
                window.updateTechRatingsVisibility();
              }, 50);
            }
            if (fieldId === 'editCompany' && typeof window.updateEditTechRatingsVisibility === 'function') {
              setTimeout(() => {
                window.updateEditTechRatingsVisibility();
              }, 50);
            }

            // Динамическая фильтрация блоков и функций в модалке добавления технологии при удалении тега
            if (fieldId === 'techSector' && typeof window.updateModalBlocksForSectors === 'function') {
              window.updateModalBlocksForSectors(remaining);
            } else if (fieldId === 'techBlock' && typeof window.updateModalFunctionsForBlocks === 'function') {
              window.updateModalFunctionsForBlocks(remaining, 'techFunc');
            } else if (fieldId === 'editBlock' && typeof window.updateModalFunctionsForBlocks === 'function') {
              window.updateModalFunctionsForBlocks(remaining, 'editFunc');
            }

            // Обновляем радар (если remaining не пуст, иначе renderMultiSelectTags обновит радар)
            // Но для надежности обновляем всегда, так как renderMultiSelectTags может вернуться раньше
            if (typeof window.updateRadar === 'function') {
              window.updateRadar();
            }
          });
        }
        selectedTextEl.appendChild(span);
      });
      customSelect.setAttribute('data-value', hiddenInput ? hiddenInput.value : JSON.stringify(selected));
    }

    // Для фильтров в левой панели (data-filter) после любого изменения набора тегов
    // принудительно обновляем радар и связанные списки, чтобы состояние всегда
    // соответствовало текущему набору выбранных значений.
    const filterKey = customSelect.getAttribute('data-filter');
    if (filterKey) {
      // Дополнительно синхронизируем фильтр функций при изменении блоков
      if (filterKey === 'block') {
        const currentSelected = Array.from(customSelect.querySelectorAll('.select-options li.selected'))
          .map(li => li.getAttribute('data-value'))
          .filter(v => v && v.length > 0);
        const updateFunctionFilterForBlock = window.Filters?.updateFunctionFilterForBlock;
        if (updateFunctionFilterForBlock) updateFunctionFilterForBlock(currentSelected);
      }
      if (typeof window.updateRadar === 'function') {
        window.updateRadar();
      }
    }
  }

  // Обновить фильтр функций по выбранным блокам
  function updateFunctionFilterForBlock(blockNames) {
    if (typeof window.functions === 'undefined' || !window.functions || window.functions.length === 0) return;
    if (typeof window.functionToBlockMap === 'undefined' || !window.functionToBlockMap || Object.keys(window.functionToBlockMap).length === 0) return;

    const select = document.querySelector('.custom-select[data-filter="function"]');
    if (!select) return;

    const optionsList = select.querySelector('.select-options');
    if (!optionsList) return;
    const hiddenInput = document.getElementById('filter_function');

    // Сохраняем текущие выбранные значения (множественный выбор)
    const currentSelected = getFilterValues('function');

    // Очищаем список опций
    optionsList.innerHTML = '';

    // Добавляем поиск
    const searchWrap = document.createElement('li');
    searchWrap.className = 'select-search';
    searchWrap.innerHTML = `<input type="text" placeholder="Поиск..." autocomplete="off" />`;
    optionsList.appendChild(searchWrap);

    // Добавляем "Выбрать все"
    optionsList.appendChild(createSelectAllLi());

    // Фильтруем функции по выбранным блокам
    let filteredFunctions = window.functions;
    const blockNamesArray = Array.isArray(blockNames) ? blockNames : (blockNames ? [blockNames] : []);
    if (blockNamesArray.length > 0 && typeof window.nameToBlockId !== 'undefined' && window.nameToBlockId) {
      const selectedBlockIds = blockNamesArray
        .map(blockName => window.nameToBlockId[blockName])
        .filter(id => id != null);
      if (selectedBlockIds.length > 0) {
        filteredFunctions = window.functions.filter(funcName => {
          const blockIds = window.functionToBlockMap[funcName];
          if (!blockIds) return false;
          const funcBlockIds = Array.isArray(blockIds) ? blockIds : [blockIds];
          return funcBlockIds.some(id => selectedBlockIds.includes(id));
        });
      }
    }

    // Добавляем отфильтрованные функции
    filteredFunctions.forEach(funcName => {
      const li = createCheckboxOptionLi(funcName, funcName);
      // Восстанавливаем выделение, если функция была выбрана и все еще доступна
      if (currentSelected.includes(funcName)) {
        li.classList.add('selected');
        const checkbox = li.querySelector('input[type="checkbox"]');
        if (checkbox) checkbox.checked = true;
      }
      optionsList.appendChild(li);
    });

    // Обновляем скрытое поле и отображение, оставляя только доступные выбранные функции
    const validSelected = currentSelected.filter(func => filteredFunctions.includes(func));
    if (hiddenInput) hiddenInput.value = JSON.stringify(validSelected);
    select.setAttribute('data-value', hiddenInput ? hiddenInput.value : JSON.stringify(validSelected));
    renderMultiSelectTags(select);

    // Если какие-то выбранные функции стали недоступны, обновляем радар
    if (validSelected.length !== currentSelected.length) {
      if (typeof window.updateRadar === 'function') {
        window.updateRadar();
      }
    }
  }

  // Обновить фильтр блоков по зуммированному квадранту
  function updateBlockFilterForZoomedQuadrant(quadrantId) {
    if (typeof window.blocksList === 'undefined' || !window.blocksList || window.blocksList.length === 0) return;

    const select = document.querySelector('.custom-select[data-filter="block"]');
    if (!select) return;

    const optionsList = select.querySelector('.select-options');
    if (!optionsList) return;
    const hiddenInput = document.getElementById('filter_block');

    // Сохраняем текущие выбранные значения (множественный выбор)
    const currentSelected = getFilterValues('block');

    // Очищаем список опций
    optionsList.innerHTML = '';

    // Добавляем поиск
    const searchWrap = document.createElement('li');
    searchWrap.className = 'select-search';
    searchWrap.innerHTML = `<input type="text" placeholder="Поиск..." autocomplete="off" />`;
    optionsList.appendChild(searchWrap);

    // Добавляем "Выбрать все"
    optionsList.appendChild(createSelectAllLi());

    // Фильтруем блоки по квадранту, если есть зум
    let filteredBlocks = window.blocksList;
    if (quadrantId != null) {
      const getQuadrantIdForBlock = window.Positioning?.getQuadrantIdForBlock;
      if (getQuadrantIdForBlock) {
        filteredBlocks = window.blocksList.filter(blockName => {
          const blockQuadrantId = getQuadrantIdForBlock(blockName);
          return blockQuadrantId === quadrantId;
        });
      }
    }

    // Добавляем отфильтрованные блоки
    filteredBlocks.forEach(blockName => {
      const li = createCheckboxOptionLi(blockName, blockName);
      // Восстанавливаем выделение, если блок был выбран и все еще доступен
      if (currentSelected.includes(blockName)) {
        li.classList.add('selected');
        const checkbox = li.querySelector('input[type="checkbox"]');
        if (checkbox) checkbox.checked = true;
      }
      optionsList.appendChild(li);
    });

    // Обновляем скрытое поле и отображение, оставляя только доступные выбранные блоки
    const validSelected = currentSelected.filter(block => filteredBlocks.includes(block));
    if (hiddenInput) hiddenInput.value = JSON.stringify(validSelected);
    select.setAttribute('data-value', hiddenInput ? hiddenInput.value : JSON.stringify(validSelected));
    renderMultiSelectTags(select);

    // Если какие-то выбранные блоки стали недоступны, обновляем радар и фильтр функций
    if (validSelected.length !== currentSelected.length) {
      updateFunctionFilterForBlock(validSelected);
      if (typeof window.updateRadar === 'function') {
        window.updateRadar();
      }
    }
  }

  // Заполнить селект для модального окна
  function populateSelectForModal(selectId, items, placeholder) {
    const customSelect = document.querySelector(`.custom-select-modal[data-field="${selectId}"]`);
    if (!customSelect) {
      console.warn(`populateSelectForModal: селект с data-field="${selectId}" не найден`);
      return;
    }
    if (!Array.isArray(items) || items.length === 0) {
      console.warn(`populateSelectForModal: для "${selectId}" передан пустой массив или не массив:`, items);
    }
    const optionsList = customSelect.querySelector('.select-options');
    if (!optionsList) {
      console.error(`populateSelectForModal: не найден .select-options для "${selectId}"`);
      return;
    }
    const selectedText = customSelect.querySelector('.selected-text');
    if (!selectedText) {
      console.error(`populateSelectForModal: не найден .selected-text для "${selectId}"`);
      return;
    }
    const hiddenInput = document.getElementById(selectId);
    customSelect.setAttribute('data-placeholder', placeholder);
    selectedText.textContent = placeholder;
    optionsList.innerHTML = '';
    // Для селектов с поиском проверяем, есть ли уже обёртка select-dropdown в HTML
    const selectDropdown = customSelect.querySelector('.select-dropdown');
    // Определяем, нужны ли чекбоксы для данного селекта (блоки и функции в модалках)
    const needsCheckboxes = ['techBlock', 'techFunc', 'editBlock', 'editFunc'].includes(selectId);
    if (needsCheckboxes) {
      // Если есть select-dropdown, поиск уже есть в HTML, не добавляем
      if (!selectDropdown) {
        const searchWrap = document.createElement('li');
        searchWrap.className = 'select-search';
        searchWrap.innerHTML = `<input type="text" placeholder="Поиск..." autocomplete="off" />`;
        optionsList.appendChild(searchWrap);
      }
      // Добавляем опцию "Выбрать все" для блоков и функций
      const selectAllLi = document.createElement('li');
      selectAllLi.className = 'select-all-option';
      selectAllLi.innerHTML = `
        <label class="option-label">
          <input type="checkbox" class="select-all-checkbox" />
          <span>Выбрать все</span>
        </label>
      `;
      optionsList.appendChild(selectAllLi);
    }
    // Для блоков, функций, процессов и предприятий в модалке разрешим множественный выбор
    const isMulti = ['techSector', 'techBlock', 'editBlock', 'techFunc', 'editFunc', 'techLevel', 'editLevel', 'techCompany', 'editCompany'].includes(selectId);
    if (isMulti) {
      customSelect.setAttribute('data-multi', 'true');
    } else {
      customSelect.removeAttribute('data-multi');
    }
    // Для множественного выбора не добавляем placeholder-опцию, только для одиночного
    if (!isMulti) {
      const allOption = document.createElement('li');
      allOption.textContent = placeholder;
      allOption.setAttribute('data-value', '');
      optionsList.appendChild(allOption);
    }
    items.forEach(item => {
      if (needsCheckboxes) {
        // Создаём элемент с чекбоксом для блоков и функций
        const li = document.createElement('li');
        li.classList.add('select-option-item');
        li.setAttribute('data-value', item);
        li.innerHTML = `
          <label class="option-label">
            <input type="checkbox" class="option-checkbox" />
            <span>${item}</span>
          </label>
        `;
        optionsList.appendChild(li);
      } else {
        const li = document.createElement('li');
        li.textContent = item;
        li.setAttribute('data-value', item);
        optionsList.appendChild(li);
      }
    });
    if (hiddenInput) hiddenInput.value = '';
    // Если это multi-select, отрендерим теги (пустые по умолчанию)
    if (customSelect.getAttribute('data-multi') === 'true') renderMultiSelectTags(customSelect);

  }

  // Установить значение кастомного селекта
  function setCustomSelectValue(fieldId, value) {
    const customSelect = document.querySelector(`.custom-select-modal[data-field="${fieldId}"]`);
    if (!customSelect) return;
    const hiddenInput = document.getElementById(fieldId);
    // Поддерживаем передачу массива или JSON-строки массива
    let normalized = value;
    if (Array.isArray(value)) {
      normalized = JSON.stringify(value);
    } else if (typeof value === 'string' && value.trim().startsWith('[')) {
      // оставим как есть
      normalized = value;
    }
    if (hiddenInput) hiddenInput.value = normalized;
    const options = customSelect.querySelectorAll('.select-options li');
    let selectedOption = null;
    // Снимем все выделения и сбросим чекбоксы, затем отметим нужные
    options.forEach(li => {
      li.classList.remove('selected');
      const checkbox = li.querySelector('input[type="checkbox"]');
      if (checkbox) checkbox.checked = false;
    });
    // Если hidden содержит JSON-массив — распарсим
    let toSelect = [];
    try {
      if (hiddenInput && hiddenInput.value && hiddenInput.value.trim().startsWith('[')) {
        const parsed = JSON.parse(hiddenInput.value);
        if (Array.isArray(parsed)) toSelect = parsed;
      } else if (typeof value === 'string' && value.trim().startsWith('[')) {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) toSelect = parsed;
      } else if (typeof value === 'string' && value.length > 0) {
        toSelect = [value];
      }
    } catch (e) {
      // Если не массив, попробуем как одиночное значение
      if (typeof value === 'string' && value.length > 0) {
        toSelect = [value];
      }
    }
    // Отметим нужные опции
    toSelect.forEach(val => {
      const li = customSelect.querySelector(`.select-options li[data-value="${val}"]`);
      if (li) {
        li.classList.add('selected');
        const checkbox = li.querySelector('input[type="checkbox"]');
        if (checkbox) checkbox.checked = true;
        if (!selectedOption) selectedOption = li;
      }
    });
    // Обновим отображение
    renderMultiSelectTags(customSelect);
    // Если это одиночный выбор, обновим текст
    if (!customSelect.getAttribute('data-multi') && selectedOption) {
      const selectedTextEl = customSelect.querySelector('.selected-text');
      if (selectedTextEl) {
        selectedTextEl.textContent = selectedOption.textContent.trim();
      }
    }
  }

  // Сбросить кастомные селекты
  function resetCustomSelects(prefix) {
    document.querySelectorAll(`.custom-select-modal[data-field^="${prefix}"]`).forEach(select => {
      const hiddenInputId = select.dataset.field;
      const hiddenInput = document.getElementById(hiddenInputId);
      if (hiddenInput) hiddenInput.value = '';
      const placeholder = select.getAttribute('data-placeholder') || 'Выберите';
      const selectedTextEl = select.querySelector('.selected-text');
      if (selectedTextEl) selectedTextEl.innerHTML = placeholder;
      select.setAttribute('data-value', '');
      select.classList.remove('open');
      select.querySelectorAll('.select-options li').forEach(li => {
        li.classList.remove('selected');
        // Сбрасываем чекбоксы
        const checkbox = li.querySelector('input[type="checkbox"]');
        if (checkbox) checkbox.checked = false;
      });
    });
  }

  // Экспорт функций
  window.Filters = {
    createCheckboxOptionLi,
    createSelectAllLi,
    getFilterValues,
    populateSelect,
    populateSelectForModal,
    renderMultiSelectTags,
    updateFunctionFilterForBlock,
    updateBlockFilterForZoomedQuadrant,
    setCustomSelectValue,
    resetCustomSelects
  };

  // Экспорт функций в window для обратной совместимости с events.js
  window.renderMultiSelectTags = renderMultiSelectTags;
  window.updateFunctionFilterForBlock = updateFunctionFilterForBlock;
  window.setCustomSelectValue = setCustomSelectValue;
  window.resetCustomSelects = resetCustomSelects;
})();
