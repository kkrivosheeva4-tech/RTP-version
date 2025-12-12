// ===== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ =====
let enterpriseData = {};
let blockToQuadrant = {};
let currentEnterprise = "all";
let charts = {};

// Нормализация уровня технологии — возвращает один из ключей: 'existing','implementing','perspective'
function normalizeLevel(level) {
  if (!level) return 'unknown';
  const s = String(level).toLowerCase();
  if (s.includes('сущ') || s.includes('existing')) return 'existing';
  if (s.includes('внед') || s.includes('implement')) return 'implementing';
  if (s.includes('персп') || s.includes('perspect') || s.includes('перспектив')) return 'perspective';
  return 'unknown';
}

// ===== ИНИЦИАЛИЗАЦИЯ =====
document.addEventListener('DOMContentLoaded', async () => {
  // Инициализация темы
  initTheme();

  // Инициализация авторизации
  renderAuth();

  // Загрузка данных
  await loadData();

  // Инициализация вкладок предприятий
  initEnterpriseTabs();

  // Инициализация фильтров
  initFilters();

  // Инициализация селекта предприятий (рядом с периодом)
  initEnterpriseSelect();

  // Инициализация кнопок экспорта
  initExportButtons();

  // Отрисовка начальных данных
  renderAnalytics();
});

// ===== ЗАГРУЗКА ДАННЫХ =====
async function loadData() {
  // Функция-помощник для попытки загрузки по нескольким относительным путям
  async function tryFetch(paths) {
    for (const p of paths) {
      try {
        const res = await fetch(p);
        if (res.ok) return await res.json();
      } catch (e) {
        // игнорируем и пробуем следующий путь
      }
    }
    return null;
  }

  try {
    // Возможные относительные пути (зависит от того, откуда открывается страница)
    const enterprisePaths = [
      'data/ru/enterpriseData.json',
      './data/ru/enterpriseData.json',
      'РТП/data/ru/enterpriseData.json',
      './РТП/data/ru/enterpriseData.json'
    ];

    const blockPaths = [
      'data/ru/blockToQuadrant.json',
      './data/ru/blockToQuadrant.json',
      'РТП/data/ru/blockToQuadrant.json',
      './РТП/data/ru/blockToQuadrant.json'
    ];

    const enterpriseJson = await tryFetch(enterprisePaths);
    const blockJson = await tryFetch(blockPaths);

    // Сначала загружаем blockToQuadrant, чтобы использовать его при преобразовании данных
    if (blockJson) {
      blockToQuadrant = blockJson;
    }

    if (enterpriseJson) {
      // Преобразуем массив в объект, сгруппированный по предприятиям
      enterpriseData = {};

      // Если данные - массив, преобразуем их
      if (Array.isArray(enterpriseJson)) {
        enterpriseJson.forEach(tech => {
          const company = tech.company || 'Unknown';
          if (!enterpriseData[company]) {
            enterpriseData[company] = [];
          }

          // Преобразуем блоки из массива чисел в названия блоков
          let blockName = '';
          if (Array.isArray(tech.blocks) && tech.blocks.length > 0 && blockToQuadrant) {
            const blockNames = Object.keys(blockToQuadrant);
            const blockIndex = tech.blocks[0] - 1; // blocks начинаются с 1
            if (blockIndex >= 0 && blockIndex < blockNames.length) {
              blockName = blockNames[blockIndex];
            }
          } else {
            blockName = tech.block || '';
          }

          // Преобразуем структуру данных в формат, ожидаемый аналитикой
          const normalizedTech = {
            name: tech.name || '',
            level: tech.status || tech.level || '',
            companyMaturity: tech.organRead || tech.companyMaturity || 1,
            technologyMaturity: tech.techRead || tech.technologyMaturity || 1,
            block: blockName,
            func: Array.isArray(tech.functions) && tech.functions.length > 0
              ? tech.functions[0]
              : (tech.func || tech.function || ''),
            functions: tech.functions || [],
            shape: tech.shape || 'circle',
            ref: tech.ref || null,
            ...tech // Сохраняем остальные поля
          };

          enterpriseData[company].push(normalizedTech);
        });
      } else {
        // Если данные уже в формате объекта, используем как есть
        enterpriseData = enterpriseJson;
      }
    } else {
      console.error('Не удалось загрузить enterpriseData.json по путям', enterprisePaths);
      showNotification('Не удалось загрузить данные о предприятиях', 'error');
      // не прерываем полностью — оставляем пустой enterpriseData
    }

    if (!blockJson) {
      console.error('Не удалось загрузить blockToQuadrant.json по путям', blockPaths);
      showNotification('Не удалось загрузить данные о блоках', 'error');
      // оставляем пустой blockToQuadrant
    }
  } catch (error) {
    console.error('Ошибка при загрузке данных:', error);
    showNotification('Произошла ошибка при загрузке данных', 'error');
  }
}

// ===== ИНИЦИАЛИЗАЦИЯ ТЕМЫ =====
function initTheme() {
  const themeToggle = document.getElementById("themeToggle");
  const savedTheme = localStorage.getItem("theme") || "light";
  document.body.className = savedTheme;
  if (themeToggle) {
    themeToggle.checked = savedTheme === "dark";
    themeToggle.addEventListener("change", () => {
      const theme = themeToggle.checked ? "dark" : "light";
      document.body.className = theme;
      localStorage.setItem("theme", theme);

      // Обновление графиков при смене темы
      updateChartsTheme();
    });
  }
}

// ===== ИНИЦИАЛИЗАЦИЯ АВТОРИЗАЦИИ =====
function renderAuth() {
  const authInfo = document.getElementById("authInfo");
  const logoutContainer = document.getElementById("logoutContainer");
  const role = localStorage.getItem("role");

  if (role === "architect" || role === "admin") {
    if (authInfo) {
      authInfo.innerHTML = `<div class="user-role">${role === "admin" ? "Администратор" : "Архитектор"}</div>`;
    }
    if (logoutContainer) {
      logoutContainer.innerHTML = `<button class="logout" data-tooltip="Выйти" aria-label="Выйти">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16,17 21,12 16,7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
      </button>`;

      const logoutBtn = logoutContainer.querySelector(".logout");
      if (logoutBtn) {
        logoutBtn.onclick = () => {
          const theme = localStorage.getItem('theme');
          localStorage.clear();
          if (theme) localStorage.setItem('theme', theme);
          location.reload();
        };
      }
    }
  } else {
    // Перенаправление на страницу входа, если пользователь не авторизован
    window.location.href = "auth.html";
  }
}

