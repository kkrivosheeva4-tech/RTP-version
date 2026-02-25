// data-normalize.js — ES module
// Нормализация технологий и справочников из сырых JSON.

/**
 * Строит blockIdToName и nameToBlockId из массива блоков.
 */
export function buildBlockMaps(blocks) {
    const blockIdToName = {};
    const nameToBlockId = {};
    const blocksList = Array.isArray(blocks)
      ? blocks.map(b => (b && b.name) ? b.name : b).filter(Boolean)
      : [];

    if (Array.isArray(blocks)) {
      blocks.forEach(b => {
        const id = b?.id;
        const nm = b?.name || b;
        if (nm) {
          blockIdToName[id] = nm;
          nameToBlockId[nm] = id;
        }
      });
    }

  return { blockIdToName, nameToBlockId, blocksList };
}

/**
 * Нормализует значение готовности из диапазона 1-9 в 0-3.
 */
export function normalizeReadiness(value) {
    if (value == null || value === undefined) return null;
    const num = Number(value);
    if (Number.isNaN(num)) return null;
    if (num >= 0 && num <= 3) return num;
    if (num >= 1 && num <= 9) {
      return Math.round(((num - 1) / 8) * 3);
    }
  return Math.max(0, Math.min(3, num));
}

/**
 * Преобразует технологию из формата JSON/API в формат приложения.
 * Маппинг полей: см. docs/API_FORMAT_MAPPING.md
 *
 * @param {Object} tech — сырая технология (API или JSON)
 * @param {Object} blockIdToName — маппинг id блока → имя
 * @param {Array} enterprisesData — справочник предприятий
 * @returns {Object} технология в формате приложения
 */
