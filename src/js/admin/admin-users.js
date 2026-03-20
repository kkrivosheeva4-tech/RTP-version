/**
 * Раздел «Пользователи» админ-панели: backend-driven список, редактирование роли и удаление.
 */
(function () {
  'use strict';

  var USERS_API_PATH = '/api/v1/admin-panel/users';

  function getCommon() {
    return window.AdminCommon;
  }

  function getState() {
    return getCommon().AdminState;
  }

  function getApiClient() {
    return window.ApiClient || null;
  }

  function addAuditLog(action, details) {
    if (typeof window.addAdminAuditLog === 'function') {
      window.addAdminAuditLog(action, details);
    }
  }

  function mapApiUserToState(user) {
    var common = getCommon();
    var rawRole = (user && user.role != null ? String(user.role) : '').trim();
    var normalizedRole = rawRole;
    if (window.RolesConfig && typeof window.RolesConfig.normalizeRole === 'function') {
      normalizedRole = window.RolesConfig.normalizeRole(rawRole) || rawRole;
    }
    return {
      id: Number(user && user.id) || 0,
      name: (user && user.username != null ? String(user.username) : '').trim(),
      email: (user && user.email != null ? String(user.email) : '').trim(),
      role: normalizedRole || 'guest',
      status: user && user.is_active === false ? 'inactive' : 'active',
      is2faEnabled: Boolean(user && user.is_2fa_enabled),
      createdAt: user && user.created_at ? user.created_at : common.ensureInstallDate()
    };
  }

  async function fetchUsersFromApi() {
    var client = getApiClient();
    if (!client || typeof client.get !== 'function') {
      throw new Error('ApiClient недоступен для загрузки пользователей');
    }
    var response = await client.get(USERS_API_PATH);
    if (!response || response.ok === false) {
      throw new Error((response && response.error) || 'Не удалось загрузить пользователей');
    }
    var users = Array.isArray(response.data) ? response.data : [];
    return normalizeUsers(users);
  }

  async function updateUserViaApi(userId, payload) {
    var client = getApiClient();
    if (!client || typeof client.patch !== 'function') {
      throw new Error('ApiClient недоступен для обновления пользователя');
    }
    var response = await client.patch(USERS_API_PATH + '/' + userId, payload);
    if (!response || response.ok === false) {
      throw new Error((response && response.error) || 'Не удалось обновить пользователя');
    }
    return mapApiUserToState(response.data || {});
  }

  async function deleteUserViaApi(userId) {
    var client = getApiClient();
    if (!client || typeof client.delete !== 'function') {
      throw new Error('ApiClient недоступен для удаления пользователя');
    }
    var response = await client.delete(USERS_API_PATH + '/' + userId);
    if (!response || response.ok === false) {
      throw new Error((response && response.error) || 'Не удалось удалить пользователя');
    }
  }

  function normalizeUsers(list) {
    if (!Array.isArray(list)) return [];
    return list.filter(Boolean).map(function (u) {
      if (Object.prototype.hasOwnProperty.call(u, 'username')) {
        return mapApiUserToState(u);
      }
      return {
        id: Number(u.id) || 0,
        name: (u.name != null ? String(u.name) : '').trim(),
        email: (u.email != null ? String(u.email) : '').trim(),
        role: (u.role != null ? String(u.role) : '').trim() || 'guest',
        status: u.status === 'inactive' ? 'inactive' : 'active',
        createdAt: u.createdAt || ''
      };
    });
  }

  async function refreshUsersFromApi() {
    var common = getCommon();
    var state = getState();
    state.users = await fetchUsersFromApi();
    loadUsers();
    if (window.AdminDashboard && typeof window.AdminDashboard.updateDashboardStats === 'function') {
      window.AdminDashboard.updateDashboardStats();
    }
    return state.users;
  }

  function loadUsers() {
    var state = getState();
    var common = getCommon();
    var tbody = document.getElementById('usersTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    var search =
      document.getElementById('userSearch') && document.getElementById('userSearch').value
        ? document.getElementById('userSearch').value.toLowerCase()
        : '';
    var roleFilter =
      document.getElementById('roleFilter') && document.getElementById('roleFilter').value
        ? document.getElementById('roleFilter').value
        : '';
    var users = state.users || [];
    var filteredUsers = users.filter(function (user) {
      var matchesSearch =
        user.name.toLowerCase().indexOf(search) !== -1 ||
        user.email.toLowerCase().indexOf(search) !== -1;
      var roleValue = user.role;
      if (window.RolesConfig && typeof window.RolesConfig.normalizeRole === 'function') {
        roleValue = window.RolesConfig.normalizeRole(roleValue) || roleValue;
      }
      var matchesRole = !roleFilter || roleValue === roleFilter;
      return matchesSearch && matchesRole;
    });
    filteredUsers.forEach(function (user) {
      var row = document.createElement('tr');
      var tdId = document.createElement('td');
      tdId.textContent = user.id;
      row.appendChild(tdId);
      var tdName = document.createElement('td');
      tdName.textContent = user.name;
      row.appendChild(tdName);
      var tdEmail = document.createElement('td');
      tdEmail.textContent = user.email;
      row.appendChild(tdEmail);
      var tdRole = document.createElement('td');
      var roleBadge = document.createElement('span');
      roleBadge.className = 'status-badge ' + common.getRoleClass(user.role);
      roleBadge.textContent = common.getRoleName(user.role);
      tdRole.appendChild(roleBadge);
      row.appendChild(tdRole);
      var tdDate = document.createElement('td');
      tdDate.textContent = common.formatDate(user.createdAt);
      row.appendChild(tdDate);
      var tdStatus = document.createElement('td');
      var statusBadge = document.createElement('span');
      statusBadge.className =
        'status-badge ' + (user.status === 'active' ? 'status-active' : 'status-inactive');
      statusBadge.textContent = user.status === 'active' ? 'Активен' : 'Неактивен';
      tdStatus.appendChild(statusBadge);
      row.appendChild(tdStatus);
      var tdActions = document.createElement('td');
      var actionsDiv = document.createElement('div');
      actionsDiv.className = 'action-buttons';
      var editBtn = document.createElement('button');
      editBtn.className = 'action-btn edit-btn';
      editBtn.setAttribute('data-tooltip', 'Редактировать');
      editBtn.setAttribute('data-user-id', user.id);
      editBtn.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>';
      editBtn.addEventListener('click', function () {
        editUser(user.id);
      });
      actionsDiv.appendChild(editBtn);
      var deleteBtn = document.createElement('button');
      deleteBtn.className = 'action-btn delete-btn';
      deleteBtn.setAttribute('data-tooltip', 'Удалить');
      deleteBtn.setAttribute('data-user-id', user.id);
      deleteBtn.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3,6 5,6 21,6"></polyline><path d="M19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>';
      deleteBtn.addEventListener('click', function () {
        deleteUser(user.id);
      });
      actionsDiv.appendChild(deleteBtn);
      tdActions.appendChild(actionsDiv);
      row.appendChild(tdActions);
      tbody.appendChild(row);
    });
  }

  function filterUsers() {
    loadUsers();
  }

  function editUser(userId) {
    var state = getState();
    var common = getCommon();
    var users = state.users || [];
    var user = users.filter(function (u) {
      return u.id === userId;
    })[0];
    if (!user) return;
    state.currentUserId = userId;
    document.getElementById('userModalTitle').textContent = 'Редактировать пользователя';
    document.getElementById('userName').value = user.name;
    document.getElementById('userEmail').value = user.email;
    document.getElementById('userRole').value = user.role;
    common.showModal('userModal');
  }

  function deleteUser(userId) {
    var state = getState();
    var common = getCommon();
    var users = state.users || [];
    var user = users.filter(function (u) {
      return u.id === userId;
    })[0];
    if (!user) return;
    common.showConfirmModal(
      'Удаление пользователя',
      'Вы уверены, что хотите удалить пользователя "' + user.name + '"?',
      async function () {
        try {
          await deleteUserViaApi(userId);
          state.users = state.users.filter(function (u) {
            return u.id !== userId;
          });
          loadUsers();
          if (
            window.AdminDashboard &&
            typeof window.AdminDashboard.updateDashboardStats === 'function'
          ) {
            window.AdminDashboard.updateDashboardStats();
          }
          addAuditLog('delete', 'Удален пользователь "' + user.name + '"');
          common.showNotification('Успешно', 'Пользователь удален', 'success');
        } catch (error) {
          common.showNotification(
            'Ошибка',
            error && error.message ? error.message : 'Не удалось удалить пользователя',
            'error',
            true
          );
        }
      }
    );
  }

  async function handleUserSubmit(e) {
    e.preventDefault();
    var state = getState();
    var common = getCommon();
    var users = state.users || [];
    var formData = {
      name: document.getElementById('userName').value,
      email: document.getElementById('userEmail').value,
      role: document.getElementById('userRole').value
    };
    if (!formData.name || !formData.role) {
      common.showNotification('Ошибка', 'Заполните все обязательные поля', 'error');
      return;
    }
    if (state.currentUserId) {
      var userIndex = users.findIndex(function (u) {
        return u.id === state.currentUserId;
      });
      if (userIndex === -1) return;
      var oldRole = users[userIndex].role;
      try {
        var updatedUser = await updateUserViaApi(state.currentUserId, { role: formData.role });
        users[userIndex] = updatedUser;
        loadUsers();
        addAuditLog(
          'update',
          'Изменена роль пользователя: ' +
            updatedUser.name +
            ' (' +
            oldRole +
            ' -> ' +
            formData.role +
            ')'
        );
        common.showNotification('Успешно', 'Роль пользователя обновлена', 'success');
      } catch (error) {
        common.showNotification(
          'Ошибка',
          error && error.message ? error.message : 'Не удалось обновить пользователя',
          'error',
          true
        );
        return;
      }
    } else {
      common.showNotification(
        'Ограничение UI',
        'Создание пользователей из админского UI пока не включено. Для этого сценария нужен отдельный backend-driven form.',
        'info',
        true
      );
      return;
    }
    common.hideModal('userModal');
    loadUsers();
    if (window.AdminDashboard && typeof window.AdminDashboard.updateDashboardStats === 'function') {
      window.AdminDashboard.updateDashboardStats();
    }
  }

  function init() {
    var common = getCommon();
    var userSearch = document.getElementById('userSearch');
    var roleFilter = document.getElementById('roleFilter');
    if (userSearch)
      userSearch.addEventListener('input', function () {
        filterUsers();
      });
    if (roleFilter)
      roleFilter.addEventListener('change', function () {
        filterUsers();
      });
    var userForm = document.getElementById('userForm');
    var cancelUser = document.getElementById('cancelUser');
    if (userForm) userForm.addEventListener('submit', handleUserSubmit);
    if (cancelUser)
      cancelUser.addEventListener('click', function () {
        common.hideModal('userModal');
      });
    loadUsers();
  }

  window.AdminUsers = {
    init: init,
    loadUsers: loadUsers,
    normalizeUsers: normalizeUsers,
    fetchUsersFromApi: fetchUsersFromApi,
    refreshUsersFromApi: refreshUsersFromApi
  };
})();
