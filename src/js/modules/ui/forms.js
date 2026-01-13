// forms.js
// Модуль работы с формами добавления/редактирования технологий

// Экспорт функций в window для использования в RMK2.js и других модулях
window.FormsModule = (function() {
  'use strict';

  // ===== ФУНКЦИИ ДЛЯ УПРАВЛЕНИЯ СОСТОЯНИЕМ ФОРМ =====

  /**
   * Проверяет, были ли изменены поля формы по сравнению с начальным состоянием
   * @param {HTMLFormElement} formEl - элемент формы
   * @returns {boolean} - true, если форма была изменена
   */
  function isFormDirty(formEl) {
    if (!formEl) return false;
    const initial = formEl.dataset.initial ? JSON.parse(formEl.dataset.initial) : {};
    const data = {};
    Array.from(formEl.elements).forEach(el => {
      const key = el.name || el.id;
      if (!key) return;
      if (el.type === 'checkbox' || el.type === 'radio') data[key] = el.checked;
      else data[key] = el.value;
    });
    return JSON.stringify(initial) !== JSON.stringify(data);
  }

  /**
   * Сохраняет snapshot начального состояния формы
   * @param {HTMLFormElement} formEl - элемент формы
   */
  function snapshotFormInitial(formEl) {
    if (!formEl) return;
    const data = {};
    Array.from(formEl.elements).forEach(el => {
      const key = el.name || el.id;
      if (!key) return;
      if (el.type === 'checkbox' || el.type === 'radio') data[key] = el.checked;
      else data[key] = el.value;
    });
    formEl.dataset.initial = JSON.stringify(data);
  }

  // ===== ФУНКЦИИ ДЛЯ УПРАВЛЕНИЯ ВИДИМОСТЬЮ ПОЛЕЙ ОЦЕНОК =====

  /**
   * Создает динамические поля оценок для каждого предприятия
   * @param {string[]} companies - массив названий предприятий
   * @param {string} containerId - ID контейнера для полей
   * @param {string} prefix - префикс для ID полей ('tech' или 'edit')
   */
  function createCompanyRatingsFields(companies, containerId, prefix) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Очищаем контейнер
    container.innerHTML = '';

    if (companies.length === 0) {
      container.style.display = 'none';
      return;
    }

    if (companies.length === 1) {
      container.style.display = 'none';
      return;
    }

    // Создаем поля для каждого предприятия
    companies.forEach(company => {
      const companyGroup = document.createElement('div');
      companyGroup.className = 'company-ratings-group';

      const companyLabel = document.createElement('div');
      companyLabel.className = 'company-ratings-label';
      companyLabel.textContent = company;
      companyGroup.appendChild(companyLabel);

      const ratingsRow = document.createElement('div');
      ratingsRow.className = 'ratings-row';
      ratingsRow.style.display = 'flex';
      ratingsRow.style.flexDirection = 'row';
      ratingsRow.style.gap = '12px';

      // Технологическая готовность - выпадающий список
      const techReadDiv = document.createElement('div');
      techReadDiv.style.flex = '1';
      techReadDiv.style.display = 'flex';
      techReadDiv.style.flexDirection = 'column';
      techReadDiv.style.gap = '6px';
      const techReadLabel = document.createElement('span');
      techReadLabel.textContent = 'Технологическая готовность';
      techReadLabel.style.display = 'block';
      techReadLabel.style.marginBottom = '4px';
      techReadLabel.style.fontSize = '13px';
      techReadLabel.style.fontWeight = '500';
      const techReadFieldId = `${prefix}TechRead_${company}`;
      const techReadSelect = document.createElement('div');
      techReadSelect.className = 'custom-select-modal';
      techReadSelect.setAttribute('data-field', techReadFieldId);
      techReadSelect.setAttribute('tabindex', '0');
      const techReadSelectTrigger = document.createElement('div');
      techReadSelectTrigger.className = 'select-trigger';
      const techReadSelectText = document.createElement('span');
      techReadSelectText.className = 'selected-text';
      techReadSelectText.textContent = 'Выберите оценку';
      const techReadSelectArrow = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      techReadSelectArrow.setAttribute('class', 'arrow');
      techReadSelectArrow.setAttribute('width', '12');
      techReadSelectArrow.setAttribute('height', '12');
      techReadSelectArrow.setAttribute('viewBox', '0 0 12 12');
      techReadSelectArrow.setAttribute('fill', 'none');
      const techReadSelectArrowPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      techReadSelectArrowPath.setAttribute('d', 'M3 5L6 8L9 5');
      techReadSelectArrowPath.setAttribute('stroke', '#666');
      techReadSelectArrowPath.setAttribute('stroke-width', '1.5');
      techReadSelectArrowPath.setAttribute('stroke-linecap', 'round');
      techReadSelectArrowPath.setAttribute('stroke-linejoin', 'round');
      techReadSelectArrow.appendChild(techReadSelectArrowPath);
      techReadSelectTrigger.appendChild(techReadSelectText);
      techReadSelectTrigger.appendChild(techReadSelectArrow);
      const techReadSelectOptions = document.createElement('ul');
      techReadSelectOptions.className = 'select-options';
      techReadSelect.appendChild(techReadSelectTrigger);
      techReadSelect.appendChild(techReadSelectOptions);
      const techReadHiddenInput = document.createElement('input');
      techReadHiddenInput.type = 'hidden';
      techReadHiddenInput.id = techReadFieldId;
      techReadHiddenInput.name = techReadFieldId;
      techReadDiv.appendChild(techReadLabel);
      techReadDiv.appendChild(techReadSelect);
      techReadDiv.appendChild(techReadHiddenInput);
      ratingsRow.appendChild(techReadDiv);

      // Организационная готовность - выпадающий список
      const organReadDiv = document.createElement('div');
      organReadDiv.style.flex = '1';
      organReadDiv.style.display = 'flex';
      organReadDiv.style.flexDirection = 'column';
      organReadDiv.style.gap = '6px';
      const organReadLabel = document.createElement('span');
      organReadLabel.textContent = 'Организационная готовность';
      organReadLabel.style.display = 'block';
      organReadLabel.style.marginBottom = '4px';
      organReadLabel.style.fontSize = '13px';
      organReadLabel.style.fontWeight = '500';
      const organReadFieldId = `${prefix}OrganRead_${company}`;
      const organReadSelect = document.createElement('div');
      organReadSelect.className = 'custom-select-modal';
      organReadSelect.setAttribute('data-field', organReadFieldId);
      organReadSelect.setAttribute('tabindex', '0');
      const organReadSelectTrigger = document.createElement('div');
      organReadSelectTrigger.className = 'select-trigger';
      const organReadSelectText = document.createElement('span');
      organReadSelectText.className = 'selected-text';
      organReadSelectText.textContent = 'Выберите оценку';
      const organReadSelectArrow = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      organReadSelectArrow.setAttribute('class', 'arrow');
      organReadSelectArrow.setAttribute('width', '12');
      organReadSelectArrow.setAttribute('height', '12');
      organReadSelectArrow.setAttribute('viewBox', '0 0 12 12');
      organReadSelectArrow.setAttribute('fill', 'none');
      const organReadSelectArrowPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      organReadSelectArrowPath.setAttribute('d', 'M3 5L6 8L9 5');
      organReadSelectArrowPath.setAttribute('stroke', '#666');
      organReadSelectArrowPath.setAttribute('stroke-width', '1.5');
      organReadSelectArrowPath.setAttribute('stroke-linecap', 'round');
      organReadSelectArrowPath.setAttribute('stroke-linejoin', 'round');
      organReadSelectArrow.appendChild(organReadSelectArrowPath);
      organReadSelectTrigger.appendChild(organReadSelectText);
      organReadSelectTrigger.appendChild(organReadSelectArrow);
      const organReadSelectOptions = document.createElement('ul');
      organReadSelectOptions.className = 'select-options';
      organReadSelect.appendChild(organReadSelectTrigger);
      organReadSelect.appendChild(organReadSelectOptions);
      const organReadHiddenInput = document.createElement('input');
      organReadHiddenInput.type = 'hidden';
      organReadHiddenInput.id = organReadFieldId;
      organReadHiddenInput.name = organReadFieldId;
      organReadDiv.appendChild(organReadLabel);
      organReadDiv.appendChild(organReadSelect);
      organReadDiv.appendChild(organReadHiddenInput);
      ratingsRow.appendChild(organReadDiv);

      companyGroup.appendChild(ratingsRow);
      container.appendChild(companyGroup);
    });

    container.style.display = 'block';

    // Инициализируем выпадающие списки и добавляем tooltips после создания всех элементов
    if (window.Filters && typeof window.Filters.populateSelectForModal === 'function') {
      const ratingOptions = ['0 — Не готова', '1 — Низкая', '2 — Средняя', '3 — Высокая'];
      const techReadTooltips = {
        '0 — Не готова': 'Технология находится на начальной стадии, не применима',
        '1 — Низкая': 'Начальная стадия разработки, требуется значительная доработка',
        '2 — Средняя': 'Технология частично готова, требуется доработка',
        '3 — Высокая': 'Технология готова к применению'
      };
      const organReadTooltips = {
        '0 — Не готова': 'Организация не готова к внедрению',
        '1 — Низкая': 'Начальный этап подготовки, требуется значительная работа',
        '2 — Средняя': 'Частичная готовность, требуется дополнительная подготовка',
        '3 — Высокая': 'Организация полностью готова к внедрению'
      };

      // Инициализируем выпадающие списки для каждого предприятия
      companies.forEach(company => {
        const techReadFieldId = `${prefix}TechRead_${company}`;
        const organReadFieldId = `${prefix}OrganRead_${company}`;

        window.Filters.populateSelectForModal(techReadFieldId, ratingOptions, 'Выберите оценку');
        window.Filters.populateSelectForModal(organReadFieldId, ratingOptions, 'Выберите оценку');

        // Добавляем tooltips после небольшой задержки, чтобы элементы были созданы
        setTimeout(() => {
          const addRatingTooltips = (fieldId, tooltipMap) => {
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
          };
          addRatingTooltips(techReadFieldId, techReadTooltips);
          addRatingTooltips(organReadFieldId, organReadTooltips);
        }, 50);
      });
    }
  }

  /**
   * Обновляет видимость полей оценок в форме добавления технологии
   * в зависимости от количества выбранных предприятий
   */
  function updateTechRatingsVisibility() {
    const techCompanyInput = document.getElementById('techCompany');
    if (!techCompanyInput) return;

    let selectedCompanies = [];
    try {
      const value = techCompanyInput.value || '';
      if (value.trim().startsWith('[')) {
        selectedCompanies = JSON.parse(value);
      } else if (value) {
        selectedCompanies = [value];
      }
    } catch (e) {
      // Если не удалось распарсить, считаем что ничего не выбрано
      selectedCompanies = [];
    }

    const techTechReadGroup = document.getElementById('techTechReadGroup');
    const techOrganReadGroup = document.getElementById('techOrganReadGroup');
    const techRatingsWarning = document.getElementById('techRatingsWarning');
    const techCompanyRatingsContainer = document.getElementById('techCompanyRatingsContainer');

    if (selectedCompanies.length === 1) {
      // Одно предприятие - показываем обычные поля, скрываем динамические
      if (techTechReadGroup) techTechReadGroup.style.display = '';
      if (techOrganReadGroup) techOrganReadGroup.style.display = '';
      if (techRatingsWarning) techRatingsWarning.style.display = 'none';
      if (techCompanyRatingsContainer) techCompanyRatingsContainer.style.display = 'none';
    } else if (selectedCompanies.length > 1) {
      // Несколько предприятий - скрываем обычные поля, показываем динамические
      if (techTechReadGroup) techTechReadGroup.style.display = 'none';
      if (techOrganReadGroup) techOrganReadGroup.style.display = 'none';
      if (techRatingsWarning) techRatingsWarning.style.display = 'none';
      // Создаем динамические поля для каждого предприятия
      createCompanyRatingsFields(selectedCompanies, 'techCompanyRatingsContainer', 'tech');
      // Очищаем значения обычных полей (выпадающие списки)
      if (typeof window.setCustomSelectValue === 'function') {
        window.setCustomSelectValue('techTechRead', '');
        window.setCustomSelectValue('techOrganRead', '');
      }
    } else {
      // Нет выбранных предприятий - показываем поля (по умолчанию будет установлено текущее предприятие)
      if (techTechReadGroup) techTechReadGroup.style.display = '';
      if (techOrganReadGroup) techOrganReadGroup.style.display = '';
      if (techRatingsWarning) techRatingsWarning.style.display = 'none';
      if (techCompanyRatingsContainer) techCompanyRatingsContainer.style.display = 'none';
    }
  }

  /**
   * Обновляет видимость полей оценок в форме редактирования технологии
   * в зависимости от количества предприятий у технологии
   * @param {Object} tech - объект технологии (опционально, если не передан, берется из формы)
   */
  function updateEditTechRatingsVisibility(tech) {
    let companies = [];

    if (tech) {
      companies = Array.isArray(tech.company) ? tech.company : (tech.company ? [tech.company] : []);
    } else {
      // Если tech не передан, получаем предприятия из формы
      const editCompanyInput = document.getElementById('editCompany');
      if (editCompanyInput) {
        try {
          const value = editCompanyInput.value || '';
          if (value.trim().startsWith('[')) {
            companies = JSON.parse(value);
          } else if (value) {
            companies = [value];
          }
        } catch (e) {
          if (editCompanyInput.value) companies = [editCompanyInput.value];
        }
      }
    }
    const editTechReadGroup = document.getElementById('editTechReadGroup');
    const editOrganReadGroup = document.getElementById('editOrganReadGroup');
    const editCompanyRatingsContainer = document.getElementById('editCompanyRatingsContainer');

    if (companies.length === 1) {
      // Одно предприятие - показываем обычные поля, скрываем динамические
      if (editTechReadGroup) editTechReadGroup.style.display = '';
      if (editOrganReadGroup) editOrganReadGroup.style.display = '';
      if (editCompanyRatingsContainer) editCompanyRatingsContainer.style.display = 'none';
    } else if (companies.length > 1) {
      // Несколько предприятий - скрываем обычные поля, показываем динамические
      if (editTechReadGroup) editTechReadGroup.style.display = 'none';
      if (editOrganReadGroup) editOrganReadGroup.style.display = 'none';
      // Создаем динамические поля и заполняем их значениями из companyRatings
      createCompanyRatingsFields(companies, 'editCompanyRatingsContainer', 'edit');
      // Заполняем значения из companyRatings или общих полей в выпадающие списки
      const ratingOptions = {
        0: '0 — Не готова',
        1: '1 — Низкая',
        2: '2 — Средняя',
        3: '3 — Высокая'
      };
      // Если tech не передан, пытаемся получить технологию по ID из формы
      if (!tech) {
        const editIdInput = document.getElementById('editId');
        if (editIdInput && editIdInput.value) {
          const techId = parseInt(editIdInput.value, 10);
          if (!isNaN(techId) && typeof window.getTechnologies === 'function') {
            const technologies = window.getTechnologies();
            tech = technologies.find(t => t.id === techId);
          }
        }
      }
      if (typeof window.setCustomSelectValue === 'function' && tech) {
        if (tech.companyRatings && typeof tech.companyRatings === 'object') {
          companies.forEach(company => {
            const ratings = tech.companyRatings[company];
            if (ratings) {
              const techReadFieldId = `editTechRead_${company}`;
              const organReadFieldId = `editOrganRead_${company}`;
              if (ratings.techRead !== undefined && ratings.techRead !== null) {
                const techValue = ratingOptions[ratings.techRead];
                window.setCustomSelectValue(techReadFieldId, techValue || '');
              } else {
                window.setCustomSelectValue(techReadFieldId, '');
              }
              if (ratings.organRead !== undefined && ratings.organRead !== null) {
                const organValue = ratingOptions[ratings.organRead];
                window.setCustomSelectValue(organReadFieldId, organValue || '');
              } else {
                window.setCustomSelectValue(organReadFieldId, '');
              }
            } else {
              // Используем общие значения
              const techReadFieldId = `editTechRead_${company}`;
              const organReadFieldId = `editOrganRead_${company}`;
              if (tech.techRead !== undefined && tech.techRead !== null) {
                const techValue = ratingOptions[tech.techRead];
                window.setCustomSelectValue(techReadFieldId, techValue || '');
              } else {
                window.setCustomSelectValue(techReadFieldId, '');
              }
              if (tech.organRead !== undefined && tech.organRead !== null) {
                const organValue = ratingOptions[tech.organRead];
                window.setCustomSelectValue(organReadFieldId, organValue || '');
              } else {
                window.setCustomSelectValue(organReadFieldId, '');
              }
            }
          });
        } else {
          // Нет companyRatings - используем общие значения для всех
          companies.forEach(company => {
            const techReadFieldId = `editTechRead_${company}`;
            const organReadFieldId = `editOrganRead_${company}`;
            if (tech.techRead !== undefined && tech.techRead !== null) {
              const techValue = ratingOptions[tech.techRead];
              window.setCustomSelectValue(techReadFieldId, techValue || '');
            } else {
              window.setCustomSelectValue(techReadFieldId, '');
            }
            if (tech.organRead !== undefined && tech.organRead !== null) {
              const organValue = ratingOptions[tech.organRead];
              window.setCustomSelectValue(organReadFieldId, organValue || '');
            } else {
              window.setCustomSelectValue(organReadFieldId, '');
            }
          });
        }
      }
    } else {
      // Нет предприятий - показываем обычные поля
      if (editTechReadGroup) editTechReadGroup.style.display = '';
      if (editOrganReadGroup) editOrganReadGroup.style.display = '';
      if (editCompanyRatingsContainer) editCompanyRatingsContainer.style.display = 'none';
    }
  }

  // Экспорт функций
  return {
    isFormDirty,
    snapshotFormInitial,
    createCompanyRatingsFields,
    updateTechRatingsVisibility,
    updateEditTechRatingsVisibility
  };
})();

// Экспорт функций в глобальную область для обратной совместимости
window.isFormDirty = window.FormsModule.isFormDirty;
window.snapshotFormInitial = window.FormsModule.snapshotFormInitial;
window.createCompanyRatingsFields = window.FormsModule.createCompanyRatingsFields;
window.updateTechRatingsVisibility = window.FormsModule.updateTechRatingsVisibility;
window.updateEditTechRatingsVisibility = window.FormsModule.updateEditTechRatingsVisibility;