// ===== ИНИЦИАЛИЗАЦИЯ ВКЛАДОК ПРЕДПРИЯТИЙ =====
function initEnterpriseTabs() {
  const tabButtons = document.querySelectorAll('.tab-btn');

  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      // Удаление активного класса со всех кнопок
      tabButtons.forEach(btn => btn.classList.remove('active'));

      // Добавление активного класса к нажатой кнопке
      button.classList.add('active');

      // Обновление текущего предприятия
      currentEnterprise = button.getAttribute('data-enterprise');

      // Синхронизируем кастомный селект предприятия, если он есть
      const enterpriseSelect = document.getElementById('enterpriseSelect');
      if (enterpriseSelect) {
        const opts = enterpriseSelect.querySelectorAll('.custom-option');
        opts.forEach(o => o.classList.toggle('selected', o.getAttribute('data-value') === currentEnterprise));
        const trigger = enterpriseSelect.querySelector('.custom-select-trigger');
        const activeOpt = enterpriseSelect.querySelector('.custom-option.selected');
        if (trigger && activeOpt) trigger.textContent = activeOpt.textContent;
      }

      // Перерисовка аналитики
      renderAnalytics();
    });
  });
}

// ===== ИНИЦИАЛИЗАЦИЯ ФИЛЬТРОВ =====
function initFilters() {
  // Инициализация кастомного селекта времени
  const custom = document.getElementById('timePeriod');
  if (!custom) return;

  const trigger = custom.querySelector('.custom-select-trigger');
  const options = custom.querySelectorAll('.custom-option');

  // Toggle open
  trigger.addEventListener('click', () => {
    const expanded = custom.classList.toggle('open');
    custom.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  });

  // Выбор опции
  options.forEach(opt => {
    opt.addEventListener('click', (e) => {
      options.forEach(o=>o.classList.remove('selected'));
      opt.classList.add('selected');
      trigger.textContent = opt.textContent;
      custom.classList.remove('open');
      custom.setAttribute('aria-expanded', 'false');
      renderAnalytics();
    });
  });

  // Закрыть при клике вне
  window.addEventListener('click', (e) => {
    if (!custom.contains(e.target)) {
      custom.classList.remove('open');
      custom.setAttribute('aria-expanded', 'false');
    }
  });
}

function getSelectedTimePeriod() {
  const custom = document.getElementById('timePeriod');
  if (!custom) return 'year';
  const sel = custom.querySelector('.custom-option.selected');
  return sel ? sel.getAttribute('data-value') : 'year';
}

// ===== ИНИЦИАЛИЗАЦИЯ КНОПОК ЭКСПОРТА =====
function initExportButtons() {
  const exportPdfBtn = document.getElementById('exportPdfBtn');
  const exportExcelBtn = document.getElementById('exportExcelBtn');

  if (exportPdfBtn) {
    exportPdfBtn.addEventListener('click', exportToPDF);
  }

  if (exportExcelBtn) {
    exportExcelBtn.addEventListener('click', exportToExcel);
  }
}

// Инициализация кастомного селекта предприятий (синхронизация с вкладками)
function initEnterpriseSelect() {
  const custom = document.getElementById('enterpriseSelect');
  if (!custom) return;

  const trigger = custom.querySelector('.custom-select-trigger');
  const options = custom.querySelectorAll('.custom-option');

  // Toggle open
  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    const expanded = custom.classList.toggle('open');
    custom.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  });

  // Выбор опции
  options.forEach(opt => {
    opt.addEventListener('click', (e) => {
      options.forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      trigger.textContent = opt.textContent;
      custom.classList.remove('open');
      custom.setAttribute('aria-expanded', 'false');

      // Обновляем текущую вкладку/предприятие
      const val = opt.getAttribute('data-value');
      currentEnterprise = val || 'all';

      // Синхронизируем кнопки вкладок
      const tabButtons = document.querySelectorAll('.tab-btn');
      tabButtons.forEach(btn => {
        if (btn.getAttribute('data-enterprise') === currentEnterprise) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });

      // Перерисовка аналитики
      renderAnalytics();
    });
  });

  // Закрыть при клике вне
  window.addEventListener('click', (e) => {
    if (!custom.contains(e.target)) {
      custom.classList.remove('open');
      custom.setAttribute('aria-expanded', 'false');
    }
  });
}

// ===== ОСНОВНАЯ ФУНКЦИЯ ОТРИСОВКИ АНАЛИТИКИ =====
function renderAnalytics() {
  // Обновление общей статистики
  updateStatsOverview();

  // Обновление сравнительных графиков
  updateComparativeCharts();

  // Обновление детальной аналитики
  updateDetailedAnalytics();

  // Обновление оповещений
  updateAlerts();

  // Бенчмаркинг отключён по запросу (график удалён)

  // Обновление технологических зависимостей
  updateDependencies();
}

// ===== ОБНОВЛЕНИЕ ОБЩЕЙ СТАТИСТИКИ =====
function updateStatsOverview() {
  let allTechnologies = [];

  // Сбор всех технологий
  if (currentEnterprise === "all") {
    Object.values(enterpriseData).forEach(enterprise => {
      allTechnologies = [...allTechnologies, ...enterprise];
    });
  } else {
    allTechnologies = enterpriseData[currentEnterprise] || [];
  }

  // Подсчет статистики
  const totalTechnologies = allTechnologies.length;
  const existingTechnologies = allTechnologies.filter(t => normalizeLevel(t.level) === 'existing').length;
  const implementingTechnologies = allTechnologies.filter(t => normalizeLevel(t.level) === 'implementing').length;
  const perspectiveTechnologies = allTechnologies.filter(t => normalizeLevel(t.level) === 'perspective').length;

  // Расчет индекса зрелости
  let totalMaturity = 0;
  allTechnologies.forEach(tech => {
    const companyMaturity = Number(tech.companyMaturity) || 1;
    const technologyMaturity = Number(tech.technologyMaturity) || 1;
    totalMaturity += (companyMaturity * technologyMaturity) / 9; // Нормализация к 0-1
  });
  const maturityIndex = totalTechnologies > 0 ? (totalMaturity / totalTechnologies).toFixed(1) : "0.0";

  // Подсчет предприятий с высокой зрелостью
  let highMaturityCount = 0;
  if (currentEnterprise === "all") {
    Object.keys(enterpriseData).forEach(enterprise => {
      const technologies = enterpriseData[enterprise];
      let enterpriseMaturity = 0;

      technologies.forEach(tech => {
        const companyMaturity = Number(tech.companyMaturity) || 1;
        const technologyMaturity = Number(tech.technologyMaturity) || 1;
        enterpriseMaturity += (companyMaturity * technologyMaturity) / 9;
      });

      const avgMaturity = technologies.length > 0 ? enterpriseMaturity / technologies.length : 0;
      if (avgMaturity > 0.6) highMaturityCount++;
    });
  } else {
    const enterpriseMaturity = parseFloat(maturityIndex);
    if (enterpriseMaturity > 0.6) highMaturityCount = 1;
  }

  // Обновление DOM
  document.getElementById('totalTechnologies').textContent = totalTechnologies;
  document.getElementById('existingTechnologies').textContent = existingTechnologies;
  document.getElementById('implementingTechnologies').textContent = implementingTechnologies;
  document.getElementById('perspectiveTechnologies').textContent = perspectiveTechnologies;
  document.getElementById('maturityIndex').textContent = maturityIndex;
  document.getElementById('highMaturityCount').textContent = currentEnterprise === "all" ? highMaturityCount : `${highMaturityCount}/1`;
}

