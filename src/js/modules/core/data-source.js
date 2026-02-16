// data-source.js
// Слой работы с данными: VFS (localStorage) и fetch-загрузка JSON.
// Вынесено из data-loader.js для этапа 2 рефакторинга.

(function () {
  'use strict';

  const FETCH_CACHE_TTL_MS = 5 * 60 * 1000; // 5 минут
  const DEFAULT_FETCH_TIMEOUT_MS = 8000;
  const fetchCache = new Map();
  const inflightFetches = new Map();

  function vfsKey(filename) {
    return `vfs:${filename}`;
  }

  function vfsRead(filename) {
    try {
      const raw = localStorage.getItem(vfsKey(filename));
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      if (typeof window !== 'undefined' && window.Logger) {
        window.Logger.warn('vfsRead parse error', e);
      }
      return null;
    }
  }

  function vfsWrite(filename, data) {
    try {
      localStorage.setItem(vfsKey(filename), JSON.stringify(data));
      if (typeof window !== 'undefined' && window.Logger) {
        window.Logger.debug(`vfsWrite: ${filename} saved to localStorage`);
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  function clearVfsCache() {
    try {
      const vfsKeys = Object.keys(localStorage).filter(key => key.startsWith('vfs:'));
      vfsKeys.forEach(key => localStorage.removeItem(key));
      if (typeof window !== 'undefined' && window.Logger) {
        window.Logger.debug(`Очищено ${vfsKeys.length} ключей VFS из localStorage`);
      }
      return vfsKeys.length;
    } catch (e) {
      return 0;
    }
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

  /**
   * Загружает JSON: сначала с диска (paths), затем из VFS.
   * @param {string} filename
   * @param {boolean} forceReload — при true очищает кэш перед загрузкой
   * @returns {Promise<{path: string|null, data: any|null}>}
   */
  async function loadJsonPreferVfs(filename, forceReload = false) {
    if (forceReload) {
      const paths = [`/src/data/ru/${filename}`, `/src/data/${filename}`];
      paths.forEach(p => fetchCache.delete(p));
    }

    const paths = [`/src/data/ru/${filename}`, `/src/data/${filename}`];
    for (const p of paths) {
      try {
        let json;
        if (forceReload) {
          const urlWithTimestamp = `${p}?t=${Date.now()}`;
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
          if (typeof window !== 'undefined' && window.Logger) {
            window.Logger.debug(`Загружены данные из файла ${p}:`, json);
          }
          if (forceReload) {
            fetchCache.set(p, { data: json, expiresAt: Date.now() + FETCH_CACHE_TTL_MS });
          }
          return { path: p, data: json };
        }
      } catch (err) {
        if (typeof window !== 'undefined' && window.Logger) {
          window.Logger.warn(`Ошибка загрузки ${p}:`, err);
        }
      }
    }

    const fromVfs = vfsRead(filename);
    if (fromVfs !== null) {
      if (typeof window !== 'undefined' && window.Logger) {
        window.Logger.debug(`Загружены данные из VFS для ${filename}:`, fromVfs);
      }
      return { path: `local:${filename}`, data: fromVfs };
    }

    return { path: null, data: null };
  }

  window.DataSource = {
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

  window.vfsRead = vfsRead;
  window.vfsWrite = vfsWrite;
  window.clearVfsCache = clearVfsCache;
  window.fetchJsonWithCache = fetchJsonWithCache;
  window.clearFetchCache = clearFetchCache;
  window.loadJsonPreferVfs = loadJsonPreferVfs;
})();
