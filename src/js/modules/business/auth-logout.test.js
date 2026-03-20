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

  test('bootstrapAuthSession restores mock admin session from legacy storage', async () => {
    const AuthModule = await loadAuthModule();
    const store = new Map();
    localStorage.getItem.mockImplementation((key) => (store.has(key) ? store.get(key) : null));
    localStorage.setItem.mockImplementation((key, value) => {
      store.set(key, String(value));
    });
    localStorage.removeItem.mockImplementation((key) => {
      store.delete(key);
    });
    localStorage.clear.mockImplementation(() => {
      store.clear();
    });
    window.ApiConfig = {
      getUseApi: () => false,
      getTokenStorageKey: () => 'rmk_access_token',
      getRefreshTokenStorageKey: () => 'rmk_refresh_token'
    };
    localStorage.setItem('isLoggedIn', 'true');
    localStorage.setItem('username', 'admin');
    localStorage.setItem('role', 'admin');

    await AuthModule.bootstrapAuthSession(true);

    expect(AuthModule.isAuthenticated()).toBe(true);
    expect(AuthModule.getCurrentUsername()).toBe('admin');
    expect(AuthModule.getCurrentRole()).toBe('admin');

    delete window.ApiConfig;
  });
});
