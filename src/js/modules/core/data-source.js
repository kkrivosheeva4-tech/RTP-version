// data-source.js — ES module
// Слой чтения статических JSON и fetch-кэша.

import Logger from './logger.js';

const FETCH_CACHE_TTL_MS = 5 * 60 * 1000;
const DEFAULT_FETCH_TIMEOUT_MS = 8000;
const fetchCache = new Map();
const inflightFetches = new Map();

function vfsKey(filename) {
  return `vfs:${filename}`;
}

function vfsRead(filename) {
  void filename;
  return null;
}

function vfsWrite(filename, data) {
  void filename;
  void data;
  return false;
}

function clearVfsCache() {
  return 0;
}

function clearFetchCache() {
  fetchCache.clear();
  inflightFetches.clear();
}

async function fetchJsonWithCache(url, { ttl = FETCH_CACHE_TTL_MS, timeout = DEFAULT_FETCH_TIMEOUT_MS } = {}) {
  const now = Date.now();
  const cached = fetchCache.get(url);
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  if (inflightFetches.has(url)) {
    return inflightFetches.get(url);
  }

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timerId = timeout ? setTimeout(() => controller?.abort(), timeout) : null;

  const promise = fetch(url, controller ? { signal: controller.signal } : undefined)
    .then(async (r) => {
      if (!r || !r.ok) {
        throw new Error(`HTTP ${r ? r.status : 'no response'}`);
      }
      return r.json();
    })
    .then((json) => {
      fetchCache.set(url, { data: json, expiresAt: now + ttl });
      return json;
    })
    .finally(() => {
      inflightFetches.delete(url);
      if (timerId) clearTimeout(timerId);
    });

  inflightFetches.set(url, promise);
  return promise;
}

// Базовый URL для fetch (учёт base path при деплое в подкаталог)
function getDataBasePath() {
  try {
    const base = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL) || '/';
    const clean = String(base).endsWith('/') ? base.slice(0, -1) : base;
    return clean || '';
  } catch {
    return '';
  }
}

async function loadJsonPreferVfs(filename, forceReload = false) {
  const basePath = getDataBasePath();
  const path1 = `${basePath}/static/data/ru/${filename}`.replace(/\/+/g, '/');
  const path2 = `${basePath}/static/data/${filename}`.replace(/\/+/g, '/');

  if (forceReload) {
    [path1, path2].forEach((p) => fetchCache.delete(p));
  }

  // Относительный путь как fallback (для production при деплое в подкаталог)
  let relPath = null;
  if (typeof document !== 'undefined' && document.location && !document.location.pathname.startsWith('/api/')) {
    relPath = new URL('../data/ru/' + filename, document.location.href).href;
  }

  const paths = [path1, path2];
  if (relPath) paths.push(relPath);

  for (const p of paths) {
    try {
      let json;
      const urlToFetch = p.startsWith('http') ? p : (p.startsWith('/') ? p : '/' + p.replace(/^\/+/, ''));
      if (forceReload) {
        const urlWithTimestamp = `${urlToFetch}?t=${Date.now()}`;
        const response = await fetch(urlWithTimestamp, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
          }
        });
        if (!response || !response.ok) {
          throw new Error(`HTTP ${response ? response.status : 'no response'}`);
        }
        json = await response.json();
      } else {
        json = await fetchJsonWithCache(p, { ttl: FETCH_CACHE_TTL_MS, timeout: DEFAULT_FETCH_TIMEOUT_MS });
      }
      if (json) {
        Logger.debug(`Загружены данные из файла ${p}:`, json);
        if (forceReload) {
          fetchCache.set(p, { data: json, expiresAt: Date.now() + FETCH_CACHE_TTL_MS });
        }
        return { path: p, data: json };
      }
    } catch (err) {
      Logger.warn(`Ошибка загрузки ${p}:`, err);
    }
  }

  return { path: null, data: null };
}

const DataSource = {
  vfsKey,
  vfsRead,
  vfsWrite,
  clearVfsCache,
  fetchJsonWithCache,
  clearFetchCache,
  loadJsonPreferVfs,
  FETCH_CACHE_TTL_MS,
  DEFAULT_FETCH_TIMEOUT_MS
};

if (typeof window !== 'undefined') {
  window.DataSource = DataSource;
  window.vfsRead = vfsRead;
  window.vfsWrite = vfsWrite;
  window.clearVfsCache = clearVfsCache;
  window.fetchJsonWithCache = fetchJsonWithCache;
  window.clearFetchCache = clearFetchCache;
  window.loadJsonPreferVfs = loadJsonPreferVfs;
}

export default DataSource;
export {
  vfsRead,
  vfsWrite,
  clearVfsCache,
  fetchJsonWithCache,
  clearFetchCache,
  loadJsonPreferVfs,
  FETCH_CACHE_TTL_MS,
  DEFAULT_FETCH_TIMEOUT_MS
};
