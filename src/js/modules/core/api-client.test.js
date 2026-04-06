function buildJsonResponse(status, payload) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get(name) {
        return String(name || '').toLowerCase() === 'content-type' ? 'application/json' : null;
      }
    },
    async json() {
      return payload;
    },
    async text() {
      return JSON.stringify(payload);
    }
  };
}

async function loadApiClientModule() {
  return import(`./api-client.js?test=${Date.now()}-${Math.random()}`);
}

describe('api-client auth redirect policy', () => {
  let originalLocation;
  let originalFetch;
  let originalApiConfig;

  beforeEach(() => {
    originalLocation = window.location;
    originalFetch = globalThis.fetch;
    originalApiConfig = window.ApiConfig;
    localStorage.clear();
    sessionStorage.clear();
    document.cookie = 'csrftoken=test-csrf-token';

    window.ApiConfig = {
      getBaseUrl: () => 'https://127.0.0.1:8443',
      getUseApi: () => true,
      getDefaultTimeout: () => 1000,
      getHeavyTimeout: () => 1000,
      getTokenStorageKey: () => 'rmk_access_token',
      getRefreshTokenStorageKey: () => 'rmk_refresh_token',
      getUseRefreshCookieAuth: () => true
    };
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation
    });
    globalThis.fetch = originalFetch;
    if (originalApiConfig === undefined) {
      delete window.ApiConfig;
    } else {
      window.ApiConfig = originalApiConfig;
    }
    localStorage.clear();
    sessionStorage.clear();
  });

  test('401 on protected page clears auth and returns user to home page', async () => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...originalLocation,
        pathname: '/radar/',
        search: '',
        href: 'https://127.0.0.1:8443/radar/',
        origin: 'https://127.0.0.1:8443',
        protocol: 'https:'
      }
    });

    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(buildJsonResponse(401, { error: 'Authentication required.' }))
      .mockResolvedValueOnce(buildJsonResponse(401, { error: 'Refresh token revoked' }));

    const { default: ApiClient } = await loadApiClientModule();
    const response = await ApiClient.get('/api/v1/users/me/', null, { skipAuth: false });

    expect(response.ok).toBe(false);
    expect(response.status).toBe(401);
    expect(window.location.href).toBe('/');
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    expect(globalThis.fetch.mock.calls[1][0]).toContain('/api/v1/auth/refresh');
  });

  test('401 on public home page does not auto-redirect to login or elsewhere', async () => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...originalLocation,
        pathname: '/',
        search: '',
        href: 'https://127.0.0.1:8443/',
        origin: 'https://127.0.0.1:8443',
        protocol: 'https:'
      }
    });

    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(buildJsonResponse(401, { error: 'Authentication required.' }))
      .mockResolvedValueOnce(buildJsonResponse(401, { error: 'Refresh token revoked' }));

    const { default: ApiClient } = await loadApiClientModule();
    const response = await ApiClient.get('/api/v1/users/me/', null, { skipAuth: false });

    expect(response.ok).toBe(false);
    expect(response.status).toBe(401);
    expect(window.location.href).toBe('https://127.0.0.1:8443/');
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });
});
