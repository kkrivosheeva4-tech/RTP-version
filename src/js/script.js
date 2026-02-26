  // Класс для управления подсказками
  class Tooltip {
    constructor() {
      this.tooltip = document.createElement('div');
      this.tooltip.className = 'custom-tooltip';
      document.body.appendChild(this.tooltip);

      this.currentElement = null;
      this.tooltipId = 'tooltip-' + Math.random().toString(36).substr(2, 9);
      this.tooltip.id = this.tooltipId;

      this.handleMouseEnter = this.handleMouseEnter.bind(this);
      this.handleMouseLeave = this.handleMouseLeave.bind(this);
      this.handleFocus = this.handleFocus.bind(this);
      this.handleBlur = this.handleBlur.bind(this);
      this.updatePosition = this.updatePosition.bind(this);

      window.addEventListener('resize', this.updatePosition);
      window.addEventListener('scroll', this.updatePosition, true);

      this.init();
    }

    init() {
      // Используем делегирование событий, чтобы поддерживать динамически добавляемые элементы
      // Обрабатываем наведение/уход через pointerover/pointerout (они всплывают)
      this.handlePointerOver = (e) => {
        const el = e.target.closest && e.target.closest('[data-tooltip], [title]');
        if (!el) return;
        const tooltipText = el.getAttribute('data-tooltip') || el.getAttribute('title');
        if (!tooltipText) return;
        // Удаляем native title, переносим в data-tooltip
        if (el.hasAttribute('title')) el.removeAttribute('title');
        el.setAttribute('data-tooltip', tooltipText);
        el.setAttribute('aria-describedby', this.tooltipId);
        this.show(el);
      };

      this.handlePointerOut = (e) => {
        // Если уход из элемента или его потомка — скрываем
        const from = e.target.closest && e.target.closest('[data-tooltip]');
        const related = e.relatedTarget;
        if (!from) return;
        if (related && from.contains(related)) return; // все ещё внутри
        this.hide();
      };

      this.handleFocusIn = (e) => {
        const el = e.target.closest && e.target.closest('[data-tooltip], [title]');
        if (!el) return;
        const tooltipText = el.getAttribute('data-tooltip') || el.getAttribute('title');
        if (!tooltipText) return;
        if (el.hasAttribute('title')) el.removeAttribute('title');
        el.setAttribute('data-tooltip', tooltipText);
        el.setAttribute('aria-describedby', this.tooltipId);
        this.show(el);
      };

      this.handleFocusOut = (e) => {
        const el = e.target.closest && e.target.closest('[data-tooltip]');
        if (!el) return;
        this.hide();
      };

      document.addEventListener('pointerover', this.handlePointerOver);
      document.addEventListener('pointerout', this.handlePointerOut);
      document.addEventListener('focusin', this.handleFocusIn);
      document.addEventListener('focusout', this.handleFocusOut);
    }

    handleMouseEnter(e) {
      this.show(e.target);
    }

    handleMouseLeave() {
      this.hide();
    }

    handleFocus(e) {
      this.show(e.target);
    }

    handleBlur() {
      this.hide();
    }

    show(element) {
      this.currentElement = element;
      const tooltipText = element.getAttribute('data-tooltip');
      this.tooltip.textContent = tooltipText;
      this.tooltip.classList.add('visible');
      this.updatePosition();
    }

    hide() {
      this.currentElement = null;
      this.tooltip.classList.remove('visible');
    }

    updatePosition() {
      if (!this.currentElement) return;

      const elementRect = this.currentElement.getBoundingClientRect();
      const tooltipRect = this.tooltip.getBoundingClientRect();
      const padding = 10; // Отступ от элемента
      const margin = 10; // Минимальный отступ от края экрана

      // Сбрасываем все классы позиционирования
      this.tooltip.classList.remove('top', 'bottom', 'left', 'right');

      // Определяем доступное пространство с каждой стороны
      const space = {
        top: elementRect.top,
        bottom: window.innerHeight - elementRect.bottom,
        left: elementRect.left,
        right: window.innerWidth - elementRect.right
      };

      // Пытаемся расположить подсказку сверху или снизу
      let position = 'top';
      let top = 0;
      let left = 0;

      if (space.bottom >= tooltipRect.height + padding && space.top < tooltipRect.height + padding) {
        // Располагаем снизу
        position = 'bottom';
        top = elementRect.bottom + padding;
      } else {
        // Располагаем сверху (по умолчанию)
        top = elementRect.top - tooltipRect.height - padding;
      }

      // Центрируем по горизонтали
      left = elementRect.left + (elementRect.width - tooltipRect.width) / 2;

      // Проверяем, не выходит ли подсказка за пределы экрана по горизонтали
      if (left < margin) {
        // Если выходит слева
        left = margin;
      } else if (left + tooltipRect.width > window.innerWidth - margin) {
        // Если выходит справа
        left = window.innerWidth - tooltipRect.width - margin;
      }

      // Если подсказка не помещается ни сверху, ни снизу, пробуем слева или справа
      if ((position === 'top' && top < margin) || (position === 'bottom' && top + tooltipRect.height > window.innerHeight - margin)) {
        // Проверяем пространство слева и справа
        if (space.right >= tooltipRect.width + padding) {
          position = 'right';
          left = elementRect.right + padding;
          top = elementRect.top + (elementRect.height - tooltipRect.height) / 2;
        } else if (space.left >= tooltipRect.width + padding) {
          position = 'left';
          left = elementRect.left - tooltipRect.width - padding;
          top = elementRect.top + (elementRect.height - tooltipRect.height) / 2;
        }
      }

      // Добавляем соответствующий класс позиционирования
      this.tooltip.classList.add(position);

      // Применяем вычисленные координаты
      this.tooltip.style.top = `${Math.max(margin, Math.min(top, window.innerHeight - tooltipRect.height - margin))}px`;
      this.tooltip.style.left = `${Math.max(margin, Math.min(left, window.innerWidth - tooltipRect.width - margin))}px`;
    }
  }

  // Инициализируем подсказки после загрузки DOM
  function initTooltip() {
    // Guard: предотвращаем повторную инициализацию
    if (window.__tooltipInitialized) {
      if (window.Logger) window.Logger.debug('Tooltip уже инициализирован, пропускаем повторную инициализацию');
      return;
    }
    window.__tooltipInitialized = true;
    new Tooltip();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTooltip);
  } else {
    // DOM уже загружен
    initTooltip();
  }

  // Логирование (централизовано в /src/js/audit-logger.js)
  // Здесь только подстраховка: если audit-logger по какой-то причине не загрузился,
  // то appendAdminAudit останется undefined (и вызовы в модулях не упадут).

  // renderAuth, safeLogout, initTheme, initHelpButton теперь в common-ui.js
  // Используем функции из common-ui.js через window
  // renderAuth вызывается автоматически в common-ui.js при загрузке DOM

  // Делегированный обработчик кликов для динамически добавляемых кнопок входа/выхода и ролей
  document.addEventListener('click', (e) => {
    const loginBtn = e.target.closest && e.target.closest('.login');
    if (loginBtn) {
      e.preventDefault();
      window.location.href = '/src/pages/auth.html';
      return;
    }
    const logoutBtn = e.target.closest && e.target.closest('.logout');
    if (logoutBtn) {
      e.preventDefault();
      if (typeof window.safeLogout === 'function') {
        window.safeLogout();
      }
      location.reload();
      return;
    }
    const adminRole = e.target.closest && e.target.closest('.admin-role');
    if (adminRole) {
      e.preventDefault();
      window.location.href = '/src/pages/admin.html';
      return;
    }
  });

  // Сайдбар - новая структура с вертикальной панелью кнопок
  // Инициализация выполняется после загрузки DOM
  function initSidebarButtons() {
    const sidebarWrapper = document.querySelector(".sidebar-wrapper");
    const sidebar = document.getElementById("sidebar");
    const toggleSidebarBtn = document.getElementById("toggleSidebarBtn");
    const searchIconBtn = document.getElementById("searchIconBtn");
    const filterIconBtn = document.getElementById("filterIconBtn");
    const resetIconBtn = document.getElementById("resetIconBtn");
    const reportIconBtn = document.getElementById("reportIconBtn");
    const addIconBtn = document.getElementById("addIconBtn");

    // Инициализация: панель скрыта по умолчанию
    if (sidebarWrapper) {
      sidebarWrapper.classList.add("collapsed");
    }

    // Функция для управления видимостью кнопок "Фильтр" и "Поиск"
    function toggleSearchFilterButtons(isExpanded) {
      if (searchIconBtn) {
        if (isExpanded) {
          searchIconBtn.style.display = 'none';
        } else {
          searchIconBtn.style.display = '';
        }
      }
      if (filterIconBtn) {
        if (isExpanded) {
          filterIconBtn.style.display = 'none';
        } else {
          filterIconBtn.style.display = '';
        }
      }
    }

    // Переключение видимости панели
    if (toggleSidebarBtn && sidebarWrapper) {
      toggleSidebarBtn.onclick = () => {
        sidebarWrapper.classList.toggle("collapsed");
        sidebarWrapper.classList.toggle("expanded");
        const isExpanded = sidebarWrapper.classList.contains("expanded");
        // Перемещаем кнопку сброса
        moveResetButton(sidebarWrapper);
        // Управляем видимостью кнопок "Фильтр" и "Поиск"
        toggleSearchFilterButtons(isExpanded);
      };
    }

    // Функция для перемещения кнопки "Сбросить выбор"
    function moveResetButton(sidebarWrapper) {
      const resetBtn = document.getElementById('resetIconBtn');
      const sidebarButtons = document.getElementById('sidebarButtons');
      const resetButtonContainer = document.getElementById('resetButtonContainer');

      if (!resetBtn || !sidebarButtons || !resetButtonContainer) return;

      const isExpanded = sidebarWrapper.classList.contains('expanded');

      // Добавляем класс для анимации
      resetBtn.classList.add('moving');

      // Используем requestAnimationFrame для плавного перехода
      requestAnimationFrame(() => {
        if (isExpanded) {
          // Перемещаем в filterPanel
          resetButtonContainer.appendChild(resetBtn);
          // Обновляем tooltip
          resetBtn.removeAttribute('data-tooltip');
        } else {
          // Возвращаем в sidebar-buttons (после filterIconBtn)
          const filterIconBtn = document.getElementById('filterIconBtn');
          if (filterIconBtn) {
            // Вставляем сразу после filterIconBtn
            if (filterIconBtn.nextSibling) {
              sidebarButtons.insertBefore(resetBtn, filterIconBtn.nextSibling);
            } else {
              sidebarButtons.appendChild(resetBtn);
            }
          } else {
            sidebarButtons.appendChild(resetBtn);
          }
          // Восстанавливаем tooltip
          resetBtn.setAttribute('data-tooltip', 'Сбросить выбор');
        }

        // Убираем класс анимации после завершения перехода
        setTimeout(() => {
          resetBtn.classList.remove('moving');
        }, 400);
      });
    }

    // Инициализация положения кнопки при загрузке
    if (sidebarWrapper) {
      moveResetButton(sidebarWrapper);
      // Инициализация видимости кнопок "Фильтр" и "Поиск" (панель скрыта по умолчанию)
      toggleSearchFilterButtons(false);
    }

    // Подключение кнопок к их функциям
    if (searchIconBtn && sidebarWrapper) {
      searchIconBtn.onclick = () => {
        sidebarWrapper.classList.remove("collapsed");
        sidebarWrapper.classList.add("expanded");
        moveResetButton(sidebarWrapper);
        // Скрываем кнопки "Фильтр" и "Поиск"
        toggleSearchFilterButtons(true);
        const searchInput = document.getElementById("searchInput");
        if (searchInput) {
          setTimeout(() => searchInput.focus(), 300);
        }
      };
    }

    if (filterIconBtn && sidebarWrapper) {
      filterIconBtn.onclick = () => {
        sidebarWrapper.classList.remove("collapsed");
        sidebarWrapper.classList.add("expanded");
        moveResetButton(sidebarWrapper);
        // Скрываем кнопки "Фильтр" и "Поиск"
        toggleSearchFilterButtons(true);
      };
    }

    // Обработчик для resetIconBtn теперь в RMK2.js
    // Не переопределяем его здесь, чтобы не конфликтовать с логикой перемещения

    if (reportIconBtn) {
      reportIconBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        // Ждем, пока кнопка будет создана в RMK2.js
        setTimeout(() => {
          const exportPdfBtn = document.getElementById("exportPdfBtn");
          if (exportPdfBtn) {
            exportPdfBtn.click();
          } else {
            if (window.Logger) window.Logger.warn('exportPdfBtn not found');
          }
        }, 100);
      };
    }

    if (addIconBtn) {
      addIconBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();

        // Проверяем роль пользователя (архитектор, админ, директор, РП могут добавлять технологии)
        const role = localStorage.getItem("role");
        if (role !== "architect" && role !== "admin" && role !== "director" && role !== "project_manager") {
          return;
        }

        const pop = document.getElementById('addChoicePopover');
        if (!pop) {
          if (window.Logger) window.Logger.warn('addChoicePopover not found');
          return;
        }

        // Если popover уже открыт, закрываем его
        if (pop.style.display === 'block' || pop.classList.contains('open')) {
          pop.classList.remove('open');
          pop.style.display = 'none';
          return;
        }

        // Получаем позицию кнопки addIconBtn
        const rect = addIconBtn.getBoundingClientRect();
        pop.style.display = 'block';
        pop.style.position = 'fixed';
        pop.style.top = `${rect.bottom + 8}px`;
        pop.style.left = `${rect.right + 8}px`;

        requestAnimationFrame(() => {
          pop.classList.add('open');
          const pw = pop.offsetWidth;
          const ph = pop.offsetHeight;
          let top = rect.bottom + 8;
          let left = rect.right + 8;

          // Проверяем, не выходит ли за границы экрана
          if (top + ph + 8 > window.innerHeight) {
            const spaceRight = window.innerWidth - rect.right - 8;
            const spaceLeft = rect.left - 8;
            if (spaceRight >= pw) {
              top = rect.top + rect.height / 2 - ph / 2;
              top = Math.max(8, Math.min(top, window.innerHeight - ph - 8));
              left = rect.right + 8;
            } else if (spaceLeft >= pw) {
              top = rect.top + rect.height / 2 - ph / 2;
              top = Math.max(8, Math.min(top, window.innerHeight - ph - 8));
              left = rect.left - pw - 8;
            } else {
              top = Math.max(8, window.innerHeight - ph - 8);
              left = rect.right + 8;
              if (left + pw + 8 > window.innerWidth) left = window.innerWidth - pw - 8;
              if (left < 8) left = 8;
            }
          } else {
            if (left + pw + 8 > window.innerWidth) {
              // Пробуем разместить слева от кнопки
              const spaceLeft = rect.left - 8;
              if (spaceLeft >= pw) {
                left = rect.left - pw - 8;
              } else {
                left = window.innerWidth - pw - 8;
              }
            }
            if (left < 8) left = 8;
          }

          pop.style.top = `${Math.round(top)}px`;
          pop.style.left = `${Math.round(left)}px`;
        });
      };
    }
  }

  // Инициализация при загрузке DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      // Небольшая задержка, чтобы убедиться, что все скрипты загружены
      setTimeout(initSidebarButtons, 50);
    });
  } else {
    setTimeout(initSidebarButtons, 50);
  }

  // Фильтр - всегда открыт, кнопка удалена
  function initFilters() {
    const filterPanel = document.getElementById("filterPanel");
    const sidebar = document.getElementById("sidebar");
    if (filterPanel) {
      // Фильтры всегда открыты
      filterPanel.classList.add('open');
      if (sidebar) {
        sidebar.classList.add('filters-open');
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFilters);
  } else {
    initFilters();
  }

  // Поиск обрабатывается в events.js через DOMCache и debounce
  // Удален избыточный обработчик, который отправлял неиспользуемое событие searchTech

  // ===== РАДАР ЛОГИКА (фиксированные точки + задержка и плавное затухание) =====
(function () {
  const radarContainer = document.getElementById('radarContainer');
  const svg = document.getElementById('techRadar');
  if (!radarContainer || !svg) return;

  const SVG_NS = "http://www.w3.org/2000/svg";
  const CENTER_X = 500, CENTER_Y = 500, RADIUS_STEP = 140;
  const maxRadius = 3 * RADIUS_STEP;

  function polarToCartesian(centerX, centerY, radius, angleInDegrees) {
    const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
    return {
      x: centerX + (radius * Math.cos(angleInRadians)),
      y: centerY + (radius * Math.sin(angleInRadians))
    };
  }

  function describeWedge(x, y, radius, startAngle, endAngle) {
    const start = polarToCartesian(x, y, radius, endAngle);
    const end = polarToCartesian(x, y, radius, startAngle);
    return `M ${x},${y} L ${start.x},${start.y} A ${radius},${radius} 0 0 0 ${end.x},${end.y} Z`;
  }

  function renderInitialAnimation() {
    svg.innerHTML = '';
    const quadrantLabelsContainer = document.getElementById('quadrantLabels');
    if (quadrantLabelsContainer) quadrantLabelsContainer.innerHTML = '';

    // Сетка радара
    const gridGroup = document.createElementNS(SVG_NS, 'g');
    for (let i = 1; i <= 3; i++) {
      const circle = document.createElementNS(SVG_NS, 'circle');
      circle.setAttribute('cx', CENTER_X);
      circle.setAttribute('cy', CENTER_Y);
      circle.setAttribute('r', i * RADIUS_STEP);
      circle.classList.add('radar-arc');
      gridGroup.appendChild(circle);
    }
    const line1 = document.createElementNS(SVG_NS, 'line');
    line1.setAttribute('x1', 50); line1.setAttribute('y1', CENTER_Y);
    line1.setAttribute('x2', 950); line1.setAttribute('y2', CENTER_Y);
    const line2 = document.createElementNS(SVG_NS, 'line');
    line2.setAttribute('x1', CENTER_X); line2.setAttribute('y1', 50);
    line2.setAttribute('x2', CENTER_X); line2.setAttribute('y2', 950);
    line1.classList.add('radar-line');
    line2.classList.add('radar-line');
    gridGroup.appendChild(line1);
    gridGroup.appendChild(line2);
    svg.appendChild(gridGroup);

    // Градиент сканера
    const defs = document.createElementNS(SVG_NS, 'defs');
    const gradient = document.createElementNS(SVG_NS, 'linearGradient');
    gradient.id = 'scannerGradient';
    gradient.setAttribute('gradientTransform', 'rotate(-30 0.5 0.5)');
    gradient.innerHTML = `
      <stop offset="0%" style="stop-color:var(--primary-color);stop-opacity:0" />
      <stop offset="100%" style="stop-color:var(--primary-color);stop-opacity:0.5" />
    `;
    defs.appendChild(gradient);
    svg.appendChild(defs);

    // Сканер
    const scannerGroup = document.createElementNS(SVG_NS, 'g');
    scannerGroup.id = 'scannerGroup';
    const wedgeWidth = 50;
    const highlightTolerance = 6; // Угловая толерантность для "активной" области
    const wedge = document.createElementNS(SVG_NS, 'path');
    wedge.setAttribute('d', describeWedge(CENTER_X, CENTER_Y, maxRadius, -wedgeWidth, 0));
    wedge.setAttribute('fill', 'url(#scannerGradient)');
    const highlight = document.createElementNS(SVG_NS, 'path');
    highlight.setAttribute('d', describeWedge(CENTER_X, CENTER_Y, maxRadius, -highlightTolerance, 0));
    highlight.setAttribute('class', 'scanner-highlight');
    const lineEnd = polarToCartesian(CENTER_X, CENTER_Y, maxRadius, 0);
    const line = document.createElementNS(SVG_NS, 'line');
    line.setAttribute('x1', CENTER_X); line.setAttribute('y1', CENTER_Y);
    line.setAttribute('x2', lineEnd.x); line.setAttribute('y2', lineEnd.y);
    line.classList.add('scanner-line');

    scannerGroup.appendChild(wedge);
    scannerGroup.appendChild(highlight);
    scannerGroup.appendChild(line);
    svg.appendChild(scannerGroup);

    // === ФИКСИРОВАННЫЕ ТОЧКИ ===
    const FIXED_BLIPS = [
      { angle: 30,  radius: 100 },
      { angle: 120, radius: 170 },
      { angle: 230, radius: 230 },
      { angle: 330, radius: 360 },
    ];

    const pingBlips = [];
    const BASE_R = 14;          // ← увеличенный размер
    const HIGHLIGHT_SCALE = 1.3;

    // --- Новые параметры ---
    const FADE_DURATION = 8000;  // Время затухания от 100% до 0% (в мс)

    FIXED_BLIPS.forEach(blipData => {
      const pos = polarToCartesian(CENTER_X, CENTER_Y, blipData.radius, blipData.angle);
      const blip = document.createElementNS(SVG_NS, 'circle');
      blip.setAttribute('cx', pos.x);
      blip.setAttribute('cy', pos.y);
      blip.setAttribute('r', BASE_R);
      blip.classList.add('static-ping-blip');
      // Начальное состояние — невидима
      blip.style.opacity = '0';
      blip.style.transform = 'scale(0.5)';
      blip.style.transformOrigin = 'center center';
      blip.style.pointerEvents = 'none';
      svg.appendChild(blip);

      pingBlips.push({
        element: blip,
        x: pos.x,
        y: pos.y,
        radius: blipData.radius,
        baseScale: 1,
        highlightScale: HIGHLIGHT_SCALE,
        state: 'hidden', // 'hidden', 'fading'
        fadeStartTime: null // время начала затухания
      });
    });

    // Функция для обновления состояния точки
    function updateBlipState(blip, timestamp) {
  // --- 1. Определяем, находится ли точка в зоне сканирования СЕЙЧАС ---
  const dx = blip.x - CENTER_X;
  const dy = blip.y - CENTER_Y;
  const pointAngle = (Math.atan2(dy, dx) * 180 / Math.PI + 90 + 360) % 360;
  const pointRadius = Math.sqrt(dx * dx + dy * dy);
  let diff = Math.abs(pointAngle - currentCenterAngle);
  if (diff > 180) diff = 360 - diff;
  const isScanned = pointRadius <= maxRadius && diff <= highlightTolerance;

  // --- 2. Если точка в зоне сканирования ---
  if (isScanned) {
    // Если точка была скрытой, запускаем появление с opacity 100% и начинаем затухание
    if (blip.state === 'hidden') {
      blip.state = 'fading';
      blip.fadeStartTime = timestamp;
      blip.element.style.opacity = '1';
      blip.element.style.transform = `scale(${blip.highlightScale})`;
      blip.element.classList.add('blip-active');
    }
    // Если точка уже затухает, сбрасываем таймер затухания (начинаем заново)
    else if (blip.state === 'fading') {
      blip.fadeStartTime = timestamp;
      blip.element.style.opacity = '1';
      blip.element.style.transform = `scale(${blip.highlightScale})`;
    }
    return;
  }

  // --- 3. Если точка НЕ сканируется — обрабатываем затухание ---

  // Если точка скрыта, ничего не делаем
  if (blip.state === 'hidden') {
    return;
  }

  // Если точка затухает, вычисляем текущую прозрачность
  if (blip.state === 'fading' && blip.fadeStartTime !== null) {
    const timeSinceFadeStart = timestamp - blip.fadeStartTime;

    if (timeSinceFadeStart < FADE_DURATION) {
      // Затухание в процессе: равномерно от 1 до 0 за FADE_DURATION
      const fadeProgress = timeSinceFadeStart / FADE_DURATION;
      const opacity = 1 - fadeProgress;
      const scale = 0.5 + (blip.highlightScale - 0.5) * (1 - fadeProgress);

      blip.element.style.opacity = opacity.toString();
      blip.element.style.transform = `scale(${scale})`;
      blip.element.classList.add('blip-active');
    } else {
      // Затухание завершено — скрываем
      blip.state = 'hidden';
      blip.element.style.opacity = '0';
      blip.element.style.transform = 'scale(0.5)';
      blip.element.classList.remove('blip-active');
      blip.fadeStartTime = null;
    }
  }
}


    let currentCenterAngle = 0; // Глобальная переменная для текущего угла сканера (передний край)
    function updatePings(timestamp) {
      if (!startTime) startTime = timestamp;
      const elapsedTime = timestamp - startTime;
      const rotationDegrees = (elapsedTime / 8000) * 360 % 360;
      // Передний край сканера (линия) находится точно на rotationDegrees
      currentCenterAngle = rotationDegrees;

      pingBlips.forEach(blip => {
        updateBlipState(blip, timestamp);
      });

      requestAnimationFrame(updatePings);
    }

    let startTime = null;
    startTime = performance.now(); // Используем performance.now() для начального времени
    requestAnimationFrame(updatePings);
  }

  renderInitialAnimation();
})();

  // --- Mobile Navigation и Touch Handlers инициализация ---
  (function() {
    // Загружаем модули мобильной навигации и touch-жестов, если они доступны
    function initMobileFeatures() {
      if (window.MobileNav && typeof window.MobileNav.init === 'function') {
        window.MobileNav.init();
        window.addEventListener('resize', () => {
          if (window.MobileNav && typeof window.MobileNav.handleResize === 'function') {
            window.MobileNav.handleResize();
          }
        });
      }

      if (window.TouchHandlers && typeof window.TouchHandlers.init === 'function') {
        window.TouchHandlers.init();
      }
    }

    // Инициализируем после загрузки DOM
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initMobileFeatures);
    } else {
      // DOM уже загружен, но модули могут еще не быть загружены
      // Попробуем инициализировать с небольшой задержкой
      setTimeout(initMobileFeatures, 100);
    }
  })();

  // Help Button теперь в common-ui.js
  // Инициализация происходит автоматически в common-ui.js при загрузке DOM

  // Скрытие кнопки "Перейти к детальному просмотру" для неавторизованных пользователей
  function initDetailViewLinkVisibility() {
    const detailViewLink = document.getElementById('detailViewLink');
    if (!detailViewLink) return;

    function checkAndUpdateVisibility() {
      const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
      const role = localStorage.getItem('role');
      const isAuthorized = isLoggedIn || (role && role.trim() !== '');

      if (isAuthorized) {
        detailViewLink.style.display = '';
      } else {
        detailViewLink.style.display = 'none';
      }
    }

    // Проверяем при загрузке
    checkAndUpdateVisibility();

    // Слушаем изменения в localStorage (для случаев, когда пользователь войдет/выйдет в другом окне)
    window.addEventListener('storage', checkAndUpdateVisibility);

    // Проверяем после небольшой задержки, чтобы убедиться, что renderAuth выполнился
    setTimeout(checkAndUpdateVisibility, 100);

    // Проверяем периодически (для случаев, когда localStorage изменяется в том же окне)
    // Используем более редкий интервал для лучшей производительности
    setInterval(checkAndUpdateVisibility, 1000);
  }

  // Инициализируем после загрузки DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDetailViewLinkVisibility);
  } else {
    initDetailViewLinkVisibility();
  }
export {};
