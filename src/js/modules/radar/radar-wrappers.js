// radar-wrappers.js
// Обертки для рендеринга радара

import RadarRenderer from './radar-renderer.js';
import QuadrantCache from './quadrant-cache.js';
import { DOMProxy } from '../core/dom-utils.js';

'use strict';

  // Ленивая загрузка для модулей, ещё не переведённых на ES (Utils из script.js)
  function getUtils() {
    if (typeof window !== 'undefined' && window.Utils) {
      return window.Utils;
    }
    throw new Error('Utils не загружен');
  }

  function getStateAccessors() {
    if (typeof window !== 'undefined' && window.StateAccessors) {
      return window.StateAccessors;
    }
    throw new Error('StateAccessors не загружен');
  }

  function getPositioning() {
    if (typeof window !== 'undefined' && window.Positioning) {
      return window.Positioning;
    }
    throw new Error('Positioning не загружен');
  }

  // Форма по типу технологии (используем модуль RadarRenderer)
  function computeShapeByTechType(techType) {
    const TECHTYPE_TO_SHAPE = window.TECHTYPE_TO_SHAPE || {};
    return RadarRenderer.computeShapeByTechType(techType, TECHTYPE_TO_SHAPE);
  }

  // Функции рендеринга вынесены в модуль radar-renderer.js
  // Используем обертки для обратной совместимости
  function renderRadarBackground() {
    const QuadrantCacheRef = (typeof window !== 'undefined' && window.QuadrantCache) ? window.QuadrantCache : QuadrantCache;

    // Получаем константы из window
    const SVG_NS = window.SVG_NS || "http://www.w3.org/2000/svg";
    const CENTER_X = window.CENTER_X || 500;
    const CENTER_Y = window.CENTER_Y || 500;
    const RADIUS_STEP = window.RADIUS_STEP || 140;
    const RINGS = window.RINGS || [];
    const QUADRANTS = window.QUADRANTS || [];

    // Получаем svg через DOMProxy
    const svg = DOMProxy.createDOMProxy("techRadar");

    RadarRenderer.renderRadarBackground({
      SVG_NS,
      CENTER_X,
      CENTER_Y,
      RADIUS_STEP,
      RINGS,
      QUADRANTS,
      svg,
      clearQuadrantGroupsCache: QuadrantCacheRef.clearQuadrantGroupsCache,
      polarToCartesian: window.polarToCartesian,
      describeArc: window.describeArc,
      describeWedge: window.describeWedge
    });
  }


  // Функция рендеринга радара (используем модуль)
  function renderRadar(data) {
    const StateAccessors = getStateAccessors();
    const Positioning = getPositioning();
    const QuadrantCacheRef = (typeof window !== 'undefined' && window.QuadrantCache) ? window.QuadrantCache : QuadrantCache;
    const Utils = getUtils();

    // Получаем данные
    const technologies = data || StateAccessors.getTechnologies();
    const levelToRing = window.levelToRing || {};
    const QUADRANTS = window.QUADRANTS || [];
    const TECHTYPE_TO_SHAPE = window.TECHTYPE_TO_SHAPE || {};

    // Получаем svg через DOMProxy
    const svg = DOMProxy.createDOMProxy("techRadar");

    RadarRenderer.renderRadar(technologies, {
      technologies: StateAccessors.getTechnologies(),
      levelToRing,
      QUADRANTS,
      svg,
      selectedBlipId: StateAccessors.getSelectedBlipId(),
      attachBlipHoverHandlers: window.attachBlipHoverHandlers || (() => {}),
      getAllQuadrantsForTech: Positioning.getAllQuadrantsForTech,
      assignFixedPositionForQuadrant: Positioning.assignFixedPositionForQuadrant,
      applyNonOverlappingLayout: Positioning.applyNonOverlappingLayout,
      getQuadrantGroup: QuadrantCacheRef.getQuadrantGroup,
      computeShapeByTechType,
      TECHTYPE_TO_SHAPE,
      createBlip: createBlipWrapper,
      renderRadarBackground
    });
  }

  // Обертка для createBlip из модуля
  function createBlipWrapper(tech, pos, quadrant) {
    const StateAccessors = getStateAccessors();
    const QuadrantCacheRef = (typeof window !== 'undefined' && window.QuadrantCache) ? window.QuadrantCache : QuadrantCache;
    const Utils = getUtils();

    const SVG_NS = window.SVG_NS || "http://www.w3.org/2000/svg";
    const TECHTYPE_TO_SHAPE = window.TECHTYPE_TO_SHAPE || {};

    // Получаем svg через DOMProxy
    const svg = DOMProxy.createDOMProxy("techRadar");

    // Получаем showDetail напрямую из window во время вызова, чтобы гарантировать, что функция доступна
    const showDetailFn = (typeof window.showDetail === 'function') ? window.showDetail : null;

    RadarRenderer.createBlip(tech, pos, quadrant, {
      SVG_NS,
      svg,
      getQuadrantGroup: QuadrantCacheRef.getQuadrantGroup,
      computeShapeByTechType,
      TECHTYPE_TO_SHAPE,
      starPath: window.starPath,
      isRatingFilled: Utils.isRatingFilled,
      currentEnterprise: StateAccessors.getCurrentEnterprise(),
      getTechById: window.getTechById,
      showDetail: showDetailFn
    });
  }

  // Функция создания blip'а (используем модуль)
  function createBlip(tech, pos, quadrant = null) {
    createBlipWrapper(tech, pos, quadrant);
  }

  // Экспорт модуля
  const RadarWrappers = {
    computeShapeByTechType,
    renderRadarBackground,
    renderRadar,
    createBlipWrapper,
    createBlip
  };

  if (typeof window !== 'undefined') {
    window.RadarWrappers = RadarWrappers;
    window.computeShapeByTechType = computeShapeByTechType;
    window.renderRadarBackground = renderRadarBackground;
    window.renderRadar = renderRadar;
    window.createBlipWrapper = createBlipWrapper;
    window.createBlip = createBlip;
  }

  export default RadarWrappers;
  export { computeShapeByTechType, renderRadarBackground, renderRadar, createBlipWrapper, createBlip };
