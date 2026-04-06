function getRoleApi() {
  return typeof window !== 'undefined' ? (window.RoleCapabilities || window.RolesConfig || null) : null;
}

function getCurrentRole() {
  const roleApi = getRoleApi();
  if (roleApi && typeof roleApi.getCurrentRole === 'function') {
    return roleApi.getCurrentRole();
  }
  return 'guest';
}

function hasCapability(capability) {
  const roleApi = getRoleApi();
  return Boolean(roleApi && typeof roleApi.hasCapability === 'function' && roleApi.hasCapability(capability, getCurrentRole()));
}

function canCreateProposals() {
  return hasCapability('create_proposals');
}

function canReviewProposals() {
  return hasCapability('review_proposals');
}

function canSubmitTechnologyChanges() {
  const roleApi = getRoleApi();
  if (roleApi && typeof roleApi.canSubmitTechnologyChanges === 'function') {
    return roleApi.canSubmitTechnologyChanges(getCurrentRole());
  }
  return hasCapability('manage_technologies') || canCreateProposals();
}

function canManageTechnologies() {
  return hasCapability('manage_technologies');
}

let selectedProposalHistoryIds = new Set();
let activePanelView = 'pending';
let latestMineProposals = [];
let latestPendingProposals = [];
let latestHistoryProposals = [];
let latestProposalNotifications = [];
let historyFilterState = {
  search: '',
  status: 'all',
  action: 'all'
};

function isProposalOnlyMode() {
  const roleApi = getRoleApi();
  if (roleApi && typeof roleApi.isProposalOnlyRole === 'function') {
    return roleApi.isProposalOnlyRole(getCurrentRole());
  }
  return canCreateProposals() && !hasCapability('manage_technologies');
}

function getDataService() {
  return typeof window !== 'undefined' ? window.DataService || null : null;
}

function getStateAccessors() {
  return typeof window !== 'undefined' ? window.StateAccessors || null : null;
}

function notify(message, isSuccess) {
  if (window.DataLoader && typeof window.DataLoader.showNotification === 'function') {
    window.DataLoader.showNotification(message, isSuccess !== false);
    return;
  }
  if (window.Toast) {
    if (isSuccess === false && typeof window.Toast.error === 'function') {
      window.Toast.error(message);
      return;
    }
    if (typeof window.Toast.success === 'function') {
      window.Toast.success(message);
    }
  }
}

function setButtonText(button, text) {
  if (!button) return;
  const span = button.querySelector('span');
  if (span) {
    span.textContent = text;
  } else {
    button.textContent = text;
  }
}

function syncUiState() {
  const proposalBtn = document.getElementById('proposalIconBtn');
  const historyBtn = document.getElementById('proposalHistoryViewBtn');
  const legacyHistoryBtn = document.getElementById('proposalHistoryIconBtn');
  const submitAddBtn = document.getElementById('submitAddTech');
  const submitEditBtn = document.getElementById('submitEditTech');
  const editBtn = document.getElementById('editTechBtn');
  const deleteBtn = document.getElementById('deleteTechBtn');
  const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
  const addIconBtn = document.getElementById('addIconBtn');
  const chooseAddBlockBtn = document.getElementById('chooseAddBlock');

  const canOpenProposalPanel = canCreateProposals() || canReviewProposals();
  const showHistoryButton = canOpenProposalPanel && !isProposalOnlyMode();
  if (proposalBtn) {
    proposalBtn.style.display = canOpenProposalPanel ? 'flex' : 'none';
    proposalBtn.classList.toggle('hidden', !canOpenProposalPanel);
  }
  if (historyBtn) {
    historyBtn.classList.toggle('hidden', !showHistoryButton);
  }
  if (legacyHistoryBtn) {
    legacyHistoryBtn.style.display = 'none';
    legacyHistoryBtn.classList.add('hidden');
  }

  if (isProposalOnlyMode()) {
    if (addIconBtn) addIconBtn.setAttribute('data-tooltip', 'Предложить изменение');
    if (submitAddBtn) submitAddBtn.dataset.defaultText = 'Отправить на модерацию';
    setButtonText(submitAddBtn, 'Отправить на модерацию');
    if (submitEditBtn) submitEditBtn.dataset.defaultText = 'Отправить на модерацию';
    setButtonText(submitEditBtn, 'Отправить на модерацию');
    setButtonText(editBtn, 'Предложить изменение');
    setButtonText(deleteBtn, 'Предложить удаление');
    setButtonText(confirmDeleteBtn, 'Отправить на модерацию');
  } else {
    if (addIconBtn) addIconBtn.setAttribute('data-tooltip', 'Добавить');
    if (submitAddBtn) submitAddBtn.dataset.defaultText = 'Добавить технологию';
    setButtonText(submitAddBtn, 'Добавить технологию');
    if (submitEditBtn) submitEditBtn.dataset.defaultText = 'Сохранить';
    setButtonText(submitEditBtn, 'Сохранить');
    setButtonText(editBtn, 'Редактировать');
    setButtonText(deleteBtn, 'Удалить');
    setButtonText(confirmDeleteBtn, 'Да, удалить');
  }
  if (chooseAddBlockBtn) {
    const allowBlockManagement = canManageTechnologies() || isProposalOnlyMode();
    chooseAddBlockBtn.style.display = allowBlockManagement ? '' : 'none';
    chooseAddBlockBtn.classList.toggle('hidden', !allowBlockManagement);
  }
}

function getActionLabel(action) {
  const map = {
    create: 'Создание',
    update: 'Изменение',
    delete: 'Удаление'
  };
  return map[String(action || '').trim().toLowerCase()] || 'Изменение';
}

function getStatusLabel(status) {
  const map = {
    draft: 'Черновик',
    approved: 'Одобрено',
    rejected: 'Отклонено'
  };
  return map[String(status || '').trim().toLowerCase()] || 'Неизвестно';
}

