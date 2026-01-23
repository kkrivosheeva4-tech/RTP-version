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

  // Расчет готовности технологии (для директорской страницы)
  // УСТАРЕВШЕЕ: используется только для обратной совместимости
  function calculateReadinessScore(tech) {
    const techRead = tech.techRead !== undefined ? tech.techRead : 0; // 0-3
    const organRead = tech.organRead !== undefined ? tech.organRead : 0; // 0-3
    const trlStage = tech.trlStage !== undefined ? tech.trlStage : 1; // 1-3

    // Нормализация в диапазон 0-1
    const techN = techRead / 3;
    const organN = organRead / 3;
    const trlN = (trlStage - 1) / 2;

    // Комбинированная оценка (среднее арифметическое)
    const readinessScore = (techN + organN + trlN) / 3;

    // Маппинг на позицию от 1 до 99 (не включая 0 и 100)
    const position = 1 + (readinessScore * 98);

    return position; // от 1 до 99
  }

  // Расчет радиуса на основе позиции готовности
  // УСТАРЕВШЕЕ: используется только для обратной совместимости
  function calculateRadiusFromReadiness(position, maxRadius) {
    // position от 1 до 99
    // maxRadius - радиус третьего кольца
    // Центр = 0, внешний край = maxRadius
    // Инвертируем: чем выше готовность (ближе к 100), тем ближе к центру (меньше радиус)
    const normalizedPosition = (100 - position) / 100; // инвертируем: 1 -> 0, 99 -> 0.01
    return normalizedPosition * maxRadius;
  }

  /**
   * Вычисляет позицию технологии на радаре в полярных координатах (θ, r)
   * согласно математической модели с логистической функцией.
   *
   * @param {Object} tech - Объект технологии
   * @returns {Object} {theta: number, radius: number} - Полярные координаты
   *
   * Математическая модель:
   * - θ (угол) - фиксированное значение на основе квадранта/направления
   * - r (радиус) - вычисляется как "дистанция до внедрения" в диапазоне (0, 100)
   *
   * Конвейер вычисления радиуса:
   * 1. Факторы s_ik: techRead (0-3), organRead (0-3), funcCover (0-3), trlStage (1-3)
   * 2. Нормализация: x_ik в диапазон [0, 1]
   * 3. Сводный показатель: z_i = Σ(w_k * x_ik) + b
   * 4. Логистическая функция: p_i = 1 / (1 + exp(-α * z_i))
   * 5. Радиус: r_i = 100 * (1 - p_i), затем масштабирование с гарантией (0, 100)
   */
  function calculateRadarPosition(tech) {
    if (!tech) {
      return { theta: 0, radius: 50 };
    }

    // === ВЫЧИСЛЕНИЕ УГЛА (θ) ===
    // Угол определяется принадлежностью технологии к квадранту/кластеру
    const QUADRANTS = window.QUADRANTS || [];
    const POSITION_ANGLE_PAD = window.POSITION_ANGLE_PAD || 8;
    const GOLDEN_ANGLE = 137.50776405003785;

    const blockKey = (tech.blocks && tech.blocks.length) ? tech.blocks[0] : tech.block;
    const quadrantId = getQuadrantIdForBlock(blockKey);

    let theta = 0; // значение по умолчанию
    if (quadrantId != null) {
      const q = QUADRANTS.find(q => q.id === quadrantId);
      if (q) {
        const ANGLE_PAD = POSITION_ANGLE_PAD;
        const ANGLE_SPAN = 90 - (ANGLE_PAD * 2);
        const aBase = q.startAngle + ANGLE_PAD;
        const id = Number(tech.id) || 0;
        // Добавляем небольшой offset на основе ID для распределения внутри квадранта
        const angleOffset = ((id * GOLDEN_ANGLE) % ANGLE_SPAN);
        theta = aBase + angleOffset;
      }
    }

    // === ВЫЧИСЛЕНИЕ РАДИУСА (r) ===
    // Параметры модели
    const ALPHA = 4; // Параметр чувствительности логистической функции (3-5)

    // Веса факторов (w_k)
    // Все факторы положительные - "приближающие" (уменьшают радиус)
    const weights = {
      techRead: 0.25,      // Технологическая готовность (0-3) → положительный
      organRead: 0.25,     // Организационная готовность (0-3) → положительный
      funcCover: 0.15,     // Покрытие функций (0-3) → положительный
      trlStage: 0.20       // TRL стадия (1-3) → положительный
    };

    // Сдвиг для калибровки общей строгости модели
    const bias = -0.5; // Отрицательный сдвиг делает модель более строгой (больше радиус)

    // Извлечение и нормализация факторов (s_ik → x_ik)
    // Учитываем индивидуальные оценки для текущего предприятия, если они есть
    const companies = Array.isArray(tech.company) ? tech.company : (tech.company ? [tech.company] : []);
    let techRead, organRead, funcCover;

    // Получаем текущее предприятие из глобальной области или StateAccessors
    let currentEnterprise = null;
    if (typeof window !== 'undefined') {
      if (window.StateAccessors && typeof window.StateAccessors.getCurrentEnterprise === 'function') {
        currentEnterprise = window.StateAccessors.getCurrentEnterprise();
      } else if (typeof window.getCurrentEnterprise === 'function') {
        currentEnterprise = window.getCurrentEnterprise();
      } else if (typeof window.currentEnterprise !== 'undefined') {
        currentEnterprise = window.currentEnterprise;
      }
    }

    // Если есть несколько предприятий и индивидуальные оценки, используем оценки для текущего предприятия
    if (companies.length > 1 && tech.companyRatings && typeof tech.companyRatings === 'object' &&
        currentEnterprise && companies.includes(currentEnterprise) && tech.companyRatings[currentEnterprise]) {
      const ratings = tech.companyRatings[currentEnterprise];
      techRead = ratings.techRead !== undefined ? ratings.techRead : (tech.techRead !== undefined ? tech.techRead : 0);
      organRead = ratings.organRead !== undefined ? ratings.organRead : (tech.organRead !== undefined ? tech.organRead : 0);
      funcCover = ratings.funcCover !== undefined ? ratings.funcCover : (tech.funcCover !== undefined ? tech.funcCover : 0);
    } else {
      techRead = tech.techRead !== undefined ? tech.techRead : 0;
      organRead = tech.organRead !== undefined ? tech.organRead : 0;
      funcCover = tech.funcCover !== undefined ? tech.funcCover : 0;
    }

    const trlStage = tech.trlStage !== undefined ? tech.trlStage : 1;

    // Нормализация факторов в диапазон [0, 1]
    // techRead, organRead, funcCover: 0-3 → x = value/3
    // trlStage: 1-3 → x = (value-1)/2
    const x_techRead = techRead / 3;
    const x_organRead = organRead / 3;
    const x_funcCover = funcCover / 3;
    const x_trlStage = (trlStage - 1) / 2;

    // Вычисление сводного показателя: z_i = Σ(w_k * x_ik) + b
    let z_i = 0;
    z_i += weights.techRead * x_techRead;
    z_i += weights.organRead * x_organRead;
    z_i += weights.funcCover * x_funcCover;
    z_i += weights.trlStage * x_trlStage;
    z_i += bias;

    // Преобразование через логистическую функцию: p_i = 1 / (1 + exp(-α * z_i))
    // p_i ∈ (0, 1) - степень близости (вероятность готовности)
    const expTerm = Math.exp(-ALPHA * z_i);
    let p_i = 1 / (1 + expTerm);

    // === ПРАВИЛА РАЗМЕЩЕНИЯ ===
    // Проверяем, все ли оценки максимальные
    const isMaxScores = (techRead === 3 && organRead === 3 && funcCover === 3 && trlStage === 3);

    // Проверяем количество вендоров (считаем непустые массивы vendors)
    const vendorsCount = (tech.vendors && Array.isArray(tech.vendors)) ? tech.vendors.length : 0;
    const hasManyVendors = vendorsCount >= 2; // Минимум 2 вендора для центрального круга

    // Правило: В центральном кругу только технологии с максимальными оценками И большим количеством вендоров
    // Если хоть одна оценка меньше 3, технология должна быть в среднем кольце (радиус >= 35)
    if (!isMaxScores) {
      // Хоть одна оценка не максимальная → принудительно в среднее кольцо
      // Устанавливаем p_i так, чтобы радиус был >= 35
      const minRadiusForMiddleRing = 35;
      p_i = Math.min(p_i, (100 - minRadiusForMiddleRing) / 100);
    } else if (!hasManyVendors) {
      // Все оценки максимальные, но мало вендоров → тоже в среднее кольцо
      const minRadiusForMiddleRing = 35;
      p_i = Math.min(p_i, (100 - minRadiusForMiddleRing) / 100);
    }
    // Если isMaxScores && hasManyVendors, используем расчетный p_i (может быть близко к центру)

    // Вычисление радиуса: r_i = 100 * (1 - p_i)
    // Инвертируем: чем выше p_i (ближе к внедрению), тем меньше радиус (ближе к центру)
    let r_i = 100 * (1 - p_i);

    // Гарантируем, что радиус строго в диапазоне (0, 100)
    // Используем очень малые значения близкие к границам вместо 0 или 100
    const EPSILON = 0.01; // Минимальное отклонение от границ

    // Для среднего кольца гарантируем минимум 35
    if (!isMaxScores || !hasManyVendors) {
      if (r_i < 35) {
        r_i = 35;
      }
    }

    if (r_i <= 0) {
      r_i = EPSILON;
    } else if (r_i >= 100) {
      r_i = 100 - EPSILON;
    }

    return {
      theta: theta,
      radius: r_i // Радиус в процентах (0 < r < 100)
    };
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
    const RINGS = window.RINGS || [];

    // Проверяем, является ли это директорской страницей
    const isDirectorPage = document.body.id === 'rmk-director';

    const blockKey = (tech.blocks && tech.blocks.length) ? tech.blocks[0] : tech.block;
    const quadrantId = getQuadrantIdForBlock(blockKey);

    if (quadrantId == null) return { x: CENTER_X, y: CENTER_Y };
    const q = QUADRANTS.find(q => q.id === quadrantId);
    if (!q) return { x: CENTER_X, y: CENTER_Y };

    const PAD = POSITION_PAD;
    const ANGLE_PAD = POSITION_ANGLE_PAD;
    const ANGLE_SPAN = 90 - (ANGLE_PAD * 2);
    const aBase = q.startAngle + ANGLE_PAD;
    const id = Number(tech.id) || 0;
    const GOLDEN_ANGLE = 137.50776405003785;
    const PHI_FRAC = 0.6180339887498949;

    let radius;
    let rMin, rMax;

    if (isDirectorPage) {
      // Новая логика для директорской страницы: используем calculateRadarPosition
      // с математической моделью логистической функции
      const radarPos = calculateRadarPosition(tech);

      // Масштабируем радиус из процентов (0-100) к реальным координатам SVG
      // r_i находится в диапазоне (0, 100), нужно масштабировать к maxR
      const maxR = (Array.isArray(RINGS) && RINGS.length > 0) ? RINGS.length * RADIUS_STEP : 3 * RADIUS_STEP;
      const availableRadius = maxR - PAD; // Доступный радиус с учетом отступов

      // Масштабируем: r_i (0-100) → радиус в пикселях (PAD - maxR-PAD)
      // Инвертируем логику: чем больше r_i (дальше от центра в процентах),
      // тем дальше от центра в пикселях
      radius = PAD + (radarPos.radius / 100) * availableRadius;

      // Используем угол из calculateRadarPosition
      const angle = radarPos.theta;

      const p = window.polarToCartesian(CENTER_X, CENTER_Y, radius, angle);
      return { x: Math.round(p.x), y: Math.round(p.y) };
    } else {
      // Старая логика для обычной страницы: позиция на основе статуса (level)
      const ringIndex = levelToRing[tech.level];
      if (ringIndex == null) return { x: CENTER_X, y: CENTER_Y };

      rMin = ringIndex * RADIUS_STEP + PAD;
      rMax = (ringIndex + 1) * RADIUS_STEP - PAD;
      const angleOffset = ((id * GOLDEN_ANGLE) % ANGLE_SPAN);
      const angle = aBase + angleOffset;
      const rFrac = frac(id * PHI_FRAC + ringIndex * 0.173 + quadrantId * 0.317);
      radius = rMin + rFrac * (rMax - rMin);
      const p = window.polarToCartesian(CENTER_X, CENTER_Y, radius, angle);
      return { x: Math.round(p.x), y: Math.round(p.y) };
    }
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
    const RINGS = window.RINGS || [];

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

    const q = QUADRANTS.find(q => q.id === targetQuadrant);
    if (!q) return { x: CENTER_X, y: CENTER_Y };

    const PAD = POSITION_PAD;
    const ANGLE_PAD = POSITION_ANGLE_PAD;
    const ANGLE_SPAN = 90 - (ANGLE_PAD * 2);
    const aBase = q.startAngle + ANGLE_PAD;
    const id = Number(tech.id) || 0;
    const GOLDEN_ANGLE = 137.50776405003785;
    const PHI_FRAC = 0.6180339887498949;

    // Проверяем, является ли это директорской страницей
    const isDirectorPage = document.body.id === 'rmk-director';

    let radius;

    if (isDirectorPage) {
      // Новая логика для директорской страницы: используем calculateRadarPosition
      // с математической моделью логистической функции
      // Для конкретного квадранта используем targetQuadrant для расчета угла
      const radarPos = calculateRadarPosition(tech);

      // Масштабируем радиус из процентов (0-100) к реальным координатам SVG
      const maxR = (Array.isArray(RINGS) && RINGS.length > 0) ? RINGS.length * RADIUS_STEP : 3 * RADIUS_STEP;
      const availableRadius = maxR - PAD;
      radius = PAD + (radarPos.radius / 100) * availableRadius;

      // Для конкретного квадранта переопределяем угол на основе targetQuadrant
      const blockHash = String(blockKey).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const angleOffset = ((id * GOLDEN_ANGLE + blockHash * 37) % ANGLE_SPAN);
      const angle = aBase + angleOffset;

      const p = window.polarToCartesian(CENTER_X, CENTER_Y, radius, angle);
      return { x: Math.round(p.x), y: Math.round(p.y) };
    } else {
      // Старая логика для обычной страницы: позиция на основе статуса (level)
      const ringIndex = levelToRing[tech.level];
      if (ringIndex == null) return { x: CENTER_X, y: CENTER_Y };

      const rMin = ringIndex * RADIUS_STEP + PAD;
      const rMax = (ringIndex + 1) * RADIUS_STEP - PAD;
      const blockHash = String(blockKey).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const angleOffset = ((id * GOLDEN_ANGLE + blockHash * 37) % ANGLE_SPAN);
      const angle = aBase + angleOffset;
      const rFrac = frac(id * PHI_FRAC + ringIndex * 0.173 + targetQuadrant * 0.317 + blockHash * 0.041);
      radius = rMin + rFrac * (rMax - rMin);
      const p = window.polarToCartesian(CENTER_X, CENTER_Y, radius, angle);
      return { x: Math.round(p.x), y: Math.round(p.y) };
    }
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
    const RINGS = window.RINGS || [];

    if (!Array.isArray(renderData) || !renderData.length) return;
    if (!Array.isArray(QUADRANTS) || !QUADRANTS.length) return;

    // Проверяем, является ли это директорской страницей
    const isDirectorPage = document.body.id === 'rmk-director';

    const quadrantById = {};
    QUADRANTS.forEach(q => {
      if (q && typeof q.id !== 'undefined') quadrantById[q.id] = q;
    });

    const groups = new Map();
    renderData.forEach(t => {
      if (t == null || t.quadrant == null) return;
      // Для директорской страницы группируем только по квадранту
      // (поле ring не используется, позиционирование основано на математической модели)
      if (isDirectorPage) {
        const key = `${t.quadrant}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(t);
      } else {
        if (t.ring == null) return;
        const key = `${t.quadrant}|${t.ring}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(t);
      }
    });

    const MAX_ITER = 80;

    function clampToSectorRing(t) {
      const q = quadrantById[t.quadrant];
      if (!q) return;
      const PAD = POSITION_PAD;
      const ANGLE_PAD = POSITION_ANGLE_PAD;
      const ANGLE_SPAN = 90 - (ANGLE_PAD * 2);

      let rMin, rMax;
      if (isDirectorPage) {
        // Для директорской страницы: НЕ используем поле ring из данных
        // Позиционирование основано только на математической модели calculateRadarPosition
        // Используем весь доступный диапазон радиуса для разведения точек
        const maxR = (Array.isArray(RINGS) && RINGS.length > 0) ? RINGS.length * RADIUS_STEP : 3 * RADIUS_STEP;
        rMin = PAD;
        rMax = maxR - PAD;
      } else {
        // Для обычной страницы: в пределах кольца
        const ringIndex = t.ring;
        rMin = ringIndex * RADIUS_STEP + PAD;
        rMax = (ringIndex + 1) * RADIUS_STEP - PAD;
      }

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
    // Для директорской страницы не нужно избегать наложения с подписями колец (их нет)
    const isDirectorPage = document.body.id === 'rmk-director';
    if (isDirectorPage) return;

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
    avoidRingLabelOverlap,
    calculateReadinessScore,
    calculateRadiusFromReadiness,
    calculateRadarPosition
  };

})();
