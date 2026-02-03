// Модуль работы с детальной панелью
// Экспортирует функции в window для использования в RMK2.js
// Использует глобальные переменные из RMK2.js и функции из других модулей

(function () {
  'use strict';

  /**
   * Получить пояснение для TRL-стадии
   */
  function getTrlStageDescription(trlStage) {
    const trlValue = parseInt(trlStage);
    switch (trlValue) {
      case 1:
        return 'Исследовательская стадия';
      case 2:
        return 'Технология на стадии разработки';
      case 3:
        return 'Технология готова к внедрению';
      default:
        return 'Не указано';
    }
  }

  /**
   * Получить пояснение для покрытия функций
   */
  function getFuncCoverDescription(funcCover) {
    const coverValue = parseInt(funcCover);
    switch (coverValue) {
      case 0:
        return 'Не покрывает необходимые функции';
      case 1:
        return 'Низкое покрытие функций блока (до 33%)';
      case 2:
        return 'Среднее покрытие функций блока (33-67%)';
      case 3:
        return 'Высокое покрытие функций блока (67-100%)';
      default:
        return 'Не указано';
    }
  }

  /**
   * Получить пояснение для технологической готовности
   */
  function getTechReadDescription(techRead) {
    const readValue = parseInt(techRead);
    switch (readValue) {
      case 0:
        return 'Технология не готова к использованию';
      case 1:
        return 'Начальная технологическая готовность';
      case 2:
        return 'Готова к пилотному внедрению';
      case 3:
        return 'Готова к промышленному использованию';
      default:
        return 'Не указано';
    }
  }

  /**
   * Получить пояснение для организационной готовности
   */
  function getOrganReadDescription(organRead) {
    const readValue = parseInt(organRead);
    switch (readValue) {
      case 0:
        return 'Организация не готова к внедрению';
      case 1:
        return 'Начальная организационная готовность';
      case 2:
        return 'Организация готова к пилотированию';
      case 3:
        return 'Организация полностью готова';
      default:
        return 'Не указано';
    }
  }

  /**
   * Создать HTML для отображения оценки с пояснением
   */
  function createRatingDisplayHTML(value, description, maxValue = 3) {
    if (value === undefined || value === null || value === '' || value === '—') {
      return `
        <div class="rating-display-content">
          <span class="rating-display-value">—</span>
          <span class="rating-display-description">Не указано</span>
        </div>
        <span class="rating-display-max">/${maxValue}</span>
      `;
    }
    return `
      <div class="rating-display-content">
        <span class="rating-display-value">${value}</span>
        <span class="rating-display-description">— ${description}</span>
      </div>
      <span class="rating-display-max">/${maxValue}</span>
    `;
  }

  // Получаем зависимости из других модулей и глобальных переменных (ленивая загрузка)
  const getDOMElement = (id) => {
    if (window.DOMCache) {
      let element = window.DOMCache.get(id);
      // Если элемент не найден в кэше, попробуем обновить кэш
      if (!element) {
        element = window.DOMCache.refresh(id);
      }
      // Если все еще не найден, попробуем напрямую
      if (!element) {
        element = document.getElementById(id);
        // Если нашли напрямую, обновим кэш
        if (element && window.DOMCache.refresh) {
          window.DOMCache.refresh(id);
        }
      }
      return element;
    }
    return document.getElementById(id);
  };

  const getStateManager = () => {
    return window.StateManager || null;
  };

  const getCurrentEnterprise = () => {
    const sm = getStateManager();
    return sm ? sm.get('currentEnterprise') : (window.currentEnterprise || null);
  };

  const getCurrentZoomedQuadrant = () => {
    const sm = getStateManager();
    return sm ? sm.get('currentZoomedQuadrant') : (window.currentZoomedQuadrant || null);
  };

  const setCurrentZoomedQuadrant = (value) => {
    const sm = getStateManager();
    if (sm) {
      sm.set('currentZoomedQuadrant', value);
    }
    if (window.currentZoomedQuadrant !== undefined) {
      window.currentZoomedQuadrant = value;
    }
  };

  const setSelectedBlipId = (value) => {
    const sm = getStateManager();
    if (sm) {
      sm.set('selectedBlipId', value);
    }
  };

  const setCurrentTech = (tech) => {
    const fn = window.setCurrentTech;
    if (fn) fn(tech);
  };

  const getTechnologies = () => {
    const sm = getStateManager();
    if (sm) {
      return sm.get('technologies') || [];
    }
    return [];
  };

  const getTechById = (id) => {
    const sm = getStateManager();
    if (sm) {
      const technologiesById = sm.get('technologiesById');
      if (technologiesById && technologiesById instanceof Map) {
        return technologiesById.get(id) || null;
      }
    }
    return null;
  };

  const getQuadrantIdForBlock = (block) => {
    const fn = window.Positioning?.getQuadrantIdForBlock;
    return fn ? fn(block) : null;
  };

  const isRatingFilled = (rating) => {
    if (rating === undefined || rating === null) return false;
    const str = String(rating).trim();
    return str !== '' && str !== 'null' && str !== 'undefined';
  };

  const computePriority = (...args) => {
    const fn = window.Priorities?.computePriority;
    return fn ? fn(...args) : null;
  };

  const getPriorityCategory = (...args) => {
    const fn = window.Priorities?.getPriorityCategory;
    return fn ? fn(...args) : { key: 'none', label: 'Не определен', description: 'Недостаточно данных' };
  };

  const getPriorityWeakLinkComment = (...args) => {
    const fn = window.Priorities?.getPriorityWeakLinkComment;
    return fn ? fn(...args) : '';
  };

  const closeQuadrantPriorityPanel = () => {
    const fn = window.Priorities?.closeQuadrantPriorityPanel;
    if (fn) fn();
  };

  const showNotification = (message, isSuccess = false) => {
    const fn = window.showNotification;
    if (fn) {
      fn(message, isSuccess);
    } else {
      if (window.Logger) window.Logger.warn('showNotification not available');
    }
  };

  const createTechListForSector = (...args) => {
    const fn = window.Sidebar?.createTechListForSector;
    if (fn) fn(...args);
  };

  const zoomQuadrant = (...args) => {
    const fn = window.zoomQuadrant;
    if (fn) fn(...args);
  };

  const getAllQuadrantsForTech = (...args) => {
    const fn = window.getAllQuadrantsForTech;
    return fn ? fn(...args) : [];
  };

  /**
   * Показ панели подробной информации для заданной технологии
   * @param {Object} t - объект технологии
   * @param {string} source - источник открытия: 'priority', 'blip', 'unknown'
   * @param {number|null} sourceQuadrant - опциональный квадрант, в котором был клик
   */
  function showDetail(t, source = 'unknown', sourceQuadrant = null) {
    if (!t) {
      // showDetail: технология не передана
      return;
    }

    const detailPanel = getDOMElement('detailPanel');

    const svg = getDOMElement('techRadar');
    const quadrantPriorityPanel = getDOMElement('quadrantPriorityPanel');
    const currentZoomedQuadrant = getCurrentZoomedQuadrant();

    // Если был совершен клик по blip на радаре при открытом модальном окне списка технологий,
    // то модальное окно списка технологий скрывается, чтобы панель детальной информации не открывалась под ним
    // Также убеждаемся, что z-index панели выше, чем у модального окна списка технологий
    if (source === 'blip' &&
      quadrantPriorityPanel &&
      quadrantPriorityPanel.classList.contains('open')) {
      closeQuadrantPriorityPanel();
    }

    // Убеждаемся, что z-index панели выше, чем у модального окна списка технологий (10004)
    if (detailPanel) {
      detailPanel.style.setProperty('z-index', '10005', 'important');
    }

    setCurrentTech(t);
    setSelectedBlipId(t.id);

    // Логируем просмотр технологии
    if (typeof window.appendAdminAudit === 'function' && source === 'blip') {
      window.appendAdminAudit('update', `Просмотр технологии: "${t.name}" (ID: ${t.id})`);
    }

    // Снять выделение со всех других blip
    if (svg) {
      svg.querySelectorAll('.blip.selected').forEach(el => el.classList.remove('selected'));

      // Всегда выделяем ВСЕ blip'ы этой технологии (подсветка и пульсация на всех экземплярах)
      // Квадрант используется только для зума, но подсветка должна быть везде
      svg.querySelectorAll(`.blip[data-id="${t.id}"]`).forEach(blipEl => {
        blipEl.classList.add('selected');
      });
    }

    if (detailPanel) {
      detailPanel.querySelector('#panelTitle').textContent = t.name || 'Без названия';

      // Теги блоков
      const blockWrap = detailPanel.querySelector('#panelBlock');
      const blocksArr = Array.isArray(t.blocks) && t.blocks.length ? t.blocks : (t.block ? [t.block] : []);
      const blockText = blocksArr.length ? blocksArr.join(', ') : 'Не указано';
      if (blockWrap) {
        if (blocksArr.length) {
          blockWrap.innerHTML = blocksArr.map(b => {
            const escaped = window.escapeHtml ? window.escapeHtml(b) : String(b).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]);
            return `<span class="multi-tag">${escaped}</span>`;
          }).join(' ');
        } else {
          blockWrap.innerHTML = '<span style="opacity:0.7">Не указано</span>';
        }
      }

      // Теги функций
      const funcWrap = detailPanel.querySelector('#panelFunction');
      const functionsArr = Array.isArray(t.functions) && t.functions.length ? t.functions : (t.func ? [t.func] : []);
      const funcText = functionsArr.length ? functionsArr.join(', ') : 'Не указано';
      if (funcWrap) {
        if (functionsArr.length) {
          funcWrap.innerHTML = functionsArr.map(f => {
            const escaped = window.escapeHtml ? window.escapeHtml(f) : String(f).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]);
            return `<span class="multi-tag">${escaped}</span>`;
          }).join(' ');
        } else {
          funcWrap.innerHTML = '<span style="opacity:0.7">Не указано</span>';
        }
      }

      const descText = t.description || 'Описание отсутствует';

      // Поле "Тип технологии" удалено из отображения
      const panelTechType = detailPanel.querySelector('#panelTechType');
      if (panelTechType) {
        panelTechType.textContent = '';
        panelTechType.style.display = 'none';
      }

      // Получаем массив предприятий
      const companies = Array.isArray(t.company) ? t.company : (t.company ? [t.company] : []);
      const currentEnterprise = getCurrentEnterprise();

      // Отображаем TRL и покрытие функций с пояснениями (общие для всех предприятий)
      const trlStageDisplay = detailPanel.querySelector('#panelTrlStageDisplay');
      const funcCoverDisplay = detailPanel.querySelector('#panelFuncCoverDisplay');

      if (trlStageDisplay) {
        const trlValue = t.trlStage;
        const trlDescription = getTrlStageDescription(trlValue);
        trlStageDisplay.innerHTML = createRatingDisplayHTML(trlValue, trlDescription, 3);
      }

      if (funcCoverDisplay) {
        const funcCoverValue = t.funcCover;
        const funcCoverDescription = getFuncCoverDescription(funcCoverValue);
        funcCoverDisplay.innerHTML = createRatingDisplayHTML(funcCoverValue, funcCoverDescription, 3);
      }

      // Создаем вкладочную карточку с предприятиями и оценками
      const enterpriseTabsContainer = detailPanel.querySelector('#panelEnterpriseTabs');
      const enterpriseContentContainer = detailPanel.querySelector('#panelEnterpriseContent');
      const ratingsHint = detailPanel.querySelector('#panelRatingsHint');
      const editBtn = detailPanel.querySelector('#editTechBtn');
      const enterprisesSection = detailPanel.querySelector('#panelEnterprisesSection');

      if (enterpriseTabsContainer && enterpriseContentContainer) {
        // Очищаем старое содержимое
        enterpriseTabsContainer.innerHTML = '';
        enterpriseContentContainer.innerHTML = '';

        if (companies.length === 0) {
          // Нет предприятий
          if (ratingsHint) {
            ratingsHint.textContent = 'Технология не внедрена ни на одном предприятии';
            ratingsHint.style.display = 'block';
            ratingsHint.style.color = 'var(--text-secondary, #666)';
            ratingsHint.style.fontStyle = 'italic';
          }
          if (editBtn) editBtn.classList.remove('highlight-missing-ratings');
          if (enterprisesSection) enterprisesSection.classList.remove('highlight-missing-ratings');
          enterpriseContentContainer.innerHTML = '<div class="enterprise-no-data">Технология не внедрена ни на одном предприятии</div>';
        } else {
          // Есть предприятия - создаем вкладки
          let hasAnyRatings = false;

          companies.forEach((company, index) => {
            // Создаем вкладку
            const tab = document.createElement('button');
            tab.className = 'enterprise-tab';
            tab.type = 'button';
            tab.dataset.company = company;
            tab.textContent = company;
            if (index === 0) tab.classList.add('active');

            // Получаем оценки для этого предприятия
            let techRead, organRead;
            if (t.companyRatings && typeof t.companyRatings === 'object' && t.companyRatings[company]) {
              const ratings = t.companyRatings[company];
              techRead = ratings.techRead;
              organRead = ratings.organRead;
            } else {
              // Используем общие оценки
              techRead = t.techRead;
              organRead = t.organRead;
            }

            // Проверяем заполненность оценок
            const techReadFilled = isRatingFilled(techRead);
            const organReadFilled = isRatingFilled(organRead);
            if (techReadFilled && organReadFilled) {
              hasAnyRatings = true;
            }

            // Обработчик клика на вкладку
            tab.addEventListener('click', () => {
              // Убираем активный класс со всех вкладок
              enterpriseTabsContainer.querySelectorAll('.enterprise-tab').forEach(t => t.classList.remove('active'));
              tab.classList.add('active');

              // Показываем содержимое для выбранного предприятия
              showEnterpriseRatings(company);
            });

            enterpriseTabsContainer.appendChild(tab);
          });

          // Функция для отображения оценок выбранного предприятия
          const showEnterpriseRatings = (company) => {
            let techRead, organRead, isImplemented;
            if (t.companyRatings && typeof t.companyRatings === 'object' && t.companyRatings[company]) {
              const ratings = t.companyRatings[company];
              techRead = ratings.techRead;
              organRead = ratings.organRead;
              isImplemented = ratings.isImplemented;
            } else {
              // Используем общие оценки
              techRead = t.techRead;
              organRead = t.organRead;
              isImplemented = t.isImplemented;
            }

            const techReadValue = (techRead !== undefined && techRead !== null && techRead !== '') ? techRead : null;
            const organReadValue = (organRead !== undefined && organRead !== null && organRead !== '') ? organRead : null;

            const techReadDescription = getTechReadDescription(techReadValue);
            const organReadDescription = getOrganReadDescription(organReadValue);

            // Определяем статус внедрения
            const implementationStatus = isImplemented === true ? 'Внедрена' : 'Не внедрена';
            const implementationClass = isImplemented === true ? 'implemented' : 'not-implemented';

            enterpriseContentContainer.innerHTML = `
              <div class="enterprise-ratings">
                <div class="enterprise-status-badge ${implementationClass}">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    ${isImplemented === true
                ? '<path d="M13.5 4L6 11.5L2.5 8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'
                : '<path d="M12 4L4 12M4 4L12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'
              }
                  </svg>
                  <span>${implementationStatus}</span>
                </div>
                <div class="enterprise-rating-item">
                  <span class="enterprise-rating-label">Технологическая готовность:</span>
                  <div class="enterprise-rating-content">
                    <span class="enterprise-rating-description">${techReadValue !== null ? `${techReadValue} — ${techReadDescription}` : 'Не указано'}</span>
                    <span class="enterprise-rating-value">/3</span>
                  </div>
                </div>
                <div class="enterprise-rating-item">
                  <span class="enterprise-rating-label">Организационная готовность:</span>
                  <div class="enterprise-rating-content">
                    <span class="enterprise-rating-description">${organReadValue !== null ? `${organReadValue} — ${organReadDescription}` : 'Не указано'}</span>
                    <span class="enterprise-rating-value">/3</span>
                  </div>
                </div>
              </div>
            `;
          };

          // Показываем оценки для первого предприятия
          showEnterpriseRatings(companies[0]);

          // Проверяем заполненность оценок
          if (!hasAnyRatings) {
            if (editBtn) editBtn.classList.add('highlight-missing-ratings');
            if (enterprisesSection) enterprisesSection.classList.add('highlight-missing-ratings');
            if (ratingsHint) {
              ratingsHint.textContent = 'Заполните поля оценок';
              ratingsHint.style.display = 'block';
              ratingsHint.style.color = '';
              ratingsHint.style.fontStyle = '';
            }
          } else {
            if (editBtn) editBtn.classList.remove('highlight-missing-ratings');
            if (enterprisesSection) enterprisesSection.classList.remove('highlight-missing-ratings');
            if (ratingsHint) {
              ratingsHint.textContent = '';
              ratingsHint.style.display = 'none';
            }
          }
        }
      }

      // Описание
      detailPanel.querySelector('#panelDescription').textContent = descText;

      // Пример внедрения
      const exampleEl = detailPanel.querySelector('#panelExampleDesc');
      if (exampleEl) exampleEl.textContent = t.exampleDesc || '—';

      // Вспомогательная функция для форматирования размера файла
      const formatFileSize = (bytes) => {
        if (!bytes || bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
      };

      // Вендоры
      const vendorsEl = detailPanel.querySelector('#panelVendors');
      if (vendorsEl) {
        if (t.vendors && Array.isArray(t.vendors) && t.vendors.length > 0) {
          const esc = (s) => (window.escapeHtml ? window.escapeHtml(String(s ?? '')) : String(s ?? ''));
          const normalize = (x) => String(x ?? '').trim();
          const vendors = t.vendors
            .map(v => ({
              name: normalize(v && typeof v === 'object' ? (v.name || v.id || '') : v),
              integrators: (v && typeof v === 'object' && Array.isArray(v.integrators)) ? v.integrators : []
            }))
            .filter(v => v.name);

          if (vendors.length === 0) {
            vendorsEl.innerHTML = '<span class="panel-muted">Вендоры не указаны</span>';
          } else {
            vendorsEl.innerHTML = `
              <div class="vendor-list">
                ${vendors.map(v => {
              const integratorNames = v.integrators
                .map(i => (i && typeof i === 'object') ? (i.name || i.id || '') : i)
                .map(normalize)
                .filter(Boolean);

              return `
                    <div class="vendor-card">
                      <div class="vendor-card__header">
                        <div class="vendor-name">${esc(v.name)}</div>
                        ${integratorNames.length ? `<div class="vendor-meta">${integratorNames.length} интегратор(ов)</div>` : `<div class="vendor-meta">интеграторы не указаны</div>`}
                      </div>
                      ${integratorNames.length ? `
                        <div class="vendor-card__integrators">
                          ${integratorNames.map(n => `<span class="chip chip--integrator">${esc(n)}</span>`).join('')}
                        </div>
                      ` : ''}
                    </div>
                  `;
            }).join('')}
              </div>
            `;
          }
        } else {
          vendorsEl.innerHTML = '<span class="panel-muted">Вендоры не указаны</span>';
        }
      }

      // Файлы
      const filesEl = detailPanel.querySelector('#panelFiles');
      if (filesEl) {
        if (t.files && Array.isArray(t.files) && t.files.length > 0) {
          filesEl.innerHTML = t.files.map(file => {
            const fileName = file.name || 'Без названия';
            const fileId = file.id || Date.now();
            return `
              <div class="panel-file-item">
                <div class="panel-file-content">
                  <div class="panel-file-icon">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M4 2h5.172a2 2 0 0 1 1.414.586l2.828 2.828A2 2 0 0 1 14 6.828V13a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
                      <path d="M9 2v4h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </div>
                  <div class="panel-file-info">
                    <div class="panel-file-name">${window.escapeHtml ? window.escapeHtml(fileName) : fileName}</div>
                    ${file.size ? `<div class="panel-file-size">${formatFileSize(file.size)}</div>` : ''}
                  </div>
                </div>
                <button type="button" class="download-file-btn" data-file-id="${fileId}" aria-label="Скачать файл">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin-right: 4px;">
                    <path d="M8 11V2M8 11L5 8M8 11L11 8M2 13h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                  Скачать
                </button>
              </div>
            `;
          }).join('');

          // Добавляем обработчики для кнопок скачивания
          filesEl.querySelectorAll('.download-file-btn').forEach(btn => {
            btn.addEventListener('click', () => {
              const fileId = btn.dataset.fileId;
              const file = t.files.find(f => (f.id || Date.now()) == fileId);
              if (file) {
                try {
                  // Если файл имеет URL/ссылку, открываем её
                  if (file.url || file.link) {
                    const fileUrl = file.url || file.link;
                    const a = document.createElement('a');
                    a.href = fileUrl;
                    a.target = '_blank';
                    a.rel = 'noopener noreferrer';
                    a.download = file.name || 'file';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                  } else if (file.data) {
                    // Создаем blob из base64
                    const byteCharacters = atob(file.data);
                    const byteNumbers = new Array(byteCharacters.length);
                    for (let i = 0; i < byteCharacters.length; i++) {
                      byteNumbers[i] = byteCharacters.charCodeAt(i);
                    }
                    const byteArray = new Uint8Array(byteNumbers);
                    const blob = new Blob([byteArray], { type: file.type || 'application/octet-stream' });

                    // Создаем ссылку для скачивания
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = file.name || 'file';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  }
                } catch (err) {
                  if (window.Logger) window.Logger.warn('Ошибка при скачивании файла', err);
                  if (window.showNotification) {
                    window.showNotification('Ошибка при скачивании файла', false);
                  }
                }
              }
            });
          });
        } else {
          filesEl.innerHTML = '<span style="opacity:0.7">Файлы не прикреплены</span>';
        }
      }

      // Управление кнопкой «Назад к списку технологий» в шапке панели:
      // показываем её только если панель открыта из списка приоритетов сектора
      const backBtn = detailPanel.querySelector('#detailBackFromPriorityBtn');
      if (backBtn) {
        if (source === 'priority') {
          backBtn.style.display = 'inline-flex';
          backBtn.setAttribute('aria-hidden', 'false');
        } else {
          backBtn.style.display = 'none';
          backBtn.setAttribute('aria-hidden', 'true');
        }
      }

      // Устанавливаем display и добавляем класс active для показа панели
      // CSS использует display: flex !important, поэтому не нужно устанавливать display вручную
      // Но убедимся, что элемент видим
      // Очищаем любые inline стили, которые могут мешать
      detailPanel.style.display = '';

      // Освобождаем старый focus trap перед активацией нового (на случай, если панель уже была открыта)
      if (window.FocusTrap && typeof window.FocusTrap.release === 'function') {
        try {
          window.FocusTrap.release();
        } catch (e) {
          // Игнорируем ошибки при освобождении
        }
      }

      // Добавляем класс active ПЕРЕД установкой inline стилей
      detailPanel.classList.add('active');

      // Активируем focus trap для detail panel
      if (window.FocusTrap && typeof window.FocusTrap.trap === 'function') {
        setTimeout(() => {
          window.FocusTrap.trap(detailPanel);
        }, 50);
      }

      // ПРИНУДИТЕЛЬНО устанавливаем стили для показа панели через inline стили с !important
      // Это необходимо, так как CSS может быть переопределен другими правилами
      // Используем setProperty с 'important' для гарантированного применения
      detailPanel.style.setProperty('visibility', 'visible', 'important');
      detailPanel.style.setProperty('opacity', '1', 'important');
      detailPanel.style.setProperty('transform', 'translateX(0)', 'important');
      detailPanel.style.setProperty('position', 'fixed', 'important');
      detailPanel.style.setProperty('z-index', '10002', 'important');

      // Также устанавливаем через обычные свойства для совместимости
      detailPanel.style.visibility = 'visible';
      detailPanel.style.opacity = '1';
      detailPanel.style.transform = 'translateX(0)';
      detailPanel.style.position = 'fixed';
      detailPanel.style.zIndex = '10002';

      // Проверяем, что панель действительно видна
      const computedStyle = window.getComputedStyle(detailPanel);
      // Убеждаемся, что z-index достаточно высокий
      const currentZIndex = parseInt(computedStyle.zIndex) || 0;
      if (currentZIndex < 10002) {
        detailPanel.style.setProperty('z-index', '10002', 'important');
      }

      // Проверяем, находится ли панель в видимой области
      const rect = detailPanel.getBoundingClientRect();

      // Дополнительная проверка через небольшую задержку
      setTimeout(() => {
        const checkStyle = window.getComputedStyle(detailPanel);
        const transformMatrix = checkStyle.transform;
        const isHidden = checkStyle.visibility === 'hidden' ||
          checkStyle.opacity === '0' ||
          (transformMatrix && transformMatrix !== 'none' &&
            !transformMatrix.includes('translateX(0') &&
            !transformMatrix.includes('matrix(1, 0, 0, 1, 0, 0)'));

        if (isHidden) {
          // Принудительно показываем через inline стили с !important через setProperty
          detailPanel.style.setProperty('visibility', 'visible', 'important');
          detailPanel.style.setProperty('opacity', '1', 'important');
          detailPanel.style.setProperty('transform', 'translateX(0)', 'important');
        } else {
          // Проверяем финальное состояние панели
          const finalRect = detailPanel.getBoundingClientRect();
          const isInViewport = finalRect.top >= 0 &&
            finalRect.left >= 0 &&
            finalRect.right <= window.innerWidth &&
            finalRect.bottom <= window.innerHeight;

          // Если панель не в видимой области, принудительно позиционируем
          if (!isInViewport && (finalRect.right > window.innerWidth || finalRect.left < 0)) {
            detailPanel.style.right = '16px';
            detailPanel.style.left = 'auto';
          }
        }
      }, 50);
    } else {
      if (window.Logger) window.Logger.warn('showDetail: detailPanel не найден', {
        DOMCache: window.DOMCache ? 'доступен' : 'недоступен',
        getElementById: document.getElementById('detailPanel') ? 'найден' : 'не найден'
      });
    }

    // Определяем квадрант для отображения: используем переданный квадрант или вычисляем из направлений
    // Если источник - 'priority', используем текущий зуммированный квадрант, если он есть
    const q = sourceQuadrant != null
      ? sourceQuadrant
      : (source === 'priority' && currentZoomedQuadrant != null)
        ? currentZoomedQuadrant
        : (() => {
          // Используем направления для определения квадранта
          const getAllQuadrantsForTech = window.Positioning?.getAllQuadrantsForTech || window.getAllQuadrantsForTech;
          if (getAllQuadrantsForTech && typeof getAllQuadrantsForTech === 'function') {
            const quadrants = getAllQuadrantsForTech(t);
            return quadrants.length > 0 ? quadrants[0] : null;
          }
          return null;
        })();

    // Попытаемся найти и выделить соответствующий сектор в сайдбаре
    // Индикаторы зрелости заменены на оценки (techRead, organRead, funcCover) и выводятся выше
    if (q != null) {
      try {
        const sectorItem = document.querySelector(`.sector-item[data-quadrant="${q}"]`);
        if (sectorItem) {
          // Если сектор пустой — не подсвечиваем, показываем уведомление
          const gEl = document.querySelector(`.quadrant-group.q${q}`);
          if (gEl && gEl.classList.contains('empty')) {
            showNotification('На данный момент в данном секторе отсутствуют технологии, но мы активно работаем над внедрением новых технологий.', false);
          } else {
            document.querySelectorAll('.sector-item').forEach(i => i.classList.remove('active'));
            sectorItem.classList.add('active');
            try {
              const existing = sectorItem.nextElementSibling;
              if (existing && existing.classList.contains('tech-list')) {
                const listItem = existing.querySelector(`.tech-list-item[data-tech-id="${t.id}"]`);
                if (listItem) {
                  existing.querySelectorAll('.tech-list-item').forEach(li => li.classList.remove('selected'));
                  listItem.classList.add('selected');
                  listItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                }
              } else {
                // Создаём список технологий в секторе
                document.querySelectorAll('.tech-list').forEach(tl => tl.parentNode?.removeChild(tl));
                createTechListForSector(sectorItem, q, getTechnologies());
                const newList = sectorItem.nextElementSibling;
                if (newList && newList.classList.contains('tech-list')) {
                  const listItem = newList.querySelector(`.tech-list-item[data-tech-id="${t.id}"]`);
                  if (listItem) {
                    newList.querySelectorAll('.tech-list-item').forEach(li => li.classList.remove('selected'));
                    listItem.classList.add('selected');
                    listItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                  }
                }
              }
            } catch (errInner) {
              if (window.Logger) window.Logger.warn('showDetail: не удалось раскрыть список сектора:', errInner);
            }
          }
        }
      } catch (err) {
        if (window.Logger) window.Logger.warn('showDetail: Не удалось открыть сектор в сайдбаре:', err);
      }
    }

    // Выполним зум в квадрант, из которого был клик (или в первый доступный)
    // Если источник - 'priority' и сектор уже зуммирован, не применяем зум повторно
    // Если источник - 'add', не делаем зум (уже сброшен в form-management.js)
    if (q != null && source !== 'add') {
      if (source === 'priority' && getCurrentZoomedQuadrant() === q) {
        // Сектор уже зуммирован, просто убедимся, что он правильно отображается
        const g = document.querySelector(`.quadrant-group.q${q}`);
        if (g && !g.classList.contains('zoomed-in')) {
          zoomQuadrant(q, { source: 'priority' });
        }
      } else {
        zoomQuadrant(q, { source: source === 'priority' ? 'priority' : 'blip' });
      }
    }
  }

  /**
   * Получение значения поля технологии для экспорта
   * @param {Object} tech - объект технологии
   * @param {string} fieldName - название поля
   * @param {Object} options - опции (companyFilter)
   * @returns {string} значение поля
   */
  function getFieldValue(tech, fieldName, options = {}) {
    const { companyFilter = null } = options;

    switch (fieldName) {
      case 'name':
        return tech.name || 'Не указано';
      case 'company':
        if (Array.isArray(tech.company)) {
          let companies = tech.company;
          // Если указан фильтр по предприятиям, показываем только отфильтрованные
          if (companyFilter && Array.isArray(companyFilter) && companyFilter.length > 0) {
            companies = tech.company.filter(c => companyFilter.includes(c));
          }
          return companies.length > 0 ? companies.join(', ') : 'Не указано';
        }
        return tech.company || 'Не указано';
      case 'blocks':
        if (Array.isArray(tech.blocks)) {
          const blockIdToName = window.blockIdToName || {};
          return tech.blocks.map(b => {
            if (typeof b === 'number' && blockIdToName[b]) {
              return blockIdToName[b];
            }
            return String(b || '');
          }).filter(Boolean).join(', ') || 'Не указано';
        }
        return tech.block || tech.blocks || 'Не указано';
      case 'functions':
        if (Array.isArray(tech.functions)) {
          return tech.functions.join(', ') || 'Не указано';
        }
        return tech.func || tech.functions || 'Не указано';
      case 'status':
        // Определяем статус на основе isImplemented
        const companies = Array.isArray(tech.company) ? tech.company : (tech.company ? [tech.company] : []);
        let isImplemented = false;

        if (companies.length > 1 && tech.companyRatings && typeof tech.companyRatings === 'object') {
          isImplemented = companies.some(company => {
            const ratings = tech.companyRatings[company];
            return ratings && ratings.isImplemented === true;
          });
        } else {
          if (companies.length === 1 && tech.companyRatings && typeof tech.companyRatings === 'object') {
            const ratings = tech.companyRatings[companies[0]];
            isImplemented = ratings && ratings.isImplemented === true;
          } else {
            isImplemented = tech.isImplemented === true;
          }
        }
        return isImplemented ? 'Внедренные' : 'Невнедренные';
      case 'costProm':
        if (tech.status === 'Перспективные' || tech.level === 'Перспективные') {
          return tech.costProm !== undefined && tech.costProm !== null ? String(tech.costProm) : '—';
        }
        return '—';
      case 'description':
        return tech.description || (tech.ref ? `Референс: ${tech.ref}` : '—');
      case 'techRead':
        // Для технологий с несколькими предприятиями показываем значения для каждого
        if (Array.isArray(tech.company) && tech.company.length > 1) {
          let companiesToShow = tech.company;
          if (companyFilter && Array.isArray(companyFilter) && companyFilter.length > 0) {
            companiesToShow = tech.company.filter(c => companyFilter.includes(c));
          }

          // Если есть данные по предприятиям с индивидуальными оценками
          if (tech.companyRatings && typeof tech.companyRatings === 'object') {
            const techReadLines = [];
            companiesToShow.forEach(company => {
              const ratings = tech.companyRatings[company];
              if (ratings && ratings.techRead !== undefined && ratings.techRead !== null) {
                techReadLines.push(`${company}: ${ratings.techRead}`);
              } else {
                // Используем общие значения
                const value = tech.techRead !== undefined && tech.techRead !== null ? String(tech.techRead) : '—';
                techReadLines.push(`${company}: ${value}`);
              }
            });
            return techReadLines.length > 0 ? techReadLines.join('\n') : '—';
          } else {
            // Нет индивидуальных оценок - показываем общее значение для всех предприятий
            const value = tech.techRead !== undefined && tech.techRead !== null ? String(tech.techRead) : '—';
            const techReadLines = companiesToShow.map(company => `${company}: ${value}`);
            return techReadLines.join('\n');
          }
        } else {
          // Одно предприятие - стандартное отображение
          return tech.techRead !== undefined && tech.techRead !== null ? String(tech.techRead) : '—';
        }
      case 'organRead':
        // Для технологий с несколькими предприятиями показываем значения для каждого
        if (Array.isArray(tech.company) && tech.company.length > 1) {
          let companiesToShow = tech.company;
          if (companyFilter && Array.isArray(companyFilter) && companyFilter.length > 0) {
            companiesToShow = tech.company.filter(c => companyFilter.includes(c));
          }

          // Если есть данные по предприятиям с индивидуальными оценками
          if (tech.companyRatings && typeof tech.companyRatings === 'object') {
            const organReadLines = [];
            companiesToShow.forEach(company => {
              const ratings = tech.companyRatings[company];
              if (ratings && ratings.organRead !== undefined && ratings.organRead !== null) {
                organReadLines.push(`${company}: ${ratings.organRead}`);
              } else {
                // Используем общие значения
                const value = tech.organRead !== undefined && tech.organRead !== null ? String(tech.organRead) : '—';
                organReadLines.push(`${company}: ${value}`);
              }
            });
            return organReadLines.length > 0 ? organReadLines.join('\n') : '—';
          } else {
            // Нет индивидуальных оценок - показываем общее значение для всех предприятий
            const value = tech.organRead !== undefined && tech.organRead !== null ? String(tech.organRead) : '—';
            const organReadLines = companiesToShow.map(company => `${company}: ${value}`);
            return organReadLines.join('\n');
          }
        } else {
          // Одно предприятие - стандартное отображение
          return tech.organRead !== undefined && tech.organRead !== null ? String(tech.organRead) : '—';
        }
      case 'trlStage':
        return tech.trlStage !== undefined && tech.trlStage !== null ? String(tech.trlStage) : '—';
      case 'vendors':
        if (tech.vendors && Array.isArray(tech.vendors) && tech.vendors.length > 0) {
          return tech.vendors.map(vendor => vendor.name || 'Без названия').filter(Boolean).join(', ') || 'Не указано';
        }
        return 'Не указано';
      case 'integrators':
        if (tech.vendors && Array.isArray(tech.vendors) && tech.vendors.length > 0) {
          const allIntegrators = [];
          tech.vendors.forEach(vendor => {
            if (vendor.integrators && Array.isArray(vendor.integrators) && vendor.integrators.length > 0) {
              vendor.integrators.forEach(integrator => {
                const integratorName = integrator.name || integrator;
                if (integratorName && !allIntegrators.includes(integratorName)) {
                  allIntegrators.push(integratorName);
                }
              });
            }
          });
          return allIntegrators.length > 0 ? allIntegrators.join(', ') : 'Не указано';
        }
        return 'Не указано';
      case 'exampleDesc':
        // exampleDesc может быть строкой или массивом (marketExamples)
        if (tech.exampleDesc) {
          return tech.exampleDesc;
        } else if (tech.marketExamples) {
          if (Array.isArray(tech.marketExamples)) {
            return tech.marketExamples.join('\n');
          }
          return String(tech.marketExamples);
        }
        return '—';
      default:
        return '—';
    }
  }

  /**
   * Получение заголовка поля для экспорта
   * @param {string} fieldName - название поля
   * @returns {string} заголовок поля
   */
  function getFieldLabel(fieldName) {
    const labels = {
      'name': 'Название',
      'company': 'Предприятия',
      'blocks': 'Функциональный блок',
      'functions': 'Функции',
      'status': 'Статус',
      'costProm': 'Стоимость внедрения',
      'description': 'Описание',
      'exampleDesc': 'Примеры внедрения',
      'techRead': 'Технологическая готовность',
      'organRead': 'Организационная готовность',
      'trlStage': 'TRL-стадия',
      'vendors': 'Вендору',
      'integrators': 'Интеграторы'
    };
    return labels[fieldName] || fieldName;
  }

  // Экспорт функций в window для обратной совместимости
  window.showDetail = showDetail;
  window.getFieldValue = getFieldValue;
  window.getFieldLabel = getFieldLabel;

  // Экспорт в объект для модульной структуры (опционально)
  window.DetailPanel = {
    showDetail,
    getFieldValue,
    getFieldLabel
  };

})();
