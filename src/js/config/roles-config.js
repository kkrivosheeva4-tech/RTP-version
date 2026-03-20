/**
 * Единый конфиг ролей и возможностей (role model v2).
 * Источник правды для auth/admin/onboarding/ui-gating.
 */
(function () {
  'use strict';

  var ROLES = {
    GUEST: 'guest',
    EDITOR: 'editor',
    OWNER: 'owner',
    ADMIN: 'admin'
  };

  var LEGACY_TO_V2 = {
    architect: ROLES.OWNER,
    director: ROLES.OWNER,
    project_manager: ROLES.OWNER,
    analyst: ROLES.GUEST,
    viewer: ROLES.GUEST
  };

  var ROLE_LABELS = {
    guest: 'Гость',
    editor: 'Редактор',
    owner: 'Владелец',
    admin: 'Администратор'
  };

  var CAPABILITIES_BY_ROLE = {
    guest: ['read_radar', 'use_filters', 'export_reports'],
    editor: [
      'read_radar',
      'use_filters',
      'export_reports',
      'create_proposals',
      'view_proposal_statuses'
    ],
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
      'manage_admin_panel',
      'manage_users'
    ]
  };

  var SYSTEM_ACCOUNTS = [
    { username: 'admin', role: ROLES.ADMIN },
    { username: 'owner', role: ROLES.OWNER },
    { username: 'editor', role: ROLES.EDITOR },
    { username: 'guest', role: ROLES.GUEST }
  ];

  // Legacy-учетки оставляем только для плавного перехода в mock-режиме.
  var LEGACY_ALIAS_ACCOUNTS = [
    { username: 'architect', role: ROLES.OWNER },
    { username: 'director', role: ROLES.OWNER },
    { username: 'project_manager', role: ROLES.OWNER },
    { username: 'analyst', role: ROLES.GUEST }
  ];

  var MOCK_PASSWORDS = {
    admin: 'admin123',
    owner: 'owner123',
    editor: 'editor123',
    guest: 'guest123',
    architect: 'architect123',
    director: 'director123',
    project_manager: 'pm123',
    analyst: 'analyst123'
  };

  function normalizeRole(role) {
    var key = (role == null ? '' : String(role)).trim().toLowerCase();
    if (!key) return ROLES.GUEST;
    if (ROLE_LABELS[key]) return key;
    if (LEGACY_TO_V2[key]) return LEGACY_TO_V2[key];
    return ROLES.GUEST;
  }

  function getCurrentRole() {
    if (typeof window !== 'undefined' && window.AuthModule && typeof window.AuthModule.getCurrentRole === 'function') {
      return normalizeRole(window.AuthModule.getCurrentRole());
    }
    return ROLES.GUEST;
  }

  function hasCapability(capability, role) {
    var normalized = normalizeRole(role || getCurrentRole());
    var caps = CAPABILITIES_BY_ROLE[normalized] || [];
    return caps.indexOf(String(capability || '').trim()) !== -1;
  }

  function canManageTechnologies(role) {
    return hasCapability('manage_technologies', role);
  }

  function canExportReports(role) {
    return hasCapability('export_reports', role);
  }

  function canAccessAdminPanel(role) {
    return hasCapability('manage_admin_panel', role);
  }

  function canCreateProposals(role) {
    return hasCapability('create_proposals', role);
  }

  function canReviewProposals(role) {
    return hasCapability('review_proposals', role);
  }

  function canSubmitTechnologyChanges(role) {
    return canManageTechnologies(role) || canCreateProposals(role);
  }

  function isProposalOnlyRole(role) {
    return canCreateProposals(role) && !canManageTechnologies(role);
  }

  function getUsersForMockAuth() {
    var merged = SYSTEM_ACCOUNTS.concat(LEGACY_ALIAS_ACCOUNTS);
    return merged.map(function (acc) {
      return {
        username: acc.username,
        password: MOCK_PASSWORDS[acc.username] || '',
        role: normalizeRole(acc.role)
      };
    });
  }

  function getSystemAccountsForAdmin() {
    return SYSTEM_ACCOUNTS.slice();
  }

  function getRoleLabel(roleKey) {
    var normalized = normalizeRole(roleKey);
    return ROLE_LABELS[normalized] || normalized;
  }

  function isKnownRole(role) {
    var normalized = normalizeRole(role);
    return Object.keys(ROLE_LABELS).indexOf(normalized) !== -1;
  }

  var api = {
    ROLES: ROLES,
    ROLE_LABELS: ROLE_LABELS,
    LEGACY_TO_V2: LEGACY_TO_V2,
    CAPABILITIES_BY_ROLE: CAPABILITIES_BY_ROLE,
    normalizeRole: normalizeRole,
    getCurrentRole: getCurrentRole,
    hasCapability: hasCapability,
    canManageTechnologies: canManageTechnologies,
    canExportReports: canExportReports,
    canAccessAdminPanel: canAccessAdminPanel,
    canCreateProposals: canCreateProposals,
    canReviewProposals: canReviewProposals,
    canSubmitTechnologyChanges: canSubmitTechnologyChanges,
    isProposalOnlyRole: isProposalOnlyRole,
    getUsersForMockAuth: getUsersForMockAuth,
    getSystemAccountsForAdmin: getSystemAccountsForAdmin,
    getRoleLabel: getRoleLabel,
    isKnownRole: isKnownRole
  };

  window.RolesConfig = api;
  window.RoleCapabilities = api;
})();
