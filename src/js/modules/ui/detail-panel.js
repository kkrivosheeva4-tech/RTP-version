// Модуль работы с детальной панелью
// Экспортирует функции в window для использования в RMK2.js
// Использует глобальные переменные из RMK2.js и функции из других модулей

(function() {
  'use strict';

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
      console.error('showDetail: технология не передана');
      return;
    }

    const detailPanel = getDOMElement('detailPanel');

    const svg = getDOMElement('techRadar');
    const quadrantPriorityPanel = getDOMElement('quadrantPriorityPanel');
    const currentZoomedQuadrant = getCurrentZoomedQuadrant();

    // Если был совершен клик по blip на радаре при открытом модальном окне приоритетных технологий,
    // то модальное окно приоритетных технологий скрывается, чтобы панель детальной информации не открывалась под ним
    // Также убеждаемся, что z-index панели выше, чем у модального окна приоритетных технологий
    if (source === 'blip' &&
        quadrantPriorityPanel &&
        quadrantPriorityPanel.classList.contains('open')) {
      closeQuadrantPriorityPanel();
    }

    // Убеждаемся, что z-index панели выше, чем у модального окна приоритетных технологий (10004)
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

      // Теги предприятий (company)
      const companyWrap = detailPanel.querySelector('#panelCompanyTags');
      if (companyWrap) {
        const companies = Array.isArray(t.company) ? t.company : (t.company ? [t.company] : []);
        if (companies.length) {
          companyWrap.innerHTML = companies.map(c => {
            const escaped = window.escapeHtml ? window.escapeHtml(c) : String(c).replace(/[&<>"']/g, m => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[m]);
            return `<span class="multi-tag">${escaped}</span>`;
          }).join(' ');
        } else {
          companyWrap.innerHTML = '<span style="opacity:0.7">Не указано</span>';
        }
      }

      // Теги блоков
      const blockWrap = detailPanel.querySelector('#panelBlock');
      const blocksArr = Array.isArray(t.blocks) && t.blocks.length ? t.blocks : (t.block ? [t.block] : []);
      const blockText = blocksArr.length ? blocksArr.join(', ') : 'Не указано';
      if (blockWrap) {
        if (blocksArr.length) {
          blockWrap.innerHTML = blocksArr.map(b => {
            const escaped = window.escapeHtml ? window.escapeHtml(b) : String(b).replace(/[&<>"']/g, m => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[m]);
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
            const escaped = window.escapeHtml ? window.escapeHtml(f) : String(f).replace(/[&<>"']/g, m => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[m]);
            return `<span class="multi-tag">${escaped}</span>`;
          }).join(' ');
        } else {
          funcWrap.innerHTML = '<span style="opacity:0.7">Не указано</span>';
        }
      }

      const techTypeText = t.techType || 'Не указано';
      const descText = t.description || 'Описание отсутствует';

      detailPanel.querySelector('#panelTechType').textContent = techTypeText;
      detailPanel.querySelector('#panelDescription').textContent = descText;

      // Оценки 0-3
      const techReadEl = detailPanel.querySelector('#panelTechRead');
      const organReadEl = detailPanel.querySelector('#panelOrganRead');
      const funcCoverEl = detailPanel.querySelector('#panelFuncCover');
      const trlStageEl = detailPanel.querySelector('#panelTrlStage');

      // Проверяем, есть ли индивидуальные оценки по предприятиям
      const companies = Array.isArray(t.company) ? t.company : (t.company ? [t.company] : []);
      const currentEnterprise = getCurrentEnterprise();

      if (companies.length > 1 && t.companyRatings && typeof t.companyRatings === 'object') {
        // Несколько предприятий с индивидуальными оценками:
        // - если текущее предприятие входит в companies, показываем ТОЛЬКО его оценки (если нет — показываем "—")
        // - иначе (на всякий случай) показываем общий fallback (первое предприятие / общие)
        if (currentEnterprise && companies.includes(currentEnterprise)) {
          const ratings = (t.companyRatings && t.companyRatings[currentEnterprise]) ? t.companyRatings[currentEnterprise] : null;
          if (techReadEl) techReadEl.textContent = (ratings && ratings.techRead !== undefined && ratings.techRead !== null && ratings.techRead !== '') ? String(ratings.techRead) : '—';
          if (organReadEl) organReadEl.textContent = (ratings && ratings.organRead !== undefined && ratings.organRead !== null && ratings.organRead !== '') ? String(ratings.organRead) : '—';
        } else {
          // fallback: общие значения или значения первого предприятия
          const firstCompany = companies[0];
          const ratings = (t.companyRatings && t.companyRatings[firstCompany]) ? t.companyRatings[firstCompany] : {};
          if (techReadEl) techReadEl.textContent = (ratings.techRead !== undefined && ratings.techRead !== null && ratings.techRead !== '') ? String(ratings.techRead) : ((t.techRead ?? '') !== '' ? String(t.techRead) : '—');
          if (organReadEl) organReadEl.textContent = (ratings.organRead !== undefined && ratings.organRead !== null && ratings.organRead !== '') ? String(ratings.organRead) : ((t.organRead ?? '') !== '' ? String(t.organRead) : '—');
        }
      } else {
        // Одно предприятие или нет индивидуальных оценок - показываем общие значения
        if (techReadEl) techReadEl.textContent = (t.techRead ?? '') !== '' ? String(t.techRead) : '—';
        if (organReadEl) organReadEl.textContent = (t.organRead ?? '') !== '' ? String(t.organRead) : '—';
      }

      // Отображаем funcCover с учетом индивидуальных оценок
      if (funcCoverEl) {
        if (companies.length > 1 && t.companyRatings && typeof t.companyRatings === 'object') {
          if (currentEnterprise && companies.includes(currentEnterprise)) {
            const ratings = (t.companyRatings && t.companyRatings[currentEnterprise]) ? t.companyRatings[currentEnterprise] : null;
            funcCoverEl.textContent = (ratings && ratings.funcCover !== undefined && ratings.funcCover !== null && ratings.funcCover !== '') ? String(ratings.funcCover) : '—';
          } else {
            // fallback: общие значения или значения первого предприятия
            const firstCompany = companies[0];
            const ratings = (t.companyRatings && t.companyRatings[firstCompany]) ? t.companyRatings[firstCompany] : {};
            funcCoverEl.textContent = (ratings.funcCover !== undefined && ratings.funcCover !== null && ratings.funcCover !== '') ? String(ratings.funcCover) : ((t.funcCover ?? '') !== '' ? String(t.funcCover) : '—');
          }
        } else {
          funcCoverEl.textContent = (t.funcCover ?? '') !== '' ? String(t.funcCover) : '—';
        }
      }

      // Отображаем TRL (общий для всех предприятий)
      if (trlStageEl) {
        trlStageEl.textContent = (t.trlStage !== undefined && t.trlStage !== null && t.trlStage !== '') ? String(t.trlStage) : '—';
      }

      // Проверяем заполненность оценок и подсвечиваем кнопку/блок оценок при их отсутствии
      // Для технологий с несколькими предприятиями проверяем оценки текущего предприятия
      let techReadFilled = false;
      let organReadFilled = false;
      if (companies.length > 1 && t.companyRatings && typeof t.companyRatings === 'object') {
        if (currentEnterprise && companies.includes(currentEnterprise)) {
          const ratings = (t.companyRatings && t.companyRatings[currentEnterprise]) ? t.companyRatings[currentEnterprise] : {};
          techReadFilled = isRatingFilled(ratings.techRead);
          organReadFilled = isRatingFilled(ratings.organRead);
        } else {
          // fallback: используем общие значения
          techReadFilled = isRatingFilled(t.techRead);
          organReadFilled = isRatingFilled(t.organRead);
        }
      } else {
        techReadFilled = isRatingFilled(t.techRead);
        organReadFilled = isRatingFilled(t.organRead);
      }
      const hasReadinessRatings = techReadFilled && organReadFilled;

      const editBtn = detailPanel.querySelector('#editTechBtn');
      const ratingsSection = detailPanel.querySelector('#panelRatingsSection');
      const ratingsHint = detailPanel.querySelector('#panelRatingsHint');

      if (!hasReadinessRatings) {
        if (editBtn) editBtn.classList.add('highlight-missing-ratings');
        if (ratingsSection) ratingsSection.classList.add('highlight-missing-ratings');
        if (ratingsHint) {
          ratingsHint.textContent = 'Заполните поля оценок';
          ratingsHint.style.display = 'block';
        }
      } else {
        if (editBtn) editBtn.classList.remove('highlight-missing-ratings');
        if (ratingsSection) ratingsSection.classList.remove('highlight-missing-ratings');
        if (ratingsHint) {
          ratingsHint.textContent = '';
          ratingsHint.style.display = 'none';
        }
      }

      // Приоритет технологии (0–1 → 0–100%)
      const prioritySection = detailPanel.querySelector('#panelPrioritySection');
      const priorityValueEl = detailPanel.querySelector('#panelPriorityValue');
      const priorityCommentEl = detailPanel.querySelector('#panelPriorityComment');
      if (prioritySection && priorityValueEl && priorityCommentEl) {
        // Используем текущее предприятие для вычисления приоритета, если технология с несколькими предприятиями
        const companies = Array.isArray(t.company) ? t.company : (t.company ? [t.company] : []);
        const companyForPriority = (companies.length > 1 && currentEnterprise && companies.includes(currentEnterprise)) ? currentEnterprise : null;
        const priority = computePriority(t, 'mult', companyForPriority);
        const category = getPriorityCategory(priority);

        prioritySection.classList.remove('priority-low', 'priority-medium', 'priority-high', 'priority-none');

        if (priority == null || category.key === 'none') {
          priorityValueEl.textContent = 'Приоритет: —';
          priorityCommentEl.textContent = category.description;
          prioritySection.classList.add('priority-none');
        } else {
          const percent = Math.round(priority * 100);
          priorityValueEl.textContent = `Приоритет: ${percent}% (${category.label})`;
          priorityCommentEl.textContent = getPriorityWeakLinkComment(t, companyForPriority);
          if (category.key === 'low') prioritySection.classList.add('priority-low');
          else if (category.key === 'medium') prioritySection.classList.add('priority-medium');
          else if (category.key === 'high') prioritySection.classList.add('priority-high');
        }
      }

      // Пример внедрения
      const exampleEl = detailPanel.querySelector('#panelExampleDesc');
      if (exampleEl) exampleEl.textContent = t.exampleDesc || '—';

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

    // Определяем квадрант для отображения: используем переданный квадрант или вычисляем из первого блока
    // Если источник - 'priority', используем текущий зуммированный квадрант, если он есть
    const q = sourceQuadrant != null
      ? sourceQuadrant
      : (source === 'priority' && currentZoomedQuadrant != null)
        ? currentZoomedQuadrant
        : (() => {
            const blockKey = (t.blocks && t.blocks.length) ? t.blocks[0] : t.block;
            return getQuadrantIdForBlock(blockKey);
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
    if (q != null) {
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
      case 'techTypes':
        return tech.techTypes || tech.techType || 'Не указано';
      case 'status':
        return tech.status || tech.level || 'Не указано';
      case 'costProm':
        if (tech.status === 'Перспективные' || tech.level === 'Перспективные') {
          return tech.costProm !== undefined && tech.costProm !== null ? String(tech.costProm) : '—';
        }
        return '—';
      case 'description':
        return tech.description || (tech.ref ? `Референс: ${tech.ref}` : '—');
      case 'priority':
        try {
          // Для технологий с несколькими предприятиями показываем приоритет для каждого
          if (Array.isArray(tech.company) && tech.company.length > 1) {
            // Получаем список предприятий для отображения приоритета
            let companiesToShow = tech.company;
            if (companyFilter && Array.isArray(companyFilter) && companyFilter.length > 0) {
              companiesToShow = tech.company.filter(c => companyFilter.includes(c));
            }

            // Если есть данные по предприятиям с индивидуальными оценками
            if (tech.companyRatings && typeof tech.companyRatings === 'object') {
              const priorityLines = [];
              companiesToShow.forEach(company => {
                const p = computePriority(tech, 'mult', company);
                if (p != null && !Number.isNaN(p)) {
                  const percent = Math.round(p * 100);
                  const cat = getPriorityCategory(p);
                  priorityLines.push(`${company}: ${percent}% (${cat.label})`);
                } else {
                  priorityLines.push(`${company}: —`);
                }
              });
              return priorityLines.join('\n');
            } else {
              // Нет индивидуальных оценок - показываем общий приоритет для всех предприятий
              const p = computePriority(tech, 'mult');
              if (p == null || Number.isNaN(p)) return '—';
              const percent = Math.round(p * 100);
              const cat = getPriorityCategory(p);
              // Показываем для каждого предприятия одинаковый приоритет
              const priorityLines = companiesToShow.map(company => `${company}: ${percent}% (${cat.label})`);
              return priorityLines.join('\n');
            }
          } else {
            // Одно предприятие - стандартное отображение
            const p = computePriority(tech, 'mult');
            if (p == null || Number.isNaN(p)) return '—';
            const percent = Math.round(p * 100);
            const cat = getPriorityCategory(p);
            return `${percent}% (${cat.label})`;
          }
        } catch (e) {
          return '—';
        }
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
      case 'funcCover':
        return tech.funcCover !== undefined && tech.funcCover !== null ? String(tech.funcCover) : '—';
      case 'exampleDesc':
        return tech.exampleDesc || '—';
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
      'techTypes': 'Тип технологии',
      'status': 'Статус',
      'costProm': 'Стоимость внедрения',
      'description': 'Описание',
      'priority': 'Приоритет технологии',
      'techRead': 'Технологическая готовность',
      'organRead': 'Организационная готовность',
      'funcCover': 'Покрытие функций'
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
