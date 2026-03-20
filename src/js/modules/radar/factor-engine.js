import Logger from '../core/logger.js';

'use strict';

const BASE_FACTOR_REGISTRY = {
  techRead: {
    id: 'techRead',
    enabled: true,
    weight: 0.35,
    impact: 'positive',
    scale: { min: 0, max: 3 },
    fallbackPolicy: 'none',
    fallbackValue: null
  },
  organRead: {
    id: 'organRead',
    enabled: true,
    weight: 0.35,
    impact: 'positive',
    scale: { min: 0, max: 3 },
    fallbackPolicy: 'none',
    fallbackValue: null
  },
  funcCover: {
    id: 'funcCover',
    enabled: true,
    weight: 0.20,
    impact: 'positive',
    scale: { min: 0, max: 3 },
    fallbackPolicy: 'constant',
    fallbackValue: 0
  },
  trlStage: {
    id: 'trlStage',
    enabled: true,
    weight: 0.10,
    impact: 'positive',
    scale: { min: 1, max: 3 },
    fallbackPolicy: 'constant',
    fallbackValue: 1
  }
};

// Новые факторы P2.3: отдельный слой, отключенный по умолчанию.
const EXTRA_FACTOR_REGISTRY = {
  implementationCostPressure: {
    id: 'implementationCostPressure',
    enabled: false,
    weight: 0.15,
    impact: 'negative',
    scale: { min: 0, max: 10000000 },
    fallbackPolicy: 'none',
    fallbackValue: null
  },
  integrationRisk: {
    id: 'integrationRisk',
    enabled: false,
    weight: 0.15,
    impact: 'negative',
    scale: { min: 0, max: 3 },
    fallbackPolicy: 'none',
    fallbackValue: null
  },
  integrationComplexity: {
    id: 'integrationComplexity',
    enabled: false,
    weight: 0.10,
    impact: 'negative',
    scale: { min: 0, max: 3 },
    fallbackPolicy: 'none',
    fallbackValue: null
  }
};

const FACTOR_VALUE_ALIASES = {
  techRead: ['techRead', 'tech_read'],
  organRead: ['organRead', 'organ_read'],
  funcCover: ['funcCover', 'func_cover'],
  trlStage: ['trlStage', 'trl_stage'],
  implementationCostPressure: ['implementationCostPressure', 'costProm', 'cost', 'costs'],
  integrationRisk: ['integrationRisk', 'risks', 'risk'],
  integrationComplexity: ['integrationComplexity', 'complexity']
};

const TEXT_LEVEL_TO_SCORE = {
  low: 1,
  medium: 2,
  high: 3,
  низкий: 1,
  средний: 2,
  высокий: 3,
  small: 1,
  moderate: 2,
  severe: 3
};

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function toNumberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function toBooleanOrDefault(value, fallback) {
  if (typeof value === 'boolean') return value;
  return fallback;
}

function toImpact(value, fallback = 'positive') {
  const normalized = String(value || fallback).trim().toLowerCase();
  return normalized === 'negative' ? 'negative' : 'positive';
}

function toFallbackPolicy(value, fallback = 'none') {
  const normalized = String(value || fallback).trim().toLowerCase();
  if (normalized === 'constant' || normalized === 'predict' || normalized === 'none') return normalized;
  return fallback;
}

function normalizeScale(scale, fallbackScale) {
  const fallbackMin = fallbackScale && isFiniteNumber(fallbackScale.min) ? fallbackScale.min : 0;
  const fallbackMax = fallbackScale && isFiniteNumber(fallbackScale.max) ? fallbackScale.max : 3;
  const min = isFiniteNumber(scale && scale.min) ? scale.min : fallbackMin;
  const max = isFiniteNumber(scale && scale.max) ? scale.max : fallbackMax;
  if (max <= min) {
    return { min: fallbackMin, max: fallbackMax };
  }
  return { min, max };
}

function normalizeFactorConfig(id, config, baseConfig = null) {
  const base = baseConfig || {
    id,
    enabled: true,
    weight: 0,
    impact: 'positive',
    scale: { min: 0, max: 3 },
    fallbackPolicy: 'none',
    fallbackValue: null
  };
  const source = config || {};

  const scale = normalizeScale(source.scale, base.scale);
  const weight = toNumberOrNull(source.weight);
  const fallbackValueRaw = source.fallbackValue !== undefined ? source.fallbackValue : base.fallbackValue;
  const fallbackValue = toNumberOrNull(fallbackValueRaw);

  return {
    id,
    enabled: toBooleanOrDefault(source.enabled, base.enabled),
    weight: weight !== null ? Math.max(0, weight) : Math.max(0, base.weight),
    impact: toImpact(source.impact, base.impact),
    scale,
    fallbackPolicy: toFallbackPolicy(source.fallbackPolicy, base.fallbackPolicy),
    fallbackValue
  };
}

function getDefaultRegistryMap() {
  return { ...BASE_FACTOR_REGISTRY, ...EXTRA_FACTOR_REGISTRY };
}

