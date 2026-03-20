// auth.js
// Runtime-auth слой: backend/cookie auth является источником истины,
// localStorage используется только как временный fallback для mock/legacy режима.

'use strict';

const AUTH_RUNTIME_KEY = '__RMK_AUTH_STATE__';

function getApiConfig() {
  return typeof window !== 'undefined' ? window.ApiConfig || null : null;
}

function getApiClient() {
  return typeof window !== 'undefined' ? window.ApiClient || null : null;
}

function getRoleApi() {
  return typeof window !== 'undefined' ? window.RoleCapabilities || window.RolesConfig || null : null;
}

function isApiModeEnabled() {
  const cfg = getApiConfig();
  return !!(cfg && typeof cfg.getUseApi === 'function' && cfg.getUseApi() === true);
}

function getRuntimeState() {
  if (typeof window === 'undefined') {
    return {
      initialized: false,
      authenticated: false,
      profile: null,
      bootstrapPromise: null
    };
  }
  if (!window[AUTH_RUNTIME_KEY]) {
    window[AUTH_RUNTIME_KEY] = {
      initialized: false,
      authenticated: false,
      profile: null,
      bootstrapPromise: null
    };
  }
  return window[AUTH_RUNTIME_KEY];
}

function dispatchAuthChanged() {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
  const state = getRuntimeState();
  window.dispatchEvent(
    new CustomEvent('rmk-auth-changed', {
      detail: {
        initialized: state.initialized,
        authenticated: state.authenticated,
        profile: state.profile
      }
    })
  );
}

function getTokenStorageKey() {
  const cfg = getApiConfig();
  return cfg && typeof cfg.getTokenStorageKey === 'function'
    ? cfg.getTokenStorageKey()
    : 'rmk_access_token';
}

function getRefreshTokenStorageKey() {
  const cfg = getApiConfig();
  return cfg && typeof cfg.getRefreshTokenStorageKey === 'function'
    ? cfg.getRefreshTokenStorageKey()
    : 'rmk_refresh_token';
}

function clearLegacyAuthArtifacts() {
  const tokenKey = getTokenStorageKey();
  const refreshKey = getRefreshTokenStorageKey();
  try { localStorage.removeItem('isLoggedIn'); } catch (_) {}
  try { localStorage.removeItem('username'); } catch (_) {}
  try { localStorage.removeItem('userName'); } catch (_) {}
  try { localStorage.removeItem('role'); } catch (_) {}
  try { localStorage.removeItem(tokenKey); } catch (_) {}
  try { localStorage.removeItem(refreshKey); } catch (_) {}
  try { sessionStorage.removeItem(tokenKey); } catch (_) {}
  try { sessionStorage.removeItem(refreshKey); } catch (_) {}
  try { sessionStorage.removeItem('auth2faPending'); } catch (_) {}
}

function getLegacyProfile() {
  try {
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    const username = String(
      localStorage.getItem('username') || localStorage.getItem('userName') || ''
    ).trim();
    if (!isLoggedIn || !username) {
      return null;
    }

    return {
      username,
      role: normalizeRole(localStorage.getItem('role') || ''),
      is_2fa_enabled: true
    };
  } catch (_) {
    return null;
  }
}

function normalizeRole(role) {
  const roleApi = getRoleApi();
  if (roleApi && typeof roleApi.normalizeRole === 'function') {
    return roleApi.normalizeRole(role);
  }
  return String(role || '').trim().toLowerCase();
}

function isAuthenticated() {
  const state = getRuntimeState();
  if (state.authenticated && state.profile) {
    return true;
  }
  if (!isApiModeEnabled()) {
    return !!getLegacyProfile();
  }
  return false;
}

function getCurrentProfile() {
  const state = getRuntimeState();
  if (state.profile) {
    return state.profile;
  }
  if (!isApiModeEnabled()) {
    return getLegacyProfile();
  }
  return null;
}

function getCurrentUsername() {
  const profile = getCurrentProfile();
  return profile && profile.username ? String(profile.username).trim() : '';
}

function getCurrentRole() {
  const profile = getCurrentProfile();
  return normalizeRole(profile && profile.role ? profile.role : '');
}

function setAuthSession(profile, options = {}) {
  const state = getRuntimeState();
  state.initialized = true;
  state.authenticated = !!(profile && profile.username);
  state.profile = profile
    ? {
        id: profile.id,
        username: String(profile.username || '').trim(),
        role: normalizeRole(profile.role || ''),
        legacy_role: profile.legacy_role || '',
        is_2fa_enabled: profile.is_2fa_enabled === true
      }
    : null;

  const apiClient = getApiClient();
  if (apiClient && typeof apiClient.setAccessToken === 'function') {
    // Не перезаписываем токен пустой строкой при восстановлении сессии из /users/me:
    // токен уже установлен в api-client после refresh и должен сохраняться.
    if (options.accessToken !== undefined) {
      apiClient.setAccessToken(options.accessToken || '');
    }
  }

  if (options.clearLegacy !== false) {
    clearLegacyAuthArtifacts();
  }

  dispatchAuthChanged();
  return state.profile;
}

