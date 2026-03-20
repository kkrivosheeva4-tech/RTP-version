import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import {
  analyzeFactorCorrelations,
  calculateQualityMetrics
} from './model-analytics.js';

describe('model analytics regression', () => {
  beforeEach(() => {
    window.RadarModelConfig = {
      factors: {
        techRead: { enabled: true, weight: 0.5, impact: 'positive', scale: { min: 0, max: 3 } },
        organRead: { enabled: false },
        funcCover: { enabled: false },
        trlStage: { enabled: false },
        integrationRisk: { enabled: true, weight: 0.5, impact: 'negative', scale: { min: 0, max: 3 } }
      }
    };
  });

  afterEach(() => {
    delete window.RadarModelConfig;
    delete window.Positioning;
    delete window.polarToCartesian;
  });

  test('analyzeFactorCorrelations() использует dynamic registry и extra factors', () => {
    const result = analyzeFactorCorrelations([
      { id: 1, techRead: 0, integrationRisk: 3 },
      { id: 2, techRead: 1, integrationRisk: 2 },
      { id: 3, techRead: 2, integrationRisk: 1 },
      { id: 4, techRead: 3, integrationRisk: 0 }
    ]);

    expect(result.correlations.techRead_integrationRisk).toBeCloseTo(-1, 5);
    expect(result.factorCounts.techRead).toBe(4);
    expect(result.factorCounts.integrationRisk).toBe(4);
  });

  test('calculateQualityMetrics() возвращает устойчивые метрики распределения и факторов', () => {
    window.Positioning = {
      calculateRadarPosition: vi.fn((tech) => ({
        theta: tech.id * 30,
        radius: tech.mockRadius
      }))
    };
    window.polarToCartesian = (cx, cy, radius, theta) => {
      const angle = (theta * Math.PI) / 180;
      return {
        x: cx + radius * Math.cos(angle),
        y: cy + radius * Math.sin(angle)
      };
    };

    const result = calculateQualityMetrics([
      { id: 1, mockRadius: 20, techRead: 3, integrationRisk: 0 },
      { id: 2, mockRadius: 50, techRead: 2, integrationRisk: 1 },
      { id: 3, mockRadius: 80, techRead: 1, integrationRisk: 2 }
    ]);

    expect(result.metrics.distribution.min).toBe(20);
    expect(result.metrics.distribution.max).toBe(80);
    expect(result.metrics.zones.center).toBe(1);
    expect(result.metrics.zones.middle).toBe(1);
    expect(result.metrics.zones.edge).toBe(1);
    expect(Number(result.metrics.factors.techRead.mean)).toBeCloseTo(2, 5);
    expect(Number(result.metrics.factors.integrationRisk.mean)).toBeCloseTo(1, 5);
    expect(result.quality.score).toBeGreaterThanOrEqual(0);
    expect(result.quality.score).toBeLessThanOrEqual(1);
  });
});
