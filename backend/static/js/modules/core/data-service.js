/**
 * DataService вЂ” РµРґРёРЅС‹Р№ API-СЃР»РѕР№ РґРѕСЃС‚СѓРїР° Рє РґР°РЅРЅС‹Рј.
 *
 * @module data-service
 */

import { clearFetchCache as clearDataSourceCache } from './data-source.js';
import { buildBlockMaps, normalizeTechnologyFromNewFormat, buildEnterpriseDataFromTechnologies } from './data-normalize.js';
import Logger from './logger.js';

/** РРјРµРЅР° СЃРїСЂР°РІРѕС‡РЅРёРєРѕРІ, РґРѕСЃС‚СѓРїРЅС‹С… С‡РµСЂРµР· loadReference */
export const REFERENCE_NAMES = [
  'blocks',
  'functions',
  'functionToBlock',
  'digitalDirections',
  'directionToQuadrant',
  'vendors',
  'integrators',
  'enterprises',
  'enterprisesBlocksMapping'
];


function getApiClient() {
  if (typeof window !== 'undefined' && window.ApiClient) {
    return window.ApiClient;
  }
  return null;
}

/**
 * РЈРЅРёС„РёС†РёСЂРѕРІР°РЅРЅР°СЏ РѕР±СЂР°Р±РѕС‚РєР° РѕС€РёР±РѕРє API.
 * @param {Error|{ ok?: boolean, error?: string, status?: number }} err
 * @returns {never}
 */
function wrapApiError(err) {
  if (err && typeof err === 'object' && err.ok === false && err.error) {
    throw new Error(err.error);
  }
  if (err instanceof Error) {
    throw err;
  }
  throw new Error(String(err || 'РќРµРёР·РІРµСЃС‚РЅР°СЏ РѕС€РёР±РєР°'));
}

function getStateValue(key, fallback = null) {
  try {
    if (typeof window !== 'undefined' && window.StateManager && typeof window.StateManager.get === 'function') {
      const value = window.StateManager.get(key);
      return value == null ? fallback : value;
    }
  } catch (e) {
    Logger.warn(`DataService: РѕС€РёР±РєР° С‡С‚РµРЅРёСЏ state "${key}"`, e);
  }
  return fallback;
}

function normalizeReadinessToBackend(value) {
  if (value == null || value === '') return 1;
  const n = Number(value);
  if (Number.isNaN(n)) return 1;
  if (n >= 1 && n <= 9) return Math.round(n);
  const rounded = Math.round(n);
  if (rounded <= 0) return 1;
  if (rounded === 1) return 3;
  if (rounded === 2) return 6;
  return 9;
}

function hasExplicitValue(value) {
  return value !== undefined && value !== null && value !== '';
}

function normalizeEnterpriseReadinessToBackend(value) {
  if (!hasExplicitValue(value)) return undefined;
  return normalizeReadinessToBackend(value);
}

function normalizeStatusToBackend(value, isImplemented) {
  const raw = String(value || '').trim();
  const norm = raw.toLowerCase();
  if (isImplemented === true) return 'Р’РЅРµРґСЂРµРЅР°';
  if (isImplemented === false) return 'РќРµРІРЅРµРґСЂРµРЅРЅР°';
  if (norm === 'РІРЅРµРґСЂРµРЅР°' || norm === 'РІРЅРµРґСЂРµРЅРЅР°') return 'Р’РЅРµРґСЂРµРЅР°';
  if (norm === 'РЅРµРІРЅРµРґСЂРµРЅР°' || norm === 'РЅРµРІРЅРµРґСЂРµРЅРЅР°') return 'РќРµРІРЅРµРґСЂРµРЅРЅР°';
  if (norm === 'РёСЃРїРѕР»СЊР·СѓРµРјС‹Рµ') return 'Р’РЅРµРґСЂРµРЅР°';
  if (norm === 'РІРЅРµРґСЂСЏРµРјС‹Рµ' || norm === 'РїРµСЂСЃРїРµРєС‚РёРІРЅС‹Рµ') return 'РќРµРІРЅРµРґСЂРµРЅРЅР°';
  return raw || 'planned';
}

