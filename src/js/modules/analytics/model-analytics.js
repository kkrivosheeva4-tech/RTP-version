/**
 * Модуль аналитики математической модели радара РТП
 *
 * Предоставляет инструменты для:
 * - Корреляционного анализа факторов готовности
 * - Метрик качества модели позиционирования
 * - Анализа чувствительности модели к изменению параметров
 *
 * ОБНОВЛЕНО (2026-01-29): Добавлен модуль аналитики для приоритета 3
 */

import FactorEngine from '../radar/factor-engine.js';

'use strict';

  function getAnalyticsRegistry() {
    const modelConfig = (typeof window !== 'undefined' && window.RadarModelConfig)
      ? window.RadarModelConfig
      : {};
    const registry = FactorEngine.buildFactorRegistry(modelConfig);
    return registry.length > 0 ? registry : FactorEngine.buildFactorRegistry({});
  }

  function getActiveFactorIds() {
    return getAnalyticsRegistry().map(f => f.id);
  }

  function initFactorAccumulator(factorIds) {
    const factors = {};
    factorIds.forEach(id => {
      factors[id] = [];
    });
    return factors;
  }

  function toNumericOrNull(value) {
    if (value === undefined || value === null || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function buildCorrelationMatrix(factors, factorIds) {
    const matrix = {};
    for (let i = 0; i < factorIds.length; i++) {
      for (let j = i + 1; j < factorIds.length; j++) {
        const a = factorIds[i];
        const b = factorIds[j];
        matrix[`${a}_${b}`] = calculateCorrelation(factors[a], factors[b]);
      }
    }
    return matrix;
  }

  function buildFactorStatistics(factors, factorIds) {
    const stats = {};
    factorIds.forEach(id => {
      const values = factors[id] || [];
      stats[id] = {
        count: values.length,
        mean: values.length > 0
          ? (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2)
          : 'N/A'
      };
    });
    return stats;
  }

  function createModelConfigWithWeights(baseModelConfig, weights) {
    const nextModelConfig = { ...(baseModelConfig || {}) };
    const nextFactors = { ...(nextModelConfig.factors || {}) };

    Object.entries(weights || {}).forEach(([factorId, weight]) => {
      nextFactors[factorId] = {
        ...(nextFactors[factorId] || {}),
        enabled: true,
        weight
      };
    });

    nextModelConfig.factors = nextFactors;
    nextModelConfig.weights = {
      ...(nextModelConfig.weights || {}),
      ...(weights || {})
    };

    return nextModelConfig;
  }

  /**
   * Вычисление коэффициента корреляции Пирсона между двумя массивами
   * @param {number[]} x - Первый массив значений
   * @param {number[]} y - Второй массив значений
   * @returns {number} Коэффициент корреляции (-1 до 1)
   */
  function calculateCorrelation(x, y) {
    if (!Array.isArray(x) || !Array.isArray(y) || x.length !== y.length || x.length === 0) {
      return null;
    }

    // Фильтруем пары, где оба значения валидны
    const validPairs = [];
    for (let i = 0; i < x.length; i++) {
      const xi = Number(x[i]);
      const yi = Number(y[i]);
      if (!isNaN(xi) && !isNaN(yi) && x[i] !== null && y[i] !== null) {
        validPairs.push({ x: xi, y: yi });
      }
    }

    if (validPairs.length < 2) {
      return null;
    }

    // Вычисляем средние значения
    const meanX = validPairs.reduce((sum, p) => sum + p.x, 0) / validPairs.length;
    const meanY = validPairs.reduce((sum, p) => sum + p.y, 0) / validPairs.length;

    // Вычисляем корреляцию
    let numerator = 0;
    let sumSqX = 0;
    let sumSqY = 0;

    validPairs.forEach(p => {
      const dx = p.x - meanX;
      const dy = p.y - meanY;
      numerator += dx * dy;
      sumSqX += dx * dx;
      sumSqY += dy * dy;
    });

    const denominator = Math.sqrt(sumSqX * sumSqY);
    if (denominator === 0) {
      return 0;
    }

    return numerator / denominator;
  }

  /**
   * Извлечение факторов готовности из технологии
   * @param {Object} tech - Объект технологии
   * @returns {Object} Объект с факторами готовности
   */
  function extractFactors(tech) {
    const activeFactorIds = getActiveFactorIds();
    if (!tech) {
      const empty = {};
      activeFactorIds.forEach(id => {
        empty[id] = null;
      });
      return empty;
    }

    // Извлекаем techRead и organRead из enterprises
    let techRead = null;
    let organRead = null;

    const enterprises = Array.isArray(tech.enterprises) ? tech.enterprises : [];
    if (enterprises.length > 0) {
      let sumTechRead = 0;
      let sumOrganRead = 0;
      let countTechRead = 0;
      let countOrganRead = 0;

      enterprises.forEach(ent => {
        if (ent && typeof ent === 'object') {
          const techReadValue = ent.technologicalReadiness;
          const organReadValue = ent.organizationalReadiness;

          if (techReadValue !== undefined && techReadValue !== null && !isNaN(Number(techReadValue))) {
            sumTechRead += Number(techReadValue);
            countTechRead++;
          }

          if (organReadValue !== undefined && organReadValue !== null && !isNaN(Number(organReadValue))) {
            sumOrganRead += Number(organReadValue);
            countOrganRead++;
          }
        }
      });

      if (countTechRead > 0) {
        techRead = sumTechRead / countTechRead;
      }
      if (countOrganRead > 0) {
        organRead = sumOrganRead / countOrganRead;
      }
    } else {
      // Fallback на общие значения
      if (tech.techRead !== undefined && tech.techRead !== null && !isNaN(Number(tech.techRead))) {
        techRead = Number(tech.techRead);
      }
      if (tech.organRead !== undefined && tech.organRead !== null && !isNaN(Number(tech.organRead))) {
        organRead = Number(tech.organRead);
      }
    }

    // Извлекаем funcCover
    let funcCover = null;
    if (tech.funcCover !== undefined && tech.funcCover !== null && !isNaN(Number(tech.funcCover))) {
      funcCover = Number(tech.funcCover);
    } else if (Array.isArray(tech.functionCoverage) && tech.functionCoverage.length > 0) {
      // Используем упрощенный расчет
      const funcCount = tech.functionCoverage.length;
      if (funcCount === 1) {
        funcCover = 1;
      } else if (funcCount >= 2 && funcCount <= 3) {
        funcCover = 2;
      } else if (funcCount >= 4) {
        funcCover = 3;
      }
    }

    // Извлекаем trlStage
    let trlStage = null;
    if (tech.trlStage !== undefined && tech.trlStage !== null && !isNaN(Number(tech.trlStage))) {
      trlStage = Number(tech.trlStage);
    }

    const baseFactors = {
      techRead: techRead,
      organRead: organRead,
      funcCover: funcCover,
      trlStage: trlStage
    };

    // Дополнительные факторы берем из factor engine (слой P2.3).
    activeFactorIds.forEach(id => {
      if (baseFactors[id] !== undefined) return;
      baseFactors[id] = toNumericOrNull(FactorEngine.extractRawFactorValue(tech, id));
    });

    return baseFactors;
  }

  /**
   * Корреляционный анализ факторов готовности
   *
   * @param {Array} technologies - Массив технологий для анализа
   * @returns {Object} Объект с матрицей корреляций и интерпретацией
   */
  function analyzeFactorCorrelations(technologies) {
    if (!Array.isArray(technologies) || technologies.length === 0) {
      return {
        error: 'Не предоставлены технологии для анализа',
        correlations: null,
        interpretation: null
      };
    }

    const factorIds = getActiveFactorIds();
    const factors = initFactorAccumulator(factorIds);

    technologies.forEach(tech => {
      const extracted = extractFactors(tech);
      factorIds.forEach(id => {
        if (extracted[id] !== null && extracted[id] !== undefined) {
          factors[id].push(extracted[id]);
        }
      });
    });

    const correlationMatrix = buildCorrelationMatrix(factors, factorIds);

    // Интерпретация корреляций
    const interpretation = [];
    const highCorrelationThreshold = 0.7;
    const moderateCorrelationThreshold = 0.5;

    Object.entries(correlationMatrix).forEach(([pair, corr]) => {
      if (corr === null) return;

      const [factor1, factor2] = pair.split('_');
      const absCorr = Math.abs(corr);

      if (absCorr >= highCorrelationThreshold) {
        interpretation.push({
          pair: `${factor1} ↔ ${factor2}`,
          correlation: corr,
          level: 'высокая',
          warning: true,
          message: `Высокая корреляция (${corr.toFixed(3)}) может указывать на мультиколлинеарность. Рекомендуется пересмотреть веса факторов.`
        });
      } else if (absCorr >= moderateCorrelationThreshold) {
        interpretation.push({
          pair: `${factor1} ↔ ${factor2}`,
          correlation: corr,
          level: 'умеренная',
          warning: false,
          message: `Умеренная корреляция (${corr.toFixed(3)}). Стоит учитывать при интерпретации результатов.`
        });
      }
    });

    return {
      correlations: correlationMatrix,
      interpretation: interpretation,
      factorCounts: Object.fromEntries(factorIds.map(id => [id, factors[id].length])),
      statistics: {
        totalTechnologies: technologies.length,
        technologiesWithAllFactors: technologies.filter(tech => {
          const f = extractFactors(tech);
          return factorIds.every(id => f[id] !== null && f[id] !== undefined);
        }).length
      }
    };
  }

  /**
   * Метрики качества модели позиционирования
   *
   * @param {Array} technologies - Массив технологий для анализа
   * @returns {Object} Объект с метриками качества
   */
  function calculateQualityMetrics(technologies) {
    if (!Array.isArray(technologies) || technologies.length === 0) {
      return {
        error: 'Не предоставлены технологии для анализа',
        metrics: null
      };
    }

    // Вычисляем позиции для всех технологий
    const positions = [];
    const radii = [];
    const factorIds = getActiveFactorIds();
    const factors = initFactorAccumulator(factorIds);

    technologies.forEach(tech => {
      if (!tech || !window.Positioning || typeof window.Positioning.calculateRadarPosition !== 'function') {
        return;
      }

      const pos = window.Positioning.calculateRadarPosition(tech);
      if (pos && typeof pos.radius === 'number') {
        positions.push({ tech: tech, position: pos });
        radii.push(pos.radius);

        // Извлекаем факторы
        const f = extractFactors(tech);
        factorIds.forEach(id => {
          if (f[id] !== null && f[id] !== undefined) {
            factors[id].push(f[id]);
          }
        });
      }
    });

    if (radii.length === 0) {
      return {
        error: 'Не удалось вычислить позиции для технологий',
        metrics: null
      };
    }

    // Статистика распределения радиусов
    const sortedRadii = [...radii].sort((a, b) => a - b);
    const meanRadius = radii.reduce((sum, r) => sum + r, 0) / radii.length;
    const medianRadius = sortedRadii[Math.floor(sortedRadii.length / 2)];
    const stdDev = Math.sqrt(
      radii.reduce((sum, r) => sum + Math.pow(r - meanRadius, 2), 0) / radii.length
    );

    // Распределение по зонам
    const zones = {
      center: radii.filter(r => r < 30).length,      // 0-30% - близко к центру
      middle: radii.filter(r => r >= 30 && r < 70).length, // 30-70% - среднее положение
      edge: radii.filter(r => r >= 70).length          // 70-100% - у края
    };

    // Проверка на наложения (используем данные из renderData, если доступны)
    let overlapCount = 0;
    let minDistance = Infinity;
    const CENTER_X = window.CENTER_X || 500;
    const CENTER_Y = window.CENTER_Y || 500;

    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const posA = positions[i].position;
        const posB = positions[j].position;

        if (posA && posB && posA.theta !== undefined && posB.theta !== undefined) {
          // Преобразуем в декартовы координаты для проверки расстояния
          if (window.polarToCartesian) {
            const cartA = window.polarToCartesian(CENTER_X, CENTER_Y,
              (posA.radius / 100) * 390 + 30, posA.theta);
            const cartB = window.polarToCartesian(CENTER_X, CENTER_Y,
              (posB.radius / 100) * 390 + 30, posB.theta);

            const dx = cartB.x - cartA.x;
            const dy = cartB.y - cartA.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            minDistance = Math.min(minDistance, distance);

            // Считаем наложением, если расстояние меньше 28px (MIN_BLIP_DISTANCE)
            if (distance < 28) {
              overlapCount++;
            }
          }
        }
      }
    }

    // Равномерность распределения (коэффициент вариации)
    const coefficientOfVariation = stdDev / meanRadius;

    // Покрытие диапазона (насколько хорошо используется весь диапазон радиусов)
    const rangeCoverage = (Math.max(...radii) - Math.min(...radii)) / 100;

    return {
      metrics: {
        // Статистика распределения
        distribution: {
          mean: meanRadius,
          median: medianRadius,
          stdDev: stdDev,
          min: Math.min(...radii),
          max: Math.max(...radii),
          coefficientOfVariation: coefficientOfVariation
        },
        // Распределение по зонам
        zones: {
          center: zones.center,
          middle: zones.middle,
          edge: zones.edge,
          centerPercent: (zones.center / radii.length * 100).toFixed(1),
          middlePercent: (zones.middle / radii.length * 100).toFixed(1),
          edgePercent: (zones.edge / radii.length * 100).toFixed(1)
        },
        // Качество разведения
        layout: {
          totalTechnologies: positions.length,
          potentialOverlaps: overlapCount,
          minDistance: minDistance !== Infinity ? minDistance.toFixed(2) : 'N/A',
          rangeCoverage: rangeCoverage
        },
        factors: buildFactorStatistics(factors, factorIds)
      },
      quality: {
        // Оценка качества (0-1, где 1 - отлично)
        score: calculateQualityScore({
          coefficientOfVariation,
          rangeCoverage,
          overlapCount,
          totalTechnologies: positions.length
        }),
        recommendations: generateRecommendations({
          coefficientOfVariation,
          rangeCoverage,
          overlapCount,
          zones
        })
      }
    };
  }

  /**
   * Вычисление общей оценки качества модели (0-1)
   */
  function calculateQualityScore(params) {
    const { coefficientOfVariation, rangeCoverage, overlapCount, totalTechnologies } = params;

    // Нормализуем метрики
    // Коэффициент вариации: чем меньше, тем лучше (идеально < 0.5)
    const cvScore = Math.max(0, 1 - coefficientOfVariation / 0.5);

    // Покрытие диапазона: чем больше, тем лучше (идеально > 0.8)
    const rangeScore = Math.min(1, rangeCoverage / 0.8);

    // Наложения: чем меньше, тем лучше
    const overlapScore = Math.max(0, 1 - (overlapCount / Math.max(1, totalTechnologies * 0.1)));

    // Взвешенная сумма
    const score = (cvScore * 0.3 + rangeScore * 0.4 + overlapScore * 0.3);
    return Math.max(0, Math.min(1, score));
  }

  /**
   * Генерация рекомендаций по улучшению модели
   */
  function generateRecommendations(params) {
    const { coefficientOfVariation, rangeCoverage, overlapCount, zones } = params;
    const recommendations = [];

    if (coefficientOfVariation > 0.7) {
      recommendations.push({
        type: 'warning',
        message: 'Высокая вариативность распределения радиусов. Рассмотрите корректировку bias или весов факторов.'
      });
    }

    if (rangeCoverage < 0.5) {
      recommendations.push({
        type: 'info',
        message: 'Недостаточное использование диапазона радиусов. Технологии группируются в узком диапазоне.'
      });
    }

    if (overlapCount > 0) {
      recommendations.push({
        type: 'warning',
        message: `Обнаружено ${overlapCount} потенциальных наложений. Проверьте работу алгоритма разведения.`
      });
    }

    if (zones.center === 0 && zones.middle === 0) {
      recommendations.push({
        type: 'warning',
        message: 'Все технологии находятся у края радара. Модель может быть слишком строгой. Рассмотрите уменьшение bias.'
      });
    }

    if (zones.edge === 0) {
      recommendations.push({
        type: 'info',
        message: 'Все технологии находятся близко к центру. Модель может быть слишком мягкой. Рассмотрите увеличение bias.'
      });
    }

    return recommendations;
  }

  /**
   * Анализ чувствительности модели к изменению параметров
   *
   * @param {Array} technologies - Массив технологий для анализа
   * @param {Object} options - Опции анализа
   * @returns {Object} Результаты анализа чувствительности
   */
  function analyzeSensitivity(technologies, options = {}) {
    if (!Array.isArray(technologies) || technologies.length === 0) {
      return {
        error: 'Не предоставлены технологии для анализа',
        results: null
      };
    }

    const {
      weightVariations = [0.1, 0.2, 0.3], // Вариации весов (±10%, ±20%, ±30%)
      biasVariations = [0.1, 0.2, 0.3],    // Вариации bias (±0.1, ±0.2, ±0.3)
      alphaVariations = [1, 2, 3]           // Вариации ALPHA (±1, ±2, ±3)
    } = options;

    const baseModelConfig = (typeof window !== 'undefined' && window.RadarModelConfig)
      ? window.RadarModelConfig
      : {};
    const registry = getAnalyticsRegistry();
    const baseWeights = {};
    registry.forEach(f => {
      baseWeights[f.id] = f.weight;
    });
    if (Object.keys(baseWeights).length === 0) {
      return {
        error: 'Не удалось определить активные факторы модели',
        results: null
      };
    }
    const baseBias = -0.6;
    const baseAlpha = 4;

    const results = {
      weightSensitivity: {},
      biasSensitivity: {},
      alphaSensitivity: {}
    };

    // Вычисляем базовый средний радиус один раз
    const baseAvgRadius = calculateAverageRadius(
      technologies,
      createModelConfigWithWeights(baseModelConfig, baseWeights)
    );

    // Анализ чувствительности к весам
    Object.keys(baseWeights).forEach(factor => {
      results.weightSensitivity[factor] = [];

      weightVariations.forEach(variation => {
        // Создаем копию весов с изменением одного фактора
        const testWeights = { ...baseWeights };
        const newWeight = Math.max(0.01, Math.min(0.99, baseWeights[factor] + variation));
        testWeights[factor] = newWeight;

        // Нормализуем остальные веса
        const otherFactors = Object.keys(baseWeights).filter(f => f !== factor);
        const otherSum = otherFactors.reduce((sum, f) => sum + baseWeights[f], 0);
        const targetSum = 1.0 - newWeight;
        if (targetSum > 0 && otherSum > 0) {
          const normalizationFactor = targetSum / otherSum;
          otherFactors.forEach(f => {
            testWeights[f] = baseWeights[f] * normalizationFactor;
          });
        }

        // Вычисляем средний радиус для тестовых весов
        const testConfig = createModelConfigWithWeights(baseModelConfig, testWeights);

        const avgRadius = calculateAverageRadius(technologies, testConfig);

        results.weightSensitivity[factor].push({
          variation: variation,
          weight: testWeights[factor],
          avgRadius: avgRadius !== null ? avgRadius : 0,
          change: avgRadius !== null && baseAvgRadius !== null ? avgRadius - baseAvgRadius : 0
        });
      });
    });

    // Анализ чувствительности к bias
    biasVariations.forEach(variation => {
      const testBias = baseBias + variation;
      const avgRadius = calculateAverageRadius(
        technologies,
        createModelConfigWithWeights(baseModelConfig, baseWeights)
      );

      results.biasSensitivity.push({
        bias: testBias,
        avgRadius: avgRadius !== null ? avgRadius : 0,
        change: avgRadius !== null && baseAvgRadius !== null ? avgRadius - baseAvgRadius : 0
      });
    });

    // Анализ чувствительности к ALPHA
    alphaVariations.forEach(variation => {
      const testAlpha = Math.max(0.1, baseAlpha + variation);
      const avgRadius = calculateAverageRadius(
        technologies,
        createModelConfigWithWeights(baseModelConfig, baseWeights)
      );

      results.alphaSensitivity.push({
        alpha: testAlpha,
        avgRadius: avgRadius !== null ? avgRadius : 0,
        change: avgRadius !== null && baseAvgRadius !== null ? avgRadius - baseAvgRadius : 0
      });
    });

    return results;
  }

  /**
   * Вычисление среднего радиуса для заданной конфигурации
   */
  function calculateAverageRadius(technologies, config) {
    // Временно сохраняем текущую конфигурацию
    const originalConfig = window.RadarModelConfig ? { ...window.RadarModelConfig } : null;

    // Устанавливаем тестовую конфигурацию
    window.RadarModelConfig = config || {};

    // Вычисляем радиусы
    const radii = [];
    technologies.forEach(tech => {
      if (tech && window.Positioning && typeof window.Positioning.calculateRadarPosition === 'function') {
        try {
          const pos = window.Positioning.calculateRadarPosition(tech);
          if (pos && typeof pos.radius === 'number' && !isNaN(pos.radius)) {
            radii.push(pos.radius);
          }
        } catch (e) {
          // Ошибка при вычислении позиции для технологии
        }
      }
    });

    // Восстанавливаем оригинальную конфигурацию
    if (originalConfig) {
      window.RadarModelConfig = originalConfig;
    } else {
      delete window.RadarModelConfig;
    }

    if (radii.length === 0) {
      return null;
    }

    return radii.reduce((sum, r) => sum + r, 0) / radii.length;
  }

  /**
   * Полный анализ модели (корреляции + метрики качества + чувствительность)
   *
   * @param {Array} technologies - Массив технологий для анализа
   * @param {Object} options - Опции анализа
   * @returns {Object} Полный отчет об анализе
   */
  function performFullAnalysis(technologies, options = {}) {
    // Начало полного анализа модели

    const correlations = analyzeFactorCorrelations(technologies);
    const qualityMetrics = calculateQualityMetrics(technologies);
    const sensitivity = analyzeSensitivity(technologies, options);

    const report = {
      timestamp: new Date().toISOString(),
      correlations: correlations,
      qualityMetrics: qualityMetrics,
      sensitivity: sensitivity,
      summary: {
        totalTechnologies: technologies.length,
        hasHighCorrelations: correlations.interpretation &&
          correlations.interpretation.some(i => i.warning),
        qualityScore: qualityMetrics.quality ? qualityMetrics.quality.score : null,
        recommendations: qualityMetrics.quality ? qualityMetrics.quality.recommendations : []
      }
    };

    // Анализ завершен
    return report;
  }

  const ModelAnalytics = {
    analyzeFactorCorrelations,
    calculateQualityMetrics,
    analyzeSensitivity,
    performFullAnalysis,
    extractFactors,
    calculateCorrelation
  };

  if (typeof window !== 'undefined') {
    window.ModelAnalytics = ModelAnalytics;
  }

  export default ModelAnalytics;
  export {
    analyzeFactorCorrelations,
    calculateQualityMetrics,
    analyzeSensitivity,
    performFullAnalysis,
    extractFactors,
    calculateCorrelation
  };
