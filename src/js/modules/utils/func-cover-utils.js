/**
 * Утилиты для расчета покрытия функций (funcCover)
 * с учетом количества функций в блоках
 */
(function (window) {
  'use strict';

  console.log('[FuncCoverUtils] Инициализация модуля');

  // Кэш для данных functionToBlock
  let functionToBlockData = null;
  let blockFunctionCounts = null;

  /**
   * Загрузка данных из functionToBlock.json
   * @returns {Promise<Object>} Объект с маппингом функций на блоки
   */
  async function loadFunctionToBlockData() {
    if (functionToBlockData !== null) {
      return functionToBlockData;
    }

    try {
      // Используем абсолютный путь от корня сайта
      const response = await fetch('/src/data/ru/functionToBlock.json');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      functionToBlockData = await response.json();
      console.log('[FuncCoverUtils] Данные functionToBlock загружены', functionToBlockData);
      return functionToBlockData;
    } catch (error) {
      console.error('[FuncCoverUtils] Ошибка загрузки functionToBlock.json:', error);
      functionToBlockData = {};
      return functionToBlockData;
    }
  }

  /**
   * Подсчет количества функций в каждом блоке
   * @param {Object} functionToBlock - Маппинг функций на блоки
   * @returns {Object} Объект с количеством функций для каждого блока
   */
  function calculateBlockFunctionCounts(functionToBlock) {
    const counts = {};

    for (const [func, blockIds] of Object.entries(functionToBlock)) {
      // blockIds может быть числом или массивом чисел
      const blocks = Array.isArray(blockIds) ? blockIds : [blockIds];

      blocks.forEach(blockId => {
        if (!counts[blockId]) {
          counts[blockId] = 0;
        }
        counts[blockId]++;
      });
    }

    console.log('[FuncCoverUtils] Количество функций по блокам:', counts);
    return counts;
  }

  /**
   * Получение количества функций в блоке
   * @param {number} blockId - ID блока
   * @returns {Promise<number>} Количество функций в блоке
   */
  async function getFunctionCountInBlock(blockId) {
    if (!blockFunctionCounts) {
      const ftb = await loadFunctionToBlockData();
      blockFunctionCounts = calculateBlockFunctionCounts(ftb);
    }

    return blockFunctionCounts[blockId] || 0;
  }

  /**
   * Получение всех блоков, к которым относится функция
   * @param {string} functionName - Название функции
   * @returns {Promise<number[]>} Массив ID блоков
   */
  async function getBlocksForFunction(functionName) {
    const ftb = await loadFunctionToBlockData();
    const blockIds = ftb[functionName];

    if (!blockIds) {
      return [];
    }

    return Array.isArray(blockIds) ? blockIds : [blockIds];
  }

  /**
   * Расчет покрытия функций (funcCover) на основе процентного покрытия блока
   *
   * Логика для одного блока:
   * - Процент покрытия = (покрытые функции / всего функций в блоке)
   * - funcCover = ceil(процент * 3), но минимум 1 если есть хотя бы одна функция
   *
   * Логика для нескольких блоков:
   * - Суммируем все функции во всех блоках технологии
   * - Процент покрытия = (покрытые функции / сумма всех функций)
   * - funcCover = ceil(процент * 3), но минимум 1 если есть хотя бы одна функция
   *
   * @param {string[]} coveredFunctions - Массив покрытых функций
   * @param {number[]} blockIds - Массив ID блоков, к которым относится технология
   * @returns {Promise<number>} Значение funcCover (0-3)
   */
  async function calculateFuncCover(coveredFunctions, blockIds) {
    // Проверка входных данных
    if (!Array.isArray(coveredFunctions) || coveredFunctions.length === 0) {
      return 0;
    }

    if (!Array.isArray(blockIds) || blockIds.length === 0) {
      // Если блоки не указаны, используем старую логику (абсолютное количество)
      console.warn('[FuncCoverUtils] Блоки не указаны, используем старую логику');
      return calculateFuncCoverLegacy(coveredFunctions.length);
    }

    // Загружаем данные если необходимо
    if (!blockFunctionCounts) {
      const ftb = await loadFunctionToBlockData();
      blockFunctionCounts = calculateBlockFunctionCounts(ftb);
    }

    // Подсчитываем общее количество функций во всех блоках технологии
    let totalFunctionsInBlocks = 0;
    const uniqueBlocks = [...new Set(blockIds)]; // Убираем дубликаты

    uniqueBlocks.forEach(blockId => {
      const count = blockFunctionCounts[blockId] || 0;
      totalFunctionsInBlocks += count;
      console.log(`[FuncCoverUtils] Блок ${blockId}: ${count} функций`);
    });

    if (totalFunctionsInBlocks === 0) {
      console.warn('[FuncCoverUtils] В указанных блоках нет функций');
      return 0;
    }

    // Количество покрытых функций
    const coveredCount = coveredFunctions.length;

    // Процент покрытия
    const coveragePercent = coveredCount / totalFunctionsInBlocks;

    // Преобразуем процент в оценку 0-3
    let funcCover;
    if (coveragePercent === 0) {
      funcCover = 0;
    } else if (coveragePercent >= 1.0) {
      // 100% покрытие = максимальная оценка
      funcCover = 3;
    } else {
      // Округляем вверх: любое покрытие даёт минимум 1
      funcCover = Math.ceil(coveragePercent * 3);
      // Гарантируем минимум 1, если есть хотя бы одна функция
      funcCover = Math.max(1, funcCover);
    }

    console.log(`[FuncCoverUtils] Расчет покрытия: ${coveredCount}/${totalFunctionsInBlocks} функций = ${(coveragePercent * 100).toFixed(1)}% = funcCover ${funcCover}`);

    return Math.min(3, Math.max(0, funcCover));
  }

  /**
   * Старая логика расчета funcCover (для обратной совместимости)
   * Используется когда блоки не указаны
   * @param {number} funcCount - Количество функций
   * @returns {number} Значение funcCover (0-3)
   */
  function calculateFuncCoverLegacy(funcCount) {
    if (funcCount === 0) return 0;
    if (funcCount === 1) return 1;
    if (funcCount >= 2 && funcCount <= 3) return 2;
    return 3; // 4+ функций
  }

  /**
   * Получение описания покрытия функций
   * @param {number} funcCover - Значение funcCover (0-3)
   * @returns {string} Текстовое описание
   */
  function getFuncCoverDescription(funcCover) {
    const coverValue = parseInt(funcCover);
    switch (coverValue) {
      case 0:
        return 'Не покрывает необходимые функции';
      case 1:
        return 'Низкое покрытие функций (до 33%)';
      case 2:
        return 'Среднее покрытие функций (33-67%)';
      case 3:
        return 'Высокое покрытие функций (67-100%)';
      default:
        return 'Не указано';
    }
  }

  /**
   * Инициализация модуля
   * Загружает данные при старте приложения
   */
  async function init() {
    console.log('[FuncCoverUtils] Инициализация');
    await loadFunctionToBlockData();
  }

  // Публичный API
  window.FuncCoverUtils = {
    init: init,
    loadFunctionToBlockData: loadFunctionToBlockData,
    getFunctionCountInBlock: getFunctionCountInBlock,
    getBlocksForFunction: getBlocksForFunction,
    calculateFuncCover: calculateFuncCover,
    calculateFuncCoverLegacy: calculateFuncCoverLegacy,
    getFuncCoverDescription: getFuncCoverDescription,
    // Для тестирования и отладки
    getBlockFunctionCounts: async () => {
      if (!blockFunctionCounts) {
        const ftb = await loadFunctionToBlockData();
        blockFunctionCounts = calculateBlockFunctionCounts(ftb);
      }
      return blockFunctionCounts;
    }
  };

  console.log('[FuncCoverUtils] Модуль загружен');

})(window);