// ===== ОБНОВЛЕНИЕ СРАВНИТЕЛЬНЫХ ГРАФИКОВ =====
function updateComparativeCharts() {
  // График распределения технологий по статусам
  updateStatusChart();

  // График индекса технологической зрелости
  updateMaturityChart();
}

// ===== ГРАФИК РАСПРЕДЕЛЕНИЯ ТЕХНОЛОГИЙ ПО СТАТУСАМ =====
function updateStatusChart() {
  const ctx = document.getElementById('statusChart');
  if (!ctx) return;

  const canvas = ctx.getContext('2d');

  // Уничтожение предыдущего графика, если он существует
  if (charts.statusChart) {
    charts.statusChart.destroy();
  }

  // Определение темы
  const isDark = document.body.classList.contains('dark');
  const textColor = isDark ? '#ffffff' : '#333333';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';

  // Подготовка данных
  const enterprises = currentEnterprise === "all" ? Object.keys(enterpriseData) : [currentEnterprise];
  const statusData = {
    labels: enterprises,
    datasets: [
      {
        label: 'Существующие',
        data: enterprises.map(enterprise => {
          const technologies = enterpriseData[enterprise] || [];
          return technologies.filter(t => normalizeLevel(t.level) === 'existing').length;
        }),
        backgroundColor: 'rgba(54, 162, 235, 0.7)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1
      },
      {
        label: 'Внедряемые',
        data: enterprises.map(enterprise => {
          const technologies = enterpriseData[enterprise] || [];
          return technologies.filter(t => normalizeLevel(t.level) === 'implementing').length;
        }),
        backgroundColor: 'rgba(255, 206, 86, 0.7)',
        borderColor: 'rgba(255, 206, 86, 1)',
        borderWidth: 1
      },
      {
        label: 'Перспективные',
        data: enterprises.map(enterprise => {
          const technologies = enterpriseData[enterprise] || [];
          return technologies.filter(t => normalizeLevel(t.level) === 'perspective').length;
        }),
        backgroundColor: 'rgba(75, 192, 192, 0.7)',
        borderColor: 'rgba(75, 192, 192, 1)',
        borderWidth: 1
      }
    ]
  };

  // Создание графика
  charts.statusChart = new Chart(canvas, {
    type: 'bar',
    data: statusData,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          stacked: true,
          grid: {
            display: false,
            color: gridColor
          },
          ticks: {
            color: textColor
          }
        },
        y: {
          stacked: true,
          beginAtZero: true,
          grid: {
            color: gridColor
          },
          ticks: {
            color: textColor
          }
        }
      },
      plugins: {
        legend: {
          position: 'top',
          labels: {
            color: textColor
          }
        },
        tooltip: {
          mode: 'index',
          intersect: false
        }
      }
    }
  });
}

// ===== ГРАФИК ИНДЕКСА ТЕХНОЛОГИЧЕСКОЙ ЗРЕЛОСТИ =====
function updateMaturityChart() {
  const ctx = document.getElementById('maturityChart');
  if (!ctx) return;

  const canvas = ctx.getContext('2d');

  // Уничтожение предыдущего графика, если он существует
  if (charts.maturityChart) {
    charts.maturityChart.destroy();
  }

  // Определение темы
  const isDark = document.body.classList.contains('dark');
  const textColor = isDark ? '#ffffff' : '#333333';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';

  // Подготовка данных
  const enterprises = currentEnterprise === "all" ? Object.keys(enterpriseData) : [currentEnterprise];
  const maturityData = enterprises.map(enterprise => {
    const technologies = enterpriseData[enterprise] || [];
    let totalMaturity = 0;

    technologies.forEach(tech => {
      const companyMaturity = Number(tech.companyMaturity) || 1;
      const technologyMaturity = Number(tech.technologyMaturity) || 1;
      totalMaturity += (companyMaturity * technologyMaturity) / 9; // Нормализация к 0-1
    });

    return technologies.length > 0 ? (totalMaturity / technologies.length) * 100 : 0;
  });

  // Создание графика
  charts.maturityChart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: enterprises,
      datasets: [{
        label: 'Индекс зрелости (%)',
        data: maturityData,
        backgroundColor: 'rgba(206, 144, 104, 0.7)',
        borderColor: 'rgba(206, 144, 104, 1)',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          grid: {
            display: false,
            color: gridColor
          },
          ticks: {
            color: textColor
          }
        },
        y: {
          beginAtZero: true,
          max: 100,
          grid: {
            color: gridColor
          },
          ticks: {
            color: textColor
          }
        }
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return `Индекс зрелости: ${context.raw.toFixed(1)}%`;
            }
          }
        }
      }
    }
  });
}

// Преобразует normalized level в читаемую русскую метку
function levelToLabel(level) {
  const nl = normalizeLevel(level);
  if (nl === 'existing') return 'Существующие';
  if (nl === 'implementing') return 'Внедряемые';
  if (nl === 'perspective') return 'Перспективные';
  return level || '';
}

