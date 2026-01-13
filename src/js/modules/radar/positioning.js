// Модуль позиционирования blip'ов на радаре
// Экспортирует функции в window.Positioning для использования в RMK2.js
// Использует глобальные переменные из RMK2.js: CENTER_X, CENTER_Y, RADIUS_STEP,
// POSITION_PAD, POSITION_ANGLE_PAD, MIN_BLIP_DISTANCE, RING_LABEL_WIDTH,
// RING_LABEL_HEIGHT, QUADRANTS, RINGS, levelToRing, blockToQuadrant
// Использует функции из radar-utils.js: polarToCartesian, cartesianToPolar

(function() {
  'use strict';

  // Вспомогательная функция для дробной части
  function frac(n) {
    return n - Math.floor(n);
  }

  // Получить id квадранта для блока
  function getQuadrantIdForBlock(blockKey) {
    if (!blockKey || !window.blockToQuadrant) return null;
    const m = window.blockToQuadrant[blockKey];
    if (Array.isArray(m)) return m.length ? m[0] : null;
    return (typeof m === 'number') ? m : null;
  }

  // Получить все квадранты для блока
  function getQuadrantsForBlock(blockKey) {
    if (!blockKey || !window.blockToQuadrant) return [];
    const m = window.blockToQuadrant[blockKey];
    if (m == null) return [];
    if (Array.isArray(m)) return m.filter(q => typeof q === 'number');
    if (typeof m === 'number') return [m];
    return [];
  }

  // Получить все уникальные квадранты для технологии
  function getAllQuadrantsForTech(tech) {
    if (!tech) return [];
    const quadrantsSet = new Set();

    const blocks = Array.isArray(tech.blocks) && tech.blocks.length
      ? tech.blocks
      : (tech.block ? [tech.block] : []);

    blocks.forEach(blockKey => {
      const blockQuadrants = getQuadrantsForBlock(blockKey);
      blockQuadrants.forEach(q => quadrantsSet.add(q));
    });

    return Array.from(quadrantsSet);
  }

  // Рассчитать позицию технологии
  function assignFixedPosition(tech) {
    const CENTER_X = window.CENTER_X || 500;
    const CENTER_Y = window.CENTER_Y || 500;
    const RADIUS_STEP = window.RADIUS_STEP || 140;
    const POSITION_PAD = window.POSITION_PAD || 30;
    const POSITION_ANGLE_PAD = window.POSITION_ANGLE_PAD || 8;
    const QUADRANTS = window.QUADRANTS || [];
    const levelToRing = window.levelToRing || {};

    const blockKey = (tech.blocks && tech.blocks.length) ? tech.blocks[0] : tech.block;
    const quadrantId = getQuadrantIdForBlock(blockKey);
    const ringIndex = levelToRing[tech.level];
    if (quadrantId == null || ringIndex == null) return { x: CENTER_X, y: CENTER_Y };
    const q = QUADRANTS.find(q => q.id === quadrantId);
    if (!q) return { x: CENTER_X, y: CENTER_Y };

    const PAD = POSITION_PAD;
    const ANGLE_PAD = POSITION_ANGLE_PAD;
    const ANGLE_SPAN = 90 - (ANGLE_PAD * 2);
    const aBase = q.startAngle + ANGLE_PAD;
    const rMin = ringIndex * RADIUS_STEP + PAD;
    const rMax = (ringIndex + 1) * RADIUS_STEP - PAD;
    const id = Number(tech.id) || 0;
    const GOLDEN_ANGLE = 137.50776405003785;
    const PHI_FRAC = 0.6180339887498949;
    const angleOffset = ((id * GOLDEN_ANGLE) % ANGLE_SPAN);
    const angle = aBase + angleOffset;
    const rFrac = frac(id * PHI_FRAC + ringIndex * 0.173 + quadrantId * 0.317);
    const radius = rMin + rFrac * (rMax - rMin);
    const p = window.polarToCartesian(CENTER_X, CENTER_Y, radius, angle);
    return { x: Math.round(p.x), y: Math.round(p.y) };
  }

  // Рассчитать позицию технологии для конкретного квадранта
  function assignFixedPositionForQuadrant(tech, targetQuadrant) {
    const CENTER_X = window.CENTER_X || 500;
    const CENTER_Y = window.CENTER_Y || 500;
    const RADIUS_STEP = window.RADIUS_STEP || 140;
    const POSITION_PAD = window.POSITION_PAD || 30;
    const POSITION_ANGLE_PAD = window.POSITION_ANGLE_PAD || 8;
    const QUADRANTS = window.QUADRANTS || [];
    const levelToRing = window.levelToRing || {};

    if (!tech || targetQuadrant == null) {
      return assignFixedPosition(tech);
    }

    const blocks = Array.isArray(tech.blocks) && tech.blocks.length
      ? tech.blocks
      : (tech.block ? [tech.block] : []);

    let blockKey = null;
    for (const block of blocks) {
      const blockQuadrants = getQuadrantsForBlock(block);
      if (blockQuadrants.includes(targetQuadrant)) {
        blockKey = block;
        break;
      }
    }

    if (!blockKey) {
      return assignFixedPosition(tech);
    }

    const ringIndex = levelToRing[tech.level];
    if (ringIndex == null) return { x: CENTER_X, y: CENTER_Y };

    const q = QUADRANTS.find(q => q.id === targetQuadrant);
    if (!q) return { x: CENTER_X, y: CENTER_Y };

    const PAD = POSITION_PAD;
    const ANGLE_PAD = POSITION_ANGLE_PAD;
    const ANGLE_SPAN = 90 - (ANGLE_PAD * 2);
    const aBase = q.startAngle + ANGLE_PAD;
    const rMin = ringIndex * RADIUS_STEP + PAD;
    const rMax = (ringIndex + 1) * RADIUS_STEP - PAD;
    const id = Number(tech.id) || 0;
    const GOLDEN_ANGLE = 137.50776405003785;
    const PHI_FRAC = 0.6180339887498949;

    const blockHash = String(blockKey).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const angleOffset = ((id * GOLDEN_ANGLE + blockHash * 37) % ANGLE_SPAN);
    const angle = aBase + angleOffset;
    const rFrac = frac(id * PHI_FRAC + ringIndex * 0.173 + targetQuadrant * 0.317 + blockHash * 0.041);
    const radius = rMin + rFrac * (rMax - rMin);
    const p = window.polarToCartesian(CENTER_X, CENTER_Y, radius, angle);
    return { x: Math.round(p.x), y: Math.round(p.y) };
  }

  // Рассчитать координаты для технологии и записать в объект
  function computeCoordinates(tech) {
    const pos = assignFixedPosition(tech);
    tech.x = pos.x;
    tech.y = pos.y;
    return tech;
  }

  // Разведение точек внутри каждого сектора и кольца
  function applyNonOverlappingLayout(renderData) {
    const CENTER_X = window.CENTER_X || 500;
    const CENTER_Y = window.CENTER_Y || 500;
    const RADIUS_STEP = window.RADIUS_STEP || 140;
    const POSITION_PAD = window.POSITION_PAD || 30;
    const POSITION_ANGLE_PAD = window.POSITION_ANGLE_PAD || 8;
    const MIN_BLIP_DISTANCE = window.MIN_BLIP_DISTANCE || 28;
    const QUADRANTS = window.QUADRANTS || [];

    if (!Array.isArray(renderData) || !renderData.length) return;
    if (!Array.isArray(QUADRANTS) || !QUADRANTS.length) return;

    const quadrantById = {};
    QUADRANTS.forEach(q => {
      if (q && typeof q.id !== 'undefined') quadrantById[q.id] = q;
    });

    const groups = new Map();
    renderData.forEach(t => {
      if (t == null || t.quadrant == null || t.ring == null) return;
      const key = `${t.quadrant}|${t.ring}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(t);
    });

    const MAX_ITER = 80;

    function clampToSectorRing(t) {
      const q = quadrantById[t.quadrant];
      if (!q) return;
      const ringIndex = t.ring;
      const PAD = POSITION_PAD;
      const ANGLE_PAD = POSITION_ANGLE_PAD;
      const ANGLE_SPAN = 90 - (ANGLE_PAD * 2);

      const rMin = ringIndex * RADIUS_STEP + PAD;
      const rMax = (ringIndex + 1) * RADIUS_STEP - PAD;
      const angleMin = q.startAngle + ANGLE_PAD;
      const angleMax = angleMin + ANGLE_SPAN;

      const polar = window.cartesianToPolar(CENTER_X, CENTER_Y, t.x, t.y);
      let radius = polar.radius;
      let angle = polar.angle;

      if (!Number.isFinite(radius)) radius = (rMin + rMax) / 2;
      if (!Number.isFinite(angle)) angle = (angleMin + angleMax) / 2;

      if (radius < rMin) radius = rMin;
      if (radius > rMax) radius = rMax;
      if (angle < angleMin) angle = angleMin;
      if (angle > angleMax) angle = angleMax;

      const p = window.polarToCartesian(CENTER_X, CENTER_Y, radius, angle);
      t.x = Math.round(p.x);
      t.y = Math.round(p.y);
    }

    for (const group of groups.values()) {
      if (!group || group.length <= 1) continue;

      group.forEach(t => {
        if (typeof t.x !== 'number' || typeof t.y !== 'number' || isNaN(t.x) || isNaN(t.y)) {
          const pos = assignFixedPosition(t);
          t.x = pos.x;
          t.y = pos.y;
        }
        clampToSectorRing(t);
      });

      const MIN_BLIP_DISTANCE_SQ = MIN_BLIP_DISTANCE * MIN_BLIP_DISTANCE;
      for (let iter = 0; iter < MAX_ITER; iter++) {
        let moved = false;
        for (let i = 0; i < group.length; i++) {
          for (let j = i + 1; j < group.length; j++) {
            const a = group[i];
            const b = group[j];
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const distSq = dx * dx + dy * dy;
            if (distSq >= MIN_BLIP_DISTANCE_SQ) continue;

            const dist = Math.sqrt(distSq) || 0.001;
            const overlap = MIN_BLIP_DISTANCE - dist;
            const shiftX = (dx / dist) * (overlap / 2);
            const shiftY = (dy / dist) * (overlap / 2);

            a.x -= shiftX;
            a.y -= shiftY;
            b.x += shiftX;
            b.y += shiftY;

            clampToSectorRing(a);
            clampToSectorRing(b);

            moved = true;
          }
        }
        if (!moved) break;
      }
    }
  }

  // Дополнительное разведение технологий относительно подписей колец
  function avoidRingLabelOverlap(renderData) {
    const CENTER_X = window.CENTER_X || 500;
    const CENTER_Y = window.CENTER_Y || 500;
    const RADIUS_STEP = window.RADIUS_STEP || 140;
    const POSITION_ANGLE_PAD = window.POSITION_ANGLE_PAD || 8;
    const RING_LABEL_WIDTH = window.RING_LABEL_WIDTH || 180;
    const RING_LABEL_HEIGHT = window.RING_LABEL_HEIGHT || 42;
    const RINGS = window.RINGS || [];
    const QUADRANTS = window.QUADRANTS || [];

    if (!Array.isArray(renderData) || !renderData.length) return;
    if (!Array.isArray(RINGS) || !RINGS.length) return;

    const PADDING = 6;
    const labelZones = RINGS.map((_, ringIndex) => {
      const r = (ringIndex + 1) * RADIUS_STEP;
      const pos = window.polarToCartesian(CENTER_X, CENTER_Y, r, 0);
      return {
        ringIndex,
        centerX: pos.x,
        centerY: pos.y,
        radius: r,
        xMin: pos.x - RING_LABEL_WIDTH / 2 - PADDING,
        xMax: pos.x + RING_LABEL_WIDTH / 2 + PADDING,
        yMin: pos.y - RING_LABEL_HEIGHT / 2 - PADDING,
        yMax: pos.y + RING_LABEL_HEIGHT / 2 + PADDING,
      };
    });

    renderData.forEach((t) => {
      if (!t || t.ring == null || typeof t.x !== "number" || typeof t.y !== "number") return;
      const zone = labelZones[t.ring];
      if (!zone) return;

      if (
        t.x >= zone.xMin &&
        t.x <= zone.xMax &&
        t.y >= zone.yMin &&
        t.y <= zone.yMax
      ) {
        const polar = window.cartesianToPolar(CENTER_X, CENTER_Y, t.x, t.y);
        let radius = polar.radius;
        if (!Number.isFinite(radius) || radius <= 0) radius = zone.radius;

        const qId = t.quadrant;
        if (qId !== 1 && qId !== 4) return;

        const side = qId === 4 ? -1 : 1;

        const chord = RING_LABEL_WIDTH;
        const halfAngleRad = Math.min(
          Math.PI / 3,
          Math.max(0, Math.asin(Math.min(1, chord / (2 * radius))))
        );
        const halfAngleDeg = (halfAngleRad * 180) / Math.PI;

        const extraGap = 4;
        let targetAngle = (halfAngleDeg + extraGap) * (side > 0 ? 1 : -1);
        while (targetAngle < 0) targetAngle += 360;
        while (targetAngle >= 360) targetAngle -= 360;

        const q = QUADRANTS.find((qq) => qq.id === qId);
        if (q) {
          const angleMin = q.startAngle + POSITION_ANGLE_PAD;
          const angleMax = q.startAngle + 90 - POSITION_ANGLE_PAD;
          if (targetAngle < angleMin) targetAngle = angleMin;
          if (targetAngle > angleMax) targetAngle = angleMax;
        }

        const p = window.polarToCartesian(CENTER_X, CENTER_Y, radius, targetAngle);
        t.x = Math.round(p.x);
        t.y = Math.round(p.y);
      }
    });
  }

  // Экспорт в window.Positioning
  window.Positioning = {
    frac,
    getQuadrantIdForBlock,
    getQuadrantsForBlock,
    getAllQuadrantsForTech,
    assignFixedPosition,
    assignFixedPositionForQuadrant,
    computeCoordinates,
    applyNonOverlappingLayout,
    avoidRingLabelOverlap
  };

})();