function clearAuthSession() {
  const state = getRuntimeState();
  state.initialized = true;
  state.authenticated = false;
  state.profile = null;
  state.bootstrapPromise = null;

  const apiClient = getApiClient();
  if (apiClient && typeof apiClient.clearAccessToken === 'function') {
    apiClient.clearAccessToken();
  } else if (apiClient && typeof apiClient.setAccessToken === 'function') {
    apiClient.setAccessToken('');
  }

  clearLegacyAuthArtifacts();
  // Очищаем состояние формы, чтобы следующий пользователь не видел данные предыдущего
  try {
    localStorage.removeItem('techFormState');
  } catch (_) {}
  dispatchAuthChanged();
}

async function bootstrapAuthSession(force = false) {
  const state = getRuntimeState();
  if (!force && state.initialized) {
    return state;
  }
  if (!force && state.bootstrapPromise) {
    return state.bootstrapPromise;
  }

  const bootstrapPromise = (async () => {
    if (!isApiModeEnabled()) {
      const legacyProfile = getLegacyProfile();
      if (legacyProfile) {
        setAuthSession(legacyProfile, { clearLegacy: false });
      } else {
        clearAuthSession();
      }
      return getRuntimeState();
    }

    const apiClient = getApiClient();
    if (!apiClient || typeof apiClient.get !== 'function') {
      state.initialized = true;
      dispatchAuthChanged();
      return state;
    }

    const response = await apiClient.get('/api/v1/users/me/', null, { skipAuth: false });
    if (response && response.ok && response.data && response.data.username) {
      setAuthSession(response.data, { clearLegacy: true });
      return getRuntimeState();
    }

    clearAuthSession();
    return getRuntimeState();
  })();

  state.bootstrapPromise = bootstrapPromise;
  try {
    return await bootstrapPromise;
  } finally {
    state.bootstrapPromise = null;
  }
}

async function safeLogout() {
  try {
    const role = getCurrentRole();
    if (typeof window !== 'undefined' && typeof window.appendAdminAudit === 'function') {
      window.appendAdminAudit('logout', `Выход из системы${role ? ` (${role})` : ''}`);
    }
  } catch (_) {}

  try {
    if (isApiModeEnabled()) {
      const apiClient = getApiClient();
      if (apiClient && typeof apiClient.post === 'function') {
        // skipAuth: true — endpoint AllowAny, нужен только refresh-cookie (credentials: include).
        // Исключаем 401 при истёкшем access-токене.
        await apiClient.post('/api/v1/auth/logout/', {}, { skipAuth: true });
      }
    }
  } catch (_) {
    // На клиенте logout должен завершаться локальной очисткой даже при сетевой ошибке.
  }

  clearAuthSession();
}

function checkArchitectRole() {
  const roleApi = getRoleApi();
  const role = getCurrentRole();
  if (roleApi && typeof roleApi.canManageTechnologies === 'function') {
    return roleApi.canManageTechnologies(role);
  }
  if (roleApi && typeof roleApi.hasCapability === 'function') {
    return roleApi.hasCapability('manage_technologies', role);
  }
  return false;
}

function checkDirectorRole() {
  return getCurrentRole() === 'owner';
}

