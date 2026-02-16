// Модуль фильтрации
// Экспортирует функции в window.Filters для использования в RMK2.js
// Использует глобальные переменные из RMK2.js и функции из других модулей

(function () {
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

  // Получить все технологии (StateAccessors — основной источник)
  function getAllTechnologies() {
    if (window.StateAccessors && typeof window.StateAccessors.getTechnologies === 'function') {
      const techs = window.StateAccessors.getTechnologies();
      if (Array.isArray(techs) && techs.length > 0) return techs;
    }
    if (window.StateManager && typeof window.StateManager.get === 'function') {
      const techs = window.StateManager.get('technologies');
      if (Array.isArray(techs) && techs.length > 0) return techs;
    }
    if (typeof window.getTechnologies === 'function') {
      const techs = window.getTechnologies();
      if (Array.isArray(techs) && techs.length > 0) return techs;
    }
    return [];
  }

  // Справочники — через StateAccessors (window.* устарел)
  function getBlocksListFromState() {
    if (window.StateAccessors && typeof window.StateAccessors.getBlocksList === 'function') {
      const list = window.StateAccessors.getBlocksList();
      return Array.isArray(list) ? list : [];
    }
    if (window.StateManager && typeof window.StateManager.get === 'function') {
      const list = window.StateManager.get('blocksList');
      return Array.isArray(list) ? list : [];
    }
    return [];
  }

  function getFunctionsFromState() {
    if (window.StateAccessors && typeof window.StateAccessors.getFunctions === 'function') {
      const list = window.StateAccessors.getFunctions();
      return Array.isArray(list) ? list : [];
    }
    if (window.StateManager && typeof window.StateManager.get === 'function') {
      const list = window.StateManager.get('functions');
      return Array.isArray(list) ? list : [];
    }
    return [];
  }

  function getNameToBlockIdFromState() {
    if (window.StateAccessors && typeof window.StateAccessors.getNameToBlockId === 'function') {
      const map = window.StateAccessors.getNameToBlockId();
      return map && typeof map === 'object' ? map : {};
    }
    if (window.StateManager && typeof window.StateManager.get === 'function') {
      const map = window.StateManager.get('nameToBlockId');
      return map && typeof map === 'object' ? map : {};
    }
    return {};
  }

  function getFunctionToBlockMapFromState() {
    if (window.StateAccessors && typeof window.StateAccessors.getFunctionToBlockMap === 'function') {
      const map = window.StateAccessors.getFunctionToBlockMap();
      return map && typeof map === 'object' ? map : {};
    }
    if (window.StateManager && typeof window.StateManager.get === 'function') {
      const map = window.StateManager.get('functionToBlockMap');
      return map && typeof map === 'object' ? map : {};
    }
    return {};
  }

  // Получить все уникальные блоки из технологий
  function getAllUniqueBlocks(allTechnologies) {
    const blocksSet = new Set();
    const blockIdToName = window.blockIdToName || {};
    const nameToBlockId = getNameToBlockIdFromState();

    allTechnologies.forEach(tech => {
      if (!tech) return;
      const techBlocks = Array.isArray(tech.blocks)
        ? tech.blocks
        : (tech.blocks ? [tech.blocks] : [tech.block].filter(Boolean));

      techBlocks.forEach(block => {
        let blockName = '';
        if (typeof block === 'number') {
          // Если блок - это ID, преобразуем в название
          blockName = blockIdToName[block] || '';
        } else if (typeof block === 'string') {
          blockName = block;
        }
        if (blockName) blocksSet.add(blockName);
      });
    });

    return Array.from(blocksSet).sort();
  }

  // Получить блоки для выбранных предприятий
  function getBlocksForEnterprises(selectedEnterprises, allTechnologies) {
    if (!selectedEnterprises || selectedEnterprises.length === 0) {
      // Если предприятия не выбраны, показать все блоки
      return getAllUniqueBlocks(allTechnologies);
    }

    const blocksSet = new Set();
    const enterpriseSet = new Set(selectedEnterprises);
    const blockIdToName = window.blockIdToName || {};

    allTechnologies.forEach(tech => {
      if (!tech) return;
      const techEnterprises = Array.isArray(tech.company)
        ? tech.company
        : (tech.company ? [tech.company] : []);

      // Проверяем, относится ли технология к выбранным предприятиям
      const belongsToSelected = techEnterprises.length === 0
        ? false // Технология без предприятий не учитывается при фильтрации
        : techEnterprises.some(ent => enterpriseSet.has(ent));

      if (belongsToSelected) {
        const techBlocks = Array.isArray(tech.blocks)
          ? tech.blocks
          : (tech.blocks ? [tech.blocks] : [tech.block].filter(Boolean));

        techBlocks.forEach(block => {
          // Нормализовать блок (может быть ID или название)
          let blockName = '';
          if (typeof block === 'number') {
            blockName = blockIdToName[block] || '';
          } else if (typeof block === 'string') {
            blockName = block;
          }
          if (blockName) blocksSet.add(blockName);
        });
      }
    });

    return Array.from(blocksSet).sort();
  }

  // Получить функции для выбранных предприятий
  function getFunctionsForEnterprises(selectedEnterprises, allTechnologies) {
    if (!selectedEnterprises || selectedEnterprises.length === 0) {
      // Если предприятия не выбраны, показать все функции
      const functionsSet = new Set();
      allTechnologies.forEach(tech => {
        if (!tech) return;
        const techFunctions = Array.isArray(tech.functions)
          ? tech.functions
          : (tech.function ? [tech.function] : []);
        techFunctions.forEach(func => {
          if (func) functionsSet.add(func);
        });
      });
      return Array.from(functionsSet).sort();
    }

    const functionsSet = new Set();
    const enterpriseSet = new Set(selectedEnterprises);

    allTechnologies.forEach(tech => {
      if (!tech) return;
      const techEnterprises = Array.isArray(tech.company)
        ? tech.company
        : (tech.company ? [tech.company] : []);

      // Проверяем, относится ли технология к выбранным предприятиям
      const belongsToSelected = techEnterprises.length === 0
        ? false // Технология без предприятий не учитывается при фильтрации
        : techEnterprises.some(ent => enterpriseSet.has(ent));

      if (belongsToSelected) {
        const techFunctions = Array.isArray(tech.functions)
          ? tech.functions
          : (tech.function ? [tech.function] : []);
        techFunctions.forEach(func => {
          if (func) functionsSet.add(func);
        });
      }
    });

    return Array.from(functionsSet).sort();
  }

  // Заполнить селект фильтра
  function populateSelect(filterKey, items, placeholderText) {
    const select = document.querySelector(`.custom-select[data-filter="${filterKey}"]`);
    if (!select) {
      if (window.Logger) window.Logger.warn(`populateSelect: селект с data-filter="${filterKey}" не найден`);
      return;
    }
    if (!Array.isArray(items) || items.length === 0) {
      if (window.Logger) window.Logger.warn(`populateSelect: для "${filterKey}" передан пустой массив или не массив:`, items);
    }
    const optionsList = select.querySelector('.select-options');
    if (!optionsList) {
      // Не найден .select-options
      return;
    }
    const selectedText = select.querySelector('.selected-text');
    if (!selectedText) {
      // Не найден .selected-text
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

    // Получаем выбранные предприятия для фильтрации
    const selectedEnterprises = getFilterValues('enterprise');
    const allTechnologies = getAllTechnologies();

    // Если это фильтр блоков, фильтруем по предприятиям и квадранту
    let filteredItems = items;
    if (filterKey === 'block') {
      // Сначала фильтруем по предприятиям
      if (selectedEnterprises.length > 0) {
        filteredItems = getBlocksForEnterprises(selectedEnterprises, allTechnologies);
      } else {
        // Если предприятия не выбраны, показываем все блоки
        filteredItems = getAllUniqueBlocks(allTechnologies);
      }

      // Затем фильтруем по зуммированному квадранту, если есть
      if (typeof window.currentZoomedQuadrant !== 'undefined' && window.currentZoomedQuadrant != null) {
        const getQuadrantIdForBlock = window.Positioning?.getQuadrantIdForBlock;
        if (getQuadrantIdForBlock) {
          filteredItems = filteredItems.filter(blockName => {
            const quadrantId = getQuadrantIdForBlock(blockName);
            return quadrantId === window.currentZoomedQuadrant;
          });
        }
      }
    }

    // Если это фильтр функций, фильтруем по предприятиям и блокам
    if (filterKey === 'function') {
      // Сначала фильтруем по предприятиям
      if (selectedEnterprises.length > 0) {
        filteredItems = getFunctionsForEnterprises(selectedEnterprises, allTechnologies);
      } else {
        // Если предприятия не выбраны, используем все функции из items
        filteredItems = items;
      }

      // Затем фильтруем по выбранным блокам, если они выбраны
      const selectedBlocks = getFilterValues('block');
      if (selectedBlocks.length > 0 && typeof window.nameToBlockId !== 'undefined' && window.nameToBlockId && typeof window.functionToBlockMap !== 'undefined' && window.functionToBlockMap) {
        const selectedBlockIds = selectedBlocks
          .map(blockName => window.nameToBlockId[blockName])
          .filter(id => id != null);
        if (selectedBlockIds.length > 0) {
          filteredItems = filteredItems.filter(funcName => {
            const blockIds = window.functionToBlockMap[funcName];
            if (!blockIds) return false;
            // blockIds может быть числом или массивом чисел
            const funcBlockIds = Array.isArray(blockIds) ? blockIds : [blockIds];
            return funcBlockIds.some(id => selectedBlockIds.includes(id));
          });
        }
      }
    }

    // Обработка пустых результатов
    if (filteredItems.length === 0) {
      const emptyMessage = document.createElement('li');
      emptyMessage.className = 'select-empty-message';
      emptyMessage.style.padding = '10px';
      emptyMessage.style.color = '#999';
      emptyMessage.style.fontStyle = 'italic';
      if (filterKey === 'block') {
        emptyMessage.textContent = selectedEnterprises.length > 0
          ? 'Нет блоков для выбранных предприятий'
          : 'Нет доступных блоков';
      } else if (filterKey === 'function') {
        emptyMessage.textContent = selectedEnterprises.length > 0
          ? 'Нет функций для выбранных предприятий'
          : 'Нет доступных функций';
      } else {
        emptyMessage.textContent = 'Нет доступных элементов';
      }
      optionsList.appendChild(emptyMessage);
    } else {
      filteredItems.forEach(item => {
        const li = createCheckboxOptionLi(item, item);
        optionsList.appendChild(li);
      });
    }

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
      if (hiddenInput) {
        hiddenInput.value = '';
        // ВАЖНО: для модальных форм (например, techVendors/editVendors) слушаемые модулями
        // изменения приходят через события input/change на hidden input.
        // Без этого секции, зависящие от значения (например, интеграторы по вендору),
        // не пересобираются при удалении последнего тега.
        hiddenInput.dispatchEvent(new Event('input', { bubbles: true }));
        hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
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
            if (hiddenInput) {
              hiddenInput.value = JSON.stringify(remaining);
              // Сообщаем подписчикам (например, form-management.js), что значение изменилось.
              hiddenInput.dispatchEvent(new Event('input', { bubbles: true }));
              hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
            }
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

            // Если это фильтр предприятий, обновляем фильтры блоков и функций
            const filterKeyInner = customSelect.getAttribute('data-filter');
            if (filterKeyInner === 'enterprise') {
              const updateFiltersForEnterprises = window.Filters?.updateFiltersForEnterprises;
              if (updateFiltersForEnterprises) {
                updateFiltersForEnterprises();
              }
            }
            // Если это фильтр блоков, обновляем фильтр функций
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
      // При изменении фильтра предприятий обновляем фильтры блоков и функций
      if (filterKey === 'enterprise') {
        const updateFiltersForEnterprises = window.Filters?.updateFiltersForEnterprises;
        if (updateFiltersForEnterprises) {
          updateFiltersForEnterprises();
        }
      }
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
    const functions = getFunctionsFromState();
    const functionToBlockMap = getFunctionToBlockMapFromState();
    if (!functions.length) return;
    if (!functionToBlockMap || Object.keys(functionToBlockMap).length === 0) return;

    const select = document.querySelector('.custom-select[data-filter="function"]');
    if (!select) return;

    const optionsList = select.querySelector('.select-options');
    if (!optionsList) return;
    const hiddenInput = document.getElementById('filter_function');

    // Сохраняем текущие выбранные значения (множественный выбор)
    const currentSelected = getFilterValues('function');

    // Получаем выбранные предприятия для дополнительной фильтрации
    const selectedEnterprises = getFilterValues('enterprise');
    const allTechnologies = getAllTechnologies();

    // Сначала фильтруем функции по выбранным предприятиям
    let filteredFunctions = selectedEnterprises.length > 0
      ? getFunctionsForEnterprises(selectedEnterprises, allTechnologies)
      : getFunctionsFromState();

    // Затем фильтруем функции по выбранным блокам
    const nameToBlockId = getNameToBlockIdFromState();
    const blockNamesArray = Array.isArray(blockNames) ? blockNames : (blockNames ? [blockNames] : []);
    if (blockNamesArray.length > 0 && nameToBlockId && Object.keys(nameToBlockId).length > 0) {
      const selectedBlockIds = blockNamesArray
        .map(blockName => nameToBlockId[blockName])
        .filter(id => id != null);
      if (selectedBlockIds.length > 0) {
        filteredFunctions = filteredFunctions.filter(funcName => {
          const blockIds = functionToBlockMap[funcName];
          if (!blockIds) return false;
          const funcBlockIds = Array.isArray(blockIds) ? blockIds : [blockIds];
          return funcBlockIds.some(id => selectedBlockIds.includes(id));
        });
      }
    }

    // Используем DocumentFragment для батчинга изменений DOM
    const fragment = document.createDocumentFragment();

    // Добавляем поиск
    const searchWrap = document.createElement('li');
    searchWrap.className = 'select-search';
    searchWrap.innerHTML = `<input type="text" placeholder="Поиск..." autocomplete="off" />`;
    fragment.appendChild(searchWrap);

    // Добавляем "Выбрать все"
    fragment.appendChild(createSelectAllLi());

    // Добавляем отфильтрованные функции в fragment
    filteredFunctions.forEach(funcName => {
      const li = createCheckboxOptionLi(funcName, funcName);
      // Восстанавливаем выделение, если функция была выбрана и все еще доступна
      if (currentSelected.includes(funcName)) {
        li.classList.add('selected');
        const checkbox = li.querySelector('input[type="checkbox"]');
        if (checkbox) checkbox.checked = true;
      }
      fragment.appendChild(li);
    });

    // Очищаем список опций и добавляем fragment одним операцией
    optionsList.innerHTML = '';
    optionsList.appendChild(fragment);

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

  // Обновить фильтры блоков и функций при изменении фильтра предприятий
  function updateFiltersForEnterprises() {
    // Сохраняем текущие выбранные значения
    const currentSelectedBlocks = getFilterValues('block');
    const currentSelectedFunctions = getFilterValues('function');

    // Обновляем фильтр блоков - populateSelect сам учтет выбранные предприятия
    const blocksList = getBlocksListFromState();
    const blockSelect = document.querySelector('.custom-select[data-filter="block"]');
    if (blockSelect && blocksList.length > 0) {
      const placeholder = blockSelect.getAttribute('data-placeholder') || 'Функциональный блок';
      populateSelect('block', blocksList, placeholder);

      // Восстанавливаем выбранные блоки, если они все еще доступны
      if (currentSelectedBlocks.length > 0) {
        // Получаем доступные блоки после фильтрации
        const selectedEnterprises = getFilterValues('enterprise');
        const allTechnologies = getAllTechnologies();
        const availableBlocks = selectedEnterprises.length > 0
          ? getBlocksForEnterprises(selectedEnterprises, allTechnologies)
          : getAllUniqueBlocks(allTechnologies);

        // Применяем дополнительную фильтрацию по квадранту, если есть
        let filteredBlocks = availableBlocks;
        if (typeof window.currentZoomedQuadrant !== 'undefined' && window.currentZoomedQuadrant != null) {
          const getQuadrantIdForBlock = window.Positioning?.getQuadrantIdForBlock;
          if (getQuadrantIdForBlock) {
            filteredBlocks = availableBlocks.filter(blockName => {
              const quadrantId = getQuadrantIdForBlock(blockName);
              return quadrantId === window.currentZoomedQuadrant;
            });
          }
        }

        const validBlocks = currentSelectedBlocks.filter(block => filteredBlocks.includes(block));
        if (validBlocks.length > 0) {
          const hiddenInput = document.getElementById('filter_block');
          if (hiddenInput) {
            hiddenInput.value = JSON.stringify(validBlocks);
            blockSelect.setAttribute('data-value', hiddenInput.value);
            // Отмечаем выбранные элементы в списке
            validBlocks.forEach(blockName => {
              const li = blockSelect.querySelector(`.select-options li[data-value="${blockName}"]`);
              if (li) {
                li.classList.add('selected');
                const checkbox = li.querySelector('input[type="checkbox"]');
                if (checkbox) checkbox.checked = true;
              }
            });
            renderMultiSelectTags(blockSelect);
          }
        } else {
          // Если выбранные блоки больше не доступны, очищаем выбор
          const hiddenInput = document.getElementById('filter_block');
          if (hiddenInput) {
            hiddenInput.value = '';
            blockSelect.setAttribute('data-value', '');
            renderMultiSelectTags(blockSelect);
          }
        }
      }
    }

    // Обновляем фильтр функций - populateSelect сам учтет выбранные предприятия и блоки
    const functionsList = getFunctionsFromState();
    const functionSelect = document.querySelector('.custom-select[data-filter="function"]');
    if (functionSelect && functionsList.length > 0) {
      const placeholder = functionSelect.getAttribute('data-placeholder') || 'Функция';
      populateSelect('function', functionsList, placeholder);

      // Восстанавливаем выбранные функции, если они все еще доступны
      if (currentSelectedFunctions.length > 0) {
        // Получаем доступные функции после фильтрации
        const selectedEnterprises = getFilterValues('enterprise');
        const allTechnologies = getAllTechnologies();
        let availableFunctions = selectedEnterprises.length > 0
          ? getFunctionsForEnterprises(selectedEnterprises, allTechnologies)
          : getFunctionsFromState();

        // Применяем дополнительную фильтрацию по блокам, если они выбраны
        const selectedBlocks = getFilterValues('block');
        const nameToBlockIdForBlocks = getNameToBlockIdFromState();
        const functionToBlockMapForBlocks = getFunctionToBlockMapFromState();
        if (selectedBlocks.length > 0 && nameToBlockIdForBlocks && Object.keys(nameToBlockIdForBlocks).length > 0 && functionToBlockMapForBlocks && Object.keys(functionToBlockMapForBlocks).length > 0) {
          const selectedBlockIds = selectedBlocks
            .map(blockName => nameToBlockIdForBlocks[blockName])
            .filter(id => id != null);
          if (selectedBlockIds.length > 0) {
            availableFunctions = availableFunctions.filter(funcName => {
              const blockIds = functionToBlockMapForBlocks[funcName];
              if (!blockIds) return false;
              const funcBlockIds = Array.isArray(blockIds) ? blockIds : [blockIds];
              return funcBlockIds.some(id => selectedBlockIds.includes(id));
            });
          }
        }

        const validFunctions = currentSelectedFunctions.filter(func => availableFunctions.includes(func));
        if (validFunctions.length > 0) {
          const hiddenInput = document.getElementById('filter_function');
          if (hiddenInput) {
            hiddenInput.value = JSON.stringify(validFunctions);
            functionSelect.setAttribute('data-value', hiddenInput.value);
            // Отмечаем выбранные элементы в списке
            validFunctions.forEach(funcName => {
              const li = functionSelect.querySelector(`.select-options li[data-value="${funcName}"]`);
              if (li) {
                li.classList.add('selected');
                const checkbox = li.querySelector('input[type="checkbox"]');
                if (checkbox) checkbox.checked = true;
              }
            });
            renderMultiSelectTags(functionSelect);
          }
        } else {
          // Если выбранные функции больше не доступны, очищаем выбор
          const hiddenInput = document.getElementById('filter_function');
          if (hiddenInput) {
            hiddenInput.value = '';
            functionSelect.setAttribute('data-value', '');
            renderMultiSelectTags(functionSelect);
          }
        }
      }
    }

    // Обновляем радар после изменения фильтров
    if (typeof window.updateRadar === 'function') {
      window.updateRadar();
    }
  }

  // Обновить фильтр блоков по зуммированному квадранту
  function updateBlockFilterForZoomedQuadrant(quadrantId) {
    const blocksList = getBlocksListFromState();
    if (!blocksList.length) return;

    const select = document.querySelector('.custom-select[data-filter="block"]');
    if (!select) return;

    const optionsList = select.querySelector('.select-options');
    if (!optionsList) return;
    const hiddenInput = document.getElementById('filter_block');

    // Сохраняем текущие выбранные значения (множественный выбор)
    const currentSelected = getFilterValues('block');

    // Фильтруем блоки по квадранту, если есть зум
    let filteredBlocks = blocksList;
    if (quadrantId != null) {
      const getQuadrantIdForBlock = window.Positioning?.getQuadrantIdForBlock;
      if (getQuadrantIdForBlock) {
        filteredBlocks = blocksList.filter(blockName => {
          const blockQuadrantId = getQuadrantIdForBlock(blockName);
          return blockQuadrantId === quadrantId;
        });
      }
    }

    // Используем DocumentFragment для батчинга изменений DOM
    const fragment = document.createDocumentFragment();

    // Добавляем поиск
    const searchWrap = document.createElement('li');
    searchWrap.className = 'select-search';
    searchWrap.innerHTML = `<input type="text" placeholder="Поиск..." autocomplete="off" />`;
    fragment.appendChild(searchWrap);

    // Добавляем "Выбрать все"
    fragment.appendChild(createSelectAllLi());

    // Добавляем отфильтрованные блоки в fragment
    filteredBlocks.forEach(blockName => {
      const li = createCheckboxOptionLi(blockName, blockName);
      // Восстанавливаем выделение, если блок был выбран и все еще доступен
      if (currentSelected.includes(blockName)) {
        li.classList.add('selected');
        const checkbox = li.querySelector('input[type="checkbox"]');
        if (checkbox) checkbox.checked = true;
      }
      fragment.appendChild(li);
    });

    // Очищаем список опций и добавляем fragment одной операцией
    optionsList.innerHTML = '';
    optionsList.appendChild(fragment);

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
      // Селект не найден (это нормально, если модальное окно закрыто)
      return;
    }
    if (!Array.isArray(items) || items.length === 0) {
      if (window.Logger) window.Logger.warn(`populateSelectForModal: для "${selectId}" передан пустой массив или не массив:`, items);
    }
    const optionsList = customSelect.querySelector('.select-options');
    if (!optionsList) {
      // Не найден .select-options
      return;
    }
    const selectedText = customSelect.querySelector('.selected-text');
    if (!selectedText) {
      // Не найден .selected-text
      return;
    }
    const hiddenInput = document.getElementById(selectId);
    customSelect.setAttribute('data-placeholder', placeholder);
    selectedText.textContent = placeholder;
    optionsList.innerHTML = '';
    // Для селектов с поиском проверяем, есть ли уже обёртка select-dropdown в HTML
    const selectDropdown = customSelect.querySelector('.select-dropdown');
    // Определяем, нужны ли чекбоксы для данного селекта (мультиселекты в модалках)
    const isVendorIntegratorsByVendor = typeof selectId === 'string'
      && (selectId.startsWith('techVendorIntegrators__') || selectId.startsWith('editVendorIntegrators__'));
    const needsCheckboxes = ['techDirections', 'editDirections', 'techBlock', 'techFunc', 'editBlock', 'editFunc', 'techVendors', 'editVendors', 'techIntegrators', 'editIntegrators'].includes(selectId)
      || isVendorIntegratorsByVendor;
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
    const isMulti = ['techSector', 'techDirections', 'editDirections', 'techBlock', 'editBlock', 'techFunc', 'editFunc', 'techLevel', 'editLevel', 'techCompany', 'editCompany', 'techVendors', 'editVendors', 'techIntegrators', 'editIntegrators'].includes(selectId)
      || isVendorIntegratorsByVendor;
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

    // Добавляем опцию "Добавить новый" для вендоров и интеграторов
    const isVendorField = selectId === 'techVendors' || selectId === 'editVendors';
    const isIntegratorField = selectId === 'techIntegrators' || selectId === 'editIntegrators'
      || isVendorIntegratorsByVendor;

    if (isVendorField || isIntegratorField) {
      const addNewLi = document.createElement('li');
      addNewLi.className = 'add-new-option';
      addNewLi.setAttribute('data-add-new', isVendorField ? 'vendor' : 'integrator');
      const label = isVendorField ? 'Добавить нового вендора' : 'Добавить нового интегратора';
      addNewLi.innerHTML = `
        <div class="add-new-option-content">
          <input type="text" class="add-new-input" placeholder="${label}" autocomplete="off" />
          <button type="button" class="add-new-btn" title="Добавить">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M8 3V13M3 8H13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
      `;
      optionsList.appendChild(addNewLi);

      // Обработчик для добавления нового значения
      const addNewInput = addNewLi.querySelector('.add-new-input');
      const addNewBtn = addNewLi.querySelector('.add-new-btn');

      if (addNewInput && addNewBtn) {
        const handleAddNew = () => {
          const newValue = addNewInput.value.trim();
          if (!newValue) return;

          // Проверяем, что такого значения еще нет
          const existingValues = Array.from(optionsList.querySelectorAll('li[data-value]'))
            .map(li => li.getAttribute('data-value'))
            .filter(Boolean);

          if (existingValues.includes(newValue)) {
            if (window.showNotification) {
              window.showNotification(`${isVendorField ? 'Вендор' : 'Интегратор'} "${newValue}" уже существует`, false);
            }
            return;
          }

          // Сохраняем текущую позицию прокрутки перед добавлением
          const optionsContainer = optionsList.closest('.select-options') || optionsList;
          const scrollTopBefore = optionsContainer.scrollTop || 0;

          // ВАЖНО: Сначала сохраняем текущие выбранные значения ПЕРЕД любыми изменениями
          let currentValues = [];
          try {
            if (hiddenInput && hiddenInput.value && hiddenInput.value.trim().startsWith('[')) {
              currentValues = JSON.parse(hiddenInput.value);
              if (!Array.isArray(currentValues)) {
                currentValues = [];
              }
            } else if (hiddenInput && hiddenInput.value) {
              const singleValue = hiddenInput.value.trim();
              if (singleValue) {
                currentValues = [singleValue];
              }
            }
          } catch (e) {
            currentValues = [];
          }

          // Сохраняем копию текущих значений для безопасности
          const savedCurrentValues = [...currentValues];

          // Сохраняем в localStorage через модуль vendors-files
          // Это НЕ должно влиять на текущие значения, так как мы убрали вызовы updateVendorsSelects/updateIntegratorsSelects
          if (isVendorField && window.VendorsFiles && typeof window.VendorsFiles.addVendor === 'function') {
            window.VendorsFiles.addVendor(newValue);
          } else if (isIntegratorField && window.VendorsFiles && typeof window.VendorsFiles.addIntegrator === 'function') {
            window.VendorsFiles.addIntegrator(newValue);
          }

          // Используем сохраненные значения
          currentValues = savedCurrentValues;

          // Добавляем новое значение к выбранным (если его еще нет)
          if (!currentValues.includes(newValue)) {
            currentValues.push(newValue);
          }

          // Добавляем новую опцию в список и сразу помечаем как выбранную
          let newLi;
          if (needsCheckboxes) {
            newLi = document.createElement('li');
            newLi.classList.add('select-option-item', 'selected');
            newLi.setAttribute('data-value', newValue);
            newLi.innerHTML = `
              <label class="option-label">
                <input type="checkbox" class="option-checkbox" checked />
                <span>${newValue}</span>
              </label>
            `;
            // Вставляем перед опцией "Добавить новый"
            optionsList.insertBefore(newLi, addNewLi);
          } else {
            newLi = document.createElement('li');
            newLi.textContent = newValue;
            newLi.setAttribute('data-value', newValue);
            newLi.classList.add('selected');
            optionsList.insertBefore(newLi, addNewLi);
          }

          // Очищаем поле ввода
          addNewInput.value = '';

          // Сохраняем выбранные значения в hidden input
          if (isMulti) {
            hiddenInput.value = JSON.stringify(currentValues);
          } else {
            hiddenInput.value = newValue;
          }

          // Используем двойной requestAnimationFrame для гарантии, что DOM полностью обновлен
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              // ВАЖНО: Обновляем отображение вручную, чтобы не сбрасывать существующие значения
              // setCustomSelectValue сбрасывает все выделения, что может привести к потере значений

              // Отмечаем все нужные опции, не сбрасывая существующие
              currentValues.forEach(val => {
                const valStr = String(val);
                let li = null;
                try {
                  li = customSelect.querySelector(`.select-options li[data-value="${CSS.escape(valStr)}"]`);
                } catch (e) {
                  li = customSelect.querySelector(`.select-options li[data-value="${valStr}"]`);
                }

                if (li) {
                  li.classList.add('selected');
                  const checkbox = li.querySelector('input[type="checkbox"]');
                  if (checkbox) {
                    checkbox.checked = true;
                    checkbox.dataset.programmaticChange = 'true';
                    setTimeout(() => {
                      delete checkbox.dataset.programmaticChange;
                    }, 100);
                  }
                }
              });

              // Обновляем отображение тегов для мультиселекта
              if (typeof renderMultiSelectTags === 'function') {
                renderMultiSelectTags(customSelect);
              }

              // Дополнительная проверка: убеждаемся, что все значения правильно отмечены
              setTimeout(() => {
                // Проверяем, что hidden input содержит правильные значения
                const currentHiddenValue = hiddenInput ? hiddenInput.value : '';
                let expectedValues = currentValues;

                // Если hidden input не соответствует currentValues, восстанавливаем его
                try {
                  if (currentHiddenValue && currentHiddenValue.trim().startsWith('[')) {
                    const parsed = JSON.parse(currentHiddenValue);
                    if (Array.isArray(parsed)) {
                      // Проверяем, что все значения из currentValues присутствуют в parsed
                      const missing = currentValues.filter(v => !parsed.includes(v));
                      if (missing.length > 0) {
                        // Восстанавливаем значения в hidden input
                        hiddenInput.value = JSON.stringify(currentValues);
                      }
                    }
                  } else if (isMulti && currentValues.length > 0) {
                    // Если это мультиселект, но hidden input не содержит массив, восстанавливаем
                    hiddenInput.value = JSON.stringify(currentValues);
                  }
                } catch (e) {
                  // Если ошибка парсинга, восстанавливаем значения
                  if (isMulti) {
                    hiddenInput.value = JSON.stringify(currentValues);
                  }
                }

                // Отмечаем все опции из currentValues
                currentValues.forEach(val => {
                  const valStr = String(val);
                  let li = null;
                  try {
                    li = customSelect.querySelector(`.select-options li[data-value="${CSS.escape(valStr)}"]`);
                  } catch (e) {
                    li = customSelect.querySelector(`.select-options li[data-value="${valStr}"]`);
                  }

                  if (li) {
                    const isSelected = li.classList.contains('selected');
                    const checkbox = li.querySelector('input[type="checkbox"]');
                    const isChecked = checkbox ? checkbox.checked : false;

                    // Если опция не выбрана, выбираем её
                    if (!isSelected || (checkbox && !isChecked)) {
                      li.classList.add('selected');
                      if (checkbox) {
                        checkbox.checked = true;
                        checkbox.dataset.programmaticChange = 'true';
                        setTimeout(() => {
                          delete checkbox.dataset.programmaticChange;
                        }, 100);
                      }
                    }
                  }
                });

                // Обновляем отображение тегов еще раз после проверки
                if (typeof renderMultiSelectTags === 'function') {
                  renderMultiSelectTags(customSelect);
                }
              }, 100);

              // Если это поле вендоров, вызываем обновление полей интеграторов
              if (isVendorField && hiddenInput) {
                // Триггерим событие change, чтобы сработал обработчик renderVendorIntegrators
                // Используем setTimeout для гарантии, что все обновления DOM завершены
                setTimeout(() => {
                  // Триггерим события change и input на hidden input
                  // Обработчики в form-management.js слушают эти события и вызывают renderVendorIntegrators
                  // Используем более надежный способ: сначала изменяем значение, затем триггерим события
                  const currentValue = hiddenInput.value;

                  // Временно изменяем значение, чтобы гарантировать срабатывание событий
                  if (currentValue) {
                    // Триггерим события с текущим значением
                    const changeEvent = new Event('change', { bubbles: true, cancelable: true });
                    hiddenInput.dispatchEvent(changeEvent);

                    const inputEvent = new Event('input', { bubbles: true, cancelable: true });
                    hiddenInput.dispatchEvent(inputEvent);
                  }
                }, 200);
              }
            });
          });

          // Восстанавливаем позицию прокрутки или прокручиваем к новому элементу
          // Используем requestAnimationFrame для гарантии, что DOM обновлен
          requestAnimationFrame(() => {
            // Вычисляем новую позицию прокрутки с учетом добавленного элемента
            const newLiHeight = newLi.offsetHeight || 30; // Примерная высота элемента
            const newScrollTop = scrollTopBefore + newLiHeight;

            // Прокручиваем так, чтобы новая опция была видна, но не в самом верху
            // Это сохраняет контекст и не перебрасывает пользователя
            if (optionsContainer.scrollHeight > optionsContainer.clientHeight) {
              // Если список прокручиваемый, прокручиваем к новой опции, но с небольшим отступом сверху
              newLi.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest',
                inline: 'nearest'
              });

              // Дополнительно корректируем позицию, чтобы новая опция была видна, но не в самом верху
              setTimeout(() => {
                const liRect = newLi.getBoundingClientRect();
                const containerRect = optionsContainer.getBoundingClientRect();

                // Если новая опция слишком высоко, немного прокручиваем вниз
                if (liRect.top < containerRect.top + 50) {
                  optionsContainer.scrollTop = Math.max(0, optionsContainer.scrollTop - 30);
                }
              }, 100);
            }
          });

          if (window.showNotification) {
            window.showNotification(`${isVendorField ? 'Вендор' : 'Интегратор'} "${newValue}" добавлен и выбран`, true);
          }
        };

        addNewBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          handleAddNew();
        });

        addNewInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.stopPropagation();
            e.preventDefault();
            handleAddNew();
          }
        });
      }
    }

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
      // Сначала проверяем переданное значение (может быть массивом)
      if (Array.isArray(value)) {
        toSelect = value;
      } else if (hiddenInput && hiddenInput.value && hiddenInput.value.trim().startsWith('[')) {
        const parsed = JSON.parse(hiddenInput.value);
        if (Array.isArray(parsed)) toSelect = parsed;
      } else if (typeof value === 'string' && value.trim().startsWith('[')) {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) toSelect = parsed;
      } else if (typeof value === 'string' && value.length > 0) {
        toSelect = [value];
      } else if (hiddenInput && hiddenInput.value) {
        // Если значение в hiddenInput не массив, создаем массив
        const singleValue = hiddenInput.value.trim();
        if (singleValue) {
          toSelect = [singleValue];
        }
      }
    } catch (e) {
      // Если не массив, попробуем как одиночное значение
      if (Array.isArray(value)) {
        toSelect = value;
      } else if (typeof value === 'string' && value.length > 0) {
        toSelect = [value];
      }
    }
    // Отметим нужные опции
    toSelect.forEach(val => {
      const valStr = String(val);
      // Используем CSS.escape для безопасного поиска
      let li = null;
      try {
        li = customSelect.querySelector(`.select-options li[data-value="${CSS.escape(valStr)}"]`);
      } catch (e) {
        // Если CSS.escape не поддерживается, используем обычный селектор
        li = customSelect.querySelector(`.select-options li[data-value="${valStr}"]`);
      }

      // Если не нашли по data-value, ищем по тексту содержимого
      if (!li) {
        const allOptions = customSelect.querySelectorAll('.select-options li');
        for (let i = 0; i < allOptions.length; i++) {
          const option = allOptions[i];
          // Пропускаем служебные элементы (поиск, "Выбрать все", "Добавить новый")
          if (option.classList.contains('select-search') ||
            option.classList.contains('select-all-option') ||
            option.classList.contains('add-new-option')) {
            continue;
          }

          const optionValue = option.getAttribute('data-value');
          if (optionValue === valStr) {
            li = option;
            break;
          }

          // Проверяем текст опции (для опций с чекбоксами - берем текст из span)
          const span = option.querySelector('span');
          const textContent = span ? span.textContent.trim() : option.textContent.trim();
          if (textContent === valStr) {
            li = option;
            break;
          }
        }
      }

      if (li) {
        li.classList.add('selected');
        const checkbox = li.querySelector('input[type="checkbox"]');
        if (checkbox) {
          checkbox.checked = true;
          // Устанавливаем флаг, чтобы избежать повторной обработки
          checkbox.dataset.programmaticChange = 'true';
          setTimeout(() => {
            delete checkbox.dataset.programmaticChange;
          }, 100);
        }
        if (!selectedOption) selectedOption = li;
      } else {
        // Логируем, если не нашли опцию (для отладки)
        if (window.Logger) {
          window.Logger.warn(`Не удалось найти опцию для значения: "${valStr}" в селекте ${fieldId}`);
        }
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
    updateFiltersForEnterprises,
    getBlocksForEnterprises,
    getFunctionsForEnterprises,
    getAllTechnologies,
    getAllUniqueBlocks,
    setCustomSelectValue,
    resetCustomSelects
  };

  // Экспорт функций в window для обратной совместимости с events.js
  window.renderMultiSelectTags = renderMultiSelectTags;
  window.updateFunctionFilterForBlock = updateFunctionFilterForBlock;
  window.setCustomSelectValue = setCustomSelectValue;
  window.resetCustomSelects = resetCustomSelects;
})();
