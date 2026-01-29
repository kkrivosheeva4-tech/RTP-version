// Модуль графика «Перспективные»
// Экспортирует функции инициализации в window.ProspectsChart для использования
// Использует глобальные переменные из RMK2.js и функции из других модулей

(function() {
  'use strict';

  // Инициализация графика при загрузке DOM
  function initProspectsChart() {
    const SVG_NS = "http://www.w3.org/2000/svg";
    const toggleBtn = document.getElementById('toggleProspectsChartBtn');
    const modal = document.getElementById('prospectsModal');
    const closeBtn = document.getElementById('closeProspectsBtn');
    const svg = document.getElementById('prospectsChartSvg');
    const exportBtn = document.getElementById('exportProspectsChartBtn');
    const companySelect = document.querySelector('.prospects-company-select');
    const selectTrigger = document.querySelector('.prospects-select-trigger');
    const selectOptions = document.querySelector('.prospects-select-options');
    const selectText = document.querySelector('.prospects-select-text');
    const hiddenInput = document.getElementById('prospectsSelectedCompany');

    if (!toggleBtn || !modal || !svg || !closeBtn || !exportBtn || !companySelect) return;

    let cachedData = null;
    let allData = null;
    let renderedOnce = false;
    let selectedCompanies = []; // Массив выбранных предприятий
    // Если пользователь вручную менял выбор предприятий в модалке — не перезаписываем его
    // из enterprise-nav при следующих открытиях.
    let isCompanySelectionDirty = false;
    // Запоминаем предприятие из enterprise-nav, с которым последний раз синхронизировали селект модалки
    let lastSyncedEnterpriseNav = null;
    let syncCheckboxesFn = null; // Функция синхронизации чекбоксов
    let companyColors = {}; // Карта цветов для компаний
    let allCompaniesList = []; // Полный список предприятий для детерминированных цветов

    // Генерация насыщенных, различимых цветов по индексу
    function generateCompanyColorByIndex(index, totalCount) {
      const safeTotal = Math.max(1, totalCount || 1);
      const hue = Math.round((index * 360) / safeTotal);
      const saturation = 65;
      const lightness = 50;
      return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    }

    // Функция для получения цвета компании
    function getCompanyColor(company) {
      if (!company) return '#808080';
      if (companyColors[company]) return companyColors[company];

      // Если уже известен полный список предприятий, используем его индекс,
      // чтобы цвет был стабильным и не пересекался с другими.
      if (Array.isArray(allCompaniesList) && allCompaniesList.length > 0) {
        const idx = allCompaniesList.indexOf(company);
        if (idx !== -1) {
          const color = generateCompanyColorByIndex(idx, allCompaniesList.length);
          companyColors[company] = color;
          return color;
        }
      }

      // Fallback: если по какой-то причине список ещё не инициализирован,
      // назначаем новый цвет по следующему свободному индексу.
      const idx = Object.keys(companyColors).length;
      const color = generateCompanyColorByIndex(idx, idx + 1);
      companyColors[company] = color;
      return color;
    }

    // Анимация SVG при клике на кнопку
    toggleBtn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation(); // Предотвращаем всплытие события, чтобы глобальные обработчики не закрыли модальное окно
      toggleBtn.classList.add('animating');
      setTimeout(() => {
        toggleBtn.classList.remove('animating');
      }, 600);
      openModal();
    });

    // Обновление текста в триггере
    function updateSelectText() {
      if (selectedCompanies.length === 0) {
        selectText.textContent = 'Все предприятия';
      } else if (selectedCompanies.length === 1) {
        selectText.textContent = selectedCompanies[0];
      } else {
        selectText.textContent = `Выбрано: ${selectedCompanies.length}`;
      }
      hiddenInput.value = JSON.stringify(selectedCompanies);
    }

    // Обновление selectedCompanies при изменении чекбокса
    function updateSelectedCompanies(company, isChecked) {
      isCompanySelectionDirty = true;
      if (isChecked) {
        if (!selectedCompanies.includes(company)) {
          selectedCompanies.push(company);
        }
      } else {
        selectedCompanies = selectedCompanies.filter(c => c !== company);
      }
    }

    // Синхронизировать выбор предприятий в модалке с enterprise-nav (без пометки "dirty")
    function syncSelectionFromEnterpriseNav() {
      const { currentEnt } = getGlobalFilters();
      const desired = (currentEnt && currentEnt !== 'all') ? [currentEnt] : [];
      selectedCompanies = desired;
      lastSyncedEnterpriseNav = (currentEnt && currentEnt !== 'all') ? currentEnt : 'all';
      updateSelectText();
      if (syncCheckboxesFn) syncCheckboxesFn();
    }

    // Обновление состояния "Выбрать все"
    function updateSelectAllState(selectAllCheckbox) {
      const allCheckboxes = selectOptions.querySelectorAll('li:not(.prospects-select-all) input[type="checkbox"]');
      const allChecked = Array.from(allCheckboxes).every(cb => cb.checked);
      const someChecked = Array.from(allCheckboxes).some(cb => cb.checked);
      selectAllCheckbox.checked = allChecked;
      selectAllCheckbox.indeterminate = someChecked && !allChecked;
    }

    // Инициализация выпадающего списка предприятий
    async function initCompanySelect() {
      if (!allData) {
        const res = await fetch('/src/data/ru/enterpriseData.json', { cache: 'no-store' });
        allData = await res.json();
      }

      // Собираем ВСЕ предприятия из всех данных, не только перспективные
      const companiesList = extractCompanies(allData);
      selectOptions.innerHTML = '';

      // Добавляем опцию "Выбрать все"
      const selectAllLi = document.createElement('li');
      selectAllLi.className = 'prospects-select-all';
      selectAllLi.innerHTML = `
        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; width: 100%; padding: 4px 0;">
          <input type="checkbox" id="prospects-select-all-checkbox" style="cursor: pointer;">
          <span>Выбрать все</span>
        </label>
      `;
      const selectAllCheckbox = selectAllLi.querySelector('input[type="checkbox"]');
      selectAllCheckbox.addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        const checkboxes = selectOptions.querySelectorAll('li:not(.prospects-select-all) input[type="checkbox"]');

        // Если снимаем "Выбрать все" — по умолчанию оставляем предприятие,
        // выбранное в enterprise-nav (если оно задано), чтобы не оставалось пусто.
        if (!isChecked) {
          const { currentEnt } = getGlobalFilters();
          const defaultCompany = (currentEnt && currentEnt !== 'all') ? currentEnt : null;

          // Сбрасываем и выставляем чекбоксы согласно defaultCompany
          selectedCompanies = [];
          checkboxes.forEach(cb => {
            const shouldBeChecked = defaultCompany ? (cb.value === defaultCompany) : false;
            cb.checked = shouldBeChecked;
            updateSelectedCompanies(cb.value, shouldBeChecked);
          });
        } else {
          checkboxes.forEach(cb => {
            cb.checked = true;
            updateSelectedCompanies(cb.value, true);
          });
        }

        updateSelectText();
        updateChart();
      });
      selectOptions.appendChild(selectAllLi);

      // Добавляем предприятия с чекбоксами
      companiesList.forEach(company => {
        const li = document.createElement('li');
        const escapedCompany = window.escapeHtml ? window.escapeHtml(company) : String(company).replace(/[&<>"']/g, m => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[m]);
        const checkboxId = `prospects-company-${company.replace(/\s+/g, '-')}`;
        li.innerHTML = `
          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; width: 100%; padding: 4px 0;">
            <input type="checkbox" id="${checkboxId}" value="${escapedCompany}" style="cursor: pointer;">
            <span>${escapedCompany}</span>
          </label>
        `;
        const checkbox = li.querySelector('input[type="checkbox"]');
        checkbox.addEventListener('change', (e) => {
          updateSelectedCompanies(e.target.value, e.target.checked);
          updateSelectAllState(selectAllCheckbox);
          updateSelectText();
          updateChart();
        });
        selectOptions.appendChild(li);
      });

      // Инициализируем состояние "Выбрать все" как не выбранное
      selectAllCheckbox.checked = false;
      // По умолчанию в селекте показываем предприятие,
      // выбранное в enterprise-nav (если пользователь ещё не менял выбор вручную).
      if (!isCompanySelectionDirty) {
        const { currentEnt } = getGlobalFilters();
        if (currentEnt && currentEnt !== 'all') {
          selectedCompanies = [currentEnt];
        } else {
          selectedCompanies = [];
        }
      }
      updateSelectText();

      // Синхронизируем состояние чекбоксов при открытии модального окна
      syncCheckboxesFn = () => {
        const checkboxes = selectOptions.querySelectorAll('li:not(.prospects-select-all) input[type="checkbox"]');
        checkboxes.forEach(cb => {
          cb.checked = selectedCompanies.includes(cb.value);
        });
        updateSelectAllState(selectAllCheckbox);
      };
    }

    // Открытие/закрытие выпадающего списка
    selectTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      companySelect.classList.toggle('open');
    });

    document.addEventListener('click', (e) => {
      if (!companySelect.contains(e.target)) {
        companySelect.classList.remove('open');
      }
    });

    // Загружаем blockToQuadrant для преобразования чисел блоков в названия
    let blockToQuadrantMap = null;
    let blockIdToNameMap = null;
    async function loadBlockMappings() {
      if (blockToQuadrantMap && blockIdToNameMap) return;
      try {
        const res = await fetch('/src/data/ru/blockToQuadrant.json', { cache: 'no-store' });
        blockToQuadrantMap = await res.json();

        // Пытаемся получить маппинг из RMK2.js, если доступен
        blockIdToNameMap = {};
        if (typeof window.blockIdToName !== 'undefined' && window.blockIdToName) {
          Object.assign(blockIdToNameMap, window.blockIdToName);
        } else if (typeof blockIdToName !== 'undefined' && blockIdToName) {
          Object.assign(blockIdToNameMap, blockIdToName);
        }

        // Если маппинг не получен из RMK2.js, создаем его на основе порядка блоков в blockToQuadrant.json
        if (Object.keys(blockIdToNameMap).length === 0) {
          // Создаем маппинг на основе порядка блоков в blockToQuadrant.json
          // Предполагаем, что ID блоков соответствуют порядку в файле (начиная с 1)
          const blockNames = Object.keys(blockToQuadrantMap);
          blockNames.forEach((name, index) => {
            blockIdToNameMap[index + 1] = name;
          });
        }
      } catch (e) {
        if (window.Logger) window.Logger.warn('Не удалось загрузить blockToQuadrant.json:', e);
      }
    }

    // Функция для преобразования числа блока в название блока
    function getBlockName(blockId) {
      if (typeof blockId === 'string') return blockId;
      if (typeof blockId === 'number') {
        // Сначала пытаемся использовать маппинг из RMK2.js
        if (blockIdToNameMap && blockIdToNameMap[blockId]) {
          return blockIdToNameMap[blockId];
        }
        // Если маппинг не доступен, пытаемся использовать порядок из blockToQuadrant
        if (blockToQuadrantMap) {
          const blockNames = Object.keys(blockToQuadrantMap);
          if (blockId > 0 && blockId <= blockNames.length) {
            return blockNames[blockId - 1];
          }
        }
      }
      return null;
    }

    // Получение глобальных фильтров из RMK2.js
    function getGlobalFilters() {
      let currentEnt = null;
      let zoomedQuadrant = null;
      let getFilterValuesFn = () => [];
      let getQuadrantIdForBlockFn = () => null;

      try {
        if (typeof window.currentEnterprise !== 'undefined') {
          currentEnt = window.currentEnterprise;
        } else if (typeof currentEnterprise !== 'undefined') {
          currentEnt = currentEnterprise;
        }

        if (typeof window.currentZoomedQuadrant !== 'undefined') {
          zoomedQuadrant = window.currentZoomedQuadrant;
        } else if (typeof currentZoomedQuadrant !== 'undefined') {
          zoomedQuadrant = currentZoomedQuadrant;
        }

        if (typeof window.getFilterValues === 'function') {
          getFilterValuesFn = window.getFilterValues;
        } else if (typeof getFilterValues === 'function') {
          getFilterValuesFn = getFilterValues;
        }

        if (typeof window.getQuadrantIdForBlock === 'function') {
          getQuadrantIdForBlockFn = window.getQuadrantIdForBlock;
        } else if (typeof getQuadrantIdForBlock === 'function') {
          getQuadrantIdForBlockFn = getQuadrantIdForBlock;
        }
      } catch (e) {
        if (window.Logger) window.Logger.warn('Не удалось получить фильтры из RMK2.js:', e);
      }

      return { currentEnt, zoomedQuadrant, getFilterValuesFn, getQuadrantIdForBlockFn };
    }

    // Извлечение уникальных компаний из данных
    function extractCompanies(data) {
      const companies = new Set();
      data.forEach(item => {
        if (item && item.company) {
          const list = Array.isArray(item.company) ? item.company : [item.company];
          list.forEach(c => {
            const company = (c == null ? '' : String(c)).trim();
            if (company) companies.add(company);
          });
        }
      });
      return Array.from(companies).sort();
    }

    // Определение компании для отображения
    function getDisplayCompany(item, selectedCompanies, currentEnt) {
      const itemCompaniesRaw = Array.isArray(item && item.company)
        ? item.company
        : (item && item.company ? [item.company] : []);
      const itemCompanies = itemCompaniesRaw
        .map(c => (c == null ? '' : String(c)).trim())
        .filter(Boolean);

      const selected = Array.isArray(selectedCompanies)
        ? selectedCompanies.map(c => (c == null ? '' : String(c)).trim()).filter(Boolean)
        : [];

      // Если в селекте выбран ОДИН завод — показываем именно его (если он есть у технологии)
      if (selected.length === 1) {
        const selectedOne = selected[0];
        if (itemCompanies.includes(selectedOne)) return selectedOne;
        return itemCompanies[0] || selectedOne;
      }

      // Если выбрано несколько — стараемся взять ту компанию технологии, которая входит в выбор
      if (selected.length > 1) {
        const match = itemCompanies.find(c => selected.includes(c));
        return match || itemCompanies[0] || selected[0] || null;
      }

      // Если селект пуст, но в enterprise-nav выбрано предприятие — показываем его
      if (currentEnt && currentEnt !== "all") {
        return currentEnt;
      }

      // Иначе — первое предприятие технологии (если есть)
      return itemCompanies[0] || null;
    }

    // Сортировка данных по ABC-оценке (по убыванию)
    function sortDataByABC(data) {
      return [...data].sort((a, b) => {
        const aVal = typeof a.abc === 'number' ? a.abc : (typeof a.score === 'number' ? a.score : 0);
        const bVal = typeof b.abc === 'number' ? b.abc : (typeof b.score === 'number' ? b.score : 0);
        return bVal - aVal;
      });
    }

    // Вспомогательные функции для создания SVG элементов
    function createSVGElement(tagName, attributes = {}, textContent = null) {
      const element = document.createElementNS(SVG_NS, tagName);
      Object.entries(attributes).forEach(([key, value]) => {
        element.setAttribute(key, value);
      });
      if (textContent !== null) {
        element.textContent = textContent;
      }
      return element;
    }

    function setSVGAttributes(element, attributes) {
      Object.entries(attributes).forEach(([key, value]) => {
        element.setAttribute(key, value);
      });
    }

    async function loadData() {
      // Загружаем маппинги блоков
      await loadBlockMappings();

      if (!allData) {
        const res = await fetch('/src/data/ru/enterpriseData.json', { cache: 'no-store' });
        allData = await res.json();
      }

      // Получаем список всех предприятий для проверки "все выбраны"
      // Сохраняем полный список предприятий в глобальную переменную и сортируем,
      // чтобы цвета были детерминированными и закреплёнными за каждым предприятием.
      allCompaniesList = extractCompanies(allData);
      // Переинициализируем карту цветов и назначаем уникальный цвет каждому предприятию.
      companyColors = {};
      allCompaniesList.forEach((company, index) => {
        companyColors[company] = generateCompanyColorByIndex(index, allCompaniesList.length);
      });

      // Получаем фильтры из RMK2.js (если доступны)
      const { currentEnt, zoomedQuadrant, getFilterValuesFn, getQuadrantIdForBlockFn } = getGlobalFilters();

      // Для графика «Перспективные» учитываем только фильтрацию по предприятиям,
      // остальные фильтры и зум радара игнорируем, чтобы всегда можно было
      // увидеть все технологии по выбранным предприятиям.
      // hasFilters здесь отражает только выбор предприятия в enterprise‑nav.
      const hasFilters = (currentEnt && currentEnt !== "all");

      const allSelected = selectedCompanies.length === 0 ||
        (selectedCompanies.length === allCompaniesList.length &&
         allCompaniesList.every(c => selectedCompanies.includes(c)));

      if (cachedData && allSelected && !hasFilters) {
        return cachedData;
      }

      // Базовый фильтр: только перспективные технологии (статус «Перспективные»)
      let filtered = allData.filter(item => {
        if (!item) return false;
        return (item.status === 'Перспективные' || item.level === 'Перспективные');
      });

      // Фильтрация по выбранным предприятиям:
      // 1) если в селекте графика выбраны предприятия — используем именно их;
      // 2) если селект пуст, но в enterprise‑nav выбрано конкретное предприятие —
      //    показываем технологии только этого предприятия;
      //
      // Важно: если в селекте выбраны ВСЕ предприятия (режим "Выбрать все"),
      // то это эквивалентно "нет фильтра по предприятиям" — показываем все технологии.
      if (selectedCompanies.length > 0) {
        if (!allSelected) {
          filtered = filtered.filter(item => {
            const itemCompanies = (Array.isArray(item.company) ? item.company : (item.company ? [item.company] : []))
              .map(c => (c == null ? '' : String(c)).trim())
              .filter(Boolean);
            const selected = selectedCompanies.map(c => (c == null ? '' : String(c)).trim()).filter(Boolean);
            return itemCompanies.some(comp => selected.includes(comp));
          });
        }
      } else if (currentEnt && currentEnt !== "all") {
        filtered = filtered.filter(item => {
          const itemCompanies = (Array.isArray(item.company) ? item.company : (item.company ? [item.company] : []))
            .map(c => (c == null ? '' : String(c)).trim())
            .filter(Boolean);
          return itemCompanies.includes(String(currentEnt).trim());
        });
      }

      const processed = [];
      filtered.forEach(t => {
        const a = Number(t.techRead) || 0;
        const b = Number(t.organRead) || 0;
        const c = Number(t.funcCover) || 0;

        // Все предприятия, к которым относится технология (если указаны)
        const itemCompaniesRaw = Array.isArray(t.company) ? t.company : (t.company ? [t.company] : []);
        const itemCompanies = itemCompaniesRaw
          .map(x => (x == null ? '' : String(x)).trim())
          .filter(Boolean);

        // Приоритет отключен
        let priority = null;

        // Интегральная метрика ABC: A*B*C (0–27) и её нормализация в [0,1]
        const abc = a * b * c;
        const abcNormalized = abc / 27;
        const score = abc;

        // ВАЖНО:
        // - если выбрано ОДНО предприятие (селект или enterprise-nav) — рисуем одну точку для него;
        // - если выбран режим "все предприятия" — для технологий с несколькими предприятиями
        //   рисуем отдельную точку для КАЖДОГО предприятия, чтобы в "все" не терялись точки АМК и др.
        const selected = Array.isArray(selectedCompanies)
          ? selectedCompanies.map(x => (x == null ? '' : String(x)).trim()).filter(Boolean)
          : [];

        let companiesToRender = [];

        if (selected.length > 0) {
          if (allSelected) {
            companiesToRender = itemCompanies.length > 0 ? itemCompanies : [null];
          } else {
            const subset = itemCompanies.filter(comp => selected.includes(comp));
            companiesToRender = subset.length > 0 ? subset : [getDisplayCompany(t, selectedCompanies, currentEnt)];
          }
        } else if (currentEnt && currentEnt !== 'all') {
          companiesToRender = [currentEnt];
        } else {
          companiesToRender = itemCompanies.length > 0 ? itemCompanies : [null];
        }

        companiesToRender.forEach(company => {
          const renderCompany = (company == null || company === '') ? null : String(company);
          processed.push({
            // делаем id уникальным для связки "технология + предприятие"
            id: `${t.id}::${renderCompany || '—'}`,
            originalId: t.id,
            name: t.name,
            company: renderCompany,
            // score используется как значение по оси X (ABC)
            score: score,
            cost: typeof t.costProm === 'number' ? t.costProm : 0,
            a,
            b,
            c,
            abc,
            abcNormalized,
            priority
          });
        });
      });

      // Кэшируем только если выбраны все предприятия и нет других фильтров
      if (allSelected && !hasFilters) cachedData = processed;
      return processed;
    }

    function clearSvg() {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
    }

    // Вычисление масштабов графика (общая логика для SVG и Canvas)
    function calculateChartScales(data, margin, width, height) {
      const ix0 = margin.left;
      const iy0 = height - margin.bottom;
      const ix1 = width - margin.right;
      const iy1 = margin.top;

      // Ось X отображает интегральную оценку ABC = A*B*C
      const abcValues = data.map(d =>
        typeof d.abc === 'number' && !Number.isNaN(d.abc)
          ? d.abc
          : (typeof d.score === 'number' && !Number.isNaN(d.score) ? d.score : 0)
      );
      let xMin = 0;
      let xMax = Math.max(3, ...abcValues);
      if (!Number.isFinite(xMax) || xMax <= xMin) {
        xMax = xMin + 3; // защита от деления на ноль
      }

      const costs = data.map(d => d.cost);
      const yMinRaw = Math.min(...costs);
      const yMaxRaw = Math.max(...costs);
      // Если все стоимости равны 0, устанавливаем разумные значения для отображения
      const pad = yMaxRaw === 0 && yMinRaw === 0 ? 10 : Math.max(2, Math.round((yMaxRaw - yMinRaw) * 0.08));
      const yMin = Math.max(0, yMinRaw - pad);
      const yMax = yMaxRaw === 0 && yMinRaw === 0 ? 50 : yMaxRaw + pad;

      const xMap = (val) => ix0 + (val - xMin) / (xMax - xMin || 1) * (ix1 - ix0);
      const yMap = (val) => iy0 - (val - yMin) / (yMax - yMin || 1) * (iy0 - iy1);

      return { xMin, xMax, yMin, yMax, xMap, yMap, ix0, iy0, ix1, iy1 };
    }

    // Отрисовка осей для SVG
    function drawAxesSVG(svg, SVG_NS, ix0, iy0, ix1, iy1) {
      const xAxis = document.createElementNS(SVG_NS, 'line');
      xAxis.setAttribute('x1', ix0); xAxis.setAttribute('y1', iy0);
      xAxis.setAttribute('x2', ix1); xAxis.setAttribute('y2', iy0);
      xAxis.setAttribute('stroke', 'currentColor');
      xAxis.setAttribute('stroke-opacity', '0.6');
      svg.appendChild(xAxis);

      const yAxis = document.createElementNS(SVG_NS, 'line');
      yAxis.setAttribute('x1', ix0); yAxis.setAttribute('y1', iy0);
      yAxis.setAttribute('x2', ix0); yAxis.setAttribute('y2', iy1);
      yAxis.setAttribute('stroke', 'currentColor');
      yAxis.setAttribute('stroke-opacity', '0.6');
      svg.appendChild(yAxis);
    }

    // Отрисовка сетки для SVG
    function drawGridSVG(svg, SVG_NS, xMin, xMax, yMin, yMax, xMap, yMap, ix0, iy0, ix1, iy1) {
      // Grid lines по X
      const xTicksVals = [];
      const xTickCount = 6;
      const xStep = (xMax - xMin) / xTickCount;
      for (let i = 0; i <= xTickCount; i++) {
        const v = xMin + xStep * i;
        xTicksVals.push(Math.round(v));
      }
      xTicksVals.forEach(val => {
        const x = xMap(val);
        const grid = document.createElementNS(SVG_NS, 'line');
        grid.setAttribute('x1', x); grid.setAttribute('y1', iy0);
        grid.setAttribute('x2', x); grid.setAttribute('y2', iy1);
        grid.setAttribute('stroke', 'currentColor');
        grid.setAttribute('stroke-opacity', '0.1');
        svg.appendChild(grid);
        const tick = document.createElementNS(SVG_NS, 'line');
        tick.setAttribute('x1', x); tick.setAttribute('y1', iy0);
        tick.setAttribute('x2', x); tick.setAttribute('y2', iy0 + 6);
        tick.setAttribute('stroke', 'currentColor');
        tick.setAttribute('stroke-opacity', '0.6');
        svg.appendChild(tick);
        const lbl = document.createElementNS(SVG_NS, 'text');
        lbl.setAttribute('x', x);
        lbl.setAttribute('y', iy0 + 24);
        lbl.setAttribute('text-anchor', 'middle');
        lbl.setAttribute('fill', 'currentColor');
        lbl.setAttribute('font-size', '24');
        lbl.textContent = String(val);
        svg.appendChild(lbl);
      });

      // Grid lines по Y
      const yTickCount = 6;
      const yTicksVals = Array.from({ length: yTickCount }, (_, i) =>
        Math.round(yMin + (i * (yMax - yMin)) / (yTickCount - 1))
      );
      yTicksVals.forEach(val => {
        const y = yMap(val);
        const grid = document.createElementNS(SVG_NS, 'line');
        grid.setAttribute('x1', ix0); grid.setAttribute('y1', y);
        grid.setAttribute('x2', ix1); grid.setAttribute('y2', y);
        grid.setAttribute('stroke', 'currentColor');
        grid.setAttribute('stroke-opacity', '0.1');
        svg.appendChild(grid);
        const tick = document.createElementNS(SVG_NS, 'line');
        tick.setAttribute('x1', ix0 - 6); tick.setAttribute('y1', y);
        tick.setAttribute('x2', ix0); tick.setAttribute('y2', y);
        tick.setAttribute('stroke', 'currentColor');
        tick.setAttribute('stroke-opacity', '0.6');
        svg.appendChild(tick);
        const lbl = document.createElementNS(SVG_NS, 'text');
        lbl.setAttribute('x', ix0 - 10);
        lbl.setAttribute('y', y + 4);
        lbl.setAttribute('text-anchor', 'end');
        lbl.setAttribute('fill', 'currentColor');
        lbl.setAttribute('font-size', '22');
        lbl.textContent = String(val);
        svg.appendChild(lbl);
      });
    }

    // Отрисовка осей для Canvas
    function drawAxesCanvas(ctx, ix0, iy0, ix1, iy1) {
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.moveTo(ix0, iy0);
      ctx.lineTo(ix1, iy0);
      ctx.moveTo(ix0, iy0);
      ctx.lineTo(ix0, iy1);
      ctx.stroke();
    }

    // Отрисовка сетки для Canvas
    function drawGridCanvas(ctx, xMin, xMax, yMin, yMax, xMap, yMap, ix0, iy0, ix1, iy1) {
      // Сетка и подписи по X
      const xTicksVals = [];
      const xTickCount = 6;
      const xStep = (xMax - xMin) / xTickCount;
      for (let i = 0; i <= xTickCount; i++) {
        xTicksVals.push(Math.round(xMin + xStep * i));
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#000000';
      ctx.textAlign = 'center';

      xTicksVals.forEach(val => {
        const x = xMap(val);
        // вертикальная сетка
        ctx.strokeStyle = 'rgba(0,0,0,0.1)';
        ctx.beginPath();
        ctx.moveTo(x, iy0);
        ctx.lineTo(x, iy1);
        ctx.stroke();
        // засечка
        ctx.strokeStyle = 'rgba(0,0,0,0.6)';
        ctx.beginPath();
        ctx.moveTo(x, iy0);
        ctx.lineTo(x, iy0 + 6);
        ctx.stroke();
        // подпись
        ctx.font = '16px Arial';
        ctx.fillText(String(val), x, iy0 + 10);
      });

      // Сетка и подписи по Y
      const yTickCount = 6;
      const yTicksVals = Array.from({ length: yTickCount }, (_, i) =>
        Math.round(yMin + (i * (yMax - yMin)) / (yTickCount - 1 || 1))
      );
      ctx.textAlign = 'right';

      yTicksVals.forEach(val => {
        const y = yMap(val);
        ctx.strokeStyle = 'rgba(0,0,0,0.1)';
        ctx.beginPath();
        ctx.moveTo(ix0, y);
        ctx.lineTo(ix1, y);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(0,0,0,0.6)';
        ctx.beginPath();
        ctx.moveTo(ix0 - 6, y);
        ctx.lineTo(ix0, y);
        ctx.stroke();

        ctx.font = '16px Arial';
        ctx.fillText(String(val), ix0 - 8, y - 8);
      });
    }

    // Отрисовка легенды для SVG
    function drawLegendSVG(svg, SVG_NS, data, ix1, iy1, iy0) {
      const uniqueCompanies = [...new Set(data.map(d => d.company))].sort();
      if (uniqueCompanies.length === 0) return false;

      const legendGroup = document.createElementNS(SVG_NS, 'g');
      legendGroup.setAttribute('class', 'company-legend');
      const legendX = ix1 + 20;
      const legendY = iy1;
      const legendItemHeight = 24;
      const maxLegendHeight = iy0 - iy1;
      const maxItems = Math.floor(maxLegendHeight / legendItemHeight);
      const companiesToShow = uniqueCompanies.slice(0, maxItems);

      companiesToShow.forEach((company, idx) => {
        const color = getCompanyColor(company);
        const y = legendY + idx * legendItemHeight;

        // Цветной квадрат
        const rect = document.createElementNS(SVG_NS, 'rect');
        rect.setAttribute('x', legendX);
        rect.setAttribute('y', y - 10);
        rect.setAttribute('width', 14);
        rect.setAttribute('height', 14);
        rect.setAttribute('fill', color);
        rect.setAttribute('stroke', 'currentColor');
        rect.setAttribute('stroke-opacity', '0.3');
        rect.setAttribute('stroke-width', '1');
        legendGroup.appendChild(rect);

        // Текст компании
        const text = document.createElementNS(SVG_NS, 'text');
        text.setAttribute('x', legendX + 20);
        text.setAttribute('y', y + 2);
        text.setAttribute('fill', 'currentColor');
        text.setAttribute('font-size', '16');
        text.textContent = company;
        legendGroup.appendChild(text);
      });

      // Если есть скрытые компании, показываем подсказку
      if (uniqueCompanies.length > maxItems) {
        const moreText = document.createElementNS(SVG_NS, 'text');
        moreText.setAttribute('x', legendX);
        moreText.setAttribute('y', legendY + companiesToShow.length * legendItemHeight + 4);
        moreText.setAttribute('fill', 'currentColor');
        moreText.setAttribute('font-size', '14');
        moreText.setAttribute('opacity', '0.7');
        moreText.textContent = `...и ещё ${uniqueCompanies.length - maxItems}`;
        legendGroup.appendChild(moreText);
      }

      svg.appendChild(legendGroup);
      return uniqueCompanies.length > 1;
    }

    // Отрисовка легенды для Canvas
    function drawLegendCanvas(ctx, data, ix1, iy1, iy0) {
      const uniqueCompanies = [...new Set(data.map(d => d.company))].sort();
      if (uniqueCompanies.length === 0) return;

      const legendX = ix1 + 20;
      const legendY = iy1;
      const legendItemHeight = 22;
      const maxLegendHeight = iy0 - iy1;
      const maxItems = Math.floor(maxLegendHeight / legendItemHeight);
      const companiesToShow = uniqueCompanies.slice(0, maxItems);

      ctx.textAlign = 'left';
      ctx.font = '14px Arial';

      companiesToShow.forEach((company, idx) => {
        const color = getCompanyColor(company);
        const y = legendY + idx * legendItemHeight;

        // квадрат
        ctx.fillStyle = color || '#808080';
        ctx.fillRect(legendX, y - 8, 14, 14);
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.strokeRect(legendX, y - 8, 14, 14);

        // текст
        ctx.fillStyle = '#000000';
        ctx.fillText(company, legendX + 20, y - 10);
      });

      if (uniqueCompanies.length > maxItems) {
        ctx.fillStyle = '#000000';
        ctx.globalAlpha = 0.7;
        ctx.fillText(`...и ещё ${uniqueCompanies.length - maxItems}`, legendX, legendY + companiesToShow.length * legendItemHeight);
        ctx.globalAlpha = 1;
      }
    }

    function drawChart(data) {
      clearSvg();
      if (!data || data.length === 0) {
        const noDataText = document.createElementNS(SVG_NS, 'text');
        noDataText.setAttribute('x', 500);
        noDataText.setAttribute('y', 340);
        noDataText.setAttribute('text-anchor', 'middle');
        noDataText.setAttribute('fill', 'currentColor');
        noDataText.setAttribute('font-size', '24');
        noDataText.textContent = 'Нет данных для отображения';
        svg.appendChild(noDataText);
        return;
      }

      const margin = { top: 60, right: 200, bottom: 80, left: 90 }; // Увеличили right для легенды
      const width = 1200; // Увеличили ширину для легенды
      const height = 680;
      const { xMin, xMax, yMin, yMax, xMap, yMap, ix0, iy0, ix1, iy1 } = calculateChartScales(data, margin, width, height);

      // Axes and Grid
      drawAxesSVG(svg, SVG_NS, ix0, iy0, ix1, iy1);
      drawGridSVG(svg, SVG_NS, xMin, xMax, yMin, yMax, xMap, yMap, ix0, iy0, ix1, iy1);

      // Labels
      const xLabel = createSVGElement('text', {
        'x': (ix0 + ix1) / 2,
        'y': iy0 + 48,
        'text-anchor': 'middle',
        'fill': 'currentColor',
        'font-size': '22'
      }, 'Оценка');
      svg.appendChild(xLabel);

      const yLabel = createSVGElement('text', {
        'x': ix0 - 60,
        'y': (iy0 + iy1) / 2,
        'text-anchor': 'middle',
        'fill': 'currentColor',
        'font-size': '24',
        'transform': `rotate(-90 ${ix0 - 60} ${(iy0 + iy1) / 2})`
      }, 'Стоимость внедрения');
      svg.appendChild(yLabel);

      // Легенда компаний (размещаем справа от графика, но не перекрывая его)
      // Кольца-подсветки для совпадающих точек показываем только,
      // если на графике одновременно отображаются данные более чем по одному предприятию.
      const enableOverlapHalo = drawLegendSVG(svg, SVG_NS, data, ix1, iy1, iy0);

      // Линия, соединяющая ВСЕ точки (даже с разных предприятий).
      // Цвета точек остаются корпоративными; линия нейтральная и полупрозрачная.
      const allLinePoints = data.map(d => {
        const xVal = (typeof d.abc === 'number' && !Number.isNaN(d.abc)) ? d.abc : d.score;
        return { cx: xMap(xVal), cy: yMap(d.cost) };
      });
      if (allLinePoints.length >= 2) {
        allLinePoints.sort((a, b) => (a.cx - b.cx) || (a.cy - b.cy));
        const polyline = document.createElementNS(SVG_NS, 'polyline');
        polyline.setAttribute('points', allLinePoints.map(p => `${p.cx},${p.cy}`).join(' '));
        polyline.setAttribute('fill', 'none');
        polyline.setAttribute('stroke', 'currentColor');
        polyline.setAttribute('stroke-width', '1.5');
        polyline.setAttribute('stroke-opacity', '0.28');
        polyline.setAttribute('class', 'prospects-all-line');
        polyline.style.pointerEvents = 'none';
        svg.appendChild(polyline);
      }

      // Определяем позиции, на которых находятся несколько технологий одновременно
      const positionCounts = new Map();
      const positionTechIds = new Map();
      const positionEntries = new Map();
      data.forEach(d => {
        const xValRaw = (typeof d.abc === 'number' && !Number.isNaN(d.abc)) ? d.abc : d.score;
        const key = `${xValRaw}|${d.cost}`;
        positionCounts.set(key, (positionCounts.get(key) || 0) + 1);

        if (!positionTechIds.has(key)) {
          positionTechIds.set(key, []);
        }
        positionTechIds.get(key).push(d.id);

        if (!positionEntries.has(key)) {
          positionEntries.set(key, []);
        }
        positionEntries.get(key).push(d);
      });

      // Points
      data.forEach(d => {
        const xVal = (typeof d.abc === 'number' && !Number.isNaN(d.abc)) ? d.abc : d.score;
        const cx = xMap(xVal);
        const cy = yMap(d.cost);
        const key = `${xVal}|${d.cost}`;
        const hasOverlap = (positionCounts.get(key) || 0) > 1;

        const g = document.createElementNS(SVG_NS, 'g');
        const companyColor = getCompanyColor(d.company);

        // Если в этой точке несколько технологий и на графике несколько предприятий,
        // рисуем дополнительное кольцо‑подсветку
        if (hasOverlap && enableOverlapHalo) {
          const halo = document.createElementNS(SVG_NS, 'circle');
          halo.setAttribute('cx', cx);
          halo.setAttribute('cy', cy);
          halo.setAttribute('r', 9);
          halo.setAttribute('fill', 'none');
          halo.setAttribute('class', 'prospects-chart-point-overlap-halo');
          halo.style.pointerEvents = 'none';
          g.appendChild(halo);
        }

        const c = document.createElementNS(SVG_NS, 'circle');
        c.setAttribute('cx', cx);
        c.setAttribute('cy', cy);
        c.setAttribute('r', 6);
        c.setAttribute('fill', companyColor);
        c.setAttribute('fill-opacity', '0.9');
        c.setAttribute('stroke', companyColor);
        c.setAttribute('stroke-opacity', '0.8');
        c.setAttribute('stroke-width', '1.5');
        // Текст подсказки: список всех технологий в этой точке.
        // Формат: "• Технология: Предприятие"
        const entriesAtPos = positionEntries.get(key) || [d];
        const sortedEntries = [...entriesAtPos].sort((a, b) => {
          const nameA = String(a && a.name ? a.name : '').toLowerCase();
          const nameB = String(b && b.name ? b.name : '').toLowerCase();
          if (nameA !== nameB) return nameA.localeCompare(nameB, 'ru');
          const compA = String(a && a.company ? a.company : '').toLowerCase();
          const compB = String(b && b.company ? b.company : '').toLowerCase();
          return compA.localeCompare(compB, 'ru');
        });
        const tooltipLines = sortedEntries.map(entry => {
          const techName = entry && entry.name ? entry.name : '—';
          const company = entry && entry.company ? entry.company : '—';
          return `• ${techName}: ${company}`;
        });
        c.setAttribute('data-tooltip', tooltipLines.join('\n'));
        c.setAttribute('data-company', d.company);
        c.setAttribute('data-tech-id', d.id);
        c.setAttribute('class', 'prospects-chart-point');
        c.style.transition = 'transform 140ms ease, filter 140ms ease, opacity 140ms ease';
        c.style.transformOrigin = '50% 50%';
        c.style.transformBox = 'fill-box';
        c.addEventListener('mouseenter', () => {
          c.style.cursor = 'pointer';
          const currentClass = c.getAttribute('class') || '';
          if (!currentClass.includes('highlighted')) {
            c.style.transform = 'scale(1.4)';
            c.setAttribute('stroke-opacity', '1');
            c.setAttribute('stroke-width', '2.5');
            c.style.filter = `drop-shadow(0 0 8px ${companyColor})`;
          }
        });
        c.addEventListener('mouseleave', () => {
          const currentClass = c.getAttribute('class') || '';
          if (!currentClass.includes('highlighted')) {
            c.style.transform = 'scale(1)';
            c.setAttribute('stroke-opacity', '0.8');
            c.setAttribute('stroke-width', '1.5');
            c.style.filter = 'none';
          }
        });
        c.addEventListener('click', () => {
          if (hasOverlap && enableOverlapHalo) {
            const idsAtPos = positionTechIds.get(key) || [d.id];
            highlightTechs(idsAtPos);
          } else {
            toggleTechHighlight(d.id);
          }
        });
        g.appendChild(c);
        svg.appendChild(g);
      });
    }

    // Функция для заполнения таблицы
    function updateTable(data) {
      const tbody = document.getElementById('prospectsTableBody');
      if (!tbody) return;

      tbody.innerHTML = '';

      if (!data || data.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = '<td colspan="7" style="text-align:center; padding:20px;">Нет данных для отображения</td>';
        tbody.appendChild(tr);
        return;
      }

      // Сортируем данные по интегральной ABC‑оценке (по убыванию)
      const sortedData = sortDataByABC(data);

      sortedData.forEach(d => {
        const tr = document.createElement('tr');
        const companyColor = getCompanyColor(d.company);
        tr.setAttribute('data-tech-id', d.id);
        tr.setAttribute('class', 'prospects-table-row');
        tr.style.cursor = 'pointer';

        // Ячейка с названием технологии
        const tdName = document.createElement('td');
        tdName.textContent = d.name;
        tr.appendChild(tdName);

        // Ячейка с предприятием (с цветным индикатором)
        const tdCompany = document.createElement('td');
        const companyIndicator = document.createElement('span');
        companyIndicator.style.display = 'inline-block';
        companyIndicator.style.width = '12px';
        companyIndicator.style.height = '12px';
        companyIndicator.style.borderRadius = '2px';
        companyIndicator.style.backgroundColor = companyColor;
        companyIndicator.style.marginRight = '8px';
        companyIndicator.style.verticalAlign = 'middle';
        tdCompany.appendChild(companyIndicator);
        tdCompany.appendChild(document.createTextNode(d.company));
        tr.appendChild(tdCompany);

        // Ячейки с отдельными оценками A, B, C
        const tdA = document.createElement('td');
        tdA.textContent = (d.a != null && !Number.isNaN(d.a)) ? d.a : '—';
        tr.appendChild(tdA);

        const tdB = document.createElement('td');
        tdB.textContent = (d.b != null && !Number.isNaN(d.b)) ? d.b : '—';
        tr.appendChild(tdB);

        const tdC = document.createElement('td');
        tdC.textContent = (d.c != null && !Number.isNaN(d.c)) ? d.c : '—';
        tr.appendChild(tdC);

        // Ячейка с общей оценкой A*B*C
        const tdAbc = document.createElement('td');
        tdAbc.textContent = (d.abc != null && !Number.isNaN(d.abc)) ? d.abc : '—';
        tr.appendChild(tdAbc);

        // Ячейка со стоимостью
        const tdCost = document.createElement('td');
        tdCost.textContent = d.cost > 0 ? d.cost.toLocaleString('ru-RU') : '—';
        tr.appendChild(tdCost);

        // Добавляем обработчик клика
        tr.addEventListener('click', () => {
          toggleTechHighlight(d.id);
        });

        tbody.appendChild(tr);
      });
    }

    // Функция фильтрации таблицы по поисковому запросу
    function filterTable(searchValue) {
      const tbody = document.getElementById('prospectsTableBody');
      if (!tbody) return;

      const rows = tbody.querySelectorAll('tr');
      const searchLower = searchValue.toLowerCase().trim();

      rows.forEach(row => {
        if (searchLower === '') {
          row.style.display = '';
          return;
        }

        // Получаем текст из всех ячеек строки
        const cells = row.querySelectorAll('td');
        let rowText = '';
        cells.forEach(cell => {
          rowText += cell.textContent.toLowerCase() + ' ';
        });

        // Показываем строку, если она содержит поисковый запрос
        if (rowText.includes(searchLower)) {
          row.style.display = '';
        } else {
          row.style.display = 'none';
        }
      });
    }

    // Инициализация обработчика поиска (используем делегирование событий)
    modal.addEventListener('input', (e) => {
      if (e.target && e.target.id === 'prospectsTableSearch') {
        filterTable(e.target.value);
      }
    });

    // Снятие подсветки со всех элементов
    function clearAllHighlights() {
      svg.querySelectorAll('circle[data-tech-id]').forEach(point => {
        const pointClass = point.getAttribute('class') || '';
        if (pointClass.includes('highlighted')) {
          const newClass = pointClass.replace(/\s*highlighted\s*/g, ' ').trim();
          point.setAttribute('class', newClass || 'prospects-chart-point');
          point.setAttribute('stroke-opacity', '0.8');
          point.setAttribute('stroke-width', '1.5');
          point.setAttribute('r', '6');
          point.style.filter = 'none';
          point.style.transform = 'scale(1)';
        }
      });

      document.querySelectorAll('tr[data-tech-id]').forEach(row => {
        row.classList.remove('highlighted');
      });
    }

    // Применение подсветки к элементу
    function applyHighlight(techId, scrollToRow = false) {
      const chartPoint = svg.querySelector(`circle[data-tech-id="${techId}"]`);
      const tableRow = document.querySelector(`tr[data-tech-id="${techId}"]`);

      if (chartPoint) {
        const companyColor = chartPoint.getAttribute('fill');
        const currentClass = chartPoint.getAttribute('class') || 'prospects-chart-point';
        chartPoint.setAttribute('class', currentClass + ' highlighted');
        chartPoint.setAttribute('stroke-opacity', '1');
        chartPoint.setAttribute('stroke-width', '3');
        chartPoint.setAttribute('r', '8');
        chartPoint.style.filter = `drop-shadow(0 0 12px ${companyColor})`;
        chartPoint.style.transform = 'scale(1.5)';
      }

      if (tableRow) {
        tableRow.classList.add('highlighted');
        if (scrollToRow) {
          tableRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }
    }

    // Функция для переключения подсветки технологии (одиночный выбор)
    function toggleTechHighlight(techId) {
      if (!techId) return;

      const chartPoint = svg.querySelector(`circle[data-tech-id="${techId}"]`);
      const currentClass = chartPoint ? (chartPoint.getAttribute('class') || '') : '';
      const isHighlighted = currentClass.includes('highlighted');

      // Снимаем подсветку со всех элементов
      clearAllHighlights();

      // Если элемент был не подсвечен, подсвечиваем его
      if (!isHighlighted) {
        applyHighlight(techId, true);
      }
    }

    // Функция для подсветки всех технологий, относящихся к одной точке на графике
    function highlightTechs(techIds) {
      if (!Array.isArray(techIds) || techIds.length === 0) return;

      // Снимаем подсветку со всех элементов
      clearAllHighlights();

      // Подсвечиваем все технологии из переданного списка
      let firstRow = null;
      techIds.forEach(id => {
        applyHighlight(id, false);
        const tableRow = document.querySelector(`tr[data-tech-id="${id}"]`);
        if (tableRow && !firstRow) {
          firstRow = tableRow;
        }
      });

      // Прокручиваем к первой строке из группы
      if (firstRow) {
        firstRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }

    async function updateChart() {
      const data = await loadData();
      drawChart(data);
      updateTable(data);
      // Сбрасываем поле поиска при обновлении данных
      const searchInput = document.getElementById('prospectsTableSearch');
      if (searchInput) {
        searchInput.value = '';
        filterTable('');
      }
    }

    // Функция для обновления графика при изменении фильтров (если модальное окно открыто)
    function checkAndUpdateChart() {
      if (modal && modal.style.display !== 'none' && modal.classList.contains('open')) {
        updateChart();
      }
    }

    // Добавляем слушатели на изменения фильтров (если они доступны)
    // Используем MutationObserver для отслеживания изменений в скрытых полях фильтров
    if (typeof MutationObserver !== 'undefined') {
      const filterObserver = new MutationObserver(() => {
        checkAndUpdateChart();
      });

      // Наблюдаем за изменениями в скрытых полях фильтров
      ['filter_block', 'filter_function', 'filter_techType'].forEach(filterId => {
        const filterInput = document.getElementById(filterId);
        if (filterInput) {
          filterObserver.observe(filterInput, { attributes: true, attributeFilter: ['value'] });
          filterInput.addEventListener('change', checkAndUpdateChart);
        }
      });

      // Также слушаем изменения в enterprise-nav
      const enterpriseNav = document.querySelector('.enterprise-nav');
      if (enterpriseNav) {
        enterpriseNav.addEventListener('click', (e) => {
          if (e.target.tagName === 'BUTTON') {
            setTimeout(() => {
              // Небольшая задержка для обновления currentEnterprise
              if (modal && modal.style.display !== 'none' && modal.classList.contains('open')) {
                const { currentEnt } = getGlobalFilters();
                const curNav = (currentEnt && currentEnt !== 'all') ? currentEnt : 'all';

                // Если пользователь НЕ менял выбор предприятий в модалке вручную,
                // то при переключении в enterprise-nav автоматически обновляем селект и данные.
                if (!isCompanySelectionDirty) {
                  // Синхронизируем только если предприятие реально изменилось
                  if (curNav !== lastSyncedEnterpriseNav) {
                    syncSelectionFromEnterpriseNav();
                  }
                }
              }
              checkAndUpdateChart();
            }, 100);
          }
        });
      }
    }

    // Функция для рендеринга русского текста на canvas
    function renderTextToCanvas(text, fontSize, fontWeight, maxWidthPx) {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const scale = 2; // Для лучшего качества

      // Устанавливаем стили текста
      ctx.font = `${fontWeight} ${fontSize * scale}px Arial, sans-serif`;
      ctx.fillStyle = '#000000';
      ctx.textBaseline = 'top';

      // Измеряем текст
      const lines = [];
      const words = String(text || '').split(' ');
      let currentLine = '';

      words.forEach(word => {
        const testLine = currentLine ? currentLine + ' ' + word : word;
        const metrics = ctx.measureText(testLine);

        if (metrics.width > maxWidthPx * scale && currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      });
      if (currentLine) lines.push(currentLine);

      // Вычисляем размеры canvas
      const lineHeight = fontSize * scale * 1.2;
      const padding = 4 * scale;
      const width = Math.max(...lines.map(line => ctx.measureText(line).width)) + padding * 2;
      const height = lines.length * lineHeight + padding * 2;

      canvas.width = width;
      canvas.height = height;

      // Перерисовываем с учетом нового размера
      ctx.font = `${fontWeight} ${fontSize * scale}px Arial, sans-serif`;
      ctx.fillStyle = '#000000';
      ctx.textBaseline = 'top';

      // Рисуем текст
      lines.forEach((line, index) => {
        ctx.fillText(line, padding, padding + index * lineHeight);
      });

      return { canvas, scale };
    }

    // НОВОЕ: отрисовка графика «Перспективные» на canvas (для PDF, без html2canvas)
    function drawProspectsChartOnCanvas(ctx, data, width, height) {
      // Фон
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      ctx.textBaseline = 'top';

      const margin = { top: 60, right: 200, bottom: 80, left: 90 };
      const { xMin, xMax, yMin, yMax, xMap, yMap, ix0, iy0, ix1, iy1 } = calculateChartScales(data, margin, width, height);

      // Оси и сетка
      drawAxesCanvas(ctx, ix0, iy0, ix1, iy1);
      drawGridCanvas(ctx, xMin, xMax, yMin, yMax, xMap, yMap, ix0, iy0, ix1, iy1);

      // Подписи осей
      ctx.textAlign = 'center';
      ctx.font = '18px Arial';
      ctx.fillText('Оценка', (ix0 + ix1) / 2, iy0 + 36);

      ctx.save();
      ctx.translate(ix0 - 60, (iy0 + iy1) / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = 'center';
      ctx.fillText('Стоимость внедрения', 0, -12);
      ctx.restore();

      // Легенда по предприятиям
      drawLegendCanvas(ctx, data, ix1, iy1, iy0);

      // Линия, соединяющая ВСЕ точки (даже с разных предприятий)
      const allLinePoints = data.map(d => {
        const xVal = (typeof d.abc === 'number' && !Number.isNaN(d.abc)) ? d.abc : d.score;
        return { cx: xMap(xVal), cy: yMap(d.cost) };
      });
      if (allLinePoints.length >= 2) {
        allLinePoints.sort((a, b) => (a.cx - b.cx) || (a.cy - b.cy));
        ctx.strokeStyle = '#000000';
        ctx.globalAlpha = 0.28;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        allLinePoints.forEach((p, idx) => {
          if (idx === 0) ctx.moveTo(p.cx, p.cy);
          else ctx.lineTo(p.cx, p.cy);
        });
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // Точки
      data.forEach(d => {
        const xVal = (typeof d.abc === 'number' && !Number.isNaN(d.abc)) ? d.abc : d.score;
        const cx = xMap(xVal);
        const cy = yMap(d.cost);
        const color = getCompanyColor(d.company) || '#3366cc';

        ctx.beginPath();
        ctx.arc(cx, cy, 6, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.9;
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.8;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.globalAlpha = 1;
      });
    }

    // Вспомогательная функция переноса текста в ячейках таблицы
    function wrapProspectsTableText(ctx, text, maxWidthPx) {
      const words = String(text || '').split(/\s+/);
      const lines = [];
      let line = '';

      for (let i = 0; i < words.length; i++) {
        const word = words[i];
        const testLine = line ? line + ' ' + word : word;
        const testWidth = ctx.measureText(testLine).width;
        if (testWidth > maxWidthPx && line) {
          lines.push(line);
          line = word;
        } else {
          line = testLine;
        }
      }

      if (line) lines.push(line);
      return lines;
    }

    // Рендеринг таблицы «Перспективные» в несколько страниц canvas (для PDF, без html2canvas)
    function renderProspectsTablePages(sortedData, pageWidthMm, pageHeightMm, marginMm) {
      const images = [];

      const DPI = 150;
      const pxPerMM = DPI / 25.4;
      const mmToPx = (mm) => Math.round(mm * pxPerMM);

      const cw = mmToPx(pageWidthMm);
      const ch = mmToPx(pageHeightMm);
      const marginPx = mmToPx(marginMm);
      const tableWidthPx = cw - 2 * marginPx;

      const headers = [
        'Технология',
        'Предприятие',
        'Технологическая готовность',
        'Организационная готовность',
        'Покрытие функций',
        'Общая оценка',
        'Стоимость внедрения'
      ];

      // Пропорции ширин колонок:
      //  - "Предприятие" и "Стоимость внедрения" сделаны уже;
      //  - колонки готовности A/B/C расширены под длинные подписи.
      const colFractions = [0.25, 0.10, 0.14, 0.14, 0.14, 0.08, 0.15];
      const colWidths = colFractions.map(f => tableWidthPx * f);

      const fontFamily = 'Segoe UI, Roboto, Arial, sans-serif';
      const headerFontSize = 20;
      const cellFontSize = 18;
      const lineHeight = Math.round(cellFontSize * 1.3);
      const headerLineHeight = Math.round(headerFontSize * 1.2);
      const cellPadding = 4;

      let rowIndex = 0;
      let globalRowIndex = 0;

      while (rowIndex < sortedData.length) {
        const canvas = document.createElement('canvas');
        canvas.width = cw;
        canvas.height = ch;
        const ctx = canvas.getContext('2d');

        // Фон страницы
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, cw, ch);
        ctx.textBaseline = 'top';

        let y = marginPx;

        // Заголовок таблицы с переносом слов в ячейках заголовков
        ctx.fillStyle = '#000000';
        ctx.font = `${headerFontSize}px ${fontFamily}`;
        ctx.textAlign = 'left';

        // Сначала рассчитываем перенос строк и высоту заголовка
        const headerLinesByCol = headers.map((h, i) => {
          const maxWidth = colWidths[i] - cellPadding * 2;
          return wrapProspectsTableText(ctx, h, maxWidth);
        });
        let maxHeaderLines = 1;
        headerLinesByCol.forEach(lines => {
          if (lines.length > maxHeaderLines) maxHeaderLines = lines.length;
        });
        const headerHeight = maxHeaderLines * headerLineHeight + cellPadding * 2;

        // Фон заголовка
        ctx.fillStyle = '#e0e0e0';
        ctx.fillRect(marginPx, y, tableWidthPx, headerHeight);
        ctx.fillStyle = '#000000';

        // Рисуем текст заголовков по строкам внутри своих столбцов
        let x = marginPx;
        headers.forEach((h, i) => {
          const colWidth = colWidths[i];
          const lines = headerLinesByCol[i];
          const totalTextHeight = lines.length * headerLineHeight;
          let textY = y + Math.max(0, (headerHeight - totalTextHeight) / 2);

          lines.forEach(line => {
            ctx.fillText(line, x + cellPadding, textY);
            textY += headerLineHeight;
          });

          x += colWidth;
        });

        y += headerHeight;

        ctx.font = `${cellFontSize}px ${fontFamily}`;
        ctx.textBaseline = 'top';

        while (rowIndex < sortedData.length) {
          const d = sortedData[rowIndex];
          const values = [
            d.name || '',
            d.company || '',
            (d.a != null && !Number.isNaN(d.a)) ? String(d.a) : '—',
            (d.b != null && !Number.isNaN(d.b)) ? String(d.b) : '—',
            (d.c != null && !Number.isNaN(d.c)) ? String(d.c) : '—',
            (d.abc != null && !Number.isNaN(d.abc)) ? String(d.abc) : '—',
            d.cost > 0 ? d.cost.toLocaleString('ru-RU') : '—'
          ];

          const cellLines = [];
          let maxLines = 1;

          for (let colIdx = 0; colIdx < values.length; colIdx++) {
            const text = String(values[colIdx] || '');
            const maxWidth = colWidths[colIdx] - cellPadding * 2;
            const lines = wrapProspectsTableText(ctx, text, maxWidth);
            cellLines[colIdx] = lines;
            if (lines.length > maxLines) maxLines = lines.length;
          }

          const rowHeight = maxLines * lineHeight + cellPadding * 2;

          // Если строка не помещается на текущей странице — выходим, она уйдёт на следующую
          if (y + rowHeight > ch - marginPx) {
            break;
          }

          // Зебра-строки
          if (globalRowIndex % 2 === 0) {
            ctx.fillStyle = '#f9f9f9';
            ctx.fillRect(marginPx, y, tableWidthPx, rowHeight);
          }

          // Текст и границы ячеек
          let cx = marginPx;
          for (let colIdx = 0; colIdx < values.length; colIdx++) {
            const colWidth = colWidths[colIdx];

            // Граница ячейки
            ctx.strokeStyle = '#d0d0d0';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(cx, y, colWidth, rowHeight);

            // Текст
            const lines = cellLines[colIdx];
            const isNumeric = colIdx >= 2; // A,B,C,ABC,Стоимость
            ctx.fillStyle = '#000000';
            ctx.textAlign = isNumeric ? 'right' : 'left';
            const textX = isNumeric ? cx + colWidth - cellPadding : cx + cellPadding;
            let textY = y + cellPadding;
            lines.forEach(line => {
              ctx.fillText(line, textX, textY);
              textY += lineHeight;
            });

            cx += colWidth;
          }

          y += rowHeight;
          rowIndex++;
          globalRowIndex++;
        }

        images.push(canvas.toDataURL('image/png'));
      }

      return images;
    }

    // Экспорт графика и таблицы в PDF (без html2canvas)
    exportBtn.addEventListener('click', async () => {
      try {
        const data = await loadData();
        if (!data || data.length === 0) {
          if (typeof window.showNotification === 'function') {
            window.showNotification('Нет данных для экспорта', false);
          }
          return;
        }

        // Сортируем данные по ABC‑оценке, как в updateTable
        const sortedData = sortDataByABC(data);

        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();

        const margin = 10;
        let yPos = margin;

        // Заголовок отчёта
        const maxWidthPx = (pageWidth - 2 * margin) * 3.779527559;
        const titleText = 'График «Перспективные»';
        const titleResult = renderTextToCanvas(titleText, 18, 'bold', maxWidthPx);
        const titleHeight = titleResult.canvas.height / titleResult.scale / 3.779527559;
        const titleWidth = titleResult.canvas.width / titleResult.scale / 3.779527559;
        pdf.addImage(
          titleResult.canvas.toDataURL('image/png'),
          'PNG',
          (pageWidth - titleWidth) / 2,
          yPos,
          titleWidth,
          titleHeight
        );
        yPos += titleHeight + 4;

        // График — рисуем на canvas вручную и вставляем как изображение
        const chartCanvas = document.createElement('canvas');
        chartCanvas.width = 1200;
        chartCanvas.height = 680;
        const chartCtx = chartCanvas.getContext('2d');
        drawProspectsChartOnCanvas(chartCtx, data, chartCanvas.width, chartCanvas.height);

        const availableHeightForChart = pageHeight - yPos - margin - 8; // немного места под отступ
        const chartImgWidth = pageWidth - 2 * margin;
        const chartImgHeight = (chartCanvas.height * chartImgWidth) / chartCanvas.width;

        let finalChartHeight = chartImgHeight;
        let finalChartWidth = chartImgWidth;

        if (chartImgHeight > availableHeightForChart) {
          const ratio = availableHeightForChart / chartImgHeight;
          finalChartHeight = availableHeightForChart;
          finalChartWidth = chartImgWidth * ratio;
        }

        pdf.addImage(
          chartCanvas.toDataURL('image/png'),
          'PNG',
          margin + (chartImgWidth - finalChartWidth) / 2,
          yPos,
          finalChartWidth,
          finalChartHeight
        );

        // Таблица — отдельные страницы, отрисованные на canvas
        const tableImages = renderProspectsTablePages(sortedData, pageWidth, pageHeight, margin);
        tableImages.forEach((img, idx) => {
          // Для первой таблицы добавляем новую страницу,
          // так как первая уже занята графиком.
          pdf.addPage();
          pdf.addImage(img, 'PNG', 0, 0, pageWidth, pageHeight);
        });

        // Дата формирования на последней странице
        const dateText = 'Дата формирования: ' + new Date().toLocaleDateString('ru-RU');
        const dateResult = renderTextToCanvas(dateText, 10, 'normal', maxWidthPx);
        const dateHeight = dateResult.canvas.height / dateResult.scale / 3.779527559;
        const dateWidth = dateResult.canvas.width / dateResult.scale / 3.779527559;
        const lastPageHeight = pdf.internal.pageSize.getHeight();
        pdf.addImage(
          dateResult.canvas.toDataURL('image/png'),
          'PNG',
          pageWidth - margin - dateWidth,
          lastPageHeight - margin - dateHeight,
          dateWidth,
          dateHeight
        );

        const companyName = selectedCompanies.length === 0
          ? 'Все_предприятия'
          : selectedCompanies.length === 1
            ? selectedCompanies[0]
            : `${selectedCompanies.length}_предприятий`;
        const filename = `График_Перспективные_${companyName.replace(/\s+/g, '_')}.pdf`;
        pdf.save(filename);

        // Логируем экспорт графика (важное действие → должно попадать на график аудита)
        try {
          const companiesLabel = selectedCompanies.length === 0
            ? 'Все предприятия'
            : selectedCompanies.length === 1
              ? selectedCompanies[0]
              : `Выбрано предприятий: ${selectedCompanies.length}`;
          const details = `Экспорт графика «Перспективные» в PDF (${companiesLabel})`;

          let ok = false;
          if (typeof window.appendAdminAudit === 'function') {
            ok = !!window.appendAdminAudit('export', details);
          }

          // Fallback: прямое логирование в localStorage если appendAdminAudit недоступна/не сработала
          if (!ok) {
            const key = 'adminAuditLogs';
            const raw = localStorage.getItem(key);
            const list = raw ? (JSON.parse(raw) || []) : [];
            const arr = Array.isArray(list) ? list : [];
            const username = (localStorage.getItem('username') || localStorage.getItem('userName') || 'system').trim() || 'system';
            const now = (typeof window.getAuditTimestamp === 'function')
              ? window.getAuditTimestamp()
              : new Date().toISOString().slice(0, 19).replace('T', ' ');
            const nextId = arr.length > 0 ? (Math.max(...arr.map(x => Number(x && x.id) || 0)) + 1) : 1;
            arr.unshift({
              id: nextId,
              date: now,
              user: username,
              action: 'export',
              details,
              tz: 'local',
              ip: 'local'
            });
            localStorage.setItem(key, JSON.stringify(arr));
          }
        } catch (e) {
          // silent
        }

        if (typeof window.showNotification === 'function') {
          window.showNotification('График и таблица успешно экспортированы в PDF', true);
        }
      } catch (error) {
        console.error('Ошибка при экспорте графика/таблицы:', error);
        if (typeof window.showNotification === 'function') {
          window.showNotification('Ошибка при экспорте графика', false);
        }
      }
    });

    function openModal() {
      // Устанавливаем защиту от мгновенного закрытия модального окна при открытии
      if (typeof window.ignoreOutsideClickUntil !== 'undefined') {
        window.ignoreOutsideClickUntil = Date.now() + 500;
      }
      modal.style.display = 'block';
      requestAnimationFrame(() => modal.classList.add('open'));
      document.body.style.overflow = 'hidden';
      toggleBtn.setAttribute('aria-pressed', 'true');

      // Если пользователь не менял выбор предприятий вручную,
      // при каждом открытии модалки синхронизируем селект с enterprise-nav.
      if (!isCompanySelectionDirty) {
        const { currentEnt } = getGlobalFilters();
        if (currentEnt && currentEnt !== 'all') {
          selectedCompanies = [currentEnt];
          lastSyncedEnterpriseNav = currentEnt;
        } else {
          selectedCompanies = [];
          lastSyncedEnterpriseNav = 'all';
        }
        updateSelectText();
      }

      if (!renderedOnce) {
        initCompanySelect().then(() => {
          // После инициализации списка — синхронизируем чекбоксы (на случай дефолтного выбора)
          if (syncCheckboxesFn) syncCheckboxesFn();
          updateChart();
          renderedOnce = true;
        }).catch(e => console.error('Не удалось инициализировать график «Перспективные»', e));
      } else {
        // Синхронизируем чекбоксы при повторном открытии
        if (syncCheckboxesFn) {
          syncCheckboxesFn();
        }
        updateChart();
      }
    }

    function closeModal() {
      modal.classList.remove('open');
      setTimeout(() => { modal.style.display = 'none'; }, 200);
      document.body.style.overflow = '';
      toggleBtn.setAttribute('aria-pressed', 'false');
    }

    closeBtn.addEventListener('click', (e) => { e.preventDefault(); closeModal(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && modal.style.display !== 'none') closeModal(); });
  }

  // Инициализация при загрузке DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initProspectsChart);
  } else {
    // DOM уже загружен
    initProspectsChart();
  }

  // Экспорт функции инициализации для возможности повторной инициализации
  window.ProspectsChart = {
    init: initProspectsChart
  };
})();
