/**
 * Раздел «Предприятия» админ-панели: загрузка из backend API, CRUD, таблица и модалка.
 */
(function () {
  'use strict';

  var ENTERPRISES_API_PATH = '/api/v1/admin-panel/enterprises';

  function getCommon() {
    return window.AdminCommon;
  }

  function getState() {
    return getCommon().AdminState;
  }

  function getApiClient() {
    return window.ApiClient || null;
  }

  function isApiMode() {
    var client = getApiClient();
    var cfg = window.ApiConfig;
    return !!(client && typeof client.get === 'function' && cfg && typeof cfg.getUseApi === 'function' && cfg.getUseApi());
  }

  function addAuditLog(action, details) {
    if (typeof window.addAdminAuditLog === 'function') {
      window.addAdminAuditLog(action, details);
    }
  }

  function mapApiEnterpriseToLocal(e) {
    return {
      id: e && e.id ? Number(e.id) : 0,
      name: (e && e.name != null ? String(e.name) : '').trim() || '',
      code: (e && e.code != null ? String(e.code) : '').trim() || '',
      description: (e && e.description != null ? String(e.description) : '').trim() || ''
    };
  }

  async function fetchEnterprisesFromApi() {
    var client = getApiClient();
    if (!client || typeof client.get !== 'function') {
      throw new Error('ApiClient недоступен для загрузки предприятий');
    }
    var response = await client.get(ENTERPRISES_API_PATH);
    if (!response || response.ok === false) {
      throw new Error((response && response.error) || 'Не удалось загрузить список предприятий');
    }
    var data = Array.isArray(response.data) ? response.data : [];
    return data.map(mapApiEnterpriseToLocal);
  }

  async function createEnterpriseViaApi(payload) {
    var client = getApiClient();
    if (!client || typeof client.post !== 'function') {
      throw new Error('ApiClient недоступен для создания предприятия');
    }
    var response = await client.post(ENTERPRISES_API_PATH, payload);
    if (!response || response.ok === false) {
      throw new Error((response && response.error) || 'Не удалось создать предприятие');
    }
    return mapApiEnterpriseToLocal(response.data || {});
  }

  async function updateEnterpriseViaApi(id, payload) {
    var client = getApiClient();
    if (!client || typeof client.patch !== 'function') {
      throw new Error('ApiClient недоступен для обновления предприятия');
    }
    var response = await client.patch(ENTERPRISES_API_PATH + '/' + id, payload);
    if (!response || response.ok === false) {
      throw new Error((response && response.error) || 'Не удалось обновить предприятие');
    }
    return mapApiEnterpriseToLocal(response.data || {});
  }

  async function deleteEnterpriseViaApi(id) {
    var client = getApiClient();
    if (!client || typeof client.delete !== 'function') {
      throw new Error('ApiClient недоступен для удаления предприятия');
    }
    var response = await client.delete(ENTERPRISES_API_PATH + '/' + id);
    if (!response || response.ok === false) {
      throw new Error((response && response.error) || 'Не удалось удалить предприятие');
    }
  }

  function normalizeEnterprises(list) {
    if (!Array.isArray(list)) return [];
    var nextId = 1;
    var used = {};
    return list
      .filter(Boolean)
      .map(function (e) {
        var id = Number(e.id);
        if (!Number.isFinite(id) || id <= 0 || used[id]) {
          while (used[nextId]) nextId += 1;
          id = nextId++;
        }
        used[id] = true;
        return {
          id: id,
          name: (e.name != null ? String(e.name) : '').trim() || ('enterprise-' + id),
          code: (e.code != null ? String(e.code) : '').trim() || '',
          description: (e.description != null ? String(e.description) : '').trim() || ''
        };
      });
  }

  function loadEnterprisesFromJson() {
    var state = getState();
    var common = getCommon();
    if (isApiMode()) {
      fetchEnterprisesFromApi()
        .then(function (list) {
          state.enterprises = list;
          if (state.currentSection === 'enterprises' && window.AdminEnterprises && typeof window.AdminEnterprises.loadEnterprises === 'function') {
            window.AdminEnterprises.loadEnterprises();
          }
        })
        .catch(function (e) {
          if (typeof window.reportError === 'function') {
            window.reportError(e, 'Загрузка списка предприятий');
          } else if (window.Logger) {
            window.Logger.warn('Failed to load enterprises', e);
          }
        });
      return;
    }
    // Mock-режим: используем DataService (JSON/VFS), не прямой fetch
    var ds = window.DataService;
    if (ds && typeof ds.loadReference === 'function') {
      ds.loadReference('enterprises')
        .then(function (data) {
          var list = Array.isArray(data) ? data : (data && data.length ? [] : []);
          if (list.length) {
            state.enterprises = normalizeEnterprises(list);
            common.persistEnterprises();
          }
          if (state.currentSection === 'enterprises' && window.AdminEnterprises && typeof window.AdminEnterprises.loadEnterprises === 'function') {
            window.AdminEnterprises.loadEnterprises();
          }
        })
        .catch(function (e) {
          if (typeof window.reportError === 'function') {
            window.reportError(e, 'Загрузка списка предприятий');
          } else if (window.Logger) {
            window.Logger.warn('Failed to load enterprises', e);
          }
        });
      return;
    }
    fetch('/src/data/ru/enterprises.json')
      .then(function (response) {
        if (!response.ok) return;
        return response.json();
      })
      .then(function (data) {
        if (Array.isArray(data) && data.length) {
          state.enterprises = normalizeEnterprises(data);
          common.persistEnterprises();
          if (state.currentSection === 'enterprises' && window.AdminEnterprises && typeof window.AdminEnterprises.loadEnterprises === 'function') {
            window.AdminEnterprises.loadEnterprises();
          }
        }
      })
      .catch(function (e) {
        if (typeof window.reportError === 'function') {
          window.reportError(e, 'Загрузка списка предприятий');
        } else if (window.Logger) {
          window.Logger.warn('Failed to load enterprises.json', e);
        }
      });
  }

  function loadEnterprises() {
    var state = getState();
    var common = getCommon();
    var tbody = document.getElementById('enterprisesTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    var search = (document.getElementById('enterpriseSearch') && document.getElementById('enterpriseSearch').value) ? document.getElementById('enterpriseSearch').value.toLowerCase() : '';
    var enterprises = state.enterprises || [];
    var filtered = enterprises.filter(function (enterprise) {
      return enterprise.name.toLowerCase().indexOf(search) !== -1 ||
        enterprise.code.toLowerCase().indexOf(search) !== -1 ||
        (enterprise.description || '').toLowerCase().indexOf(search) !== -1;
    });
    filtered.forEach(function (enterprise) {
      var row = document.createElement('tr');
      var tdId = document.createElement('td');
      tdId.textContent = enterprise.id;
      row.appendChild(tdId);
      var tdName = document.createElement('td');
      tdName.textContent = enterprise.name;
      row.appendChild(tdName);
      var tdCode = document.createElement('td');
      var codeBadge = document.createElement('span');
      codeBadge.className = 'status-badge status-active';
      codeBadge.textContent = enterprise.code;
      tdCode.appendChild(codeBadge);
      row.appendChild(tdCode);
      var tdDescription = document.createElement('td');
      tdDescription.textContent = enterprise.description || '—';
      row.appendChild(tdDescription);
      var tdActions = document.createElement('td');
      var actionsDiv = document.createElement('div');
      actionsDiv.className = 'action-buttons';
      var editBtn = document.createElement('button');
      editBtn.className = 'action-btn edit-btn';
      editBtn.setAttribute('data-tooltip', 'Редактировать');
      editBtn.setAttribute('data-enterprise-id', enterprise.id);
      editBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>';
      editBtn.addEventListener('click', function () { editEnterprise(enterprise.id); });
      actionsDiv.appendChild(editBtn);
      var deleteBtn = document.createElement('button');
      deleteBtn.className = 'action-btn delete-btn';
      deleteBtn.setAttribute('data-tooltip', 'Удалить');
      deleteBtn.setAttribute('data-enterprise-id', enterprise.id);
      deleteBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3,6 5,6 21,6"></polyline><path d="M19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>';
      deleteBtn.addEventListener('click', function () { deleteEnterprise(enterprise.id); });
      actionsDiv.appendChild(deleteBtn);
      tdActions.appendChild(actionsDiv);
      row.appendChild(tdActions);
      tbody.appendChild(row);
    });
  }

  function filterEnterprises() {
    loadEnterprises();
  }

  function openEnterpriseModal() {
    var state = getState();
    var common = getCommon();
    state.currentEnterpriseId = null;
    document.getElementById('enterpriseModalTitle').textContent = 'Добавить предприятие';
    document.getElementById('enterpriseForm').reset();
    document.getElementById('enterpriseName').removeAttribute('readonly');
    document.getElementById('enterpriseCode').removeAttribute('readonly');
    document.getElementById('enterpriseDescription').removeAttribute('readonly');
    common.showModal('enterpriseModal');
  }

  function editEnterprise(enterpriseId) {
    var state = getState();
    var common = getCommon();
    var enterprises = state.enterprises || [];
    var enterprise = enterprises.filter(function (e) { return e.id === enterpriseId; })[0];
    if (!enterprise) return;
    state.currentEnterpriseId = enterpriseId;
    document.getElementById('enterpriseModalTitle').textContent = 'Редактировать предприятие';
    document.getElementById('enterpriseName').value = enterprise.name;
    document.getElementById('enterpriseCode').value = enterprise.code;
    document.getElementById('enterpriseDescription').value = enterprise.description || '';
    common.showModal('enterpriseModal');
  }

  function deleteEnterprise(enterpriseId) {
    var state = getState();
    var common = getCommon();
    var enterprises = state.enterprises || [];
    var enterprise = enterprises.filter(function (e) { return e.id === enterpriseId; })[0];
    if (!enterprise) return;
    common.showConfirmModal(
      'Удаление предприятия',
      'Вы уверены, что хотите удалить предприятие "' + enterprise.name + '"?',
      function () {
        if (isApiMode()) {
          deleteEnterpriseViaApi(enterpriseId)
            .then(function () {
              state.enterprises = enterprises.filter(function (e) { return e.id !== enterpriseId; });
              loadEnterprises();
              addAuditLog('delete', 'Удалено предприятие "' + enterprise.name + '" (' + enterprise.code + ')');
              common.showNotification('Успешно', 'Предприятие удалено', 'success');
            })
            .catch(function (err) {
              common.showNotification('Ошибка', (err && err.message) || 'Не удалось удалить предприятие', 'error', true);
            });
          return;
        }
        state.enterprises = enterprises.filter(function (e) { return e.id !== enterpriseId; });
        common.persistEnterprises();
        loadEnterprises();
        addAuditLog('delete', 'Удалено предприятие "' + enterprise.name + '" (' + enterprise.code + ')');
        common.showNotification('Успешно', 'Предприятие удалено', 'success');
      }
    );
  }

  function handleEnterpriseSubmit(e) {
    e.preventDefault();
    var state = getState();
    var common = getCommon();
    var enterprises = state.enterprises || [];
    var formData = {
      name: document.getElementById('enterpriseName').value.trim(),
      code: document.getElementById('enterpriseCode').value.trim(),
      description: document.getElementById('enterpriseDescription').value.trim()
    };
    if (!formData.name || !formData.code) {
      common.showNotification('Ошибка', 'Заполните все обязательные поля', 'error');
      return;
    }
    if (state.currentEnterpriseId) {
      if (isApiMode()) {
        updateEnterpriseViaApi(state.currentEnterpriseId, formData)
          .then(function (updated) {
            var idx = enterprises.findIndex(function (x) { return x.id === state.currentEnterpriseId; });
            if (idx !== -1) enterprises[idx] = updated;
            loadEnterprises();
            addAuditLog('update', 'Изменено предприятие: ' + formData.name);
            common.showNotification('Успешно', 'Предприятие обновлено', 'success');
            common.hideModal('enterpriseModal');
          })
          .catch(function (err) {
            common.showNotification('Ошибка', (err && err.message) || 'Не удалось обновить предприятие', 'error', true);
          });
        return;
      }
      var idx = -1;
      for (var i = 0; i < enterprises.length; i++) {
        if (enterprises[i].id === state.currentEnterpriseId) { idx = i; break; }
      }
      if (idx !== -1) {
        var oldData = { name: enterprises[idx].name };
        enterprises[idx].name = formData.name;
        enterprises[idx].code = formData.code;
        enterprises[idx].description = formData.description;
        common.persistEnterprises();
        loadEnterprises();
        addAuditLog('update', 'Изменено предприятие: ' + oldData.name + ' → ' + formData.name);
        common.showNotification('Успешно', 'Предприятие обновлено', 'success');
      }
    } else {
      var existingWithCode = enterprises.filter(function (e) {
        return e.code.toLowerCase() === formData.code.toLowerCase();
      })[0];
      if (existingWithCode && !isApiMode()) {
        common.showNotification('Ошибка', 'Предприятие с кодом "' + formData.code + '" уже существует', 'error');
        return;
      }
      if (isApiMode()) {
        createEnterpriseViaApi(formData)
          .then(function (newEnterprise) {
            state.enterprises.push(newEnterprise);
            loadEnterprises();
            addAuditLog('create', 'Создано новое предприятие: ' + formData.name + ' (' + formData.code + ')');
            common.showNotification('Успешно', 'Предприятие создано', 'success');
            common.hideModal('enterpriseModal');
          })
          .catch(function (err) {
            common.showNotification('Ошибка', (err && err.message) || 'Не удалось создать предприятие', 'error', true);
          });
        return;
      }
      var maxId = 0;
      enterprises.forEach(function (e) {
        var id = Number(e && e.id) || 0;
        if (id > maxId) maxId = id;
      });
      var newEnterprise = {
        id: maxId + 1,
        name: formData.name,
        code: formData.code,
        description: formData.description
      };
      state.enterprises.push(newEnterprise);
      common.persistEnterprises();
      loadEnterprises();
      addAuditLog('create', 'Создано новое предприятие: ' + formData.name + ' (' + formData.code + ')');
      common.showNotification('Успешно', 'Предприятие создано', 'success');
    }
    common.hideModal('enterpriseModal');
  }

  function init() {
    var common = getCommon();
    var enterpriseSearch = document.getElementById('enterpriseSearch');
    var addEnterpriseBtn = document.getElementById('addEnterpriseBtn');
    if (enterpriseSearch) enterpriseSearch.addEventListener('input', function () { filterEnterprises(); });
    if (addEnterpriseBtn) addEnterpriseBtn.addEventListener('click', openEnterpriseModal);
    var enterpriseForm = document.getElementById('enterpriseForm');
    var cancelEnterprise = document.getElementById('cancelEnterprise');
    if (enterpriseForm) enterpriseForm.addEventListener('submit', handleEnterpriseSubmit);
    if (cancelEnterprise) cancelEnterprise.addEventListener('click', function () { common.hideModal('enterpriseModal'); });
    loadEnterprises();
  }

  window.AdminEnterprises = {
    init: init,
    loadEnterprises: loadEnterprises,
    loadEnterprisesFromJson: loadEnterprisesFromJson,
    normalizeEnterprises: normalizeEnterprises,
    fetchEnterprisesFromApi: fetchEnterprisesFromApi,
    isApiMode: isApiMode
  };
})();
