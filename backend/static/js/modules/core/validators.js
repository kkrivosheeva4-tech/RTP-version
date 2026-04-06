// validators.js — ES module
// Валидация данных: дубликаты технологий, вендоров и т.д. с учётом омоглифов и регистра

import StateManager from './state-manager.js';

export function normalizeForComparison(str) {
  if (str == null || typeof str !== 'string') return '';
  let s = str.trim().toLowerCase();
  const homoglyphs = [
    ['а', 'a'], ['е', 'e'], ['о', 'o'], ['р', 'p'], ['у', 'y'], ['с', 'c'], ['х', 'x']
  ];
  for (const [cyr, lat] of homoglyphs) {
    s = s.split(cyr).join(lat);
  }
  return s;
}

export function validateDuplicateTechnology(name, excludeId) {
  const technologies = StateManager.get('technologies') || [];
  const normalized = normalizeForComparison(name);
  if (!normalized) {
    return { valid: false, message: 'Введите название технологии' };
  }
  const duplicate = technologies.find((t) => {
    if (excludeId != null && t.id === excludeId) return false;
    return normalizeForComparison(t.name) === normalized;
  });
  return duplicate
    ? { valid: false, message: 'Технология с таким названием уже существует' }
    : { valid: true };
}

if (typeof window !== 'undefined') {
  window.normalizeForComparison = normalizeForComparison;
  window.validateDuplicateTechnology = validateDuplicateTechnology;
}
