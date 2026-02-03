/**
 * Модуль для автоматического расчета покрытия функций
 * на основе выбранных функций и блоков
 */
(function (window) {
  'use strict';

  // Модуль AutoFuncCover инициализирован

  /**
   * Получение текстового представления покрытия функций
   * @param {number} value - Значение покрытия функций (0-3)
   * @returns {string} Текстовое представление
   */
  function getFuncCoverText(value) {
    const options = {
      0: '0 — Не покрывает',
      1: '1 — Низкое покрытие',
      2: '2 — Среднее покрытие',
      3: '3 — Полное покрытие'
    };
    return options[value] || '—';
  }

  /**
   * Обновление поля покрытия функций
   * @param {string} fieldId - ID поля (techFuncCover или editFuncCover)
   * @param {number} value - Значение покрытия функций (0-3)
   */
  function updateFuncCoverField(fieldId, value) {
    const field = document.getElementById(fieldId);
    if (!field) {
      return;
    }

    const text = getFuncCoverText(value);
    field.value = text;

    // Также сохраняем числовое значение в data-атрибуте для удобства
    field.setAttribute('data-value', value);

    // Покрытие функций обновлено
  }

  /**
   * Получение выбранных функций из поля
   * @param {string} funcFieldId - ID поля функций (techFunc или editFunc)
   * @returns {string[]} Массив выбранных функций
   */
  function getSelectedFunctions(funcFieldId) {
    const funcInput = document.getElementById(funcFieldId);
    if (!funcInput || !funcInput.value) {
      return [];
    }

    try {
      const parsed = JSON.parse(funcInput.value);
      if (Array.isArray(parsed)) {
        return parsed.filter(f => f && f.trim());
      }
      if (typeof parsed === 'string' && parsed.trim()) {
        return [parsed.trim()];
      }
    } catch (e) {
      // Если не JSON, пробуем как строку
      if (funcInput.value.trim()) {
        return [funcInput.value.trim()];
      }
    }

    return [];
  }

  /**
   * Получение выбранных блоков из поля
   * @param {string} blockFieldId - ID поля блоков (techBlock или editBlock)
   * @returns {number[]} Массив ID выбранных блоков
   */
  function getSelectedBlockIds(blockFieldId) {
    const blockInput = document.getElementById(blockFieldId);
    if (!blockInput || !blockInput.value) {
      return [];
    }

    try {
      const parsed = JSON.parse(blockInput.value);
      const blockNames = Array.isArray(parsed) ? parsed : [parsed];

      // Преобразуем названия блоков в ID блоков
      const nameToBlockId = window.nameToBlockId || {};
      const blockIds = blockNames
        .map(name => {
          if (typeof name === 'number') return name;
          if (typeof name === 'string') {
            // Ищем ID блока по названию
            const blockId = nameToBlockId[name];
            if (blockId !== undefined) return blockId;
            // Если не найдено, пробуем парсить как число
            const num = parseInt(name, 10);
            if (!isNaN(num)) return num;
          }
          return null;
        })
        .filter(id => id !== null);

      return blockIds;
    } catch (e) {
      // Ошибка при парсинге блоков
      return [];
    }
  }

  /**
   * Расчет покрытия функций на основе выбранных функций и блоков
   * @param {string} funcFieldId - ID поля функций
   * @param {string} blockFieldId - ID поля блоков
   * @param {string} coverFieldId - ID поля покрытия функций
   */
  async function calculateAndUpdateFuncCover(funcFieldId, blockFieldId, coverFieldId) {
    const selectedFunctions = getSelectedFunctions(funcFieldId);
    const selectedBlockIds = getSelectedBlockIds(blockFieldId);

    // Если функции не выбраны, покрытие = 0
    if (selectedFunctions.length === 0) {
      updateFuncCoverField(coverFieldId, 0);
      return;
    }

    // Используем FuncCoverUtils для расчета, если доступен
    if (window.FuncCoverUtils && typeof window.FuncCoverUtils.calculateFuncCover === 'function') {
      try {
        const funcCover = await window.FuncCoverUtils.calculateFuncCover(selectedFunctions, selectedBlockIds);
        updateFuncCoverField(coverFieldId, funcCover);
        return;
      } catch (e) {
        // Ошибка при расчете через FuncCoverUtils
      }
    }

    // Fallback: простая логика на основе количества функций
    let funcCover = 0;
    if (selectedFunctions.length === 0) {
      funcCover = 0;
    } else if (selectedFunctions.length === 1) {
      funcCover = 1;
    } else if (selectedFunctions.length >= 2 && selectedFunctions.length <= 3) {
      funcCover = 2;
    } else {
      funcCover = 3;
    }

    updateFuncCoverField(coverFieldId, funcCover);
  }

  /**
   * Получение числового значения покрытия функций из поля
   * @param {string} fieldId - ID поля
   * @returns {number} Значение покрытия функций (0-3)
   */
  function getFuncCoverValue(fieldId) {
    const field = document.getElementById(fieldId);
    if (!field) {
      return 0;
    }

    // Сначала пробуем получить из data-атрибута
    const dataValue = field.getAttribute('data-value');
    if (dataValue !== null) {
      const num = parseInt(dataValue, 10);
      if (!isNaN(num) && num >= 0 && num <= 3) {
        return num;
      }
    }

    // Если нет data-атрибута, пробуем извлечь из текста
    const text = field.value || '';
    const match = text.match(/^(\d+)/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num >= 0 && num <= 3) {
        return num;
      }
    }

    return 0;
  }

  /**
   * Инициализация для формы добавления технологии
   */
  function initForAddForm() {
    const funcInput = document.getElementById('techFunc');
    const blockInput = document.getElementById('techBlock');
    const coverField = document.getElementById('techFuncCover');

    if (!funcInput || !coverField) {
      return;
    }

    // Обработчик изменения функций
    const handleFuncChange = () => {
      calculateAndUpdateFuncCover('techFunc', 'techBlock', 'techFuncCover');
    };

    // Обработчик изменения блоков
    const handleBlockChange = () => {
      calculateAndUpdateFuncCover('techFunc', 'techBlock', 'techFuncCover');
    };

    // Добавляем обработчики
    funcInput.addEventListener('change', handleFuncChange);
    funcInput.addEventListener('input', handleFuncChange);

    if (blockInput) {
      blockInput.addEventListener('change', handleBlockChange);
      blockInput.addEventListener('input', handleBlockChange);
    }

    // Инициализируем значение при загрузке
    setTimeout(() => {
      handleFuncChange();
    }, 100);

    // Инициализация для формы добавления завершена
  }

  /**
   * Инициализация для формы редактирования технологии
   */
  function initForEditForm() {
    const funcInput = document.getElementById('editFunc');
    const blockInput = document.getElementById('editBlock');
    const coverField = document.getElementById('editFuncCover');

    if (!funcInput || !coverField) {
      return;
    }

    // Обработчик изменения функций
    const handleFuncChange = () => {
      calculateAndUpdateFuncCover('editFunc', 'editBlock', 'editFuncCover');
    };

    // Обработчик изменения блоков
    const handleBlockChange = () => {
      calculateAndUpdateFuncCover('editFunc', 'editBlock', 'editFuncCover');
    };

    // Добавляем обработчики
    funcInput.addEventListener('change', handleFuncChange);
    funcInput.addEventListener('input', handleFuncChange);

    if (blockInput) {
      blockInput.addEventListener('change', handleBlockChange);
      blockInput.addEventListener('input', handleBlockChange);
    }

    // Инициализируем значение при загрузке (будет вызвано при открытии модального окна)
    setTimeout(() => {
      handleFuncChange();
    }, 100);

    // Инициализация для формы редактирования завершена
  }

  /**
   * Инициализация модуля
   */
  function init() {
    // Инициализируем для формы добавления
    initForAddForm();

    // Для формы редактирования будет инициализировано при открытии модального окна
    // через метод initForEditForm
  }

  // Публичный API
  window.AutoFuncCover = {
    init: init,
    initForAddForm: initForAddForm,
    initForEditForm: initForEditForm,
    calculateAndUpdateFuncCover: calculateAndUpdateFuncCover,
    getFuncCoverValue: getFuncCoverValue,
    updateFuncCoverField: updateFuncCoverField
  };

  // Модуль AutoFuncCover загружен

  // Автоматическая инициализация при загрузке модуля
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    // DOM уже загружен
    setTimeout(init, 200);
  }

})(window);
