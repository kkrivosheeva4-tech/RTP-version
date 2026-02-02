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
   * ОБНОВЛЕНО (2026-01-29): Добавлено кеширование в localStorage для офлайн-работы
   * @returns {Promise<Object>} Объект с маппингом функций на блоки
   */
  async function loadFunctionToBlockData() {
    if (functionToBlockData !== null) {
      return functionToBlockData;
    }

    // ОБНОВЛЕНО (2026-01-29): Пробуем загрузить из localStorage
    const STORAGE_KEY = 'rtp_functionToBlock_data';
    const STORAGE_VERSION_KEY = 'rtp_functionToBlock_version';
    const CURRENT_VERSION = '1.0'; // Версия данных для инвалидации кеша

    try {
      // Проверяем localStorage
      if (typeof localStorage !== 'undefined') {
        const cachedVersion = localStorage.getItem(STORAGE_VERSION_KEY);
        const cachedData = localStorage.getItem(STORAGE_KEY);

        if (cachedVersion === CURRENT_VERSION && cachedData) {
          try {
            functionToBlockData = JSON.parse(cachedData);
            console.log('[FuncCoverUtils] Данные functionToBlock загружены из localStorage');
            return functionToBlockData;
          } catch (e) {
            console.warn('[FuncCoverUtils] Ошибка парсинга данных из localStorage, загружаем с сервера');
          }
        }
      }
    } catch (e) {
      console.warn('[FuncCoverUtils] Ошибка доступа к localStorage:', e);
    }

    try {
      // Используем абсолютный путь от корня сайта
      const response = await fetch('/src/data/ru/functionToBlock.json');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      functionToBlockData = await response.json();
      console.log('[FuncCoverUtils] Данные functionToBlock загружены с сервера', functionToBlockData);

      // ОБНОВЛЕНО (2026-01-29): Сохраняем в localStorage для последующих загрузок
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(functionToBlockData));
          localStorage.setItem(STORAGE_VERSION_KEY, CURRENT_VERSION);
          console.log('[FuncCoverUtils] Данные functionToBlock сохранены в localStorage');
        }
      } catch (e) {
        console.warn('[FuncCoverUtils] Ошибка сохранения в localStorage:', e);
      }

      return functionToBlockData;
    } catch (error) {
      console.error('[FuncCoverUtils] Ошибка загрузки functionToBlock.json:', error);

      // ОБНОВЛЕНО (2026-01-29): Пробуем использовать устаревшие данные из localStorage
      if (typeof localStorage !== 'undefined') {
        const cachedData = localStorage.getItem(STORAGE_KEY);
        if (cachedData) {
          try {
            functionToBlockData = JSON.parse(cachedData);
            console.warn('[FuncCoverUtils] Используются устаревшие данные из localStorage');
            return functionToBlockData;
          } catch (e) {
            console.error('[FuncCoverUtils] Ошибка парсинга устаревших данных:', e);
          }
        }
      }

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
   * Загрузка весов важности функций
   * ОБНОВЛЕНО: Добавлена поддержка весов важности функций
   * @returns {Promise<Object>} Объект с весами функций {functionName: weight}
   */
  let functionWeights = null;
  async function loadFunctionWeights() {
    if (functionWeights !== null) {
      return functionWeights;
    }

    // Пробуем загрузить из localStorage
    const STORAGE_KEY = 'rtp_functionWeights';
    try {
      if (typeof localStorage !== 'undefined') {
        const cached = localStorage.getItem(STORAGE_KEY);
        if (cached) {
          functionWeights = JSON.parse(cached);
          return functionWeights;
        }
      }
    } catch (e) {
      console.warn('[FuncCoverUtils] Ошибка загрузки весов из localStorage:', e);
    }

    // Пробуем загрузить с сервера
    try {
      const response = await fetch('/src/data/ru/functionWeights.json');
      if (response.ok) {
        functionWeights = await response.json();
        // Сохраняем в localStorage
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(functionWeights));
        }
        return functionWeights;
      }
    } catch (e) {
      console.warn('[FuncCoverUtils] Файл functionWeights.json не найден, используются равные веса');
    }

    // По умолчанию все функции имеют одинаковый вес
    functionWeights = {};
    return functionWeights;
  }

  /**
   * Расчет покрытия функций (funcCover) на основе процентного покрытия блока
   * ОБНОВЛЕНО: Добавлен учет важности функций (взвешенное покрытие)
   *
   * Логика для одного блока:
   * - Процент покрытия = (взвешенная сумма покрытых функций / взвешенная сумма всех функций в блоке)
   * - funcCover = ceil(процент * 3), но минимум 1 если есть хотя бы одна функция
   *
   * Логика для нескольких блоков:
   * - Суммируем взвешенные функции во всех блоках технологии
   * - Процент покрытия = (взвешенная сумма покрытых функций / взвешенная сумма всех функций)
   * - funcCover = ceil(процент * 3), но минимум 1 если есть хотя бы одна функция
   *
   * @param {string[]} coveredFunctions - Массив покрытых функций
   * @param {number[]} blockIds - Массив ID блоков, к которым относится технология
   * @param {Object} options - Опции расчета {useWeights: boolean}
   * @returns {Promise<number>} Значение funcCover (0-3)
   */
  async function calculateFuncCover(coveredFunctions, blockIds, options = {}) {
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

    // ОБНОВЛЕНО: Загружаем веса важности функций, если включено
    const useWeights = options.useWeights !== false; // По умолчанию включено
    let weights = {};
    if (useWeights) {
      weights = await loadFunctionWeights();
    }

    // Подсчитываем взвешенную сумму всех функций во всех блоках технологии
    let totalWeightedFunctions = 0;
    const uniqueBlocks = [...new Set(blockIds)]; // Убираем дубликаты

    // Получаем маппинг функций на блоки для вычисления весов
    const ftb = await loadFunctionToBlockData();
    const functionToBlockMap = ftb || {};

    uniqueBlocks.forEach(blockId => {
      const count = blockFunctionCounts[blockId] || 0;

      // Вычисляем взвешенную сумму функций в блоке
      let blockWeight = 0;
      Object.entries(functionToBlockMap).forEach(([funcName, funcBlockIds]) => {
        const funcBlocks = Array.isArray(funcBlockIds) ? funcBlockIds : [funcBlockIds];
        if (funcBlocks.includes(blockId)) {
          const weight = weights[funcName] || 1.0; // По умолчанию вес = 1.0
          blockWeight += weight;
        }
      });

      // Если веса не используются или не найдены, используем простое количество
      totalWeightedFunctions += useWeights && Object.keys(weights).length > 0 ? blockWeight : count;
      console.log(`[FuncCoverUtils] Блок ${blockId}: ${count} функций, взвешенная сумма: ${useWeights && Object.keys(weights).length > 0 ? blockWeight.toFixed(2) : count}`);
    });

    if (totalWeightedFunctions === 0) {
      console.warn('[FuncCoverUtils] В указанных блоках нет функций');
      return 0;
    }

    // ОБНОВЛЕНО: Взвешенная сумма покрытых функций
    let coveredWeightedSum = 0;
    if (useWeights && Object.keys(weights).length > 0) {
      coveredFunctions.forEach(funcName => {
        const weight = weights[funcName] || 1.0;
        coveredWeightedSum += weight;
      });
    } else {
      coveredWeightedSum = coveredFunctions.length;
    }

    // Процент покрытия (взвешенный)
    const coveragePercent = coveredWeightedSum / totalWeightedFunctions;

    // ОБНОВЛЕНО (2026-01-29): Используем общую функцию для преобразования
    const funcCover = convertCoveragePercentToFuncCover(coveragePercent);

    console.log(`[FuncCoverUtils] Расчет покрытия: ${coveredCount}/${totalFunctionsInBlocks} функций = ${(coveragePercent * 100).toFixed(1)}% = funcCover ${funcCover}`);

    return funcCover;
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
   * Синхронный расчет funcCover с использованием предзагруженных данных
   * ОБНОВЛЕНО (2026-01-29): Добавлен синхронный метод для использования в позиционировании
   * ОБНОВЛЕНО: Добавлен учет важности функций
   *
   * @param {string[]} coveredFunctions - Массив покрытых функций
   * @param {number[]} blockIds - Массив ID блоков, к которым относится технология
   * @param {Object} options - Опции расчета {useWeights: boolean}
   * @returns {number} Значение funcCover (0-3)
   */
  function calculateFuncCoverSync(coveredFunctions, blockIds, options = {}) {
    // Проверка входных данных
    if (!Array.isArray(coveredFunctions) || coveredFunctions.length === 0) {
      return 0;
    }

    if (!Array.isArray(blockIds) || blockIds.length === 0) {
      // Если блоки не указаны, используем старую логику (абсолютное количество)
      return calculateFuncCoverLegacy(coveredFunctions.length);
    }

    // Используем предзагруженные данные, если они доступны
    if (!blockFunctionCounts) {
      // Данные не загружены, используем legacy расчет
      console.warn('[FuncCoverUtils] Данные блоков не загружены, используется legacy расчет');
      return calculateFuncCoverLegacy(coveredFunctions.length);
    }

    // ОБНОВЛЕНО: Используем веса важности функций, если доступны
    const useWeights = options.useWeights !== false; // По умолчанию включено
    let weights = {};
    if (useWeights && functionWeights !== null) {
      weights = functionWeights;
    }

    // Получаем маппинг функций на блоки (из кеша, если доступен)
    let functionToBlockMap = {};
    try {
      if (typeof localStorage !== 'undefined') {
        const cached = localStorage.getItem('rtp_functionToBlock_data');
        if (cached) {
          functionToBlockMap = JSON.parse(cached);
        }
      }
    } catch (e) {
      // Игнорируем ошибки
    }

    // Подсчитываем взвешенную сумму всех функций во всех блоках технологии
    let totalWeightedFunctions = 0;
    const uniqueBlocks = [...new Set(blockIds)]; // Убираем дубликаты

    uniqueBlocks.forEach(blockId => {
      const count = blockFunctionCounts[blockId] || 0;

      // Вычисляем взвешенную сумму функций в блоке
      let blockWeight = 0;
      if (useWeights && Object.keys(weights).length > 0 && Object.keys(functionToBlockMap).length > 0) {
        Object.entries(functionToBlockMap).forEach(([funcName, funcBlockIds]) => {
          const funcBlocks = Array.isArray(funcBlockIds) ? funcBlockIds : [funcBlockIds];
          if (funcBlocks.includes(blockId)) {
            const weight = weights[funcName] || 1.0;
            blockWeight += weight;
          }
        });
      }

      totalWeightedFunctions += useWeights && Object.keys(weights).length > 0 && blockWeight > 0 ? blockWeight : count;
    });

    if (totalWeightedFunctions === 0) {
      return 0;
    }

    // ОБНОВЛЕНО: Взвешенная сумма покрытых функций
    let coveredWeightedSum = 0;
    if (useWeights && Object.keys(weights).length > 0) {
      coveredFunctions.forEach(funcName => {
        const weight = weights[funcName] || 1.0;
        coveredWeightedSum += weight;
      });
    } else {
      coveredWeightedSum = coveredFunctions.length;
    }

    // Процент покрытия (взвешенный)
    const coveragePercent = coveredWeightedSum / totalWeightedFunctions;

    // ОБНОВЛЕНО (2026-01-29): Используем общую функцию для преобразования
    return convertCoveragePercentToFuncCover(coveragePercent);
  }

  /**
   * Преобразование процента покрытия в оценку funcCover (0-3)
   * ОБНОВЛЕНО (2026-01-29): Более плавное преобразование с плавными переходами
   * @param {number} coveragePercent - Процент покрытия (0-1)
   * @returns {number} Значение funcCover (0-3)
   */
  function convertCoveragePercentToFuncCover(coveragePercent) {
    // ОБНОВЛЕНО (2026-01-29): Более плавное преобразование процента покрытия в оценку 0-3
    // Используем непрерывную шкалу с плавными переходами вместо жестких порогов
    let funcCover;
    if (coveragePercent === 0) {
      funcCover = 0;
    } else if (coveragePercent >= 1.0) {
      // 100% покрытие = максимальная оценка
      funcCover = 3;
    } else {
      // Используем более плавное преобразование с учетом контекста
      // Вместо простого округления вверх, используем формулу с плавными переходами
      // Это позволяет лучше различать технологии с близким покрытием
      const rawValue = coveragePercent * 3;

      // Применяем плавное округление с учетом близости к границам
      // Если значение близко к границе категории (в пределах 5%), округляем к ней
      const threshold = 0.05; // 5% порог

      if (rawValue < 1 + threshold) {
        // Близко к 1, округляем к 1
        funcCover = 1;
      } else if (rawValue < 2 - threshold) {
        // Между 1 и 2, используем линейную интерполяцию
        funcCover = Math.round(rawValue);
      } else if (rawValue < 2 + threshold) {
        // Близко к 2, округляем к 2
        funcCover = 2;
      } else if (rawValue < 3 - threshold) {
        // Между 2 и 3, используем линейную интерполяцию
        funcCover = Math.round(rawValue);
      } else {
        // Близко к 3, округляем к 3
        funcCover = 3;
      }

      // Гарантируем минимум 1, если есть хотя бы одна функция
      funcCover = Math.max(1, funcCover);
    }

    return Math.min(3, Math.max(0, funcCover));
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
   * ОБНОВЛЕНО (2026-01-29): Инициализирует blockFunctionCounts для синхронного доступа
   * ОБНОВЛЕНО: Загружает веса важности функций
   */
  async function init() {
    console.log('[FuncCoverUtils] Инициализация');
    const ftb = await loadFunctionToBlockData();
    if (!blockFunctionCounts) {
      blockFunctionCounts = calculateBlockFunctionCounts(ftb);
    }
    // Загружаем веса важности функций
    await loadFunctionWeights();
  }

  // Публичный API
  window.FuncCoverUtils = {
    init: init,
    loadFunctionToBlockData: loadFunctionToBlockData,
    loadFunctionWeights: loadFunctionWeights, // ОБНОВЛЕНО: Публичный доступ к загрузке весов
    getFunctionCountInBlock: getFunctionCountInBlock,
    getBlocksForFunction: getBlocksForFunction,
    calculateFuncCover: calculateFuncCover,
    calculateFuncCoverLegacy: calculateFuncCoverLegacy,
    calculateFuncCoverSync: calculateFuncCoverSync, // ОБНОВЛЕНО (2026-01-29): Синхронный метод
    getFuncCoverDescription: getFuncCoverDescription,
    // Для тестирования и отладки
    getBlockFunctionCounts: async () => {
      if (!blockFunctionCounts) {
        const ftb = await loadFunctionToBlockData();
        blockFunctionCounts = calculateBlockFunctionCounts(ftb);
      }
      return blockFunctionCounts;
    },
    // ОБНОВЛЕНО (2026-01-29): Публичный доступ к кешу для проверки загрузки данных
    _blockFunctionCounts: () => blockFunctionCounts
  };

  console.log('[FuncCoverUtils] Модуль загружен');

})(window);
