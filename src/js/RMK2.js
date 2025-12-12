// RMK2.js
// ===== КОНСТАНТЫ =====
const SVG_NS = "http://www.w3.org/2000/svg";
const CENTER_X = 500;
const CENTER_Y = 500;
const RADIUS_STEP = 140;
// Отступы и минимальное расстояние между технологиями на радаре
const POSITION_PAD = 30;           // отступ от границ колец
const POSITION_ANGLE_PAD = 8;      // отступ от границ секторов (в градусах)
const MIN_BLIP_DISTANCE = 28;      // минимальная дистанция между центрами технологий
// Размеры прямоугольников фона подписей колец (должны совпадать с renderRadarBackground)
const RING_LABEL_WIDTH = 180;
const RING_LABEL_HEIGHT = 42;
// Будут загружены из JSON
let RINGS = [];
let QUADRANTS = [];
let levelToRing = {};
// Соответствие techType → форма
const TECHTYPE_TO_SHAPE = {
  "Базовые": "triangle",
  "Интегрированные": "circle",
  "Платформенные решения": "square",
  "Управление с ML и AI": "star",
};
// Координаты вычисляются детерминированно на основе id, blocks и level
// ===== УТИЛИТЫ =====
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function polarToCartesian(cx, cy, r, deg) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

// Обратное преобразование: из декартовых координат в полярные (относительно центра радара)
function cartesianToPolar(cx, cy, x, y) {
  const dx = x - cx;
  const dy = y - cy;
  const radius = Math.sqrt(dx * dx + dy * dy);
  // Угол в градусах в той же системе, что и в polarToCartesian (0° — вверх)
  let deg = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
  // Нормализуем угол в диапазон [0, 360)
  if (!Number.isFinite(deg)) deg = 0;
  while (deg < 0) deg += 360;
  while (deg >= 360) deg -= 360;
  return { radius, angle: deg };
}

function describeArc(x, y, r, sa, ea) {
  const s = polarToCartesian(x, y, r, ea);
  const e = polarToCartesian(x, y, r, sa);
  return `M ${s.x} ${s.y} A ${r} ${r} 0 0 0 ${e.x} ${e.y}`;
}

function describeWedge(x, y, r, sa, ea) {
  const s = polarToCartesian(x, y, r, ea);
  const e = polarToCartesian(x, y, r, sa);
  return `M ${x},${y} L ${s.x},${s.y} A ${r},${r} 0 0 0 ${e.x},${e.y} Z`;
}

// ===== VFS: virtual file system using localStorage =====
function vfsKey(filename) { return `vfs:${filename}`; }
function vfsRead(filename) {
  try {
    const raw = localStorage.getItem(vfsKey(filename));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) { console.warn('vfsRead parse error', e); return null; }
}
function vfsWrite(filename, data) {
  try {
    localStorage.setItem(vfsKey(filename), JSON.stringify(data));
    console.debug(`vfsWrite: ${filename} saved to localStorage`);
    return true;
  } catch (e) { console.error('vfsWrite error', e); return false; }
}
async function loadJsonPreferVfs(filename) {
  const fromVfs = vfsRead(filename);
  if (fromVfs !== null) return { path: `local:${filename}`, data: fromVfs };
  const paths = [`/src/data/${filename}`, `/src/data/ru/${filename}`];
  for (const p of paths) {
    try {
      const r = await fetch(p);
      if (r && r.ok) {
        try { const json = await r.json(); return { path: p, data: json }; } catch (err) { }
      }
    } catch (err) { /* ignore fetch errors */ }
  }
  return { path: null, data: null };
}

// ===== УВЕДОМЛЕНИЯ =====
function showNotification(message, isSuccess = false) {
  let panel = document.getElementById('notificationPanel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'notificationPanel';
    panel.className = 'notification-panel';
    document.body.appendChild(panel);
  }
  const notification = document.createElement('div');
  notification.className = `notification ${isSuccess ? 'success' : 'info'}`;
  notification.innerHTML = `
    <div class="notification-title">${isSuccess ? 'Успешно' : 'Уведомление'}</div>
    <div class="notification-message">${message}</div>
    <button class="notification-close" aria-label="Закрыть">&times;</button>
  `;
  const topZ = parseInt(panel.getAttribute('data-top-z') || '2000', 10) + 1;
  panel.setAttribute('data-top-z', String(topZ));
  notification.style.zIndex = String(topZ);
  panel.appendChild(notification);

  const closeBtn = notification.querySelector('.notification-close');
  const hide = () => {
    notification.style.animation = 'slideOutRight 0.28s ease forwards';
    setTimeout(() => panel.contains(notification) && panel.removeChild(notification), 300);
  };
  closeBtn?.addEventListener('click', hide);
  notification.addEventListener('click', hide);
  setTimeout(hide, 4000);
}

// ===== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ =====
let technologies = [];
let enterpriseData = {};
let blockToQuadrant = {};
let currentEnterprise = "РМК";
let nextId = 1;
let currentTech = null;
let selectedBlipId = null;
let blocksList = [];
let functions = [];
let nameToBlockId = {}; // Маппинг имени блока к его id
let functionToBlockMap = {}; // Маппинг функции к id блока(ов)
// временный таймаут, чтобы игнорировать click, который открыл модалку
let ignoreOutsideClickUntil = 0;

// DOM
const svg = document.getElementById("techRadar");
const detailPanel = document.getElementById("detailPanel");
const hoverLabel = document.getElementById("hoverLabel");
const searchInput = document.getElementById("searchInput");
const themeToggle = document.getElementById("themeToggle");
const authInfo = document.getElementById("authInfo");
const logoutContainer = document.getElementById("logoutContainer");
const addTechBtn = document.getElementById("addTechBtn");

// ===== ПОЗИЦИОНИРОВАНИЕ ТОЧЕК =====
function frac(n) { return n - Math.floor(n); }
function getQuadrantIdForBlock(blockKey) {
  if (!blockKey || !blockToQuadrant) return null;
  const m = blockToQuadrant[blockKey];
  if (Array.isArray(m)) return m.length ? m[0] : null;
  return (typeof m === 'number') ? m : null;
}

/**
 * Получить все квадранты для блока.
 * Возвращает массив квадрантов (даже если один).
 */
function getQuadrantsForBlock(blockKey) {
  if (!blockKey || !blockToQuadrant) return [];
  const m = blockToQuadrant[blockKey];
  if (m == null) return [];
  if (Array.isArray(m)) return m.filter(q => typeof q === 'number');
  if (typeof m === 'number') return [m];
  return [];
}

/**
 * Получить все уникальные квадранты для технологии.
 * Проходит по всем блокам технологии и собирает все связанные квадранты.
 */
function getAllQuadrantsForTech(tech) {
  if (!tech) return [];
  const quadrantsSet = new Set();

  // Получаем все блоки технологии
  const blocks = Array.isArray(tech.blocks) && tech.blocks.length
    ? tech.blocks
    : (tech.block ? [tech.block] : []);

  // Для каждого блока получаем все его квадранты
  blocks.forEach(blockKey => {
    const blockQuadrants = getQuadrantsForBlock(blockKey);
    blockQuadrants.forEach(q => quadrantsSet.add(q));
  });

  return Array.from(quadrantsSet);
}

function assignFixedPosition(tech) {
  const blockKey = (tech.blocks && tech.blocks.length) ? tech.blocks[0] : tech.block;
  const quadrantId = getQuadrantIdForBlock(blockKey);
  const ringIndex = levelToRing[tech.level];
  if (quadrantId == null || ringIndex == null) return { x: CENTER_X, y: CENTER_Y };
  const q = QUADRANTS.find(q => q.id === quadrantId);
  const PAD = POSITION_PAD; // Увеличен отступ от границ колец
  const ANGLE_PAD = POSITION_ANGLE_PAD; // Отступ от границ секторов (в градусах)
  const ANGLE_SPAN = 90 - (ANGLE_PAD * 2); // Уменьшаем доступный угол с учетом отступов
  const aBase = q.startAngle + ANGLE_PAD; // Начинаем с отступом от границы сектора
  const rMin = ringIndex * RADIUS_STEP + PAD;
  const rMax = (ringIndex + 1) * RADIUS_STEP - PAD;
  const id = Number(tech.id) || 0;
  const GOLDEN_ANGLE = 137.50776405003785;
  const PHI_FRAC = 0.6180339887498949;
  const angleOffset = ((id * GOLDEN_ANGLE) % ANGLE_SPAN);
  const angle = aBase + angleOffset;
  const rFrac = frac(id * PHI_FRAC + ringIndex * 0.173 + quadrantId * 0.317);
  const radius = rMin + rFrac * (rMax - rMin);
  const p = polarToCartesian(CENTER_X, CENTER_Y, radius, angle);
  return { x: Math.round(p.x), y: Math.round(p.y) };
}

/**
 * Рассчитать позицию технологии для конкретного квадранта.
 * Находит первый блок технологии, который относится к целевому квадранту,
 * и использует его для расчета позиции в этом квадранте.
 */
function assignFixedPositionForQuadrant(tech, targetQuadrant) {
  if (!tech || targetQuadrant == null) {
    return assignFixedPosition(tech);
  }

  // Находим первый блок, который относится к целевому квадранту
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

  // Если не нашли блок для этого квадранта, используем стандартную функцию
  if (!blockKey) {
    return assignFixedPosition(tech);
  }

  // Используем целевый квадрант для расчета позиции
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

  // Добавляем смещение на основе блока, чтобы blip'ы в разных квадрантах были в разных местах
  const blockHash = String(blockKey).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const angleOffset = ((id * GOLDEN_ANGLE + blockHash * 37) % ANGLE_SPAN);
  const angle = aBase + angleOffset;
  const rFrac = frac(id * PHI_FRAC + ringIndex * 0.173 + targetQuadrant * 0.317 + blockHash * 0.041);
  const radius = rMin + rFrac * (rMax - rMin);
  const p = polarToCartesian(CENTER_X, CENTER_Y, radius, angle);
  return { x: Math.round(p.x), y: Math.round(p.y) };
}

// Форма по типу технологии
function computeShapeByTechType(techType) {
  if (!techType) return null;
  return TECHTYPE_TO_SHAPE[techType] || null;
}

// Рассчитать координаты для технологии и записать в объект (детерминировано)
// Позиция вычисляется только на основе свойств технологии (id, blocks, level),
// что гарантирует стабильность независимо от порядка обработки
function computeCoordinates(tech) {
  const pos = assignFixedPosition(tech);
  tech.x = pos.x;
  tech.y = pos.y;
  return tech;
}