// ===== ОБНОВЛЕНИЕ ДЕТАЛЬНОЙ АНАЛИТИКИ =====
function updateDetailedAnalytics() {
  const container = document.getElementById('enterpriseDetails');
  container.innerHTML = '';

  const enterprises = currentEnterprise === "all" ? Object.keys(enterpriseData) : [currentEnterprise];
  // Если показываем все предприятия — рендерим сводную таблицу
  if (currentEnterprise === 'all') {
    const table = document.createElement('table');
    table.className = 'summary-table';
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';
    table.innerHTML = `
      <thead>
        <tr>
          <th style="text-align:left;padding:8px;border-bottom:1px solid var(--input-border)">Предприятие</th>
          <th style="padding:8px;border-bottom:1px solid var(--input-border)">Всего</th>
          <th style="padding:8px;border-bottom:1px solid var(--input-border)">Существующие</th>
          <th style="padding:8px;border-bottom:1px solid var(--input-border)">Внедряемые</th>
          <th style="padding:8px;border-bottom:1px solid var(--input-border)">Перспективные</th>
          <th style="padding:8px;border-bottom:1px solid var(--input-border)">Действия</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;

    const tbody = table.querySelector('tbody');
    Object.keys(enterpriseData).forEach(enterprise => {
      const technologies = enterpriseData[enterprise] || [];
      const total = technologies.length;
      const counts = { existing:0, implementing:0, perspective:0 };
      technologies.forEach(t => {
        const lvl = normalizeLevel(t.level);
        if (lvl === 'existing') counts.existing++;
        else if (lvl === 'implementing') counts.implementing++;
        else if (lvl === 'perspective') counts.perspective++;
      });

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="padding:8px;border-bottom:1px solid var(--input-border);text-align:left">${enterprise}</td>
        <td style="padding:8px;border-bottom:1px solid var(--input-border);text-align:center">${total}</td>
        <td style="padding:8px;border-bottom:1px solid var(--input-border);text-align:center">${counts.existing}</td>
        <td style="padding:8px;border-bottom:1px solid var(--input-border);text-align:center">${counts.implementing}</td>
        <td style="padding:8px;border-bottom:1px solid var(--input-border);text-align:center">${counts.perspective}</td>
        <td style="padding:8px;border-bottom:1px solid var(--input-border);text-align:center"></td>
      `;

      const actionsCell = tr.querySelector('td:last-child');
      // Убираем кнопку "Детальный просмотр" — оставляем только показ таблицы
      const showTableBtn = document.createElement('button'); showTableBtn.className='show-table-btn'; showTableBtn.textContent='Показать таблицу технологий';
      showTableBtn.addEventListener('click', (e) => toggleInlineTechTable(tr, enterprise, showTableBtn));
      actionsCell.appendChild(showTableBtn);

      tbody.appendChild(tr);
    });

    container.appendChild(table);
  } else {
    // Показываем только выбранное предприятие
    const enterprise = currentEnterprise;
    const technologies = enterpriseData[enterprise] || [];
    const card = document.createElement('div'); card.className='enterprise-card';
    const title = document.createElement('h3'); title.textContent = enterprise; card.appendChild(title);

    // Детальная статистика и распределение типов
    const counts = { existing:0, implementing:0, perspective:0 };
    technologies.forEach(t=>{
      const lvl = normalizeLevel(t.level);
      if (lvl === 'existing') counts.existing++;
      else if (lvl === 'implementing') counts.implementing++;
      else if (lvl === 'perspective') counts.perspective++;
    });

    const statsHtml = `
      <div class="enterprise-stats">
        <div class="enterprise-stat"><div class="enterprise-stat-value">${technologies.length}</div><div class="enterprise-stat-label">Всего</div></div>
        <div class="enterprise-stat"><div class="enterprise-stat-value">${counts.existing}</div><div class="enterprise-stat-label">Существующие</div></div>
        <div class="enterprise-stat"><div class="enterprise-stat-value">${counts.implementing}</div><div class="enterprise-stat-label">Внедряемые</div></div>
        <div class="enterprise-stat"><div class="enterprise-stat-value">${counts.perspective}</div><div class="enterprise-stat-label">Перспективные</div></div>
      </div>
    `;
    card.innerHTML += statsHtml;

    // Кнопка детального просмотра и таблица под ней
  const detailBtn = document.createElement('button'); detailBtn.className='show-table-btn'; detailBtn.textContent='Показать таблицу технологий';
  detailBtn.style.marginTop='12px';
  detailBtn.addEventListener('click', (e) => toggleInlineTechTable(detailBtn, enterprise, detailBtn));
  card.appendChild(detailBtn);

    container.appendChild(card);
  }
}

// ===== ОБНОВЛЕНИЕ ОПОВЕЩЕНИЙ =====
function updateAlerts() {
  const container = document.getElementById('alertsContainer');
  container.innerHTML = '';

  const enterprises = currentEnterprise === "all" ? Object.keys(enterpriseData) : [currentEnterprise];
  const alerts = [];

  enterprises.forEach(enterprise => {
    const technologies = enterpriseData[enterprise] || [];

    // Проверка на низкий процент передовых технологий
    const advancedTech = technologies.filter(t => t.shape === "square").length;
    const advancedPercent = technologies.length > 0 ? (advancedTech / technologies.length) * 100 : 0;

    if (advancedPercent < 10) {
      alerts.push({
        type: 'critical',
        title: `${enterprise}: Низкий процент передовых технологий`,
        description: `Только ${advancedPercent.toFixed(1)}% технологий являются передовыми. Рекомендуется увеличить инвестиции в инновации.`
      });
    }

    // Проверка на отсутствие технологий в блоках
    const blocks = new Set();
    technologies.forEach(tech => {
      if (tech.block) blocks.add(tech.block);
    });

    if (blocks.size < 2) {
      alerts.push({
        type: 'warning',
        title: `${enterprise}: Узкое покрытие функциональных блоков`,
        description: `Технологии охватывают только ${blocks.size} из 4 функциональных блоков. Рекомендуется расширить покрытие.`
      });
    }

    // Проверка на отсутствие перспективных технологий
    const perspectiveTech = technologies.filter(t => normalizeLevel(t.level) === 'perspective').length;

    if (perspectiveTech === 0) {
      alerts.push({
        type: 'warning',
        title: `${enterprise}: Отсутствие перспективных технологий`,
        description: 'В портфеле нет перспективных технологий. Рекомендуется разработать стратегию инновационного развития.'
      });
    }

    // Проверка на низкий индекс зрелости
    let totalMaturity = 0;
    technologies.forEach(tech => {
      const companyMaturity = Number(tech.companyMaturity) || 1;
      const technologyMaturity = Number(tech.technologyMaturity) || 1;
      totalMaturity += (companyMaturity * technologyMaturity) / 9;
    });
    const maturityIndex = technologies.length > 0 ? totalMaturity / technologies.length : 0;

    if (maturityIndex < 0.3) {
      alerts.push({
        type: 'critical',
        title: `${enterprise}: Низкий индекс технологической зрелости`,
        description: `Индекс зрелости составляет ${(maturityIndex * 100).toFixed(1)}%. Рекомендуется разработать план цифровой трансформации.`
      });
    }
  });

  // Проверка на дублирование технологий между предприятиями
  if (currentEnterprise === "all") {
    const techNames = new Map();

    Object.keys(enterpriseData).forEach(enterprise => {
      const technologies = enterpriseData[enterprise] || [];

      technologies.forEach(tech => {
        if (tech.name) {
          if (!techNames.has(tech.name)) {
            techNames.set(tech.name, []);
          }
          techNames.get(tech.name).push(enterprise);
        }
      });
    });

    // Поиск дубликатов
    techNames.forEach((enterprises, techName) => {
      if (enterprises.length > 1) {
        alerts.push({
          type: 'info',
          title: 'Дублирование технологий',
          description: `Технология "${techName}" используется в нескольких предприятиях: ${enterprises.join(', ')}. Рассмотрите возможность централизации.`
        });
      }
    });
  }

  // Отображение оповещений
  if (alerts.length === 0) {
    const noAlerts = document.createElement('div');
    noAlerts.className = 'alert-card alert-info';
    noAlerts.innerHTML = `
      <div class="alert-icon">ℹ️</div>
      <div class="alert-content">
        <div class="alert-title">Нет критических проблем</div>
        <div class="alert-description">На данный момент не выявлено критических точек, требующих внимания.</div>
      </div>
    `;
    container.appendChild(noAlerts);
  } else {
    alerts.forEach(alert => {
      const alertCard = document.createElement('div');
      alertCard.className = `alert-card alert-${alert.type}`;

      let icon;
      switch (alert.type) {
        case 'critical':
          icon = '🚨';
          break;
        case 'warning':
          icon = '⚠️';
          break;
        case 'info':
          icon = 'ℹ️';
          break;
        default:
          icon = '📢';
      }

      alertCard.innerHTML = `
        <div class="alert-icon">${icon}</div>
        <div class="alert-content">
          <div class="alert-title">${alert.title}</div>
          <div class="alert-description">${alert.description}</div>
        </div>
      `;

      container.appendChild(alertCard);
    });
  }
}

