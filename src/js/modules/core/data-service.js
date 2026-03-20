/**
 * DataService — слой абстракции для переключения между mock (JSON + VFS) и API.
 * Этап 9.3: реализация переключения mock / API.
 *
 * @module data-service
 */

import { vfsRead, vfsWrite, loadJsonPreferVfs, clearFetchCache as clearDataSourceCache } from './data-source.js';
import { buildBlockMaps, normalizeTechnologyFromNewFormat, buildEnterpriseDataFromTechnologies } from './data-normalize.js';
import Logger from './logger.js';

/** Имена справочников, доступных через loadReference */
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

/** Маппинг имён справочников на имена файлов */
const REFERENCE_TO_FILE = {
  blocks: 'blocks.json',
  functions: 'functions.json',
  functionToBlock: 'functionToBlock.json',
  digitalDirections: 'digitalDirections.json',
  directionToQuadrant: 'directionToQuadrant.json',
  vendors: 'vendors.json',
  integrators: 'integrators.json',
  enterprises: 'enterprises.json',
  enterprisesBlocksMapping: 'enterprises-blocks-mapping.json'
};

function getUseApi() {
  if (typeof window !== 'undefined' && window.ApiConfig && typeof window.ApiConfig.getUseApi === 'function') {
    return window.ApiConfig.getUseApi();
  }
  return false;
}

function getApiClient() {
  if (typeof window !== 'undefined' && window.ApiClient) {
    return window.ApiClient;
  }
  return null;
}