function getProposalStatusLabel(status, listContext) {
  const normalized = String(status || '').trim().toLowerCase();
  if (normalized === 'draft') {
    return listContext === 'pending' ? 'В процессе' : 'Отправлено на модерацию';
  }
  if (normalized === 'postponed') {
    return 'Отложено';
  }
  if (normalized === 'approved') {
    return 'Одобрено';
  }
  if (normalized === 'rejected') {
    return 'Отклонено';
  }
  return 'Неизвестно';
}

function escapeHtml(value) {
  if (typeof window !== 'undefined' && typeof window.escapeHtml === 'function') {
    return window.escapeHtml(value);
  }
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getStateValue(key, fallbackValue) {
  if (window.StateManager && typeof window.StateManager.get === 'function') {
    const value = window.StateManager.get(key);
    return value == null ? fallbackValue : value;
  }
  return fallbackValue;
}

function getTechnologyById(technologyId) {
  const technologies = getStateValue('technologies', []);
  if (!Array.isArray(technologies)) return null;
  return technologies.find(function (item) {
    return String(item && item.id) === String(technologyId);
  }) || null;
}

function getBlockNameById(blockId) {
  const nameToBlockId = getStateValue('nameToBlockId', {});
  const entries = Object.entries(nameToBlockId || {});
  const found = entries.find(function (entry) {
    return String(entry[1]) === String(blockId);
  });
  return found ? found[0] : String(blockId);
}

function getDirectionNameById(directionId) {
  const list = getStateValue('digitalDirections', []);
  if (!Array.isArray(list)) return String(directionId);
  const item = list.find(function (row) {
    return row && String(row.id) === String(directionId);
  });
  return item && item.name ? item.name : String(directionId);
}

function getEnterpriseNameById(enterpriseId) {
  const list = getStateValue('enterprisesList', []);
  if (!Array.isArray(list)) return String(enterpriseId);
  const item = list.find(function (row) {
    return row && String(row.id) === String(enterpriseId);
  });
  return item && item.name ? item.name : String(enterpriseId);
}

function toArray(value) {
  return Array.isArray(value) ? value : value != null && value !== '' ? [value] : [];
}

function formatList(values) {
  return toArray(values).map(function (item) {
    return String(item || '').trim();
  }).filter(Boolean);
}

function formatBlockList(payload) {
  const blockIds = toArray(payload && payload.blocks).concat(payload && payload.block != null ? [payload.block] : []);
  const unique = Array.from(new Set(blockIds.map(function (item) { return String(item); })));
  return unique.map(function (item) { return getBlockNameById(item); });
}

function formatDirectionList(payload) {
  return Array.from(new Set(toArray(payload && payload.directions).map(function (item) {
    return getDirectionNameById(item);
  })));
}

function formatEnterpriseList(payload) {
  return toArray(payload && payload.enterprises).map(function (row) {
    if (!row || typeof row !== 'object') return '';
    const parts = [getEnterpriseNameById(row.enterpriseId)];
    if (row.technologicalReadiness != null) {
      parts.push('тех. ' + row.technologicalReadiness);
    }
    if (row.organizationalReadiness != null) {
      parts.push('орг. ' + row.organizationalReadiness);
    }
    if (row.status) {
      parts.push('статус ' + row.status);
    }
    return parts.join(', ');
  }).filter(Boolean);
}

function formatVendorList(payload) {
  return toArray(payload && payload.vendors).map(function (row) {
    if (!row) return '';
    if (typeof row === 'string') return row;
    const name = String(row.name || '').trim();
    const integrators = formatList(row.integrators);
    if (!integrators.length) return name;
    return name + ' (' + integrators.join(', ') + ')';
  }).filter(Boolean);
}

function formatCurrentEnterpriseList(technology) {
  return toArray(technology && technology.enterprises).map(function (row) {
    if (!row || typeof row !== 'object') return '';
    const name = row.name || getEnterpriseNameById(row.enterpriseId);
    const parts = [name];
    if (row.technologicalReadiness != null) {
      parts.push('тех. ' + row.technologicalReadiness);
    }
    if (row.organizationalReadiness != null) {
      parts.push('орг. ' + row.organizationalReadiness);
    }
    if (row.status) {
      parts.push('статус ' + row.status);
    }
    return parts.join(', ');
  }).filter(Boolean);
}

function getTechnologyDisplayName(proposal) {
  const payload = proposal && proposal.payload && typeof proposal.payload === 'object' ? proposal.payload : {};
  if (String(payload.referenceType || '').trim().toLowerCase() === 'functional_block') {
    const blockName = String(payload.blockName || '').trim();
    if (blockName) return blockName;
    const existingBlocks = Array.isArray(payload.existingBlocks) ? payload.existingBlocks.filter(Boolean) : [];
    if (existingBlocks.length > 0) return existingBlocks.join(', ');
    return 'Функциональный блок';
  }
  const payloadName = proposal && proposal.payload && proposal.payload.name ? String(proposal.payload.name).trim() : '';
  if (payloadName) return payloadName;
  const technology = getTechnologyById(proposal && proposal.technologyId);
  if (technology && technology.name) return technology.name;
  if (proposal && proposal.technologyId) return 'Технология #' + proposal.technologyId;
  return 'Без названия';
}

function renderDetailsRow(label, currentValue, nextValue) {
  const currentText = Array.isArray(currentValue) ? currentValue.join(', ') : String(currentValue || '').trim();
  const nextText = Array.isArray(nextValue) ? nextValue.join(', ') : String(nextValue || '').trim();
  if (!currentText && !nextText) return '';
  return `<div class="proposal-details-row">
    <div class="proposal-details-label">${escapeHtml(label)}</div>
    <div class="proposal-details-value">${currentText ? `<span class="proposal-details-before">${escapeHtml(currentText)}</span>` : '<span class="proposal-details-before">Не указано</span>'}</div>
    <div class="proposal-details-arrow">→</div>
    <div class="proposal-details-value">${nextText ? `<span class="proposal-details-after">${escapeHtml(nextText)}</span>` : '<span class="proposal-details-after">Не указано</span>'}</div>
  </div>`;
}

function renderSingleValueRow(label, value) {
  const text = Array.isArray(value) ? value.join(', ') : String(value || '').trim();
  if (!text) return '';
  return `<div class="proposal-details-single-row">
    <div class="proposal-details-label">${escapeHtml(label)}</div>
    <div class="proposal-details-single-value">${escapeHtml(text)}</div>
  </div>`;
}

function buildProposalDetailsHtml(proposal) {
  const action = String(proposal && proposal.action ? proposal.action : '').trim().toLowerCase();
  const payload = proposal && proposal.payload && typeof proposal.payload === 'object' ? proposal.payload : {};
  const currentTechnology = getTechnologyById(proposal && proposal.technologyId);
  const details = [];
  const isFunctionalBlockProposal = String(payload.referenceType || '').trim().toLowerCase() === 'functional_block';

  details.push(renderSingleValueRow('Кто предлагает', proposal && proposal.created_by && proposal.created_by.username ? proposal.created_by.username : 'Неизвестно'));
  if (proposal && proposal.technologyId) {
    details.push(renderSingleValueRow('Целевая технология', currentTechnology && currentTechnology.name ? currentTechnology.name + ' (ID ' + proposal.technologyId + ')' : 'ID ' + proposal.technologyId));
  }

  if (isFunctionalBlockProposal) {
    details.push(renderSingleValueRow('Тип предложения', 'Функциональный блок'));
    details.push(renderSingleValueRow('Операция', payload.operation === 'map_existing' ? 'Привязка существующих блоков' : 'Создание блока'));
    details.push(renderSingleValueRow('Название блока', payload.blockName));
    details.push(renderSingleValueRow('Существующие блоки', formatList(payload.existingBlocks)));
    details.push(renderSingleValueRow('Предприятия', formatEnterpriseList({ enterprises: toArray(payload.enterpriseIds).map(function (enterpriseId) { return { enterpriseId }; }) })));
    details.push(renderSingleValueRow('Направление', payload.directionName));
  } else if (action === 'create') {
    details.push(renderSingleValueRow('Предлагаемое название', payload.name));
    details.push(renderSingleValueRow('Описание', payload.description));
    details.push(renderSingleValueRow('TRL', payload.trlStage));
    details.push(renderSingleValueRow('Статус', payload.status));
    details.push(renderSingleValueRow('Функциональные блоки', formatBlockList(payload)));
    details.push(renderSingleValueRow('Направления', formatDirectionList(payload)));
    details.push(renderSingleValueRow('Покрытие функций', formatList(payload.functionCoverage)));
    details.push(renderSingleValueRow('Предприятия', formatEnterpriseList(payload)));
    details.push(renderSingleValueRow('Вендоры', formatVendorList(payload)));
    details.push(renderSingleValueRow('Примеры рынка', formatList(payload.marketExamples)));
    details.push(renderSingleValueRow('Файлы', formatList(payload.documentationFiles)));
  } else if (action === 'update') {
    details.push(renderDetailsRow('Название', currentTechnology && currentTechnology.name, payload.name));
    details.push(renderDetailsRow('Описание', currentTechnology && currentTechnology.description, payload.description));
    details.push(renderDetailsRow('TRL', currentTechnology && currentTechnology.trlStage, payload.trlStage));
    details.push(renderDetailsRow('Статус', currentTechnology && (currentTechnology.status || currentTechnology.level), payload.status));
    details.push(renderDetailsRow('Функциональные блоки', currentTechnology ? formatList(currentTechnology.blocks || currentTechnology.block) : [], formatBlockList(payload)));
    details.push(renderDetailsRow('Направления', currentTechnology ? formatList(toArray(currentTechnology.directions || currentTechnology.direction).map(function (item) {
      return typeof item === 'number' ? getDirectionNameById(item) : item;
    })) : [], formatDirectionList(payload)));
    details.push(renderDetailsRow('Покрытие функций', currentTechnology ? formatList(currentTechnology.functionCoverage || currentTechnology.functions || currentTechnology.func) : [], formatList(payload.functionCoverage)));
    details.push(renderDetailsRow('Предприятия', currentTechnology ? formatCurrentEnterpriseList(currentTechnology) : [], formatEnterpriseList(payload)));
    details.push(renderDetailsRow('Вендоры', currentTechnology ? formatVendorList({ vendors: currentTechnology.vendors }) : [], formatVendorList(payload)));
    details.push(renderDetailsRow('Примеры рынка', currentTechnology ? formatList(currentTechnology.marketExamples || currentTechnology.exampleDesc) : [], formatList(payload.marketExamples)));
    details.push(renderDetailsRow('Файлы', currentTechnology ? formatList(currentTechnology.documentationFiles || currentTechnology.files) : [], formatList(payload.documentationFiles)));
  } else if (action === 'delete') {
    details.push(renderSingleValueRow('Будет удалена', currentTechnology && currentTechnology.name ? currentTechnology.name : getTechnologyDisplayName(proposal)));
    details.push(renderSingleValueRow('Идентификатор', proposal && proposal.technologyId ? proposal.technologyId : 'Не указан'));
  }

  if (proposal && proposal.comment) {
    details.push(renderSingleValueRow('Комментарий автора', proposal.comment));
  }
  if (proposal && proposal.review_comment) {
    details.push(renderSingleValueRow('Комментарий ревью', proposal.review_comment));
  }

  return details.filter(Boolean).join('');
}

function renderProposalList(containerId, proposals, withReviewActions, listContext) {
  const container = document.getElementById(containerId);
  if (!container) return;
  if (!Array.isArray(proposals) || proposals.length === 0) {
    container.innerHTML = '<div class="proposal-empty">Список пока пуст.</div>';
    return;
  }
  const normalizedProposals = proposals.map(function (proposal) {
    if (!proposal || typeof proposal !== 'object') return proposal;
    return {
      ...proposal,
      reviewComment: proposal.reviewComment || proposal.review_comment || ''
    };
  });
  container.innerHTML = normalizedProposals.map((proposal) => {
    const status = String(proposal && proposal.status ? proposal.status : 'draft').trim().toLowerCase();
    const action = String(proposal && proposal.action ? proposal.action : '').trim().toLowerCase();
    const payload = proposal && proposal.payload && typeof proposal.payload === 'object' ? proposal.payload : {};
    const isFunctionalBlockProposal = String(payload.referenceType || '').trim().toLowerCase() === 'functional_block';
    const title = getTechnologyDisplayName(proposal);
    const proposer = proposal && proposal.created_by && proposal.created_by.username
      ? proposal.created_by.username
      : 'Неизвестно';
    const actionSummary = isFunctionalBlockProposal
      ? (payload.operation === 'map_existing' ? 'привязка блока к предприятиям' : 'создание функционального блока')
      : action === 'create'
      ? 'создание новой технологии'
      : action === 'delete'
        ? 'удаление технологии'
        : 'изменение существующей технологии';
    const comment = proposal && proposal.comment ? `<div class="proposal-card-comment"><strong>Комментарий:</strong> ${escapeHtml(proposal.comment)}</div>` : '';
    const reviewComment = proposal && proposal.reviewComment ? `<div class="proposal-card-comment"><strong>Ревью:</strong> ${escapeHtml(proposal.reviewComment)}</div>` : '';
    const actions = (withReviewActions && (status === 'draft' || status === 'postponed'))
      ? `<div class="proposal-card-actions">
          <button type="button" class="btn-primary" data-proposal-action="approve" data-proposal-id="${proposal.id}">Принять</button>
          <button type="button" class="btn-secondary" data-proposal-action="reject" data-proposal-id="${proposal.id}">Отклонить</button>
        </div>`
      : '';
    const allowReviewActions = withReviewActions && (status === 'draft' || status === 'postponed');
    const allowHistorySelection = containerId === 'proposalMineList' && (status === 'approved' || status === 'rejected' || status === 'postponed');
    const selectionControl = allowHistorySelection
      ? `<label class="proposal-select-control">
          <input type="checkbox" class="proposal-history-checkbox" data-proposal-history-id="${proposal.id}" ${selectedProposalHistoryIds.has(proposal.id) ? 'checked' : ''} />
          <span>Выбрать</span>
        </label>`
      : '';
    const detailsId = `proposal-details-${proposal.id}`;
    return `<div class="proposal-card">
      <div class="proposal-card-header">
        <div class="proposal-card-title">${escapeHtml(title)}</div>
        <div class="proposal-card-header-actions">
          ${selectionControl}
          <button type="button" class="proposal-detail-toggle" data-proposal-toggle="${proposal.id}" aria-expanded="false" aria-controls="${detailsId}" title="Показать подробности">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M12 16v-4"></path>
              <path d="M12 8h.01"></path>
            </svg>
          </button>
          <span class="proposal-status proposal-status-${escapeHtml(status)}">${escapeHtml(getProposalStatusLabel(status, listContext))}</span>
        </div>
      </div>
      <div class="proposal-card-summary">
        <div class="proposal-card-meta"><strong>Кто предлагает:</strong> ${escapeHtml(proposer)}</div>
        <div class="proposal-card-meta"><strong>Что предлагает:</strong> ${escapeHtml(actionSummary)}</div>
      </div>
      ${comment}
      ${reviewComment}
      <div id="${detailsId}" class="proposal-card-details hidden">${buildProposalDetailsHtml(proposal)}</div>
      ${actions}
    </div>`;
  }).join('');
  if (withReviewActions) {
    normalizedProposals.forEach(function (proposal) {
      const status = String(proposal && proposal.status ? proposal.status : '').trim().toLowerCase();
      if (status !== 'draft' && status !== 'postponed') {
        return;
      }
      const approveButton = container.querySelector(`[data-proposal-action="approve"][data-proposal-id="${proposal.id}"]`);
      if (!approveButton || !approveButton.parentElement) {
        return;
      }
      if (approveButton.parentElement.querySelector(`[data-proposal-action="postpone"][data-proposal-id="${proposal.id}"]`)) {
        return;
      }
      const postponeButton = document.createElement('button');
      postponeButton.type = 'button';
      postponeButton.className = 'btn-secondary';
      postponeButton.setAttribute('data-proposal-action', 'postpone');
      postponeButton.setAttribute('data-proposal-id', String(proposal.id));
      postponeButton.textContent = 'Отложить';
      approveButton.insertAdjacentElement('afterend', postponeButton);
    });
  }
}

function showPanelError(message) {
  const errorEl = document.getElementById('proposalPanelError');
  if (!errorEl) return;
  if (message) {
    errorEl.textContent = message;
    errorEl.classList.remove('hidden');
  } else {
    errorEl.textContent = '';
    errorEl.classList.add('hidden');
  }
}

function setProposalAttentionState(mine, pending) {
  const proposalBtn = document.getElementById('proposalIconBtn');
  if (!proposalBtn) return;
  const mineList = Array.isArray(mine) ? mine : [];
  const pendingList = Array.isArray(pending) ? pending : [];
  const mineDraftCount = mineList.filter(function (item) {
    const status = String(item && item.status ? item.status : '').trim().toLowerCase();
    return status === 'draft' || status === 'postponed';
  }).length;
  const attentionCount = canReviewProposals() ? pendingList.length : mineDraftCount;
  proposalBtn.classList.toggle('has-updates', attentionCount > 0);
  if (attentionCount > 0) {
    proposalBtn.setAttribute('data-proposal-count', attentionCount > 99 ? '99+' : String(attentionCount));
  } else {
    proposalBtn.removeAttribute('data-proposal-count');
  }
}

function resetProposalAttentionState() {
  setProposalAttentionState([], []);
}

function syncSelectedProposalHistory(proposals) {
  const availableIds = new Set(
    (Array.isArray(proposals) ? proposals : [])
      .filter(function (proposal) {
        const status = String(proposal && proposal.status ? proposal.status : '').trim().toLowerCase();
        return status === 'approved' || status === 'rejected' || status === 'postponed';
      })
      .map(function (proposal) { return proposal.id; })
  );
  selectedProposalHistoryIds = new Set(
    Array.from(selectedProposalHistoryIds).filter(function (proposalId) {
      return availableIds.has(proposalId);
    })
  );
  return availableIds;
}

function getHistorySource() {
  return canReviewProposals() && !isProposalOnlyMode() ? latestHistoryProposals : latestMineProposals;
}

function applyHistoryFilters(proposals) {
  const search = String(historyFilterState.search || '').trim().toLowerCase();
  const statusFilter = String(historyFilterState.status || 'all').trim().toLowerCase();
  const actionFilter = String(historyFilterState.action || 'all').trim().toLowerCase();
  return (Array.isArray(proposals) ? proposals : []).filter(function (proposal) {
    const title = getTechnologyDisplayName(proposal).toLowerCase();
    const author = proposal && proposal.created_by && proposal.created_by.username
      ? String(proposal.created_by.username).trim().toLowerCase()
      : '';
    const proposalStatus = String(proposal && proposal.status ? proposal.status : '').trim().toLowerCase();
    const proposalAction = String(proposal && proposal.action ? proposal.action : '').trim().toLowerCase();
    const matchesSearch = !search || title.includes(search) || author.includes(search);
    const matchesStatus = statusFilter === 'all' || proposalStatus === statusFilter;
    const matchesAction = actionFilter === 'all' || proposalAction === actionFilter;
    return matchesSearch && matchesStatus && matchesAction;
  });
}

function renderHistoryFilters() {
  const section = document.getElementById('proposalMineSection');
  if (!section || activePanelView !== 'history') return;
  let filters = document.getElementById('proposalHistoryFilters');
  if (!filters) {
    filters = document.createElement('div');
    filters.id = 'proposalHistoryFilters';
    filters.className = 'proposal-panel-actions proposal-history-filters';
    filters.innerHTML = `
      <input type="search" id="proposalHistorySearch" class="proposal-history-input" placeholder="Поиск по названию или автору" />
      <select id="proposalHistoryStatusFilter" class="proposal-history-select">
        <option value="all">Все статусы</option>
        <option value="approved">Одобрено</option>
        <option value="rejected">Отклонено</option>
        <option value="postponed">Отложено</option>
      </select>
      <select id="proposalHistoryActionFilter" class="proposal-history-select">
        <option value="all">Все действия</option>
        <option value="create">Создание</option>
        <option value="update">Изменение</option>
        <option value="delete">Удаление</option>
      </select>
    `;
    section.insertBefore(filters, section.firstChild);
  }
  const searchInput = document.getElementById('proposalHistorySearch');
  const statusSelect = document.getElementById('proposalHistoryStatusFilter');
  const actionSelect = document.getElementById('proposalHistoryActionFilter');
  if (searchInput) searchInput.value = historyFilterState.search;
  if (statusSelect) statusSelect.value = historyFilterState.status;
  if (actionSelect) actionSelect.value = historyFilterState.action;
}

function syncHistoryView() {
  renderHistoryFilters();
  renderProposalList('proposalMineList', applyHistoryFilters(getHistorySource()), false, 'history');
}

function renderMineHistoryActions(proposals) {
  const section = document.getElementById('proposalMineSection');
  if (!section) return;
  const filters = document.getElementById('proposalHistoryFilters');
  if (filters) {
    filters.classList.toggle('hidden', activePanelView !== 'history');
  }
  const availableIds = syncSelectedProposalHistory(proposals);

  let actions = document.getElementById('proposalMineActions');
  if (!actions) {
    actions = document.createElement('div');
    actions.id = 'proposalMineActions';
    actions.className = 'proposal-panel-actions';
    actions.innerHTML = `
      <label class="proposal-history-toggle hidden" id="proposalHistoryToggleWrap">
        <input type="checkbox" id="toggleAllProposalHistory" />
        <span>Выбрать все</span>
      </label>
      <button type="button" id="clearProposalHistoryBtn" class="btn-secondary proposal-clear-btn hidden">Очистить выбранное</button>
    `;
    section.insertBefore(actions, section.firstChild);
  }

  const clearBtn = document.getElementById('clearProposalHistoryBtn');
  const toggleAll = document.getElementById('toggleAllProposalHistory');
  const toggleWrap = document.getElementById('proposalHistoryToggleWrap');
  if (!clearBtn || !toggleAll || !toggleWrap) return;
  if (activePanelView === 'history' || canReviewProposals()) {
    actions.classList.add('hidden');
    actions.setAttribute('aria-hidden', 'true');
    clearBtn.classList.add('hidden');
    toggleWrap.classList.add('hidden');
    return;
  }
  if (clearBtn.dataset.moderationBound !== 'true') {
    clearBtn.dataset.moderationBound = 'true';
    clearBtn.addEventListener('click', function () {
      clearProposalHistory();
    });
  }
  if (toggleAll.dataset.moderationBound !== 'true') {
    toggleAll.dataset.moderationBound = 'true';
    toggleAll.addEventListener('change', function () {
      const currentIds = Array.from(document.querySelectorAll('.proposal-history-checkbox'))
        .map(function (input) { return Number(input.getAttribute('data-proposal-history-id')); })
        .filter(function (proposalId) { return Number.isInteger(proposalId) && proposalId > 0; });
      if (toggleAll.checked) {
        selectedProposalHistoryIds = new Set(currentIds);
      } else {
        selectedProposalHistoryIds = new Set();
      }
      renderMineHistoryActions(proposals);
      renderProposalList('proposalMineList', proposals, false, 'mine');
    });
  }
  const hasHistory = Array.isArray(proposals) && proposals.some(function (proposal) {
    const status = String(proposal && proposal.status ? proposal.status : '').trim().toLowerCase();
    return status === 'approved' || status === 'rejected' || status === 'postponed';
  });
  actions.classList.toggle('hidden', !hasHistory);
  actions.setAttribute('aria-hidden', hasHistory ? 'false' : 'true');
  clearBtn.classList.toggle('hidden', !hasHistory);
  toggleWrap.classList.toggle('hidden', !hasHistory);
  clearBtn.disabled = selectedProposalHistoryIds.size === 0;
  toggleAll.checked = hasHistory && selectedProposalHistoryIds.size > 0 && selectedProposalHistoryIds.size === availableIds.size;
  toggleAll.indeterminate = selectedProposalHistoryIds.size > 0 && selectedProposalHistoryIds.size < availableIds.size;
}

async function refreshPanel() {
  const dataService = getDataService();
  if (!dataService) return;
  showPanelError('');
  try {
    const tasks = [];
    if (canCreateProposals() && typeof dataService.loadMyTechnologyProposals === 'function') {
      tasks.push(dataService.loadMyTechnologyProposals());
    } else {
      tasks.push(Promise.resolve([]));
    }
    if (canReviewProposals() && typeof dataService.loadPendingTechnologyProposals === 'function') {
      tasks.push(dataService.loadPendingTechnologyProposals());
    } else {
      tasks.push(Promise.resolve([]));
    }
    const historyTask = activePanelView === 'history'
      ? (
          canReviewProposals() && !isProposalOnlyMode() && typeof dataService.loadTechnologyProposalHistory === 'function'
            ? dataService.loadTechnologyProposalHistory()
            : (typeof dataService.loadMyTechnologyProposalHistory === 'function'
                ? dataService.loadMyTechnologyProposalHistory()
                : Promise.resolve([]))
        )
      : Promise.resolve([]);
    const [mine, pending, history] = await Promise.all([...tasks, historyTask]);
    latestMineProposals = Array.isArray(mine) ? mine : [];
    latestPendingProposals = Array.isArray(pending) ? pending : [];
    latestHistoryProposals = Array.isArray(history) ? history : [];
    
    // Загружаем уведомления для редакторов
    if (canCreateProposals() && typeof dataService.loadProposalNotifications === 'function') {
      try {
        latestProposalNotifications = await dataService.loadProposalNotifications();
      } catch (error) {
        console.warn('Не удалось загрузить уведомления:', error);
        latestProposalNotifications = [];
      }
    }
    
    renderMineHistoryActions(latestMineProposals);
    if (activePanelView === 'history') {
      syncHistoryView();
    } else {
      renderProposalList('proposalMineList', latestMineProposals, false, 'mine');
    }
    renderProposalList('proposalPendingList', latestPendingProposals, canReviewProposals(), 'pending');
    setProposalAttentionState(latestMineProposals, latestPendingProposals);
    
    // Показываем уведомления редактору
    if (canCreateProposals()) {
      displayProposalNotifications(latestProposalNotifications);
    }
  } catch (error) {
    showPanelError(error && error.message ? error.message : 'Не удалось загрузить предложения');
  }
}

async function syncRadarStateFromApi() {
  const dataService = getDataService();
  const stateAccessors = getStateAccessors();
  if (!dataService || !stateAccessors) return;
  if (typeof dataService.loadTechnologies !== 'function' || typeof dataService.loadEnterpriseData !== 'function') return;

  const [technologies, enterpriseData] = await Promise.all([
    dataService.loadTechnologies(),
    dataService.loadEnterpriseData()
  ]);

  stateAccessors.setTechnologies(Array.isArray(technologies) ? technologies : []);
  stateAccessors.setEnterpriseData(enterpriseData && typeof enterpriseData === 'object' ? enterpriseData : {});
  stateAccessors.setSelectedBlipId(null);
  stateAccessors.setCurrentTech(null);

  const quadrantsCache = stateAccessors.getQuadrantsCache && stateAccessors.getQuadrantsCache();
  if (quadrantsCache && typeof quadrantsCache.clear === 'function') {
    quadrantsCache.clear();
  }
  if (typeof stateAccessors.getQuadrantsCacheVersion === 'function' && typeof stateAccessors.setQuadrantsCacheVersion === 'function') {
    stateAccessors.setQuadrantsCacheVersion((stateAccessors.getQuadrantsCacheVersion() || 0) + 1);
  }
  if (typeof window.rebuildTechnologiesIndex === 'function') {
    window.rebuildTechnologiesIndex();
  }
  if (typeof window.updateRadar === 'function') {
    window.updateRadar();
  }
}

function switchTab(tabId) {
  const mineTab = document.getElementById('proposalMineTab');
  const pendingTab = document.getElementById('proposalPendingTab');
  const mineSection = document.getElementById('proposalMineSection');
  const pendingSection = document.getElementById('proposalPendingSection');
  const showPending = tabId === 'pending' && canReviewProposals();

  if (mineTab) mineTab.classList.toggle('active', !showPending);
  if (pendingTab) pendingTab.classList.toggle('active', showPending);
  if (mineSection) mineSection.classList.toggle('hidden', showPending);
  if (pendingSection) pendingSection.classList.toggle('hidden', !showPending);
}

function updatePanelLayout(view) {
  const title = document.querySelector('#proposalReviewPanel .modal-header h2');
  const tabsWrap = document.querySelector('#proposalReviewPanel .modal-tabs');
  const mineTab = document.getElementById('proposalMineTab');
  const pendingTab = document.getElementById('proposalPendingTab');
  const historyBtn = document.getElementById('proposalHistoryViewBtn');
  const editorMode = isProposalOnlyMode();
  const historyMode = view === 'history';

  if (title) {
    title.textContent = historyMode ? 'История предложений' : 'Предложения изменений';
  }
  if (tabsWrap) {
    tabsWrap.classList.toggle('hidden', historyMode);
  }
  if (mineTab) {
    mineTab.classList.toggle('hidden', !editorMode);
  }
  if (pendingTab) {
    pendingTab.classList.toggle('hidden', !canReviewProposals() || historyMode);
  }
  if (historyBtn) {
    historyBtn.classList.toggle('hidden', editorMode);
    historyBtn.textContent = historyMode ? 'К предложениям' : 'История предложений';
  }
}

async function openPanel(view) {
  if (!canCreateProposals() && !canReviewProposals()) return;
  const panel = document.getElementById('proposalReviewPanel');
  if (!panel) return;
  activePanelView = view || (isProposalOnlyMode() ? 'mine' : 'pending');
  updatePanelLayout(activePanelView);
  const historyBtn = document.getElementById('proposalHistoryViewBtn');
  if (historyBtn) {
    const label = activePanelView === 'history' ? 'К предложениям' : 'История предложений';
    historyBtn.setAttribute('aria-label', label);
    historyBtn.setAttribute('title', label);
    historyBtn.innerHTML = `
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path d="M3 12a9 9 0 1 0 3-6.708" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        <path d="M3 3v6h6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        <path d="M12 7v5l3 3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      </svg>`;
  }
  if (historyBtn && activePanelView === 'history') {
    historyBtn.innerHTML = `
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        <path d="M21 12H9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      </svg>`;
  }
  if (typeof window.showModal === 'function') {
    window.showModal(panel);
  } else {
    panel.style.display = 'block';
    panel.classList.add('open');
  }
  switchTab(activePanelView === 'history' ? 'mine' : (activePanelView === 'mine' ? 'mine' : (canReviewProposals() ? 'pending' : 'mine')));
  await refreshPanel();
}

async function createProposal(action, options) {
  const dataService = getDataService();
  if (!dataService || typeof dataService.createTechnologyProposal !== 'function') {
    throw new Error('DataService недоступен для moderation flow');
  }
  const proposal = await dataService.createTechnologyProposal(action, options);
  if (window.Notifications && typeof window.Notifications.add === 'function') {
    const proposalTechName = proposal && (
      proposal.technologyName ||
      (proposal.payload && (proposal.payload.name || proposal.payload.blockName))
    )
      ? (proposal.technologyName || proposal.payload.name || proposal.payload.blockName)
      : (options && options.tech && options.tech.name
          ? options.tech.name
          : (options && options.payload && options.payload.blockName ? options.payload.blockName : 'Неизвестная технология'));
    window.Notifications.add(window.Notifications.TYPES.PROPOSAL, proposalTechName, proposal && proposal.technologyId, {
      proposalAction: action,
      proposalStatus: proposal && proposal.status ? proposal.status : 'draft'
    });
  }
  notify('Предложение отправлено на модерацию', true);
  const panel = document.getElementById('proposalReviewPanel');
  if (panel && panel.classList.contains('open')) {
    refreshPanel();
  }
  return proposal;
}

async function reviewProposal(proposalId, action) {
  const dataService = getDataService();
  if (!dataService) return;
  try {
    if (action === 'approve' && typeof dataService.approveTechnologyProposal === 'function') {
      await dataService.approveTechnologyProposal(proposalId, '');
      await syncRadarStateFromApi();
      notify('Предложение одобрено', true);
    } else if (action === 'postpone' && typeof dataService.postponeTechnologyProposal === 'function') {
      await dataService.postponeTechnologyProposal(proposalId, '');
      notify('Предложение отложено', true);
    } else if (action === 'reject' && typeof dataService.rejectTechnologyProposal === 'function') {
      await dataService.rejectTechnologyProposal(proposalId, '');
      notify('Предложение отклонено', true);
    }
    await refreshPanel();
  } catch (error) {
    showPanelError(error && error.message ? error.message : 'Не удалось обработать предложение');
  }
}

async function clearProposalHistory() {
  const dataService = getDataService();
  if (!dataService || typeof dataService.clearMyTechnologyProposalHistory !== 'function') return;
  try {
    await dataService.clearMyTechnologyProposalHistory(Array.from(selectedProposalHistoryIds));
    selectedProposalHistoryIds = new Set();
    notify('История предложений очищена', true);
    await refreshPanel();
  } catch (error) {
    showPanelError(error && error.message ? error.message : 'Не удалось очистить историю предложений');
  }
}

function init() {
  syncUiState();

  if (canCreateProposals() || canReviewProposals()) {
    refreshPanel();
  } else {
    resetProposalAttentionState();
  }

  if (typeof window !== 'undefined' && !window.__moderationAuthSyncBound) {
    window.__moderationAuthSyncBound = true;
    window.addEventListener('rmk-auth-changed', function () {
      syncUiState();
      if (canCreateProposals() || canReviewProposals()) {
        refreshPanel();
      } else {
        resetProposalAttentionState();
      }
    });
  }

  const proposalBtn = document.getElementById('proposalIconBtn');
  const historyBtn = document.getElementById('proposalHistoryViewBtn');
  if (proposalBtn && proposalBtn.dataset.moderationBound !== 'true') {
    proposalBtn.dataset.moderationBound = 'true';
    proposalBtn.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      openPanel(isProposalOnlyMode() ? 'mine' : 'pending');
    });
  }
  if (historyBtn && historyBtn.dataset.moderationBound !== 'true') {
    historyBtn.dataset.moderationBound = 'true';
    historyBtn.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      openPanel(activePanelView === 'history' ? 'pending' : 'history');
    });
  }

  const closeBtn = document.getElementById('closeProposalPanel');
  if (closeBtn && closeBtn.dataset.moderationBound !== 'true') {
    closeBtn.dataset.moderationBound = 'true';
    closeBtn.addEventListener('click', function () {
      if (typeof window.hideModal === 'function') {
        window.hideModal('proposalReviewPanel');
      }
    });
  }

  const mineTab = document.getElementById('proposalMineTab');
  if (mineTab && mineTab.dataset.moderationBound !== 'true') {
    mineTab.dataset.moderationBound = 'true';
    mineTab.addEventListener('click', function () {
      switchTab('mine');
    });
  }

  const clearHistoryBtn = document.getElementById('clearProposalHistoryBtn');
  if (clearHistoryBtn && clearHistoryBtn.dataset.moderationBound !== 'true') {
    clearHistoryBtn.dataset.moderationBound = 'true';
    clearHistoryBtn.addEventListener('click', function () {
      clearProposalHistory();
    });
  }

  const pendingTab = document.getElementById('proposalPendingTab');
  if (pendingTab) {
    pendingTab.classList.toggle('hidden', !canReviewProposals());
    if (pendingTab.dataset.moderationBound !== 'true') {
      pendingTab.dataset.moderationBound = 'true';
      pendingTab.addEventListener('click', function () {
        switchTab('pending');
      });
    }
  }

  document.addEventListener('change', function (event) {
    const target = event.target;
    if (target instanceof HTMLSelectElement && target.id === 'proposalHistoryStatusFilter') {
      historyFilterState.status = target.value || 'all';
      syncHistoryView();
      return;
    }
    if (target instanceof HTMLSelectElement && target.id === 'proposalHistoryActionFilter') {
      historyFilterState.action = target.value || 'all';
      syncHistoryView();
      return;
    }
    if (!(target instanceof HTMLInputElement) || !target.classList.contains('proposal-history-checkbox')) {
      return;
    }
    const proposalId = Number(target.getAttribute('data-proposal-history-id'));
    if (!Number.isInteger(proposalId) || proposalId <= 0) {
      return;
    }
    if (target.checked) {
      selectedProposalHistoryIds.add(proposalId);
    } else {
      selectedProposalHistoryIds.delete(proposalId);
    }
    const dataService = getDataService();
    if (dataService && typeof dataService.loadMyTechnologyProposals === 'function') {
      dataService.loadMyTechnologyProposals().then(function (mine) {
        renderMineHistoryActions(mine);
      }).catch(function () {});
    }
  });

  document.addEventListener('input', function (event) {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || target.id !== 'proposalHistorySearch') {
      return;
    }
    historyFilterState.search = target.value || '';
    syncHistoryView();
  });

  const panel = document.getElementById('proposalReviewPanel');
  if (panel && panel.dataset.moderationBound !== 'true') {
    panel.dataset.moderationBound = 'true';
    panel.addEventListener('click', function (event) {
      const toggleButton = event.target && event.target.closest ? event.target.closest('[data-proposal-toggle]') : null;
      if (toggleButton) {
        const proposalId = toggleButton.getAttribute('data-proposal-toggle');
        const details = proposalId ? document.getElementById('proposal-details-' + proposalId) : null;
        if (details) {
          const expanded = toggleButton.getAttribute('aria-expanded') === 'true';
          toggleButton.setAttribute('aria-expanded', expanded ? 'false' : 'true');
          details.classList.toggle('hidden', expanded);
        }
        return;
      }
      const actionButton = event.target && event.target.closest ? event.target.closest('[data-proposal-action]') : null;
      if (!actionButton) return;
      const proposalId = actionButton.getAttribute('data-proposal-id');
      const action = actionButton.getAttribute('data-proposal-action');
      if (!proposalId || !action) return;
      reviewProposal(proposalId, action);
    });
  }
}

