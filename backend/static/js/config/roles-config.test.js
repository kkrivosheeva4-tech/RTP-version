import './roles-config.js';

describe('roles-config role model v2', () => {
  test('normalizes legacy roles to v2', () => {
    expect(window.RolesConfig.normalizeRole('architect')).toBe('owner');
    expect(window.RolesConfig.normalizeRole('director')).toBe('owner');
    expect(window.RolesConfig.normalizeRole('analyst')).toBe('guest');
  });

  test('evaluates capabilities by role', () => {
    expect(window.RolesConfig.hasCapability('manage_technologies', 'owner')).toBe(true);
    expect(window.RolesConfig.hasCapability('manage_technologies', 'editor')).toBe(false);
    expect(window.RolesConfig.hasCapability('manage_admin_panel', 'admin')).toBe(true);
    expect(window.RolesConfig.hasCapability('manage_admin_panel', 'owner')).toBe(false);
    expect(window.RolesConfig.hasCapability('export_reports', 'guest')).toBe(true);
    expect(window.RolesConfig.canSubmitTechnologyChanges('editor')).toBe(true);
    expect(window.RolesConfig.isProposalOnlyRole('editor')).toBe(true);
  });

  test('supports capability checks with legacy roles', () => {
    expect(window.RoleCapabilities.normalizeRole('project_manager')).toBe('owner');
    expect(window.RoleCapabilities.canManageTechnologies('project_manager')).toBe(true);
    expect(window.RoleCapabilities.canExportReports('viewer')).toBe(true);
    expect(window.RoleCapabilities.canManageTechnologies('viewer')).toBe(false);
  });
});
