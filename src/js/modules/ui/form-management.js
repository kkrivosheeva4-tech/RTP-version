// form-management.js — ES module
// Управление формами: события и обработчики

import { DOMCache } from '../core/dom-utils.js';

  function getDependency(name) {
    if (typeof window === "undefined" || !window[name]) {
      throw new Error(`Зависимость ${name} не загружена. Подключите необходимые модули перед form-management.js`);
    }
    return window[name];
  }

  function getDOMCache() {
    return DOMCache;
  }

  function getStateAccessors() {
    if (typeof window !== 'undefined' && window.StateAccessors) {
      return window.StateAccessors;
    }
    return null;
  }

  function getDataLoader() {
    if (typeof window !== 'undefined' && window.DataLoader) {
      return window.DataLoader;
    }
    if (window.Logger) window.Logger.warn('DataLoader не загружен, попробуйте позже');
    return null;
  }

  function getDataService() {
    if (typeof window !== 'undefined' && window.DataService) {
      return window.DataService;
    }
    return null;
  }

  function getModerationFlow() {
    if (typeof window !== 'undefined' && window.ModerationFlow) {
      return window.ModerationFlow;
    }
    return null;
  }

  function isProposalOnlyMode() {
    const moderationFlow = getModerationFlow();
    return Boolean(moderationFlow && typeof moderationFlow.isProposalOnlyMode === 'function' && moderationFlow.isProposalOnlyMode());
  }

  function getPositioning() {
    if (typeof window !== 'undefined' && window.Positioning) {
      return window.Positioning;
    }
    throw new Error('Positioning не загружен');
  }

  // Helper функция для получения значения поля формы через DOMCache
  function getFormFieldValue(fieldId) {
    const DOMCache = getDOMCache();
    const field = DOMCache.get(fieldId);
    return field ? field.value : '';
  }

  // ===== FORM EVENTS =====
  // Инициализация обработчиков событий для форм
  function initFormEvents() {
    const DOMCache = getDependency("DOMCache");

    // ===== VENDORS -> INTEGRATORS (multi vendors, integrators per vendor) =====
    function parseSelectedVendors(raw) {
      const s = String(raw || "").trim();
      if (!s) return [];
      let arr = [];
      if (s.startsWith("[")) {
        try {
          const parsed = JSON.parse(s);
          arr = Array.isArray(parsed)
            ? parsed.map(x => String(x || "").trim()).filter(Boolean)
            : [];
        } catch (e) {
          return [];
        }
      } else {
        arr = [s].map(x => String(x || "").trim()).filter(Boolean);
      }
      // Дедупликация по нормализованному имени (избегаем дублирования строк вендоров)
      const seen = new Set();
      return arr.filter((v) => {
        const norm = v.trim().toLowerCase();
        if (seen.has(norm)) return false;
        seen.add(norm);
        return true;
      });
    }

    function vendorKeyFromName(name) {
      return encodeURIComponent(String(name || "").trim()).replace(/%/g, "_");
    }

    function getIntegratorsListFromState() {
      try {
        if (window.StateManager && typeof window.StateManager.get === "function") {
          const list = window.StateManager.get("integratorsList");
          if (Array.isArray(list)) return list.slice();
        }
      } catch (e) { /* ignore */ }
      return [];
    }

    // Получить полный список интеграторов (JSON + localStorage) для селектов по вендорам
    async function getIntegratorsListForModal() {
      if (window.VendorsFiles && typeof window.VendorsFiles.loadIntegratorsList === "function") {
        try {
          const list = await window.VendorsFiles.loadIntegratorsList();
          return Array.isArray(list) ? list : [];
        } catch (e) { /* ignore */ }
      }
      return getIntegratorsListFromState();
    }

    function setGroupVisible(groupId, visible) {
      const el = document.getElementById(groupId);
      if (!el) return;
      el.style.display = visible ? "" : "none";
    }

    let _renderVendorIntegratorsBusy = false;
    async function renderVendorIntegrators(prefix, existingVendors) {
      if (_renderVendorIntegratorsBusy) return;
      _renderVendorIntegratorsBusy = true;
      try {
        return await _renderVendorIntegratorsImpl(prefix, existingVendors);
      } finally {
        _renderVendorIntegratorsBusy = false;
      }
    }
    async function _renderVendorIntegratorsImpl(prefix, existingVendors) {
      const vendorsFieldId = prefix === "edit" ? "editVendors" : "techVendors";
      const groupId = prefix === "edit" ? "editVendorIntegratorsGroup" : "techVendorIntegratorsGroup";
      const containerId = prefix === "edit" ? "editVendorIntegratorsByVendor" : "techVendorIntegratorsByVendor";
      const container = document.getElementById(containerId);
      if (!container) return;

      const selectedVendors = parseSelectedVendors(getFormFieldValue(vendorsFieldId));
      if (selectedVendors.length === 0) {
        setGroupVisible(groupId, false);
        container.innerHTML = "";
        return;
      }

      setGroupVisible(groupId, true);

      // Сохраняем текущие значения интеграторов ПЕРЕД очисткой контейнера
      const savedIntegratorsValues = new Map();
      container.querySelectorAll('input[type="hidden"][id^="' + prefix + 'VendorIntegrators__"]').forEach(input => {
        const fieldId = input.id;
        const value = input.value || '';
        if (value) {
          const vendorKey = fieldId.replace(prefix + 'VendorIntegrators__', '');
          savedIntegratorsValues.set(vendorKey.toLowerCase(), value);
          savedIntegratorsValues.set(vendorKey, value); // сохраняем и без lowerCase для совместимости
        }
      });

      // При переименовании вендора — переносим интеграторы со старого ключа на новый
      const renameMap = window._lastVendorRenameMap || null;
      if (window._lastVendorRenameMap) window._lastVendorRenameMap = null;

      container.innerHTML = "";

      // Используем полный список интеграторов (JSON + localStorage) для корректного отображения
      const integratorsList = await getIntegratorsListForModal();
      const existingMap = new Map();
      (Array.isArray(existingVendors) ? existingVendors : []).forEach(v => {
        const vn = (v && typeof v === "object") ? String(v.name || "").trim() : String(v || "").trim();
        if (!vn) return;
        const ints = (v && typeof v === "object" && Array.isArray(v.integrators)) ? v.integrators : [];
        const names = ints
          .map(i => (i && typeof i === "object" ? i.name : i))
          .map(x => String(x || "").trim())
          .filter(Boolean);
        existingMap.set(vn.toLowerCase(), names);
      });

      selectedVendors.forEach(vendorName => {
        const key = vendorKeyFromName(vendorName);
        const fieldId = `${prefix === "edit" ? "edit" : "tech"}VendorIntegrators__${key}`;

        const row = document.createElement("div");
        row.className = "vendor-integrators-row";
        row.style.marginBottom = "10px";

        const title = document.createElement("div");
        title.style.fontWeight = "600";
        title.style.marginBottom = "6px";
        title.textContent = vendorName;

        const select = document.createElement("div");
        select.className = "custom-select-modal";
        select.setAttribute("data-field", fieldId);
        select.setAttribute("tabindex", "0");
        select.innerHTML = `
          <div class="select-trigger">
            <span class="selected-text">Выберите</span>
            <svg class="arrow" width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 5L6 8L9 5" stroke="#666" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path>
            </svg>
          </div>
          <ul class="select-options"></ul>
        `;

        const hidden = document.createElement("input");
        hidden.type = "hidden";
        hidden.id = fieldId;
        hidden.name = fieldId;

        row.appendChild(title);
        row.appendChild(select);
        row.appendChild(hidden);
        container.appendChild(row);

        if (window.Filters && typeof window.Filters.populateSelectForModal === "function") {
          window.Filters.populateSelectForModal(fieldId, integratorsList, "Выберите");
        }

        // Восстанавливаем значение: сначала из existingMap (если передано), затем из savedIntegratorsValues
        const vendorKey = vendorKeyFromName(vendorName);
        let pre = existingMap.get(vendorName.toLowerCase()) || [];

        // При переименовании вендора — берём интеграторы со старого ключа
        let savedValue = savedIntegratorsValues.get(vendorKey.toLowerCase()) || savedIntegratorsValues.get(vendorKey);
        if (renameMap && renameMap.oldName && renameMap.newName) {
          const norm = (s) => String(s || '').trim().toLowerCase();
          if (norm(vendorName) === norm(renameMap.newName)) {
            const oldKey = vendorKeyFromName(renameMap.oldName);
            savedValue = savedValue || savedIntegratorsValues.get(oldKey.toLowerCase()) || savedIntegratorsValues.get(oldKey);
          }
        }

        if (savedValue) {
          try {
            // Пытаемся распарсить сохраненное значение
            if (savedValue.trim().startsWith('[')) {
              const parsed = JSON.parse(savedValue);
              if (Array.isArray(parsed) && parsed.length > 0) {
                pre = parsed;
              }
            } else if (savedValue.trim()) {
              pre = [savedValue.trim()];
            }
          } catch (e) {
            // Если не удалось распарсить, используем значение из existingMap
          }
        }

        if (typeof window.setCustomSelectValue === "function") {
          // Используем requestAnimationFrame для гарантии, что DOM обновлен
          requestAnimationFrame(() => {
            window.setCustomSelectValue(fieldId, pre);
          });
        } else {
          hidden.value = pre.length ? JSON.stringify(pre) : "";
        }
      });
    }

    // Hook vendors changes to re-render vendor->integrators rows (debounce для предотвращения дублирования)
    let renderVendorIntegratorsTimer = null;
    const scheduleRenderVendorIntegrators = (p) => {
      if (renderVendorIntegratorsTimer) clearTimeout(renderVendorIntegratorsTimer);
      renderVendorIntegratorsTimer = setTimeout(() => {
        renderVendorIntegratorsTimer = null;
        renderVendorIntegrators(p);
      }, 50);
    };
    ["tech", "edit"].forEach((p) => {
      const vendorsFieldId = p === "edit" ? "editVendors" : "techVendors";
      const el = document.getElementById(vendorsFieldId);
      if (el && el.dataset.vendorIntegratorsHooked !== "true") {
        el.dataset.vendorIntegratorsHooked = "true";
        el.addEventListener("change", () => scheduleRenderVendorIntegrators(p), false);
        el.addEventListener("input", () => scheduleRenderVendorIntegrators(p), false);
      }
      setTimeout(() => renderVendorIntegrators(p), 0);
    });

    // ===== HOLDING WIDE CHECKBOX HANDLER =====
    // Обработчик для галочки "Применима в холдинге"
    const holdingWideCheckbox = document.getElementById('techHoldingWide');
    if (holdingWideCheckbox) {
      holdingWideCheckbox.addEventListener('change', () => {
        const techCompanyField = document.getElementById('techCompany');
        const holdingWideChecked = holdingWideCheckbox.checked;

        if (holdingWideChecked) {
          // Если отмечена "Применима в холдинге", очищаем выбор предприятий
          if (typeof window.setCustomSelectValue === 'function') {
            window.setCustomSelectValue('techCompany', []);
          } else if (techCompanyField) {
            techCompanyField.value = '';
          }
        }
      });
    }

    // ===== LIVE PRIORITY PREVIEW (EDIT FORM) =====
    function parseLeadingInt(value) {
      if (value === undefined || value === null) return null;
      const s = String(value).trim();
      if (!s) return null;
      const m = s.match(/^(\d+)/);
      if (!m) return null;
      const n = parseInt(m[1], 10);
      return Number.isFinite(n) ? n : null;
    }

    function safeParseArrayOrString(raw) {
      const s = (raw ?? "").toString().trim();
      if (!s) return [];
      try {
        if (s.startsWith("[")) {
          const parsed = JSON.parse(s);
          return Array.isArray(parsed) ? parsed : [];
        }
      } catch (e) {
        // ignore
      }
      return [s];
    }

    function updateEditTechPriorityPreview() {
      // Функция отключена - приоритеты больше не используются
      return;
    }

    // ===== ФОРМЫ =====
    function updateFunctionPlaceholders() {
      const container = document.getElementById("functionsContainer");
      if (!container) return;
      const rows = container.querySelectorAll(".function-row");
      rows.forEach((r, i) => {
        const inp = r.querySelector("input");
        if (inp) inp.placeholder = `Функция ${i + 1}`;
      });
    }

    const addFunctionRow = document.getElementById("addFunctionRow");
    if (addFunctionRow) {
      addFunctionRow.onclick = () => {
        const container = document.getElementById("functionsContainer");
        if (!container) return;
        const count = container.querySelectorAll(".function-row").length;
        if (count >= 20) return;
        const row = document.createElement("div");
        row.className = "function-row";
        row.style.display = "flex";
        row.style.gap = "8px";
        row.style.alignItems = "center";
        row.style.marginTop = "6px";
        const input = document.createElement("input");
        input.type = "text";
        input.placeholder = `Функция ${count + 1}`;
        input.style.flex = "1";
        const removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.className = "remove-fn-btn";
        removeBtn.setAttribute("data-tooltip", "Удалить функцию");
        removeBtn.setAttribute("aria-label", "Удалить функцию");
        removeBtn.textContent = "×";
        removeBtn.addEventListener("click", (ev) => {
          ev.stopPropagation();
          ev.preventDefault();
          row.remove();
          updateFunctionPlaceholders();
        });
        row.appendChild(input);
        row.appendChild(removeBtn);
        container.appendChild(row);
      };
    }

    const cancelAdd = document.getElementById("cancelAdd");
    if (cancelAdd) {
      cancelAdd.onclick = () => {
        // Сбрасываем форму и очищаем состояние при отмене
        if (window.TechTabsManager) {
          if (typeof window.TechTabsManager.resetForm === 'function') {
            window.TechTabsManager.resetForm();
          }
          if (typeof window.TechTabsManager.clearFormState === 'function') {
            window.TechTabsManager.clearFormState();
          }
        }

        if (typeof window.hideModal === "function") {
          window.hideModal("addTechPanel");
        }
      };
    }

    const cancelEdit = document.getElementById("cancelEdit");
    if (cancelEdit) {
      cancelEdit.onclick = (e) => {
        e.stopPropagation();
        const panel = document.getElementById("editTechPanel");
        if (!panel) return;

        if (
          typeof window.isFormDirty === "function" &&
          typeof window.showInternalConfirm === "function" &&
          typeof window.hideModal === "function"
        ) {
          const form = panel.querySelector("form");
          if (window.isFormDirty(form)) {
            window.showInternalConfirm(
              "Вы заполнили/изменили некоторые поля. Уверены, что хотите закрыть? Все изменения будут потеряны.",
              () => {
                form?.reset();
                if (
                  typeof window.resetCustomSelects === "function"
                ) {
                  window.resetCustomSelects("edit");
                }
              },
              panel
            );
          } else {
            window.hideModal(panel);
          }
        } else if (typeof window.hideModal === "function") {
          window.hideModal(panel);
        }
      };
    }

    const cancelAddBlock = document.getElementById("cancelAddBlock");
    if (cancelAddBlock) {
      cancelAddBlock.onclick = () => {
        if (typeof window.hideModal === "function") {
          window.hideModal("addBlockPanel");
        }
      };
    }

    // Обработчик confirmDeleteBtn назначается централизованно в app-init.js (initDeleteHandlers).

    const cancelDeleteBtn = document.getElementById("cancelDeleteBtn");
    if (cancelDeleteBtn) {
      cancelDeleteBtn.onclick = () => {
        if (typeof window.hideModal === "function") {
          window.hideModal("deleteConfirmModal");
        }
      };
    }

    const closeDeleteConfirm = document.getElementById("closeDeleteConfirm");
    if (closeDeleteConfirm) {
      closeDeleteConfirm.onclick = () => {
        if (typeof window.hideModal === "function") {
          window.hideModal("deleteConfirmModal");
        }
      };
    }

    // Обработчик формы добавления технологии
    const addTechForm = document.getElementById("addTechForm");
    if (addTechForm) {
      addTechForm.onsubmit = (e) => {
        e.preventDefault();
        // Логика обработки формы будет в RMK2.js или forms.js
        // Здесь только предотвращаем стандартное поведение
        if (typeof window.handleAddTechFormSubmit === "function") {
          window.handleAddTechFormSubmit(e);
        }
      };

      // Живая проверка дубликата названия при вводе (сообщение под полем)
      const techNameInput = document.getElementById("techName");
      const techNameErrorEl = document.getElementById("techNameError");
      const submitAddBtn = document.getElementById("submitAddTech");
      if (techNameInput && typeof window.validateDuplicateTechnology === "function") {
        var addNameDebounceTimer;
        function checkAddNameDuplicate() {
          var name = techNameInput.value;
          var result = window.validateDuplicateTechnology(name, null);
          if (!result.valid && result.message) {
            techNameInput.classList.add("duplicate-name-error");
            if (submitAddBtn) submitAddBtn.disabled = true;
            if (techNameErrorEl) {
              techNameErrorEl.textContent = result.message;
              techNameErrorEl.classList.add("visible");
            }
          } else {
            techNameInput.classList.remove("duplicate-name-error");
            if (submitAddBtn) submitAddBtn.disabled = false;
            if (techNameErrorEl) {
              techNameErrorEl.textContent = "";
              techNameErrorEl.classList.remove("visible");
            }
          }
        }
        techNameInput.addEventListener("input", function () {
          clearTimeout(addNameDebounceTimer);
          addNameDebounceTimer = setTimeout(checkAddNameDuplicate, 400);
        });
        techNameInput.addEventListener("blur", checkAddNameDuplicate);
      }
    }

    // Обработчик формы редактирования технологии
    const editTechForm = document.getElementById("editTechForm");
    if (editTechForm) {
      editTechForm.onsubmit = (e) => {
        e.preventDefault();
        // Логика обработки формы будет в RMK2.js или forms.js
        if (typeof window.handleEditTechFormSubmit === "function") {
          window.handleEditTechFormSubmit(e);
        }
      };

      // Живой пересчёт приоритета при изменении полей в форме редактирования.
      // Важно: custom-select'ы триггерят change на скрытых input'ах (см. select-events.js).
      editTechForm.addEventListener("change", (e) => {
        // Ограничиваемся изменениями внутри формы (на всякий случай).
        if (!e || !e.target) return;
        updateEditTechPriorityPreview();
      });

      // Живая проверка дубликата названия при редактировании (сообщение под полем)
      var editNameInput = document.getElementById("editName");
      var editNameErrorEl = document.getElementById("editNameError");
      var editSubmitBtn = editTechForm.querySelector('button[type="submit"]');
      if (editNameInput && typeof window.validateDuplicateTechnology === "function") {
        var editNameDebounceTimer;
        function checkEditNameDuplicate() {
          var newName = editNameInput.value;
          var editIdEl = document.getElementById("editId");
          var excludeId = editIdEl && editIdEl.value !== "" && editIdEl.value !== undefined ? +editIdEl.value : null;
          var result = window.validateDuplicateTechnology(newName, excludeId);
          if (!result.valid && result.message) {
            editNameInput.classList.add("duplicate-name-error");
            if (editSubmitBtn) editSubmitBtn.disabled = true;
            if (editNameErrorEl) {
              editNameErrorEl.textContent = result.message;
              editNameErrorEl.classList.add("visible");
            }
          } else {
            editNameInput.classList.remove("duplicate-name-error");
            if (editSubmitBtn) editSubmitBtn.disabled = false;
            if (editNameErrorEl) {
              editNameErrorEl.textContent = "";
              editNameErrorEl.classList.remove("visible");
            }
          }
        }
        editNameInput.addEventListener("input", function () {
          clearTimeout(editNameDebounceTimer);
          editNameDebounceTimer = setTimeout(checkEditNameDuplicate, 400);
        });
        editNameInput.addEventListener("blur", checkEditNameDuplicate);
      }
    }

    // ===== ОБРАБОТЧИКИ КНОПОК РЕДАКТИРОВАНИЯ И УДАЛЕНИЯ =====
    // Обработчики кнопок редактирования и удаления через делегирование событий
    // Используем делегирование, так как элементы могут быть созданы динамически
    document.addEventListener("click", (e) => {
      if (e.target.closest("#editTechBtn")) {
        if (
          typeof window.getCurrentTech !== "function" ||
          !window.ModerationFlow ||
          typeof window.ModerationFlow.canSubmitTechnologyChanges !== "function"
        )
          return;
        const currentTech = window.getCurrentTech();
        if (!window.ModerationFlow.canSubmitTechnologyChanges() || !currentTech) return;
        const f = document.getElementById("editTechForm");
        if (!f) return;
        // Сбрасываем предыдущий snapshot, если он был
        if (f.dataset.initial) delete f.dataset.initial;

        f.querySelector("#editId").value = currentTech.id;
        f.querySelector("#editName").value = currentTech.name;
        if (typeof window.setCustomSelectValue === "function") {
          // Заполняем направления цифрового развития
          // Преобразуем ID направлений в названия для отображения в селекте
          let directionsToSet = [];
          const directionsFromTech = currentTech.directions && currentTech.directions.length
            ? currentTech.directions
            : currentTech.direction
              ? [currentTech.direction]
              : [];

          // Получаем список направлений для преобразования ID в названия
          const digitalDirections = window.StateManager && typeof window.StateManager.get === 'function'
            ? window.StateManager.get('digitalDirections') || []
            : (window.digitalDirections || []);

          // Преобразуем ID в названия
          directionsToSet = directionsFromTech.map(dirId => {
            // Если уже строка (название), возвращаем как есть
            if (typeof dirId === 'string') {
              return dirId;
            }
            // Если число (ID), ищем название
            const id = typeof dirId === 'number' ? dirId : Number(dirId);
            if (!isNaN(id)) {
              const direction = digitalDirections.find(d =>
                d && typeof d === 'object' && d.id === id
              );
              return direction && direction.name ? direction.name : dirId;
            }
            return dirId;
          }).filter(Boolean);

          window.setCustomSelectValue(
            "editDirections",
            directionsToSet
          );
          // Вызываем renderMultiSelectTags для отображения тегов множественного выбора направлений
          const editDirectionsSelect = document.querySelector(
            '.custom-select-modal[data-field="editDirections"]'
          );
          if (
            editDirectionsSelect &&
            typeof window.renderMultiSelectTags === "function"
          ) {
            setTimeout(() => {
              window.renderMultiSelectTags(editDirectionsSelect);
            }, 50);
          }
          const selectedBlocks = currentTech.blocks && currentTech.blocks.length
            ? currentTech.blocks
            : currentTech.block
              ? [currentTech.block]
              : [];

          window.setCustomSelectValue(
            "editBlock",
            selectedBlocks
          );

          // Фильтруем функции по выбранному блоку перед установкой значения
          if (selectedBlocks.length > 0 && typeof window.updateModalFunctionsForBlocks === 'function') {
            window.updateModalFunctionsForBlocks(selectedBlocks, 'editFunc');
          }

          // Устанавливаем функции после фильтрации
          setTimeout(() => {
            window.setCustomSelectValue(
              "editFunc",
              currentTech.functions && currentTech.functions.length
                ? currentTech.functions
                : currentTech.func
                  ? [currentTech.func]
                  : []
            );

            // Обновляем покрытие функций ПОСЛЕ установки функций
            // (поле read-only, рассчитывается автоматически от выбора функций)
            // Используем задержку, чтобы убедиться, что функции установлены
            if (
              window.AutoFuncCover &&
              typeof window.AutoFuncCover.calculateAndUpdateFuncCover === "function"
            ) {
              setTimeout(() => {
                window.AutoFuncCover.calculateAndUpdateFuncCover(
                  "editFunc",
                  "editBlock",
                  "editFuncCover"
                );
              }, 100);
            }
          }, 50);
          // Поля "Тип технологии" и "Статус" удалены из формы редактирования
          // Устанавливаем галочку "Применима в холдинге" или предприятия
          const holdingWideCheckbox = document.getElementById("editHoldingWide");
          const companies = Array.isArray(currentTech.company)
            ? currentTech.company
            : currentTech.company
              ? [currentTech.company]
              : [];

          // Проверяем, применима ли технология в холдинге
          const isHoldingWide = currentTech.holdingWide === true || currentTech.holdingWide === 'true';

          if (holdingWideCheckbox) {
            holdingWideCheckbox.checked = isHoldingWide;
          }

          // Если не применима в холдинге, устанавливаем предприятия
          if (!isHoldingWide) {
            window.setCustomSelectValue(
              "editCompany",
              companies.length > 0 ? companies : ""
            );
            // Вызываем renderMultiSelectTags для отображения тегов множественного выбора
            const editCompanySelect = document.querySelector(
              '.custom-select-modal[data-field="editCompany"]'
            );
            if (
              editCompanySelect &&
              typeof window.renderMultiSelectTags === "function"
            ) {
              setTimeout(() => {
                window.renderMultiSelectTags(editCompanySelect);
              }, 50);
            }

            // Загружаем данные предприятий в вкладки через EditTechTabsManager
            if (currentTech.companyRatings && companies.length > 0) {
              // Данные будут загружены после создания вкладок в EditTechTabsManager
              // См. код ниже после showModal
            }
          } else {
            // Если применима в холдинге, очищаем выбор предприятий
            window.setCustomSelectValue("editCompany", "");
          }
        }
        // Общие поля оценок
        const ratingOptions = {
          0: "0 — Не покрывает",
          1: "1 — Низкое покрытие",
          2: "2 — Среднее покрытие",
          3: "3 — Полное покрытие",
        };
        // Покрытие функций теперь рассчитывается автоматически на основе выбранных функций
        // Сначала устанавливаем начальное значение из данных технологии, затем пересчитаем после установки функций
        if (currentTech.funcCover !== undefined && currentTech.funcCover !== null) {
          if (window.AutoFuncCover && typeof window.AutoFuncCover.updateFuncCoverField === "function") {
            window.AutoFuncCover.updateFuncCoverField("editFuncCover", currentTech.funcCover);
          }
        }
        // Устанавливаем значение TRL в кастомный селект
        if (
          currentTech.trlStage !== undefined &&
          currentTech.trlStage !== null
        ) {
          const trlOptions = {
            1: "1-Исследовательская",
            2: "2-Прототип",
            3: "3-Технология готова к внедрению",
          };
          const trlValue = trlOptions[currentTech.trlStage];
          if (typeof window.setCustomSelectValue === "function") {
            if (trlValue) {
              window.setCustomSelectValue("editTrlStage", trlValue);
            } else {
              window.setCustomSelectValue("editTrlStage", "");
            }
          }
        } else {
          if (typeof window.setCustomSelectValue === "function") {
            window.setCustomSelectValue("editTrlStage", "");
          }
        }
        // cost + toggle visibility
        const costGroup = document.getElementById("editCostGroup");
        const costInput = document.getElementById("editCostProm");
        if (costInput) costInput.value = currentTech.costProm ?? "";
        if (costGroup) costGroup.style.display = "";
        f.querySelector("#editDesc").value = currentTech.description;
        const exampleDescEl = document.getElementById("editExampleDesc");
        if (exampleDescEl) exampleDescEl.value = currentTech.exampleDesc || "";
        // Вендоры + интеграторы по каждому вендору
        try {
          let vendorNames = Array.isArray(currentTech.vendors)
            ? currentTech.vendors.map(v => normalizeVendorName(v)).filter(Boolean)
            : [];
          // Дедупликация вендоров (избегаем дублирования блоков при открытии модалки редактирования)
          const seen = new Set();
          vendorNames = vendorNames.filter((v) => {
            const norm = v.trim().toLowerCase();
            if (seen.has(norm)) return false;
            seen.add(norm);
            return true;
          });
          // Обновляем селекты актуальным списком (включая вендоров/интеграторов из модалки добавления)
          const hiddenVendors = document.getElementById("editVendors");
          if (hiddenVendors) hiddenVendors.value = vendorNames.length ? JSON.stringify(vendorNames) : "";
          if (window.VendorsFiles && typeof window.VendorsFiles.updateVendorsSelects === "function") {
            window.VendorsFiles.updateVendorsSelects();
          }
          if (window.VendorsFiles && typeof window.VendorsFiles.updateIntegratorsSelects === "function") {
            window.VendorsFiles.updateIntegratorsSelects();
          }
          if (typeof window.setCustomSelectValue === "function") {
            window.setCustomSelectValue("editVendors", vendorNames);
          }
          // После установки вендоров — отрисуем блоки интеграторов и префиллим из currentTech.vendors
          setTimeout(() => {
            if (typeof renderVendorIntegrators === "function") {
              renderVendorIntegrators("edit", currentTech.vendors || []);
            }
          }, 0);
        } catch (e) {
          // ignore
        }
        // Загружаем файлы
        if (window.VendorsFiles) {
          if (currentTech.files && Array.isArray(currentTech.files)) {
            window.VendorsFiles.loadFilesIntoForm('editFilesList', currentTech.files, true);
          }
        }

        // Обновляем видимость полей оценок в зависимости от количества предприятий
        if (typeof window.updateEditTechRatingsVisibility === "function") {
          window.updateEditTechRatingsVisibility(currentTech);
        }

        // Обновляем авто-приоритет сразу после заполнения формы
        setTimeout(() => {
          updateEditTechPriorityPreview();
        }, 0);

        // Делаем snapshot ПОСЛЕ заполнения всех полей, но ДО открытия модального окна
        // Используем setTimeout, чтобы убедиться, что все DOM-обновления завершены
        setTimeout(() => {
          if (typeof window.snapshotFormInitial === "function") {
            window.snapshotFormInitial(f);
          }
          // Увеличиваем время игнорирования кликов, чтобы предотвратить закрытие при открытии
          if (typeof window.ignoreOutsideClickUntil !== "undefined") {
            window.ignoreOutsideClickUntil = Date.now() + 500;
          }
          if (typeof window.showModal === "function") {
            window.showModal("editTechPanel");

            // Логируем открытие модального окна редактирования технологии
            if (typeof window.appendAdminAudit === 'function' && currentTech) {
              window.appendAdminAudit('update', `Открыто модальное окно редактирования технологии: "${currentTech.name}" (ID: ${currentTech.id})`);
            }

            // Принудительно создаём вкладки предприятий после открытия окна
            setTimeout(() => {
              // Вызываем метод напрямую из EditTechTabsManager
              if (window.EditTechTabsManager && typeof window.EditTechTabsManager.updateTabs === 'function') {
                window.EditTechTabsManager.updateTabs();
              }

              // Также триггерим событие change для совместимости
              const editCompanyInput = document.getElementById("editCompany");
              if (editCompanyInput && editCompanyInput.value) {
                const event = new Event('change', { bubbles: true });
                editCompanyInput.dispatchEvent(event);
              }

              // Загружаем данные предприятий в созданные вкладки
              if (currentTech.companyRatings && window.EditTechTabsManager && typeof window.EditTechTabsManager.loadEnterpriseData === 'function') {
                setTimeout(() => {
                  window.EditTechTabsManager.loadEnterpriseData(currentTech.companyRatings);
                }, 150);
              }

              // Обновляем funcCover на основе выбранных функций (автоматический расчет)
              if (window.AutoFuncCover && typeof window.AutoFuncCover.calculateAndUpdateFuncCover === 'function') {
                setTimeout(() => {
                  window.AutoFuncCover.calculateAndUpdateFuncCover('editFunc', 'editBlock', 'editFuncCover');
                }, 300);
              }
            }, 200);
          }
        }, 0);
      }

      if (e.target.closest("#deleteTechBtn")) {
        if (
          typeof window.getCurrentTech !== "function" ||
          !window.ModerationFlow ||
          typeof window.ModerationFlow.canSubmitTechnologyChanges !== "function"
        )
          return;
        const currentTech = window.getCurrentTech();
        if (!window.ModerationFlow.canSubmitTechnologyChanges() || !currentTech) return;
        // Показываем модальное окно подтверждения
        const modal = document.getElementById("deleteConfirmModal");
        const messageEl = document.getElementById("deleteConfirmMessage");
        if (modal && messageEl && currentTech) {
          messageEl.textContent = `Вы уверены что хотите удалить технологию ${currentTech.name}?`;
          if (typeof window.showModal === "function") {
            window.showModal("deleteConfirmModal");
          }
        }
      }
    });
  }

  // ===== FORM HANDLERS =====
  // Обработчики форм для добавления и редактирования технологий, а также добавления блоков

  function normalizeVendorName(v) {
    if (v == null) return '';
    if (typeof v === 'object') {
      const n = v.name || v.id || '';
      return String(n).trim();
    }
    return String(v).trim();
  }

  function parseVendorsFromField(fieldId) {
    // Вендор(ы) выбираются в мультиселекте: JSON-массив строк в hidden input.
    // Интеграторы для каждого вендора хранятся в динамических hidden полях:
    // techVendorIntegrators__{key} / editVendorIntegrators__{key}
    let vendorNames = parseSelectedValuesFromModalSelect(fieldId);
    if (!Array.isArray(vendorNames)) vendorNames = [];
    if (vendorNames.length === 0) {
      const raw = getFormFieldValue(fieldId);
      const s = String(raw || '').trim();
      if (!s) vendorNames = [];
      else if (s.startsWith('[')) {
        try {
          const parsed = JSON.parse(s);
          vendorNames = Array.isArray(parsed) ? parsed.map(x => String(x || '').trim()).filter(Boolean) : [];
        } catch (e) {
          vendorNames = [];
        }
      } else {
        vendorNames = [s].map(x => String(x || '').trim()).filter(Boolean);
      }
    }
    // Дедупликация вендоров (сохраняем порядок, оставляем первое вхождение)
    const seen = new Set();
    vendorNames = vendorNames.filter((v) => {
      const norm = v.trim().toLowerCase();
      if (seen.has(norm)) return false;
      seen.add(norm);
      return true;
    });

    const prefix = fieldId.startsWith('edit') ? 'edit' : 'tech';
    const vendorKeyFromName = (name) => encodeURIComponent(String(name || '').trim()).replace(/%/g, '_');

    const vendors = vendorNames.map((name, idx) => {
      const key = vendorKeyFromName(name);
      const integratorsFieldId = `${prefix}VendorIntegrators__${key}`;
      // Prefer current UI state in dynamic selects over hidden input snapshot.
      const integratorNames = parseSelectedValuesFromModalSelect(integratorsFieldId, true);
      return {
        id: Date.now() + idx,
        name,
        integrators: integratorsToObjects(integratorNames),
      };
    });

    return vendors;
  }

  function parseStringArrayFromField(fieldId) {
    const raw = getFormFieldValue(fieldId);
    if (!raw || !String(raw).trim()) return [];
    const s = String(raw).trim();
    if (s.startsWith('[')) {
      try {
        const parsed = JSON.parse(s);
        return Array.isArray(parsed)
          ? parsed.map(x => String(x || '').trim()).filter(Boolean)
          : [];
      } catch (e) {
        return [];
      }
    }
    return [s].map(x => String(x || '').trim()).filter(Boolean);
  }

  function parseSelectedValuesFromModalSelect(fieldId, fallbackToHidden = false) {
    const select = document.querySelector(`.custom-select-modal[data-field="${fieldId}"]`);
    if (select) {
      const optionLis = Array.from(select.querySelectorAll('.select-options li.select-option-item'));
      const selected = optionLis
        .filter(li => li.classList.contains('selected'))
        .map(li => li.getAttribute('data-value'))
        .filter(Boolean)
        .map(v => String(v).trim())
        .filter(Boolean);
      const deduped = [...new Set(selected)];
      // If the select exists, trust UI state even when the result is an empty array.
      if (optionLis.length > 0) return deduped;
    }
    return fallbackToHidden ? parseStringArrayFromField(fieldId) : [];
  }

  function integratorsToObjects(names) {
    const arr = Array.isArray(names) ? names : [];
    return arr
      .map((n, idx) => ({ id: Date.now() + idx, name: String(n || '').trim() }))
      .filter(x => x.name);
  }

  function mergeVendorsPreservingIntegrators(existingVendors, selectedVendors) {
    // Для мультивыбора: сохраняем integrators у тех вендоров, которые остались выбранными,
    // если для них не выбраны новые интеграторы (через динамические поля).
    const existing = Array.isArray(existingVendors) ? existingVendors : [];
    const selected = Array.isArray(selectedVendors) ? selectedVendors : [];

    const existingByName = new Map();
    existing.forEach(v => {
      const n = normalizeVendorName(v);
      if (!n) return;
      existingByName.set(n.toLowerCase(), v);
    });

    return selected.map((v, idx) => {
      const name = normalizeVendorName(v);
      if (!name) return null;
      const prev = existingByName.get(name.toLowerCase());
      if (prev && typeof prev === 'object') {
        // integrators уже сформированы из динамических полей в parseVendorsFromField,
        // но если там пусто — оставим старые.
        const nextIntegrators = Array.isArray(v.integrators) ? v.integrators : [];
        return {
          id: prev.id != null ? prev.id : (v && typeof v === 'object' && v.id != null ? v.id : (Date.now() + idx)),
          name: prev.name ? String(prev.name).trim() : name,
          integrators: nextIntegrators.length ? nextIntegrators : (Array.isArray(prev.integrators) ? prev.integrators : [])
        };
      }
      return v;
    }).filter(Boolean);
  }

  /**
   * Включает или выключает состояние «загрузка» у кнопки (спиннер, disabled, aria-busy).
   * @param {HTMLButtonElement|null} btn - кнопка
   * @param {boolean} loading - true = показать спиннер и отключить кнопку
   * @param {string} [loadingText] - при loading: подпись (например «Сохранение…»)
   */
  function setButtonLoading(btn, loading, loadingText) {
    if (!btn) return;
    const textEl = btn.querySelector('.btn-text');
    if (loading) {
      btn.classList.add('loading');
      btn.disabled = true;
      btn.setAttribute('aria-busy', 'true');
      if (textEl && loadingText) textEl.textContent = loadingText;
    } else {
      btn.classList.remove('loading');
      btn.disabled = false;
      btn.removeAttribute('aria-busy');
      if (textEl && btn.dataset.defaultText) textEl.textContent = btn.dataset.defaultText;
    }
  }

  // Обработчик формы добавления технологии
  async function handleAddTechFormSubmit(e) {
    e.preventDefault();
    const DOMCache = getDOMCache();
    const StateAccessors = getStateAccessors();
    const DataLoader = getDataLoader();
    const Positioning = getPositioning();

    // Валидация дубликата названия технологии (регистр, омоглифы, пробелы)
    if (typeof window.validateDuplicateTechnology === "function") {
      const techName = getFormFieldValue("techName");
      const result = window.validateDuplicateTechnology(techName, null);
      if (!result.valid) {
        if (DataLoader && typeof DataLoader.showNotification === "function") {
          DataLoader.showNotification(result.message || "Технология с таким названием уже существует", false);
        }
        return;
      }
    }

    // Валидация формы через TechTabsManager
    if (window.TechTabsManager && typeof window.TechTabsManager.validateForm === 'function') {
      const validation = window.TechTabsManager.validateForm();
      if (!validation.valid) {
        if (typeof window.TechTabsManager.showValidationErrors === 'function') {
          window.TechTabsManager.showValidationErrors(validation.fieldErrors || {});
        }
        DataLoader.showNotification('Заполните обязательные поля, отмеченные в форме', false);
        return;
      }
    }

    // Валидация поля "Область применения" - должна быть либо галочка, либо выбрано предприятие
    const holdingWideCheckbox = document.getElementById('techHoldingWide');
    const techCompanyField = document.getElementById('techCompany');
    const holdingWideChecked = holdingWideCheckbox && holdingWideCheckbox.checked;
    const companiesSelected = techCompanyField && techCompanyField.value && techCompanyField.value.trim();

    if (!holdingWideChecked && !companiesSelected) {
      DataLoader.showNotification('Пожалуйста, отметьте "Применима в холдинге" или выберите конкретные предприятия', false);
      return;
    }

    const submitAddBtn = document.getElementById('submitAddTech');
    setButtonLoading(submitAddBtn, true, 'Добавление…');
    await new Promise(function (r) { setTimeout(r, 1500); });
    try {
    // Получаем глобальные переменные
    const RINGS = window.RINGS || [];
    const QUADRANTS = window.QUADRANTS || [];
    const levelToRing = window.levelToRing || {};
    const StateManager = window.StateManager;
    if (!StateManager) throw new Error('StateManager не загружен');
    let nextId = StateManager.get('nextId') || 1;

    const rawSector = getFormFieldValue("techSector");
    let sectorVal = rawSector;
    try {
      if (rawSector && rawSector.trim().startsWith('[')) {
        sectorVal = JSON.parse(rawSector);
      }
    } catch (err) {
      sectorVal = rawSector;
    }
    const sectorArray = Array.isArray(sectorVal)
      ? sectorVal.map(s => (typeof s === 'string' ? s.trim() : s)).filter(Boolean)
      : ((typeof sectorVal === 'string' && sectorVal.trim()) ? [sectorVal.trim()] : []);
    const sectorName = sectorArray.length > 0 ? sectorArray[0] : '';

    // Получаем направления цифрового развития
    const rawDirections = getFormFieldValue("techDirections");
    let directionsVal = rawDirections;
    try {
      if (rawDirections && rawDirections.trim().startsWith('[')) {
        directionsVal = JSON.parse(rawDirections);
      }
    } catch (err) {
      directionsVal = rawDirections;
    }
    const directionsArray = Array.isArray(directionsVal)
      ? directionsVal.map(d => (typeof d === 'string' ? d.trim() : d)).filter(Boolean)
      : ((typeof directionsVal === 'string' && directionsVal.trim()) ? [directionsVal.trim()] : []);

    const rawBlock = getFormFieldValue("techBlock");
    const rawFunc = getFormFieldValue("techFunc");
    // Поле "Статус" удалено из формы добавления, используем значение по умолчанию
    const selStatus = '';
    let blocksVal = rawBlock;
    let functionsVal = rawFunc;
    try {
      if (rawBlock && rawBlock.trim().startsWith('[')) blocksVal = JSON.parse(rawBlock);
    } catch (err) { /* ignore */ }
    try {
      if (rawFunc && rawFunc.trim().startsWith('[')) functionsVal = JSON.parse(rawFunc);
    } catch (err) { /* ignore */ }

    const rawBlockVal = Array.isArray(blocksVal)
      ? blocksVal.map(b => (typeof b === 'string' ? b.trim() : b))
      : (typeof blocksVal === 'string' ? blocksVal.trim() : blocksVal);
    const rawFuncVal = Array.isArray(functionsVal)
      ? functionsVal.map(f => (typeof f === 'string' ? f.trim() : f))
      : (typeof functionsVal === 'string' ? functionsVal.trim() : functionsVal);

    const rawCompany = getFormFieldValue("techCompany");
    let companiesVal = [];
    try {
      if (rawCompany && rawCompany.trim().startsWith('[')) {
        companiesVal = JSON.parse(rawCompany);
      } else if (rawCompany) {
        companiesVal = [rawCompany];
      }
    } catch (err) {
      if (rawCompany) companiesVal = [rawCompany];
    }
    // Предприятия теперь необязательное поле - не устанавливаем значение по умолчанию
    // Если не выбрано ни одного предприятия, оставляем пустым массивом
    // company: companiesVal.length === 1 ? companiesVal[0] : companiesVal,

    // Получаем TRL стадию и преобразуем в число
    const trlStageVal = getFormFieldValue("techTrlStage").trim();
    let trlStageNum = null;
    if (trlStageVal !== undefined && trlStageVal !== null && trlStageVal !== '' && String(trlStageVal).trim() !== '') {
      const trlMatch = String(trlStageVal).match(/^(\d+)/);
      if (trlMatch) {
        const trlNum = parseInt(trlMatch[1], 10);
        if (trlNum >= 1 && trlNum <= 3) {
          trlStageNum = trlNum;
        }
      }
    }

    const t = {
      id: nextId++,
      name: getFormFieldValue("techName").trim(),
      sector: sectorArray.length > 1 ? sectorArray : sectorName,
      directions: directionsArray.length > 0 ? directionsArray : [],
      direction: directionsArray.length > 0 ? directionsArray[0] : '',
      block: Array.isArray(rawBlockVal) ? (rawBlockVal[0] || '') : (rawBlockVal || ''),
      blocks: Array.isArray(rawBlockVal) ? rawBlockVal : (rawBlockVal ? [rawBlockVal] : []),
      func: Array.isArray(rawFuncVal) ? (rawFuncVal[0] || '') : (rawFuncVal || ''),
      functions: Array.isArray(rawFuncVal) ? rawFuncVal : (rawFuncVal ? [rawFuncVal] : []),
      techType: '',
      level: '',
      company: companiesVal.length > 0 ? (companiesVal.length === 1 ? companiesVal[0] : companiesVal) : [],
      holdingWide: holdingWideChecked,
      trlStage: trlStageNum,
      description: getFormFieldValue("techDesc").trim(),
      exampleDesc: getFormFieldValue('techExampleDesc').trim(),
      vendors: parseVendorsFromField('techVendors'),
      files: []
    };

    // Интеграторы выбираются для каждого вендора в динамических полях (см. parseVendorsFromField)

    // Обработка файлов
    const filesValue = getFormFieldValue('techFiles');
    if (filesValue && filesValue.trim()) {
      try {
        const files = JSON.parse(filesValue);
        if (Array.isArray(files) && files.length > 0) {
          t.files = files;
        }
      } catch (e) {
        if (window.Logger) window.Logger.warn('Ошибка при парсинге файлов', e);
      }
    }

    t.level = selStatus || ((RINGS && RINGS.length) ? RINGS[0] : 'Используемые');
    t.status = t.level;

    const costVal = Number(getFormFieldValue('techCostProm'));
    if (!Number.isNaN(costVal)) t.costProm = costVal; else delete t.costProm;

    // Получаем покрытие функций из формы (автоматически рассчитанное значение)
    let funcCoverVal = 0;
    if (window.AutoFuncCover && typeof window.AutoFuncCover.getFuncCoverValue === "function") {
      funcCoverVal = window.AutoFuncCover.getFuncCoverValue("techFuncCover");
    } else {
      // Fallback: читаем из поля напрямую
      const funcCoverField = document.getElementById("techFuncCover");
      if (funcCoverField) {
        const dataValue = funcCoverField.getAttribute("data-value");
        if (dataValue !== null) {
          funcCoverVal = parseInt(dataValue, 10);
        } else {
          // Пробуем извлечь из текста
          const text = funcCoverField.value || "";
          const match = text.match(/^(\d+)/);
          if (match) {
            funcCoverVal = parseInt(match[1], 10);
          }
        }
      }
    }
    if (!isNaN(funcCoverVal) && funcCoverVal >= 0 && funcCoverVal <= 3) {
      t.funcCover = funcCoverVal;
    }

    // Получаем данные из вкладок предприятий через TechTabsManager
    let enterprisesData = [];
    if (window.TechTabsManager && typeof window.TechTabsManager.getAllEnterpriseData === 'function') {
      const enterpriseTabsData = window.TechTabsManager.getAllEnterpriseData();

      // Преобразуем данные в формат для сохранения
      Object.entries(enterpriseTabsData).forEach(([enterpriseName, data]) => {
        // Получаем enterpriseId из списка предприятий, если доступен
        let enterpriseId = null;
        if (window.StateManager && typeof window.StateManager.get === 'function') {
          const enterprisesList = window.StateManager.get('enterprisesList') || [];
          const enterprise = enterprisesList.find(e => {
            const name = (typeof e === 'object' && e.name) ? e.name : (typeof e === 'string' ? e : '');
            return name === enterpriseName;
          });
          if (enterprise) {
            enterpriseId = (typeof enterprise === 'object' && enterprise.id !== undefined) ? enterprise.id : null;
          }
        }

        enterprisesData.push({
          name: enterpriseName,
          enterpriseId: enterpriseId,
          technologicalReadiness: data.technologicalReadiness !== undefined && data.technologicalReadiness !== null ? Number(data.technologicalReadiness) : null,
          organizationalReadiness: data.organizationalReadiness !== undefined && data.organizationalReadiness !== null ? Number(data.organizationalReadiness) : null,
          ...(typeof data.isImplemented === 'boolean' ? { isImplemented: data.isImplemented } : {})
        });
      });
    }

    // Добавляем данные предприятий в объект технологии
    if (enterprisesData.length > 0) {
      t.enterprises = enterprisesData;

      // Преобразуем enterprises в companyRatings для совместимости с detail-panel
      t.companyRatings = {};
      enterprisesData.forEach(ent => {
        if (ent.name) {
          t.companyRatings[ent.name] = {
            techRead: ent.technologicalReadiness !== null && ent.technologicalReadiness !== undefined ? ent.technologicalReadiness : null,
            organRead: ent.organizationalReadiness !== null && ent.organizationalReadiness !== undefined ? ent.organizationalReadiness : null,
            ...(typeof ent.isImplemented === 'boolean' ? { isImplemented: ent.isImplemented } : {})
          };
        }
      });
    }
    // TRL стадия (trlStage) теперь сохраняется при добавлении технологии

    // Поле "Тип технологии" удалено из формы добавления
    t.techType = '';
    // Используем форму по умолчанию (круг)
    t.shape = 'circle';

    if (isProposalOnlyMode()) {
      const moderationFlow = getModerationFlow();
      try {
        await moderationFlow.createProposal('create', { tech: t });
      } catch (err) {
        if (window.Logger) window.Logger.warn('Не удалось отправить предложение на создание', err);
        DataLoader.showNotification((err && err.message) ? err.message : 'Не удалось отправить предложение на модерацию', false);
        return;
      } finally {
        setButtonLoading(submitAddBtn, false);
      }

      if (window.TechTabsManager && typeof window.TechTabsManager.clearFormState === 'function') {
        window.TechTabsManager.clearFormState();
      }
      if (window.TechTabsManager && typeof window.TechTabsManager.resetForm === 'function') {
        window.TechTabsManager.resetForm();
      }
      if (typeof window.hideModal === 'function') {
        window.hideModal('addTechPanel');
      }
      return;
    }

    const blockKeyForLookup = (t.blocks && t.blocks.length) ? (typeof t.blocks[0] === 'string' ? t.blocks[0].trim() : t.blocks[0]) : (typeof t.block === 'string' ? t.block.trim() : t.block);
    t.block = blockKeyForLookup;
    const blocksList = StateAccessors.getBlocksList();

    // Добавляем блок в список, если его там нет (без привязки к квадранту)
    if (!blocksList.includes(blockKeyForLookup)) {
      StateAccessors.setBlocksList([...blocksList, blockKeyForLookup]);
      const sidebarSelect = DOMCache.find('.custom-select[data-filter="block"] .select-options');
      if (sidebarSelect) {
        const li = document.createElement('li'); li.textContent = blockKeyForLookup; li.setAttribute('data-value', blockKeyForLookup);
        sidebarSelect.appendChild(li);
      }
      const modalSelects = DOMCache.queryAll('.custom-select-modal[data-field="techBlock"], .custom-select-modal[data-field="editBlock"]');
      modalSelects.forEach(ms => {
        const opts = ms.querySelector('.select-options');
        if (opts) {
          const li = document.createElement('li');
          li.classList.add('select-option-item');
          li.setAttribute('data-value', blockKeyForLookup);
          const escapedBlock = (typeof window.escapeHtml === 'function' ? window.escapeHtml(blockKeyForLookup) : String(blockKeyForLookup));
          li.innerHTML = `<label class="option-label"><input type="checkbox" class="option-checkbox" /><span>${escapedBlock}</span></label>`;
          opts.appendChild(li);
        }
      });
      try {
        const DataService = getDataService();
        if (DataService && typeof DataService.saveReference === 'function') {
          const list = StateAccessors.getBlocksList() || [];
          const blocks = list.map((b, i) => typeof b === 'object' ? b : { id: i + 1, name: b });
          await DataService.saveReference('blocks', blocks);
        } else if (DataLoader && typeof DataLoader.vfsWrite === 'function') {
          DataLoader.vfsWrite('blocks.json', StateAccessors.getBlocksList());
        }
      } catch (err) { if (window.Logger) window.Logger.warn('Не удалось сохранить новый блок', err); }
    }

    if (!levelToRing || !Object.prototype.hasOwnProperty.call(levelToRing, t.level)) {
      if (window.Logger) window.Logger.warn('addTech: level mapping missing for', t.level, '— defaulting to "Существующие"');
      t.level = (RINGS && RINGS.length) ? RINGS[0] : 'Используемые';
    }

    Positioning.computeCoordinates(t);

    // Получаем квадранты технологии на основе направлений
    let techQuadrants = typeof Positioning.getAllQuadrantsForTech === 'function'
      ? Positioning.getAllQuadrantsForTech(t)
      : [];

    try {
      if (window.Logger) window.Logger.debug('addTech: new tech BEFORE persist', { id: t.id, name: t.name, block: t.block, quadrants: techQuadrants, level: t.level, ring: levelToRing[t.level], x: t.x, y: t.y });
    } catch (e) { /* ignore */ }

    StateManager.set('nextId', nextId);

    // Получаем или создаем quadrantsCache
    let quadrantsCache = StateAccessors.getQuadrantsCache();
    if (!quadrantsCache) {
      // Создаем новый Map если кэш не существует
      quadrantsCache = new Map();
      // Устанавливаем через StateManager напрямую
      try {
        if (StateManager && StateManager.set) {
          StateManager.set('quadrantsCache', quadrantsCache);
        }
        // Также пробуем установить через window для обратной совместимости
        if (window.setQuadrantsCache && typeof window.setQuadrantsCache === 'function') {
          window.setQuadrantsCache(quadrantsCache);
        }
      } catch (e) {
        if (window.Logger) window.Logger.warn('Не удалось установить quadrantsCache', e);
      }
    }
    // Проверяем еще раз после возможной установки
    if (!quadrantsCache) {
      quadrantsCache = StateAccessors.getQuadrantsCache() || new Map();
    }
    if (quadrantsCache && typeof quadrantsCache.clear === 'function') {
      quadrantsCache.clear();
    } else if (window.Logger) {
      window.Logger.warn('quadrantsCache не является объектом с методом clear', quadrantsCache);
    }
    const currentVersion = StateAccessors.getQuadrantsCacheVersion() || 0;
    StateAccessors.setQuadrantsCacheVersion(currentVersion + 1);

    if (typeof window.rebuildTechnologiesIndex === 'function') {
      window.rebuildTechnologiesIndex();
    }

    try {
      await DataLoader.ensureAndPersistNewTech(t);
    } catch (err) {
      if (window.Logger) window.Logger.warn('Не удалось сохранить новую технологию', err);
      return;
    }

    if (typeof window.rebuildTechnologiesIndex === 'function') {
      window.rebuildTechnologiesIndex();
    }

    // Очищаем состояние формы из localStorage после успешного сохранения
    if (window.TechTabsManager && typeof window.TechTabsManager.clearFormState === 'function') {
      window.TechTabsManager.clearFormState();
    }

    // Сбрасываем форму
    if (window.TechTabsManager && typeof window.TechTabsManager.resetForm === 'function') {
      window.TechTabsManager.resetForm();
    }

    if (typeof window.hideModal === 'function') {
      window.hideModal('addTechPanel');
    }

    try {
      if (typeof window.updateRadar === 'function') {
        window.updateRadar();
      }
    } catch (err) { if (window.Logger) window.Logger.warn('updateRadar failed after add', err); }

    // Получаем квадранты технологии на основе направлений (используем уже объявленную переменную)
    if (typeof Positioning.getAllQuadrantsForTech === 'function') {
      techQuadrants = Positioning.getAllQuadrantsForTech(t);
    }

    // Обновляем состояние квадрантов и секторов
    techQuadrants.forEach(q => {
      const g = DOMCache.find(`.quadrant-group.q${q}`);
      if (g) g.classList.remove('empty');
      const sidebarItem = DOMCache.find(`.sector-item[data-quadrant="${q}"]`);
      if (sidebarItem) {
        sidebarItem.classList.remove('empty');
      }
    });

    // Убираем зум квадранта после добавления технологии
    if (typeof window.unzoom === 'function') {
      window.unzoom();
    }

    // Открываем панель подробной информации с корректными данными
    setTimeout(() => {
      if (typeof window.showDetail === 'function') {
        window.showDetail(t, 'add');
      }
    }, 200);

    try {
      let enterpriseData = StateAccessors.getEnterpriseData();
      const currentEnterprise = StateAccessors.getCurrentEnterprise();
      const technologies = StateAccessors.getTechnologies();

      // Сохраняем технологию только для выбранных предприятий (если они есть)
      if (companiesVal.length > 0) {
        companiesVal.forEach(company => {
          if (!enterpriseData[company]) {
            enterpriseData[company] = [];
          }
          const existingIndex = enterpriseData[company].findIndex(tech => tech.id === t.id);
          if (existingIndex === -1) {
            enterpriseData[company].push(t);
          } else {
            enterpriseData[company][existingIndex] = t;
          }
        });
      }

      enterpriseData[currentEnterprise] = [...technologies];
      StateAccessors.setEnterpriseData({ ...enterpriseData });
    } catch (err) { if (window.Logger) window.Logger.warn('Не удалось обновить enterpriseData', err); }

    DataLoader.showNotification('Технология добавлена!', true);

    // Добавляем уведомление в систему уведомлений
    // Сохраняем данные технологии для уведомления
    const techName = t.name || 'Неизвестная технология';
    const techId = t.id;
    const companies = companiesVal.length > 0 ? companiesVal : (t.company ? (Array.isArray(t.company) ? t.company : [t.company]) : []);

    // Пытаемся добавить уведомление сразу
    if (window.Notifications && typeof window.Notifications.add === 'function') {
      try {
        window.Notifications.add(window.Notifications.TYPES.ADD, techName, techId, {
          companies: companies
        });
      } catch (error) {
        // Ошибка при добавлении уведомления
        // Если ошибка, пробуем через небольшую задержку
        setTimeout(() => {
          if (window.Notifications && typeof window.Notifications.add === 'function') {
            window.Notifications.add(window.Notifications.TYPES.ADD, techName, techId, {
              companies: companies
            });
          }
        }, 300);
      }
    } else {
      // Если модуль еще не загружен, пробуем несколько раз
      let attempts = 0;
      const maxAttempts = 5;
      const checkInterval = setInterval(() => {
        attempts++;
        if (window.Notifications && typeof window.Notifications.add === 'function') {
          clearInterval(checkInterval);
          window.Notifications.add(window.Notifications.TYPES.ADD, techName, techId, {
            companies: companies
          });
        } else if (attempts >= maxAttempts) {
          clearInterval(checkInterval);
          // Модуль уведомлений не загружен
        }
      }, 200);
    }

    // Предлагаем открыть карточку редактирования для заполнения полей по предприятиям
    if (companiesVal.length > 0) {
      setTimeout(() => {
        if (window.showNotification) {
          window.showNotification('Не забудьте заполнить поля для каждого предприятия в карточке редактирования технологии', false);
        }
      }, 500);
    }

    // Логируем создание технологии
    if (typeof window.appendAdminAudit === 'function') {
      window.appendAdminAudit('create', `Создана технология: "${t.name}" (ID: ${t.id})`);
    }
    } finally {
      setButtonLoading(submitAddBtn, false);
    }
  }

  // Обработчик формы редактирования технологии
  async function handleEditTechFormSubmit(e) {
    e.preventDefault();
    const DOMCache = getDOMCache();
    const StateAccessors = getStateAccessors();
    const DataLoader = getDataLoader();
    const Positioning = getPositioning();

    const RINGS = window.RINGS || [];

    // Валидация дубликата названия технологии (регистр, омоглифы, пробелы)
    if (typeof window.validateDuplicateTechnology === "function") {
      const newName = getFormFieldValue("editName");
      const editId = getFormFieldValue("editId");
      const excludeId = editId !== "" && editId !== undefined ? +editId : null;
      const result = window.validateDuplicateTechnology(newName, excludeId);
      if (!result.valid) {
        if (DataLoader && typeof DataLoader.showNotification === "function") {
          DataLoader.showNotification(result.message || "Технология с таким названием уже существует", false);
        }
        return;
      }
    }

    // Валидация обязательных полей
    const requiredFields = [
      { id: 'editName', label: 'Название' },
      { id: 'editDirections', label: 'Направления цифрового развития' },
      { id: 'editBlock', label: 'Функциональный блок' },
      { id: 'editFunc', label: 'Функция' },
      { id: 'editTrlStage', label: 'TRL (стадия готовности технологии)' },
      { id: 'editFuncCover', label: 'Покрытие функций' },
      { id: 'editDesc', label: 'Описание' }
    ];

    const missingFields = [];
    for (const field of requiredFields) {
      const element = document.getElementById(field.id);
      if (!element || !element.value.trim()) {
        missingFields.push(field.label);
      }
    }

    if (missingFields.length > 0) {
      const errorMessage = 'Пожалуйста, заполните следующие обязательные поля:\n' + missingFields.join('\n');
      DataLoader.showNotification(errorMessage, false);
      return;
    }

    const editSubmitBtn = document.getElementById('submitEditTech');
    setButtonLoading(editSubmitBtn, true, 'Сохранение…');
    await new Promise(function (r) { setTimeout(r, 1500); });

    const id = +getFormFieldValue("editId");
    const technologies = (StateAccessors.getTechnologies() || []).slice();
    const idx = technologies.findIndex(t => t.id === id);
    if (idx === -1) {
      setButtonLoading(editSubmitBtn, false);
      return;
    }
    const existing = technologies[idx];
    // Сохраняем существующие значения techType и status (не обновляем их из формы)
    const newTechTypeVal = existing.techType || '';
    const newStatus = existing.level || existing.status || '';
    const newShape = window.computeShapeByTechType ? (window.computeShapeByTechType(newTechTypeVal) || 'circle') : 'circle';
    const selectedVendors = parseVendorsFromField('editVendors');
    let mergedVendors = mergeVendorsPreservingIntegrators(existing.vendors, selectedVendors);

    const rawBlockE = getFormFieldValue("editBlock");
    const rawFuncE = getFormFieldValue("editFunc");
    let blocksValE = rawBlockE;
    let functionsValE = rawFuncE;
    try { if (rawBlockE && rawBlockE.trim().startsWith('[')) blocksValE = JSON.parse(rawBlockE); } catch (err) { window.Logger?.warn('form-management: parse blocks JSON (edit)', err); }
    try { if (rawFuncE && rawFuncE.trim().startsWith('[')) functionsValE = JSON.parse(rawFuncE); } catch (err) { window.Logger?.warn('form-management: parse functions JSON (edit)', err); }

    // Получаем направления цифрового развития
    const rawDirectionsE = getFormFieldValue("editDirections");
    let directionsValE = rawDirectionsE;
    try {
      if (rawDirectionsE && rawDirectionsE.trim().startsWith('[')) {
        directionsValE = JSON.parse(rawDirectionsE);
      }
    } catch (err) {
      directionsValE = rawDirectionsE;
    }
    let directionsArrayE = Array.isArray(directionsValE)
      ? directionsValE.map(d => (typeof d === 'string' ? d.trim() : d)).filter(Boolean)
      : ((typeof directionsValE === 'string' && directionsValE.trim()) ? [directionsValE.trim()] : []);

    // Преобразуем названия направлений обратно в ID для сохранения
    // Получаем список направлений для преобразования названий в ID
    const digitalDirections = window.StateManager && typeof window.StateManager.get === 'function'
      ? window.StateManager.get('digitalDirections') || []
      : (window.digitalDirections || []);

    // Преобразуем названия в ID
    directionsArrayE = directionsArrayE.map(dirName => {
      // Если уже число (ID), возвращаем как есть
      if (typeof dirName === 'number') {
        return dirName;
      }
      // Если строка (название), ищем ID
      const direction = digitalDirections.find(d =>
        d && typeof d === 'object' && d.name === dirName
      );
      return direction && direction.id !== undefined ? direction.id : dirName;
    }).filter(d => d !== null && d !== undefined);

    // Сохраняем сектор (если он не меняется, оставляем существующий)
    // Сектор может быть строкой или массивом, сохраняем как есть
    const existingSector = existing.sector !== undefined ? existing.sector : null;

    technologies[idx] = Object.assign({}, existing, {
      name: getFormFieldValue("editName"),
      directions: directionsArrayE.length > 0 ? directionsArrayE : (existing.directions || []),
      direction: directionsArrayE.length > 0 ? directionsArrayE[0] : (existing.direction || ''),
      block: Array.isArray(blocksValE) ? (blocksValE[0] || '') : blocksValE,
      blocks: Array.isArray(blocksValE) ? blocksValE : (blocksValE ? [blocksValE] : []),
      func: Array.isArray(functionsValE) ? (functionsValE[0] || '') : functionsValE,
      functions: Array.isArray(functionsValE) ? functionsValE : (functionsValE ? [functionsValE] : []),
      techType: newTechTypeVal,
      level: newStatus || existing.level || (RINGS && RINGS.length ? RINGS[0] : 'Используемые'),
      status: newStatus || existing.status || existing.level,
      shape: newShape,
      description: getFormFieldValue("editDesc"),
      exampleDesc: getFormFieldValue('editExampleDesc').trim(),
      vendors: mergedVendors,
      files: existing.files || []
    });

    // Сохраняем сектор отдельно, чтобы не перезаписать его, если он был
    if (existingSector !== null && existingSector !== undefined) {
      technologies[idx].sector = existingSector;
    }

    const costEdit = Number(getFormFieldValue('editCostProm'));
    if (!Number.isNaN(costEdit)) technologies[idx].costProm = costEdit;
    else delete technologies[idx].costProm;

    // Получаем покрытие функций из формы (автоматически рассчитанное значение)
    let funcCoverVal = 0;
    if (window.AutoFuncCover && typeof window.AutoFuncCover.getFuncCoverValue === "function") {
      funcCoverVal = window.AutoFuncCover.getFuncCoverValue("editFuncCover");
    } else {
      // Fallback: читаем из поля напрямую
      const funcCoverField = document.getElementById("editFuncCover");
      if (funcCoverField) {
        const dataValue = funcCoverField.getAttribute("data-value");
        if (dataValue !== null) {
          funcCoverVal = parseInt(dataValue, 10);
        } else {
          // Пробуем извлечь из текста
          const text = funcCoverField.value || "";
          const match = text.match(/^(\d+)/);
          if (match) {
            funcCoverVal = parseInt(match[1], 10);
          }
        }
      }
    }
    if (!isNaN(funcCoverVal) && funcCoverVal >= 0 && funcCoverVal <= 3) {
      technologies[idx].funcCover = funcCoverVal;
    }

    const trlValue = getFormFieldValue('editTrlStage');
    if (trlValue !== undefined && trlValue !== null && trlValue !== '' && String(trlValue).trim() !== '') {
      const trlMatch = String(trlValue).match(/^(\d+)/);
      if (trlMatch) {
        const trlNum = parseInt(trlMatch[1], 10);
        if (trlNum >= 1 && trlNum <= 3) {
          technologies[idx].trlStage = trlNum;
        }
      }
    } else {
      // Если TRL-стадия не указана в форме, сохраняем существующее значение
      if (existing.trlStage !== undefined && existing.trlStage !== null) {
        technologies[idx].trlStage = existing.trlStage;
      }
    }

    // Извлекаем предприятия из формы редактирования и галочку "holdingWide"
    const holdingWideCheckbox = document.getElementById("editHoldingWide");
    const isHoldingWide = holdingWideCheckbox && holdingWideCheckbox.checked;

    const rawCompanyE = getFormFieldValue("editCompany");
    let companiesValE = [];
    try {
      if (rawCompanyE && rawCompanyE.trim().startsWith('[')) {
        companiesValE = JSON.parse(rawCompanyE);
      } else if (rawCompanyE) {
        companiesValE = [rawCompanyE];
      }
    } catch (err) {
      if (rawCompanyE) companiesValE = [rawCompanyE];
    }
    const companies = isHoldingWide
      ? []
      : (Array.isArray(companiesValE) && companiesValE.length > 0
        ? companiesValE
        : (Array.isArray(existing.company) ? existing.company : (existing.company ? [existing.company] : [])));

    // Обработка файлов при редактировании
    const filesValue = getFormFieldValue('editFiles');
    if (filesValue && filesValue.trim()) {
      try {
        const files = JSON.parse(filesValue);
        if (Array.isArray(files) && files.length > 0) {
          technologies[idx].files = files;
        }
      } catch (e) {
        if (window.Logger) window.Logger.warn('Ошибка при парсинге файлов при редактировании', e);
      }
    }

    // Обновляем поле company и holdingWide в технологии
    technologies[idx].company = companies.length === 1 ? companies[0] : companies;
    technologies[idx].holdingWide = isHoldingWide;

    // Получаем данные из вкладок предприятий (если используется EditTechTabsManager)
    let enterpriseTabsData = {};
    if (window.EditTechTabsManager && typeof window.EditTechTabsManager.getAllEnterpriseData === 'function') {
      enterpriseTabsData = window.EditTechTabsManager.getAllEnterpriseData();
    }

    // Обрабатываем данные по предприятиям (для всех предприятий, даже одного)
    if (companies.length > 0) {
      const companyRatings = {};
      const existingCompanyRatings = (existing.companyRatings && typeof existing.companyRatings === 'object')
        ? { ...existing.companyRatings }
        : {};

      // Фолбэк для старого формата (одно предприятие, оценки в общих полях технологии)
      if (Object.keys(existingCompanyRatings).length === 0 && companies.length === 1) {
        const fallbackRating = {};
        if (existing.techRead !== undefined && existing.techRead !== null && existing.techRead !== '') {
          const techNum = parseInt(existing.techRead, 10);
          if (!isNaN(techNum) && techNum >= 0 && techNum <= 3) {
            fallbackRating.techRead = techNum;
          }
        }
        if (existing.organRead !== undefined && existing.organRead !== null && existing.organRead !== '') {
          const organNum = parseInt(existing.organRead, 10);
          if (!isNaN(organNum) && organNum >= 0 && organNum <= 3) {
            fallbackRating.organRead = organNum;
          }
        }
        if (typeof existing.isImplemented === 'boolean') {
          fallbackRating.isImplemented = existing.isImplemented;
        }
        if (Object.keys(fallbackRating).length > 0) {
          existingCompanyRatings[companies[0]] = fallbackRating;
        }
      }

      companies.forEach(company => {
        // Получаем данные из вкладок предприятий
        let techReadVal, organReadVal, isImplementedVal;

        if (enterpriseTabsData[company]) {
          // Используем данные из вкладок
          techReadVal = enterpriseTabsData[company].technologicalReadiness;
          organReadVal = enterpriseTabsData[company].organizationalReadiness;
          isImplementedVal = enterpriseTabsData[company].isImplemented;
        }

        const ratings = {};
        const existingRatings = existingCompanyRatings[company];

        if (existingRatings && typeof existingRatings === 'object') {
          if (existingRatings.techRead !== undefined && existingRatings.techRead !== null && existingRatings.techRead !== '') {
            const trExisting = parseInt(existingRatings.techRead, 10);
            if (!isNaN(trExisting) && trExisting >= 0 && trExisting <= 3) {
              ratings.techRead = trExisting;
            }
          }
          if (existingRatings.organRead !== undefined && existingRatings.organRead !== null && existingRatings.organRead !== '') {
            const orExisting = parseInt(existingRatings.organRead, 10);
            if (!isNaN(orExisting) && orExisting >= 0 && orExisting <= 3) {
              ratings.organRead = orExisting;
            }
          }
          if (typeof existingRatings.isImplemented === 'boolean') {
            ratings.isImplemented = existingRatings.isImplemented;
          }
        }

        // Технологическая готовность (0-3)
        if (techReadVal !== undefined && techReadVal !== null && techReadVal !== '') {
          const trNum = parseInt(techReadVal, 10);
          if (!isNaN(trNum) && trNum >= 0 && trNum <= 3) {
            ratings.techRead = trNum;
          }
        }

        // Организационная готовность (0-3)
        if (organReadVal !== undefined && organReadVal !== null && organReadVal !== '') {
          const orNum = parseInt(organReadVal, 10);
          if (!isNaN(orNum) && orNum >= 0 && orNum <= 3) {
            ratings.organRead = orNum;
          }
        }

        // Внедрена/Не внедрена (boolean)
        if (typeof isImplementedVal === 'boolean') {
          ratings.isImplemented = isImplementedVal;
        }

        if (Object.keys(ratings).length > 0) {
          companyRatings[company] = ratings;
        }
      });

      if (Object.keys(companyRatings).length > 0) {
        technologies[idx].companyRatings = companyRatings;
      } else {
        if (technologies[idx].companyRatings) {
          delete technologies[idx].companyRatings;
        }
      }

      // Обновляем массив enterprises для использования в математической модели
      // Это необходимо для правильного расчета techRead и organRead в calculateRadarPosition
      const enterprisesData = [];
      companies.forEach(company => {
        const ratings = companyRatings[company] || {};
        // Получаем enterpriseId из списка предприятий, если доступен
        let enterpriseId = null;
        if (window.StateManager && typeof window.StateManager.get === 'function') {
          const enterprisesList = window.StateManager.get('enterprisesList') || [];
          const enterprise = enterprisesList.find(e => {
            const name = (typeof e === 'object' && e.name) ? e.name : (typeof e === 'string' ? e : '');
            return name === company;
          });
          if (enterprise) {
            enterpriseId = (typeof enterprise === 'object' && enterprise.id !== undefined) ? enterprise.id : null;
          }
        }

        enterprisesData.push({
          ...(ratings.techRead !== undefined && ratings.techRead !== null ? { technologicalReadiness: ratings.techRead } : {}),
          ...(ratings.organRead !== undefined && ratings.organRead !== null ? { organizationalReadiness: ratings.organRead } : {}),
          ...(typeof ratings.isImplemented === 'boolean' ? { isImplemented: ratings.isImplemented } : {}),
          name: company,
          enterpriseId: enterpriseId
        });
      });

      // Обновляем массив enterprises в технологии
      if (enterprisesData.length > 0) {
        technologies[idx].enterprises = enterprisesData;
      } else {
        // Если нет данных по предприятиям, очищаем массив
        technologies[idx].enterprises = [];
      }

      // Для обратной совместимости: если предприятие одно, сохраняем также в общие поля
      if (companies.length === 1) {
        const company = companies[0];
        const ratings = companyRatings[company];
        if (ratings) {
          if (ratings.techRead !== undefined && ratings.techRead !== null) {
            technologies[idx].techRead = ratings.techRead;
          }
          if (ratings.organRead !== undefined && ratings.organRead !== null) {
            technologies[idx].organRead = ratings.organRead;
          }
          if (ratings.isImplemented !== undefined) {
            technologies[idx].isImplemented = ratings.isImplemented;
          }
        }
      }

      // Важно: funcCover и trlStage - общие значения для всей технологии, они уже сохранены выше
      // Не удаляем их, даже если есть индивидуальные оценки для предприятий
    } else {
      // Если нет выбранных предприятий, очищаем массивы enterprises и companyRatings
      technologies[idx].enterprises = [];
      if (technologies[idx].companyRatings) {
        delete technologies[idx].companyRatings;
      }
    }

    if (isProposalOnlyMode()) {
      const moderationFlow = getModerationFlow();
      try {
        await moderationFlow.createProposal('update', {
          technologyId: id,
          tech: technologies[idx]
        });
      } catch (err) {
        if (window.Logger) window.Logger.warn('Не удалось отправить предложение на изменение', err);
        DataLoader.showNotification((err && err.message) ? err.message : 'Не удалось отправить предложение на модерацию', false);
        return;
      } finally {
        setButtonLoading(editSubmitBtn, false);
      }

      if (typeof window.hideModal === 'function') {
        window.hideModal('editTechPanel');
      }
      return;
    }

    // Проверяем, нужно ли пересчитывать координаты
    const blockChanged = JSON.stringify(technologies[idx].blocks || [technologies[idx].block]) !==
      JSON.stringify(existing.blocks || [existing.block]);
    const statusChanged = technologies[idx].status !== existing.status ||
      technologies[idx].level !== existing.level;
    const directionsChanged = JSON.stringify(technologies[idx].directions || [technologies[idx].direction]) !==
      JSON.stringify(existing.directions || [existing.direction]);
    const trlChanged = technologies[idx].trlStage !== existing.trlStage;
    const funcCoverChanged = technologies[idx].funcCover !== existing.funcCover;

    // Проверяем, изменились ли оценки предприятий
    const enterprisesChanged = JSON.stringify(technologies[idx].enterprises || []) !==
      JSON.stringify(existing.enterprises || []);

    // Пересчитываем координаты если изменились параметры, влияющие на позицию
    // Сохраняем угол, если направления не менялись
    const shouldRecalculate = blockChanged || statusChanged || directionsChanged || trlChanged || funcCoverChanged || enterprisesChanged;

    if (shouldRecalculate) {
      // Сохраняем старые координаты и угол, если направления не менялись
      const oldX = existing.x;
      const oldY = existing.y;
      const oldTheta = existing.theta;
      const preserveAngle = !directionsChanged && oldTheta !== undefined && oldTheta !== null;

      // Пересчитываем координаты
      Positioning.computeCoordinates(technologies[idx]);

      // Если направления не менялись, восстанавливаем угол и пересчитываем координаты
      if (preserveAngle) {
        // Вычисляем радиус из новых координат (после пересчета)
        const CENTER_X = window.CENTER_X || 500;
        const CENTER_Y = window.CENTER_Y || 500;
        const newRadius = Math.sqrt(
          Math.pow(technologies[idx].x - CENTER_X, 2) +
          Math.pow(technologies[idx].y - CENTER_Y, 2)
        );

        // Сохраняем угол и пересчитываем координаты с сохраненным углом
        technologies[idx].theta = oldTheta;
        if (window.polarToCartesian) {
          const p = window.polarToCartesian(CENTER_X, CENTER_Y, newRadius, oldTheta);
          technologies[idx].x = Math.round(p.x);
          technologies[idx].y = Math.round(p.y);
        }
      }

      // Инвалидируем кэш квадрантов
      // Получаем или создаем quadrantsCache
      let quadrantsCache = StateAccessors.getQuadrantsCache();
      if (!quadrantsCache) {
        // Создаем новый Map если кэш не существует
        quadrantsCache = new Map();
        // Пытаемся установить через StateManager, если доступен
        if (StateManager && StateManager.set) {
          StateManager.set('quadrantsCache', quadrantsCache);
        }
      }
      if (quadrantsCache && typeof quadrantsCache.clear === 'function') {
        quadrantsCache.clear();
      }
      const currentVersion = StateAccessors.getQuadrantsCacheVersion() || 0;
      StateAccessors.setQuadrantsCacheVersion(currentVersion + 1);
    }

    StateAccessors.setTechnologies([...technologies]);

    if (typeof window.rebuildTechnologiesIndex === 'function') {
      window.rebuildTechnologiesIndex();
    }

    // Сохраняем через DataService (ensureAndPersistNewTech вызывает DataService.updateTech)
    try {
      await DataLoader.ensureAndPersistNewTech(technologies[idx]);
    } catch (err) {
      if (window.Logger) window.Logger.warn('Не удалось сохранить изменения технологии', err);
      return;
    } finally {
      setButtonLoading(editSubmitBtn, false);
    }

    if (typeof window.hideModal === 'function') {
      window.hideModal('editTechPanel');
    }

    if (typeof window.updateRadar === 'function') {
      window.updateRadar();
    }

    // Если панель приоритетов сектора открыта — обновим список,
    // т.к. приоритет мог измениться без смены блока/статуса (и без пересчёта координат).
    try {
      const qp = document.getElementById('quadrantPriorityPanel');
      const getCurrentZoomedQuadrant = window.getCurrentZoomedQuadrant;
      if (
        qp &&
        qp.classList.contains('open') &&
        typeof window.recomputeQuadrantPriorityList === 'function' &&
        typeof getCurrentZoomedQuadrant === 'function'
      ) {
        const qId = getCurrentZoomedQuadrant();
        if (qId != null) {
          window.recomputeQuadrantPriorityList(qId);
        }
      }
    } catch (err) {
      // ignore
    }

    try {
      const enterpriseData = StateAccessors.getEnterpriseData();
      const oldCompanies = Array.isArray(existing.company) ? existing.company : (existing.company ? [existing.company] : []);
      const newCompanies = companies;

      // Удаляем технологию из старых предприятий (если предприятие изменилось)
      const allCompanies = new Set([...oldCompanies, ...newCompanies]);
      allCompanies.forEach(companyName => {
        if (!enterpriseData[companyName]) {
          enterpriseData[companyName] = [];
        }
        // Удаляем старую версию технологии из этого предприятия
        const companyTechs = enterpriseData[companyName];
        const oldTechIndex = companyTechs.findIndex(t => t.id === id);
        if (oldTechIndex !== -1) {
          companyTechs.splice(oldTechIndex, 1);
        }
        // Если это новое предприятие - добавляем технологию
        if (newCompanies.includes(companyName)) {
          companyTechs.push(technologies[idx]);
        }
        enterpriseData[companyName] = companyTechs;
      });

      // Обновляем текущее предприятие
      const currentEnterprise = StateAccessors.getCurrentEnterprise();
      if (enterpriseData[currentEnterprise]) {
        const currentIndex = enterpriseData[currentEnterprise].findIndex(t => t.id === id);
        if (currentIndex !== -1) {
          enterpriseData[currentEnterprise][currentIndex] = technologies[idx];
        } else if (newCompanies.includes(currentEnterprise)) {
          enterpriseData[currentEnterprise].push(technologies[idx]);
        }
      }

      StateAccessors.setEnterpriseData({ ...enterpriseData });
    } catch (err) { if (window.Logger) window.Logger.warn('Не удалось обновить enterpriseData после редактирования', err); }

    // Проверяем, открыта ли панель подробной информации для этой технологии
    // Если да, обновляем данные в панели
    const detailPanel = DOMCache.get('detailPanel');
    if (detailPanel) {
      const isPanelActive = detailPanel.classList.contains('active');
      const selectedBlipId = StateAccessors.getSelectedBlipId();

      // Если панель открыта и отображает редактируемую технологию, обновляем её
      if (isPanelActive && selectedBlipId === id) {
        // Получаем обновленную технологию
        const updatedTech = technologies[idx];

        // Обновляем панель с новыми данными
        if (typeof window.showDetail === 'function') {
          // Определяем источник открытия панели (сохраняем текущее состояние)
          // Используем 'blip' как источник по умолчанию, так как панель уже была открыта
          window.showDetail(updatedTech, 'blip');
        }
      }
    }

    DataLoader.showNotification('Изменения сохранены!', true);

    // Добавляем уведомление в систему уведомлений
    if (window.Notifications && typeof window.Notifications.add === 'function') {
      const techName = technologies[idx]?.name || 'Неизвестная технология';

      // Определяем измененные поля
      const changedFields = {};
      const newTech = technologies[idx];
      const fieldsToCheck = ['name', 'description', 'block', 'blocks', 'status', 'level', 'direction', 'directions', 'company', 'companies', 'trlStage', 'funcCover', 'techRead', 'organRead', 'isImplemented', 'holdingWide', 'companyRatings', 'vendors', 'files'];

      fieldsToCheck.forEach(field => {
        const oldVal = existing[field];
        const newVal = newTech[field];

        // Сравниваем значения (учитываем массивы и объекты)
        let isChanged = false;

        // Специальная обработка для companyRatings
        if (field === 'companyRatings') {
          // Нормализуем значения: если поля нет, считаем его пустым объектом
          const normalizedOld = oldVal || {};
          const normalizedNew = newVal || {};

          // Сравниваем объекты companyRatings
          const oldKeys = Object.keys(normalizedOld);
          const newKeys = Object.keys(normalizedNew);
          if (oldKeys.length !== newKeys.length) {
            isChanged = true;
          } else {
            // Проверяем каждое предприятие
            for (const key of oldKeys) {
              if (JSON.stringify(normalizedOld[key]) !== JSON.stringify(normalizedNew[key])) {
                isChanged = true;
                break;
              }
            }
            // Проверяем, нет ли новых предприятий
            if (!isChanged) {
              for (const key of newKeys) {
                if (!normalizedOld[key]) {
                  isChanged = true;
                  break;
                }
              }
            }
          }
        } else if (field === 'vendors') {
          // Специальная обработка для вендоров: нормализуем перед сравнением
          const normalizeVendor = (v) => {
            if (!v) return null;
            const name = (v && typeof v === 'object') ? (v.name || v.id || '') : String(v || '');
            const integrators = (v && typeof v === 'object' && Array.isArray(v.integrators))
              ? v.integrators.map(i => (i && typeof i === 'object') ? (i.name || i.id || '') : String(i || '')).filter(Boolean).sort()
              : [];
            return { name: String(name).trim(), integrators };
          };
          const oldArray = Array.isArray(oldVal) ? oldVal : (oldVal ? [oldVal] : []);
          const newArray = Array.isArray(newVal) ? newVal : (newVal ? [newVal] : []);
          const normalizedOld = oldArray.map(normalizeVendor).filter(v => v && v.name).sort((a, b) => a.name.localeCompare(b.name));
          const normalizedNew = newArray.map(normalizeVendor).filter(v => v && v.name).sort((a, b) => a.name.localeCompare(b.name));
          isChanged = JSON.stringify(normalizedOld) !== JSON.stringify(normalizedNew);
        } else if (Array.isArray(oldVal) && Array.isArray(newVal)) {
          isChanged = JSON.stringify(oldVal) !== JSON.stringify(newVal);
        } else if (typeof oldVal === 'object' && typeof newVal === 'object' && oldVal !== null && newVal !== null) {
          isChanged = JSON.stringify(oldVal) !== JSON.stringify(newVal);
        } else {
          // Для примитивных значений учитываем undefined/null
          const normalizedOld = oldVal === undefined ? null : oldVal;
          const normalizedNew = newVal === undefined ? null : newVal;
          isChanged = normalizedOld !== normalizedNew;
        }

        if (isChanged) {
          changedFields[field] = {
            old: oldVal === undefined ? null : oldVal,
            new: newVal === undefined ? null : newVal
          };
        }
      });

      window.Notifications.add(window.Notifications.TYPES.EDIT, techName, id, {
        changedFields: changedFields
      });
    }

    // Логируем редактирование технологии
    if (typeof window.appendAdminAudit === 'function') {
      const techName = technologies[idx]?.name || 'Неизвестная технология';
      window.appendAdminAudit('update', `Отредактирована технология: "${techName}" (ID: ${id})`);
    }
  }

  // Инициализация обработчика формы добавления блока
  let initAddBlockFormHandlerAttempts = 0;
  const MAX_INIT_ATTEMPTS = 10;
  function initAddBlockFormHandler() {
    const DOMCache = getDOMCache();
    const StateAccessors = getStateAccessors();
    const DataLoader = getDataLoader();
    if (!StateAccessors) {
      if (initAddBlockFormHandlerAttempts < MAX_INIT_ATTEMPTS) {
        initAddBlockFormHandlerAttempts++;
        setTimeout(initAddBlockFormHandler, 200);
      } else if (window.Logger) {
        window.Logger.warn('initAddBlockFormHandler: StateAccessors не загружен после ' + MAX_INIT_ATTEMPTS + ' попыток');
      }
      return;
    }
    if (!DataLoader) {
      // Если DataLoader еще не загружен, отложим инициализацию (но не более MAX_INIT_ATTEMPTS раз)
      if (initAddBlockFormHandlerAttempts < MAX_INIT_ATTEMPTS) {
        initAddBlockFormHandlerAttempts++;
        setTimeout(initAddBlockFormHandler, 200);
      } else {
        if (window.Logger) window.Logger.warn('initAddBlockFormHandler: DataLoader не загружен после ' + MAX_INIT_ATTEMPTS + ' попыток');
      }
      return;
    }
    initAddBlockFormHandlerAttempts = 0; // Сбрасываем счетчик при успешной загрузке

    const blockEnterprisesInput = document.getElementById('blockEnterprises');
    if (blockEnterprisesInput && !blockEnterprisesInput.dataset.blockBlocksListener) {
      blockEnterprisesInput.dataset.blockBlocksListener = '1';
      blockEnterprisesInput.addEventListener('input', () => {
        if (typeof window.updateBlockBlocksForEnterprises === 'function') {
          window.updateBlockBlocksForEnterprises();
        }
      });
      blockEnterprisesInput.addEventListener('change', () => {
        if (typeof window.updateBlockBlocksForEnterprises === 'function') {
          window.updateBlockBlocksForEnterprises();
        }
      });
    }

    const addBlockForm = DOMCache.get('addBlockForm');
    if (addBlockForm) {
      addBlockForm.onsubmit = async (e) => {
        e.preventDefault();
        const nameInput = DOMCache.get('blockName');
        const sectorInput = DOMCache.get('blockSector');
        const blockEnterprisesInput = document.getElementById('blockEnterprises');
        const blockBlocksInput = document.getElementById('blockBlocks');
        if (!nameInput) { DataLoader.showNotification('Не найдено поле имени блока (blockName)', false); return; }

        const blockName = (nameInput.value || '').trim();

        // Читаем выбранные предприятия и блоки из списка
        let selectedEnterprises = [];
        let selectedBlocks = [];
        if (blockEnterprisesInput && blockEnterprisesInput.value) {
          try {
            const p = JSON.parse(blockEnterprisesInput.value);
            selectedEnterprises = Array.isArray(p) ? p : (p ? [p] : []);
          } catch {
            selectedEnterprises = blockEnterprisesInput.value.split(',').map(s => s.trim()).filter(Boolean);
          }
        }
        if (blockBlocksInput && blockBlocksInput.value) {
          try {
            const p = JSON.parse(blockBlocksInput.value);
            selectedBlocks = Array.isArray(p) ? p : (p ? [p] : []);
          } catch {
            selectedBlocks = blockBlocksInput.value.split(',').map(s => s.trim()).filter(Boolean);
          }
        }

        // Получаем значение направления из кастомного селекта
        let sectorName = (sectorInput && sectorInput.value) ? (sectorInput.value || '').trim() : '';
        if (!sectorName) {
          const sectorSelect = DOMCache.query('.custom-select-modal[data-field="blockSector"]');
          if (sectorSelect) {
            const sectorValue = sectorSelect.getAttribute('data-value') || '';
            if (sectorValue) {
              try {
                const parsed = JSON.parse(sectorValue);
                sectorName = Array.isArray(parsed) ? parsed[0] : parsed;
              } catch (e) {
                sectorName = sectorValue;
              }
            }
            if (!sectorName) {
              const selectedTextEl = sectorSelect.querySelector('.selected-text');
              if (selectedTextEl && selectedTextEl.textContent && selectedTextEl.textContent !== 'Выберите') {
                sectorName = selectedTextEl.textContent.trim();
              }
            }
            if (!sectorName) {
              const selectedLi = sectorSelect.querySelector('.select-options li.selected');
              if (selectedLi) {
                sectorName = selectedLi.getAttribute('data-value') || selectedLi.textContent.trim();
              }
            }
          }
        }

        const hasEnterprise = selectedEnterprises.length > 0;
        const hasBlockFromList = selectedBlocks.length > 0;
        const hasBlockName = blockName.length > 0;
        const hasDirection = !!(sectorName && sectorName !== 'Выберите');

        // Валидация: если выбрано предприятие — нужен либо блок из списка, либо название
        if (hasEnterprise && !hasBlockFromList && !hasBlockName) {
          DataLoader.showNotification('Выберите блок из списка или введите название нового блока', false);
          return;
        }

        // Режим «только привязка»: предприятие + блок из списка, без создания нового блока
        if (hasEnterprise && hasBlockFromList && !hasBlockName) {
          if (DataLoader.ensureEnterpriseBlockMapping) {
            await DataLoader.ensureEnterpriseBlockMapping({ company: selectedEnterprises, blocks: selectedBlocks });
          }
          if (typeof window.hideModal === 'function') {
            window.hideModal('addBlockPanel');
          }
          DataLoader.showNotification('Блоки привязаны к предприятиям', true);
          return;
        }

        // Нет ни привязки, ни нового блока — нечего сохранять
        if (!hasBlockName) {
          DataLoader.showNotification('Выберите предприятие и блок для привязки или введите название нового блока', false);
          return;
        }

        let QUADRANTS_LOCAL = window.QUADRANTS || [];
        let quad = null;
        let qId = null;
        if (hasDirection) {
          // Если QUADRANTS не загружены, используем дефолтные значения
          if (!QUADRANTS_LOCAL || QUADRANTS_LOCAL.length === 0) {
            QUADRANTS_LOCAL = [
              { id: 1, name: "Единый центр данных (Data Hub)", startAngle: 0 },
              { id: 2, name: "Искусственный интеллект во всех процессах", startAngle: 90 },
              { id: 3, name: "Автономные комплексы на всех предприятиях", startAngle: 180 },
              { id: 4, name: "Надёжная и безопасная цифровая инфраструктура", startAngle: 270 },
            ];
            if (window.Logger) window.Logger.warn('QUADRANTS не загружены, используются дефолтные значения');
          }

          // Ищем квадрант по имени (точное совпадение, без учета регистра)
          quad = QUADRANTS_LOCAL.find(q => {
            const qName = String(q.name || '').trim();
            const sName = String(sectorName).trim();
            return qName === sName || qName.toLowerCase() === sName.toLowerCase();
          });

          if (!quad) {
            DataLoader.showNotification(`Сектор "${sectorName}" не найден. Использован квадрант по умолчанию`, false);
            if (window.Logger) window.Logger.warn('Квадрант не найден для сектора:', sectorName, 'Доступные:', QUADRANTS_LOCAL.map(q => q.name));
          }

          qId = quad ? quad.id : (QUADRANTS_LOCAL[0] ? QUADRANTS_LOCAL[0].id : 1);
        }

        // Логируем для отладки
        if (window.Logger) {
          window.Logger.debug('Добавление блока:', { blockName, sectorName, quadId: qId, quadName: quad ? quad.name : 'не найдено' });
        }

        // Собираем функции из формы
        const functionsContainer = DOMCache.get('functionsContainer');
        const functionNames = [];
        if (functionsContainer) {
          const functionRows = functionsContainer.querySelectorAll('.function-row input[type="text"]');
          functionRows.forEach(input => {
            const funcName = (input.value || '').trim();
            if (funcName) {
              functionNames.push(funcName);
            }
          });
        }

        let blocksData = [];
        try {
          const DataService = getDataService();
          if (DataService && typeof DataService.loadReference === 'function') {
            blocksData = await DataService.loadReference('blocks') || [];
          } else if (DataLoader) {
            const vfs = DataLoader.vfsRead ? DataLoader.vfsRead('blocks.json') : null;
            if (!vfs && DataLoader.loadJsonPreferVfs) {
              const loaded = await DataLoader.loadJsonPreferVfs('blocks.json');
              blocksData = loaded?.data || [];
            } else {
              blocksData = vfs || [];
            }
          }
        } catch (err) {
          blocksData = [];
        }
        // Если блоки хранятся как массив строк, конвертируем их в объекты
        if (Array.isArray(blocksData) && blocksData.length > 0 && typeof blocksData[0] === 'string') {
          blocksData = blocksData.map((name, idx) => ({ id: idx + 1, name }));
        }
        if (!Array.isArray(blocksData)) {
          blocksData = [];
        }

        // Проверяем, существует ли блок с таким именем
        let blockId = StateAccessors.getNameToBlockId ? (StateAccessors.getNameToBlockId()[blockName] || null) : null;
        const existingBlockIndex = blocksData.findIndex(b => (b.name || b) === blockName);

        if (existingBlockIndex !== -1) {
          // Блок существует, используем его ID
          const existingBlock = blocksData[existingBlockIndex];
          blockId = existingBlock.id || existingBlockIndex + 1;
        } else {
          // Создаем новый блок с новым ID
          const maxId = blocksData.length > 0
            ? Math.max(...blocksData.map(b => (b && typeof b === 'object' && b.id) ? b.id : 0))
            : 0;
          blockId = maxId + 1;
          blocksData.push({ id: blockId, name: blockName });
        }

        // Обновляем nameToBlockId
        const nameToBlockId = StateAccessors.getNameToBlockId ? StateAccessors.getNameToBlockId() : {};
        nameToBlockId[blockName] = blockId;
        if (StateAccessors.setNameToBlockId) {
          StateAccessors.setNameToBlockId({ ...nameToBlockId });
        }

        // УДАЛЕНО (2026-01-29): Привязка блоков к квадрантам больше не используется
        // Блоки являются отдельными критериями технологии и могут быть в любом квадранте
        // Квадранты определяются только через направления цифрового развития

        // Обновляем blocksList (массив строк для селектов)
        const blocksList = StateAccessors.getBlocksList();
        if (!blocksList.includes(blockName)) {
          StateAccessors.setBlocksList([...blocksList, blockName]);
        }

        // Обновляем функции и связи
        if (functionNames.length > 0) {
          try {
            let functionsData = [];
            try {
              const DataService = getDataService();
              if (DataService && typeof DataService.loadReference === 'function') {
                functionsData = await DataService.loadReference('functions') || [];
              } else if (DataLoader) {
                const vfs = DataLoader.vfsRead ? DataLoader.vfsRead('functions.json') : null;
                functionsData = vfs || (DataLoader.loadJsonPreferVfs ? (await DataLoader.loadJsonPreferVfs('functions.json'))?.data : null) || [];
              }
            } catch (err) {
              functionsData = [];
            }
            if (!Array.isArray(functionsData)) {
              functionsData = [];
            }
            // Преобразуем функции в массив строк, если нужно
            const functionsList = functionsData.map(f => (f && typeof f === 'object' && f.name) ? f.name : String(f || '')).filter(Boolean);

            // Добавляем новые функции
            functionNames.forEach(funcName => {
              if (!functionsList.includes(funcName)) {
                functionsList.push(funcName);
              }
            });
            StateAccessors.setFunctions([...functionsList]);
            try {
              const DataService = getDataService();
              if (DataService && typeof DataService.saveReference === 'function') {
                await DataService.saveReference('functions', functionsList);
              } else if (DataLoader?.vfsWrite) {
                DataLoader.vfsWrite('functions.json', functionsList);
              }
            } catch (err) { if (window.Logger) window.Logger.warn('Не удалось сохранить functions', err); }

            let functionToBlockMap = StateAccessors.getFunctionToBlockMap ? StateAccessors.getFunctionToBlockMap() : {};
            if (!functionToBlockMap || typeof functionToBlockMap !== 'object') {
              try {
                const DataService = getDataService();
                functionToBlockMap = (DataService && await DataService.loadReference('functionToBlock')) || (DataLoader?.loadJsonPreferVfs && (await DataLoader.loadJsonPreferVfs('functionToBlock.json'))?.data) || {};
              } catch (err) {
                functionToBlockMap = {};
              }
            }

            // Создаем связи функций с блоком
            functionNames.forEach(funcName => {
              if (!functionToBlockMap[funcName]) {
                // Функция не связана ни с каким блоком
                functionToBlockMap[funcName] = blockId;
              } else if (Array.isArray(functionToBlockMap[funcName])) {
                // Функция уже связана с несколькими блоками
                if (!functionToBlockMap[funcName].includes(blockId)) {
                  functionToBlockMap[funcName].push(blockId);
                }
              } else if (functionToBlockMap[funcName] !== blockId) {
                // Функция связана с другим блоком, преобразуем в массив
                functionToBlockMap[funcName] = [functionToBlockMap[funcName], blockId];
              }
            });

            StateAccessors.setFunctionToBlockMap({ ...functionToBlockMap });
            try {
              const DataService = getDataService();
              if (DataService && typeof DataService.saveReference === 'function') {
                await DataService.saveReference('functionToBlock', functionToBlockMap);
              } else if (DataLoader?.vfsWrite) {
                DataLoader.vfsWrite('functionToBlock.json', functionToBlockMap);
              }
            } catch (err) { if (window.Logger) window.Logger.warn('Не удалось сохранить functionToBlock', err); }
          } catch (err) {
            if (window.Logger) window.Logger.warn('Не удалось сохранить функции и связи', err);
          }
        }

        try {
          const DataService = getDataService();
          if (DataService && typeof DataService.saveReference === 'function') {
            await DataService.saveReference('blocks', blocksData);
          } else if (DataLoader?.vfsWrite) {
            DataLoader.vfsWrite('blocks.json', blocksData);
          }
        } catch (err) { if (window.Logger) window.Logger.warn('Не удалось сохранить блоки', err); }

        // Обновляем фильтры и модальные формы с актуальными данными
        const blocksListUpdated = StateAccessors.getBlocksList();
        const functionsUpdated = StateAccessors.getFunctions();

        // Обновляем фильтры sidebar
        if (window.Filters && typeof window.Filters.populateSelect === 'function') {
          if (blocksListUpdated.length > 0) {
            window.Filters.populateSelect('block', blocksListUpdated, 'Функциональные блоки: Все');
          }
          if (functionsUpdated.length > 0) {
            window.Filters.populateSelect('function', functionsUpdated, 'Функции: Все');
          }
        }

        if (window.StateManager && window.StateManager.set) {
          window.StateManager.set('blocksList', blocksListUpdated);
        }

        // Обновляем модальные формы
        if (window.Filters && typeof window.Filters.populateSelectForModal === 'function') {
          if (blocksListUpdated.length > 0) {
            window.Filters.populateSelectForModal('techBlock', blocksListUpdated, 'Выберите');
            window.Filters.populateSelectForModal('editBlock', blocksListUpdated, 'Выберите');
          }
          if (functionsUpdated.length > 0) {
            window.Filters.populateSelectForModal('techFunc', functionsUpdated, 'Выберите');
            window.Filters.populateSelectForModal('editFunc', functionsUpdated, 'Выберите');
          }
        }

        // Если модальное окно добавления технологии открыто и выбран сектор, обновляем список блоков
        if (typeof window.updateModalBlocksForSectors === 'function') {
          try {
            const addTechPanel = DOMCache.get('addTechPanel');
            if (addTechPanel && (addTechPanel.style.display === 'block' || addTechPanel.classList.contains('open'))) {
              const techSectorInput = DOMCache.get('techSector');
              if (techSectorInput && techSectorInput.value) {
                let selectedSectors = [];
                try {
                  const parsed = JSON.parse(techSectorInput.value);
                  if (Array.isArray(parsed)) {
                    selectedSectors = parsed;
                  } else if (parsed) {
                    selectedSectors = [parsed];
                  }
                } catch (e) {
                  // Если не JSON, пробуем как строку
                  if (techSectorInput.value.trim()) {
                    selectedSectors = [techSectorInput.value.trim()];
                  }
                }
                if (selectedSectors.length > 0) {
                  // Используем setTimeout для гарантии, что данные обновились и populateSelectForModal завершился
                  setTimeout(() => {
                    window.updateModalBlocksForSectors(selectedSectors);
                  }, 50);
                }
              }
            }
          } catch (err) {
            if (window.Logger) window.Logger.warn('Не удалось обновить блоки модальных форм для секторов', err);
          }
        }

        // Обновляем функции модальных форм для блоков (если модальное окно открыто)
        if (typeof window.updateModalFunctionsForBlocks === 'function') {
          try {
            // Получаем текущий выбор блоков в модальном окне добавления технологии
            const techBlockInput = DOMCache.get('techBlock');
            if (techBlockInput && techBlockInput.value) {
              try {
                const selectedBlocks = JSON.parse(techBlockInput.value);
                if (Array.isArray(selectedBlocks) && selectedBlocks.length > 0) {
                  window.updateModalFunctionsForBlocks(selectedBlocks);
                }
              } catch (e) {
                // Если не JSON, пробуем как строку
                const selectedBlock = techBlockInput.value.trim();
                if (selectedBlock) {
                  window.updateModalFunctionsForBlocks([selectedBlock]);
                }
              }
            }
          } catch (err) {
            if (window.Logger) window.Logger.warn('Не удалось обновить функции модальных форм для блоков', err);
          }
        }

        if (qId != null) {
          const g = document.querySelector(`.quadrant-group.q${qId}`);
          if (g) g.classList.remove('empty');
          const sidebarItem = document.querySelector(`.sector-item[data-quadrant="${qId}"]`);
          if (sidebarItem) {
            sidebarItem.classList.remove('empty');
            document.querySelectorAll('.sector-item').forEach(i => i.classList.remove('active'));
            sidebarItem.classList.add('active');
          }
        }

        // Привязка блоков к предприятиям (если выбраны)
        let mappingEnterprises = selectedEnterprises;
        let mappingBlocks = [...selectedBlocks];
        if (existingBlockIndex === -1 && blockName) {
          mappingBlocks = [...new Set([...mappingBlocks, blockName])];
        }
        if (mappingEnterprises.length > 0 && mappingBlocks.length > 0 && DataLoader.ensureEnterpriseBlockMapping) {
          await DataLoader.ensureEnterpriseBlockMapping({ company: mappingEnterprises, blocks: mappingBlocks });
        }

        if (typeof window.hideModal === 'function') {
          window.hideModal('addBlockPanel');
        }

        const funcCount = functionNames.length;
        const message = funcCount > 0
          ? `Функциональный блок добавлен с ${funcCount} ${funcCount === 1 ? 'функцией' : 'функциями'}`
          : 'Функциональный блок добавлен';
        DataLoader.showNotification(message, true);
      };
    }
  }

  // Экспорт модуля
  const FormManagement = {
    initFormEvents,
    getFormFieldValue,
    handleAddTechFormSubmit,
    handleEditTechFormSubmit,
    initAddBlockFormHandler
  };

  // Экспорт в window для обратной совместимости
  if (typeof window !== "undefined") {
    window.FormManagement = FormManagement;
    // Экспорт функций в window для обратной совместимости
    window.initFormEvents = initFormEvents;
    window.getFormFieldValue = getFormFieldValue;
    window.handleAddTechFormSubmit = handleAddTechFormSubmit;
    window.handleEditTechFormSubmit = handleEditTechFormSubmit;
    window.setButtonLoading = setButtonLoading;

    // Экспорт FormHandlers для обратной совместимости
    window.FormHandlers = {
      getFormFieldValue,
      handleAddTechFormSubmit,
      handleEditTechFormSubmit,
      initAddBlockFormHandler
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => setTimeout(initAddBlockFormHandler, 0));
    } else {
      setTimeout(initAddBlockFormHandler, 0);
    }
  }

  export default FormManagement;
  export { initFormEvents, getFormFieldValue, handleAddTechFormSubmit, handleEditTechFormSubmit, setButtonLoading };