function getOrderedFactorIds(registryMap, baseMap, overrides) {
  const ordered = [];
  Object.keys(baseMap).forEach(id => {
    if (registryMap[id]) ordered.push(id);
  });
  Object.keys(overrides || {}).sort().forEach(id => {
    if (!ordered.includes(id) && registryMap[id]) {
      ordered.push(id);
    }
  });
  Object.keys(registryMap).sort().forEach(id => {
    if (!ordered.includes(id)) {
      ordered.push(id);
    }
  });
  return ordered;
}

function buildFactorRegistry(modelConfig = {}) {
  const overrides = modelConfig && typeof modelConfig.factors === 'object' ? modelConfig.factors : {};
  const legacyWeights = modelConfig && typeof modelConfig.weights === 'object' ? modelConfig.weights : {};
  const defaultRegistryMap = getDefaultRegistryMap();

  const registryMap = {};
  Object.keys(defaultRegistryMap).forEach(id => {
    const baseConfig = defaultRegistryMap[id];
    const merged = {
      ...baseConfig,
      ...(legacyWeights[id] !== undefined ? { weight: legacyWeights[id] } : {}),
      ...(overrides[id] || {})
    };
    registryMap[id] = normalizeFactorConfig(id, merged, baseConfig);
  });

  Object.keys(overrides).forEach(id => {
    if (registryMap[id]) return;
    registryMap[id] = normalizeFactorConfig(id, overrides[id], null);
  });

  const orderedIds = getOrderedFactorIds(registryMap, defaultRegistryMap, overrides);
  return orderedIds.map(id => registryMap[id]).filter(factor => factor.enabled);
}

function resolveRadiusConfig(modelConfig = {}) {
  const radiusFromNewConfig = modelConfig && typeof modelConfig.radius === 'object' ? modelConfig.radius : {};
  const radiusMinNew = toNumberOrNull(radiusFromNewConfig.min);
  const radiusMaxNew = toNumberOrNull(radiusFromNewConfig.max);

  const radiusMinLegacy = toNumberOrNull(modelConfig.r_min);
  const radiusMaxLegacy = toNumberOrNull(modelConfig.r_max);

  const min = radiusMinNew !== null ? radiusMinNew : (radiusMinLegacy !== null ? radiusMinLegacy : 5);
  const max = radiusMaxNew !== null ? radiusMaxNew : (radiusMaxLegacy !== null ? radiusMaxLegacy : 95);

  if (max <= min) {
    return { min: 5, max: 95 };
  }

  return { min, max };
}

function resolveMinValidFactors(registry, modelConfig = {}) {
  const configured = toNumberOrNull(modelConfig.minValidFactors);
  const enabledCount = registry.length;
  if (enabledCount === 0) return 0;

  if (configured !== null) {
    return Math.max(1, Math.min(enabledCount, Math.round(configured)));
  }

  // Обратная совместимость: для 4 факторов требуется минимум 3 валидных.
  return Math.max(1, enabledCount - 1);
}

function parseTextLevelValue(value) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (TEXT_LEVEL_TO_SCORE[normalized] !== undefined) {
    return TEXT_LEVEL_TO_SCORE[normalized];
  }
  return null;
}

function getFirstDefinedProperty(obj, aliases = []) {
  for (const key of aliases) {
    if (obj && obj[key] !== undefined && obj[key] !== null && obj[key] !== '') {
      return obj[key];
    }
  }
  return null;
}

function extractRawFactorValue(tech, factorId) {
  const aliases = FACTOR_VALUE_ALIASES[factorId] || [factorId];
  const raw = getFirstDefinedProperty(tech, aliases);
  if (raw !== null) return raw;

  // Для базовых факторов по готовности поддерживаем fallback из enterprises.
  if ((factorId === 'techRead' || factorId === 'organRead') && Array.isArray(tech && tech.enterprises)) {
    let sum = 0;
    let count = 0;
    tech.enterprises.forEach(ent => {
      if (!ent || typeof ent !== 'object') return;
      const sourceValue = factorId === 'techRead'
        ? ent.technologicalReadiness
        : ent.organizationalReadiness;
      const numeric = toNumberOrNull(sourceValue);
      if (numeric !== null) {
        sum += numeric;
        count++;
      }
    });
    if (count > 0) {
      return sum / count;
    }
  }

  return null;
}

function normalizeRawForFactor(raw, factor) {
  const numeric = toNumberOrNull(raw);
  if (numeric !== null) return numeric;

  const parsedText = parseTextLevelValue(raw);
  if (parsedText !== null) {
    return parsedText;
  }

  return null;
}

function normalizeFactorValue(rawValue, scale) {
  if (!isFiniteNumber(rawValue)) return null;
  const clamped = clamp(rawValue, scale.min, scale.max);
  const span = scale.max - scale.min;
  if (span <= 0) return null;
  return (clamped - scale.min) / span;
}

