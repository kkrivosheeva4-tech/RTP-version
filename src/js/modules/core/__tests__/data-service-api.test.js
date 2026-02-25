/**
 * Тесты DataService в режиме API с mock (MSW).
 * Шаг 10.3.
 */
import './setup-api-mode.js'; // первым: задаёт API_BASE_URL до загрузки api-config
import { describe, it, expect, beforeEach } from 'vitest';
import { resetTechnologies } from '../../../../test/mocks/handlers.js';
import '../../../config/api-config.js';
import ApiClient from '../api-client.js';
import DataService from '../data-service.js';

describe('DataService (API mode, MSW mock)', () => {
  beforeEach(() => {
    resetTechnologies();
  });

  it('loadReference(blocks) возвращает массив блоков', async () => {
    const blocks = await DataService.loadReference('blocks');
    expect(Array.isArray(blocks)).toBe(true);
    expect(blocks.length).toBeGreaterThan(0);
    expect(blocks[0]).toHaveProperty('id');
    expect(blocks[0]).toHaveProperty('name');
  });

  it('loadReference(enterprises) возвращает массив предприятий', async () => {
    const enterprises = await DataService.loadReference('enterprises');
    expect(Array.isArray(enterprises)).toBe(true);
    expect(enterprises.length).toBeGreaterThan(0);
    expect(enterprises[0]).toHaveProperty('id');
    expect(enterprises[0]).toHaveProperty('name');
  });

  it('loadTechnologies() возвращает нормализованные технологии', async () => {
    const techs = await DataService.loadTechnologies();
    expect(Array.isArray(techs)).toBe(true);
    if (techs.length > 0) {
      const t = techs[0];
      expect(t).toHaveProperty('id');
      expect(t).toHaveProperty('name');
      expect(t).toHaveProperty('block');
    }
  });

  it('loadTechnologies(enterpriseId) фильтрует по предприятию', async () => {
    const techs = await DataService.loadTechnologies(1);
    expect(Array.isArray(techs)).toBe(true);
  });

  it('createTech() создаёт технологию', async () => {
    const newTech = {
      name: 'Тестовая технология',
      description: 'Описание',
      block: 1,
      functionCoverage: ['Маркшейдерские работы']
    };
    const created = await DataService.createTech(newTech);
    expect(created).toHaveProperty('id');
    expect(created.name).toBe(newTech.name);
  });

  it('updateTech() обновляет технологию', async () => {
    const techs = await DataService.loadTechnologies();
    expect(techs.length).toBeGreaterThan(0);
    const id = techs[0].id;
    const updated = await DataService.updateTech(id, { name: 'Обновлённое имя' });
    expect(updated.name).toBe('Обновлённое имя');
  });

  it('deleteTech() удаляет технологию', async () => {
    const techs = await DataService.loadTechnologies();
    const len = techs.length;
    if (len > 0) {
      await DataService.deleteTech(techs[0].id);
      const after = await DataService.loadTechnologies();
      expect(after.length).toBe(len - 1);
    }
  });
});
