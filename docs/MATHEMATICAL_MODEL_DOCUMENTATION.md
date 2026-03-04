# Документация по математической модели позиционирования технологий

**Актуально на:** 04.03.2026  
**Источник реализации:** `src/js/modules/radar/positioning.js`, `src/js/modules/utils/func-cover-utils.js`

---

## 1. Обзор

Позиция blip определяется в полярных координатах:

- `theta` - угол внутри квадранта;
- `r` - радиус (дистанция до внедрения).

Модель в текущей реализации линейная по сводному индексу готовности `z_i`.

---

## 2. Расчет угла `theta`

- Квадрант определяется по `directions` и `directionToQuadrant`.
- Для стабильного распределения внутри квадранта используется golden-angle hash.
- Для одной технологии углы в разных квадрантах различаются детерминированно.

Упрощенно:

- `quadrantHash = tech.id * 1000 + quadrantId * 37`
- `angleOffset = (quadrantHash * GOLDEN_ANGLE) % ANGLE_SPAN`
- `theta = startAngle + ANGLE_PAD + angleOffset`

---

## 3. Расчет радиуса `r`

### 3.1 Факторы

- `techRead` (0..3) - технологическая готовность по предприятиям.
- `organRead` (0..3) - организационная готовность по предприятиям.
- `funcCover` (0..3) - покрытие функций.
- `trlStage` (1..3) - стадия TRL.

### 3.2 Нормализация

- `x_techRead = techRead / 3`
- `x_organRead = organRead / 3`
- `x_funcCover = funcCover / 3`
- `x_trlStage = (trlStage - 1) / 2`

### 3.3 Веса по умолчанию (актуальная реализация)

- `techRead: 0.35`
- `organRead: 0.35`
- `funcCover: 0.20`
- `trlStage: 0.10`

Если сумма весов не равна 1.0 (после override из `RadarModelConfig`), выполняется нормализация.

### 3.4 Сводный индекс и радиус

- `z_i = Σ(w_k * x_ik)`
- `r_i = r_min + (r_max - r_min) * (1 - z_i)`

Параметры по умолчанию:

- `r_min = 5`
- `r_max = 95`

Чем выше готовность (`z_i`), тем ближе точка к центру (меньше `r`).

---

## 4. Особенности текущей реализации

### 4.1 Учет предприятий

`techRead`/`organRead` считаются по `tech.enterprises` с учетом выбранных предприятий фильтра.

### 4.2 Исключение внедренных из расчета позиции

В первую очередь учитываются **невнедренные** предприятия. Это позволяет радару отражать потенциал внедрения.

### 4.3 Обработка отсутствующих данных

- Входные факторы валидируются и ограничиваются допустимыми диапазонами.
- Пропущенные факторы учитываются отдельно; доступные веса перераспределяются.
- Предиктор пропусков (`MissingDataPredictor`) включается только флагом `RadarModelConfig.enableMissingDataPrediction = true`.

---

## 5. Расчет `funcCover`

Источник: `src/js/modules/utils/func-cover-utils.js`.

Логика:

1. Берутся покрытые функции `functionCoverage`.
2. Учитываются только функции, относящиеся к блокам технологии (`functionToBlock.json`).
3. Опционально применяются веса важности (`functionWeights.json`).
4. Считается `coveragePercent = coveredWeightedSum / totalWeightedFunctions`.
5. `coveragePercent` преобразуется в `funcCover` в диапазоне `0..3` через `convertCoveragePercentToFuncCover`.

---

## 6. Конфигурирование модели

Параметры могут быть переопределены через `window.RadarModelConfig`.

Пример ключей:

- `weights.techRead|organRead|funcCover|trlStage`
- `r_min`, `r_max`
- `enableMissingDataPrediction`

Файл-шаблон: `src/js/config/radar-model-config.example.js`.

---

## 7. Быстрый sanity-check

Минимальный сценарий в консоли:

- `Positioning.testCalibration({ techRead: 3, organRead: 3, funcCover: 3, trlStage: 3 })`

Ожидаемо: радиус близок к `r_min`, но не равен ему строго (из-за защитного epsilon).
