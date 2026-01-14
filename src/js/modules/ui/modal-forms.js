// modal-forms.js
// Модуль для работы с формами в модальных окнах (обновление списков блоков и функций)

(function() {
  'use strict';

  // Ленивая загрузка зависимостей
  function getDOMCache() {
    if (typeof window !== 'undefined' && window.DOMCache) {
      return window.DOMCache;
    }
    throw new Error('DOMCache не загружен');
  }

  function getFilters() {
    if (typeof window !== 'undefined' && window.Filters) {
      return window.Filters;
    }
    throw new Error('Filters не загружен');
  }

  // Обновление списка функциональных блоков в модалке добавления/редактирования технологии
  // в зависимости от выбранных секторов
  function updateModalBlocksForSectors(sectorNames) {
    const DOMCache = getDOMCache();
    const Filters = getFilters();
    const renderMultiSelectTags = Filters.renderMultiSelectTags;

    // Получаем зависимости из window
    const getBlocksList = window.getBlocksList || (() => []);
    const getBlockToQuadrant = window.getBlockToQuadrant || (() => ({}));
    const QUADRANTS = window.QUADRANTS || [];
    const updateModalFunctionsForBlocks = window.updateModalFunctionsForBlocks;

    // Получаем актуальные данные из StateAccessors, если доступны
    let blocksList;
    let blockToQuadrant;
    if (window.StateAccessors) {
      try {
        blocksList = window.StateAccessors.getBlocksList ? window.StateAccessors.getBlocksList() : getBlocksList();
        blockToQuadrant = window.StateAccessors.getBlockToQuadrant ? window.StateAccessors.getBlockToQuadrant() : getBlockToQuadrant();
        // Также проверяем window.blocksList и window.blockToQuadrant для обратной совместимости
        if (!blocksList || blocksList.length === 0) {
          blocksList = window.blocksList || getBlocksList();
        }
        if (!blockToQuadrant || Object.keys(blockToQuadrant).length === 0) {
          blockToQuadrant = window.blockToQuadrant || getBlockToQuadrant();
        }
      } catch (e) {
        // Fallback к window функциям если StateAccessors недоступен
        blocksList = window.blocksList || getBlocksList();
        blockToQuadrant = window.blockToQuadrant || getBlockToQuadrant();
      }
    } else {
      // Fallback к window функциям
      blocksList = window.blocksList || getBlocksList();
      blockToQuadrant = window.blockToQuadrant || getBlockToQuadrant();
    }

    if (!Array.isArray(blocksList) || blocksList.length === 0) {
      if (window.Logger) window.Logger.warn('updateModalBlocksForSectors: blocksList пуст или не массив');
      return;
    }
    if (!Array.isArray(QUADRANTS) || QUADRANTS.length === 0) {
      if (window.Logger) window.Logger.warn('updateModalBlocksForSectors: QUADRANTS пуст');
      return;
    }
    if (!blockToQuadrant || Object.keys(blockToQuadrant).length === 0) {
      if (window.Logger) window.Logger.warn('updateModalBlocksForSectors: blockToQuadrant пуст');
      return;
    }

    // Используем query вместо find, так как find требует parent элемент
    const blockSelect = DOMCache.query('.custom-select-modal[data-field="techBlock"]') ||
                        document.querySelector('.custom-select-modal[data-field="techBlock"]');
    if (!blockSelect) return;
    const optionsList = blockSelect.querySelector('.select-options');
    if (!optionsList) return;
    const hiddenInput = DOMCache.get('techBlock');

    // Текущий выбор блоков (множественный выбор)
    let currentSelected = [];
    if (hiddenInput && hiddenInput.value) {
      try {
        const parsed = JSON.parse(hiddenInput.value);
        if (Array.isArray(parsed)) currentSelected = parsed;
      } catch (e) {
        currentSelected = [];
      }
    }

    // Нормализуем входные данные: всегда получаем массив секторов
    let sectorArray = [];
    if (Array.isArray(sectorNames)) {
      sectorArray = sectorNames.filter(s => s != null && String(s).trim() !== '');
    } else if (sectorNames) {
      sectorArray = [sectorNames];
    }

    let allowedBlocks = blocksList.slice();

    if (sectorArray.length > 0) {
      // Маппинг "имя сектора" -> id квадранта
      const sectorNameToId = {};
      QUADRANTS.forEach(q => {
        if (q && q.name != null && q.id != null) {
          sectorNameToId[String(q.name).trim()] = q.id;
        }
      });

      const selectedQuadrantIds = sectorArray
        .map(name => {
          const trimmed = String(name).trim();
          return sectorNameToId[trimmed];
        })
        .filter(id => id != null);

      if (selectedQuadrantIds.length > 0) {
        // Фильтруем блоки: показываем блоки, которые относятся к ЛЮБОМУ из выбранных квадрантов
        allowedBlocks = blocksList.filter(blockName => {
          // Еще раз получаем актуальные данные для каждого блока
          let currentBlockToQuadrant = blockToQuadrant;
          if (window.StateAccessors && window.StateAccessors.getBlockToQuadrant) {
            try {
              currentBlockToQuadrant = window.StateAccessors.getBlockToQuadrant();
            } catch (e) {
              // Используем переданные данные если StateAccessors недоступен
            }
          }
          const m = currentBlockToQuadrant[blockName];
          if (m == null) {
            // Если блока нет в blockToQuadrant, но он есть в blocksList, возможно это новый блок
            // Пробуем найти его квадрант через nameToBlockId и blocksList
            if (window.Logger) window.Logger.debug(`updateModalBlocksForSectors: блок "${blockName}" не найден в blockToQuadrant`);
            return false;
          }
          // blockToQuadrant может содержать массив квадрантов или одно значение
          const blockQuadrants = Array.isArray(m) ? m : [m];
          // Проверяем, есть ли пересечение между квадрантами блока и выбранными квадрантами
          const matches = blockQuadrants.some(blockQuadrantId => selectedQuadrantIds.includes(blockQuadrantId));
          if (window.Logger && matches) {
            window.Logger.debug(`updateModalBlocksForSectors: блок "${blockName}" соответствует квадрантам:`, blockQuadrants, 'выбранные:', selectedQuadrantIds);
          }
          return matches;
        });

        if (window.Logger) {
          window.Logger.debug('updateModalBlocksForSectors: всего блоков:', blocksList.length, 'разрешено:', allowedBlocks.length, 'для квадрантов:', selectedQuadrantIds);
        }
      }
    }

    // Перестраиваем список опций в модальном селекте блоков
    const existingSearch = optionsList.querySelector('.select-search');
    optionsList.innerHTML = '';
    if (existingSearch) optionsList.appendChild(existingSearch);

    // Добавляем опцию "Выбрать все" для блоков с чекбоксами
    const selectAllLi = document.createElement('li');
    selectAllLi.className = 'select-all-option';
    selectAllLi.innerHTML = `
      <label class="option-label">
        <input type="checkbox" class="select-all-checkbox" />
        <span>Выбрать все</span>
      </label>
    `;
    optionsList.appendChild(selectAllLi);

    // Оставляем только те выбранные блоки, которые доступны после фильтрации
    const validSelectedBlocks = currentSelected.filter(b => allowedBlocks.includes(b));

    allowedBlocks.forEach(blockName => {
      const li = document.createElement('li');
      li.classList.add('select-option-item');
      li.setAttribute('data-value', blockName);
      const isSelected = validSelectedBlocks.includes(blockName);
      const escapedBlockName = window.escapeHtml ? window.escapeHtml(blockName) : String(blockName).replace(/[&<>"']/g, m => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[m]);
      li.innerHTML = `
        <label class="option-label">
          <input type="checkbox" class="option-checkbox" ${isSelected ? 'checked' : ''} />
          <span>${escapedBlockName}</span>
        </label>
      `;
      if (isSelected) {
        li.classList.add('selected');
      }
      optionsList.appendChild(li);
    });

    if (hiddenInput) {
      hiddenInput.value = validSelectedBlocks.length ? JSON.stringify(validSelectedBlocks) : '';
    }

    // Обновляем состояние чекбокса "Выбрать все"
    const allCheckbox = selectAllLi.querySelector('input[type="checkbox"]');
    if (allCheckbox && allowedBlocks.length > 0) {
      allCheckbox.checked = validSelectedBlocks.length === allowedBlocks.length;
    }

    // Обновляем отображение тегов
    renderMultiSelectTags(blockSelect);

    // После изменения доступных блоков, обновим функции в модалке
    if (typeof updateModalFunctionsForBlocks === 'function') {
      updateModalFunctionsForBlocks(validSelectedBlocks, 'techFunc');
    }
  }

  // Обновление списка функций в модалке добавления/редактирования технологии
  // в зависимости от выбранных функциональных блоков
  function updateModalFunctionsForBlocks(blockNames, fieldId) {
    const DOMCache = getDOMCache();
    const Filters = getFilters();
    const renderMultiSelectTags = Filters.renderMultiSelectTags;

    // Получаем зависимости из window
    const functions = window.functions || [];
    const functionToBlockMap = window.functionToBlockMap || {};
    const nameToBlockId = window.nameToBlockId || {};

    if (!Array.isArray(functions) || functions.length === 0) return;
    if (!functionToBlockMap || Object.keys(functionToBlockMap).length === 0) return;
    if (!nameToBlockId || Object.keys(nameToBlockId).length === 0) return;

    const targetField = fieldId || 'techFunc';
    // Используем query вместо find, так как find требует parent элемент
    const funcSelect = DOMCache.query(`.custom-select-modal[data-field="${targetField}"]`) ||
                       document.querySelector(`.custom-select-modal[data-field="${targetField}"]`);
    if (!funcSelect) return;
    const optionsList = funcSelect.querySelector('.select-options');
    if (!optionsList) return;
    const hiddenInput = DOMCache.get(targetField);

    // Текущее значение (множественный выбор)
    let currentSelected = [];
    if (hiddenInput && hiddenInput.value) {
      try {
        const parsed = JSON.parse(hiddenInput.value);
        if (Array.isArray(parsed)) currentSelected = parsed;
      } catch (e) {
        currentSelected = [];
      }
    }

    const blockNamesArray = Array.isArray(blockNames)
      ? blockNames
      : (blockNames ? [blockNames] : []);

    let allowedFunctions = functions.slice();

    if (blockNamesArray.length > 0) {
      const selectedBlockIds = blockNamesArray
        .map(blockName => nameToBlockId[blockName])
        .filter(id => id != null);

      if (selectedBlockIds.length > 0) {
        allowedFunctions = functions.filter(funcName => {
          const blockIds = functionToBlockMap[funcName];
          if (!blockIds) return false;
          const funcBlockIds = Array.isArray(blockIds) ? blockIds : [blockIds];
          return funcBlockIds.some(id => selectedBlockIds.includes(id));
        });
      }
    }

    // Перестраиваем список опций в модальном селекте функций
    const existingSearch = optionsList.querySelector('.select-search');
    optionsList.innerHTML = '';
    if (existingSearch) optionsList.appendChild(existingSearch);

    // Добавляем опцию "Выбрать все" для функций с чекбоксами
    const selectAllLi = document.createElement('li');
    selectAllLi.className = 'select-all-option';
    selectAllLi.innerHTML = `
      <label class="option-label">
        <input type="checkbox" class="select-all-checkbox" />
        <span>Выбрать все</span>
      </label>
    `;
    optionsList.appendChild(selectAllLi);

    // Оставляем только доступные выбранные функции
    const validSelectedFunctions = currentSelected.filter(f => allowedFunctions.includes(f));

    allowedFunctions.forEach(funcName => {
      const li = document.createElement('li');
      li.classList.add('select-option-item');
      li.setAttribute('data-value', funcName);
      const isSelected = validSelectedFunctions.includes(funcName);
      const escapedFuncName = window.escapeHtml ? window.escapeHtml(funcName) : String(funcName).replace(/[&<>"']/g, m => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[m]);
      li.innerHTML = `
        <label class="option-label">
          <input type="checkbox" class="option-checkbox" ${isSelected ? 'checked' : ''} />
          <span>${escapedFuncName}</span>
        </label>
      `;
      if (isSelected) {
        li.classList.add('selected');
      }
      optionsList.appendChild(li);
    });

    if (hiddenInput) {
      hiddenInput.value = validSelectedFunctions.length ? JSON.stringify(validSelectedFunctions) : '';
    }

    // Обновляем состояние чекбокса "Выбрать все"
    const allCheckbox = selectAllLi.querySelector('input[type="checkbox"]');
    if (allCheckbox && allowedFunctions.length > 0) {
      allCheckbox.checked = validSelectedFunctions.length === allowedFunctions.length;
    }

    renderMultiSelectTags(funcSelect);
  }

  // Инициализация фильтрации при открытии модального окна добавления технологии
  // Применяет фильтрацию блоков по секторам и функций по блокам, если уже есть выбранные значения
  function initModalFilters() {
    const DOMCache = getDOMCache();

    // Проверяем, открыто ли модальное окно добавления технологии
    const addTechPanel = DOMCache.get('addTechPanel');
    if (!addTechPanel || !addTechPanel.classList.contains('open')) {
      return;
    }

    // Получаем выбранные секторы
    const sectorInput = DOMCache.get('techSector');
    if (sectorInput && sectorInput.value) {
      let selectedSectors = [];
      try {
        const parsed = JSON.parse(sectorInput.value);
        if (Array.isArray(parsed)) {
          selectedSectors = parsed;
        } else if (parsed) {
          selectedSectors = [parsed];
        }
      } catch (e) {
        // Если не JSON, значит это строка
        if (sectorInput.value.trim()) {
          selectedSectors = [sectorInput.value.trim()];
        }
      }

      // Если есть выбранные секторы, применяем фильтрацию блоков
      if (selectedSectors.length > 0 && typeof window.updateModalBlocksForSectors === 'function') {
        window.updateModalBlocksForSectors(selectedSectors);
        return; // После фильтрации блоков, фильтрация функций будет вызвана автоматически
      }
    }

    // Если секторы не выбраны, но есть выбранные блоки, применяем фильтрацию функций
    const blockInput = DOMCache.get('techBlock');
    if (blockInput && blockInput.value) {
      let selectedBlocks = [];
      try {
        const parsed = JSON.parse(blockInput.value);
        if (Array.isArray(parsed)) {
          selectedBlocks = parsed;
        } else if (parsed) {
          selectedBlocks = [parsed];
        }
      } catch (e) {
        // Если не JSON, значит это строка
        if (blockInput.value.trim()) {
          selectedBlocks = [blockInput.value.trim()];
        }
      }

      // Если есть выбранные блоки, применяем фильтрацию функций
      if (selectedBlocks.length > 0 && typeof window.updateModalFunctionsForBlocks === 'function') {
        window.updateModalFunctionsForBlocks(selectedBlocks, 'techFunc');
      }
    }
  }

  // Экспорт функций
  window.ModalForms = {
    updateModalBlocksForSectors,
    updateModalFunctionsForBlocks,
    initModalFilters
  };

  // Глобальные алиасы для обратной совместимости
  window.updateModalBlocksForSectors = updateModalBlocksForSectors;
  window.updateModalFunctionsForBlocks = updateModalFunctionsForBlocks;
  window.initModalFilters = initModalFilters;
})();