export function normalizeTechnologyFromNewFormat(tech, blockIdToName, enterprisesData) {
    let blockId = null;
    let blockIds = [];

    if (Array.isArray(tech.blocks) && tech.blocks.length > 0) {
      blockIds = tech.blocks.map(b => typeof b === 'number' ? b : (typeof b === 'string' ? parseInt(b, 10) : null)).filter(b => b !== null && !isNaN(b));
      blockId = blockIds.length > 0 ? blockIds[0] : null;
    } else if (typeof tech.block === 'number') {
      blockId = tech.block;
      blockIds = [tech.block];
    } else if (typeof tech.block === 'string') {
      const foundId = Object.keys(blockIdToName).find(id => blockIdToName[id] === tech.block);
      if (foundId) {
        blockId = parseInt(foundId, 10);
        blockIds = [blockId];
      }
    }

    const blockName = blockId && blockIdToName[blockId] ? blockIdToName[blockId] : (typeof tech.block === 'string' ? tech.block : '');

    const companies = [];
    const companyRatings = {};

    if (Array.isArray(tech.enterprises) && tech.enterprises.length > 0) {
      tech.enterprises.forEach(ent => {
        const enterpriseId = ent.enterpriseId;
        const enterprise = Array.isArray(enterprisesData)
          ? enterprisesData.find(e => (typeof e === 'object' && e.id) ? e.id === enterpriseId : false)
          : null;
        const companyName = enterprise
          ? (typeof enterprise === 'object' ? enterprise.name : enterprise)
          : (enterprisesData[enterpriseId - 1]
            ? (typeof enterprisesData[enterpriseId - 1] === 'object' ? enterprisesData[enterpriseId - 1].name : enterprisesData[enterpriseId - 1])
            : `Предприятие ${enterpriseId}`);

        if (companyName) {
          companies.push(companyName);
          const techReadValue = ent.technologicalReadiness !== undefined
            ? normalizeReadiness(ent.technologicalReadiness)
            : null;
          const organReadValue = ent.organizationalReadiness !== undefined
            ? normalizeReadiness(ent.organizationalReadiness)
            : null;
          const statusLower = String(ent.status || '').trim().toLowerCase();
          const isImplemented = statusLower === 'внедрена' || statusLower === 'внедренна';

          companyRatings[companyName] = {
            techRead: techReadValue,
            organRead: organReadValue,
            isImplemented: isImplemented
          };
        }
      });
    }

    let techRead = null;
    let organRead = null;
    if (companies.length === 1 && Object.keys(companyRatings).length > 0) {
      const firstCompanyName = companies[0];
      const firstCompanyRatings = companyRatings[firstCompanyName];
      if (firstCompanyRatings) {
        techRead = firstCompanyRatings.techRead;
        organRead = firstCompanyRatings.organRead;
      }
    } else if (tech.enterprises && tech.enterprises.length > 0) {
      const firstEnt = tech.enterprises[0];
      techRead = normalizeReadiness(firstEnt.technologicalReadiness);
      organRead = normalizeReadiness(firstEnt.organizationalReadiness);
    }

    let funcCover = null;
    const techBlockIds = blockIds;

    if (Array.isArray(tech.functionCoverage) && tech.functionCoverage.length > 0) {
      const funcCount = tech.functionCoverage.length;
      if (funcCount === 1) funcCover = 1;
      else if (funcCount >= 2 && funcCount <= 3) funcCover = 2;
      else if (funcCount >= 4) funcCover = 3;
    }

    const files = Array.isArray(tech.documentationFiles)
      ? tech.documentationFiles.map(path => ({ path, name: path.split('/').pop() }))
      : [];

    const blockNames = blockIds
      .map(id => blockIdToName[id] || null)
      .filter(name => name !== null);

    const normalized = {
      id: tech.id,
      name: tech.name || '',
      description: tech.description || '',
      exampleDesc: tech.marketExamples ? (Array.isArray(tech.marketExamples) ? tech.marketExamples.join('\n') : tech.marketExamples) : '',
      block: blockName,
      blocks: blockNames,
      func: tech.function || '',
      functions: Array.isArray(tech.functionCoverage) && tech.functionCoverage.length > 0
        ? tech.functionCoverage
        : (tech.function ? [tech.function] : []),
      directions: Array.isArray(tech.directions) ? tech.directions : [],
      direction: Array.isArray(tech.directions) && tech.directions.length > 0 ? tech.directions[0] : '',
      company: companies.length > 0 ? (companies.length === 1 ? companies[0] : companies) : [],
      companyRatings: Object.keys(companyRatings).length > 0 ? companyRatings : undefined,
      techRead,
      organRead,
      funcCover,
      trlStage: tech.trlStage != null ? (() => {
        const trl = Number(tech.trlStage);
        if (Number.isNaN(trl)) return null;
        if (trl >= 1 && trl <= 3) return trl;
        if (trl >= 4 && trl <= 6) return 2;
        if (trl >= 7 && trl <= 9) return 3;
        return Math.max(1, Math.min(3, trl));
      })() : null,
      status: tech.status || '',
      level: (() => {
        const techStatusNorm = String(tech.status || '').trim().toLowerCase();
        if (techStatusNorm === 'внедрена' || techStatusNorm === 'внедренна') {
          return 'Используемые';
        } else if (techStatusNorm === 'невнедренна' || techStatusNorm === 'невнедрена') {
          const trl = tech.trlStage != null ? Number(tech.trlStage) : null;
          if (trl != null && !Number.isNaN(trl)) {
            return trl >= 7 && trl <= 9 ? 'Внедряемые' : 'Перспективные';
          }
          return 'Перспективные';
        }
        return tech.status || 'Перспективные';
      })(),
      vendors: Array.isArray(tech.vendors) ? tech.vendors : [],
      integrators: Array.isArray(tech.integrators) ? tech.integrators : [],
      files,
      techType: '',
      technologicalReadiness: tech.enterprises && tech.enterprises.length > 0 ? tech.enterprises[0].technologicalReadiness : null,
      organizationalReadiness: tech.enterprises && tech.enterprises.length > 0 ? tech.enterprises[0].organizationalReadiness : null
    };

    if (Array.isArray(tech.functionCoverage) && tech.functionCoverage.length > 0 &&
        typeof window !== 'undefined' && window.FuncCoverUtils && typeof window.FuncCoverUtils.calculateFuncCover === 'function') {
      window.FuncCoverUtils.calculateFuncCover(tech.functionCoverage, techBlockIds)
        .then(calculatedFuncCover => {
          if (normalized.id === tech.id) {
            normalized.funcCover = calculatedFuncCover;
          }
        })
        .catch(() => {});
    }

    return normalized;
  }

/**
 * Строит enterpriseData (map company -> technologies[]) из массива технологий.
 */
export function buildEnterpriseDataFromTechnologies(allTechnologies) {
    const enterpriseData = {};
    allTechnologies.forEach(tech => {
      const companies = Array.isArray(tech.company) ? tech.company : (tech.company ? [tech.company] : []);
      companies.forEach(company => {
        if (!enterpriseData[company]) enterpriseData[company] = [];
        enterpriseData[company].push(tech);
      });
    });
    return enterpriseData;
  }

if (typeof window !== 'undefined') {
  window.DataNormalize = {
    buildBlockMaps,
    normalizeTechnologyFromNewFormat,
    buildEnterpriseDataFromTechnologies,
    normalizeReadiness
  };
  window.normalizeTechnologyFromNewFormat = normalizeTechnologyFromNewFormat;
  window.buildBlockMaps = buildBlockMaps;
}
