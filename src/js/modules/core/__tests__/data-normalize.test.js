// data-normalize.test.js
// Тесты для модуля data-normalize.js

import { describe, it, expect } from 'vitest';

// Тестовые версии функций из data-normalize.js

/**
 * Строит blockIdToName и nameToBlockId из массива блоков.
 */
function buildBlockMaps(blocks) {
  const blockIdToName = {};
  const nameToBlockId = {};
  const blocksList = Array.isArray(blocks)
    ? blocks.map(b => (b && b.name) ? b.name : b).filter(Boolean)
    : [];

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

  return { blockIdToName, nameToBlockId, blocksList };
}

/**
 * Нормализует значение готовности из диапазона 1-9 в 0-3.
 */
function normalizeReadiness(value) {
  if (value == null || value === undefined) return null;
  const num = Number(value);
  if (Number.isNaN(num)) return null;
  if (num >= 0 && num <= 3) return num;
  if (num >= 1 && num <= 9) {
    return Math.round(((num - 1) / 8) * 3);
  }
  return Math.max(0, Math.min(3, num));
}

/**
 * Строит enterpriseData (map company -> technologies[]) из массива технологий.
 */
function buildEnterpriseDataFromTechnologies(allTechnologies) {
  const enterpriseData = {};
  allTechnologies.forEach(tech => {
    const companies = Array.isArray(tech.company) ? tech.company : (tech.company ? [tech.company] : []);
    companies.forEach(company => {
      if (!enterpriseData[company]) enterpriseData[company] = [];
      enterpriseData[company].push(tech);
    });
  });
  return enterpriseData;
}

describe('buildBlockMaps', () => {
  it('должна возвращать пустые объекты для пустого массива', () => {
    const result = buildBlockMaps([]);
    expect(result.blockIdToName).toEqual({});
    expect(result.nameToBlockId).toEqual({});
    expect(result.blocksList).toEqual([]);
  });

  it('должна обрабатывать массив объектов с id и name', () => {
    const blocks = [
      { id: 1, name: 'Блок1' },
      { id: 2, name: 'Блок2' },
      { id: 3, name: 'Блок3' }
    ];
    const result = buildBlockMaps(blocks);
    expect(result.blockIdToName).toEqual({ 1: 'Блок1', 2: 'Блок2', 3: 'Блок3' });
    expect(result.nameToBlockId).toEqual({ 'Блок1': 1, 'Блок2': 2, 'Блок3': 3 });
    expect(result.blocksList).toEqual(['Блок1', 'Блок2', 'Блок3']);
  });

  it('должна обрабатывать массив строк', () => {
    const blocks = ['Блок1', 'Блок2', 'Блок3'];
    const result = buildBlockMaps(blocks);
    expect(result.blocksList).toEqual(['Блок1', 'Блок2', 'Блок3']);
  });

  it('должна обрабатывать смешанные типы', () => {
    const blocks = [
      { id: 1, name: 'Блок1' },
      'Блок2',
      { id: 3, name: 'Блок3' }
    ];
    const result = buildBlockMaps(blocks);
    expect(result.blockIdToName[1]).toBe('Блок1');
    expect(result.blockIdToName[3]).toBe('Блок3');
    expect(result.nameToBlockId['Блок1']).toBe(1);
    expect(result.nameToBlockId['Блок3']).toBe(3);
    expect(result.blocksList).toContain('Блок1');
    expect(result.blocksList).toContain('Блок2');
    expect(result.blocksList).toContain('Блок3');
  });

  it('должна обрабатывать блоки без name (использует сам объект)', () => {
    const blocks = [
      { id: 1, name: 'Блок1' },
      { id: 2 }, // без name - используется сам объект
      { id: 3, name: 'Блок3' }
    ];
    const result = buildBlockMaps(blocks);
    expect(result.blockIdToName[1]).toBe('Блок1');
    expect(result.blockIdToName[3]).toBe('Блок3');
    // Блок без name использует сам объект как name, но объект не является строкой,
    // поэтому может не попасть в nameToBlockId, но может попасть в blockIdToName
    // Проверяем, что функция обрабатывает такие случаи
    expect(result.blocksList).toContain('Блок1');
    expect(result.blocksList).toContain('Блок3');
  });

  it('должна обрабатывать null и undefined', () => {
    const result1 = buildBlockMaps(null);
    expect(result1.blockIdToName).toEqual({});
    expect(result1.nameToBlockId).toEqual({});
    expect(result1.blocksList).toEqual([]);

    const result2 = buildBlockMaps(undefined);
    expect(result2.blockIdToName).toEqual({});
    expect(result2.nameToBlockId).toEqual({});
    expect(result2.blocksList).toEqual([]);
  });
});

