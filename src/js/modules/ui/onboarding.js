// onboarding.js — ES module
// Модуль интерактивного тура по приложению

import Logger from '../core/logger.js';

'use strict';

  const STORAGE_KEY = 'rmk_onboarding_completed';
  const STORAGE_PROGRESS_KEY = 'rmk_onboarding_progress';
  const STORAGE_VERSION_KEY = 'rmk_onboarding_version';
  const CURRENT_VERSION = '1.1';

  // Master-flow тура и ролевые профили показа шагов (P3).
  const MASTER_FLOW_STEP_IDS = Object.freeze([
    'welcome',
    'sidebar',
    'report-button',
    'add-technology',
    'add-block',
    'search',
    'filters',
    'radar',
    'quadrant-zoom',
    'priority-panel',
    'detail-panel',
    'proposal-workflow',
    'admin-panel-entry',
    'complete'
  ]);

  const ROLE_PROFILE_STEP_IDS = Object.freeze({
    guest: Object.freeze([
      'welcome',
      'sidebar',
      'report-button',
      'search',
      'filters',
      'radar',
      'quadrant-zoom',
      'priority-panel',
      'detail-panel',
      'complete'
    ]),
    editor: Object.freeze([
      'welcome',
      'sidebar',
      'report-button',
      'search',
      'filters',
      'radar',
      'quadrant-zoom',
      'priority-panel',
      'detail-panel',
      'proposal-workflow',
      'complete'
    ]),
    owner: Object.freeze([
      'welcome',
      'sidebar',
      'report-button',
      'add-technology',
      'add-block',
      'search',
      'filters',
      'radar',
      'quadrant-zoom',
      'priority-panel',
      'detail-panel',
      'proposal-workflow',
      'complete'
    ]),
    admin: Object.freeze([
      'welcome',
      'sidebar',
      'report-button',
      'add-technology',
      'add-block',
      'search',
      'filters',
      'radar',
      'quadrant-zoom',
      'priority-panel',
      'detail-panel',
      'proposal-workflow',
      'admin-panel-entry',
      'complete'
    ])
  });

  function normalizeRole(role) {
    const roleApi = window.RoleCapabilities || window.RolesConfig || null;
    if (roleApi && typeof roleApi.normalizeRole === 'function') {
      return roleApi.normalizeRole(role);
    }
    return String(role || '').trim().toLowerCase();
  }

  function getCurrentRoleForTour() {
    const roleApi = window.RoleCapabilities || window.RolesConfig || null;
    if (roleApi && typeof roleApi.getCurrentRole === 'function') {
      return normalizeRole(roleApi.getCurrentRole());
    }
    return normalizeRole(localStorage.getItem('role'));
  }

  function resolveRoleProfile(role) {
    const normalized = normalizeRole(role || getCurrentRoleForTour());
    if (ROLE_PROFILE_STEP_IDS[normalized]) {
      return normalized;
    }
    return 'guest';
  }

  function getRoleProfileStepIds(role) {
    return ROLE_PROFILE_STEP_IDS[resolveRoleProfile(role)].slice();
  }

  function isStepAllowedByRoleProfile(step, role) {
    if (!step || !step.id) return false;
    return getRoleProfileStepIds(role).includes(step.id);
  }

  function isStepVisible(step, role, options = {}) {
    if (!isStepAllowedByRoleProfile(step, role)) {
      return false;
    }
    if (options.skipConditional === true) {
      return true;
    }
    if (step.conditional && typeof step.conditional === 'function') {
      return step.conditional();
    }
    return true;
  }

  function hasRoleCapability(capability) {
    const roleApi = window.RoleCapabilities || window.RolesConfig || null;
    if (roleApi && typeof roleApi.hasCapability === 'function') {
      return roleApi.hasCapability(capability);
    }
    return false;
  }

  function isAuthorizedFor(capability) {
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    const username = localStorage.getItem('username');
    return isLoggedIn && !!username && hasRoleCapability(capability);
  }

  // Определение шагов тура
  const TOUR_STEPS = [
    {
      id: 'welcome',
      title: 'Добро пожаловать в Радар технологий!',
      description: 'Это интерактивный радар, который помогает визуализировать и анализировать технологические решения компании.',
      target: null, // Нет целевого элемента
      position: 'center',
      showSkip: true
    },
    {
      id: 'sidebar',
      title: 'Боковая панель',
      description: 'Здесь вы можете найти поиск, фильтры и другие инструменты для работы с радаром.',
      target: '#sidebarButtons',
      position: 'right',
      showSkip: true
    },
    {
      id: 'report-button',
      title: 'Кнопка "Отчеты"',
      description: 'Нажмите на иконку "Отчеты" в боковой панели, чтобы открыть модальное окно экспорта данных. В этом окне вы можете выбрать поля для экспорта, настроить фильтры и создать PDF отчет с информацией о технологиях.',
      target: '#exportPdfModal',
      position: 'center',
      showSkip: true,
      waitForElement: true,
      conditional: () => {
        // Также проверяем, что модальное окно существует
        const exportModal = document.getElementById('exportPdfModal');
        return isAuthorizedFor('export_reports') && exportModal !== null;
      },
      beforeShow: () => {
        // Открываем модальное окно экспорта сразу, без задержки
        const exportModal = document.getElementById('exportPdfModal');
        const exportPdfBtn = document.getElementById('exportPdfBtn');

        if (exportModal) {
          // Убеждаемся, что модальное окно видно поверх overlay
          exportModal.style.zIndex = '10005';
          exportModal.style.position = 'fixed';

          // Открываем модальное окно через клик на кнопку, если она доступна
          if (exportPdfBtn) {
            // Убираем задержку для более быстрого открытия
            exportPdfBtn.click();
          } else {
            // Если кнопка недоступна, открываем модальное окно напрямую
            if (exportModal.classList.contains('hidden') || exportModal.hasAttribute('aria-hidden')) {
              exportModal.classList.remove('hidden');
              exportModal.setAttribute('aria-hidden', 'false');
              exportModal.style.display = 'block';
              exportModal.classList.add('open');

              // Вызываем функцию открытия модального окна, если она доступна
              if (typeof window.showExportPdfModal === 'function') {
                window.showExportPdfModal();
              } else if (typeof window.showModal === 'function') {
                window.showModal('exportPdfModal');
              }
            }
          }
        }
      },
      afterHide: () => {
        // Убираем подсветку кнопки "Отчеты" в боковой панели
        const reportIconBtn = document.getElementById('reportIconBtn');
        if (reportIconBtn) {
          reportIconBtn.classList.remove('onboarding-highlight');
        }
        // Убираем классы с родительских контейнеров
        const sidebarButtons = document.getElementById('sidebarButtons');
        const sidebarWrapper = document.querySelector('.sidebar-wrapper');
        if (sidebarButtons) {
          sidebarButtons.classList.remove('onboarding-highlight-container');
        }
        if (sidebarWrapper) {
          sidebarWrapper.classList.remove('onboarding-highlight-container');
        }

        // Закрываем модальное окно после шага
        const exportModal = document.getElementById('exportPdfModal');
        if (exportModal) {
          if (typeof window.hideModal === 'function') {
            window.hideModal('exportPdfModal');
          } else {
            exportModal.classList.add('hidden');
            exportModal.setAttribute('aria-hidden', 'true');
            exportModal.style.display = 'none';
          }
        }
      }
    },
    {
      id: 'add-technology',
      title: 'Добавление новой технологии',
      description: 'Для авторизованных пользователей доступна возможность добавления новых технологий. Нажмите на кнопку добавления в боковой панели, чтобы открыть форму, где вы можете указать название технологии, выбрать сектор, функциональный блок, функцию, тип технологии, статус и другие параметры.',
      target: '#addTechPanel',
      position: 'center',
      showSkip: true,
      waitForElement: true,
      conditional: () => {
        // Также проверяем, что модальное окно существует
        const addTechPanel = document.getElementById('addTechPanel');
        return isAuthorizedFor('manage_technologies') && addTechPanel !== null;
      },
      beforeShow: () => {
        // Подсвечиваем кнопку "Добавить" в боковой панели
        const addIconBtn = document.getElementById('addIconBtn');
        if (addIconBtn) {
          addIconBtn.classList.add('onboarding-highlight');
          // Добавляем класс к родительским контейнерам для правильного z-index
          const sidebarButtons = document.getElementById('sidebarButtons');
          const sidebarWrapper = document.querySelector('.sidebar-wrapper');
          if (sidebarButtons) {
            sidebarButtons.classList.add('onboarding-highlight-container');
          }
          if (sidebarWrapper) {
            sidebarWrapper.classList.add('onboarding-highlight-container');
          }
        }

        // Открываем модальное окно добавления технологии
        const addTechPanel = document.getElementById('addTechPanel');
        const chooseAddTechBtn = document.getElementById('chooseAddTech');

        if (addTechPanel) {
          // Убеждаемся, что модальное окно видно поверх overlay
          addTechPanel.style.zIndex = '10005';
          addTechPanel.style.position = 'fixed';

          // Открываем модальное окно через клик на кнопку, если она доступна
          if (chooseAddTechBtn) {
            // Сначала открываем popover, если он закрыт
            const pop = document.getElementById('addChoicePopover');
            if (pop) {
              // Убираем класс hidden, если он есть
              pop.classList.remove('hidden');
              if (pop.style.display !== 'block' && !pop.classList.contains('open')) {
                const addIconBtn = document.getElementById('addIconBtn');
                if (addIconBtn) {
                  const rect = addIconBtn.getBoundingClientRect();
                  pop.style.display = 'block';
                  pop.style.position = 'fixed';
                  pop.style.top = `${rect.bottom + 8}px`;
                  pop.style.left = `${rect.right + 8}px`;
                  pop.style.zIndex = '10006';
                  pop.classList.add('open');
                }
              } else {
                // Если popover уже открыт, убеждаемся, что он виден поверх overlay
                pop.style.zIndex = '10006';
              }
            }
            // Минимальная задержка перед кликом на кнопку, чтобы popover успел открыться
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                chooseAddTechBtn.click();
              });
            });
          } else {
            // Если кнопка недоступна, открываем модальное окно напрямую
            if (addTechPanel.classList.contains('hidden') || addTechPanel.hasAttribute('aria-hidden')) {
              addTechPanel.classList.remove('hidden');
              addTechPanel.setAttribute('aria-hidden', 'false');
              addTechPanel.style.display = 'block';
              addTechPanel.classList.add('open');

              // Вызываем функцию открытия модального окна, если она доступна
              if (typeof window.showModal === 'function') {
                window.showModal('addTechPanel');
              }
            }
          }
        }
      },
      afterHide: () => {
        // Убираем подсветку кнопки "Добавить" в боковой панели
        const addIconBtn = document.getElementById('addIconBtn');
        if (addIconBtn) {
          addIconBtn.classList.remove('onboarding-highlight');
        }
        // Убираем классы с родительских контейнеров
        const sidebarButtons = document.getElementById('sidebarButtons');
        const sidebarWrapper = document.querySelector('.sidebar-wrapper');
        if (sidebarButtons) {
          sidebarButtons.classList.remove('onboarding-highlight-container');
        }
        if (sidebarWrapper) {
          sidebarWrapper.classList.remove('onboarding-highlight-container');
        }

        // Закрываем popover, если он открыт
        const pop = document.getElementById('addChoicePopover');
        if (pop) {
          pop.style.display = 'none';
          pop.classList.remove('open');
        }

        // Закрываем модальное окно после шага
        const addTechPanel = document.getElementById('addTechPanel');
        if (addTechPanel) {
          if (typeof window.hideModal === 'function') {
            window.hideModal('addTechPanel');
          } else {
            addTechPanel.classList.add('hidden');
            addTechPanel.setAttribute('aria-hidden', 'true');
            addTechPanel.style.display = 'none';
          }
        }
      }
    },
    {
      id: 'add-block',
      title: 'Добавление нового функционального блока',
      description: 'Для авторизованных пользователей доступна возможность добавления новых функциональных блоков. Нажмите на кнопку добавления функционального блока, чтобы открыть форму, где вы можете указать название блока и его описание. Функциональный блок представляет собой группу связанных функций, объединенных общей целью.',
      target: '#addBlockPanel',
      position: 'center',
      showSkip: true,
      waitForElement: true,
      conditional: () => {
        // Также проверяем, что модальное окно существует
        const addBlockPanel = document.getElementById('addBlockPanel');
        return isAuthorizedFor('manage_technologies') && addBlockPanel !== null;
      },
      beforeShow: () => {
        // Подсвечиваем кнопку "Добавить" в боковой панели
        const addIconBtn = document.getElementById('addIconBtn');
        if (addIconBtn) {
          addIconBtn.classList.add('onboarding-highlight');
          // Добавляем класс к родительским контейнерам для правильного z-index
          const sidebarButtons = document.getElementById('sidebarButtons');
          const sidebarWrapper = document.querySelector('.sidebar-wrapper');
          if (sidebarButtons) {
            sidebarButtons.classList.add('onboarding-highlight-container');
          }
          if (sidebarWrapper) {
            sidebarWrapper.classList.add('onboarding-highlight-container');
          }
        }

        // Открываем модальное окно добавления функционального блока
        const addBlockPanel = document.getElementById('addBlockPanel');
        const chooseAddBlockBtn = document.getElementById('chooseAddBlock');

        if (addBlockPanel) {
          // Убеждаемся, что модальное окно видно поверх overlay
          addBlockPanel.style.zIndex = '10005';
          addBlockPanel.style.position = 'fixed';

          // Открываем модальное окно через клик на кнопку, если она доступна
          if (chooseAddBlockBtn) {
            // Сначала открываем popover, если он закрыт
            const pop = document.getElementById('addChoicePopover');
            if (pop) {
              // Убираем класс hidden, если он есть
              pop.classList.remove('hidden');
              if (pop.style.display !== 'block' && !pop.classList.contains('open')) {
                const addIconBtn = document.getElementById('addIconBtn');
                if (addIconBtn) {
                  const rect = addIconBtn.getBoundingClientRect();
                  pop.style.display = 'block';
                  pop.style.position = 'fixed';
                  pop.style.top = `${rect.bottom + 8}px`;
                  pop.style.left = `${rect.right + 8}px`;
                  pop.style.zIndex = '10006';
                  pop.classList.add('open');
                }
              } else {
                // Если popover уже открыт, убеждаемся, что он виден поверх overlay
                pop.style.zIndex = '10006';
              }
            }
            // Минимальная задержка перед кликом на кнопку, чтобы popover успел открыться
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                chooseAddBlockBtn.click();
              });
            });
          } else {
            // Если кнопка недоступна, открываем модальное окно напрямую
            if (addBlockPanel.classList.contains('hidden') || addBlockPanel.hasAttribute('aria-hidden')) {
              addBlockPanel.classList.remove('hidden');
              addBlockPanel.setAttribute('aria-hidden', 'false');
              addBlockPanel.style.display = 'block';
              addBlockPanel.classList.add('open');

              // Вызываем функцию открытия модального окна, если она доступна
              if (typeof window.showModal === 'function') {
                window.showModal('addBlockPanel');
              }
            }
          }
        }
      },
      afterHide: () => {
        // Убираем подсветку кнопки "Добавить" в боковой панели
        const addIconBtn = document.getElementById('addIconBtn');
        if (addIconBtn) {
          addIconBtn.classList.remove('onboarding-highlight');
        }
        // Убираем классы с родительских контейнеров
        const sidebarButtons = document.getElementById('sidebarButtons');
        const sidebarWrapper = document.querySelector('.sidebar-wrapper');
        if (sidebarButtons) {
          sidebarButtons.classList.remove('onboarding-highlight-container');
        }
        if (sidebarWrapper) {
          sidebarWrapper.classList.remove('onboarding-highlight-container');
        }

        // Закрываем popover, если он открыт
        const pop = document.getElementById('addChoicePopover');
        if (pop) {
          pop.style.display = 'none';
          pop.classList.remove('open');
        }

        // Закрываем модальное окно после шага
        const addBlockPanel = document.getElementById('addBlockPanel');
        if (addBlockPanel) {
          if (typeof window.hideModal === 'function') {
            window.hideModal('addBlockPanel');
          } else {
            addBlockPanel.classList.add('hidden');
            addBlockPanel.setAttribute('aria-hidden', 'true');
            addBlockPanel.style.display = 'none';
          }
        }
      }
    },
    {
      id: 'search',
      title: 'Поиск технологий',
      description: 'Используйте поиск для быстрого нахождения нужных технологий по названию. Введите название технологии в поле поиска, и результаты отобразятся на радаре.',
      target: '#sidebar',
      position: 'right',
      showSkip: true,
      beforeShow: () => {
        // Раскрываем боковую панель перед показом шага
        const sidebarWrapper = document.querySelector('.sidebar-wrapper');
        if (sidebarWrapper) {
          sidebarWrapper.classList.remove('collapsed');
          sidebarWrapper.classList.add('expanded');
        }
        // Убеждаемся, что контейнер поиска виден и поверх overlay
        const searchContainer = document.querySelector('.search-container');
        if (searchContainer) {
          searchContainer.style.display = 'block';
          searchContainer.classList.add('onboarding-visible');
        }
        // Убеждаемся, что сайдбар виден и поверх overlay
        const sidebar = document.getElementById('sidebar');
        if (sidebar) {
          sidebar.style.display = 'block';
          sidebar.classList.add('onboarding-visible');
        }
      },
      afterHide: (stepIndex) => {
        // Убираем классы видимости
        const searchContainer = document.querySelector('.search-container');
        const sidebar = document.getElementById('sidebar');
        if (searchContainer) {
          searchContainer.classList.remove('onboarding-visible');
        }
        if (sidebar) {
          sidebar.classList.remove('onboarding-visible');
        }
        // Скрываем панель только если следующий шаг не требует её раскрытия
        const nextStepIndex = (stepIndex !== undefined ? stepIndex : currentStepIndex) + 1;
        if (nextStepIndex < TOUR_STEPS.length) {
          const nextStep = TOUR_STEPS[nextStepIndex];
          if (nextStep && nextStep.id !== 'filters') {
            const sidebarWrapper = document.querySelector('.sidebar-wrapper');
            if (sidebarWrapper) {
              sidebarWrapper.classList.remove('expanded');
              sidebarWrapper.classList.add('collapsed');
            }
          }
        } else {
          // Если это последний шаг, скрываем панель
          const sidebarWrapper = document.querySelector('.sidebar-wrapper');
          if (sidebarWrapper) {
            sidebarWrapper.classList.remove('expanded');
            sidebarWrapper.classList.add('collapsed');
          }
        }
      }
    },
    {
      id: 'filters',
      title: 'Фильтры',
      description: 'Фильтруйте технологии по функциональным блокам, функциям, типам и статусам. Вы можете выбрать несколько значений в каждом фильтре для точной настройки отображения технологий на радаре.',
      target: '#filterPanel',
      position: 'right',
      showSkip: true,
      beforeShow: () => {
        // Раскрываем боковую панель перед показом шага
        const sidebarWrapper = document.querySelector('.sidebar-wrapper');
        if (sidebarWrapper) {
          sidebarWrapper.classList.remove('collapsed');
          sidebarWrapper.classList.add('expanded');
        }
        // Убеждаемся, что сайдбар виден и поверх overlay
        const sidebar = document.getElementById('sidebar');
        if (sidebar) {
          sidebar.style.display = 'block';
          sidebar.classList.add('onboarding-visible');
        }
        // Открываем панель фильтров и делаем её видимой поверх overlay
        const filterPanel = document.getElementById('filterPanel');
        if (filterPanel) {
          filterPanel.classList.add('open');
          filterPanel.classList.add('onboarding-visible');
        }
      },
      afterHide: (stepIndex) => {
        // Убираем классы видимости
        const sidebar = document.getElementById('sidebar');
        const filterPanel = document.getElementById('filterPanel');
        if (sidebar) {
          sidebar.classList.remove('onboarding-visible');
        }
        if (filterPanel) {
          filterPanel.classList.remove('onboarding-visible');
        }
        // Скрываем боковую панель после прохождения шага фильтров
        // Всегда скрываем, так как следующий шаг (радар) не требует панели
        const sidebarWrapper = document.querySelector('.sidebar-wrapper');
        if (sidebarWrapper) {
          sidebarWrapper.classList.remove('expanded');
          sidebarWrapper.classList.add('collapsed');
        }
      }
    },
    {
      id: 'radar',
      title: 'Интерактивный радар',
      description: 'Радар разделен на квадранты и кольца зрелости. Кликните на технологию, чтобы увидеть детальную информацию. Для детального просмотра сектора кликните на него - откроется увеличенный вид с модальным окном списка технологий.',
      target: '#techRadar',
      position: 'center',
      showSkip: true
    },
    {
      id: 'quadrant-zoom',
      title: 'Зуммирование сектора',
      description: 'Кликните на любой сектор радара, чтобы увеличить его и открыть модальное окно со списком технологий этого сектора. В модальном окне отображаются все технологии сектора с учётом фильтров боковой панели; поиск по списку доступен в поле ввода.',
      target: '#techRadar',
      position: 'center',
      showSkip: true,
      beforeShow: () => {
        // Убеждаемся, что радар виден
        const radar = document.getElementById('techRadar');
        if (radar) {
          radar.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        // Подчеркиваем названия всех секторов (они находятся внутри SVG)
        const allLabelGroups = document.querySelectorAll('#techRadar .sector-label-group');
        allLabelGroups.forEach(labelGroup => {
          labelGroup.classList.add('onboarding-highlight-label');

          // Добавляем линию подчеркивания через SVG элемент
          const labelText = labelGroup.querySelector('.sector-label');
          if (labelText && !labelGroup.querySelector('.underline-line')) {
            const addUnderline = () => {
              try {
                const bbox = labelText.getBBox();
                if (bbox.width > 0 && bbox.height > 0) {
                  const SVG_NS = "http://www.w3.org/2000/svg";
                  const underline = document.createElementNS(SVG_NS, 'line');
                  underline.classList.add('underline-line');
                  underline.setAttribute('x1', (bbox.x).toString());
                  underline.setAttribute('y1', (bbox.y + bbox.height + 4).toString());
                  underline.setAttribute('x2', (bbox.x + bbox.width).toString());
                  underline.setAttribute('y2', (bbox.y + bbox.height + 4).toString());
                  underline.setAttribute('stroke', 'var(--accent)');
                  underline.setAttribute('stroke-width', '2');
                  underline.setAttribute('stroke-linecap', 'round');
                  labelGroup.appendChild(underline);
                }
              } catch (e) {
                // Если getBBox не работает, используем примерные координаты
                const SVG_NS = "http://www.w3.org/2000/svg";
                const underline = document.createElementNS(SVG_NS, 'line');
                underline.classList.add('underline-line');
                underline.setAttribute('x1', '-100');
                underline.setAttribute('y1', '8');
                underline.setAttribute('x2', '100');
                underline.setAttribute('y2', '8');
                underline.setAttribute('stroke', 'var(--accent)');
                underline.setAttribute('stroke-width', '2');
                underline.setAttribute('stroke-linecap', 'round');
                labelGroup.appendChild(underline);
              }
            };

            // Используем requestAnimationFrame для получения правильных координат после рендеринга
            requestAnimationFrame(() => {
              requestAnimationFrame(addUnderline);
            });
          }
        });
      },
      afterHide: () => {
        // Убираем подчеркивание названий секторов
        const allLabelGroups = document.querySelectorAll('#techRadar .sector-label-group');
        allLabelGroups.forEach(labelGroup => {
          labelGroup.classList.remove('onboarding-highlight-label');

          // Удаляем линии подчеркивания
          const underline = labelGroup.querySelector('.underline-line');
          if (underline) {
            underline.remove();
          }
        });
      }
    },
    {
      id: 'priority-panel',
      title: 'Модальное окно списка технологий',
      description: 'При зуммировании сектора открывается модальное окно со списком технологий. Здесь отображаются все технологии выбранного сектора с учётом фильтров боковой панели и поиска по названию.',
      target: '#quadrantPriorityPanel',
      position: 'center',
      showSkip: true,
      conditional: () => {
        // Показываем шаг, если панель существует
        const priorityPanel = document.getElementById('quadrantPriorityPanel');
        return priorityPanel !== null;
      },
      beforeShow: () => {
        // Зуммируем первый доступный квадрант для демонстрации
        if (typeof window.zoomQuadrant === 'function' && typeof window.getQuadrantIdForBlock === 'function') {
          // Пробуем зуммировать первый квадрант
          const quadrants = window.QUADRANTS || [];
          if (quadrants.length > 0) {
            const firstQuadrant = quadrants[0];
            if (firstQuadrant && firstQuadrant.id) {
              // Используем requestAnimationFrame для более быстрого выполнения
              requestAnimationFrame(() => {
                window.zoomQuadrant(firstQuadrant.id, { source: 'onboarding' });
                // Открываем панель списка технологий и заполняем список
                requestAnimationFrame(() => {
                  requestAnimationFrame(() => {
                    if (typeof window.openQuadrantPriorityPanel === 'function') {
                      window.openQuadrantPriorityPanel();
                      // Заполняем список технологий
                      if (typeof window.recomputeQuadrantPriorityList === 'function') {
                        window.recomputeQuadrantPriorityList(firstQuadrant.id);
                      }
                      // Убеждаемся, что модальное окно видно поверх overlay
                      const priorityPanel = document.getElementById('quadrantPriorityPanel');
                      if (priorityPanel) {
                        priorityPanel.style.zIndex = '10004';
                        priorityPanel.style.position = 'fixed';
                      }
                      // Подсвечиваем поле поиска внутри модального окна
                      const searchInput = document.getElementById('qpSearchInput');
                      if (searchInput) {
                        searchInput.classList.add('onboarding-highlight-input');
                      }
                    }
                  });
                });
              });
            }
          }
        }
      },
      afterHide: () => {
        // Убираем подсветку поля поиска
        const searchInput = document.getElementById('qpSearchInput');
        if (searchInput) {
          searchInput.classList.remove('onboarding-highlight-input');
        }
        // Не закрываем панель и не убираем зум - они нужны для следующих шагов
        // Панель и зум будут закрыты только после шага со списком технологий
        // Overlay обрабатывается автоматически при переходе между шагами
      }
    },
    {
      id: 'detail-panel',
      title: 'Панель подробной информации',
      description: 'При клике на технологию в списке открывается панель с подробной информацией: описание, оценки и примеры внедрений. Используйте эту панель для получения полной информации о технологии.',
      target: null,
      position: 'center',
      showSkip: true,
      conditional: () => {
        // Показываем шаг, если панель списка технологий существует
        const priorityPanel = document.getElementById('quadrantPriorityPanel');
        return priorityPanel !== null;
      },
      beforeShow: () => {
        // Убеждаемся, что зум не сброшен
        const currentZoomed = typeof window.getCurrentZoomedQuadrant === 'function'
          ? window.getCurrentZoomedQuadrant()
          : null;
        if (!currentZoomed) {
          // Если зум сброшен, восстанавливаем его
          const quadrants = window.QUADRANTS || [];
          if (quadrants.length > 0 && typeof window.zoomQuadrant === 'function') {
            const firstQuadrant = quadrants[0];
            if (firstQuadrant && firstQuadrant.id) {
              window.zoomQuadrant(firstQuadrant.id, { source: 'onboarding' });
            }
          }
        }

        // Убеждаемся, что панель списка технологий открыта и видна поверх overlay
        const priorityPanel = document.getElementById('quadrantPriorityPanel');
        if (priorityPanel) {
          if (priorityPanel.hasAttribute('aria-hidden')) {
            if (typeof window.openQuadrantPriorityPanel === 'function') {
              window.openQuadrantPriorityPanel();
            }
          }
          // Убеждаемся, что модальное окно видно поверх overlay
          priorityPanel.style.zIndex = '10004';
          priorityPanel.style.position = 'fixed';
        }

        // Просто открываем панель детальной информации пустой для демонстрации
        // Используем requestAnimationFrame для более быстрого отображения
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const detailPanel = document.getElementById('detailPanel');
          if (detailPanel) {
            detailPanel.classList.add('active');
            // Не устанавливаем display, zIndex, position через inline стили
            // CSS уже управляет отображением через класс .active
            // Только для тура временно увеличиваем z-index, чтобы панель была видна поверх overlay
            const originalZIndex = detailPanel.style.zIndex;
            detailPanel.style.zIndex = '10003';
            // Сохраняем оригинальный z-index для восстановления
            if (!detailPanel.dataset.originalZIndex) {
              detailPanel.dataset.originalZIndex = originalZIndex || '';
            }

            // Заполняем базовую информацию, если панель пустая
            const panelTitle = detailPanel.querySelector('#panelTitle');
            if (panelTitle && !panelTitle.textContent.trim()) {
              panelTitle.textContent = 'Детальная информация о технологии';
            }

            // Скрываем кнопки "Редактировать" и "Удалить" для неавторизованных пользователей
            const isAuthorized = isAuthorizedFor('manage_technologies');

            const editBtn = detailPanel.querySelector('#editTechBtn');
            const deleteBtn = detailPanel.querySelector('#deleteTechBtn');
            const techActions = detailPanel.querySelector('.tech-actions');

            if (!isAuthorized) {
              // Скрываем кнопки для неавторизованных пользователей
              if (editBtn) {
                editBtn.style.display = 'none';
                editBtn.style.visibility = 'hidden';
                editBtn.style.opacity = '0';
                editBtn.setAttribute('aria-hidden', 'true');
              }
              if (deleteBtn) {
                deleteBtn.style.display = 'none';
                deleteBtn.style.visibility = 'hidden';
                deleteBtn.style.opacity = '0';
                deleteBtn.setAttribute('aria-hidden', 'true');
              }
              // Скрываем весь блок действий для неавторизованных пользователей
              if (techActions) {
                techActions.style.display = 'none';
                techActions.style.visibility = 'hidden';
                techActions.style.opacity = '0';
                techActions.setAttribute('aria-hidden', 'true');
              }
            } else {
              // Показываем кнопки для авторизованных пользователей
              if (editBtn) {
                editBtn.style.display = '';
                editBtn.style.visibility = 'visible';
                editBtn.style.opacity = '1';
                editBtn.removeAttribute('aria-hidden');
              }
              if (deleteBtn) {
                deleteBtn.style.display = '';
                deleteBtn.style.visibility = 'visible';
                deleteBtn.style.opacity = '1';
                deleteBtn.removeAttribute('aria-hidden');
              }
              if (techActions) {
                techActions.style.display = '';
                techActions.style.visibility = 'visible';
                techActions.style.opacity = '1';
                techActions.removeAttribute('aria-hidden');
              }
            }
          }
          });
        });
      },
      afterHide: (stepIndex) => {
        // Восстанавливаем видимость кнопок после тура
        const detailPanel = document.getElementById('detailPanel');
        if (detailPanel) {
          const editBtn = detailPanel.querySelector('#editTechBtn');
          const deleteBtn = detailPanel.querySelector('#deleteTechBtn');
          const techActions = detailPanel.querySelector('.tech-actions');

          // Восстанавливаем отображение кнопок в зависимости от авторизации
          const isAuthorized = isAuthorizedFor('manage_technologies');

          if (isAuthorized) {
            if (editBtn) {
              editBtn.style.display = '';
              editBtn.style.visibility = 'visible';
              editBtn.style.opacity = '1';
              editBtn.removeAttribute('aria-hidden');
            }
            if (deleteBtn) {
              deleteBtn.style.display = '';
              deleteBtn.style.visibility = 'visible';
              deleteBtn.style.opacity = '1';
              deleteBtn.removeAttribute('aria-hidden');
            }
            if (techActions) {
              techActions.style.display = '';
              techActions.style.visibility = 'visible';
              techActions.style.opacity = '1';
              techActions.removeAttribute('aria-hidden');
            }
          } else {
            // Убеждаемся, что кнопки скрыты для неавторизованных
            if (editBtn) {
              editBtn.style.display = 'none';
              editBtn.style.visibility = 'hidden';
              editBtn.style.opacity = '0';
            }
            if (deleteBtn) {
              deleteBtn.style.display = 'none';
              deleteBtn.style.visibility = 'hidden';
              deleteBtn.style.opacity = '0';
            }
            if (techActions) {
              techActions.style.display = 'none';
              techActions.style.visibility = 'hidden';
              techActions.style.opacity = '0';
            }
          }
        }

        // Проверяем, является ли следующий шаг последним (complete)
        // Это нужно, чтобы не сбрасывать зум при переходе с шага detail-panel на шаг complete
        const currentIndex = stepIndex !== undefined ? stepIndex : currentStepIndex;
        const currentStepObj = currentIndex >= 0 && currentIndex < TOUR_STEPS.length ? TOUR_STEPS[currentIndex] : null;
        const isCurrentStepDetailPanel = currentStepObj && currentStepObj.id === 'detail-panel';
        const nextStepIndex = currentIndex + 1;
        const isLastStep = currentIndex === TOUR_STEPS.length - 1;
        const nextStep = !isLastStep && nextStepIndex < TOUR_STEPS.length ? TOUR_STEPS[nextStepIndex] : null;
        const isNextStepComplete = nextStep && nextStep.id === 'complete';

        // Закрываем панель списка технологий и убираем зум после шага
        // НО не сбрасываем зум и не закрываем панель, если мы на шаге detail-panel и следующий шаг - это завершающий шаг (complete)
        // Это позволяет сохранить зум при переходе с шага 9 (detail-panel) на шаг 10 (complete)
        const shouldPreserveZoom = isCurrentStepDetailPanel && isNextStepComplete;
        if (!shouldPreserveZoom) {
          if (typeof window.closeQuadrantPriorityPanel === 'function') {
            window.closeQuadrantPriorityPanel();
          }
          if (typeof window.unzoom === 'function') {
            setTimeout(() => {
              window.unzoom();
            }, 200);
          }
        }
        // Скрываем панель после шага, если она была открыта только для тура
        // И очищаем inline стили, установленные туром
        if (detailPanel && !window.StateManager?.get('selectedBlipId')) {
          detailPanel.classList.remove('active');
          // Очищаем inline стили, установленные туром
          detailPanel.style.display = '';
          // Восстанавливаем оригинальный z-index, если он был сохранен
          if (detailPanel.dataset.originalZIndex !== undefined) {
            detailPanel.style.zIndex = detailPanel.dataset.originalZIndex;
            delete detailPanel.dataset.originalZIndex;
          } else {
            detailPanel.style.zIndex = '';
          }
          detailPanel.style.position = '';
        }
      }
    },
    {
      id: 'proposal-workflow',
      title: 'Предложения изменений и модерация',
      description: 'Для ролей editor/owner/admin доступен сценарий предложений изменений: editor формирует предложение, owner/admin его рассматривают (approve/reject), а editor отслеживает статусы модерации.',
      target: null,
      position: 'center',
      showSkip: true,
      conditional: () => {
        return hasRoleCapability('create_proposals') && hasRoleCapability('view_proposal_statuses');
      }
    },
    {
      id: 'admin-panel-entry',
      title: 'Функции админ-панели',
      description: 'Роль admin получает доступ к админ-панели: управление пользователями, метриками и системными разделами. Переход в админку доступен по роли в правом верхнем углу.',
      target: null,
      position: 'center',
      showSkip: true,
      conditional: () => {
        return hasRoleCapability('manage_admin_panel');
      }
    },
    {
      id: 'complete',
      title: 'Тур завершен!',
      description: 'Вы изучили основные функции приложения. Если у вас возникнут вопросы, используйте кнопку "Помощь" в меню.',
      target: null,
      position: 'center',
      showSkip: false
    }
  ];

  let currentStepIndex = 0;
  let overlay = null;
  let tooltip = null;
  let isTourActive = false;
  let highlightUpdateIntervalId = null;
  let detailPanelUpdateIntervalId = null;
  let activeStepRenderToken = 0;

  /**
   * Проверяет, проходил ли пользователь тур
   */
  function hasCompletedTour() {
    const completed = localStorage.getItem(STORAGE_KEY);
    const version = localStorage.getItem(STORAGE_VERSION_KEY);
    // Если версия изменилась, считаем тур не пройденным
    return completed === 'true' && version === CURRENT_VERSION;
  }

  /**
   * Сохраняет прогресс тура
   */
  function saveProgress(stepIndex) {
    localStorage.setItem(STORAGE_PROGRESS_KEY, stepIndex.toString());
  }

  /**
   * Загружает сохраненный прогресс
   */
  function loadProgress() {
    const progress = localStorage.getItem(STORAGE_PROGRESS_KEY);
    return progress ? parseInt(progress, 10) : 0;
  }

  /**
   * Отмечает тур как завершенный
   */
  function completeTour() {
    localStorage.setItem(STORAGE_KEY, 'true');
    localStorage.setItem(STORAGE_VERSION_KEY, CURRENT_VERSION);
    localStorage.removeItem(STORAGE_PROGRESS_KEY);
  }

  /**
   * Создает overlay для подсветки элементов
   */
  function createOverlay() {
    if (overlay) return overlay;

    overlay = document.createElement('div');
    overlay.className = 'onboarding-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    document.body.appendChild(overlay);
    return overlay;
  }

  /**
   * Создает tooltip для отображения информации о шаге
   */
  function createTooltip() {
    if (tooltip) return tooltip;

    tooltip = document.createElement('div');
    tooltip.className = 'onboarding-tooltip';
    tooltip.setAttribute('role', 'dialog');
    tooltip.setAttribute('aria-modal', 'true');
    tooltip.setAttribute('aria-live', 'polite');
    document.body.appendChild(tooltip);
    return tooltip;
  }

  function clearOverlayIntervals() {
    if (highlightUpdateIntervalId !== null) {
      clearInterval(highlightUpdateIntervalId);
      highlightUpdateIntervalId = null;
    }
    if (detailPanelUpdateIntervalId !== null) {
      clearInterval(detailPanelUpdateIntervalId);
      detailPanelUpdateIntervalId = null;
    }
  }

  function clearOverlayMasks() {
    const styleElement = document.getElementById('onboarding-sector1-cutout-style');
    if (styleElement) {
      styleElement.remove();
    }

    const maskSvg = document.getElementById('onboarding-quadrant-zoom-mask');
    if (maskSvg) {
      maskSvg.remove();
    }

    const detailPanelMaskSvg = document.getElementById('onboarding-detail-panel-mask');
    if (detailPanelMaskSvg) {
      detailPanelMaskSvg.remove();
    }

    if (overlay) {
      overlay.style.mask = '';
      overlay.style.webkitMask = '';
      overlay.style.background = '';
    }
  }

  function cleanupTransientHighlights() {
    document.querySelectorAll('.onboarding-highlight').forEach((el) => {
      el.classList.remove('onboarding-highlight');
    });
    document.querySelectorAll('.onboarding-highlight-container').forEach((el) => {
      el.classList.remove('onboarding-highlight-container');
    });
    document.querySelectorAll('.onboarding-visible').forEach((el) => {
      el.classList.remove('onboarding-visible');
    });
    document.querySelectorAll('.onboarding-highlight-input').forEach((el) => {
      el.classList.remove('onboarding-highlight-input');
    });
    document.querySelectorAll('.onboarding-highlight-label').forEach((el) => {
      el.classList.remove('onboarding-highlight-label');
    });
    document.querySelectorAll('.underline-line').forEach((el) => {
      el.remove();
    });
  }

  function resetStepArtifactsForTransition() {
    clearOverlayIntervals();
    clearOverlayMasks();
    cleanupTransientHighlights();
  }

  /**
   * Удаляет overlay и tooltip
   */
  function removeOverlay() {
    clearOverlayIntervals();
    clearOverlayMasks();
    if (overlay) {
      overlay.remove();
      overlay = null;
    }
    if (tooltip) {
      tooltip.remove();
      tooltip = null;
    }
  }

  /**
   * Вычисляет позицию и размеры для подсветки элемента
   */
  function getElementRect(element) {
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    return {
      top: rect.top + window.scrollY,
      left: rect.left + window.scrollX,
      width: rect.width,
      height: rect.height
    };
  }

  function applyHighlightRect(rect, padding = 10) {
    if (!overlay || !rect) return;
    const top = rect.top - padding;
    const left = rect.left - padding;
    const width = rect.width + padding * 2;
    const height = rect.height + padding * 2;

    overlay.style.display = 'block';
    overlay.style.setProperty('--highlight-top', `${top}px`);
    overlay.style.setProperty('--highlight-left', `${left}px`);
    overlay.style.setProperty('--highlight-width', `${width}px`);
    overlay.style.setProperty('--highlight-height', `${height}px`);
  }

  /**
   * Подсвечивает элемент
   */
  function highlightElement(element, position = 'bottom') {
    if (!overlay) {
      createOverlay();
    }

    // Проверяем, что overlay создан
    if (!overlay) {
      if (Logger) Logger.warn('Onboarding: overlay не был создан');
      return;
    }

    if (!element) {
      // Центрированная подсветка для шагов без целевого элемента
      overlay.style.display = 'block';
      overlay.style.setProperty('--highlight-top', '50%');
      overlay.style.setProperty('--highlight-left', '50%');
      overlay.style.setProperty('--highlight-width', '0px');
      overlay.style.setProperty('--highlight-height', '0px');
      return;
    }

    // Проверяем, что элемент все еще существует в DOM
    if (!document.contains(element)) {
      if (Logger) Logger.warn('Onboarding: элемент не найден в DOM');
      overlay.style.display = 'block';
      overlay.style.setProperty('--highlight-top', '50%');
      overlay.style.setProperty('--highlight-left', '50%');
      overlay.style.setProperty('--highlight-width', '0px');
      overlay.style.setProperty('--highlight-height', '0px');
      return;
    }

    // Ждем, пока элемент будет отрендерен
    let attempts = 0;
    const maxAttempts = 100; // Максимум 5 секунд (100 * 50ms)

    const updateHighlight = () => {
      // Проверяем, что overlay все еще существует
      if (!overlay || !document.body.contains(overlay)) {
        if (Logger) Logger.warn('Onboarding: overlay был удален');
        return;
      }

      // Проверяем, что элемент все еще существует
      if (!document.contains(element)) {
        if (Logger) Logger.warn('Onboarding: элемент был удален из DOM');
        overlay.style.display = 'block';
        overlay.style.setProperty('--highlight-top', '50%');
        overlay.style.setProperty('--highlight-left', '50%');
        overlay.style.setProperty('--highlight-width', '0px');
        overlay.style.setProperty('--highlight-height', '0px');
        return;
      }

      attempts++;
      if (attempts > maxAttempts) {
        if (Logger) Logger.warn('Onboarding: превышено максимальное количество попыток обновления подсветки');
        // Если превышен лимит, используем центрированную подсветку или скрываем overlay
        if (overlay) {
          // Для панели детальной информации не показываем подсветку, если она не видна
          const currentStep = TOUR_STEPS[currentStepIndex];
          if (currentStep && currentStep.target === '#detailPanel') {
            overlay.style.display = 'none';
          } else {
            overlay.style.display = 'block';
            overlay.style.setProperty('--highlight-top', '50%');
            overlay.style.setProperty('--highlight-left', '50%');
            overlay.style.setProperty('--highlight-width', '0px');
            overlay.style.setProperty('--highlight-height', '0px');
          }
        }
        return;
      }

      const rect = getElementRect(element);
      if (!rect || rect.width === 0 || rect.height === 0) {
        // Если элемент еще не отрендерен, пробуем еще раз
        // Но только если не превышен лимит попыток
        if (attempts < maxAttempts) {
          requestAnimationFrame(updateHighlight);
        } else {
          // Если превышен лимит, используем центрированную подсветку или скрываем
          if (overlay) {
            const currentStep = TOUR_STEPS[currentStepIndex];
            if (currentStep && currentStep.target === '#detailPanel') {
              overlay.style.display = 'none';
            } else {
              overlay.style.display = 'block';
              overlay.style.setProperty('--highlight-top', '50%');
              overlay.style.setProperty('--highlight-left', '50%');
              overlay.style.setProperty('--highlight-width', '0px');
              overlay.style.setProperty('--highlight-height', '0px');
            }
          }
        }
        return;
      }

      // Добавляем отступ для лучшей видимости
      const padding = 10;
      applyHighlightRect(rect, padding);

      // Убеждаемся, что панель детальной информации и модальное окно списка технологий видимы поверх overlay
      const currentStep = TOUR_STEPS[currentStepIndex];
      if (currentStep && currentStep.id === 'detail-panel') {
        const detailPanel = document.getElementById('detailPanel');
        const priorityPanel = document.getElementById('quadrantPriorityPanel');
        if (detailPanel) {
          // Только для тура временно увеличиваем z-index
          const originalZIndex = detailPanel.style.zIndex;
          detailPanel.style.zIndex = '10003';
          // Сохраняем оригинальный z-index для восстановления
          if (!detailPanel.dataset.originalZIndex) {
            detailPanel.dataset.originalZIndex = originalZIndex || '';
          }
        }
        if (priorityPanel) {
          priorityPanel.style.zIndex = '10004';
          priorityPanel.style.position = 'fixed';
        }
      }

      // Для шага search и priority-panel обновляем подсветку периодически, чтобы она не слетала
      if (currentStep && (currentStep.id === 'search' || currentStep.id === 'priority-panel')) {
        // Останавливаем предыдущий интервал, если он существует
        if (highlightUpdateIntervalId !== null) {
          clearInterval(highlightUpdateIntervalId);
          highlightUpdateIntervalId = null;
        }
        // Устанавливаем периодическое обновление подсветки
        const stepIndex = currentStepIndex;
        highlightUpdateIntervalId = setInterval(() => {
          if (!isTourActive || currentStepIndex !== stepIndex) {
            clearInterval(highlightUpdateIntervalId);
            highlightUpdateIntervalId = null;
            return;
          }
          const step = TOUR_STEPS[currentStepIndex];
          if (step && step.target) {
            let targetElement = document.querySelector(step.target);
            if (step.id === 'search') {
              const searchContainer = document.querySelector('.search-container');
              if (searchContainer) {
                targetElement = searchContainer;
              }
            }
            if (targetElement && document.contains(targetElement)) {
              const targetRect = getElementRect(targetElement);
              if (targetRect && targetRect.width > 0 && targetRect.height > 0) {
                applyHighlightRect(targetRect, 10);
              }
            }
          }
        }, 200);
      } else {
        // Останавливаем периодическое обновление для других шагов
        if (highlightUpdateIntervalId !== null) {
          clearInterval(highlightUpdateIntervalId);
          highlightUpdateIntervalId = null;
        }
      }

      // Прокручиваем к элементу, если он не виден
      requestAnimationFrame(() => {
        // Проверяем, что элемент все еще существует перед прокруткой
        if (document.contains(element)) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
          // Обновляем позицию после прокрутки (используем двойной requestAnimationFrame для более быстрого обновления)
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              // Проверяем, что overlay и элемент все еще существуют
              if (!overlay || !document.body.contains(overlay)) {
                return;
              }
              if (!document.contains(element)) {
                return;
              }
              const updatedRect = getElementRect(element);
              if (updatedRect) {
                applyHighlightRect(updatedRect, padding);
              }
            });
          });
        }
      });
    };

    updateHighlight();
  }

  /**
   * Создает затемнение с вырезами для панели подробной информации и окна с описанием на шаге 13 (detail-panel)
   */
  function createDarkenedOverlayForDetailPanel() {
    if (!overlay) {
      createOverlay();
    }

    if (!overlay) return;

    const updateCutouts = () => {
      // Получаем позиции панели подробной информации
      const detailPanel = document.getElementById('detailPanel');
      const detailPanelRect = detailPanel && detailPanel.classList.contains('active')
        ? detailPanel.getBoundingClientRect()
        : null;

      // Получаем позиции окна с описанием шага (tooltip)
      const tooltipRect = tooltip ? tooltip.getBoundingClientRect() : null;

      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const padding = 10;

      // Создаем SVG mask для затемнения фона
      // В mask: белый = затемнение видно, черный = затемнение не видно (вырезы)
      let maskSvg = document.getElementById('onboarding-detail-panel-mask');
      if (!maskSvg) {
        maskSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        maskSvg.id = 'onboarding-detail-panel-mask';
        maskSvg.style.position = 'fixed';
        maskSvg.style.top = '0';
        maskSvg.style.left = '0';
        maskSvg.style.width = '0';
        maskSvg.style.height = '0';
        maskSvg.style.pointerEvents = 'none';
        document.body.appendChild(maskSvg);
      }

      // Обновляем размеры SVG
      maskSvg.setAttribute('width', viewportWidth.toString());
      maskSvg.setAttribute('height', viewportHeight.toString());
      maskSvg.setAttribute('viewBox', `0 0 ${viewportWidth} ${viewportHeight}`);

      // Создаем defs и mask
      let defs = maskSvg.querySelector('defs');
      if (!defs) {
        defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        maskSvg.appendChild(defs);
      }

      let mask = defs.querySelector('mask');
      if (!mask) {
        mask = document.createElementNS('http://www.w3.org/2000/svg', 'mask');
        mask.id = 'onboarding-detail-panel-mask-element';
        defs.appendChild(mask);
      }

      // Очищаем mask
      mask.innerHTML = '';

      // Создаем белый прямоугольник (затемнение видно везде)
      const whiteRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      whiteRect.setAttribute('x', '0');
      whiteRect.setAttribute('y', '0');
      whiteRect.setAttribute('width', viewportWidth.toString());
      whiteRect.setAttribute('height', viewportHeight.toString());
      whiteRect.setAttribute('fill', 'white');
      mask.appendChild(whiteRect);

      // Создаем черные прямоугольники для вырезов (затемнение не видно в этих областях)
      if (detailPanelRect && detailPanelRect.width > 0 && detailPanelRect.height > 0) {
        const blackRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        blackRect.setAttribute('x', (detailPanelRect.left - padding).toString());
        blackRect.setAttribute('y', (detailPanelRect.top - padding).toString());
        blackRect.setAttribute('width', (detailPanelRect.width + padding * 2).toString());
        blackRect.setAttribute('height', (detailPanelRect.height + padding * 2).toString());
        blackRect.setAttribute('fill', 'black');
        mask.appendChild(blackRect);
      }

      if (tooltipRect && tooltipRect.width > 0 && tooltipRect.height > 0) {
        const blackRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        blackRect.setAttribute('x', (tooltipRect.left - padding).toString());
        blackRect.setAttribute('y', (tooltipRect.top - padding).toString());
        blackRect.setAttribute('width', (tooltipRect.width + padding * 2).toString());
        blackRect.setAttribute('height', (tooltipRect.height + padding * 2).toString());
        blackRect.setAttribute('fill', 'black');
        mask.appendChild(blackRect);
      }

      // Применяем mask к overlay
      const maskUrl = `url(#onboarding-detail-panel-mask-element)`;
      overlay.style.mask = maskUrl;
      overlay.style.webkitMask = maskUrl;
      overlay.style.display = 'block';
      overlay.style.background = 'rgba(0, 0, 0, 0.7)';

      // Убираем стандартные стили подсветки
      overlay.style.setProperty('--highlight-top', '0px');
      overlay.style.setProperty('--highlight-left', '0px');
      overlay.style.setProperty('--highlight-width', '0px');
      overlay.style.setProperty('--highlight-height', '0px');
    };

    // Обновляем вырезы сразу и после позиционирования tooltip
    updateCutouts();
    // Используем requestAnimationFrame для более быстрого обновления
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        updateCutouts();
        // Устанавливаем периодическое обновление для отслеживания изменений позиций
        if (detailPanelUpdateIntervalId !== null) {
          clearInterval(detailPanelUpdateIntervalId);
          detailPanelUpdateIntervalId = null;
        }
        const stepIndex = currentStepIndex;
        detailPanelUpdateIntervalId = setInterval(() => {
          if (!isTourActive || currentStepIndex !== stepIndex) {
            clearInterval(detailPanelUpdateIntervalId);
            detailPanelUpdateIntervalId = null;
            return;
          }
          updateCutouts();
        }, 100);
      });
    });
  }

  /**
   * Создает затемнение с вырезами для сектора, названия сектора и tooltip на шаге 8
   */
  function createDarkenedOverlayWithCutouts() {
    if (!overlay) {
      createOverlay();
    }

    if (!overlay) return;

    const updateCutouts = () => {
      // Получаем позиции сектора
      const sector1 = document.querySelector('.quadrant-group.q1');
      const sectorRect = sector1 ? sector1.getBoundingClientRect() : null;

      // Получаем позиции названия сектора
      let sectorLabelRect = null;
      const quadrantLabels = document.getElementById('quadrantLabels');
      if (quadrantLabels) {
        const labelGroup = quadrantLabels.querySelector('.sector-label-group[data-quadrant="1"]');
        if (labelGroup) {
          sectorLabelRect = labelGroup.getBoundingClientRect();
        }
      }

      // Получаем позиции tooltip
      const tooltipRect = tooltip ? tooltip.getBoundingClientRect() : null;

      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const padding = 10;

      // Создаем SVG mask для затемнения фона (не сектора)
      // В mask: белый = затемнение видно, черный = затемнение не видно (вырезы)
      let maskSvg = document.getElementById('onboarding-quadrant-zoom-mask');
      if (!maskSvg) {
        maskSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        maskSvg.id = 'onboarding-quadrant-zoom-mask';
        maskSvg.style.position = 'fixed';
        maskSvg.style.top = '0';
        maskSvg.style.left = '0';
        maskSvg.style.width = '0';
        maskSvg.style.height = '0';
        maskSvg.style.pointerEvents = 'none';
        document.body.appendChild(maskSvg);
      }

      // Обновляем размеры SVG
      maskSvg.setAttribute('width', viewportWidth.toString());
      maskSvg.setAttribute('height', viewportHeight.toString());
      maskSvg.setAttribute('viewBox', `0 0 ${viewportWidth} ${viewportHeight}`);

      // Создаем defs и mask
      let defs = maskSvg.querySelector('defs');
      if (!defs) {
        defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        maskSvg.appendChild(defs);
      }

      let mask = defs.querySelector('mask');
      if (!mask) {
        mask = document.createElementNS('http://www.w3.org/2000/svg', 'mask');
        mask.id = 'onboarding-quadrant-zoom-mask-element';
        defs.appendChild(mask);
      }

      // Очищаем mask
      mask.innerHTML = '';

      // Создаем белый прямоугольник (затемнение видно везде)
      const whiteRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      whiteRect.setAttribute('x', '0');
      whiteRect.setAttribute('y', '0');
      whiteRect.setAttribute('width', viewportWidth.toString());
      whiteRect.setAttribute('height', viewportHeight.toString());
      whiteRect.setAttribute('fill', 'white');
      mask.appendChild(whiteRect);

      // Создаем черные прямоугольники для вырезов (затемнение не видно в этих областях)
      if (sectorRect && sectorRect.width > 0 && sectorRect.height > 0) {
        const blackRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        blackRect.setAttribute('x', (sectorRect.left - padding).toString());
        blackRect.setAttribute('y', (sectorRect.top - padding).toString());
        blackRect.setAttribute('width', (sectorRect.width + padding * 2).toString());
        blackRect.setAttribute('height', (sectorRect.height + padding * 2).toString());
        blackRect.setAttribute('fill', 'black');
        mask.appendChild(blackRect);
      }

      if (sectorLabelRect && sectorLabelRect.width > 0 && sectorLabelRect.height > 0) {
        const blackRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        blackRect.setAttribute('x', (sectorLabelRect.left - padding).toString());
        blackRect.setAttribute('y', (sectorLabelRect.top - padding).toString());
        blackRect.setAttribute('width', (sectorLabelRect.width + padding * 2).toString());
        blackRect.setAttribute('height', (sectorLabelRect.height + padding * 2).toString());
        blackRect.setAttribute('fill', 'black');
        mask.appendChild(blackRect);
      }

      if (tooltipRect && tooltipRect.width > 0 && tooltipRect.height > 0) {
        const blackRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        blackRect.setAttribute('x', (tooltipRect.left - padding).toString());
        blackRect.setAttribute('y', (tooltipRect.top - padding).toString());
        blackRect.setAttribute('width', (tooltipRect.width + padding * 2).toString());
        blackRect.setAttribute('height', (tooltipRect.height + padding * 2).toString());
        blackRect.setAttribute('fill', 'black');
        mask.appendChild(blackRect);
      }

      // Применяем mask к overlay
      const maskUrl = `url(#onboarding-quadrant-zoom-mask-element)`;
      overlay.style.mask = maskUrl;
      overlay.style.webkitMask = maskUrl;
      overlay.style.display = 'block';
      overlay.style.background = 'rgba(0, 0, 0, 0.7)';

      // Убираем стандартные стили подсветки
      overlay.style.setProperty('--highlight-top', '0px');
      overlay.style.setProperty('--highlight-left', '0px');
      overlay.style.setProperty('--highlight-width', '0px');
      overlay.style.setProperty('--highlight-height', '0px');

      // Убеждаемся, что сектор, название сектора и tooltip видны поверх затемнения
      if (sector1) {
        sector1.style.zIndex = '10002';
        sector1.style.position = 'relative';
      }

      // Убеждаемся, что название сектора видно поверх затемнения
      if (quadrantLabels) {
        const labelGroup = quadrantLabels.querySelector('.sector-label-group[data-quadrant="1"]');
        if (labelGroup) {
          labelGroup.style.zIndex = '10003';
          labelGroup.style.position = 'relative';
        }
      }

      // Tooltip уже имеет z-index: 10006 в CSS
    };

    // Обновляем вырезы сразу и после позиционирования tooltip
    updateCutouts();
    // Используем requestAnimationFrame для более быстрого обновления
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        updateCutouts();
      });
    });
  }

  /**
   * Позиционирует tooltip относительно элемента
   */
  function positionTooltip(element, position = 'bottom') {
    if (!tooltip) return;

    const tooltipRect = tooltip.getBoundingClientRect();
    let top, left;

    if (!element || position === 'center') {
      // Центрированное позиционирование
      top = window.innerHeight / 2 - tooltipRect.height / 2;
      left = window.innerWidth / 2 - tooltipRect.width / 2;
    } else {
      const rect = element.getBoundingClientRect();
      const spacing = 20;

      switch (position) {
        case 'top':
          top = rect.top - tooltipRect.height - spacing;
          left = rect.left + rect.width / 2 - tooltipRect.width / 2;
          break;
        case 'bottom':
          top = rect.bottom + spacing;
          left = rect.left + rect.width / 2 - tooltipRect.width / 2;
          break;
        case 'left':
          top = rect.top + rect.height / 2 - tooltipRect.height / 2;
          left = rect.left - tooltipRect.width - spacing;
          break;
        case 'right':
          top = rect.top + rect.height / 2 - tooltipRect.height / 2;
          left = rect.right + spacing;
          break;
        default:
          top = rect.bottom + spacing;
          left = rect.left + rect.width / 2 - tooltipRect.width / 2;
      }

      // Проверяем границы экрана
      if (top < 10) top = 10;
      if (left < 10) left = 10;
      if (top + tooltipRect.height > window.innerHeight - 10) {
        top = window.innerHeight - tooltipRect.height - 10;
      }
      if (left + tooltipRect.width > window.innerWidth - 10) {
        left = window.innerWidth - tooltipRect.width - 10;
      }
    }

    tooltip.style.top = `${top + window.scrollY}px`;
    tooltip.style.left = `${left + window.scrollX}px`;
  }

  /**
   * Получает видимые шаги (для подсчета общего количества)
   */
  function getVisibleSteps() {
    return TOUR_STEPS.filter((step) => isStepVisible(step));
  }

  /**
   * Получает индекс видимого шага по его порядковому номеру среди видимых
   */
  function getVisibleStepIndex(visibleIndex) {
    let visibleCount = 0;
    for (let i = 0; i < TOUR_STEPS.length; i++) {
      const step = TOUR_STEPS[i];
      if (isStepVisible(step)) {
        if (visibleCount === visibleIndex) {
          return i;
        }
        visibleCount++;
      }
    }
    return -1;
  }

  function getNextVisibleStepIndex(fromStepIndex) {
    for (let i = fromStepIndex + 1; i < TOUR_STEPS.length; i++) {
      if (isStepVisible(TOUR_STEPS[i])) {
        return i;
      }
    }
    return -1;
  }

  function getPreviousVisibleStepIndex(fromStepIndex) {
    for (let i = fromStepIndex - 1; i >= 0; i--) {
      if (isStepVisible(TOUR_STEPS[i])) {
        return i;
      }
    }
    return -1;
  }

  /**
   * Получает порядковый номер текущего шага среди видимых
   */
  function getCurrentVisibleStepNumber() {
    let visibleCount = 0;
    for (let i = 0; i <= currentStepIndex; i++) {
      const step = TOUR_STEPS[i];
      if (isStepVisible(step)) {
        visibleCount++;
      }
    }
    return visibleCount;
  }

  /**
   * Отображает шаг тура
   */
  function showStep(stepIndex) {
    if (!isTourActive) return;

    if (stepIndex < 0 || stepIndex >= TOUR_STEPS.length) {
      endTour();
      return;
    }

    const renderToken = ++activeStepRenderToken;
    resetStepArtifactsForTransition();

    const step = TOUR_STEPS[stepIndex];
    currentStepIndex = stepIndex;

    // Проверяем условие показа шага (роль + conditional).
    if (!isStepVisible(step)) {
      // Пропускаем шаг, если условие не выполнено
      showStep(stepIndex + 1);
      return;
    }

    // Выполняем beforeShow, если есть (перед проверкой элемента)
    if (step.beforeShow && typeof step.beforeShow === 'function') {
      step.beforeShow();
    }

    // Ждем появления элемента, если нужно
    if (step.waitForElement && step.target) {
      let attempts = 0;
      // Для prospectsModal уменьшаем количество попыток и интервал для более быстрого отклика
      const isProspectsModal = step.target === '#prospectsModal';
      const maxAttempts = isProspectsModal ? 20 : 30; // Максимум 1 секунда для модального окна (20 * 50ms)
      const checkInterval = isProspectsModal ? 30 : 50; // Проверяем каждые 30ms для модального окна, 50ms для других
      // Для prospectsModal добавляем минимальную начальную задержку, чтобы дать модальному окну время открыться
      const initialDelay = isProspectsModal ? 50 : 0; // 50ms задержка для модального окна (уменьшено с 150ms)

      const checkElement = () => {
        if (!isTourActive || renderToken !== activeStepRenderToken) {
          return;
        }

        attempts++;
        const element = document.querySelector(step.target);

        // Проверяем, что элемент существует и виден
        if (element) {
          // Для панели детальной информации проверяем, что она активна или видна
          if (step.target === '#detailPanel') {
            const isVisible = element.classList.contains('active') ||
                             element.style.display === 'block' ||
                             (element.style.display !== 'none' && element.offsetParent !== null);
            if (isVisible) {
              displayStep(step, renderToken);
              return;
            }
          } else if (step.target === '#prospectsModal') {
            // Для модального окна графика перспективных технологий проверяем, что оно открыто
            // Проверяем несколько условий: класс 'open', отсутствие 'hidden', display !== 'none', и видимость в DOM
            const hasOpenClass = element.classList.contains('open');
            const notHidden = !element.classList.contains('hidden');
            const ariaHidden = element.getAttribute('aria-hidden');
            const notAriaHidden = !ariaHidden || ariaHidden === 'false';
            const isDisplayed = element.style.display !== 'none' &&
                               (element.style.display === 'block' || element.offsetParent !== null);
            // Модальное окно видимо, если есть класс 'open' ИЛИ (не скрыто И отображается)
            const isVisible = hasOpenClass || (notHidden && notAriaHidden && isDisplayed);
            if (isVisible) {
              displayStep(step, renderToken);
              return;
            }
          } else if (step.target === '#exportPdfModal') {
            // Для модального окна экспорта проверяем, что оно открыто
            const isVisible = element.classList.contains('open') ||
                             (!element.classList.contains('hidden') &&
                              element.style.display !== 'none' &&
                              element.offsetParent !== null);
            if (isVisible) {
              displayStep(step, renderToken);
              return;
            }
          } else if (step.target === '#addTechPanel') {
            // Для модального окна добавления технологии проверяем, что оно открыто
            const isVisible = element.classList.contains('open') ||
                             (!element.classList.contains('hidden') &&
                              element.style.display !== 'none' &&
                              element.offsetParent !== null);
            if (isVisible) {
              displayStep(step, renderToken);
              return;
            }
          } else if (step.target === '#addBlockPanel') {
            // Для модального окна добавления функционального блока проверяем, что оно открыто
            const isVisible = element.classList.contains('open') ||
                             (!element.classList.contains('hidden') &&
                              element.style.display !== 'none' &&
                              element.offsetParent !== null);
            if (isVisible) {
              displayStep(step, renderToken);
              return;
            }
          } else {
            // Для других элементов просто проверяем существование и видимость
            if (element.offsetParent !== null || element.style.display !== 'none') {
              displayStep(step, renderToken);
              return;
            }
          }
        }

        if (attempts >= maxAttempts) {
          // Если элемент не появился, все равно показываем шаг
          if (Logger) Logger.warn(`Onboarding: элемент ${step.target} не найден или не виден после ${maxAttempts} попыток, показываем шаг без подсветки`);
          // Для панели детальной информации открываем её программно, если она не открыта
          if (step.target === '#detailPanel') {
            const detailPanel = document.getElementById('detailPanel');
            if (detailPanel) {
              detailPanel.classList.add('active');
              // Не устанавливаем display через inline стили - CSS управляет через класс .active
              // Только для тура временно увеличиваем z-index
              const originalZIndex = detailPanel.style.zIndex;
              detailPanel.style.zIndex = '10003';
              if (!detailPanel.dataset.originalZIndex) {
                detailPanel.dataset.originalZIndex = originalZIndex || '';
              }
            }
          }
          displayStep(step, renderToken);
          return;
        }

        setTimeout(checkElement, checkInterval);
      };
      // Для модального окна добавляем минимальную задержку перед первой проверкой
      // Используем requestAnimationFrame для более быстрого отклика
      if (initialDelay > 0) {
        // Для модального окна используем двойной requestAnimationFrame вместо setTimeout
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            checkElement();
          });
        });
      } else {
        checkElement();
      }
    } else {
      // Используем requestAnimationFrame для немедленного отображения без задержки
      requestAnimationFrame(() => {
        if (!isTourActive || renderToken !== activeStepRenderToken) {
          return;
        }
        displayStep(step, renderToken);
      });
    }
  }

  /**
   * Отображает шаг
   */
  function displayStep(step, renderToken = activeStepRenderToken) {
    if (!isTourActive || renderToken !== activeStepRenderToken) {
      return;
    }

    const currentStep = TOUR_STEPS[currentStepIndex];
    if (!currentStep || currentStep.id !== step.id) {
      return;
    }

    createOverlay();
    createTooltip();
    clearOverlayMasks();

    // Для шага report-button подсвечиваем кнопку "Отчеты" в боковой панели
    // Делаем это после создания overlay, чтобы кнопка была видна поверх затемнения
    if (step.id === 'report-button') {
      const reportIconBtn = document.getElementById('reportIconBtn');
      if (reportIconBtn) {
        reportIconBtn.classList.add('onboarding-highlight');
        // Добавляем класс к родительским контейнерам для правильного z-index
        const sidebarButtons = document.getElementById('sidebarButtons');
        const sidebarWrapper = document.querySelector('.sidebar-wrapper');
        if (sidebarButtons) {
          sidebarButtons.classList.add('onboarding-highlight-container');
        }
        if (sidebarWrapper) {
          sidebarWrapper.classList.add('onboarding-highlight-container');
        }
      }
    }

    // Для шагов add-technology и add-block подсвечиваем кнопку "Добавить" в боковой панели
    // Делаем это после создания overlay, чтобы кнопка была видна поверх затемнения
    if (step.id === 'add-technology' || step.id === 'add-block') {
      const addIconBtn = document.getElementById('addIconBtn');
      if (addIconBtn) {
        addIconBtn.classList.add('onboarding-highlight');
        // Добавляем класс к родительским контейнерам для правильного z-index
        const sidebarButtons = document.getElementById('sidebarButtons');
        const sidebarWrapper = document.querySelector('.sidebar-wrapper');
        if (sidebarButtons) {
          sidebarButtons.classList.add('onboarding-highlight-container');
        }
        if (sidebarWrapper) {
          sidebarWrapper.classList.add('onboarding-highlight-container');
        }
      }
    }

    const targetElement = step.target ? document.querySelector(step.target) : null;

    // Для шага search подсвечиваем .search-container, но tooltip позиционируем относительно #sidebar
    let highlightTarget = targetElement;
    if (step.id === 'search') {
      const searchContainer = document.querySelector('.search-container');
      if (searchContainer) {
        highlightTarget = searchContainer;
      }
    }

    // Подсвечиваем элемент (если target не null)
    // Для шага detail-panel target = null, но затемнение оставляем для лучшей видимости
    // Для шага quadrant-zoom подсвечиваем весь радар как на шаге 7
    if (step.target !== null) {
      highlightElement(highlightTarget, step.position);

      // Для шага priority-panel также подсвечиваем поле поиска внутри модального окна
      if (step.id === 'priority-panel') {
        // Используем задержку, чтобы модальное окно успело открыться
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            // Убеждаемся, что модальное окно видно поверх overlay
            const priorityPanel = document.getElementById('quadrantPriorityPanel');
            if (priorityPanel) {
              priorityPanel.style.zIndex = '10004';
              priorityPanel.style.position = 'fixed';
            }
            // Подсвечиваем поле поиска внутри модального окна
            const searchInput = document.getElementById('qpSearchInput');
            if (searchInput) {
              searchInput.classList.add('onboarding-highlight-input');
            }
          });
        });
      }
    } else {
      // Для шага detail-panel создаем затемнение с вырезами для панели подробной информации и окна с описанием
      if (step.id === 'detail-panel') {
        createDarkenedOverlayForDetailPanel();
      } else {
        // Если target = null, не показываем затемнение (как на шаге 4 - только подсветка элементов без затемнения)
        // Overlay не показываем вообще для шагов без целевого элемента
        if (overlay) {
          overlay.style.display = 'none';
        }
      }
    }

    // Заполняем tooltip
    const prevVisibleStepIndex = getPreviousVisibleStepIndex(currentStepIndex);
    const nextVisibleStepIndex = getNextVisibleStepIndex(currentStepIndex);
    const isLastVisibleStep = nextVisibleStepIndex === -1;

    tooltip.innerHTML = `
      <div class="onboarding-tooltip-header">
        <h3 class="onboarding-tooltip-title">${step.title}</h3>
        <button class="onboarding-tooltip-close" aria-label="Закрыть тур">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
      <div class="onboarding-tooltip-body">
        <p class="onboarding-tooltip-description">${step.description}</p>
      </div>
      <div class="onboarding-tooltip-footer">
        <div class="onboarding-tooltip-progress">
          Шаг ${getCurrentVisibleStepNumber()} из ${getVisibleSteps().length}
        </div>
        <div class="onboarding-tooltip-actions">
          ${prevVisibleStepIndex !== -1 ? '<button class="onboarding-btn onboarding-btn-secondary" data-action="prev">Назад</button>' : ''}
          ${step.showSkip ? '<button class="onboarding-btn onboarding-btn-secondary" data-action="skip">Пропустить</button>' : ''}
          <button class="onboarding-btn onboarding-btn-primary" data-action="next">
            ${isLastVisibleStep ? 'Завершить' : 'Далее'}
          </button>
        </div>
      </div>
    `;

    // Позиционируем tooltip и показываем его немедленно
    positionTooltip(targetElement, step.position);
    // Используем requestAnimationFrame для плавного появления
    requestAnimationFrame(() => {
      tooltip.classList.add('visible');
    });

    // Добавляем обработчики событий
    const closeBtn = tooltip.querySelector('.onboarding-tooltip-close');
    const prevBtn = tooltip.querySelector('[data-action="prev"]');
    const nextBtn = tooltip.querySelector('[data-action="next"]');
    const skipBtn = tooltip.querySelector('[data-action="skip"]');

    if (closeBtn) {
      closeBtn.onclick = () => endTour();
    }
    if (prevBtn) {
      prevBtn.onclick = () => {
        // Выполняем afterHide для текущего шага
        const activeStep = TOUR_STEPS[currentStepIndex];
        if (activeStep && activeStep.afterHide && typeof activeStep.afterHide === 'function') {
          activeStep.afterHide(currentStepIndex);
        }

        const prevIndex = getPreviousVisibleStepIndex(currentStepIndex);
        if (prevIndex !== -1) {
          saveProgress(prevIndex);
          showStep(prevIndex);
          return;
        }
      };
    }
    if (nextBtn) {
      nextBtn.onclick = () => {
        // Выполняем afterHide для текущего шага
        const activeStep = TOUR_STEPS[currentStepIndex];
        if (activeStep && activeStep.afterHide && typeof activeStep.afterHide === 'function') {
          activeStep.afterHide(currentStepIndex);
        }

        const nextIndex = getNextVisibleStepIndex(currentStepIndex);
        if (nextIndex === -1) {
          completeTour();
          endTour();
        } else {
          saveProgress(nextIndex);
          showStep(nextIndex);
        }
      };
    }
    if (skipBtn) {
      skipBtn.onclick = () => {
        // Выполняем afterHide для текущего шага
        const currentStep = TOUR_STEPS[currentStepIndex];
        if (currentStep && currentStep.afterHide && typeof currentStep.afterHide === 'function') {
          currentStep.afterHide(currentStepIndex);
        }

        // Скрываем панель при пропуске
        const sidebarWrapper = document.querySelector('.sidebar-wrapper');
        if (sidebarWrapper && (currentStep.id === 'search' || currentStep.id === 'filters')) {
          sidebarWrapper.classList.remove('expanded');
          sidebarWrapper.classList.add('collapsed');
        }

        completeTour();
        endTour();
      };
    }

    // Сохраняем прогресс
    saveProgress(currentStepIndex);

    // Устанавливаем фокус на tooltip для доступности
    tooltip.focus();
  }

  /**
   * Обновляет позицию подсветки при изменении размера окна
   */
  function updateHighlightPosition() {
    if (!isTourActive || !overlay) return;

    const step = TOUR_STEPS[currentStepIndex];
    if (!step || !step.target) return;

    const element = document.querySelector(step.target);
    if (element) {
      highlightElement(element, step.position);
    }
  }

  /**
   * Запускает тур
   */
  function startTour(resume = false) {
    if (isTourActive) return;

    isTourActive = true;
    const startIndex = resume ? loadProgress() : 0;
    showStep(startIndex);

    // Блокируем прокрутку фона
    document.body.style.overflow = 'hidden';

    // Добавляем обработчик изменения размера окна
    window.addEventListener('resize', updateHighlightPosition);
    window.addEventListener('scroll', updateHighlightPosition);
  }

  /**
   * Завершает тур
   */
  function endTour() {
    isTourActive = false;
    activeStepRenderToken++;

    // Выполняем afterHide для текущего шага, если есть
    const currentStep = TOUR_STEPS[currentStepIndex];
    if (currentStep && currentStep.afterHide && typeof currentStep.afterHide === 'function') {
      currentStep.afterHide(currentStepIndex);
    }

    // Убеждаемся, что панель скрыта при завершении тура
    const sidebarWrapper = document.querySelector('.sidebar-wrapper');
    if (sidebarWrapper && currentStep && (currentStep.id === 'search' || currentStep.id === 'filters')) {
      sidebarWrapper.classList.remove('expanded');
      sidebarWrapper.classList.add('collapsed');
    }

    // Сбрасываем зум при завершении тура
    if (typeof window.closeQuadrantPriorityPanel === 'function') {
      window.closeQuadrantPriorityPanel();
    }
    if (typeof window.unzoom === 'function') {
      setTimeout(() => {
        window.unzoom();
      }, 200);
    }

    // Очищаем inline стили, установленные туром для detailPanel
    const detailPanel = document.getElementById('detailPanel');
    if (detailPanel) {
      // Восстанавливаем оригинальный z-index, если он был сохранен
      if (detailPanel.dataset.originalZIndex !== undefined) {
        detailPanel.style.zIndex = detailPanel.dataset.originalZIndex;
        delete detailPanel.dataset.originalZIndex;
      } else {
        detailPanel.style.zIndex = '';
      }
      // Очищаем position, если он был установлен туром
      detailPanel.style.position = '';
      // Очищаем display, если он был установлен туром (но только если панель не активна)
      if (!detailPanel.classList.contains('active')) {
        detailPanel.style.display = '';
      }
    }

    // Удаляем обработчики событий
    window.removeEventListener('resize', updateHighlightPosition);
    window.removeEventListener('scroll', updateHighlightPosition);

    // Останавливаем все интервалы обновления и очищаем временные подсветки.
    resetStepArtifactsForTransition();

    removeOverlay();
    document.body.style.overflow = '';

    // Если тур был завершен полностью, отмечаем его
    if (currentStepIndex === TOUR_STEPS.length - 1) {
      completeTour();
    }
  }

  /**
   * Сбрасывает прогресс тура (для тестирования)
   */
  function resetTour() {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_PROGRESS_KEY);
    localStorage.removeItem(STORAGE_VERSION_KEY);
  }

  function getMasterFlowStepIds() {
    return MASTER_FLOW_STEP_IDS.slice();
  }

  function getRoleProfileName(role) {
    return resolveRoleProfile(role);
  }

  function getVisibleStepIdsForRole(role, options = {}) {
    return TOUR_STEPS
      .filter((step) => isStepVisible(step, role, options))
      .map((step) => step.id);
  }

  /**
   * Инициализирует модуль
   */
  function init() {
    // Проверяем, нужно ли запускать тур автоматически
    if (!hasCompletedTour()) {
      // Не запускаем автоматически, пользователь может запустить вручную
      // или через кнопку помощи
    }
  }

  // Экспорт модуля
  const OnboardingTour = {
    init,
    startTour,
    endTour,
    resetTour,
    hasCompletedTour,
    completeTour,
    getMasterFlowStepIds,
    getRoleProfileName,
    getRoleProfileStepIds,
    getVisibleStepIdsForRole
  };

  if (typeof window !== 'undefined') {
    window.OnboardingTour = OnboardingTour;
  }

  export default OnboardingTour;
