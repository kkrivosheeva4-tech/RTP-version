/**
 * Модуль автоматической оптимизации весов факторов модели позиционирования
 * Использует методы оптимизации (градиентный спуск, генетические алгоритмы)
 * для подбора оптимальных весов на основе исторических данных
 */

import FactorEngine from '../radar/factor-engine.js';

'use strict';

  function getModelConfig(config = {}) {
    if (config.modelConfig) return config.modelConfig;
    if (typeof window !== 'undefined' && window.RadarModelConfig) return window.RadarModelConfig;
    return {};
  }

  function getDefaultWeights(config = {}) {
    const modelConfig = getModelConfig(config);
    const registry = FactorEngine.buildFactorRegistry(modelConfig);
    const defaults = {};
    registry.forEach(f => {
      defaults[f.id] = f.weight;
    });
    return defaults;
  }

  /**
   * Функция потерь для оптимизации весов
   * Оценивает качество распределения технологий на радаре
   * @param {Object} weights - Веса факторов
   * @param {Array} technologies - Массив технологий с известными позициями
   * @param {Object} config - Конфигурация модели (bias, alpha)
   * @returns {number} Значение функции потерь (меньше = лучше)
   */
  function calculateLoss(weights, technologies, config) {
    if (!technologies || technologies.length === 0) return Infinity;

    const modelConfig = getModelConfig(config);
    const radiusConfig = FactorEngine.resolveRadiusConfig(modelConfig);
    const baseRegistry = FactorEngine.buildFactorRegistry(modelConfig);
    const registry = baseRegistry.map(f => ({
      ...f,
      weight: weights[f.id] !== undefined ? weights[f.id] : f.weight
    }));
    const targetRadius = config.targetRadius || 50; // Целевой средний радиус

    let totalLoss = 0;
    let validCount = 0;

    technologies.forEach(tech => {
      const readiness = FactorEngine.calculateReadinessIndex({
        tech,
        modelConfig,
        registry
      });
      if (readiness.insufficientData) {
        return;
      }
      const radius = radiusConfig.min + (radiusConfig.max - radiusConfig.min) * (1 - readiness.z);

      // Функция потерь: квадратичное отклонение от целевого распределения
      // Поощряем равномерное распределение по зонам
      const zoneLoss = Math.abs(radius - targetRadius) / 100;
      totalLoss += zoneLoss;
      validCount++;
    });

    return validCount > 0 ? totalLoss / validCount : Infinity;
  }

  /**
   * Градиентный спуск для оптимизации весов
   * @param {Array} technologies - Массив технологий
   * @param {Object} initialWeights - Начальные веса
   * @param {Object} config - Конфигурация
   * @returns {Object} Оптимизированные веса
   */
  function gradientDescent(technologies, initialWeights, config) {
    const learningRate = config.learningRate || 0.01;
    const maxIterations = config.maxIterations || 100;
    const tolerance = config.tolerance || 0.001;

    let weights = Object.assign({}, initialWeights);
    let previousLoss = Infinity;

    for (let iter = 0; iter < maxIterations; iter++) {
      const loss = calculateLoss(weights, technologies, config);

      // Проверка сходимости
      if (Math.abs(previousLoss - loss) < tolerance) {
        // Градиентный спуск сошелся
        break;
      }

      previousLoss = loss;

      // Вычисляем градиенты (численное дифференцирование)
      const epsilon = 0.001;
      const gradients = {};

      Object.keys(weights).forEach(key => {
        const weightsPlus = Object.assign({}, weights, { [key]: weights[key] + epsilon });
        const weightsMinus = Object.assign({}, weights, { [key]: weights[key] - epsilon });

        const lossPlus = calculateLoss(weightsPlus, technologies, config);
        const lossMinus = calculateLoss(weightsMinus, technologies, config);

        gradients[key] = (lossPlus - lossMinus) / (2 * epsilon);
      });

      // Обновляем веса
      Object.keys(weights).forEach(key => {
        weights[key] = Math.max(0, Math.min(1, weights[key] - learningRate * gradients[key]));
      });

      // Нормализуем веса
      const sum = Object.values(weights).reduce((a, b) => a + b, 0);
      if (sum > 0) {
        Object.keys(weights).forEach(key => {
          weights[key] = weights[key] / sum;
        });
      }
    }

    return weights;
  }

  /**
   * Генетический алгоритм для оптимизации весов
   * @param {Array} technologies - Массив технологий
   * @param {Object} config - Конфигурация
   * @returns {Object} Оптимизированные веса
   */
  function geneticAlgorithm(technologies, config) {
    const populationSize = config.populationSize || 20;
    const generations = config.generations || 50;
    const mutationRate = config.mutationRate || 0.1;
    const crossoverRate = config.crossoverRate || 0.7;

    const defaultWeights = getDefaultWeights(config);
    const factorKeys = Object.keys(defaultWeights);
    if (factorKeys.length === 0) return {};

    // Инициализация популяции
    let population = [];
    for (let i = 0; i < populationSize; i++) {
      const weights = {};
      factorKeys.forEach(key => {
        weights[key] = Math.random();
      });
      // Нормализуем
      const sum = Object.values(weights).reduce((a, b) => a + b, 0);
      Object.keys(weights).forEach(key => weights[key] /= sum);
      population.push({ weights, fitness: -calculateLoss(weights, technologies, config) });
    }

    // Эволюция
    for (let gen = 0; gen < generations; gen++) {
      // Сортировка по приспособленности
      population.sort((a, b) => b.fitness - a.fitness);

      // Создание нового поколения
      const newPopulation = [];
      // Элитизм: сохраняем лучших
      const eliteSize = Math.floor(populationSize * 0.2);
      for (let i = 0; i < eliteSize; i++) {
        newPopulation.push(population[i]);
      }

      // Скрещивание и мутация
      while (newPopulation.length < populationSize) {
        // Селекция (турнирная)
        const parent1 = tournamentSelection(population, 3);
        const parent2 = tournamentSelection(population, 3);

        // Скрещивание
        let child = {};
        if (Math.random() < crossoverRate) {
          child = crossover(parent1.weights, parent2.weights);
        } else {
          child = Object.assign({}, parent1.weights);
        }

        // Мутация
        if (Math.random() < mutationRate) {
          child = mutate(child);
        }

        // Нормализация
        const sum = Object.values(child).reduce((a, b) => a + b, 0);
        if (sum > 0) {
          Object.keys(child).forEach(key => child[key] /= sum);
        }

        newPopulation.push({
          weights: child,
          fitness: -calculateLoss(child, technologies, config)
        });
      }

      population = newPopulation;
    }

    // Возвращаем лучшие веса
    population.sort((a, b) => b.fitness - a.fitness);
    return population[0].weights;
  }

  /**
   * Турнирная селекция
   */
  function tournamentSelection(population, tournamentSize) {
    const tournament = [];
    for (let i = 0; i < tournamentSize; i++) {
      tournament.push(population[Math.floor(Math.random() * population.length)]);
    }
    tournament.sort((a, b) => b.fitness - a.fitness);
    return tournament[0];
  }

  /**
   * Скрещивание двух наборов весов
   */
  function crossover(weights1, weights2) {
    const child = {};
    Object.keys(weights1).forEach(key => {
      child[key] = (weights1[key] + weights2[key]) / 2;
    });
    return child;
  }

  /**
   * Мутация весов
   */
  function mutate(weights) {
    const mutated = Object.assign({}, weights);
    const key = Object.keys(weights)[Math.floor(Math.random() * Object.keys(weights).length)];
    mutated[key] = Math.max(0, Math.min(1, mutated[key] + (Math.random() - 0.5) * 0.2));
    return mutated;
  }

  /**
   * Автоматическая оптимизация весов факторов
   * @param {Array} technologies - Массив технологий для обучения
   * @param {Object} options - Опции оптимизации
   * @returns {Object} Оптимизированные веса и метрики
   */
  function optimizeWeights(technologies, options = {}) {
    if (!technologies || technologies.length < 10) {
      // Недостаточно данных для оптимизации
      return null;
    }

    const method = options.method || 'gradient'; // 'gradient' или 'genetic'
    const defaultWeights = getDefaultWeights(options);
    if (Object.keys(defaultWeights).length === 0) {
      return null;
    }
    const initialWeights = options.initialWeights
      ? { ...defaultWeights, ...options.initialWeights }
      : defaultWeights;

    const config = {
      modelConfig: getModelConfig(options),
      targetRadius: options.targetRadius || 50,
      learningRate: options.learningRate || 0.01,
      maxIterations: options.maxIterations || 100,
      tolerance: options.tolerance || 0.001,
      populationSize: options.populationSize || 20,
      generations: options.generations || 50,
      mutationRate: options.mutationRate || 0.1,
      crossoverRate: options.crossoverRate || 0.7
    };

    // Начало оптимизации

    let optimizedWeights;
    if (method === 'genetic') {
      optimizedWeights = geneticAlgorithm(technologies, config);
    } else {
      optimizedWeights = gradientDescent(technologies, initialWeights, config);
    }

    // Вычисляем метрики
    const initialLoss = calculateLoss(initialWeights, technologies, config);
    const optimizedLoss = calculateLoss(optimizedWeights, technologies, config);
    const improvement = ((initialLoss - optimizedLoss) / initialLoss) * 100;

    // Оптимизация завершена

    return {
      weights: optimizedWeights,
      metrics: {
        initialLoss: initialLoss,
        optimizedLoss: optimizedLoss,
        improvement: improvement
      }
    };
  }

  const WeightOptimizer = {
    optimizeWeights: optimizeWeights,
    calculateLoss: calculateLoss,
    gradientDescent: gradientDescent,
    geneticAlgorithm: geneticAlgorithm
  };

  if (typeof window !== 'undefined') {
    window.WeightOptimizer = WeightOptimizer;
  }

  export default WeightOptimizer;
  export { optimizeWeights, calculateLoss, gradientDescent, geneticAlgorithm };
