import OnboardingTour from './onboarding.js';

const CAPABILITIES_BY_ROLE = {
  guest: ['read_radar', 'use_filters', 'export_reports'],
  editor: ['read_radar', 'use_filters', 'export_reports', 'create_proposals', 'view_proposal_statuses'],
  owner: [
    'read_radar',
    'use_filters',
    'export_reports',
    'manage_technologies',
    'publish_technologies',
    'create_proposals',
    'view_proposal_statuses',
    'review_proposals'
  ],
  admin: [
    'read_radar',
    'use_filters',
    'export_reports',
    'manage_technologies',
    'publish_technologies',
    'create_proposals',
    'view_proposal_statuses',
    'review_proposals',
    'manage_references',
    'manage_admin_panel',
    'manage_users',
    'view_metrics'
  ]
};

function setupLocalStorage() {
  const store = new Map([
    ['isLoggedIn', 'true'],
    ['username', 'qa-user'],
    ['role', 'guest']
  ]);

  const localStorageMock = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear()
  };

  global.localStorage = localStorageMock;
  window.localStorage = localStorageMock;

  return store;
}

function setupConditionalTargets() {
  document.body.innerHTML = `
    <div id="exportPdfModal"></div>
    <div id="addTechPanel"></div>
    <div id="addBlockPanel"></div>
    <div id="quadrantPriorityPanel"></div>
  `;
}

function setupRoleApi(store) {
  const normalizeRole = (role) => {
    const normalized = String(role || '').trim().toLowerCase();
    if (normalized === 'architect' || normalized === 'director' || normalized === 'project_manager') {
      return 'owner';
    }
    if (normalized === 'analyst' || normalized === 'viewer') {
      return 'guest';
    }
    return CAPABILITIES_BY_ROLE[normalized] ? normalized : '';
  };

  window.RoleCapabilities = {
    normalizeRole,
    getCurrentRole: () => normalizeRole(store.get('role')),
    hasCapability: (capability, role) => {
      const effectiveRole = normalizeRole(role || store.get('role'));
      const capabilities = CAPABILITIES_BY_ROLE[effectiveRole] || [];
      return capabilities.includes(capability);
    }
  };
}

function getVisibleIdsFor(role) {
  localStorage.setItem('role', role);
  return OnboardingTour.getVisibleStepIdsForRole(role);
}

describe('onboarding role-based flow (P3)', () => {
  beforeEach(() => {
    const store = setupLocalStorage();
    setupConditionalTargets();
    setupRoleApi(store);
  });

  afterEach(() => {
    document.body.innerHTML = '';
    delete window.RoleCapabilities;
  });

  test('defines master-flow with role-specific steps', () => {
    expect(OnboardingTour.getMasterFlowStepIds()).toEqual([
      'welcome',
      'sidebar',
      'report-button',
      'add-technology',
      'add-block',
      'search',
      'filters',
      'radar',
      'quadrant-zoom',
      'priority-panel',
      'detail-panel',
      'proposal-workflow',
      'admin-panel-entry',
      'complete'
    ]);
  });

  test('guest does not see owner/editor/admin-only steps', () => {
    const visible = getVisibleIdsFor('guest');
    expect(visible).not.toContain('add-technology');
    expect(visible).not.toContain('add-block');
    expect(visible).not.toContain('proposal-workflow');
    expect(visible).not.toContain('admin-panel-entry');
  });

  test('editor sees proposal step but not owner/admin steps', () => {
    const visible = getVisibleIdsFor('editor');
    expect(visible).toContain('proposal-workflow');
    expect(visible).not.toContain('add-technology');
    expect(visible).not.toContain('add-block');
    expect(visible).not.toContain('admin-panel-entry');
  });

  test('owner sees CRUD and proposal steps, but not admin step', () => {
    const visible = getVisibleIdsFor('owner');
    expect(visible).toContain('add-technology');
    expect(visible).toContain('add-block');
    expect(visible).toContain('proposal-workflow');
    expect(visible).not.toContain('admin-panel-entry');
  });

  test('admin sees full role-specific flow', () => {
    const visible = getVisibleIdsFor('admin');
    expect(visible).toContain('add-technology');
    expect(visible).toContain('add-block');
    expect(visible).toContain('proposal-workflow');
    expect(visible).toContain('admin-panel-entry');
  });
});