function renderAuth() {
  const authInfo = document.getElementById('authInfo');
  const logoutContainer = document.getElementById('logoutContainer');
  if (!authInfo || !logoutContainer) return;

  const roleApi = getRoleApi();
  const role = getCurrentRole();
  const authenticated = isAuthenticated();
  const canManageTechnologies =
    roleApi && typeof roleApi.hasCapability === 'function'
      ? roleApi.hasCapability('manage_technologies', role)
      : checkArchitectRole();
  const canSubmitTechnologyChanges =
    roleApi && typeof roleApi.canSubmitTechnologyChanges === 'function'
      ? roleApi.canSubmitTechnologyChanges(role)
      : canManageTechnologies;
  const canExportReports =
    roleApi && typeof roleApi.hasCapability === 'function'
      ? roleApi.hasCapability('export_reports', role)
      : true;
  const canAccessAdminPanel =
    roleApi && typeof roleApi.canAccessAdminPanel === 'function'
      ? roleApi.canAccessAdminPanel(role)
      : role === 'admin';
  const canOpenProposalPanel =
    roleApi && typeof roleApi.hasCapability === 'function'
      ? roleApi.hasCapability('create_proposals', role) ||
        roleApi.hasCapability('review_proposals', role)
      : false;
  const roleLabel =
    roleApi && typeof roleApi.getRoleLabel === 'function' ? roleApi.getRoleLabel(role) : role;
  const exportPdfBtn = document.getElementById('exportPdfBtn');
  const editBtn = document.getElementById('editTechBtn');
  const deleteBtn = document.getElementById('deleteTechBtn');
  const addTechBtn = document.getElementById('addTechBtn');
  const reportIconBtn = document.getElementById('reportIconBtn');
  const addIconBtn = document.getElementById('addIconBtn');
  const proposalBtn = document.getElementById('proposalIconBtn');

  const setButtonsVisibility = (visible) => {
    if (addTechBtn) addTechBtn.style.display = visible ? 'flex' : 'none';
    if (exportPdfBtn) exportPdfBtn.style.display = canExportReports ? 'flex' : 'none';
    if (editBtn) editBtn.style.display = visible ? 'inline-flex' : 'none';
    if (deleteBtn) deleteBtn.style.display = visible ? 'inline-flex' : 'none';
    if (reportIconBtn) {
      reportIconBtn.style.display = canExportReports ? 'flex' : 'none';
      reportIconBtn.classList.toggle('hidden', !canExportReports);
    }
    if (addIconBtn) {
      addIconBtn.style.display = visible ? 'flex' : 'none';
      addIconBtn.classList.toggle('hidden', !visible);
    }
    if (proposalBtn) {
      proposalBtn.style.display = canOpenProposalPanel ? 'flex' : 'none';
      proposalBtn.classList.toggle('hidden', !canOpenProposalPanel);
    }
  };

  document.body.classList.remove('not-authorized');

  if (authenticated && canManageTechnologies && role !== 'admin') {
    authInfo.innerHTML = `<div class="user-role architect-role">${roleLabel}</div>`;
    logoutContainer.innerHTML = `<button class="logout" data-tooltip="Выйти" aria-label="Выйти">
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16,17 21,12 16,7"/>
      <line x1="21" y1="12" x2="9" y2="12" stroke-dasharray="100"/>
    </svg>
  </button>`;
    setButtonsVisibility(canSubmitTechnologyChanges);
    logoutContainer.querySelector('.logout').onclick = async () => {
      await safeLogout();
      window.location.href = '/src/pages/auth.html';
    };
  } else if (authenticated && canAccessAdminPanel) {
    authInfo.innerHTML = `<div class="user-role admin-role" data-tooltip="Перейти в админ-панель" style="cursor: pointer;">Администратор</div>`;
    logoutContainer.innerHTML = `<button class="logout" data-tooltip="Выйти" aria-label="Выйти">
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16,17 21,12 16,7"/>
      <line x1="21" y1="12" x2="9" y2="12" stroke-dasharray="100"/>
    </svg>
  </button>`;
    setButtonsVisibility(canSubmitTechnologyChanges);
    const adminRoleElement = authInfo.querySelector('.admin-role');
    if (adminRoleElement) {
      adminRoleElement.onclick = () => {
        try {
          sessionStorage.setItem('rmk_admin_nav_ts', String(Date.now()));
        } catch (_) {}
        window.location.href = '/src/pages/admin.html';
      };
    }
    logoutContainer.querySelector('.logout').onclick = async () => {
      await safeLogout();
      location.reload();
    };
  } else if (authenticated && (role === 'editor' || role === 'guest')) {
    authInfo.innerHTML = `<div class="user-role">${roleLabel}</div>`;
    logoutContainer.innerHTML = `<button class="logout" data-tooltip="Выйти" aria-label="Выйти">
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16,17 21,12 16,7"/>
      <line x1="21" y1="12" x2="9" y2="12" stroke-dasharray="100"/>
    </svg>
  </button>`;
    setButtonsVisibility(canSubmitTechnologyChanges);
    logoutContainer.querySelector('.logout').onclick = async () => {
      await safeLogout();
      location.reload();
    };
  } else {
    authInfo.innerHTML = '';
    logoutContainer.innerHTML = `<button class="login" data-tooltip="Войти" aria-label="Войти">
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
      <polyline points="10,17 15,12 10,7"/>
      <line x1="15" y1="12" x2="3" y2="12" stroke-dasharray="100"/>
    </svg>
  </button>`;
    setButtonsVisibility(false);
    document.body.classList.add('not-authorized');
    logoutContainer.querySelector('.login').onclick = () => {
      window.location.href = '/src/pages/auth.html';
    };
    const isAuthPage = window.location.pathname.includes('auth.html');
    const state = getRuntimeState();
    if (!isAuthPage && (!isApiModeEnabled() || state.initialized)) {
      window.location.href = '/src/pages/auth.html';
    }
  }

  if (window.ModerationFlow && typeof window.ModerationFlow.syncUiState === 'function') {
    window.ModerationFlow.syncUiState();
  }
}

const AuthModule = {
  bootstrapAuthSession,
  setAuthSession,
  clearAuthSession,
  clearLegacyAuthArtifacts,
  isAuthenticated,
  getCurrentProfile,
  getCurrentUsername,
  getCurrentRole,
  checkArchitectRole,
  checkDirectorRole,
  renderAuth,
  safeLogout
};

if (typeof window !== 'undefined') {
  window.AuthModule = AuthModule;
  window.checkArchitectRole = checkArchitectRole;
  window.checkDirectorRole = checkDirectorRole;
  window.renderAuth = renderAuth;
  window.clearAuthFromStorage = clearAuthSession;
  window.safeLogout = safeLogout;
}

export default AuthModule;
export {
  bootstrapAuthSession,
  setAuthSession,
  clearAuthSession,
  clearLegacyAuthArtifacts,
  isAuthenticated,
  getCurrentProfile,
  getCurrentUsername,
  getCurrentRole,
  checkArchitectRole,
  checkDirectorRole,
  renderAuth,
  safeLogout
};
