import {
  buildFactorRegistry,
  calculateReadinessIndex,
  extractRawFactorValue,
  resolveRadiusConfig,
  getModelSignature
} from './factor-engine.js';

describe('factor-engine', () => {
  test('buildFactorRegistry возвращает baseline-реестр из 4 факторов', () => {
    const registry = buildFactorRegistry({});
    expect(registry.map(f => f.id)).toEqual(['techRead', 'organRead', 'funcCover', 'trlStage']);
    expect(registry.find(f => f.id === 'techRead').weight).toBeCloseTo(0.35);
    expect(registry.find(f => f.id === 'trlStage').scale).toEqual({ min: 1, max: 3 });
  });

  test('legacy weights override применяется', () => {
    const registry = buildFactorRegistry({
      weights: {
        techRead: 0.5,
        organRead: 0.25,
        funcCover: 0.15,
        trlStage: 0.10
      }
    });
    expect(registry.find(f => f.id === 'techRead').weight).toBeCloseTo(0.5);
    expect(registry.find(f => f.id === 'organRead').weight).toBeCloseTo(0.25);
  });

  test('negative weights не поддерживаются и clampятся к 0, используем negative impact', () => {
    const registry = buildFactorRegistry({
      factors: {
        techRead: {
          weight: -0.5,
          impact: 'negative'
        }
      }
    });

    const factor = registry.find(f => f.id === 'techRead');
    expect(factor.weight).toBe(0);
    expect(factor.impact).toBe('negative');
  });

  test('resolveRadiusConfig поддерживает новый и legacy формат', () => {
    expect(resolveRadiusConfig({ radius: { min: 10, max: 80 } })).toEqual({ min: 10, max: 80 });
    expect(resolveRadiusConfig({ r_min: 7, r_max: 90 })).toEqual({ min: 7, max: 90 });
  });

  test('calculateReadinessIndex: baseline max значения дают z ~ 1', () => {
    const result = calculateReadinessIndex({
      rawFactors: {
        techRead: 3,
        organRead: 3,
        funcCover: 3,
        trlStage: 3
      },
      availability: {
        techRead: true,
        organRead: true,
        funcCover: true,
        trlStage: true
      }
    });

    expect(result.insufficientData).toBe(false);
    expect(result.z).toBeCloseTo(1, 5);
  });

  test('совместимость с legacy линейной формулой для baseline факторов', () => {
    const raw = {
      techRead: 2,
      organRead: 1,
      funcCover: 3,
      trlStage: 2
    };

    const legacyZ =
      (0.35 * (raw.techRead / 3)) +
      (0.35 * (raw.organRead / 3)) +
      (0.20 * (raw.funcCover / 3)) +
      (0.10 * ((raw.trlStage - 1) / 2));

    const result = calculateReadinessIndex({
      rawFactors: raw,
      availability: {
        techRead: true,
        organRead: true,
        funcCover: true,
        trlStage: true
      }
    });

    expect(result.insufficientData).toBe(false);
    expect(result.z).toBeCloseTo(legacyZ, 8);
  });

  test('calculateReadinessIndex: при двух валидных факторах данных недостаточно (baseline)', () => {
    const result = calculateReadinessIndex({
      rawFactors: {
        techRead: null,
        organRead: null,
        funcCover: 1,
        trlStage: 2
      },
      availability: {
        techRead: false,
        organRead: false,
        funcCover: true,
        trlStage: true
      }
    });

    expect(result.validFactorsCount).toBe(2);
    expect(result.insufficientData).toBe(true);
    expect(result.missingFactors).toEqual(expect.arrayContaining(['techRead', 'organRead']));
  });

  test('negative factor уменьшает z при росте риска', () => {
    const modelConfig = {
      minValidFactors: 1,
      factors: {
        techRead: { enabled: true, weight: 0.5, impact: 'positive', scale: { min: 0, max: 3 } },
        organRead: { enabled: false },
        funcCover: { enabled: false },
        trlStage: { enabled: false },
        integrationRisk: { enabled: true, weight: 0.5, impact: 'negative', scale: { min: 0, max: 3 } }
      }
    };

    const lowRisk = calculateReadinessIndex({
      modelConfig,
      rawFactors: { techRead: 3, integrationRisk: 0 },
      availability: { techRead: true, integrationRisk: true }
    });
    const highRisk = calculateReadinessIndex({
      modelConfig,
      rawFactors: { techRead: 3, integrationRisk: 3 },
      availability: { techRead: true, integrationRisk: true }
    });

    expect(lowRisk.z).toBeGreaterThan(highRisk.z);
    expect(highRisk.z).toBeCloseTo(0.5, 5);
  });

  test('fallbackPolicy predict использует общий predict callback', () => {
    const modelConfig = {
      minValidFactors: 1,
      factors: {
        techRead: {
          enabled: true,
          weight: 1,
          impact: 'positive',
          scale: { min: 0, max: 3 },
          fallbackPolicy: 'predict'
        },
        organRead: { enabled: false },
        funcCover: { enabled: false },
        trlStage: { enabled: false }
      }
    };

    const result = calculateReadinessIndex({
      modelConfig,
      rawFactors: {
        techRead: null
      },
      availability: {
        techRead: false
      },
      predictValue: (factor) => factor.id === 'techRead' ? 2 : null
    });

    expect(result.insufficientData).toBe(false);
    expect(result.missingFactors).toContain('techRead');
    expect(result.z).toBeCloseTo(2 / 3, 5);
  });

  test('новый negative factor implementationCostPressure извлекается из costProm', () => {
    const modelConfig = {
      minValidFactors: 1,
      factors: {
        techRead: { enabled: true, weight: 0.5, impact: 'positive', scale: { min: 0, max: 3 } },
        organRead: { enabled: false },
        funcCover: { enabled: false },
        trlStage: { enabled: false },
        implementationCostPressure: {
          enabled: true,
          weight: 0.5,
          impact: 'negative',
          scale: { min: 0, max: 10000000 }
        }
      }
    };

    const lowCost = calculateReadinessIndex({
      modelConfig,
      tech: { techRead: 3, costProm: 0 },
      availability: { techRead: true }
    });
    const highCost = calculateReadinessIndex({
      modelConfig,
      tech: { techRead: 3, costProm: 10000000 },
      availability: { techRead: true }
    });

    expect(lowCost.z).toBeGreaterThan(highCost.z);
    expect(extractRawFactorValue({ costProm: 1234 }, 'implementationCostPressure')).toBe(1234);
  });

  test('дополнительный фактор можно отключить без изменения ядра', () => {
    const tech = { techRead: 3, costProm: 9000000 };

    const withDisabledExtra = calculateReadinessIndex({
      modelConfig: {
        factors: {
          implementationCostPressure: { enabled: false }
        }
      },
      tech,
      availability: { techRead: true, organRead: true, funcCover: true, trlStage: true }
    });

    const baseline = calculateReadinessIndex({
      tech,
      availability: { techRead: true, organRead: true, funcCover: true, trlStage: true }
    });

    expect(withDisabledExtra.z).toBeCloseTo(baseline.z, 8);
  });

  test('getModelSignature меняется при изменении конфигурации', () => {
    const s1 = getModelSignature({});
    const s2 = getModelSignature({ factors: { techRead: { weight: 0.4 } } });
    expect(s1).not.toEqual(s2);
  });
});