/**
 * Унифицированная обработка ошибок API.
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
  throw new Error(String(err || 'Неизвестная ошибка'));
}

function getStateValue(key, fallback = null) {
  try {
    if (typeof window !== 'undefined' && window.StateManager && typeof window.StateManager.get === 'function') {
      const value = window.StateManager.get(key);
      return value == null ? fallback : value;
    }
  } catch (e) {
    Logger.warn(`DataService: ошибка чтения state "${key}"`, e);
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
  if (isImplemented === true) return 'Внедрена';
  if (isImplemented === false) return 'Невнедренна';
  if (norm === 'внедрена' || norm === 'внедренна') return 'Внедрена';
  if (norm === 'невнедрена' || norm === 'невнедренна') return 'Невнедренна';
  if (norm === 'используемые') return 'Внедрена';
  if (norm === 'внедряемые' || norm === 'перспективные') return 'Невнедренна';
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

// ========== MOCK-РЕЖИМ (USE_API === false) ==========

async function mockLoadReference(name) {
  const filename = REFERENCE_TO_FILE[name] || `${name}.json`;
  if (name === 'enterprisesBlocksMapping') {
    const fromVfs = vfsRead(filename);
    if (fromVfs !== null && fromVfs !== undefined && typeof fromVfs === 'object') {
      return fromVfs;
    }
  }
  const result = await loadJsonPreferVfs(filename, true);
  if (result && result.data !== null && result.data !== undefined) {
    return result.data;
  }
  const fromVfs = vfsRead(filename);
  if (fromVfs !== null) {
    return fromVfs;
  }
  if (name === 'technologies' || filename === 'technologies.json') {
    return [];
  }
  if (['functionToBlock', 'directionToQuadrant'].includes(name)) {
    return {};
  }
  return [];
}

async function mockLoadTechnologies(enterpriseId) {
  const [blocksData, enterprisesData] = await Promise.all([
    mockLoadReference('blocks'),
    mockLoadReference('enterprises')
  ]);

  const blocks = Array.isArray(blocksData) ? blocksData : (blocksData && typeof blocksData === 'object' ? [] : []);
  const { blockIdToName } = buildBlockMaps(blocks);
  const enterprises = Array.isArray(enterprisesData) ? enterprisesData : [];

  const techResult = await loadJsonPreferVfs('technologies.json', true);
  let rawTechs = (techResult && techResult.data && Array.isArray(techResult.data)) ? techResult.data : null;
  let fromFile = !!(rawTechs && rawTechs.length > 0);

  if (!rawTechs || rawTechs.length === 0) {
    rawTechs = vfsRead('technologies.json');
    if (!Array.isArray(rawTechs)) rawTechs = [];
  }

  const normalizeTech = normalizeTechnologyFromNewFormat;
  let allTechnologies = fromFile
    ? rawTechs.map(tech => normalizeTech(tech, blockIdToName, enterprises))
    : rawTechs;

  if (enterpriseId != null && enterpriseId !== '') {
    const eId = Number(enterpriseId);
    const enterprise = enterprises.find(e => (e && (e.id === eId || e.id === enterpriseId)));
    const companyName = enterprise ? (enterprise.name || enterprise) : null;
    if (companyName) {
      allTechnologies = allTechnologies.filter(t => {
        const companies = Array.isArray(t.company) ? t.company : (t.company ? [t.company] : []);
        return companies.includes(companyName);
      });
    }
  }

  return allTechnologies;
}

async function mockLoadEnterprises() {
  return mockLoadReference('enterprises');
}

async function mockLoadEnterpriseData() {
  const techs = await mockLoadTechnologies();
  return buildEnterpriseDataFromTechnologies(techs);
}

async function mockCreateTech(tech) {
  const raw = vfsRead('technologies.json');
  const technologies = Array.isArray(raw) ? raw : [];
  const maxId = technologies.length > 0 ? Math.max(...technologies.map(t => Number(t.id) || 0)) : 0;
  const newTech = { ...tech, id: tech.id != null ? tech.id : maxId + 1 };
  technologies.push(newTech);
  if (!vfsWrite('technologies.json', technologies)) {
    throw new Error('Не удалось сохранить технологии в VFS');
  }
  Logger.debug('DataService.mockCreateTech: создана технология', newTech.id);
  return newTech;
}

async function mockUpdateTech(id, tech) {
  const raw = vfsRead('technologies.json');
  const technologies = Array.isArray(raw) ? [...raw] : [];
  const idx = technologies.findIndex(t => String(t.id) === String(id));
  if (idx < 0) {
    throw new Error(`Технология с id=${id} не найдена`);
  }
  const updated = { ...technologies[idx], ...tech, id: technologies[idx].id };
  technologies[idx] = updated;
  if (!vfsWrite('technologies.json', technologies)) {
    throw new Error('Не удалось сохранить технологии в VFS');
  }
  Logger.debug('DataService.mockUpdateTech: обновлена технология', id);
  return updated;
}

async function mockDeleteTech(id) {
  const raw = vfsRead('technologies.json');
  const technologies = Array.isArray(raw) ? raw : [];
  const filtered = technologies.filter(t => String(t.id) !== String(id));
  if (filtered.length === technologies.length) {
    throw new Error(`Технология с id=${id} не найдена`);
  }
  if (!vfsWrite('technologies.json', filtered)) {
    throw new Error('Не удалось сохранить технологии в VFS');
  }
  Logger.debug('DataService.mockDeleteTech: удалена технология', id);
}

async function mockSaveReference(name, data) {
  const filename = REFERENCE_TO_FILE[name] || `${name}.json`;
  if (!vfsWrite(filename, data)) {
    throw new Error(`Не удалось сохранить ${filename} в VFS`);
  }
  Logger.debug('DataService.mockSaveReference:', filename);
}

async function mockSaveTechnologies(technologies) {
  if (!Array.isArray(technologies)) {
    throw new Error('saveTechnologies: ожидается массив технологий');
  }
  if (!vfsWrite('technologies.json', technologies)) {
    throw new Error('Не удалось сохранить технологии в VFS');
  }
  Logger.debug('DataService.mockSaveTechnologies: сохранено', technologies.length, 'технологий');
}

// ========== API-РЕЖИМ (USE_API === true) ==========

async function apiLoadReference(name) {
  const client = getApiClient();
  if (!client || typeof client.get !== 'function') {
    throw new Error('ApiClient недоступен');
  }
  const path = `/api/v1/references/${name}`;
  const res = await client.get(path);
  if (!res || res.ok === false) {
    wrapApiError(res || { error: 'Ошибка загрузки справочника' });
  }
  return res && res.data != null ? res.data : (Array.isArray(res) ? res : []);
}

async function apiLoadTechnologies(enterpriseId) {
  const client = getApiClient();
  if (!client || typeof client.get !== 'function') {
    throw new Error('ApiClient недоступен');
  }
  let path = '/api/v1/technologies';
  const query = enterpriseId != null && enterpriseId !== '' ? { enterpriseId } : {};
  const res = await client.get(path, Object.keys(query).length ? query : undefined);
  if (!res || res.ok === false) {
    wrapApiError(res || { error: 'Ошибка загрузки технологий' });
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
    throw new Error('ApiClient недоступен');
  }
  const payload = toApiTechnologyPayload(tech);
  delete payload.id;
  const res = await client.post('/api/v1/technologies', payload);
  if (!res || res.ok === false) {
    wrapApiError(res || { error: 'Ошибка создания технологии' });
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
    throw new Error('ApiClient недоступен');
  }
  const method = client.patch || client.put;
  const payload = toApiTechnologyPayload({ ...tech, id });
  const res = await method(`/api/v1/technologies/${id}`, payload);
  if (!res || res.ok === false) {
    wrapApiError(res || { error: 'Ошибка обновления технологии' });
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
    throw new Error('ApiClient недоступен');
  }
  const res = await client.delete(`/api/v1/technologies/${id}`);
  if (!res || res.ok === false) {
    wrapApiError(res || { error: 'Ошибка удаления технологии' });
  }
}

async function apiCreateTechnologyProposal(action, options) {
  const client = getApiClient();
  if (!client || typeof client.post !== 'function') {
    throw new Error('ApiClient недоступен');
  }
  const normalizedAction = String(action || '').trim().toLowerCase();
  const payload = {
    action: normalizedAction
  };
  const technologyId = options && options.technologyId != null ? Number(options.technologyId) : null;
  if (Number.isInteger(technologyId) && technologyId > 0) {
    payload.technologyId = technologyId;
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
    wrapApiError(res || { error: 'Ошибка создания предложения' });
  }
  return res && res.data != null ? res.data : res;
}

async function apiLoadMyTechnologyProposals() {
  const client = getApiClient();
  if (!client || typeof client.get !== 'function') {
    throw new Error('ApiClient недоступен');
  }
  const res = await client.get('/api/v1/technology-proposals/mine');
  if (!res || res.ok === false) {
    wrapApiError(res || { error: 'Ошибка загрузки моих предложений' });
  }
  return Array.isArray(res && res.data) ? res.data : [];
}

async function apiLoadPendingTechnologyProposals() {
  const client = getApiClient();
  if (!client || typeof client.get !== 'function') {
    throw new Error('ApiClient недоступен');
  }
  const res = await client.get('/api/v1/technology-proposals/pending');
  if (!res || res.ok === false) {
    wrapApiError(res || { error: 'Ошибка загрузки предложений на ревью' });
  }
  return Array.isArray(res && res.data) ? res.data : [];
}

async function apiReviewTechnologyProposal(id, decision, reviewComment) {
  const client = getApiClient();
  if (!client || typeof client.post !== 'function') {
    throw new Error('ApiClient недоступен');
  }
  const normalizedDecision = String(decision || '').trim().toLowerCase();
  const res = await client.post(`/api/v1/technology-proposals/${id}/${normalizedDecision}`, {
    review_comment: typeof reviewComment === 'string' ? reviewComment.trim() : ''
  });
  if (!res || res.ok === false) {
    wrapApiError(res || { error: 'Ошибка обработки предложения' });
  }
  return res && res.data != null ? res.data : res;
}

async function apiSaveTechnologies(technologies) {
  const client = getApiClient();
  if (!client || typeof client.put !== 'function') {
    throw new Error('ApiClient недоступен');
  }
  const payload = Array.isArray(technologies)
    ? technologies.map((t) => toApiTechnologyPayload(t)).filter((t) => t && t.name)
    : [];
  const res = await client.put('/api/v1/technologies/bulk', payload);
  if (!res || res.ok === false) {
    wrapApiError(res || { error: 'Ошибка массового сохранения технологий' });
  }
  Logger.debug('DataService.apiSaveTechnologies: сохранено', technologies?.length, 'технологий');
}

// ========== DataService ==========

/**
 * DataService — единая точка доступа к данным (mock или API).
 */