// ===== ОБНОВЛЕНИЕ БЕНЧМАРКИНГА И ПРОГНОЗОВ =====
function updateBenchmarking() {
  // График сравнения с отраслевыми стандартами
  updateBenchmarkChart();
}

// ===== ГРАФИК СРАВНЕНИЯ С ОТРАСЛЕВЫМИ СТАНДАРТАМИ =====
function updateBenchmarkChart() {
  const ctx = document.getElementById('benchmarkChart').getContext('2d');

  // Уничтожение предыдущего графика, если он существует
  if (charts.benchmarkChart) {
    charts.benchmarkChart.destroy();
  }

  // Подготовка данных
  const enterprises = currentEnterprise === "all" ? Object.keys(enterpriseData) : [currentEnterprise];

  // Расчет метрик для каждого предприятия
  const enterpriseMetrics = enterprises.map(enterprise => {
    const technologies = enterpriseData[enterprise] || [];

    // Расчет индекса зрелости
    let totalMaturity = 0;
    technologies.forEach(tech => {
      const companyMaturity = Number(tech.companyMaturity) || 1;
      const technologyMaturity = Number(tech.technologyMaturity) || 1;
      totalMaturity += (companyMaturity * technologyMaturity) / 9;
    });
    const maturityIndex = technologies.length > 0 ? (totalMaturity / technologies.length) * 100 : 0;

    // Расчет процента передовых технологий
    const advancedTech = technologies.filter(t => t.shape === "square").length;
    const advancedPercent = technologies.length > 0 ? (advancedTech / technologies.length) * 100 : 0;

  // Расчет процента внедряемых технологий
  const implementingTech = technologies.filter(t => normalizeLevel(t.level) === 'implementing').length;
  const implementingPercent = technologies.length > 0 ? (implementingTech / technologies.length) * 100 : 0;

    return {
      enterprise,
      maturityIndex,
      advancedPercent,
      implementingPercent
    };
  });

  // Отраслевые стандарты (условные значения)
  const industryStandards = {
    maturityIndex: 65,
    advancedPercent: 25,
    implementingPercent: 35
  };

  // Создание графика
  charts.benchmarkChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Индекс зрелости', 'Передовые технологии', 'Внедряемые технологии'],
      datasets: [
        {
          label: 'Отраслевой стандарт',
          data: [
            industryStandards.maturityIndex,
            industryStandards.advancedPercent,
            industryStandards.implementingPercent
          ],
          backgroundColor: 'rgba(75, 192, 192, 0.7)',
          borderColor: 'rgba(75, 192, 192, 1)',
          borderWidth: 1
        },
        ...enterpriseMetrics.map((metrics, index) => {
          const colors = [
            'rgba(255, 99, 132, 0.7)',
            'rgba(54, 162, 235, 0.7)',
            'rgba(255, 206, 86, 0.7)',
            'rgba(153, 102, 255, 0.7)',
            'rgba(255, 159, 64, 0.7)',
            'rgba(199, 199, 199, 0.7)'
          ];
          const borderColors = [
            'rgba(255, 99, 132, 1)',
            'rgba(54, 162, 235, 1)',
            'rgba(255, 206, 86, 1)',
            'rgba(153, 102, 255, 1)',
            'rgba(255, 159, 64, 1)',
            'rgba(199, 199, 199, 1)'
          ];

          return {
            label: metrics.enterprise,
            data: [
              metrics.maturityIndex,
              metrics.advancedPercent,
              metrics.implementingPercent
            ],
            backgroundColor: colors[index % colors.length],
            borderColor: borderColors[index % borderColors.length],
            borderWidth: 1
          };
        })
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          max: 100
        }
      },
      plugins: {
        legend: {
          position: 'top'
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return `${context.dataset.label}: ${context.raw.toFixed(1)}%`;
            }
          }
        }
      }
    }
  });
}

