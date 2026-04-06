/**
 * Раздел "Пользователи" админ-панели: backend-driven список, создание, редактирование и удаление.
 */
(function () {
  'use strict';

  var USERS_API_PATH = '/api/v1/admin-panel/users';
  var USER_FORM_TIMEOUT_MS = 30000;

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
      mustChangePassword: Boolean(user && user.must_change_password),
      isLocked: Boolean(user && user.is_locked),
      failedLoginAttempts: Number(user && user.failed_login_attempts) || 0,
      lockedAt: user && user.locked_at ? user.locked_at : '',
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

  async function createUserViaApi(payload) {
    var client = getApiClient();
    if (!client || typeof client.post !== 'function') {
      throw new Error('ApiClient недоступен для создания пользователя');
    }
    var response = await client.post(USERS_API_PATH, payload, { timeoutMs: USER_FORM_TIMEOUT_MS });
    if (!response || response.ok === false) {
      throw new Error((response && response.error) || 'Не удалось создать пользователя');
    }
    return mapApiUserToState(response.data || {});
  }

  async function updateUserViaApi(userId, payload) {
    var client = getApiClient();
    if (!client || typeof client.patch !== 'function') {
      throw new Error('ApiClient недоступен для обновления пользователя');
    }
    var response = await client.patch(USERS_API_PATH + '/' + userId, payload, {
      timeoutMs: USER_FORM_TIMEOUT_MS
    });
    if (!response || response.ok === false) {
      throw new Error((response && response.error) || 'Не удалось обновить пользователя');
    }
    return mapApiUserToState(response.data || {});
  }

  async function unlockUserViaApi(userId) {
    return updateUserViaApi(userId, { unlock_account: true });
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
        isLocked: Boolean(u.isLocked),
        failedLoginAttempts: Number(u.failedLoginAttempts) || 0,
        lockedAt: u.lockedAt || '',
        createdAt: u.createdAt || ''
      };
    });
  }

  async function refreshUsersFromApi() {
    var state = getState();
    state.users = await fetchUsersFromApi();
    loadUsers();
    if (window.AdminDashboard && typeof window.AdminDashboard.updateDashboardStats === 'function') {
      window.AdminDashboard.updateDashboardStats();
    }
    return state.users;
  }

  function getField(id) {
    return document.getElementById(id);
  }

  function setFieldValue(id, value) {
    var field = getField(id);
    if (field) {
      field.value = value == null ? '' : String(value);
    }
  }

  function setFieldText(id, value) {
    var field = getField(id);
    if (field) {
      field.textContent = value || '';
    }
  }

  function setFieldRequired(id, required) {
    var field = getField(id);
    if (!field) return;
    if (required) {
      field.setAttribute('required', 'required');
    } else {
      field.removeAttribute('required');
    }
  }

  function getSubmitButton() {
    var form = getField('userForm');
    return form ? form.querySelector('button[type="submit"]') : null;
  }

  function setSubmitButtonText(value) {
    var button = getSubmitButton();
    if (button) {
      button.textContent = value;
    }
  }

  function resetUserForm() {
    setFieldValue('userName', '');
    setFieldValue('userEmail', '');
    setFieldValue('userRole', 'guest');
    setFieldValue('userPassword', '');
    setPasswordFieldVisibility(false);
  }

  function setPasswordFieldVisibility(isVisible) {
    var passwordField = getField('userPassword');
    var toggleButton = getField('toggleUserPasswordBtn');
    if (!passwordField || !toggleButton) return;
    var shouldShow = isVisible === true;
    passwordField.setAttribute('type', shouldShow ? 'text' : 'password');
    toggleButton.classList.toggle('is-visible', shouldShow);
    toggleButton.setAttribute('aria-pressed', shouldShow ? 'true' : 'false');
    toggleButton.setAttribute('aria-label', shouldShow ? 'Скрыть пароль' : 'Показать пароль');
    toggleButton.setAttribute('data-tooltip', shouldShow ? 'Скрыть пароль' : 'Показать пароль');
  }

  function configureUserFormForCreate() {
    setFieldText('userModalTitle', 'Добавить пользователя');
    setFieldText('userPasswordLabel', 'Временный пароль');
    setFieldText(
      'userPasswordHelp',
      'При первом входе пользователь должен будет его сменить.'
    );
    setFieldRequired('userPassword', true);
    setSubmitButtonText('Создать');
  }

  function configureUserFormForEdit() {
    setFieldText('userModalTitle', 'Редактировать пользователя');
    setFieldText('userPasswordLabel', 'Новый временный пароль');
    setFieldText(
      'userPasswordHelp',
      'Оставьте поле пустым, если пароль менять не нужно. Если задать новый пароль, пользователь будет обязан сменить его при следующем входе.'
    );
    setFieldRequired('userPassword', false);
    setSubmitButtonText('Сохранить');
  }

  function getRandomValues(length) {
    var cryptoApi = typeof window !== 'undefined' ? (window.crypto || window.msCrypto || null) : null;
    if (cryptoApi && typeof cryptoApi.getRandomValues === 'function') {
      var typed = new Uint32Array(length);
      cryptoApi.getRandomValues(typed);
      return Array.prototype.slice.call(typed);
    }
    var fallback = [];
    for (var index = 0; index < length; index += 1) {
      fallback.push(Math.floor(Math.random() * 4294967296));
    }
    return fallback;
  }

  function pickRandomCharacter(charset, randomValue) {
    return charset.charAt(randomValue % charset.length);
  }

  function shuffleCharacters(characters) {
    var shuffled = characters.slice();
    var randomValues = getRandomValues(shuffled.length || 1);
    for (var index = shuffled.length - 1; index > 0; index -= 1) {
      var swapIndex = randomValues[index] % (index + 1);
      var temp = shuffled[index];
      shuffled[index] = shuffled[swapIndex];
      shuffled[swapIndex] = temp;
    }
    return shuffled;
  }

  function generateTemporaryPassword() {
    var uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    var lowercase = 'abcdefghijkmnopqrstuvwxyz';
    var digits = '23456789';
    var specials = '!@#$%^&*()-_+=~[]{}';
    var combined = uppercase + lowercase + digits + specials;
    var required = [
      pickRandomCharacter(uppercase, getRandomValues(1)[0]),
      pickRandomCharacter(lowercase, getRandomValues(1)[0]),
      pickRandomCharacter(digits, getRandomValues(1)[0]),
      pickRandomCharacter(specials, getRandomValues(1)[0])
    ];
    var passwordCharacters = required.slice();
    var targetLength = 12;
    var extraRandom = getRandomValues(targetLength - passwordCharacters.length);
    for (var extraIndex = 0; extraIndex < extraRandom.length; extraIndex += 1) {
      passwordCharacters.push(pickRandomCharacter(combined, extraRandom[extraIndex]));
    }
    return shuffleCharacters(passwordCharacters).join('');
  }

  function handleGeneratePassword() {
    var passwordField = getField('userPassword');
    var generatorButton = getField('generateUserPasswordBtn');
    if (!passwordField) return;
    passwordField.value = generateTemporaryPassword();
    passwordField.dispatchEvent(new Event('input', { bubbles: true }));
    passwordField.focus();
    passwordField.select();
    if (generatorButton) {
      generatorButton.classList.remove('is-rolling');
      void generatorButton.offsetWidth;
      generatorButton.classList.add('is-rolling');
      window.setTimeout(function () {
        generatorButton.classList.remove('is-rolling');
      }, 600);
    }
  }

  function toggleUserPasswordVisibility() {
    var passwordField = getField('userPassword');
    if (!passwordField) return;
    setPasswordFieldVisibility(passwordField.getAttribute('type') === 'password');
    passwordField.focus();
  }

  function loadUsers() {
    var state = getState();
    var common = getCommon();
    var tbody = getField('usersTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    var search = getField('userSearch') && getField('userSearch').value
      ? getField('userSearch').value.toLowerCase()
      : '';
    var roleFilter = getField('roleFilter') && getField('roleFilter').value
      ? getField('roleFilter').value
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
      var isLocked = user.isLocked === true;
      statusBadge.className =
        'status-badge ' +
        (isLocked ? 'status-inactive' : user.status === 'active' ? 'status-active' : 'status-inactive');
      statusBadge.textContent = isLocked
        ? 'Заблокирован'
        : user.status === 'active'
          ? 'Активен'
          : 'Неактивен';
      if (isLocked && user.failedLoginAttempts) {
        statusBadge.setAttribute(
          'data-tooltip',
          'Неудачных попыток входа: ' + user.failedLoginAttempts
        );
      }
      tdStatus.appendChild(statusBadge);
      row.appendChild(tdStatus);

      var tdActions = document.createElement('td');
      var actionsDiv = document.createElement('div');
      actionsDiv.className = 'action-buttons';

      var editBtn = document.createElement('button');
      editBtn.className = 'action-btn edit-btn';
      editBtn.setAttribute('type', 'button');
      editBtn.setAttribute('data-tooltip', 'Редактировать');
      editBtn.setAttribute('data-user-id', user.id);
      editBtn.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>';
      editBtn.addEventListener('click', function () {
        editUser(user.id);
      });
      actionsDiv.appendChild(editBtn);

      if (user.isLocked) {
        var unlockBtn = document.createElement('button');
        unlockBtn.className = 'action-btn edit-btn';
        unlockBtn.setAttribute('type', 'button');
        unlockBtn.setAttribute('data-tooltip', 'Разблокировать');
        unlockBtn.innerHTML =
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"></rect><path d="M7 11V7a5 5 0 0 1 9.9-1"></path></svg>';
        unlockBtn.addEventListener('click', function () {
          unlockUser(user.id);
        });
        actionsDiv.appendChild(unlockBtn);
      }

      var deleteBtn = document.createElement('button');
      deleteBtn.className = 'action-btn delete-btn';
      deleteBtn.setAttribute('type', 'button');
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

  function openCreateUserModal() {
    var state = getState();
    var common = getCommon();
    state.currentUserId = null;
    resetUserForm();
    configureUserFormForCreate();
    common.showModal('userModal');
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
    setFieldValue('userName', user.name);
    setFieldValue('userEmail', user.email);
    setFieldValue('userRole', user.role);
    setFieldValue('userPassword', '');
    configureUserFormForEdit();
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

  function unlockUser(userId) {
    var state = getState();
    var common = getCommon();
    var users = state.users || [];
    var user = users.filter(function (u) {
      return u.id === userId;
    })[0];
    if (!user) return;
    common.showConfirmModal(
      'Разблокировка пользователя',
      'Разблокировать пользователя "' + user.name + '"?',
      async function () {
        try {
          var updatedUser = await unlockUserViaApi(userId);
          var userIndex = users.findIndex(function (u) { return u.id === userId; });
          if (userIndex !== -1) users[userIndex] = updatedUser;
          loadUsers();
          addAuditLog('update', 'Разблокирован пользователь ' + updatedUser.name);
          common.showNotification('Успешно', 'Пользователь разблокирован', 'success');
        } catch (error) {
          common.showNotification(
            'Ошибка',
            error && error.message ? error.message : 'Не удалось разблокировать пользователя',
            'error',
            true
          );
        }
      }
    );
  }

  function buildUpdatePayload(currentUser, formData) {
    var payload = {};
    if (formData.name !== currentUser.name) {
      payload.username = formData.name;
    }
    if (formData.email !== currentUser.email) {
      payload.email = formData.email;
    }
    if (formData.role !== currentUser.role) {
      payload.role = formData.role;
    }
    if (formData.password) {
      payload.password = formData.password;
    }
    return payload;
  }

  async function handleUserSubmit(e) {
    e.preventDefault();
    var state = getState();
    var common = getCommon();
    var users = state.users || [];
    var formData = {
      name: (getField('userName').value || '').trim(),
      email: (getField('userEmail').value || '').trim(),
      role: getField('userRole').value,
      password: getField('userPassword').value || ''
    };

    if (!formData.name || !formData.role || !formData.email) {
      common.showNotification('Ошибка', 'Заполните все обязательные поля', 'error');
      return;
    }
    if (formData.email !== formData.email.trim() || /\s/.test(formData.email)) {
      common.showNotification('Ошибка', 'Email не должен содержать пробелы', 'error');
      return;
    }
    if (!state.currentUserId && !formData.password) {
      common.showNotification('Ошибка', 'Укажите временный пароль для нового пользователя', 'error');
      return;
    }
    if (formData.password && formData.password.length < 8) {
      common.showNotification('Ошибка', 'Пароль должен содержать не менее 8 символов', 'error');
      return;
    }
    if (
      formData.password &&
      !/^[A-Za-z0-9!@#$%^&*()\-_+=~[\]{}\\:;'\"<>,.?/]{8,20}$/.test(formData.password)
    ) {
      common.showNotification(
        'Ошибка',
        'Пароль должен быть длиной 8-20 символов и содержать только латинские буквы, цифры и допустимые спецсимволы',
        'error'
      );
      return;
    }
    if (
      formData.password &&
      (!/[A-Z]/.test(formData.password) ||
        !/[a-z]/.test(formData.password) ||
        !/\d/.test(formData.password))
    ) {
      common.showNotification(
        'Ошибка',
        'Пароль должен содержать заглавные и строчные латинские буквы и цифры',
        'error'
      );
      return;
    }

    if (state.currentUserId) {
      var userIndex = users.findIndex(function (u) {
        return u.id === state.currentUserId;
      });
      if (userIndex === -1) return;
      var currentUser = users[userIndex];
      var payload = buildUpdatePayload(currentUser, formData);
      if (!Object.keys(payload).length) {
        common.showNotification('Информация', 'Изменений для сохранения нет', 'info');
        state.currentUserId = null;
        resetUserForm();
        common.hideModal('userModal');
        return;
      }
      try {
        var updatedUser = await updateUserViaApi(state.currentUserId, payload);
        users[userIndex] = updatedUser;
        loadUsers();
        var changes = [];
        if (payload.username) changes.push('логин');
        if (Object.prototype.hasOwnProperty.call(payload, 'email')) changes.push('email');
        if (payload.role) changes.push('роль');
        if (payload.password) changes.push('временный пароль');
        addAuditLog(
          'update',
          'Обновлен пользователь ' +
            updatedUser.name +
            (changes.length ? ' (' + changes.join(', ') + ')' : '')
        );
        common.showNotification(
          'Успешно',
          payload.password
            ? 'Пользователь обновлен, временный пароль сброшен'
            : 'Данные пользователя обновлены',
          'success'
        );
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
      try {
        var createdUser = await createUserViaApi({
          username: formData.name,
          email: formData.email,
          password: formData.password,
          role: formData.role
        });
        users.push(createdUser);
        loadUsers();
        addAuditLog(
          'create',
          'Создан пользователь ' + createdUser.name + ' с ролью ' + createdUser.role
        );
        common.showNotification(
          'Успешно',
          'Пользователь создан. При первом входе потребуется смена пароля.',
          'success'
        );
      } catch (error) {
        common.showNotification(
          'Ошибка',
          error && error.message ? error.message : 'Не удалось создать пользователя',
          'error',
          true
        );
        return;
      }
    }

    state.currentUserId = null;
    resetUserForm();
    common.hideModal('userModal');
    loadUsers();
    if (window.AdminDashboard && typeof window.AdminDashboard.updateDashboardStats === 'function') {
      window.AdminDashboard.updateDashboardStats();
    }
  }

  function init() {
    var state = getState();
    var common = getCommon();
    var userSearch = getField('userSearch');
    var roleFilter = getField('roleFilter');
    var userForm = getField('userForm');
    var cancelUser = getField('cancelUser');
    var addUserBtn = getField('addUserBtn');
    var generateUserPasswordBtn = getField('generateUserPasswordBtn');
    var toggleUserPasswordBtn = getField('toggleUserPasswordBtn');

    if (userSearch) {
      userSearch.addEventListener('input', function () {
        filterUsers();
      });
    }
    if (roleFilter) {
      roleFilter.addEventListener('change', function () {
        filterUsers();
      });
    }
    if (userForm) {
      userForm.addEventListener('submit', handleUserSubmit);
    }
    if (addUserBtn) {
      addUserBtn.addEventListener('click', function () {
        openCreateUserModal();
      });
    }
    if (generateUserPasswordBtn) {
      generateUserPasswordBtn.addEventListener('click', handleGeneratePassword);
    }
    if (toggleUserPasswordBtn) {
      toggleUserPasswordBtn.addEventListener('click', toggleUserPasswordVisibility);
    }
    if (cancelUser) {
      cancelUser.addEventListener('click', function () {
        state.currentUserId = null;
        resetUserForm();
        common.hideModal('userModal');
      });
    }

    configureUserFormForCreate();
    loadUsers();
    if ((state.users || []).some(function (user) { return user.isLocked; })) {
      common.showNotification(
        'Внимание',
        'В системе есть заблокированные пользователи. Их можно разблокировать в этом разделе.',
        'info'
      );
    }
  }

  window.AdminUsers = {
    init: init,
    loadUsers: loadUsers,
    normalizeUsers: normalizeUsers,
    fetchUsersFromApi: fetchUsersFromApi,
    refreshUsersFromApi: refreshUsersFromApi,
    openCreateUserModal: openCreateUserModal
  };
})();
