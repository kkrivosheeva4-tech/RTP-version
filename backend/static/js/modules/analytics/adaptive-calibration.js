/**
 * Модуль адаптивной калибровки параметров модели
 * Автоматически адаптирует параметры (α, bias) под распределение данных
 */

import FactorEngine from '../radar/factor-engine.js';

'use strict';

  function getCalibrationRegistry(options = {}) {
    const modelConfig = options.modelConfig ||
      ((typeof window !== 'undefined' && window.RadarModelConfig) ? window.RadarModelConfig : {});
    return FactorEngine.buildFactorRegistry(modelConfig);
  }

  function getNumericFactorValue(tech, factorId) {
    if (!tech) return null;
    const direct = tech[factorId];
    const directN = Number(direct);
    if (direct !== undefined && direct !== null && !Number.isNaN(directN)) return directN;
    const extracted = FactorEngine.extractRawFactorValue(tech, factorId);
    const n = Number(extracted);
    return Number.isNaN(n) ? null : n;
  }

  /**
   * Анализ распределения факторов готовности
   * @param {Array} technologies - Массив технологий
   * @returns {Object} Статистика распределения
   */
  function analyzeDistribution(technologies, options = {}) {
    if (!technologies || technologies.length === 0) return null;

    const registry = getCalibrationRegistry(options);
    const factors = registry.map(f => f.id);
    const registryById = {};
    registry.forEach(f => {
      registryById[f.id] = f;
    });
    const stats = {};

    factors.forEach(factor => {
      const values = technologies
        .map(t => getNumericFactorValue(t, factor))
        .filter(v => v !== undefined && v !== null && !isNaN(Number(v)));

      if (values.length === 0) {
        stats[factor] = null;
        return;
      }

      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
      const stdDev = Math.sqrt(variance);

      // Нормализуем в диапазон [0, 1] на основе registry scale.
      const factorCfg = registryById[factor];
      const minValue = factorCfg && factorCfg.scale ? factorCfg.scale.min : (factor === 'trlStage' ? 1 : 0);
      const maxValue = factorCfg && factorCfg.scale ? factorCfg.scale.max : 3;
      const normalizedMean = (mean - minValue) / (maxValue - minValue);
      const normalizedStdDev = stdDev / (maxValue - minValue);

      stats[factor] = {
        mean: mean,
        stdDev: stdDev,
        normalizedMean: normalizedMean,
        normalizedStdDev: normalizedStdDev,
        min: Math.min(...values),
        max: Math.max(...values),
        count: values.length
      };
    });

    return stats;
  }

  /**
   * Автоматическая настройка параметра α (чувствительность логистической функции)
   * @param {Object} distributionStats - Статистика распределения
   * @returns {number} Оптимальное значение α
   */
  function calibrateAlpha(distributionStats) {
    if (!distributionStats) return 4; // Значение по умолчанию

    // Вычисляем среднюю нормализованную вариативность
    const factors = Object.keys(distributionStats);
    let totalStdDev = 0;
    let count = 0;

    factors.forEach(factor => {
      if (distributionStats[factor]) {
        totalStdDev += distributionStats[factor].normalizedStdDev;
        count++;
      }
    });

    if (count === 0) return 4;

    const avgStdDev = totalStdDev / count;

    // Адаптируем α на основе вариативности
    // Высокая вариативность → меньший α (более плавная функция)
    // Низкая вариативность → больший α (более резкая функция)
    let alpha = 4;

    if (avgStdDev > 0.3) {
      // Высокая вариативность - делаем функцию более плавной
      alpha = 3;
    } else if (avgStdDev < 0.15) {
      // Низкая вариативность - делаем функцию более резкой
      alpha = 5;
    } else {
      // Средняя вариативность - стандартное значение
      alpha = 4;
    }

    return alpha;
  }

  /**
   * Автоматическая настройка параметра bias (сдвиг)
   * @param {Object} distributionStats - Статистика распределения
   * @param {Object} targetDistribution - Целевое распределение по зонам
   * @returns {number} Оптимальное значение bias
   */
  function calibrateBias(distributionStats, targetDistribution = { center: 0.2, middle: 0.5, edge: 0.3 }) {
    if (!distributionStats) return -0.6; // Значение по умолчанию

    // Вычисляем среднюю нормализованную готовность
    const factors = Object.keys(distributionStats);
    let totalMean = 0;
    let count = 0;

    factors.forEach(factor => {
      if (distributionStats[factor]) {
        totalMean += distributionStats[factor].normalizedMean;
        count++;
      }
    });

    if (count === 0) return -0.6;

    const avgReadiness = totalMean / count;

    // Адаптируем bias на основе средней готовности
    // Высокая готовность → более отрицательный bias (технологии ближе к центру)
    // Низкая готовность → менее отрицательный bias (технологии дальше от центра)

    // Целевое среднее значение z_i для равномерного распределения
    const targetZ = 0; // При z_i = 0, p_i = 0.5, r_i = 50%

    // Вычисляем текущее среднее z_i (при bias = 0)
    const currentZ = avgReadiness - 0.5; // Примерная оценка

    // Корректируем bias для достижения целевого распределения
    let bias = -0.6;

    if (avgReadiness > 0.6) {
      // Высокая готовность - делаем bias более отрицательным
      bias = -0.7;
    } else if (avgReadiness < 0.4) {
      // Низкая готовность - делаем bias менее отрицательным
      bias = -0.5;
    } else {
      // Средняя готовность - стандартное значение
      bias = -0.6;
    }

    return bias;
  }

  /**
   * Полная адаптивная калибровка параметров модели
   * @param {Array} technologies - Массив технологий
   * @param {Object} options - Опции калибровки
   * @returns {Object} Оптимизированные параметры
   */
  function calibrateModel(technologies, options = {}) {
    if (!technologies || technologies.length < 10) {
      // Недостаточно данных для калибровки
      return {
        alpha: 4,
        bias: -0.6
      };
    }

    // Начало адаптивной калибровки

    // Анализируем распределение
    const distributionStats = analyzeDistribution(technologies, options);

    // Калибруем параметры
    const alpha = calibrateAlpha(distributionStats);
    const bias = calibrateBias(distributionStats, options.targetDistribution);

    // Калибровка завершена

    return {
      alpha: alpha,
      bias: bias,
      distributionStats: distributionStats
    };
  }

  /**
   * Применение откалиброванных параметров к модели
   * @param {Object} calibratedParams - Откалиброванные параметры
   */
  function applyCalibration(calibratedParams) {
    if (!calibratedParams) return;

    // Устанавливаем параметры через RadarModelConfig
    if (!window.RadarModelConfig) {
      window.RadarModelConfig = {};
    }

    if (calibratedParams.alpha !== undefined) {
      window.RadarModelConfig.alpha = calibratedParams.alpha;
    }

    if (calibratedParams.bias !== undefined) {
      window.RadarModelConfig.bias = calibratedParams.bias;
    }

    // Параметры применены к модели
  }

  const AdaptiveCalibration = {
    calibrateModel: calibrateModel,
    applyCalibration: applyCalibration,
    analyzeDistribution: analyzeDistribution,
    calibrateAlpha: calibrateAlpha,
    calibrateBias: calibrateBias
  };

  if (typeof window !== 'undefined') {
    window.AdaptiveCalibration = AdaptiveCalibration;
  }

  export default AdaptiveCalibration;
  export {
    calibrateModel,
    applyCalibration,
    analyzeDistribution,
    calibrateAlpha,
    calibrateBias
  };