function extractRawValue(factor, tech, rawFactors = {}) {
  if (rawFactors[factor.id] !== undefined) return rawFactors[factor.id];
  return extractRawFactorValue(tech, factor.id);
}

function getDefaultAvailability(factor, rawValue) {
  if (factor.id === 'funcCover') {
    // Для funcCover значение 0 — валидное, наличие значения определяется отдельным флагом в positioning.
    return rawValue !== null && rawValue !== undefined;
  }
  return rawValue !== null && rawValue !== undefined;
}

function resolveFallbackValue(factor, rawValue, context = {}) {
  if (rawValue !== null && rawValue !== undefined) return rawValue;

  if (factor.fallbackPolicy === 'constant') {
    return factor.fallbackValue;
  }

  if (factor.fallbackPolicy === 'predict' && typeof context.predictValue === 'function') {
    return context.predictValue(factor, context);
  }

  return null;
}

function normalizeWeights(contributions) {
  const totalWeight = contributions.reduce((sum, item) => sum + item.weight, 0);
  if (totalWeight <= 0) {
    return contributions.map(item => ({ ...item, normalizedWeight: 0 }));
  }
  return contributions.map(item => ({
    ...item,
    normalizedWeight: item.weight / totalWeight
  }));
}

function calculateReadinessIndex(params = {}) {
  const modelConfig = params.modelConfig || {};
  const registry = params.registry || buildFactorRegistry(modelConfig);
  const tech = params.tech || null;
  const rawFactors = params.rawFactors || {};
  const availability = params.availability || {};
  const logger = params.logger || Logger;
  const predictValue = typeof params.predictValue === 'function' ? params.predictValue : null;
  const minValidFactors = resolveMinValidFactors(registry, modelConfig);

  const missingFactors = [];
  const contributions = [];

  registry.forEach(factor => {
    const extractedRaw = normalizeRawForFactor(extractRawValue(factor, tech, rawFactors), factor);
    const sourceAvailable = availability[factor.id] !== undefined
      ? Boolean(availability[factor.id])
      : getDefaultAvailability(factor, extractedRaw);

    if (!sourceAvailable) {
      missingFactors.push(factor.id);
    }

    const valueWithFallback = toNumberOrNull(resolveFallbackValue(factor, extractedRaw, {
      factor,
      tech,
      rawFactors,
      availability,
      registry,
      modelConfig,
      logger,
      predictValue
    }));
    if (valueWithFallback === null) {
      return;
    }

    const normalized = normalizeFactorValue(valueWithFallback, factor.scale);
    if (normalized === null) {
      if (logger && typeof logger.warn === 'function') {
        logger.warn(`[FactorEngine] Некорректный диапазон фактора ${factor.id}: min=${factor.scale.min}, max=${factor.scale.max}`);
      }
      return;
    }

    const effective = factor.impact === 'negative' ? (1 - normalized) : normalized;
    contributions.push({
      id: factor.id,
      weight: factor.weight,
      normalized,
      effective,
      sourceAvailable
    });
  });

  const weightedContributions = normalizeWeights(contributions);
  const z = weightedContributions.reduce((sum, item) => sum + (item.normalizedWeight * item.effective), 0);
  const validFactorsCount = weightedContributions.length;
  const insufficientData = minValidFactors > 0 && validFactorsCount < minValidFactors;

  return {
    z,
    registry,
    contributions: weightedContributions,
    validFactorsCount,
    minValidFactors,
    missingFactors,
    hasMissingData: missingFactors.length > 0,
    insufficientData
  };
}

function getActiveFactorIds(modelConfig = {}) {
  return buildFactorRegistry(modelConfig).map(f => f.id);
}

function getModelSignature(modelConfig = {}) {
  const registry = buildFactorRegistry(modelConfig);
  const radius = resolveRadiusConfig(modelConfig);
  const minValidFactors = resolveMinValidFactors(registry, modelConfig);
  const factorSignature = registry
    .map(f => `${f.id}:${f.enabled ? 1 : 0}:${f.weight}:${f.impact}:${f.scale.min}-${f.scale.max}:${f.fallbackPolicy}:${f.fallbackValue}`)
    .join('|');

  return `radius=${radius.min},${radius.max};minValid=${minValidFactors};factors=${factorSignature}`;
}

const FactorEngine = {
  BASE_FACTOR_REGISTRY,
  EXTRA_FACTOR_REGISTRY,
  extractRawFactorValue,
  buildFactorRegistry,
  getActiveFactorIds,
  resolveRadiusConfig,
  resolveMinValidFactors,
  calculateReadinessIndex,
  getModelSignature
};

if (typeof window !== 'undefined') {
  window.FactorEngine = FactorEngine;
}

export default FactorEngine;
export {
  BASE_FACTOR_REGISTRY,
  EXTRA_FACTOR_REGISTRY,
  extractRawFactorValue,
  buildFactorRegistry,
  getActiveFactorIds,
  resolveRadiusConfig,
  resolveMinValidFactors,
  calculateReadinessIndex,
  getModelSignature
};
