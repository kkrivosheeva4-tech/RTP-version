// Чистые утилиты для радара технологий.
// Декларации в глобальной области, чтобы сохранять совместимость с RMK2.js.

// Декоратор для отсрочки вызова функций.
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Координатные преобразования
function polarToCartesian(cx, cy, r, deg) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

// Обратное преобразование: декартовы → полярные
function cartesianToPolar(cx, cy, x, y) {
  const dx = x - cx;
  const dy = y - cy;
  const radius = Math.sqrt(dx * dx + dy * dy);
  let deg = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
  if (!Number.isFinite(deg)) deg = 0;
  while (deg < 0) deg += 360;
  while (deg >= 360) deg -= 360;
  return { radius, angle: deg };
}

function describeArc(x, y, r, sa, ea) {
  const s = polarToCartesian(x, y, r, ea);
  const e = polarToCartesian(x, y, r, sa);
  return `M ${s.x} ${s.y} A ${r} ${r} 0 0 0 ${e.x} ${e.y}`;
}

function describeWedge(x, y, r, sa, ea) {
  const s = polarToCartesian(x, y, r, ea);
  const e = polarToCartesian(x, y, r, sa);
  return `M ${x},${y} L ${s.x},${s.y} A ${r},${r} 0 0 0 ${e.x},${e.y} Z`;
}

// Генерация пути SVG для звезды
function starPath(cx, cy, outerR, innerR, points = 5) {
  const step = Math.PI / points;
  let d = '';
  for (let i = 0; i < 2 * points; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const a = -Math.PI / 2 + i * step;
    const x = cx + r * Math.cos(a);
    const y = cy + r * Math.sin(a);
    d += (i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`);
  }
  return d + ' Z';
}

// Экспорт функций в window для использования в других модулях
if (typeof window !== 'undefined') {
  window.debounce = debounce;
  window.polarToCartesian = polarToCartesian;
  window.cartesianToPolar = cartesianToPolar;
  window.describeArc = describeArc;
  window.describeWedge = describeWedge;
  window.starPath = starPath;
}
export {};