function normalizeName(item) {
  if (item == null) return '';
  if (typeof item === 'string') return item.trim();
  if (typeof item === 'object') {
    const val = item.name ?? item.title ?? item.id;
    return String(val ?? '').trim();
  }
  return String(item).trim();
}

function toArray(value) {
  if (Array.isArray(value)) return value;
  return value == null || value === '' ? [] : [value];
}

function uniqueTrimmedStrings(items) {
  const seen = new Set();
  return toArray(items)
    .map((item) => String(item || '').trim())
    .filter((item) => {
      if (!item) return false;
      const key = item.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function buildDirectionNameToIdMap() {
  const map = {};
  const directions = getStateValue('digitalDirections', []);
  if (Array.isArray(directions)) {
    directions.forEach((d) => {
      const id = d && typeof d === 'object' ? d.id : null;
      const name = normalizeName(d);
      if (id != null && name) map[name] = Number(id);
    });
  }
  return map;
}

function buildEnterpriseNameToIdMap() {
  const map = {};
  const enterprises = getStateValue('enterprisesList', []);
  if (Array.isArray(enterprises)) {
    enterprises.forEach((e) => {
      const id = e && typeof e === 'object' ? (e.id ?? e.enterprise_id) : null;
      const name = normalizeName(e);
      if (id != null && name) map[name] = Number(id);
    });
  }
  return map;
}

function toApiTechnologyPayload(tech) {
  const t = tech && typeof tech === 'object' ? tech : {};
  const nameToBlockId = getStateValue('nameToBlockId', {}) || {};
  const directionNameToId = buildDirectionNameToIdMap();
  const enterpriseNameToId = buildEnterpriseNameToIdMap();

  const rawBlocks = Array.isArray(t.blocks) && t.blocks.length > 0 ? t.blocks : toArray(t.block);
  const blockIds = rawBlocks
    .map((b) => {
      if (typeof b === 'number') return b;
      const asNum = Number(b);
      if (!Number.isNaN(asNum) && asNum > 0) return asNum;
      const byName = nameToBlockId[String(b || '').trim()];
      return byName != null ? Number(byName) : null;
    })
    .filter((id) => Number.isInteger(id) && id > 0);

  const rawDirections = Array.isArray(t.directions) && t.directions.length > 0 ? t.directions : toArray(t.direction);
  const directionIds = rawDirections
    .map((d) => {
      if (typeof d === 'number') return d;
      const asNum = Number(d);
      if (!Number.isNaN(asNum) && asNum > 0) return asNum;
      const byName = directionNameToId[String(d || '').trim()];
      return byName != null ? Number(byName) : null;
    })
    .filter((id) => Number.isInteger(id) && id > 0);

  let enterprisesPayload = [];
  if (Array.isArray(t.enterprises) && t.enterprises.length > 0) {
    enterprisesPayload = t.enterprises
      .map((e) => {
        const enterpriseId = Number(e?.enterpriseId);
        if (!Number.isInteger(enterpriseId) || enterpriseId <= 0) return null;
        const enterprisePayload = { enterpriseId };
        const isImplemented = typeof e?.isImplemented === 'boolean' ? e.isImplemented : undefined;
        const technologicalReadiness = normalizeEnterpriseReadinessToBackend(e?.technologicalReadiness);
        const organizationalReadiness = normalizeEnterpriseReadinessToBackend(e?.organizationalReadiness);

        if (technologicalReadiness !== undefined) {
          enterprisePayload.technologicalReadiness = technologicalReadiness;
        }
        if (organizationalReadiness !== undefined) {
          enterprisePayload.organizationalReadiness = organizationalReadiness;
        }
        if (hasExplicitValue(e?.status) || typeof isImplemented === 'boolean') {
          enterprisePayload.status = normalizeStatusToBackend(e?.status, isImplemented);
        }
        return enterprisePayload;
      })
      .filter(Boolean);
  } else {
    const companies = toArray(t.company).map(normalizeName).filter(Boolean);
    enterprisesPayload = companies
      .map((companyName) => {
        const enterpriseId = Number(enterpriseNameToId[companyName]);
        if (!Number.isInteger(enterpriseId) || enterpriseId <= 0) return null;
        const ratings = t.companyRatings && typeof t.companyRatings === 'object' ? t.companyRatings[companyName] : null;
        const enterprisePayload = { enterpriseId };
        const isImplemented = ratings && typeof ratings.isImplemented === 'boolean' ? ratings.isImplemented : undefined;
        const technologicalReadiness = normalizeEnterpriseReadinessToBackend(ratings?.techRead);
        const organizationalReadiness = normalizeEnterpriseReadinessToBackend(ratings?.organRead);

        if (technologicalReadiness !== undefined) {
          enterprisePayload.technologicalReadiness = technologicalReadiness;
        }
        if (organizationalReadiness !== undefined) {
          enterprisePayload.organizationalReadiness = organizationalReadiness;
        }
        if ((ratings && hasExplicitValue(ratings.status)) || typeof isImplemented === 'boolean') {
          enterprisePayload.status = normalizeStatusToBackend(ratings?.status, isImplemented);
        }
        return enterprisePayload;
      })
      .filter(Boolean);
  }

  const functionCoverage = (
    Array.isArray(t.functionCoverage) && t.functionCoverage.length > 0
      ? t.functionCoverage
      : (Array.isArray(t.functions) && t.functions.length > 0 ? t.functions : toArray(t.func))
  )
    .map((f) => String(f || '').trim())
    .filter(Boolean);

  const vendorsPayload = toArray(t.vendors)
    .map((v) => {
      if (typeof v === 'string') {
        const name = v.trim();
        return name ? { name, integrators: [] } : null;
      }
      if (!v || typeof v !== 'object') return null;
      const name = normalizeName(v.name ?? v.id ?? '');
      if (!name) return null;
      const integrators = toArray(v.integrators)
        .map((i) => normalizeName(i))
        .filter(Boolean);
      return { name, integrators };
    })
    .filter(Boolean);

  const marketExamples = (() => {
    if (Array.isArray(t.marketExamples)) return uniqueTrimmedStrings(t.marketExamples);
    if (typeof t.exampleDesc === 'string' && t.exampleDesc.trim()) {
      return uniqueTrimmedStrings(t.exampleDesc
        .split('\n')
        .map((x) => x.trim()));
    }
    return [];
  })();

  const documentationFiles = uniqueTrimmedStrings(toArray(t.files)
    .map((f) => {
      if (typeof f === 'string') return f.trim();
      if (f && typeof f === 'object') return String(f.path || f.url || f.name || '').trim();
      return '';
    }));

  const payload = {
    name: String(t.name || '').trim(),
    description: String(t.description || '').trim(),
    block: blockIds.length > 0 ? blockIds[0] : null,
    blocks: blockIds,
    function: String(t.func || '').trim(),
    functionCoverage,
    enterprises: enterprisesPayload,
    directions: directionIds,
    trlStage: (() => {
      const trl = Number(t.trlStage);
      if (Number.isNaN(trl)) return 1;
      return Math.max(1, Math.min(9, Math.round(trl)));
    })(),
    status: normalizeStatusToBackend(t.status || t.level),
    vendors: vendorsPayload,
    marketExamples,
    documentationFiles,
  };

  if (t.id != null) {
    const id = Number(t.id);
    if (Number.isInteger(id) && id > 0) payload.id = id;
  }

  return payload;
}

// ========== API-СЃР»РѕР№ ==========

async function apiLoadReference(name) {
  const client = getApiClient();
  if (!client || typeof client.get !== 'function') {
    throw new Error('ApiClient РЅРµРґРѕСЃС‚СѓРїРµРЅ');
  }
  const path = `/api/v1/references/${name}`;
  const res = await client.get(path);
  if (!res || res.ok === false) {
    wrapApiError(res || { error: 'РћС€РёР±РєР° Р·Р°РіСЂСѓР·РєРё СЃРїСЂР°РІРѕС‡РЅРёРєР°' });
  }
  return res && res.data != null ? res.data : (Array.isArray(res) ? res : []);
}

async function apiLoadTechnologies(enterpriseId) {
  const client = getApiClient();
  if (!client || typeof client.get !== 'function') {
    throw new Error('ApiClient РЅРµРґРѕСЃС‚СѓРїРµРЅ');
  }
  let path = '/api/v1/technologies';
  const query = enterpriseId != null && enterpriseId !== '' ? { enterpriseId } : {};
  const res = await client.get(path, Object.keys(query).length ? query : undefined);
  if (!res || res.ok === false) {
    wrapApiError(res || { error: 'РћС€РёР±РєР° Р·Р°РіСЂСѓР·РєРё С‚РµС…РЅРѕР»РѕРіРёР№' });
  }
  let items = res && res.data != null ? res.data : (Array.isArray(res) ? res : []);
  if (!Array.isArray(items)) items = [];

  const [blocksData, enterprisesData] = await Promise.all([
    apiLoadReference('blocks').catch(() => []),
    apiLoadReference('enterprises').catch(() => [])
  ]);
  const blocks = Array.isArray(blocksData) ? blocksData : [];
  const { blockIdToName } = buildBlockMaps(blocks);
  const enterprises = Array.isArray(enterprisesData) ? enterprisesData : [];

  const normalizeTech = normalizeTechnologyFromNewFormat;
  return items.map(tech => normalizeTech(tech, blockIdToName, enterprises));
}

async function apiLoadEnterprises() {
  return apiLoadReference('enterprises');
}

async function apiLoadEnterpriseData() {
  const techs = await apiLoadTechnologies();
  return buildEnterpriseDataFromTechnologies(techs);
}

async function apiCreateTech(tech) {
  const client = getApiClient();
  if (!client || typeof client.post !== 'function') {
    throw new Error('ApiClient РЅРµРґРѕСЃС‚СѓРїРµРЅ');
  }
  const payload = toApiTechnologyPayload(tech);
  delete payload.id;
  const res = await client.post('/api/v1/technologies', payload);
  if (!res || res.ok === false) {
    wrapApiError(res || { error: 'РћС€РёР±РєР° СЃРѕР·РґР°РЅРёСЏ С‚РµС…РЅРѕР»РѕРіРёРё' });
  }
  const created = res && res.data != null ? res.data : res;
  const [blocksData, enterprisesData] = await Promise.all([
    apiLoadReference('blocks').catch(() => []),
    apiLoadReference('enterprises').catch(() => [])
  ]);
  const blocks = Array.isArray(blocksData) ? blocksData : [];
  const { blockIdToName } = buildBlockMaps(blocks);
  const enterprises = Array.isArray(enterprisesData) ? enterprisesData : [];
  return normalizeTechnologyFromNewFormat(created, blockIdToName, enterprises);
}

async function apiUpdateTech(id, tech) {
  const client = getApiClient();
  if (!client || (typeof client.put !== 'function' && typeof client.patch !== 'function')) {
    throw new Error('ApiClient РЅРµРґРѕСЃС‚СѓРїРµРЅ');
  }
  const method = client.patch || client.put;
  const payload = toApiTechnologyPayload({ ...tech, id });
  const res = await method(`/api/v1/technologies/${id}`, payload);
  if (!res || res.ok === false) {
    wrapApiError(res || { error: 'РћС€РёР±РєР° РѕР±РЅРѕРІР»РµРЅРёСЏ С‚РµС…РЅРѕР»РѕРіРёРё' });
  }
  const updated = res && res.data != null ? res.data : res;
  const [blocksData, enterprisesData] = await Promise.all([
    apiLoadReference('blocks').catch(() => []),
    apiLoadReference('enterprises').catch(() => [])
  ]);
  const blocks = Array.isArray(blocksData) ? blocksData : [];
  const { blockIdToName } = buildBlockMaps(blocks);
  const enterprises = Array.isArray(enterprisesData) ? enterprisesData : [];
  return normalizeTechnologyFromNewFormat(updated, blockIdToName, enterprises);
}

async function apiDeleteTech(id) {
  const client = getApiClient();
  if (!client || typeof client.delete !== 'function') {
    throw new Error('ApiClient РЅРµРґРѕСЃС‚СѓРїРµРЅ');
  }
  const res = await client.delete(`/api/v1/technologies/${id}`);
  if (!res || res.ok === false) {
    wrapApiError(res || { error: 'РћС€РёР±РєР° СѓРґР°Р»РµРЅРёСЏ С‚РµС…РЅРѕР»РѕРіРёРё' });
  }
}

async function apiCreateTechnologyProposal(action, options) {
  const client = getApiClient();
  if (!client || typeof client.post !== 'function') {
    throw new Error('ApiClient РЅРµРґРѕСЃС‚СѓРїРµРЅ');
  }
  const normalizedAction = String(action || '').trim().toLowerCase();
  const payload = {
    action: normalizedAction
  };
  const technologyId = options && options.technologyId != null ? Number(options.technologyId) : null;
  if (Number.isInteger(technologyId) && technologyId > 0) {
    payload.technologyId = technologyId;
  }
  if (options && options.payload && typeof options.payload === 'object') {
    payload.payload = options.payload;
  }
  if (options && options.tech) {
    payload.payload = toApiTechnologyPayload(options.tech);
    delete payload.payload.id;
  }
  if (options && typeof options.comment === 'string' && options.comment.trim()) {
    payload.comment = options.comment.trim();
  }
  const res = await client.post('/api/v1/technology-proposals', payload);
  if (!res || res.ok === false) {
    wrapApiError(res || { error: 'РћС€РёР±РєР° СЃРѕР·РґР°РЅРёСЏ РїСЂРµРґР»РѕР¶РµРЅРёСЏ' });
  }
  return res && res.data != null ? res.data : res;
}

async function apiLoadMyTechnologyProposals() {
  const client = getApiClient();
  if (!client || typeof client.get !== 'function') {
    throw new Error('ApiClient РЅРµРґРѕСЃС‚СѓРїРµРЅ');
  }
  const res = await client.get('/api/v1/technology-proposals/mine');
  if (!res || res.ok === false) {
    wrapApiError(res || { error: 'РћС€РёР±РєР° Р·Р°РіСЂСѓР·РєРё РјРѕРёС… РїСЂРµРґР»РѕР¶РµРЅРёР№' });
  }
  return Array.isArray(res && res.data) ? res.data : [];
}

async function apiLoadMyTechnologyProposalHistory() {
  const client = getApiClient();
  if (!client || typeof client.get !== 'function') {
    throw new Error('ApiClient Р Р…Р ВµР Т‘Р С•РЎРѓРЎвЂљРЎС“Р С—Р ВµР Р…');
  }
  const res = await client.get('/api/v1/technology-proposals/mine/history');
  if (!res || res.ok === false) {
    wrapApiError(res || { error: 'Р С›РЎв‚¬Р С‘Р В±Р С”Р В° Р В·Р В°Р С–РЎР‚РЎС“Р В·Р С”Р С‘ Р С‘РЎРѓРЎвЂљР С•РЎР‚Р С‘Р С‘ Р СР С•Р С‘РЎвЂ¦ Р С—РЎР‚Р ВµР Т‘Р В»Р С•Р В¶Р ВµР Р…Р С‘Р в„–' });
  }
  return Array.isArray(res && res.data) ? res.data : [];
}

async function apiLoadPendingTechnologyProposals() {
  const client = getApiClient();
  if (!client || typeof client.get !== 'function') {
    throw new Error('ApiClient РЅРµРґРѕСЃС‚СѓРїРµРЅ');
  }
  const res = await client.get('/api/v1/technology-proposals/pending');
  if (!res || res.ok === false) {
    wrapApiError(res || { error: 'РћС€РёР±РєР° Р·Р°РіСЂСѓР·РєРё РїСЂРµРґР»РѕР¶РµРЅРёР№ РЅР° СЂРµРІСЊСЋ' });
  }
  return Array.isArray(res && res.data) ? res.data : [];
}

async function apiLoadTechnologyProposalHistory() {
  const client = getApiClient();
  if (!client || typeof client.get !== 'function') {
    throw new Error('ApiClient Р Р…Р ВµР Т‘Р С•РЎРѓРЎвЂљРЎС“Р С—Р ВµР Р…');
  }
  const res = await client.get('/api/v1/technology-proposals/history');
  if (!res || res.ok === false) {
    wrapApiError(res || { error: 'Р С›РЎв‚¬Р С‘Р В±Р С”Р В° Р В·Р В°Р С–РЎР‚РЎС“Р В·Р С”Р С‘ Р С‘РЎРѓРЎвЂљР С•РЎР‚Р С‘Р С‘ Р С—РЎР‚Р ВµР Т‘Р В»Р С•Р В¶Р ВµР Р…Р С‘Р в„–' });
  }
  return Array.isArray(res && res.data) ? res.data : [];
}

async function apiReviewTechnologyProposal(id, decision, reviewComment) {
  const client = getApiClient();
  if (!client || typeof client.post !== 'function') {
    throw new Error('ApiClient РЅРµРґРѕСЃС‚СѓРїРµРЅ');
  }
  const normalizedDecision = String(decision || '').trim().toLowerCase();
  const res = await client.post(`/api/v1/technology-proposals/${id}/${normalizedDecision}`, {
    review_comment: typeof reviewComment === 'string' ? reviewComment.trim() : ''
  });
  if (!res || res.ok === false) {
    wrapApiError(res || { error: 'РћС€РёР±РєР° РѕР±СЂР°Р±РѕС‚РєРё РїСЂРµРґР»РѕР¶РµРЅРёСЏ' });
  }
  return res && res.data != null ? res.data : res;
}

async function apiClearMyTechnologyProposalHistory(ids) {
  const client = getApiClient();
  if (!client || typeof client.delete !== 'function') {
    throw new Error('ApiClient РЅРµРґРѕСЃС‚СѓРїРµРЅ');
  }
  const normalizedIds = Array.isArray(ids)
    ? ids.map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0)
    : [];
  const requestOptions = normalizedIds.length > 0 ? { body: { ids: normalizedIds } } : {};
  const res = await client.delete('/api/v1/technology-proposals/mine/history', requestOptions);
  if (!res || res.ok === false) {
    wrapApiError(res || { error: 'РћС€РёР±РєР° РѕС‡РёСЃС‚РєРё РёСЃС‚РѕСЂРёРё РїСЂРµРґР»РѕР¶РµРЅРёР№' });
  }
  return res && res.data != null ? res.data : res;
}

async function apiSaveTechnologies(technologies) {
  const client = getApiClient();
  if (!client || typeof client.put !== 'function') {
    throw new Error('ApiClient РЅРµРґРѕСЃС‚СѓРїРµРЅ');
  }
  const payload = Array.isArray(technologies)
    ? technologies.map((t) => toApiTechnologyPayload(t)).filter((t) => t && t.name)
    : [];
  const res = await client.put('/api/v1/technologies/bulk', payload);
  if (!res || res.ok === false) {
    wrapApiError(res || { error: 'РћС€РёР±РєР° РјР°СЃСЃРѕРІРѕРіРѕ СЃРѕС…СЂР°РЅРµРЅРёСЏ С‚РµС…РЅРѕР»РѕРіРёР№' });
  }
  Logger.debug('DataService.apiSaveTechnologies: СЃРѕС…СЂР°РЅРµРЅРѕ', technologies?.length, 'С‚РµС…РЅРѕР»РѕРіРёР№');
}

// ========== DataService ==========

/**
 * DataService вЂ” РµРґРёРЅР°СЏ С‚РѕС‡РєР° РґРѕСЃС‚СѓРїР° Рє РґР°РЅРЅС‹Рј С‡РµСЂРµР· backend API.
 */
const DataService = {
  /**
   * Р—Р°РіСЂСѓР¶Р°РµС‚ СЃРїРёСЃРѕРє С‚РµС…РЅРѕР»РѕРіРёР№.
   * @param {number|string} [enterpriseId] вЂ” РѕРїС†РёРѕРЅР°Р»СЊРЅРѕ: С„РёР»СЊС‚СЂ РїРѕ ID РїСЂРµРґРїСЂРёСЏС‚РёСЏ
   * @returns {Promise<Array>} РјР°СЃСЃРёРІ С‚РµС…РЅРѕР»РѕРіРёР№ РІ РЅРѕСЂРјР°Р»РёР·РѕРІР°РЅРЅРѕРј С„РѕСЂРјР°С‚Рµ
   */
  async loadTechnologies(enterpriseId) {
    return apiLoadTechnologies(enterpriseId);
  },

  /**
   * Р—Р°РіСЂСѓР¶Р°РµС‚ СЃРїСЂР°РІРѕС‡РЅРёРє РїРѕ РёРјРµРЅРё.
   * @param {string} name вЂ” РёРјСЏ СЃРїСЂР°РІРѕС‡РЅРёРєР°: blocks, functions, vendors, integrators, enterprises, digitalDirections, directionToQuadrant, functionToBlock
   * @returns {Promise<Array|Object>} РґР°РЅРЅС‹Рµ СЃРїСЂР°РІРѕС‡РЅРёРєР° (РјР°СЃСЃРёРІ РёР»Рё РѕР±СЉРµРєС‚)
   */
  async loadReference(name) {
    if (!REFERENCE_NAMES.includes(name)) {
      return Promise.reject(new Error(`DataService.loadReference: РЅРµРёР·РІРµСЃС‚РЅС‹Р№ СЃРїСЂР°РІРѕС‡РЅРёРє "${name}"`));
    }
    return apiLoadReference(name);
  },

  /**
   * РЎРѕР·РґР°С‘С‚ РЅРѕРІСѓСЋ С‚РµС…РЅРѕР»РѕРіРёСЋ.
   * @param {Object} tech вЂ” РґР°РЅРЅС‹Рµ С‚РµС…РЅРѕР»РѕРіРёРё
   * @returns {Promise<Object>} СЃРѕР·РґР°РЅРЅР°СЏ С‚РµС…РЅРѕР»РѕРіРёСЏ РІ РЅРѕСЂРјР°Р»РёР·РѕРІР°РЅРЅРѕРј С„РѕСЂРјР°С‚Рµ
   */
  async createTech(tech) {
    return apiCreateTech(tech);
  },

  /**
   * РћР±РЅРѕРІР»СЏРµС‚ С‚РµС…РЅРѕР»РѕРіРёСЋ РїРѕ ID.
   * @param {number|string} id вЂ” ID С‚РµС…РЅРѕР»РѕРіРёРё
   * @param {Object} tech вЂ” РґР°РЅРЅС‹Рµ РґР»СЏ РѕР±РЅРѕРІР»РµРЅРёСЏ
   * @returns {Promise<Object>} РѕР±РЅРѕРІР»С‘РЅРЅР°СЏ С‚РµС…РЅРѕР»РѕРіРёСЏ
   */
  async updateTech(id, tech) {
    return apiUpdateTech(id, tech);
  },

  /**
   * РЈРґР°Р»СЏРµС‚ С‚РµС…РЅРѕР»РѕРіРёСЋ РїРѕ ID.
   * @param {number|string} id вЂ” ID С‚РµС…РЅРѕР»РѕРіРёРё
   * @returns {Promise<void>}
   */
  async deleteTech(id) {
    return apiDeleteTech(id);
  },

  async createTechnologyProposal(action, options) {
    return apiCreateTechnologyProposal(action, options);
  },

  async loadMyTechnologyProposals() {
    return apiLoadMyTechnologyProposals();
  },

  async loadMyTechnologyProposalHistory() {
    return apiLoadMyTechnologyProposalHistory();
  },

  async loadPendingTechnologyProposals() {
    return apiLoadPendingTechnologyProposals();
  },

  async loadTechnologyProposalHistory() {
    return apiLoadTechnologyProposalHistory();
  },

  async approveTechnologyProposal(id, reviewComment) {
    return apiReviewTechnologyProposal(id, 'approve', reviewComment);
  },

  async rejectTechnologyProposal(id, reviewComment) {
    return apiReviewTechnologyProposal(id, 'reject', reviewComment);
  },

  async postponeTechnologyProposal(id, reviewComment) {
    return apiReviewTechnologyProposal(id, 'postpone', reviewComment);
  },

  async clearMyTechnologyProposalHistory(ids) {
    return apiClearMyTechnologyProposalHistory(ids);
  },

  /**
   * Р—Р°РіСЂСѓР¶Р°РµС‚ СЃРїРёСЃРѕРє РїСЂРµРґРїСЂРёСЏС‚РёР№.
   * @returns {Promise<Array>} РјР°СЃСЃРёРІ РїСЂРµРґРїСЂРёСЏС‚РёР№
   */
  async loadEnterprises() {
    return apiLoadEnterprises();
  },

  /**
   * Р—Р°РіСЂСѓР¶Р°РµС‚ РґР°РЅРЅС‹Рµ РїРѕ РїСЂРµРґРїСЂРёСЏС‚РёСЏРј (enterpriseData: { [companyName]: technology[] }).
   * @returns {Promise<Object>}
   */
  async loadEnterpriseData() {
    return apiLoadEnterpriseData();
  },

  /**
   * РћС‡РёС‰Р°РµС‚ РєСЌС€ fetch.
   */
  clearFetchCache() {
    clearDataSourceCache();
  },

  /**
   * РЎРѕС…СЂР°РЅСЏРµС‚ СЃРїСЂР°РІРѕС‡РЅРёРє С‡РµСЂРµР· API.
   * @param {string} name вЂ” blocks, functions, functionToBlock Рё С‚.Рґ.
   * @param {Array|Object} data вЂ” РґР°РЅРЅС‹Рµ РґР»СЏ СЃРѕС…СЂР°РЅРµРЅРёСЏ
   * @returns {Promise<void>}
   */
  /**
   * РЎРѕС…СЂР°РЅСЏРµС‚ РІРµСЃСЊ РјР°СЃСЃРёРІ С‚РµС…РЅРѕР»РѕРіРёР№ (РґР»СЏ РјР°СЃСЃРѕРІС‹С… РѕРїРµСЂР°С†РёР№: РїРµСЂРµРёРјРµРЅРѕРІР°РЅРёРµ РІРµРЅРґРѕСЂР° Рё С‚.Рґ.).
   * @param {Array} technologies вЂ” РјР°СЃСЃРёРІ С‚РµС…РЅРѕР»РѕРіРёР№ РІ С„РѕСЂРјР°С‚Рµ РїСЂРёР»РѕР¶РµРЅРёСЏ
   * @returns {Promise<void>}
   */
  async saveTechnologies(technologies) {
    return apiSaveTechnologies(technologies);
  },

  async saveReference(name, data) {
    if (!REFERENCE_NAMES.includes(name)) {
      return Promise.reject(new Error(`DataService.saveReference: РЅРµРёР·РІРµСЃС‚РЅС‹Р№ СЃРїСЂР°РІРѕС‡РЅРёРє "${name}"`));
    }
    if (getUseApi()) {
      const client = getApiClient();
      if (!client || typeof client.put !== 'function') {
        throw new Error('ApiClient РЅРµРґРѕСЃС‚СѓРїРµРЅ');
      }
      const res = await client.put(`/api/v1/references/${name}`, data);
      if (!res || res.ok === false) {
        wrapApiError(res || { error: `РћС€РёР±РєР° СЃРѕС…СЂР°РЅРµРЅРёСЏ СЃРїСЂР°РІРѕС‡РЅРёРєР° ${name}` });
      }
      return;
    }
    return;
  }
};

if (typeof window !== 'undefined') {
  window.DataService = DataService;
}

export default DataService;
