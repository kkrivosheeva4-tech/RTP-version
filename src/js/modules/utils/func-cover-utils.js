/**
 * Утилиты для расчета покрытия функций (funcCover)
 * ES module (шаг 7.5).
 */
  // Модуль инициализирован

  // Кэш для данных functionToBlock
  let functionToBlockData = null;
  let blockFunctionCounts = null;

  /**
   * Загрузка данных functionToBlock.
   * Данные загружаются через DataService из backend API.
   * Кэш только в памяти, не в localStorage.
   * @returns {Promise<Object>} Объект с маппингом функций на блоки
   */
  async function loadFunctionToBlockData() {
    if (functionToBlockData !== null) {
      return functionToBlockData;
    }

    try {
      const ds = typeof window !== 'undefined' ? window.DataService : null;
      if (ds && typeof ds.loadReference === 'function') {
        const data = await ds.loadReference('functionToBlock');
        functionToBlockData = data && typeof data === 'object' ? data : {};
        return functionToBlockData;
      }
    } catch (_) {}

    try {
      const response = await fetch('/static/data/ru/functionToBlock.json');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      functionToBlockData = await response.json();
      return functionToBlockData;
    } catch (error) {
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

    // Количество функций по блокам подсчитано
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
      // Ошибка загрузки весов из localStorage
    }

    // Пробуем загрузить с сервера
    // Используем более тихую обработку для опционального файла
    try {
      const response = await fetch('/static/data/ru/functionWeights.json', {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });

      // Проверяем статус ответа - 404 это нормально для опционального файла
      if (response.status === 404) {
        // Файл не найден - это нормально, используем пустой объект
        functionWeights = {};
        return functionWeights;
      }

      if (response.ok) {
        functionWeights = await response.json();
        // Сохраняем в localStorage
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(functionWeights));
        }
        return functionWeights;
      }
    } catch (e) {
      // Ошибка загрузки - файл опциональный, игнорируем
      // Сетевые ошибки не должны выводиться в консоль для опциональных файлов
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
      // Блоки не указаны, используем старую логику
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
      // Блок обработан
    });

    if (totalWeightedFunctions === 0) {
      // В указанных блоках нет функций
      return 0;
    }

    // ИСПРАВЛЕНО: Фильтруем покрытые функции - учитываем только те, которые относятся к блокам технологии
    const validCoveredFunctions = coveredFunctions.filter(funcName => {
      const funcBlockIds = functionToBlockMap[funcName];
      if (!funcBlockIds) {
        // Функция не найдена в маппинге - не учитываем
        return false;
      }
      const funcBlocks = Array.isArray(funcBlockIds) ? funcBlockIds : [funcBlockIds];
      // Проверяем, относится ли функция хотя бы к одному из блоков технологии
      return funcBlocks.some(blockId => uniqueBlocks.includes(blockId));
    });

    if (validCoveredFunctions.length === 0) {
      // Ни одна из покрытых функций не относится к блокам технологии
      return 0;
    }

    // ОБНОВЛЕНО: Взвешенная сумма покрытых функций (только валидных)
    let coveredWeightedSum = 0;
    if (useWeights && Object.keys(weights).length > 0) {
      validCoveredFunctions.forEach(funcName => {
        const weight = weights[funcName] || 1.0;
        coveredWeightedSum += weight;
      });
    } else {
      coveredWeightedSum = validCoveredFunctions.length;
    }

    // Процент покрытия (взвешенный)
    const coveragePercent = coveredWeightedSum / totalWeightedFunctions;

    // ОБНОВЛЕНО (2026-01-29): Используем общую функцию для преобразования
    const funcCover = convertCoveragePercentToFuncCover(coveragePercent);

    // ИСПРАВЛЕНО: Используем правильные переменные для лога
    const totalFunctionsInBlocks = totalWeightedFunctions;
    const coveredCount = validCoveredFunctions.length;
    // Расчет покрытия завершен

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
      // Данные блоков не загружены, используется legacy расчет
      return calculateFuncCoverLegacy(coveredFunctions.length);
    }

    // ОБНОВЛЕНО: Используем веса важности функций, если доступны
    const useWeights = options.useWeights !== false; // По умолчанию включено
    let weights = {};
    if (useWeights && functionWeights !== null) {
      weights = functionWeights;
    }

    // Используем in-memory кэш (functionToBlockData), не localStorage
    const functionToBlockMap = functionToBlockData || {};

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

    // ИСПРАВЛЕНО: Фильтруем покрытые функции - учитываем только те, которые относятся к блокам технологии
    const validCoveredFunctions = coveredFunctions.filter(funcName => {
      const funcBlockIds = functionToBlockMap[funcName];
      if (!funcBlockIds) {
        // Функция не найдена в маппинге - не учитываем
        return false;
      }
      const funcBlocks = Array.isArray(funcBlockIds) ? funcBlockIds : [funcBlockIds];
      // Проверяем, относится ли функция хотя бы к одному из блоков технологии
      return funcBlocks.some(blockId => uniqueBlocks.includes(blockId));
    });

    if (validCoveredFunctions.length === 0) {
      // Ни одна из покрытых функций не относится к блокам технологии
      return 0;
    }

    // ОБНОВЛЕНО: Взвешенная сумма покрытых функций (только валидных)
    let coveredWeightedSum = 0;
    if (useWeights && Object.keys(weights).length > 0) {
      validCoveredFunctions.forEach(funcName => {
        const weight = weights[funcName] || 1.0;
        coveredWeightedSum += weight;
      });
    } else {
      coveredWeightedSum = validCoveredFunctions.length;
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
    // Одноразовая очистка: удаляем старые ключи из localStorage (больше не используем)
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('rtp_functionToBlock_data');
        localStorage.removeItem('rtp_functionToBlock_version');
      }
    } catch (_) {}

    // Инициализация FuncCoverUtils
    const ftb = await loadFunctionToBlockData();
    if (!blockFunctionCounts) {
      blockFunctionCounts = calculateBlockFunctionCounts(ftb);
    }
    // Загружаем веса важности функций
    await loadFunctionWeights();
  }

  // Публичный API (экспорт в window для обратной совместимости)
  if (typeof window !== 'undefined') {
    window.FuncCoverUtils = {
      init: init,
      loadFunctionToBlockData: loadFunctionToBlockData,
      loadFunctionWeights: loadFunctionWeights,
      getFunctionCountInBlock: getFunctionCountInBlock,
      getBlocksForFunction: getBlocksForFunction,
      calculateFuncCover: calculateFuncCover,
      calculateFuncCoverLegacy: calculateFuncCoverLegacy,
      calculateFuncCoverSync: calculateFuncCoverSync,
      getFuncCoverDescription: getFuncCoverDescription,
      getBlockFunctionCounts: async () => {
        if (!blockFunctionCounts) {
          const ftb = await loadFunctionToBlockData();
          blockFunctionCounts = calculateBlockFunctionCounts(ftb);
        }
        return blockFunctionCounts;
      },
      _blockFunctionCounts: () => blockFunctionCounts
    };
  }
export {};