const DataService = {
  /**
   * Загружает список технологий.
   * @param {number|string} [enterpriseId] — опционально: фильтр по ID предприятия
   * @returns {Promise<Array>} массив технологий в нормализованном формате
   */
  async loadTechnologies(enterpriseId) {
    if (getUseApi()) {
      return apiLoadTechnologies(enterpriseId);
    }
    return mockLoadTechnologies(enterpriseId);
  },

  /**
   * Загружает справочник по имени.
   * @param {string} name — имя справочника: blocks, functions, vendors, integrators, enterprises, digitalDirections, directionToQuadrant, functionToBlock
   * @returns {Promise<Array|Object>} данные справочника (массив или объект)
   */
  async loadReference(name) {
    if (!REFERENCE_NAMES.includes(name)) {
      return Promise.reject(new Error(`DataService.loadReference: неизвестный справочник "${name}"`));
    }
    if (getUseApi()) {
      return apiLoadReference(name);
    }
    return mockLoadReference(name);
  },

  /**
   * Создаёт новую технологию.
   * @param {Object} tech — данные технологии
   * @returns {Promise<Object>} созданная технология в нормализованном формате
   */
  async createTech(tech) {
    if (getUseApi()) {
      return apiCreateTech(tech);
    }
    return mockCreateTech(tech);
  },

  /**
   * Обновляет технологию по ID.
   * @param {number|string} id — ID технологии
   * @param {Object} tech — данные для обновления
   * @returns {Promise<Object>} обновлённая технология
   */
  async updateTech(id, tech) {
    if (getUseApi()) {
      return apiUpdateTech(id, tech);
    }
    return mockUpdateTech(id, tech);
  },

  /**
   * Удаляет технологию по ID.
   * @param {number|string} id — ID технологии
   * @returns {Promise<void>}
   */
  async deleteTech(id) {
    if (getUseApi()) {
      return apiDeleteTech(id);
    }
    return mockDeleteTech(id);
  },

  async createTechnologyProposal(action, options) {
    if (getUseApi()) {
      return apiCreateTechnologyProposal(action, options);
    }
    return Promise.reject(new Error('Moderation flow доступен только в API режиме'));
  },

  async loadMyTechnologyProposals() {
    if (getUseApi()) {
      return apiLoadMyTechnologyProposals();
    }
    return Promise.resolve([]);
  },

  async loadPendingTechnologyProposals() {
    if (getUseApi()) {
      return apiLoadPendingTechnologyProposals();
    }
    return Promise.resolve([]);
  },

  async approveTechnologyProposal(id, reviewComment) {
    if (getUseApi()) {
      return apiReviewTechnologyProposal(id, 'approve', reviewComment);
    }
    return Promise.reject(new Error('Moderation flow доступен только в API режиме'));
  },

  async rejectTechnologyProposal(id, reviewComment) {
    if (getUseApi()) {
      return apiReviewTechnologyProposal(id, 'reject', reviewComment);
    }
    return Promise.reject(new Error('Moderation flow доступен только в API режиме'));
  },

  /**
   * Загружает список предприятий.
   * @returns {Promise<Array>} массив предприятий
   */
  async loadEnterprises() {
    if (getUseApi()) {
      return apiLoadEnterprises();
    }
    return mockLoadEnterprises();
  },

  /**
   * Загружает данные по предприятиям (enterpriseData: { [companyName]: technology[] }).
   * @returns {Promise<Object>}
   */
  async loadEnterpriseData() {
    if (getUseApi()) {
      return apiLoadEnterpriseData();
    }
    return mockLoadEnterpriseData();
  },

  /**
   * Очищает кэш fetch (для mock-режима; вызывается при принудительной перезагрузке).
   */
  clearFetchCache() {
    clearDataSourceCache();
  },

  /**
   * Сохраняет справочник (mock: vfsWrite; API: PUT).
   * @param {string} name — blocks, functions, functionToBlock и т.д.
   * @param {Array|Object} data — данные для сохранения
   * @returns {Promise<void>}
   */
  /**
   * Сохраняет весь массив технологий (для массовых операций: переименование вендора и т.д.).
   * @param {Array} technologies — массив технологий в формате приложения
   * @returns {Promise<void>}
   */
  async saveTechnologies(technologies) {
    if (getUseApi()) {
      return apiSaveTechnologies(technologies);
    }
    return mockSaveTechnologies(technologies);
  },

  async saveReference(name, data) {
    if (!REFERENCE_NAMES.includes(name)) {
      return Promise.reject(new Error(`DataService.saveReference: неизвестный справочник "${name}"`));
    }
    if (getUseApi()) {
      const client = getApiClient();
      if (!client || typeof client.put !== 'function') {
        throw new Error('ApiClient недоступен');
      }
      const res = await client.put(`/api/v1/references/${name}`, data);
      if (!res || res.ok === false) {
        wrapApiError(res || { error: `Ошибка сохранения справочника ${name}` });
      }
      return;
    }
    return mockSaveReference(name, data);
  }
};

if (typeof window !== 'undefined') {
  window.DataService = DataService;
}

export default DataService;
