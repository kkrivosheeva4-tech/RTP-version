function setupDom() {
  document.body.innerHTML = `
    <div id="authInfo"></div>
    <div id="logoutContainer"></div>
    <button id="exportPdfBtn"></button>
    <button id="editTechBtn"></button>
    <button id="deleteTechBtn"></button>
    <button id="addTechBtn"></button>
    <button id="reportIconBtn"></button>
    <button id="addIconBtn"></button>
    <button id="proposalIconBtn"></button>
  `;
}

async function loadAuthModule() {
  await import('../../config/roles-config.js');
  const mod = await import('./auth.js');
  return mod.default;
}

describe('auth logout regression', () => {
  beforeEach(() => {
    setupDom();
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
    sessionStorage.clear();
  });

  test('safeLogout clears auth tokens and pending 2FA state', async () => {
    const AuthModule = await loadAuthModule();
    localStorage.setItem('isLoggedIn', 'true');
    localStorage.setItem('username', 'editor');
    localStorage.setItem('role', 'editor');
    localStorage.setItem('rmk_access_token', 'access');
    localStorage.setItem('rmk_refresh_token', 'refresh');
    sessionStorage.setItem('rmk_access_token', 'access-session');
    sessionStorage.setItem('auth2faPending', '{"username":"editor"}');

    await AuthModule.safeLogout();

    expect(localStorage.getItem('isLoggedIn') ?? null).toBeNull();
    expect(localStorage.getItem('username') ?? null).toBeNull();
    expect(localStorage.getItem('role') ?? null).toBeNull();
    expect(localStorage.getItem('rmk_access_token') ?? null).toBeNull();
    expect(localStorage.getItem('rmk_refresh_token') ?? null).toBeNull();
    expect(sessionStorage.getItem('rmk_access_token') ?? null).toBeNull();
    expect(sessionStorage.getItem('auth2faPending') ?? null).toBeNull();
  });

  test('unauthenticated guest fallback renders login button instead of guest role', async () => {
    const AuthModule = await loadAuthModule();
    localStorage.setItem('role', 'guest');

    AuthModule.renderAuth();

    expect(document.getElementById('authInfo').textContent.trim()).toBe('');
    expect(document.querySelector('#logoutContainer .login')).not.toBeNull();
  });

  test('legacy localStorage auth markers do not authenticate user in API mode', async () => {
    const AuthModule = await loadAuthModule();
    localStorage.setItem('isLoggedIn', 'true');
    localStorage.setItem('username', 'legacy-user');
    localStorage.setItem('role', 'admin');

    AuthModule.renderAuth();

    expect(AuthModule.isAuthenticated()).toBe(false);
    expect(document.getElementById('authInfo').textContent.trim()).toBe('');
    expect(document.querySelector('#logoutContainer .login')).not.toBeNull();
  });

  test('bootstrapAuthSession keeps API mode on early page bootstrap without ApiConfig', async () => {
    const AuthModule = await loadAuthModule();
    delete window.ApiConfig;

    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...originalLocation,
        protocol: 'https:',
        port: '',
        hostname: 'rtp3.localhost',
        origin: 'https://rtp3.localhost'
      }
    });

    const response = {
      ok: true,
      data: {
        id: 1,
        username: 'admin',
        role: 'admin',
        is_2fa_enabled: true
      }
    };
    window.ApiClient = {
      get: vi.fn().mockResolvedValue(response),
      setAccessToken: vi.fn(),
      setLogoutInProgress: vi.fn()
    };

    await AuthModule.bootstrapAuthSession(true);

    expect(window.ApiClient.get).toHaveBeenCalledWith('/api/v1/users/me/', null, { skipAuth: false });
    expect(AuthModule.isAuthenticated()).toBe(true);
    expect(AuthModule.getCurrentRole()).toBe('admin');

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation
    });
    delete window.ApiClient;
  });
});
