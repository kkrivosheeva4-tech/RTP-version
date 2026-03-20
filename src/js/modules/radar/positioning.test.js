import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import Positioning from './positioning.js';

function setupPositioningGlobals() {
  window.QUADRANTS = [{ id: 1, startAngle: 0 }];
  window.POSITION_ANGLE_PAD = 8;
  window.directionToQuadrant = { 'Dir A': 1 };
  window.StateManager = {
    get(key) {
      if (key === 'digitalDirections') {
        return [{ id: 1, name: 'Dir A' }];
      }
      if (key === 'enterprisesList') {
        return [];
      }
      return [];
    }
  };
  window.Filters = {
    getFilterValues() {
      return [];
    }
  };
  window.FuncCoverUtils = {
    calculateFuncCoverSync(coverage) {
      const count = Array.isArray(coverage) ? coverage.length : 0;
      if (count <= 0) return 0;
      if (count === 1) return 1;
      if (count <= 3) return 2;
      return 3;
    },
    calculateFuncCoverLegacy(count) {
      if (count <= 0) return 0;
      if (count === 1) return 1;
      if (count <= 3) return 2;
      return 3;
    }
  };
}

describe('positioning regression', () => {
  beforeEach(() => {
    localStorage.clear();
    setupPositioningGlobals();
    window.StateAccessors = {
      getTechnologies() {
        return [];
      }
    };
    delete window.MissingDataPredictor;
    delete window.RadarModelConfig;
    Positioning.clearPositionCache();
  });

  afterEach(() => {
    Positioning.clearPositionCache();
    delete window.MissingDataPredictor;
    delete window.RadarModelConfig;
  });

  test('calculateRadarPosition() сохраняет baseline parity для legacy weighted модели', () => {
    const tech = {
      id: 11,
      directions: ['Dir A'],
      techRead: 2,
      organRead: 1,
      funcCover: 3,
      trlStage: 2,
      enterprises: []
    };

    const legacyZ =
      (0.35 * (tech.techRead / 3)) +
      (0.35 * (tech.organRead / 3)) +
      (0.20 * (tech.funcCover / 3)) +
      (0.10 * ((tech.trlStage - 1) / 2));
    const expectedRadius = 5 + (95 - 5) * (1 - legacyZ);

    const pos = Positioning.calculateRadarPosition(tech);

    expect(pos.theta).toBeGreaterThan(0);
    expect(pos.radius).toBeCloseTo(expectedRadius, 5);
    expect(pos.insufficientData).toBe(false);
  });

  test('calculateRadarPosition() применяет predict fallback для небазового фактора из registry', () => {
    const predictor = vi.fn((tech, trainingSet, factorId) => {
      return factorId === 'integrationRisk' ? 3 : null;
    });

    window.RadarModelConfig = {
      radius: { min: 5, max: 95 },
      minValidFactors: 1,
      prediction: {
        method: 'knn',
        k: 3,
        minTrainingSize: 1
      },
      factors: {
        techRead: { enabled: false },
        organRead: { enabled: false },
        funcCover: { enabled: false },
        trlStage: { enabled: false },
        integrationRisk: {
          enabled: true,
          weight: 1,
          impact: 'negative',
          scale: { min: 0, max: 3 },
          fallbackPolicy: 'predict'
        }
      }
    };
    window.StateAccessors = {
      getTechnologies() {
        return [{ id: 99, directions: ['Dir A'], integrationRisk: 3 }];
      }
    };
    window.MissingDataPredictor = {
      kNNPrediction: predictor
    };

    const pos = Positioning.calculateRadarPosition({
      id: 12,
      directions: ['Dir A'],
      enterprises: []
    });

    expect(predictor).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(Array),
      'integrationRisk',
      3,
      expect.objectContaining({
        modelConfig: expect.any(Object),
        factors: ['integrationRisk']
      })
    );
    expect(pos.insufficientData).toBe(false);
    expect(pos.radius).toBeCloseTo(94.99, 2);
  });
});
