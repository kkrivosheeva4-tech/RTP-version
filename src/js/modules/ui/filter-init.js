// filter-init.js — ES module
// Инициализация sidebar-фильтров и модальных селектов.

import StateManager from '../core/state-manager.js';

  function getFormFieldOptions() {
    if (typeof window !== 'undefined' && window.FormFieldOptions) {
      return window.FormFieldOptions;
    }
    return null;
  }

  function getTrlOptions() {
    var opts = getFormFieldOptions();
    return (opts && opts.TRL_OPTIONS) ? opts.TRL_OPTIONS : ['1-Исследовательская', '2-Прототип', '3-Технология готова к внедрению'];
  }

  function getRatingOptions() {
    var opts = getFormFieldOptions();
    return (opts && opts.RATING_OPTIONS) ? opts.RATING_OPTIONS : ['0 — Не готова', '1 — Низкая', '2 — Средняя', '3 — Высокая'];
  }

  function getStatusOptions() {
    var opts = getFormFieldOptions();
    return (opts && opts.STATUS_OPTIONS) ? opts.STATUS_OPTIONS : ['Внедренная', 'Невнедренная'];
  }

  function getTrlTooltips() {
    var opts = getFormFieldOptions();
    return (opts && opts.TRL_TOOLTIPS) ? opts.TRL_TOOLTIPS : {};
  }

  function getFuncCoverTooltips() {
    var opts = getFormFieldOptions();
    return (opts && opts.FUNC_COVER_TOOLTIPS) ? opts.FUNC_COVER_TOOLTIPS : {};
  }

  function getState(key) {
    return StateManager.get(key);
  }

  function getFilters() {
    if (window.Filters) return window.Filters;
    return null;
  }

  function addTrlTooltips(fieldId) {
    const tooltips = getTrlTooltips();
    const trlSelect = document.querySelector(`.custom-select-modal[data-field="${fieldId}"]`);
    if (trlSelect) {
      const options = trlSelect.querySelectorAll('.select-options li[data-value]');
      options.forEach(li => {
        const value = li.getAttribute('data-value');
        if (value && tooltips[value]) {
          li.setAttribute('title', tooltips[value]);
        }
      });
    }
  }

  function addRatingTooltips(fieldId, tooltipMap) {
    const ratingSelect = document.querySelector(`.custom-select-modal[data-field="${fieldId}"]`);
    if (ratingSelect) {
      const options = ratingSelect.querySelectorAll('.select-options li[data-value]');
      options.forEach(li => {
        const value = li.getAttribute('data-value');
        if (value && tooltipMap[value]) {
          li.setAttribute('title', tooltipMap[value]);
        }
      });
    }
  }

  /**
   * Инициализация sidebar-фильтров и модальных селектов с повтором при неготовности DOM.
   * @param {number} attempt
   */
  function initFiltersWithRetry(attempt = 0) {
    const maxAttempts = 5;
    const delay = 100 * (attempt + 1);

    setTimeout(() => {
      const Filters = getFilters();
      if (!Filters) {
        if (window.Logger) window.Logger.warn(`Попытка ${attempt + 1}: Filters не загружен`);
        if (attempt < maxAttempts - 1) {
          initFiltersWithRetry(attempt + 1);
        }
        return;
      }

      const blocksList = getState('blocksList') || [];
      const functions = getState('functions') || [];
      const QUADRANTS = window.QUADRANTS || [];

      let sectorNames = [];
      if (Array.isArray(QUADRANTS) && QUADRANTS.length) {
        sectorNames = QUADRANTS.map(q => q && q.name).filter(Boolean);
      }

      const enterpriseData = getState('enterpriseData') || {};
      const enterprisesListData = getState('enterprisesList') || [];
      const enterpriseList = enterprisesListData.length > 0
        ? enterprisesListData.map(ent => typeof ent === 'string' ? ent : (ent.name || ent)).filter(Boolean)
        : Object.keys(enterpriseData).filter(Boolean);

      const sidebarEnterpriseSelect = document.querySelector('.custom-select[data-filter="enterprise"]');
      const sidebarBlockSelect = document.querySelector('.custom-select[data-filter="block"]');
      const sidebarFunctionSelect = document.querySelector('.custom-select[data-filter="function"]');
      const sidebarLevelSelect = document.querySelector('.custom-select[data-filter="level"]');

      if (!sidebarEnterpriseSelect || !sidebarBlockSelect || !sidebarFunctionSelect || !sidebarLevelSelect) {
        if (window.Logger) window.Logger.warn(`Попытка ${attempt + 1}: не все элементы DOM найдены`, {
          enterprise: !!sidebarEnterpriseSelect,
          block: !!sidebarBlockSelect,
          function: !!sidebarFunctionSelect,
          level: !!sidebarLevelSelect
        });
        if (attempt < maxAttempts - 1) {
          initFiltersWithRetry(attempt + 1);
        }
        return;
      }

      if (enterpriseList.length > 0) {
        Filters.populateSelect('enterprise', enterpriseList, 'Предприятия: Все');
      }
      if (blocksList.length > 0) {
        Filters.populateSelect('block', blocksList, 'Функциональные блоки: Все');
      }
      if (functions.length > 0) {
        Filters.populateSelect('function', functions, 'Функции: Все');
      }
      const statusOptions = getStatusOptions();
      if (statusOptions.length > 0) {
        Filters.populateSelect('level', statusOptions, 'Статус: Все');
      }

      const modalEnterpriseList = enterprisesListData.length > 0
        ? enterprisesListData.map(ent => typeof ent === 'string' ? ent : (ent.name || ent))
        : Object.keys(enterpriseData || {});
      const vendorsList = getState('vendorsList') || [];

      const modalSelects = [
        { id: 'techBlock', items: blocksList, placeholder: 'Выберите' },
        { id: 'techFunc', items: functions, placeholder: 'Выберите' },
        { id: 'techCompany', items: modalEnterpriseList, placeholder: 'Выберите' },
        { id: 'techVendors', items: vendorsList, placeholder: 'Выберите' },
        { id: 'editBlock', items: blocksList, placeholder: 'Выберите' },
        { id: 'editFunc', items: functions, placeholder: 'Выберите' },
        { id: 'editCompany', items: modalEnterpriseList, placeholder: 'Выберите' },
        { id: 'editVendors', items: vendorsList, placeholder: 'Выберите' }
      ];

      modalSelects.forEach(({ id, items, placeholder }) => {
        if (Array.isArray(items) && items.length > 0) {
          Filters.populateSelectForModal(id, items, placeholder);
        }
      });

      Filters.populateSelectForModal('techTrlStage', getTrlOptions(), 'Выберите стадию');
      Filters.populateSelectForModal('editTrlStage', getTrlOptions(), 'Выберите стадию');
      Filters.populateSelectForModal('techFuncCover', getRatingOptions(), 'Выберите оценку');
      Filters.populateSelectForModal('editFuncCover', getRatingOptions(), 'Выберите оценку');

      setTimeout(() => {
        addTrlTooltips('techTrlStage');
        addTrlTooltips('editTrlStage');
        addRatingTooltips('techTechRead', getFormFieldOptions() ? getFormFieldOptions().TECH_READ_TOOLTIPS : {});
        addRatingTooltips('techOrganRead', getFormFieldOptions() ? getFormFieldOptions().ORGAN_READ_TOOLTIPS : {});
        addRatingTooltips('techFuncCover', getFuncCoverTooltips());
        addRatingTooltips('editTechRead', getFormFieldOptions() ? getFormFieldOptions().TECH_READ_TOOLTIPS : {});
        addRatingTooltips('editOrganRead', getFormFieldOptions() ? getFormFieldOptions().ORGAN_READ_TOOLTIPS : {});
        addRatingTooltips('editFuncCover', getFuncCoverTooltips());
      }, 50);
    }, delay);
  }

  /**
   * Инициализация модальных селектов направлениями (вызывается из data-loader при загрузке).
   */
  function initModalSelectsWithDirections(directionsList, blocksList, functions, enterpriseListForModal, vendorsList) {
    const Filters = getFilters();
    if (!Filters) return;

    if (directionsList.length > 0) {
      Filters.populateSelectForModal('techDirections', directionsList, 'Выберите');
      Filters.populateSelectForModal('editDirections', directionsList, 'Выберите');
    }
    Filters.populateSelectForModal('techBlock', blocksList, 'Выберите');
    Filters.populateSelectForModal('techFunc', functions, 'Выберите');
    Filters.populateSelectForModal('techCompany', enterpriseListForModal, 'Выберите');
    Filters.populateSelectForModal('techTrlStage', getTrlOptions(), 'Выберите стадию');
    Filters.populateSelectForModal('techTechRead', getRatingOptions(), 'Выберите оценку');
    Filters.populateSelectForModal('techOrganRead', getRatingOptions(), 'Выберите оценку');
    Filters.populateSelectForModal('techFuncCover', getRatingOptions(), 'Выберите оценку');
    Filters.populateSelectForModal('editBlock', blocksList, 'Выберите');
    Filters.populateSelectForModal('editFunc', functions, 'Выберите');
    Filters.populateSelectForModal('editCompany', enterpriseListForModal, 'Выберите');
    Filters.populateSelectForModal('editVendors', vendorsList, 'Выберите');
    Filters.populateSelectForModal('editTrlStage', getTrlOptions(), 'Выберите стадию');
    Filters.populateSelectForModal('editTechRead', getRatingOptions(), 'Выберите оценку');
    Filters.populateSelectForModal('editOrganRead', getRatingOptions(), 'Выберите оценку');
    Filters.populateSelectForModal('editFuncCover', getRatingOptions(), 'Выберите оценку');

    setTimeout(() => {
      addTrlTooltips('techTrlStage');
      addRatingTooltips('techTechRead', getFormFieldOptions() ? getFormFieldOptions().TECH_READ_TOOLTIPS : {});
      addRatingTooltips('techOrganRead', getFormFieldOptions() ? getFormFieldOptions().ORGAN_READ_TOOLTIPS : {});
      addRatingTooltips('techFuncCover', getFuncCoverTooltips());
      addTrlTooltips('editTrlStage');
      addRatingTooltips('editTechRead', getFormFieldOptions() ? getFormFieldOptions().TECH_READ_TOOLTIPS : {});
      addRatingTooltips('editOrganRead', getFormFieldOptions() ? getFormFieldOptions().ORGAN_READ_TOOLTIPS : {});
      addRatingTooltips('editFuncCover', getFuncCoverTooltips());
    }, 50);
  }

  /**
   * Ручная инициализация фильтров (для отладки и повторной инициализации).
   * @returns {boolean}
   */
  function initFilters() {
    const Filters = getFilters();
    if (!Filters) return false;

    const blocksList = getState('blocksList') || [];
    const functions = getState('functions') || [];
    const QUADRANTS = window.QUADRANTS || [];
    const digitalDirections = getState('digitalDirections') || [];

    let sectorNames = [];
    if (Array.isArray(QUADRANTS) && QUADRANTS.length) {
      sectorNames = QUADRANTS.map(q => q && q.name).filter(Boolean);
    }

    const directionsList = Array.isArray(digitalDirections) && digitalDirections.length > 0
      ? digitalDirections.map(d => (d && typeof d === 'object' && d.name) ? d.name : String(d || '')).filter(Boolean)
      : [];

    const enterpriseData = getState('enterpriseData') || {};
    const enterprisesListData = getState('enterprisesList') || [];
    const enterpriseList = enterprisesListData.length > 0
      ? enterprisesListData.map(ent => typeof ent === 'string' ? ent : (ent.name || ent)).filter(Boolean)
      : Object.keys(enterpriseData).filter(Boolean);

    if (enterpriseList.length > 0) {
      Filters.populateSelect('enterprise', enterpriseList, 'Предприятия: Все');
    }
    if (directionsList.length > 0) {
      Filters.populateSelect('direction', directionsList, 'Направления цифрового развития: Все');
    }
    if (blocksList.length > 0) {
      Filters.populateSelect('block', blocksList, 'Функциональные блоки: Все');
    }
    if (functions.length > 0) {
      Filters.populateSelect('function', functions, 'Функции: Все');
    }
    const statusOptions = getStatusOptions();
    if (statusOptions.length > 0) {
      Filters.populateSelect('level', statusOptions, 'Статус: Все');
    }

    const enterpriseListForInit = enterprisesListData.length > 0
      ? enterprisesListData.map(ent => typeof ent === 'string' ? ent : (ent.name || ent))
      : Object.keys(enterpriseData || {});
    const vendorsList = getState('vendorsList') || [];
    const integratorsList = getState('integratorsList') || [];

    const modalSelects = [
      { id: 'techSector', items: sectorNames, placeholder: 'Выберите' },
      { id: 'techDirections', items: directionsList, placeholder: 'Выберите' },
      { id: 'techBlock', items: blocksList, placeholder: 'Выберите' },
      { id: 'techFunc', items: functions, placeholder: 'Выберите' },
      { id: 'techCompany', items: enterpriseListForInit, placeholder: 'Выберите' },
      { id: 'techVendors', items: vendorsList, placeholder: 'Выберите' },
      { id: 'techIntegrators', items: integratorsList, placeholder: 'Выберите' },
      { id: 'techTrlStage', items: getTrlOptions(), placeholder: 'Выберите стадию' },
      { id: 'techTechRead', items: getRatingOptions(), placeholder: 'Выберите оценку' },
      { id: 'techOrganRead', items: getRatingOptions(), placeholder: 'Выберите оценку' },
      { id: 'techFuncCover', items: getRatingOptions(), placeholder: 'Выберите оценку' },
      { id: 'editDirections', items: directionsList, placeholder: 'Выберите' },
      { id: 'editBlock', items: blocksList, placeholder: 'Выберите' },
      { id: 'editFunc', items: functions, placeholder: 'Выберите' },
      { id: 'editCompany', items: enterpriseListForInit, placeholder: 'Выберите' },
      { id: 'editVendors', items: vendorsList, placeholder: 'Выберите' },
      { id: 'editIntegrators', items: integratorsList, placeholder: 'Выберите' },
      { id: 'editTrlStage', items: getTrlOptions(), placeholder: 'Выберите стадию' },
      { id: 'editTechRead', items: getRatingOptions(), placeholder: 'Выберите оценку' },
      { id: 'editOrganRead', items: getRatingOptions(), placeholder: 'Выберите оценку' },
      { id: 'editFuncCover', items: getRatingOptions(), placeholder: 'Выберите оценку' }
    ];

    modalSelects.forEach(({ id, items, placeholder }) => {
      if (Array.isArray(items) && items.length > 0) {
        Filters.populateSelectForModal(id, items, placeholder);
      }
    });

    return true;
  }

  const FilterInit = {
    initFiltersWithRetry,
    initModalSelectsWithDirections,
    initFilters,
    TRL_OPTIONS: getTrlOptions(),
    RATING_OPTIONS: getRatingOptions()
  };

  if (typeof window !== 'undefined') {
    window.FilterInit = FilterInit;
    window.initFiltersWithRetry = initFiltersWithRetry;
    window.initFilters = initFilters;
  }

  export default FilterInit;
  export { initFiltersWithRetry, initModalSelectsWithDirections, initFilters };
