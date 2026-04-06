/**
 * Пример конфигурации математической модели радара РТП (P2 factor engine)
 *
 * Скопируйте файл в `radar-model-config.js` и настройте параметры под ваш контур.
 * Для обратной совместимости поддерживаются legacy-поля `weights`, `r_min`, `r_max`.
 */

(function() {
  'use strict';

  window.RadarModelConfig = {
    // Новый формат радиуса
    radius: {
      min: 5,
      max: 95
    },

    // Минимум валидных факторов для обычного позиционирования.
    // Если валидных факторов меньше, технология уходит в зону insufficient-data.
    minValidFactors: 3,

    // Новый формат factor registry
    factors: {
      techRead: {
        enabled: true,
        weight: 0.35,
        impact: 'positive',
        fallbackPolicy: 'none',
        scale: { min: 0, max: 3 }
      },
      organRead: {
        enabled: true,
        weight: 0.35,
        impact: 'positive',
        fallbackPolicy: 'none',
        scale: { min: 0, max: 3 }
      },
      funcCover: {
        enabled: true,
        weight: 0.20,
        impact: 'positive',
        fallbackPolicy: 'constant',
        fallbackValue: 0,
        scale: { min: 0, max: 3 }
      },
      trlStage: {
        enabled: true,
        weight: 0.10,
        impact: 'positive',
        fallbackPolicy: 'constant',
        fallbackValue: 1,
        scale: { min: 1, max: 3 }
      },

      // Пример отрицательных факторов (отключены по умолчанию)
      implementationCostPressure: {
        enabled: false,
        weight: 0.15,
        impact: 'negative', // Для "отрицательных" факторов используем impact, а не negative weight
        fallbackPolicy: 'none',
        scale: { min: 0, max: 10000000 } // Источник: tech.costProm
      },
      integrationRisk: {
        enabled: false,
        weight: 0.15,
        impact: 'negative',
        fallbackPolicy: 'none', // Источник: tech.risks / tech.integrationRisk
        scale: { min: 0, max: 3 }
      },
      integrationComplexity: {
        enabled: false,
        weight: 0.10,
        impact: 'negative',
        fallbackPolicy: 'none', // Источник: tech.complexity / tech.integrationComplexity
        scale: { min: 0, max: 3 }
      }
    },

    // Legacy-совместимость: можно оставить для старых сценариев.
    // Если в `factors.<id>.weight` задан вес, он имеет приоритет над `weights.<id>`.
    weights: {
      techRead: 0.35,
      organRead: 0.35,
      funcCover: 0.20,
      trlStage: 0.10
    },
    r_min: 5,
    r_max: 95,

    // Общие параметры prediction-pipeline для fallbackPolicy: 'predict'
    prediction: {
      method: 'knn', // 'knn' | 'regression'
      k: 5,
      minTrainingSize: 5
    },

    // Legacy bridge: если включить, techRead/organRead автоматически получат predict-fallback,
    // даже если у них в factors.* еще указан fallbackPolicy: 'none'.
    enableMissingDataPrediction: false,

    _metadata: {
      updated: '2026-03-11',
      version: '2.0-factor-engine',
      description: 'Конфигурация модели для P2'
    }
  };
})();
