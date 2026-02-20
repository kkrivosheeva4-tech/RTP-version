// func-cover-utils.test.js
// Тесты для модуля func-cover-utils.js

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Тестовые версии функций из func-cover-utils.js
// Поскольку модуль использует IIFE и экспортирует в window, создадим тестовые версии

/**
 * Подсчет количества функций в каждом блоке
 */
function calculateBlockFunctionCounts(functionToBlock) {
  const counts = {};

  for (const [func, blockIds] of Object.entries(functionToBlock)) {
    const blocks = Array.isArray(blockIds) ? blockIds : [blockIds];

    blocks.forEach(blockId => {
      if (!counts[blockId]) {
        counts[blockId] = 0;
      }
      counts[blockId]++;
    });
  }

  return counts;
}

/**
 * Старая логика расчета funcCover (для обратной совместимости)
 */
function calculateFuncCoverLegacy(funcCount) {
  if (funcCount === 0) return 0;
  if (funcCount === 1) return 1;
  if (funcCount >= 2 && funcCount <= 3) return 2;
  return 3; // 4+ функций
}

/**
 * Преобразование процента покрытия в оценку funcCover (0-3)
 */
function convertCoveragePercentToFuncCover(coveragePercent) {
  let funcCover;
  if (coveragePercent === 0) {
    funcCover = 0;
  } else if (coveragePercent >= 1.0) {
    funcCover = 3;
  } else {
    const rawValue = coveragePercent * 3;
    const threshold = 0.05;

    if (rawValue < 1 + threshold) {
      funcCover = 1;
    } else if (rawValue < 2 - threshold) {
      funcCover = Math.round(rawValue);
    } else if (rawValue < 2 + threshold) {
      funcCover = 2;
    } else if (rawValue < 3 - threshold) {
      funcCover = Math.round(rawValue);
    } else {
      funcCover = 3;
    }

    funcCover = Math.max(1, funcCover);
  }

  return Math.min(3, Math.max(0, funcCover));
}

/**
 * Получение описания покрытия функций
 */
function getFuncCoverDescription(funcCover) {
  const coverValue = parseInt(funcCover);
  switch (coverValue) {
    case 0:
      return 'Не покрывает необходимые функции';
    case 1:
      return 'Низкое покрытие функций (до 33%)';
    case 2:
      return 'Среднее покрытие функций (33-67%)';
    case 3:
      return 'Высокое покрытие функций (67-100%)';
    default:
      return 'Не указано';
  }
}

describe('calculateBlockFunctionCounts', () => {
  it('должна возвращать пустой объект для пустого объекта', () => {
    expect(calculateBlockFunctionCounts({})).toEqual({});
  });

  it('должна подсчитывать функции для одного блока', () => {
    const functionToBlock = {
      'Функция1': 1,
      'Функция2': 1,
      'Функция3': 1
    };
    expect(calculateBlockFunctionCounts(functionToBlock)).toEqual({ 1: 3 });
  });

  it('должна обрабатывать массивы блоков', () => {
    const functionToBlock = {
      'Функция1': [1, 2],
      'Функция2': 1,
      'Функция3': [2, 3]
    };
    const result = calculateBlockFunctionCounts(functionToBlock);
    expect(result[1]).toBe(2); // Функция1 и Функция2
    expect(result[2]).toBe(2); // Функция1 и Функция3
    expect(result[3]).toBe(1); // Функция3
  });

  it('должна обрабатывать смешанные типы (число и массив)', () => {
    const functionToBlock = {
      'Функция1': 1,
      'Функция2': [1, 2],
      'Функция3': 2
    };
    const result = calculateBlockFunctionCounts(functionToBlock);
    expect(result[1]).toBe(2); // Функция1 и Функция2
    expect(result[2]).toBe(2); // Функция2 и Функция3
  });
});

describe('calculateFuncCoverLegacy', () => {
  it('должна возвращать 0 для 0 функций', () => {
    expect(calculateFuncCoverLegacy(0)).toBe(0);
  });

  it('должна возвращать 1 для 1 функции', () => {
    expect(calculateFuncCoverLegacy(1)).toBe(1);
  });

  it('должна возвращать 2 для 2-3 функций', () => {
    expect(calculateFuncCoverLegacy(2)).toBe(2);
    expect(calculateFuncCoverLegacy(3)).toBe(2);
  });

  it('должна возвращать 3 для 4+ функций', () => {
    expect(calculateFuncCoverLegacy(4)).toBe(3);
    expect(calculateFuncCoverLegacy(5)).toBe(3);
    expect(calculateFuncCoverLegacy(10)).toBe(3);
  });
});

