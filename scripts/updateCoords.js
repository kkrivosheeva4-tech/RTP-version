const fs = require('fs');
const path = require('path');

// Constants matching RMK2.js
const CENTER_X = 500;
const CENTER_Y = 500;
const RADIUS_STEP = 140;
const PAD = 20;
const ANGLE_SPAN = 80;
const GOLDEN_ANGLE = 137.50776405003785;
const PHI_FRAC = 0.6180339887498949;
const COORDS_VERSION = 2;

function polarToCartesian(cx, cy, r, deg) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}
function frac(n) { return n - Math.floor(n); }

function loadJson(rel) {
  const p = path.join(process.cwd(), rel);
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}
function saveJson(rel, data) {
  const p = path.join(process.cwd(), rel);
  fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf8');
}

function main() {
  const enterprisePath = 'data/ru/enterpriseData.json';
  const blocks = loadJson('data/ru/bloks.json');
  const blockToQuadrant = loadJson('data/ru/blockToQuadrant.json');
  const statusList = loadJson('data/ru/status.json'); // order defines rings
  const sectors = loadJson('data/ru/sector.json');
  const blockIdToName = {};
  for (const b of blocks) {
    blockIdToName[Number(b.id)] = b.name;
  }
  const levelToRing = {};
  statusList.forEach((name, idx) => {
    levelToRing[name] = idx;
    if (typeof name === 'string' && name.endsWith('ые')) {
      levelToRing[name.slice(0, -2) + 'ая'] = idx;
    }
  });
  const quadrantAngles = {};
  for (const s of sectors) {
    quadrantAngles[Number(s.quadrant)] = (Number(s.quadrant) - 1) * 90;
  }
  const data = loadJson(enterprisePath);
  if (!Array.isArray(data)) {
    console.error('enterpriseData.json: expected array');
    process.exit(1);
  }
  const updated = data.map(item => {
    const id = Number(item.id) || 0;
    // Derive block name from first blocks id if present
    let blockName = '';
    if (Array.isArray(item.blocks) && item.blocks.length) {
      const bid = Number(item.blocks[0]);
      blockName = blockIdToName[bid] || '';
    } else if (typeof item.block === 'number') {
      blockName = blockIdToName[Number(item.block)] || '';
    } else if (typeof item.block === 'string') {
      blockName = item.block;
    }
    // QuadrantId
    let quadrantId = null;
    const qMap = blockToQuadrant[blockName];
    if (Array.isArray(qMap) && qMap.length) quadrantId = Number(qMap[0]);
    else if (typeof qMap === 'number') quadrantId = Number(qMap);
    if (!(quadrantId >= 1 && quadrantId <= 4)) quadrantId = 1;
    const startAngle = quadrantAngles[quadrantId] ?? (quadrantId - 1) * 90;
    // Ring index
    const ringIndex = (item.status && levelToRing[item.status] != null) ? levelToRing[item.status] : 0;
    const aBase = startAngle + 5;
    const rMin = ringIndex * RADIUS_STEP + PAD;
    const rMax = (ringIndex + 1) * RADIUS_STEP - PAD;
    const angleOffset = (id * GOLDEN_ANGLE) % ANGLE_SPAN;
    const angle = aBase + angleOffset;
    const rFrac = frac(id * PHI_FRAC + ringIndex * 0.173 + quadrantId * 0.317);
    const radius = rMin + rFrac * (rMax - rMin);
    const p = polarToCartesian(CENTER_X, CENTER_Y, radius, angle);
    item.x = Math.round(p.x);
    item.y = Math.round(p.y);
    item._coordsVer = COORDS_VERSION;
    return item;
  });
  saveJson(enterprisePath, updated);
  console.log(`Updated ${updated.length} items in ${enterprisePath}`);
}

main();