// Разведение точек внутри каждого сектора и кольца,
// чтобы технологии не накладывались друг на друга.
// Пересечения допускаются только если в секторе/кольце физически не хватает места.
function applyNonOverlappingLayout(renderData) {
  if (!Array.isArray(renderData) || !renderData.length) return;
  if (!Array.isArray(QUADRANTS) || !QUADRANTS.length) return;

  // Предсоздадим быстрый доступ к квадрантам по id
  const quadrantById = {};
  QUADRANTS.forEach(q => {
    if (q && typeof q.id !== 'undefined') quadrantById[q.id] = q;
  });

  // Группируем технологии по (quadrant, ring)
  const groups = new Map();
  renderData.forEach(t => {
    if (t == null || t.quadrant == null || t.ring == null) return;
    const key = `${t.quadrant}|${t.ring}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(t);
  });

  const MAX_ITER = 80;

  // Вспомогательная функция: ограничить точку внутри заданного сектора и кольца
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

    const polar = cartesianToPolar(CENTER_X, CENTER_Y, t.x, t.y);
    let radius = polar.radius;
    let angle = polar.angle;

    if (!Number.isFinite(radius)) radius = (rMin + rMax) / 2;
    if (!Number.isFinite(angle)) angle = (angleMin + angleMax) / 2;

    if (radius < rMin) radius = rMin;
    if (radius > rMax) radius = rMax;
    if (angle < angleMin) angle = angleMin;
    if (angle > angleMax) angle = angleMax;

    const p = polarToCartesian(CENTER_X, CENTER_Y, radius, angle);
    t.x = Math.round(p.x);
    t.y = Math.round(p.y);
  }

  // Для каждой группы выполняем простую итеративную «расталкивающую» раскладку
  for (const group of groups.values()) {
    if (!group || group.length <= 1) continue;

    // Сначала убедимся, что все точки находятся внутри своего сектора/кольца
    group.forEach(t => {
      if (typeof t.x !== 'number' || typeof t.y !== 'number' || isNaN(t.x) || isNaN(t.y)) {
        const pos = assignFixedPosition(t);
        t.x = pos.x;
        t.y = pos.y;
      }
      clampToSectorRing(t);
    });

    // Итеративно раздвигаем точки до минимального расстояния
    for (let iter = 0; iter < MAX_ITER; iter++) {
      let moved = false;
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          const a = group[i];
          const b = group[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
          if (dist >= MIN_BLIP_DISTANCE) continue;

          // Сколько нужно раздвинуть точки
          const overlap = MIN_BLIP_DISTANCE - dist;
          const shiftX = (dx / dist) * (overlap / 2);
          const shiftY = (dy / dist) * (overlap / 2);

          // Смещаем точки в противоположные стороны
          a.x -= shiftX;
          a.y -= shiftY;
          b.x += shiftX;
          b.y += shiftY;

          // Ограничиваем в пределах сектора и кольца
          clampToSectorRing(a);
          clampToSectorRing(b);

          moved = true;
        }
      }
      // Если за проход ничего не сдвинули — достигли устойчивого состояния
      if (!moved) break;
      // Если точек слишком много и места объективно мало, часть пересечений останется —
      // это соответствует требованию, что наложения допустимы только при нехватке места.
    }
  }
}

// Дополнительное разведение технологий относительно подписей колец:
// технологии не должны находиться поверх прямоугольников с названиями колец,
// а располагаться рядом с ними.
function avoidRingLabelOverlap(renderData) {
  if (!Array.isArray(renderData) || !renderData.length) return;
  if (!Array.isArray(RINGS) || !RINGS.length) return;

  // Предрассчитываем «запрещённые» зоны вокруг подписей колец
  const PADDING = 6; // небольшой запас вокруг прямоугольника
  const labelZones = RINGS.map((_, ringIndex) => {
    const r = (ringIndex + 1) * RADIUS_STEP;
    const pos = polarToCartesian(CENTER_X, CENTER_Y, r, 0);
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

    // Проверяем, попадает ли технология в прямоугольник подписи кольца
    if (
      t.x >= zone.xMin &&
      t.x <= zone.xMax &&
      t.y >= zone.yMin &&
      t.y <= zone.yMax
    ) {
      const polar = cartesianToPolar(CENTER_X, CENTER_Y, t.x, t.y);
      let radius = polar.radius;
      if (!Number.isFinite(radius) || radius <= 0) radius = zone.radius;

      // Определяем, в какую сторону «уводить» точку:
      // для квадранта 1 — вправо от подписи, для квадранта 4 — влево.
      // Для остальных квадрантов (2 и 3) подписи не пересекаются.
      const qId = t.quadrant;
      if (qId !== 1 && qId !== 4) return;

      const side = qId === 4 ? -1 : 1;

      // Оцениваем угловую ширину подписи на данном радиусе
      const chord = RING_LABEL_WIDTH;
      const halfAngleRad = Math.min(
        Math.PI / 3, // не более 60°
        Math.max(0, Math.asin(Math.min(1, chord / (2 * radius))))
      );
      const halfAngleDeg = (halfAngleRad * 180) / Math.PI;

      // Добавляем небольшой зазор по углу, чтобы точки были «рядом, но не на подписи»
      const extraGap = 4;
      let targetAngle =
        (halfAngleDeg + extraGap) * (side > 0 ? 1 : -1);
      // Нормализуем в [0, 360)
      while (targetAngle < 0) targetAngle += 360;
      while (targetAngle >= 360) targetAngle -= 360;

      // Учитываем ограничения сектора, чтобы не выйти за его границы
      const q = QUADRANTS.find((qq) => qq.id === qId);
      if (q) {
        const angleMin = q.startAngle + POSITION_ANGLE_PAD;
        const angleMax = q.startAngle + 90 - POSITION_ANGLE_PAD;
        if (targetAngle < angleMin) targetAngle = angleMin;
        if (targetAngle > angleMax) targetAngle = angleMax;
      }

      const p = polarToCartesian(CENTER_X, CENTER_Y, radius, targetAngle);
      t.x = Math.round(p.x);
      t.y = Math.round(p.y);
    }
  });
}

// ===== ЗАГРУЗКА ДАННЫХ =====
async function loadData() {
  // Очищаем кэш при загрузке
  Object.keys(localStorage).forEach(key => {
    if (key.startsWith('vfs:')) {
      localStorage.removeItem(key);
    }
  });

  // Helper: try to load JSON from VFS first, then from disk via fetch
  async function loadJsonPreferVfs(filename) {
    // Всегда пытаемся сначала загрузить из data/ru
    const paths = [`/src/data/ru/${filename}`, `/src/data/${filename}`];
    for (const p of paths) {
      try {
        const r = await fetch(p, {
          headers: {
            'Accept': 'application/json',
            'Cache-Control': 'no-cache'
          }
        });
        if (r && r.ok) {
          try {
            const text = await r.text();
            const json = JSON.parse(text);
            console.debug(`Загружены данные из файла ${p}:`, json);
            return { path: p, data: json };
          } catch (err) {
            console.warn(`Ошибка парсинга JSON из ${p}:`, err);
            continue;
          }
        } else {
          console.warn(`Не удалось загрузить ${p}, статус:`, r.status);
        }
      } catch (err) {
        console.warn(`Ошибка загрузки ${p}:`, err);
      }
    }

    // Только если не удалось загрузить с диска, пробуем из VFS
    const fromVfs = vfsRead(filename);
    if (fromVfs !== null) {
      console.debug(`Загружены данные из VFS для ${filename}:`, fromVfs);
      return { path: `local:${filename}`, data: fromVfs };
    }

    return { path: null, data: null };
  }
  // Попытаться загрузить и распарсить JSON по наборам путей (data/ и data/ru/). Возвращает { path, data, errors }
  async function tryFetchAndParse(filename) {
    const paths = [`/src/data/${filename}`, `/src/data/ru/${filename}`];
    const errors = [];
    for (const p of paths) {
      try {
        const r = await fetch(p);
        if (r && r.ok) {
          try {
            const json = await r.json();
            return { path: p, data: json };
          } catch (err) {
            errors.push(`Парсинг ${p} не удался: ${err?.message || err}`);
          }
        } else {
          errors.push(`${p} ответ: ${r ? r.status : 'нет ответа'}`);
        }
      } catch (err) {
        errors.push(`Ошибка fetch(${p}): ${err?.message || err}`);
      }
    }
    return { path: null, data: null, errors };
  }

  try {
    // Load blocks list (prefer VFS)
    const b1 = await loadJsonPreferVfs('bloks.json');
    let blocks = b1.data;
    if (!blocks) {
      const alt = await loadJsonPreferVfs('blocks.json');
      if (alt.data) blocks = alt.data;
    }
    // Справочники блоков и список имен для селектов
    const blockIdToName = {};
    // Используем глобальную переменную nameToBlockId
    nameToBlockId = {};
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
    blocksList = Array.isArray(blocks) ? blocks.map(b => (b && b.name) ? b.name : b).filter(Boolean) : [];

    const fileNames = [
      'functions.json',
      'techTypes.json',
      'status.json',
      'sector.json',
      'functionToBlock.json',
      'enterpriseData.json',
      'blockToQuadrant.json',
    ];

    const fetched = {};
    for (const fn of fileNames) {
      fetched[fn] = await loadJsonPreferVfs(fn);
    }

    // Соберём список отсутствующих/непреобразованных файлов
    const missing = [];
    if (!blocks) missing.push('bloks.json|blocks.json');
    for (const fn of fileNames) if (!fetched[fn].data) missing.push(fn);

    if (missing.length) {
      console.error('Ошибка загрузки данных. Подробности:', { fetched });
      const hint = missing.join(', ');
      throw new Error(`Не удалось загрузить файлы: ${hint}`);
    }

    // Присваиваем распаршенные данные
    const functionsData = fetched['functions.json'].data;
    functions = Array.isArray(functionsData)
      ? functionsData.map(f => (f && typeof f === 'object' && f.name) ? f.name : String(f || '')).filter(Boolean)
      : [];
    const techTypes = fetched['techTypes.json'].data;
    const statusList = fetched['status.json'].data;
    const sectors = fetched['sector.json'].data;
    functionToBlockMap = fetched['functionToBlock.json'].data || {};
    // enterpriseData may come from VFS (path startsWith 'local:') or from disk
    enterpriseData = fetched['enterpriseData.json'].data || {};
    // If enterpriseData was loaded from VFS, attempt to read disk copy and merge any new entries (helps when user edited JSON on disk)
    try {
      if (fetched['enterpriseData.json'].path && String(fetched['enterpriseData.json'].path).startsWith('local:')) {
        // try disk locations
        const diskPaths = ['/src/data/enterpriseData.json', '/src/data/ru/enterpriseData.json'];
        for (const p of diskPaths) {
          try {
            const resp = await fetch(p);
            if (!resp || !resp.ok) continue;
            const diskJson = await resp.json();
            if (!diskJson) continue;
            // Merge: for each enterprise, add technologies with ids not present in VFS
            let merged = false;
            Object.keys(diskJson).forEach(ent => {
              const arrDisk = Array.isArray(diskJson[ent]) ? diskJson[ent] : [];
              if (!enterpriseData[ent]) {
                enterpriseData[ent] = [];
                merged = merged || arrDisk.length > 0;
              }
              const existingIds = new Set((enterpriseData[ent] || []).map(t => Number(t.id)));
              arrDisk.forEach(t => {
                const tid = Number(t.id);
                if (!existingIds.has(tid)) {
                  enterpriseData[ent].push(t);
                  existingIds.add(tid);
                  merged = true;
                }
              });
            });
            if (merged) {
              console.info('VFS enterpriseData merged with disk copy from', p);
              try { vfsWrite('enterpriseData.json', enterpriseData); } catch (e) { console.warn('vfs write failed during merge', e); }
            }
            break; // whether merged or not, we've checked disk
          } catch (err) { /* ignore fetch parse errors for this path */ }
        }
      }
    } catch (err) { console.warn('Error while attempting to merge enterpriseData from disk into VFS', err); }
  blockToQuadrant = fetched['blockToQuadrant.json'].data || {};
    // Установим RINGS и QUADRANTS из JSON
    RINGS = Array.isArray(statusList) ? statusList.slice() : ["Используемые", "Внедряемые", "Перспективные"];
    levelToRing = {};
    RINGS.forEach((rName, idx) => {
      levelToRing[rName] = idx;
      if (typeof rName === 'string' && rName.endsWith('ые')) {
        levelToRing[rName.slice(0, -2) + 'ая'] = idx;
      }
    });
    QUADRANTS = Array.isArray(sectors)
      ? sectors.map(s => ({ id: s.quadrant, name: s.name, startAngle: (s.quadrant - 1) * 90 }))
      : [
          { id: 1, name: "Корпоративное управление и администрация", startAngle: 0 },
          { id: 2, name: "Основное производство", startAngle: 90 },
          { id: 3, name: "Производственная поддержка и безопасность", startAngle: 180 },
          { id: 4, name: "Внешние бизнесы", startAngle: 270 },
        ];
    // Преобразуем enterpriseData к объекту по предприятиям, если пришел массив
    if (Array.isArray(fetched['enterpriseData.json'].data)) {
      const grouped = {};
      (fetched['enterpriseData.json'].data || []).forEach(item => {
        // Обрабатываем company как массив или строку
        const companies = Array.isArray(item.company) ? item.company : (item.company ? [item.company] : ['РМК']);
        // Преобразуем блоки (id → имя)
        const blockNames = Array.isArray(item.blocks)
          ? item.blocks.map(bid => blockIdToName[bid]).filter(Boolean)
          : [];
        const normalized = Object.assign({}, item, {
          block: blockNames.length ? blockNames[0] : (typeof item.block === 'number' ? (blockIdToName[item.block] || '') : (item.block || '')),
          blocks: blockNames.length ? blockNames : (Array.isArray(item.blocks) ? item.blocks : []),
          techType: item.techTypes || item.techType || '',
          level: item.status || item.level || '',
        });
        // Добавляем технологию во все указанные компании
        companies.forEach(company => {
          if (!grouped[company]) grouped[company] = [];
          grouped[company].push(normalized);
        });
      });
      enterpriseData = grouped;
    }

    // Заполнение фильтров
    populateSelect('block', blocksList, 'Функциональные блоки: Все');
    populateSelect('function', functions, 'Функции: Все');
    populateSelect('techType', Array.isArray(techTypes) ? techTypes : Object.keys(TECHTYPE_TO_SHAPE), 'Тип технологий: Все');
    populateSelect('level', RINGS, 'Статус: Все');

    // Модальные окна
    // Список секторов: сначала пробуем взять из sector.json, если по какой-то причине
    // данные не загрузились — используем имена из QUADRANTS (дефолтные сектора радара).
    let sectorNames = [];
    if (Array.isArray(sectors) && sectors.length) {
      sectorNames = sectors.map(s => s && s.name).filter(Boolean);
    }
    if ((!Array.isArray(sectorNames) || sectorNames.length === 0) && Array.isArray(QUADRANTS) && QUADRANTS.length) {
      sectorNames = QUADRANTS.map(q => q && q.name).filter(Boolean);
    }
    populateSelectForModal('techSector', sectorNames, 'Выберите');
    populateSelectForModal('techBlock', blocksList, 'Выберите');
    populateSelectForModal('techFunc', functions, 'Выберите');
    populateSelectForModal('techTechType', Array.isArray(techTypes) ? techTypes : Object.keys(TECHTYPE_TO_SHAPE), 'Выберите');
    populateSelectForModal('techStatus', RINGS, 'Выберите');
    // Заполняем список предприятий
    const enterpriseList = Object.keys(enterpriseData);
    populateSelectForModal('techCompany', enterpriseList, 'Выберите');
    // Поле стоимости внедрения теперь доступно для всех статусов
    function setupCostToggle(prefix) {
      const group = document.getElementById(`${prefix}CostGroup`);
      if (!group) return;
      // Поле всегда видно для всех статусов
      group.style.display = '';
    }
    setupCostToggle('tech');
    // removed: digitalizationLevel, process (techLevel), ref

    // Настройка обработчиков форм
    const addTechForm = document.getElementById('addTechForm');
    if (addTechForm) {
      addTechForm.onsubmit = function(e) {
        e.preventDefault();
        const formData = new FormData(this);

        // Статус технологии выбирается из поля techStatus и
        // должен напрямую задавать уровень (кольцо) радара.
        const rawStatus = formData.get('techStatus');
        const selectedStatus =
          (rawStatus && rawStatus.toString().trim()) ||
          (Array.isArray(RINGS) && RINGS.length ? RINGS[0] : 'Используемые');

        const tech = {
          id: nextId++,
          name: formData.get('techName'),
          blocks: [formData.get('techBlock')],
          functions: [formData.get('techFunc')],
          techType: formData.get('techTechType'),
          // Явно сохраняем и status, и level, чтобы фильтры и приоритеты
          // всегда использовали одну и ту же строку статуса.
          status: selectedStatus,
          level: selectedStatus,
          description: formData.get('techDescription')
        };

        // Добавляем в массив технологий
        technologies.push(tech);
        enterpriseData[currentEnterprise] = technologies;

        // Сохраняем в VFS
        vfsWrite('enterpriseData.json', enterpriseData);

        // Обновляем радар
        computeCoordinates(tech);
        updateRadar();

        // Закрываем модальное окно
        const modal = document.getElementById('addTechPanel');
        if (modal) modal.style.display = 'none';

        showNotification('Технология успешно добавлена', true);
        return false;
      };
    }

    const editTechForm = document.getElementById('editTechForm');
    if (editTechForm) {
      editTechForm.onsubmit = function(e) {
        e.preventDefault();
        if (!currentTech) return false;

        const formData = new FormData(this);

        // Новый статус при редактировании берём из поля editStatus.
        // Если пользователь не менял статус, оставляем прежний.
        const rawStatus = formData.get('editStatus');
        const selectedStatus =
          (rawStatus && rawStatus.toString().trim()) ||
          (currentTech.status && currentTech.status.toString().trim()) ||
          (currentTech.level && currentTech.level.toString().trim()) ||
          (Array.isArray(RINGS) && RINGS.length ? RINGS[0] : 'Используемые');

        const updatedTech = {
          ...currentTech,
          name: formData.get('editName'),
          blocks: [formData.get('editBlock')],
          functions: [formData.get('editFunc')],
          techType: formData.get('editTechType'),
          status: selectedStatus,
          level: selectedStatus,
          description: formData.get('editDescription')
        };

        // Обновляем в массиве
        const index = technologies.findIndex(t => t.id === currentTech.id);
        if (index !== -1) {
          technologies[index] = updatedTech;
          enterpriseData[currentEnterprise] = technologies;

          // Сохраняем в VFS
          vfsWrite('enterpriseData.json', enterpriseData);

          // Обновляем координаты и радар
          computeCoordinates(updatedTech);
          updateRadar();

          // Обновляем панель деталей (источник — редактирование)
          showDetail(updatedTech, 'edit');
        }

        // Закрываем модальное окно
        const modal = document.getElementById('editTechPanel');
        if (modal) modal.style.display = 'none';

        showNotification('Технология успешно обновлена', true);
        return false;
      };
    }

    populateSelectForModal('editBlock', blocksList, 'Выберите');
    populateSelectForModal('editFunc', functions, 'Выберите');
    populateSelectForModal('editTechType', techTypes, 'Выберите');
    populateSelectForModal('editStatus', RINGS, 'Выберите');
    setupCostToggle('edit');

    // removed: editDigitalizationLevel, editLevel, editRef
    // --- Нормализация данных: вычислим и закрепим зрелости, форму и координаты для каждой технологии ---
    function normalizeEnterpriseData() {
      let updated = false;
      Object.keys(enterpriseData).forEach(ent => {
        enterpriseData[ent] = enterpriseData[ent].map(t => {
          // Приведём id к числу
          t.id = Number(t.id) || nextId++;
          // Преобразуем блоки: числа → строки (страховка; основное преобразование делаем при загрузке)
          if (Array.isArray(t.blocks) && t.blocks.length && typeof t.blocks[0] === 'number') {
            try {
              t.blocks = t.blocks.map(b => String(b));
              t.block = t.blocks[0] || t.block;
            } catch (e) { /* ignore */ }
          }
          if (typeof t.block === 'number') t.block = String(t.block);
          // Нормализуем функции в массив строк
          if (t.functions && !Array.isArray(t.functions)) {
            t.functions = [String(t.functions)];
          }
          // level берём из статуса, если он указан
          if (t.status && !t.level) t.level = t.status;
          // Тип технологии: возможное поле techTypes → techType
          if (t.techTypes && !t.techType) t.techType = t.techTypes;
          // Вычислим форму строго по techType
          const newShape = computeShapeByTechType(t.techType) || 'circle';
          if (t.shape !== newShape) { t.shape = newShape; updated = true; }
          // Вычислим координаты
          const prevX = t.x, prevY = t.y;
          computeCoordinates(t);
          if (t.x !== prevX || t.y !== prevY) updated = true;
          return t;
        });
      });
      if (updated) {
        try { vfsWrite('enterpriseData.json', enterpriseData); } catch (e) { console.warn('Не удалось сохранить enterpriseData после нормализации', e); }
      }
    }
    normalizeEnterpriseData();
    // Обновим заголовки секторов в сайдбаре
    try {
      QUADRANTS.forEach(q => {
        const el = document.querySelector(`.sector-item[data-quadrant="${q.id}"]`);
        if (el) {
          const title = el.querySelector('.sector-title') || el;
          if (title) title.textContent = q.name;
        }
      });
    } catch (e) { /* ignore */ }
  } catch (error) {
    console.error('Ошибка загрузки данных:', error);
    // Добавим подсказку о возможной причине (локальное открытие файла без сервера)
    const msg = error?.message || '';
    alert('Не удалось загрузить данные приложения. ' + msg + '\nЕсли вы открываете страницу по протоколу file://, запустите локальный HTTP-сервер и откройте по http://localhost.');
  }
}

// ===== ФИЛЬТРЫ =====
function createCheckboxOptionLi(value, labelText) {
  const li = document.createElement('li');
  li.classList.add('select-option-item');
  li.setAttribute('data-value', value);
  li.innerHTML = `
    <label class="option-label">
      <input type="checkbox" class="option-checkbox" />
      <span>${labelText}</span>
    </label>
  `;
  return li;
}

function createSelectAllLi() {
  const li = document.createElement('li');
  li.className = 'select-all-option';
  li.innerHTML = `
    <label class="option-label">
      <input type="checkbox" class="select-all-checkbox" />
      <span>Выбрать все</span>
    </label>
  `;
  return li;
}

function populateSelect(filterKey, items, placeholderText) {
  const select = document.querySelector(`.custom-select[data-filter="${filterKey}"]`);
  if (!select) return;
  const optionsList = select.querySelector('.select-options');
  const selectedText = select.querySelector('.selected-text');
  const hiddenInput = document.getElementById(`filter_${filterKey}`);

  // Сохраняем плейсхолдер и "базовый" заголовок без ": Все"
  select.setAttribute('data-placeholder', placeholderText);
  const baseLabel = placeholderText.includes(':')
    ? placeholderText.split(':')[0].trim()
    : placeholderText;
  select.setAttribute('data-label', baseLabel);

  // Все фильтры sidebar работают в режиме множественного выбора
  select.setAttribute('data-multi', 'true');
  optionsList.innerHTML = '';

  // Поиск для блоков и функций
  if (filterKey === 'block' || filterKey === 'function') {
    const searchWrap = document.createElement('li');
    searchWrap.className = 'select-search';
    searchWrap.innerHTML = `<input type="text" placeholder="Поиск..." autocomplete="off" />`;
    optionsList.appendChild(searchWrap);
  }

  // "Выбрать все"
  optionsList.appendChild(createSelectAllLi());

  // Если это фильтр блоков и есть зуммированный квадрант, фильтруем блоки
  let filteredItems = items;
  if (filterKey === 'block' && currentZoomedQuadrant != null) {
    filteredItems = items.filter(blockName => {
      const quadrantId = getQuadrantIdForBlock(blockName);
      return quadrantId === currentZoomedQuadrant;
    });
  }

  // Если это фильтр функций и выбран блок, фильтруем функции
  if (filterKey === 'function') {
    const selectedBlocks = getFilterValues('block'); // Получаем массив выбранных блоков
    if (selectedBlocks.length > 0 && nameToBlockId && functionToBlockMap) {
      const selectedBlockIds = selectedBlocks
        .map(blockName => nameToBlockId[blockName])
        .filter(id => id != null);
      if (selectedBlockIds.length > 0) {
        filteredItems = items.filter(funcName => {
          const blockIds = functionToBlockMap[funcName];
          if (!blockIds) return false;
          // blockIds может быть числом или массивом чисел
          const funcBlockIds = Array.isArray(blockIds) ? blockIds : [blockIds];
          return funcBlockIds.some(id => selectedBlockIds.includes(id));
        });
      }
    }
  }

  filteredItems.forEach(item => {
    const li = createCheckboxOptionLi(item, item);
    optionsList.appendChild(li);
  });

  // Инициализируем отображение (по умолчанию ничего не выбрано)
  if (hiddenInput) hiddenInput.value = '';
  renderMultiSelectTags(select);
}

// Функция для обновления фильтра функций по выбранным блокам
function updateFunctionFilterForBlock(blockNames) {
  if (!functions || functions.length === 0) return;
  if (!functionToBlockMap || Object.keys(functionToBlockMap).length === 0) return;

  const select = document.querySelector('.custom-select[data-filter="function"]');
  if (!select) return;

  const optionsList = select.querySelector('.select-options');
  if (!optionsList) return;
  const hiddenInput = document.getElementById('filter_function');

  // Сохраняем текущие выбранные значения (множественный выбор)
  const currentSelected = getFilterValues('function');

  // Очищаем список опций
  optionsList.innerHTML = '';

  // Добавляем поиск
  const searchWrap = document.createElement('li');
  searchWrap.className = 'select-search';
  searchWrap.innerHTML = `<input type="text" placeholder="Поиск..." autocomplete="off" />`;
  optionsList.appendChild(searchWrap);

  // Добавляем "Выбрать все"
  optionsList.appendChild(createSelectAllLi());

  // Фильтруем функции по выбранным блокам
  let filteredFunctions = functions;
  const blockNamesArray = Array.isArray(blockNames) ? blockNames : (blockNames ? [blockNames] : []);
  if (blockNamesArray.length > 0 && nameToBlockId) {
    const selectedBlockIds = blockNamesArray
      .map(blockName => nameToBlockId[blockName])
      .filter(id => id != null);
    if (selectedBlockIds.length > 0) {
      filteredFunctions = functions.filter(funcName => {
        const blockIds = functionToBlockMap[funcName];
        if (!blockIds) return false;
        // blockIds может быть числом или массивом чисел
        const funcBlockIds = Array.isArray(blockIds) ? blockIds : [blockIds];
        return funcBlockIds.some(id => selectedBlockIds.includes(id));
      });
    }
  }

  // Добавляем отфильтрованные функции
  filteredFunctions.forEach(funcName => {
    const li = createCheckboxOptionLi(funcName, funcName);
    // Восстанавливаем выделение, если функция была выбрана и все еще доступна
    if (currentSelected.includes(funcName)) {
      li.classList.add('selected');
      const checkbox = li.querySelector('input[type="checkbox"]');
      if (checkbox) checkbox.checked = true;
    }
    optionsList.appendChild(li);
  });

  // Обновляем скрытое поле и отображение, оставляя только доступные выбранные функции
  const validSelected = currentSelected.filter(func => filteredFunctions.includes(func));
  if (hiddenInput) hiddenInput.value = JSON.stringify(validSelected);
  select.setAttribute('data-value', hiddenInput ? hiddenInput.value : JSON.stringify(validSelected));
  renderMultiSelectTags(select);

  // Если какие-то выбранные функции стали недоступны, обновляем радар
  if (validSelected.length !== currentSelected.length) {
    updateRadar();
  }
}

// Обновление списка функциональных блоков в модалке добавления/редактирования технологии
// в зависимости от выбранных секторов
function updateModalBlocksForSectors(sectorNames) {
  if (!Array.isArray(blocksList) || blocksList.length === 0) return;
  if (!Array.isArray(QUADRANTS) || QUADRANTS.length === 0) return;
  if (!blockToQuadrant || Object.keys(blockToQuadrant).length === 0) return;

  const blockSelect = document.querySelector('.custom-select-modal[data-field="techBlock"]');
  if (!blockSelect) return;
  const optionsList = blockSelect.querySelector('.select-options');
  if (!optionsList) return;
  const hiddenInput = document.getElementById('techBlock');

  // Текущий выбор блоков (множественный выбор)
  let currentSelected = [];
  if (hiddenInput && hiddenInput.value) {
    try {
      const parsed = JSON.parse(hiddenInput.value);
      if (Array.isArray(parsed)) currentSelected = parsed;
    } catch (e) {
      currentSelected = [];
    }
  }

  const sectorArray = Array.isArray(sectorNames)
    ? sectorNames
    : (sectorNames ? [sectorNames] : []);

  let allowedBlocks = blocksList.slice();

  if (sectorArray.length > 0) {
    // Маппинг "имя сектора" -> id квадранта
    const sectorNameToId = {};
    QUADRANTS.forEach(q => {
      if (q && q.name != null && q.id != null) {
        sectorNameToId[String(q.name).trim()] = q.id;
      }
    });
    const selectedQuadrantIds = sectorArray
      .map(name => sectorNameToId[String(name).trim()])
      .filter(id => id != null);

    if (selectedQuadrantIds.length > 0) {
      allowedBlocks = blocksList.filter(blockName => {
        const m = blockToQuadrant[blockName];
        if (m == null) return false;
        const arr = Array.isArray(m) ? m : [m];
        return arr.some(id => selectedQuadrantIds.includes(id));
      });
    }
  }

  // Перестраиваем список опций в модальном селекте блоков
  const existingSearch = optionsList.querySelector('.select-search');
  optionsList.innerHTML = '';
  if (existingSearch) optionsList.appendChild(existingSearch);

  // Добавляем опцию "Выбрать все" для блоков с чекбоксами
  const selectAllLi = document.createElement('li');
  selectAllLi.className = 'select-all-option';
  selectAllLi.innerHTML = `
    <label class="option-label">
      <input type="checkbox" class="select-all-checkbox" />
      <span>Выбрать все</span>
    </label>
  `;
  optionsList.appendChild(selectAllLi);

  // Оставляем только те выбранные блоки, которые доступны после фильтрации
  const validSelectedBlocks = currentSelected.filter(b => allowedBlocks.includes(b));

  allowedBlocks.forEach(blockName => {
    const li = document.createElement('li');
    li.classList.add('select-option-item');
    li.setAttribute('data-value', blockName);
    const isSelected = validSelectedBlocks.includes(blockName);
    li.innerHTML = `
      <label class="option-label">
        <input type="checkbox" class="option-checkbox" ${isSelected ? 'checked' : ''} />
        <span>${blockName}</span>
      </label>
    `;
    if (isSelected) {
      li.classList.add('selected');
    }
    optionsList.appendChild(li);
  });

  if (hiddenInput) {
    hiddenInput.value = validSelectedBlocks.length ? JSON.stringify(validSelectedBlocks) : '';
  }

  // Обновляем состояние чекбокса "Выбрать все"
  const allCheckbox = selectAllLi.querySelector('input[type="checkbox"]');
  if (allCheckbox && allowedBlocks.length > 0) {
    allCheckbox.checked = validSelectedBlocks.length === allowedBlocks.length;
  }

  // Обновляем отображение тегов
  renderMultiSelectTags(blockSelect);

  // После изменения доступных блоков, обновим функции в модалке
  updateModalFunctionsForBlocks(validSelectedBlocks, 'techFunc');
}

// Обновление списка функций в модалке добавления/редактирования технологии
// в зависимости от выбранных функциональных блоков
function updateModalFunctionsForBlocks(blockNames, fieldId) {
  if (!Array.isArray(functions) || functions.length === 0) return;
  if (!functionToBlockMap || Object.keys(functionToBlockMap).length === 0) return;
  if (!nameToBlockId || Object.keys(nameToBlockId).length === 0) return;

  const targetField = fieldId || 'techFunc';
  const funcSelect = document.querySelector(`.custom-select-modal[data-field="${targetField}"]`);
  if (!funcSelect) return;
  const optionsList = funcSelect.querySelector('.select-options');
  if (!optionsList) return;
  const hiddenInput = document.getElementById(targetField);

  // Текущее значение (множественный выбор)
  let currentSelected = [];
  if (hiddenInput && hiddenInput.value) {
    try {
      const parsed = JSON.parse(hiddenInput.value);
      if (Array.isArray(parsed)) currentSelected = parsed;
    } catch (e) {
      currentSelected = [];
    }
  }

  const blockNamesArray = Array.isArray(blockNames)
    ? blockNames
    : (blockNames ? [blockNames] : []);

  let allowedFunctions = functions.slice();

  if (blockNamesArray.length > 0) {
    const selectedBlockIds = blockNamesArray
      .map(blockName => nameToBlockId[blockName])
      .filter(id => id != null);

    if (selectedBlockIds.length > 0) {
      allowedFunctions = functions.filter(funcName => {
        const blockIds = functionToBlockMap[funcName];
        if (!blockIds) return false;
        const funcBlockIds = Array.isArray(blockIds) ? blockIds : [blockIds];
        return funcBlockIds.some(id => selectedBlockIds.includes(id));
      });
    }
  }

  // Перестраиваем список опций в модальном селекте функций
  const existingSearch = optionsList.querySelector('.select-search');
  optionsList.innerHTML = '';
  if (existingSearch) optionsList.appendChild(existingSearch);

  // Добавляем опцию "Выбрать все" для функций с чекбоксами
  const selectAllLi = document.createElement('li');
  selectAllLi.className = 'select-all-option';
  selectAllLi.innerHTML = `
    <label class="option-label">
      <input type="checkbox" class="select-all-checkbox" />
      <span>Выбрать все</span>
    </label>
  `;
  optionsList.appendChild(selectAllLi);

  // Оставляем только доступные выбранные функции
  const validSelectedFunctions = currentSelected.filter(f => allowedFunctions.includes(f));

  allowedFunctions.forEach(funcName => {
    const li = document.createElement('li');
    li.classList.add('select-option-item');
    li.setAttribute('data-value', funcName);
    const isSelected = validSelectedFunctions.includes(funcName);
    li.innerHTML = `
      <label class="option-label">
        <input type="checkbox" class="option-checkbox" ${isSelected ? 'checked' : ''} />
        <span>${funcName}</span>
      </label>
    `;
    if (isSelected) {
      li.classList.add('selected');
    }
    optionsList.appendChild(li);
  });

  if (hiddenInput) {
    hiddenInput.value = validSelectedFunctions.length ? JSON.stringify(validSelectedFunctions) : '';
  }

  // Обновляем состояние чекбокса "Выбрать все"
  const allCheckbox = selectAllLi.querySelector('input[type="checkbox"]');
  if (allCheckbox && allowedFunctions.length > 0) {
    allCheckbox.checked = validSelectedFunctions.length === allowedFunctions.length;
  }

  renderMultiSelectTags(funcSelect);
}

// Функция для обновления фильтра блоков при зуме/анзуме
function updateBlockFilterForZoomedQuadrant(quadrantId) {
  if (!blocksList || blocksList.length === 0) return;

  const select = document.querySelector('.custom-select[data-filter="block"]');
  if (!select) return;

  const optionsList = select.querySelector('.select-options');
  if (!optionsList) return;
  const hiddenInput = document.getElementById('filter_block');

  // Сохраняем текущие выбранные значения (множественный выбор)
  const currentSelected = getFilterValues('block');

  // Очищаем список опций
  optionsList.innerHTML = '';

  // Добавляем поиск
  const searchWrap = document.createElement('li');
  searchWrap.className = 'select-search';
  searchWrap.innerHTML = `<input type="text" placeholder="Поиск..." autocomplete="off" />`;
  optionsList.appendChild(searchWrap);

  // Добавляем "Выбрать все"
  optionsList.appendChild(createSelectAllLi());

  // Фильтруем блоки по квадранту, если есть зум
  let filteredBlocks = blocksList;
  if (quadrantId != null) {
    filteredBlocks = blocksList.filter(blockName => {
      const blockQuadrantId = getQuadrantIdForBlock(blockName);
      return blockQuadrantId === quadrantId;
    });
  }

  // Добавляем отфильтрованные блоки
  filteredBlocks.forEach(blockName => {
    const li = createCheckboxOptionLi(blockName, blockName);
    // Восстанавливаем выделение, если блок был выбран и все еще доступен
    if (currentSelected.includes(blockName)) {
      li.classList.add('selected');
      const checkbox = li.querySelector('input[type="checkbox"]');
      if (checkbox) checkbox.checked = true;
    }
    optionsList.appendChild(li);
  });

  // Обновляем скрытое поле и отображение, оставляя только доступные выбранные блоки
  const validSelected = currentSelected.filter(block => filteredBlocks.includes(block));
  if (hiddenInput) hiddenInput.value = JSON.stringify(validSelected);
  select.setAttribute('data-value', hiddenInput ? hiddenInput.value : JSON.stringify(validSelected));
  renderMultiSelectTags(select);

  // Если какие-то выбранные блоки стали недоступны, обновляем радар и фильтр функций
  if (validSelected.length !== currentSelected.length) {
    updateFunctionFilterForBlock(validSelected);
    updateRadar();
  }
}

function populateSelectForModal(selectId, items, placeholder) {
  const customSelect = document.querySelector(`.custom-select-modal[data-field="${selectId}"]`);
  if (!customSelect) return;
  const optionsList = customSelect.querySelector('.select-options');
  const selectedText = customSelect.querySelector('.selected-text');
  const hiddenInput = document.getElementById(selectId);
  customSelect.setAttribute('data-placeholder', placeholder);
  selectedText.textContent = placeholder;
  optionsList.innerHTML = '';
  // Для селектов с поиском проверяем, есть ли уже обёртка select-dropdown в HTML
  const selectDropdown = customSelect.querySelector('.select-dropdown');
  // Определяем, нужны ли чекбоксы для данного селекта (блоки и функции в модалках)
  const needsCheckboxes = ['techBlock', 'techFunc', 'editBlock', 'editFunc'].includes(selectId);
  if (needsCheckboxes) {
    // Если есть select-dropdown, поиск уже есть в HTML, не добавляем
    if (!selectDropdown) {
      const searchWrap = document.createElement('li');
      searchWrap.className = 'select-search';
      searchWrap.innerHTML = `<input type="text" placeholder="Поиск..." autocomplete="off" />`;
      optionsList.appendChild(searchWrap);
    }
    // Добавляем опцию "Выбрать все" для блоков и функций
    const selectAllLi = document.createElement('li');
    selectAllLi.className = 'select-all-option';
    selectAllLi.innerHTML = `
      <label class="option-label">
        <input type="checkbox" class="select-all-checkbox" />
        <span>Выбрать все</span>
      </label>
    `;
    optionsList.appendChild(selectAllLi);
  }
  // Для блоков, функций, процессов и предприятий в модалке разрешим множественный выбор
  const isMulti = ['techSector', 'techBlock', 'editBlock', 'techFunc', 'editFunc', 'techLevel', 'editLevel', 'techCompany'].includes(selectId);
  if (isMulti) {
    customSelect.setAttribute('data-multi', 'true');
  } else {
    customSelect.removeAttribute('data-multi');
  }
  // Для множественного выбора не добавляем placeholder-опцию, только для одиночного
  if (!isMulti) {
    const allOption = document.createElement('li');
    allOption.textContent = placeholder;
    allOption.setAttribute('data-value', '');
    optionsList.appendChild(allOption);
  }
  items.forEach(item => {
    if (needsCheckboxes) {
      // Создаём элемент с чекбоксом для блоков и функций
      const li = document.createElement('li');
      li.classList.add('select-option-item');
      li.setAttribute('data-value', item);
      li.innerHTML = `
        <label class="option-label">
          <input type="checkbox" class="option-checkbox" />
          <span>${item}</span>
        </label>
      `;
      optionsList.appendChild(li);
    } else {
      const li = document.createElement('li');
      li.textContent = item;
      li.setAttribute('data-value', item);
      optionsList.appendChild(li);
    }
  });
  if (hiddenInput) hiddenInput.value = '';
  // Если это multi-select, отрендерим теги (пустые по умолчанию)
  if (customSelect.getAttribute('data-multi') === 'true') renderMultiSelectTags(customSelect);
}

// Визуализация выбранных элементов для множественного выбора: теги с крестиком
function renderMultiSelectTags(customSelect) {
  if (!customSelect) return;
  const selectedTextEl = customSelect.querySelector('.selected-text');
  if (!selectedTextEl) return;

  // Определяем скрытое поле: для модальных селектов используется data-field, для фильтров - data-filter
  const hiddenInputId = customSelect.dataset.field || `filter_${customSelect.dataset.filter}`;
  const hiddenInput = document.getElementById(hiddenInputId);
  let selected = [];

  // Предпочитаем читать из li.selected, иначе парсим скрытое поле
  const selLis = Array.from(customSelect.querySelectorAll('.select-options li.selected'))
    .map(li => li.getAttribute('data-value'))
    .filter(v => v && v.length > 0);
  if (selLis.length) selected = selLis;
  else if (hiddenInput && hiddenInput.value) {
    try { selected = JSON.parse(hiddenInput.value); } catch (e) { selected = []; }
  }

  if (!selected || selected.length === 0) {
    selectedTextEl.innerHTML = customSelect.getAttribute('data-placeholder') || 'Выберите';
    customSelect.setAttribute('data-value', '');
    if (hiddenInput) hiddenInput.value = '';
    // Если это фильтр (не модальное окно), обновляем радар при очистке
    const filterKey = customSelect.getAttribute('data-filter');
    if (filterKey) {
      // Если это фильтр блоков, обновляем фильтр функций
      if (filterKey === 'block') {
        updateFunctionFilterForBlock([]);
      }
      // Обновляем радар
      updateRadar();
    }
    return;
  }

  const isSidebarFilter = !!customSelect.getAttribute('data-filter') && !customSelect.classList.contains('custom-select-modal');

  if (isSidebarFilter) {
    // Для фильтров в левой панели показываем только счётчик, без перечисления выбранных пунктов
    const baseLabel = customSelect.getAttribute('data-label') || customSelect.getAttribute('data-placeholder') || 'Выберите';
    const count = selected.length;
    selectedTextEl.textContent = `${baseLabel}: выбрано ${count}`;
    customSelect.setAttribute('data-value', hiddenInput ? hiddenInput.value : JSON.stringify(selected));
  } else {
    // Соберём теги (поведение для модальных мультиселектов и др.)
    selectedTextEl.innerHTML = '';
    selected.forEach(val => {
      const span = document.createElement('span');
      span.className = 'multi-tag';
      span.setAttribute('data-value', val);
      span.innerHTML = `${val} <button type="button" class="multi-tag-remove" aria-label="Удалить">&times;</button>`;
      // обработчик удаления
      span.querySelector('.multi-tag-remove').addEventListener('click', (ev) => {
        ev.stopPropagation();
        // снять выделение в списке
        const li = customSelect.querySelector(`.select-options li[data-value="${val}"]`);
        if (li) li.classList.remove('selected');
        // обновить скрытое поле
        const remaining = Array.from(customSelect.querySelectorAll('.select-options li.selected'))
          .map(x => x.getAttribute('data-value'))
          .filter(v => v && v.length > 0);
        if (hiddenInput) hiddenInput.value = JSON.stringify(remaining);
        customSelect.setAttribute('data-value', hiddenInput ? hiddenInput.value : JSON.stringify(remaining));
        // повторно отрисуем теги
        renderMultiSelectTags(customSelect);
        // удерживать фокус на select
        positionOptions(customSelect);

        // Если это фильтр блоков, обновляем фильтр функций
        const filterKeyInner = customSelect.getAttribute('data-filter');
        if (filterKeyInner === 'block') {
          updateFunctionFilterForBlock(remaining);
        }

        // Если это поле techCompany, обновляем видимость полей оценок
        const fieldId = customSelect.getAttribute('data-field');
        if (fieldId === 'techCompany' && typeof updateTechRatingsVisibility === 'function') {
          setTimeout(() => {
            updateTechRatingsVisibility();
          }, 50);
        }

        // Обновляем радар (если remaining не пуст, иначе renderMultiSelectTags обновит радар)
        // Но для надежности обновляем всегда, так как renderMultiSelectTags может вернуться раньше
        updateRadar();
      });
      selectedTextEl.appendChild(span);
    });
    customSelect.setAttribute('data-value', hiddenInput ? hiddenInput.value : JSON.stringify(selected));
  }

  // Для фильтров в левой панели (data-filter) после любого изменения набора тегов
  // принудительно обновляем радар и связанные списки, чтобы состояние всегда
  // соответствовало текущему набору выбранных значений.
  const filterKey = customSelect.getAttribute('data-filter');
  if (filterKey) {
    // Дополнительно синхронизируем фильтр функций при изменении блоков
    if (filterKey === 'block') {
      const currentSelected = Array.from(customSelect.querySelectorAll('.select-options li.selected'))
        .map(li => li.getAttribute('data-value'))
        .filter(v => v && v.length > 0);
      updateFunctionFilterForBlock(currentSelected);
    }
    updateRadar();
  }
}

let radarBackgroundRendered = false;
function renderRadarBackground() {
  if (radarBackgroundRendered) return;

  // Сначала создаем ringLabelsGroup (добавим его в SVG после секторов,
  // чтобы подписи колец были поверх линий радара, но под технологиями)
  const ringLabels = document.createElementNS(SVG_NS, "g");
  ringLabels.id = "ringLabelsGroup";
  RINGS.forEach((name, i) => {
    const r = (i + 1) * RADIUS_STEP;
    const pos = polarToCartesian(CENTER_X, CENTER_Y, r, 0);
    const labelGroup = document.createElementNS(SVG_NS, "g");
    labelGroup.setAttribute("transform", `translate(${pos.x}, ${pos.y})`);
    const bg = document.createElementNS(SVG_NS, "rect");
    bg.classList.add("ring-label-bg");
    const width = 180;
    const height = 42;
    bg.setAttribute("x", -width / 2);
    bg.setAttribute("y", -height / 2);
    bg.setAttribute("width", width);
    bg.setAttribute("height", height);
    const txt = document.createElementNS(SVG_NS, "text");
    txt.classList.add("ring-label");
    txt.setAttribute("x", 0);
    txt.setAttribute("y", 0);
    txt.setAttribute("dominant-baseline", "middle");
    txt.setAttribute("text-anchor", "middle");
    txt.textContent = name;
    labelGroup.appendChild(bg);
    labelGroup.appendChild(txt);
    ringLabels.appendChild(labelGroup);
  });

  // Затем создаем и добавляем quadrant-group (фон радара и линии)
  QUADRANTS.forEach((q) => {
    const g = document.createElementNS(SVG_NS, "g");
    g.classList.add("quadrant-group", `q${q.id}`);
    g.dataset.quadrant = q.id;
    const maxR = RINGS.length * RADIUS_STEP;
    const wedge = document.createElementNS(SVG_NS, "path");
    wedge.setAttribute("d", describeWedge(CENTER_X, CENTER_Y, maxR, q.startAngle, q.startAngle + 90));
    wedge.classList.add("quadrant-bg");
    g.appendChild(wedge);
    for (let i = 1; i <= RINGS.length; i++) {
      const arc = document.createElementNS(SVG_NS, "path");
      arc.setAttribute("d", describeArc(CENTER_X, CENTER_Y, i * RADIUS_STEP, q.startAngle, q.startAngle + 90));
      arc.classList.add("radar-arc");
      g.appendChild(arc);
    }
    const p1 = polarToCartesian(CENTER_X, CENTER_Y, maxR, q.startAngle);
    const p2 = polarToCartesian(CENTER_X, CENTER_Y, maxR, q.startAngle + 90);
    [p1, p2].forEach((p) => {
      const line = document.createElementNS(SVG_NS, "line");
      line.setAttribute("x1", CENTER_X);
      line.setAttribute("y1", CENTER_Y);
      line.setAttribute("x2", p.x);
      line.setAttribute("y2", p.y);
      line.classList.add("radar-line");
      g.appendChild(line);
    });

    // Добавляем подпись сектора по диагонали от центра, вне радара
    const sectorCenterAngle = q.startAngle + 45; // Центр сектора (45 градусов от начала)
    const sectorLabelRadius = maxR * 1.25; // Размещаем подпись на 115% от максимального радиуса (вне радара)
    const sectorLabelPos = polarToCartesian(CENTER_X, CENTER_Y, sectorLabelRadius, sectorCenterAngle);

    const sectorLabelGroup = document.createElementNS(SVG_NS, "g");
    sectorLabelGroup.classList.add("sector-label-group");
    sectorLabelGroup.setAttribute("transform", `translate(${sectorLabelPos.x}, ${sectorLabelPos.y})`);

    // Текст подписи с поддержкой переноса
    const sectorLabelText = document.createElementNS(SVG_NS, "text");
    sectorLabelText.classList.add("sector-label");
    sectorLabelText.setAttribute("x", 0);
    sectorLabelText.setAttribute("y", 0);
    sectorLabelText.setAttribute("dominant-baseline", "middle");
    sectorLabelText.setAttribute("text-anchor", "middle");

    // Разбиваем длинный текст на строки
    const words = q.name.split(' ');
    const maxCharsPerLine = 25; // Максимальное количество символов на строку
    let currentLine = '';
    const lines = [];

    words.forEach(word => {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      if (testLine.length <= maxCharsPerLine) {
        currentLine = testLine;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    });
    if (currentLine) lines.push(currentLine);

    // Если текст не помещается в одну строку, создаем многострочный текст
    if (lines.length === 1) {
      sectorLabelText.textContent = lines[0];
    } else {
      // Многострочный текст с использованием tspan
      lines.forEach((line, idx) => {
        const tspan = document.createElementNS(SVG_NS, "tspan");
        tspan.setAttribute("x", 0);
        tspan.setAttribute("dy", idx === 0 ? "-0.6em" : "1.2em");
        tspan.textContent = line;
        sectorLabelText.appendChild(tspan);
      });
    }

    sectorLabelGroup.appendChild(sectorLabelText);
    g.appendChild(sectorLabelGroup);

    svg.appendChild(g);
  });

  // ВАЖНО: добавляем группу подписей колец ПОСЛЕ секторов,
  // чтобы непрозрачный фон подписей перекрывал линии радара
  // (но сами технологии, которые рисуются позже, были поверх этих подписей)
  svg.appendChild(ringLabels);

  radarBackgroundRendered = true;
}
// Легенда фигур технологий по типам
function renderLegend() {
  const legend = document.querySelector('.legend');
  if (!legend) return;
  const items = [
    { label: 'Базовые', shape: 'triangle' },
    { label: 'Интегрированные', shape: 'circle' },
    { label: 'Платформенные решения', shape: 'square' },
    { label: 'Управление с ML и AI', shape: 'star' },
  ];
  // Вспомогательная генерация звезды для SVG
  const starPath = (cx, cy, outerR, innerR, points = 5) => {
    const step = Math.PI / points;
    let d = '';
    for (let i = 0; i < 2 * points; i++) {
      const r = i % 2 === 0 ? outerR : innerR;
      const a = -Math.PI / 2 + i * step;
      const x = cx + r * Math.cos(a);
      const y = cy + r * Math.sin(a);
      d += (i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`);
    }
    return d + ' Z';
  };
  // Соберём HTML
  const wrap = document.createElement('div');
  wrap.className = 'legend-items';
  items.forEach(it => {
    const row = document.createElement('div');
    row.className = 'legend-item';
    const svgEl = document.createElementNS(SVG_NS, 'svg');
    svgEl.setAttribute('width', '28');
    svgEl.setAttribute('height', '28');
    svgEl.setAttribute('viewBox', '0 0 40 40');
    let shapeEl;
    if (it.shape === 'circle') {
      shapeEl = document.createElementNS(SVG_NS, 'circle');
      shapeEl.setAttribute('cx', '20'); shapeEl.setAttribute('cy', '20'); shapeEl.setAttribute('r', '12');
    } else if (it.shape === 'square') {
      shapeEl = document.createElementNS(SVG_NS, 'rect');
      shapeEl.setAttribute('x', '10'); shapeEl.setAttribute('y', '10'); shapeEl.setAttribute('width', '22'); shapeEl.setAttribute('height', '22');
    } else if (it.shape === 'triangle') {
      shapeEl = document.createElementNS(SVG_NS, 'path');
      shapeEl.setAttribute('d', `M 20 8 L 30 28 L 10 28 Z`);
    } else if (it.shape === 'star') {
      shapeEl = document.createElementNS(SVG_NS, 'path');
      shapeEl.setAttribute('d', starPath(21, 21, 15, 5, 5));
    }
    if (shapeEl) {
      shapeEl.setAttribute('class', `legend-icon legend-icon--${it.shape}`);
      svgEl.appendChild(shapeEl);
    }
    const text = document.createElement('span');
    text.className = 'legend-label';
    text.textContent = it.label;
    row.appendChild(svgEl);
    row.appendChild(text);
    wrap.appendChild(row);
  });
  legend.innerHTML = '';
  legend.appendChild(wrap);
}
// ===== РАДАР =====
function renderRadar(data = technologies) {
  // Отрисовываем фон один раз
  renderRadarBackground();
  // Обновляем легенду под актуальные формы
  try { renderLegend(); } catch (e) { /* ignore */ }

  // Удаляем только точки (blips) и иконки предупреждения, не трогая фон
  svg.querySelectorAll('.blip').forEach(el => el.remove());
  svg.querySelectorAll('.blip-warning').forEach(el => el.remove());

  console.debug('renderRadar: start — input data length:', Array.isArray(data) ? data.length : 0);

  // Сначала фильтруем технологии по валидности кольца
  const validTechs = (Array.isArray(data) ? data : [])
    .filter((t) => {
      const ring = (t && typeof t.level !== 'undefined' && levelToRing && Object.prototype.hasOwnProperty.call(levelToRing, t.level)) ? levelToRing[t.level] : null;
      return t && ring != null;
    });

  console.debug('renderRadar: start — valid techs:', validTechs.length);

  // Создаем структуру данных для отображения: каждая технология может иметь несколько blip'ов
  const renderData = [];

  validTechs.forEach((t) => {
    // Получаем все квадранты для технологии
    const techQuadrants = getAllQuadrantsForTech(t);

    if (techQuadrants.length === 0) {
      console.debug('renderRadar: tech has no quadrants', { id: t.id, name: t.name });
      return;
    }

    // Принудительно используем форму по типу технологии
    const shape = computeShapeByTechType(t.techType) || 'circle';

    // Для каждого квадранта создаем запись для отображения
    techQuadrants.forEach((quadrantId) => {
      renderData.push({
        ...t,
        quadrant: quadrantId,
        ring: levelToRing[t.level],
        shape: shape,
        // Позиция будет вычислена позже для каждого квадранта отдельно
        x: null,
        y: null
      });
    });
  });

  console.debug('renderRadar: after mapping — renderData entries:', renderData.length);

  // Вычисляем позиции для каждого blip'а в его квадранте
  renderData.forEach((entry) => {
    const pos = assignFixedPositionForQuadrant(entry, entry.quadrant);
    entry.x = pos.x;
    entry.y = pos.y;
  });

  // Группируем по квадрантам для раскладки
  const renderDataByQuadrant = {};
  renderData.forEach(entry => {
    if (!renderDataByQuadrant[entry.quadrant]) {
      renderDataByQuadrant[entry.quadrant] = [];
    }
    renderDataByQuadrant[entry.quadrant].push(entry);
  });

  // Применяем раскладку для каждого квадранта отдельно
  Object.keys(renderDataByQuadrant).forEach(quadrantId => {
    const quadrantData = renderDataByQuadrant[quadrantId];
    applyNonOverlappingLayout(quadrantData);
    avoidRingLabelOverlap(quadrantData);
  });

  // Создаём blip'ы в SVG для каждого квадранта
  renderData.forEach((entry) => {
    console.debug('renderRadar: rendering blip', {
      id: entry.id,
      name: entry.name,
      quadrant: entry.quadrant,
      ring: entry.ring,
      x: entry.x,
      y: entry.y
    });
    createBlip(entry, { x: entry.x, y: entry.y }, entry.quadrant);
  });

  // Пометить пустые квадранты в DOM и в сайдбаре
  // Проверяем наличие blip'ов в каждом квадранте
  QUADRANTS.forEach(q => {
    const has = renderData.some(t => t.quadrant === q.id);
    const g = svg.querySelector(`.quadrant-group.q${q.id}`);
    if (g) {
      g.classList.toggle('empty', !has);
    }
    const sidebarItem = document.querySelector(`.sector-item[data-quadrant="${q.id}"]`);
    if (sidebarItem) sidebarItem.classList.toggle('empty', !has);
  });

  attachBlipHoverHandlers();
  // Выделяем все blip'ы выбранной технологии (если их несколько в разных секторах)
  if (selectedBlipId != null) {
    svg.querySelectorAll(`.blip[data-id="${selectedBlipId}"]`).forEach(blipEl => {
      blipEl.classList.add('selected');
    });
  }
}

// Ensure fields, compute coordinates and persist enterpriseData for a newly added tech
function ensureAndPersistNewTech(newTech) {
  try {
    if (!newTech) return;
    // Trim block and level
    if (newTech.block && typeof newTech.block === 'string') newTech.block = newTech.block.trim();
    if (newTech.level && typeof newTech.level === 'string') newTech.level = newTech.level.trim();
    if (!newTech.level) newTech.level = 'Существующие';
    // Ensure mapping exists
    const bk = (newTech.blocks && newTech.blocks.length) ? (typeof newTech.blocks[0] === 'string' ? newTech.blocks[0].trim() : newTech.blocks[0]) : (typeof newTech.block === 'string' ? newTech.block : newTech.block);
    newTech.block = bk;
    if (!blockToQuadrant.hasOwnProperty(bk) || blockToQuadrant[bk] == null) {
      blockToQuadrant[bk] = 1;
      // add to selects
      const sidebarOptionsList = document.querySelector('.custom-select[data-filter="block"] .select-options');
      if (sidebarOptionsList) {
        const li = typeof createCheckboxOptionLi === 'function'
          ? createCheckboxOptionLi(bk, bk)
          : (function () {
              const tmpLi = document.createElement('li');
              tmpLi.classList.add('select-option-item');
              tmpLi.setAttribute('data-value', bk);
              tmpLi.textContent = bk;
              return tmpLi;
            })();
        sidebarOptionsList.appendChild(li);
      }
      document.querySelectorAll('.custom-select-modal[data-field="techBlock"], .custom-select-modal[data-field="editBlock"]').forEach(ms => {
        const opts = ms.querySelector('.select-options');
        if (opts) {
          const li = document.createElement('li');
          li.classList.add('select-option-item');
          li.setAttribute('data-value', bk);
          li.innerHTML = `<label class="option-label"><input type="checkbox" class="option-checkbox" /><span>${bk}</span></label>`;
          opts.appendChild(li);
        }
      });
      if (!blocksList.includes(bk)) blocksList.push(bk);
      try { vfsWrite('bloks.json', blocksList); vfsWrite('blockToQuadrant.json', blockToQuadrant); } catch (e) { console.warn('vfs write failed', e); }
    }
    // Ensure level mapping exists
    if (!levelToRing || !Object.prototype.hasOwnProperty.call(levelToRing, newTech.level)) {
      // fallback to default
      newTech.level = newTech.level || 'Существующие';
      if (!levelToRing[newTech.level]) newTech.level = 'Существующие';
    }

    // Compute coordinates taking into account existing technologies (technologies may include newTech)
    console.debug('ensureAndPersistNewTech: computing coordinates for', { id: newTech.id, block: newTech.block, level: newTech.level });
    computeCoordinates(newTech);
    console.debug('ensureAndPersistNewTech: coords computed', { id: newTech.id, x: newTech.x, y: newTech.y });

    // Ensure technologies array contains the tech (if not, add it)
    const existsIdx = technologies.findIndex(t => t.id === newTech.id);
    if (existsIdx === -1) {
      technologies.push(newTech);
    } else {
      technologies[existsIdx] = Object.assign({}, technologies[existsIdx], newTech);
    }

    // Synchronize enterpriseData for current enterprise before persisting
    try {
      enterpriseData[currentEnterprise] = Array.isArray(enterpriseData[currentEnterprise]) ? [...technologies] : [...technologies];
      vfsWrite('enterpriseData.json', enterpriseData);
      console.debug('ensureAndPersistNewTech: enterpriseData persisted for', currentEnterprise, 'total techs:', technologies.length);
    } catch (e) { console.warn('persist enterpriseData failed', e); }
  } catch (err) { console.warn('ensureAndPersistNewTech error', err); }
}

// Функция для проверки, заполнена ли оценка (вынесена на уровень модуля)
function isRatingFilled(rating) {
  if (rating === undefined || rating === null) return false;
  const str = String(rating).trim();
  return str !== '' && str !== 'null' && str !== 'undefined';
}

// ===== Приоритет технологии на основе TRL / готовностей =====
/**
 * Безопасное приведение значения к числу в диапазоне [min, max].
 */
function clampNumber(value, min, max) {
  const n = Number(value);
  if (Number.isNaN(n)) return min;
  return Math.min(max, Math.max(min, n));
}

/**
 * Получить нормализованные оценки готовности и TRL в интервале [0, 1].
 * Org_n = Org/3, Tech_n = Tech/3, TRL_n = (trlStage-1)/2 при trlStage ∈ {1,2,3}.
 */
function getNormalizedReadinessAndTrl(tech, company = null) {
  // Если указано предприятие и есть индивидуальные оценки, используем их
  let techRead, organRead;
  if (company && tech.companyRatings && typeof tech.companyRatings === 'object' && tech.companyRatings[company]) {
    const ratings = tech.companyRatings[company];
    techRead = clampNumber(ratings.techRead !== undefined ? ratings.techRead : (tech.techRead ?? tech.tech_read), 0, 3);
    organRead = clampNumber(ratings.organRead !== undefined ? ratings.organRead : (tech.organRead ?? tech.organ_read), 0, 3);
  } else {
    // Используем общие оценки
    techRead = clampNumber(tech.techRead ?? tech.tech_read, 0, 3);
    organRead = clampNumber(tech.organRead ?? tech.organ_read, 0, 3);
  }

  // Если trlStage не задан — пробуем вывести его из статуса, иначе считаем TRL неизвестным.
  // TRL остается общим для всех предприятий
  let trlStage = tech.trlStage;
  if (trlStage === undefined || trlStage === null) {
    const status = (tech.status || tech.level || '').toString().toLowerCase();
    if (!status) {
      trlStage = null;
    } else if (status.includes('перспектив')) {
      trlStage = 1;
    } else if (status.includes('внедряем')) {
      trlStage = 2;
    } else {
      // Используемые / Существующие и любые «боевые» статусы
      trlStage = 3;
    }
  }
  const trlNum = trlStage == null ? null : clampNumber(trlStage, 1, 3);

  const orgN = organRead / 3;
  const techN = techRead / 3;
  const trlN = trlNum == null ? null : (trlNum - 1) / 2;

  return { orgN, techN, trlN, techRead, organRead, trlStage: trlNum };
}

/**
 * Вычисление приоритета технологии в диапазоне [0,1].
 * model:
 *  - 'avg'  – среднее трёх нормализованных показателей;
 *  - 'min'  – «слабое звено», минимум из трёх;
 *  - 'mult' – мультипликативная модель (по умолчанию).
 * company - опциональный параметр для указания предприятия (для использования индивидуальных оценок)
 * Если каких‑то данных нет (особенно TRL), функция возвращает null.
 */
function computePriority(tech, model = 'mult', company = null) {
  // Если не указано предприятие, но есть текущее предприятие и технология с несколькими предприятиями, используем его
  if (!company && typeof currentEnterprise !== 'undefined' && currentEnterprise &&
      Array.isArray(tech.company) && tech.company.includes(currentEnterprise)) {
    company = currentEnterprise;
  }

  const { orgN, techN, trlN } = getNormalizedReadinessAndTrl(tech, company);
  if (trlN == null || Number.isNaN(orgN) || Number.isNaN(techN)) return null;

  switch (model) {
    case 'avg':
      return (orgN + techN + trlN) / 3;
    case 'min':
      return Math.min(orgN, techN, trlN);
    case 'mult':
    default:
      return orgN * techN * trlN;
  }
}

/**
 * Категория приоритета по порогам:
 * 0–0.3  → low
 * 0.3–0.6 → medium
 * 0.6–1.0 → high
 */
function getPriorityCategory(priority) {
  if (priority == null || Number.isNaN(priority)) {
    return { key: 'none', label: 'нет данных', description: 'Недостаточно данных для расчёта приоритета.' };
  }
  const p = Math.max(0, Math.min(1, Number(priority)));
  if (p < 0.3) {
    return {
      key: 'low',
      label: 'низкий',
      description: 'Низкий приоритет: технологию можно отложить и наблюдать за развитием.'
    };
  }
  if (p < 0.6) {
    return {
      key: 'medium',
      label: 'средний',
      description: 'Средний приоритет: уместны пилоты и проработка бизнес‑кейсов.'
    };
  }
  return {
    key: 'high',
    label: 'высокий',
    description: 'Высокий приоритет: стоит активно искать кейсы внедрения и масштабирования.'
  };
}

/**
 * Определение «слабого звена» для комментария.
 */
function getPriorityWeakLinkComment(tech, company = null) {
  // Если не указано предприятие, но есть текущее предприятие и технология с несколькими предприятиями, используем его
  if (!company && typeof currentEnterprise !== 'undefined' && currentEnterprise &&
      Array.isArray(tech.company) && tech.company.includes(currentEnterprise)) {
    company = currentEnterprise;
  }

  const { orgN, techN, trlN, techRead, organRead, trlStage } = getNormalizedReadinessAndTrl(tech, company);
  if (trlN == null) {
    return 'Заполните TRL для более точной оценки приоритета.';
  }
  const values = [
    { key: 'org', v: orgN, raw: organRead, label: 'организационная готовность' },
    { key: 'tech', v: techN, raw: techRead, label: 'технологическая готовность' },
    { key: 'trl', v: trlN, raw: trlStage, label: 'TRL' }
  ];
  values.sort((a, b) => a.v - b.v);
  const weakest = values[0];

  if (weakest.key === 'org') {
    return 'Слабое звено: организационная готовность — нужна подготовка процессов и команды.';
  }
  if (weakest.key === 'tech') {
    return 'Слабое звено: технологическая готовность — важно доработать прототипы и архитектуру.';
  }
  return 'Слабое звено: стадия TRL — технология ещё на ранней исследовательской стадии.';
}

