/**
 * Модуль улучшенной обработки отсутствующих данных
 * Использует методы машинного обучения (k-NN, регрессия) для предсказания отсутствующих значений
 */

import Logger from '../core/logger.js';
import FactorEngine from '../radar/factor-engine.js';

'use strict';

  function getPredictorContext(options = {}) {
    const modelConfig = options.modelConfig ||
      ((typeof window !== 'undefined' && window.RadarModelConfig) ? window.RadarModelConfig : {});
    const registry = FactorEngine.buildFactorRegistry(modelConfig);
    const factorMap = {};
    registry.forEach(f => {
      factorMap[f.id] = f;
    });
    const factors = options.factors && options.factors.length > 0
      ? options.factors
      : (registry.length > 0 ? registry.map(f => f.id) : ['techRead', 'organRead', 'funcCover', 'trlStage']);
    return { factors, factorMap };
  }

  function getFactorValue(tech, factor) {
    if (!tech) return null;
    const direct = tech[factor];
    const directNum = Number(direct);
    if (direct !== undefined && direct !== null && !Number.isNaN(directNum)) {
      return directNum;
    }
    const extracted = FactorEngine.extractRawFactorValue(tech, factor);
    const n = Number(extracted);
    return Number.isNaN(n) ? null : n;
  }

  function getFactorSpan(factor, factorMap = {}) {
    const cfg = factorMap[factor];
    if (cfg && cfg.scale && Number.isFinite(cfg.scale.max) && Number.isFinite(cfg.scale.min)) {
      const span = cfg.scale.max - cfg.scale.min;
      return span > 0 ? span : 1;
    }
    return factor === 'trlStage' ? 2 : 3;
  }

  function getFactorMin(factor, factorMap = {}) {
    const cfg = factorMap[factor];
    if (cfg && cfg.scale && Number.isFinite(cfg.scale.min)) {
      return cfg.scale.min;
    }
    return factor === 'trlStage' ? 1 : 0;
  }

  function normalizeFactorValue(value, factor, factorMap = {}) {
    const span = getFactorSpan(factor, factorMap);
    const min = getFactorMin(factor, factorMap);
    return (value - min) / span;
  }

  /**
   * Вычисление евклидова расстояния между двумя технологиями
   * @param {Object} tech1 - Первая технология
   * @param {Object} tech2 - Вторая технология
   * @returns {number} Расстояние
   */
  function euclideanDistance(tech1, tech2, options = {}) {
    const { factors, factorMap } = getPredictorContext(options);
    let distance = 0;
    let count = 0;

    factors.forEach(factor => {
      const val1 = getFactorValue(tech1, factor);
      const val2 = getFactorValue(tech2, factor);

      // Учитываем только если оба значения присутствуют
      if (val1 !== undefined && val1 !== null && val2 !== undefined && val2 !== null) {
        const n1 = normalizeFactorValue(val1, factor, factorMap);
        const n2 = normalizeFactorValue(val2, factor, factorMap);
        const diff = n1 - n2;
        distance += diff * diff;
        count++;
      }
    });

    return count > 0 ? Math.sqrt(distance / count) : Infinity;
  }

  /**
   * k-NN предсказание отсутствующего значения
   * @param {Object} tech - Технология с отсутствующими данными
   * @param {Array} trainingSet - Обучающий набор технологий
   * @param {string} missingFactor - Название отсутствующего фактора
   * @param {number} k - Количество ближайших соседей
   * @returns {number|null} Предсказанное значение или null
   */
  function kNNPrediction(tech, trainingSet, missingFactor, k = 5, options = {}) {
    if (!trainingSet || trainingSet.length === 0) return null;
    const { factors, factorMap } = getPredictorContext(options);

    // Фильтруем технологии, у которых есть значение для missingFactor
    const validTechs = trainingSet.filter(t =>
      getFactorValue(t, missingFactor) !== null
    );

    if (validTechs.length === 0) return null;

    // Вычисляем расстояния
    const distances = validTechs.map(t => ({
      tech: t,
      distance: euclideanDistance(tech, t, { factors, modelConfig: options.modelConfig })
    }));

    // Сортируем по расстоянию
    distances.sort((a, b) => a.distance - b.distance);

    // Берем k ближайших соседей
    const neighbors = distances.slice(0, Math.min(k, distances.length));

    // Взвешенное среднее (обратное расстояние как вес)
    let weightedSum = 0;
    let totalWeight = 0;

    neighbors.forEach(neighbor => {
      const weight = neighbor.distance > 0 ? 1 / (neighbor.distance + 0.001) : 1;
      weightedSum += getFactorValue(neighbor.tech, missingFactor) * weight;
      totalWeight += weight;
    });

    if (totalWeight === 0) return null;

    const prediction = weightedSum / totalWeight;

    // Ограничиваем диапазон
    const factorCfg = factorMap[missingFactor];
    const minValue = factorCfg && factorCfg.scale ? factorCfg.scale.min : (missingFactor === 'trlStage' ? 1 : 0);
    const maxValue = factorCfg && factorCfg.scale ? factorCfg.scale.max : 3;
    const rounded = missingFactor === 'trlStage' ? Math.round(prediction) : prediction;
    return Math.max(minValue, Math.min(maxValue, rounded));
  }

  /**
   * Линейная регрессия для предсказания отсутствующего значения
   * @param {Object} tech - Технология с отсутствующими данными
   * @param {Array} trainingSet - Обучающий набор
   * @param {string} missingFactor - Название отсутствующего фактора
   * @returns {number|null} Предсказанное значение или null
   */
  function linearRegressionPrediction(tech, trainingSet, missingFactor, options = {}) {
    if (!trainingSet || trainingSet.length === 0) return null;
    const { factors, factorMap } = getPredictorContext(options);
    const missingSpan = getFactorSpan(missingFactor, factorMap);
    const missingMin = getFactorMin(missingFactor, factorMap);

    // Фильтруем технологии с полными данными
    const validTechs = trainingSet.filter(t => {
      if (getFactorValue(t, missingFactor) === null) return false;
      return factors.every(f => f === missingFactor || getFactorValue(t, f) !== null);
    });

    if (validTechs.length < 3) return null; // Минимум 3 точки для регрессии

    // Собираем данные для регрессии
    const X = []; // Признаки (другие факторы)
    const y = []; // Целевая переменная

    const featureFactors = factors.filter(f => f !== missingFactor);

    validTechs.forEach(t => {
      const features = featureFactors.map(f => {
        const factorValue = getFactorValue(t, f);
        return normalizeFactorValue(factorValue, f, factorMap);
      });
      X.push([1, ...features]); // Добавляем bias
      y.push(normalizeFactorValue(getFactorValue(t, missingFactor), missingFactor, factorMap));
    });

    // Простая линейная регрессия (метод наименьших квадратов)
    // y = X * beta
    // beta = (X^T * X)^(-1) * X^T * y

    try {
      // Транспонируем X
      const XT = X[0].map((_, i) => X.map(row => row[i]));

      // X^T * X
      const XTX = XT.map(row =>
        X[0].map((_, i) =>
          row.reduce((sum, val, j) => sum + val * XT[i][j], 0)
        )
      );

      // X^T * y
      const XTy = XT.map(row =>
        row.reduce((sum, val, i) => sum + val * y[i], 0)
      );

      // Простая инверсия для 2x2 или 3x3 матрицы
      const det = XTX[0][0] * XTX[1][1] - XTX[0][1] * XTX[1][0];
      if (Math.abs(det) < 0.001) return null; // Вырожденная матрица

      const invXTX = [
        [XTX[1][1] / det, -XTX[0][1] / det],
        [-XTX[1][0] / det, XTX[0][0] / det]
      ];

      // beta = inv(XTX) * XTy
      const beta = invXTX.map(row =>
        row.reduce((sum, val, i) => sum + val * XTy[i], 0)
      );

      // Предсказание
      const features = featureFactors.map(f => {
        const value = getFactorValue(tech, f);
        if (value === null) return 0.5;
        return normalizeFactorValue(value, f, factorMap);
      });
      const prediction = beta[0] + beta.slice(1).reduce((sum, b, i) => sum + b * features[i], 0);

      // Денормализуем и ограничиваем
      const denormalized = (prediction * missingSpan) + missingMin;
      const factorCfg = factorMap[missingFactor];
      const minValue = factorCfg && factorCfg.scale ? factorCfg.scale.min : (missingFactor === 'trlStage' ? 1 : 0);
      const maxValue = factorCfg && factorCfg.scale ? factorCfg.scale.max : 3;
      const rounded = missingFactor === 'trlStage' ? Math.round(denormalized) : denormalized;
      return Math.max(minValue, Math.min(maxValue, rounded));
    } catch (e) {
      // Ошибка регрессии
      return null;
    }
  }

  /**
   * Предсказание отсутствующих значений для технологии
   * @param {Object} tech - Технология с отсутствующими данными
   * @param {Array} trainingSet - Обучающий набор (все технологии)
   * @param {Object} options - Опции предсказания
   * @returns {Object} Технология с заполненными значениями
   */
  function predictMissingValues(tech, trainingSet, options = {}) {
    if (!tech || !trainingSet) return tech;

    const method = options.method || 'knn'; // 'knn' или 'regression'
    const k = options.k || 5;

    const { factors } = getPredictorContext(options);
    const predicted = Object.assign({}, tech);

    factors.forEach(factor => {
      if (predicted[factor] === undefined || predicted[factor] === null) {
        let prediction = null;

        if (method === 'regression') {
          prediction = linearRegressionPrediction(predicted, trainingSet, factor, options);
        } else {
          prediction = kNNPrediction(predicted, trainingSet, factor, k, options);
        }

        if (prediction !== null) {
          predicted[factor] = prediction;
          if (Logger && typeof Logger.debug === 'function') {
            Logger.debug(`[MissingDataPredictor] Предсказано ${factor} = ${prediction.toFixed(2)} для технологии ${tech.id}`);
          }
        }
      }
    });

    return predicted;
  }

  /**
   * Пакетное предсказание для массива технологий
   * @param {Array} technologies - Массив технологий
   * @param {Object} options - Опции
   * @returns {Array} Массив технологий с заполненными значениями
   */
  function predictBatch(technologies, options = {}) {
    if (!technologies || technologies.length === 0) return technologies;

    return technologies.map(tech => predictMissingValues(tech, technologies, options));
  }

  const MissingDataPredictor = {
    predictMissingValues: predictMissingValues,
    predictBatch: predictBatch,
    kNNPrediction: kNNPrediction,
    linearRegressionPrediction: linearRegressionPrediction
  };

  if (typeof window !== 'undefined') {
    window.MissingDataPredictor = MissingDataPredictor;
  }

  export default MissingDataPredictor;
  export { predictMissingValues, predictBatch, kNNPrediction, linearRegressionPrediction };