// ===== ГРАФИК ПРОГНОЗА ТРЕНДОВ =====
function updateTrendsChart() {
  const ctx = document.getElementById('trendsChart').getContext('2d');

  // Уничтожение предыдущего графика, если он существует
  if (charts.trendsChart) {
    charts.trendsChart.destroy();
  }

  // Подготовка данных
  const enterprises = currentEnterprise === "all" ? Object.keys(enterpriseData) : [currentEnterprise];

  // Генерация данных для трендов (условные значения)
  const months = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];

  const datasets = enterprises.map((enterprise, index) => {
    // Расчет текущего индекса зрелости
    const technologies = enterpriseData[enterprise] || [];
    let totalMaturity = 0;
    technologies.forEach(tech => {
      const companyMaturity = Number(tech.companyMaturity) || 1;
      const technologyMaturity = Number(tech.technologyMaturity) || 1;
      totalMaturity += (companyMaturity * technologyMaturity) / 9;
    });
    const currentMaturity = technologies.length > 0 ? (totalMaturity / technologies.length) * 100 : 0;

    // Генерация исторических данных (с некоторой случайностью)
    const historicalData = [];
    let value = currentMaturity - 15; // Начальное значение

    for (let i = 0; i < 12; i++) {
      value += Math.random() * 5 - 1; // Случайное изменение
      value = Math.max(0, Math.min(100, value)); // Ограничение диапазона
      historicalData.push(value);
    }

    // Генерация прогнозных данных
    const forecastData = [];
    value = historicalData[historicalData.length - 1];

    for (let i = 0; i < 6; i++) {
      value += Math.random() * 3 + 1; // Положительный тренд
      value = Math.max(0, Math.min(100, value)); // Ограничение диапазона
      forecastData.push(value);
    }

    // Объединение данных
    const allData = [...historicalData, ...forecastData];

    // Генерация цвета
    const colors = [
      'rgba(255, 99, 132, 0.7)',
      'rgba(54, 162, 235, 0.7)',
      'rgba(255, 206, 86, 0.7)',
      'rgba(75, 192, 192, 0.7)',
      'rgba(153, 102, 255, 0.7)',
      'rgba(255, 159, 64, 0.7)'
    ];
    const borderColors = [
      'rgba(255, 99, 132, 1)',
      'rgba(54, 162, 235, 1)',
      'rgba(255, 206, 86, 1)',
      'rgba(75, 192, 192, 1)',
      'rgba(153, 102, 255, 1)',
      'rgba(255, 159, 64, 1)'
    ];

    return {
      label: enterprise,
      data: allData,
      backgroundColor: colors[index % colors.length],
      borderColor: borderColors[index % borderColors.length],
      borderWidth: 2,
      fill: false,
      tension: 0.4,
      pointRadius: 3,
      segment: {
        borderDash: ctx => ctx.p1DataIndex > 11 ? [6, 6] : undefined, // Пунктир для прогноза
      }
    };
  });

  // Создание графика
  charts.trendsChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [...months, 'Прогноз Янв', 'Прогноз Фев', 'Прогноз Мар', 'Прогноз Апр', 'Прогноз Май', 'Прогноз Июн'],
      datasets: datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          title: {
            display: true,
            text: 'Индекс зрелости (%)'
          }
        }
      },
      plugins: {
        legend: {
          position: 'top'
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          callbacks: {
            label: function(context) {
              return `${context.dataset.label}: ${context.raw.toFixed(1)}%`;
            }
          }
        }
      }
    }
  });
}

// ===== ОБНОВЛЕНИЕ ТЕХНОЛОГИЧЕСКИХ ЗАВИСИМОСТЕЙ =====
function updateDependencies() {
  // График технологических зависимостей
  updateDependenciesChart();

  // Анализ технологических пробелов
  updateGapsAnalysis();
}

// ===== ГРАФИК ТЕХНОЛОГИЧЕСКИХ ЗАВИСИМОСТЕЙ =====
function updateDependenciesChart() {
  const ctx = document.getElementById('dependenciesChart');
  if (!ctx) return;

  const canvas = ctx.getContext('2d');

  // Уничтожение предыдущего графика, если он существует
  if (charts.dependenciesChart) {
    charts.dependenciesChart.destroy();
  }

  // Определение темы
  const isDark = document.body.classList.contains('dark');
  const textColor = isDark ? '#ffffff' : '#333333';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';

  // Подготовка данных
  const enterprises = currentEnterprise === "all" ? Object.keys(enterpriseData) : [currentEnterprise];

  // Расчет зависимостей между технологиями
  const dependencies = {};

  enterprises.forEach(enterprise => {
    const technologies = enterpriseData[enterprise] || [];

    technologies.forEach(tech => {
      if (tech.ref) {
        if (!dependencies[tech.ref]) {
          dependencies[tech.ref] = {
            enterprises: new Set(),
            count: 0
          };
        }
        dependencies[tech.ref].enterprises.add(enterprise);
        dependencies[tech.ref].count++;
      }
    });
  });

  // Сортировка зависимостей по количеству
  const sortedDependencies = Object.entries(dependencies)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10); // Топ-10 зависимостей

  // Создание графика
  charts.dependenciesChart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: sortedDependencies.map(([ref]) => ref),
      datasets: [{
        label: 'Количество технологий',
        data: sortedDependencies.map(([, data]) => data.count),
        backgroundColor: 'rgba(206, 144, 104, 0.7)',
        borderColor: 'rgba(206, 144, 104, 1)',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y', // Горизонтальный график
      scales: {
        x: {
          beginAtZero: true,
          grid: {
            color: gridColor
          },
          ticks: {
            color: textColor
          }
        },
        y: {
          grid: {
            display: false,
            color: gridColor
          },
          ticks: {
            color: textColor
          }
        }
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            afterLabel: function(context) {
              const ref = context.label;
              const data = dependencies[ref];
              return `Используется в: ${Array.from(data.enterprises).join(', ')}`;
            }
          }
        }
      }
    }
  });
}

// ===== АНАЛИЗ ТЕХНОЛОГИЧЕСКИХ ПРОБЕЛОВ =====
function updateGapsAnalysis() {
  const container = document.getElementById('gapsContainer');
  container.innerHTML = '';

  // Подготовка данных
  const enterprises = currentEnterprise === "all" ? Object.keys(enterpriseData) : [currentEnterprise];

  // Анализ пробелов по блокам
  const blockGaps = {};

  Object.keys(blockToQuadrant).forEach(block => {
    blockGaps[block] = {
      enterprises: new Set(),
      totalTech: 0,
      advancedTech: 0
    };
  });

  enterprises.forEach(enterprise => {
    const technologies = enterpriseData[enterprise] || [];

    technologies.forEach(tech => {
      if (tech.block && blockGaps[tech.block]) {
        blockGaps[tech.block].enterprises.add(enterprise);
        blockGaps[tech.block].totalTech++;

        if (tech.shape === "square") {
          blockGaps[tech.block].advancedTech++;
        }
      }
    });
  });

  // Определение пробелов
  const gaps = [];

  Object.entries(blockGaps).forEach(([block, data]) => {
    const coverage = data.enterprises.size / enterprises.length;
    const advancedRatio = data.totalTech > 0 ? data.advancedTech / data.totalTech : 0;

    if (coverage < 0.5) {
      gaps.push({
        title: `Недостаточное покрытие блока "${block}"`,
        description: `Блок охвачен только в ${(coverage * 100).toFixed(1)}% предприятий.`,
        priority: 'high'
      });
    } else if (advancedRatio < 0.2) {
      gaps.push({
        title: `Низкая зрелость технологий в блоке "${block}"`,
        description: `Только ${(advancedRatio * 100).toFixed(1)}% технологий в блоке являются передовыми.`,
        priority: 'medium'
      });
    }
  });

  // Анализ пробелов по референтным технологиям
  const refTechGaps = {};

  enterprises.forEach(enterprise => {
    const technologies = enterpriseData[enterprise] || [];

    technologies.forEach(tech => {
      if (tech.ref) {
        if (!refTechGaps[tech.ref]) {
          refTechGaps[tech.ref] = {
            enterprises: new Set(),
            count: 0
          };
        }
        refTechGaps[tech.ref].enterprises.add(enterprise);
        refTechGaps[tech.ref].count++;
      }
    });
  });

  // Поиск популярных референтных технологий, которые не используются везде
  Object.entries(refTechGaps).forEach(([ref, data]) => {
    const coverage = data.enterprises.size / enterprises.length;

    if (data.count >= 3 && coverage < 0.8) {
      gaps.push({
        title: `Недоиспользование популярной технологии "${ref}"`,
        description: `Технология используется в ${data.enterprises.size} из ${enterprises.length} предприятий.`,
        priority: 'low'
      });
    }
  });

  // Сортировка пробелов по приоритету
  gaps.sort((a, b) => {
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    return priorityOrder[b.priority] - priorityOrder[a.priority];
  });

  // Отображение пробелов
  if (gaps.length === 0) {
    const noGaps = document.createElement('div');
    noGaps.className = 'gap-item gap-low';
    noGaps.innerHTML = `
      <div class="gap-title">Критических пробелов не выявлено</div>
      <div class="gap-description">Текущий портфель технологий хорошо сбалансирован.</div>
      <div class="gap-priority priority-low">Низкий приоритет</div>
    `;
    container.appendChild(noGaps);
  } else {
    gaps.forEach(gap => {
      const gapItem = document.createElement('div');
      gapItem.className = `gap-item gap-${gap.priority}`;
      gapItem.innerHTML = `
        <div>
          <div class="gap-title">${gap.title}</div>
          <div class="gap-description">${gap.description}</div>
        </div>
        <div class="gap-priority priority-${gap.priority}">${
          gap.priority === 'high' ? 'Высокий' :
          gap.priority === 'medium' ? 'Средний' : 'Низкий'
        }</div>
      `;
      container.appendChild(gapItem);
    });
  }
}