function createBlip(tech, pos, quadrant = null) {
  // Используем переданный квадрант или квадрант из tech.quadrant
  const targetQuadrant = quadrant !== null ? quadrant : tech.quadrant;
  const g = svg.querySelector(`.quadrant-group.q${targetQuadrant}`);
  if (!g) return;
  const size = 10;
  let el;
  const shape = computeShapeByTechType(tech.techType) || tech.shape || 'circle';
  // debug attribute
  const dataShape = shape;
  // Вспомогательная генерация звезды
  const starPath = (cx, cy, outerR, innerR, points = 5) => {
    const step = Math.PI / points;
    let d = '';
    for (let i = 0; i < 2 * points; i++) {
      const r = i % 2 === 0 ? outerR : innerR;
      const a = -Math.PI / 2 + i * step;
      const x = cx + r * Math.cos(a);
      const y = cy + r * Math.sin(a);
      d += (i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`);
    }
    return d + ' Z';
  };

  if (shape === "circle") {
    el = document.createElementNS(SVG_NS, "circle");
    el.setAttribute("cx", pos.x);
    el.setAttribute("cy", pos.y);
    el.setAttribute("r", size);
  } else if (shape === "square") {
    el = document.createElementNS(SVG_NS, "rect");
    el.setAttribute("x", pos.x - size);
    el.setAttribute("y", pos.y - size);
    el.setAttribute("width", size * 2);
    el.setAttribute("height", size * 2);
  } else if (shape === "triangle") {
    el = document.createElementNS(SVG_NS, "path");
    el.setAttribute("d", `M ${pos.x} ${pos.y - size} L ${pos.x + size} ${pos.y + size} L ${pos.x - size} ${pos.y + size} Z`);
  } else if (shape === "star") {
    el = document.createElementNS(SVG_NS, "path");
    const outer = Math.round(size * 1.3);
    const inner = Math.round(size * 0.58);
    el.setAttribute("d", starPath(pos.x, pos.y, outer, inner, 5));
  }
  // Если не создали элемент предыдущей логикой (т.к. tech.type не соответствует), создадим на основании shape
  if (!el) {
    if (dataShape === 'circle') {
      el = document.createElementNS(SVG_NS, "circle");
      el.setAttribute("cx", pos.x);
      el.setAttribute("cy", pos.y);
      el.setAttribute("r", size);
    } else if (dataShape === 'triangle') {
      el = document.createElementNS(SVG_NS, "path");
      el.setAttribute("d", `M ${pos.x} ${pos.y - size} L ${pos.x + size} ${pos.y + size} L ${pos.x - size} ${pos.y + size} Z`);
    } else if (dataShape === 'star') {
      el = document.createElementNS(SVG_NS, "path");
      el.setAttribute("d", starPath(pos.x, pos.y, size, Math.round(size * 0.5), 5));
    } else {
      el = document.createElementNS(SVG_NS, "rect");
      el.setAttribute("x", pos.x - size);
      el.setAttribute("y", pos.y - size);
      el.setAttribute("width", size * 2);
      el.setAttribute("height", size * 2);
    }
  }
  el.classList.add("blip");
  el.dataset.id = tech.id;
  el.dataset.shape = dataShape;
  el.dataset.quadrant = targetQuadrant; // Сохраняем квадрант в dataset
  // Добавим класс формы для стилизации
  el.classList.add(`blip--${dataShape}`);
  g.appendChild(el);

  // Проверяем наличие оценок и добавляем иконку предупреждения, если они отсутствуют
  // Проверяем оценки для текущего предприятия, если есть индивидуальные оценки
  const companies = Array.isArray(tech.company) ? tech.company : (tech.company ? [tech.company] : []);
  let techRead, organRead, funcCover;

  // Если есть несколько предприятий и индивидуальные оценки для текущего предприятия, используем их
  if (companies.length > 1 && tech.companyRatings && typeof tech.companyRatings === 'object' &&
      currentEnterprise && companies.includes(currentEnterprise) && tech.companyRatings[currentEnterprise]) {
    const ratings = tech.companyRatings[currentEnterprise];
    techRead = ratings.techRead !== undefined ? ratings.techRead : tech.techRead;
    organRead = ratings.organRead !== undefined ? ratings.organRead : tech.organRead;
    funcCover = ratings.funcCover !== undefined ? ratings.funcCover : tech.funcCover;
  } else {
    // Используем общие оценки
    techRead = tech.techRead;
    organRead = tech.organRead;
    funcCover = tech.funcCover;
  }

  // Иконка предупреждения появляется, если ВСЕ три оценки отсутствуют
  const hasRatings = isRatingFilled(techRead) || isRatingFilled(organRead) || isRatingFilled(funcCover);

  // Проверяем, заполнены ли технологическая и организационная готовность
  const techReadFilled = isRatingFilled(techRead);
  const organReadFilled = isRatingFilled(organRead);
  const hasReadinessRatings = techReadFilled && organReadFilled;

  // Добавляем класс для подсветки, если не заполнены techRead или organRead
  if (!hasReadinessRatings) {
    el.classList.add('blip-incomplete');
  }

  if (!hasRatings) {
    // Создаем группу для иконки предупреждения
    const warningGroup = document.createElementNS(SVG_NS, "g");
    warningGroup.classList.add("blip-warning");
    warningGroup.setAttribute("transform", `translate(${pos.x + size + 3}, ${pos.y - size - 3})`);

    // Создаем круг-фон для иконки
    const bgCircle = document.createElementNS(SVG_NS, "circle");
    bgCircle.setAttribute("cx", "0");
    bgCircle.setAttribute("cy", "0");
    bgCircle.setAttribute("r", "6");
    bgCircle.setAttribute("fill", "#ff9800");
    bgCircle.setAttribute("stroke", "#fff");
    bgCircle.setAttribute("stroke-width", "1");
    warningGroup.appendChild(bgCircle);

    // Создаем иконку восклицательного знака
    const exclamation = document.createElementNS(SVG_NS, "text");
    exclamation.setAttribute("x", "0");
    exclamation.setAttribute("y", "0");
    exclamation.setAttribute("text-anchor", "middle");
    exclamation.setAttribute("dominant-baseline", "middle");
    exclamation.setAttribute("fill", "#fff");
    exclamation.setAttribute("font-size", "8");
    exclamation.setAttribute("font-weight", "bold");
    exclamation.textContent = "!";
    warningGroup.appendChild(exclamation);

    // Добавляем title для подсказки
    const title = document.createElementNS(SVG_NS, "title");
    title.textContent = "Заполните поля оценок";
    warningGroup.appendChild(title);

    g.appendChild(warningGroup);
  }

  // Надёжный обработчик клика прямо на blip — вызывает показ панели подробностей
  el.addEventListener('click', (e) => {
    e.stopPropagation();
    try {
      const id = +el.dataset.id;
      const blipQuadrant = el.dataset.quadrant ? +el.dataset.quadrant : null;
      const t = technologies.find(tt => tt.id === id);
      if (t) {
        // Источник — клик по blip на радаре, передаем квадрант blip'а
        showDetail(t, 'blip', blipQuadrant);
      }
    } catch (err) {
      console.warn('Ошибка при обработке клика на blip:', err);
    }
  });
}

// Показ панели подробной информации для заданной технологии
// source:
//  - 'priority'  → открыто из панели приоритетов сектора
//  - 'blip'      → клик по точке на радаре
//  - другие/по умолчанию → из списка, формы и т.п.
// sourceQuadrant: опциональный квадрант, в котором был клик (для зума в правильный сектор)
function showDetail(t, source = 'unknown', sourceQuadrant = null) {
  if (!t) return;

  // Если сектор зуммирован и был совершен клик по blip на радаре при открытом модальном окне приоритетных технологий,
  // то модальное окно приоритетных технологий скрывается, чтобы панель детальной информации не открывалась под ним
  if (source === 'blip' &&
      currentZoomedQuadrant != null &&
      quadrantPriorityPanel &&
      quadrantPriorityPanel.classList.contains('open')) {
    closeQuadrantPriorityPanel();
  }

  currentTech = t;
  selectedBlipId = t.id;
  // Снять выделение со всех других blip
  svg.querySelectorAll('.blip.selected').forEach(el => el.classList.remove('selected'));

  // Всегда выделяем ВСЕ blip'ы этой технологии (подсветка и пульсация на всех экземплярах)
  // Квадрант используется только для зума, но подсветка должна быть везде
  svg.querySelectorAll(`.blip[data-id="${t.id}"]`).forEach(blipEl => {
    blipEl.classList.add('selected');
  });

  if (detailPanel) {
    console.debug('showDetail: показываем детали для', { id: t.id, name: t.name, data: t });

    detailPanel.querySelector('#panelTitle').textContent = t.name || 'Без названия';

    // Теги предприятий (company)
    const companyWrap = detailPanel.querySelector('#panelCompanyTags');
    if (companyWrap) {
      const companies = Array.isArray(t.company) ? t.company : (t.company ? [t.company] : []);
      companyWrap.innerHTML = companies.length
        ? companies.map(c => `<span class="multi-tag">${c}</span>`).join(' ')
        : '<span style="opacity:0.7">Не указано</span>';
    }

    // Теги блоков
    const blockWrap = detailPanel.querySelector('#panelBlock');
    const blocksArr = Array.isArray(t.blocks) && t.blocks.length ? t.blocks : (t.block ? [t.block] : []);
    const blockText = blocksArr.length ? blocksArr.join(', ') : 'Не указано';
    if (blockWrap) {
      blockWrap.innerHTML = blocksArr.length
        ? blocksArr.map(b => `<span class="multi-tag">${b}</span>`).join(' ')
        : '<span style="opacity:0.7">Не указано</span>';
    }

    // Теги функций
    const funcWrap = detailPanel.querySelector('#panelFunction');
    const functionsArr = Array.isArray(t.functions) && t.functions.length ? t.functions : (t.func ? [t.func] : []);
    const funcText = functionsArr.length ? functionsArr.join(', ') : 'Не указано';
    if (funcWrap) {
      funcWrap.innerHTML = functionsArr.length
        ? functionsArr.map(f => `<span class="multi-tag">${f}</span>`).join(' ')
        : '<span style="opacity:0.7">Не указано</span>';
    }

    const techTypeText = t.techType || 'Не указано';
    const descText = t.description || 'Описание отсутствует';

    detailPanel.querySelector('#panelTechType').textContent = techTypeText;
    detailPanel.querySelector('#panelDescription').textContent = descText;

    // Оценки 0-3
    const techReadEl = detailPanel.querySelector('#panelTechRead');
    const organReadEl = detailPanel.querySelector('#panelOrganRead');
    const funcCoverEl = detailPanel.querySelector('#panelFuncCover');

    // Проверяем, есть ли индивидуальные оценки по предприятиям
    const companies = Array.isArray(t.company) ? t.company : (t.company ? [t.company] : []);
    if (companies.length > 1 && t.companyRatings && typeof t.companyRatings === 'object') {
      // Несколько предприятий с индивидуальными оценками - показываем для текущего предприятия или все
      if (currentEnterprise && companies.includes(currentEnterprise) && t.companyRatings[currentEnterprise]) {
        const ratings = t.companyRatings[currentEnterprise];
        if (techReadEl) techReadEl.textContent = (ratings.techRead !== undefined && ratings.techRead !== null && ratings.techRead !== '') ? String(ratings.techRead) : '—';
        if (organReadEl) organReadEl.textContent = (ratings.organRead !== undefined && ratings.organRead !== null && ratings.organRead !== '') ? String(ratings.organRead) : '—';
      } else {
        // Показываем общие значения или значения первого предприятия
        const firstCompany = companies[0];
        const ratings = t.companyRatings[firstCompany] || {};
        if (techReadEl) techReadEl.textContent = (ratings.techRead !== undefined && ratings.techRead !== null && ratings.techRead !== '') ? String(ratings.techRead) : ((t.techRead ?? '') !== '' ? String(t.techRead) : '—');
        if (organReadEl) organReadEl.textContent = (ratings.organRead !== undefined && ratings.organRead !== null && ratings.organRead !== '') ? String(ratings.organRead) : ((t.organRead ?? '') !== '' ? String(t.organRead) : '—');
      }
    } else {
      // Одно предприятие или нет индивидуальных оценок - показываем общие значения
      if (techReadEl) techReadEl.textContent = (t.techRead ?? '') !== '' ? String(t.techRead) : '—';
      if (organReadEl) organReadEl.textContent = (t.organRead ?? '') !== '' ? String(t.organRead) : '—';
    }

    // Отображаем funcCover с учетом индивидуальных оценок
    if (funcCoverEl) {
      if (companies.length > 1 && t.companyRatings && typeof t.companyRatings === 'object') {
        if (currentEnterprise && companies.includes(currentEnterprise) && t.companyRatings[currentEnterprise]) {
          const ratings = t.companyRatings[currentEnterprise];
          funcCoverEl.textContent = (ratings.funcCover !== undefined && ratings.funcCover !== null && ratings.funcCover !== '') ? String(ratings.funcCover) : '—';
        } else {
          // Показываем общие значения или значения первого предприятия
          const firstCompany = companies[0];
          const ratings = t.companyRatings[firstCompany] || {};
          funcCoverEl.textContent = (ratings.funcCover !== undefined && ratings.funcCover !== null && ratings.funcCover !== '') ? String(ratings.funcCover) : ((t.funcCover ?? '') !== '' ? String(t.funcCover) : '—');
        }
      } else {
        funcCoverEl.textContent = (t.funcCover ?? '') !== '' ? String(t.funcCover) : '—';
      }
    }

    // Проверяем заполненность оценок и подсвечиваем кнопку/блок оценок при их отсутствии
    // Для технологий с несколькими предприятиями проверяем оценки текущего предприятия
    let techReadFilled = false;
    let organReadFilled = false;
    if (companies.length > 1 && t.companyRatings && typeof t.companyRatings === 'object') {
      if (currentEnterprise && companies.includes(currentEnterprise) && t.companyRatings[currentEnterprise]) {
        const ratings = t.companyRatings[currentEnterprise];
        techReadFilled = isRatingFilled(ratings.techRead);
        organReadFilled = isRatingFilled(ratings.organRead);
      } else {
        // Используем общие значения
        techReadFilled = isRatingFilled(t.techRead);
        organReadFilled = isRatingFilled(t.organRead);
      }
    } else {
      techReadFilled = isRatingFilled(t.techRead);
      organReadFilled = isRatingFilled(t.organRead);
    }
    const hasReadinessRatings = techReadFilled && organReadFilled;

    const editBtn = detailPanel.querySelector('#editTechBtn');
    const ratingsSection = detailPanel.querySelector('#panelRatingsSection');
    const ratingsHint = detailPanel.querySelector('#panelRatingsHint');

    if (!hasReadinessRatings) {
      if (editBtn) editBtn.classList.add('highlight-missing-ratings');
      if (ratingsSection) ratingsSection.classList.add('highlight-missing-ratings');
      if (ratingsHint) {
        ratingsHint.textContent = 'Заполните поля оценок';
        ratingsHint.style.display = 'block';
      }
    } else {
      if (editBtn) editBtn.classList.remove('highlight-missing-ratings');
      if (ratingsSection) ratingsSection.classList.remove('highlight-missing-ratings');
      if (ratingsHint) {
        ratingsHint.textContent = '';
        ratingsHint.style.display = 'none';
      }
    }

    // Приоритет технологии (0–1 → 0–100%)
    const prioritySection = detailPanel.querySelector('#panelPrioritySection');
    const priorityValueEl = detailPanel.querySelector('#panelPriorityValue');
    const priorityCommentEl = detailPanel.querySelector('#panelPriorityComment');
    if (prioritySection && priorityValueEl && priorityCommentEl) {
      // Используем текущее предприятие для вычисления приоритета, если технология с несколькими предприятиями
      const companies = Array.isArray(t.company) ? t.company : (t.company ? [t.company] : []);
      const companyForPriority = (companies.length > 1 && currentEnterprise && companies.includes(currentEnterprise)) ? currentEnterprise : null;
      const priority = computePriority(t, 'mult', companyForPriority);
      const category = getPriorityCategory(priority);

      prioritySection.classList.remove('priority-low', 'priority-medium', 'priority-high', 'priority-none');

      if (priority == null || category.key === 'none') {
        priorityValueEl.textContent = 'Приоритет: —';
        priorityCommentEl.textContent = category.description;
        prioritySection.classList.add('priority-none');
      } else {
        const percent = Math.round(priority * 100);
        priorityValueEl.textContent = `Приоритет: ${percent}% (${category.label})`;
        priorityCommentEl.textContent = getPriorityWeakLinkComment(t, companyForPriority);
        if (category.key === 'low') prioritySection.classList.add('priority-low');
        else if (category.key === 'medium') prioritySection.classList.add('priority-medium');
        else if (category.key === 'high') prioritySection.classList.add('priority-high');
      }
    }

    // Пример внедрения
    const exampleEl = detailPanel.querySelector('#panelExampleDesc');
    if (exampleEl) exampleEl.textContent = t.exampleDesc || '—';

    // Управление кнопкой «Назад к списку технологий» в шапке панели:
    // показываем её только если панель открыта из списка приоритетов сектора
    const backBtn = detailPanel.querySelector('#detailBackFromPriorityBtn');
    if (backBtn) {
      if (source === 'priority') {
        backBtn.style.display = 'inline-flex';
        backBtn.setAttribute('aria-hidden', 'false');
      } else {
        backBtn.style.display = 'none';
        backBtn.setAttribute('aria-hidden', 'true');
      }
    }

    // Добавляем дополнительный вывод для отладки
    console.debug('Отображаемые значения:', {
      block: blockText,
      function: funcText,
      techType: techTypeText,
      source,
    });

    detailPanel.style.display = 'block';
    detailPanel.classList.add('active');
  } else {
    console.warn('showDetail: detailPanel не найден');
  }

  // Определяем квадрант для отображения: используем переданный квадрант или вычисляем из первого блока
  // Если источник - 'priority', используем текущий зуммированный квадрант, если он есть
  const q = sourceQuadrant != null
    ? sourceQuadrant
    : (source === 'priority' && currentZoomedQuadrant != null)
      ? currentZoomedQuadrant
      : (() => {
          const blockKey = (t.blocks && t.blocks.length) ? t.blocks[0] : t.block;
          return getQuadrantIdForBlock(blockKey);
        })();

  // Попытаемся найти и выделить соответствующий сектор в сайдбаре
  // Индикаторы зрелости заменены на оценки (techRead, organRead, funcCover) и выводятся выше
  if (q != null) {
    try {
      const sectorItem = document.querySelector(`.sector-item[data-quadrant="${q}"]`);
      if (sectorItem) {
        // Если сектор пустой — не подсвечиваем, показываем уведомление
        const gEl = document.querySelector(`.quadrant-group.q${q}`);
        if (gEl && gEl.classList.contains('empty')) {
          showNotification('На данный момент в данном секторе отсутствуют технологии, но мы активно работаем над внедрением новых технологий.', false);
        } else {
          document.querySelectorAll('.sector-item').forEach(i => i.classList.remove('active'));
          sectorItem.classList.add('active');
          try {
            const existing = sectorItem.nextElementSibling;
            if (existing && existing.classList.contains('tech-list')) {
              const listItem = existing.querySelector(`.tech-list-item[data-tech-id="${t.id}"]`);
              if (listItem) {
                existing.querySelectorAll('.tech-list-item').forEach(li => li.classList.remove('selected'));
                listItem.classList.add('selected');
                listItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
              }
            } else {
              // Создаём список технологий в секторе
              document.querySelectorAll('.tech-list').forEach(tl => tl.parentNode?.removeChild(tl));
              createTechListForSector(sectorItem, q, technologies);
              const newList = sectorItem.nextElementSibling;
              if (newList && newList.classList.contains('tech-list')) {
                const listItem = newList.querySelector(`.tech-list-item[data-tech-id="${t.id}"]`);
                if (listItem) {
                  newList.querySelectorAll('.tech-list-item').forEach(li => li.classList.remove('selected'));
                  listItem.classList.add('selected');
                  listItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                }
              }
            }
          } catch (errInner) {
            console.warn('showDetail: не удалось раскрыть список сектора:', errInner);
          }
        }
      }
    } catch (err) {
      console.warn('showDetail: Не удалось открыть сектор в сайдбаре:', err);
    }
  }

  // Выполним зум в квадрант, из которого был клик (или в первый доступный)
  // Если источник - 'priority' и сектор уже зуммирован, не применяем зум повторно
  if (q != null) {
    if (source === 'priority' && currentZoomedQuadrant === q) {
      // Сектор уже зуммирован, просто убедимся, что он правильно отображается
      const g = document.querySelector(`.quadrant-group.q${q}`);
      if (g && !g.classList.contains('zoomed-in')) {
        zoomQuadrant(q, { source: 'priority' });
      }
    } else {
      zoomQuadrant(q, { source: source === 'priority' ? 'priority' : 'blip' });
    }
  }
}

// ===== ФИЛЬТРАЦИЯ =====
// Вспомогательная функция для получения значений фильтра (массив для множественного выбора)
function getFilterValues(key) {
  const select = document.querySelector(`.custom-select[data-filter="${key}"]`);
  if (!select) return [];
  const hiddenInput = document.getElementById(`filter_${key}`);
  if (hiddenInput && hiddenInput.value) {
    try {
      const parsed = JSON.parse(hiddenInput.value);
      if (Array.isArray(parsed)) return parsed;
    } catch (e) {
      // Если не JSON, проверяем data-value
    }
  }
  // Fallback: читаем из data-value или из выбранных li
  const dataValue = select.getAttribute('data-value') || '';
  if (dataValue && dataValue.trim().startsWith('[')) {
    try {
      const parsed = JSON.parse(dataValue);
      if (Array.isArray(parsed)) return parsed;
    } catch (e) {
      // Игнорируем ошибки парсинга
    }
  }
  // Читаем из выбранных элементов списка
  const selected = Array.from(select.querySelectorAll('.select-options li.selected'))
    .map(li => li.getAttribute('data-value'))
    .filter(v => v && v.length > 0);
  if (selected.length > 0) return selected;
  // Если ничего не выбрано, возвращаем пустой массив
  return [];
}

function updateRadar() {
  const b = getFilterValues('block');
  const f = getFilterValues('function');
  const tt = getFilterValues('techType');
  const l = getFilterValues('level');
  const q = (searchInput.value || '').toLowerCase().trim();

  let filtered = technologies.filter((t) => {
    // Проверяем блок (может быть в t.block или t.blocks)
    if (b.length > 0) {
      const techBlocks = t.blocks && Array.isArray(t.blocks) ? t.blocks : (t.block ? [t.block] : []);
      if (!techBlocks.some(block => b.includes(block))) return false;
    }
    // Проверяем функцию (может быть в t.func или t.functions)
    if (f.length > 0) {
      const techFunctions = t.functions && Array.isArray(t.functions) ? t.functions : (t.func ? [t.func] : []);
      if (!techFunctions.some(func => f.includes(func))) return false;
    }
    // Проверяем тип технологии
    if (tt.length > 0 && !tt.includes(t.techType)) return false;
    // Проверяем статус
    if (l.length > 0 && !l.includes(t.level)) return false;
    return true;
  });

  // Применяем текстовый поиск поверх фильтров
  if (q) {
    filtered = filtered.filter(t => {
      const fields = [
        String(t.name || ''),
        String(t.description || ''),
        String(t.block || ''),
        ...(t.blocks || []),
        String(t.func || ''),
        ...(t.functions || []),
        String(t.techType || ''),
        String(t.level || ''),
        String(t.id || '')
      ];
      return fields.some(fld => fld.toLowerCase().includes(q));
    });
  }

  renderRadar(filtered);

  // 🔥 Обновляем сайдбар ТОЛЬКО если есть активный поиск или фильтры
  const hasActiveFilter = b.length > 0 || f.length > 0 || tt.length > 0 || l.length > 0 || q;
  if (hasActiveFilter) {
    updateSidebarLists(filtered);
  } else {
    // Сбрасываем сайдбар: скрываем все списки
    document.querySelectorAll('.tech-list').forEach(el => {
      el.classList.remove('open');
      setTimeout(() => el.remove(), 260);
    });
    document.querySelectorAll('.sector-item').forEach(el => {
      el.classList.remove('active');
    });
  }

  // Если открыт модал приоритета сектора и есть зуммированный сектор,
  // обновляем список технологий в панели с учётом текущих фильтров
  if (quadrantPriorityPanel &&
      quadrantPriorityPanel.classList.contains('open') &&
      currentZoomedQuadrant != null) {
    recomputeQuadrantPriorityList(currentZoomedQuadrant);
  }
}
function updateSidebarLists(filteredTechs) {
  // Группируем технологии по квадрантам
  // Технология может попасть в несколько квадрантов, если она имеет блоки в разных секторах
  const techsByQuadrant = {};
  filteredTechs.forEach(t => {
    const techQuadrants = getAllQuadrantsForTech(t);
    techQuadrants.forEach(qId => {
      if (qId == null) return;
      if (!techsByQuadrant[qId]) techsByQuadrant[qId] = [];
      techsByQuadrant[qId].push(t);
    });
  });

  QUADRANTS.forEach(q => {
    const sectorItem = document.querySelector(`.sector-item[data-quadrant="${q.id}"]`);
    if (!sectorItem) return;

    const hasMatches = techsByQuadrant[q.id]?.length > 0;
    const existingList = sectorItem.nextElementSibling;

    // Скрыть список, если нет совпадений
    if (!hasMatches) {
      if (existingList && existingList.classList.contains('tech-list')) {
        existingList.classList.remove('open');
        setTimeout(() => existingList.remove(), 260);
      }
      return;
    }

    // Есть совпадения → создать или обновить список
    if (!existingList || !existingList.classList.contains('tech-list')) {
      createTechListForSector(sectorItem, q.id, filteredTechs);
      sectorItem.classList.add('active');
    } else {
      updateTechListItems(q.id, techsByQuadrant[q.id]);
    }
  });
}
function createTechListForSector(sectorItem, quadrantId, allTechnologies) {
  // Удаляем старый список, если есть
  const oldList = sectorItem.nextElementSibling;
  if (oldList && oldList.classList.contains('tech-list')) {
    oldList.remove();
  }

  const list = document.createElement('div');
  list.className = 'tech-list';
  // Проверяем все квадранты технологии, а не только первый блок
  const techs = allTechnologies.filter(t => {
    const techQuadrants = getAllQuadrantsForTech(t);
    return techQuadrants.includes(quadrantId);
  });
  techs.forEach(t => {
    const ti = document.createElement('div');
    ti.className = 'tech-list-item';
    ti.dataset.techId = t.id;
    ti.textContent = t.name;

    // Hover
    ti.addEventListener('mouseenter', () => {
      const tech = allTechnologies.find(tt => tt.id == t.id);
      if (tech) {
        const blip = svg.querySelector(`.blip[data-id="${t.id}"]`);
        if (blip) blip.classList.add('highlighted');
        debouncedHover(tech, true);
        const svgRect = svg.getBoundingClientRect();
        const bRect = blip.getBoundingClientRect();
        hoverLabel.style.left = `${bRect.left + bRect.width/2 - svgRect.left}px`;
        hoverLabel.style.top = `${bRect.top + bRect.height/2 - svgRect.top}px`;
      }
    });
    ti.addEventListener('mouseleave', () => {
      debouncedHover(null, false);
      svg.querySelectorAll('.blip').forEach(el => el.classList.remove('highlighted'));
    });

    // Click
    ti.addEventListener('click', (e) => {
      e.stopPropagation();
      const blip = svg.querySelector(`.blip[data-id="${t.id}"]`);
      if (blip) {
        blip.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      } else {
        showDetail(t);
      }
      list.querySelectorAll('.tech-list-item').forEach(el => el.classList.remove('selected'));
      ti.classList.add('selected');
      selectedBlipId = t.id;
    });

    list.appendChild(ti);
  });

  sectorItem.parentNode.insertBefore(list, sectorItem.nextSibling);
  requestAnimationFrame(() => list.classList.add('open'));
}

function updateTechListItems(quadrantId, matchedTechs) {
  const list = document.querySelector(`.sector-item[data-quadrant="${quadrantId}"] + .tech-list`);
  if (!list) return;

  const matchedIds = new Set(matchedTechs.map(t => t.id));

  list.querySelectorAll('.tech-list-item').forEach(item => {
    const techId = Number(item.dataset.techId);
    if (matchedIds.has(techId)) {
      item.classList.add('matched');
    } else {
      item.classList.remove('matched');
    }
  });
}

// ===== ПРЕДПРИЯТИЯ =====
function switchEnterprise(enterpriseName) {
  if (!enterpriseData[enterpriseName]) {
    console.error(`Данные для предприятия "${enterpriseName}" не найдены`);
    return;
  }
  currentEnterprise = enterpriseName;
  technologies = [...enterpriseData[enterpriseName]];
  nextId = technologies.length > 0 ? Math.max(...technologies.map((t) => t.id)) + 1 : 1;
  currentTech = null;
  document.querySelectorAll('.custom-select').forEach(select => {
    const filterKey = select.getAttribute('data-filter');
    const hiddenInput = filterKey ? document.getElementById(`filter_${filterKey}`) : null;
    select.setAttribute('data-value', '');
    if (hiddenInput) hiddenInput.value = '';
    const placeholder = select.getAttribute('data-placeholder') || 'Выберите';
    const selectedText = select.querySelector('.selected-text');
    if (selectedText) {
      selectedText.textContent = placeholder;
      selectedText.innerHTML = placeholder; // Очищаем теги
    }
    // Снимаем выделение со всех элементов
    select.querySelectorAll('.select-options li').forEach(li => li.classList.remove('selected'));
  });
  searchInput.value = "";
  document.querySelectorAll(".sector-item").forEach(i => i.classList.remove("active"));
  updateRadar();
  unzoom();
}

// Глобальная переменная для хранения текущего зуммированного квадранта
let currentZoomedQuadrant = null;

// Элементы правой панели приоритета сектора
const quadrantPriorityPanel = document.getElementById('quadrantPriorityPanel');
const qpTitleEl = quadrantPriorityPanel ? quadrantPriorityPanel.querySelector('#qpTitle') : null;
const qpListEl = quadrantPriorityPanel ? quadrantPriorityPanel.querySelector('#qpList') : null;
const qpSearchInput = document.getElementById('qpSearchInput');

function getTechStatus(tech) {
  return (tech.status || tech.level || '').toString();
}

function getQuadrantName(qId) {
  try {
    const q = QUADRANTS.find(q => q.id === qId || q.quadrant === qId);
    return q ? (q.name || q.title || `Сектор ${qId}`) : `Сектор ${qId}`;
  } catch (e) {
    return `Сектор ${qId}`;
  }
}

function getTechnologiesForQuadrant(qId) {
  return technologies.filter(t => {
    // Проверяем все квадранты технологии, а не только первый блок
    const techQuadrants = getAllQuadrantsForTech(t);
    return techQuadrants.includes(qId);
  });
}

function recomputeQuadrantPriorityList(qId) {
  if (!quadrantPriorityPanel || !qpListEl) return;

  const allTechs = getTechnologiesForQuadrant(qId);
  if (!allTechs.length) {
    qpListEl.innerHTML = '<p style="font-size:12px; opacity:0.8;">В этом секторе пока нет технологий.</p>';
    return;
  }

  // Учитываем фильтры из левой панели и строку поиска
  const b = getFilterValues('block');
  const f = getFilterValues('function');
  const tt = getFilterValues('techType');
  const l = getFilterValues('level');
  // Поиск: используем поле поиска в панели приоритетов (qpSearchInput) или основной поиск (searchInput)
  const qpQuery = (qpSearchInput && qpSearchInput.value ? qpSearchInput.value : '').toLowerCase().trim();
  const sidebarQuery = (searchInput && searchInput.value ? searchInput.value : '').toLowerCase().trim();
  const textQuery = qpQuery || sidebarQuery;

  let sidebarFilteredTechs = allTechs.filter(t => {
    // Фильтр по блокам (t.block или t.blocks)
    if (b.length > 0) {
      const techBlocks = t.blocks && Array.isArray(t.blocks) ? t.blocks : (t.block ? [t.block] : []);
      if (!techBlocks.some(block => b.includes(block))) return false;
    }
    // Фильтр по функциям (t.func или t.functions)
    if (f.length > 0) {
      const techFunctions = t.functions && Array.isArray(t.functions) ? t.functions : (t.func ? [t.func] : []);
      if (!techFunctions.some(func => f.includes(func))) return false;
    }
    // Фильтр по типу технологии
    if (tt.length > 0 && !tt.includes(t.techType)) return false;
    // Фильтр по статусу/уровню
    if (l.length > 0 && !l.includes(t.level)) return false;
    return true;
  });

  // Текстовый поиск
  if (textQuery) {
    sidebarFilteredTechs = sidebarFilteredTechs.filter(t => {
      const fields = [
        String(t.name || ''),
        String(t.description || ''),
        String(t.block || ''),
        ...(t.blocks || []),
        String(t.func || ''),
        ...(t.functions || []),
        String(t.techType || ''),
        String(t.level || ''),
        String(t.id || '')
      ];
      return fields.some(fld => fld.toLowerCase().includes(textQuery));
    });
  }

  if (!sidebarFilteredTechs.length) {
    qpListEl.innerHTML = '<p style="font-size:12px; opacity:0.8;">В этом секторе нет технологий, соответствующих текущим фильтрам.</p>';
    qpSummaryEl.textContent = '';
    return;
  }

  // Фильтрация по статусам на панели
  // Сначала синхронизируем кнопки статусов с фильтром "Статус" в левой панели
  const sidebarLevels = getFilterValues('level');
  const statusButtons = Array.from(quadrantPriorityPanel.querySelectorAll('.qp-filter-btn'));

  if (sidebarLevels && sidebarLevels.length > 0) {
    statusButtons.forEach(btn => {
      const st = btn.getAttribute('data-status');
      if (!st) return;
      // В модалке подсвечиваем только те статусы, которые выбраны в фильтре слева
      btn.classList.toggle('active', sidebarLevels.includes(st));
    });
  } else if (!statusButtons.some(btn => btn.classList.contains('active'))) {
    // Если в фильтре слева статусы не заданы и в модалке ничего не активно —
    // по умолчанию считаем все статусы активными
    statusButtons.forEach(btn => btn.classList.add('active'));
  }

  const activeStatuses = statusButtons
    .filter(btn => btn.classList.contains('active'))
    .map(btn => btn.getAttribute('data-status'));

  const filteredTechs = sidebarFilteredTechs.filter(t => {
    const st = getTechStatus(t);
    if (!activeStatuses.length) return true;
    return activeStatuses.some(s => st.includes(s));
  });

  // Строим список технологий с приоритетами
  qpListEl.innerHTML = '';

  const stats = { low: 0, medium: 0, high: 0, all: 0, sumPriority: 0 };

  filteredTechs.forEach(t => {
    const priority = computePriority(t, 'mult');
    const category = getPriorityCategory(priority);
    const percent = priority == null ? null : Math.round(priority * 100);

    if (priority != null && !Number.isNaN(priority)) {
      stats.all += 1;
      stats.sumPriority += priority;
      if (category.key === 'low') stats.low += 1;
      else if (category.key === 'medium') stats.medium += 1;
      else if (category.key === 'high') stats.high += 1;
    }

    const item = document.createElement('div');
    item.className = 'qp-item';
    item.dataset.techId = t.id;

    if (category.key === 'low') item.classList.add('priority-low');
    else if (category.key === 'medium') item.classList.add('priority-medium');
    else if (category.key === 'high') item.classList.add('priority-high');

    const titleEl = document.createElement('div');
    titleEl.className = 'qp-item-title';
    titleEl.textContent = t.name || 'Без названия';

    // Заголовок элемента с кнопкой-стрелкой для сворачивания/разворачивания описания
    const headerEl = document.createElement('div');
    headerEl.className = 'qp-item-header';

    const toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.className = 'qp-item-toggle';
    toggleBtn.setAttribute('aria-label', 'Показать описание технологии');
    toggleBtn.setAttribute('aria-expanded', 'false');

    const arrowSpan = document.createElement('span');
    arrowSpan.className = 'qp-item-arrow';
    arrowSpan.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" focusable="false">
        <polyline points="3 4 6 7 9 4"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round" />
      </svg>
    `;

    toggleBtn.appendChild(arrowSpan);
    headerEl.appendChild(toggleBtn);
    headerEl.appendChild(titleEl);

    const prEl = document.createElement('div');
    prEl.className = 'qp-item-priority';
    if (percent == null) {
      prEl.textContent = 'Приоритет: нет данных';
    } else {
      prEl.textContent = `Приоритет: ${percent}% (${category.label})`;
    }

    const commentEl = document.createElement('div');
    commentEl.className = 'qp-item-comment';
    commentEl.textContent = (priority == null ? category.description : getPriorityWeakLinkComment(t));

    const detailsEl = document.createElement('div');
    detailsEl.className = 'qp-item-details';
    detailsEl.appendChild(prEl);
    detailsEl.appendChild(commentEl);

    item.appendChild(headerEl);
    item.appendChild(detailsEl);

    // Наведение и клик синхронизируют blip и detailPanel
    item.addEventListener('mouseenter', () => {
      // Подсвечиваем элемент в модальном окне
      qpListEl.querySelectorAll('.qp-item').forEach(el => el.classList.remove('highlighted'));
      item.classList.add('highlighted');

      // Находим все blip для этой технологии (может быть несколько в разных квадрантах)
      const allBlips = svg.querySelectorAll(`.blip[data-id="${t.id}"]`);
      svg.querySelectorAll('.blip').forEach(el => el.classList.remove('highlighted'));

      if (allBlips.length > 0) {
        // Если есть зуммированный квадрант, предпочитаем blip из него
        let targetBlip = null;
        if (currentZoomedQuadrant !== null) {
          targetBlip = Array.from(allBlips).find(b => {
            const blipQuadrant = b.dataset.quadrant ? +b.dataset.quadrant : null;
            return blipQuadrant === currentZoomedQuadrant;
          });
        }
        // Если не нашли в зуммированном квадранте, берем первый
        if (!targetBlip) {
          targetBlip = allBlips[0];
        }

        targetBlip.classList.add('highlighted');

        // Точное позиционирование подсказки на blip
        const rect = targetBlip.getBoundingClientRect();
        const svgRect = svg.getBoundingClientRect();
        const text = getHoverText(t);
        hoverLabel.textContent = text;
        hoverLabel.classList.remove('priority-low', 'priority-medium', 'priority-high');
        // Позиционируем подсказку точно над blip по центру
        hoverLabel.style.left = `${rect.left + rect.width / 2 - svgRect.left}px`;
        hoverLabel.style.top = `${rect.top - svgRect.top}px`;
        hoverLabel.classList.add('visible');
      }
    });

    item.addEventListener('mouseleave', () => {
      svg.querySelectorAll('.blip').forEach(el => el.classList.remove('highlighted'));
      qpListEl.querySelectorAll('.qp-item').forEach(el => el.classList.remove('highlighted'));
      hoverLabel.classList.remove('visible');
    });

    // Клик по стрелке разворачивает/сворачивает описание, не открывая детали
    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const expanded = item.classList.toggle('expanded');
      toggleBtn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    });

    // Клик по технологии в списке приоритета:
    //  - открывает панель подробной информации
    //  - скрывает панель приоритета
    //  - не сбрасывает зум сектора
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      currentTech = t;
      if (detailPanel) {
        // Открываем детали с пометкой, что источник — панель приоритетов
        // Передаем текущий зуммированный квадрант, чтобы сохранить зум
        showDetail(t, 'priority', qId);
      } else {
        console.warn('recomputeQuadrantPriorityList: detailPanel не найден при клике по технологии');
      }
      // Скрываем панель приоритета, но НЕ вызываем unzoom(),
      // чтобы зум сектора сохранился.
      closeQuadrantPriorityPanel();
    });

    qpListEl.appendChild(item);
  });

  // Ранее здесь обновлялась текстовая сводка по приоритетам в элементе qpSummary.
  // Элемент и связанные с ним тексты удалены по требованию, поэтому дополнительная
  // текстовая сводка больше не отображается.
}

