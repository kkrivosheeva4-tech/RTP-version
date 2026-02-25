// Модуль позиционирования blip'ов на радаре
// Экспортирует функции в window.Positioning для использования в RMK-director.js
// Использует глобальные переменные из RMK-director.js: CENTER_X, CENTER_Y, RADIUS_STEP,
// POSITION_PAD, POSITION_ANGLE_PAD, MIN_BLIP_DISTANCE, QUADRANTS, RINGS, levelToRing
// Использует функции из radar-utils.js: polarToCartesian, cartesianToPolar

import Logger from '../core/logger.js';

'use strict';

// ОБНОВЛЕНО (2026-01-29): Кеш для расчетов позиций технологий
  // Кеширует результаты расчета позиций для улучшения производительности
  const positionCache = new Map();
  const CACHE_VERSION = '2.3'; // Версия кеша (обновлено: веса techRead/organRead 0.35, trlStage 0.10)
  const CACHE_STORAGE_KEY = 'rmk_position_cache'; // Ключ для localStorage
  const CACHE_STORAGE_VERSION_KEY = 'rmk_position_cache_version'; // Ключ для версии кеша

  /**
   * Генерация ключа кеша для технологии
   * ОБНОВЛЕНО: Включает информацию о выбранных предприятиях из фильтра
   * @param {Object} tech - Объект технологии
   * @returns {string} Ключ кеша
   */
  function getCacheKey(tech) {
    if (!tech || !tech.id) return null;

    // Получаем выбранные предприятия из фильтра (влияют на расчет techRead и organRead)
    let selectedEnterpriseFilter = '';
    if (typeof window !== 'undefined' && window.Filters && typeof window.Filters.getFilterValues === 'function') {
      const selectedEnterprises = window.Filters.getFilterValues('enterprise') || [];
      if (selectedEnterprises.length > 0) {
        // Сортируем для стабильности ключа
        selectedEnterpriseFilter = selectedEnterprises.slice().sort().join(',');
      }
    }

    // Создаем ключ на основе ID и основных параметров, влияющих на позицию
    const techRead = tech.techRead !== undefined ? tech.techRead : 'null';
    const organRead = tech.organRead !== undefined ? tech.organRead : 'null';
    const funcCover = tech.funcCover !== undefined ? tech.funcCover : 'null';
    const trlStage = tech.trlStage !== undefined ? tech.trlStage : 'null';
    const directions = Array.isArray(tech.directions) ? tech.directions.join(',') : (tech.direction || '');

    // Учитываем предприятия, если они есть
    let enterprisesKey = '';
    if (Array.isArray(tech.enterprises) && tech.enterprises.length > 0) {
      // Сортируем для стабильности ключа
      enterprisesKey = tech.enterprises
        // ВАЖНО: используем nullish-coalescing, чтобы 0 не превращался в пустую строку
        // Также включаем признак внедрения, т.к. он влияет на расчёт (внедрённые исключаются)
        .map(e => {
          if (!e || typeof e !== 'object') return ':::'; // стабильный маркер "плохой записи"
          const enterpriseId = (e.enterpriseId ?? '');
          const techR = (e.technologicalReadiness ?? '');
          const organR = (e.organizationalReadiness ?? '');
          const status = String(e.status || '').trim().toLowerCase();
          const isImplemented = (e.isImplemented === true) || status === 'внедрена' || status === 'внедренна';
          return `${enterpriseId}:${techR}:${organR}:${isImplemented ? 1 : 0}`;
        })
        .sort()
        .join('|');
    }

    // Учитываем параметры модели (влияют на радиус) и визуальные параметры (влияют на угол)
    // Это помогает избежать рассинхронизации кеша при изменении window.RadarModelConfig.
    let modelKey = '';
    try {
      const cfg = (typeof window !== 'undefined' && window.RadarModelConfig) ? window.RadarModelConfig : {};
      const w = (cfg && cfg.weights) ? cfg.weights : {};
      const rMin = (cfg && cfg.r_min !== undefined) ? cfg.r_min : 5;
      const rMax = (cfg && cfg.r_max !== undefined) ? cfg.r_max : 95;
      const pad = (typeof window !== 'undefined' && window.POSITION_ANGLE_PAD !== undefined) ? window.POSITION_ANGLE_PAD : 8;
      // Стабильный порядок полей
      modelKey = `rmin=${rMin};rmax=${rMax};w=${w.techRead ?? ''},${w.organRead ?? ''},${w.funcCover ?? ''},${w.trlStage ?? ''};pad=${pad}`;
    } catch (e) {
      modelKey = '';
    }

    // Включаем фильтр по предприятиям в ключ кеша
    return `${CACHE_VERSION}:${tech.id}:${techRead}:${organRead}:${funcCover}:${trlStage}:${directions}:${enterprisesKey}:filter:${selectedEnterpriseFilter}:model:${modelKey}`;
  }

  /**
   * Сохранение кеша позиций в localStorage
   * ОБНОВЛЕНО: Добавлено сохранение кеша для стабильности позиций при перезагрузке
   */
  function savePositionCache() {
    try {
      const cacheData = Array.from(positionCache.entries());
      localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(cacheData));
      localStorage.setItem(CACHE_STORAGE_VERSION_KEY, CACHE_VERSION);
      if (Logger && typeof Logger.debug === 'function') {
        Logger.debug(`[Positioning] Кеш позиций сохранен (${cacheData.length} записей)`);
      }
    } catch (e) {
      // Ошибка при сохранении кеша в localStorage (может быть из-за ограничений размера)
      if (Logger && typeof Logger.warn === 'function') {
        Logger.warn('[Positioning] Не удалось сохранить кеш позиций в localStorage', e);
      }
    }
  }

  /**
   * Загрузка кеша позиций из localStorage
   * ОБНОВЛЕНО: Добавлена загрузка кеша для стабильности позиций при перезагрузке
   */
  function loadPositionCache() {
    try {
      const savedVersion = localStorage.getItem(CACHE_STORAGE_VERSION_KEY);
      // Проверяем версию кеша - если версия изменилась, очищаем старый кеш
      if (savedVersion !== CACHE_VERSION) {
        if (savedVersion) {
          localStorage.removeItem(CACHE_STORAGE_KEY);
          localStorage.removeItem(CACHE_STORAGE_VERSION_KEY);
          if (Logger && typeof Logger.debug === 'function') {
            Logger.debug('[Positioning] Старый кеш позиций очищен (изменилась версия)');
          }
        }
        return;
      }

      const cacheDataStr = localStorage.getItem(CACHE_STORAGE_KEY);
      if (cacheDataStr) {
        const cacheData = JSON.parse(cacheDataStr);
        if (Array.isArray(cacheData)) {
          positionCache.clear();
          cacheData.forEach(([key, value]) => {
            if (key && value && typeof value.x === 'number' && typeof value.y === 'number') {
              positionCache.set(key, value);
            }
          });
          if (Logger && typeof Logger.debug === 'function') {
            Logger.debug(`[Positioning] Кеш позиций загружен из localStorage (${positionCache.size} записей)`);
          }
        }
      }
    } catch (e) {
      // Ошибка при загрузке кеша из localStorage
      if (Logger && typeof Logger.warn === 'function') {
        Logger.warn('[Positioning] Не удалось загрузить кеш позиций из localStorage', e);
      }
    }
  }

  /**
   * Очистка кеша позиций
   * Вызывается при изменении данных или параметров модели
   */
  function clearPositionCache() {
    positionCache.clear();
    try {
      localStorage.removeItem(CACHE_STORAGE_KEY);
      localStorage.removeItem(CACHE_STORAGE_VERSION_KEY);
    } catch (e) {
      // Игнорируем ошибки при удалении из localStorage
    }
    if (Logger && typeof Logger.debug === 'function') {
      Logger.debug('[Positioning] Кеш позиций очищен');
    }
  }

  /**
   * Очистка только финальных позиций (после разведения)
   * Вызывается при изменении фильтров, чтобы пересчитать позиции с учетом нового состава технологий
   */
  function clearFinalPositionsCache() {
    const keysToDelete = [];
    positionCache.forEach((value, key) => {
      if (key.includes(':final:quadrant:')) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach(key => positionCache.delete(key));
    if (Logger && typeof Logger.debug === 'function') {
      Logger.debug(`[Positioning] Кеш финальных позиций очищен (${keysToDelete.length} записей)`);
    }
  }

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
    let directionName = getDirectionNameById(directionNameOrId);

    // Если название не найдено, пробуем использовать исходное значение
    if (!directionName) {
      directionName = directionNameOrId;
    }

    // Пробуем найти квадрант по названию
    let m = window.directionToQuadrant[directionName];

    // Если не найдено по названию и исходное значение - число, пробуем найти по ID
    if (m == null && typeof directionNameOrId === 'number') {
      m = window.directionToQuadrant[directionNameOrId];
    }

    // Если все еще не найдено, пробуем найти по строковому представлению ID
    if (m == null && typeof directionNameOrId === 'number') {
      m = window.directionToQuadrant[String(directionNameOrId)];
    }

    if (Array.isArray(m)) return m.length ? m[0] : null;
    return (typeof m === 'number') ? m : null;
  }

  // Получить все квадранты для направления
  function getQuadrantsForDirection(directionNameOrId) {
    if (directionNameOrId == null || !window.directionToQuadrant) return [];

    // Преобразуем ID в название, если нужно
    let directionName = getDirectionNameById(directionNameOrId);

    // Если название не найдено, пробуем использовать исходное значение
    if (!directionName) {
      directionName = directionNameOrId;
    }

    // Пробуем найти квадрант по названию
    let m = window.directionToQuadrant[directionName];

    // Если не найдено по названию и исходное значение - число, пробуем найти по ID
    if (m == null && typeof directionNameOrId === 'number') {
      m = window.directionToQuadrant[directionNameOrId];
    }

    // Если все еще не найдено, пробуем найти по строковому представлению ID
    if (m == null && typeof directionNameOrId === 'number') {
      m = window.directionToQuadrant[String(directionNameOrId)];
    }

    if (m == null) return [];
    if (Array.isArray(m)) return m.filter(q => typeof q === 'number');
    if (typeof m === 'number') return [m];
    return [];
  }

  // Получить все уникальные квадранты для технологии на основе направлений
  // ОБНОВЛЕНО (2026-01-29): Удален fallback через блоки - блоки больше не привязаны к квадрантам
  // Блоки теперь используются только для определения функциональных областей технологии
  function getAllQuadrantsForTech(tech) {
    if (!tech) return [];
    const quadrantsSet = new Set();

    // Используем только направления для определения квадрантов
    const directions = Array.isArray(tech.directions) && tech.directions.length
      ? tech.directions
      : (tech.direction ? [tech.direction] : []);

    if (directions.length > 0) {
      // Если есть направления, используем их
      directions.forEach(directionName => {
        const directionQuadrants = getQuadrantsForDirection(directionName);
        if (directionQuadrants.length === 0) {
          // Если квадрант не найден, логируем для отладки
          if (Logger && typeof Logger.warn === 'function') {
            const directionNameStr = getDirectionNameById(directionName) || directionName;
            Logger.warn(`[Positioning] Не найден квадрант для направления "${directionNameStr}" (ID: ${directionName}) в технологии ${tech.id || tech.name || 'unknown'}. Проверьте directionToQuadrant.`);
          }
        }
        directionQuadrants.forEach(q => quadrantsSet.add(q));
      });
    }

    // ОБНОВЛЕНО (2026-01-29): Если направлений нет или квадранты не найдены, размещаем в квадранте 1 (по умолчанию)
    // Блоки больше не используются для определения квадранта, так как они являются
    // отдельными критериями технологии и могут быть в любом квадранте
    if (quadrantsSet.size === 0) {
      if (Logger && typeof Logger.warn === 'function') {
        Logger.warn(`[Positioning] Технология ${tech.id || tech.name || 'unknown'} не имеет направлений или квадранты не найдены, размещаем в квадранте 1 (по умолчанию)`);
      }
      quadrantsSet.add(1); // Квадрант 1 по умолчанию
    }

    return Array.from(quadrantsSet);
  }

  // Получить id квадранта для блока
  // УДАЛЕНО (2026-01-29): Блоки больше не привязаны к квадрантам
  // Блоки являются отдельными критериями технологии и могут быть в любом квадранте
  // Квадранты определяются только через направления цифрового развития
  function getQuadrantIdForBlock(blockKey) {
    // Блоки не привязаны к квадрантам
    return null;
  }

  // Получить все квадранты для блока
  // УДАЛЕНО (2026-01-29): Блоки больше не привязаны к квадрантам
  // Блоки являются отдельными критериями технологии и могут быть в любом квадранте
  function getQuadrantsForBlock(blockKey) {
    // Блоки не привязаны к квадрантам
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
   * Вычисляет размер элемента (радиус в пикселях) для технологии.
   * Единый размер для всех технологий.
   * @param {Object} tech - Объект технологии
   * @returns {number} - Размер элемента (радиус в пикселях)
   */
  function calculateElementSize(tech) {
    return 10;
  }

  /**
   * Определение отсутствующих данных в технологии
   * ОБНОВЛЕНО (2026-01-29): Добавлена функция для визуальной индикации неполноты данных
   *
   * @param {Object} tech - Объект технологии
   * @returns {Object} Объект с информацией об отсутствующих данных
   */
  function getMissingDataInfo(tech) {
    if (!tech) {
      return {
        hasMissingData: true,
        missingFactors: ['techRead', 'organRead', 'funcCover', 'trlStage'],
        missingEnterprises: []
      };
    }

    const missingFactors = [];
    const missingEnterprises = [];

    // Проверяем наличие данных о предприятиях
    const enterprises = Array.isArray(tech.enterprises) ? tech.enterprises : [];
    const hasEnterprises = enterprises.length > 0;

    // Проверяем techRead и organRead
    if (hasEnterprises) {
      // Проверяем оценки по предприятиям
      let hasTechRead = false;
      let hasOrganRead = false;
      const enterprisesWithoutData = [];

      enterprises.forEach(ent => {
        if (ent && typeof ent === 'object') {
          const hasTechReadValue = ent.technologicalReadiness !== undefined &&
            ent.technologicalReadiness !== null &&
            !isNaN(Number(ent.technologicalReadiness));
          const hasOrganReadValue = ent.organizationalReadiness !== undefined &&
            ent.organizationalReadiness !== null &&
            !isNaN(Number(ent.organizationalReadiness));

          if (hasTechReadValue) hasTechRead = true;
          if (hasOrganReadValue) hasOrganRead = true;

          if (!hasTechReadValue || !hasOrganReadValue) {
            enterprisesWithoutData.push(ent.enterpriseId || 'unknown');
          }
        }
      });

      if (!hasTechRead) missingFactors.push('techRead');
      if (!hasOrganRead) missingFactors.push('organRead');
      if (enterprisesWithoutData.length > 0) {
        missingEnterprises.push(...enterprisesWithoutData);
      }
    } else {
      // Проверяем общие значения (fallback)
      if (tech.techRead === undefined || tech.techRead === null) {
        missingFactors.push('techRead');
      }
      if (tech.organRead === undefined || tech.organRead === null) {
        missingFactors.push('organRead');
      }
    }

    // Проверяем funcCover
    if ((tech.funcCover === undefined || tech.funcCover === null || tech.funcCover === 0) &&
      (!Array.isArray(tech.functionCoverage) || tech.functionCoverage.length === 0)) {
      missingFactors.push('funcCover');
    }

    // Проверяем trlStage
    if (tech.trlStage === undefined || tech.trlStage === null) {
      missingFactors.push('trlStage');
    }

    return {
      hasMissingData: missingFactors.length > 0,
      missingFactors: missingFactors,
      missingEnterprises: [...new Set(missingEnterprises)], // Убираем дубликаты
      hasEnterprises: hasEnterprises
    };
  }

  /**
   * Валидация и нормализация входных значений факторов готовности
   *
   * @param {*} value - Значение для валидации
   * @param {string} factorName - Название фактора (для логирования)
   * @param {number} min - Минимальное допустимое значение
   * @param {number} max - Максимальное допустимое значение
   * @param {number} defaultValue - Значение по умолчанию при отсутствии данных
   * @returns {number|null} - Валидированное значение или null если данные отсутствуют
   */
  function validateAndNormalizeFactor(value, factorName, min, max, defaultValue = null) {
    // Если значение явно null или undefined, возвращаем null (отсутствие данных)
    if (value === null || value === undefined) {
      return null;
    }

    // Преобразуем в число
    const numValue = Number(value);

    // Проверяем на NaN
    if (isNaN(numValue)) {
      if (Logger && typeof Logger.warn === 'function') {
        Logger.warn(`[Positioning] Некорректное значение ${factorName}: ${value}. Используется значение по умолчанию.`);
      } else {
        // Некорректное значение, используется значение по умолчанию
      }
      return defaultValue;
    }

    // Проверяем диапазон
    if (numValue < min || numValue > max) {
      if (Logger && typeof Logger.warn === 'function') {
        Logger.warn(`[Positioning] Значение ${factorName} (${numValue}) выходит за допустимый диапазон [${min}, ${max}]. Ограничено до границ диапазона.`);
      } else {
        // Значение выходит за допустимый диапазон, ограничено до границ
      }
      // Ограничиваем до границ диапазона
      return Math.max(min, Math.min(max, numValue));
    }

    return numValue;
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
   *
   * ВАЛИДАЦИЯ (обновлено 2026-01-29):
   * - Все входные значения факторов валидируются на корректность диапазонов
   * - Некорректные значения логируются и ограничиваются до допустимых границ
   * - Отсутствующие данные (null/undefined) обрабатываются явно
   */
  function calculateRadarPosition(tech) {
    if (!tech) {
      if (Logger && typeof Logger.warn === 'function') {
        Logger.warn('[Positioning] calculateRadarPosition вызвана с null/undefined технологией');
      }
      return { theta: 0, radius: 50 };
    }

    // === ВЫЧИСЛЕНИЕ УГЛА (θ) ===
    // ОБНОВЛЕНО: Угол теперь рассчитывается для конкретного квадранта
    // Если квадрант не указан, используется первый квадрант из направлений технологии
    // Для технологий с несколькими направлениями каждый квадрант получает уникальный угол
    const QUADRANTS = window.QUADRANTS || [];
    const POSITION_ANGLE_PAD = window.POSITION_ANGLE_PAD || 8;
    const GOLDEN_ANGLE = 137.50776405003785;

    // Используем направления для определения квадранта
    const directions = Array.isArray(tech.directions) && tech.directions.length
      ? tech.directions
      : (tech.direction ? [tech.direction] : []);

    // Берем первое направление для определения квадранта (для обратной совместимости)
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
        // ОБНОВЛЕНО: Используем уникальный угол на основе ID технологии и квадранта
        // Это обеспечивает разные углы для одной технологии в разных квадрантах
        const quadrantHash = id * 1000 + quadrantId * 37;
        const angleOffset = (quadrantHash * GOLDEN_ANGLE) % ANGLE_SPAN;
        theta = aBase + angleOffset;
      }
    }

    // === ВЫЧИСЛЕНИЕ РАДИУСА (r) ===
    // ОБНОВЛЕНО: Заменена логистическая функция на линейную модель
    // Линейная модель более интуитивна и предсказуема
    // Параметры можно переопределить через window.RadarModelConfig

    // Веса факторов (w_k)
    // Все факторы положительные - "приближающие" (уменьшают радиус).
    // Готовность по предприятиям (techRead, organRead) имеет больший вес, чтобы при низких
    // оценках технология не смещалась к центру из-за одного высокого TRL.
    const defaultWeights = {
      techRead: 0.35,      // Технологическая готовность предприятия (0-3)
      organRead: 0.35,     // Организационная готовность предприятия (0-3)
      funcCover: 0.20,     // Покрытие функций (0-3)
      trlStage: 0.10       // TRL стадия (1-3) — общая зрелость технологии
    };

    // Получаем веса из конфигурации или используем значения по умолчанию
    let weights = defaultWeights;
    if (window.RadarModelConfig && window.RadarModelConfig.weights) {
      weights = Object.assign({}, defaultWeights, window.RadarModelConfig.weights);

      // Нормализуем веса, чтобы их сумма была равна 1.0
      const sum = weights.techRead + weights.organRead + weights.funcCover + weights.trlStage;
      if (Math.abs(sum - 1.0) > 0.001) {
        if (Logger && typeof Logger.warn === 'function') {
          Logger.warn(`[Positioning] Сумма весов факторов (${sum.toFixed(3)}) не равна 1.0. Выполняется нормализация.`);
        } else {
          // Сумма весов факторов не равна 1.0, выполняется нормализация
        }
        const normalizationFactor = 1.0 / sum;
        weights = {
          techRead: weights.techRead * normalizationFactor,
          organRead: weights.organRead * normalizationFactor,
          funcCover: weights.funcCover * normalizationFactor,
          trlStage: weights.trlStage * normalizationFactor
        };
      }
    }

    // ОБНОВЛЕНО: Параметры калибровки для линейной модели
    // r_min и r_max определяют диапазон радиуса
    // r_min = 5%: минимальный радиус (близко к центру) для максимальной готовности
    // r_max = 95%: максимальный радиус (близко к краю) для минимальной готовности
    const r_min = (window.RadarModelConfig && window.RadarModelConfig.r_min !== undefined)
      ? window.RadarModelConfig.r_min
      : 5; // Значение по умолчанию: 5%
    const r_max = (window.RadarModelConfig && window.RadarModelConfig.r_max !== undefined)
      ? window.RadarModelConfig.r_max
      : 95; // Значение по умолчанию: 95%

    // Извлечение и нормализация факторов (s_ik → x_ik)
    // techRead и organRead вычисляются как среднее значение по выбранным предприятиям из фильтра
    // funcCover и trlStage - общие значения для технологии

    let techRead = null;
    let organRead = null;

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

    // ОБНОВЛЕНО: Исключаем внедренные предприятия из расчета позиции
    // Радар показывает только потенциал внедрения для невнедренных предприятий
    const nonImplementedEnterprises = filteredEnterprises.filter(ent => {
      if (!ent || typeof ent !== 'object') return false;

      // Проверяем статус внедрения (только "Внедрена"/"Внедренна", не "Невнедренна")
      const status = String(ent.status || '').trim().toLowerCase();
      const isImplemented = ent.isImplemented === true || status === 'внедрена' || status === 'внедренна';

      return !isImplemented;
    });

    // Если все предприятия внедрены, считаем techRead/organRead по внедрённым предприятиям
    // (для корректной позиции и отсутствия подсветки "нет оценок" при фильтре "Внедренные")
    if (nonImplementedEnterprises.length === 0 && filteredEnterprises.length > 0) {
      let sumTechRead = 0;
      let sumOrganRead = 0;
      let countTechRead = 0;
      let countOrganRead = 0;
      filteredEnterprises.forEach(ent => {
        if (ent && typeof ent === 'object') {
          const techReadValue = validateAndNormalizeFactor(
            ent.technologicalReadiness,
            `technologicalReadiness (tech.id=${tech.id || 'unknown'})`,
            0,
            3,
            null
          );
          const organReadValue = validateAndNormalizeFactor(
            ent.organizationalReadiness,
            `organizationalReadiness (tech.id=${tech.id || 'unknown'})`,
            0,
            3,
            null
          );
          if (techReadValue !== null) {
            sumTechRead += techReadValue;
            countTechRead++;
          }
          if (organReadValue !== null) {
            sumOrganRead += organReadValue;
            countOrganRead++;
          }
        }
      });
      if (countTechRead > 0) techRead = sumTechRead / countTechRead;
      if (countOrganRead > 0) organRead = sumOrganRead / countOrganRead;

      if (Logger && typeof Logger.debug === 'function') {
        Logger.debug(`[Positioning] Технология ${tech.id || 'unknown'} полностью внедрена, оценки для позиции взяты по ${filteredEnterprises.length} предприятиям`);
      }
    } else if (nonImplementedEnterprises.length > 0) {
      // Вычисляем среднее значение technologicalReadiness и organizationalReadiness
      // только по невнедренным предприятиям
      let sumTechRead = 0;
      let sumOrganRead = 0;
      let countTechRead = 0;
      let countOrganRead = 0;

      nonImplementedEnterprises.forEach(ent => {
        if (ent && typeof ent === 'object') {
          // Валидация technologicalReadiness
          const techReadValue = validateAndNormalizeFactor(
            ent.technologicalReadiness,
            `technologicalReadiness (tech.id=${tech.id || 'unknown'})`,
            0,
            3,
            null // null означает отсутствие данных, не используем значение по умолчанию
          );

          if (techReadValue !== null) {
            sumTechRead += techReadValue;
            countTechRead++;
          }

          // Валидация organizationalReadiness
          const organReadValue = validateAndNormalizeFactor(
            ent.organizationalReadiness,
            `organizationalReadiness (tech.id=${tech.id || 'unknown'})`,
            0,
            3,
            null // null означает отсутствие данных
          );

          if (organReadValue !== null) {
            sumOrganRead += organReadValue;
            countOrganRead++;
          }
        }
      });

      // Вычисляем средние значения только по невнедренным предприятиям
      if (countTechRead > 0) {
        techRead = sumTechRead / countTechRead;
      }
      if (countOrganRead > 0) {
        organRead = sumOrganRead / countOrganRead;
      }

      if (Logger && typeof Logger.debug === 'function') {
        Logger.debug(`[Positioning] Технология ${tech.id || 'unknown'}: учтено ${nonImplementedEnterprises.length} невнедренных из ${filteredEnterprises.length} предприятий`);
      }
    } else if (enterprises.length === 0) {
      // Если у технологии нет enterprises, но есть общие techRead и organRead (для обратной совместимости)
      // Используем их как fallback, но это не рекомендуется - оценки должны быть для предприятий
      techRead = validateAndNormalizeFactor(
        tech.techRead,
        `tech.techRead (tech.id=${tech.id || 'unknown'})`,
        0,
        3,
        null
      );
      organRead = validateAndNormalizeFactor(
        tech.organRead,
        `tech.organRead (tech.id=${tech.id || 'unknown'})`,
        0,
        3,
        null
      );
    }

    // funcCover и trlStage - общие значения для технологии
    // Если funcCover не задан, вычисляем его из functionCoverage
    let funcCover = tech.funcCover !== undefined && tech.funcCover !== null ? tech.funcCover : null;

    // ОБНОВЛЕНО (2026-01-29): Исправлена асинхронность расчета funcCover
    // ОБНОВЛЕНО: Добавлен учет важности функций
    // Теперь используем синхронный расчет с предзагруженными данными
    if (funcCover === null || funcCover === undefined || funcCover === 0) {
      // Вычисляем funcCover из functionCoverage (массив функций)
      if (Array.isArray(tech.functionCoverage) && tech.functionCoverage.length > 0) {
        const blockIds = Array.isArray(tech.blocks) ? tech.blocks : (tech.block ? (Array.isArray(tech.block) ? tech.block : [tech.block]) : []);

        // Пытаемся использовать синхронный расчет с учетом блоков и важности функций
        if (window.FuncCoverUtils && typeof window.FuncCoverUtils.calculateFuncCoverSync === 'function') {
          // Используем синхронный метод, который работает с предзагруженными данными
          // Включаем учет важности функций по умолчанию
          funcCover = window.FuncCoverUtils.calculateFuncCoverSync(tech.functionCoverage, blockIds, { useWeights: true });
        } else if (window.FuncCoverUtils && typeof window.FuncCoverUtils.calculateFuncCoverLegacy === 'function') {
          // Fallback на legacy расчет
          funcCover = window.FuncCoverUtils.calculateFuncCoverLegacy(tech.functionCoverage.length);
        } else {
          // Fallback если модуль не загружен
          const funcCount = tech.functionCoverage.length;
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

    // Валидация funcCover
    funcCover = validateAndNormalizeFactor(
      funcCover,
      `funcCover (tech.id=${tech.id || 'unknown'})`,
      0,
      3,
      0 // Значение по умолчанию - отсутствие покрытия
    );
    // Если валидация вернула null, используем 0
    if (funcCover === null) {
      funcCover = 0;
    }

    // Валидация trlStage
    const trlStage = validateAndNormalizeFactor(
      tech.trlStage,
      `trlStage (tech.id=${tech.id || 'unknown'})`,
      1,
      3,
      1 // Значение по умолчанию - минимальная стадия
    );
    // Если валидация вернула null, используем 1
    const trlStageValue = trlStage !== null ? trlStage : 1;

    // ВАЖНО: НЕ заполняем пропуски "предсказаниями" по умолчанию.
    // Это ломает прозрачность: технология без оценок может оказаться в "нормальной" зоне.
    // Если когда-нибудь понадобится эксперимент, можно включить флаг:
    // window.RadarModelConfig.enableMissingDataPrediction = true
    const enableMissingDataPrediction =
      (window.RadarModelConfig && window.RadarModelConfig.enableMissingDataPrediction === true);

    if (enableMissingDataPrediction && (techRead === null || techRead === undefined) && window.MissingDataPredictor) {
      let allTechnologies = [];
      if (window.StateAccessors && typeof window.StateAccessors.getTechnologies === 'function') {
        allTechnologies = window.StateAccessors.getTechnologies() || [];
      }
      if (allTechnologies.length >= 5) {
        const prediction = window.MissingDataPredictor.kNNPrediction(tech, allTechnologies, 'techRead', 5);
        if (prediction !== null) techRead = prediction;
      }
    }

    if (enableMissingDataPrediction && (organRead === null || organRead === undefined) && window.MissingDataPredictor) {
      let allTechnologies = [];
      if (window.StateAccessors && typeof window.StateAccessors.getTechnologies === 'function') {
        allTechnologies = window.StateAccessors.getTechnologies() || [];
      }
      if (allTechnologies.length >= 5) {
        const prediction = window.MissingDataPredictor.kNNPrediction(tech, allTechnologies, 'organRead', 5);
        if (prediction !== null) organRead = prediction;
      }
    }

    // Нормализация факторов в диапазон [0, 1]
    // techRead, organRead, funcCover: 0-3 → x = value/3
    // trlStage: 1-3 → x = (value-1)/2
    // ОБНОВЛЕНО: Явная обработка отсутствующих данных
    // Не используем средние значения - если данные отсутствуют, они не учитываются в расчете
    // Технологии с отсутствующими данными позиционируются в отдельной зоне

    // Подсчитываем количество отсутствующих факторов
    const missingFactors = [];
    if (techRead === null || techRead === undefined) missingFactors.push('techRead');
    if (organRead === null || organRead === undefined) missingFactors.push('organRead');
    // funcCover = 0 — валидный минимум, это не "пропуск".
    // Считаем funcCover отсутствующим только если не задано поле и нет functionCoverage.
    const hasFunctionCoverage = Array.isArray(tech.functionCoverage) && tech.functionCoverage.length > 0;
    const hasFuncCoverField = (tech.funcCover !== undefined && tech.funcCover !== null);
    if (!hasFuncCoverField && !hasFunctionCoverage) missingFactors.push('funcCover');
    if (trlStageValue === null || trlStageValue === undefined) missingFactors.push('trlStage');

    const hasMissingData = missingFactors.length > 0;

    // Если отсутствует более 2 факторов, позиционируем в зоне "недостаточно данных"
    if (missingFactors.length >= 2) {
      if (Logger && typeof Logger.debug === 'function') {
        Logger.debug(`[Positioning] Технология ${tech.id || 'unknown'} имеет недостаточно данных (${missingFactors.join(', ')}), позиционируется в зоне недостаточных данных`);
      }
      // Позиционируем в зоне "недостаточно данных" (близко к краю, радиус ~85%)
      return {
        theta: theta,
        radius: 85, // Зона недостаточных данных
        hasMissingData: true,
        missingFactors: missingFactors
      };
    }

    // Нормализация факторов (только для имеющихся данных)
    let x_techRead = null;
    let x_organRead = null;

    if (techRead !== null && techRead !== undefined) {
      x_techRead = techRead / 3;
    }

    if (organRead !== null && organRead !== undefined) {
      x_organRead = organRead / 3;
    }

    const x_funcCover = funcCover / 3;
    const x_trlStage = (trlStageValue - 1) / 2;

    // Вычисление сводного показателя: z_i = Σ(w_k * x_ik)
    // ОБНОВЛЕНО: Линейная модель без bias (более интуитивна)
    // Если фактор отсутствует, он не учитывается в расчете
    // Пересчитываем веса для имеющихся факторов
    let availableWeights = {
      techRead: x_techRead !== null ? weights.techRead : 0,
      organRead: x_organRead !== null ? weights.organRead : 0,
      funcCover: weights.funcCover,
      trlStage: weights.trlStage
    };

    // Нормализуем веса, чтобы их сумма была равна 1.0
    const totalWeight = availableWeights.techRead + availableWeights.organRead +
      availableWeights.funcCover + availableWeights.trlStage;

    if (totalWeight > 0 && Math.abs(totalWeight - 1.0) > 0.001) {
      const normalizationFactor = 1.0 / totalWeight;
      availableWeights = {
        techRead: availableWeights.techRead * normalizationFactor,
        organRead: availableWeights.organRead * normalizationFactor,
        funcCover: availableWeights.funcCover * normalizationFactor,
        trlStage: availableWeights.trlStage * normalizationFactor
      };
    }

    // Вычисляем сводный показатель готовности: z_i = Σ(w_k * x_ik)
    // z_i ∈ [0, 1] - степень готовности (0 = минимальная, 1 = максимальная)
    let z_i = 0;
    if (x_techRead !== null) {
      z_i += availableWeights.techRead * x_techRead;
    }
    if (x_organRead !== null) {
      z_i += availableWeights.organRead * x_organRead;
    }
    z_i += availableWeights.funcCover * x_funcCover;
    z_i += availableWeights.trlStage * x_trlStage;

    // ОБНОВЛЕНО: Линейная модель вместо логистической функции
    // r_i = r_min + (r_max - r_min) * (1 - z_i)
    // Инвертируем: чем выше z_i (ближе к внедрению), тем меньше радиус (ближе к центру)
    // z_i = 0 (минимальная готовность) → r_i = r_max (близко к краю)
    // z_i = 1 (максимальная готовность) → r_i = r_min (близко к центру)
    let r_i = r_min + (r_max - r_min) * (1 - z_i);

    // Гарантируем, что радиус строго в диапазоне (r_min, r_max)
    // Используем очень малые значения близкие к границам вместо точных границ
    const EPSILON = 0.01; // Минимальное отклонение от границ

    if (r_i <= r_min) {
      r_i = r_min + EPSILON;
    } else if (r_i >= r_max) {
      r_i = r_max - EPSILON;
    }

    return {
      theta: theta,
      radius: r_i, // Радиус в процентах (0 < r < 100)
      hasMissingData: hasMissingData,
      missingFactors: hasMissingData ? missingFactors : []
    };
  }

  // Рассчитать позицию технологии
  // Всегда использует математическую модель с линейной функцией
  // ОБНОВЛЕНО (2026-01-29): Добавлено кеширование результатов
  // ОБНОВЛЕНО: Заменена логистическая функция на линейную модель
  function assignFixedPosition(tech) {
    const CENTER_X = window.CENTER_X || 500;
    const CENTER_Y = window.CENTER_Y || 500;
    const RADIUS_STEP = window.RADIUS_STEP || 140;
    const POSITION_PAD = window.POSITION_PAD || 30;
    const POSITION_ANGLE_PAD = window.POSITION_ANGLE_PAD || 8;
    const QUADRANTS = window.QUADRANTS || [];
    const RINGS = window.RINGS || [];

    // ОБНОВЛЕНО (2026-01-29): Проверяем кеш перед расчетом
    const cacheKey = getCacheKey(tech);
    if (cacheKey && positionCache.has(cacheKey)) {
      const cached = positionCache.get(cacheKey);
      // Проверяем, что кешированная позиция актуальна
      if (cached && typeof cached.x === 'number' && typeof cached.y === 'number') {
        return cached;
      }
    }

    // Всегда используем математическую модель calculateRadarPosition
    // с логистической функцией для вычисления позиции
    const radarPos = calculateRadarPosition(tech);

    // ОБНОВЛЕНО: Проверяем наличие отсутствующих данных
    if (radarPos.hasMissingData && radarPos.missingFactors && radarPos.missingFactors.length >= 2) {
      // Технология с недостаточными данными - позиционируем в зоне недостаточных данных
      const maxR = (Array.isArray(RINGS) && RINGS.length > 0) ? RINGS.length * RADIUS_STEP : 3 * RADIUS_STEP;
      const availableRadius = maxR - POSITION_PAD;
      const radius = POSITION_PAD + (radarPos.radius / 100) * availableRadius;

      const p = window.polarToCartesian(CENTER_X, CENTER_Y, radius, radarPos.theta);
      const result = {
        x: Math.round(p.x),
        y: Math.round(p.y),
        hasMissingData: true,
        missingFactors: radarPos.missingFactors
      };
      // Кешируем только базовую (математическую) позицию
      if (cacheKey) {
        positionCache.set(cacheKey, result);
        if (!savePositionCache._timeout) {
          savePositionCache._timeout = setTimeout(() => {
            savePositionCache();
            savePositionCache._timeout = null;
          }, 1000);
        }
      }
      return result;
    }

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
    const result = {
      x: Math.round(p.x),
      y: Math.round(p.y),
      hasMissingData: radarPos.hasMissingData || false,
      missingFactors: radarPos.missingFactors || []
    };
    // Кешируем только базовую (математическую) позицию
    if (cacheKey) {
      positionCache.set(cacheKey, result);
      if (!savePositionCache._timeout) {
        savePositionCache._timeout = setTimeout(() => {
          savePositionCache();
          savePositionCache._timeout = null;
        }, 1000);
      }
    }
    return result;
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
  // Всегда использует математическую модель с линейной функцией
  // ОБНОВЛЕНО: Использует уникальный угол для каждого квадранта
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

    // ОБНОВЛЕНО: Проверяем кеш перед расчетом
    // Создаем ключ кеша с учетом квадранта для стабильности позиций
    const cacheKey = getCacheKey(tech);
    if (cacheKey) {
      // Создаем уникальный ключ для позиции с учетом квадранта
      const quadrantCacheKey = `${cacheKey}:quadrant:${targetQuadrant}`;
      if (positionCache.has(quadrantCacheKey)) {
        const cached = positionCache.get(quadrantCacheKey);
        // Проверяем, что кешированная позиция актуальна
        if (cached && typeof cached.x === 'number' && typeof cached.y === 'number') {
          return cached;
        }
      }
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

    // ОБНОВЛЕНО: Проверяем наличие отсутствующих данных
    if (radarPos.hasMissingData && radarPos.missingFactors && radarPos.missingFactors.length >= 2) {
      // Технология с недостаточными данными - позиционируем в зоне недостаточных данных
      const maxR = (Array.isArray(RINGS) && RINGS.length > 0) ? RINGS.length * RADIUS_STEP : 3 * RADIUS_STEP;
      const availableRadius = maxR - POSITION_PAD;
      const radius = POSITION_PAD + (radarPos.radius / 100) * availableRadius;

      const p = window.polarToCartesian(CENTER_X, CENTER_Y, radius, radarPos.theta);
      const result = {
        x: Math.round(p.x),
        y: Math.round(p.y),
        hasMissingData: true,
        missingFactors: radarPos.missingFactors
      };

      // Сохраняем в кеш
      if (cacheKey) {
        const quadrantCacheKey = `${cacheKey}:quadrant:${targetQuadrant}`;
        positionCache.set(quadrantCacheKey, result);
        positionCache.set(cacheKey, result);
      }

      return result;
    }

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
    // ОБНОВЛЕНО: Используем уникальный угол для каждого квадранта на основе ID технологии и квадранта
    // Это обеспечивает разные углы для одной технологии в разных квадрантах
    const GOLDEN_ANGLE = 137.50776405003785;
    // Уменьшаем доступный диапазон с учетом углового размера элемента
    const ANGLE_SPAN = 90 - (POSITION_ANGLE_PAD * 2) - (angularSize * 2);
    const aBase = q.startAngle + POSITION_ANGLE_PAD + angularSize;
    const id = Number(tech.id) || 0;
    // ОБНОВЛЕНО: Создаем уникальный хеш для комбинации tech.id и targetQuadrant
    // Это гарантирует разные углы для одной технологии в разных квадрантах
    const quadrantHash = id * 1000 + targetQuadrant * 37;
    const angleOffset = (quadrantHash * GOLDEN_ANGLE) % Math.max(1, ANGLE_SPAN);
    const angle = aBase + angleOffset;

    const p = window.polarToCartesian(CENTER_X, CENTER_Y, radius, angle);
    const result = {
      x: Math.round(p.x),
      y: Math.round(p.y),
      hasMissingData: radarPos.hasMissingData || false,
      missingFactors: radarPos.missingFactors || []
    };

    // ОБНОВЛЕНО: Сохраняем результат в кеш с учетом квадранта
    if (cacheKey) {
      const quadrantCacheKey = `${cacheKey}:quadrant:${targetQuadrant}`;
      positionCache.set(quadrantCacheKey, result);
      // Также сохраняем общий кеш для обратной совместимости
      positionCache.set(cacheKey, result);
      // Ограничиваем размер кеша (максимум 1000 записей)
      if (positionCache.size > 1000) {
        // Удаляем самые старые записи (первая половина)
        const entries = Array.from(positionCache.entries());
        const toDelete = entries.slice(0, Math.floor(entries.length / 2));
        toDelete.forEach(([key]) => positionCache.delete(key));
      }
      // Сохраняем кеш в localStorage для стабильности при перезагрузке
      // Используем debounce для оптимизации (сохраняем не чаще раза в секунду)
      if (!savePositionCache._timeout) {
        savePositionCache._timeout = setTimeout(() => {
          savePositionCache();
          savePositionCache._timeout = null;
        }, 1000);
      }
    }

    return result;
  }

  // Рассчитать координаты для технологии и записать в объект
  function computeCoordinates(tech) {
    const pos = assignFixedPosition(tech);
    tech.x = pos.x;
    tech.y = pos.y;
    return tech;
  }

  // Вычисляет угловое смещение, необходимое для элемента заданного размера на радиусе
  // Используется для корректировки углов с учетом размера фигур
  function calculateAngularSizeInDegrees(elementRadius, circleRadius) {
    if (circleRadius <= 0 || elementRadius <= 0) return 0;
    if (elementRadius >= circleRadius) return 45; // Ограничиваем половиной квадранта
    const angleInRadians = Math.asin(Math.min(1, elementRadius / circleRadius));
    const angleInDegrees = (angleInRadians * 180) / Math.PI;
    return angleInDegrees;
  }

  /**
   * Рассчитывает максимальное количество технологий, которые могут поместиться в квадрант
   * без наложений, учитывая размеры элементов и отступы
   * @param {Object} q - Объект квадранта
   * @param {number} avgElementSize - Средний размер элемента (радиус в пикселях)
   * @param {number} avgRadius - Средний радиус для расчета углового размера
   * @returns {number} Максимальное количество технологий
   */
  function calculateMaxTechnologiesInQuadrant(q, avgElementSize = 10, avgRadius = 200) {
    const POSITION_ANGLE_PAD = window.POSITION_ANGLE_PAD || 8;
    const ANGLE_SPAN = 90 - (POSITION_ANGLE_PAD * 2); // Доступный угловой диапазон (74°)

    // Вычисляем угловой размер элемента на среднем радиусе
    const angularSize = calculateAngularSizeInDegrees(avgElementSize * 1.2, avgRadius);

    // Минимальный угловой зазор между элементами (чтобы не накладывались)
    const minAngularGap = angularSize * 2; // Два угловых размера для зазора

    // Доступный диапазон с учетом размеров элементов
    const availableSpan = ANGLE_SPAN - (angularSize * 2);

    // Максимальное количество технологий = доступный диапазон / минимальный зазор
    const maxCount = Math.floor(availableSpan / minAngularGap);

    return Math.max(1, maxCount);
  }

  /**
   * Распределяет технологии равномерно по углу в квадранте от начала до конца
   * ОБНОВЛЕНО: Равномерное распределение по всему угловому диапазону квадранта
   * @param {Array} group - Массив технологий в квадранте
   * @param {Object} q - Объект квадранта
   * @param {Object} quadrantById - Маппинг ID квадранта на объект квадранта
   */
  function applyUniformAngleDistribution(group, q, quadrantById) {
    if (!group || group.length === 0) return;

    const CENTER_X = window.CENTER_X || 500;
    const CENTER_Y = window.CENTER_Y || 500;
    const POSITION_ANGLE_PAD = window.POSITION_ANGLE_PAD || 8;
    const RADIUS_STEP = window.RADIUS_STEP || 140;
    const POSITION_PAD = window.POSITION_PAD || 30;
    const RINGS = window.RINGS || [];

    // Сортируем технологии по ID для детерминированного порядка
    group.sort((a, b) => {
      return (Number(a.id) || 0) - (Number(b.id) || 0);
    });

    // Вычисляем параметры квадранта
    const maxR = (Array.isArray(RINGS) && RINGS.length > 0) ? RINGS.length * RADIUS_STEP : 3 * RADIUS_STEP;
    const rMin = POSITION_PAD;
    const rMax = maxR - POSITION_PAD;

    // Вычисляем угловой размер каждого элемента на его радиусе
    const techData = group.map(t => {
      const polar = window.cartesianToPolar(CENTER_X, CENTER_Y, t.x || CENTER_X, t.y || CENTER_Y);
      const radius = Math.max(rMin, Math.min(rMax, polar.radius));
      const elementSize = (t.size && typeof t.size === 'number') ? t.size : calculateElementSize(t);
      const angularSize = calculateAngularSizeInDegrees(elementSize * 1.2, radius);
      return {
        tech: t,
        radius: radius,
        angularSize: angularSize,
        elementSize: elementSize,
        originalPolar: polar
      };
    });

    // Вычисляем доступный угловой диапазон квадранта
    // Для квадранта 1: от 0° + отступ до 90° - отступ
    // Элементы могут находиться рядом с чертой, но не пересекать её
    // Используем минимальный отступ для границ, чтобы максимизировать доступный диапазон
    const ANGLE_SPAN = 90; // Полный диапазон квадранта
    // Используем минимальный угловой размер для расчета границ, чтобы не сужать диапазон слишком сильно
    const minAngularSize = Math.min(...techData.map(t => t.angularSize));
    const avgAngularSize = techData.reduce((sum, t) => sum + t.angularSize, 0) / techData.length;
    // Используем средний размер с небольшим запасом для границ
    const boundaryAngularSize = Math.max(minAngularSize, avgAngularSize * 0.7);
    const angleMin = q.startAngle + POSITION_ANGLE_PAD + boundaryAngularSize;
    const angleMax = q.startAngle + ANGLE_SPAN - POSITION_ANGLE_PAD - boundaryAngularSize;
    const availableAngleSpan = Math.max(1, angleMax - angleMin);

    // Группируем технологии по радиусу для лучшего распределения
    const radiusGroups = new Map();
    techData.forEach((techInfo, index) => {
      const radiusKey = Math.round(techInfo.radius / 10) * 10; // Группируем по округленному радиусу
      if (!radiusGroups.has(radiusKey)) {
        radiusGroups.set(radiusKey, []);
      }
      radiusGroups.get(radiusKey).push({ techInfo, index });
    });

    // Равномерно распределяем технологии по всему доступному угловому диапазону
    // Для технологий с одинаковым радиусом учитываем угловые размеры элементов
    group.forEach((t, index) => {
      const techInfo = techData[index];
      const radiusKey = Math.round(techInfo.radius / 10) * 10;
      const sameRadiusTechs = radiusGroups.get(radiusKey) || [];

      // Вычисляем угол для равномерного распределения
      // Первая технология - ближе к началу, последняя - ближе к концу
      let targetAngle;
      if (group.length === 1) {
        // Если одна технология - размещаем в центре квадранта
        targetAngle = (angleMin + angleMax) / 2;
      } else if (sameRadiusTechs.length > 1) {
        // Если есть технологии с одинаковым радиусом, распределяем их с учетом угловых размеров
        const sameRadiusIndex = sameRadiusTechs.findIndex(item => item.index === index);
        const totalAngularSize = sameRadiusTechs.reduce((sum, item) => sum + item.techInfo.angularSize, 0);
        const minAngularGap = Math.max(...sameRadiusTechs.map(item => item.techInfo.angularSize)) * 2;
        const availableSpanForSameRadius = availableAngleSpan - totalAngularSize - (minAngularGap * (sameRadiusTechs.length - 1));

        if (availableSpanForSameRadius > 0 && sameRadiusTechs.length > 1) {
          const ratio = sameRadiusIndex / (sameRadiusTechs.length - 1);
          const startOffset = sameRadiusTechs.slice(0, sameRadiusIndex).reduce((sum, item) =>
            sum + item.techInfo.angularSize + minAngularGap, 0);
          targetAngle = angleMin + startOffset + (techInfo.angularSize / 2) + ratio * availableSpanForSameRadius;
        } else {
          // Fallback: равномерное распределение
          const ratio = index / (group.length - 1);
          targetAngle = angleMin + ratio * availableAngleSpan;
        }
      } else {
        // Равномерно распределяем от начала до конца
        const ratio = index / (group.length - 1);
        targetAngle = angleMin + ratio * availableAngleSpan;
      }

      // Учитываем угловой размер конкретного элемента для корректировки границ
      // Элемент не должен выходить за границы квадранта
      const elementAngleMin = q.startAngle + POSITION_ANGLE_PAD + techInfo.angularSize;
      const elementAngleMax = q.startAngle + ANGLE_SPAN - POSITION_ANGLE_PAD - techInfo.angularSize;

      // Ограничиваем угол с учетом размера конкретного элемента
      if (targetAngle < elementAngleMin) {
        targetAngle = elementAngleMin;
      } else if (targetAngle > elementAngleMax) {
        targetAngle = elementAngleMax;
      }

      // Нормализуем угол для квадранта 4 (пересекает 0°/360°)
      if (q.id === 4) {
        if (targetAngle < 90) {
          targetAngle += 360;
        }
        while (targetAngle >= 360) targetAngle -= 360;
      }

      // Обновляем позицию с сохранением радиуса (готовности)
      const newPos = window.polarToCartesian(CENTER_X, CENTER_Y, techInfo.radius, targetAngle);
      t.x = Math.round(newPos.x);
      t.y = Math.round(newPos.y);
    });
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

    // ОБНОВЛЕНО: Кеш для финальных позиций после разведения
    // Ключ: `${techId}:${quadrantId}`, значение: {x, y}
    const finalPositionsCache = new Map();

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
      // Фикс: angleMin/angleMax объявляются ниже, поэтому fallback задаём через центр квадранта
      if (!Number.isFinite(angle)) angle = q.startAngle + 45;

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

    for (const [quadrantKey, group] of groups.entries()) {
      if (!group || group.length === 0) continue;

      // ОБНОВЛЕНО: Сортируем группу по ID для детерминированного порядка обработки
      // Это гарантирует, что позиции будут одинаковыми при каждом вызове
      group.sort((a, b) => {
        const idA = Number(a.id) || 0;
        const idB = Number(b.id) || 0;
        return idA - idB;
      });

      // ОБНОВЛЕНО: Проверяем кеш финальных позиций для всех технологий в квадранте
      // ВАЖНО: Ключ кеша включает хеш состава технологий в квадранте, чтобы позиции
      // были актуальны только для того же состава технологий
      let allHaveFinalPositions = true;
      const cachedFinalPositions = new Map();

      // Вычисляем хеш состава технологий в квадранте для включения в ключ кеша
      // Это гарантирует, что финальные позиции используются только для того же состава
      const groupIds = group
        .map(t => t && t.id ? String(t.id) : '')
        .filter(id => id.length > 0)
        .sort()
        .join(',');
      const groupHash = groupIds.length > 0
        ? groupIds.split(',').reduce((hash, id) => {
            // Простой хеш на основе ID
            return ((hash << 5) - hash) + id.charCodeAt(0);
          }, 0)
        : 0;

      group.forEach(t => {
        if (t && t.id && t.quadrant) {
          const cacheKey = getCacheKey(t);
          if (cacheKey) {
            const quadrantId = t.quadrant;
            // Включаем хеш состава технологий в ключ кеша
            const finalCacheKey = `${cacheKey}:final:quadrant:${quadrantId}:group:${groupHash}`;
            if (positionCache.has(finalCacheKey)) {
              const cached = positionCache.get(finalCacheKey);
              if (cached && typeof cached.x === 'number' && typeof cached.y === 'number') {
                cachedFinalPositions.set(`${t.id}:${quadrantId}`, cached);
              } else {
                allHaveFinalPositions = false;
              }
            } else {
              allHaveFinalPositions = false;
            }
          } else {
            allHaveFinalPositions = false;
          }
        }
      });

      // Если все технологии имеют кешированные финальные позиции, используем их и пропускаем разведение
      if (allHaveFinalPositions && cachedFinalPositions.size === group.length) {
        group.forEach(t => {
          if (t && t.id && t.quadrant) {
            const cachedPos = cachedFinalPositions.get(`${t.id}:${t.quadrant}`);
            if (cachedPos) {
              t.x = cachedPos.x;
              t.y = cachedPos.y;
            }
          }
        });
        continue; // Переходим к следующему квадранту, пропуская разведение
      }

      // Инициализируем позиции, если они не заданы
      // ОБНОВЛЕНО: Используем кеш для получения позиций
      group.forEach(t => {
        if (typeof t.x !== 'number' || typeof t.y !== 'number' || isNaN(t.x) || isNaN(t.y)) {
          // Пробуем использовать кеш
          const cacheKey = getCacheKey(t);
          if (cacheKey) {
            const quadrantId = t.quadrant;
            const quadrantCacheKey = `${cacheKey}:quadrant:${quadrantId}`;
            if (positionCache.has(quadrantCacheKey)) {
              const cached = positionCache.get(quadrantCacheKey);
              if (cached && typeof cached.x === 'number' && typeof cached.y === 'number') {
                t.x = cached.x;
                t.y = cached.y;
                return;
              }
            }
            // Если кеш не сработал, пробуем общий кеш
            if (positionCache.has(cacheKey)) {
              const cached = positionCache.get(cacheKey);
              if (cached && typeof cached.x === 'number' && typeof cached.y === 'number') {
                t.x = cached.x;
                t.y = cached.y;
                return;
              }
            }
          }
          // Если кеш не сработал, вычисляем позицию
          const pos = assignFixedPositionForQuadrant(t, t.quadrant);
          t.x = pos.x;
          t.y = pos.y;
        }
      });

      // Получаем объект квадранта
      const quadrantId = parseInt(quadrantKey, 10);
      const q = quadrantById[quadrantId];
      if (!q) continue;

      // ОБНОВЛЕНО (2026-01-29): Сначала равномерно распределяем технологии по углу в квадранте
      // Это обеспечивает равномерное заполнение от начала до конца с учетом размеров
      applyUniformAngleDistribution(group, q, quadrantById);

      // Применяем ограничение квадранта
      group.forEach(t => {
        clampToSectorRing(t);
      });

      // Запоминаем базовые позиции ПОСЛЕ равномерного распределения и ограничиваем максимальное смещение.
      // Это сохраняет равномерное распределение по углу, даже когда алгоритм разведения смещает технологии.
      const originalPositions = new Map();
      group.forEach(t => {
        originalPositions.set(`${t.id}:${t.quadrant}`, { x: t.x, y: t.y });
      });

      const techCount = group.length;
      let maxSize = 10;
      group.forEach(t => {
        if (t.size && typeof t.size === 'number' && t.size > maxSize) maxSize = t.size;
      });
      // Динамический лимит: больше точек/крупнее blip'ы → можно смещать чуть сильнее
      // Увеличиваем лимит смещения, чтобы сохранить равномерное распределение по углу
      const MAX_DISPLACEMENT = Math.min(100, 25 + techCount * 2 + Math.max(0, maxSize - 10));

      function clampToMaxDisplacement(t) {
        const key = `${t.id}:${t.quadrant}`;
        const origin = originalPositions.get(key);
        if (!origin) return;
        const dx = t.x - origin.x;
        const dy = t.y - origin.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (!Number.isFinite(dist) || dist <= MAX_DISPLACEMENT) return;
        const k = MAX_DISPLACEMENT / dist;
        t.x = Math.round(origin.x + dx * k);
        t.y = Math.round(origin.y + dy * k);
      }

      // Предварительное разведение: если технологии имеют идентичные или очень близкие координаты,
      // или находятся на одинаковом радиусе и слишком близко по углу, разводим их
      const COORDINATE_TOLERANCE = 0.5; // Минимальная разница в координатах для считания идентичными
      const RADIUS_TOLERANCE = 5; // Минимальная разница в радиусах для считания одинаковыми

      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          const a = group[i];
          const b = group[j];
          const dx = Math.abs(b.x - a.x);
          const dy = Math.abs(b.y - a.y);
          const dist = Math.sqrt(dx * dx + dy * dy);

          // Получаем размеры элементов
          const sizeA = (a.size && typeof a.size === 'number') ? a.size : 10;
          const sizeB = (b.size && typeof b.size === 'number') ? b.size : 10;
          const minDistForPair = sizeA + sizeB + 4; // минимальное расстояние между элементами

          // Вычисляем полярные координаты
          const polarA = window.cartesianToPolar(CENTER_X, CENTER_Y, a.x, a.y);
          const polarB = window.cartesianToPolar(CENTER_X, CENTER_Y, b.x, b.y);
          const radiusDiff = Math.abs(polarA.radius - polarB.radius);

          // Проверяем, нужно ли разводить:
          // 1. Если координаты практически идентичны
          // 2. Если радиусы одинаковые (или очень близкие) и расстояние меньше минимального
          const needsSeparation = (dx < COORDINATE_TOLERANCE && dy < COORDINATE_TOLERANCE) ||
            (radiusDiff < RADIUS_TOLERANCE && dist < minDistForPair);

          if (needsSeparation) {
            const q = quadrantById[a.quadrant];
            if (q) {
              const ANGLE_PAD = POSITION_ANGLE_PAD;
              const ANGLE_SPAN = 90 - (ANGLE_PAD * 2);

              // Используем уже вычисленные полярные координаты
              let angleA = polarA.angle;
              let angleB = polarB.angle;
              let radiusA = polarA.radius;
              let radiusB = polarB.radius;

              // Если радиусы очень близкие, используем средний радиус для обоих
              // Это помогает развести технологии по углу, сохраняя их на одной окружности
              if (radiusDiff < RADIUS_TOLERANCE) {
                const avgRadius = (radiusA + radiusB) / 2;
                radiusA = avgRadius;
                radiusB = avgRadius;
              }

              // Обрабатываем квадрант 4, который пересекает 0°
              if (q.id === 4) {
                if (angleA < 90) angleA += 360;
                if (angleB < 90) angleB += 360;
              }

              // Вычисляем угловые размеры элементов на текущих радиусах
              const angularSizeA = calculateAngularSizeInDegrees(sizeA * 1.2, radiusA);
              const angularSizeB = calculateAngularSizeInDegrees(sizeB * 1.2, radiusB);

              // Корректируем границы с учетом размеров элементов
              const angleMin = q.startAngle + ANGLE_PAD + Math.max(angularSizeA, angularSizeB);
              const angleMax = q.startAngle + ANGLE_PAD + ANGLE_SPAN - Math.max(angularSizeA, angularSizeB);

              // Вычисляем минимальное угловое расстояние между элементами
              // Учитываем не только угловые размеры, но и минимальное расстояние в пикселях
              const minAngularDistance = Math.max(
                angularSizeA + angularSizeB + 2, // сумма угловых размеров + зазор
                (minDistForPair / radiusA) * (180 / Math.PI) // минимальное расстояние в градусах
              );

              // Если технологии на одинаковом радиусе, разводим их по углу равномерно
              if (radiusDiff < RADIUS_TOLERANCE) {
                // Вычисляем текущее угловое расстояние
                let angularDiff = Math.abs(angleB - angleA);
                if (q.id === 4) {
                  // Для квадранта 4 учитываем переход через 0°
                  if (angularDiff > 180) angularDiff = 360 - angularDiff;
                }

                // Если угловое расстояние меньше минимального, разводим
                if (angularDiff < minAngularDistance) {
                  // Размещаем технологии равномерно с минимальным угловым расстоянием
                  const midAngle = (angleA + angleB) / 2;
                  const halfSeparation = minAngularDistance / 2;

                  angleA = midAngle - halfSeparation;
                  angleB = midAngle + halfSeparation;

                  // Ограничиваем углы в пределах квадранта
                  if (angleA < angleMin) {
                    angleA = angleMin;
                    angleB = angleA + minAngularDistance;
                  }
                  if (angleB > angleMax) {
                    angleB = angleMax;
                    angleA = angleB - minAngularDistance;
                  }
                }
              } else {
                // Если радиусы разные, используем старый алгоритм с небольшими улучшениями
                const availableSpan = Math.max(1, angleMax - angleMin);
                const angleOffsetA = ((Number(a.id) || 0) * 5) % (availableSpan / 3);
                const angleOffsetB = ((Number(b.id) || 0) * 5) % (availableSpan / 3);

                let newAngleA = angleMin + angleOffsetA;
                let newAngleB = angleMin + angleOffsetB + minAngularDistance;

                // Ограничиваем углы в пределах квадранта
                if (newAngleA < angleMin) newAngleA = angleMin;
                if (newAngleA > angleMax) newAngleA = angleMax;
                if (newAngleB < angleMin) newAngleB = angleMin;
                if (newAngleB > angleMax) newAngleB = angleMax;

                angleA = newAngleA;
                angleB = newAngleB;
              }

              // Нормализуем углы для квадранта 4
              if (q.id === 4) {
                while (angleA >= 360) angleA -= 360;
                while (angleB >= 360) angleB -= 360;
              }

              const newPosA = window.polarToCartesian(CENTER_X, CENTER_Y, radiusA, angleA);
              const newPosB = window.polarToCartesian(CENTER_X, CENTER_Y, radiusB, angleB);

              a.x = Math.round(newPosA.x);
              a.y = Math.round(newPosA.y);
              b.x = Math.round(newPosB.x);
              b.y = Math.round(newPosB.y);

              // Применяем строгое ограничение в пределах квадранта
              clampToSectorRing(a);
              clampToSectorRing(b);
              clampToMaxDisplacement(a);
              clampToMaxDisplacement(b);
              clampToSectorRing(a);
              clampToSectorRing(b);
            }
          }
        }
      }

      // ОБНОВЛЕНО: Использование пространственных индексов для оптимизации
      // Если доступен модуль SpatialIndex, используем его для ускорения при большом количестве технологий
      if (window.SpatialIndex && typeof window.SpatialIndex.optimizeLayoutWithSpatialIndex === 'function' && group.length > 20) {
        const maxR = (Array.isArray(RINGS) && RINGS.length > 0) ? RINGS.length * RADIUS_STEP : 3 * RADIUS_STEP;
        const bounds = {
          x: CENTER_X - maxR,
          y: CENTER_Y - maxR,
          width: maxR * 2,
          height: maxR * 2
        };

        window.SpatialIndex.optimizeLayoutWithSpatialIndex(group, bounds, {
          maxIterations: 80,
          dampingFactor: 0.98,
          convergenceThreshold: 0.1
        });

        // Применяем ограничение квадранта после оптимизации
        group.forEach(t => {
          clampToSectorRing(t);
          clampToMaxDisplacement(t);
          clampToSectorRing(t);
        });

        continue; // Переходим к следующему квадранту
      }

      // Адаптивное минимальное расстояние в зависимости от количества технологий в квадранте
      // Чем больше технологий, тем больше должно быть минимальное расстояние
      let baseMinDistance = MIN_BLIP_DISTANCE;

      // Учитываем размеры элементов при расчете минимального расстояния
      // Находим максимальный размер в группе
      // (maxSize уже рассчитан выше для MAX_DISPLACEMENT — переиспользуем, чтобы избежать redeclare)

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

      // ОБНОВЛЕНО (2026-01-29): Оптимизация алгоритма разведения
      // Адаптивное количество итераций в зависимости от количества технологий
      const BASE_MAX_ITER = 80;
      const ENHANCED_MAX_ITER = Math.min(150, BASE_MAX_ITER + Math.floor(techCount / 5));

      // Порог сходимости: если максимальное смещение меньше этого значения, считаем что сходимость достигнута
      const CONVERGENCE_THRESHOLD = 0.1; // пикселей

      // Коэффициент затухания для стабильности (уменьшается с каждой итерацией)
      let dampingFactor = 1.0;
      const DAMPING_DECAY = 0.98; // Уменьшаем силу с каждой итерацией

      for (let iter = 0; iter < ENHANCED_MAX_ITER; iter++) {
        let maxMovement = 0; // Максимальное смещение в этой итерации
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

            // Вычисляем радиусы элементов для учета расстояния от центра
            const polarA = window.cartesianToPolar(CENTER_X, CENTER_Y, a.x, a.y);
            const polarB = window.cartesianToPolar(CENTER_X, CENTER_Y, b.x, b.y);
            const avgRadius = (polarA.radius + polarB.radius) / 2;

            // Для элементов в центре (малый радиус) увеличиваем минимальное расстояние,
            // так как угловой размер там больше
            const radiusFactor = avgRadius < 100 ? 1.5 : (avgRadius < 200 ? 1.2 : 1.0);
            const minDistForPair = (sizeA + sizeB + 4) * radiusFactor; // сумма радиусов + зазор + коэффициент для центра
            const minDistForPairSq = minDistForPair * minDistForPair;

            // Если точки слишком близко, разводим их
            if (distSq < minDistForPairSq) {
              const dist = Math.sqrt(distSq) || 0.001;
              const overlap = minDistForPair - dist;

              // Увеличиваем силу отталкивания для очень близких точек
              const forceMultiplier = dist < minDistForPair * 0.5 ? 1.5 : 1.0;

              // Применяем затухание для стабильности
              const shiftX = (dx / dist) * (overlap / 2) * forceMultiplier * dampingFactor;
              const shiftY = (dy / dist) * (overlap / 2) * forceMultiplier * dampingFactor;

              // Сохраняем старые позиции для расчета смещения
              const oldAX = a.x;
              const oldAY = a.y;
              const oldBX = b.x;
              const oldBY = b.y;

              a.x -= shiftX;
              a.y -= shiftY;
              b.x += shiftX;
              b.y += shiftY;

              clampToSectorRing(a);
              clampToSectorRing(b);
              clampToMaxDisplacement(a);
              clampToMaxDisplacement(b);
              clampToSectorRing(a);
              clampToSectorRing(b);

              // Вычисляем фактическое смещение после clamp
              const movementA = Math.sqrt((a.x - oldAX) ** 2 + (a.y - oldAY) ** 2);
              const movementB = Math.sqrt((b.x - oldBX) ** 2 + (b.y - oldBY) ** 2);
              maxMovement = Math.max(maxMovement, movementA, movementB);

              moved = true;
            }
          }
        }

        // Проверка сходимости: если максимальное смещение меньше порога, останавливаемся
        if (!moved || maxMovement < CONVERGENCE_THRESHOLD) {
          if (Logger && typeof Logger.debug === 'function') {
            Logger.debug(`[Positioning] Алгоритм разведения сошелся за ${iter + 1} итераций (maxMovement: ${maxMovement.toFixed(3)})`);
          }
          break;
        }

        // Уменьшаем коэффициент затухания для следующей итерации
        dampingFactor *= DAMPING_DECAY;
      }

      // ОБНОВЛЕНО: Сохраняем финальные позиции в кеш после разведения
      // Это обеспечивает стабильность позиций при повторных рендерах
      // ВАЖНО: Используем тот же хеш состава технологий, что и при проверке кеша
      const groupIdsForSave = group
        .map(t => t && t.id ? String(t.id) : '')
        .filter(id => id.length > 0)
        .sort()
        .join(',');
      const groupHashForSave = groupIdsForSave.length > 0
        ? groupIdsForSave.split(',').reduce((hash, id) => {
            return ((hash << 5) - hash) + id.charCodeAt(0);
          }, 0)
        : 0;

      group.forEach(t => {
        if (t && t.id && t.quadrant && typeof t.x === 'number' && typeof t.y === 'number') {
          const cacheKey = getCacheKey(t);
          if (cacheKey) {
            const quadrantId = t.quadrant;
            // Включаем хеш состава технологий в ключ кеша
            const finalCacheKey = `${cacheKey}:final:quadrant:${quadrantId}:group:${groupHashForSave}`;
            positionCache.set(finalCacheKey, { x: t.x, y: t.y });
            // Также сохраняем в общий кеш для обратной совместимости
            const quadrantCacheKey = `${cacheKey}:quadrant:${quadrantId}`;
            positionCache.set(quadrantCacheKey, { x: t.x, y: t.y });
          }
        }
      });
    }

    // ОБНОВЛЕНО: Сохраняем кеш в localStorage для стабильности при перезагрузке
    // Используем debounce для оптимизации (сохраняем не чаще раза в секунду)
    if (!savePositionCache._timeout) {
      savePositionCache._timeout = setTimeout(() => {
        savePositionCache();
        savePositionCache._timeout = null;
      }, 1000);
    }
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

    // Тест калибровки модели позиционирования

    return result;
  }

  /**
   * Тестирование калибровки с предустановленными сценариями
   * Вызов в консоли: Positioning.testAllScenarios()
   */
  function testAllScenarios() {
    // Тестирование всех сценариев калибровки

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

    // Тестирование завершено
  }

  // Экспорт в window.Positioning (обратная совместимость)
  const Positioning = {
    frac,
    getQuadrantIdForDirection,
    getQuadrantsForDirection,
    getAllQuadrantsForTech,
    getQuadrantIdForBlock,
    getQuadrantsForBlock,
    assignFixedPosition,
    assignFixedPositionForQuadrant,
    computeCoordinates,
    applyNonOverlappingLayout,
    calculateReadinessScore,
    calculateRadiusFromReadiness,
    calculateRadarPosition,
    calculateElementSize,
    calculateAngularSize,
    calculateMaxTechnologiesInQuadrant,
    getMissingDataInfo,
    clearPositionCache,
    clearFinalPositionsCache,
    getCacheKey,
    savePositionCache,
    loadPositionCache,
    positionCache,
    testCalibration,
    testAllScenarios
  };

  if (typeof window !== 'undefined') {
    window.Positioning = Positioning;
  }

  loadPositionCache();

  export default Positioning;
  export { Positioning };
