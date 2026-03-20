import { beforeEach, describe, expect, test } from 'vitest';

import {
  computePriority,
  getPriorityWeakLinkComment
} from './priorities.js';

describe('priorities', () => {
  beforeEach(() => {
    window.RadarModelConfig = {
      minValidFactors: 1,
      factors: {
        techRead: { enabled: true, weight: 0.8, impact: 'positive', scale: { min: 0, max: 3 } },
        organRead: { enabled: false },
        funcCover: { enabled: false },
        trlStage: { enabled: false },
        integrationRisk: { enabled: true, weight: 0.2, impact: 'negative', scale: { min: 0, max: 3 } }
      }
    };
  });

  test('computePriority() использует dynamic factor registry как weighted score', () => {
    const value = computePriority({
      techRead: 3,
      integrationRisk: 3
    });

    expect(value).toBeCloseTo(0.8, 5);
    expect(computePriority({ techRead: 3, integrationRisk: 3 }, 'avg')).toBeCloseTo(0.5, 5);
    expect(computePriority({ techRead: 3, integrationRisk: 3 }, 'min')).toBeCloseTo(0, 5);
  });

  test('getPriorityWeakLinkComment() сообщает о пропущенных факторах при недостатке данных', () => {
    window.RadarModelConfig = {
      minValidFactors: 3,
      factors: {
        techRead: { enabled: true, weight: 0.4, impact: 'positive', scale: { min: 0, max: 3 } },
        organRead: { enabled: true, weight: 0.4, impact: 'positive', scale: { min: 0, max: 3 } },
        funcCover: { enabled: true, weight: 0.1, impact: 'positive', scale: { min: 0, max: 3 }, fallbackPolicy: 'none' },
        trlStage: { enabled: true, weight: 0.1, impact: 'positive', scale: { min: 1, max: 3 }, fallbackPolicy: 'constant', fallbackValue: 1 }
      }
    };

    const comment = getPriorityWeakLinkComment({
      trlStage: 2
    });

    expect(comment).toContain('Недостаточно данных');
    expect(comment).toContain('технологическая готовность');
    expect(comment).toContain('организационная готовность');
  });
});
