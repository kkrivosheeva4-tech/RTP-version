// Модуль управления вендорами и файлами для форм
// Используется в формах добавления и редактирования технологий

(function() {
  'use strict';

  // Хранение списков вендоров и интеграторов в localStorage (для новых значений)
  const VENDORS_STORAGE_KEY = 'rmk_vendors_list';
  const INTEGRATORS_STORAGE_KEY = 'rmk_integrators_list';

  // Кэш для загруженных списков
  let vendorsListCache = null;
  let integratorsListCache = null;

  // Загрузка списка вендоров из JSON и localStorage (объединение)
  async function loadVendorsList() {
    if (vendorsListCache) {
      if (window.Logger) window.Logger.debug('Используем кэш списка вендоров', vendorsListCache.length);
      return vendorsListCache;
    }

    let jsonVendors = [];
    let localVendors = [];

    // Загружаем из JSON
    try {
      const response = await fetch('/src/data/ru/vendors.json');
      if (response.ok) {
        jsonVendors = await response.json();
        if (!Array.isArray(jsonVendors)) {
          if (window.Logger) window.Logger.warn('Данные вендоров из JSON не являются массивом, преобразуем', jsonVendors);
          jsonVendors = Array.isArray(jsonVendors) ? jsonVendors : [];
        }
        if (window.Logger) window.Logger.debug('Загружен список вендоров из JSON', jsonVendors.length);
      }
    } catch (e) {
      if (window.Logger) window.Logger.warn('Не удалось загрузить список вендоров из JSON', e);
    }

    // Загружаем из localStorage
    try {
      const stored = localStorage.getItem(VENDORS_STORAGE_KEY);
      if (stored) {
        localVendors = JSON.parse(stored);
        if (!Array.isArray(localVendors)) {
          localVendors = [];
        }
        if (window.Logger && localVendors.length > 0) {
          window.Logger.debug('Загружен список вендоров из localStorage', localVendors.length);
        }
      }
    } catch (e) {
      if (window.Logger) window.Logger.warn('Ошибка при чтении вендоров из localStorage', e);
    }

    // Объединяем списки: сначала из JSON, потом из localStorage (уникальные значения)
    const combined = [...jsonVendors];
    localVendors.forEach(vendor => {
      const vendorStr = String(vendor).trim();
      if (vendorStr && !combined.includes(vendorStr)) {
        combined.push(vendorStr);
      }
    });

    vendorsListCache = combined;
    if (window.Logger) {
      window.Logger.debug('Объединенный список вендоров', {
        json: jsonVendors.length,
        local: localVendors.length,
        total: combined.length
      });
    }

    return vendorsListCache;
  }

  // Загрузка списка интеграторов из JSON и localStorage (объединение)
  async function loadIntegratorsList() {
    if (integratorsListCache) return integratorsListCache;

    let jsonIntegrators = [];
    let localIntegrators = [];

    // Загружаем из JSON
    try {
      const response = await fetch('/src/data/ru/integrators.json');
      if (response.ok) {
        jsonIntegrators = await response.json();
        if (!Array.isArray(jsonIntegrators)) {
          jsonIntegrators = Array.isArray(jsonIntegrators) ? jsonIntegrators : [];
        }
        if (window.Logger) window.Logger.debug('Загружен список интеграторов из JSON', jsonIntegrators.length);
      }
    } catch (e) {
      if (window.Logger) window.Logger.warn('Не удалось загрузить список интеграторов из JSON', e);
    }

    // Загружаем из localStorage
    try {
      const stored = localStorage.getItem(INTEGRATORS_STORAGE_KEY);
      if (stored) {
        localIntegrators = JSON.parse(stored);
        if (!Array.isArray(localIntegrators)) {
          localIntegrators = [];
        }
        if (window.Logger && localIntegrators.length > 0) {
          window.Logger.debug('Загружен список интеграторов из localStorage', localIntegrators.length);
        }
      }
    } catch (e) {
      if (window.Logger) window.Logger.warn('Ошибка при чтении интеграторов из localStorage', e);
    }

    // Объединяем списки: сначала из JSON, потом из localStorage (уникальные значения)
    const combined = [...jsonIntegrators];
    localIntegrators.forEach(integrator => {
      const integratorStr = String(integrator).trim();
      if (integratorStr && !combined.includes(integratorStr)) {
        combined.push(integratorStr);
      }
    });

    integratorsListCache = combined;
    if (window.Logger) {
      window.Logger.debug('Объединенный список интеграторов', {
        json: jsonIntegrators.length,
        local: localIntegrators.length,
        total: combined.length
      });
    }

    return integratorsListCache;
  }

  // Получение списка вендоров (синхронная версия для обратной совместимости)
  function getVendorsList() {
    return vendorsListCache || [];
  }

  // Сохранение нового вендора в localStorage
  function saveVendorsList(vendors) {
    try {
      // Получаем текущий список из localStorage
      let existingVendors = [];
      try {
        const stored = localStorage.getItem(VENDORS_STORAGE_KEY);
        if (stored) {
          existingVendors = JSON.parse(stored);
          if (!Array.isArray(existingVendors)) {
            existingVendors = [];
          }
        }
      } catch (e) {
        existingVendors = [];
      }

      // Объединяем существующие и новые вендоры (уникальные значения)
      const combined = [...existingVendors];
      vendors.forEach(vendor => {
        const vendorStr = String(vendor).trim();
        if (vendorStr && !combined.includes(vendorStr)) {
          combined.push(vendorStr);
        }
      });

      // Сохраняем объединенный список в localStorage
      localStorage.setItem(VENDORS_STORAGE_KEY, JSON.stringify(combined));

      // Обновляем кэш
      vendorsListCache = vendors;

      if (window.Logger) {
        window.Logger.debug('Сохранен список вендоров в localStorage', {
          existing: existingVendors.length,
          new: vendors.length,
          total: combined.length
        });
      }
    } catch (e) {
      if (window.Logger) window.Logger.warn('Не удалось сохранить список вендоров', e);
    }
  }

  // Получение списка интеграторов (синхронная версия для обратной совместимости)
  function getIntegratorsList() {
    return integratorsListCache || [];
  }

  // Сохранение нового интегратора в localStorage
  function saveIntegratorsList(integrators) {
    try {
      // Получаем текущий список из localStorage
      let existingIntegrators = [];
      try {
        const stored = localStorage.getItem(INTEGRATORS_STORAGE_KEY);
        if (stored) {
          existingIntegrators = JSON.parse(stored);
          if (!Array.isArray(existingIntegrators)) {
            existingIntegrators = [];
          }
        }
      } catch (e) {
        existingIntegrators = [];
      }

      // Объединяем существующие и новые интеграторы (уникальные значения)
      const combined = [...existingIntegrators];
      integrators.forEach(integrator => {
        const integratorStr = String(integrator).trim();
        if (integratorStr && !combined.includes(integratorStr)) {
          combined.push(integratorStr);
        }
      });

      // Сохраняем объединенный список в localStorage
      localStorage.setItem(INTEGRATORS_STORAGE_KEY, JSON.stringify(combined));

      // Обновляем кэш
      integratorsListCache = integrators;

      if (window.Logger) {
        window.Logger.debug('Сохранен список интеграторов в localStorage', {
          existing: existingIntegrators.length,
          new: integrators.length,
          total: combined.length
        });
      }
    } catch (e) {
      if (window.Logger) window.Logger.warn('Не удалось сохранить список интеграторов', e);
    }
  }

  // Создание элемента вендора
  async function createVendorElement(vendor, containerId, isEdit = false) {
    try {
      const container = document.getElementById(containerId);
      if (!container) {
        if (window.Logger) window.Logger.warn('Контейнер не найден при создании элемента вендора:', containerId);
        return null;
      }

    const vendorDiv = document.createElement('div');
    vendorDiv.className = 'vendor-item';
    vendorDiv.dataset.vendorId = vendor.id || Date.now();

    // Убеждаемся, что элемент виден
    vendorDiv.style.display = '';
    vendorDiv.style.visibility = 'visible';
    vendorDiv.style.opacity = '1';

    const vendorName = vendor.name || '';
    const integrators = vendor.integrators || [];
    const vendorFieldId = `vendor-${vendorDiv.dataset.vendorId}`;

    // Загружаем список вендоров
    const vendorsList = await loadVendorsList();
    if (!vendorsList || !Array.isArray(vendorsList)) {
      if (window.Logger) window.Logger.warn('Список вендоров не является массивом', vendorsList);
    }
    // Убеждаемся, что каждый элемент - строка
    const vendorsOptions = vendorsList
      .filter(v => v != null && String(v).trim() !== '')
      .map(v => `<li data-value="${String(v)}">${String(v)}</li>`)
      .join('');

    if (window.Logger && vendorsList.length > 0) {
      window.Logger.debug('Создано опций вендоров для селекта:', vendorsList.length);
    }

    vendorDiv.innerHTML = `
      <div class="vendor-header">
        <div class="custom-select-modal vendor-select" data-field="${vendorFieldId}" tabindex="0">
          <div class="select-trigger">
            <span class="selected-text">${vendorName || 'Выберите вендора'}</span>
            <svg class="arrow" width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 5L6 8L9 5" stroke="#666" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <ul class="select-options">
            <li class="add-new-vendor-option">
              <input type="text" class="new-vendor-input" placeholder="Введите название нового вендора" />
              <button type="button" class="add-new-vendor-btn">Добавить</button>
            </li>
            ${vendorsOptions}
          </ul>
        </div>
        <input type="hidden" id="${vendorFieldId}" class="vendor-name-input" value="${vendorName}" />
        <button type="button" class="remove-vendor-btn" aria-label="Удалить вендора">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
      <div class="vendor-integrators">
        <div>Интеграторы:</div>
        <div class="integrators-list"></div>
        <button type="button" class="add-integrator-btn btn-secondary btn-with-icon">
          <svg class="btn-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M8 3V13M3 8H13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span>Добавить интегратора</span>
        </button>
      </div>
    `;

      // Обработчик изменения значения селекта вендора
      const vendorSelect = vendorDiv.querySelector('.vendor-select');
      const vendorHiddenInput = document.getElementById(vendorFieldId);
      const vendorSelectTrigger = vendorDiv.querySelector('.select-trigger');
      const vendorIntegratorsSection = vendorDiv.querySelector('.vendor-integrators');

      // Функция для показа/скрытия секции интеграторов
      const toggleIntegratorsSection = (show) => {
        if (vendorIntegratorsSection) {
          if (show) {
            vendorIntegratorsSection.style.display = '';
            vendorIntegratorsSection.setAttribute('aria-hidden', 'false');
            // Убеждаемся, что секция видима
            if (window.Logger) {
              window.Logger.debug('Показываем секцию интеграторов для вендора');
            }
          } else {
            vendorIntegratorsSection.style.display = 'none';
            vendorIntegratorsSection.setAttribute('aria-hidden', 'true');
          }
        }
      };

      // Показываем/скрываем секцию интеграторов в зависимости от наличия вендора
      toggleIntegratorsSection(!!vendorName);

      // Функция для обновления UI при изменении вендора
      const updateVendorUI = () => {
        // Получаем значение из скрытого поля или из селекта
        let value = '';
        if (vendorHiddenInput) {
          value = vendorHiddenInput.value.trim();
        }
        // Если значение пустое, пробуем получить из селекта
        if (!value && vendorSelect) {
          const selectedOption = vendorSelect.querySelector('.select-options li.selected');
          if (selectedOption) {
            value = selectedOption.dataset.value || selectedOption.textContent.trim();
          }
        }
        // Также пробуем получить из data-value селекта
        if (!value && vendorSelect) {
          value = vendorSelect.getAttribute('data-value') || '';
        }
        // Также пробуем получить из текста триггера
        if (!value && vendorSelectTrigger) {
          const triggerText = vendorSelectTrigger.querySelector('.selected-text')?.textContent?.trim();
          if (triggerText && triggerText !== 'Выберите вендора') {
            value = triggerText;
          }
        }

        if (vendorSelectTrigger) {
          vendorSelectTrigger.querySelector('.selected-text').textContent = value || 'Выберите вендора';
        }

        // Показываем секцию интеграторов только если вендор выбран
        const hasVendor = !!value && value !== 'Выберите вендора' && value !== '';
        toggleIntegratorsSection(hasVendor);

        if (window.Logger && hasVendor) {
          window.Logger.debug('Вендор выбран:', value, 'Показываем интеграторов');
        } else if (window.Logger && !hasVendor) {
          window.Logger.debug('Вендор не выбран, скрываем интеграторов');
        }

        updateVendorsHiddenInput(containerId, isEdit);
      };

      // Дополнительный обработчик для отслеживания изменений через setCustomSelectValue
      // Используем дополнительный MutationObserver для отслеживания изменений value
      if (vendorHiddenInput) {
        // Уже есть observer выше, но добавим еще один для надежности
        const valueObserver = new MutationObserver(() => {
          updateVendorUI();
        });
        valueObserver.observe(vendorHiddenInput, {
          attributes: true,
          attributeFilter: ['value']
        });
      }

        // Слушаем изменения скрытого поля
        if (vendorHiddenInput) {
          // Обработчик события change (триггерится select-events.js)
          vendorHiddenInput.addEventListener('change', () => {
            // Небольшая задержка для гарантии, что значение обновлено
            setTimeout(() => {
              updateVendorUI();
              // Дополнительная проверка: если значение есть, но секция скрыта - показываем
              const currentValue = vendorHiddenInput.value.trim();
              if (currentValue && vendorIntegratorsSection) {
                const isHidden = vendorIntegratorsSection.style.display === 'none' ||
                                vendorIntegratorsSection.getAttribute('aria-hidden') === 'true';
                if (isHidden) {
                  toggleIntegratorsSection(true);
                }
              }
            }, 10);
          });

          // Также слушаем события input для надежности
          vendorHiddenInput.addEventListener('input', () => {
            setTimeout(() => {
              updateVendorUI();
              // Дополнительная проверка: если значение есть, но секция скрыта - показываем
              const currentValue = vendorHiddenInput.value.trim();
              if (currentValue && vendorIntegratorsSection) {
                const isHidden = vendorIntegratorsSection.style.display === 'none' ||
                                vendorIntegratorsSection.getAttribute('aria-hidden') === 'true';
                if (isHidden) {
                  toggleIntegratorsSection(true);
                }
              }
            }, 10);
          });

          // MutationObserver для отслеживания программных изменений
          const observer = new MutationObserver(() => {
            setTimeout(() => {
              updateVendorUI();
            }, 10);
          });
          observer.observe(vendorHiddenInput, { attributes: true, attributeFilter: ['value'] });

        // Отслеживаем изменения состояния селекта (открытие/закрытие) для обновления UI
        const selectStateObserver = new MutationObserver((mutations) => {
          mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
              // Селект изменил состояние (открыт/закрыт)
              const isOpen = vendorSelect.classList.contains('open');
              if (!isOpen) {
                // Селект закрыт - проверяем значение и обновляем UI
                // Используем requestAnimationFrame для гарантии обновления после всех изменений DOM
                requestAnimationFrame(() => {
                  setTimeout(() => {
                    updateVendorUI();
                    // Дополнительная проверка: если значение есть, но секция скрыта - показываем
                    const currentValue = vendorHiddenInput ? vendorHiddenInput.value.trim() : '';
                    if (currentValue && vendorIntegratorsSection) {
                      const isHidden = vendorIntegratorsSection.style.display === 'none' ||
                                      vendorIntegratorsSection.getAttribute('aria-hidden') === 'true';
                      if (isHidden) {
                        toggleIntegratorsSection(true);
                      }
                    }
                  }, 50);
                });
              }
            }
          });
        });

        // Наблюдаем за изменениями класса селекта
        if (vendorSelect) {
          selectStateObserver.observe(vendorSelect, {
            attributes: true,
            attributeFilter: ['class']
          });
        }

        // Также слушаем изменения через делегирование событий на document
        // Это нужно для случаев, когда select-events.js обновляет значение
        const changeHandler = (e) => {
          if (e.target === vendorHiddenInput) {
            // Используем requestAnimationFrame для гарантии обновления после всех изменений DOM
            requestAnimationFrame(() => {
              setTimeout(() => {
                updateVendorUI();
              }, 10);
            });
          }
        };
        document.addEventListener('change', changeHandler, true);

        // Дополнительный обработчик для отслеживания изменений через setCustomSelectValue
        // Используем MutationObserver для отслеживания изменений в DOM
        const selectObserver = new MutationObserver(() => {
          const currentValue = vendorHiddenInput ? vendorHiddenInput.value.trim() : '';
          if (currentValue) {
            updateVendorUI();
          }
        });

        // Наблюдаем за изменениями в селекте
        if (vendorSelect) {
          selectObserver.observe(vendorSelect, {
            attributes: true,
            attributeFilter: ['class', 'data-value'],
            childList: true,
            subtree: true
          });
        }

        // Сохраняем обработчики для возможной очистки
        vendorDiv._changeHandler = changeHandler;
        vendorDiv._selectStateObserver = selectStateObserver;

        // Проверяем начальное значение
        if (vendorHiddenInput.value) {
          updateVendorUI();
        }

        // Дополнительная проверка через небольшую задержку после создания элемента
        setTimeout(() => {
          updateVendorUI();
        }, 200);

        // Обработчик добавления нового вендора из выпадающего списка
        const addNewVendorBtn = vendorDiv.querySelector('.add-new-vendor-btn');
        const newVendorInput = vendorDiv.querySelector('.new-vendor-input');

        if (addNewVendorBtn && newVendorInput) {
            const addNewVendor = async () => {
            const newVendorName = newVendorInput.value.trim();
            if (!newVendorName) return;

            // Закрываем селект сразу после начала обработки и сбрасываем inline стили
            vendorSelect.classList.remove('open');
            const options = vendorSelect.querySelector('.select-options');
            if (options) {
              options.style.removeProperty('display');
              options.style.removeProperty('visibility');
              options.style.removeProperty('opacity');
              options.style.removeProperty('pointer-events');
              options.style.removeProperty('z-index');
            }

            // Проверяем, нет ли уже такого вендора
            const currentVendors = await loadVendorsList();
            if (currentVendors.includes(newVendorName)) {
              // Если вендор уже существует, просто выбираем его
              if (typeof window.setCustomSelectValue === 'function') {
                window.setCustomSelectValue(vendorFieldId, newVendorName);
              } else {
                vendorHiddenInput.value = newVendorName;
                vendorHiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
              }
              newVendorInput.value = '';
              toggleIntegratorsSection(true);
              updateVendorUI();
              updateVendorsHiddenInput(containerId, isEdit);
              return;
            }

            // Добавляем в список вендоров
            if (!currentVendors.includes(newVendorName)) {
              currentVendors.push(newVendorName);
            }

            // Сохраняем новый вендор в localStorage
            try {
              // Получаем текущий список из localStorage
              let localVendors = [];
              try {
                const stored = localStorage.getItem(VENDORS_STORAGE_KEY);
                if (stored) {
                  localVendors = JSON.parse(stored);
                  if (!Array.isArray(localVendors)) {
                    localVendors = [];
                  }
                }
              } catch (e) {
                localVendors = [];
              }

              // Добавляем новый вендор, если его еще нет
              if (!localVendors.includes(newVendorName)) {
                localVendors.push(newVendorName);
                localStorage.setItem(VENDORS_STORAGE_KEY, JSON.stringify(localVendors));
                if (window.Logger) {
                  window.Logger.debug('Сохранен новый вендор в localStorage:', newVendorName);
                }
              }
            } catch (e) {
              if (window.Logger) window.Logger.warn('Не удалось сохранить вендора в localStorage', e);
            }

            // Обновляем кэш - объединяем текущий список с новым вендором
            vendorsListCache = currentVendors;

            // Закрываем селект сразу после сохранения (если еще не закрыт) и сбрасываем inline стили
            vendorSelect.classList.remove('open');
            const optionsEl = vendorSelect.querySelector('.select-options');
            if (optionsEl) {
              optionsEl.style.removeProperty('display');
              optionsEl.style.removeProperty('visibility');
              optionsEl.style.removeProperty('opacity');
              optionsEl.style.removeProperty('pointer-events');
              optionsEl.style.removeProperty('z-index');
            }
            newVendorInput.value = '';

            // Обновляем все селекты вендоров на странице - добавляем новую опцию
            document.querySelectorAll('.vendor-select').forEach(select => {
              const optionsList = select.querySelector('.select-options');
              if (optionsList) {
                // Проверяем, нет ли уже такой опции
                const existingOption = Array.from(optionsList.querySelectorAll('li')).find(
                  li => li.dataset.value === newVendorName && !li.classList.contains('add-new-vendor-option')
                );
                if (!existingOption) {
                  const newOption = document.createElement('li');
                  newOption.dataset.value = newVendorName;
                  newOption.textContent = newVendorName;
                  newOption.style.cursor = 'pointer';
                  newOption.style.padding = '8px 12px';

                  // Вставляем после опции добавления нового (опция добавления должна быть первой)
                  const addNewOption = optionsList.querySelector('.add-new-vendor-option');
                  if (addNewOption && addNewOption.nextSibling) {
                    optionsList.insertBefore(newOption, addNewOption.nextSibling);
                  } else if (addNewOption) {
                    // Если опция добавления последняя, добавляем после неё
                    optionsList.appendChild(newOption);
                  } else {
                    // Если опции добавления нет, добавляем в конец
                    optionsList.appendChild(newOption);
                  }
                }
              }
            });

            // Устанавливаем значение используя setCustomSelectValue для правильного обновления UI
            // Используем requestAnimationFrame и небольшую задержку, чтобы убедиться, что опция добавлена в DOM
            requestAnimationFrame(() => {
              setTimeout(() => {
                // Проверяем, что опция действительно добавлена в текущий селект
                const optionsList = vendorSelect.querySelector('.select-options');
                const newOption = optionsList ? optionsList.querySelector(`li[data-value="${newVendorName}"]`) : null;

                if (!newOption) {
                  // Если опция еще не добавлена, добавляем её
                  if (optionsList) {
                    const addNewOption = optionsList.querySelector('.add-new-vendor-option');
                    const createdOption = document.createElement('li');
                    createdOption.dataset.value = newVendorName;
                    createdOption.textContent = newVendorName;
                    createdOption.style.cursor = 'pointer';
                    createdOption.style.padding = '8px 12px';

                    // Вставляем после опции добавления нового (опция добавления должна быть первой)
                    if (addNewOption && addNewOption.nextSibling) {
                      optionsList.insertBefore(createdOption, addNewOption.nextSibling);
                    } else if (addNewOption) {
                      // Если опция добавления последняя, добавляем после неё
                      optionsList.appendChild(createdOption);
                    } else {
                      // Если опции добавления нет, добавляем в конец
                      optionsList.appendChild(createdOption);
                    }
                  }
                }

                // Устанавливаем значение
                if (typeof window.setCustomSelectValue === 'function') {
                  window.setCustomSelectValue(vendorFieldId, newVendorName);
                } else {
                  // Fallback на ручную установку
                  vendorHiddenInput.value = newVendorName;
                  vendorHiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
                  vendorHiddenInput.dispatchEvent(new Event('input', { bubbles: true }));

                  if (vendorSelectTrigger) {
                    vendorSelectTrigger.querySelector('.selected-text').textContent = newVendorName;
                  }

                  // Выделяем выбранную опцию
                  if (optionsList) {
                    optionsList.querySelectorAll('li').forEach(li => {
                      li.classList.remove('selected');
                      if (li.dataset.value === newVendorName) {
                        li.classList.add('selected');
                      }
                    });
                  }
                }

                // Обновляем UI
                updateVendorUI();
                updateVendorsHiddenInput(containerId, isEdit);
              }, 50);
            });

            // Показываем секцию интеграторов немедленно
            toggleIntegratorsSection(true);
          };

          // Используем делегирование событий на уровне контейнера для надежности
          const handleAddVendorClick = (e) => {
            // Проверяем, что клик был именно по кнопке добавления или внутри неё
            const clickedBtn = e.target.closest('.add-new-vendor-btn');
            if (clickedBtn === addNewVendorBtn || e.target === addNewVendorBtn) {
              e.stopPropagation();
              e.stopImmediatePropagation();
              e.preventDefault();
              if (window.Logger) {
                window.Logger.debug('Клик по кнопке добавления вендора');
              }
              addNewVendor();
              return false;
            }
          };

          const handleAddVendorKeypress = (e) => {
            // Проверяем, что событие было в поле ввода
            if ((e.target === newVendorInput || e.target.classList.contains('new-vendor-input')) && e.key === 'Enter') {
              e.stopPropagation();
              e.stopImmediatePropagation();
              e.preventDefault();
              if (window.Logger) {
                window.Logger.debug('Enter в поле ввода вендора');
              }
              addNewVendor();
              return false;
            }
          };

          // Добавляем обработчики с capture phase для раннего перехвата (до других обработчиков)
          addNewVendorBtn.addEventListener('click', handleAddVendorClick, true);
          newVendorInput.addEventListener('keypress', handleAddVendorKeypress, true);
          newVendorInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
              handleAddVendorKeypress(e);
            }
          }, true);

          // Также добавляем обработчики в bubble phase для надежности
          addNewVendorBtn.addEventListener('click', handleAddVendorClick, false);
          newVendorInput.addEventListener('keypress', handleAddVendorKeypress, false);
          newVendorInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
              handleAddVendorKeypress(e);
            }
          }, false);
        }

      }

    // Добавляем интеграторов (только если вендор уже выбран)
    // Теперь создаем один элемент интегратора с множественным выбором для всех интеграторов вендора
    const integratorsList = vendorDiv.querySelector('.integrators-list');
    if (vendorName && integratorsList && integrators.length > 0) {
      // Собираем все имена интеграторов в массив
      const integratorNames = integrators.map(int => int.name || int).filter(name => name);

      if (integratorNames.length > 0) {
        // Создаем один элемент интегратора с множественным выбором
        // Используем первый интегратор как основу, но передаем массив имен
        const integratorData = {
          id: integrators[0].id || Date.now(),
          name: JSON.stringify(integratorNames) // Передаем массив как JSON строку
        };
        const integratorEl = await createIntegratorElement(integratorData, vendorDiv.dataset.vendorId);
        if (integratorEl) {
          integratorsList.appendChild(integratorEl);
        }
      }
    }

    // Если вендор уже выбран при создании, показываем секцию интеграторов
    if (vendorName) {
      const vendorIntegratorsSection = vendorDiv.querySelector('.vendor-integrators');
      if (vendorIntegratorsSection) {
        vendorIntegratorsSection.style.display = '';
        vendorIntegratorsSection.setAttribute('aria-hidden', 'false');
      }
    } else {
      // Если вендор не выбран, скрываем секцию интеграторов
      const vendorIntegratorsSection = vendorDiv.querySelector('.vendor-integrators');
      if (vendorIntegratorsSection) {
        vendorIntegratorsSection.style.display = 'none';
        vendorIntegratorsSection.setAttribute('aria-hidden', 'true');
      }
    }

    // Обработчики событий - кнопка удаления вендора
    const removeVendorBtn = vendorDiv.querySelector('.remove-vendor-btn');
    if (removeVendorBtn) {
      removeVendorBtn.addEventListener('click', async (e) => {
        e.stopPropagation(); // Предотвращаем закрытие модального окна
        e.preventDefault();

        // Получаем контейнер вендоров перед удалением
        const vendorsContainer = vendorDiv.closest('.vendors-container');
        if (!vendorsContainer || !vendorsContainer.id) {
          vendorDiv.remove();
          return;
        }

        const containerId = vendorsContainer.id;
        const isEdit = containerId.includes('edit');

        // Проверяем количество вендоров перед удалением
        const remainingVendors = vendorsContainer.querySelectorAll('.vendor-item');
        const willBeLast = remainingVendors.length === 1; // Текущий вендор еще не удален

        // Удаляем элемент вендора
        vendorDiv.remove();

        // Если это был последний вендор, создаем новый пустой вендор
        if (willBeLast) {
          const container = document.getElementById(containerId);
          if (container) {
            const newVendorEl = await createVendorElement({ id: Date.now(), name: '', integrators: [] }, containerId, isEdit);
            if (newVendorEl) {
              // Добавляем класс для анимации появления
              newVendorEl.classList.add('vendor-item-new');
              container.appendChild(newVendorEl);
              // Убираем класс анимации после завершения анимации
              setTimeout(() => {
                newVendorEl.classList.remove('vendor-item-new');
              }, 400);
            }
          }
        }

        // Обновляем скрытое поле
        updateVendorsHiddenInput(containerId, isEdit);
      });
    }

    // Кнопка добавления вендора теперь находится рядом с label "Вендоры"
    // Старая кнопка add-vendor-btn была удалена из vendor-header

    const addIntegratorBtn = vendorDiv.querySelector('.add-integrator-btn');
    if (addIntegratorBtn && integratorsList) {
      addIntegratorBtn.addEventListener('click', async () => {
        const integratorEl = await createIntegratorElement({ id: Date.now(), name: '' }, vendorDiv.dataset.vendorId);
        integratorsList.appendChild(integratorEl);
        updateVendorsHiddenInput(containerId, isEdit);

        // Скрываем кнопку "Добавить интегратора" после добавления
        addIntegratorBtn.style.display = 'none';
      });
    }

      return vendorDiv;
    } catch (error) {
      if (window.Logger) window.Logger.warn('Ошибка при создании элемента вендора:', error);
      return null;
    }
  }

  // Создание элемента интегратора
  async function createIntegratorElement(integrator, vendorId) {
    const integratorDiv = document.createElement('div');
    integratorDiv.className = 'integrator-item';
    integratorDiv.dataset.integratorId = integrator.id || Date.now();
    integratorDiv.dataset.vendorId = vendorId;

    const integratorName = integrator.name || '';

    // Загружаем список интеграторов
    const integratorsList = await loadIntegratorsList();
    // Для множественного выбора создаем опции с чекбоксами
    const integratorsOptions = integratorsList.map(int => `
      <li class="select-option-item" data-value="${int}">
        <label class="option-label">
          <input type="checkbox" />
          <span>${int}</span>
        </label>
      </li>
    `).join('');

    const integratorFieldId = `integrator-${integratorDiv.dataset.integratorId}`;
    // Парсим значение интегратора - может быть строкой или массивом
    let integratorValue = integratorName;
    let integratorArray = [];
    if (integratorName) {
      try {
        integratorArray = JSON.parse(integratorName);
        if (Array.isArray(integratorArray)) {
          integratorValue = integratorArray;
        }
      } catch (e) {
        // Если не JSON, значит это строка - оставляем как есть
        integratorArray = integratorName ? [integratorName] : [];
      }
    }

    integratorDiv.innerHTML = `
      <div class="custom-select-modal integrator-select" data-field="${integratorFieldId}" data-multi="true" tabindex="0" data-placeholder="Выберите интеграторов">
        <div class="select-trigger">
          <span class="selected-text">${integratorArray.length > 0 ? integratorArray.join(', ') : 'Выберите интеграторов'}</span>
          <svg class="arrow" width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 5L6 8L9 5" stroke="#666" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <ul class="select-options">
          <li class="add-new-integrator-option">
            <input type="text" class="new-integrator-input" placeholder="Введите название нового интегратора" />
            <button type="button" class="add-new-integrator-btn">Добавить</button>
          </li>
          ${integratorsOptions}
        </ul>
      </div>
      <button type="button" class="remove-integrator-btn" aria-label="Удалить интегратора">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
      <input type="hidden" id="${integratorFieldId}" class="integrator-name-input" value="${JSON.stringify(integratorArray)}" />
    `;

    const removeBtn = integratorDiv.querySelector('.remove-integrator-btn');
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation(); // Предотвращаем закрытие модального окна
      e.preventDefault();

      // Находим родительский элемент вендора и кнопку добавления интегратора
      const vendorItem = integratorDiv.closest('.vendor-item');
      const vendorIntegratorsSection = vendorItem ? vendorItem.querySelector('.vendor-integrators') : null;
      const addIntegratorBtn = vendorIntegratorsSection ? vendorIntegratorsSection.querySelector('.add-integrator-btn') : null;

      integratorDiv.remove();

      // Показываем кнопку "Добавить интегратора" после удаления
      if (addIntegratorBtn) {
        addIntegratorBtn.style.display = '';
      }

      const vendorsContainer = integratorDiv.closest('.vendors-container');
      if (vendorsContainer && vendorsContainer.id) {
        const containerId = vendorsContainer.id;
        const isEdit = containerId.includes('edit');
        updateVendorsHiddenInput(containerId, isEdit);
      }
    });

    // Обработчик изменения значения селекта интегратора
    const integratorSelect = integratorDiv.querySelector('.integrator-select');
    const integratorHiddenInput = document.getElementById(integratorFieldId);
    const integratorSelectTrigger = integratorDiv.querySelector('.select-trigger');

    // Инициализация выбранных значений для множественного выбора
    // Используем небольшую задержку, чтобы убедиться, что DOM полностью обновлен
    if (integratorArray.length > 0 && integratorSelect) {
      setTimeout(() => {
        integratorArray.forEach(integratorName => {
          const optionLi = integratorSelect.querySelector(`.select-options li[data-value="${integratorName}"]`);
          if (optionLi) {
            optionLi.classList.add('selected');
            const checkbox = optionLi.querySelector('input[type="checkbox"]');
            if (checkbox) {
              checkbox.checked = true;
            }
          }
        });

        // Убеждаемся, что скрытое поле содержит правильное значение
        if (integratorHiddenInput) {
          integratorHiddenInput.value = JSON.stringify(integratorArray);
        }

        // Используем renderMultiSelectTags для отображения тегов
        if (typeof window.renderMultiSelectTags === 'function') {
          window.renderMultiSelectTags(integratorSelect);
        }
      }, 100);
    }

    // Слушаем изменения скрытого поля
    if (integratorHiddenInput) {
      const observer = new MutationObserver(() => {
        const vendorsContainer = integratorDiv.closest('.vendors-container');
        if (vendorsContainer && vendorsContainer.id) {
          const containerId = vendorsContainer.id;
          const isEdit = containerId.includes('edit');
          updateVendorsHiddenInput(containerId, isEdit);
          // Обновляем отображение тегов
          if (typeof window.renderMultiSelectTags === 'function') {
            window.renderMultiSelectTags(integratorSelect);
          }
        }
      });

      observer.observe(integratorHiddenInput, { attributes: true, attributeFilter: ['value'] });

      // Также слушаем события input
      integratorHiddenInput.addEventListener('input', () => {
        const vendorsContainer = integratorDiv.closest('.vendors-container');
        if (vendorsContainer && vendorsContainer.id) {
          const containerId = vendorsContainer.id;
          const isEdit = containerId.includes('edit');
          updateVendorsHiddenInput(containerId, isEdit);
          // Обновляем отображение тегов
          if (typeof window.renderMultiSelectTags === 'function') {
            window.renderMultiSelectTags(integratorSelect);
          }
        }
      });

      // Обработчик изменений для множественного выбора (обрабатывается в select-events.js)
      // Добавляем обработчик для обновления данных после выбора
      integratorSelect.addEventListener('change', () => {
        setTimeout(() => {
          const vendorsContainer = integratorDiv.closest('.vendors-container');
          if (vendorsContainer && vendorsContainer.id) {
            const containerId = vendorsContainer.id;
            const isEdit = containerId.includes('edit');
            updateVendorsHiddenInput(containerId, isEdit);
          }
        }, 0);
      });

      // Обработчик добавления нового интегратора
      const addNewIntegratorBtn = integratorDiv.querySelector('.add-new-integrator-btn');
      const newIntegratorInput = integratorDiv.querySelector('.new-integrator-input');

      if (addNewIntegratorBtn && newIntegratorInput) {
        const addNewIntegrator = async () => {
          const newIntegratorName = newIntegratorInput.value.trim();
          if (!newIntegratorName) return;

          // Получаем текущий список интеграторов
          const currentIntegrators = await loadIntegratorsList();

          // Сохраняем в список интеграторов, если еще нет
          if (!currentIntegrators.includes(newIntegratorName)) {
            currentIntegrators.push(newIntegratorName);

            // Сохраняем новый интегратор в localStorage
            try {
              // Получаем текущий список из localStorage
              let localIntegrators = [];
              try {
                const stored = localStorage.getItem(INTEGRATORS_STORAGE_KEY);
                if (stored) {
                  localIntegrators = JSON.parse(stored);
                  if (!Array.isArray(localIntegrators)) {
                    localIntegrators = [];
                  }
                }
              } catch (e) {
                localIntegrators = [];
              }

              // Добавляем новый интегратор, если его еще нет
              if (!localIntegrators.includes(newIntegratorName)) {
                localIntegrators.push(newIntegratorName);
                localStorage.setItem(INTEGRATORS_STORAGE_KEY, JSON.stringify(localIntegrators));
                if (window.Logger) {
                  window.Logger.debug('Сохранен новый интегратор в localStorage:', newIntegratorName);
                }
              }
            } catch (e) {
              if (window.Logger) window.Logger.warn('Не удалось сохранить интегратора в localStorage', e);
            }

            // Обновляем кэш
            integratorsListCache = currentIntegrators;

            // Обновляем все селекты интеграторов на странице - добавляем новую опцию
            document.querySelectorAll('.integrator-select').forEach(select => {
              const optionsList = select.querySelector('.select-options');
              if (optionsList) {
                // Проверяем, нет ли уже такой опции
                const existingOption = Array.from(optionsList.querySelectorAll('li.select-option-item')).find(
                  li => li.dataset.value === newIntegratorName
                );
                if (!existingOption) {
                  const newOption = document.createElement('li');
                  newOption.className = 'select-option-item';
                  newOption.dataset.value = newIntegratorName;
                  newOption.innerHTML = `
                    <label class="option-label">
                      <input type="checkbox" />
                      <span>${newIntegratorName}</span>
                    </label>
                  `;

                  // Вставляем после опции добавления нового (опция добавления должна быть первой)
                  const addNewOption = optionsList.querySelector('.add-new-integrator-option');
                  if (addNewOption && addNewOption.nextSibling) {
                    optionsList.insertBefore(newOption, addNewOption.nextSibling);
                  } else if (addNewOption) {
                    // Если опция добавления последняя, добавляем после неё
                    optionsList.appendChild(newOption);
                  } else {
                    // Если опции добавления нет, добавляем в конец
                    optionsList.appendChild(newOption);
                  }
                }
              }
            });
          }

          // Добавляем в список опций текущего селекта, если еще нет
          const optionsList = integratorSelect.querySelector('.select-options');
          const existingOption = Array.from(optionsList.querySelectorAll('li.select-option-item')).find(
            li => li.dataset.value === newIntegratorName
          );
          if (!existingOption) {
            const newOption = document.createElement('li');
            newOption.className = 'select-option-item';
            newOption.dataset.value = newIntegratorName;
            newOption.innerHTML = `
              <label class="option-label">
                <input type="checkbox" />
                <span>${newIntegratorName}</span>
              </label>
            `;

            // Вставляем после опции добавления нового (опция добавления должна быть первой)
            const addNewOption = optionsList.querySelector('.add-new-integrator-option');
            if (addNewOption && addNewOption.nextSibling) {
              optionsList.insertBefore(newOption, addNewOption.nextSibling);
            } else if (addNewOption) {
              // Если опция добавления последняя, добавляем после неё
              optionsList.appendChild(newOption);
            } else {
              // Если опции добавления нет, добавляем в конец
              optionsList.appendChild(newOption);
            }
          }

          // Добавляем к выбранным значениям (множественный выбор)
          let currentValues = [];
          try {
            const currentValue = integratorHiddenInput.value;
            if (currentValue) {
              currentValues = JSON.parse(currentValue);
              if (!Array.isArray(currentValues)) {
                currentValues = currentValues ? [currentValues] : [];
              }
            }
          } catch (e) {
            currentValues = [];
          }

          if (!currentValues.includes(newIntegratorName)) {
            currentValues.push(newIntegratorName);
          }

          // Устанавливаем значение используя setCustomSelectValue для правильного обновления UI
          // Используем requestAnimationFrame и небольшую задержку, чтобы убедиться, что опция добавлена в DOM
          requestAnimationFrame(() => {
            setTimeout(() => {
              // Проверяем, что опция действительно добавлена в текущий селект
              const optionsList = integratorSelect.querySelector('.select-options');
              const newOption = optionsList ? optionsList.querySelector(`li.select-option-item[data-value="${newIntegratorName}"]`) : null;

              if (!newOption && optionsList) {
                // Если опция еще не добавлена, добавляем её
                const addNewOption = optionsList.querySelector('.add-new-integrator-option');
                const createdOption = document.createElement('li');
                createdOption.className = 'select-option-item';
                createdOption.dataset.value = newIntegratorName;
                createdOption.innerHTML = `
                  <label class="option-label">
                    <input type="checkbox" />
                    <span>${newIntegratorName}</span>
                  </label>
                `;

                // Вставляем после опции добавления нового (опция добавления должна быть первой)
                if (addNewOption && addNewOption.nextSibling) {
                  optionsList.insertBefore(createdOption, addNewOption.nextSibling);
                } else if (addNewOption) {
                  // Если опция добавления последняя, добавляем после неё
                  optionsList.appendChild(createdOption);
                } else {
                  // Если опции добавления нет, добавляем в конец
                  optionsList.appendChild(createdOption);
                }
              }

              // Устанавливаем значение
              if (typeof window.setCustomSelectValue === 'function') {
                window.setCustomSelectValue(integratorFieldId, JSON.stringify(currentValues));
              } else {
                // Fallback на ручную установку
                integratorHiddenInput.value = JSON.stringify(currentValues);
                integratorHiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
                integratorHiddenInput.dispatchEvent(new Event('input', { bubbles: true }));

                // Отмечаем опцию как выбранную
                const optionLi = optionsList ? optionsList.querySelector(`li.select-option-item[data-value="${newIntegratorName}"]`) : null;
                if (optionLi) {
                  optionLi.classList.add('selected');
                  const checkbox = optionLi.querySelector('input[type="checkbox"]');
                  if (checkbox) {
                    checkbox.checked = true;
                  }
                }

                // Обновляем отображение тегов
                if (typeof window.renderMultiSelectTags === 'function') {
                  window.renderMultiSelectTags(integratorSelect);
                }
              }

              // Обновляем скрытое поле вендоров
              const vendorsContainer = integratorDiv.closest('.vendors-container');
              if (vendorsContainer && vendorsContainer.id) {
                const containerId = vendorsContainer.id;
                const isEdit = containerId.includes('edit');
                updateVendorsHiddenInput(containerId, isEdit);
              }
            }, 50);
          });

          integratorSelect.classList.remove('open');

          // Очищаем поле ввода
          newIntegratorInput.value = '';
        };

        // Используем делегирование событий на уровне контейнера для надежности
        const handleAddIntegratorClick = (e) => {
          // Проверяем, что клик был именно по кнопке добавления или внутри неё
          const clickedBtn = e.target.closest('.add-new-integrator-btn');
          if (clickedBtn === addNewIntegratorBtn || e.target === addNewIntegratorBtn) {
            e.stopPropagation();
            e.stopImmediatePropagation();
            e.preventDefault();
            if (window.Logger) {
              window.Logger.debug('Клик по кнопке добавления интегратора');
            }
            addNewIntegrator();
            return false;
          }
        };

        const handleAddIntegratorKeypress = (e) => {
          // Проверяем, что событие было в поле ввода
          if ((e.target === newIntegratorInput || e.target.classList.contains('new-integrator-input')) && e.key === 'Enter') {
            e.stopPropagation();
            e.stopImmediatePropagation();
            e.preventDefault();
            if (window.Logger) {
              window.Logger.debug('Enter в поле ввода интегратора');
            }
            addNewIntegrator();
            return false;
          }
        };

        // Добавляем обработчики с capture phase для раннего перехвата (до других обработчиков)
        addNewIntegratorBtn.addEventListener('click', handleAddIntegratorClick, true);
        newIntegratorInput.addEventListener('keypress', handleAddIntegratorKeypress, true);
        newIntegratorInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            handleAddIntegratorKeypress(e);
          }
        }, true);

        // Также добавляем обработчики в bubble phase для надежности
        addNewIntegratorBtn.addEventListener('click', handleAddIntegratorClick, false);
        newIntegratorInput.addEventListener('keypress', handleAddIntegratorKeypress, false);
        newIntegratorInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            handleAddIntegratorKeypress(e);
          }
        }, false);
      }
    }

    return integratorDiv;
  }

  // Обновление скрытого поля с данными вендоров
  function updateVendorsHiddenInput(containerId, isEdit) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const hiddenInputId = isEdit ? 'editVendors' : 'techVendors';
    const hiddenInput = document.getElementById(hiddenInputId);
    if (!hiddenInput) return;

    const vendors = [];
    const vendorItems = container.querySelectorAll('.vendor-item');

    vendorItems.forEach(vendorItem => {
      const vendorNameInput = vendorItem.querySelector('.vendor-name-input');
      const vendorName = vendorNameInput ? vendorNameInput.value.trim() : '';

      if (!vendorName) return; // Пропускаем пустые вендоры

      const integrators = [];
      const integratorItems = vendorItem.querySelectorAll('.integrator-item');

      integratorItems.forEach(integratorItem => {
        const integratorNameInput = integratorItem.querySelector('.integrator-name-input');
        const integratorValue = integratorNameInput ? integratorNameInput.value.trim() : '';

        if (integratorValue) {
          let integratorNames = [];
          try {
            integratorNames = JSON.parse(integratorValue);
            if (!Array.isArray(integratorNames)) {
              // Если это не массив, значит старое значение (строка) - преобразуем в массив
              integratorNames = integratorNames ? [integratorNames] : [];
            }
          } catch (e) {
            // Если не JSON, значит это строка - преобразуем в массив
            integratorNames = integratorValue ? [integratorValue] : [];
          }

          // Добавляем каждый интегратор из массива
          integratorNames.forEach((integratorName, index) => {
            if (integratorName) {
              integrators.push({
                id: parseInt(integratorItem.dataset.integratorId) || Date.now() + index,
                name: integratorName
              });
            }
          });
        }
      });

      vendors.push({
        id: parseInt(vendorItem.dataset.vendorId) || Date.now(),
        name: vendorName,
        integrators: integrators
      });
    });

    hiddenInput.value = JSON.stringify(vendors);
  }

  // Флаги для отслеживания инициализации (чтобы избежать повторной инициализации)
  const initializedContainers = new Set();
  const initializedFileInputs = new Set();

  // Инициализация управления вендорами для формы
  function initVendorsManagement(containerId, addButtonId, isEdit = false) {
    const container = document.getElementById(containerId);
    if (!container) {
      if (window.Logger) window.Logger.warn('Контейнер вендоров не найден:', containerId);
      return;
    }

    // Проверяем, не инициализирован ли уже этот контейнер
    // Удаляем флаг при закрытии модального окна, но не при повторной инициализации
    if (initializedContainers.has(containerId)) {
      if (window.Logger) window.Logger.debug('Контейнер вендоров уже инициализирован, пропускаем:', containerId);
      return;
    }

    // Помечаем контейнер как инициализированный
    initializedContainers.add(containerId);

    // Очищаем контейнер перед инициализацией только если он пустой
    // Это нужно, чтобы не удалить уже загруженные вендоры
    const existingVendorsCheck = container.querySelectorAll('.vendor-item');
    if (existingVendorsCheck.length === 0) {
      container.innerHTML = '';
    }

    // Находим label "Вендоры" и добавляем кнопку плюсика рядом с ним
    // Пробуем найти form-group разными способами для надежности
    let vendorsGroup = container.closest('.form-group');
    if (!vendorsGroup) {
      // Если не нашли через closest, пробуем найти по id
      const containerParent = container.parentElement;
      if (containerParent && containerParent.classList.contains('form-group')) {
        vendorsGroup = containerParent;
      } else {
        // Пробуем найти по id editVendorsGroup или techVendorsGroup
        vendorsGroup = document.getElementById('editVendorsGroup') || document.getElementById('techVendorsGroup');
      }
    }

    if (vendorsGroup) {
      const label = vendorsGroup.querySelector('label');
      if (label) {
        // Проверяем, нет ли уже кнопки добавления
        let addVendorBtn = vendorsGroup.querySelector('.add-vendor-label-btn');
        if (!addVendorBtn) {
          addVendorBtn = document.createElement('button');
          addVendorBtn.type = 'button';
          addVendorBtn.className = 'add-vendor-label-btn';
          addVendorBtn.setAttribute('aria-label', 'Добавить еще вендора');
          addVendorBtn.setAttribute('data-tooltip', 'Добавить еще вендора');
          addVendorBtn.style.cssText = 'margin-left: 8px; padding: 4px 8px; border: none; background: transparent; cursor: pointer; display: inline-flex; align-items: center; vertical-align: middle;';
          addVendorBtn.innerHTML = `
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style="color: #666;">
              <path d="M8 3V13M3 8H13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          `;
          label.appendChild(addVendorBtn);
        }
      } else {
        if (window.Logger) window.Logger.warn('Label не найден в form-group для контейнера:', containerId);
      }
    } else {
      if (window.Logger) window.Logger.warn('Form-group не найден для контейнера:', containerId);
    }

    // Функция для добавления нового вендора
    const addNewVendor = async () => {
      const vendorEl = await createVendorElement({ id: Date.now(), name: '', integrators: [] }, containerId, isEdit);
      if (vendorEl) {
        // Добавляем класс для анимации появления
        vendorEl.classList.add('vendor-item-new');
        container.appendChild(vendorEl);
        updateVendorsHiddenInput(containerId, isEdit);

        // Убираем класс анимации после завершения анимации
        setTimeout(() => {
          vendorEl.classList.remove('vendor-item-new');
        }, 400);
      }
    };

    // Обработчик клика на кнопку добавления вендора рядом с label
    if (vendorsGroup) {
      const addVendorLabelBtn = vendorsGroup.querySelector('.add-vendor-label-btn');
      if (addVendorLabelBtn) {
        addVendorLabelBtn.addEventListener('click', async (e) => {
          e.preventDefault();
          e.stopPropagation();
          await addNewVendor();
        });
      }
    }

    // Проверяем, нет ли уже элементов вендоров (чтобы не создавать дубликаты)
    const existingVendors = container.querySelectorAll('.vendor-item');
    if (existingVendors.length === 0) {
      // Для режима редактирования не создаем пустой селект - вендоры будут добавлены через кнопку "Плюсик" или загружены из данных
      if (!isEdit) {
        // Создаем первое поле выбора вендора только если его нет (только для режима создания)
        createVendorElement({ id: Date.now(), name: '', integrators: [] }, containerId, isEdit).then(vendorEl => {
          if (vendorEl && container) {
            container.appendChild(vendorEl);
            updateVendorsHiddenInput(containerId, isEdit);
          }
        });
      } else {
        if (window.Logger) window.Logger.debug('Режим редактирования: не создаем пустой селект вендора');
      }
    } else {
      if (window.Logger) window.Logger.debug('Элементы вендоров уже существуют, не создаем дубликат');
    }

  }

  // Загрузка вендоров в форму
  async function loadVendorsIntoForm(containerId, vendors, isEdit = false) {
    try {
      const container = document.getElementById(containerId);
      if (!container) {
        if (window.Logger) window.Logger.warn('Контейнер вендоров не найден:', containerId);
        return Promise.resolve();
      }

      // Очищаем контейнер
      container.innerHTML = '';

      // Убеждаемся, что контейнер виден
      container.style.display = '';
      container.style.visibility = 'visible';
      container.style.opacity = '1';

      if (vendors && Array.isArray(vendors) && vendors.length > 0) {
        // Загружаем существующие вендоры
        for (const vendor of vendors) {
          try {
            const vendorEl = await createVendorElement(vendor, containerId, isEdit);
            if (vendorEl) {
              container.appendChild(vendorEl);
              if (window.Logger) window.Logger.debug('Добавлен элемент вендора:', vendor.name || 'без названия');
            } else {
              if (window.Logger) window.Logger.warn('Не удалось создать элемент вендора:', vendor);
            }
          } catch (err) {
            if (window.Logger) window.Logger.warn('Ошибка при создании элемента вендора:', err);
          }
        }
      } else {
        // Если вендоров нет, создаем хотя бы одно пустое поле для возможности добавления вендора
        // Это работает как для режима создания, так и для редактирования
        try {
          const vendorEl = await createVendorElement({ id: Date.now(), name: '', integrators: [] }, containerId, isEdit);
          if (vendorEl) {
            container.appendChild(vendorEl);
            if (window.Logger) window.Logger.debug('Создан пустой элемент вендора для режима', isEdit ? 'редактирования' : 'создания');
          } else {
            if (window.Logger) window.Logger.warn('Не удалось создать пустой элемент вендора');
          }
        } catch (err) {
          if (window.Logger) window.Logger.warn('Ошибка при создании пустого элемента вендора:', err);
        }
      }

      // Устанавливаем значения в селекты вендоров и интеграторов после создания элементов
      // Используем небольшую задержку, чтобы убедиться, что DOM обновлен
      setTimeout(() => {
        try {
          const vendorItems = container.querySelectorAll('.vendor-item');
          vendorItems.forEach((vendorItem) => {
            const vendorSelect = vendorItem.querySelector('.vendor-select');
            const vendorHiddenInput = vendorItem.querySelector('.vendor-name-input');

            if (vendorSelect && vendorHiddenInput) {
              const vendorName = vendorHiddenInput.value ? vendorHiddenInput.value.trim() : '';

              // Если есть значение, устанавливаем его в селект
              if (vendorName && typeof window.setCustomSelectValue === 'function') {
                try {
                  // Устанавливаем значение в селект
                  const vendorFieldId = vendorSelect.getAttribute('data-field');
                  window.setCustomSelectValue(vendorFieldId, vendorName);

                  // Обновляем текст в триггере
                  const trigger = vendorSelect.querySelector('.select-trigger .selected-text');
                  if (trigger) {
                    trigger.textContent = vendorName;
                  }

                  // Показываем секцию интеграторов, если вендор выбран
                  const integratorsSection = vendorItem.querySelector('.vendor-integrators');
                  if (integratorsSection) {
                    integratorsSection.style.display = '';
                    integratorsSection.setAttribute('aria-hidden', 'false');
                  }
                } catch (e) {
                  if (window.Logger) window.Logger.warn('Ошибка при установке значения вендора:', e);
                }
              }
            }

            // Устанавливаем значения для интеграторов
            // Значения уже устанавливаются в createIntegratorElement, но нужно убедиться, что они отображаются правильно
            const integratorItems = vendorItem.querySelectorAll('.integrator-item');
            integratorItems.forEach((integratorItem) => {
              const integratorSelect = integratorItem.querySelector('.integrator-select');
              const integratorHiddenInput = integratorItem.querySelector('.integrator-name-input');

              if (integratorSelect && integratorHiddenInput && integratorHiddenInput.value) {
                try {
                  const integratorValue = integratorHiddenInput.value.trim();
                  if (integratorValue) {
                    let integratorArray = [];
                    try {
                      integratorArray = JSON.parse(integratorValue);
                      if (!Array.isArray(integratorArray)) {
                        integratorArray = integratorValue ? [integratorValue] : [];
                      }
                    } catch (e) {
                      integratorArray = integratorValue ? [integratorValue] : [];
                    }

                    if (integratorArray.length > 0) {
                      // Убеждаемся, что скрытое поле содержит правильное значение
                      if (integratorHiddenInput) {
                        integratorHiddenInput.value = JSON.stringify(integratorArray);
                      }

                      // Убеждаемся, что опции отмечены правильно
                      integratorArray.forEach(integratorName => {
                        const optionLi = integratorSelect.querySelector(`.select-options li[data-value="${integratorName}"]`);
                        if (optionLi) {
                          optionLi.classList.add('selected');
                          const checkbox = optionLi.querySelector('input[type="checkbox"]');
                          if (checkbox) {
                            checkbox.checked = true;
                          }
                        }
                      });

                      // Обновляем отображение тегов для множественного выбора
                      // Используем небольшую задержку, чтобы убедиться, что DOM обновлен
                      setTimeout(() => {
                        if (typeof window.renderMultiSelectTags === 'function') {
                          window.renderMultiSelectTags(integratorSelect);
                        }
                      }, 50);
                    }
                  }
                } catch (e) {
                  if (window.Logger) window.Logger.warn('Ошибка при установке значений интеграторов', e);
                }
              }
            });
          });
        } catch (e) {
          if (window.Logger) window.Logger.warn('Ошибка при установке значений в селекты:', e);
        }
      }, 150);

      updateVendorsHiddenInput(containerId, isEdit);

      // Проверяем, что элементы действительно добавлены
      if (window.Logger) {
        const addedItems = container.querySelectorAll('.vendor-item');
        window.Logger.debug(`Всего элементов вендоров в контейнере: ${addedItems.length}`);
      }

      return Promise.resolve();
    } catch (error) {
      if (window.Logger) window.Logger.warn('Критическая ошибка в loadVendorsIntoForm:', error);
      return Promise.reject(error);
    }
  }

  // ===== УПРАВЛЕНИЕ ФАЙЛАМИ =====

  // Конвертация файла в base64
  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result.split(',')[1]; // Убираем префикс data:type;base64,
        resolve({
          id: Date.now(),
          name: file.name,
          type: file.type,
          size: file.size,
          data: base64
        });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // Создание элемента файла в списке
  function createFileElement(file, containerId, isEdit = false) {
    const container = document.getElementById(containerId);
    if (!container) return null;

    const fileDiv = document.createElement('div');
    fileDiv.className = 'file-item';
    fileDiv.dataset.fileId = file.id;

    // Проверяем, является ли это ссылкой
    const isLink = file.url || file.link;
    const fileUrl = file.url || file.link;

    let fileSize = '';
    let fileName = '';
    let iconSvg = '';

    if (isLink) {
      // Для ссылок
      fileName = file.name || fileUrl || 'Ссылка';
      iconSvg = `
        <svg class="file-icon link-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M10 13h1a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-1M6 3H5a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h1M6 8h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      `;
    } else {
      // Для файлов
      fileSize = file.size ? ` (${formatFileSize(file.size)})` : '';
      fileName = file.name || 'Без названия';
      iconSvg = `
        <svg class="file-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M4 2h5.172a2 2 0 0 1 1.414.586l2.828 2.828A2 2 0 0 1 14 6.828V13a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
          <path d="M9 2v4h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      `;
    }

    const displayName = window.escapeHtml ? window.escapeHtml(fileName) : fileName;
    const displayUrl = fileUrl ? (window.escapeHtml ? window.escapeHtml(fileUrl) : fileUrl) : '';

    fileDiv.innerHTML = `
      <div class="file-item-content">
        ${iconSvg}
        ${isLink ? `
          <div class="file-link-wrapper">
            <span class="file-name">${displayName}</span>
            <a href="${displayUrl}" target="_blank" rel="noopener noreferrer" class="file-link-url" title="${displayUrl}">${displayUrl}</a>
          </div>
        ` : `
          <span class="file-name">${displayName}${fileSize}</span>
        `}
      </div>
      <button type="button" class="remove-file-btn" aria-label="Удалить ${isLink ? 'ссылку' : 'файл'}">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    `;

    const removeBtn = fileDiv.querySelector('.remove-file-btn');
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation(); // Предотвращаем закрытие модального окна
      e.preventDefault();

      // Удаляем данные файла из хранилища
      if (window._tempFilesData && window._tempFilesData[file.id]) {
        delete window._tempFilesData[file.id];
      }

      fileDiv.remove();
      updateFilesHiddenInput(containerId, isEdit);
    });

    return fileDiv;
  }

  // Форматирование размера файла
  function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  // Обновление скрытого поля с данными файлов
  function updateFilesHiddenInput(containerId, isEdit) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const hiddenInputId = isEdit ? 'editFiles' : 'techFiles';
    const hiddenInput = document.getElementById(hiddenInputId);
    if (!hiddenInput) return;

    const files = [];
    const fileItems = container.querySelectorAll('.file-item');

    fileItems.forEach(fileItem => {
      const fileId = fileItem.dataset.fileId;
      // Получаем данные файла из data-атрибутов или из глобального хранилища
      const fileData = window._tempFilesData && window._tempFilesData[fileId];
      if (fileData) {
        files.push(fileData);
      }
    });

    hiddenInput.value = JSON.stringify(files);
  }

  // Инициализация управления файлами для формы
  function initFilesManagement(inputId, listId, isEdit = false) {
    const fileInput = document.getElementById(inputId);
    const fileList = document.getElementById(listId);
    const addFileBtnId = isEdit ? 'editAddFileBtn' : 'techAddFileBtn';
    const addFileBtn = document.getElementById(addFileBtnId);

    if (!fileInput || !fileList) return;

    // Проверяем, не инициализирован ли уже этот input
    if (initializedFileInputs.has(inputId)) {
      if (window.Logger) window.Logger.debug('Обработчик файлов уже инициализирован, пропускаем:', inputId);
      return;
    }

    // Помечаем input как инициализированный
    initializedFileInputs.add(inputId);

    // Инициализируем хранилище для временных данных файлов
    if (!window._tempFilesData) {
      window._tempFilesData = {};
    }

    // Обработчик клика на кнопку добавления файла
    if (addFileBtn) {
      // Удаляем старый обработчик, если он есть
      const oldHandler = addFileBtn._fileClickHandler;
      if (oldHandler) {
        addFileBtn.removeEventListener('click', oldHandler);
      }

      const clickHandler = (e) => {
        e.stopPropagation();
        e.preventDefault();
        fileInput.click();
      };

      addFileBtn._fileClickHandler = clickHandler;
      addFileBtn.addEventListener('click', clickHandler);
    }

    // Инициализация обработчиков для добавления ссылок
    initLinkManagement(listId, isEdit);

    // Удаляем старый обработчик change, если он есть
    const oldChangeHandler = fileInput._fileChangeHandler;
    if (oldChangeHandler) {
      fileInput.removeEventListener('change', oldChangeHandler);
    }

    // Создаем новый обработчик change
    const changeHandler = async (e) => {
      const files = Array.from(e.target.files);

      // Защита от пустого списка файлов
      if (files.length === 0) return;

      for (const file of files) {
        try {
          const fileData = await fileToBase64(file);
          window._tempFilesData[fileData.id] = fileData;

          const fileEl = createFileElement(fileData, listId, isEdit);
          if (fileEl) {
            fileList.appendChild(fileEl);
          }
        } catch (err) {
          if (window.Logger) window.Logger.warn('Ошибка при загрузке файла', err);
          if (window.showNotification) {
            window.showNotification(`Ошибка при загрузке файла ${file.name}`, false);
          }
        }
      }

      // Очищаем input для возможности повторной загрузки того же файла
      fileInput.value = '';
      updateFilesHiddenInput(listId, isEdit);
    };

    // Сохраняем ссылку на обработчик для возможного удаления
    fileInput._fileChangeHandler = changeHandler;
    fileInput.addEventListener('change', changeHandler);
  }

  // Инициализация управления ссылками для формы
  function initLinkManagement(listId, isEdit = false) {
    const addLinkBtnId = isEdit ? 'editAddLinkBtn' : 'techAddLinkBtn';
    const addLinkBtn = document.getElementById(addLinkBtnId);
    const linkContainerId = isEdit ? 'editAddLinkContainer' : 'techAddLinkContainer';
    const linkContainer = document.getElementById(linkContainerId);
    const linkInputId = isEdit ? 'editLinkInput' : 'techLinkInput';
    const linkInput = document.getElementById(linkInputId);
    const confirmBtnId = isEdit ? 'editConfirmLinkBtn' : 'techConfirmLinkBtn';
    const confirmBtn = document.getElementById(confirmBtnId);
    const cancelBtnId = isEdit ? 'editCancelLinkBtn' : 'techCancelLinkBtn';
    const cancelBtn = document.getElementById(cancelBtnId);
    const fileList = document.getElementById(listId);

    if (!addLinkBtn || !linkContainer || !linkInput || !confirmBtn || !cancelBtn || !fileList) return;

    // Инициализируем хранилище для временных данных файлов
    if (!window._tempFilesData) {
      window._tempFilesData = {};
    }

    // Обработчик клика на кнопку "Добавить ссылку"
    const addLinkClickHandler = (e) => {
      e.stopPropagation();
      e.preventDefault();
      linkContainer.style.display = 'flex';
      linkInput.focus();
    };

    // Удаляем старый обработчик, если он есть
    if (addLinkBtn._linkClickHandler) {
      addLinkBtn.removeEventListener('click', addLinkBtn._linkClickHandler);
    }
    addLinkBtn._linkClickHandler = addLinkClickHandler;
    addLinkBtn.addEventListener('click', addLinkClickHandler);

    // Обработчик подтверждения добавления ссылки
    const confirmLinkHandler = (e) => {
      e.stopPropagation();
      e.preventDefault();

      const url = linkInput.value.trim();
      if (!url) {
        if (window.showNotification) {
          window.showNotification('Введите URL ссылки', false);
        }
        return;
      }

      // Простая валидация URL
      try {
        new URL(url);
      } catch (err) {
        if (window.showNotification) {
          window.showNotification('Введите корректный URL (например, https://example.com/file.pdf)', false);
        }
        return;
      }

      // Извлекаем имя файла из URL или используем URL как имя
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/');
      let fileName = pathParts[pathParts.length - 1] || urlObj.hostname;
      if (!fileName || fileName === '/') {
        fileName = urlObj.hostname;
      }

      // Создаем объект ссылки
      const linkData = {
        id: Date.now() + Math.random(),
        name: fileName,
        url: url,
        link: url, // для обратной совместимости
        isLink: true
      };

      // Сохраняем в хранилище
      window._tempFilesData[linkData.id] = linkData;

      // Создаем элемент и добавляем в список
      const linkEl = createFileElement(linkData, listId, isEdit);
      if (linkEl) {
        fileList.appendChild(linkEl);
      }

      // Очищаем поле ввода и скрываем контейнер
      linkInput.value = '';
      linkContainer.style.display = 'none';
      updateFilesHiddenInput(listId, isEdit);
    };

    // Удаляем старый обработчик, если он есть
    if (confirmBtn._confirmLinkHandler) {
      confirmBtn.removeEventListener('click', confirmBtn._confirmLinkHandler);
    }
    confirmBtn._confirmLinkHandler = confirmLinkHandler;
    confirmBtn.addEventListener('click', confirmLinkHandler);

    // Обработчик отмены добавления ссылки
    const cancelLinkHandler = (e) => {
      e.stopPropagation();
      e.preventDefault();
      linkInput.value = '';
      linkContainer.style.display = 'none';
    };

    // Удаляем старый обработчик, если он есть
    if (cancelBtn._cancelLinkHandler) {
      cancelBtn.removeEventListener('click', cancelBtn._cancelLinkHandler);
    }
    cancelBtn._cancelLinkHandler = cancelLinkHandler;
    cancelBtn.addEventListener('click', cancelLinkHandler);

    // Обработчик нажатия Enter в поле ввода ссылки
    const linkInputKeyHandler = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        confirmBtn.click();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancelBtn.click();
      }
    };

    // Удаляем старый обработчик, если он есть
    if (linkInput._linkInputKeyHandler) {
      linkInput.removeEventListener('keydown', linkInput._linkInputKeyHandler);
    }
    linkInput._linkInputKeyHandler = linkInputKeyHandler;
    linkInput.addEventListener('keydown', linkInputKeyHandler);
  }

  // Загрузка файлов в форму
  function loadFilesIntoForm(listId, files, isEdit = false) {
    const fileList = document.getElementById(listId);
    if (!fileList) return;

    fileList.innerHTML = '';

    if (!window._tempFilesData) {
      window._tempFilesData = {};
    }

    if (files && Array.isArray(files) && files.length > 0) {
      files.forEach(file => {
        window._tempFilesData[file.id] = file;
        const fileEl = createFileElement(file, listId, isEdit);
        if (fileEl) {
          fileList.appendChild(fileEl);
        }
      });
    }

    updateFilesHiddenInput(listId, isEdit);
  }

  // Сброс флага инициализации для контейнера
  function resetInitialization(containerId) {
    initializedContainers.delete(containerId);
    if (window.Logger) window.Logger.debug('Сброшен флаг инициализации для контейнера:', containerId);
  }

  // Сброс флага инициализации для файлового input
  function resetFileInputInitialization(inputId) {
    initializedFileInputs.delete(inputId);
    const fileInput = document.getElementById(inputId);
    if (fileInput && fileInput._fileChangeHandler) {
      fileInput.removeEventListener('change', fileInput._fileChangeHandler);
      delete fileInput._fileChangeHandler;
    }
    const addFileBtnId = inputId === 'editFilesInput' ? 'editAddFileBtn' : 'techAddFileBtn';
    const addFileBtn = document.getElementById(addFileBtnId);
    if (addFileBtn && addFileBtn._fileClickHandler) {
      addFileBtn.removeEventListener('click', addFileBtn._fileClickHandler);
      delete addFileBtn._fileClickHandler;
    }

    // Очистка обработчиков ссылок
    const isEdit = inputId === 'editFilesInput';
    const addLinkBtnId = isEdit ? 'editAddLinkBtn' : 'techAddLinkBtn';
    const linkInputId = isEdit ? 'editLinkInput' : 'techLinkInput';
    const confirmBtnId = isEdit ? 'editConfirmLinkBtn' : 'techConfirmLinkBtn';
    const cancelBtnId = isEdit ? 'editCancelLinkBtn' : 'techCancelLinkBtn';

    const addLinkBtn = document.getElementById(addLinkBtnId);
    const linkInput = document.getElementById(linkInputId);
    const confirmBtn = document.getElementById(confirmBtnId);
    const cancelBtn = document.getElementById(cancelBtnId);

    if (addLinkBtn && addLinkBtn._linkClickHandler) {
      addLinkBtn.removeEventListener('click', addLinkBtn._linkClickHandler);
      delete addLinkBtn._linkClickHandler;
    }
    if (linkInput && linkInput._linkInputKeyHandler) {
      linkInput.removeEventListener('keydown', linkInput._linkInputKeyHandler);
      delete linkInput._linkInputKeyHandler;
    }
    if (confirmBtn && confirmBtn._confirmLinkHandler) {
      confirmBtn.removeEventListener('click', confirmBtn._confirmLinkHandler);
      delete confirmBtn._confirmLinkHandler;
    }
    if (cancelBtn && cancelBtn._cancelLinkHandler) {
      cancelBtn.removeEventListener('click', cancelBtn._cancelLinkHandler);
      delete cancelBtn._cancelLinkHandler;
    }

    // Скрываем контейнер добавления ссылки, если он открыт
    const linkContainerId = isEdit ? 'editAddLinkContainer' : 'techAddLinkContainer';
    const linkContainer = document.getElementById(linkContainerId);
    if (linkContainer) {
      linkContainer.style.display = 'none';
    }

    if (window.Logger) window.Logger.debug('Сброшен флаг инициализации для файлового input:', inputId);
  }

  // Глобальное делегирование событий для обработки добавления вендоров и интеграторов
  // Это гарантирует, что обработчики сработают даже если события перехватываются другими обработчиками
  document.addEventListener('click', (e) => {
    // Обработка добавления нового вендора
    const addVendorBtn = e.target.closest('.add-new-vendor-btn');
    if (addVendorBtn) {
      const addNewOption = addVendorBtn.closest('.add-new-vendor-option');
      if (addNewOption) {
        const vendorSelect = addNewOption.closest('.vendor-select');
        if (vendorSelect) {
          const vendorDiv = vendorSelect.closest('.vendor-item');
          if (vendorDiv) {
            const input = addNewOption.querySelector('.new-vendor-input');
            if (input && input.value.trim()) {
              e.stopPropagation();
              e.stopImmediatePropagation();
              e.preventDefault();

              // Находим обработчик через vendorDiv
              const vendorFieldId = vendorSelect.getAttribute('data-field');
              const vendorHiddenInput = document.getElementById(vendorFieldId);
              const vendorsContainer = vendorDiv.closest('.vendors-container');
              const containerId = vendorsContainer ? vendorsContainer.id : '';
              const isEdit = containerId.includes('edit');

              // Вызываем функцию добавления напрямую
              const addNewVendor = async () => {
                const newVendorName = input.value.trim();
                if (!newVendorName) return;

                const currentVendors = await loadVendorsList();

                if (currentVendors.includes(newVendorName)) {
                  // Закрываем селект и сбрасываем inline стили для существующего вендора
                  vendorSelect.classList.remove('open');
                  const options = vendorSelect.querySelector('.select-options');
                  if (options) {
                    options.style.removeProperty('display');
                    options.style.removeProperty('visibility');
                    options.style.removeProperty('opacity');
                    options.style.removeProperty('pointer-events');
                    options.style.removeProperty('z-index');
                  }
                  if (typeof window.setCustomSelectValue === 'function') {
                    window.setCustomSelectValue(vendorFieldId, newVendorName);
                  } else if (vendorHiddenInput) {
                    vendorHiddenInput.value = newVendorName;
                    vendorHiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
                  }

                  // Показываем секцию интеграторов для существующего вендора
                  const vendorIntegratorsSection = vendorDiv.querySelector('.vendor-integrators');
                  if (vendorIntegratorsSection) {
                    vendorIntegratorsSection.style.display = '';
                    vendorIntegratorsSection.setAttribute('aria-hidden', 'false');
                  }

                  input.value = '';
                  if (containerId) updateVendorsHiddenInput(containerId, isEdit);
                  return;
                }

                if (!currentVendors.includes(newVendorName)) {
                  currentVendors.push(newVendorName);
                }

                try {
                  let localVendors = [];
                  try {
                    const stored = localStorage.getItem(VENDORS_STORAGE_KEY);
                    if (stored) {
                      localVendors = JSON.parse(stored);
                      if (!Array.isArray(localVendors)) {
                        localVendors = [];
                      }
                    }
                  } catch (e) {
                    localVendors = [];
                  }

                  if (!localVendors.includes(newVendorName)) {
                    localVendors.push(newVendorName);
                    localStorage.setItem(VENDORS_STORAGE_KEY, JSON.stringify(localVendors));
                  }
                } catch (e) {
                  if (window.Logger) window.Logger.warn('Не удалось сохранить вендора в localStorage', e);
                }

                vendorsListCache = currentVendors;

                // Закрываем селект сразу после сохранения (если еще не закрыт) и сбрасываем inline стили
                vendorSelect.classList.remove('open');
                const optionsEl = vendorSelect.querySelector('.select-options');
                if (optionsEl) {
                  optionsEl.style.removeProperty('display');
                  optionsEl.style.removeProperty('visibility');
                  optionsEl.style.removeProperty('opacity');
                  optionsEl.style.removeProperty('pointer-events');
                  optionsEl.style.removeProperty('z-index');
                }
                input.value = '';

                document.querySelectorAll('.vendor-select').forEach(select => {
                  const optionsList = select.querySelector('.select-options');
                  if (optionsList) {
                    const existingOption = Array.from(optionsList.querySelectorAll('li')).find(
                      li => li.dataset.value === newVendorName && !li.classList.contains('add-new-vendor-option')
                    );
                    if (!existingOption) {
                      const newOption = document.createElement('li');
                      newOption.dataset.value = newVendorName;
                      newOption.textContent = newVendorName;
                      newOption.style.cursor = 'pointer';
                      newOption.style.padding = '8px 12px';

                      const addNewOptionEl = optionsList.querySelector('.add-new-vendor-option');
                      if (addNewOptionEl && addNewOptionEl.nextSibling) {
                        optionsList.insertBefore(newOption, addNewOptionEl.nextSibling);
                      } else if (addNewOptionEl) {
                        optionsList.appendChild(newOption);
                      } else {
                        optionsList.appendChild(newOption);
                      }
                    }
                  }
                });

                requestAnimationFrame(() => {
                  setTimeout(() => {
                    if (typeof window.setCustomSelectValue === 'function') {
                      window.setCustomSelectValue(vendorFieldId, newVendorName);
                    } else if (vendorHiddenInput) {
                      vendorHiddenInput.value = newVendorName;
                      vendorHiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
                      vendorHiddenInput.dispatchEvent(new Event('input', { bubbles: true }));
                    }

                    // Показываем секцию интеграторов для добавленного вендора
                    const vendorIntegratorsSection = vendorDiv.querySelector('.vendor-integrators');
                    if (vendorIntegratorsSection) {
                      vendorIntegratorsSection.style.display = '';
                      vendorIntegratorsSection.setAttribute('aria-hidden', 'false');
                    }

                    if (containerId) updateVendorsHiddenInput(containerId, isEdit);
                  }, 50);
                });

                // Показываем секцию интеграторов немедленно (до анимации)
                const vendorIntegratorsSection = vendorDiv.querySelector('.vendor-integrators');
                if (vendorIntegratorsSection) {
                  vendorIntegratorsSection.style.display = '';
                  vendorIntegratorsSection.setAttribute('aria-hidden', 'false');
                }
              };

              addNewVendor();
              return false;
            }
          }
        }
      }
    }

    // Обработка добавления нового интегратора
    const addIntegratorBtn = e.target.closest('.add-new-integrator-btn');
    if (addIntegratorBtn) {
      const addNewOption = addIntegratorBtn.closest('.add-new-integrator-option');
      if (addNewOption) {
        const integratorSelect = addNewOption.closest('.integrator-select');
        if (integratorSelect) {
          const integratorDiv = integratorSelect.closest('.integrator-item');
          if (integratorDiv) {
            const input = addNewOption.querySelector('.new-integrator-input');
            if (input && input.value.trim()) {
              e.stopPropagation();
              e.stopImmediatePropagation();
              e.preventDefault();

              const integratorFieldId = integratorSelect.getAttribute('data-field');
              const integratorHiddenInput = document.getElementById(integratorFieldId);
              const vendorsContainer = integratorDiv.closest('.vendors-container');
              const containerId = vendorsContainer ? vendorsContainer.id : '';
              const isEdit = containerId.includes('edit');

              const addNewIntegrator = async () => {
                const newIntegratorName = input.value.trim();
                if (!newIntegratorName) return;

                const currentIntegrators = await loadIntegratorsList();

                if (!currentIntegrators.includes(newIntegratorName)) {
                  currentIntegrators.push(newIntegratorName);

                  try {
                    let localIntegrators = [];
                    try {
                      const stored = localStorage.getItem(INTEGRATORS_STORAGE_KEY);
                      if (stored) {
                        localIntegrators = JSON.parse(stored);
                        if (!Array.isArray(localIntegrators)) {
                          localIntegrators = [];
                        }
                      }
                    } catch (e) {
                      localIntegrators = [];
                    }

                    if (!localIntegrators.includes(newIntegratorName)) {
                      localIntegrators.push(newIntegratorName);
                      localStorage.setItem(INTEGRATORS_STORAGE_KEY, JSON.stringify(localIntegrators));
                    }
                  } catch (e) {
                    if (window.Logger) window.Logger.warn('Не удалось сохранить интегратора в localStorage', e);
                  }

                  integratorsListCache = currentIntegrators;

                  document.querySelectorAll('.integrator-select').forEach(select => {
                    const optionsList = select.querySelector('.select-options');
                    if (optionsList) {
                      const existingOption = Array.from(optionsList.querySelectorAll('li.select-option-item')).find(
                        li => li.dataset.value === newIntegratorName
                      );
                      if (!existingOption) {
                        const newOption = document.createElement('li');
                        newOption.className = 'select-option-item';
                        newOption.dataset.value = newIntegratorName;
                        newOption.innerHTML = `
                          <label class="option-label">
                            <input type="checkbox" />
                            <span>${newIntegratorName}</span>
                          </label>
                        `;

                        const addNewOptionEl = optionsList.querySelector('.add-new-integrator-option');
                        if (addNewOptionEl && addNewOptionEl.nextSibling) {
                          optionsList.insertBefore(newOption, addNewOptionEl.nextSibling);
                        } else if (addNewOptionEl) {
                          optionsList.appendChild(newOption);
                        } else {
                          optionsList.appendChild(newOption);
                        }
                      }
                    }
                  });
                }

                const optionsList = integratorSelect.querySelector('.select-options');
                const existingOption = Array.from(optionsList.querySelectorAll('li.select-option-item')).find(
                  li => li.dataset.value === newIntegratorName
                );
                if (!existingOption) {
                  const newOption = document.createElement('li');
                  newOption.className = 'select-option-item';
                  newOption.dataset.value = newIntegratorName;
                  newOption.innerHTML = `
                    <label class="option-label">
                      <input type="checkbox" />
                      <span>${newIntegratorName}</span>
                    </label>
                  `;

                  const addNewOptionEl = optionsList.querySelector('.add-new-integrator-option');
                  if (addNewOptionEl && addNewOptionEl.nextSibling) {
                    optionsList.insertBefore(newOption, addNewOptionEl.nextSibling);
                  } else if (addNewOptionEl) {
                    optionsList.appendChild(newOption);
                  } else {
                    optionsList.appendChild(newOption);
                  }
                }

                let currentValues = [];
                try {
                  const currentValue = integratorHiddenInput ? integratorHiddenInput.value : '';
                  if (currentValue) {
                    currentValues = JSON.parse(currentValue);
                    if (!Array.isArray(currentValues)) {
                      currentValues = currentValues ? [currentValues] : [];
                    }
                  }
                } catch (e) {
                  currentValues = [];
                }

                if (!currentValues.includes(newIntegratorName)) {
                  currentValues.push(newIntegratorName);
                }

                requestAnimationFrame(() => {
                  setTimeout(() => {
                    if (typeof window.setCustomSelectValue === 'function') {
                      window.setCustomSelectValue(integratorFieldId, JSON.stringify(currentValues));
                    } else if (integratorHiddenInput) {
                      integratorHiddenInput.value = JSON.stringify(currentValues);
                      integratorHiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
                      integratorHiddenInput.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                    if (containerId) updateVendorsHiddenInput(containerId, isEdit);
                  }, 50);
                });

                integratorSelect.classList.remove('open');
                input.value = '';
              };

              addNewIntegrator();
              return false;
            }
          }
        }
      }
    }
  }, true); // Используем capture phase для раннего перехвата

  // Обработка Enter в полях ввода
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const input = e.target;
      if (input && input.classList.contains('new-vendor-input')) {
        const addNewOption = input.closest('.add-new-vendor-option');
        if (addNewOption) {
          const addVendorBtn = addNewOption.querySelector('.add-new-vendor-btn');
          if (addVendorBtn) {
            e.stopPropagation();
            e.stopImmediatePropagation();
            e.preventDefault();
            addVendorBtn.click();
            return false;
          }
        }
      }

      if (input && input.classList.contains('new-integrator-input')) {
        const addNewOption = input.closest('.add-new-integrator-option');
        if (addNewOption) {
          const addIntegratorBtn = addNewOption.querySelector('.add-new-integrator-btn');
          if (addIntegratorBtn) {
            e.stopPropagation();
            e.stopImmediatePropagation();
            e.preventDefault();
            addIntegratorBtn.click();
            return false;
          }
        }
      }
    }
  }, true); // Используем capture phase для раннего перехвата

  // Экспорт функций
  window.VendorsFiles = {
    initVendorsManagement,
    loadVendorsIntoForm,
    updateVendorsHiddenInput,
    initFilesManagement,
    loadFilesIntoForm,
    getVendorsList,
    saveVendorsList,
    getIntegratorsList,
    saveIntegratorsList,
    resetInitialization,
    resetFileInputInitialization
  };

})();
