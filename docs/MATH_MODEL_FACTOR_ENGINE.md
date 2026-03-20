# Factor Engine

## Назначение

`factor-engine` отвечает за конфигурационный расчет индекса готовности технологии (`z`) и за перевод этого индекса в радиус на радаре. Цель движка: позволить добавлять, отключать и перенастраивать факторы без переписывания ядра позиционирования.

## Где используется

- `src/js/modules/radar/factor-engine.js` — ядро registry и расчетов
- `src/js/modules/radar/positioning.js` — расчет радиуса и insufficient-data зоны
- `src/js/modules/business/priorities.js` — пользовательский приоритет и комментарий по слабому звену
- `src/js/modules/analytics/*` — аналитика, калибровка, оптимизация весов, predictor
- `src/js/config/radar-model-config.example.js` — пример конфигурации

## Модель данных фактора

Каждый фактор описывается объектом:

```js
{
  enabled: true,
  weight: 0.35,
  impact: 'positive', // или 'negative'
  scale: { min: 0, max: 3 },
  fallbackPolicy: 'none', // 'none' | 'constant' | 'predict'
  fallbackValue: null
}
```

Поддерживаются базовые факторы:

- `techRead`
- `organRead`
- `funcCover`
- `trlStage`

И дополнительные расширяемые факторы:

- `implementationCostPressure`
- `integrationRisk`
- `integrationComplexity`

## Алгоритм расчета

1. Строится активный registry из baseline-конфига и `window.RadarModelConfig.factors`.
2. Для каждого фактора извлекается исходное значение из технологии или из переданных `rawFactors`.
3. При необходимости применяется fallback:
   - `none` — фактор пропускается;
   - `constant` — берется фиксированное значение;
   - `predict` — вызывается общий prediction callback, который может использовать `k-NN` или регрессию.
4. Значение нормализуется в диапазон `[0, 1]` по `scale`.
5. Для `impact: 'negative'` применяется инверсия `effective = 1 - normalized`.
6. Веса нормализуются по реально валидным факторам.
7. Итоговый индекс готовности `z` считается как взвешенная сумма `effective`.

## Конфигурация

Основная конфигурация задается через `window.RadarModelConfig`:

```js
window.RadarModelConfig = {
  radius: { min: 5, max: 95 },
  minValidFactors: 3,
  factors: {
    techRead: { weight: 0.35, enabled: true },
    integrationRisk: { enabled: true, impact: 'negative', weight: 0.15 }
  }
};
```

Для обратной совместимости еще поддерживаются:

- `weights`
- `r_min`
- `r_max`

Если у фактора задан `factors.<id>.weight`, он имеет приоритет над legacy `weights.<id>`.

## Prediction Pipeline

Общий `predict`-fallback теперь работает через `FactorEngine.calculateReadinessIndex()`:

- сам engine решает, когда применять `fallbackPolicy: 'predict'`;
- consumer передает единый `predictValue` callback;
- `positioning` больше не делает точечные обходы только для `techRead/organRead`, а собирает `rawFactors` и `availability` по активному registry;
- legacy-флаг `enableMissingDataPrediction` сохраняется как bridge для старого поведения и автоматически переводит `techRead/organRead` в predict-fallback, если у них еще стоит `fallbackPolicy: 'none'`.

Поддерживаемые параметры prediction-конфига:

```js
prediction: {
  method: 'knn', // или 'regression'
  k: 5,
  minTrainingSize: 5
}
```

## Current Contract

- Registry уже конфигурационный и расширяемый.
- `negative impact` поддерживается и используется в расчетах.
- `fallbackPolicy: predict` поддерживается как общий runtime-механизм.
- `negative weights` сейчас не поддерживаются: веса нормализуются как неотрицательные.
- Backend parity для factor-engine пока отсутствует: текущий runtime-контракт является frontend-only.

## Decision Record

### C7. Negative Weights vs Negative Impact

Принятое решение:

- Поддерживаем только `negative impact`.
- Отрицательные `weight` не являются допустимым runtime-контрактом.
- Если в конфиг передан отрицательный вес, он clampится к `0`.

Почему так:

- знак влияния и величина влияния разделяются по разным полям и не смешиваются;
- это упрощает интерпретацию модели и нормализацию весов;
- это согласуется с уже реализованным поведением `factor-engine`.

Практическое правило:

```js
integrationRisk: {
  enabled: true,
  weight: 0.15,
  impact: 'negative'
}
```

Неправильный вариант:

```js
integrationRisk: {
  enabled: true,
  weight: -0.15
}
```

### C8. Backend Strategy

Принятое решение:

- На текущем этапе factor-engine остается `frontend-only`.
- Backend не рассчитывает `z`, радиус или итоговую позицию blip.
- Backend хранит и отдает сырые данные факторов, которые frontend использует в своем registry/pipeline.

Почему так:

- текущий runtime уже завязан на frontend-config (`RadarModelConfig`, prediction, registry overrides);
- backend parity потребует отдельного versioned-контракта для модели и синхронизации конфигурации;
- до появления такой версии backend-расчет создаст риск рассинхронизации между UI и API.

Следствие:

- источником истины для позиционирования пока является frontend;
- если в будущем понадобится backend parity, это должно быть отдельной задачей с фиксированным API-контрактом, версионированием модели и regression-suite на совпадение результатов.

## Приоритеты

`src/js/modules/business/priorities.js` больше не использует отдельную жестко зашитую формулу. Теперь модуль:

- берет тот же registry, что и `positioning`;
- использует тот же `RadarModelConfig`;
- считает `weighted` priority через `factor-engine`;
- сохраняет режимы совместимости `avg`, `min`, `mult`, но уже поверх активных факторов registry;
- формирует комментарий по weakest factor на основе фактических contributions.

## Ограничения и следующие шаги

- Нужно добавить расширенные regression tests для `positioning`, analytics и factor-engine pipeline.