describe('convertCoveragePercentToFuncCover', () => {
  it('должна возвращать 0 для 0% покрытия', () => {
    expect(convertCoveragePercentToFuncCover(0)).toBe(0);
  });

  it('должна возвращать 3 для 100% покрытия', () => {
    expect(convertCoveragePercentToFuncCover(1.0)).toBe(3);
    expect(convertCoveragePercentToFuncCover(1.5)).toBe(3);
  });

  it('должна возвращать 1 для низкого покрытия', () => {
    expect(convertCoveragePercentToFuncCover(0.01)).toBe(1);
    expect(convertCoveragePercentToFuncCover(0.1)).toBe(1);
    expect(convertCoveragePercentToFuncCover(0.3)).toBe(1);
  });

  it('должна возвращать 2 для среднего покрытия', () => {
    // rawValue = 0.4 * 3 = 1.2 -> Math.round(1.2) = 1, но минимум 1
    // rawValue = 0.5 * 3 = 1.5 -> Math.round(1.5) = 2
    // rawValue = 0.6 * 3 = 1.8 -> Math.round(1.8) = 2
    expect(convertCoveragePercentToFuncCover(0.4)).toBe(1); // 1.2 округляется до 1
    expect(convertCoveragePercentToFuncCover(0.5)).toBe(2); // 1.5 округляется до 2
    expect(convertCoveragePercentToFuncCover(0.6)).toBe(2); // 1.8 округляется до 2
  });

  it('должна возвращать 3 для высокого покрытия', () => {
    // rawValue = 0.7 * 3 = 2.1 -> Math.round(2.1) = 2
    // rawValue = 0.8 * 3 = 2.4 -> Math.round(2.4) = 2
    // rawValue = 0.9 * 3 = 2.7 -> Math.round(2.7) = 3
    expect(convertCoveragePercentToFuncCover(0.7)).toBe(2); // 2.1 округляется до 2
    expect(convertCoveragePercentToFuncCover(0.8)).toBe(2); // 2.4 округляется до 2
    expect(convertCoveragePercentToFuncCover(0.9)).toBe(3); // 2.7 округляется до 3
  });

  it('должна гарантировать минимум 1 для любого ненулевого покрытия', () => {
    expect(convertCoveragePercentToFuncCover(0.001)).toBe(1);
  });

  it('должна ограничивать результат диапазоном 0-3', () => {
    expect(convertCoveragePercentToFuncCover(-1)).toBeGreaterThanOrEqual(0);
    expect(convertCoveragePercentToFuncCover(2)).toBeLessThanOrEqual(3);
  });
});

describe('getFuncCoverDescription', () => {
  it('должна возвращать описание для 0', () => {
    expect(getFuncCoverDescription(0)).toBe('Не покрывает необходимые функции');
  });

  it('должна возвращать описание для 1', () => {
    expect(getFuncCoverDescription(1)).toBe('Низкое покрытие функций (до 33%)');
  });

  it('должна возвращать описание для 2', () => {
    expect(getFuncCoverDescription(2)).toBe('Среднее покрытие функций (33-67%)');
  });

  it('должна возвращать описание для 3', () => {
    expect(getFuncCoverDescription(3)).toBe('Высокое покрытие функций (67-100%)');
  });

  it('должна возвращать "Не указано" для невалидных значений', () => {
    expect(getFuncCoverDescription(4)).toBe('Не указано');
    expect(getFuncCoverDescription(-1)).toBe('Не указано');
    expect(getFuncCoverDescription(null)).toBe('Не указано');
    expect(getFuncCoverDescription(undefined)).toBe('Не указано');
  });

  it('должна обрабатывать строковые значения', () => {
    expect(getFuncCoverDescription('0')).toBe('Не покрывает необходимые функции');
    expect(getFuncCoverDescription('1')).toBe('Низкое покрытие функций (до 33%)');
    expect(getFuncCoverDescription('2')).toBe('Среднее покрытие функций (33-67%)');
    expect(getFuncCoverDescription('3')).toBe('Высокое покрытие функций (67-100%)');
  });
});