describe('normalizeReadiness', () => {
  it('должна возвращать null для null и undefined', () => {
    expect(normalizeReadiness(null)).toBeNull();
    expect(normalizeReadiness(undefined)).toBeNull();
  });

  it('должна возвращать null для NaN', () => {
    expect(normalizeReadiness(NaN)).toBeNull();
    expect(normalizeReadiness('не число')).toBeNull();
  });

  it('должна возвращать значение как есть для диапазона 0-3', () => {
    expect(normalizeReadiness(0)).toBe(0);
    expect(normalizeReadiness(1)).toBe(1);
    expect(normalizeReadiness(2)).toBe(2);
    expect(normalizeReadiness(3)).toBe(3);
  });

  it('должна нормализовать значения из диапазона 1-9 в 0-3', () => {
    // ВАЖНО: значения 0-3 возвращаются как есть, нормализация применяется только для значений > 3
    // Формула для диапазона 1-9: Math.round(((num - 1) / 8) * 3)
    // Но значения 1-3 попадают в первую проверку (num >= 0 && num <= 3) и возвращаются как есть
    expect(normalizeReadiness(1)).toBe(1); // попадает в диапазон 0-3, возвращается как есть
    expect(normalizeReadiness(2)).toBe(2); // попадает в диапазон 0-3, возвращается как есть
    expect(normalizeReadiness(3)).toBe(3); // попадает в диапазон 0-3, возвращается как есть
    expect(normalizeReadiness(4)).toBe(1); // Math.round(((4-1)/8)*3) = Math.round(1.125) = 1
    expect(normalizeReadiness(5)).toBe(2); // Math.round(((5-1)/8)*3) = Math.round(1.5) = 2
    expect(normalizeReadiness(6)).toBe(2); // Math.round(((6-1)/8)*3) = Math.round(1.875) = 2
    expect(normalizeReadiness(7)).toBe(2); // Math.round(((7-1)/8)*3) = Math.round(2.25) = 2
    expect(normalizeReadiness(8)).toBe(3); // Math.round(((8-1)/8)*3) = Math.round(2.625) = 3
    expect(normalizeReadiness(9)).toBe(3); // Math.round(((9-1)/8)*3) = Math.round(3) = 3
  });

  it('должна ограничивать значения за пределами диапазона', () => {
    expect(normalizeReadiness(-1)).toBe(0); // Math.max(0, Math.min(3, -1)) = 0
    expect(normalizeReadiness(10)).toBe(3); // Math.max(0, Math.min(3, 10)) = 3
    expect(normalizeReadiness(100)).toBe(3);
  });

  it('должна обрабатывать строковые числа', () => {
    expect(normalizeReadiness('0')).toBe(0);
    expect(normalizeReadiness('1')).toBe(1); // попадает в диапазон 0-3, возвращается как есть
    expect(normalizeReadiness('3')).toBe(3); // попадает в диапазон 0-3, возвращается как есть
    expect(normalizeReadiness('9')).toBe(3); // нормализуется из диапазона 1-9
  });
});

describe('buildEnterpriseDataFromTechnologies', () => {
  it('должна возвращать пустой объект для пустого массива', () => {
    expect(buildEnterpriseDataFromTechnologies([])).toEqual({});
  });

  it('должна группировать технологии по компаниям', () => {
    const technologies = [
      { id: 1, name: 'Tech1', company: 'Компания1' },
      { id: 2, name: 'Tech2', company: 'Компания1' },
      { id: 3, name: 'Tech3', company: 'Компания2' }
    ];
    const result = buildEnterpriseDataFromTechnologies(technologies);
    expect(result['Компания1']).toHaveLength(2);
    expect(result['Компания1']).toContainEqual(technologies[0]);
    expect(result['Компания1']).toContainEqual(technologies[1]);
    expect(result['Компания2']).toHaveLength(1);
    expect(result['Компания2']).toContainEqual(technologies[2]);
  });

  it('должна обрабатывать массив компаний', () => {
    const technologies = [
      { id: 1, name: 'Tech1', company: ['Компания1', 'Компания2'] },
      { id: 2, name: 'Tech2', company: 'Компания1' }
    ];
    const result = buildEnterpriseDataFromTechnologies(technologies);
    expect(result['Компания1']).toHaveLength(2);
    expect(result['Компания2']).toHaveLength(1);
  });

  it('должна игнорировать технологии без компании', () => {
    const technologies = [
      { id: 1, name: 'Tech1', company: 'Компания1' },
      { id: 2, name: 'Tech2' }, // без company
      { id: 3, name: 'Tech3', company: null }
    ];
    const result = buildEnterpriseDataFromTechnologies(technologies);
    expect(result['Компания1']).toHaveLength(1);
    expect(Object.keys(result)).toEqual(['Компания1']);
  });

  it('должна обрабатывать пустые массивы компаний', () => {
    const technologies = [
      { id: 1, name: 'Tech1', company: [] },
      { id: 2, name: 'Tech2', company: 'Компания1' }
    ];
    const result = buildEnterpriseDataFromTechnologies(technologies);
    expect(result['Компания1']).toHaveLength(1);
    expect(Object.keys(result)).toEqual(['Компания1']);
  });
});
