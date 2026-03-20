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
  const submitAddBtn = document.getElementById('submitAddTech');
  const submitEditBtn = document.getElementById('submitEditTech');
  const editBtn = document.getElementById('editTechBtn');
  const deleteBtn = document.getElementById('deleteTechBtn');
  const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
  const addIconBtn = document.getElementById('addIconBtn');

  const canOpenProposalPanel = canCreateProposals() || canReviewProposals();
  if (proposalBtn) {
    proposalBtn.style.display = canOpenProposalPanel ? 'flex' : 'none';
    proposalBtn.classList.toggle('hidden', !canOpenProposalPanel);
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

  details.push(renderSingleValueRow('Кто предлагает', proposal && proposal.created_by && proposal.created_by.username ? proposal.created_by.username : 'Неизвестно'));
  if (proposal && proposal.technologyId) {
    details.push(renderSingleValueRow('Целевая технология', currentTechnology && currentTechnology.name ? currentTechnology.name + ' (ID ' + proposal.technologyId + ')' : 'ID ' + proposal.technologyId));
  }

  if (action === 'create') {
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

function renderProposalList(containerId, proposals, withReviewActions) {
  const container = document.getElementById(containerId);
  if (!container) return;
  if (!Array.isArray(proposals) || proposals.length === 0) {
    container.innerHTML = '<div class="proposal-empty">Список пока пуст.</div>';
    return;
  }
  container.innerHTML = proposals.map((proposal) => {
    const status = String(proposal && proposal.status ? proposal.status : 'draft').trim().toLowerCase();
    const action = String(proposal && proposal.action ? proposal.action : '').trim().toLowerCase();
    const title = getTechnologyDisplayName(proposal);
    const proposer = proposal && proposal.created_by && proposal.created_by.username
      ? proposal.created_by.username
      : 'Неизвестно';
    const actionSummary = action === 'create'
      ? 'создание новой технологии'
      : action === 'delete'
        ? 'удаление технологии'
        : 'изменение существующей технологии';
    const comment = proposal && proposal.comment ? `<div class="proposal-card-comment"><strong>Комментарий:</strong> ${escapeHtml(proposal.comment)}</div>` : '';
    const reviewComment = proposal && proposal.reviewComment ? `<div class="proposal-card-comment"><strong>Ревью:</strong> ${escapeHtml(proposal.reviewComment)}</div>` : '';
    const actions = withReviewActions && status === 'draft'
      ? `<div class="proposal-card-actions">
          <button type="button" class="btn-primary" data-proposal-action="approve" data-proposal-id="${proposal.id}">Принять</button>
          <button type="button" class="btn-secondary" data-proposal-action="reject" data-proposal-id="${proposal.id}">Отклонить</button>
        </div>`
      : '';
    const detailsId = `proposal-details-${proposal.id}`;
    return `<div class="proposal-card">
      <div class="proposal-card-header">
        <div class="proposal-card-title">${escapeHtml(title)}</div>
        <div class="proposal-card-header-actions">
          <button type="button" class="proposal-detail-toggle" data-proposal-toggle="${proposal.id}" aria-expanded="false" aria-controls="${detailsId}" title="Показать подробности">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M12 16v-4"></path>
              <path d="M12 8h.01"></path>
            </svg>
          </button>
          <span class="proposal-status proposal-status-${escapeHtml(status)}">${escapeHtml(getStatusLabel(status))}</span>
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
    const [mine, pending] = await Promise.all(tasks);
    renderProposalList('proposalMineList', mine, false);
    renderProposalList('proposalPendingList', pending, canReviewProposals());
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

async function openPanel() {
  if (!canCreateProposals() && !canReviewProposals()) return;
  const panel = document.getElementById('proposalReviewPanel');
  if (!panel) return;
  if (typeof window.showModal === 'function') {
    window.showModal(panel);
  } else {
    panel.style.display = 'block';
    panel.classList.add('open');
  }
  switchTab(canReviewProposals() ? 'pending' : 'mine');
  await refreshPanel();
}

async function createProposal(action, options) {
  const dataService = getDataService();
  if (!dataService || typeof dataService.createTechnologyProposal !== 'function') {
    throw new Error('DataService недоступен для moderation flow');
  }
  const proposal = await dataService.createTechnologyProposal(action, options);
  if (window.Notifications && typeof window.Notifications.add === 'function') {
    const proposalTechName = proposal && (proposal.technologyName || (proposal.payload && proposal.payload.name))
      ? (proposal.technologyName || proposal.payload.name)
      : (options && options.tech && options.tech.name ? options.tech.name : 'Неизвестная технология');
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
    } else if (action === 'reject' && typeof dataService.rejectTechnologyProposal === 'function') {
      await dataService.rejectTechnologyProposal(proposalId, '');
      notify('Предложение отклонено', true);
    }
    await refreshPanel();
  } catch (error) {
    showPanelError(error && error.message ? error.message : 'Не удалось обработать предложение');
  }
}

function init() {
  syncUiState();

  const proposalBtn = document.getElementById('proposalIconBtn');
  if (proposalBtn && proposalBtn.dataset.moderationBound !== 'true') {
    proposalBtn.dataset.moderationBound = 'true';
    proposalBtn.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      openPanel();
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

const ModerationFlow = {
  init,
  syncUiState,
  openPanel,
  refreshPanel,
  canSubmitTechnologyChanges,
  canCreateProposals,
  canReviewProposals,
  isProposalOnlyMode,
  createProposal
};

if (typeof window !== 'undefined') {
  window.ModerationFlow = ModerationFlow;
}

export default ModerationFlow;
