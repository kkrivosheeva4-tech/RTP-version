/**
 * Раздел «Пользователи» админ-панели: загрузка из localStorage, CRUD, таблица и модалка.
 */
(function () {
  'use strict';

  function getCommon() {
    return window.AdminCommon;
  }

  function getState() {
    return getCommon().AdminState;
  }

  function addAuditLog(action, details) {
    if (typeof window.addAdminAuditLog === 'function') {
      window.addAdminAuditLog(action, details);
    }
  }

  function getDefaultUsers() {
    var common = getCommon();
    var createdAt = common.ensureInstallDate();
    var base = (typeof window.RolesConfig !== 'undefined' && typeof window.RolesConfig.getSystemAccountsForAdmin === 'function')
      ? window.RolesConfig.getSystemAccountsForAdmin()
      : [
          { username: 'admin', role: 'admin' },
          { username: 'architect', role: 'architect' },
          { username: 'director', role: 'director' },
          { username: 'project_manager', role: 'project_manager' }
        ];
    return base.map(function (u, idx) {
      return {
        id: idx + 1,
        name: u.username,
        email: u.username + '@local',
        role: u.role,
        status: 'active',
        createdAt: createdAt
      };
    });
  }

  function normalizeUsers(list) {
    var common = getCommon();
    if (!Array.isArray(list)) return [];
    var nextId = 1;
    var used = {};
    return list
      .filter(Boolean)
      .map(function (u) {
        var createdAt = (u.createdAt && String(u.createdAt).trim()) || common.ensureInstallDate();
        var id = Number(u.id);
        if (!Number.isFinite(id) || id <= 0 || used[id]) {
          while (used[nextId]) nextId += 1;
          id = nextId++;
        }
        used[id] = true;
        return {
          id: id,
          name: (u.name != null ? String(u.name) : '').trim() || ('user-' + id),
          email: (u.email != null ? String(u.email) : '').trim() || ('user-' + id + '@local'),
          role: (u.role != null ? String(u.role) : '').trim() || 'analyst',
          status: (u.status === 'inactive' ? 'inactive' : 'active'),
          createdAt: createdAt
        };
      });
  }

  function loadUsers() {
    var state = getState();
    var common = getCommon();
    var tbody = document.getElementById('usersTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    var search = (document.getElementById('userSearch') && document.getElementById('userSearch').value) ? document.getElementById('userSearch').value.toLowerCase() : '';
    var roleFilter = (document.getElementById('roleFilter') && document.getElementById('roleFilter').value) ? document.getElementById('roleFilter').value : '';
    var users = state.users || [];
    var filteredUsers = users.filter(function (user) {
      var matchesSearch = user.name.toLowerCase().indexOf(search) !== -1 || user.email.toLowerCase().indexOf(search) !== -1;
      var matchesRole = !roleFilter || user.role === roleFilter;
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
      statusBadge.className = 'status-badge ' + (user.status === 'active' ? 'status-active' : 'status-inactive');
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
      editBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>';
      editBtn.addEventListener('click', function () { editUser(user.id); });
      actionsDiv.appendChild(editBtn);
      var deleteBtn = document.createElement('button');
      deleteBtn.className = 'action-btn delete-btn';
      deleteBtn.setAttribute('data-tooltip', 'Удалить');
      deleteBtn.setAttribute('data-user-id', user.id);
      deleteBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3,6 5,6 21,6"></polyline><path d="M19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>';
      deleteBtn.addEventListener('click', function () { deleteUser(user.id); });
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
    var user = users.filter(function (u) { return u.id === userId; })[0];
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
    var user = users.filter(function (u) { return u.id === userId; })[0];
    if (!user) return;
    common.showConfirmModal(
      'Удаление пользователя',
      'Вы уверены, что хотите удалить пользователя "' + user.name + '"?',
      function () {
        state.users = users.filter(function (u) { return u.id !== userId; });
        getCommon().persistUsers();
        loadUsers();
        if (window.AdminDashboard && typeof window.AdminDashboard.updateDashboardStats === 'function') {
          window.AdminDashboard.updateDashboardStats();
        }
        addAuditLog('delete', 'Удален пользователь "' + user.name + '"');
        common.showNotification('Успешно', 'Пользователь удален', 'success');
      }
    );
  }

  function openUserModal() {
    var state = getState();
    var common = getCommon();
    state.currentUserId = null;
    document.getElementById('userModalTitle').textContent = 'Добавить пользователя';
    document.getElementById('userForm').reset();
    common.showModal('userModal');
  }

  function handleUserSubmit(e) {
    e.preventDefault();
    var state = getState();
    var common = getCommon();
    var users = state.users || [];
    var formData = {
      name: document.getElementById('userName').value,
      email: document.getElementById('userEmail').value,
      role: document.getElementById('userRole').value
    };
    if (!formData.name || !formData.email || !formData.role) {
      common.showNotification('Ошибка', 'Заполните все обязательные поля', 'error');
      return;
    }
    if (state.currentUserId) {
      var userIndex = -1;
      for (var i = 0; i < users.length; i++) {
        if (users[i].id === state.currentUserId) { userIndex = i; break; }
      }
      if (userIndex !== -1) {
        var oldRole = users[userIndex].role;
        users[userIndex].role = formData.role;
        getCommon().persistUsers();
        loadUsers();
        addAuditLog('update', 'Изменена роль пользователя: ' + users[userIndex].name + ' (' + oldRole + ' -> ' + formData.role + ')');
        common.showNotification('Успешно', 'Роль пользователя обновлена', 'success');
      }
    } else {
      var maxId = 0;
      users.forEach(function (u) {
        var id = Number(u && u.id) || 0;
        if (id > maxId) maxId = id;
      });
      var newUser = {
        id: maxId + 1,
        name: formData.name,
        email: formData.email,
        role: formData.role,
        status: 'active',
        createdAt: new Date().toISOString().split('T')[0]
      };
      state.users.push(newUser);
      getCommon().persistUsers();
      addAuditLog('create', 'Создан новый пользователь: ' + formData.name);
      common.showNotification('Успешно', 'Пользователь создан', 'success');
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
    if (userSearch) userSearch.addEventListener('input', function () { filterUsers(); });
    if (roleFilter) roleFilter.addEventListener('change', function () { filterUsers(); });
    var userForm = document.getElementById('userForm');
    var cancelUser = document.getElementById('cancelUser');
    if (userForm) userForm.addEventListener('submit', handleUserSubmit);
    if (cancelUser) cancelUser.addEventListener('click', function () { common.hideModal('userModal'); });
    loadUsers();
  }

  window.AdminUsers = {
    init: init,
    loadUsers: loadUsers,
    getDefaultUsers: getDefaultUsers,
    normalizeUsers: normalizeUsers
  };
})();