function openQuadrantPriorityPanel(qId) {
  if (!quadrantPriorityPanel) return;
  quadrantPriorityPanel.classList.add('open');
  quadrantPriorityPanel.setAttribute('aria-hidden', 'false');
  if (qpTitleEl) {
    qpTitleEl.textContent = `Приоритет технологий: ${getQuadrantName(qId)}`;
  }
  // Синхронизируем статусы панели с фильтром "Статус" из левой панели
  const sidebarLevels = getFilterValues('level');
  const statusButtons = quadrantPriorityPanel.querySelectorAll('.qp-filter-btn');
  if (sidebarLevels && sidebarLevels.length > 0) {
    statusButtons.forEach(btn => {
      const st = btn.getAttribute('data-status');
      if (!st) return;
      btn.classList.toggle('active', sidebarLevels.includes(st));
    });
  } else {
    // Если фильтр статуса не задан — по умолчанию все три статуса активны
    statusButtons.forEach(btn => btn.classList.add('active'));
  }
  recomputeQuadrantPriorityList(qId);
}

function closeQuadrantPriorityPanel() {
  if (!quadrantPriorityPanel) return;
  quadrantPriorityPanel.classList.remove('open');
  quadrantPriorityPanel.setAttribute('aria-hidden', 'true');
  if (qpListEl) qpListEl.innerHTML = '';
  // Очищаем поле поиска при закрытии панели
  if (qpSearchInput) qpSearchInput.value = '';
}

// Функция для перемещения кнопки "Сбросить выбор" под фильтры при раскрытии панели
function moveResetButtonToFilterPanel() {
  const resetBtn = document.getElementById('resetIconBtn');
  const sidebarButtons = document.getElementById('sidebarButtons');
  const resetButtonContainer = document.getElementById('resetButtonContainer');

  if (!resetBtn || !sidebarButtons || !resetButtonContainer) return;

  // Проверяем, что кнопка еще не в контейнере фильтров
  if (resetBtn.parentNode === resetButtonContainer) return;

  // Добавляем класс для анимации
  resetBtn.classList.add('moving');

  // Используем requestAnimationFrame для плавного перехода
  requestAnimationFrame(() => {
    // Перемещаем в filterPanel
    resetButtonContainer.appendChild(resetBtn);
    // Обновляем tooltip
    resetBtn.removeAttribute('data-tooltip');

    // Убираем класс анимации после завершения перехода
    setTimeout(() => {
      resetBtn.classList.remove('moving');
    }, 400);
  });
}

function zoomQuadrant(qId, opts = {}) {
  const g = document.querySelector(`.quadrant-group.q${qId}`);
  if (!g) return;
  if (g.classList.contains('empty')) {
    showNotification('На данный момент в данном секторе отсутствуют технологии, но мы активно работаем над внедрением новых технологий.', false);
    return;
  }
  // Сначала снимаем зум со всех квадрантов, чтобы избежать множественного зума
  document.querySelectorAll(".quadrant-group").forEach(g2 => {
    g2.classList.remove("zoomed-in", "hidden");
  });
  // Затем применяем зум к нужному квадранту
  document.querySelectorAll(".quadrant-group").forEach(g2 => {
    if (+g2.dataset.quadrant !== qId) g2.classList.add("hidden");
    else g2.classList.add("zoomed-in");
  });

  // Показываем подписи колец при зуме (не скрываем их)
  const legendEl = document.querySelector(".legend");
  if (legendEl) legendEl.classList.add("hidden");

  // Применяем трансформацию через CSS
  const ringLabelsGroup = document.getElementById("ringLabelsGroup");
  if (ringLabelsGroup) {
    ringLabelsGroup.classList.remove("hidden");
    ringLabelsGroup.setAttribute("data-zoomed-quadrant", qId);
  }

  // Сохраняем текущий зуммированный квадрант
  currentZoomedQuadrant = qId;

  // Раскрываем боковую панель
  const sidebarWrapper = document.querySelector(".sidebar-wrapper");
  if (sidebarWrapper) {
    sidebarWrapper.classList.remove("collapsed");
    sidebarWrapper.classList.add("expanded");
    // Перемещаем кнопку "Сбросить выбор" под фильтры
    moveResetButtonToFilterPanel();
  }

  // Обновляем фильтр блоков, чтобы показывать только блоки этого сектора
  updateBlockFilterForZoomedQuadrant(qId);

  // Открываем правую панель приоритета сектора только,
  // если зум инициирован явно с сектора/его названия.
  if (opts && opts.source === 'sector') {
    openQuadrantPriorityPanel(qId);
  }
}

function unzoom() {
  document.querySelectorAll(".quadrant-group").forEach(g => {
    g.classList.remove("hidden", "zoomed-in");
  });

  // Восстанавливаем видимость легенды
  const legendEl = document.querySelector(".legend");
  if (legendEl) legendEl.classList.remove("hidden");

  // Убираем атрибут с информацией о зуме
  const ringLabelsGroup = document.getElementById("ringLabelsGroup");
  if (ringLabelsGroup) {
    ringLabelsGroup.removeAttribute("data-zoomed-quadrant");
  }

  // Сбрасываем текущий зуммированный квадрант
  currentZoomedQuadrant = null;

  // Восстанавливаем фильтр блоков (показываем все блоки)
  updateBlockFilterForZoomedQuadrant(null);

  // Закрываем правую панель приоритета
  closeQuadrantPriorityPanel();
}


function renderSectorTechListFilteredByCurrentFilters(quadrantId) {
  // удалить существующие
  document.querySelectorAll('.tech-list').forEach(tl => tl.parentNode?.removeChild(tl));
  const sectorItem = document.querySelector(`.sector-item[data-quadrant="${quadrantId}"]`);
  if (!sectorItem) return;
  const blockVals = getFilterValues('block'); // Получаем массив выбранных блоков
  const techs = technologies.filter(t => {
    if (getQuadrantIdForBlock(t.block) !== quadrantId) return false;
    if (blockVals.length > 0) {
      const techBlocks = t.blocks && Array.isArray(t.blocks) ? t.blocks : (t.block ? [t.block] : []);
      if (!techBlocks.some(block => blockVals.includes(block))) return false;
    }
    return true;
  });
  const list = document.createElement('div');
  list.className = 'tech-list';
  techs.forEach(t => {
    const ti = document.createElement('div');
    ti.className = 'tech-list-item';
    ti.dataset.techId = t.id;
    ti.textContent = t.name;
    ti.addEventListener('mouseenter', () => {
      const tech = technologies.find(tt => tt.id == t.id);
      if (tech) {
        const blip = svg.querySelector(`.blip[data-id="${t.id}"]`);
        if (blip) blip.classList.add('highlighted');
        debouncedHover(tech, true);
        const svgRect = svg.getBoundingClientRect();
        const bRect = blip?.getBoundingClientRect?.() || { left: 0, top: 0, width: 0, height: 0 };
        hoverLabel.style.left = `${bRect.left + bRect.width/2 - svgRect.left}px`;
        hoverLabel.style.top = `${bRect.top + bRect.height/2 - svgRect.top}px`;
      }
    });
    ti.addEventListener('mouseleave', () => {
      debouncedHover(null, false);
      svg.querySelectorAll('.blip').forEach(el => el.classList.remove('highlighted'));
    });
    ti.addEventListener('click', (e) => {
      e.stopPropagation();
      const blip = svg.querySelector(`.blip[data-id="${t.id}"]`);
      if (blip) {
        blip.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      } else {
        // Открываем детали из списка сектора (не из панели приоритета)
        // showDetail сам выделит все blip'ы технологии
        showDetail(t, 'sector-list');
      }
      list.querySelectorAll('.tech-list-item').forEach(el => el.classList.remove('selected'));
      ti.classList.add('selected');
      selectedBlipId = t.id;
    });
    list.appendChild(ti);
  });
  sectorItem.parentNode.insertBefore(list, sectorItem.nextSibling);
  requestAnimationFrame(() => list.classList.add('open'));
  document.querySelectorAll('.sector-item').forEach(i => i.classList.remove('active'));
  sectorItem.classList.add('active');
}
// ===== ХОВЕР =====
// Функция для получения текста подсказки с учетом незаполненных полей
const getHoverText = (tech) => {
  if (!tech) return '';

  const techReadFilled = isRatingFilled(tech.techRead);
  const organReadFilled = isRatingFilled(tech.organRead);
  const hasReadinessRatings = techReadFilled && organReadFilled;

  // Если базовые оценки не заполнены — показываем текущее предупреждение.
  if (!hasReadinessRatings) {
    return `${tech.name}\nНеобходимо заполнить поля оценок!`;
  }

  const priority = computePriority(tech, 'mult');
  const category = getPriorityCategory(priority);

  if (priority == null || category.key === 'none') {
    return `${tech.name}\nНедостаточно данных для расчёта приоритета.`;
  }

  const percent = Math.round(priority * 100);
  const weakLinkComment = getPriorityWeakLinkComment(tech);

  // Многострочный hover: название → приоритет → краткий комментарий.
  return `${tech.name}\nПриоритет: ${percent}% (${category.label})\n${weakLinkComment}`;
};

const debouncedHover = debounce((tech, visible) => {
  if (visible) {
    const text = tech ? getHoverText(tech) : '';
    hoverLabel.textContent = text;
    // Цвет подсказки один, классы категорий не используем
    hoverLabel.classList.remove('priority-low', 'priority-medium', 'priority-high');
    hoverLabel.style.opacity = "1";
  } else {
    hoverLabel.style.opacity = "0";
  }
}, 100);

function attachBlipHoverHandlers() {
  svg.querySelectorAll('.blip').forEach(b => {
    b.replaceWith(b.cloneNode(true));
  });
  svg.querySelectorAll('.blip').forEach(b => {
    b.addEventListener('mouseenter', () => {
      const id = +b.dataset.id;
      const tech = technologies.find(t => t.id === id);
      if (!tech) return;
      b.classList.add('highlighted');

      // Подсвечиваем соответствующий элемент в модальном окне приоритетных технологий (если открыто)
      if (quadrantPriorityPanel && quadrantPriorityPanel.classList.contains('open') && qpListEl) {
        qpListEl.querySelectorAll('.qp-item').forEach(el => el.classList.remove('highlighted'));
        const priorityItem = qpListEl.querySelector(`.qp-item[data-tech-id="${id}"]`);
        if (priorityItem) {
          priorityItem.classList.add('highlighted');
          // Прокручиваем к элементу, если он не виден
          priorityItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }

      const rect = b.getBoundingClientRect();
      const svgRect = svg.getBoundingClientRect();
      const text = getHoverText(tech);
      hoverLabel.textContent = text;
      hoverLabel.classList.remove('priority-low', 'priority-medium', 'priority-high');
      // Точное позиционирование подсказки над blip по центру
      hoverLabel.style.left = `${rect.left + rect.width / 2 - svgRect.left}px`;
      hoverLabel.style.top = `${rect.top - svgRect.top}px`;
      hoverLabel.classList.add('visible');
    });

    b.addEventListener('mouseleave', () => {
      // Подсветка бордером только при ховере
      b.classList.remove('highlighted');
      hoverLabel.classList.remove('visible');
      // Убираем подсветку с элемента в модальном окне
      if (qpListEl) {
        qpListEl.querySelectorAll('.qp-item').forEach(el => el.classList.remove('highlighted'));
      }
    });

    // Надёжный обработчик клика на каждом blip, добавляем после клонирования.
    // Примечание: после клонирования blip теряет обработчики из createBlip, поэтому добавляем здесь
    b.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const id = +b.dataset.id;
      const blipQuadrant = b.dataset.quadrant ? +b.dataset.quadrant : null;
      const tech = technologies.find(t => t.id === id);
      if (!tech) return;
      // Установим как текущую технологию
      currentTech = tech;
      b.classList.remove('highlighted'); // убрать бордер, он только для hover

      // Обновим панель деталей, передавая квадрант blip'а
      // showDetail сам выделит все blip'ы технологии (подсветка и пульсация) и выполнит зум
      showDetail(tech, 'blip', blipQuadrant);
    });
  });
}


  // ===== АВТОРИЗАЦИЯ =====
  function checkArchitectRole() {
    const role = localStorage.getItem("role");
    return role === "architect" || role === "admin";
  }

  function renderAuth() {
    if (!authInfo || !logoutContainer) return;
    const role = localStorage.getItem("role");
    const exportPdfBtn = document.getElementById("exportPdfBtn");
    const editBtn = document.getElementById("editTechBtn");
    const deleteBtn = document.getElementById("deleteTechBtn");

    const setButtonsVisibility = (visible) => {
      // addTech visibility remains role-based
      if (addTechBtn) addTechBtn.style.display = visible ? "flex" : "none";
      // Export button — доступна всем пользователям (не зависит от роли)
      if (exportPdfBtn) exportPdfBtn.style.display = "flex";
      if (editBtn) editBtn.style.display = visible ? "inline-flex" : "none";
      if (deleteBtn) deleteBtn.style.display = visible ? "inline-flex" : "none";
    };

    // Удаляем класс неавторизованного пользователя при наличии роли
    document.body.classList.remove('not-authorized');

    if (role === "architect") {
      authInfo.innerHTML = `<div class="user-role architect-role" data-tooltip="Страница аналитики" style="cursor: pointer;">Архитектор</div>`;
          // Добавляем обработчик клика для перехода на analitic.html
          const adminRoleElement = authInfo.querySelector('.architect-role');
          if (adminRoleElement) {
            adminRoleElement.onclick = () => {
              window.location.href = 'analitic.html';
            };
          }
      logoutContainer.innerHTML = `<button class="logout" data-tooltip="Выйти" aria-label="Выйти">
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16,17 21,12 16,7"/>
      <!-- Добавляем stroke-dasharray сюда -->
      <line x1="21" y1="12" x2="9" y2="12" stroke-dasharray="100"/>
    </svg>
  </button>`;
      setButtonsVisibility(true);
      logoutContainer.querySelector(".logout").onclick = () => {
        const theme = localStorage.getItem('theme');
        localStorage.clear();
        if (theme) localStorage.setItem('theme', theme);
        location.reload();
      };
    } else if (role === "admin") {
      authInfo.innerHTML = `<div class="user-role admin-role" data-tooltip="Перейти в админ-панель" style="cursor: pointer;">Администратор</div>`;
      logoutContainer.innerHTML = `<button class="logout" data-tooltip="Выйти" aria-label="Выйти">
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16,17 21,12 16,7"/>
      <!-- Добавляем stroke-dasharray сюда -->
      <line x1="21" y1="12" x2="9" y2="12" stroke-dasharray="100"/>
    </svg>
  </button>`;
      setButtonsVisibility(true);
      const adminRoleElement = authInfo.querySelector('.admin-role');
      if (adminRoleElement) {
        adminRoleElement.onclick = () => window.location.href = 'admin.html';
      }
      logoutContainer.querySelector(".logout").onclick = () => {
        const theme = localStorage.getItem('theme');
        localStorage.clear();
        if (theme) localStorage.setItem('theme', theme);
        location.reload();
      };
    } else {
      authInfo.innerHTML = ``;
      logoutContainer.innerHTML = `<button class="login" data-tooltip="Войти" aria-label="Войти">
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
      <polyline points="10,17 15,12 10,7"/>
      <!-- И сюда тоже -->
      <line x1="15" y1="12" x2="3" y2="12" stroke-dasharray="100"/>
    </svg>
  </button>`;
      setButtonsVisibility(false);
      // Добавляем класс для неавторизованных пользователей
      document.body.classList.add('not-authorized');
      logoutContainer.querySelector(".login").onclick = () => {
        window.location.href = "auth.html";
      };
    }
  }

// ===== МОДАЛЬНЫЕ ОКНА =====
function showModal(panelId) {
  const panel = typeof panelId === 'string' ? document.getElementById(panelId) : panelId;
  if (!panel) return;
  panel.style.display = 'block';
  // игнорировать внешние клики в течение короткого окна после открытия
  // Увеличим окно игнорирования до 300ms — это предотвращает моментальное закрытие
  // модалки в тех браузерах/сценариях, где глобальный document.click обрабатывается
  // после локального обработчика открытия в той же цепочке событий.
  ignoreOutsideClickUntil = Date.now() + 300;
  // Сделаем снимок начального состояния формы внутри панели (если есть) для dirty-check
  try {
    const form = panel.querySelector && panel.querySelector('form');
    if (form && !form.dataset.initial) snapshotFormInitial(form);
  } catch (e) { /* ignore */ }
  requestAnimationFrame(() => panel.classList.add('open'));
}

function hideModal(panelIdOrEl) {
  const panel = typeof panelIdOrEl === 'string' ? document.getElementById(panelIdOrEl) : panelIdOrEl;
  if (!panel) return;
  panel.classList.remove('open');
  const onEnd = () => {
    panel.style.display = 'none';
    panel.removeEventListener('transitionend', onEnd);
  };
  const dur = parseFloat(getComputedStyle(panel).transitionDuration) || 0;
  if (dur > 0) {
    panel.addEventListener('transitionend', onEnd);
  } else {
    setTimeout(onEnd, 220);
  }
  if (panel.id === 'addTechPanel') {
    document.getElementById('addTechForm')?.reset();
    resetCustomSelects('add');
    document.getElementById('functionsContainer').innerHTML = '';
    // Сбрасываем видимость полей оценок
    if (typeof updateTechRatingsVisibility === 'function') {
      setTimeout(() => {
        updateTechRatingsVisibility();
      }, 50);
    }
  }
  if (panel.id === 'editTechPanel') {
    document.getElementById('editTechForm')?.reset();
    resetCustomSelects('edit');
  }
  if (panel.id === 'addBlockPanel') {
    document.getElementById('addBlockForm')?.reset();
    document.getElementById('functionsContainer').innerHTML = '';
    // Сброс кастомных выпадающих списков
    const sectorSelect = document.querySelector('.custom-select-modal[data-field="blockSector"]');
    if (sectorSelect) {
      const hiddenInput = document.getElementById('blockSector');
      if (hiddenInput) hiddenInput.value = '';
      const selectedTextEl = sectorSelect.querySelector('.selected-text');
      if (selectedTextEl) selectedTextEl.textContent = 'Выберите';
      sectorSelect.classList.remove('open');
      sectorSelect.querySelectorAll('.select-options li').forEach(li => li.classList.remove('selected'));
    }
  }
}

// Проверка, были ли изменения в форме модалки (сравнение текущих значений с исходными)
function isFormDirty(formEl) {
  if (!formEl) return false;
  const initial = formEl.dataset.initial ? JSON.parse(formEl.dataset.initial) : {};
  const data = {};
  Array.from(formEl.elements).forEach(el => {
    const key = el.name || el.id;
    if (!key) return;
    if (el.type === 'checkbox' || el.type === 'radio') data[key] = el.checked;
    else data[key] = el.value;
  });
  return JSON.stringify(initial) !== JSON.stringify(data);
}

// Сохранить snapshot initial для формы
function snapshotFormInitial(formEl) {
  if (!formEl) return;
  const data = {};
  Array.from(formEl.elements).forEach(el => {
    const key = el.name || el.id;
    if (!key) return;
    if (el.type === 'checkbox' || el.type === 'radio') data[key] = el.checked;
    else data[key] = el.value;
  });
  formEl.dataset.initial = JSON.stringify(data);
}

function resetCustomSelects(prefix) {
  document.querySelectorAll(`.custom-select-modal[data-field^="${prefix}"]`).forEach(select => {
    const hiddenInputId = select.dataset.field;
    const hiddenInput = document.getElementById(hiddenInputId);
    if (hiddenInput) hiddenInput.value = '';
    const placeholder = select.getAttribute('data-placeholder') || 'Выберите';
    const selectedTextEl = select.querySelector('.selected-text');
    if (selectedTextEl) selectedTextEl.innerHTML = placeholder;
    select.setAttribute('data-value', '');
    select.classList.remove('open');
    select.querySelectorAll('.select-options li').forEach(li => {
      li.classList.remove('selected');
      // Сбрасываем чекбоксы
      const checkbox = li.querySelector('input[type="checkbox"]');
      if (checkbox) checkbox.checked = false;
    });
  });
}

function setCustomSelectValue(fieldId, value) {
  const customSelect = document.querySelector(`.custom-select-modal[data-field="${fieldId}"]`);
  if (!customSelect) return;
  const hiddenInput = document.getElementById(fieldId);
  // Поддерживаем передачу массива или JSON-строки массива
  let normalized = value;
  if (Array.isArray(value)) {
    normalized = JSON.stringify(value);
  } else if (typeof value === 'string' && value.trim().startsWith('[')) {
    // оставим как есть
    normalized = value;
  }
  if (hiddenInput) hiddenInput.value = normalized;
  const options = customSelect.querySelectorAll('.select-options li');
  let selectedOption = null;
  // Снимем все выделения и сбросим чекбоксы, затем отметим нужные
  options.forEach(li => {
    li.classList.remove('selected');
    const checkbox = li.querySelector('input[type="checkbox"]');
    if (checkbox) checkbox.checked = false;
  });
  // Если hidden содержит JSON-массив — распарсим
  let toSelect = [];
  try {
    if (hiddenInput && hiddenInput.value && hiddenInput.value.trim().startsWith('[')) {
      const parsed = JSON.parse(hiddenInput.value);
      if (Array.isArray(parsed)) toSelect = parsed;
    } else if (typeof value === 'string' && value.trim().startsWith('[')) {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) toSelect = parsed;
    } else if (Array.isArray(value)) {
      toSelect = value;
    } else if (value) {
      toSelect = [value];
    }
  } catch (err) { toSelect = [] }

  toSelect.forEach(v => {
    const li = customSelect.querySelector(`.select-options li[data-value="${v}"]`);
    if (li) {
      li.classList.add('selected');
      // Обновляем чекбокс
      const checkbox = li.querySelector('input[type="checkbox"]');
      if (checkbox) checkbox.checked = true;
    }
  });

  // Обновляем состояние чекбокса "Выбрать все" для блоков и функций
  const hasCheckboxes = ['techBlock', 'techFunc', 'editBlock', 'editFunc'].includes(fieldId);
  if (hasCheckboxes) {
    const allLi = customSelect.querySelector('.select-all-option');
    const allCheckbox = allLi ? allLi.querySelector('input[type="checkbox"]') : null;
    if (allCheckbox) {
      const optionLis = Array.from(customSelect.querySelectorAll('.select-options li.select-option-item'));
      const allSelected = optionLis.length > 0 && optionLis.every(optLi => optLi.classList.contains('selected'));
      allCheckbox.checked = allSelected;
    }
  }

  // Если есть выбранные — отобразим
  if (toSelect.length) {
    customSelect.setAttribute('data-value', hiddenInput ? (hiddenInput.value || JSON.stringify(toSelect)) : JSON.stringify(toSelect));
    if (customSelect.getAttribute('data-multi') === 'true') {
      renderMultiSelectTags(customSelect);
    } else {
      const first = customSelect.querySelector('.select-options li.selected');
      if (first) customSelect.querySelector('.selected-text').textContent = first.textContent;
    }
  } else {
    const placeholder = customSelect.getAttribute('data-placeholder') || 'Выберите';
    customSelect.querySelector('.selected-text').textContent = placeholder;
    customSelect.setAttribute('data-value', '');
  }

  // Если это поле techCompany, обновляем видимость полей оценок
  if (fieldId === 'techCompany' && typeof updateTechRatingsVisibility === 'function') {
    setTimeout(() => {
      updateTechRatingsVisibility();
    }, 50);
  }
}

// ===== ФУНКЦИИ ДЛЯ УПРАВЛЕНИЯ ВИДИМОСТЬЮ ПОЛЕЙ ОЦЕНОК =====
// Функция для проверки количества выбранных предприятий и управления видимостью полей
// Функция для создания динамических полей оценок для предприятий
function createCompanyRatingsFields(companies, containerId, prefix) {
  const container = document.getElementById(containerId);
  if (!container) return;

  // Очищаем контейнер
  container.innerHTML = '';

  if (companies.length === 0) {
    container.style.display = 'none';
    return;
  }

  if (companies.length === 1) {
    container.style.display = 'none';
    return;
  }

  // Создаем поля для каждого предприятия
  companies.forEach(company => {
    const companyGroup = document.createElement('div');
    companyGroup.className = 'company-ratings-group';

    const companyLabel = document.createElement('div');
    companyLabel.className = 'company-ratings-label';
    companyLabel.textContent = company;
    companyGroup.appendChild(companyLabel);

    const ratingsRow = document.createElement('div');
    ratingsRow.className = 'ratings-row';
    ratingsRow.style.display = 'flex';
    ratingsRow.style.flexDirection = 'row';
    ratingsRow.style.gap = '12px';

    // Технологическая готовность
    const techReadDiv = document.createElement('div');
    techReadDiv.style.flex = '1';
    techReadDiv.style.display = 'flex';
    techReadDiv.style.flexDirection = 'column';
    techReadDiv.style.gap = '6px';
    const techReadLabel = document.createElement('span');
    techReadLabel.textContent = 'Технологическая готовность';
    techReadLabel.style.display = 'block';
    techReadLabel.style.marginBottom = '4px';
    techReadLabel.style.fontSize = '13px';
    techReadLabel.style.fontWeight = '500';
    const techReadInput = document.createElement('input');
    techReadInput.type = 'number';
    techReadInput.min = '0';
    techReadInput.max = '3';
    techReadInput.step = '1';
    techReadInput.id = `${prefix}TechRead_${company}`;
    techReadInput.className = 'company-rating-input';
    techReadDiv.appendChild(techReadLabel);
    techReadDiv.appendChild(techReadInput);
    ratingsRow.appendChild(techReadDiv);

    // Организационная готовность
    const organReadDiv = document.createElement('div');
    organReadDiv.style.flex = '1';
    organReadDiv.style.display = 'flex';
    organReadDiv.style.flexDirection = 'column';
    organReadDiv.style.gap = '6px';
    const organReadLabel = document.createElement('span');
    organReadLabel.textContent = 'Организационная готовность';
    organReadLabel.style.display = 'block';
    organReadLabel.style.marginBottom = '4px';
    organReadLabel.style.fontSize = '13px';
    organReadLabel.style.fontWeight = '500';
    const organReadInput = document.createElement('input');
    organReadInput.type = 'number';
    organReadInput.min = '0';
    organReadInput.max = '3';
    organReadInput.step = '1';
    organReadInput.id = `${prefix}OrganRead_${company}`;
    organReadInput.className = 'company-rating-input';
    organReadDiv.appendChild(organReadLabel);
    organReadDiv.appendChild(organReadInput);
    ratingsRow.appendChild(organReadDiv);

    companyGroup.appendChild(ratingsRow);
    container.appendChild(companyGroup);
  });

  container.style.display = 'block';
}

function updateTechRatingsVisibility() {
  const techCompanyInput = document.getElementById('techCompany');
  if (!techCompanyInput) return;

  let selectedCompanies = [];
  try {
    const value = techCompanyInput.value || '';
    if (value.trim().startsWith('[')) {
      selectedCompanies = JSON.parse(value);
    } else if (value) {
      selectedCompanies = [value];
    }
  } catch (e) {
    // Если не удалось распарсить, считаем что ничего не выбрано
    selectedCompanies = [];
  }

  const techTechReadGroup = document.getElementById('techTechReadGroup');
  const techOrganReadGroup = document.getElementById('techOrganReadGroup');
  const techRatingsWarning = document.getElementById('techRatingsWarning');
  const techCompanyRatingsContainer = document.getElementById('techCompanyRatingsContainer');

  if (selectedCompanies.length === 1) {
    // Одно предприятие - показываем обычные поля, скрываем динамические
    if (techTechReadGroup) techTechReadGroup.style.display = '';
    if (techOrganReadGroup) techOrganReadGroup.style.display = '';
    if (techRatingsWarning) techRatingsWarning.style.display = 'none';
    if (techCompanyRatingsContainer) techCompanyRatingsContainer.style.display = 'none';
  } else if (selectedCompanies.length > 1) {
    // Несколько предприятий - скрываем обычные поля, показываем динамические
    if (techTechReadGroup) techTechReadGroup.style.display = 'none';
    if (techOrganReadGroup) techOrganReadGroup.style.display = 'none';
    if (techRatingsWarning) techRatingsWarning.style.display = 'none';
    // Создаем динамические поля для каждого предприятия
    createCompanyRatingsFields(selectedCompanies, 'techCompanyRatingsContainer', 'tech');
    // Очищаем значения обычных полей
    const techTechReadInput = document.getElementById('techTechRead');
    const techOrganReadInput = document.getElementById('techOrganRead');
    if (techTechReadInput) techTechReadInput.value = '';
    if (techOrganReadInput) techOrganReadInput.value = '';
  } else {
    // Нет выбранных предприятий - показываем поля (по умолчанию будет установлено текущее предприятие)
    if (techTechReadGroup) techTechReadGroup.style.display = '';
    if (techOrganReadGroup) techOrganReadGroup.style.display = '';
    if (techRatingsWarning) techRatingsWarning.style.display = 'none';
    if (techCompanyRatingsContainer) techCompanyRatingsContainer.style.display = 'none';
  }
}

// Аналогичная функция для модального окна редактирования
function updateEditTechRatingsVisibility(tech) {
  if (!tech) return;

  const companies = Array.isArray(tech.company) ? tech.company : (tech.company ? [tech.company] : []);
  const editTechReadGroup = document.getElementById('editTechReadGroup');
  const editOrganReadGroup = document.getElementById('editOrganReadGroup');
  const editCompanyRatingsContainer = document.getElementById('editCompanyRatingsContainer');

  if (companies.length === 1) {
    // Одно предприятие - показываем обычные поля, скрываем динамические
    if (editTechReadGroup) editTechReadGroup.style.display = '';
    if (editOrganReadGroup) editOrganReadGroup.style.display = '';
    if (editCompanyRatingsContainer) editCompanyRatingsContainer.style.display = 'none';
  } else if (companies.length > 1) {
    // Несколько предприятий - скрываем обычные поля, показываем динамические
    if (editTechReadGroup) editTechReadGroup.style.display = 'none';
    if (editOrganReadGroup) editOrganReadGroup.style.display = 'none';
    // Создаем динамические поля и заполняем их значениями из companyRatings
    createCompanyRatingsFields(companies, 'editCompanyRatingsContainer', 'edit');
    // Заполняем значения из companyRatings или общих полей
    if (tech.companyRatings && typeof tech.companyRatings === 'object') {
      companies.forEach(company => {
        const ratings = tech.companyRatings[company];
        if (ratings) {
          const techReadInput = document.getElementById(`editTechRead_${company}`);
          const organReadInput = document.getElementById(`editOrganRead_${company}`);
          if (techReadInput) techReadInput.value = ratings.techRead !== undefined ? ratings.techRead : '';
          if (organReadInput) organReadInput.value = ratings.organRead !== undefined ? ratings.organRead : '';
        } else {
          // Используем общие значения
          const techReadInput = document.getElementById(`editTechRead_${company}`);
          const organReadInput = document.getElementById(`editOrganRead_${company}`);
          if (techReadInput) techReadInput.value = tech.techRead !== undefined ? tech.techRead : '';
          if (organReadInput) organReadInput.value = tech.organRead !== undefined ? tech.organRead : '';
        }
      });
    } else {
      // Нет companyRatings - используем общие значения для всех
      companies.forEach(company => {
        const techReadInput = document.getElementById(`editTechRead_${company}`);
        const organReadInput = document.getElementById(`editOrganRead_${company}`);
        if (techReadInput) techReadInput.value = tech.techRead !== undefined ? tech.techRead : '';
        if (organReadInput) organReadInput.value = tech.organRead !== undefined ? tech.organRead : '';
      });
    }
  } else {
    // Нет предприятий - показываем обычные поля
    if (editTechReadGroup) editTechReadGroup.style.display = '';
    if (editOrganReadGroup) editOrganReadGroup.style.display = '';
    if (editCompanyRatingsContainer) editCompanyRatingsContainer.style.display = 'none';
  }
}

