// data-indexing.js
// Объединенный модуль для индексации данных и технологий
// Объединяет функциональность data-index.js и tech-index.js

(function() {
  'use strict';

  // ===== DATA INDEX =====
  // Быстрый доступ к технологиям по ключам.
  // API: build(list), getById(id), getBy(predicate), filter(fn), byBlock, byStatus, byCompany

  let byId = new Map();
  let byBlock = new Map();
  let byStatus = new Map();
  let byCompany = new Map();

  // Добавление элемента в индекс по ключу
  function indexMap(map, key, item) {
    if (!key) return;
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key).push(item);
  }

  // Индексация технологии
  function indexTechnology(tech) {
    if (!tech || tech.id == null) return;

    const id = Number(tech.id);
    byId.set(id, tech);

    if (tech.block) {
      indexMap(byBlock, tech.block, tech);
    }

    const status = tech.level || tech.status;
    if (status) {
      indexMap(byStatus, status, tech);
    }

    if (tech.company) {
      const companies = Array.isArray(tech.company) ? tech.company : [tech.company];
      companies.filter(Boolean).forEach(c => indexMap(byCompany, c, tech));
    }
  }

  const DataIndex = {
    build(list) {
      // Очистка индексов
      byId.clear();
      byBlock.clear();
      byStatus.clear();
      byCompany.clear();

      if (!Array.isArray(list)) return;

      list.forEach(indexTechnology);
    },

    getById(id) {
      return byId.get(Number(id)) || null;
    },

    filter(fn) {
      return Array.from(byId.values()).filter(fn);
    },

    getBy(predicate) {
      return Array.from(byId.values()).find(predicate) || null;
    },

    byBlock(key) {
      return byBlock.get(key) || [];
    },

    byStatus(key) {
      return byStatus.get(key) || [];
    },

    byCompany(key) {
      return byCompany.get(key) || [];
    }
  };

  // ===== TECH INDEX =====
  // Функции для работы с индексом технологий

  function getStateAccessors() {
    if (typeof window !== 'undefined' && window.StateAccessors) {
      return window.StateAccessors;
    }
    throw new Error('StateAccessors не загружен');
  }

  function getStateManager() {
    if (typeof window !== 'undefined' && window.StateManager) {
      return window.StateManager;
    }
    throw new Error('StateManager не загружен');
  }

  // Обновить индекс технологий по id
  function rebuildTechnologiesIndex() {
    const StateAccessors = getStateAccessors();
    const StateManager = getStateManager();

    let technologiesById = StateAccessors.getTechnologiesById();

    // Инициализация, если не существует
    if (!technologiesById || !(technologiesById instanceof Map)) {
      technologiesById = new Map();
      StateManager.set('technologiesById', technologiesById);
    }

    technologiesById.clear();

    const technologies = StateAccessors.getTechnologies();
    if (Array.isArray(technologies)) {
      technologies.forEach(tech => {
        if (tech && tech.id != null) {
          technologiesById.set(tech.id, tech);
        }
      });
    }

    // Обновление DataIndex
    try {
      DataIndex.build(technologies || []);
    } catch (e) {
      if (window.Logger) window.Logger.warn('DataIndex.build failed', e);
    }
  }

  // Быстрый поиск технологии по id (O(1))
  function getTechById(id) {
    const StateAccessors = getStateAccessors();
    const technologiesById = StateAccessors.getTechnologiesById();

    if (!technologiesById || !(technologiesById instanceof Map)) {
      return null;
    }

    return technologiesById.get(id) || null;
  }

  // Экспорт TechIndex
  const TechIndex = {
    rebuildTechnologiesIndex,
    getTechById
  };

  // Экспорт в window для обратной совместимости
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DataIndex, TechIndex };
  } else if (typeof window !== 'undefined') {
    window.DataIndex = DataIndex;
    window.TechIndex = TechIndex;
    // Глобальные алиасы для обратной совместимости
    window.rebuildTechnologiesIndex = rebuildTechnologiesIndex;
    window.getTechById = getTechById;
  }
})();
