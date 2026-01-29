# Математическая модель радара технологий РТП

## Содержание
1. [Введение](#введение)
2. [Система координат и позиционирование](#система-координат-и-позиционирование)
3. [Математическая модель расчета позиции](#математическая-модель-расчета-позиции)
4. [Расчет покрытия функций (funcCover)](#расчет-покрытия-функций-funccover)
5. [Размер фигур технологий](#размер-фигур-технологий)
6. [Система контроля наложений](#система-контроля-наложений)
7. [Параметры и константы](#параметры-и-константы)
8. [Примеры расчетов](#примеры-расчетов)

---

## Введение

Радар технологий РТП использует сложную математическую модель для визуализации готовности технологий к внедрению. Система автоматически позиционирует технологии на основе их характеристик и предотвращает визуальные наложения для обеспечения читаемости.

**Основные принципы:**
- Позиция технологии определяется автоматически на основе её параметров готовности
- Используется полярная система координат (радиус, угол)
- Применяется логистическая функция для нелинейного масштабирования
- Реализован алгоритм автоматического разведения наложений

---

## Система координат и позиционирование

### Полярная система координат

Радар использует **полярную систему координат** для позиционирования технологий:

- **Центр радара**: `(CENTER_X, CENTER_Y) = (500, 500)` в SVG-координатах
- **Угол θ (theta)**: определяет квадрант/направление (0°-360°)
- **Радиус r**: определяет удаленность от центра (0-100%)

```
Квадранты радара:
        0° (Север)
           |
  Q1       |       Q4
  (0°-90°) | (270°-360°)
-----------+-----------
  Q2       |       Q3
(90°-180°) | (180°-270°)
           |
        180° (Юг)
```

### Определение квадранта

Квадрант технологии определяется на основе **направлений цифрового развития**:

1. Технология имеет одно или несколько направлений (`tech.directions`)
2. Каждое направление маппится на один или несколько квадрантов через `directionToQuadrant`
3. Технология может отображаться в нескольких квадрантах одновременно

**Пример кода** (`src/js/modules/radar/positioning.js`, строки 72-107):
```javascript
function getAllQuadrantsForTech(tech) {
  const quadrantsSet = new Set();

  const directions = Array.isArray(tech.directions)
    ? tech.directions
    : (tech.direction ? [tech.direction] : []);

  directions.forEach(directionName => {
    const directionQuadrants = getQuadrantsForDirection(directionName);
    directionQuadrants.forEach(q => quadrantsSet.add(q));
  });

  return Array.from(quadrantsSet);
}
```

### Вычисление угла (θ)

Угол рассчитывается на основе:
- **Квадранта** технологии (определяет базовый диапазон 90°)
- **ID технологии** (для распределения внутри квадранта)
- **Золотого угла** (137.5°) для равномерного распределения

**Формула:**
```
θ = angleBase + ((id × GOLDEN_ANGLE) mod angleSpan)

где:
- angleBase = quadrant.startAngle + ANGLE_PAD
- angleSpan = 90° - (2 × ANGLE_PAD)
- GOLDEN_ANGLE = 137.50776405003785°
- ANGLE_PAD = 8° (отступ от границ квадранта)
```

**Реализация** (`positioning.js`, строки 234-241):
```javascript
const GOLDEN_ANGLE = 137.50776405003785;
const ANGLE_PAD = POSITION_ANGLE_PAD;
const ANGLE_SPAN = 90 - (ANGLE_PAD * 2);
const aBase = q.startAngle + ANGLE_PAD;
const id = Number(tech.id) || 0;
const angleOffset = ((id * GOLDEN_ANGLE) % ANGLE_SPAN);
theta = aBase + angleOffset;
```

---

## Математическая модель расчета позиции

### Обзор модели

Радиус технологии на радаре вычисляется как **"дистанция до внедрения"** по логистической модели:

- **Близко к центру** (малый радиус) = технология готова к внедрению
- **Далеко от центра** (большой радиус) = технология требует доработки

### Конвейер вычисления радиуса

Модель включает 5 этапов:

#### 1. Извлечение факторов (s_ik)

Используются 4 фактора готовности:

| Фактор | Диапазон | Описание |
|--------|----------|----------|
| `techRead` | 0-3 | Технологическая готовность (среднее по предприятиям) |
| `organRead` | 0-3 | Организационная готовность (среднее по предприятиям) |
| `funcCover` | 0-3 | Покрытие функций (общее для технологии) |
| `trlStage` | 1-3 | TRL стадия (Technology Readiness Level) |

**Особенности расчета techRead и organRead:**
- Вычисляются как **среднее значение** по выбранным предприятиям из фильтра
- Если фильтр не применен → используются все предприятия технологии
- Берутся из массива `tech.enterprises[]`

**Код** (`positioning.js`, строки 265-388):
```javascript
// Получаем выбранные предприятия из фильтра
let selectedEnterpriseNames = [];
if (window.Filters && typeof window.Filters.getFilterValues === 'function') {
  selectedEnterpriseNames = window.Filters.getFilterValues('enterprise') || [];
}

// Фильтруем enterprises по выбранным
let filteredEnterprises = enterprises;
if (selectedEnterpriseNames.length > 0) {
  filteredEnterprises = enterprises.filter(ent => {
    // Проверка соответствия названия предприятия
    return selectedNamesSet.has(enterpriseName.toLowerCase());
  });
}

// Вычисляем средние значения
filteredEnterprises.forEach(ent => {
  sumTechRead += Number(ent.technologicalReadiness);
  sumOrganRead += Number(ent.organizationalReadiness);
  countTechRead++;
  countOrganRead++;
});

techRead = countTechRead > 0 ? sumTechRead / countTechRead : 0;
organRead = countOrganRead > 0 ? sumOrganRead / countOrganRead : 0;
```

#### 2. Нормализация (s_ik → x_ik)

Все факторы нормализуются в диапазон [0, 1]:

```
x_techRead  = techRead / 3
x_organRead = organRead / 3
x_funcCover = funcCover / 3
x_trlStage  = (trlStage - 1) / 2
```

**Примеры:**
- `techRead = 3` → `x_techRead = 1.0`
- `techRead = 1.5` → `x_techRead = 0.5`
- `trlStage = 1` → `x_trlStage = 0.0`
- `trlStage = 3` → `x_trlStage = 1.0`

**Код** (`positioning.js`, строки 422-428):
```javascript
const x_techRead = techRead / 3;
const x_organRead = organRead / 3;
const x_funcCover = funcCover / 3;
const x_trlStage = (trlStage - 1) / 2;
```

#### 3. Сводный показатель (z_i)

Вычисляется взвешенная сумма нормализованных факторов:

```
z_i = Σ(w_k × x_ik) + bias
z_i = w₁×x_techRead + w₂×x_organRead + w₃×x_funcCover + w₄×x_trlStage + bias
```

**Веса факторов (w_k):**
```javascript
const weights = {
  techRead:  0.30,  // 30% - Технологическая готовность
  organRead: 0.30,  // 30% - Организационная готовность
  funcCover: 0.20,  // 20% - Покрытие функций
  trlStage:  0.20   // 20% - TRL стадия
};
// Сумма весов = 1.0 ✓
```

**Сдвиг (bias):**
```javascript
const bias = -0.6;
```

**Обоснование весов:**
- `techRead` и `organRead` — наиболее важные факторы (по 30%)
- `funcCover` и `trlStage` — дополняющие факторы (по 20%)
- Все веса положительные → все факторы "приближают" к центру
- Bias -0.6 калибрует общую строгость модели

**Код** (`positioning.js`, строки 430-436):
```javascript
let z_i = 0;
z_i += weights.techRead * x_techRead;
z_i += weights.organRead * x_organRead;
z_i += weights.funcCover * x_funcCover;
z_i += weights.trlStage * x_trlStage;
z_i += bias;
```

#### 4. Логистическая функция (p_i)

Применяется логистическая функция для нелинейного преобразования:

```
p_i = 1 / (1 + e^(-α × z_i))

где α = 4 (параметр чувствительности)
```

**Свойства:**
- `p_i ∈ (0, 1)` — степень готовности к внедрению
- При `z_i = 0`: `p_i = 0.5` (нейтральное положение)
- При `z_i → +∞`: `p_i → 1` (полная готовность)
- При `z_i → -∞`: `p_i → 0` (не готово)

**График логистической функции:**
```
p_i
1.0 |           ___________
    |         /
0.5 |       /
    |     /
0.0 |___/
    |_____|_____|_____|
      -2    0    2      z_i
```

**Код** (`positioning.js`, строки 438-441):
```javascript
const ALPHA = 4;
const expTerm = Math.exp(-ALPHA * z_i);
const p_i = 1 / (1 + expTerm);
```

#### 5. Вычисление радиуса (r_i)

Финальное преобразование в радиус:

```
r_i = 100 × (1 - p_i)
```

**Инверсия:** чем выше `p_i` (готовность), тем **меньше** радиус (ближе к центру).

**Гарантия диапазона:**
```javascript
const EPSILON = 0.01; // Минимальное отклонение от границ

if (r_i <= 0) {
  r_i = EPSILON; // 0.01% вместо 0%
} else if (r_i >= 100) {
  r_i = 100 - EPSILON; // 99.99% вместо 100%
}
```

**Итоговый результат:** `r_i ∈ (0, 100)` — радиус в процентах.

**Код** (`positioning.js`, строки 443-455):
```javascript
let r_i = 100 * (1 - p_i);

const EPSILON = 0.01;
if (r_i <= 0) {
  r_i = EPSILON;
} else if (r_i >= 100) {
  r_i = 100 - EPSILON;
}

return {
  theta: theta,
  radius: r_i
};
```

### Масштабирование в SVG-координаты

Радиус в процентах преобразуется в пиксели SVG:

```javascript
const RADIUS_STEP = 140; // Шаг между кольцами
const RINGS = 3; // Количество колец
const POSITION_PAD = 30; // Отступ от границ

const maxR = RINGS × RADIUS_STEP; // 420px
const availableRadius = maxR - POSITION_PAD; // 390px

// Масштабирование: 0-100% → 30-420px
const radius = POSITION_PAD + (r_i / 100) × availableRadius;
```

**Преобразование в декартовы координаты:**
```javascript
function polarToCartesian(centerX, centerY, radius, angleDeg) {
  const angleRad = (angleDeg - 90) × (Math.PI / 180);
  return {
    x: centerX + radius × Math.cos(angleRad),
    y: centerY + radius × Math.sin(angleRad)
  };
}

const pos = polarToCartesian(CENTER_X, CENTER_Y, radius, theta);
tech.x = Math.round(pos.x);
tech.y = Math.round(pos.y);
```

---

## Расчет покрытия функций (funcCover)

### Определение

**Покрытие функций (funcCover)** — показатель того, сколько бизнес-функций покрывает технология.

**Диапазон:** 0-3
- `0` — функции не указаны
- `1` — покрывает 1 функцию
- `2` — покрывает 2-3 функции
- `3` — покрывает 4+ функций

### Алгоритм расчета

#### Метод 1: Базовый расчет (по количеству функций)

Используется как fallback, если более сложный расчет недоступен:

```javascript
const funcCount = tech.functionCoverage.length;

if (funcCount === 1) {
  funcCover = 1;
} else if (funcCount >= 2 && funcCount <= 3) {
  funcCover = 2;
} else if (funcCount >= 4) {
  funcCover = 3;
}
```

**Код** (`positioning.js`, строки 404-410):
```javascript
if (funcCount === 1) {
  funcCover = 1;
} else if (funcCount >= 2 && funcCount <= 3) {
  funcCover = 2;
} else if (funcCount >= 4) {
  funcCover = 3;
}
```

#### Метод 2: Расчет с учетом блоков (предпочтительный)

Если доступен модуль `FuncCoverUtils`, используется более сложная логика:

1. Извлекается список функций технологии (`tech.functionCoverage`)
2. Извлекается список блоков технологии (`tech.blocks`)
3. Учитывается соответствие функций блокам через `functionToBlock` маппинг
4. Вычисляется взвешенная оценка покрытия

**Асинхронное обновление** (`data-loader.js`, строки 556-568):
```javascript
if (window.FuncCoverUtils && typeof window.FuncCoverUtils.calculateFuncCover === 'function') {
  window.FuncCoverUtils.calculateFuncCover(tech.functionCoverage, techBlockIds)
    .then(calculatedFuncCover => {
      // Обновляем значение в уже созданном объекте
      normalized.funcCover = calculatedFuncCover;
      console.log(`[DataLoader] Обновлен funcCover для технологии ${tech.id}: ${calculatedFuncCover}`);
    })
    .catch(err => {
      console.error('[DataLoader] Ошибка расчета funcCover:', err);
    });
}
```

### Использование в модели

`funcCover` используется в математической модели с весом **20%**:

```
z_i = ... + 0.20 × (funcCover / 3) + ...
```

**Влияние на позицию:**
- `funcCover = 0` → нет вклада в приближение к центру
- `funcCover = 3` → вклад 0.20 в сводный показатель z_i

---

## Размер фигур технологий

### Общие принципы

Все технологии отображаются как **круги** для единообразия интерфейса.

**Размер (радиус круга в пикселях)** зависит от:
- **Страницы** (обычная или директорская)
- **Количества вендоров** (только для директорской страницы)

### Размеры на обычной странице

**Фиксированный размер:**
```javascript
size = 10; // пикселей (радиус круга)
```

Все технологии отображаются одинакового размера.

### Размеры на директорской странице

**Три категории размеров** в зависимости от количества вендоров:

| Вендоров | Размер (px) | Категория |
|----------|-------------|-----------|
| 0-1 | 8 | Малый |
| 2-3 | 14 | Средний |
| 4+ | 20 | Большой |

**Обоснование:**
- Технологии с большим количеством вендоров → более зрелые → больший размер
- Визуальная значимость пропорциональна зрелости рынка
- Облегчает идентификацию "зрелых" технологий

**Код** (`positioning.js`, строки 167-185):
```javascript
function calculateElementSize(tech) {
  const isDirectorPage = document.body && document.body.id === 'rmk-director';
  let size;

  if (isDirectorPage) {
    const vendorCount = (tech.vendors && Array.isArray(tech.vendors))
      ? tech.vendors.length
      : 0;

    if (vendorCount <= 1) {
      size = 8;  // Малый
    } else if (vendorCount === 2 || vendorCount === 3) {
      size = 14; // Средний
    } else {
      size = 20; // Большой (4+)
    }
  } else {
    size = 10; // Обычная страница
  }

  return size;
}
```

### Учет размера при позиционировании

Размер элемента влияет на:
1. **Угловые ограничения** — элемент не должен выходить за границы квадранта
2. **Минимальное расстояние** — между элементами должен быть зазор
3. **Разведение наложений** — учитывается при расчете коллизий

**Вычисление углового размера:**
```javascript
function calculateAngularSize(elementRadius, circleRadius) {
  const angleInRadians = Math.asin(Math.min(1, elementRadius / circleRadius));
  const angleInDegrees = (angleInRadians * 180) / Math.PI;
  return angleInDegrees;
}
```

---

## Система контроля наложений

Система предотвращает визуальное наложение технологий через многоступенчатый алгоритм разведения.

### Этап 1: Группировка по квадрантам

Технологии группируются по квадрантам для изолированной обработки:

```javascript
const groups = new Map();
renderData.forEach(t => {
  const key = `${t.quadrant}`;
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(t);
});
```

### Этап 2: Предварительное разведение идентичных координат

Если две технологии имеют практически одинаковые координаты, они разводятся по углу:

**Критерий идентичности:**
```javascript
const COORDINATE_TOLERANCE = 0.5; // пикселей
if (Math.abs(b.x - a.x) < 0.5 && Math.abs(b.y - a.y) < 0.5) {
  // Координаты идентичны → разводим
}
```

**Алгоритм разведения:**
1. Вычисляются текущие углы обеих технологий
2. Рассчитывается минимальное угловое расстояние:
   ```javascript
   minAngularDistance = angularSizeA + angularSizeB + 2°
   ```
3. Технологии разводятся на это расстояние внутри квадранта

**Код** (`positioning.js`, строки 730-804):
```javascript
// Если координаты идентичны
if (dx < COORDINATE_TOLERANCE && dy < COORDINATE_TOLERANCE) {
  // Вычисляем угловые размеры элементов
  const angularSizeA = calculateAngularSizeInDegrees(sizeA * 1.2, polarA.radius);
  const angularSizeB = calculateAngularSizeInDegrees(sizeB * 1.2, polarB.radius);

  // Минимальное угловое расстояние
  const minAngularDistance = angularSizeA + angularSizeB + 2;

  // Новые углы с разведением
  let newAngleA = angleMin + angleOffsetA;
  let newAngleB = angleMin + angleOffsetB + minAngularDistance;

  // Применяем новые позиции
  a.x = Math.round(newPosA.x);
  a.y = Math.round(newPosA.y);
  b.x = Math.round(newPosB.x);
  b.y = Math.round(newPosB.y);
}
```

### Этап 3: Итеративное разведение (основной алгоритм)

Применяется алгоритм **force-directed layout** для разведения пересекающихся элементов.

**Параметры:**
```javascript
const MIN_BLIP_DISTANCE = 28; // Базовое минимальное расстояние (px)
const ENHANCED_MAX_ITER = 120; // Количество итераций
```

**Адаптивное минимальное расстояние:**
```javascript
// Учитываем размеры элементов
const sizeBasedMinDistance = maxSize × 2 + 4; // 2 радиуса + зазор
baseMinDistance = Math.max(MIN_BLIP_DISTANCE, sizeBasedMinDistance);

// Адаптируем к количеству технологий
const adaptiveMinDistance = techCount > 10 ? baseMinDistance × 1.3
                          : techCount > 5  ? baseMinDistance × 1.15
                          : baseMinDistance;
```

**Алгоритм итерации:**

Для каждой пары технологий (i, j):

1. **Вычисляем расстояние:**
   ```javascript
   const dx = b.x - a.x;
   const dy = b.y - a.y;
   const distSq = dx × dx + dy × dy;
   ```

2. **Проверяем наложение:**
   ```javascript
   const minDistForPair = sizeA + sizeB + 4; // Сумма радиусов + зазор
   const minDistForPairSq = minDistForPair × minDistForPair;

   if (distSq < minDistForPairSq) {
     // Технологии накладываются → нужно развести
   }
   ```

3. **Вычисляем силу отталкивания:**
   ```javascript
   const dist = Math.sqrt(distSq) || 0.001;
   const overlap = minDistForPair - dist;

   // Усиливаем для очень близких точек
   const forceMultiplier = dist < minDistForPair × 0.5 ? 1.5 : 1.0;
   ```

4. **Применяем смещение:**
   ```javascript
   const shiftX = (dx / dist) × (overlap / 2) × forceMultiplier;
   const shiftY = (dy / dist) × (overlap / 2) × forceMultiplier;

   a.x -= shiftX;
   a.y -= shiftY;
   b.x += shiftX;
   b.y += shiftY;
   ```

5. **Ограничиваем квадрантом:**
   ```javascript
   clampToSectorRing(a);
   clampToSectorRing(b);
   ```

**Код** (`positioning.js`, строки 835-877):
```javascript
for (let iter = 0; iter < ENHANCED_MAX_ITER; iter++) {
  let moved = false;

  for (let i = 0; i < group.length; i++) {
    for (let j = i + 1; j < group.length; j++) {
      const a = group[i];
      const b = group[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const distSq = dx × dx + dy × dy;

      const sizeA = (a.size && typeof a.size === 'number') ? a.size : 10;
      const sizeB = (b.size && typeof b.size === 'number') ? b.size : 10;
      const minDistForPair = sizeA + sizeB + 4;
      const minDistForPairSq = minDistForPair × minDistForPair;

      if (distSq < minDistForPairSq) {
        const dist = Math.sqrt(distSq) || 0.001;
        const overlap = minDistForPair - dist;

        const forceMultiplier = dist < minDistForPair × 0.5 ? 1.5 : 1.0;
        const shiftX = (dx / dist) × (overlap / 2) × forceMultiplier;
        const shiftY = (dy / dist) × (overlap / 2) × forceMultiplier;

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

  if (!moved) break; // Сходимость достигнута
}
```

### Этап 4: Радикальное разведение (финальная проверка)

Если после итераций остались наложения, применяется разведение **по радиусу**:

```javascript
// Разводим по радиусу: одну точку ближе к центру, другую дальше
const radiusDiff = minDistForPair × 1.2;
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
```

**Код** (`positioning.js`, строки 881-934).

### Этап 5: Избежание наложения с подписями колец

Дополнительная логика для обычной страницы (не директорской):

**Зоны подписей:**
- Расположены на границе 0° (север) каждого кольца
- Размер: `180×42` пикселей + отступ 6px

**Алгоритм:**
1. Для каждой технологии проверяется попадание в зону подписи
2. Если попадает → технология смещается по углу в сторону от подписи
3. Применяется только для квадрантов 1 и 4 (где находятся подписи)

**Код** (`positioning.js`, строки 939-1017).

### Функция ограничения `clampToSectorRing`

Гарантирует, что технология остается внутри своего квадранта:

```javascript
function clampToSectorRing(t) {
  const polar = cartesianToPolar(CENTER_X, CENTER_Y, t.x, t.y);
  let radius = polar.radius;
  let angle = polar.angle;

  // Ограничиваем радиус
  const rMin = POSITION_PAD;
  const rMax = maxR - POSITION_PAD;
  if (radius < rMin) radius = rMin;
  if (radius > rMax) radius = rMax;

  // Получаем размер элемента и вычисляем угловой размер
  const elementSize = (t.size && typeof t.size === 'number') ? t.size : 10;
  const angularSize = calculateAngularSizeInDegrees(elementSize × 1.1, radius);

  // Корректируем границы квадранта с учетом размера элемента
  const angleMin = q.startAngle + ANGLE_PAD + angularSize;
  const angleMax = q.startAngle + ANGLE_PAD + ANGLE_SPAN - angularSize;

  // Ограничиваем угол
  if (angle < angleMin) angle = angleMin;
  if (angle > angleMax) angle = angleMax;

  // Применяем новые координаты
  const p = polarToCartesian(CENTER_X, CENTER_Y, radius, angle);
  t.x = Math.round(p.x);
  t.y = Math.round(p.y);
}
```

**Код** (`positioning.js`, строки 656-714).

---

## Параметры и константы

### Глобальные константы радара

| Константа | Значение | Описание |
|-----------|----------|----------|
| `SVG_NS` | `"http://www.w3.org/2000/svg"` | Namespace для SVG |
| `CENTER_X` | `500` | X-координата центра (px) |
| `CENTER_Y` | `500` | Y-координата центра (px) |
| `RADIUS_STEP` | `140` | Шаг между кольцами (px) |
| `RINGS` | `3` | Количество колец |

**Определение:** `src/js/RMK2.js`, строки 96-115.

### Параметры позиционирования

| Параметр | Значение | Описание |
|----------|----------|----------|
| `POSITION_PAD` | `30` | Отступ от границ колец (px) |
| `POSITION_ANGLE_PAD` | `8` | Отступ от границ секторов (°) |
| `MIN_BLIP_DISTANCE` | `28` | Минимальная дистанция между технологиями (px) |
| `GOLDEN_ANGLE` | `137.50776405003785` | Золотой угол для распределения (°) |

### Параметры математической модели

| Параметр | Значение | Описание |
|----------|----------|----------|
| `ALPHA` | `4` | Параметр чувствительности логистической функции |
| `bias` | `-0.6` | Сдвиг для калибровки модели |
| `w_techRead` | `0.30` | Вес технологической готовности |
| `w_organRead` | `0.30` | Вес организационной готовности |
| `w_funcCover` | `0.20` | Вес покрытия функций |
| `w_trlStage` | `0.20` | Вес TRL стадии |
| `EPSILON` | `0.01` | Минимальное отклонение от границ (%) |

**Определение:** `src/js/modules/radar/positioning.js`, строки 246-263.

### Параметры размеров подписей

| Параметр | Значение | Описание |
|----------|----------|----------|
| `RING_LABEL_WIDTH` | `180` | Ширина подписи кольца (px) |
| `RING_LABEL_HEIGHT` | `42` | Высота подписи кольца (px) |

### Параметры алгоритма разведения

| Параметр | Значение | Описание |
|----------|----------|----------|
| `ENHANCED_MAX_ITER` | `120` | Количество итераций разведения |
| `COORDINATE_TOLERANCE` | `0.5` | Допуск для идентичных координат (px) |
| `forceMultiplier` | `1.5` / `1.0` | Множитель силы отталкивания |

---

## Примеры расчетов

### Пример 1: Технология с максимальными параметрами

**Входные данные:**
```javascript
tech = {
  id: 42,
  direction: 'Единый центр данных (Data Hub)',
  techRead: 3,    // Максимальная технологическая готовность
  organRead: 3,   // Максимальная организационная готовность
  funcCover: 3,   // Покрывает 4+ функций
  trlStage: 3,    // Готова к внедрению
  vendors: ['Vendor1', 'Vendor2', 'Vendor3', 'Vendor4', 'Vendor5']
}
```

**Расчет:**

1. **Нормализация:**
   ```
   x_techRead  = 3 / 3 = 1.0
   x_organRead = 3 / 3 = 1.0
   x_funcCover = 3 / 3 = 1.0
   x_trlStage  = (3 - 1) / 2 = 1.0
   ```

2. **Сводный показатель:**
   ```
   z_i = 0.30×1.0 + 0.30×1.0 + 0.20×1.0 + 0.20×1.0 + (-0.6)
   z_i = 0.30 + 0.30 + 0.20 + 0.20 - 0.6
   z_i = 0.40
   ```

3. **Логистическая функция:**
   ```
   p_i = 1 / (1 + e^(-4 × 0.40))
   p_i = 1 / (1 + e^(-1.6))
   p_i = 1 / (1 + 0.2019)
   p_i ≈ 0.832
   ```

4. **Радиус:**
   ```
   r_i = 100 × (1 - 0.832)
   r_i ≈ 16.8%
   ```

5. **Размер:**
   ```
   На директорской странице: 5 вендоров → size = 20px
   На обычной странице: size = 10px
   ```

**Результат:** Технология будет **близко к центру** (16.8% от максимального радиуса), что соответствует высокой готовности к внедрению. Большой размер (20px) на директорской странице подчеркивает зрелость.

---

### Пример 2: Технология со средними параметрами

**Входные данные:**
```javascript
tech = {
  id: 15,
  direction: 'Цифровые двойники',
  techRead: 1.5,  // Средняя технологическая готовность
  organRead: 1.5, // Средняя организационная готовность
  funcCover: 1.5, // 2-3 функции
  trlStage: 2,    // Прототип
  vendors: ['Vendor1', 'Vendor2']
}
```

**Расчет:**

1. **Нормализация:**
   ```
   x_techRead  = 1.5 / 3 = 0.5
   x_organRead = 1.5 / 3 = 0.5
   x_funcCover = 1.5 / 3 = 0.5
   x_trlStage  = (2 - 1) / 2 = 0.5
   ```

2. **Сводный показатель:**
   ```
   z_i = 0.30×0.5 + 0.30×0.5 + 0.20×0.5 + 0.20×0.5 + (-0.6)
   z_i = 0.15 + 0.15 + 0.10 + 0.10 - 0.6
   z_i = -0.10
   ```

3. **Логистическая функция:**
   ```
   p_i = 1 / (1 + e^(-4 × (-0.10)))
   p_i = 1 / (1 + e^(0.4))
   p_i = 1 / (1 + 1.4918)
   p_i ≈ 0.401
   ```

4. **Радиус:**
   ```
   r_i = 100 × (1 - 0.401)
   r_i ≈ 59.9%
   ```

5. **Размер:**
   ```
   На директорской странице: 2 вендора → size = 14px
   На обычной странице: size = 10px
   ```

**Результат:** Технология в **среднем положении** (59.9% от максимального радиуса), что соответствует промежуточной стадии развития.

---

### Пример 3: Технология с низкими параметрами

**Входные данные:**
```javascript
tech = {
  id: 8,
  direction: 'Предиктивная аналитика',
  techRead: 0,    // Не готова технологически
  organRead: 0,   // Не готова организационно
  funcCover: 0,   // Функции не указаны
  trlStage: 1,    // Исследовательская стадия
  vendors: []     // Нет вендоров
}
```

**Расчет:**

1. **Нормализация:**
   ```
   x_techRead  = 0 / 3 = 0.0
   x_organRead = 0 / 3 = 0.0
   x_funcCover = 0 / 3 = 0.0
   x_trlStage  = (1 - 1) / 2 = 0.0
   ```

2. **Сводный показатель:**
   ```
   z_i = 0.30×0.0 + 0.30×0.0 + 0.20×0.0 + 0.20×0.0 + (-0.6)
   z_i = -0.6
   ```

3. **Логистическая функция:**
   ```
   p_i = 1 / (1 + e^(-4 × (-0.6)))
   p_i = 1 / (1 + e^(2.4))
   p_i = 1 / (1 + 11.023)
   p_i ≈ 0.083
   ```

4. **Радиус:**
   ```
   r_i = 100 × (1 - 0.083)
   r_i ≈ 91.7%
   ```

5. **Размер:**
   ```
   На директорской странице: 0 вендоров → size = 8px
   На обычной странице: size = 10px
   ```

**Результат:** Технология **далеко от центра** (91.7% от максимального радиуса), что соответствует низкой готовности. Малый размер (8px) на директорской странице подчеркивает незрелость.

---

### Пример 4: Влияние отдельных факторов

Сравним влияние каждого фактора при изменении только одного параметра:

| Сценарий | techRead | organRead | funcCover | trlStage | z_i | p_i | r_i (%) | Позиция |
|----------|----------|-----------|-----------|----------|-----|-----|---------|---------|
| Базовый | 0 | 0 | 0 | 1 | -0.60 | 0.083 | 91.7 | У края |
| +techRead | 3 | 0 | 0 | 1 | -0.30 | 0.269 | 73.1 | Ближе |
| +organRead | 0 | 3 | 0 | 1 | -0.30 | 0.269 | 73.1 | Ближе |
| +funcCover | 0 | 0 | 3 | 1 | -0.40 | 0.202 | 79.8 | Немного ближе |
| +trlStage | 0 | 0 | 0 | 3 | -0.40 | 0.202 | 79.8 | Немного ближе |

**Выводы:**
- `techRead` и `organRead` имеют одинаковое влияние (вес 30%)
- `funcCover` и `trlStage` имеют меньшее влияние (вес 20%)
- Для значительного приближения к центру нужны высокие значения **всех** факторов

---

## Тестирование и калибровка модели

### Утилиты для тестирования

Модуль `Positioning` экспортирует функции для проверки калибровки:

#### 1. Тестирование одного сценария

```javascript
// В консоли браузера:
Positioning.testCalibration({
  techRead: 3,
  organRead: 3,
  funcCover: 3,
  trlStage: 3
});

// Вывод:
// === Тест калибровки модели позиционирования ===
// Входные параметры: {techRead: 3, organRead: 3, funcCover: 3, trlStage: 3}
// Результат: {theta: "45.32°", radius: "16.80%", position: "Близко к центру"}
```

#### 2. Тестирование всех сценариев

```javascript
// В консоли браузера:
Positioning.testAllScenarios();

// Вывод:
// === Тестирование всех сценариев калибровки ===
//
// ┌─────────┬────────────────────────────────────┬─────────┐
// │ (index) │             scenario               │ radius  │
// ├─────────┼────────────────────────────────────┼─────────┤
// │    0    │    'Максимальные параметры'        │ '16.80%'│
// │    1    │    'Высокие параметры'             │ '25.12%'│
// │    2    │    'Средние параметры'             │ '59.87%'│
// │    3    │    'Низкие параметры'              │ '85.43%'│
// │    4    │    'Минимальные параметры'         │ '91.70%'│
// │    5    │    'Высокая techRead, ...'         │ '73.11%'│
// │    6    │    'Высокая organRead, ...'        │ '73.11%'│
// │    7    │    'Высокая funcCover, ...'        │ '79.82%'│
// │    8    │    'Высокая trlStage, ...'         │ '79.82%'│
// └─────────┴────────────────────────────────────┴─────────┘
//
// ✅ Тестирование завершено!
```

**Код утилит:** `src/js/modules/radar/positioning.js`, строки 1019-1084.

### Критерии калибровки

Модель считается правильно откалиброванной, если:

1. **Максимальные параметры** → r ≈ 15-20% (близко к центру)
2. **Средние параметры** → r ≈ 50-70% (середина радара)
3. **Минимальные параметры** → r ≈ 90-95% (у края)
4. **Плавный переход** между категориями без резких скачков
5. **Различимое влияние** каждого фактора

---

## Заключение

Математическая модель радара РТП обеспечивает:

✅ **Объективное позиционирование** технологий на основе их готовности
✅ **Нелинейное масштабирование** через логистическую функцию
✅ **Учет множественных факторов** с настраиваемыми весами
✅ **Автоматическое разведение** наложений для читаемости
✅ **Адаптивные размеры** в зависимости от зрелости рынка
✅ **Тестируемость** и возможность калибровки

Модель позволяет визуализировать сложные многомерные данные о технологиях в интуитивно понятной форме, облегчая принятие решений о цифровой трансформации.

---

**Документ подготовлен:** 2026-01-29
**Версия системы:** РТП-2.3
**Файл модуля:** `src/js/modules/radar/positioning.js`