// ===== ПОКАЗ ДЕТАЛЬНОЙ ИНФОРМАЦИИ О ПРЕДПРИЯТИИ =====
function showEnterpriseDetail(enterprise) {
  const modal = document.getElementById('detailModal');
  const modalTitle = document.getElementById('modalTitle');
  const modalBody = document.getElementById('modalBody');

  // Установка заголовка
  modalTitle.textContent = `Детальная информация: ${enterprise}`;

  // Очистка содержимого
  modalBody.innerHTML = '';

  // Получение данных о предприятии
  const technologies = enterpriseData[enterprise] || [];

  // Создание таблицы технологий
  const table = document.createElement('table');
  table.className = 'tech-table';

  // Заголовок таблицы
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');

  const headers = ['Название', 'Блок', 'Функция', 'Тип', 'Зрелость компании', 'Зрелость технологии'];

  headers.forEach(headerText => {
    const th = document.createElement('th');
    th.textContent = headerText;
    headerRow.appendChild(th);
  });

  thead.appendChild(headerRow);
  table.appendChild(thead);

  // Тело таблицы
  const tbody = document.createElement('tbody');

  technologies.forEach(tech => {
    const row = document.createElement('tr');

    const cells = [
      tech.name || '',
      tech.block || '',
      tech.func || '',
      levelToLabel(tech.level || tech.type),
      tech.companyMaturity || '',
      tech.technologyMaturity || ''
    ];

    cells.forEach(cellText => {
      const td = document.createElement('td');
      td.textContent = cellText;
      row.appendChild(td);
    });

    tbody.appendChild(row);
  });

  table.appendChild(tbody);
  modalBody.appendChild(table);

  // Показ модального окна
  modal.style.display = 'block';

  // Закрытие модального окна
  const closeBtn = modal.querySelector('.close-btn');
  closeBtn.onclick = () => {
    modal.style.display = 'none';
  };

  // Закрытие при клике вне модального окна
  window.onclick = (event) => {
    if (event.target === modal) {
      modal.style.display = 'none';
    }
  };
}

// Показ/скрытие встроенной таблицы технологий прямо под элементом (tr или button)
function toggleInlineTechTable(anchorElement, enterprise, toggleBtn) {
  // определим контейнер для вставки: если якорь — строка таблицы (tr), вставим после неё; если кнопка — вставим после кнопки
  let existing = null;
  if (anchorElement.tagName && anchorElement.tagName.toLowerCase() === 'tr') {
    // ищем следующий sibling с data-inline-tech
    existing = anchorElement.nextElementSibling && anchorElement.nextElementSibling.getAttribute && anchorElement.nextElementSibling.getAttribute('data-inline-tech') === '1' ? anchorElement.nextElementSibling : null;
  } else {
    // кнопка внутри карточки
    // ищем .inline-tech-container непосредственно после кнопки
    existing = anchorElement.parentElement.querySelector('.inline-tech-container');
  }

  if (existing) {
    // скрываем
    existing.remove();
    if (toggleBtn) toggleBtn.textContent = toggleBtn.getAttribute('data-default') || 'Показать таблицу технологий';
    return;
  }

  // создаём контейнер с таблицей
  const techs = enterpriseData[enterprise] || [];
  const container = createTechTable(techs);

  if (anchorElement.tagName && anchorElement.tagName.toLowerCase() === 'tr') {
    // вставляем новую строку под tr
    const tr = document.createElement('tr');
    tr.setAttribute('data-inline-tech', '1');
    const td = document.createElement('td');
    td.colSpan = 6;
    td.appendChild(container);
    tr.appendChild(td);
    anchorElement.parentElement.insertBefore(tr, anchorElement.nextSibling);
  } else {
    // кнопка — внутри карточки, добавляем под кнопкой
    container.classList.add('inline-tech-container');
    anchorElement.parentElement.appendChild(container);
  }

  if (toggleBtn) {
    toggleBtn.setAttribute('data-default', toggleBtn.textContent);
    toggleBtn.textContent = 'Скрыть таблицу';
  }
}