// ===== ИНИЦИАЛИЗАЦИЯ =====
document.addEventListener("DOMContentLoaded", async () => {
  const savedTheme = localStorage.getItem("theme") || "light";
  if (savedTheme === "dark") {
    document.body.classList.add("dark");
    if (themeToggle) themeToggle.checked = true;
  }
  if (themeToggle) {
    themeToggle.addEventListener("change", () => {
      document.body.classList.toggle("dark", themeToggle.checked);
      localStorage.setItem("theme", themeToggle.checked ? "dark" : "light");
    });
  }

  await loadData();
  const selectedEnterprise = localStorage.getItem("selectedEnterprise") || "РМК";
  currentEnterprise = enterpriseData[selectedEnterprise] ? selectedEnterprise : "РМК";
  switchEnterprise(currentEnterprise);
  renderAuth();
  renderRadar();
  const debouncedSearch = debounce(() => updateRadar(), 300);
  if (searchInput) searchInput.addEventListener("input", debouncedSearch);
  // Фильтры
  const filterBtn = document.getElementById('filterBtn');
  const filterPanel = document.getElementById('filterPanel');
  if (filterBtn && filterPanel) {
    filterBtn.onclick = (e) => {
      e.stopPropagation();
      document.querySelectorAll('.custom-select').forEach(s => s.classList.remove('open'));
      const opening = !filterPanel.classList.contains('open');
      if (opening) {
        filterPanel.classList.remove('closing');
        filterPanel.classList.add('open');
      } else {
        filterPanel.classList.remove('open');
        filterPanel.classList.add('closing');
        setTimeout(() => filterPanel.classList.remove('closing'), 450);
      }
    };
  }

  // Предотвращаем стандартное поведение label при клике на span
  document.addEventListener('mousedown', (e) => {
    if (e.target.tagName === 'SPAN' && e.target.closest('.option-label span')) {
      const label = e.target.closest('.option-label');
      const li = label ? label.closest('.select-options li') : null;
      if (li && li.closest('.custom-select')) {
        // Предотвращаем стандартное поведение label, которое переключает чекбокс
        e.preventDefault();
      }
    }
  }, true); // Используем capture phase, чтобы перехватить событие до label

  // Обработчики кастомных селектов (sidebar)
  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('.custom-select .select-trigger');
    if (trigger) {
      const select = trigger.closest('.custom-select');
      document.querySelectorAll('.custom-select').forEach(s => {
        if (s !== select) s.classList.remove('open');
      });
      select.classList.toggle('open');
      if (select.classList.contains('open')) positionOptions(select);
      const searchInputInside = select.querySelector('.select-search input');
      if (searchInputInside) setTimeout(() => searchInputInside.focus(), 0);
      return;
    }

    // Пропускаем клики непосредственно на чекбокс (он обработается через change)
    if (e.target.type === 'checkbox') {
      return;
    }

    // Обработка клика на span внутри option-label - делаем его кликабельным
    // Находим li через span, чтобы обработать клик так же, как клик на li
    let li = null;
    const isClickOnSpan = e.target.tagName === 'SPAN' && e.target.closest('.option-label span');

    if (isClickOnSpan) {
      const label = e.target.closest('.option-label');
      li = label ? label.closest('.select-options li') : null;
      // Если кликнули на span, предотвращаем стандартное поведение label
      if (li) {
        e.preventDefault();
        e.stopPropagation();
        // Обрабатываем выбор напрямую, как будто кликнули на li
        // (продолжим обработку ниже, но li уже найден)
      }
    }

    // Если li не найден через span, ищем обычным способом
    if (!li) {
      li = e.target.closest('.select-options li');
    }

    if (li) {
      const select = li.closest('.custom-select');
      if (!select) return;
      const isMulti = select.getAttribute('data-multi') === 'true';
      const key = select.getAttribute('data-filter');
      const hiddenInput = key ? document.getElementById(`filter_${key}`) : null;

      // Пропускаем клики по элементам поиска
      if (li.classList.contains('select-search')) return;

      // Обработка "Выбрать все" для мультиселектов
      if (li.classList.contains('select-all-option') && isMulti) {
        const allCheckbox = li.querySelector('input[type="checkbox"]');
        // Если кликнули на span, инвертируем текущее состояние
        // Иначе используем текущее состояние чекбокса
        let shouldSelectAll;
        if (isClickOnSpan && allCheckbox) {
          shouldSelectAll = !allCheckbox.checked;
        } else {
          shouldSelectAll = allCheckbox ? allCheckbox.checked : true;
        }

        const optionLis = Array.from(select.querySelectorAll('.select-options li.select-option-item'));
        optionLis.forEach(optLi => {
          optLi.classList.toggle('selected', shouldSelectAll);
          const cb = optLi.querySelector('input[type="checkbox"]');
          if (cb) cb.checked = shouldSelectAll;
        });

        if (allCheckbox) allCheckbox.checked = shouldSelectAll;

        const selectedValues = shouldSelectAll
          ? optionLis
              .map(optLi => optLi.getAttribute('data-value'))
              .filter(v => v && v.length > 0)
          : [];

        if (hiddenInput) hiddenInput.value = JSON.stringify(selectedValues);
        select.setAttribute('data-value', hiddenInput ? hiddenInput.value : JSON.stringify(selectedValues));

        renderMultiSelectTags(select);
        positionOptions(select);

        if (key === 'block') {
          updateFunctionFilterForBlock(selectedValues);
        }
        updateRadar();
        return;
      }

      const value = li.getAttribute('data-value');

      if (isMulti) {
        // Множественный выбор: переключаем выделение
        li.classList.toggle('selected');
        const checkbox = li.querySelector('input[type="checkbox"]');
        if (checkbox) {
          checkbox.checked = li.classList.contains('selected');
        }

        const selected = Array.from(select.querySelectorAll('.select-options li.select-option-item.selected'))
          .map(x => x.getAttribute('data-value'))
          .filter(v => v && v.length > 0);

        if (hiddenInput) hiddenInput.value = JSON.stringify(selected);
        select.setAttribute('data-value', hiddenInput ? hiddenInput.value : JSON.stringify(selected));

        // Синхронизация состояния чекбокса "Выбрать все"
        const allLi = select.querySelector('.select-all-option');
        const allCheckbox = allLi ? allLi.querySelector('input[type="checkbox"]') : null;
        if (allCheckbox) {
          const optionLis = Array.from(select.querySelectorAll('.select-options li.select-option-item'));
          const allSelected = optionLis.length > 0 && optionLis.every(optLi => optLi.classList.contains('selected'));
          allCheckbox.checked = allSelected;
        }

        renderMultiSelectTags(select);
        positionOptions(select);

        if (key === 'block') {
          updateFunctionFilterForBlock(selected);
        }

        updateRadar();
        return;
      }

      // Одиночный выбор (старое поведение для обратной совместимости)
      const text = li.textContent;
      // Если выбран placeholder/пустое значение — сбросим селект
      if (!value) {
        select.setAttribute('data-value', '');
        const textEl = select.querySelector('.selected-text');
        if (textEl) {
          textEl.textContent = select.getAttribute('data-placeholder') || text;
        }
        select.querySelectorAll('.select-options li').forEach(opt => opt.classList.remove('selected'));
        select.classList.remove('open');
        if (hiddenInput) hiddenInput.value = '';
        updateRadar();
        if (key === 'block') {
          // При сбросе блока показываем все функции
          updateFunctionFilterForBlock(null);
        }
        return;
      }

      select.setAttribute('data-value', value);
      const textEl = select.querySelector('.selected-text');
      if (textEl) {
        textEl.textContent = text;
      }
      select.querySelectorAll('.select-options li').forEach(opt => opt.classList.toggle('selected', opt === li));
      select.classList.remove('open');
      if (hiddenInput) hiddenInput.value = value;

      // Если выбран блок, обновляем фильтр функций
      if (key === 'block') {
        updateFunctionFilterForBlock(value);
      }

      updateRadar();
      return;
    }

    if (!e.target.closest('.custom-select')) {
      document.querySelectorAll('.custom-select').forEach(s => s.classList.remove('open'));
    }
  });

  // Обработчик для синхронизации состояния чекбоксов при прямом клике на них
  document.addEventListener('change', (e) => {
    if (e.target.type === 'checkbox' && e.target.closest('.custom-select .select-options')) {
      const checkbox = e.target;
      const li = checkbox.closest('.select-options li');
      if (!li) return;

      const select = li.closest('.custom-select');
      if (!select) return;
      const isMulti = select.getAttribute('data-multi') === 'true';
      if (!isMulti) return;

      const key = select.getAttribute('data-filter');
      const hiddenInput = key ? document.getElementById(`filter_${key}`) : null;

      // Обработка "Выбрать все"
      if (li.classList.contains('select-all-option')) {
        const shouldSelectAll = checkbox.checked;
        const optionLis = Array.from(select.querySelectorAll('.select-options li.select-option-item'));
        optionLis.forEach(optLi => {
          optLi.classList.toggle('selected', shouldSelectAll);
          const cb = optLi.querySelector('input[type="checkbox"]');
          if (cb) cb.checked = shouldSelectAll;
        });

        const selectedValues = shouldSelectAll
          ? optionLis.map(optLi => optLi.getAttribute('data-value')).filter(v => v && v.length > 0)
          : [];

        if (hiddenInput) hiddenInput.value = JSON.stringify(selectedValues);
        select.setAttribute('data-value', hiddenInput ? hiddenInput.value : JSON.stringify(selectedValues));

        renderMultiSelectTags(select);
        positionOptions(select);

        if (key === 'block') {
          updateFunctionFilterForBlock(selectedValues);
        }
        updateRadar();
        return;
      }

      // Обычные элементы списка
      // Синхронизируем класс selected с состоянием чекбокса
      if (checkbox.checked) {
        li.classList.add('selected');
      } else {
        li.classList.remove('selected');
      }

      // Обновляем скрытое поле
      const selected = Array.from(select.querySelectorAll('.select-options li.select-option-item.selected'))
        .map(x => x.getAttribute('data-value'))
        .filter(v => v && v.length > 0);

      if (hiddenInput) hiddenInput.value = JSON.stringify(selected);
      select.setAttribute('data-value', hiddenInput ? hiddenInput.value : JSON.stringify(selected));

      // Синхронизация состояния чекбокса "Выбрать все"
      const allLi = select.querySelector('.select-all-option');
      const allCheckbox = allLi ? allLi.querySelector('input[type="checkbox"]') : null;
      if (allCheckbox) {
        const optionLis = Array.from(select.querySelectorAll('.select-options li.select-option-item'));
        const allSelected = optionLis.length > 0 && optionLis.every(optLi => optLi.classList.contains('selected'));
        allCheckbox.checked = allSelected;
      }

      renderMultiSelectTags(select);

      if (key === 'block') {
        updateFunctionFilterForBlock(selected);
      }

      updateRadar();
    }
  });

  // Обработчик закрытия панели приоритета сектора
  const closeQuadrantPriorityPanelBtn = document.getElementById('closeQuadrantPriorityPanel');
  if (closeQuadrantPriorityPanelBtn) {
    closeQuadrantPriorityPanelBtn.addEventListener('click', (e) => {
      e.preventDefault();
      // При клике на крестик считаем, что пользователь завершил просмотр сектора:
      // сбрасываем зум (unzoom сам закроет панель приоритета).
      unzoom();
    });
  }

  // Обработчики фильтров по статусам в панели приоритета
  if (quadrantPriorityPanel) {
    quadrantPriorityPanel.addEventListener('click', (e) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.classList.contains('qp-filter-btn')) {
        target.classList.toggle('active');
        if (currentZoomedQuadrant != null) {
          recomputeQuadrantPriorityList(currentZoomedQuadrant);
        }
      }
    });
  }

  // Обработчик поиска в панели приоритетов
  if (qpSearchInput) {
    const debouncedQpSearch = debounce(() => {
      if (currentZoomedQuadrant != null) {
        recomputeQuadrantPriorityList(currentZoomedQuadrant);
      }
    }, 300);
    qpSearchInput.addEventListener('input', debouncedQpSearch);
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.custom-select').forEach(s => s.classList.remove('open'));
    }
    const active = document.activeElement?.closest('.custom-select');
    if (!active || !active.classList.contains('open')) return;
    const items = Array.from(active.querySelectorAll('.select-options li'));
    if (items.length === 0) return;
    let idx = parseInt(active.getAttribute('data-kb-index') || '-1', 10);
    if (e.key === 'ArrowDown') idx = Math.min(idx + 1, items.length - 1);
    if (e.key === 'ArrowUp') idx = Math.max(idx - 1, 0);
    if (['ArrowDown', 'ArrowUp'].includes(e.key)) {
      e.preventDefault();
      active.setAttribute('data-kb-index', String(idx));
      items.forEach((el, i) => el.classList.toggle('selected', i === idx));
      items[idx].scrollIntoView({ block: 'nearest' });
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const sel = active.querySelector('.select-options li.selected') || items[0];
      if (sel) sel.click();
    }
  });

  // Поиск в фильтрах
  document.addEventListener('input', (e) => {
    const wrap = e.target.closest('.select-search');
    if (!wrap) return;
    const select = wrap.closest('.custom-select') || wrap.closest('.custom-select-modal');
    const list = select?.querySelector('.select-options');
    if (!list) return;
    const query = (e.target.value || '').toLowerCase();
    const items = Array.from(list.querySelectorAll('li[data-value]'));
    const starts = [];
    const contains = [];
    items.forEach(li => {
      const txt = (li.textContent || '').toLowerCase();
      if (!query) { starts.push(li); return; }
      if (txt.startsWith(query)) starts.push(li);
      else if (txt.includes(query)) contains.push(li);
      else li.style.display = 'none';
    });
    let idx = 0;
    [...starts, ...contains].forEach(li => {
      li.style.display = '';
      li.style.order = String(idx++);
    });
  });

  // Обработчики модальных селектов
  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('.custom-select-modal .select-trigger');
    if (trigger) {
      const select = trigger.closest('.custom-select-modal');
      document.querySelectorAll('.custom-select-modal').forEach(s => {
        if (s !== select) s.classList.remove('open');
      });
      select.classList.toggle('open');
      if (select.classList.contains('open')) positionOptions(select);
      const searchInputInside = select.querySelector('.select-search input');
      if (searchInputInside) setTimeout(() => searchInputInside.focus(), 0);
      return;
    }
    // Обработка клика на span внутри option-label - делаем его кликабельным
    // Находим li через span, чтобы обработать клик так же, как клик на li
    let li = null;
    const span = e.target.closest('.custom-select-modal .option-label span');
    if (span) {
      const label = span.closest('.option-label');
      li = label ? label.closest('.custom-select-modal .select-options li') : null;
    }

    // Если li не найден через span, ищем обычным способом
    if (!li) {
      li = e.target.closest('.custom-select-modal .select-options li');
    }
    if (li) {
      const select = li.closest('.custom-select-modal');
      const hiddenInputId = select.dataset.field;
      const hiddenInput = document.getElementById(hiddenInputId);
      const isMulti = select.getAttribute('data-multi') === 'true';

      // Пропускаем клики по элементам поиска
      if (li.classList.contains('select-search')) return;

      // Определяем, есть ли чекбоксы в этом селекте
      const hasCheckboxes = ['techBlock', 'techFunc', 'editBlock', 'editFunc'].includes(hiddenInputId);

      // Обработка "Выбрать все" для селектов с чекбоксами
      if (li.classList.contains('select-all-option') && isMulti && hasCheckboxes) {
        const allCheckbox = li.querySelector('input[type="checkbox"]');
        // Переключаем состояние (если кликнули не на сам чекбокс, переключаем его)
        if (e.target !== allCheckbox) {
          allCheckbox.checked = !allCheckbox.checked;
        }
        const shouldSelectAll = allCheckbox.checked;

        const optionLis = Array.from(select.querySelectorAll('.select-options li.select-option-item'));
        optionLis.forEach(optLi => {
          optLi.classList.toggle('selected', shouldSelectAll);
          const cb = optLi.querySelector('input[type="checkbox"]');
          if (cb) cb.checked = shouldSelectAll;
        });

        const selectedValues = shouldSelectAll
          ? optionLis.map(optLi => optLi.getAttribute('data-value')).filter(v => v && v.length > 0)
          : [];

        if (hiddenInput) hiddenInput.value = JSON.stringify(selectedValues);
        select.setAttribute('data-value', hiddenInput ? hiddenInput.value : JSON.stringify(selectedValues));

        renderMultiSelectTags(select);
        positionOptions(select);

        // Динамическая фильтрация
        if (hiddenInputId === 'techBlock') {
          updateModalFunctionsForBlocks(selectedValues, 'techFunc');
        } else if (hiddenInputId === 'editBlock') {
          updateModalFunctionsForBlocks(selectedValues, 'editFunc');
        }
        return;
      }

      const value = li.getAttribute('data-value');
      const text = li.textContent;

      if (isMulti) {
        // toggle selected
        li.classList.toggle('selected');

        // Обновляем состояние чекбокса, если он есть
        if (hasCheckboxes) {
          const checkbox = li.querySelector('input[type="checkbox"]');
          if (checkbox && e.target !== checkbox) {
            checkbox.checked = li.classList.contains('selected');
          } else if (checkbox && e.target === checkbox) {
            // Если кликнули на сам чекбокс, синхронизируем класс с его состоянием
            li.classList.toggle('selected', checkbox.checked);
          }
        }

        // Получаем выбранные значения (для селектов с чекбоксами используем select-option-item)
        const selectedSelector = hasCheckboxes
          ? '.select-options li.select-option-item.selected'
          : '.select-options li.selected';
        const selected = Array.from(select.querySelectorAll(selectedSelector))
          .map(x => x.getAttribute('data-value'))
          .filter(v => v && v.length > 0);

        if (hiddenInput) hiddenInput.value = JSON.stringify(selected);
        select.setAttribute('data-value', hiddenInput ? hiddenInput.value : JSON.stringify(selected));

        // Синхронизация состояния чекбокса "Выбрать все"
        if (hasCheckboxes) {
          const allLi = select.querySelector('.select-all-option');
          const allCheckbox = allLi ? allLi.querySelector('input[type="checkbox"]') : null;
          if (allCheckbox) {
            const optionLis = Array.from(select.querySelectorAll('.select-options li.select-option-item'));
            const allSelected = optionLis.length > 0 && optionLis.every(optLi => optLi.classList.contains('selected'));
            allCheckbox.checked = allSelected;
          }
        }

        // render tags for multi-selects
        renderMultiSelectTags(select);
        // keep the dropdown open for multi-select
        positionOptions(select);
        // Если это поле techCompany, обновляем видимость полей оценок
        if (hiddenInputId === 'techCompany') {
          setTimeout(() => {
            updateTechRatingsVisibility();
          }, 50);
        }
        // Динамическая фильтрация блоков и функций в модалке добавления технологии
        if (hiddenInputId === 'techSector') {
          // При изменении сектора пересчитываем доступные блоки и функции
          updateModalBlocksForSectors(selected);
        } else if (hiddenInputId === 'techBlock') {
          // При изменении блока(ов) пересчитываем функции для модалки добавления технологии
          updateModalFunctionsForBlocks(selected, 'techFunc');
        } else if (hiddenInputId === 'editBlock') {
          // Аналогично для модалки редактирования технологии
          updateModalFunctionsForBlocks(selected, 'editFunc');
        }
        return;
      }
      // single-select (existing behavior)
      // Если выбран placeholder (пустое значение) — полностью сбросим
      if (!value) {
        if (hiddenInput) hiddenInput.value = '';
        select.setAttribute('data-value', '');
        select.querySelector('.selected-text').textContent = select.getAttribute('data-placeholder') || 'Выберите';
        select.querySelectorAll('.select-options li').forEach(opt => opt.classList.remove('selected'));
        select.classList.remove('open');
        return;
      }
      if (hiddenInput) hiddenInput.value = value;
      select.setAttribute('data-value', value);
      select.querySelector('.selected-text').textContent = text;
      select.querySelectorAll('.select-options li').forEach(opt => opt.classList.toggle('selected', opt === li));
      select.classList.remove('open');
      return;
    }
    if (!e.target.closest('.custom-select-modal')) {
      document.querySelectorAll('.custom-select-modal').forEach(s => s.classList.remove('open'));
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.custom-select-modal').forEach(s => s.classList.remove('open'));
    }
    const active = e.target.closest('.custom-select-modal');
    if (!active || !active.classList.contains('open')) return;
    const items = Array.from(active.querySelectorAll('.select-options li'));
    if (items.length === 0) return;
    let idx = parseInt(active.getAttribute('data-kb-index') || '-1', 10);
    if (e.key === 'ArrowDown') idx = Math.min(idx + 1, items.length - 1);
    if (e.key === 'ArrowUp') idx = Math.max(idx - 1, 0);
    if (['ArrowDown', 'ArrowUp'].includes(e.key)) {
      e.preventDefault();
      active.setAttribute('data-kb-index', String(idx));
      items.forEach((el, i) => el.classList.toggle('selected', i === idx));
      items[idx].scrollIntoView({ block: 'nearest' });
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const sel = active.querySelector('.select-options li.selected') || items[0];
      if (sel) sel.click();
    }
  });

  // Поиск в модальных селектах
  document.addEventListener('input', (e) => {
    const wrap = e.target.closest('.select-search');
    if (!wrap) return;
    const select = wrap.closest('.custom-select-modal');
    const list = select?.querySelector('.select-options');
    if (!list) return;
    const query = (e.target.value || '').toLowerCase();
    const items = Array.from(list.querySelectorAll('li[data-value]'));
    const starts = [];
    const contains = [];
    items.forEach(li => {
      const txt = (li.textContent || '').toLowerCase();
      if (!query) { starts.push(li); return; }
      if (txt.startsWith(query)) starts.push(li);
      else if (txt.includes(query)) contains.push(li);
      else li.style.display = 'none';
    });
    let idx = 0;
    [...starts, ...contains].forEach(li => {
      li.style.display = '';
      li.style.order = String(idx++);
    });
  });

  // Предприятия
  const enterpriseButtons = document.querySelectorAll(".enterprise-nav button");
  enterpriseButtons.forEach(button => {
    if (button.textContent.trim() === currentEnterprise) {
      button.classList.add("active");
    }
  });
  enterpriseButtons.forEach(button => {
  button.addEventListener("click", () => {
    const selectedEnterprise = button.textContent.trim();
    if (selectedEnterprise === currentEnterprise) return;

    // Обновляем UI кнопок
    document.querySelectorAll(".enterprise-nav button").forEach(b => b.classList.remove("active"));
    button.classList.add("active");
    localStorage.setItem("selectedEnterprise", selectedEnterprise);

    // Immediately switch enterprise (use current in-memory enterpriseData which may come from VFS)
    try { switchEnterprise(selectedEnterprise); } catch (err) { console.warn('switchEnterprise failed', err); }

    // Генерируем событие для плавного перехода
    window.dispatchEvent(new CustomEvent('enterpriseChanged', {
      detail: { enterprise: selectedEnterprise }
    }));
  });
});

  // Плавный локальный переход между предприятиями через событие enterpriseChanged
  // Если событие пришло (например, из script.js), выполним плавную смену без перезагрузки
  window.addEventListener('enterpriseChanged', (ev) => {
    try {
      const ent = ev?.detail?.enterprise || localStorage.getItem('selectedEnterprise');
      if (!ent || ent === currentEnterprise) return;
      // Лёгкая анимация: затемнение контейнера радара и сайдбара
      const main = document.querySelector('main') || document.body;
      main.style.transition = 'opacity 260ms ease';
      main.style.opacity = '1';

      setTimeout(() => {
    switchEnterprise(ent);
        renderAuth();
        updateRadar(); // теперь это не перерисовывает фон → нет скачков

        requestAnimationFrame(() => {
          main.style.opacity = '1';
          setTimeout(() => {
            main.style.transition = '';
          }, 300);
        });
      }, 260);
    } catch (e) {
      console.error('Ошибка в обработчике enterpriseChanged:', e);
    }
  });

  // Сброс
  // Функция сброса фильтров и выбора
  const resetFiltersAndSelection = () => {
    document.querySelectorAll(".sector-item").forEach(i => i.classList.remove("active"));
    document.querySelectorAll('.tech-list').forEach(tl => tl.remove());
    document.querySelectorAll('.custom-select').forEach(select => {
      const filterKey = select.getAttribute('data-filter');
      const hiddenInput = filterKey ? document.getElementById(`filter_${filterKey}`) : null;
      select.setAttribute('data-value', '');
      if (hiddenInput) hiddenInput.value = '';
      const placeholder = select.getAttribute('data-placeholder') || 'Выберите';
      const selectedText = select.querySelector('.selected-text');
      if (selectedText) {
        selectedText.textContent = placeholder;
        selectedText.innerHTML = placeholder; // Очищаем теги
      }
      // Снимаем выделение со всех элементов
      select.querySelectorAll('.select-options li').forEach(li => li.classList.remove('selected'));
    });
    document.querySelectorAll('.custom-select .select-search input').forEach(inp => { inp.value = ''; inp.dispatchEvent(new Event('input')); });
    searchInput.value = "";
    updateRadar();
    selectedBlipId = null;
    svg.querySelectorAll('.blip.highlighted').forEach(el => el.classList.remove('highlighted'));
    svg.querySelectorAll('.blip.selected').forEach(el => el.classList.remove('selected'));
    currentTech = null;
    if (detailPanel.classList.contains('active')) {
      detailPanel.classList.remove('active');
      detailPanel.style.display = 'none';
    }
    unzoom();
    showNotification('Выбор сброшен!', true);
  };

  document.getElementById("resetSectorBtn").addEventListener("click", resetFiltersAndSelection);

  // Обработчик для кнопки "Сбросить выбор" (работает как в sidebar-buttons, так и в filterPanel)
  const resetIconBtn = document.getElementById('resetIconBtn');
  if (resetIconBtn) {
    resetIconBtn.addEventListener('click', (e) => {
      // Если кнопка находится в sidebar-buttons, вызываем resetSectorBtn
      // Если в filterPanel - вызываем функцию напрямую
      const resetSectorBtn = document.getElementById("resetSectorBtn");
      if (resetSectorBtn) {
        resetSectorBtn.click();
      } else {
        resetFiltersAndSelection();
      }

      // Анимация иконки
      const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!prefersReduced) {
        const svg = resetIconBtn.querySelector('.icon-broom-leaf');
        if (svg) {
          svg.classList.remove('animate');
          void svg.offsetWidth;
          svg.classList.add('animate');
          setTimeout(() => svg.classList.remove('animate'), 1500);
        }
      }
    });
  }

  // --- Microinteraction handlers for bottom buttons and filter ---
  // Utility: respect prefers-reduced-motion
  const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Broom animation (reset button) — applied to inline SVG with class .icon-broom
  const resetBtn = document.getElementById('resetSectorBtn');
