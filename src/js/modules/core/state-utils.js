// state-utils.js
// Объединенный модуль для работы с состоянием приложения
// Объединяет функциональность state-accessors.js и state-subscriptions.js

(function() {
  'use strict';

  // ===== STATE ACCESSORS =====
  // Геттеры и сеттеры для StateManager с синхронизацией window для обратной совместимости

  function getStateManager() {
    if (typeof window !== 'undefined' && window.StateManager) {
      return window.StateManager;
    }
    throw new Error('StateManager не загружен');
  }

  // Создание пары getter/setter с опциональной синхронизацией с window
  function createAccessor(key, windowKey = null, syncToWindow = false) {
    const stateKey = key;
    const winKey = windowKey || key;

    return {
      get() {
        return getStateManager().get(stateKey);
      },
      set(value) {
        getStateManager().set(stateKey, value);
        if (syncToWindow && typeof window !== 'undefined') {
          window[winKey] = value;
        }
      }
    };
  }

  // Создание всех accessors
  const accessors = {
    technologies: createAccessor('technologies', 'technologies', true),
    enterpriseData: createAccessor('enterpriseData', 'enterpriseData', true),
    enterpriseList: createAccessor('enterpriseList', 'enterpriseList', true),
    enterprisesList: createAccessor('enterprisesList', 'enterprisesList', true),
    currentEnterprise: createAccessor('currentEnterprise', 'currentEnterprise', true),
    currentZoomedQuadrant: createAccessor('currentZoomedQuadrant', 'currentZoomedQuadrant', true),
    selectedBlipId: createAccessor('selectedBlipId', null, false),
    currentTech: createAccessor('currentTech', null, false),
    blocksList: createAccessor('blocksList', 'blocksList', true),
    functions: createAccessor('functions', 'functions', true),
    nameToBlockId: createAccessor('nameToBlockId', 'nameToBlockId', true),
    functionToBlockMap: createAccessor('functionToBlockMap', 'functionToBlockMap', true),
    blockToQuadrant: createAccessor('blockToQuadrant', 'blockToQuadrant', true),
    technologiesById: createAccessor('technologiesById', null, false),
    quadrantsCache: createAccessor('quadrantsCache', null, false),
    quadrantsCacheVersion: createAccessor('quadrantsCacheVersion', null, false)
  };

  // Создание StateAccessors объекта с правильными именами функций
  const StateAccessors = {
    getTechnologies: accessors.technologies.get,
    setTechnologies: accessors.technologies.set,
    getEnterpriseData: accessors.enterpriseData.get,
    setEnterpriseData: accessors.enterpriseData.set,
    getEnterpriseList: accessors.enterpriseList.get,
    setEnterpriseList: accessors.enterpriseList.set,
    getEnterprisesList: accessors.enterprisesList.get,
    setEnterprisesList: accessors.enterprisesList.set,
    getCurrentEnterprise: accessors.currentEnterprise.get,
    setCurrentEnterprise: accessors.currentEnterprise.set,
    getCurrentZoomedQuadrant: accessors.currentZoomedQuadrant.get,
    setCurrentZoomedQuadrant: accessors.currentZoomedQuadrant.set,
    getSelectedBlipId: accessors.selectedBlipId.get,
    setSelectedBlipId: accessors.selectedBlipId.set,
    getCurrentTech: accessors.currentTech.get,
    setCurrentTech: accessors.currentTech.set,
    getBlocksList: accessors.blocksList.get,
    setBlocksList: accessors.blocksList.set,
    getFunctions: accessors.functions.get,
    setFunctions: accessors.functions.set,
    getNameToBlockId: accessors.nameToBlockId.get,
    setNameToBlockId: accessors.nameToBlockId.set,
    getFunctionToBlockMap: accessors.functionToBlockMap.get,
    setFunctionToBlockMap: accessors.functionToBlockMap.set,
    getBlockToQuadrant: accessors.blockToQuadrant.get,
    setBlockToQuadrant: accessors.blockToQuadrant.set,
    getTechnologiesById: accessors.technologiesById.get,
    getQuadrantsCache: accessors.quadrantsCache.get,
    getQuadrantsCacheVersion: accessors.quadrantsCacheVersion.get,
    setQuadrantsCacheVersion: accessors.quadrantsCacheVersion.set
  };

  // ===== STATE SUBSCRIPTIONS =====
  // Подписки на изменения состояния для синхронизации window и автоматического обновления UI

  function getDOMCache() {
    if (typeof window !== 'undefined' && window.DOMCache) {
      return window.DOMCache;
    }
    throw new Error('DOMCache не загружен');
  }

  // Проверка, открыто ли модальное окно
  function isModalOpen(DOMCache) {
    const editPanel = DOMCache.get('editTechPanel');
    const addPanel = DOMCache.get('addTechPanel');
    const isOpen = (panel) => panel && (panel.style.display === 'block' || panel.classList.contains('open'));
    return isOpen(editPanel) || isOpen(addPanel);
  }

  // Безопасное обновление радара
  function safeUpdateRadar(DOMCache) {
    if (typeof window.updateRadar !== 'function') return;

    const svgEl = DOMCache.get('techRadar');
    if (!svgEl || !svgEl.children || svgEl.children.length === 0) return;

    requestAnimationFrame(() => {
      try {
        window.updateRadar();
      } catch (e) {
        if (window.Logger) window.Logger.warn('Ошибка при автоматическом обновлении радара:', e);
      }
    });
  }

  // Инициализация подписок на изменения состояния
  function initStateSubscriptions() {
    const StateManager = getStateManager();
    const DOMCache = getDOMCache();

    // Синхронизация с window для обратной совместимости
    const syncKeys = [
      'blockToQuadrant', 'technologies', 'enterpriseData', 'currentEnterprise',
      'currentZoomedQuadrant', 'blocksList', 'functions', 'nameToBlockId', 'functionToBlockMap'
    ];

    syncKeys.forEach(key => {
      StateManager.subscribeToKey(key, (value) => {
        if (typeof window !== 'undefined') {
          window[key] = value;
        }
      });
    });

    // Обновление радара при изменении technologies
    StateManager.subscribeToKey('technologies', (newTechnologies) => {
      if (typeof window.rebuildTechnologiesIndex === 'function') {
        window.rebuildTechnologiesIndex();
      }

      // Автоматически сохраняем технологии в VFS (localStorage) при любом изменении
      try {
        if (newTechnologies && Array.isArray(newTechnologies)) {
          if (typeof window.vfsWrite === 'function') {
            window.vfsWrite('technologies.json', newTechnologies);
          } else if (window.DataLoader && typeof window.DataLoader.vfsWrite === 'function') {
            window.DataLoader.vfsWrite('technologies.json', newTechnologies);
          }
        }
      } catch (e) {
        if (window.Logger) window.Logger.warn('Не удалось сохранить technologies в VFS при изменении', e);
      }

      if (!isModalOpen(DOMCache)) {
        safeUpdateRadar(DOMCache);
      }
    });

    // Обновление радара при изменении currentEnterprise
    StateManager.subscribeToKey('currentEnterprise', () => {
      if (!isModalOpen(DOMCache)) {
        safeUpdateRadar(DOMCache);
      }
    });

    // Обновление подсветки blip'ов при изменении selectedBlipId
    StateManager.subscribeToKey('selectedBlipId', (newValue, oldValue) => {
      const svgEl = DOMCache.get('techRadar');
      if (!svgEl) return;

      if (oldValue) {
        const oldBlip = svgEl.querySelector(`[data-tech-id="${oldValue}"]`);
        if (oldBlip) oldBlip.classList.remove('selected');
      }

      if (newValue) {
        const newBlip = svgEl.querySelector(`[data-tech-id="${newValue}"]`);
        if (newBlip) newBlip.classList.add('selected');
      }
    });
  }

  // Экспорт StateSubscriptions
  const StateSubscriptions = { initStateSubscriptions };

  // Экспорт в window для обратной совместимости
  if (typeof window !== 'undefined') {
    window.StateAccessors = StateAccessors;
    // Экспорт функций в window для обратной совместимости
    Object.keys(StateAccessors).forEach(key => {
      window[key] = StateAccessors[key];
    });

    window.StateSubscriptions = StateSubscriptions;

    // Автоматическая инициализация подписок
    if (window.StateManager && window.StateAccessors) {
      const init = () => setTimeout(initStateSubscriptions, 0);

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
      } else {
        init();
      }
    }
  }
})();
