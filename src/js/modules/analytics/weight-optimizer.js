/**
 * Модуль автоматической оптимизации весов факторов модели позиционирования
 * Использует методы оптимизации (градиентный спуск, генетические алгоритмы)
 * для подбора оптимальных весов на основе исторических данных
 */
(function(window) {
  'use strict';

  // Модуль WeightOptimizer инициализирован

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

    const bias = config.bias || -0.6;
    const alpha = config.alpha || 4;
    const targetRadius = config.targetRadius || 50; // Целевой средний радиус

    let totalLoss = 0;
    let validCount = 0;

    technologies.forEach(tech => {
      // Извлекаем факторы
      const techRead = tech.techRead !== undefined ? tech.techRead / 3 : 0.5;
      const organRead = tech.organRead !== undefined ? tech.organRead / 3 : 0.5;
      const funcCover = tech.funcCover !== undefined ? tech.funcCover / 3 : 0;
      const trlStage = tech.trlStage !== undefined ? (tech.trlStage - 1) / 2 : 0;

      // Вычисляем сводный показатель
      const z_i = weights.techRead * techRead +
                  weights.organRead * organRead +
                  weights.funcCover * funcCover +
                  weights.trlStage * trlStage +
                  bias;

      // Логистическая функция
      const expTerm = Math.exp(-alpha * z_i);
      const p_i = 1 / (1 + expTerm);
      const radius = 100 * (1 - p_i);

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

    // Инициализация популяции
    let population = [];
    for (let i = 0; i < populationSize; i++) {
      const weights = {
        techRead: Math.random(),
        organRead: Math.random(),
        funcCover: Math.random(),
        trlStage: Math.random()
      };
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
    const initialWeights = options.initialWeights || {
      techRead: 0.30,
      organRead: 0.30,
      funcCover: 0.20,
      trlStage: 0.20
    };

    const config = {
      bias: options.bias || -0.6,
      alpha: options.alpha || 4,
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

  // Публичный API
  window.WeightOptimizer = {
    optimizeWeights: optimizeWeights,
    calculateLoss: calculateLoss,
    gradientDescent: gradientDescent,
    geneticAlgorithm: geneticAlgorithm
  };

  // Модуль WeightOptimizer загружен

})(window);
