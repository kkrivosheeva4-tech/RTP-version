// state-utils.js — ES module
// Объединенный модуль для работы с состоянием приложения (StateAccessors + StateSubscriptions)

import StateManager from './state-manager.js';
import { DOMCache } from './dom-utils.js';

'use strict';

  // ===== STATE ACCESSORS =====
  // Геттеры и сеттеры для StateManager с синхронизацией window для обратной совместимости

  function getStateManager() {
    return StateManager;
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
    quadrantsCacheVersion: createAccessor('quadrantsCacheVersion', null, false),
    enterpriseIdToBlockIds: createAccessor('enterpriseIdToBlockIds', null, false),
    blockIdToEnterpriseIds: createAccessor('blockIdToEnterpriseIds', null, false)
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
    setQuadrantsCacheVersion: accessors.quadrantsCacheVersion.set,
    getEnterpriseIdToBlockIds: accessors.enterpriseIdToBlockIds.get,
    getBlockIdToEnterpriseIds: accessors.blockIdToEnterpriseIds.get
  };

  // ===== STATE SUBSCRIPTIONS =====
  // Подписки на изменения состояния для синхронизации window и автоматического обновления UI

  function getDOMCacheRef() {
    return DOMCache;
  }

  function isApiModeEnabled() {
    try {
      return !!(
        typeof window !== 'undefined'
        && window.ApiConfig
        && typeof window.ApiConfig.getUseApi === 'function'
        && window.ApiConfig.getUseApi()
      );
    } catch (e) {
      return false;
    }
  }

  // Проверка, открыто ли модальное окно
  function isModalOpen(DOMCacheRef) {
    const editPanel = DOMCacheRef.get('editTechPanel');
    const addPanel = DOMCacheRef.get('addTechPanel');
    const isOpen = (panel) => panel && (panel.style.display === 'block' || panel.classList.contains('open'));
    return isOpen(editPanel) || isOpen(addPanel);
  }

  // Безопасное обновление радара
  // ИСПРАВЛЕНО: не проверяем svgEl.children — при первой загрузке данных SVG пуст,
  // но updateRadar/renderRadar сами создадут фон и blip'ы
  function safeUpdateRadar(DOMCacheRef) {
    if (typeof window.updateRadar !== 'function') return;
    const isRadarPage = typeof window !== 'undefined' && (
      window.location.pathname === '/radar/' ||
      window.location.pathname === '/radar' ||
      window.location.pathname.includes('radar.html') ||
      window.location.href.includes('radar.html')
    );
    if (!isRadarPage) return;

    const svgEl = DOMCacheRef.get('techRadar');
    if (!svgEl) return;

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
    const SM = getStateManager();
    const DOMCacheRef = getDOMCacheRef();

    // Синхронизация с window для обратной совместимости
    const syncKeys = [
      'blockToQuadrant', 'technologies', 'enterpriseData', 'currentEnterprise',
      'currentZoomedQuadrant', 'blocksList', 'functions', 'nameToBlockId', 'functionToBlockMap'
    ];

    syncKeys.forEach(key => {
      SM.subscribeToKey(key, (value) => {
        if (typeof window !== 'undefined') {
          window[key] = value;
        }
      });
    });

    // Обновление радара при изменении technologies
    SM.subscribeToKey('technologies', (newTechnologies) => {
      if (typeof window.rebuildTechnologiesIndex === 'function') {
        window.rebuildTechnologiesIndex();
      }

      // ОБНОВЛЕНО (2026-01-29): Очищаем кеш позиций при изменении данных
      if (window.Positioning && typeof window.Positioning.clearPositionCache === 'function') {
        window.Positioning.clearPositionCache();
      }

      // Сохранение выполняется только через явные CRUD/bulk вызовы API.

      if (!isModalOpen(DOMCacheRef)) {
        safeUpdateRadar(DOMCacheRef);
      }
    });

    // Обновление радара при изменении currentEnterprise
    SM.subscribeToKey('currentEnterprise', () => {
      if (!isModalOpen(DOMCacheRef)) {
        safeUpdateRadar(DOMCacheRef);
      }
    });

    // Обновление подсветки blip'ов при изменении selectedBlipId
    SM.subscribeToKey('selectedBlipId', (newValue, oldValue) => {
      const svgEl = DOMCacheRef.get('techRadar');
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

  if (typeof window !== 'undefined') {
    window.StateAccessors = StateAccessors;
    Object.keys(StateAccessors).forEach(key => {
      window[key] = StateAccessors[key];
    });
    window.StateSubscriptions = StateSubscriptions;
    const init = () => setTimeout(initStateSubscriptions, 0);
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  }

  export default StateAccessors;
  export { StateAccessors, StateSubscriptions };
