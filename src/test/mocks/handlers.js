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
let mockProposals = null;

function getTechnologies() {
  if (mockTechnologies === null) {
    mockTechnologies = loadJson('technologies.json');
    if (!Array.isArray(mockTechnologies)) mockTechnologies = [];
  }
  return mockTechnologies;
}

function getProposals() {
  if (mockProposals === null) {
    mockProposals = [];
  }
  return mockProposals;
}

function resetTechnologies() {
  mockTechnologies = null;
  mockProposals = null;
}

export const handlers = [
  // GET /api/v1/technologies
  http.get('*/api/v1/technologies', ({ request }) => {
    const url = new URL(request.url);
    const enterpriseId = url.searchParams.get('enterpriseId');
    let techs = getTechnologies();
    if (enterpriseId != null && enterpriseId !== '') {
      const enterprises = loadJson('enterprises.json') || [];
      const ent = enterprises.find((e) => String(e.id) === String(enterpriseId));
      const companyName = ent ? ent.name : null;
      if (companyName) {
        techs = techs.filter((t) => {
          const companies = Array.isArray(t.company) ? t.company : t.company ? [t.company] : [];
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
    const maxId = techs.length > 0 ? Math.max(...techs.map((t) => Number(t.id) || 0)) : 0;
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
    const idx = techs.findIndex((t) => String(t.id) === String(id));
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
    const idx = techs.findIndex((t) => String(t.id) === String(id));
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
    const filtered = techs.filter((t) => String(t.id) !== String(id));
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

  http.post('*/api/v1/technology-proposals', async ({ request }) => {
    const body = await request.json();
    const proposals = getProposals();
    const maxId = proposals.length > 0 ? Math.max(...proposals.map((item) => Number(item.id) || 0)) : 0;
    const proposal = {
      id: maxId + 1,
      action: String(body && body.action ? body.action : '').trim().toLowerCase(),
      status: 'draft',
      technologyId: body && body.technologyId != null ? Number(body.technologyId) : null,
      payload: body && body.payload && typeof body.payload === 'object' ? body.payload : {},
      comment: body && typeof body.comment === 'string' ? body.comment : '',
      reviewComment: '',
      createdBy: 'editor',
      technologyName: (() => {
        const payloadName = body && body.payload && typeof body.payload.name === 'string' ? body.payload.name.trim() : '';
        if (payloadName) return payloadName;
        const currentTech = getTechnologies().find((item) => String(item.id) === String(body && body.technologyId));
        return currentTech && currentTech.name ? currentTech.name : '';
      })()
    };
    proposals.push(proposal);
    mockProposals = [...proposals];
    return HttpResponse.json(proposal, { status: 201 });
  }),

  http.get('*/api/v1/technology-proposals/mine', () => {
    return HttpResponse.json(getProposals());
  }),

  http.get('*/api/v1/technology-proposals/pending', () => {
    return HttpResponse.json(getProposals().filter((item) => item.status === 'draft'));
  }),

  http.post('*/api/v1/technology-proposals/:id/approve', async ({ request, params }) => {
    const body = await request.json();
    const proposals = getProposals();
    const proposal = proposals.find((item) => String(item.id) === String(params.id));
    if (!proposal) {
      return HttpResponse.json({ error: 'Предложение не найдено' }, { status: 404 });
    }
    proposal.status = 'approved';
    proposal.reviewComment = body && typeof body.review_comment === 'string' ? body.review_comment : '';
    const techs = getTechnologies();
    if (proposal.action === 'create' && proposal.payload) {
      const maxTechId = techs.length > 0 ? Math.max(...techs.map((item) => Number(item.id) || 0)) : 0;
      const created = { ...proposal.payload, id: maxTechId + 1 };
      techs.push(created);
      proposal.technologyId = created.id;
      if (!proposal.technologyName) proposal.technologyName = created.name || '';
    } else if (proposal.action === 'update' && proposal.technologyId != null) {
      const techIndex = techs.findIndex((item) => String(item.id) === String(proposal.technologyId));
      if (techIndex >= 0) {
        techs[techIndex] = { ...techs[techIndex], ...proposal.payload, id: techs[techIndex].id };
        if (!proposal.technologyName) proposal.technologyName = techs[techIndex].name || '';
      }
    } else if (proposal.action === 'delete' && proposal.technologyId != null) {
      mockTechnologies = techs.filter((item) => String(item.id) !== String(proposal.technologyId));
    }
    if (proposal.action !== 'delete') {
      mockTechnologies = [...techs];
    }
    mockProposals = [...proposals];
    return HttpResponse.json(proposal);
  }),

  http.post('*/api/v1/technology-proposals/:id/reject', async ({ request, params }) => {
    const body = await request.json();
    const proposals = getProposals();
    const proposal = proposals.find((item) => String(item.id) === String(params.id));
    if (!proposal) {
      return HttpResponse.json({ error: 'Предложение не найдено' }, { status: 404 });
    }
    proposal.status = 'rejected';
    proposal.reviewComment = body && typeof body.review_comment === 'string' ? body.review_comment : '';
    mockProposals = [...proposals];
    return HttpResponse.json(proposal);
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
