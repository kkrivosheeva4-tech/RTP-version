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

  // Получить название направления по ID
  function getDirectionNameById(directionId) {
    if (directionId == null) return null;

    // Пробуем получить digitalDirections из разных источников
    let digitalDirections = [];
    if (window.StateManager && typeof window.StateManager.get === 'function') {
      digitalDirections = window.StateManager.get('digitalDirections') || [];
    } else if (window.digitalDirections && Array.isArray(window.digitalDirections)) {
      digitalDirections = window.digitalDirections;
    }

    // Если directionId уже строка, возвращаем как есть
    if (typeof directionId === 'string') {
      return directionId;
    }

    // Преобразуем ID в число для поиска
    const id = typeof directionId === 'number' ? directionId : Number(directionId);
    if (isNaN(id)) return null;

    // Ищем направление по ID
    const direction = digitalDirections.find(d =>
      d && typeof d === 'object' && d.id === id
    );

    return direction && direction.name ? direction.name : null;
  }

  // Получить id квадранта для направления
  function getQuadrantIdForDirection(directionNameOrId) {
    if (directionNameOrId == null || !window.directionToQuadrant) return null;

    // Преобразуем ID в название, если нужно
    const directionName = getDirectionNameById(directionNameOrId) || directionNameOrId;

    const m = window.directionToQuadrant[directionName];
    if (Array.isArray(m)) return m.length ? m[0] : null;
    return (typeof m === 'number') ? m : null;
  }

  // Получить все квадранты для направления
  function getQuadrantsForDirection(directionNameOrId) {
    if (directionNameOrId == null || !window.directionToQuadrant) return [];

    // Преобразуем ID в название, если нужно
    const directionName = getDirectionNameById(directionNameOrId) || directionNameOrId;

    const m = window.directionToQuadrant[directionName];
    if (m == null) return [];
    if (Array.isArray(m)) return m.filter(q => typeof q === 'number');
    if (typeof m === 'number') return [m];
    return [];
  }

  // Получить все уникальные квадранты для технологии на основе направлений
  function getAllQuadrantsForTech(tech) {
    if (!tech) return [];
    const quadrantsSet = new Set();

    // Используем направления для определения квадрантов
    const directions = Array.isArray(tech.directions) && tech.directions.length
      ? tech.directions
      : (tech.direction ? [tech.direction] : []);

    if (directions.length > 0) {
      // Если есть направления, используем их
      directions.forEach(directionName => {
        const directionQuadrants = getQuadrantsForDirection(directionName);
        directionQuadrants.forEach(q => quadrantsSet.add(q));
      });
    } else {
      // Fallback: если направлений нет, используем блоки (для обратной совместимости)
      // ВАЖНО: это временная мера для обратной совместимости
      const blocks = Array.isArray(tech.blocks) && tech.blocks.length
        ? tech.blocks
        : (tech.block ? [tech.block] : []);

      blocks.forEach(blockKey => {
        if (window.blockToQuadrant && window.blockToQuadrant[blockKey]) {
          const m = window.blockToQuadrant[blockKey];
          if (Array.isArray(m)) {
            m.filter(q => typeof q === 'number').forEach(q => quadrantsSet.add(q));
          } else if (typeof m === 'number') {
            quadrantsSet.add(m);
          }
        }
      });
    }

    return Array.from(quadrantsSet);
  }

  // УСТАРЕВШЕЕ: Получить id квадранта для блока (для обратной совместимости)
  // НЕ используется для позиционирования, только для фильтрации
  function getQuadrantIdForBlock(blockKey) {
    if (!blockKey || !window.blockToQuadrant) return null;
    const m = window.blockToQuadrant[blockKey];
    if (Array.isArray(m)) return m.length ? m[0] : null;
    return (typeof m === 'number') ? m : null;
  }

  // УСТАРЕВШЕЕ: Получить все квадранты для блока (для обратной совместимости)
  // НЕ используется для позиционирования, только для фильтрации
  function getQuadrantsForBlock(blockKey) {
    if (!blockKey || !window.blockToQuadrant) return [];
    const m = window.blockToQuadrant[blockKey];
    if (m == null) return [];
    if (Array.isArray(m)) return m.filter(q => typeof q === 'number');
    if (typeof m === 'number') return [m];
    return [];
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
   * Вычисляет размер элемента (радиус в пикселях) на основе технологии
   * Размер зависит от количества вендоров на директорской странице
   * @param {Object} tech - Объект технологии
   * @returns {number} - Размер элемента (радиус в пикселях)
   */
  function calculateElementSize(tech) {
    const isDirectorPage = document.body && document.body.id === 'rmk-director';
    let size;

    if (isDirectorPage) {
      const vendorCount = (tech.vendors && Array.isArray(tech.vendors)) ? tech.vendors.length : 0;
      if (vendorCount <= 1) {
        size = 8;
      } else if (vendorCount === 2 || vendorCount === 3) {
        size = 14;
      } else {
        size = 20;
      }
    } else {
      size = 10;
    }

    return size;
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
   * 1. Факторы s_ik:
   *    - techRead (0-3): среднее значение technologicalReadiness по выбранным предприятиям из фильтра (или по всем, если ничего не выбрано)
   *    - organRead (0-3): среднее значение organizationalReadiness по выбранным предприятиям из фильтра (или по всем, если ничего не выбрано)
   *    - funcCover (0-3): общее значение покрытия функций для технологии
   *    - trlStage (1-3): общая TRL стадия для технологии
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
    // Угол определяется принадлежностью технологии к направлению цифрового развития
    const QUADRANTS = window.QUADRANTS || [];
    const POSITION_ANGLE_PAD = window.POSITION_ANGLE_PAD || 8;
    const GOLDEN_ANGLE = 137.50776405003785;

    // Используем направления для определения квадранта
    const directions = Array.isArray(tech.directions) && tech.directions.length
      ? tech.directions
      : (tech.direction ? [tech.direction] : []);

    // Берем первое направление для определения квадранта
    // Преобразуем ID в название, если нужно
    const directionNameOrId = directions.length > 0 ? directions[0] : null;
    const quadrantId = directionNameOrId ? getQuadrantIdForDirection(directionNameOrId) : null;

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
    // Веса скалиброваны так, чтобы их сумма = 1.0 для корректного диапазона
    const weights = {
      techRead: 0.30,      // Технологическая готовность (0-3) → положительный
      organRead: 0.30,     // Организационная готовность (0-3) → положительный
      funcCover: 0.20,     // Покрытие функций (0-3) → положительный
      trlStage: 0.20       // TRL стадия (1-3) → положительный
    };
    // Сумма весов = 1.0 ✓

    // Сдвиг для калибровки общей строгости модели
    // bias = -0.6: технология с максимальными параметрами → r ≈ 17% (близко к центру)
    //              технология со средними параметрами → r ≈ 60% (среднее положение)
    //              технология с низкими параметрами → r ≈ 92% (у края)
    const bias = -0.6;

    // Извлечение и нормализация факторов (s_ik → x_ik)
    // techRead и organRead вычисляются как среднее значение по выбранным предприятиям из фильтра
    // funcCover и trlStage - общие значения для технологии

    let techRead = 0;
    let organRead = 0;

    // Получаем выбранные предприятия из фильтра
    let selectedEnterpriseNames = [];
    if (typeof window !== 'undefined' && window.Filters && typeof window.Filters.getFilterValues === 'function') {
      selectedEnterpriseNames = window.Filters.getFilterValues('enterprise') || [];
    }

    // Получаем оценки из массива enterprises
    const enterprises = Array.isArray(tech.enterprises) ? tech.enterprises : [];

    // Получаем список названий предприятий технологии (из поля company)
    const techCompanyNames = Array.isArray(tech.company) ? tech.company : (tech.company ? [tech.company] : []);

    // Получаем маппинг ID -> название предприятий для сопоставления
    let enterpriseIdToNameMap = {};
    if (typeof window !== 'undefined') {
      // Пробуем получить через StateManager
      if (window.StateManager && typeof window.StateManager.get === 'function') {
        const enterprisesList = window.StateManager.get('enterprisesList') || [];
        if (Array.isArray(enterprisesList)) {
          enterprisesList.forEach((ent, index) => {
            const id = (typeof ent === 'object' && ent.id !== undefined) ? ent.id : (index + 1);
            const name = (typeof ent === 'object' && ent.name) ? ent.name : (typeof ent === 'string' ? ent : `Предприятие ${id}`);
            enterpriseIdToNameMap[id] = name;
          });
        }
      }
      // Fallback: пробуем получить из window.enterprisesList
      if (Object.keys(enterpriseIdToNameMap).length === 0 && window.enterprisesList && Array.isArray(window.enterprisesList)) {
        window.enterprisesList.forEach((ent, index) => {
          const id = (typeof ent === 'object' && ent.id !== undefined) ? ent.id : (index + 1);
          const name = (typeof ent === 'object' && ent.name) ? ent.name : (typeof ent === 'string' ? ent : `Предприятие ${id}`);
          enterpriseIdToNameMap[id] = name;
        });
      }
    }

    // Фильтруем enterprises по выбранным предприятиям, если они выбраны
    let filteredEnterprises = enterprises;
    if (selectedEnterpriseNames.length > 0) {
      // Нормализуем выбранные названия для сравнения
      const selectedNamesSet = new Set(selectedEnterpriseNames.map(name => String(name).trim().toLowerCase()));

      // Фильтруем enterprises: оставляем только те, чьи названия соответствуют выбранным
      filteredEnterprises = enterprises.filter(ent => {
        if (!ent || typeof ent !== 'object') return false;
        const enterpriseId = ent.enterpriseId;
        if (enterpriseId === undefined || enterpriseId === null) return false;

        // Пробуем найти название через маппинг
        let enterpriseName = enterpriseIdToNameMap[enterpriseId];

        // Если маппинг не сработал, пробуем найти по индексу в techCompanyNames
        if (!enterpriseName && techCompanyNames.length > 0) {
          // Предполагаем, что порядок в techCompanyNames соответствует порядку в enterprises
          const entIndex = enterprises.indexOf(ent);
          if (entIndex >= 0 && entIndex < techCompanyNames.length) {
            enterpriseName = techCompanyNames[entIndex];
          }
        }

        // Если название найдено, проверяем, есть ли оно в выбранных
        if (enterpriseName) {
          return selectedNamesSet.has(String(enterpriseName).trim().toLowerCase());
        }

        return false;
      });
    }

    // Если после фильтрации не осталось предприятий, используем все (fallback)
    // Это происходит, если ничего не выбрано или выбранные предприятия не найдены
    if (filteredEnterprises.length === 0 && enterprises.length > 0) {
      filteredEnterprises = enterprises;
    }

    if (filteredEnterprises.length > 0) {
      // Вычисляем среднее значение technologicalReadiness и organizationalReadiness
      // только по выбранным предприятиям
      let sumTechRead = 0;
      let sumOrganRead = 0;
      let countTechRead = 0;
      let countOrganRead = 0;

      filteredEnterprises.forEach(ent => {
        if (ent && typeof ent === 'object') {
          const techReadValue = ent.technologicalReadiness;
          const organReadValue = ent.organizationalReadiness;

          if (techReadValue !== undefined && techReadValue !== null && !isNaN(Number(techReadValue))) {
            sumTechRead += Number(techReadValue);
            countTechRead++;
          }

          if (organReadValue !== undefined && organReadValue !== null && !isNaN(Number(organReadValue))) {
            sumOrganRead += Number(organReadValue);
            countOrganRead++;
          }
        }
      });

      // Вычисляем средние значения
      if (countTechRead > 0) {
        techRead = sumTechRead / countTechRead;
      }
      if (countOrganRead > 0) {
        organRead = sumOrganRead / countOrganRead;
      }
    } else if (enterprises.length === 0) {
      // Если у технологии нет enterprises, но есть общие techRead и organRead (для обратной совместимости)
      // Используем их как fallback, но это не рекомендуется - оценки должны быть для предприятий
      if (tech.techRead !== undefined && tech.techRead !== null && !isNaN(Number(tech.techRead))) {
        techRead = Number(tech.techRead);
      }
      if (tech.organRead !== undefined && tech.organRead !== null && !isNaN(Number(tech.organRead))) {
        organRead = Number(tech.organRead);
      }
    }

    // funcCover и trlStage - общие значения для технологии
    // Если funcCover не задан, вычисляем его из functionCoverage
    let funcCover = tech.funcCover !== undefined && tech.funcCover !== null ? tech.funcCover : null;
    if (funcCover === null || funcCover === undefined || funcCover === 0) {
      // Вычисляем funcCover из functionCoverage (массив функций)
      if (Array.isArray(tech.functionCoverage) && tech.functionCoverage.length > 0) {
        const funcCount = tech.functionCoverage.length;

        // Пытаемся использовать новую логику с учетом блоков
        if (window.FuncCoverUtils && typeof window.FuncCoverUtils.calculateFuncCoverLegacy === 'function') {
          // Используем старую логику как fallback (синхронная)
          funcCover = window.FuncCoverUtils.calculateFuncCoverLegacy(funcCount);
        } else {
          // Fallback если модуль не загружен
          if (funcCount === 1) {
            funcCover = 1;
          } else if (funcCount >= 2 && funcCount <= 3) {
            funcCover = 2;
          } else if (funcCount >= 4) {
            funcCover = 3;
          }
        }
      } else {
        // Если functionCoverage пуст или отсутствует, используем 0
        funcCover = 0;
      }
    }
    // Гарантируем, что funcCover - число в диапазоне 0-3
    funcCover = Math.max(0, Math.min(3, Number(funcCover) || 0));

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
    const p_i = 1 / (1 + expTerm);

    // Вычисление радиуса: r_i = 100 * (1 - p_i)
    // Инвертируем: чем выше p_i (ближе к внедрению), тем меньше радиус (ближе к центру)
    let r_i = 100 * (1 - p_i);

    // Гарантируем, что радиус строго в диапазоне (0, 100)
    // Используем очень малые значения близкие к границам вместо 0 или 100
    const EPSILON = 0.01; // Минимальное отклонение от границ

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
  // Всегда использует математическую модель с логистической функцией
  function assignFixedPosition(tech) {
    const CENTER_X = window.CENTER_X || 500;
    const CENTER_Y = window.CENTER_Y || 500;
    const RADIUS_STEP = window.RADIUS_STEP || 140;
    const POSITION_PAD = window.POSITION_PAD || 30;
    const POSITION_ANGLE_PAD = window.POSITION_ANGLE_PAD || 8;
    const QUADRANTS = window.QUADRANTS || [];
    const RINGS = window.RINGS || [];

    // Всегда используем математическую модель calculateRadarPosition
    // с логистической функцией для вычисления позиции
    const radarPos = calculateRadarPosition(tech);

    // Масштабируем радиус из процентов (0-100) к реальным координатам SVG
    // r_i находится в диапазоне (0, 100), нужно масштабировать к maxR
    const maxR = (Array.isArray(RINGS) && RINGS.length > 0) ? RINGS.length * RADIUS_STEP : 3 * RADIUS_STEP;
    const availableRadius = maxR - POSITION_PAD; // Доступный радиус с учетом отступов

    // Масштабируем: r_i (0-100) → радиус в пикселях (PAD - maxR-PAD)
    // Инвертируем логику: чем больше r_i (дальше от центра в процентах),
    // тем дальше от центра в пикселях
    const radius = POSITION_PAD + (radarPos.radius / 100) * availableRadius;

    // Вычисляем размер элемента
    const elementSize = calculateElementSize(tech);

    // Вычисляем угловой размер элемента на вычисленном радиусе
    const angularSize = calculateAngularSize(elementSize * 1.2, radius);

    // Используем угол из calculateRadarPosition, корректируя с учетом размера элемента
    let angle = radarPos.theta;

    // Корректируем угол, чтобы элемент не выходил за границы квадранта
    // Определяем квадрант для технологии
    const directions = Array.isArray(tech.directions) && tech.directions.length
      ? tech.directions
      : (tech.direction ? [tech.direction] : []);

    if (directions.length > 0) {
      const directionNameOrId = directions[0];
      const quadrantId = getQuadrantIdForDirection(directionNameOrId);

      if (quadrantId != null) {
        const q = QUADRANTS.find(q => q.id === quadrantId);
        if (q) {
          const angleMin = q.startAngle + POSITION_ANGLE_PAD + angularSize;
          const angleMax = q.startAngle + 90 - POSITION_ANGLE_PAD - angularSize;

          // Ограничиваем угол с учетом размера элемента
          if (angle < angleMin) angle = angleMin;
          if (angle > angleMax) angle = angleMax;
        }
      }
    }

    const p = window.polarToCartesian(CENTER_X, CENTER_Y, radius, angle);
    return { x: Math.round(p.x), y: Math.round(p.y) };
  }

  // Вычисляет угловое смещение для элемента заданного размера на радиусе
  // Используется для корректировки углов с учетом размера фигур
  function calculateAngularSize(elementRadius, circleRadius) {
    if (circleRadius <= 0 || elementRadius <= 0) return 0;
    // Если элемент больше радиуса, возвращаем максимальное значение
    if (elementRadius >= circleRadius) return 15; // Ограничиваем разумным значением
    // Угловой размер = arcsin(elementRadius / circleRadius) в градусах
    const angleInRadians = Math.asin(Math.min(1, elementRadius / circleRadius));
    const angleInDegrees = (angleInRadians * 180) / Math.PI;
    return angleInDegrees;
  }

  // Рассчитать позицию технологии для конкретного квадранта
  // Всегда использует математическую модель с логистической функцией
  function assignFixedPositionForQuadrant(tech, targetQuadrant) {
    const CENTER_X = window.CENTER_X || 500;
    const CENTER_Y = window.CENTER_Y || 500;
    const RADIUS_STEP = window.RADIUS_STEP || 140;
    const POSITION_PAD = window.POSITION_PAD || 30;
    const POSITION_ANGLE_PAD = window.POSITION_ANGLE_PAD || 8;
    const QUADRANTS = window.QUADRANTS || [];
    const RINGS = window.RINGS || [];

    if (!tech || targetQuadrant == null) {
      return assignFixedPosition(tech);
    }

    // Используем направления для определения квадранта
    const directions = Array.isArray(tech.directions) && tech.directions.length
      ? tech.directions
      : (tech.direction ? [tech.direction] : []);

    let directionName = null;
    for (const dir of directions) {
      const dirQuadrants = getQuadrantsForDirection(dir);
      if (dirQuadrants.includes(targetQuadrant)) {
        // Преобразуем ID в название для использования в дальнейших вычислениях
        directionName = getDirectionNameById(dir) || dir;
        break;
      }
    }

    // Если не найдено направление для этого квадранта, используем стандартное позиционирование
    if (!directionName) {
      return assignFixedPosition(tech);
    }

    const q = QUADRANTS.find(q => q.id === targetQuadrant);
    if (!q) return { x: CENTER_X, y: CENTER_Y };

    // Всегда используем математическую модель calculateRadarPosition
    // с логистической функцией для вычисления позиции
    // Для конкретного квадранта используем targetQuadrant для расчета угла
    const radarPos = calculateRadarPosition(tech);

    // Масштабируем радиус из процентов (0-100) к реальным координатам SVG
    const maxR = (Array.isArray(RINGS) && RINGS.length > 0) ? RINGS.length * RADIUS_STEP : 3 * RADIUS_STEP;
    const availableRadius = maxR - POSITION_PAD;
    const radius = POSITION_PAD + (radarPos.radius / 100) * availableRadius;

    // Вычисляем размер элемента
    const elementSize = calculateElementSize(tech);

    // Вычисляем угловой размер элемента на вычисленном радиусе
    // Добавляем запас (множитель 1.2) для более консервативного позиционирования
    const angularSize = calculateAngularSize(elementSize * 1.2, radius);

    // Для конкретного квадранта переопределяем угол на основе targetQuadrant
    // с учетом размера элемента
    const GOLDEN_ANGLE = 137.50776405003785;
    // Уменьшаем доступный диапазон с учетом углового размера элемента
    const ANGLE_SPAN = 90 - (POSITION_ANGLE_PAD * 2) - (angularSize * 2);
    const aBase = q.startAngle + POSITION_ANGLE_PAD + angularSize;
    const id = Number(tech.id) || 0;
    const directionHash = directionName ? String(directionName).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) : 0;
    const angleOffset = ((id * GOLDEN_ANGLE + directionHash * 37) % Math.max(1, ANGLE_SPAN));
    const angle = aBase + angleOffset;

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
    const RINGS = window.RINGS || [];

    if (!Array.isArray(renderData) || !renderData.length) return;
    if (!Array.isArray(QUADRANTS) || !QUADRANTS.length) return;

    const quadrantById = {};
    QUADRANTS.forEach(q => {
      if (q && typeof q.id !== 'undefined') quadrantById[q.id] = q;
    });

    const groups = new Map();
    renderData.forEach(t => {
      if (t == null || t.quadrant == null) return;
      // Группируем только по квадранту
      // (поле ring не используется, позиционирование основано на математической модели)
      const key = `${t.quadrant}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(t);
    });

    const MAX_ITER = 80;

    // Вычисляет угловое смещение, необходимое для элемента заданного размера на радиусе
    function calculateAngularSizeInDegrees(elementRadius, circleRadius) {
      if (circleRadius <= 0 || elementRadius <= 0) return 0;
      // Если элемент больше радиуса, возвращаем максимальное значение
      if (elementRadius >= circleRadius) return 45; // Ограничиваем половиной квадранта
      // Угловой размер = 2 * arcsin(elementRadius / circleRadius) в градусах
      const angleInRadians = Math.asin(Math.min(1, elementRadius / circleRadius));
      const angleInDegrees = (angleInRadians * 180) / Math.PI;
      return angleInDegrees;
    }

    function clampToSectorRing(t) {
      const q = quadrantById[t.quadrant];
      if (!q) return;
      const PAD = POSITION_PAD;
      const ANGLE_PAD = POSITION_ANGLE_PAD;
      const ANGLE_SPAN = 90 - (ANGLE_PAD * 2);

      // Позиционирование основано только на математической модели calculateRadarPosition
      // Используем весь доступный диапазон радиуса для разведения точек
      const maxR = (Array.isArray(RINGS) && RINGS.length > 0) ? RINGS.length * RADIUS_STEP : 3 * RADIUS_STEP;
      const rMin = PAD;
      const rMax = maxR - PAD;

      const polar = window.cartesianToPolar(CENTER_X, CENTER_Y, t.x, t.y);
      let radius = polar.radius;
      let angle = polar.angle;

      if (!Number.isFinite(radius)) radius = (rMin + rMax) / 2;
      if (!Number.isFinite(angle)) angle = (angleMin + angleMax) / 2;

      // Ограничиваем радиус
      if (radius < rMin) radius = rMin;
      if (radius > rMax) radius = rMax;

      // Получаем размер элемента (радиус фигуры)
      const elementSize = (t.size && typeof t.size === 'number') ? t.size : 10;

      // Вычисляем угловой размер элемента на текущем радиусе
      // Добавляем небольшой запас (множитель 1.1) для гарантированного избежания пересечений
      const angularSize = calculateAngularSizeInDegrees(elementSize * 1.1, radius);

      // Корректируем границы квадранта с учетом размера элемента
      // Элемент должен помещаться полностью внутри квадранта
      const angleMin = q.startAngle + ANGLE_PAD + angularSize;
      const angleMax = q.startAngle + ANGLE_PAD + ANGLE_SPAN - angularSize;

      // Нормализуем угол относительно квадранта с учетом перехода через 0°
      // Квадрант 4 пересекает границу 0°/360°, нужна специальная обработка
      if (q.id === 4) {
        // Квадрант 4: 270° - 360° (или 270° - 0°)
        // Если угол в диапазоне [0°, 90°), переводим в [360°-range, 360°)
        if (angle < 90) {
          angle += 360;
        }
        // Теперь угол в диапазоне [270°, 450°)
        if (angle < angleMin) angle = angleMin;
        if (angle > angleMax + 360) angle = angleMax + 360;
        // Нормализуем обратно в [0°, 360°)
        while (angle >= 360) angle -= 360;
      } else {
        // Квадранты 1, 2, 3: стандартная обработка
        if (angle < angleMin) angle = angleMin;
        if (angle > angleMax) angle = angleMax;
      }

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

      // Предварительное разведение: если технологии имеют идентичные координаты,
      // слегка разводим их по углу с учетом размеров элементов
      const COORDINATE_TOLERANCE = 0.5; // Минимальная разница в координатах для считания идентичными
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          const a = group[i];
          const b = group[j];
          const dx = Math.abs(b.x - a.x);
          const dy = Math.abs(b.y - a.y);

          // Если координаты практически идентичны, разводим по углу
          if (dx < COORDINATE_TOLERANCE && dy < COORDINATE_TOLERANCE) {
            const q = quadrantById[a.quadrant];
            if (q) {
              const ANGLE_PAD = POSITION_ANGLE_PAD;
              const ANGLE_SPAN = 90 - (ANGLE_PAD * 2);

              // Вычисляем текущие углы
              let polarA = window.cartesianToPolar(CENTER_X, CENTER_Y, a.x, a.y);
              let polarB = window.cartesianToPolar(CENTER_X, CENTER_Y, b.x, b.y);

              // Обрабатываем квадрант 4, который пересекает 0°
              if (q.id === 4) {
                if (polarA.angle < 90) polarA.angle += 360;
                if (polarB.angle < 90) polarB.angle += 360;
              }

              // Получаем размеры элементов
              const sizeA = (a.size && typeof a.size === 'number') ? a.size : 10;
              const sizeB = (b.size && typeof b.size === 'number') ? b.size : 10;

              // Вычисляем угловые размеры элементов на текущих радиусах
              const angularSizeA = calculateAngularSizeInDegrees(sizeA * 1.2, polarA.radius);
              const angularSizeB = calculateAngularSizeInDegrees(sizeB * 1.2, polarB.radius);

              // Корректируем границы с учетом размеров элементов
              const angleMin = q.startAngle + ANGLE_PAD + Math.max(angularSizeA, angularSizeB);
              const angleMax = q.startAngle + ANGLE_PAD + ANGLE_SPAN - Math.max(angularSizeA, angularSizeB);

              // Добавляем смещение по углу на основе ID с учетом углового размера
              const availableSpan = Math.max(1, angleMax - angleMin);
              const angleOffsetA = ((Number(a.id) || 0) * 5) % (availableSpan / 3);
              const angleOffsetB = ((Number(b.id) || 0) * 5) % (availableSpan / 3);

              // Вычисляем новые углы с ограничением по квадранту
              // Учитываем минимальное угловое расстояние между элементами
              const minAngularDistance = angularSizeA + angularSizeB + 2; // сумма угловых размеров + зазор
              let newAngleA = angleMin + angleOffsetA;
              let newAngleB = angleMin + angleOffsetB + minAngularDistance;

              // Ограничиваем углы в пределах квадранта
              if (newAngleA < angleMin) newAngleA = angleMin;
              if (newAngleA > angleMax) newAngleA = angleMax;
              if (newAngleB < angleMin) newAngleB = angleMin;
              if (newAngleB > angleMax) newAngleB = angleMax;

              // Нормализуем углы для квадранта 4
              if (q.id === 4) {
                while (newAngleA >= 360) newAngleA -= 360;
                while (newAngleB >= 360) newAngleB -= 360;
              }

              const newPosA = window.polarToCartesian(CENTER_X, CENTER_Y, polarA.radius, newAngleA);
              const newPosB = window.polarToCartesian(CENTER_X, CENTER_Y, polarB.radius, newAngleB);

              a.x = Math.round(newPosA.x);
              a.y = Math.round(newPosA.y);
              b.x = Math.round(newPosB.x);
              b.y = Math.round(newPosB.y);

              // Применяем строгое ограничение в пределах квадранта
              clampToSectorRing(a);
              clampToSectorRing(b);
            }
          }
        }
      }

      // Адаптивное минимальное расстояние в зависимости от количества технологий в квадранте
      // Чем больше технологий, тем больше должно быть минимальное расстояние
      const techCount = group.length;
      let baseMinDistance = MIN_BLIP_DISTANCE;

      // Учитываем размеры элементов при расчете минимального расстояния
      // Находим максимальный размер в группе
      let maxSize = 10; // размер по умолчанию
      group.forEach(t => {
        if (t.size && typeof t.size === 'number' && t.size > maxSize) {
          maxSize = t.size;
        }
      });

      // Минимальное расстояние должно быть не меньше суммы радиусов двух самых больших элементов
      // плюс небольшой зазор
      const sizeBasedMinDistance = maxSize * 2 + 4; // 2 радиуса + зазор 4px
      baseMinDistance = Math.max(MIN_BLIP_DISTANCE, sizeBasedMinDistance);

      const adaptiveMinDistance = techCount > 10
        ? baseMinDistance * 1.3
        : techCount > 5
          ? baseMinDistance * 1.15
          : baseMinDistance;

      const MIN_BLIP_DISTANCE_SQ = adaptiveMinDistance * adaptiveMinDistance;
      // Увеличиваем количество итераций для лучшего разведения
      const ENHANCED_MAX_ITER = 120;

      for (let iter = 0; iter < ENHANCED_MAX_ITER; iter++) {
        let moved = false;

        // Используем более агрессивное разведение для близких точек
        for (let i = 0; i < group.length; i++) {
          for (let j = i + 1; j < group.length; j++) {
            const a = group[i];
            const b = group[j];
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const distSq = dx * dx + dy * dy;

            // Рассчитываем минимальное расстояние с учетом размеров конкретных элементов
            const sizeA = (a.size && typeof a.size === 'number') ? a.size : 10;
            const sizeB = (b.size && typeof b.size === 'number') ? b.size : 10;
            const minDistForPair = sizeA + sizeB + 4; // сумма радиусов + зазор
            const minDistForPairSq = minDistForPair * minDistForPair;

            // Если точки слишком близко, разводим их
            if (distSq < minDistForPairSq) {
              const dist = Math.sqrt(distSq) || 0.001;
              const overlap = minDistForPair - dist;

              // Увеличиваем силу отталкивания для очень близких точек
              const forceMultiplier = dist < minDistForPair * 0.5 ? 1.5 : 1.0;
              const shiftX = (dx / dist) * (overlap / 2) * forceMultiplier;
              const shiftY = (dy / dist) * (overlap / 2) * forceMultiplier;

              a.x -= shiftX;
              a.y -= shiftY;
              b.x += shiftX;
              b.y += shiftY;

              clampToSectorRing(a);
              clampToSectorRing(b);

              moved = true;
            }
          }
        }

        if (!moved) break;
      }

      // Финальная проверка: если после всех итераций остались наложения,
      // применяем более радикальное разведение по радиусу
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          const a = group[i];
          const b = group[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const distSq = dx * dx + dy * dy;

          // Рассчитываем минимальное расстояние с учетом размеров конкретных элементов
          const sizeA = (a.size && typeof a.size === 'number') ? a.size : 10;
          const sizeB = (b.size && typeof b.size === 'number') ? b.size : 10;
          const minDistForPair = sizeA + sizeB + 4; // сумма радиусов + зазор
          const minDistForPairSq = minDistForPair * minDistForPair;

          if (distSq < minDistForPairSq) {
            const q = quadrantById[a.quadrant];
            if (q) {
              const PAD = POSITION_PAD;
              const maxR = (Array.isArray(RINGS) && RINGS.length > 0) ? RINGS.length * RADIUS_STEP : 3 * RADIUS_STEP;
              const rMin = PAD;
              const rMax = maxR - PAD;

              const polarA = window.cartesianToPolar(CENTER_X, CENTER_Y, a.x, a.y);
              const polarB = window.cartesianToPolar(CENTER_X, CENTER_Y, b.x, b.y);

              // Разводим по радиусу: одну точку ближе к центру, другую дальше
              const radiusDiff = minDistForPair * 1.2;
              let newRadiusA = Math.max(rMin, Math.min(rMax, polarA.radius - radiusDiff / 2));
              let newRadiusB = Math.max(rMin, Math.min(rMax, polarB.radius + radiusDiff / 2));

              // Если радиусы выходят за границы, меняем стратегию
              if (newRadiusA <= rMin) {
                newRadiusA = polarA.radius;
                newRadiusB = Math.min(rMax, polarB.radius + radiusDiff);
              }
              if (newRadiusB >= rMax) {
                newRadiusB = polarB.radius;
                newRadiusA = Math.max(rMin, polarA.radius - radiusDiff);
              }

              const newPosA = window.polarToCartesian(CENTER_X, CENTER_Y, newRadiusA, polarA.angle);
              const newPosB = window.polarToCartesian(CENTER_X, CENTER_Y, newRadiusB, polarB.angle);

              a.x = Math.round(newPosA.x);
              a.y = Math.round(newPosA.y);
              b.x = Math.round(newPosB.x);
              b.y = Math.round(newPosB.y);

              clampToSectorRing(a);
              clampToSectorRing(b);
            }
          }
        }
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

  /**
   * Утилита для тестирования калибровки модели позиционирования
   * Вызов в консоли: Positioning.testCalibration({techRead: 3, organRead: 3, funcCover: 3, trlStage: 3})
   */
  function testCalibration(params) {
    const tech = {
      id: 1,
      direction: 'Единый центр данных (Data Hub)',
      directions: ['Единый центр данных (Data Hub)'],
      techRead: params.techRead !== undefined ? params.techRead : 0,
      organRead: params.organRead !== undefined ? params.organRead : 0,
      funcCover: params.funcCover !== undefined ? params.funcCover : 0,
      trlStage: params.trlStage !== undefined ? params.trlStage : 1,
      enterprises: []
    };

    const result = calculateRadarPosition(tech);

    console.log('=== Тест калибровки модели позиционирования ===');
    console.log('Входные параметры:', {
      techRead: tech.techRead,
      organRead: tech.organRead,
      funcCover: tech.funcCover,
      trlStage: tech.trlStage
    });
    console.log('Результат:', {
      theta: result.theta.toFixed(2) + '°',
      radius: result.radius.toFixed(2) + '%',
      position: result.radius < 30 ? 'Близко к центру' :
                result.radius < 70 ? 'Среднее положение' :
                'Далеко от центра'
    });

    return result;
  }

  /**
   * Тестирование калибровки с предустановленными сценариями
   * Вызов в консоли: Positioning.testAllScenarios()
   */
  function testAllScenarios() {
    console.log('=== Тестирование всех сценариев калибровки ===\n');

    const scenarios = [
      { name: 'Максимальные параметры', params: { techRead: 3, organRead: 3, funcCover: 3, trlStage: 3 } },
      { name: 'Высокие параметры', params: { techRead: 2.5, organRead: 2.5, funcCover: 2.5, trlStage: 2.5 } },
      { name: 'Средние параметры', params: { techRead: 1.5, organRead: 1.5, funcCover: 1.5, trlStage: 2 } },
      { name: 'Низкие параметры', params: { techRead: 0.5, organRead: 0.5, funcCover: 0.5, trlStage: 1 } },
      { name: 'Минимальные параметры', params: { techRead: 0, organRead: 0, funcCover: 0, trlStage: 1 } },
      { name: 'Высокая techRead, остальное низкое', params: { techRead: 3, organRead: 0, funcCover: 0, trlStage: 1 } },
      { name: 'Высокая organRead, остальное низкое', params: { techRead: 0, organRead: 3, funcCover: 0, trlStage: 1 } },
      { name: 'Высокая funcCover, остальное низкое', params: { techRead: 0, organRead: 0, funcCover: 3, trlStage: 1 } },
      { name: 'Высокая trlStage, остальное низкое', params: { techRead: 0, organRead: 0, funcCover: 0, trlStage: 3 } }
    ];

    const results = scenarios.map(scenario => {
      const result = testCalibration(scenario.params);
      return {
        scenario: scenario.name,
        radius: result.radius.toFixed(2) + '%'
      };
    });

    console.table(results);
    console.log('\n✅ Тестирование завершено!');
  }

  // Экспорт в window.Positioning
  window.Positioning = {
    frac,
    getQuadrantIdForDirection,
    getQuadrantsForDirection,
    getAllQuadrantsForTech,
    // Устаревшие функции для обратной совместимости (только для фильтрации)
    getQuadrantIdForBlock,
    getQuadrantsForBlock,
    assignFixedPosition,
    assignFixedPositionForQuadrant,
    computeCoordinates,
    applyNonOverlappingLayout,
    avoidRingLabelOverlap,
    calculateReadinessScore,
    calculateRadiusFromReadiness,
    calculateRadarPosition,
    // Новые функции для учета размеров элементов
    calculateElementSize,
    calculateAngularSize,
    // Утилиты для тестирования
    testCalibration,
    testAllScenarios
  };

})();