function displayProposalNotifications(notifications) {
  if (!Array.isArray(notifications) || notifications.length === 0) {
    return;
  }
  
  // Получаем контейнер для уведомлений или создаем его
  let notificationContainer = document.getElementById('proposalNotificationContainer');
  if (!notificationContainer) {
    notificationContainer = document.createElement('div');
    notificationContainer.id = 'proposalNotificationContainer';
    notificationContainer.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      max-width: 400px;
      z-index: 10000;
      max-height: 80vh;
      overflow-y: auto;
    `;
    document.body.appendChild(notificationContainer);
  }
  
  // Очищаем старые уведомления
  const existingNotifications = notificationContainer.querySelectorAll('.proposal-notification-item');
  const existingIds = new Set(Array.from(existingNotifications).map(n => n.getAttribute('data-notification-id')));
  
  // Добавляем новые уведомления
  let hasNewNotifications = false;
  notifications.forEach(function (notification) {
    if (!notification || !notification.id) return;
    if (existingIds.has(String(notification.id))) return;
    
    hasNewNotifications = true;
    const notificationEl = document.createElement('div');
    notificationEl.className = 'proposal-notification-item';
    notificationEl.setAttribute('data-notification-id', notification.id);
    notificationEl.style.cssText = `
      background-color: white;
      border-left: 4px solid ${
        notification.notification_type === 'approved' ? '#4CAF50' :
        notification.notification_type === 'rejected' ? '#f44336' :
        notification.notification_type === 'postponed' ? '#ff9800' : '#2196F3'
      };
      padding: 16px;
      margin-bottom: 10px;
      border-radius: 4px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      font-size: 14px;
      line-height: 1.5;
    `;
    
    const titleEl = document.createElement('div');
    titleEl.style.cssText = 'font-weight: bold; margin-bottom: 8px; color: #333;';
    titleEl.textContent = notification.title || 'Уведомление';
    notificationEl.appendChild(titleEl);
    
    const messageEl = document.createElement('div');
    messageEl.style.cssText = 'color: #666; margin-bottom: 8px;';
    messageEl.textContent = notification.message || '';
    notificationEl.appendChild(messageEl);
    
    const closeBtn = document.createElement('button');
    closeBtn.style.cssText = `
      background: none;
      border: none;
      color: #999;
      cursor: pointer;
      font-size: 18px;
      padding: 0;
      position: absolute;
      top: 8px;
      right: 8px;
    `;
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', function (e) {
      e.preventDefault();
      notificationEl.style.opacity = '0';
      setTimeout(function () {
        notificationEl.style.display = 'none';
      }, 300);
      
      // Отмечаем как прочитанное на backend
      const dataService = getDataService();
      if (dataService && typeof dataService.markProposalNotificationAsRead === 'function') {
        dataService.markProposalNotificationAsRead(notification.id, true).catch(function (error) {
          console.warn('Не удалось отметить уведомление как прочитанное:', error);
        });
      }
    });
    notificationEl.appendChild(closeBtn);
    
    notificationEl.style.transition = 'opacity 0.3s ease';
    notificationContainer.appendChild(notificationEl);
  });
  
  // Показываем контейнер, если там есть уведомления
  if (hasNewNotifications) {
    notificationContainer.style.display = 'block';
  }
}

const ModerationFlow = {
  init,
  syncUiState,
  openPanel,
  refreshPanel,
  canSubmitTechnologyChanges,
  canManageTechnologies,
  canCreateProposals,
  canReviewProposals,
  isProposalOnlyMode,
  createProposal
};

if (typeof window !== 'undefined') {
  window.ModerationFlow = ModerationFlow;
}

export default ModerationFlow;
