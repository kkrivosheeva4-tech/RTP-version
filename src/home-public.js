import Logger from './js/modules/core/logger.js';
import './js/config/api-config-loader.js';
import './js/config/roles-config.js';
import './js/modules/core/dom-utils.js';
import './js/modules/core/api-client.js';
import './js/modules/business/auth.js';
import './js/modules/ui/common-ui.js';
import './js/radar-utils.js';
import './js/modules/radar/radar-renderer.js';
import './js/modules/radar/radar-wrappers.js';

const HOME_RINGS = ['used', 'adopt', 'explore'];
const HOME_QUADRANTS = [
  { id: 1, name: 'q1', startAngle: 0 },
  { id: 2, name: 'q2', startAngle: 90 },
  { id: 3, name: 'q3', startAngle: 180 },
  { id: 4, name: 'q4', startAngle: 270 }
];

function ensureRadarRuntime() {
  if (typeof window === 'undefined') {
    return;
  }

  window.Logger = Logger;
  window.SVG_NS = 'http://www.w3.org/2000/svg';
  window.CENTER_X = 500;
  window.CENTER_Y = 500;
  window.RADIUS_STEP = 140;
  window.POSITION_PAD = 30;
  window.POSITION_ANGLE_PAD = 2;
  window.MIN_BLIP_DISTANCE = 28;
  window.RING_LABEL_WIDTH = 180;
  window.RING_LABEL_HEIGHT = 42;
  window.TECHTYPE_TO_SHAPE = {
    default: 'circle'
  };
  window.RINGS = Array.isArray(window.RINGS) && window.RINGS.length > 0 ? window.RINGS : HOME_RINGS.slice();
  window.QUADRANTS =
    Array.isArray(window.QUADRANTS) && window.QUADRANTS.length > 0
      ? window.QUADRANTS
      : HOME_QUADRANTS.map((quadrant) => ({ ...quadrant }));
  window.levelToRing =
    window.levelToRing && Object.keys(window.levelToRing).length > 0
      ? window.levelToRing
      : { used: 0, adopt: 1, explore: 2 };
}

function hasSessionAccessToken() {
  if (typeof window === 'undefined' || !window.sessionStorage) {
    return false;
  }

  const tokenKey =
    window.ApiConfig && typeof window.ApiConfig.getTokenStorageKey === 'function'
      ? window.ApiConfig.getTokenStorageKey()
      : 'rmk_access_token';

  try {
    return Boolean(window.sessionStorage.getItem(tokenKey));
  } catch (_) {
    return false;
  }
}

async function bootstrapHome() {
  ensureRadarRuntime();

  if (
    hasSessionAccessToken() &&
    window.AuthModule &&
    typeof window.AuthModule.bootstrapAuthSession === 'function'
  ) {
    try {
      await window.AuthModule.bootstrapAuthSession(true);
    } catch (_) {
      if (window.AuthModule && typeof window.AuthModule.clearAuthSession === 'function') {
        window.AuthModule.clearAuthSession();
      }
    }
  }

  if (typeof window.renderAuth === 'function') {
    window.renderAuth();
  }

  if (typeof window.renderRadarBackground === 'function') {
    window.renderRadarBackground({ showSectorLabels: false });
  }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      void bootstrapHome();
    });
  } else {
    void bootstrapHome();
  }
}
