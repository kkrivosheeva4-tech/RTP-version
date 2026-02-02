/**
 * Модуль учета временной динамики готовности технологий
 * Хранит исторические данные, рассчитывает тренды и визуализирует изменения
 */
(function(window) {
  'use strict';

  console.log('[TemporalDynamics] Инициализация модуля');

  const STORAGE_KEY = 'rtp_tech_history';
  const STORAGE_VERSION = '1.0';

  /**
   * Сохранение исторических данных технологии
   * @param {Object} tech - Технология
   * @param {Date} timestamp - Временная метка (по умолчанию текущее время)
   */
  function saveHistory(tech, timestamp = new Date()) {
    if (!tech || !tech.id) return;

    try {
      let history = {};
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          history = JSON.parse(stored);
        }
      }

      const techId = String(tech.id);
      if (!history[techId]) {
        history[techId] = [];
      }

      const snapshot = {
        timestamp: timestamp.toISOString(),
        techRead: tech.techRead,
        organRead: tech.organRead,
        funcCover: tech.funcCover,
        trlStage: tech.trlStage,
        radius: tech.radius,
        x: tech.x,
        y: tech.y
      };

      history[techId].push(snapshot);

      // Ограничиваем размер истории (последние 100 записей)
      if (history[techId].length > 100) {
        history[techId] = history[techId].slice(-100);
      }

      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
      }
    } catch (e) {
      console.warn('[TemporalDynamics] Ошибка сохранения истории:', e);
    }
  }

  /**
   * Получение истории технологии
   * @param {string|number} techId - ID технологии
   * @returns {Array} Массив исторических снимков
   */
  function getHistory(techId) {
    if (!techId) return [];

    try {
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const history = JSON.parse(stored);
          return history[String(techId)] || [];
        }
      }
    } catch (e) {
      console.warn('[TemporalDynamics] Ошибка загрузки истории:', e);
    }

    return [];
  }

  /**
   * Расчет тренда готовности технологии
   * @param {string|number} techId - ID технологии
   * @param {string} factor - Фактор для анализа ('techRead', 'organRead', 'funcCover', 'trlStage', 'radius')
   * @returns {Object} Объект с трендом
   */
  function calculateTrend(techId, factor = 'radius') {
    const history = getHistory(techId);
    if (history.length < 2) {
      return {
        trend: 'stable',
        change: 0,
        changePercent: 0,
        velocity: 0
      };
    }

    // Сортируем по времени
    const sorted = history.sort((a, b) =>
      new Date(a.timestamp) - new Date(b.timestamp)
    );

    const first = sorted[0];
    const last = sorted[sorted.length - 1];

    const firstValue = first[factor];
    const lastValue = last[factor];

    if (firstValue === undefined || lastValue === undefined) {
      return {
        trend: 'stable',
        change: 0,
        changePercent: 0,
        velocity: 0
      };
    }

    const change = lastValue - firstValue;
    const changePercent = firstValue !== 0 ? (change / firstValue) * 100 : 0;

    // Вычисляем скорость изменения (изменение в единицу времени)
    const timeDiff = new Date(last.timestamp) - new Date(first.timestamp);
    const daysDiff = timeDiff / (1000 * 60 * 60 * 24);
    const velocity = daysDiff > 0 ? change / daysDiff : 0;

    // Определяем тренд
    let trend = 'stable';
    if (Math.abs(changePercent) > 5) {
      trend = changePercent > 0 ? 'improving' : 'declining';
    }

    return {
      trend: trend,
      change: change,
      changePercent: changePercent,
      velocity: velocity,
      firstValue: firstValue,
      lastValue: lastValue,
      firstDate: first.timestamp,
      lastDate: last.timestamp
    };
  }

  /**
   * Прогнозирование будущей готовности технологии
   * @param {string|number} techId - ID технологии
   * @param {string} factor - Фактор для прогноза
   * @param {number} daysAhead - Количество дней вперед
   * @returns {number|null} Прогнозируемое значение или null
   */
  function predictFuture(techId, factor = 'radius', daysAhead = 30) {
    const history = getHistory(techId);
    if (history.length < 2) return null;

    const sorted = history.sort((a, b) =>
      new Date(a.timestamp) - new Date(b.timestamp)
    );

    // Простая линейная экстраполяция
    const values = sorted.map(s => ({
      value: s[factor],
      time: new Date(s.timestamp).getTime()
    })).filter(v => v.value !== undefined);

    if (values.length < 2) return null;

    // Вычисляем среднюю скорость изменения
    let totalVelocity = 0;
    for (let i = 1; i < values.length; i++) {
      const timeDiff = values[i].time - values[i - 1].time;
      const valueDiff = values[i].value - values[i - 1].value;
      if (timeDiff > 0) {
        totalVelocity += valueDiff / (timeDiff / (1000 * 60 * 60 * 24)); // Изменение в день
      }
    }

    const avgVelocity = totalVelocity / (values.length - 1);
    const lastValue = values[values.length - 1].value;
    const prediction = lastValue + (avgVelocity * daysAhead);

    // Ограничиваем диапазон
    if (factor === 'trlStage') {
      return Math.max(1, Math.min(3, Math.round(prediction)));
    } else if (factor === 'radius') {
      return Math.max(0, Math.min(100, prediction));
    } else {
      return Math.max(0, Math.min(3, prediction));
    }
  }

  /**
   * Пакетное сохранение истории для массива технологий
   * @param {Array} technologies - Массив технологий
   */
  function saveBatchHistory(technologies) {
    if (!technologies || technologies.length === 0) return;

    const timestamp = new Date();
    technologies.forEach(tech => {
      saveHistory(tech, timestamp);
    });
  }

  /**
   * Получение статистики изменений для всех технологий
   * @returns {Object} Статистика изменений
   */
  function getGlobalStatistics() {
    try {
      if (typeof localStorage === 'undefined') return null;

      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return null;

      const history = JSON.parse(stored);
      const techIds = Object.keys(history);

      let improving = 0;
      let declining = 0;
      let stable = 0;

      techIds.forEach(techId => {
        const trend = calculateTrend(techId, 'radius');
        if (trend.trend === 'improving') improving++;
        else if (trend.trend === 'declining') declining++;
        else stable++;
      });

      return {
        totalTechnologies: techIds.length,
        improving: improving,
        declining: declining,
        stable: stable,
        improvingPercent: techIds.length > 0 ? (improving / techIds.length) * 100 : 0,
        decliningPercent: techIds.length > 0 ? (declining / techIds.length) * 100 : 0
      };
    } catch (e) {
      console.warn('[TemporalDynamics] Ошибка получения статистики:', e);
      return null;
    }
  }

  // Публичный API
  window.TemporalDynamics = {
    saveHistory: saveHistory,
    getHistory: getHistory,
    calculateTrend: calculateTrend,
    predictFuture: predictFuture,
    saveBatchHistory: saveBatchHistory,
    getGlobalStatistics: getGlobalStatistics
  };

  console.log('[TemporalDynamics] Модуль загружен');

})(window);
