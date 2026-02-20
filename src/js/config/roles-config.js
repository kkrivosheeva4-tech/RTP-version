/**
 * Единый конфиг ролей и системных учёток.
 * Используется страницей входа (auth.js) и админ-панелью (admin-users.js).
 * При переходе на API: auth и admin только потребляют данные; реальные учётки приходят с бэкенда.
 */
(function () {
  'use strict';

  var ROLES = {
    ADMIN: 'admin',
    ARCHITECT: 'architect',
    DIRECTOR: 'director',
    PROJECT_MANAGER: 'project_manager',
    ANALYST: 'analyst'
  };

  /** Отображаемые названия ролей (для UI админки и др.) */
  var ROLE_LABELS = {
    admin: 'Администратор',
    architect: 'Архитектор',
    director: 'Директор',
    project_manager: 'Руководитель проекта',
    analyst: 'Аналитик'
  };

  /** Системные учётки для отображения в админке (шаблон по умолчанию) и для mock-входа. Без паролей. */
  var SYSTEM_ACCOUNTS = [
    { username: 'admin', role: ROLES.ADMIN },
    { username: 'architect', role: ROLES.ARCHITECT },
    { username: 'director', role: ROLES.DIRECTOR },
    { username: 'project_manager', role: ROLES.PROJECT_MANAGER }
  ];

  /**
   * Пароли только для mock-режима (dev). При переходе на API вход — через API, пароли не используются.
   * Ключ — username, значение — пароль.
   */
  var MOCK_PASSWORDS = {
    admin: 'admin123',
    architect: 'architect123',
    director: 'director123',
    project_manager: 'pm123'
  };

  /**
   * Список учёток для mock-проверки входа (auth.js): { username, password, role }.
   */
  function getUsersForMockAuth() {
    return SYSTEM_ACCOUNTS.map(function (acc) {
      return {
        username: acc.username,
        password: MOCK_PASSWORDS[acc.username] || '',
        role: acc.role
      };
    });
  }

  /**
   * Список системных учёток без паролей — для шаблона в админке (таблица пользователей по умолчанию).
   * @returns {Array<{username: string, role: string}>}
   */
  function getSystemAccountsForAdmin() {
    return SYSTEM_ACCOUNTS.slice();
  }

  /**
   * Отображаемое название роли по ключу.
   * @param {string} roleKey
   * @returns {string}
   */
  function getRoleLabel(roleKey) {
    return ROLE_LABELS[roleKey] || roleKey;
  }

  /**
   * Проверка, что роль входит в список известных (для доступа в админку и т.д.).
   * @param {string} role
   * @returns {boolean}
   */
  function isKnownRole(role) {
    return Object.keys(ROLE_LABELS).indexOf(role) !== -1;
  }

  window.RolesConfig = {
    ROLES: ROLES,
    ROLE_LABELS: ROLE_LABELS,
    getUsersForMockAuth: getUsersForMockAuth,
    getSystemAccountsForAdmin: getSystemAccountsForAdmin,
    getRoleLabel: getRoleLabel,
    isKnownRole: isKnownRole
  };
})();
