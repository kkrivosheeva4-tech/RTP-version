// Модуль работы с приоритетами технологий

import Logger from '../core/logger.js';
import FactorEngine from '../radar/factor-engine.js';

'use strict';

  const FACTOR_LABELS = {
    techRead: 'технологическая готовность',
    organRead: 'организационная готовность',
    funcCover: 'покрытие функций',
    trlStage: 'TRL',
    implementationCostPressure: 'стоимость внедрения',
    integrationRisk: 'интеграционные риски',
    integrationComplexity: 'интеграционная сложность'
  };

  const WEAK_LINK_COMMENTS = {
    techRead: 'Слабое звено: технологическая готовность. Важно доработать прототипы и архитектуру.',
    organRead: 'Слабое звено: организационная готовность. Нужна подготовка процессов, команды и владельцев.',
    funcCover: 'Слабое звено: покрытие функций. Технология пока закрывает недостаточно целевых задач.',
    trlStage: 'Слабое звено: стадия TRL. Технология еще находится на ранней стадии зрелости.',
    implementationCostPressure: 'Слабое звено: высокая стоимость внедрения. Нужна проработка экономического эффекта и масштаба проекта.',
    integrationRisk: 'Слабое звено: интеграционные риски. Требуется снижение рисков стыковки с текущим ландшафтом.',
    integrationComplexity: 'Слабое звено: интеграционная сложность. Нужна декомпозиция интеграционного контура и зависимостей.'
  };

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

  function getModelConfig() {
    return (typeof window !== 'undefined' && window.RadarModelConfig)
      ? window.RadarModelConfig
      : {};
  }

  function resolveCompanyForTech(tech, company = null) {
    const getCurrentEnterprise = window.getCurrentEnterprise || (() => (window.StateManager && window.StateManager.get ? window.StateManager.get('currentEnterprise') : undefined));
    const currentEnterprise = getCurrentEnterprise();
    if (!company && currentEnterprise &&
      Array.isArray(tech.company) && tech.company.includes(currentEnterprise)) {
      return currentEnterprise;
    }
    return company;
  }

  function resolveFunctionCoverageValue(tech) {
    if (tech && tech.funcCover !== undefined && tech.funcCover !== null && tech.funcCover !== '') {
      return tech.funcCover;
    }
    if (Array.isArray(tech && tech.functionCoverage)) {
      return Math.max(0, Math.min(3, tech.functionCoverage.length));
    }
    return null;
  }

  function hasMeaningfulValue(value) {
    return value !== undefined && value !== null && String(value).trim() !== '';
  }

  function getCompanyRatingsForPriority(tech, company = null) {
    if (!company || !tech || !tech.companyRatings || typeof tech.companyRatings !== 'object') {
      return null;
    }
    return tech.companyRatings[company] || null;
  }

  function getPriorityReadinessSources(tech, company = null) {
    const ratings = getCompanyRatingsForPriority(tech, company);
    const rawTechRead = ratings && hasMeaningfulValue(ratings.techRead)
      ? ratings.techRead
      : (hasMeaningfulValue(tech && (tech.techRead ?? tech.tech_read)) ? (tech.techRead ?? tech.tech_read) : null);
    const rawOrganRead = ratings && hasMeaningfulValue(ratings.organRead)
      ? ratings.organRead
      : (hasMeaningfulValue(tech && (tech.organRead ?? tech.organ_read)) ? (tech.organRead ?? tech.organ_read) : null);

    return {
      techRead: rawTechRead == null ? null : clampNumber(rawTechRead, 0, 3),
      organRead: rawOrganRead == null ? null : clampNumber(rawOrganRead, 0, 3),
      hasTechRead: rawTechRead != null,
      hasOrganRead: rawOrganRead != null
    };
  }

  function calculatePriorityResult(tech, company = null) {
    const resolvedCompany = resolveCompanyForTech(tech, company);
    const readiness = getNormalizedReadinessAndTrl(tech, resolvedCompany);
    const readinessSources = getPriorityReadinessSources(tech, resolvedCompany);
    const funcCover = resolveFunctionCoverageValue(tech);
    const hasFunctionCoverage = Array.isArray(tech && tech.functionCoverage) && tech.functionCoverage.length > 0;
    const hasFuncCoverField = tech && tech.funcCover !== undefined && tech.funcCover !== null && tech.funcCover !== '';

    return FactorEngine.calculateReadinessIndex({
      tech,
      modelConfig: getModelConfig(),
      rawFactors: {
        techRead: readinessSources.techRead,
        organRead: readinessSources.organRead,
        funcCover,
        trlStage: readiness.trlStage
      },
      availability: {
        techRead: readinessSources.hasTechRead,
        organRead: readinessSources.hasOrganRead,
        funcCover: hasFuncCoverField || hasFunctionCoverage,
        // Для совместимости с positioning TRL доступен через fallback baseline-конфига.
        trlStage: true
      },
      logger: Logger
    });
  }

  function formatMissingFactors(ids) {
    return ids
      .map((id) => FACTOR_LABELS[id] || id)
      .filter(Boolean)
      .join(', ');
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
  function computePriority(tech, model = 'weighted', company = null) {
    const factorResult = calculatePriorityResult(tech, company);
    if (!factorResult || factorResult.insufficientData || !Array.isArray(factorResult.contributions) || factorResult.contributions.length === 0) {
      return null;
    }

    const effectiveValues = factorResult.contributions.map((item) => item.effective);
    switch (model) {
      case 'avg':
        return effectiveValues.reduce((sum, value) => sum + value, 0) / effectiveValues.length;
      case 'min':
        return Math.min(...effectiveValues);
      case 'mult':
        return effectiveValues.reduce((acc, value) => acc * value, 1);
      case 'weighted':
      default:
        return factorResult.z;
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
    const factorResult = calculatePriorityResult(tech, company);
    if (!factorResult) {
      return 'Недостаточно данных для расчета приоритета.';
    }
    if (factorResult.insufficientData && factorResult.missingFactors.length > 0) {
      return `Недостаточно данных: заполните ${formatMissingFactors(factorResult.missingFactors)}.`;
    }
    if (!Array.isArray(factorResult.contributions) || factorResult.contributions.length === 0) {
      return 'Недостаточно данных для расчета приоритета.';
    }

    const weakest = [...factorResult.contributions].sort((a, b) => a.effective - b.effective)[0];
    return WEAK_LINK_COMMENTS[weakest.id] || `Слабое звено: ${FACTOR_LABELS[weakest.id] || weakest.id}.`;
  }

  /**
   * Определяет, внедрена ли технология на всех предприятиях.
   * Если на одном внедрена, на других нет — возвращает false (показываем в «Невнедренные»).
   */
  function isFullyImplemented(tech) {
    const companies = Array.isArray(tech.company) ? tech.company : (tech.company ? [tech.company] : []);
    if (companies.length === 0) {
      const statusLower = String(tech.status || tech.level || '').trim().toLowerCase();
      return tech.isImplemented === true || statusLower === 'внедрена' || statusLower === 'внедренна';
    }
    if (companies.length === 1 && tech.companyRatings && typeof tech.companyRatings === 'object') {
      const ratings = tech.companyRatings[companies[0]];
      return ratings && ratings.isImplemented === true;
    }
    if (companies.length > 1 && tech.companyRatings && typeof tech.companyRatings === 'object') {
      return companies.every(company => {
        const ratings = tech.companyRatings[company];
        return ratings && ratings.isImplemented === true;
      });
    }
    return tech.isImplemented === true;
  }

  /**
   * Определяет, внедрена ли технология хотя бы на одном предприятии.
   * Используется для фильтра «Внедренные» в модальном окне приоритетов.
   */
  function isImplementedAtAnyCompany(tech) {
    const companies = Array.isArray(tech.company) ? tech.company : (tech.company ? [tech.company] : []);
    if (companies.length === 0) {
      const statusLower = String(tech.status || tech.level || '').trim().toLowerCase();
      return tech.isImplemented === true || statusLower === 'внедрена' || statusLower === 'внедренна';
    }
    if (tech.companyRatings && typeof tech.companyRatings === 'object') {
      return companies.some(company => {
        const ratings = tech.companyRatings[company];
        return ratings && ratings.isImplemented === true;
      });
    }
    return tech.isImplemented === true;
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
    // showDetail будет получена в момент клика из window
    const getCurrentZoomedQuadrant = window.getCurrentZoomedQuadrant || (() => null);
    const setCurrentTech = window.setCurrentTech || (() => { });

    // Получаем глобальные переменные
    const svg = window.svg || document.getElementById('techRadar');
    const hoverLabel = window.hoverLabel || document.getElementById('hoverLabel');
    const searchInput = window.searchInput || document.getElementById('searchInput');
    const qpSearchInput = document.getElementById('qpSearchInput');
    // detailPanel будет получен в момент клика через DOMCache или getElementById
    const currentZoomedQuadrant = getCurrentZoomedQuadrant();

    const allTechs = getTechnologiesForQuadrant(qId);
    if (!allTechs.length) {
      qpListEl.innerHTML = '<p style="font-size:12px; opacity:0.8;">В этом секторе пока нет технологий.</p>';
      return;
    }

    // Учитываем фильтры из левой панели (логика должна совпадать с radar-update.js для соответствия радара и модального окна)
    const e = getFilterValues('enterprise');
    const d = getFilterValues('direction');
    const b = getFilterValues('block');
    const f = getFilterValues('function');
    const l = getFilterValues('level');
    // Поиск: используем поле поиска в панели приоритетов (qpSearchInput) или основной поиск (searchInput)
    const qpQuery = (qpSearchInput && qpSearchInput.value ? qpSearchInput.value : '').toLowerCase().trim();
    const sidebarQuery = (searchInput && searchInput.value ? searchInput.value : '').toLowerCase().trim();
    const textQuery = qpQuery || sidebarQuery;

    let sidebarFilteredTechs = allTechs.filter(t => {
      // Фильтр по предприятию (как на радаре)
      if (e.length > 0) {
        const isHoldingWide = t.holdingWide === true || t.holdingWide === 'true';
        if (!isHoldingWide) {
          const techCompanies = Array.isArray(t.company) ? t.company : (t.company ? [t.company] : []);
          if (techCompanies.length === 0 || !techCompanies.some(company => e.includes(company))) return false;
        }
      }
      // Фильтр по направлениям (t.directions или t.direction)
      if (d.length > 0) {
        const techDirections = t.directions && Array.isArray(t.directions) ? t.directions : (t.direction ? [t.direction] : []);
        if (!techDirections.some(direction => d.includes(direction))) return false;
      }
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
      // Фильтр по статусу (Внедренная/Невнедренная): логика как в radar-update.js — внедрена хотя бы на одном предприятии
      if (l.length > 0) {
        const statusValue = isImplementedAtAnyCompany(t) ? 'Внедренная' : 'Невнедренная';
        if (!l.includes(statusValue)) return false;
      }
      return true;
    });

    // Текстовый поиск (набор полей как в radar-update.js)
    if (textQuery) {
      sidebarFilteredTechs = sidebarFilteredTechs.filter(t => {
        const fields = [
          String(t.name || ''),
          String(t.description || ''),
          String(t.direction || ''),
          ...(t.directions && Array.isArray(t.directions) ? t.directions : []),
          String(t.block || ''),
          ...(t.blocks || []),
          String(t.func || ''),
          ...(t.functions || []),
          String(t.techType || ''),
          String(t.level || ''),
          String(t.id || '')
        ].map(fld => String(fld || '').toLowerCase());
        return fields.some(fld => fld.includes(textQuery));
      });
    }

    if (!sidebarFilteredTechs.length) {
      qpListEl.innerHTML = '<p style="font-size:12px; opacity:0.8;">В этом секторе нет технологий, соответствующих текущим фильтрам.</p>';
      return;
    }

    // В модальном окне показываем все технологии зуммированного квадранта, прошедшие фильтры боковой панели
    // (без отдельной фильтрации по статусу внедрения внутри модального окна)
    const filteredTechs = sidebarFilteredTechs;

    // Сортируем по названию по алфавиту (русская локаль)
    filteredTechs.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ru'));

    // Строим список технологий
    qpListEl.innerHTML = '';

    filteredTechs.forEach(t => {
      const item = document.createElement('div');
      item.className = 'qp-item';
      item.dataset.techId = t.id;

      const titleEl = document.createElement('div');
      titleEl.className = 'qp-item-title';
      titleEl.textContent = t.name || 'Без названия';

      item.appendChild(titleEl);

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

      // Клик по технологии в списке:
      //  - открывает панель подробной информации
      //  - скрывает панель приоритета
      //  - не сбрасывает зум сектора
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        setCurrentTech(t);
        // Получаем showDetail из window в момент клика, а не при создании элемента
        const showDetailFn = (typeof window.showDetail === 'function') ? window.showDetail : null;
        // Получаем detailPanel через DOMCache или напрямую в момент клика
        const DOMCache = window.DOMCache;
        const detailPanelEl = (DOMCache && typeof DOMCache.get === 'function')
          ? DOMCache.get('detailPanel')
          : (document.getElementById('detailPanel'));
        if (detailPanelEl && showDetailFn) {
          // Открываем детали с пометкой, что источник — панель приоритетов
          // Передаем текущий зуммированный квадрант, чтобы сохранить зум
          showDetailFn(t, 'priority', qId);
        } else {
          if (!detailPanelEl) {
        if (Logger && typeof Logger.warn === 'function') {
          Logger.warn('recomputeQuadrantPriorityList: detailPanel не найден при клике по технологии', { techId: t.id, techName: t.name });
        }
      }
      if (!showDetailFn) {
        if (Logger && typeof Logger.warn === 'function') {
          Logger.warn('recomputeQuadrantPriorityList: showDetail не доступна при клике по технологии', { techId: t.id, techName: t.name });
        }
      }
        }
        // Скрываем панель приоритета, но НЕ вызываем unzoom(),
        // чтобы зум сектора сохранился.
        window.closeQuadrantPriorityPanel();
      });

      qpListEl.appendChild(item);
    });
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

    if (qpTitleEl) {
      qpTitleEl.textContent = `${getQuadrantName(qId)}`;
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

  // Экспорт в window для глобального доступа (обратная совместимость)
  const Priorities = {
    computePriority,
    getPriorityCategory,
    getPriorityWeakLinkComment,
    getNormalizedReadinessAndTrl,
    recomputeQuadrantPriorityList,
    openQuadrantPriorityPanel,
    closeQuadrantPriorityPanel
  };

  if (typeof window !== 'undefined') {
    window.Priorities = Priorities;
    window.computePriority = computePriority;
    window.getPriorityCategory = getPriorityCategory;
    window.getPriorityWeakLinkComment = getPriorityWeakLinkComment;
    window.getNormalizedReadinessAndTrl = getNormalizedReadinessAndTrl;
    window.recomputeQuadrantPriorityList = recomputeQuadrantPriorityList;
    window.openQuadrantPriorityPanel = openQuadrantPriorityPanel;
    window.closeQuadrantPriorityPanel = closeQuadrantPriorityPanel;
  }

  export default Priorities;
  export {
    computePriority,
    getPriorityCategory,
    getPriorityWeakLinkComment,
    getNormalizedReadinessAndTrl,
    recomputeQuadrantPriorityList,
    openQuadrantPriorityPanel,
    closeQuadrantPriorityPanel
  };
