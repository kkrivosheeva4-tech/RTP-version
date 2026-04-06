// RMK-director.js
// ===== DEPRECATED (С€Р°Рі 7.5, 24.02.2026) =====
// РўРѕС‡РєР° РІС…РѕРґР° РїРµСЂРµРЅРµСЃРµРЅР° РІ src/main.js. Р’СЃРµ РјРѕРґСѓР»Рё Р·Р°РіСЂСѓР¶Р°СЋС‚СЃСЏ С‡РµСЂРµР· ES imports.
// Р­С‚РѕС‚ С„Р°Р№Р» РѕСЃС‚Р°РІР»РµРЅ С‚РѕР»СЊРєРѕ РґР»СЏ СЃРїСЂР°РІРєРё (РёСЃС‚РѕСЂРёСЏ РїРѕСЂСЏРґРєР° Р·Р°РіСЂСѓР·РєРё). РќРµ РїРѕРґРєР»СЋС‡Р°С‚СЊ РЅР° СЃС‚СЂР°РЅРёС†Р°С….
//
// ===== Р—РђР“Р РЈР—РљРђ РњРћР”РЈР›Р•Р™ Р”Р›РЇ РћРЎРќРћР’РќРћР™ РЎРўР РђРќРР¦Р« Р РђР”РђР Рђ =====
// РћСЃРЅРѕРІРЅР°СЏ СЃС‚СЂР°РЅРёС†Р° СЂР°РґР°СЂР° РґР»СЏ РІСЃРµС… СЂРѕР»РµР№ (Р°СЂС…РёС‚РµРєС‚РѕСЂС‹, РґРёСЂРµРєС‚РѕСЂС‹, Р Рџ, Р°РґРјРёРЅРёСЃС‚СЂР°С‚РѕСЂС‹)
// Р¤СѓРЅРєС†РёСЏ РґР»СЏ РґРёРЅР°РјРёС‡РµСЃРєРѕР№ Р·Р°РіСЂСѓР·РєРё РјРѕРґСѓР»РµР№
function loadModule(src) {
  return new Promise((resolve, reject) => {
    // РџСЂРѕРІРµСЂСЏРµРј, РЅРµ Р·Р°РіСЂСѓР¶РµРЅ Р»Рё СѓР¶Рµ РјРѕРґСѓР»СЊ
    const script = document.createElement('script');
    script.src = src;
    script.async = false; // Р—Р°РіСЂСѓР¶Р°РµРј СЃРёРЅС…СЂРѕРЅРЅРѕ РґР»СЏ СЃРѕС…СЂР°РЅРµРЅРёСЏ РїРѕСЂСЏРґРєР°
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ РјРѕРґСѓР»СЊ: ${src}`));
    document.head.appendChild(script);
  });
}

// Р¤СѓРЅРєС†РёСЏ РґР»СЏ Р·Р°РіСЂСѓР·РєРё РІСЃРµС… РјРѕРґСѓР»РµР№ РІ РїСЂР°РІРёР»СЊРЅРѕРј РїРѕСЂСЏРґРєРµ
async function loadAllModules() {
  const modules = [
    // Р‘Р°Р·РѕРІС‹Рµ СѓС‚РёР»РёС‚С‹ (РґРѕР»Р¶РЅС‹ Р±С‹С‚СЊ Р·Р°РіСЂСѓР¶РµРЅС‹ РїРµСЂРІС‹РјРё)
    '/src/js/audit-logger.js',
    '/src/js/script.js',
    '/src/js/radar-utils.js',

    // Core РјРѕРґСѓР»Рё (РІ РїРѕСЂСЏРґРєРµ Р·Р°РІРёСЃРёРјРѕСЃС‚РµР№)
    // РћР±СЉРµРґРёРЅРµРЅРЅС‹Рµ РјРѕРґСѓР»Рё
    '/src/js/modules/core/logger.js',  // logger wrapper РґР»СЏ dev/prod
    '/src/js/modules/core/dom-utils.js',  // dom-cache + dom-proxy
    '/src/js/modules/core/core-utils.js',  // error-handler + event-manager + memoization + module-loader + render-queue
    '/src/js/modules/core/error-handler.js',  // reportError вЂ” РµРґРёРЅР°СЏ С‚РѕС‡РєР° Р»РѕРіРёСЂРѕРІР°РЅРёСЏ Рё РїРѕРєР°Р·Р° РѕС€РёР±РѕРє
    '/src/js/config/api-config.js',  // Р±Р°Р·РѕРІС‹Р№ URL API, С‚Р°Р№РјР°СѓС‚С‹ (Р·Р°РіР»СѓС€РєР° РґР»СЏ Р±СЌРєРµРЅРґР°)
    '/src/js/modules/core/state-manager.js',
    '/src/js/modules/core/api-client.js',  // Р·Р°РіР»СѓС€РєР° Р·Р°РїСЂРѕСЃРѕРІ Рє API (Authorization, 401, С‚Р°Р№РјР°СѓС‚С‹)
    '/src/js/modules/core/data-source.js',  // fetch + low-level data source helpers (СЌС‚Р°Рї 2)
    '/src/js/modules/core/data-normalize.js',  // normalizeTechnologyFromNewFormat, buildBlockMaps (СЌС‚Р°Рї 2)
    '/src/js/modules/core/escape-utils.js',  // escapeHtml РґР»СЏ Р±РµР·РѕРїР°СЃРЅРѕР№ РІСЃС‚Р°РІРєРё С‚РµРєСЃС‚Р° (XSS), РґРѕ data-loader Рё toast
    '/src/js/modules/core/data-loader.js',
    '/src/js/modules/core/state-utils.js',  // state-accessors + state-subscriptions
    '/src/js/modules/core/data-indexing.js',  // data-index + tech-index
    '/src/js/modules/core/validators.js',  // РІР°Р»РёРґР°С†РёСЏ РґСѓР±Р»РёРєР°С‚РѕРІ (С‚РµС…РЅРѕР»РѕРіРёРё, РѕРјРѕРіР»РёС„С‹)

    // UI РјРѕРґСѓР»Рё (detail-panel РґРѕР»Р¶РµРЅ Р±С‹С‚СЊ Р·Р°РіСЂСѓР¶РµРЅ РґРѕ radar-wrappers, С‚Р°Рє РєР°Рє РёСЃРїРѕР»СЊР·СѓРµС‚ showDetail)
    '/src/js/modules/ui/detail-panel.js',

    // Utils РјРѕРґСѓР»Рё (РґРѕР»Р¶РЅС‹ Р±С‹С‚СЊ Р·Р°РіСЂСѓР¶РµРЅС‹ РґРѕ radar РјРѕРґСѓР»РµР№)
    '/src/js/modules/utils/func-cover-utils.js',  // РћР‘РќРћР’Р›Р•РќРћ: РЈС‡РµС‚ РІР°Р¶РЅРѕСЃС‚Рё С„СѓРЅРєС†РёР№ РІ funcCover

    // Radar РјРѕРґСѓР»Рё
    '/src/js/modules/radar/positioning.js',
    '/src/js/modules/radar/radar-renderer.js',
    '/src/js/modules/radar/quadrant-cache.js',
    '/src/js/modules/radar/quadrants.js',
    // prospects-chart.js РќР• Р·Р°РіСЂСѓР¶Р°РµС‚СЃСЏ РґР»СЏ РґРёСЂРµРєС‚РѕСЂСЃРєРѕР№ СЃС‚СЂР°РЅРёС†С‹
    '/src/js/modules/radar/radar-wrappers.js',
    '/src/js/modules/radar/radar-update.js',

    // UI РјРѕРґСѓР»Рё (РѕСЃС‚Р°Р»СЊРЅС‹Рµ)
    '/src/js/modules/ui/filters.js',
    '/src/js/config/form-field-options.js',  // TRL, СЂРµР№С‚РёРЅРіРё, СЃС‚Р°С‚СѓСЃС‹, tooltips (СЌС‚Р°Рї 7)
    '/src/js/modules/ui/filter-init.js',  // initFiltersWithRetry, initModalSelects (СЌС‚Р°Рї 2)
    '/src/js/modules/ui/focus-trap.js',
    '/src/js/modules/ui/modals.js',
    '/src/js/modules/ui/forms.js',
    '/src/js/modules/ui/sidebar.js',
    '/src/js/modules/ui/modal-forms.js',
    '/src/js/modules/ui/report-status.js',
    '/src/js/modules/ui/tooltips.js',  // tooltip + hover
    '/src/js/modules/ui/notifications.js',  // СЃРёСЃС‚РµРјР° СѓРІРµРґРѕРјР»РµРЅРёР№
    '/src/js/modules/ui/form-management.js',  // form-events + form-handlers
    '/src/js/modules/ui/vendors-files.js',  // СѓРїСЂР°РІР»РµРЅРёРµ РІРµРЅРґРѕСЂР°РјРё Рё С„Р°Р№Р»Р°РјРё
    '/src/js/modules/ui/loading.js',
    '/src/js/modules/ui/error-display.js',
    '/src/js/modules/ui/toast.js',
    '/src/js/modules/ui/skeleton.js',
    '/src/js/modules/ui/mobile-nav.js',
    '/src/js/modules/ui/touch-handlers.js',
    '/src/js/modules/ui/keyboard-nav.js',
    '/src/js/modules/ui/aria-manager.js',
    '/src/js/modules/ui/onboarding.js',
    '/src/js/modules/ui/offline-handler.js',

    // Business РјРѕРґСѓР»Рё (СЌС‚Р°Рї 3: РєРѕРЅС„РёРі РїРѕР»РµР№, С„РёР»СЊС‚СЂС‹ Рё PDF РґРѕ export.js)
    '/src/js/modules/business/export-fields-config.js',
    '/src/js/modules/business/export-filters.js',
    '/src/js/modules/business/export-pdf.js',
    '/src/js/modules/business/export.js',
    '/src/js/modules/business/auth.js',
    '/src/js/modules/business/priorities.js',

    // Analytics РјРѕРґСѓР»Рё (Р°РЅР°Р»РёС‚РёРєР° РјРѕРґРµР»Рё)
    '/src/js/modules/analytics/model-analytics.js',
    '/src/js/modules/analytics/weight-optimizer.js',  // РћР‘РќРћР’Р›Р•РќРћ: РђРІС‚РѕРјР°С‚РёС‡РµСЃРєР°СЏ РѕРїС‚РёРјРёР·Р°С†РёСЏ РІРµСЃРѕРІ
    '/src/js/modules/analytics/missing-data-predictor.js',  // РћР‘РќРћР’Р›Р•РќРћ: РЈР»СѓС‡С€РµРЅРЅР°СЏ РѕР±СЂР°Р±РѕС‚РєР° РѕС‚СЃСѓС‚СЃС‚РІСѓСЋС‰РёС… РґР°РЅРЅС‹С…
    '/src/js/modules/analytics/temporal-dynamics.js',  // РћР‘РќРћР’Р›Р•РќРћ: РЈС‡РµС‚ РІСЂРµРјРµРЅРЅРѕР№ РґРёРЅР°РјРёРєРё
    '/src/js/modules/analytics/adaptive-calibration.js',  // РћР‘РќРћР’Р›Р•РќРћ: РђРґР°РїС‚РёРІРЅР°СЏ РєР°Р»РёР±СЂРѕРІРєР° РїР°СЂР°РјРµС‚СЂРѕРІ

    // Radar РјРѕРґСѓР»Рё (РѕРїС‚РёРјРёР·Р°С†РёСЏ)
    '/src/js/modules/radar/spatial-index.js',  // РћР‘РќРћР’Р›Р•РќРћ: РџСЂРѕСЃС‚СЂР°РЅСЃС‚РІРµРЅРЅС‹Рµ РёРЅРґРµРєСЃС‹ РґР»СЏ РѕРїС‚РёРјРёР·Р°С†РёРё СЂР°Р·РІРµРґРµРЅРёСЏ

    // Integration РјРѕРґСѓР»Рё (events РґРѕР»Р¶РµРЅ Р±С‹С‚СЊ Р·Р°РіСЂСѓР¶РµРЅ РїРѕСЃР»Рµ РІСЃРµС… Р·Р°РІРёСЃРёРјРѕСЃС‚РµР№)
    // РќРѕРІС‹Рµ РјРѕРґСѓР»Рё РѕР±СЂР°Р±РѕС‚С‡РёРєРѕРІ СЃРѕР±С‹С‚РёР№ (Р·Р°РіСЂСѓР¶Р°СЋС‚СЃСЏ РїРµСЂРµРґ events.js)
    '/src/js/modules/ui/select-events.js',  // С‚РµРїРµСЂСЊ РІРєР»СЋС‡Р°РµС‚ select-positioning
    '/src/js/modules/radar/radar-events.js',
    '/src/js/modules/integration/events.js',  // С‚РµРїРµСЂСЊ РІРєР»СЋС‡Р°РµС‚ utils

    // App init (РґРѕР»Р¶РµРЅ Р±С‹С‚СЊ Р·Р°РіСЂСѓР¶РµРЅ РїРѕСЃР»РµРґРЅРёРј РїРµСЂРµРґ RMK-director.js)
    '/src/js/modules/core/app-init.js'
  ];

  try {
    for (const module of modules) {
      await loadModule(module);
    }
  } catch (error) {
    // РћС€РёР±РєР° РїСЂРё Р·Р°РіСЂСѓР·РєРµ РјРѕРґСѓР»РµР№
    throw error;
  }
}

// ===== РљРћРќРЎРўРђРќРўР« =====
const SVG_NS = "http://www.w3.org/2000/svg";
const CENTER_X = 500;
const CENTER_Y = 500;
const RADIUS_STEP = 140;
// РћС‚СЃС‚СѓРїС‹ Рё РјРёРЅРёРјР°Р»СЊРЅРѕРµ СЂР°СЃСЃС‚РѕСЏРЅРёРµ РјРµР¶РґСѓ С‚РµС…РЅРѕР»РѕРіРёСЏРјРё РЅР° СЂР°РґР°СЂРµ
const POSITION_PAD = 30;           // РѕС‚СЃС‚СѓРї РѕС‚ РіСЂР°РЅРёС† РєРѕР»РµС†
const POSITION_ANGLE_PAD = 2;      // РѕС‚СЃС‚СѓРї РѕС‚ РіСЂР°РЅРёС† СЃРµРєС‚РѕСЂРѕРІ (РІ РіСЂР°РґСѓСЃР°С…)
const MIN_BLIP_DISTANCE = 28;      // РјРёРЅРёРјР°Р»СЊРЅР°СЏ РґРёСЃС‚Р°РЅС†РёСЏ РјРµР¶РґСѓ С†РµРЅС‚СЂР°РјРё С‚РµС…РЅРѕР»РѕРіРёР№
// Р Р°Р·РјРµСЂС‹ РїСЂСЏРјРѕСѓРіРѕР»СЊРЅРёРєРѕРІ С„РѕРЅР° РїРѕРґРїРёСЃРµР№ РєРѕР»РµС† (РґРѕР»Р¶РЅС‹ СЃРѕРІРїР°РґР°С‚СЊ СЃ renderRadarBackground)
const RING_LABEL_WIDTH = 180;
const RING_LABEL_HEIGHT = 42;
// Р‘СѓРґСѓС‚ Р·Р°РіСЂСѓР¶РµРЅС‹ РёР· JSON
let RINGS = [];
let QUADRANTS = [];
let levelToRing = {};

// Р­РєСЃРїРѕСЂС‚ РєРѕРЅСЃС‚Р°РЅС‚ РІ window РґР»СЏ РёСЃРїРѕР»СЊР·РѕРІР°РЅРёСЏ РјРѕРґСѓР»СЏРјРё
window.CENTER_X = CENTER_X;
window.CENTER_Y = CENTER_Y;
window.RADIUS_STEP = RADIUS_STEP;
window.POSITION_PAD = POSITION_PAD;
window.POSITION_ANGLE_PAD = POSITION_ANGLE_PAD;
window.MIN_BLIP_DISTANCE = MIN_BLIP_DISTANCE;
// Р”Р»СЏ РґРёСЂРµРєС‚РѕСЂСЃРєРѕР№ СЃС‚СЂР°РЅРёС†С‹ РІСЃРµ С‚РµС…РЅРѕР»РѕРіРёРё РѕС‚РѕР±СЂР°Р¶Р°СЋС‚СЃСЏ РєР°Рє РєСЂСѓРіРё
// Р­РєСЃРїРѕСЂС‚ TECHTYPE_TO_SHAPE РІ window РґР»СЏ РёСЃРїРѕР»СЊР·РѕРІР°РЅРёСЏ РјРѕРґСѓР»СЏРјРё (РґР»СЏ СЃРѕРІРјРµСЃС‚РёРјРѕСЃС‚Рё)
window.TECHTYPE_TO_SHAPE = {
  "Р‘Р°Р·РѕРІС‹Рµ": "circle",
  "РРЅС‚РµРіСЂРёСЂРѕРІР°РЅРЅС‹Рµ": "circle",
  "РџР»Р°С‚С„РѕСЂРјРµРЅРЅС‹Рµ СЂРµС€РµРЅРёСЏ": "circle",
  "РЈРїСЂР°РІР»РµРЅРёРµ СЃ ML Рё AI": "circle",
};

// ===== РРќРР¦РРђР›РР—РђР¦РРЇ =====
// РРЅРёС†РёР°Р»РёР·Р°С†РёСЏ РїСЂРёР»РѕР¶РµРЅРёСЏ РїСЂРѕРёСЃС…РѕРґРёС‚ РІ РјРѕРґСѓР»Рµ app-init.js
// Р—РґРµСЃСЊ С‚РѕР»СЊРєРѕ Р·Р°РіСЂСѓР·РєР° РјРѕРґСѓР»РµР№ Рё СЌРєСЃРїРѕСЂС‚ РєРѕРЅСЃС‚Р°РЅС‚

// Р­РєСЃРїРѕСЂС‚ РїРµСЂРµРјРµРЅРЅС‹С… РІ window РґР»СЏ РёСЃРїРѕР»СЊР·РѕРІР°РЅРёСЏ РјРѕРґСѓР»СЏРјРё (РёРЅРёС†РёР°Р»РёР·РёСЂСѓСЋС‚СЃСЏ РІ app-init.js)
// Р­С‚Рё РїРµСЂРµРјРµРЅРЅС‹Рµ Р±СѓРґСѓС‚ СѓСЃС‚Р°РЅРѕРІР»РµРЅС‹ РїРѕСЃР»Рµ Р·Р°РіСЂСѓР·РєРё РґР°РЅРЅС‹С… РІ app-init.js
// Р’СЂРµРјРµРЅРЅС‹Рµ Р·РЅР°С‡РµРЅРёСЏ РґР»СЏ РѕР±СЂР°С‚РЅРѕР№ СЃРѕРІРјРµСЃС‚РёРјРѕСЃС‚Рё
window.RINGS = RINGS;
window.QUADRANTS = QUADRANTS;
window.levelToRing = levelToRing;

// Р—Р°РіСЂСѓР·РєР° РјРѕРґСѓР»РµР№ Рё РёРЅРёС†РёР°Р»РёР·Р°С†РёСЏ РїСЂРёР»РѕР¶РµРЅРёСЏ
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', async () => {
    try {
      await loadAllModules();
      // РРЅРёС†РёР°Р»РёР·Р°С†РёСЏ РїСЂРѕРёСЃС…РѕРґРёС‚ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё РІ app-init.js РїСЂРё Р·Р°РіСЂСѓР·РєРµ DOM
    } catch (error) {
      // РћС€РёР±РєР° РёРЅРёС†РёР°Р»РёР·Р°С†РёРё РїСЂРёР»РѕР¶РµРЅРёСЏ
    }
  });
} else {
  // DOM СѓР¶Рµ Р·Р°РіСЂСѓР¶РµРЅ
  (async () => {
    try {
      await loadAllModules();
      // РРЅРёС†РёР°Р»РёР·Р°С†РёСЏ РїСЂРѕРёСЃС…РѕРґРёС‚ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё РІ app-init.js РїСЂРё Р·Р°РіСЂСѓР·РєРµ DOM
    } catch (error) {
      // РћС€РёР±РєР° РёРЅРёС†РёР°Р»РёР·Р°С†РёРё РїСЂРёР»РѕР¶РµРЅРёСЏ
    }
  })();
}
