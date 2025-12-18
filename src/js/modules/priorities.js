// Модуль работы с приоритетами технологий
// Экспортирует функции в window.Priorities для использования в RMK2.js
// Использует глобальные переменные из RMK2.js и функции из других модулей

(function() {
  'use strict';

  /**
   * Безопасное приведение значения к числу в диапазоне [min, max].
   */
  function clampNumber(value, min, max) {
    const n = Number(value);
    if (Number.isNaN(n)) return min;
    return Math.min(max, Math.max(min, n));
  }

  /**
   * Получить нормализованные оценки готовности и TRL в интервале [0, 1].
   * Org_n = Org/3, Tech_n = Tech/3, TRL_n = (trlStage-1)/2 при trlStage ∈ {1,2,3}.
   */
  function getNormalizedReadinessAndTrl(tech, company = null) {
    // Если указано предприятие и есть индивидуальные оценки, используем их
    let techRead, organRead;
    if (company && tech.companyRatings && typeof tech.companyRatings === 'object' && tech.companyRatings[company]) {
      const ratings = tech.companyRatings[company];
      techRead = clampNumber(ratings.techRead !== undefined ? ratings.techRead : (tech.techRead ?? tech.tech_read), 0, 3);
      organRead = clampNumber(ratings.organRead !== undefined ? ratings.organRead : (tech.organRead ?? tech.organ_read), 0, 3);
    } else {
      // Используем общие оценки
      techRead = clampNumber(tech.techRead ?? tech.tech_read, 0, 3);
      organRead = clampNumber(tech.organRead ?? tech.organ_read, 0, 3);
    }

    // Если trlStage не задан — пробуем вывести его из статуса, иначе считаем TRL неизвестным.
    // TRL остается общим для всех предприятий
    let trlStage = tech.trlStage;
    if (trlStage === undefined || trlStage === null) {
      const status = (tech.status || tech.level || '').toString().toLowerCase();
      if (!status) {
        trlStage = null;
      } else if (status.includes('перспектив')) {
        trlStage = 1;
      } else if (status.includes('внедряем')) {
        trlStage = 2;
      } else {
        // Используемые / Существующие и любые «боевые» статусы
        trlStage = 3;
      }
    }
    const trlNum = trlStage == null ? null : clampNumber(trlStage, 1, 3);

    const orgN = organRead / 3;
    const techN = techRead / 3;
    const trlN = trlNum == null ? null : (trlNum - 1) / 2;

    return { orgN, techN, trlN, techRead, organRead, trlStage: trlNum };
  }

  /**
   * Вычисление приоритета технологии в диапазоне [0,1].
   * model:
   *  - 'avg'  – среднее трёх нормализованных показателей;
   *  - 'min'  – «слабое звено», минимум из трёх;
   *  - 'mult' – мультипликативная модель (по умолчанию).
   * company - опциональный параметр для указания предприятия (для использования индивидуальных оценок)
   * Если каких‑то данных нет (особенно TRL), функция возвращает null.
   */
  function computePriority(tech, model = 'mult', company = null) {
    // Если не указано предприятие, но есть текущее предприятие и технология с несколькими предприятиями, используем его
    const getCurrentEnterprise = window.getCurrentEnterprise || (() => window.currentEnterprise);
    const currentEnterprise = getCurrentEnterprise();
    if (!company && currentEnterprise &&
        Array.isArray(tech.company) && tech.company.includes(currentEnterprise)) {
      company = currentEnterprise;
    }

    const { orgN, techN, trlN } = getNormalizedReadinessAndTrl(tech, company);
    if (trlN == null || Number.isNaN(orgN) || Number.isNaN(techN)) return null;

    switch (model) {
      case 'avg':
        return (orgN + techN + trlN) / 3;
      case 'min':
        return Math.min(orgN, techN, trlN);
      case 'mult':
      default:
        return orgN * techN * trlN;
    }
  }

  /**
   * Категория приоритета по порогам:
   * 0–0.3  → low
   * 0.3–0.6 → medium
   * 0.6–1.0 → high
   */
  function getPriorityCategory(priority) {
    if (priority == null || Number.isNaN(priority)) {
      return { key: 'none', label: 'нет данных', description: 'Недостаточно данных для расчёта приоритета.' };
    }
    const p = Math.max(0, Math.min(1, Number(priority)));
    if (p < 0.3) {
      return {
        key: 'low',
        label: 'низкий',
        description: 'Низкий приоритет: технологию можно отложить и наблюдать за развитием.'
      };
    }
    if (p < 0.6) {
      return {
        key: 'medium',
        label: 'средний',
        description: 'Средний приоритет: уместны пилоты и проработка бизнес‑кейсов.'
      };
    }
    return {
      key: 'high',
      label: 'высокий',
      description: 'Высокий приоритет: стоит активно искать кейсы внедрения и масштабирования.'
    };
  }

  /**
   * Определение «слабого звена» для комментария.
   */
  function getPriorityWeakLinkComment(tech, company = null) {
    // Если не указано предприятие, но есть текущее предприятие и технология с несколькими предприятиями, используем его
    const getCurrentEnterprise = window.getCurrentEnterprise || (() => window.currentEnterprise);
    const currentEnterprise = getCurrentEnterprise();
    if (!company && typeof currentEnterprise !== 'undefined' && currentEnterprise &&
        Array.isArray(tech.company) && tech.company.includes(currentEnterprise)) {
      company = currentEnterprise;
    }

    const { orgN, techN, trlN, techRead, organRead, trlStage } = getNormalizedReadinessAndTrl(tech, company);
    if (trlN == null) {
      return 'Заполните TRL для более точной оценки приоритета.';
    }
    const values = [
      { key: 'org', v: orgN, raw: organRead, label: 'организационная готовность' },
      { key: 'tech', v: techN, raw: techRead, label: 'технологическая готовность' },
      { key: 'trl', v: trlN, raw: trlStage, label: 'TRL' }
    ];
    values.sort((a, b) => a.v - b.v);
    const weakest = values[0];

    if (weakest.key === 'org') {
      return 'Слабое звено: организационная готовность — нужна подготовка процессов и команды.';
    }
    if (weakest.key === 'tech') {
      return 'Слабое звено: технологическая готовность — важно доработать прототипы и архитектуру.';
    }
    return 'Слабое звено: стадия TRL — технология ещё на ранней исследовательской стадии.';
  }

  /**
   * Пересчет списка приоритетов для квадранта
   */
  function recomputeQuadrantPriorityList(qId) {
    // Получаем элементы через DOMCache или напрямую
    const quadrantPriorityPanel = document.getElementById('quadrantPriorityPanel');
    const qpListEl = quadrantPriorityPanel ? quadrantPriorityPanel.querySelector('#qpList') : null;
    if (!quadrantPriorityPanel || !qpListEl) return;

    // Используем функции из RMK2.js через window или глобальные переменные
    const getTechnologiesForQuadrant = window.getTechnologiesForQuadrant || (() => []);
    const getFilterValues = window.getFilterValues || Filters?.getFilterValues || (() => []);
    const getQuadrantName = window.getQuadrantName || (() => `Сектор ${qId}`);
    const getTechStatus = window.getTechStatus || ((tech) => (tech.status || tech.level || '').toString());
    const getHoverText = window.getHoverText || (() => '');
    const showDetail = window.showDetail || (() => {});
    const getCurrentZoomedQuadrant = window.getCurrentZoomedQuadrant || (() => null);
    const setCurrentTech = window.setCurrentTech || (() => {});

    // Получаем глобальные переменные
    const svg = window.svg || document.getElementById('techRadar');
    const hoverLabel = window.hoverLabel || document.getElementById('hoverLabel');
    const searchInput = window.searchInput || document.getElementById('searchInput');
    const qpSearchInput = document.getElementById('qpSearchInput');
    const detailPanel = window.detailPanel || document.getElementById('detailPanel');
    const currentZoomedQuadrant = getCurrentZoomedQuadrant();

    const allTechs = getTechnologiesForQuadrant(qId);
    if (!allTechs.length) {
      qpListEl.innerHTML = '<p style="font-size:12px; opacity:0.8;">В этом секторе пока нет технологий.</p>';
      return;
    }

    // Учитываем фильтры из левой панели и строку поиска
    const b = getFilterValues('block');
    const f = getFilterValues('function');
    const tt = getFilterValues('techType');
    const l = getFilterValues('level');
    // Поиск: используем поле поиска в панели приоритетов (qpSearchInput) или основной поиск (searchInput)
    const qpQuery = (qpSearchInput && qpSearchInput.value ? qpSearchInput.value : '').toLowerCase().trim();
    const sidebarQuery = (searchInput && searchInput.value ? searchInput.value : '').toLowerCase().trim();
    const textQuery = qpQuery || sidebarQuery;

    let sidebarFilteredTechs = allTechs.filter(t => {
      // Фильтр по блокам (t.block или t.blocks)
      if (b.length > 0) {
        const techBlocks = t.blocks && Array.isArray(t.blocks) ? t.blocks : (t.block ? [t.block] : []);
        if (!techBlocks.some(block => b.includes(block))) return false;
      }
      // Фильтр по функциям (t.func или t.functions)
      if (f.length > 0) {
        const techFunctions = t.functions && Array.isArray(t.functions) ? t.functions : (t.func ? [t.func] : []);
        if (!techFunctions.some(func => f.includes(func))) return false;
      }
      // Фильтр по типу технологии
      if (tt.length > 0 && !tt.includes(t.techType)) return false;
      // Фильтр по статусу/уровню
      if (l.length > 0 && !l.includes(t.level)) return false;
      return true;
    });

    // Текстовый поиск
    if (textQuery) {
      sidebarFilteredTechs = sidebarFilteredTechs.filter(t => {
        const fields = [
          String(t.name || ''),
          String(t.description || ''),
          String(t.block || ''),
          ...(t.blocks || []),
          String(t.func || ''),
          ...(t.functions || []),
          String(t.techType || ''),
          String(t.level || ''),
          String(t.id || '')
        ];
        return fields.some(fld => fld.toLowerCase().includes(textQuery));
      });
    }

    if (!sidebarFilteredTechs.length) {
      qpListEl.innerHTML = '<p style="font-size:12px; opacity:0.8;">В этом секторе нет технологий, соответствующих текущим фильтрам.</p>';
      const qpSummaryEl = quadrantPriorityPanel.querySelector('#qpSummary');
      if (qpSummaryEl) qpSummaryEl.textContent = '';
      return;
    }

    // Фильтрация по статусам на панели
    // Сначала синхронизируем кнопки статусов с фильтром "Статус" в левой панели
    const sidebarLevels = getFilterValues('level');
    const statusButtons = Array.from(quadrantPriorityPanel.querySelectorAll('.qp-filter-btn'));

    if (sidebarLevels && sidebarLevels.length > 0) {
      statusButtons.forEach(btn => {
        const st = btn.getAttribute('data-status');
        if (!st) return;
        // В модалке подсвечиваем только те статусы, которые выбраны в фильтре слева
        btn.classList.toggle('active', sidebarLevels.includes(st));
      });
    } else if (!statusButtons.some(btn => btn.classList.contains('active'))) {
      // Если в фильтре слева статусы не заданы и в модалке ничего не активно —
      // по умолчанию считаем все статусы активными
      statusButtons.forEach(btn => btn.classList.add('active'));
    }

    const activeStatuses = statusButtons
      .filter(btn => btn.classList.contains('active'))
      .map(btn => btn.getAttribute('data-status'));

    const filteredTechs = sidebarFilteredTechs.filter(t => {
      const st = getTechStatus(t);
      if (!activeStatuses.length) return true;
      return activeStatuses.some(s => st.includes(s));
    });

    // Строим список технологий с приоритетами
    qpListEl.innerHTML = '';

    const stats = { low: 0, medium: 0, high: 0, all: 0, sumPriority: 0 };

    filteredTechs.forEach(t => {
      const priority = computePriority(t, 'mult');
      const category = getPriorityCategory(priority);
      const percent = priority == null ? null : Math.round(priority * 100);

      if (priority != null && !Number.isNaN(priority)) {
        stats.all += 1;
        stats.sumPriority += priority;
        if (category.key === 'low') stats.low += 1;
        else if (category.key === 'medium') stats.medium += 1;
        else if (category.key === 'high') stats.high += 1;
      }

      const item = document.createElement('div');
      item.className = 'qp-item';
      item.dataset.techId = t.id;

      if (category.key === 'low') item.classList.add('priority-low');
      else if (category.key === 'medium') item.classList.add('priority-medium');
      else if (category.key === 'high') item.classList.add('priority-high');

      const titleEl = document.createElement('div');
      titleEl.className = 'qp-item-title';
      titleEl.textContent = t.name || 'Без названия';

      // Заголовок элемента с кнопкой-стрелкой для сворачивания/разворачивания описания
      const headerEl = document.createElement('div');
      headerEl.className = 'qp-item-header';

      const toggleBtn = document.createElement('button');
      toggleBtn.type = 'button';
      toggleBtn.className = 'qp-item-toggle';
      toggleBtn.setAttribute('aria-label', 'Показать описание технологии');
      toggleBtn.setAttribute('aria-expanded', 'false');

      const arrowSpan = document.createElement('span');
      arrowSpan.className = 'qp-item-arrow';
      arrowSpan.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" focusable="false">
          <polyline points="3 4 6 7 9 4"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round" />
        </svg>
      `;

      toggleBtn.appendChild(arrowSpan);
      headerEl.appendChild(toggleBtn);
      headerEl.appendChild(titleEl);

      const prEl = document.createElement('div');
      prEl.className = 'qp-item-priority';
      if (percent == null) {
        prEl.textContent = 'Приоритет: нет данных';
      } else {
        prEl.textContent = `Приоритет: ${percent}% (${category.label})`;
      }

      const commentEl = document.createElement('div');
      commentEl.className = 'qp-item-comment';
      commentEl.textContent = (priority == null ? category.description : getPriorityWeakLinkComment(t));

      const detailsEl = document.createElement('div');
      detailsEl.className = 'qp-item-details';
      detailsEl.appendChild(prEl);
      detailsEl.appendChild(commentEl);

      item.appendChild(headerEl);
      item.appendChild(detailsEl);

      // Наведение и клик синхронизируют blip и detailPanel
      item.addEventListener('mouseenter', () => {
        // Подсвечиваем элемент в модальном окне
        qpListEl.querySelectorAll('.qp-item').forEach(el => el.classList.remove('highlighted'));
        item.classList.add('highlighted');

        // Находим все blip для этой технологии (может быть несколько в разных квадрантах)
        if (svg) {
          const allBlips = svg.querySelectorAll(`.blip[data-id="${t.id}"]`);
          svg.querySelectorAll('.blip').forEach(el => el.classList.remove('highlighted'));

          if (allBlips.length > 0) {
            // Если есть зуммированный квадрант, предпочитаем blip из него
            let targetBlip = null;
            if (currentZoomedQuadrant !== null) {
              targetBlip = Array.from(allBlips).find(b => {
                const blipQuadrant = b.dataset.quadrant ? +b.dataset.quadrant : null;
                return blipQuadrant === currentZoomedQuadrant;
              });
            }
            // Если не нашли в зуммированном квадранте, берем первый
            if (!targetBlip) {
              targetBlip = allBlips[0];
            }

            targetBlip.classList.add('highlighted');

            // Точное позиционирование подсказки на blip
            if (hoverLabel) {
              const rect = targetBlip.getBoundingClientRect();
              const svgRect = svg.getBoundingClientRect();
              const text = getHoverText(t);
              hoverLabel.textContent = text;
              hoverLabel.classList.remove('priority-low', 'priority-medium', 'priority-high');
              // Позиционируем подсказку точно над blip по центру
              hoverLabel.style.left = `${rect.left + rect.width / 2 - svgRect.left}px`;
              hoverLabel.style.top = `${rect.top - svgRect.top}px`;
              hoverLabel.classList.add('visible');
            }
          }
        }
      });

      item.addEventListener('mouseleave', () => {
        if (svg) {
          svg.querySelectorAll('.blip').forEach(el => el.classList.remove('highlighted'));
        }
        qpListEl.querySelectorAll('.qp-item').forEach(el => el.classList.remove('highlighted'));
        if (hoverLabel) {
          hoverLabel.classList.remove('visible');
        }
      });

      // Клик по стрелке разворачивает/сворачивает описание, не открывая детали
      toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const expanded = item.classList.toggle('expanded');
        toggleBtn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      });

      // Клик по технологии в списке приоритета:
      //  - открывает панель подробной информации
      //  - скрывает панель приоритета
      //  - не сбрасывает зум сектора
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        setCurrentTech(t);
        if (detailPanel) {
          // Открываем детали с пометкой, что источник — панель приоритетов
          // Передаем текущий зуммированный квадрант, чтобы сохранить зум
          showDetail(t, 'priority', qId);
        } else {
          console.warn('recomputeQuadrantPriorityList: detailPanel не найден при клике по технологии');
        }
        // Скрываем панель приоритета, но НЕ вызываем unzoom(),
        // чтобы зум сектора сохранился.
        window.closeQuadrantPriorityPanel();
      });

      qpListEl.appendChild(item);
    });

    // Ранее здесь обновлялась текстовая сводка по приоритетам в элементе qpSummary.
    // Элемент и связанные с ним тексты удалены по требованию, поэтому дополнительная
    // текстовая сводка больше не отображается.
  }

  /**
   * Открытие панели приоритетов квадранта
   */
  function openQuadrantPriorityPanel(qId) {
    const quadrantPriorityPanel = document.getElementById('quadrantPriorityPanel');
    if (!quadrantPriorityPanel) return;
    quadrantPriorityPanel.classList.add('open');
    quadrantPriorityPanel.setAttribute('aria-hidden', 'false');

    const qpTitleEl = quadrantPriorityPanel.querySelector('#qpTitle');
    const getQuadrantName = window.getQuadrantName || (() => `Сектор ${qId}`);
    const getFilterValues = window.getFilterValues || Filters?.getFilterValues || (() => []);

    if (qpTitleEl) {
      qpTitleEl.textContent = `Приоритет технологий: ${getQuadrantName(qId)}`;
    }
    // Синхронизируем статусы панели с фильтром "Статус" из левой панели
    const sidebarLevels = getFilterValues('level');
    const statusButtons = quadrantPriorityPanel.querySelectorAll('.qp-filter-btn');
    if (sidebarLevels && sidebarLevels.length > 0) {
      statusButtons.forEach(btn => {
        const st = btn.getAttribute('data-status');
        if (!st) return;
        btn.classList.toggle('active', sidebarLevels.includes(st));
      });
    } else {
      // Если фильтр статуса не задан — по умолчанию все три статуса активны
      statusButtons.forEach(btn => btn.classList.add('active'));
    }
    recomputeQuadrantPriorityList(qId);
  }

  /**
   * Закрытие панели приоритетов квадранта
   */
  function closeQuadrantPriorityPanel() {
    const quadrantPriorityPanel = document.getElementById('quadrantPriorityPanel');
    if (!quadrantPriorityPanel) return;
    quadrantPriorityPanel.classList.remove('open');
    quadrantPriorityPanel.setAttribute('aria-hidden', 'true');
    const qpListEl = quadrantPriorityPanel.querySelector('#qpList');
    if (qpListEl) qpListEl.innerHTML = '';
    // Очищаем поле поиска при закрытии панели
    const qpSearchInput = document.getElementById('qpSearchInput');
    if (qpSearchInput) qpSearchInput.value = '';
  }

  // Экспорт функций в window.Priorities и window для обратной совместимости
  window.Priorities = {
    computePriority,
    getPriorityCategory,
    getPriorityWeakLinkComment,
    getNormalizedReadinessAndTrl,
    recomputeQuadrantPriorityList,
    openQuadrantPriorityPanel,
    closeQuadrantPriorityPanel
  };

  // Экспорт в window для глобального доступа (обратная совместимость)
  window.computePriority = computePriority;
  window.getPriorityCategory = getPriorityCategory;
  window.getPriorityWeakLinkComment = getPriorityWeakLinkComment;
  window.getNormalizedReadinessAndTrl = getNormalizedReadinessAndTrl;
  window.recomputeQuadrantPriorityList = recomputeQuadrantPriorityList;
  window.openQuadrantPriorityPanel = openQuadrantPriorityPanel;
  window.closeQuadrantPriorityPanel = closeQuadrantPriorityPanel;
})();