// Создает DOM-контейнер с таблицей технологий
function createTechTable(technologies) {
  const container = document.createElement('div');
  container.className = 'inline-tech-container';

  const table = document.createElement('table');
  table.className = 'tech-table';
  table.style.width = '100%';

  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  ['Название','Блок','Функция','Тип','Зрелость компании','Зрелость технологии'].forEach(h => {
    const th = document.createElement('th'); th.textContent = h; headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  technologies.forEach(tech => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${tech.name || ''}</td>
      <td>${tech.block || ''}</td>
      <td>${tech.func || tech.function || ''}</td>
      <td>${levelToLabel(tech.level || tech.type)}</td>
      <td>${tech.companyMaturity || ''}</td>
      <td>${tech.technologyMaturity || ''}</td>
    `;
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);

  container.appendChild(table);
  return container;
}

// ===== ЭКСПОРТ В PDF =====
function exportToPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  // Заголовок
  doc.setFontSize(18);
  doc.text('Аналитика цифровизации предприятий', 105, 20, { align: 'center' });

  // Дата формирования
  doc.setFontSize(12);
  doc.text(`Дата формирования: ${new Date().toLocaleDateString('ru-RU')}`, 105, 30, { align: 'center' });

  // Общая статистика
  doc.setFontSize(14);
  doc.text('Общая статистика', 20, 50);

  doc.setFontSize(12);
  doc.text(`Всего технологий: ${document.getElementById('totalTechnologies').textContent}`, 20, 60);
    doc.text(`Существующие: ${document.getElementById('existingTechnologies').textContent}`, 20, 70);
  doc.text(`Внедряемые: ${document.getElementById('implementingTechnologies').textContent}`, 20, 80);
  doc.text(`Перспективные: ${document.getElementById('perspectiveTechnologies').textContent}`, 20, 90);
  doc.text(`Индекс зрелости: ${document.getElementById('maturityIndex').textContent}`, 20, 100);
  doc.text(`Высокая зрелость: ${document.getElementById('highMaturityCount').textContent}`, 20, 110);

  // Детальная информация по предприятиям
  doc.setFontSize(14);
  doc.text('Детальная информация по предприятиям', 20, 130);

  const enterprises = currentEnterprise === "all" ? Object.keys(enterpriseData) : [currentEnterprise];
  let yPosition = 140;

  enterprises.forEach(enterprise => {
    const technologies = enterpriseData[enterprise] || [];

    doc.setFontSize(12);
    doc.text(`${enterprise}:`, 20, yPosition);
    yPosition += 10;

    doc.setFontSize(10);
    doc.text(`Всего технологий: ${technologies.length}`, 30, yPosition);
    yPosition += 7;

  const existingTech = technologies.filter(t => normalizeLevel(t.level) === 'existing').length;
  const implementingTech = technologies.filter(t => normalizeLevel(t.level) === 'implementing').length;
  const perspectiveTech = technologies.filter(t => normalizeLevel(t.level) === 'perspective').length;

    doc.text(`Существующие: ${existingTech}, Внедряемые: ${implementingTech}, Перспективные: ${perspectiveTech}`, 30, yPosition);
    yPosition += 7;

    // Расчет индекса зрелости
    let totalMaturity = 0;
    technologies.forEach(tech => {
      const companyMaturity = Number(tech.companyMaturity) || 1;
      const technologyMaturity = Number(tech.technologyMaturity) || 1;
      totalMaturity += (companyMaturity * technologyMaturity) / 9;
    });
    const maturityIndex = technologies.length > 0 ? (totalMaturity / technologies.length) * 100 : 0;

    doc.text(`Индекс зрелости: ${maturityIndex.toFixed(1)}%`, 30, yPosition);
    yPosition += 15;

    // Проверка, нужно ли добавить новую страницу
    if (yPosition > 270) {
      doc.addPage();
      yPosition = 20;
    }
  });

  // Сохранение PDF
  doc.save(`analytics_${new Date().toISOString().slice(0, 10)}.pdf`);

  showNotification('Отчет успешно экспортирован в PDF', 'success');
}

// ===== ЭКСПОРТ В EXCEL =====
function exportToExcel() {
  // Создание CSV-контента
  let csvContent = '\ufeff'; // BOM для корректного отображения кириллицы

  // Заголовок
  csvContent += 'Аналитика цифровизации предприятий\n';
  csvContent += `Дата формирования: ${new Date().toLocaleDateString('ru-RU')}\n\n`;

  // Общая статистика
  csvContent += 'Общая статистика\n';
  csvContent += `Всего технологий,${document.getElementById('totalTechnologies').textContent}\n`;
  csvContent += `Существующие,${document.getElementById('existingTechnologies').textContent}\n`;
  csvContent += `Внедряемые,${document.getElementById('implementingTechnologies').textContent}\n`;
  csvContent += `Перспективные,${document.getElementById('perspectiveTechnologies').textContent}\n`;
  csvContent += `Индекс зрелости,${document.getElementById('maturityIndex').textContent}\n`;
  csvContent += `Высокая зрелость,${document.getElementById('highMaturityCount').textContent}\n\n`;

  // Детальная информация по предприятиям
  csvContent += 'Детальная информация по предприятиям\n';
  csvContent += 'Предприятие,Всего технологий,Существующие,Внедряемые,Перспективные,Индекс зрелости\n';

  const enterprises = currentEnterprise === "all" ? Object.keys(enterpriseData) : [currentEnterprise];

  enterprises.forEach(enterprise => {
    const technologies = enterpriseData[enterprise] || [];

  const existingTech = technologies.filter(t => normalizeLevel(t.level) === 'existing').length;
  const implementingTech = technologies.filter(t => normalizeLevel(t.level) === 'implementing').length;
  const perspectiveTech = technologies.filter(t => normalizeLevel(t.level) === 'perspective').length;

    // Расчет индекса зрелости
    let totalMaturity = 0;
    technologies.forEach(tech => {
      const companyMaturity = Number(tech.companyMaturity) || 1;
      const technologyMaturity = Number(tech.technologyMaturity) || 1;
      totalMaturity += (companyMaturity * technologyMaturity) / 9;
    });
    const maturityIndex = technologies.length > 0 ? (totalMaturity / technologies.length) * 100 : 0;

    csvContent += `${enterprise},${technologies.length},${existingTech},${implementingTech},${perspectiveTech},${maturityIndex.toFixed(1)}%\n`;
  });

  // Создание blob и скачивание файла
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');

  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `analytics_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  showNotification('Отчет успешно экспортирован в Excel', 'success');
}

// ===== ОБНОВЛЕНИЕ ТЕМЫ ГРАФИКОВ =====
function updateChartsTheme() {
  // Перерисовываем все графики с учетом новой темы
  if (charts.statusChart) {
    updateStatusChart();
  }
  if (charts.maturityChart) {
    updateMaturityChart();
  }
  if (charts.dependenciesChart) {
    updateDependenciesChart();
  }
}

// ===== УВЕДОМЛЕНИЯ =====
function showNotification(message, type = 'info') {
  // Создание элемента уведомления
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;

  // Добавление в DOM
  document.body.appendChild(notification);

  // Показ уведомления
  setTimeout(() => {
    notification.classList.add('show');
  }, 10);

  // Скрытие и удаление уведомления
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => {
      document.body.removeChild(notification);
    }, 300);
  }, 3000);
}
                                                                                                                                                                                                                                                                                                                                                                                               
