// Модуль рендеринга радара технологий
// Экспортирует функции в window.RadarRenderer для использования в RMK2.js
// Использует глобальные переменные из RMK2.js и функции из других модулей

(function() {
  'use strict';

  // Флаг отрисовки фона (один раз за сессию)
  let radarBackgroundRendered = false;

  // Форма по типу технологии
  // Все технологии отображаются кругами для единообразия
  function computeShapeByTechType(techType, TECHTYPE_TO_SHAPE) {
    return 'circle';
  }

  // Отрисовка фона радара (секторы, кольца, подписи)
  function renderRadarBackground(config) {
    const {
      SVG_NS, CENTER_X, CENTER_Y, RADIUS_STEP, RINGS, QUADRANTS,
      RING_LABEL_WIDTH, RING_LABEL_HEIGHT, svg, clearQuadrantGroupsCache,
      polarToCartesian, describeArc, describeWedge
    } = config;

    if (radarBackgroundRendered) return;

    // Проверяем, является ли это директорской страницей
    const isDirectorPage = document.body.id === 'rmk-director';

    // Создаем ringLabelsGroup (добавим его в SVG после секторов) только для обычной страницы
    if (!isDirectorPage) {
      const ringLabels = document.createElementNS(SVG_NS, "g");
      ringLabels.id = "ringLabelsGroup";
      RINGS.forEach((name, i) => {
        const r = (i + 1) * RADIUS_STEP;
        const pos = polarToCartesian(CENTER_X, CENTER_Y, r, 0);
        const labelGroup = document.createElementNS(SVG_NS, "g");
        labelGroup.setAttribute("transform", `translate(${pos.x}, ${pos.y})`);
        const bg = document.createElementNS(SVG_NS, "rect");
        bg.classList.add("ring-label-bg");
        const width = RING_LABEL_WIDTH;
        const height = RING_LABEL_HEIGHT;
        bg.setAttribute("x", -width / 2);
        bg.setAttribute("y", -height / 2);
        bg.setAttribute("width", width);
        bg.setAttribute("height", height);
        const txt = document.createElementNS(SVG_NS, "text");
        txt.classList.add("ring-label");
        txt.setAttribute("x", 0);
        txt.setAttribute("y", 0);
        txt.setAttribute("dominant-baseline", "middle");
        txt.setAttribute("text-anchor", "middle");
        txt.textContent = name;
        labelGroup.appendChild(bg);
        labelGroup.appendChild(txt);
        ringLabels.appendChild(labelGroup);
      });
      // Добавляем группу подписей колец ПОСЛЕ секторов (будет добавлено позже)
      window.ringLabelsGroup = ringLabels;
    }

    // Создаем и добавляем quadrant-group (фон радара и линии)
    QUADRANTS.forEach((q) => {
      const g = document.createElementNS(SVG_NS, "g");
      g.classList.add("quadrant-group", `q${q.id}`);
      g.dataset.quadrant = q.id;
      const maxR = RINGS.length * RADIUS_STEP;
      const wedge = document.createElementNS(SVG_NS, "path");
      wedge.setAttribute("d", describeWedge(CENTER_X, CENTER_Y, maxR, q.startAngle, q.startAngle + 90));
      wedge.classList.add("quadrant-bg");
      g.appendChild(wedge);
      for (let i = 1; i <= RINGS.length; i++) {
        const arc = document.createElementNS(SVG_NS, "path");
        arc.setAttribute("d", describeArc(CENTER_X, CENTER_Y, i * RADIUS_STEP, q.startAngle, q.startAngle + 90));
        arc.classList.add("radar-arc");
        g.appendChild(arc);
      }
      const p1 = polarToCartesian(CENTER_X, CENTER_Y, maxR, q.startAngle);
      const p2 = polarToCartesian(CENTER_X, CENTER_Y, maxR, q.startAngle + 90);
      [p1, p2].forEach((p) => {
        const line = document.createElementNS(SVG_NS, "line");
        line.setAttribute("x1", CENTER_X);
        line.setAttribute("y1", CENTER_Y);
        line.setAttribute("x2", p.x);
        line.setAttribute("y2", p.y);
        line.classList.add("radar-line");
        g.appendChild(line);
      });

      // Добавляем подпись сектора по диагонали от центра, вне радара
      const sectorCenterAngle = q.startAngle + 45;
      const sectorLabelRadius = maxR * 1.25;
      const sectorLabelPos = polarToCartesian(CENTER_X, CENTER_Y, sectorLabelRadius, sectorCenterAngle);

      const sectorLabelGroup = document.createElementNS(SVG_NS, "g");
      sectorLabelGroup.classList.add("sector-label-group");
      sectorLabelGroup.setAttribute("transform", `translate(${sectorLabelPos.x}, ${sectorLabelPos.y})`);

      const sectorLabelText = document.createElementNS(SVG_NS, "text");
      sectorLabelText.classList.add("sector-label");
      sectorLabelText.setAttribute("x", 0);
      sectorLabelText.setAttribute("y", 0);
      sectorLabelText.setAttribute("dominant-baseline", "middle");
      sectorLabelText.setAttribute("text-anchor", "middle");

      // Разбиваем длинный текст на строки
      const words = q.name.split(' ');
      const maxCharsPerLine = 25;
      let currentLine = '';
      const lines = [];

      words.forEach(word => {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        if (testLine.length <= maxCharsPerLine) {
          currentLine = testLine;
        } else {
          if (currentLine) lines.push(currentLine);
          currentLine = word;
        }
      });
      if (currentLine) lines.push(currentLine);

      if (lines.length === 1) {
        sectorLabelText.textContent = lines[0];
      } else {
        lines.forEach((line, idx) => {
          const tspan = document.createElementNS(SVG_NS, "tspan");
          tspan.setAttribute("x", 0);
          tspan.setAttribute("dy", idx === 0 ? "-0.6em" : "1.2em");
          tspan.textContent = line;
          sectorLabelText.appendChild(tspan);
        });
      }

      sectorLabelGroup.appendChild(sectorLabelText);

      // Добавляем невидимый прямоугольник для увеличения области клика
      // Сначала создаем с примерным размером, затем обновим после рендеринга
      const estimatedWidth = Math.max(250, q.name.length * 14);
      const estimatedHeight = Math.max(60, lines.length * 32 + 20);
      const padding = 20;
      const clickArea = document.createElementNS(SVG_NS, "rect");
      clickArea.classList.add("sector-label-click-area");
      clickArea.setAttribute("x", -estimatedWidth / 2 - padding);
      clickArea.setAttribute("y", -estimatedHeight / 2 - padding);
      clickArea.setAttribute("width", estimatedWidth + padding * 2);
      clickArea.setAttribute("height", estimatedHeight + padding * 2);
      clickArea.setAttribute("fill", "transparent");
      clickArea.setAttribute("data-quadrant", q.id);
      clickArea.style.cursor = "pointer";
      clickArea.style.pointerEvents = "all";

      // Вставляем прямоугольник перед текстом, чтобы он был под ним
      sectorLabelGroup.insertBefore(clickArea, sectorLabelText);

      // Обновляем размер после рендеринга для более точного размера
      requestAnimationFrame(() => {
        try {
          const bbox = sectorLabelText.getBBox();
          if (bbox.width > 0 && bbox.height > 0) {
            clickArea.setAttribute("x", bbox.x - padding);
            clickArea.setAttribute("y", bbox.y - padding);
            clickArea.setAttribute("width", bbox.width + padding * 2);
            clickArea.setAttribute("height", bbox.height + padding * 2);
          }
        } catch (err) {
          // Игнорируем ошибки, используем примерный размер
        }
      });

      // Добавляем обработчик клика на метку сектора для зума
      sectorLabelGroup.style.cursor = 'pointer';
      sectorLabelGroup.style.pointerEvents = 'all';
      sectorLabelGroup.setAttribute("data-quadrant", q.id);
      sectorLabelGroup.setAttribute("data-label-type", "sector-label");

      const handleLabelClick = (e) => {
        e.stopPropagation();
        const qId = +g.dataset.quadrant;
        if (qId && typeof window.zoomQuadrant === 'function') {
          // Проверяем наличие технологий в секторе (учитываем технологии с несколькими блоками/квадрантами)
          if (typeof window.getTechnologies === 'function') {
            const techs = window.getTechnologies() || [];
            // Используем функции из window.Positioning, если они доступны
            const getAllQuadrantsForTech =
              (window.Positioning && typeof window.Positioning.getAllQuadrantsForTech === 'function')
                ? window.Positioning.getAllQuadrantsForTech
                : (typeof window.getAllQuadrantsForTech === 'function' ? window.getAllQuadrantsForTech : null);
            const getQuadrantIdForBlock =
              (window.Positioning && typeof window.Positioning.getQuadrantIdForBlock === 'function')
                ? window.Positioning.getQuadrantIdForBlock
                : (typeof window.getQuadrantIdForBlock === 'function' ? window.getQuadrantIdForBlock : null);

            const hasTechs = (Array.isArray(techs) ? techs : []).some(t => {
              if (!t) return false;
              if (getAllQuadrantsForTech) {
                try {
                  const qs = getAllQuadrantsForTech(t) || [];
                  return Array.isArray(qs) && qs.includes(qId);
                } catch (err) { /* fallback below */ }
              }
              if (!getQuadrantIdForBlock) return false;
              const blocks = (t.blocks && Array.isArray(t.blocks) && t.blocks.length) ? t.blocks : (t.block ? [t.block] : []);
              return blocks.some(b => getQuadrantIdForBlock(b) === qId);
            });

            if (!hasTechs) {
              if (typeof window.showNotification === 'function') {
                window.showNotification('На данный момент в данном секторе отсутствуют технологии, но мы активно работаем над внедрением новых технологий.', false);
              }
              return;
            }
          }
          // Сбрасываем текущий зум перед новым
          if (typeof window.unzoom === 'function') {
            window.unzoom();
          }
          setTimeout(() => {
            window.zoomQuadrant(qId, { source: 'sector' });
          }, 50);

          // Активируем соответствующий элемент в сайдбаре
          const sidebarItem = document.querySelector(`.sector-item[data-quadrant="${qId}"]`);
          if (sidebarItem) {
            sidebarItem.click();
          }
        }
      };

      // Добавляем обработчики на группу и кликабельную область
      sectorLabelGroup.addEventListener('click', handleLabelClick);
      clickArea.addEventListener('click', handleLabelClick);

      g.appendChild(sectorLabelGroup);

      svg.appendChild(g);
    });

    // Добавляем группу подписей колец ПОСЛЕ секторов (только для обычной страницы)
    if (!isDirectorPage && window.ringLabelsGroup) {
      svg.appendChild(window.ringLabelsGroup);
    }

    radarBackgroundRendered = true;
    // Очищаем кэш групп квадрантов после создания структуры SVG
    if (clearQuadrantGroupsCache) clearQuadrantGroupsCache();
  }

  // Легенда фигур технологий по типам
  function renderLegend(config) {
    // Для директорской страницы легенда не нужна (только круги)
    const isDirectorPage = document.body.id === 'rmk-director';
    if (isDirectorPage) {
      const legend = document.querySelector('.legend');
      if (legend) legend.innerHTML = '';
      return;
    }

    const { SVG_NS, starPath } = config;
    const legend = document.querySelector('.legend');
    if (!legend) return;
    const items = [
      { label: 'Базовые', shape: 'triangle' },
      { label: 'Интегрированные', shape: 'circle' },
      { label: 'Платформенные решения', shape: 'square' },
      { label: 'Управление с ML и AI', shape: 'star' },
    ];
    const wrap = document.createElement('div');
    wrap.className = 'legend-items';
    items.forEach(it => {
      const row = document.createElement('div');
      row.className = 'legend-item';
      const svgEl = document.createElementNS(SVG_NS, 'svg');
      svgEl.setAttribute('width', '28');
      svgEl.setAttribute('height', '28');
      svgEl.setAttribute('viewBox', '0 0 40 40');
      let shapeEl;
      if (it.shape === 'circle') {
        shapeEl = document.createElementNS(SVG_NS, 'circle');
        shapeEl.setAttribute('cx', '20');
        shapeEl.setAttribute('cy', '20');
        shapeEl.setAttribute('r', '12');
      } else if (it.shape === 'square') {
        shapeEl = document.createElementNS(SVG_NS, 'rect');
        shapeEl.setAttribute('x', '10');
        shapeEl.setAttribute('y', '10');
        shapeEl.setAttribute('width', '22');
        shapeEl.setAttribute('height', '22');
      } else if (it.shape === 'triangle') {
        shapeEl = document.createElementNS(SVG_NS, 'path');
        shapeEl.setAttribute('d', `M 20 8 L 30 28 L 10 28 Z`);
      } else if (it.shape === 'star') {
        shapeEl = document.createElementNS(SVG_NS, 'path');
        shapeEl.setAttribute('d', starPath(21, 21, 15, 5, 5));
      }
      if (shapeEl) {
        shapeEl.setAttribute('class', `legend-icon legend-icon--${it.shape}`);
        svgEl.appendChild(shapeEl);
      }
      const text = document.createElement('span');
      text.className = 'legend-label';
      text.textContent = it.label;
      row.appendChild(svgEl);
      row.appendChild(text);
      wrap.appendChild(row);
    });
    legend.innerHTML = '';
    legend.appendChild(wrap);
  }

  // Создание blip'а (точки технологии на радаре)
  function createBlip(tech, pos, quadrant, config) {
    const {
      SVG_NS, svg, getQuadrantGroup, computeShapeByTechType, TECHTYPE_TO_SHAPE,
      starPath, isRatingFilled, currentEnterprise, getTechById, showDetail
    } = config;

    const targetQuadrant = quadrant !== null ? quadrant : tech.quadrant;
    const g = getQuadrantGroup(targetQuadrant);
    if (!g) return;

    // Проверяем, является ли это директорской страницей
    const isDirectorPage = document.body.id === 'rmk-director';

    // Для директорской страницы размер зависит от количества вендоров
    // Три разреза: 0-1 вендор (8), 2-3 вендора (14), 4+ вендоров (20)
    let size;
    if (isDirectorPage) {
      const vendorCount = (tech.vendors && Array.isArray(tech.vendors)) ? tech.vendors.length : 0;

      // Определяем размер на основе количества вендоров
      if (vendorCount <= 1) {
        // Маленький: 0-1 вендор
        size = 8;
      } else if (vendorCount === 2 || vendorCount === 3) {
        // Средний: 2-3 вендора
        size = 14;
      } else {
        // Большой: 4+ вендоров
        size = 20;
      }
    } else {
      size = 10;
    }

    // Все технологии отображаются кругами
    const shape = 'circle';
    const dataShape = 'circle';

    const el = document.createElementNS(SVG_NS, "circle");
    el.setAttribute("cx", pos.x);
    el.setAttribute("cy", pos.y);
    el.setAttribute("r", size);

    el.classList.add("blip");
    el.dataset.id = tech.id;
    el.dataset.shape = dataShape;
    el.dataset.quadrant = targetQuadrant;
    el.classList.add(`blip--${dataShape}`);
    g.appendChild(el);

    // Проверяем наличие предприятий у технологии
    const companies = Array.isArray(tech.company) ? tech.company : (tech.company ? [tech.company] : []);
    const hasEnterprises = companies.length > 0;

    // Проверяем наличие оценок и добавляем иконку предупреждения, если они отсутствуют
    // НО только если у технологии есть предприятия
    let techRead, organRead, funcCover;
    let techReadFilled = false;
    let organReadFilled = false;

    // Для технологий с несколькими предприятиями проверяем индивидуальные оценки
    if (companies.length > 1 && tech.companyRatings && typeof tech.companyRatings === 'object') {
      // Если есть текущее предприятие и оно в списке предприятий технологии
      if (currentEnterprise && companies.includes(currentEnterprise)) {
        const ratings = tech.companyRatings[currentEnterprise];
        // Используем индивидуальные оценки, если они есть, иначе общие значения
        techRead = (ratings && ratings.techRead !== undefined && ratings.techRead !== null)
          ? ratings.techRead
          : (tech.techRead !== undefined && tech.techRead !== null ? tech.techRead : null);
        organRead = (ratings && ratings.organRead !== undefined && ratings.organRead !== null)
          ? ratings.organRead
          : (tech.organRead !== undefined && tech.organRead !== null ? tech.organRead : null);
        funcCover = (ratings && ratings.funcCover !== undefined && ratings.funcCover !== null)
          ? ratings.funcCover
          : (tech.funcCover !== undefined && tech.funcCover !== null ? tech.funcCover : null);
        techReadFilled = isRatingFilled(techRead);
        organReadFilled = isRatingFilled(organRead);
      } else {
        // Если текущее предприятие не установлено или не совпадает, проверяем все предприятия
        // Если хотя бы у одного предприятия нет оценок, подсвечиваем
        let allHaveRatings = true;
        for (const company of companies) {
          const ratings = tech.companyRatings[company];
          const companyTechRead = (ratings && ratings.techRead !== undefined && ratings.techRead !== null)
            ? ratings.techRead
            : (tech.techRead !== undefined && tech.techRead !== null ? tech.techRead : null);
          const companyOrganRead = (ratings && ratings.organRead !== undefined && ratings.organRead !== null)
            ? ratings.organRead
            : (tech.organRead !== undefined && tech.organRead !== null ? tech.organRead : null);

          if (!isRatingFilled(companyTechRead) || !isRatingFilled(companyOrganRead)) {
            allHaveRatings = false;
            break;
          }
        }
        // Используем общие значения для отображения
        techRead = (tech.techRead !== undefined && tech.techRead !== null) ? tech.techRead : null;
        organRead = (tech.organRead !== undefined && tech.organRead !== null) ? tech.organRead : null;
        funcCover = (tech.funcCover !== undefined && tech.funcCover !== null) ? tech.funcCover : null;
        techReadFilled = allHaveRatings && isRatingFilled(techRead);
        organReadFilled = allHaveRatings && isRatingFilled(organRead);
      }
    } else {
      // Для одной компании или отсутствия индивидуальных оценок используем общие значения
      techRead = (tech.techRead !== undefined && tech.techRead !== null) ? tech.techRead : null;
      organRead = (tech.organRead !== undefined && tech.organRead !== null) ? tech.organRead : null;
      funcCover = (tech.funcCover !== undefined && tech.funcCover !== null) ? tech.funcCover : null;
      techReadFilled = isRatingFilled(techRead);
      organReadFilled = isRatingFilled(organRead);
    }

    const hasRatings = isRatingFilled(techRead) || isRatingFilled(organRead) || isRatingFilled(funcCover);
    const hasReadinessRatings = techReadFilled && organReadFilled;

    // Подсвечиваем красным только если у технологии есть предприятия, но нет оценок готовности
    if (!hasReadinessRatings && hasEnterprises) {
      el.classList.add('blip-incomplete');
    }

    // Показываем иконку предупреждения только если у технологии есть предприятия, но нет оценок
    if (!hasRatings && hasEnterprises) {
      const warningGroup = document.createElementNS(SVG_NS, "g");
      warningGroup.classList.add("blip-warning");
      warningGroup.setAttribute("transform", `translate(${pos.x + size + 3}, ${pos.y - size - 3})`);

      const bgCircle = document.createElementNS(SVG_NS, "circle");
      bgCircle.setAttribute("cx", "0");
      bgCircle.setAttribute("cy", "0");
      bgCircle.setAttribute("r", "6");
      bgCircle.setAttribute("fill", "#ff9800");
      bgCircle.setAttribute("stroke", "#fff");
      bgCircle.setAttribute("stroke-width", "1");
      warningGroup.appendChild(bgCircle);

      const exclamation = document.createElementNS(SVG_NS, "text");
      exclamation.setAttribute("x", "0");
      exclamation.setAttribute("y", "0");
      exclamation.setAttribute("text-anchor", "middle");
      exclamation.setAttribute("dominant-baseline", "middle");
      exclamation.setAttribute("fill", "#fff");
      exclamation.setAttribute("font-size", "8");
      exclamation.setAttribute("font-weight", "bold");
      exclamation.textContent = "!";
      warningGroup.appendChild(exclamation);

      const title = document.createElementNS(SVG_NS, "title");
      title.textContent = "Заполните поля оценок";
      warningGroup.appendChild(title);

      g.appendChild(warningGroup);
    }

    // Обработчик клика на blip
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      if (window.Logger) window.Logger.log('=== Клик на blip ===', {
        id: el.dataset.id,
        quadrant: el.dataset.quadrant
      });
      try {
        const id = +el.dataset.id;
        const blipQuadrant = el.dataset.quadrant ? +el.dataset.quadrant : null;
        const t = getTechById(id);
        if (window.Logger) window.Logger.log('blip click: технология найдена', {
          tech: t ? { id: t.id, name: t.name } : null
        });

        // Получаем showDetail из window в момент клика, а не из конфига
        const showDetailFn = (typeof window.showDetail === 'function') ? window.showDetail : null;
        if (window.Logger) window.Logger.log('blip click: showDetail доступна', {
          available: !!showDetailFn,
          type: typeof window.showDetail
        });

        if (t && showDetailFn) {
          if (window.Logger) window.Logger.log('blip click: вызываем showDetail');
          showDetailFn(t, 'blip', blipQuadrant);
          if (window.Logger) window.Logger.log('blip click: showDetail вызвана');
        } else {
          if (!t) {
            console.error('Ошибка при обработке клика на blip: технология не найдена', { id });
          }
          if (!showDetailFn) {
            console.error('Ошибка при обработке клика на blip: showDetail не доступна', {
              id,
              windowShowDetail: typeof window.showDetail,
              windowDetailPanel: typeof window.DetailPanel
            });
          }
        }
      } catch (err) {
        console.error('Ошибка при обработке клика на blip:', err);
      }
    });
  }

  // Основная функция рендеринга радара
  function renderRadar(data, config) {
    const {
      technologies, levelToRing, QUADRANTS, svg, selectedBlipId,
      attachBlipHoverHandlers, getAllQuadrantsForTech, assignFixedPositionForQuadrant,
      applyNonOverlappingLayout, avoidRingLabelOverlap, getQuadrantGroup,
      computeShapeByTechType, TECHTYPE_TO_SHAPE, createBlip: createBlipFn,
      renderRadarBackground: renderRadarBackgroundFn, renderLegend: renderLegendFn
    } = config;

    const techData = data || technologies;

    // Отрисовываем фон один раз
    renderRadarBackgroundFn(config);
    // Обновляем легенду
    try { renderLegendFn(config); } catch (e) { /* ignore */ }

    // Собираем все элементы для удаления в один список
    const blipsToRemove = svg.querySelectorAll('.blip, .blip-warning');
    blipsToRemove.forEach(el => el.remove());

    if (window.Logger) window.Logger.debug('renderRadar: start — input data length:', Array.isArray(techData) ? techData.length : 0);

    // Фильтруем технологии по валидности
    // Все технологии отображаются на основе математической модели, проверяем только наличие квадрантов
    const validTechs = (Array.isArray(techData) ? techData : [])
      .filter((t) => {
        if (!t) return false;
        // Проверяем наличие квадрантов (готовность рассчитывается автоматически через математическую модель)
        return true;
      });

    if (window.Logger) window.Logger.debug('renderRadar: start — valid techs:', validTechs.length);

    // Создаем структуру данных для отображения
    const renderData = [];

    validTechs.forEach((t) => {
      const techQuadrants = getAllQuadrantsForTech(t);

      if (techQuadrants.length === 0) {
        if (window.Logger) window.Logger.debug('renderRadar: tech has no quadrants', { id: t.id, name: t.name });
        return;
      }

      const shape = computeShapeByTechType(t.techType, TECHTYPE_TO_SHAPE) || 'circle';

      // Вычисляем размер для технологии (нужно для правильного разведения)
      const isDirectorPage = document.body.id === 'rmk-director';
      let size;
      if (isDirectorPage) {
        const vendorCount = (t.vendors && Array.isArray(t.vendors)) ? t.vendors.length : 0;
        if (vendorCount <= 1) {
          size = 8;
        } else if (vendorCount === 2 || vendorCount === 3) {
          size = 14;
        } else {
          size = 20;
        }
      } else {
        size = 10;
      }

      techQuadrants.forEach((quadrantId) => {
        // Позиция вычисляется через математическую модель, ring не используется
        // Оставляем ring для обратной совместимости, но он не влияет на позиционирование
        renderData.push({
          ...t,
          quadrant: quadrantId,
          ring: null, // Не используется, позиция вычисляется через математическую модель
          shape: shape,
          size: size, // Размер для правильного разведения
          x: null,
          y: null
        });
      });
    });

    if (window.Logger) window.Logger.debug('renderRadar: after mapping — renderData entries:', renderData.length);

    // Вычисляем позиции для каждого blip'а
    renderData.forEach((entry) => {
      const pos = assignFixedPositionForQuadrant(entry, entry.quadrant);
      entry.x = pos.x;
      entry.y = pos.y;
    });

    // Группируем по квадрантам для раскладки
    const renderDataByQuadrant = {};
    renderData.forEach(entry => {
      if (!renderDataByQuadrant[entry.quadrant]) {
        renderDataByQuadrant[entry.quadrant] = [];
      }
      renderDataByQuadrant[entry.quadrant].push(entry);
    });

    // Применяем раскладку для каждого квадранта отдельно
    Object.keys(renderDataByQuadrant).forEach(quadrantId => {
      const quadrantData = renderDataByQuadrant[quadrantId];
      applyNonOverlappingLayout(quadrantData);
      avoidRingLabelOverlap(quadrantData);
    });

    // Создаём blip'ы в SVG
    renderData.forEach((entry) => {
      if (window.Logger) window.Logger.debug('renderRadar: rendering blip', {
        id: entry.id,
        name: entry.name,
        quadrant: entry.quadrant,
        ring: entry.ring,
        x: entry.x,
        y: entry.y
      });
      createBlipFn(entry, { x: entry.x, y: entry.y }, entry.quadrant, config);
    });

    // Пометить пустые квадранты в DOM и в сайдбаре
    const sidebarItemsCache = {};
    QUADRANTS.forEach(q => {
      const has = renderData.some(t => t.quadrant === q.id);
      const g = getQuadrantGroup(q.id);
      if (g) {
        g.classList.toggle('empty', !has);
      }
      if (!sidebarItemsCache[q.id]) {
        sidebarItemsCache[q.id] = document.querySelector(`.sector-item[data-quadrant="${q.id}"]`);
      }
      const sidebarItem = sidebarItemsCache[q.id];
      if (sidebarItem) sidebarItem.classList.toggle('empty', !has);
    });

    if (attachBlipHoverHandlers) attachBlipHoverHandlers();

    // Выделяем все blip'ы выбранной технологии
    if (selectedBlipId != null) {
      svg.querySelectorAll(`.blip[data-id="${selectedBlipId}"]`).forEach(blipEl => {
        blipEl.classList.add('selected');
      });
    }
  }

  // Сброс флага отрисовки фона (для перерисовки при необходимости)
  function resetRadarBackground() {
    radarBackgroundRendered = false;
  }

  // Экспорт в window.RadarRenderer
  window.RadarRenderer = {
    renderRadarBackground,
    renderLegend,
    renderRadar,
    createBlip,
    computeShapeByTechType,
    resetRadarBackground
  };

})();