if (resetBtn) {
  resetBtn.addEventListener('click', () => {
    if (prefersReduced) return;

    const svg = resetBtn.querySelector('.icon-broom-leaf');
    if (!svg) return;

    svg.classList.remove('animate');
    void svg.offsetWidth;
    svg.classList.add('animate');

    setTimeout(() => svg.classList.remove('animate'), 1500);
  });
}

  // Export PDF animation — lines draw sequentially + pop
  const exportBtn = document.getElementById('exportPdfBtn');
  if (exportBtn) {
    exportBtn.addEventListener('click', (ev) => {
      if (prefersReduced) return;
      const svg = exportBtn.querySelector('.icon-pdf');
      if (!svg) return;
      svg.classList.remove('animate'); void svg.offsetWidth; svg.classList.add('animate');
      // Remove after 900ms (animation length)
      setTimeout(() => svg.classList.remove('animate'), 950);
    });
  }

  // Add tech button pulse
  const addBtn = document.getElementById('addTechBtn');
  if (addBtn) {
    addBtn.addEventListener('click', (ev) => {
      if (prefersReduced) return;
      const svgWrap = addBtn.querySelector('.icon-add');
      if (!svgWrap) return;
      svgWrap.classList.remove('animate'); void svgWrap.offsetWidth; svgWrap.classList.add('animate');
      setTimeout(() => svgWrap.classList.remove('animate'), 650);
    });
  }

  // Filter button: toggle animation
  if (filterBtn && filterPanel) {
    let wasOpen = filterPanel.classList.contains('open');

    const updateIconState = () => {
      const icon = filterBtn.querySelector('svg') || filterBtn.querySelector('.icon-filter');
      if (!icon) return;
      if (prefersReduced) return;

      const isOpen = filterPanel.classList.contains('open');

      // Если состояние изменилось, запускаем анимацию
      if (isOpen !== wasOpen) {
        // Удаляем все классы анимации
        icon.classList.remove('toggle', 'filter-reset');
        // Принудительно перерисовываем, чтобы сбросить предыдущую анимацию
        void icon.offsetWidth;

        if (isOpen) {
          // Открываем - запускаем анимацию вращения
          icon.classList.add('toggle');
        } else {
          // Закрываем - запускаем анимацию возврата
          icon.classList.add('filter-reset');
        }

        wasOpen = isOpen;
      }
    };

    // Следим за изменениями класса open на filterPanel
    const observer = new MutationObserver(updateIconState);
    observer.observe(filterPanel, { attributes: true, attributeFilter: ['class'] });

    // Инициализируем начальное состояние
    updateIconState();
  }

  // ===== Анимации для кнопок боковой панели =====
  // Reset button animation уже обрабатывается выше в обработчике resetIconBtn

  // Filter icon button animation (filterIconBtn)
  const filterIconBtn = document.getElementById('filterIconBtn');
  if (filterIconBtn && filterPanel) {
    let filterIconWasOpen = filterPanel.classList.contains('open');
    const updateFilterIconState = () => {
      const icon = filterIconBtn.querySelector('.icon-filter');
      if (!icon) return;
      if (prefersReduced) return;
      const isOpen = filterPanel.classList.contains('open');
      if (isOpen !== filterIconWasOpen) {
        icon.classList.remove('toggle', 'filter-reset');
        void icon.offsetWidth;
        if (isOpen) {
          icon.classList.add('toggle');
        } else {
          icon.classList.add('filter-reset');
        }
        filterIconWasOpen = isOpen;
      }
    };
    const filterObserver = new MutationObserver(updateFilterIconState);
    filterObserver.observe(filterPanel, { attributes: true, attributeFilter: ['class'] });
    updateFilterIconState();
  }

  // Add icon button animation (addIconBtn)
  const addIconBtn = document.getElementById('addIconBtn');
  if (addIconBtn) {
    addIconBtn.addEventListener('click', (ev) => {
      if (prefersReduced) return;
      const svgWrap = addIconBtn.querySelector('.icon-add');
      if (!svgWrap) return;
      svgWrap.classList.remove('animate');
      void svgWrap.offsetWidth;
      svgWrap.classList.add('animate');
      setTimeout(() => svgWrap.classList.remove('animate'), 650);
    });
  }

  // Report/Export PDF icon button animation (reportIconBtn)
  const reportIconBtn = document.getElementById('reportIconBtn');
  if (reportIconBtn) {
    reportIconBtn.addEventListener('click', (ev) => {
      if (prefersReduced) return;
      const svg = reportIconBtn.querySelector('.icon-pdf');
      if (!svg) return;
      svg.classList.remove('animate');
      void svg.offsetWidth;
      svg.classList.add('animate');
      setTimeout(() => svg.classList.remove('animate'), 950);
    });
  }

  // Клик по радару
  svg.addEventListener("click", (e) => {
    const blip = e.target.closest(".blip");
    const sector = e.target.closest(".quadrant-group");
      if (blip) {
      const id = +blip.dataset.id;
      currentTech = technologies.find(t => t.id === id);
      if (!currentTech) return;
      selectedBlipId = id;
      svg.querySelectorAll('.blip.selected').forEach(el => el.classList.remove('selected'));
      blip.classList.remove('highlighted'); // бордер только для hover
      blip.classList.add('selected');
      if (detailPanel) {
        console.debug('Открытие панели подробной информации (по клику на блип)', { id: currentTech.id, name: currentTech.name });
        showDetail(currentTech);
      } else {
        console.warn('detailPanel не найден в DOM, не могу показать подробности', currentTech);
      }
      const blockKeyZoom = (currentTech.blocks && currentTech.blocks.length) ? currentTech.blocks[0] : currentTech.block;
      zoomQuadrant(getQuadrantIdForBlock(blockKeyZoom));

      try {
    const q = getQuadrantIdForBlock(blockKeyZoom);
        const sectorItem = document.querySelector(`.sector-item[data-quadrant="${q}"]`);
        if (sectorItem) {
          document.querySelectorAll(".sector-item").forEach(i => i.classList.remove("active"));
          sectorItem.classList.add("active");
          const existing = sectorItem.nextElementSibling;
          if (existing && existing.classList.contains('tech-list')) {
            const listItem = existing.querySelector(`.tech-list-item[data-tech-id="${currentTech.id}"]`);
            if (listItem) {
              existing.querySelectorAll('.tech-list-item').forEach(li => li.classList.remove('selected'));
              listItem.classList.add('selected');
              listItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
          } else {
            // Открыть список сектора и подсветить технологию
            document.querySelectorAll('.tech-list').forEach(tl => tl.parentNode?.removeChild(tl));
            createTechListForSector(sectorItem, q, technologies);
            const newList = sectorItem.nextElementSibling;
            if (newList && newList.classList.contains('tech-list')) {
              const listItem = newList.querySelector(`.tech-list-item[data-tech-id="${currentTech.id}"]`);
              if (listItem) {
                newList.querySelectorAll('.tech-list-item').forEach(li => li.classList.remove('selected'));
                listItem.classList.add('selected');
                listItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
              }
            }
          }
        }
      } catch (err) {
        console.warn('Не удалось открыть сектор в сайдбаре:', err);
      }
    } else if (sector) {
        const qId = +sector.dataset.quadrant;
        // Проверяем, есть ли технологии в этом секторе
        const hasTechs = technologies.some(t => getQuadrantIdForBlock(t.block) === qId);
        if (!hasTechs) {
          showNotification('На данный момент в данном секторе отсутствуют технологии, но мы активно работаем над внедрением новых технологий.', false);
          return;
        }
        unzoom();
        setTimeout(() => zoomQuadrant(qId, { source: 'sector' }), 50);

        // Подсветка и раскрытие в сайдбаре — эмулируем клик, чтобы раскрыть список
        const sidebarItem = document.querySelector(`.sector-item[data-quadrant="${qId}"]`);
        if (sidebarItem) {
          // Закроем другие и откроем нужный — сработает логика в обработчике click на секторе
          sidebarItem.click();
        }
      } else {
      if (detailPanel.classList.contains("active")) {
        detailPanel.classList.remove('active');
        detailPanel.style.display = 'none';
      }
      selectedBlipId = null;
      svg.querySelectorAll('.blip.highlighted').forEach(el => el.classList.remove('highlighted'));
      svg.querySelectorAll('.blip.selected').forEach(el => el.classList.remove('selected'));
      document.querySelectorAll('.tech-list').forEach(tl => tl.parentNode?.removeChild(tl));
      document.querySelectorAll('.sector-item').forEach(i => i.classList.remove('active'));
      document.querySelectorAll('.tech-list-item.selected').forEach(li => li.classList.remove('selected'));
      currentTech = null;
      unzoom();
    }
  });

  // Общий сброс по клику вне:
  // считаем "пустым местом" всё, что не относится к модальным окнам, радару или левой панели.
  document.addEventListener('click', (e) => {
    // Проверяем, был ли клик на элементы левой панели / фильтров
    const clickedOnSidebarInteractive = e.target.closest('.sidebar-wrapper') ||
                                        e.target.closest('.sector-item') ||
                                        e.target.closest('.tech-list-item') ||
                                        e.target.closest('.search-box') ||
                                        e.target.closest('.filter-toggle-btn') ||
                                        e.target.closest('.custom-select') ||
                                        e.target.closest('.filter-panel-sidebar');

    // Клики внутри модалок, попапов, хэдера, блока управлений, радара и панели приоритетов не считаем "пустым местом"
    if (clickedOnSidebarInteractive ||
        e.target.closest('.modal-panel') ||
        e.target.closest('.popover-menu') ||
        e.target.closest('header') ||
        e.target.closest('.controls') ||
        e.target.closest('#techRadar') ||
        e.target.closest('.detail-panel') ||
        e.target.closest('#quadrantPriorityPanel')) {
      return;
    }

    document.querySelectorAll('.sector-item').forEach(i => i.classList.remove('active'));
    document.querySelectorAll('.tech-list').forEach(tl => tl.parentNode?.removeChild(tl));
    document.querySelectorAll('.custom-select').forEach(s => s.classList.remove('open'));
    document.querySelectorAll('.tech-list-item.selected').forEach(li => li.classList.remove('selected'));
    selectedBlipId = null;
    svg.querySelectorAll('.blip.highlighted').forEach(el => el.classList.remove('highlighted'));
    svg.querySelectorAll('.blip.selected').forEach(el => el.classList.remove('selected'));
    currentTech = null;
    if (detailPanel.classList.contains('active')) {
      detailPanel.classList.remove('active');
      detailPanel.style.display = 'none';
    }
    unzoom();
    // Сбрасываем активные фильтры и поиск
    document.querySelectorAll('.custom-select').forEach(select => {
      select.setAttribute('data-value', '');
      const placeholder = select.getAttribute('data-placeholder') || 'Выберите';
      const st = select.querySelector('.selected-text');
      if (st) st.textContent = placeholder;
    });
    document.querySelectorAll('.custom-select .select-search input').forEach(inp => { inp.value = ''; inp.dispatchEvent(new Event('input')); });
    if (typeof searchInput !== 'undefined' && searchInput) searchInput.value = "";
    updateRadar();
  });
  const closeDetailEl = document.getElementById("closeDetailPanel");
  if (closeDetailEl) {
    closeDetailEl.addEventListener("click", () => {
      detailPanel.classList.remove("active");
      detailPanel.style.display = "none";
    });
  } else {
    console.warn('RMK2.js: #closeDetailPanel not found in DOM — cannot bind close detail action');
  }

  // Кнопка «Назад» в панели подробной информации:
  // закрывает детали и, если сектор всё ещё в зуме, возвращает панель приоритета
  if (detailPanel) {
    const detailHeader = detailPanel.querySelector('.detail-header');
    if (detailHeader) {
      let backBtn = detailPanel.querySelector('#detailBackFromPriorityBtn');
      if (!backBtn) {
        backBtn = document.createElement('button');
        backBtn.type = 'button';
        backBtn.id = 'detailBackFromPriorityBtn';
        backBtn.className = 'detail-back-btn';
        backBtn.setAttribute('aria-label', 'Назад к списку технологий');
        backBtn.setAttribute('data-tooltip', 'Назад к списку технологий');
        backBtn.title = 'Назад к списку технологий';
        backBtn.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M15.5 19.5L8 12l7.5-7.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        `;
        // По умолчанию скрыта — будет показана только при открытии из панели приоритетов
        backBtn.style.display = 'none';
        // Вставляем слева от заголовка
        detailHeader.insertBefore(backBtn, detailHeader.firstChild);
      }

      backBtn.addEventListener('click', (ev) => {
        // Не даём клику всплыть до документа, чтобы не сработал
        // глобальный обработчик клика "по пустому месту" с unzoom()
        ev.stopPropagation();

        // Скрываем панель подробной информации
        detailPanel.classList.remove('active');
        detailPanel.style.display = 'none';
        // Если по‑прежнему есть зуммированный сектор — возвращаем панель приоритета
        if (currentZoomedQuadrant != null) {
          // Убедимся, что зум сохранен и панель приоритета откроется с правильным списком
          const g = document.querySelector(`.quadrant-group.q${currentZoomedQuadrant}`);
          if (g && !g.classList.contains('zoomed-in')) {
            // Если зум был потерян, восстанавливаем его
            zoomQuadrant(currentZoomedQuadrant, { source: 'priority' });
          }
          // Открываем панель приоритета и явно обновляем список
          openQuadrantPriorityPanel(currentZoomedQuadrant);
          // Явно пересчитываем список, чтобы убедиться, что все технологии отображаются
          recomputeQuadrantPriorityList(currentZoomedQuadrant);
        }
      });
    }
  }

  // Секторы
  document.querySelectorAll(".sector-item").forEach(item => {
    item.addEventListener("mouseenter", () => {
      const q = parseInt(item.dataset.quadrant, 10);
      const g = document.querySelector(`.quadrant-group.q${q}`);
      if (g) g.classList.add("highlight");
    });
    item.addEventListener("mouseleave", () => {
      const q = parseInt(item.dataset.quadrant, 10);
      const g = document.querySelector(`.quadrant-group.q${q}`);
      if (g) g.classList.remove("highlight");
    });
    item.addEventListener("click", (ev) => {
      ev.stopPropagation();
      // Если сектор пустой — показываем уведомление и не раскрываем
      if (item.classList.contains('empty')) {
        showNotification('На данный момент в данном секторе отсутствуют технологии, но мы активно работаем над внедрением новых технологий.', false);
        return;
      }
      const q = parseInt(item.dataset.quadrant, 10);
      // закрыть открытые списки и отметить активный сектор
      document.querySelectorAll('.tech-list').forEach(tl => tl.parentNode?.removeChild(tl));
      document.querySelectorAll(".sector-item").forEach(i => i.classList.remove("active"));
      item.classList.add("active");

      unzoom();
    if (!Number.isNaN(q)) setTimeout(() => zoomQuadrant(q, { source: 'sector' }), 50);
    });
  });

  // Модальные окна
  const addBtnEl = document.getElementById("addTechBtn");
  if (addBtnEl) {
    addBtnEl.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!checkArchitectRole()) return;
      const pop = document.getElementById('addChoicePopover');
      if (!pop) return;
      if (pop.style.display === 'block' || pop.classList.contains('open')) {
        pop.classList.remove('open');
        pop.style.display = 'none';
        return;
      }
      const rect = addBtnEl.getBoundingClientRect();
      pop.style.display = 'block';
      pop.style.position = 'fixed';
      pop.style.top = `${rect.bottom + 8}px`;
      pop.style.left = `${Math.max(8, rect.left)}px`;
      requestAnimationFrame(() => {
        pop.classList.add('open');
        const pw = pop.offsetWidth;
        const ph = pop.offsetHeight;
        let top = rect.bottom + 8;
        let left = rect.left;
        if (top + ph + 8 > window.innerHeight) {
          const spaceRight = window.innerWidth - rect.right - 8;
          const spaceLeft = rect.left - 8;
          if (spaceRight >= pw) {
            top = rect.top + rect.height / 2 - ph / 2;
            top = Math.max(8, Math.min(top, window.innerHeight - ph - 8));
            left = rect.right + 8;
          } else if (spaceLeft >= pw) {
            top = rect.top + rect.height / 2 - ph / 2;
            top = Math.max(8, Math.min(top, window.innerHeight - ph - 8));
            left = rect.left - pw - 8;
          } else {
            top = Math.max(8, window.innerHeight - ph - 8);
            left = rect.left;
            if (left + pw + 8 > window.innerWidth) left = window.innerWidth - pw - 8;
            if (left < 8) left = 8;
          }
        } else {
          if (left + pw + 8 > window.innerWidth) left = window.innerWidth - pw - 8;
          if (left < 8) left = 8;
        }
        pop.style.top = `${Math.round(top)}px`;
        pop.style.left = `${Math.round(left)}px`;
      });
    });
  } else {
    console.warn('RMK2.js: #addTechBtn not found — cannot bind add-popup');
  }

  document.querySelectorAll(".close-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const panelId = e.currentTarget.dataset.close;
      const panel = panelId ? document.getElementById(panelId) : e.currentTarget.closest('.modal-panel');
      if (!panel) return;
      // Для модального окна подтверждения удаления не проверяем форму
      if (panel.id === 'deleteConfirmModal') {
        hideModal(panel);
        return;
      }
      const form = panel.querySelector('form');
      if (isFormDirty(form)) {
        showInternalConfirm('Вы заполнили/изменили некоторые поля. Уверены, что хотите закрыть? Все изменения будут потеряны.', () => {
          form?.reset();
          if (panel.id === 'addTechPanel') resetCustomSelects('add');
          if (panel.id === 'editTechPanel') resetCustomSelects('edit');
        }, panel);
      } else {
        hideModal(panel);
      }
    });
  });

  const chooseAddTechBtn = document.getElementById("chooseAddTech");
  if (chooseAddTechBtn) {
    chooseAddTechBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const pop = document.getElementById('addChoicePopover');
      if (pop) pop.style.display = 'none';
      showModal('addTechPanel');
      // Устанавливаем текущее предприятие по умолчанию
      setCustomSelectValue('techCompany', [currentEnterprise]);
      // Обновляем видимость полей оценок
      setTimeout(() => {
        updateTechRatingsVisibility();
      }, 100);
      snapshotFormInitial(document.getElementById('addTechForm'));
    });
  } else console.warn('RMK2.js: #chooseAddTech not found');

  // Обработчик изменения выбора предприятий в форме добавления технологии
  const techCompanyInput = document.getElementById('techCompany');
  if (techCompanyInput) {
    // Используем MutationObserver для отслеживания изменений значения
    const companyObserver = new MutationObserver(() => {
      updateTechRatingsVisibility();
    });
    companyObserver.observe(techCompanyInput, { attributes: true, attributeFilter: ['value'] });

    // Также слушаем события изменения через кастомный селект
    const techCompanySelect = document.querySelector('.custom-select-modal[data-field="techCompany"]');
    if (techCompanySelect) {
      // Отслеживаем изменения в скрытом поле через события
      techCompanyInput.addEventListener('change', updateTechRatingsVisibility);
      techCompanyInput.addEventListener('input', updateTechRatingsVisibility);

      // Отслеживаем клики по опциям в выпадающем списке
      const companyOptions = techCompanySelect.querySelector('.select-options');
      if (companyOptions) {
        companyOptions.addEventListener('click', (e) => {
          // Небольшая задержка, чтобы значение успело обновиться
          setTimeout(() => {
            updateTechRatingsVisibility();
          }, 50);
        });
      }
    }
  }
  const chooseAddBlockBtn = document.getElementById("chooseAddBlock");
  if (chooseAddBlockBtn) {
    chooseAddBlockBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const pop = document.getElementById('addChoicePopover');
      if (pop) pop.style.display = 'none';
      showModal('addBlockPanel');
      snapshotFormInitial(document.getElementById('addBlockForm'));
    });
  } else console.warn('RMK2.js: #chooseAddBlock not found');

  // Закрытие popover
  document.addEventListener('click', (e) => {
    const pop = document.getElementById('addChoicePopover');
    if (!pop) return;
    const isInside = e.target.closest && (e.target.closest('#addChoicePopover') || e.target.closest('#addTechBtn') || e.target.closest('#addIconBtn'));
    if (!isInside && (pop.style.display === 'block' || pop.classList.contains('open'))) {
      pop.classList.remove('open');
      pop.style.display = 'none';
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const pop = document.getElementById('addChoicePopover');
      if (pop && (pop.style.display === 'block' || pop.classList.contains('open'))) {
        pop.classList.remove('open');
        pop.style.display = 'none';
      }
      // Закрытие модального окна подтверждения удаления по Escape
      const deleteConfirmModal = document.getElementById('deleteConfirmModal');
      if (deleteConfirmModal && deleteConfirmModal.classList.contains('open')) {
        hideModal('deleteConfirmModal');
      }
    }
  });

  // Встроенное модальное подтверждение (создаётся динамически при необходимости)
  function showInternalConfirm(message, onCloseConfirmed) {
    let confirmEl = document.getElementById('internalConfirm');
    if (!confirmEl) {
      confirmEl = document.createElement('div');
      confirmEl.id = 'internalConfirm';
      confirmEl.className = 'modal-panel confirm-panel';
      confirmEl.innerHTML = `
        <div class="modal-header"><h2>Подтвердите действие</h2></div>
        <div class="modal-body"><p class="confirm-message"></p>
          <div class="form-actions" style="margin-top:12px; display:flex; gap:8px; justify-content:flex-end">
            <button class="btn-secondary" data-action="cancel">Отмена</button>
            <button class="btn-primary" data-action="close">Закрыть</button>
          </div>
        </div>`;
      document.body.appendChild(confirmEl);
      confirmEl.querySelector('[data-action="cancel"]').addEventListener('click', () => {
        confirmEl.classList.remove('open');
        setTimeout(() => confirmEl.style.display = 'none', 220);
      });
      confirmEl.querySelector('[data-action="close"]').addEventListener('click', (ev) => {
        ev.stopPropagation();
        confirmEl.classList.remove('open');
        // Сначала скрываем окно подтверждения, затем выполняем callback и гарантированно закрываем целевую панель
        setTimeout(() => {
          confirmEl.style.display = 'none';
          try { if (typeof confirmEl._onClose === 'function') confirmEl._onClose(); } catch(e) { console.error(e); }
          try {
            const related = confirmEl._relatedPanel;
            if (related) hideModal(related);
          } catch(e) { /* ignore */ }
        }, 220);
      });
    }
    confirmEl.querySelector('.confirm-message').textContent = message;
    // store callback and related panel on element for safe later invocation
    confirmEl._onClose = onCloseConfirmed;
    confirmEl._relatedPanel = arguments[2] || null;
    confirmEl.style.display = 'block';
    requestAnimationFrame(() => confirmEl.classList.add('open'));
  }

  // Закрытие модалей по клику вне: если форма изменилась — показать подтверждение
  document.addEventListener('click', (e) => {
    // Если это быстро после открытия модалки — игнорируем (предотвращаем мгновенное закрытие)
    if (Date.now() < ignoreOutsideClickUntil) return;
    // Игнорируем клики внутри модалей или по кнопкам открытия
    const mod = e.target.closest('.modal-panel');
    if (mod) {
      // Не закрываем модальное окно загрузки при клике вне его
      if (mod.id === 'reportLoadingModal') return;
      return;
    }

    // Проверяем, открыто ли модальное окно загрузки - не закрываем его при клике вне
    const loadingModal = document.getElementById('reportLoadingModal');
    if (loadingModal && (loadingModal.style.display === 'block' || loadingModal.classList.contains('open'))) {
      return;
    }
    // Закрываем popup выбора
    const pop = document.getElementById('addChoicePopover');
    if (pop && !e.target.closest('#addTechBtn') && !e.target.closest('#addIconBtn')) {
      if (pop.style.display === 'block' || pop.classList.contains('open')) { pop.classList.remove('open'); pop.style.display = 'none'; }
    }
    // Для каждой открытой модалки проверим dirty
    ['addTechPanel','editTechPanel','addBlockPanel'].forEach(id => {
      const panel = document.getElementById(id);
      if (!panel) return;
      if (panel.style.display !== 'block' && !panel.classList.contains('open')) return;
      // найдём форму внутри
      const form = panel.querySelector('form');
      const wasDirty = isFormDirty(form);
      if (!wasDirty) {
        hideModal(panel);
      } else {
        showInternalConfirm('Вы заполнили/изменили некоторые поля. Уверены, что хотите закрыть? Все изменения будут потеряны.', () => {
          // закрыть панель без сохранения
          // сбросим форму
          form?.reset();
          if (id === 'addTechPanel') resetCustomSelects('add');
          if (id === 'editTechPanel') resetCustomSelects('edit');
          if (id === 'addBlockPanel') {/* nothing extra */}
        }, panel);
      }
    });
  });

  // Функции в блоке
  function updateFunctionPlaceholders() {
    const rows = document.getElementById("functionsContainer").querySelectorAll('.function-row');
    rows.forEach((r, i) => {
      const inp = r.querySelector('input');
      if (inp) inp.placeholder = `Функция ${i + 1}`;
    });
  }
  document.getElementById("addFunctionRow").onclick = () => {
    const container = document.getElementById("functionsContainer");
    const count = container.querySelectorAll('.function-row').length;
    if (count >= 20) return;
  const row = document.createElement('div');
  row.className = 'function-row';
  row.style.display = 'flex';
  row.style.gap = '8px';
  row.style.alignItems = 'center';
  row.style.marginTop = '6px';
  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = `Функция ${count + 1}`;
  input.style.flex = '1';
  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'remove-fn-btn';
  // Используем кастомную подсказку (data-tooltip) вместо native title
  removeBtn.setAttribute('data-tooltip', 'Удалить функцию');
  removeBtn.setAttribute('aria-label', 'Удалить функцию');
  removeBtn.textContent = '×';
  // Остановим всплытие клика, чтобы глобальные document.click обработчики
  // не закрывали панель при удалении строки. Удаление должно влиять
  // только на конкретный элемент.
  removeBtn.addEventListener('click', (ev) => { ev.stopPropagation(); ev.preventDefault(); row.remove(); updateFunctionPlaceholders(); });
  row.appendChild(input);
  row.appendChild(removeBtn);
  container.appendChild(row);
  };


  // Формы
  document.getElementById("cancelAdd").onclick = () => hideModal('addTechPanel');
  document.getElementById("cancelEdit").onclick = () => hideModal('editTechPanel');
  document.getElementById("cancelAddBlock").onclick = () => hideModal('addBlockPanel');

  // Обработчики для модального окна подтверждения удаления
  const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");
  const cancelDeleteBtn = document.getElementById("cancelDeleteBtn");
  const closeDeleteConfirm = document.getElementById("closeDeleteConfirm");

  if (confirmDeleteBtn) {
    confirmDeleteBtn.onclick = () => {
      if (!currentTech) return;
      technologies = technologies.filter(t => t.id !== currentTech.id);
      detailPanel.classList.remove("active");
      detailPanel.style.display = "none";
      unzoom();
      updateRadar();
      try {
        enterpriseData[currentEnterprise] = [...technologies];
        vfsWrite('enterpriseData.json', enterpriseData);
      } catch (err) { console.warn('Не удалось сохранить enterpriseData после удаления', err); }
      showNotification('Технология удалена!', true);
      hideModal('deleteConfirmModal');
    };
  }

  if (cancelDeleteBtn) {
    cancelDeleteBtn.onclick = () => hideModal('deleteConfirmModal');
  }

  if (closeDeleteConfirm) {
    closeDeleteConfirm.onclick = () => hideModal('deleteConfirmModal');
  }

  // Обработчик добавления нового функционального блока
  const addBlockForm = document.getElementById('addBlockForm');
  if (addBlockForm) {
    addBlockForm.onsubmit = async (e) => {
      e.preventDefault();
      const nameInput = document.getElementById('blockName');
      const sectorInput = document.getElementById('blockSector');
      if (!nameInput) { showNotification('Не найдено поле имени блока (blockName)', false); return; }
      if (!sectorInput) { showNotification('Не найдено поле выбора сектора (blockSector)', false); return; }
      const blockName = (nameInput.value || '').trim();
      const sectorName = (sectorInput.value || '').trim();
      if (!blockName) { showNotification('Введите имя блока', false); return; }
      if (!sectorName) { showNotification('Выберите сектор', false); return; }
      // Найдём id квадранта по имени сектора
      const quad = QUADRANTS.find(q => q.name === sectorName) || QUADRANTS[0];
      const qId = quad ? quad.id : 1;
      // Обновим маппинг
      blockToQuadrant[blockName] = qId;
      // Добавим опцию в селекты (sidebar и модалки)
      const sidebarSelect = document.querySelector('.custom-select[data-filter="block"] .select-options');
      if (sidebarSelect) {
        const li = document.createElement('li'); li.textContent = blockName; li.setAttribute('data-value', blockName);
        sidebarSelect.appendChild(li);
      }
      const modalSelects = document.querySelectorAll('.custom-select-modal[data-field="techBlock"], .custom-select-modal[data-field="editBlock"]');
      modalSelects.forEach(ms => {
        const opts = ms.querySelector('.select-options');
        if (opts) {
          const li = document.createElement('li');
          li.classList.add('select-option-item');
          li.setAttribute('data-value', blockName);
          li.innerHTML = `<label class="option-label"><input type="checkbox" class="option-checkbox" /><span>${blockName}</span></label>`;
          opts.appendChild(li);
        }
      });
      // Разблокируем квадрант и подсвечиваем сектор
  // const qId already set above
      if (qId != null) {
        const g = document.querySelector(`.quadrant-group.q${qId}`);
        if (g) g.classList.remove('empty');
        const sidebarItem = document.querySelector(`.sector-item[data-quadrant="${qId}"]`);
        if (sidebarItem) {
          sidebarItem.classList.remove('empty');
          document.querySelectorAll('.sector-item').forEach(i => i.classList.remove('active'));
          sidebarItem.classList.add('active');
        }
      }
      // persist updated blocks list and mapping to VFS
      try {
        if (!blocksList.includes(blockName)) blocksList.push(blockName);
        vfsWrite('bloks.json', blocksList);
        vfsWrite('blockToQuadrant.json', blockToQuadrant);
      } catch (err) { console.warn('Не удалось сохранить блоки в VFS', err); }
      hideModal('addBlockPanel');
      showNotification('Функциональный блок добавлен и сектор разблокирован', true);
    };
  }

  document.getElementById("addTechForm").onsubmit = (e) => {
    e.preventDefault();
    const rawSector = document.getElementById("techSector")?.value || '';
    let sectorVal = rawSector;
    try {
      if (rawSector && rawSector.trim().startsWith('[')) {
        sectorVal = JSON.parse(rawSector);
      }
    } catch (err) {
      // ignore parse error, оставим исходное значение
      sectorVal = rawSector;
    }
    const sectorArray = Array.isArray(sectorVal)
      ? sectorVal.map(s => (typeof s === 'string' ? s.trim() : s)).filter(Boolean)
      : ((typeof sectorVal === 'string' && sectorVal.trim()) ? [sectorVal.trim()] : []);
    const sectorName = sectorArray.length > 0 ? sectorArray[0] : '';
    const rawBlock = document.getElementById("techBlock").value;
    const rawFunc = document.getElementById("techFunc").value;
    const selStatus = (document.getElementById("techStatus")?.value || '').trim();
    let blocksVal = rawBlock;
    let functionsVal = rawFunc;
    try {
      if (rawBlock && rawBlock.trim().startsWith('[')) blocksVal = JSON.parse(rawBlock);
    } catch (err) { /* ignore */ }
    try {
      if (rawFunc && rawFunc.trim().startsWith('[')) functionsVal = JSON.parse(rawFunc);
    } catch (err) { /* ignore */ }

    // Нормализуем входные значения блоков/функций (обрезаем пробелы)
    const rawBlockVal = Array.isArray(blocksVal)
      ? blocksVal.map(b => (typeof b === 'string' ? b.trim() : b))
      : (typeof blocksVal === 'string' ? blocksVal.trim() : blocksVal);
    const rawFuncVal = Array.isArray(functionsVal)
      ? functionsVal.map(f => (typeof f === 'string' ? f.trim() : f))
      : (typeof functionsVal === 'string' ? functionsVal.trim() : functionsVal);

    // Обработка выбранных предприятий
    const rawCompany = document.getElementById("techCompany")?.value || '';
    let companiesVal = [];
    try {
      if (rawCompany && rawCompany.trim().startsWith('[')) {
        companiesVal = JSON.parse(rawCompany);
      } else if (rawCompany) {
        companiesVal = [rawCompany];
      }
    } catch (err) {
      if (rawCompany) companiesVal = [rawCompany];
    }
    // Если предприятия не выбраны, используем текущее предприятие
    if (companiesVal.length === 0) {
      companiesVal = [currentEnterprise];
    }

    const t = {
      id: nextId++,
      name: (document.getElementById("techName").value || '').trim(),
      // Если выбран несколько секторов, в поле sector сохраняем массив,
      // при одном секторе — строку (обратная совместимость)
      sector: sectorArray.length > 1 ? sectorArray : sectorName,
      block: Array.isArray(rawBlockVal) ? (rawBlockVal[0] || '') : (rawBlockVal || ''),
      blocks: Array.isArray(rawBlockVal) ? rawBlockVal : (rawBlockVal ? [rawBlockVal] : []),
      func: Array.isArray(rawFuncVal) ? (rawFuncVal[0] || '') : (rawFuncVal || ''),
      functions: Array.isArray(rawFuncVal) ? rawFuncVal : (rawFuncVal ? [rawFuncVal] : []),
      techType: '',
      level: '',
      company: companiesVal.length === 1 ? companiesVal[0] : companiesVal,
      description: (document.getElementById("techDesc").value || '').trim(),
      exampleDesc: (document.getElementById('techExampleDesc')?.value || '').trim(),
    };
    // Уровень (статус)
    t.level = selStatus || ((RINGS && RINGS.length) ? RINGS[0] : 'Используемые');
    t.status = t.level;
    // Стоимость внедрения — для всех статусов
    const costVal = Number(document.getElementById('techCostProm')?.value);
    if (!Number.isNaN(costVal)) t.costProm = costVal; else delete t.costProm;
    // Оценки (0–3) - сохраняем только если значение заполнено
    const clamp03 = (n) => Math.max(0, Math.min(3, Number(n)));
    const fc = document.getElementById('techFuncCover')?.value;
    if (fc !== undefined && fc !== null && fc !== '' && String(fc).trim() !== '') {
      t.funcCover = clamp03(fc);
    }

    // Обработка оценок готовности в зависимости от количества предприятий
    if (companiesVal.length === 1) {
      // Одно предприятие - сохраняем как обычно
      const tr = document.getElementById('techTechRead')?.value;
      const or = document.getElementById('techOrganRead')?.value;
      if (tr !== undefined && tr !== null && tr !== '' && String(tr).trim() !== '') {
        t.techRead = clamp03(tr);
      }
      if (or !== undefined && or !== null && or !== '' && String(or).trim() !== '') {
        t.organRead = clamp03(or);
      }
    } else if (companiesVal.length > 1) {
      // Несколько предприятий - собираем оценки из динамических полей
      const companyRatings = {};
      let hasAnyRatings = false;
      companiesVal.forEach(company => {
        const techReadInput = document.getElementById(`techTechRead_${company}`);
        const organReadInput = document.getElementById(`techOrganRead_${company}`);
        const techReadVal = techReadInput?.value;
        const organReadVal = organReadInput?.value;

        const ratings = {};
        if (techReadVal !== undefined && techReadVal !== null && techReadVal !== '' && String(techReadVal).trim() !== '') {
          ratings.techRead = clamp03(techReadVal);
          hasAnyRatings = true;
        }
        if (organReadVal !== undefined && organReadVal !== null && organReadVal !== '' && String(organReadVal).trim() !== '') {
          ratings.organRead = clamp03(organReadVal);
          hasAnyRatings = true;
        }

        if (Object.keys(ratings).length > 0) {
          companyRatings[company] = ratings;
        }
      });

      if (hasAnyRatings) {
        t.companyRatings = companyRatings;
      }
      // Также сохраняем общие значения, если они были заполнены (для обратной совместимости)
      // Но приоритет будет отдаваться companyRatings
    }
    t.techType = document.getElementById('techTechType')?.value || '';
    // Определим форму по techType, если указана
    const shapeFromType = computeShapeByTechType(t.techType);
    if (shapeFromType) t.shape = shapeFromType;
    // Детеминированное расположение
    // Если блок не сопоставлен с квадрантом — добавим маппинг по умолчанию и опцию в селекты
    // Гарантируем канонический ключ для поиска квадранта и запишем обратно в t.block
    const blockKeyForLookup = (t.blocks && t.blocks.length) ? (typeof t.blocks[0] === 'string' ? t.blocks[0].trim() : t.blocks[0]) : (typeof t.block === 'string' ? t.block.trim() : t.block);
    t.block = blockKeyForLookup;
    if (!blockToQuadrant.hasOwnProperty(blockKeyForLookup) || blockToQuadrant[blockKeyForLookup] == null) {
      blockToQuadrant[blockKeyForLookup] = 1;
      const sidebarSelect = document.querySelector('.custom-select[data-filter="block"] .select-options');
      if (sidebarSelect) {
        const li = document.createElement('li'); li.textContent = blockKeyForLookup; li.setAttribute('data-value', blockKeyForLookup);
        sidebarSelect.appendChild(li);
      }
      const modalSelects = document.querySelectorAll('.custom-select-modal[data-field="techBlock"], .custom-select-modal[data-field="editBlock"]');
      modalSelects.forEach(ms => {
        const opts = ms.querySelector('.select-options');
        if (opts) {
          const li = document.createElement('li');
          li.classList.add('select-option-item');
          li.setAttribute('data-value', blockKeyForLookup);
          li.innerHTML = `<label class="option-label"><input type="checkbox" class="option-checkbox" /><span>${blockKeyForLookup}</span></label>`;
          opts.appendChild(li);
        }
      });
      // persist new block and mapping
      try {
        if (!blocksList.includes(blockKeyForLookup)) blocksList.push(blockKeyForLookup);
        vfsWrite('bloks.json', blocksList);
        vfsWrite('blockToQuadrant.json', blockToQuadrant);
      } catch (err) { console.warn('Не удалось сохранить новый блок в VFS', err); }
    }
    // Ensure block mapping exists before computing coords
    const bk = t.block;
    if (!bk || !blockToQuadrant || !Object.prototype.hasOwnProperty.call(blockToQuadrant, bk) || blockToQuadrant[bk] == null) {
      console.warn('addTech: block mapping missing for', bk, '— defaulting to quadrant 1 and adding option');
      blockToQuadrant[bk] = 1;
      const sidebarSelect = document.querySelector('.custom-select[data-filter="block"] .select-options');
      if (sidebarSelect) { const li = document.createElement('li'); li.textContent = bk; li.setAttribute('data-value', bk); sidebarSelect.appendChild(li); }
      document.querySelectorAll('.custom-select-modal[data-field="techBlock"], .custom-select-modal[data-field="editBlock"]').forEach(ms => {
        const opts = ms.querySelector('.select-options');
        if (opts) {
          const li = document.createElement('li');
          li.classList.add('select-option-item');
          li.setAttribute('data-value', bk);
          li.innerHTML = `<label class="option-label"><input type="checkbox" class="option-checkbox" /><span>${bk}</span></label>`;
          opts.appendChild(li);
        }
      });
      if (!blocksList.includes(bk)) blocksList.push(bk);
      try { vfsWrite('bloks.json', blocksList); vfsWrite('blockToQuadrant.json', blockToQuadrant); } catch (err) { console.warn('vfs write failed for new block', err); }
    }

    // Ensure level mapping exists
    if (!levelToRing || !Object.prototype.hasOwnProperty.call(levelToRing, t.level)) {
      console.warn('addTech: level mapping missing for', t.level, '— defaulting to "Существующие"');
      t.level = (RINGS && RINGS.length) ? RINGS[0] : 'Используемые';
    }

    // Рассчитаем координаты с учётом коллизий
    computeCoordinates(t);
    // Debug: логируем ключевые значения, чтобы диагностировать проблемы с рендером
    try {
      console.debug('addTech: new tech BEFORE persist', { id: t.id, name: t.name, block: t.block, quadrant: getQuadrantIdForBlock(t.block), level: t.level, ring: levelToRing[t.level], x: t.x, y: t.y });
    } catch (e) { /* ignore */ }

    // Добавляем в основной массив и сохраняем
    technologies.push(t);
    // Ensure fields, compute coords and persist before rendering
    ensureAndPersistNewTech(t);
    hideModal('addTechPanel');

    const q = getQuadrantIdForBlock(t.block);
    if (q != null) {
      const g = document.querySelector(`.quadrant-group.q${q}`);
      if (g) g.classList.remove('empty');
    }

    // Force re-render and ensure updated data used
    try { updateRadar(); } catch (err) { console.warn('updateRadar failed after add', err); }
    // Разблокируем квадрант, подсветим сектор в сайдбаре и делаем зум на сектор
    if (q != null) {
      const g = document.querySelector(`.quadrant-group.q${q}`);
      if (g) g.classList.remove('empty');
      const sidebarItem = document.querySelector(`.sector-item[data-quadrant="${q}"]`);
      if (sidebarItem) {
        // удалим класс empty и откроем список для быстрого просмотра
        sidebarItem.classList.remove('empty');
        // Создаем список технологий напрямую
        const existing = sidebarItem.nextElementSibling;
        if (!(existing && existing.classList.contains('tech-list'))) {
          document.querySelectorAll('.tech-list').forEach(tl => tl.parentNode?.removeChild(tl));
          createTechListForSector(sidebarItem, q, technologies);
        }
        // пометим как активный
        document.querySelectorAll('.sector-item').forEach(i => i.classList.remove('active'));
        sidebarItem.classList.add('active');
      }
      // Делаем зум на сектор, в который добавлена технология
      setTimeout(() => {
        zoomQuadrant(q);
      }, 100);
    }
    // Сохраняем технологию во все выбранные предприятия
    try {
      companiesVal.forEach(company => {
        if (!enterpriseData[company]) {
          enterpriseData[company] = [];
        }
        // Проверяем, нет ли уже технологии с таким id в этом предприятии
        const existingIndex = enterpriseData[company].findIndex(tech => tech.id === t.id);
        if (existingIndex === -1) {
          enterpriseData[company].push(t);
        } else {
          enterpriseData[company][existingIndex] = t;
        }
      });
      // Обновляем текущее предприятие
      enterpriseData[currentEnterprise] = [...technologies];
      vfsWrite('enterpriseData.json', enterpriseData);
    } catch (err) { console.warn('Не удалось сохранить enterpriseData в VFS', err); }
    showNotification('Технология добавлена!', true);
  };

  document.getElementById("editTechForm").onsubmit = (e) => {
    e.preventDefault();
    const id = +document.getElementById("editId").value;
    const idx = technologies.findIndex(t => t.id === id);
    if (idx === -1) return;
    const existing = technologies[idx];
    const newTechTypeVal = document.getElementById('editTechType')?.value || existing.techType;
    const newStatus = (document.getElementById('editStatus')?.value || existing.level || existing.status || '').trim();
    const newShape = computeShapeByTechType(newTechTypeVal) || 'circle';
    // parse blocks/functions from hidden inputs (can be JSON arrays)
    const rawBlockE = document.getElementById("editBlock").value;
    const rawFuncE = document.getElementById("editFunc").value;
    let blocksValE = rawBlockE;
    let functionsValE = rawFuncE;
    try { if (rawBlockE && rawBlockE.trim().startsWith('[')) blocksValE = JSON.parse(rawBlockE); } catch (err) {}
    try { if (rawFuncE && rawFuncE.trim().startsWith('[')) functionsValE = JSON.parse(rawFuncE); } catch (err) {}

    technologies[idx] = Object.assign({}, existing, {
      name: document.getElementById("editName").value,
      block: Array.isArray(blocksValE) ? (blocksValE[0] || '') : blocksValE,
      blocks: Array.isArray(blocksValE) ? blocksValE : (blocksValE ? [blocksValE] : []),
      func: Array.isArray(functionsValE) ? (functionsValE[0] || '') : functionsValE,
      functions: Array.isArray(functionsValE) ? functionsValE : (functionsValE ? [functionsValE] : []),
      techType: newTechTypeVal,
      level: newStatus || existing.level || (RINGS && RINGS.length ? RINGS[0] : 'Используемые'),
      status: newStatus || existing.status || existing.level,
      shape: newShape,
      description: document.getElementById("editDesc").value,
      exampleDesc: (document.getElementById('editExampleDesc')?.value || '').trim(),
    });
    // Стоимость внедрения — для всех статусов
    const costEdit = Number(document.getElementById('editCostProm')?.value);
    if (!Number.isNaN(costEdit)) technologies[idx].costProm = costEdit;
    else delete technologies[idx].costProm;
    // Оценки
    const clamp03 = (n) => Math.max(0, Math.min(3, Number(n)));
    const fc = document.getElementById('editFuncCover')?.value;
    if (fc !== undefined && fc !== null && fc !== '' && String(fc).trim() !== '') {
      technologies[idx].funcCover = clamp03(fc);
    }

    // Обработка оценок готовности в зависимости от количества предприятий
    const companies = Array.isArray(existing.company) ? existing.company : (existing.company ? [existing.company] : []);
    if (companies.length === 1) {
      // Одно предприятие - сохраняем как обычно
      const tr = document.getElementById('editTechRead')?.value;
      const or = document.getElementById('editOrganRead')?.value;
      if (tr !== undefined && tr !== null && tr !== '' && String(tr).trim() !== '') {
        technologies[idx].techRead = clamp03(tr);
      }
      if (or !== undefined && or !== null && or !== '' && String(or).trim() !== '') {
        technologies[idx].organRead = clamp03(or);
      }
      // Удаляем companyRatings, если было одно предприятие
      if (technologies[idx].companyRatings) {
        delete technologies[idx].companyRatings;
      }
    } else if (companies.length > 1) {
      // Несколько предприятий - собираем оценки из динамических полей
      const companyRatings = {};
      let hasAnyRatings = false;
      companies.forEach(company => {
        const techReadInput = document.getElementById(`editTechRead_${company}`);
        const organReadInput = document.getElementById(`editOrganRead_${company}`);
        const techReadVal = techReadInput?.value;
        const organReadVal = organReadInput?.value;

        const ratings = {};
        if (techReadVal !== undefined && techReadVal !== null && techReadVal !== '' && String(techReadVal).trim() !== '') {
          ratings.techRead = clamp03(techReadVal);
          hasAnyRatings = true;
        }
        if (organReadVal !== undefined && organReadVal !== null && organReadVal !== '' && String(organReadVal).trim() !== '') {
          ratings.organRead = clamp03(organReadVal);
          hasAnyRatings = true;
        }

        if (Object.keys(ratings).length > 0) {
          companyRatings[company] = ratings;
        }
      });

      if (hasAnyRatings) {
        technologies[idx].companyRatings = companyRatings;
      } else {
        // Если не заполнено ни одно поле, удаляем companyRatings
        if (technologies[idx].companyRatings) {
          delete technologies[idx].companyRatings;
        }
      }
      // Также сохраняем общие значения, если они были заполнены (для обратной совместимости)
      // Но приоритет будет отдаваться companyRatings
    }
    hideModal('editTechPanel');
    updateRadar();
    try {
      enterpriseData[currentEnterprise] = [...technologies];
      vfsWrite('enterpriseData.json', enterpriseData);
    } catch (err) { console.warn('Не удалось сохранить enterpriseData после редактирования', err); }
    showNotification('Изменения сохранены!', true);
  };

  document.getElementById("editTechBtn").onclick = () => {
    if (!checkArchitectRole() || !currentTech) return;
    const f = document.getElementById("editTechForm");
    f.querySelector("#editId").value = currentTech.id;
    f.querySelector("#editName").value = currentTech.name;
    setCustomSelectValue("editBlock", (currentTech.blocks && currentTech.blocks.length) ? currentTech.blocks : (currentTech.block ? [currentTech.block] : []));
    setCustomSelectValue("editFunc", (currentTech.functions && currentTech.functions.length) ? currentTech.functions : (currentTech.func ? [currentTech.func] : []));
    setCustomSelectValue("editTechType", currentTech.techType || "");
    setCustomSelectValue("editStatus", currentTech.level || currentTech.status || "");
    // ratings
    const tr = document.getElementById('editTechRead'); if (tr) tr.value = (currentTech.techRead ?? '');
    const or = document.getElementById('editOrganRead'); if (or) or.value = (currentTech.organRead ?? '');
    const fc = document.getElementById('editFuncCover'); if (fc) fc.value = (currentTech.funcCover ?? '');
    // cost + toggle visibility
    const costGroup = document.getElementById('editCostGroup');
    const costInput = document.getElementById('editCostProm');
    if (costInput) costInput.value = (currentTech.costProm ?? '');
    if (costGroup) costGroup.style.display = '';
    f.querySelector("#editDesc").value = currentTech.description;
    const exampleDescEl = document.getElementById('editExampleDesc');
    if (exampleDescEl) exampleDescEl.value = currentTech.exampleDesc || '';
    // Обновляем видимость полей оценок в зависимости от количества предприятий
    updateEditTechRatingsVisibility(currentTech);
    showModal('editTechPanel');
    snapshotFormInitial(document.getElementById('editTechForm'));
  };

  document.getElementById("deleteTechBtn").onclick = () => {
    if (!checkArchitectRole() || !currentTech) return;
    // Показываем модальное окно подтверждения
    const modal = document.getElementById('deleteConfirmModal');
    const messageEl = document.getElementById('deleteConfirmMessage');
    if (modal && messageEl && currentTech) {
      messageEl.textContent = `Вы уверены что хотите удалить технологию ${currentTech.name}?`;
      showModal('deleteConfirmModal');
    }
  };

  // Функция для получения значения поля технологии
  // filters - опциональный параметр для фильтрации отображаемых значений
  // companyFilter - опциональный параметр для ограничения списка предприятий в отчёте
  function getFieldValue(tech, fieldName, options = {}) {
    const { companyFilter = null } = options;

    switch (fieldName) {
      case 'name':
        return tech.name || 'Не указано';
      case 'company':
        if (Array.isArray(tech.company)) {
          let companies = tech.company;
          // Если указан фильтр по предприятиям, показываем только отфильтрованные
          if (companyFilter && Array.isArray(companyFilter) && companyFilter.length > 0) {
            companies = tech.company.filter(c => companyFilter.includes(c));
          }
          return companies.length > 0 ? companies.join(', ') : 'Не указано';
        }
        return tech.company || 'Не указано';
      case 'blocks':
        if (Array.isArray(tech.blocks)) {
          return tech.blocks.map(b => {
            if (typeof b === 'number' && typeof blockIdToName !== 'undefined' && blockIdToName[b]) {
              return blockIdToName[b];
            }
            return String(b || '');
          }).filter(Boolean).join(', ') || 'Не указано';
        }
        return tech.block || tech.blocks || 'Не указано';
      case 'functions':
        if (Array.isArray(tech.functions)) {
          return tech.functions.join(', ') || 'Не указано';
        }
        return tech.func || tech.functions || 'Не указано';
      case 'techTypes':
        return tech.techTypes || tech.techType || 'Не указано';
      case 'status':
        return tech.status || tech.level || 'Не указано';
      case 'costProm':
        if (tech.status === 'Перспективные' || tech.level === 'Перспективные') {
          return tech.costProm !== undefined && tech.costProm !== null ? String(tech.costProm) : '—';
        }
        return '—';
      case 'description':
        return tech.description || (tech.ref ? `Референс: ${tech.ref}` : '—');
      case 'priority':
        try {
          // Для технологий с несколькими предприятиями показываем приоритет для каждого
          if (Array.isArray(tech.company) && tech.company.length > 1) {
            // Получаем список предприятий для отображения приоритета
            let companiesToShow = tech.company;
            if (companyFilter && Array.isArray(companyFilter) && companyFilter.length > 0) {
              companiesToShow = tech.company.filter(c => companyFilter.includes(c));
            }

            // Если есть данные по предприятиям с индивидуальными оценками
            if (tech.companyRatings && typeof tech.companyRatings === 'object') {
              const priorityLines = [];
              companiesToShow.forEach(company => {
                const p = computePriority(tech, 'mult', company);
                if (p != null && !Number.isNaN(p)) {
                  const percent = Math.round(p * 100);
                  const cat = getPriorityCategory(p);
                  priorityLines.push(`${company}: ${percent}% (${cat.label})`);
                } else {
                  priorityLines.push(`${company}: —`);
                }
              });
              return priorityLines.join('\n');
            } else {
              // Нет индивидуальных оценок - показываем общий приоритет для всех предприятий
              const p = computePriority(tech, 'mult');
              if (p == null || Number.isNaN(p)) return '—';
              const percent = Math.round(p * 100);
              const cat = getPriorityCategory(p);
              // Показываем для каждого предприятия одинаковый приоритет
              const priorityLines = companiesToShow.map(company => `${company}: ${percent}% (${cat.label})`);
              return priorityLines.join('\n');
            }
          } else {
            // Одно предприятие - стандартное отображение
            const p = computePriority(tech, 'mult');
            if (p == null || Number.isNaN(p)) return '—';
            const percent = Math.round(p * 100);
            const cat = getPriorityCategory(p);
            return `${percent}% (${cat.label})`;
          }
        } catch (e) {
          return '—';
        }
      case 'techRead':
        // Для технологий с несколькими предприятиями показываем значения для каждого
        if (Array.isArray(tech.company) && tech.company.length > 1) {
          let companiesToShow = tech.company;
          if (companyFilter && Array.isArray(companyFilter) && companyFilter.length > 0) {
            companiesToShow = tech.company.filter(c => companyFilter.includes(c));
          }

          // Если есть данные по предприятиям с индивидуальными оценками
          if (tech.companyRatings && typeof tech.companyRatings === 'object') {
            const techReadLines = [];
            companiesToShow.forEach(company => {
              const ratings = tech.companyRatings[company];
              if (ratings && ratings.techRead !== undefined && ratings.techRead !== null) {
                techReadLines.push(`${company}: ${ratings.techRead}`);
              } else {
                // Используем общие значения
                const value = tech.techRead !== undefined && tech.techRead !== null ? String(tech.techRead) : '—';
                techReadLines.push(`${company}: ${value}`);
              }
            });
            return techReadLines.length > 0 ? techReadLines.join('\n') : '—';
          } else {
            // Нет индивидуальных оценок - показываем общее значение для всех предприятий
            const value = tech.techRead !== undefined && tech.techRead !== null ? String(tech.techRead) : '—';
            const techReadLines = companiesToShow.map(company => `${company}: ${value}`);
            return techReadLines.join('\n');
          }
        } else {
          // Одно предприятие - стандартное отображение
          return tech.techRead !== undefined && tech.techRead !== null ? String(tech.techRead) : '—';
        }
      case 'organRead':
        // Для технологий с несколькими предприятиями показываем значения для каждого
        if (Array.isArray(tech.company) && tech.company.length > 1) {
          let companiesToShow = tech.company;
          if (companyFilter && Array.isArray(companyFilter) && companyFilter.length > 0) {
            companiesToShow = tech.company.filter(c => companyFilter.includes(c));
          }

          // Если есть данные по предприятиям с индивидуальными оценками
          if (tech.companyRatings && typeof tech.companyRatings === 'object') {
            const organReadLines = [];
            companiesToShow.forEach(company => {
              const ratings = tech.companyRatings[company];
              if (ratings && ratings.organRead !== undefined && ratings.organRead !== null) {
                organReadLines.push(`${company}: ${ratings.organRead}`);
              } else {
                // Используем общие значения
                const value = tech.organRead !== undefined && tech.organRead !== null ? String(tech.organRead) : '—';
                organReadLines.push(`${company}: ${value}`);
              }
            });
            return organReadLines.length > 0 ? organReadLines.join('\n') : '—';
          } else {
            // Нет индивидуальных оценок - показываем общее значение для всех предприятий
            const value = tech.organRead !== undefined && tech.organRead !== null ? String(tech.organRead) : '—';
            const organReadLines = companiesToShow.map(company => `${company}: ${value}`);
            return organReadLines.join('\n');
          }
        } else {
          // Одно предприятие - стандартное отображение
          return tech.organRead !== undefined && tech.organRead !== null ? String(tech.organRead) : '—';
        }
      case 'funcCover':
        return tech.funcCover !== undefined && tech.funcCover !== null ? String(tech.funcCover) : '—';
      case 'exampleDesc':
        return tech.exampleDesc || '—';
      default:
        return '—';
    }
  }

  // Функция для получения заголовка поля
  function getFieldLabel(fieldName) {
    const labels = {
      'name': 'Название',
      'company': 'Предприятия',
      'blocks': 'Функциональный блок',
      'functions': 'Функции',
      'techTypes': 'Тип технологии',
      'status': 'Статус',
      'costProm': 'Стоимость внедрения',
      'description': 'Описание',
      'priority': 'Приоритет технологии',
      'techRead': 'Технологическая готовность',
      'organRead': 'Организационная готовность',
      'funcCover': 'Покрытие функций'
    };
    return labels[fieldName] || fieldName;
  }

  // Функция для проверки, является ли поле числовым
  function isNumericField(fieldName) {
    return ['techRead', 'organRead', 'funcCover', 'costProm'].includes(fieldName);
  }

  // Функция для получения цвета на основе значения готовности (0-3)
  function getReadinessColor(value) {
    const numValue = Number(value);
    if (isNaN(numValue)) return '#000000'; // Черный для нечисловых значений

    switch (numValue) {
      case 0:
        return '#E74C3C'; // Красный
      case 1:
        return '#FF8C00'; // Оранжевый
      case 2:
        return '#FFD700'; // Желтый
      case 3:
        return '#28A745'; // Зеленый
      default:
        return '#000000'; // Черный для значений вне диапазона
    }
  }

  // Функция для проверки, является ли поле полем готовности
  function isReadinessField(fieldName) {
    return ['techRead', 'organRead', 'funcCover'].includes(fieldName);
  }

  // ===== Функции управления индикатором загрузки отчета =====
  function showReportLoading() {
    const modal = document.getElementById('reportLoadingModal');
    const spinner = document.getElementById('loadingSpinner');
    const success = document.getElementById('loadingSuccess');
    const error = document.getElementById('loadingError');
    const text = document.getElementById('loadingText');
    const errorMessage = document.getElementById('loadingErrorMessage');

    if (!modal) return;

    // Сбрасываем состояние
    if (spinner) spinner.style.display = 'block';
    if (success) success.style.display = 'none';
    if (error) error.style.display = 'none';
    if (text) text.textContent = 'Загрузка...';
    if (errorMessage) {
      errorMessage.style.display = 'none';
      errorMessage.textContent = '';
    }

    // Показываем модальное окно
    showModal('reportLoadingModal');
  }

  function showReportSuccess() {
    const modal = document.getElementById('reportLoadingModal');
    const spinner = document.getElementById('loadingSpinner');
    const success = document.getElementById('loadingSuccess');
    const text = document.getElementById('loadingText');

    if (!modal) return;

    // Скрываем спиннер, показываем галочку
    if (spinner) spinner.style.display = 'none';
    if (success) success.style.display = 'flex';
    if (text) text.textContent = 'Отчет успешно сформирован!';

    // Автоматически закрываем через 2 секунды
    setTimeout(() => {
      hideModal('reportLoadingModal');
    }, 2000);
  }

  function showReportError(message) {
    const modal = document.getElementById('reportLoadingModal');
    const spinner = document.getElementById('loadingSpinner');
    const error = document.getElementById('loadingError');
    const text = document.getElementById('loadingText');
    const errorMessage = document.getElementById('loadingErrorMessage');

    if (!modal) return;

    // Скрываем спиннер, показываем крестик
    if (spinner) spinner.style.display = 'none';
    if (error) error.style.display = 'flex';
    if (text) text.textContent = 'Ошибка при генерации отчета';
    if (errorMessage) {
      errorMessage.textContent = message || 'Произошла неизвестная ошибка';
      errorMessage.style.display = 'block';
    }

    // Автоматически закрываем через 5 секунд
    setTimeout(() => {
      hideModal('reportLoadingModal');
    }, 5000);
  }

  // Основная функция экспорта PDF с поддержкой выбора полей
  async function performPdfExport(selectedFields, filters = {}) {
    if (!checkArchitectRole()) {
      throw new Error('Недостаточно прав для экспорта отчета');
    }

    // Проверка, что выбрано хотя бы одно поле
    const hasSelectedFields = Object.values(selectedFields).some(v => v === true);
    if (!hasSelectedFields) {
      throw new Error('Выберите хотя бы одно поле для экспорта');
    }

    try {
      const { jsPDF } = window.jspdf;

      // Настройки формата A4 (мм)
      const margin = 14; // mm

      // canvas rendering helpers (определяем один раз для всего кода)
      const DPI = 150;
      const pxPerMM = DPI / 25.4;

      // Получаем список выбранных полей для предварительного расчета
      // Определяем порядок колонок: Предприятие → Функциональный блок → Функция → Название технологии → остальные поля
      const columnOrder = ['company', 'blocks', 'functions', 'name'];
      const selectedFieldsKeys = Object.keys(selectedFields).filter(f => selectedFields[f] === true);

      // Сортируем выбранные поля согласно заданному порядку
      const selectedFieldsList = [];
      // Сначала добавляем поля в заданном порядке
      columnOrder.forEach(field => {
        if (selectedFieldsKeys.includes(field)) {
          selectedFieldsList.push(field);
        }
      });
      // Затем добавляем остальные поля в исходном порядке
      selectedFieldsKeys.forEach(field => {
        if (!columnOrder.includes(field)) {
          selectedFieldsList.push(field);
        }
      });

      if (selectedFieldsList.length === 0) {
        throw new Error('Не выбрано ни одного поля');
      }

      // Временный canvas для измерения текста (используем тот же DPI, что и в основном коде)
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d');
      const tempFontSize = Math.round(12 * pxPerMM / 3.78);
      const tempFont = `${tempFontSize}px Segoe UI, Roboto, Arial, sans-serif`;
      const tempBoldFont = `bold ${tempFontSize}px Segoe UI, Roboto, Arial, sans-serif`;
      tempCtx.font = tempFont;

      // Сохраняем фильтр по компаниям для передачи в getFieldValue (определяем раньше для previewData)
      const companyFilterForDisplay = filters.company && Array.isArray(filters.company) && filters.company.length > 0
        ? filters.company
        : null;

      // Сначала собираем данные для расчета минимальных ширин
      // (используем предварительный список, если он доступен)
      let previewData = [];
      if (filters.company && Array.isArray(filters.company) && filters.company.length > 0) {
        filters.company.forEach(company => {
          if (enterpriseData && enterpriseData[company]) {
            previewData = previewData.concat(enterpriseData[company].slice(0, 10)); // Берем первые 10 для расчета
          }
        });
      } else if (selectedFields.company === true) {
        const allCompanies = Object.keys(enterpriseData || {}).filter(c => c);
        allCompanies.forEach(company => {
          if (enterpriseData && enterpriseData[company]) {
            previewData = previewData.concat(enterpriseData[company].slice(0, 10));
          }
        });
      } else {
        const currentEnt = currentEnterprise || 'Предприятие';
        if (enterpriseData && enterpriseData[currentEnt]) {
          previewData = enterpriseData[currentEnt].slice(0, 10);
        } else if (Array.isArray(technologies)) {
          previewData = technologies.slice(0, 10);
        }
      }

      // Вычисляем минимальную ширину для каждой колонки на основе заголовков и содержимого
      const minColWidths = selectedFieldsList.map(field => {
        const label = getFieldLabel(field);
        tempCtx.font = tempBoldFont;
        const labelWidthPx = tempCtx.measureText(label).width;
        tempCtx.font = tempFont;

        // Проверяем ширину реального содержимого (берем максимальную ширину из первых записей)
        let maxContentWidthPx = labelWidthPx;
        previewData.forEach(tech => {
          const value = getFieldValue(tech, field, { companyFilter: companyFilterForDisplay });
          const valueStr = String(value || '');
          // Измеряем ширину текста (может быть многострочным, берем самую широкую строку)
          const words = valueStr.split(/\s+/);
          let line = '';
          words.forEach(word => {
            const testLine = line ? line + ' ' + word : word;
            const testWidth = tempCtx.measureText(testLine).width;
            if (testWidth > maxContentWidthPx) {
              maxContentWidthPx = testWidth;
            }
            // Если строка слишком длинная, начинаем новую
            if (testWidth > 200) { // Примерная максимальная ширина для одной строки
              line = word;
            } else {
              line = testLine;
            }
          });
        });

        // Минимальная ширина = максимальная из (заголовок, содержимое) + отступы
        const cellPadding = 4; // пиксели
        const minWidthPx = Math.max(labelWidthPx, maxContentWidthPx) + (cellPadding * 2) + 10; // 10px запас
        const minWidthMm = minWidthPx / pxPerMM;
        return Math.max(minWidthMm, 20); // Минимум 20mm на колонку
      });

      // Суммарная минимальная ширина всех колонок + отступы между колонками
      const cellPadding = 4;
      const cellPaddingMm = cellPadding / pxPerMM;
      const totalMinWidth = minColWidths.reduce((sum, w) => sum + w, 0) + (selectedFieldsList.length - 1) * cellPaddingMm;

      // Доступная ширина в portrait (A4: 210mm) и landscape (A4: 297mm)
      const availableWidthPortrait = 210 - (margin * 2);
      const availableWidthLandscape = 297 - (margin * 2);

      // Определяем ориентацию
      const useLandscape = totalMinWidth > availableWidthPortrait;
      const orientation = useLandscape ? 'landscape' : 'portrait';

      // Создаем PDF с правильной ориентацией
      const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: orientation });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      // Список технологий
      // Если в фильтре выбраны предприятия, собираем данные из всех выбранных предприятий
      let sourceList = [];
      let enterpriseName = currentEnterprise || 'Предприятие';

      // Проверяем, выбрано ли поле "company" для экспорта
      const isCompanyFieldSelected = selectedFields.company === true;

      if (filters.company && Array.isArray(filters.company) && filters.company.length > 0) {
        // Собираем данные из всех выбранных предприятий
        filters.company.forEach(company => {
          if (enterpriseData && enterpriseData[company]) {
            sourceList = sourceList.concat(enterpriseData[company]);
          }
        });
        // Формируем название для заголовка
        if (filters.company.length === 1) {
          enterpriseName = filters.company[0];
        } else {
          enterpriseName = filters.company.join(', ');
        }
      } else if (isCompanyFieldSelected) {
        // Если поле "company" выбрано для экспорта, но фильтр пустой - используем все предприятия
        // Это означает, что пользователь хочет видеть все предприятия в отчете
        const allCompanies = Object.keys(enterpriseData || {}).filter(c => c);
        allCompanies.forEach(company => {
          if (enterpriseData && enterpriseData[company]) {
            sourceList = sourceList.concat(enterpriseData[company]);
          }
        });
        enterpriseName = 'Все предприятия';
      } else {
        // Если фильтр по предприятиям не задан и поле "company" не выбрано, используем текущее предприятие
        sourceList = (enterpriseData && enterpriseData[enterpriseName]) ? enterpriseData[enterpriseName] : (Array.isArray(technologies) ? technologies : []);
      }

      // Дедупликация технологий по ID (технология с несколькими предприятиями может попасть в список несколько раз)
      const seenIds = new Set();
      sourceList = sourceList.filter(tech => {
        const techId = tech.id;
        if (seenIds.has(techId)) {
          return false;
        }
        seenIds.add(techId);
        return true;
      });

      // Применяем фильтры к списку технологий (кроме фильтра по предприятиям, так как он уже применен)
      if (Object.keys(filters).length > 0) {
        const filtersWithoutCompany = { ...filters };
        delete filtersWithoutCompany.company; // Удаляем фильтр по компаниям, так как он уже применен при сборе данных
        if (Object.keys(filtersWithoutCompany).length > 0) {
          sourceList = applyFiltersToTechnologies(sourceList, filtersWithoutCompany);
        }
      }

      // Проверяем, что выбрано хотя бы одно поле (selectedFieldsList уже определен выше)
      if (selectedFieldsList.length === 0) {
        throw new Error('Не выбрано ни одного поля');
      }

      // canvas rendering helpers (DPI и pxPerMM уже определены выше)
      function mmToPx(mm) { return Math.round(mm * pxPerMM); }

      function wrapText(ctx, text, maxWidthPx) {
        const words = String(text || '').split(/\s+/);
        const lines = [];
        let line = '';

        // Функция для разбиения длинного слова с переносом
        function breakLongWord(word, maxWidth) {
          const result = [];
          let currentPart = '';

          for (let i = 0; i < word.length; i++) {
            const testPart = currentPart + word[i];
            const testWidth = ctx.measureText(testPart + '-').width;

            if (testWidth > maxWidth && currentPart.length > 1) {
              // Добавляем дефис и начинаем новую часть
              result.push(currentPart + '-');
              currentPart = word[i];
            } else {
              currentPart = testPart;
            }
          }

          if (currentPart) {
            result.push(currentPart);
          }

          return result;
        }

        for (let i = 0; i < words.length; i++) {
          const word = words[i];
          const test = line ? line + ' ' + word : word;
          const w = ctx.measureText(test).width;

          if (w > maxWidthPx) {
            if (line) {
              lines.push(line);
              line = '';
            }

            // Проверяем, помещается ли слово целиком
            const wordWidth = ctx.measureText(word).width;
            if (wordWidth > maxWidthPx) {
              // Слово слишком длинное - разбиваем его
              const wordParts = breakLongWord(word, maxWidthPx);
              for (let j = 0; j < wordParts.length; j++) {
                if (j === wordParts.length - 1) {
                  // Последняя часть слова - добавляем в текущую строку
                  line = wordParts[j];
                } else {
                  // Не последняя часть - добавляем как отдельную строку
                  lines.push(wordParts[j]);
                }
              }
            } else {
              line = word;
            }
          } else {
            line = test;
          }
        }
        if (line) lines.push(line);
        return lines;
      }

      // Render a single page to canvas and return PNG dataURL
      async function renderPagesToImages() {
        const images = [];
        const cw = mmToPx(pageWidth);
        const ch = mmToPx(pageHeight);

        // styles
        const headerFont = `${Math.round(14 * pxPerMM / 3.78)}px Segoe UI, Roboto, Arial, sans-serif`;
        const normalFont = `${Math.round(12 * pxPerMM / 3.78)}px Segoe UI, Roboto, Arial, sans-serif`;
        const smallFont = `${Math.round(11 * pxPerMM / 3.78)}px Segoe UI, Roboto, Arial, sans-serif`;
        const boldFont = `bold ${Math.round(12 * pxPerMM / 3.78)}px Segoe UI, Roboto, Arial, sans-serif`;

        let canvas = document.createElement('canvas');
        canvas.width = cw;
        canvas.height = ch;
        let ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, cw, ch);

        const marginPx = mmToPx(margin);
        const contentW = cw - marginPx * 2;
        const cellPadding = 4;
        const rowSpacing = 2;
        const baseHeaderHeight = 20;

        let y = marginPx;

        function newPage() {
          images.push(canvas.toDataURL('image/png'));
          canvas = document.createElement('canvas');
          canvas.width = cw; canvas.height = ch;
          const cctx = canvas.getContext('2d');
          cctx.fillStyle = '#ffffff';
          cctx.fillRect(0, 0, cw, ch);
          return cctx;
        }

        const nowStr = new Date().toLocaleString('ru-RU');

        function drawHeader(cctx) {
          cctx.fillStyle = '#000';
          cctx.textBaseline = 'top';
          cctx.font = headerFont;
          const title = `Технологический отчёт: ${enterpriseName}`;
          const titleW = cctx.measureText(title).width;
          cctx.fillText(title, Math.round((cw - titleW) / 2), y);
          cctx.font = smallFont;
          cctx.fillText(`Дата формирования отчёта: ${nowStr}`, marginPx, y + Math.round(16 * pxPerMM / 3.78));
          y += Math.round(26 * pxPerMM / 3.78);
        }

        ctx.fillStyle = '#000';
        ctx.textBaseline = 'top';
        drawHeader(ctx);

        if (!sourceList || sourceList.length === 0) {
          ctx.font = normalFont;
          ctx.fillText('На предприятии не зарегистрировано технологий', marginPx, y + 6);
          images.push(canvas.toDataURL('image/png'));
          return images;
        }

        // Вычисляем ширину колонок с учетом минимальных ширин
        const numCols = selectedFieldsList.length;
        const availableWidthPx = contentW;
        const totalPadding = (numCols - 1) * cellPadding;
        const availableWidthForCols = availableWidthPx - totalPadding;

        // Конвертируем минимальные ширины из мм в пиксели для canvas
        const minColWidthsPx = minColWidths.map(w => mmToPx(w));
        const totalMinWidthPx = minColWidthsPx.reduce((sum, w) => sum + w, 0);

        // Распределяем доступное пространство между колонками
        // Гарантируем, что колонки не накладываются друг на друга
        let colWidths;
        if (totalMinWidthPx > availableWidthForCols) {
          // Если минимальные ширины превышают доступное пространство,
          // масштабируем их пропорционально, чтобы они поместились
          const scale = availableWidthForCols / totalMinWidthPx;
          colWidths = minColWidthsPx.map(w => Math.max(Math.floor(w * scale), 10)); // Минимум 10px
        } else {
          // Распределяем доступное пространство пропорционально минимальным ширинам
          const scale = availableWidthForCols / totalMinWidthPx;
          colWidths = minColWidthsPx.map(w => Math.floor(w * scale));

          // Убеждаемся, что каждая колонка не меньше своей минимальной ширины
          colWidths = colWidths.map((w, idx) => Math.max(w, minColWidthsPx[idx]));

          // Корректируем, если сумма превышает доступное пространство
          const totalWidth = colWidths.reduce((sum, w) => sum + w, 0);
          if (totalWidth > availableWidthForCols) {
            const correction = availableWidthForCols / totalWidth;
            colWidths = colWidths.map(w => Math.max(Math.floor(w * correction), 10)); // Минимум 10px
          }
        }

        // Финальная проверка: убеждаемся, что сумма не превышает доступное пространство
        let totalWidth = colWidths.reduce((sum, w) => sum + w, 0);
        if (totalWidth > availableWidthForCols) {
          const finalCorrection = availableWidthForCols / totalWidth;
          colWidths = colWidths.map(w => Math.floor(w * finalCorrection));
        }

        // Для обратной совместимости вычисляем среднюю ширину колонки
        const colWidth = Math.floor(availableWidthForCols / numCols);

        // Вычисляем необходимую высоту заголовка на основе переноса текста
        ctx.font = boldFont;
        let maxHeaderLines = 1;
        selectedFieldsList.forEach((field, idx) => {
          const label = getFieldLabel(field);
          const currentColWidth = colWidths[idx] || colWidth;
          const availableWidth = currentColWidth - cellPadding * 2;
          const headerLines = wrapText(ctx, label, availableWidth);
          maxHeaderLines = Math.max(maxHeaderLines, headerLines.length);
        });
        const headerHeight = Math.max(baseHeaderHeight, maxHeaderLines * Math.round(12 * pxPerMM / 3.78) + cellPadding * 2);

        // Рисуем заголовок таблицы с фоном
        const headerY = y;
        ctx.fillStyle = '#e0e0e0';
        ctx.fillRect(marginPx, headerY, contentW, headerHeight);
        ctx.fillStyle = '#000';
        ctx.font = boldFont;
        ctx.textBaseline = 'top';
        ctx.textAlign = 'left';

        let x = marginPx + cellPadding;
        selectedFieldsList.forEach((field, idx) => {
          const label = getFieldLabel(field);
          const currentColWidth = colWidths[idx] || colWidth;
          const availableWidth = currentColWidth - cellPadding * 2;

          // Переносим текст заголовка, если он не помещается (используем boldFont)
          ctx.font = boldFont;
          let headerLines = wrapText(ctx, label, availableWidth);
          const lineHeight = Math.round(12 * pxPerMM / 3.78);

          // Обрезаем строки, если они все еще слишком длинные
          headerLines = headerLines.map(line => {
            let displayLine = line;
            if (ctx.measureText(displayLine).width > availableWidth) {
              while (displayLine.length > 0 && ctx.measureText(displayLine + '...').width > availableWidth) {
                displayLine = displayLine.slice(0, -1);
              }
              displayLine = displayLine + '...';
            }
            return displayLine;
          });

          const totalHeaderHeight = headerLines.length * lineHeight;
          const startY = headerY + Math.max(0, (headerHeight - totalHeaderHeight) / 2);

          headerLines.forEach((line, lineIdx) => {
            ctx.fillText(line, x, startY + lineIdx * lineHeight);
          });

          x += currentColWidth + cellPadding;
        });

        y += headerHeight + rowSpacing;

        // Рисуем строки данных
        for (let i = 0; i < sourceList.length; i++) {
          const tech = sourceList[i];
          const isEvenRow = i % 2 === 0;

          // Измеряем высоту строки
          ctx.font = normalFont;
          let maxLines = 1;
          const cellValues = selectedFieldsList.map((field, idx) => {
            const value = getFieldValue(tech, field, { companyFilter: companyFilterForDisplay });
            const currentColWidth = colWidths[idx] || colWidth;
            const lines = wrapText(ctx, value, currentColWidth - cellPadding * 2);
            maxLines = Math.max(maxLines, lines.length);
            return lines;
          });

          const rowHeight = Math.max(headerHeight, maxLines * Math.round(12 * pxPerMM / 3.78) + cellPadding * 2);

          // Проверка на перенос страницы
          if (y + rowHeight + marginPx > ch - marginPx) {
            const cctx = newPage();
            y = marginPx;
            drawHeader(cctx);
            // Перерисовываем заголовок таблицы
            const newHeaderY = y;
            cctx.fillStyle = '#e0e0e0';
            cctx.fillRect(marginPx, newHeaderY, contentW, headerHeight);
            cctx.fillStyle = '#000';
            cctx.font = boldFont;
            cctx.textBaseline = 'top';
            cctx.textAlign = 'left';
            let newX = marginPx + cellPadding;
            selectedFieldsList.forEach((field, idx) => {
              const label = getFieldLabel(field);
              const currentColWidth = colWidths[idx] || colWidth;
              const availableWidth = currentColWidth - cellPadding * 2;

              // Переносим текст заголовка, если он не помещается (используем boldFont)
              cctx.font = boldFont;
              let headerLines = wrapText(cctx, label, availableWidth);
              const lineHeight = Math.round(12 * pxPerMM / 3.78);

              // Обрезаем строки, если они все еще слишком длинные
              headerLines = headerLines.map(line => {
                let displayLine = line;
                if (cctx.measureText(displayLine).width > availableWidth) {
                  while (displayLine.length > 0 && cctx.measureText(displayLine + '...').width > availableWidth) {
                    displayLine = displayLine.slice(0, -1);
                  }
                  displayLine = displayLine + '...';
                }
                return displayLine;
              });

              const totalHeaderHeight = headerLines.length * lineHeight;
              const startY = newHeaderY + Math.max(0, (headerHeight - totalHeaderHeight) / 2);

              headerLines.forEach((line, lineIdx) => {
                cctx.fillText(line, newX, startY + lineIdx * lineHeight);
              });

              newX += currentColWidth + cellPadding;
            });
            y += headerHeight + rowSpacing;
            ctx = cctx;
          }

          // Фон строки (zebra striping)
          if (isEvenRow) {
            ctx.fillStyle = '#f9f9f9';
            ctx.fillRect(marginPx, y, contentW, rowHeight);
          }

          // Границы ячеек
          ctx.strokeStyle = '#d0d0d0';
          ctx.lineWidth = 0.5;
          x = marginPx;
          for (let col = 0; col <= numCols; col++) {
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x, y + rowHeight);
            ctx.stroke();
            if (col < numCols) {
              const currentColWidth = colWidths[col] || colWidth;
              x += currentColWidth + cellPadding;
            }
          }
          ctx.beginPath();
          ctx.moveTo(marginPx, y);
          ctx.lineTo(marginPx + contentW, y);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(marginPx, y + rowHeight);
          ctx.lineTo(marginPx + contentW, y + rowHeight);
          ctx.stroke();

          // Текст в ячейках
          ctx.font = normalFont;
          ctx.textBaseline = 'top';
          ctx.textAlign = 'left';
          x = marginPx + cellPadding;
          selectedFieldsList.forEach((field, colIdx) => {
            const lines = cellValues[colIdx];
            const isNumeric = isNumericField(field);
            const currentColWidth = colWidths[colIdx] || colWidth;
            const availableTextWidth = currentColWidth - cellPadding * 2;
            const textX = isNumeric ? x + currentColWidth - cellPadding : x;
            ctx.textAlign = isNumeric ? 'right' : 'left';
            const lineHeight = Math.round(12 * pxPerMM / 3.78);

            // Все поля отображаются черным цветом
            ctx.fillStyle = '#000';

            lines.forEach((line, lineIdx) => {
              // Обрезаем текст, если он все еще слишком длинный (на случай ошибок в wrapText)
              let displayLine = line;
              if (ctx.measureText(displayLine).width > availableTextWidth) {
                // Обрезаем текст до максимальной ширины
                while (displayLine.length > 0 && ctx.measureText(displayLine + '...').width > availableTextWidth) {
                  displayLine = displayLine.slice(0, -1);
                }
                displayLine = displayLine + '...';
              }
              ctx.fillText(displayLine, textX, y + cellPadding + lineIdx * lineHeight);
            });

            x += currentColWidth + cellPadding;
            ctx.textAlign = 'left';
          });

          y += rowHeight + rowSpacing;
        }

        images.push(canvas.toDataURL('image/png'));
        return images;
      }

      // Generate images and put them into pdf
      const imgs = await renderPagesToImages();
      if (!imgs || imgs.length === 0) {
        throw new Error('Не удалось подготовить страницы отчёта');
      }

      for (let i = 0; i < imgs.length; i++) {
        if (i > 0) pdf.addPage();
        pdf.addImage(imgs[i], 'PNG', 0, 0, pageWidth, pageHeight);
      }

      const filename = `Технологический_отчёт_${enterpriseName.replace(/\s+/g, '_')}.pdf`;
      pdf.save(filename);
    } catch (error) {
      console.error('Ошибка при генерации отчёта (canvas flow):', error);
      // Пробрасываем ошибку дальше, чтобы она была обработана в обработчике кнопки
      throw error;
    }
  }

  // Функция для заполнения множественного выбора
  function populateMultiSelect(containerId, items, placeholder) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const optionsContainer = container.querySelector('.export-multi-select-options');
    const hiddenInput = container.querySelector('input[type="hidden"]');
    const textElement = container.querySelector('.export-multi-select-text');

    if (!optionsContainer || !hiddenInput || !textElement) return;

    // Сохраняем placeholder для использования в updateMultiSelectValue
    container.setAttribute('data-placeholder', placeholder);

    // Очистка существующих опций
    optionsContainer.innerHTML = '';

    // Добавляем опцию "Выбрать все" в начало списка
    const selectAllOption = document.createElement('div');
    selectAllOption.className = 'export-multi-select-option select-all-option';
    const selectAllId = `${containerId}_select_all`;
    selectAllOption.innerHTML = `
      <input type="checkbox" value="__SELECT_ALL__" id="${selectAllId}" data-select-all="true">
      <label for="${selectAllId}">Выбрать все</label>
    `;
    optionsContainer.appendChild(selectAllOption);

    // Заполнение опций
    items.forEach(item => {
      const option = document.createElement('div');
      option.className = 'export-multi-select-option';
      const safeId = `${containerId}_${item.replace(/[^a-zA-Z0-9_]/g, '_')}`;
      option.innerHTML = `
        <input type="checkbox" value="${item.replace(/"/g, '&quot;')}" id="${safeId}">
        <label for="${safeId}">${item}</label>
      `;
      optionsContainer.appendChild(option);
    });

    // Инициализация обработчиков для этого селекта (после добавления опций)
    setTimeout(() => {
      initMultiSelect(container, placeholder);
    }, 0);
  }

  // Функция для инициализации множественного выбора
  function initMultiSelect(container, placeholder) {
    // Проверка, не инициализирован ли уже
    if (container.dataset.initialized === 'true') {
      // Обновляем только обработчики для опций
      const selectAllCheckbox = container.querySelector('input[data-select-all="true"]');
      let regularCheckboxes = container.querySelectorAll('.export-multi-select-option:not(.select-all-option) input[type="checkbox"]');

      // Обновляем обработчик для "Выбрать все"
      if (selectAllCheckbox) {
        const newSelectAllCheckbox = selectAllCheckbox.cloneNode(true);
        selectAllCheckbox.parentNode.replaceChild(newSelectAllCheckbox, selectAllCheckbox);
        newSelectAllCheckbox.addEventListener('change', (e) => {
          const isChecked = e.target.checked;
          // Получаем актуальный список чекбоксов после клонирования
          const currentCheckboxes = container.querySelectorAll('.export-multi-select-option:not(.select-all-option) input[type="checkbox"]');
          currentCheckboxes.forEach(cb => {
            cb.checked = isChecked;
          });
          updateMultiSelectValue(container, placeholder);

          // Очищаем ошибки при выборе "Выбрать все"
          if (isChecked) {
            const fieldName = container.getAttribute('data-field');
            if (fieldName) {
              const fieldCheckbox = document.getElementById(`field_${fieldName}`);
              if (fieldCheckbox && fieldCheckbox.checked) {
                const fieldItem = fieldCheckbox.closest('.export-field-item');
                if (fieldItem) {
                  fieldItem.classList.remove('has-error');
                }
                container.classList.remove('has-error');
              }
            }
          }
        });
      }

      // Обновляем обработчики для обычных опций
      regularCheckboxes.forEach(checkbox => {
        const newCheckbox = checkbox.cloneNode(true);
        checkbox.parentNode.replaceChild(newCheckbox, checkbox);
        newCheckbox.addEventListener('change', () => {
          // Получаем актуальный список чекбоксов после клонирования
          const currentCheckboxes = container.querySelectorAll('.export-multi-select-option:not(.select-all-option) input[type="checkbox"]');
          const currentSelectAllCheckbox = container.querySelector('input[data-select-all="true"]');
          const allChecked = Array.from(currentCheckboxes).every(cb => cb.checked);
          const someChecked = Array.from(currentCheckboxes).some(cb => cb.checked);
          if (currentSelectAllCheckbox) {
            currentSelectAllCheckbox.checked = allChecked;
            currentSelectAllCheckbox.indeterminate = someChecked && !allChecked;
          }
          updateMultiSelectValue(container, placeholder);

          // Очищаем ошибки при выборе значения
          const fieldName = container.getAttribute('data-field');
          if (fieldName) {
            const values = getMultiSelectValues(container.id);
            // Проверяем, все ли чекбоксы выбраны
            const allCheckboxes = container.querySelectorAll('.export-multi-select-option:not(.select-all-option) input[type="checkbox"]');
            const checkedBoxes = container.querySelectorAll('.export-multi-select-option:not(.select-all-option) input[type="checkbox"]:checked');
            const isAllSelected = allCheckboxes.length > 0 && checkedBoxes.length === allCheckboxes.length;

            if (values.length > 0 || isAllSelected) {
              const fieldCheckbox = document.getElementById(`field_${fieldName}`);
              if (fieldCheckbox && fieldCheckbox.checked) {
                const fieldItem = fieldCheckbox.closest('.export-field-item');
                if (fieldItem) {
                  fieldItem.classList.remove('has-error');
                }
                container.classList.remove('has-error');
              }
              // Скрываем общее сообщение об ошибке
              const errorMessage = document.getElementById('exportFieldsError');
              if (errorMessage) {
                errorMessage.style.display = 'none';
              }
            }
          }
        });
      });

      updateMultiSelectValue(container, placeholder);
      return;
    }

    const trigger = container.querySelector('.export-multi-select-trigger');
    const dropdown = container.querySelector('.export-multi-select-dropdown');
    const searchInput = container.querySelector('.export-multi-select-search input');
    const hiddenInput = container.querySelector('input[type="hidden"]');
    const textElement = container.querySelector('.export-multi-select-text');

    if (!trigger || !dropdown || !hiddenInput || !textElement) return;

    // Открытие/закрытие выпадающего списка
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      container.classList.toggle('open');
    });

    // Закрытие при клике вне
    const closeHandler = (e) => {
      if (!container.contains(e.target)) {
        container.classList.remove('open');
      }
    };
    document.addEventListener('click', closeHandler);

    // Поиск (только для blocks и functions)
    const fieldName = container.getAttribute('data-field');
    const hasSearch = fieldName === 'blocks' || fieldName === 'functions';

    if (searchInput && hasSearch) {
      searchInput.addEventListener('input', (e) => {
        const searchText = e.target.value.toLowerCase();
        const options = container.querySelectorAll('.export-multi-select-option');
        options.forEach(option => {
          // Опция "Выбрать все" всегда видима
          if (option.classList.contains('select-all-option')) {
            option.classList.remove('hidden');
            return;
          }
          const label = option.querySelector('label');
          if (label) {
            const text = label.textContent.toLowerCase();
            if (text.includes(searchText)) {
              option.classList.remove('hidden');
            } else {
              option.classList.add('hidden');
            }
          }
        });
      });
    } else if (searchInput && !hasSearch) {
      // Скрываем поле поиска, если оно не нужно
      const searchContainer = container.querySelector('.export-multi-select-search');
      if (searchContainer) {
        searchContainer.style.display = 'none';
      }
    }

    // Обработка выбора опций
    const updateOptions = () => {
      const options = container.querySelectorAll('.export-multi-select-option');
      const selectAllCheckbox = container.querySelector('input[data-select-all="true"]');
      const regularCheckboxes = container.querySelectorAll('.export-multi-select-option:not(.select-all-option) input[type="checkbox"]');

      // Обработчик для "Выбрать все"
      if (selectAllCheckbox && !selectAllCheckbox.dataset.hasHandler) {
        selectAllCheckbox.dataset.hasHandler = 'true';
        selectAllCheckbox.addEventListener('change', (e) => {
          const isChecked = e.target.checked;
          // Получаем актуальный список чекбоксов
          const currentRegularCheckboxes = container.querySelectorAll('.export-multi-select-option:not(.select-all-option) input[type="checkbox"]');
          currentRegularCheckboxes.forEach(cb => {
            cb.checked = isChecked;
          });
          updateMultiSelectValue(container, placeholder);

          // Очищаем ошибки при выборе "Выбрать все"
          if (isChecked) {
            const fieldName = container.getAttribute('data-field');
            if (fieldName) {
              const fieldCheckbox = document.getElementById(`field_${fieldName}`);
              if (fieldCheckbox && fieldCheckbox.checked) {
                const fieldItem = fieldCheckbox.closest('.export-field-item');
                if (fieldItem) {
                  fieldItem.classList.remove('has-error');
                }
                container.classList.remove('has-error');
              }
            }
          }
        });
      }

      // Обработчики для обычных опций
      options.forEach(option => {
        const checkbox = option.querySelector('input[type="checkbox"]');
        if (checkbox && !checkbox.dataset.hasHandler && !checkbox.dataset.selectAll) {
          checkbox.dataset.hasHandler = 'true';
          checkbox.addEventListener('change', () => {
            // Получаем актуальный список чекбоксов и опцию "Выбрать все"
            const currentSelectAllCheckbox = container.querySelector('input[data-select-all="true"]');
            const currentRegularCheckboxes = container.querySelectorAll('.export-multi-select-option:not(.select-all-option) input[type="checkbox"]');
            // Обновляем состояние "Выбрать все"
            const allChecked = Array.from(currentRegularCheckboxes).every(cb => cb.checked);
            const someChecked = Array.from(currentRegularCheckboxes).some(cb => cb.checked);
            if (currentSelectAllCheckbox) {
              currentSelectAllCheckbox.checked = allChecked;
              currentSelectAllCheckbox.indeterminate = someChecked && !allChecked;
            }
            updateMultiSelectValue(container, placeholder);

            // Очищаем ошибки при выборе значения
            const fieldName = container.getAttribute('data-field');
            if (fieldName) {
              const values = getMultiSelectValues(container.id);
              // Проверяем, все ли чекбоксы выбраны
              const allCheckboxes = container.querySelectorAll('.export-multi-select-option:not(.select-all-option) input[type="checkbox"]');
              const checkedBoxes = container.querySelectorAll('.export-multi-select-option:not(.select-all-option) input[type="checkbox"]:checked');
              const isAllSelected = allCheckboxes.length > 0 && checkedBoxes.length === allCheckboxes.length;

              if (values.length > 0 || isAllSelected) {
                const fieldCheckbox = document.getElementById(`field_${fieldName}`);
                if (fieldCheckbox && fieldCheckbox.checked) {
                  const fieldItem = fieldCheckbox.closest('.export-field-item');
                  if (fieldItem) {
                    fieldItem.classList.remove('has-error');
                  }
                  container.classList.remove('has-error');
                }
                // Скрываем общее сообщение об ошибке
                const errorMessage = document.getElementById('exportFieldsError');
                if (errorMessage) {
                  errorMessage.style.display = 'none';
                }
              }
            }
          });
        }
      });
    };

    updateOptions();

    // Инициализация начального состояния "Выбрать все"
    const initialSelectAllCheckbox = container.querySelector('input[data-select-all="true"]');
    const initialRegularCheckboxes = container.querySelectorAll('.export-multi-select-option:not(.select-all-option) input[type="checkbox"]');
    if (initialSelectAllCheckbox && initialRegularCheckboxes.length > 0) {
      const allChecked = Array.from(initialRegularCheckboxes).every(cb => cb.checked);
      const someChecked = Array.from(initialRegularCheckboxes).some(cb => cb.checked);
      initialSelectAllCheckbox.checked = allChecked;
      initialSelectAllCheckbox.indeterminate = someChecked && !allChecked;
    }

    // Обновление текста при загрузке
    updateMultiSelectValue(container, placeholder);

    // Отмечаем как инициализированный
    container.dataset.initialized = 'true';
  }

  // Функция для обновления значения множественного выбора
  function updateMultiSelectValue(container, placeholder) {
    // Исключаем опцию "Выбрать все" из подсчета
    const checkboxes = container.querySelectorAll('.export-multi-select-option:not(.select-all-option) input[type="checkbox"]:checked');
    const hiddenInput = container.querySelector('input[type="hidden"]');
    const textElement = container.querySelector('.export-multi-select-text');

    if (!hiddenInput || !textElement) return;

    const selectedValues = Array.from(checkboxes).map(cb => cb.value);

    // Получаем общее количество опций (без "Выбрать все")
    const totalOptions = container.querySelectorAll('.export-multi-select-option:not(.select-all-option)').length;

    // Если выбраны ВСЕ опции, сохраняем пустой массив (означает "без фильтрации")
    // Это позволяет показать все технологии, когда пользователь хочет "все"
    if (selectedValues.length === totalOptions) {
      hiddenInput.value = '[]';
    } else {
      hiddenInput.value = JSON.stringify(selectedValues);
    }

    if (selectedValues.length === 0) {
      textElement.textContent = placeholder || 'Все';
    } else if (selectedValues.length === totalOptions) {
      textElement.textContent = placeholder || 'Все';
    } else if (selectedValues.length === 1) {
      textElement.textContent = selectedValues[0];
    } else {
      textElement.textContent = `Выбрано: ${selectedValues.length}`;
    }

    // Очищаем ошибки при выборе значения
    // Проверяем реальное количество выбранных чекбоксов (selectedValues.length может быть 0, если все выбраны)
    const allSelected = totalOptions > 0 && selectedValues.length === totalOptions;
    const hasSelection = selectedValues.length > 0 || allSelected;

    const fieldName = container.getAttribute('data-field');
    if (fieldName && hasSelection) {
      const fieldCheckbox = document.getElementById(`field_${fieldName}`);
      if (fieldCheckbox && fieldCheckbox.checked) {
        const fieldItem = fieldCheckbox.closest('.export-field-item');
        if (fieldItem) {
          fieldItem.classList.remove('has-error');
        }
        container.classList.remove('has-error');
      }
    }

    // Также очищаем общее сообщение об ошибке, если есть выбранные значения
    if (hasSelection) {
      const errorMessage = document.getElementById('exportFieldsError');
      if (errorMessage) {
        errorMessage.style.display = 'none';
      }
    }
  }

  // Функция для получения значений множественного выбора
  function getMultiSelectValues(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return [];

    const hiddenInput = container.querySelector('input[type="hidden"]');
    if (!hiddenInput || !hiddenInput.value) return [];

    try {
      return JSON.parse(hiddenInput.value);
    } catch (e) {
      return [];
    }
  }

  // Функция для заполнения списков фильтров
  function populateExportFilters() {
    // Заполнение списка предприятий
    if (typeof enterpriseData !== 'undefined') {
      const companies = Object.keys(enterpriseData).filter(c => c);
      populateMultiSelect('filter_company_container', companies, 'Все предприятия');
    }

    // Заполнение списка блоков
    if (typeof blocksList !== 'undefined' && Array.isArray(blocksList)) {
      populateMultiSelect('filter_blocks_container', blocksList, 'Все блоки');
    }

    // Заполнение списка функций
    if (typeof functions !== 'undefined' && Array.isArray(functions)) {
      populateMultiSelect('filter_functions_container', functions, 'Все функции');
    }

    // Заполнение списка типов технологий
    let techTypesList = [];
    if (typeof techTypes !== 'undefined' && Array.isArray(techTypes)) {
      techTypesList = techTypes;
    } else if (typeof TECHTYPE_TO_SHAPE !== 'undefined') {
      techTypesList = Object.keys(TECHTYPE_TO_SHAPE);
    }
    if (techTypesList.length > 0) {
      populateMultiSelect('filter_techTypes_container', techTypesList, 'Все типы');
    }

    // Заполнение списка статусов
    if (typeof RINGS !== 'undefined' && Array.isArray(RINGS)) {
      populateMultiSelect('filter_status_container', RINGS, 'Все статусы');
    }

    // Заполнение множественного выбора для стоимости внедрения
    const costPromOptions = [
      '0 - 1 000 000',
      '1 000 000 - 5 000 000',
      '5 000 000 - 10 000 000',
      'Более 10 000 000'
    ];
    populateMultiSelect('filter_costProm_container', costPromOptions, 'Все значения');

    // Заполнение множественного выбора для технологической готовности, организационной готовности, покрытия функций
    const ratingOptions = ['0', '1', '2', '3'];
    ['techRead', 'organRead', 'funcCover'].forEach(fieldName => {
      populateMultiSelect(`filter_${fieldName}_container`, ratingOptions, 'Все значения');
    });

    // Заполнение множественного выбора для приоритета технологии (по диапазонам процентов)
    const priorityOptions = [
      'Высокий (60-100%)',
      'Средний (30-60%)',
      'Низкий (0-30%)'
    ];
    populateMultiSelect('filter_priority_container', priorityOptions, 'Все приоритеты');
  }

  // Функции для работы с ошибками валидации (доступны глобально)
  function clearAllErrors() {
    // Убираем все ошибки
    document.querySelectorAll('.export-field-item').forEach(item => {
      item.classList.remove('has-error');
    });
    document.querySelectorAll('.export-multi-select').forEach(select => {
      select.classList.remove('has-error');
    });
    const errorMessage = document.getElementById('exportFieldsError');
    if (errorMessage) {
      errorMessage.style.display = 'none';
    }
  }

  function showFieldError(fieldName) {
    const fieldCheckbox = document.getElementById(`field_${fieldName}`);
    if (!fieldCheckbox) return;

    const fieldItem = fieldCheckbox.closest('.export-field-item');
    if (fieldItem) {
      fieldItem.classList.add('has-error');
    }

    // Если это поле с множественным выбором, подсвечиваем и его контейнер
    const multiSelectFields = ['company', 'blocks', 'functions', 'techTypes', 'status', 'costProm', 'techRead', 'organRead', 'funcCover'];
    if (multiSelectFields.includes(fieldName)) {
      const container = document.getElementById(`filter_${fieldName}_container`);
      if (container) {
        container.classList.add('has-error');
      }
    }
  }

  // Функция для включения/отключения фильтров при изменении чекбоксов
  function setupExportFilterToggles() {
    const multiSelectFields = ['company', 'blocks', 'functions', 'techTypes', 'status', 'costProm', 'techRead', 'organRead', 'funcCover'];
    const singleSelectFields = [];
    const textFields = ['description'];

    // Множественный выбор
    multiSelectFields.forEach(field => {
      const checkbox = document.getElementById(`field_${field}`);
      const container = document.getElementById(`filter_${field}_container`);

      if (checkbox && container) {
        // Установка начального состояния
        if (!checkbox.checked) {
          container.classList.add('disabled');
        }

        // Обработчик изменения чекбокса
        checkbox.addEventListener('change', () => {
          if (checkbox.checked) {
            container.classList.remove('disabled');
          } else {
            container.classList.add('disabled');
            // Сброс значения фильтра при отключении
            const hiddenInput = container.querySelector('input[type="hidden"]');
            if (hiddenInput) {
              hiddenInput.value = '[]';
              const checkboxes = container.querySelectorAll('input[type="checkbox"]');
              checkboxes.forEach(cb => {
                cb.checked = false;
                cb.indeterminate = false;
              });
              const placeholder = container.getAttribute('data-placeholder') || 'Все';
              updateMultiSelectValue(container, placeholder);
            }
          }
          // Очищаем ошибки при изменении
          clearAllErrors();
        });

        // Обработчик изменений в выпадающем списке для скрытия ошибок
        const hiddenInput = container.querySelector('input[type="hidden"]');
        if (hiddenInput) {
          // Используем MutationObserver для отслеживания изменений значения
          const observer = new MutationObserver(() => {
            if (checkbox.checked) {
              const values = getMultiSelectValues(`filter_${field}_container`);
              if (values.length > 0) {
                // Убираем ошибку с этого поля
                const fieldItem = checkbox.closest('.export-field-item');
                if (fieldItem) {
                  fieldItem.classList.remove('has-error');
                }
                container.classList.remove('has-error');
              }
            }
          });
          observer.observe(hiddenInput, { attributes: true, attributeFilter: ['value'] });
        }
      }
    });

    // Одиночный выбор (кастомные выпадающие списки)
    singleSelectFields.forEach(field => {
      const checkbox = document.getElementById(`field_${field}`);
      const filterElement = document.getElementById(`filter_${field}`);
      const customSelect = document.querySelector(`.custom-select-modal[data-field="filter_${field}"]`);

      if (checkbox && filterElement && customSelect) {
        // Устанавливаем начальное состояние
        if (!checkbox.checked) {
          customSelect.classList.add('disabled');
          customSelect.style.pointerEvents = 'none';
          customSelect.style.opacity = '0.5';
        }

        checkbox.addEventListener('change', () => {
          if (checkbox.checked) {
            customSelect.classList.remove('disabled');
            customSelect.style.pointerEvents = '';
            customSelect.style.opacity = '';
          } else {
            customSelect.classList.add('disabled');
            customSelect.style.pointerEvents = 'none';
            customSelect.style.opacity = '0.5';
            filterElement.value = '';
            // Сбрасываем выбранное значение в кастомном селекте
            const selectedText = customSelect.querySelector('.selected-text');
            const placeholder = customSelect.getAttribute('data-placeholder') || 'Все значения';
            if (selectedText) {
              selectedText.textContent = placeholder;
            }
            customSelect.setAttribute('data-value', '');
            // Убираем выделение с выбранного элемента
            customSelect.querySelectorAll('.select-options li').forEach(li => {
              li.classList.remove('selected');
            });
          }
          // Очищаем ошибки при изменении
          clearAllErrors();
        });
      }
    });

    // Текстовые поля
    textFields.forEach(field => {
      const checkbox = document.getElementById(`field_${field}`);
      const filterElement = document.getElementById(`filter_${field}`);

      if (checkbox && filterElement) {
        filterElement.disabled = !checkbox.checked;

        checkbox.addEventListener('change', () => {
          filterElement.disabled = !checkbox.checked;
          if (!checkbox.checked) {
            filterElement.value = '';
          }
          // Очищаем ошибки при изменении
          clearAllErrors();
        });
      }
    });

    // Обработчик для всех основных чекбоксов полей (для скрытия общей ошибки)
    document.querySelectorAll('#exportPdfModal .export-field-item > label input[type="checkbox"], #exportPdfModal .export-field-row > label input[type="checkbox"]').forEach(cb => {
      cb.addEventListener('change', () => {
        // Если выбрано хотя бы одно поле, скрываем общую ошибку
        let hasAnyFieldSelected = false;
        document.querySelectorAll('#exportPdfModal .export-field-item > label input[type="checkbox"], #exportPdfModal .export-field-row > label input[type="checkbox"]').forEach(checkbox => {
          if (checkbox.checked) {
            hasAnyFieldSelected = true;
          }
        });
        if (hasAnyFieldSelected) {
          const errorMessage = document.getElementById('exportFieldsError');
          if (errorMessage) {
            errorMessage.style.display = 'none';
          }
        }
      });
    });
  }

  // Функция для показа модального окна выбора полей
  function showExportPdfModal() {
    if (!checkArchitectRole()) return;

    const modal = document.getElementById('exportPdfModal');
    if (!modal) return;

    // Очищаем все ошибки при открытии модального окна
    clearAllErrors();

    // Дефолтные значения полей
    const defaultFields = {
      name: true,
      company: true,
      blocks: true,
      functions: false,
      techTypes: false,
      status: true,
      costProm: false,
      description: false,
      techRead: false,
      organRead: false,
      funcCover: false,
      priority: false
    };

    // Инициализация чекбоксов
    Object.keys(defaultFields).forEach(field => {
      const checkbox = document.getElementById(`field_${field}`);
      if (checkbox) {
        checkbox.checked = defaultFields[field];
      }
    });

    // Заполнение и обновление фильтров
    populateExportFilters();
    setupExportFilterToggles();

    // Автоматическая установка параметров из текущих фильтров
    // 1. Предприятие (из currentEnterprise)
    if (currentEnterprise && currentEnterprise !== "all") {
      const companyContainer = document.getElementById('filter_company_container');
      if (companyContainer) {
        // Убеждаемся, что поле company выбрано
        const companyCheckbox = document.getElementById('field_company');
        if (companyCheckbox) {
          companyCheckbox.checked = true;
          companyContainer.classList.remove('disabled');
        }
        // Устанавливаем значение
        const companyHiddenInput = companyContainer.querySelector('input[type="hidden"]');
        if (companyHiddenInput) {
          companyHiddenInput.value = JSON.stringify([currentEnterprise]);
          // Обновляем визуальное отображение
          const selectAllCheckbox = companyContainer.querySelector('input[data-select-all="true"]');
          const regularCheckboxes = companyContainer.querySelectorAll('.export-multi-select-option:not(.select-all-option) input[type="checkbox"]');
          regularCheckboxes.forEach(cb => {
            cb.checked = cb.value === currentEnterprise;
          });
          if (selectAllCheckbox) {
            const allChecked = Array.from(regularCheckboxes).every(cb => cb.checked);
            const someChecked = Array.from(regularCheckboxes).some(cb => cb.checked);
            selectAllCheckbox.checked = allChecked;
            selectAllCheckbox.indeterminate = someChecked && !allChecked;
          }
          updateMultiSelectValue(companyContainer, 'Все предприятия');
        }
      }
    }

    // 2. Сектор (если есть зум)
    if (currentZoomedQuadrant !== null) {
      // Получаем блоки для этого квадранта
      const blocksInQuadrant = [];
      if (typeof blockToQuadrant !== 'undefined') {
        Object.keys(blockToQuadrant).forEach(blockName => {
          const qId = Array.isArray(blockToQuadrant[blockName])
            ? blockToQuadrant[blockName][0]
            : blockToQuadrant[blockName];
          if (qId === currentZoomedQuadrant) {
            blocksInQuadrant.push(blockName);
          }
        });
      }
      if (blocksInQuadrant.length > 0) {
        const blocksContainer = document.getElementById('filter_blocks_container');
        if (blocksContainer) {
          const blocksCheckbox = document.getElementById('field_blocks');
          if (blocksCheckbox) {
            blocksCheckbox.checked = true;
            blocksContainer.classList.remove('disabled');
          }
          const blocksHiddenInput = blocksContainer.querySelector('input[type="hidden"]');
          if (blocksHiddenInput) {
            blocksHiddenInput.value = JSON.stringify(blocksInQuadrant);
            const selectAllCheckbox = blocksContainer.querySelector('input[data-select-all="true"]');
            const regularCheckboxes = blocksContainer.querySelectorAll('.export-multi-select-option:not(.select-all-option) input[type="checkbox"]');
            regularCheckboxes.forEach(cb => {
              cb.checked = blocksInQuadrant.includes(cb.value);
            });
            if (selectAllCheckbox) {
              const allChecked = Array.from(regularCheckboxes).every(cb => cb.checked);
              const someChecked = Array.from(regularCheckboxes).some(cb => cb.checked);
              selectAllCheckbox.checked = allChecked;
              selectAllCheckbox.indeterminate = someChecked && !allChecked;
            }
            updateMultiSelectValue(blocksContainer, 'Все блоки');
          }
        }
      }
    }

    // 3. Функциональный блок (из фильтра)
    const filterBlocks = getFilterValues('block');
    if (filterBlocks && filterBlocks.length > 0) {
      const blocksContainer = document.getElementById('filter_blocks_container');
      if (blocksContainer) {
        const blocksCheckbox = document.getElementById('field_blocks');
        if (blocksCheckbox) {
          blocksCheckbox.checked = true;
          blocksContainer.classList.remove('disabled');
        }
        const blocksHiddenInput = blocksContainer.querySelector('input[type="hidden"]');
        if (blocksHiddenInput) {
          blocksHiddenInput.value = JSON.stringify(filterBlocks);
          const selectAllCheckbox = blocksContainer.querySelector('input[data-select-all="true"]');
          const regularCheckboxes = blocksContainer.querySelectorAll('.export-multi-select-option:not(.select-all-option) input[type="checkbox"]');
          regularCheckboxes.forEach(cb => {
            cb.checked = filterBlocks.includes(cb.value);
          });
          if (selectAllCheckbox) {
            const allChecked = Array.from(regularCheckboxes).every(cb => cb.checked);
            const someChecked = Array.from(regularCheckboxes).some(cb => cb.checked);
            selectAllCheckbox.checked = allChecked;
            selectAllCheckbox.indeterminate = someChecked && !allChecked;
          }
          updateMultiSelectValue(blocksContainer, 'Все блоки');
        }
      }
    }

    // 4. Функция (из фильтра)
    const filterFunctions = getFilterValues('function');
    if (filterFunctions && filterFunctions.length > 0) {
      const functionsContainer = document.getElementById('filter_functions_container');
      if (functionsContainer) {
        const functionsCheckbox = document.getElementById('field_functions');
        if (functionsCheckbox) {
          functionsCheckbox.checked = true;
          functionsContainer.classList.remove('disabled');
        }
        const functionsHiddenInput = functionsContainer.querySelector('input[type="hidden"]');
        if (functionsHiddenInput) {
          functionsHiddenInput.value = JSON.stringify(filterFunctions);
          const selectAllCheckbox = functionsContainer.querySelector('input[data-select-all="true"]');
          const regularCheckboxes = functionsContainer.querySelectorAll('.export-multi-select-option:not(.select-all-option) input[type="checkbox"]');
          regularCheckboxes.forEach(cb => {
            cb.checked = filterFunctions.includes(cb.value);
          });
          if (selectAllCheckbox) {
            const allChecked = Array.from(regularCheckboxes).every(cb => cb.checked);
            const someChecked = Array.from(regularCheckboxes).some(cb => cb.checked);
            selectAllCheckbox.checked = allChecked;
            selectAllCheckbox.indeterminate = someChecked && !allChecked;
          }
          updateMultiSelectValue(functionsContainer, 'Все функции');
        }
      }
    }

    // 5. Тип технологии (из фильтра)
    const filterTechTypes = getFilterValues('techType');
    if (filterTechTypes && filterTechTypes.length > 0) {
      const techTypesContainer = document.getElementById('filter_techTypes_container');
      if (techTypesContainer) {
        const techTypesCheckbox = document.getElementById('field_techTypes');
        if (techTypesCheckbox) {
          techTypesCheckbox.checked = true;
          techTypesContainer.classList.remove('disabled');
        }
        const techTypesHiddenInput = techTypesContainer.querySelector('input[type="hidden"]');
        if (techTypesHiddenInput) {
          techTypesHiddenInput.value = JSON.stringify(filterTechTypes);
          const selectAllCheckbox = techTypesContainer.querySelector('input[data-select-all="true"]');
          const regularCheckboxes = techTypesContainer.querySelectorAll('.export-multi-select-option:not(.select-all-option) input[type="checkbox"]');
          regularCheckboxes.forEach(cb => {
            cb.checked = filterTechTypes.includes(cb.value);
          });
          if (selectAllCheckbox) {
            const allChecked = Array.from(regularCheckboxes).every(cb => cb.checked);
            const someChecked = Array.from(regularCheckboxes).some(cb => cb.checked);
            selectAllCheckbox.checked = allChecked;
            selectAllCheckbox.indeterminate = someChecked && !allChecked;
          }
          updateMultiSelectValue(techTypesContainer, 'Все типы');
        }
      }
    }

    // 6. Статус (из фильтра)
    const filterStatus = getFilterValues('level');
    if (filterStatus && filterStatus.length > 0) {
      const statusContainer = document.getElementById('filter_status_container');
      if (statusContainer) {
        const statusCheckbox = document.getElementById('field_status');
        if (statusCheckbox) {
          statusCheckbox.checked = true;
          statusContainer.classList.remove('disabled');
        }
        const statusHiddenInput = statusContainer.querySelector('input[type="hidden"]');
        if (statusHiddenInput) {
          statusHiddenInput.value = JSON.stringify(filterStatus);
          const selectAllCheckbox = statusContainer.querySelector('input[data-select-all="true"]');
          const regularCheckboxes = statusContainer.querySelectorAll('.export-multi-select-option:not(.select-all-option) input[type="checkbox"]');
          regularCheckboxes.forEach(cb => {
            cb.checked = filterStatus.includes(cb.value);
          });
          if (selectAllCheckbox) {
            const allChecked = Array.from(regularCheckboxes).every(cb => cb.checked);
            const someChecked = Array.from(regularCheckboxes).some(cb => cb.checked);
            selectAllCheckbox.checked = allChecked;
            selectAllCheckbox.indeterminate = someChecked && !allChecked;
          }
          updateMultiSelectValue(statusContainer, 'Все статусы');
        }
      }
    }

    showModal('exportPdfModal');

    // Обновляем состояние кнопки переключения после открытия модального окна
    setTimeout(() => {
      const toggleBtn = document.getElementById('toggleAllFields');
      if (toggleBtn) {
        const checkboxes = document.querySelectorAll('#exportPdfModal input[type="checkbox"]');
        const allSelected = checkboxes.length > 0 && Array.from(checkboxes).every(cb => cb.checked);
        const icon = toggleBtn.querySelector('.toggle-all-icon');
        const text = toggleBtn.querySelector('.toggle-all-text');

        if (allSelected && icon && text) {
          icon.innerHTML = '<path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>';
          text.textContent = 'Снять все';
          toggleBtn.setAttribute('data-state', 'all-selected');
        } else if (icon && text) {
          icon.innerHTML = '<path d="M9 11l3 3L22 4"></path><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>';
          text.textContent = 'Выбрать все';
          toggleBtn.setAttribute('data-state', 'not-all-selected');
        }
      }
    }, 50);
  }

  // Функция для применения фильтров к списку технологий
  function applyFiltersToTechnologies(sourceList, filters) {
    if (!sourceList || sourceList.length === 0) return sourceList;

    return sourceList.filter(tech => {
      // Фильтр по предприятию (массив значений)
      if (filters.company && Array.isArray(filters.company) && filters.company.length > 0) {
        // Обрабатываем tech.company как массив или строку
        const techCompanies = Array.isArray(tech.company) ? tech.company : (tech.company ? [tech.company] : []);
        // Проверяем, есть ли пересечение между фильтром и компаниями технологии
        const hasMatchingCompany = techCompanies.some(comp => filters.company.includes(comp));
        if (!hasMatchingCompany) return false;
      }

      // Фильтр по блоку (массив значений)
      if (filters.blocks && Array.isArray(filters.blocks) && filters.blocks.length > 0) {
        const techBlocks = Array.isArray(tech.blocks)
          ? tech.blocks.map(b => {
              if (typeof b === 'number' && typeof blockIdToName !== 'undefined' && blockIdToName[b]) {
                return blockIdToName[b];
              }
              return String(b || '');
            })
          : [tech.block || tech.blocks].filter(Boolean);
        const hasMatchingBlock = techBlocks.some(block => filters.blocks.includes(block));
        if (!hasMatchingBlock) return false;
      }

      // Фильтр по функциям (массив значений)
      if (filters.functions && Array.isArray(filters.functions) && filters.functions.length > 0) {
        const techFunctions = Array.isArray(tech.functions) ? tech.functions : [tech.func || tech.functions].filter(Boolean);
        const hasMatchingFunction = techFunctions.some(func => filters.functions.includes(func));
        if (!hasMatchingFunction) return false;
      }

      // Фильтр по типу технологии (массив значений)
      if (filters.techTypes && Array.isArray(filters.techTypes) && filters.techTypes.length > 0) {
        const techType = tech.techTypes || tech.techType || '';
        if (!filters.techTypes.includes(techType)) return false;
      }

      // Фильтр по статусу (массив значений)
      if (filters.status && Array.isArray(filters.status) && filters.status.length > 0) {
        const techStatus = tech.status || tech.level || '';
        if (!filters.status.includes(techStatus)) return false;
      }

      // Фильтр по стоимости (только для перспективных) - множественный выбор
      if (filters.costProm && Array.isArray(filters.costProm) && filters.costProm.length > 0) {
        const isPerspective = tech.status === 'Перспективные' || tech.level === 'Перспективные';
        if (!isPerspective) return false;

        const cost = Number(tech.costProm) || 0;
        let matchesAnyRange = false;

        filters.costProm.forEach(range => {
          if (range === '0 - 1 000 000' && cost >= 0 && cost <= 1000000) matchesAnyRange = true;
          if (range === '1 000 000 - 5 000 000' && cost > 1000000 && cost <= 5000000) matchesAnyRange = true;
          if (range === '5 000 000 - 10 000 000' && cost > 5000000 && cost <= 10000000) matchesAnyRange = true;
          if (range === 'Более 10 000 000' && cost > 10000000) matchesAnyRange = true;
        });

        if (!matchesAnyRange) return false;
      }

      // Фильтр по описанию (поиск подстроки)
      if (filters.description && filters.description !== '') {
        const desc = (tech.description || '').toLowerCase();
        const searchText = filters.description.toLowerCase();
        if (!desc.includes(searchText)) return false;
      }

      // Фильтр по технологической готовности - множественный выбор
      if (filters.techRead && Array.isArray(filters.techRead) && filters.techRead.length > 0) {
        const techRead = String(tech.techRead || '');
        if (!filters.techRead.includes(techRead)) return false;
      }

      // Фильтр по организационной готовности - множественный выбор
      if (filters.organRead && Array.isArray(filters.organRead) && filters.organRead.length > 0) {
        const organRead = String(tech.organRead || '');
        if (!filters.organRead.includes(organRead)) return false;
      }

      // Фильтр по покрытию функций - множественный выбор
      if (filters.funcCover && Array.isArray(filters.funcCover) && filters.funcCover.length > 0) {
        const funcCover = String(tech.funcCover || '');
        if (!filters.funcCover.includes(funcCover)) return false;
      }

      // Фильтр по приоритету технологии (диапазоны процентов)
      if (filters.priority && Array.isArray(filters.priority) && filters.priority.length > 0) {
        const p = computePriority(tech, 'mult');
        // Если приоритет не посчитан – не попадает ни в один диапазон
        if (p == null || Number.isNaN(p)) return false;

        const percent = Math.round(p * 100);
        let matchesAnyRange = false;

        filters.priority.forEach(range => {
          if (range === 'Высокий (60-100%)' && percent >= 60 && percent <= 100) {
            matchesAnyRange = true;
          }
          if (range === 'Средний (30-60%)' && percent >= 30 && percent < 60) {
            matchesAnyRange = true;
          }
          if (range === 'Низкий (0-30%)' && percent >= 0 && percent < 30) {
            matchesAnyRange = true;
          }
        });

        if (!matchesAnyRange) return false;
      }

      return true;
    });
  }

  // Инициализация обработчиков модального окна экспорта (один раз при загрузке)
  (function initExportPdfModalHandlers() {
    // Функция для проверки состояния всех чекбоксов
    function areAllFieldsSelected() {
      // Проверяем только основные чекбоксы полей, не из выпадающих списков
      const checkboxes = document.querySelectorAll('#exportPdfModal .export-field-item > label input[type="checkbox"], #exportPdfModal .export-field-row > label input[type="checkbox"]');
      if (checkboxes.length === 0) return false;
      return Array.from(checkboxes).every(cb => cb.checked);
    }

    // Функция для обновления состояния кнопки переключения
    function updateToggleAllButton() {
      const toggleBtn = document.getElementById('toggleAllFields');
      if (!toggleBtn) return;

      const allSelected = areAllFieldsSelected();
      const icon = toggleBtn.querySelector('.toggle-all-icon');
      const text = toggleBtn.querySelector('.toggle-all-text');

      if (allSelected) {
        // Показываем иконку "снять все" (пустой квадрат)
        icon.innerHTML = '<path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>';
        if (text) text.textContent = 'Снять все';
        toggleBtn.setAttribute('data-state', 'all-selected');
      } else {
        // Показываем иконку "выбрать все" (галочка в квадрате)
        icon.innerHTML = '<path d="M9 11l3 3L22 4"></path><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>';
        if (text) text.textContent = 'Выбрать все';
        toggleBtn.setAttribute('data-state', 'not-all-selected');
      }
    }

    // Обработчик переключения "Выбрать все" / "Снять все"
    const toggleAllBtn = document.getElementById('toggleAllFields');
    if (toggleAllBtn) {
      toggleAllBtn.addEventListener('click', () => {
        const allSelected = areAllFieldsSelected();
        const shouldSelectAll = !allSelected;

        // Сначала обрабатываем основные чекбоксы полей (не из выпадающих списков)
        document.querySelectorAll('#exportPdfModal .export-field-item > label input[type="checkbox"], #exportPdfModal .export-field-row > label input[type="checkbox"]').forEach(cb => {
          cb.checked = shouldSelectAll;
          // Включаем/отключаем соответствующие фильтры
          const field = cb.getAttribute('data-field');
          const multiSelectFields = ['company', 'blocks', 'functions', 'techTypes', 'status', 'costProm', 'techRead', 'organRead', 'funcCover', 'priority'];

          if (multiSelectFields.includes(field)) {
            const container = document.getElementById(`filter_${field}_container`);
            if (container) {
              if (shouldSelectAll) {
                container.classList.remove('disabled');
                // Если выбрано "Выбрать все", выбираем все опции в выпадающем списке
                const selectAllCheckbox = container.querySelector('input[data-select-all="true"]');
                if (selectAllCheckbox) {
                  selectAllCheckbox.checked = true;
                  const regularCheckboxes = container.querySelectorAll('.export-multi-select-option:not(.select-all-option) input[type="checkbox"]');
                  regularCheckboxes.forEach(cb => {
                    cb.checked = true;
                  });
                  const placeholder = container.getAttribute('data-placeholder') || 'Все';
                  updateMultiSelectValue(container, placeholder);
                } else {
                  // Если опция "Выбрать все" не найдена, выбираем все опции напрямую
                  const regularCheckboxes = container.querySelectorAll('.export-multi-select-option:not(.select-all-option) input[type="checkbox"]');
                  regularCheckboxes.forEach(cb => {
                    cb.checked = true;
                  });
                  const placeholder = container.getAttribute('data-placeholder') || 'Все';
                  updateMultiSelectValue(container, placeholder);
                }
              } else {
                container.classList.add('disabled');
                const hiddenInput = container.querySelector('input[type="hidden"]');
                if (hiddenInput) {
                  hiddenInput.value = '[]';
                  const checkboxes = container.querySelectorAll('input[type="checkbox"]');
                  checkboxes.forEach(cb => {
                    cb.checked = false;
                    cb.indeterminate = false;
                  });
                  const placeholder = container.getAttribute('data-placeholder') || 'Все';
                  updateMultiSelectValue(container, placeholder);
                }
              }
            }
          } else {
            const filterElement = document.getElementById(`filter_${field}`);
            if (filterElement) {
              if (shouldSelectAll) {
                filterElement.disabled = false;
              } else {
                filterElement.disabled = true;
                if (filterElement.tagName === 'SELECT') {
                  filterElement.value = '';
                } else if (filterElement.tagName === 'INPUT') {
                  filterElement.value = '';
                }
              }
            }
          }
        });

        // Очищаем ошибки при выборе
        clearAllErrors();

        // Обновляем состояние кнопки после изменения
        setTimeout(updateToggleAllButton, 10);
      });
    }

    // Обработчики изменений чекбоксов для обновления состояния кнопки
    const exportModal = document.getElementById('exportPdfModal');
    if (exportModal) {
      // Используем делегирование событий для динамических чекбоксов
      exportModal.addEventListener('change', (e) => {
        if (e.target.type === 'checkbox' && e.target.closest('#exportPdfModal')) {
          updateToggleAllButton();
        }
      });
    }

    // Обновляем состояние кнопки при открытии модального окна
    const modalObserver = new MutationObserver(() => {
      if (exportModal && exportModal.style.display !== 'none') {
        updateToggleAllButton();
      }
    });

    if (exportModal) {
      modalObserver.observe(exportModal, {
        attributes: true,
        attributeFilter: ['style', 'class']
      });
    }

    // Инициализируем состояние кнопки при загрузке
    updateToggleAllButton();

    function validateExportFields() {
      clearAllErrors();

      const selectedFields = {};
      const multiSelectFields = ['company', 'blocks', 'functions', 'techTypes', 'status'];
      let hasAnyFieldSelected = false;
      let hasErrors = false;
      const errorMessages = [];

      // Собираем выбранные поля (только основные чекбоксы, не из выпадающих списков)
      document.querySelectorAll('#exportPdfModal .export-field-item > label input[type="checkbox"], #exportPdfModal .export-field-row > label input[type="checkbox"]').forEach(cb => {
        const field = cb.getAttribute('data-field');
        if (field) {
          selectedFields[field] = cb.checked;
          if (cb.checked) {
            hasAnyFieldSelected = true;
          }
        }
      });

      // Если не выбрано ни одно поле
      if (!hasAnyFieldSelected) {
        const errorMessage = document.getElementById('exportFieldsError');
        if (errorMessage) {
          errorMessage.textContent = 'Выберите хотя бы одно поле для экспорта';
          errorMessage.style.display = 'inline-block';
        }
        return false;
      }

      // Проверяем поля с множественным выбором
      const allMultiSelectFields = ['company', 'blocks', 'functions', 'techTypes', 'status', 'costProm', 'techRead', 'organRead', 'funcCover', 'priority'];
      const fieldLabels = {
        'company': 'Предприятия',
        'blocks': 'Функциональный блок',
        'functions': 'Функции',
        'techTypes': 'Тип технологии',
        'status': 'Статус',
        'costProm': 'Стоимость внедрения',
        'techRead': 'Технологическая готовность',
        'organRead': 'Организационная готовность',
        'funcCover': 'Покрытие функций',
        'priority': 'Приоритет'
      };

      allMultiSelectFields.forEach(field => {
        const checkbox = document.getElementById(`field_${field}`);
        if (checkbox && checkbox.checked) {
          const container = document.getElementById(`filter_${field}_container`);
          if (container && !container.classList.contains('disabled')) {
            const values = getMultiSelectValues(`filter_${field}_container`);

            // Проверяем, все ли чекбоксы выбраны внутри контейнера
            // Если все выбраны - это означает "все значения", а не ошибку
            const regularCheckboxes = container.querySelectorAll('.export-multi-select-option:not(.select-all-option) input[type="checkbox"]');
            const checkedCount = container.querySelectorAll('.export-multi-select-option:not(.select-all-option) input[type="checkbox"]:checked').length;
            const allChecked = regularCheckboxes.length > 0 && checkedCount === regularCheckboxes.length;

            // Ошибка только если ничего не выбрано И не все чекбоксы отмечены
            if (values.length === 0 && !allChecked) {
              showFieldError(field);
              hasErrors = true;
              errorMessages.push(`Выберите значение для поля "${fieldLabels[field] || field}"`);
            }
          }
        }
      });

      if (hasErrors) {
        // Показываем сообщения об ошибках
        const errorMessage = document.getElementById('exportFieldsError');
        if (errorMessage) {
          errorMessage.textContent = errorMessages.join('. ');
          errorMessage.style.display = 'inline-block';
        }
        return false;
      }

      return true;
    }

    // Обработчик "Экспортировать"
    const exportBtn = document.getElementById('exportPdfConfirm');
    if (exportBtn) {
      exportBtn.addEventListener('click', async () => {
        // Валидация перед экспортом
        if (!validateExportFields()) {
          return;
        }

        const selectedFields = {};
        const filters = {};

        // Собираем выбранные поля
        document.querySelectorAll('#exportPdfModal input[type="checkbox"]').forEach(cb => {
          const field = cb.getAttribute('data-field');
          if (field) {
            selectedFields[field] = cb.checked;
          }
        });

        // Собираем значения фильтров
        const multiSelectFields = ['company', 'blocks', 'functions', 'techTypes', 'status', 'costProm', 'techRead', 'organRead', 'funcCover', 'priority'];
        const textFields = ['description'];

        // Множественный выбор
        multiSelectFields.forEach(field => {
          const container = document.getElementById(`filter_${field}_container`);
          if (container && !container.classList.contains('disabled')) {
            const values = getMultiSelectValues(`filter_${field}_container`);
            if (values.length > 0) {
              filters[field] = values;
            }
          }
        });

        // Текстовые поля
        textFields.forEach(field => {
          const filterElement = document.getElementById(`filter_${field}`);
          if (filterElement && !filterElement.disabled && filterElement.value) {
            filters[field] = filterElement.value;
          }
        });

        hideModal('exportPdfModal');

        // Показываем индикатор загрузки
        showReportLoading();

        try {
          await performPdfExport(selectedFields, filters);
          // Показываем успех
          showReportSuccess();
        } catch (error) {
          // Показываем ошибку
          showReportError(error.message || 'Произошла ошибка при генерации отчета');
        }
      });
    }

    // Обработчик "Отмена"
    const cancelBtn = document.getElementById('cancelExportPdf');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        hideModal('exportPdfModal');
      });
    }
  })();

  // Обработчик кнопки экспорта PDF
  document.getElementById("exportPdfBtn").onclick = () => {
    showExportPdfModal();
  };

  // Позиционирование выпадающих списков
  function positionOptions(select) {
    if (!select) return;
    // Для структуры с select-dropdown позиционируем dropdown, иначе позиционируем select-options
    const dropdown = select.querySelector('.select-dropdown');
    const list = dropdown || select.querySelector('.select-options');
    if (!list) return;
    // Простое и предсказуемое позиционирование: всегда позиционируем список относительно самого .custom-select
    // требуется, чтобы .custom-select (и .custom-select-modal) имели position: relative (это задано в CSS)
    if (dropdown) {
      // Для select-dropdown позиционирование уже задано в CSS, но можно обновить ширину
      dropdown.style.minWidth = `${select.offsetWidth}px`;
      dropdown.style.width = `${select.offsetWidth}px`;
    } else {
      list.style.position = 'absolute';
      list.style.left = '0';
      list.style.top = 'calc(100% + 6px)';
      list.style.minWidth = `${select.offsetWidth}px`;
      list.style.width = `${select.offsetWidth}px`;
    }
    // Высоту и прокрутку списка оставляем на уровне CSS, чтобы размер выпадающего
    // списка был стабильным и не «прыгал» при открытии/фильтрации.
  }

});
