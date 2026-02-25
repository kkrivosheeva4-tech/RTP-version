/**
 * MSW handlers для mock API (шаг 10.3).
 * Основные endpoints DataService: technologies, references/*
 */
import { http, HttpResponse } from 'msw';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '../../data/ru');

function loadJson(filename) {
  try {
    const path = join(dataDir, filename);
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch (_) {
    return null;
  }
}

const REFERENCE_FILES = {
  blocks: 'blocks.json',
  functions: 'functions.json',
  functionToBlock: 'functionToBlock.json',
  digitalDirections: 'digitalDirections.json',
  directionToQuadrant: 'directionToQuadrant.json',
  vendors: 'vendors.json',
  integrators: 'integrators.json',
  enterprises: 'enterprises.json',
  enterprisesBlocksMapping: 'enterprises-blocks-mapping.json'
};

/** Хранилище для mutable mock (technologies при POST/PATCH/DELETE) */
let mockTechnologies = null;

function getTechnologies() {
  if (mockTechnologies === null) {
    mockTechnologies = loadJson('technologies.json');
    if (!Array.isArray(mockTechnologies)) mockTechnologies = [];
  }
  return mockTechnologies;
}

function resetTechnologies() {
  mockTechnologies = null;
}

export const handlers = [
  // GET /api/v1/technologies
  http.get('*/api/v1/technologies', ({ request }) => {
    const url = new URL(request.url);
    const enterpriseId = url.searchParams.get('enterpriseId');
    let techs = getTechnologies();
    if (enterpriseId != null && enterpriseId !== '') {
      const enterprises = loadJson('enterprises.json') || [];
      const ent = enterprises.find(e => String(e.id) === String(enterpriseId));
      const companyName = ent ? ent.name : null;
      if (companyName) {
        techs = techs.filter(t => {
          const companies = Array.isArray(t.company) ? t.company : (t.company ? [t.company] : []);
          return companies.includes(companyName);
        });
      }
    }
    return HttpResponse.json(techs);
  }),

  // POST /api/v1/technologies
  http.post('*/api/v1/technologies', async ({ request }) => {
    const tech = await request.json();
    const techs = getTechnologies();
    const maxId = techs.length > 0 ? Math.max(...techs.map(t => Number(t.id) || 0)) : 0;
    const newTech = { ...tech, id: tech.id != null ? tech.id : maxId + 1 };
    techs.push(newTech);
    mockTechnologies = [...techs];
    return HttpResponse.json(newTech, { status: 201 });
  }),

  // PATCH /api/v1/technologies/:id
  http.patch('*/api/v1/technologies/:id', async ({ request, params }) => {
    const id = params.id;
    const body = await request.json();
    const techs = getTechnologies();
    const idx = techs.findIndex(t => String(t.id) === String(id));
    if (idx < 0) {
      return HttpResponse.json({ error: 'Технология не найдена' }, { status: 404 });
    }
    const updated = { ...techs[idx], ...body, id: techs[idx].id };
    techs[idx] = updated;
    mockTechnologies = [...techs];
    return HttpResponse.json(updated);
  }),

  // PUT /api/v1/technologies/:id — альтернатива PATCH
  http.put('*/api/v1/technologies/:id', async ({ request, params }) => {
    const id = params.id;
    const body = await request.json();
    const techs = getTechnologies();
    const idx = techs.findIndex(t => String(t.id) === String(id));
    if (idx < 0) {
      return HttpResponse.json({ error: 'Технология не найдена' }, { status: 404 });
    }
    const updated = { ...techs[idx], ...body, id: techs[idx].id };
    techs[idx] = updated;
    mockTechnologies = [...techs];
    return HttpResponse.json(updated);
  }),

  // DELETE /api/v1/technologies/:id
  http.delete('*/api/v1/technologies/:id', ({ params }) => {
    const id = params.id;
    const techs = getTechnologies();
    const filtered = techs.filter(t => String(t.id) !== String(id));
    if (filtered.length === techs.length) {
      return HttpResponse.json({ error: 'Технология не найдена' }, { status: 404 });
    }
    mockTechnologies = filtered;
    return new HttpResponse(null, { status: 204 });
  }),

  // PUT /api/v1/technologies/bulk
  http.put('*/api/v1/technologies/bulk', async ({ request }) => {
    const technologies = await request.json();
    if (!Array.isArray(technologies)) {
      return HttpResponse.json({ error: 'Ожидается массив' }, { status: 400 });
    }
    mockTechnologies = technologies;
    return new HttpResponse(null, { status: 204 });
  }),

  // GET /api/v1/references/:name
  http.get('*/api/v1/references/:name', ({ params }) => {
    const name = params.name;
    const filename = REFERENCE_FILES[name];
    if (!filename) {
      return HttpResponse.json({ error: 'Неизвестный справочник' }, { status: 404 });
    }
    const data = loadJson(filename);
    if (data === null) {
      if (['functionToBlock', 'directionToQuadrant'].includes(name)) return HttpResponse.json({});
      return HttpResponse.json([]);
    }
    return HttpResponse.json(data);
  }),

  // PUT /api/v1/references/:name
  http.put('*/api/v1/references/:name', () => {
    return new HttpResponse(null, { status: 204 });
  })
];

export { resetTechnologies };
