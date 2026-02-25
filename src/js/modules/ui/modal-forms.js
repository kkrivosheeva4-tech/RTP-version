// modal-forms.js — ES module
// Формы в модальных окнах (списки блоков и функций)

import { DOMCache } from '../core/dom-utils.js';
import StateManager from '../core/state-manager.js';
import Logger from '../core/logger.js';

  function getFilters() {
    if (typeof window !== 'undefined' && window.Filters) return window.Filters;
    throw new Error('Filters не загружен');
  }

  function updateModalBlocksForSectors(sectorNames) {
    const Filters = getFilters();
    const renderMultiSelectTags = Filters.renderMultiSelectTags;

    const updateModalFunctionsForBlocks = window.updateModalFunctionsForBlocks;

    // Данные только через StateAccessors (window.* устарел)
    let blocksList = [];
    if (window.StateAccessors && typeof window.StateAccessors.getBlocksList === 'function') {
      blocksList = window.StateAccessors.getBlocksList() || [];
    }
    if (!blocksList.length) {
      const list = StateManager.get('blocksList');
      blocksList = Array.isArray(list) ? list : [];
    }
    if (!blocksList.length && (window.getBlocksList && typeof window.getBlocksList === 'function')) {
      blocksList = window.getBlocksList() || [];
    }

    if (!Array.isArray(blocksList) || blocksList.length === 0) {
      Logger.warn('updateModalBlocksForSectors: blocksList пуст или не массив');
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

    // ОБНОВЛЕНО (2026-01-29): Все блоки доступны для всех квадрантов
    // Блоки больше не фильтруются по квадрантам, так как они являются отдельными критериями технологии
    const allowedBlocks = blocksList.slice();

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
    const Filters = getFilters();
    const renderMultiSelectTags = Filters.renderMultiSelectTags;

    // Справочники через StateAccessors (window.* устарел)
    let functions = [];
    let functionToBlockMap = {};
    let nameToBlockId = {};
    if (window.StateAccessors) {
      if (typeof window.StateAccessors.getFunctions === 'function') functions = window.StateAccessors.getFunctions() || [];
      if (typeof window.StateAccessors.getFunctionToBlockMap === 'function') functionToBlockMap = window.StateAccessors.getFunctionToBlockMap() || {};
      if (typeof window.StateAccessors.getNameToBlockId === 'function') nameToBlockId = window.StateAccessors.getNameToBlockId() || {};
    }
    if (!functions.length) {
      const f = StateManager.get('functions');
      functions = Array.isArray(f) ? f : [];
      if (!Object.keys(functionToBlockMap).length) functionToBlockMap = StateManager.get('functionToBlockMap') || {};
      if (!Object.keys(nameToBlockId).length) nameToBlockId = StateManager.get('nameToBlockId') || {};
    }

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

  const ModalForms = {
    updateModalBlocksForSectors,
    updateModalFunctionsForBlocks,
    initModalFilters
  };

  if (typeof window !== 'undefined') {
    window.ModalForms = ModalForms;
    window.updateModalBlocksForSectors = updateModalBlocksForSectors;
    window.updateModalFunctionsForBlocks = updateModalFunctionsForBlocks;
    window.initModalFilters = initModalFilters;
  }

  export default ModalForms;
  export { updateModalBlocksForSectors, updateModalFunctionsForBlocks, initModalFilters };
