// form-management.js
// Объединенный модуль для управления формами: события и обработчики
// Объединяет функциональность form-events.js и form-handlers.js

(function () {
  "use strict";

  // Ленивая загрузка зависимостей для совместимости
  function getDependency(name) {
    if (typeof window === "undefined" || !window[name]) {
      throw new Error(
        `Зависимость ${name} не загружена. Подключите необходимые модули перед form-management.js`
      );
    }
    return window[name];
  }

  // Ленивая загрузка зависимостей
  function getDOMCache() {
    if (typeof window !== 'undefined' && window.DOMCache) {
      return window.DOMCache;
    }
    throw new Error('DOMCache не загружен');
  }

  function getStateAccessors() {
    if (typeof window !== 'undefined' && window.StateAccessors) {
      return window.StateAccessors;
    }
    throw new Error('StateAccessors не загружен');
  }

  function getDataLoader() {
    if (typeof window !== 'undefined' && window.DataLoader) {
      return window.DataLoader;
    }
    throw new Error('DataLoader не загружен');
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
      const preview = document.getElementById("editPriorityPreview");
      const valueEl = document.getElementById("editPriorityValue");
      const commentEl = document.getElementById("editPriorityComment");
      if (!preview || !valueEl || !commentEl) return;

      const computePriority =
        window.Priorities?.computePriority || window.computePriority;
      const getPriorityCategory =
        window.Priorities?.getPriorityCategory || window.getPriorityCategory;
      const getPriorityWeakLinkComment =
        window.Priorities?.getPriorityWeakLinkComment ||
        window.getPriorityWeakLinkComment;

      if (
        typeof computePriority !== "function" ||
        typeof getPriorityCategory !== "function" ||
        typeof getPriorityWeakLinkComment !== "function"
      ) {
        return;
      }

      let existing = null;
      try {
        const StateAccessors = getStateAccessors();
        const id = +getFormFieldValue("editId");
        if (id) {
          const techs = StateAccessors.getTechnologies();
          existing = techs.find((t) => t.id === id) || null;
        }
      } catch (e) {
        existing = null;
      }

      // Собираем "кандидат" технологии из значений формы + (если есть) существующей технологии.
      const candidate = Object.assign({}, existing || {});

      // Статус/TRL влияют на приоритет (если TRL не задан — выводится из статуса).
      const newStatus = (getFormFieldValue("editStatus") || "").trim();
      if (newStatus) {
        candidate.status = newStatus;
        candidate.level = newStatus;
      }

      const trlStage = parseLeadingInt(getFormFieldValue("editTrlStage"));
      if (trlStage != null && trlStage >= 1 && trlStage <= 3) {
        candidate.trlStage = trlStage;
      } else {
        delete candidate.trlStage;
      }

      const funcCover = parseLeadingInt(getFormFieldValue("editFuncCover"));
      if (funcCover != null && funcCover >= 0 && funcCover <= 3) {
        candidate.funcCover = funcCover;
      } else {
        // не мешаем вычислению приоритета, если поле пустое
        if (!existing || existing.funcCover == null) delete candidate.funcCover;
      }

      // Предприятия: строка или JSON-массив в скрытом поле.
      const companies = safeParseArrayOrString(getFormFieldValue("editCompany"));
      if (companies.length === 1) candidate.company = companies[0];
      else if (companies.length > 1) candidate.company = companies;

      if (companies.length <= 1) {
        const techRead = parseLeadingInt(getFormFieldValue("editTechRead"));
        const organRead = parseLeadingInt(getFormFieldValue("editOrganRead"));

        if (techRead != null && techRead >= 0 && techRead <= 3) {
          candidate.techRead = techRead;
        } else if (!existing || existing.techRead == null) {
          delete candidate.techRead;
        }

        if (organRead != null && organRead >= 0 && organRead <= 3) {
          candidate.organRead = organRead;
        } else if (!existing || existing.organRead == null) {
          delete candidate.organRead;
        }

        if (candidate.companyRatings) delete candidate.companyRatings;
      } else {
        // Для нескольких предприятий: читаем поля *_{company} (если есть) и кладём в companyRatings.
        const companyRatings = {};
        let hasAny = false;
        companies.forEach((c) => {
          const tr = parseLeadingInt(getFormFieldValue(`editTechRead_${c}`));
          const or = parseLeadingInt(getFormFieldValue(`editOrganRead_${c}`));
          const ratings = {};
          if (tr != null && tr >= 0 && tr <= 3) {
            ratings.techRead = tr;
            hasAny = true;
          }
          if (or != null && or >= 0 && or <= 3) {
            ratings.organRead = or;
            hasAny = true;
          }
          if (Object.keys(ratings).length) {
            companyRatings[c] = ratings;
          }
        });
        if (hasAny) candidate.companyRatings = companyRatings;
        else if (candidate.companyRatings) delete candidate.companyRatings;
      }

      const priority = computePriority(candidate, "mult");
      const category = getPriorityCategory(priority);

      preview.classList.remove(
        "priority-low",
        "priority-medium",
        "priority-high",
        "priority-none"
      );

      if (priority == null || category.key === "none") {
        valueEl.textContent = "Приоритет: —";
        commentEl.textContent = category.description;
        preview.classList.add("priority-none");
      } else {
        const percent = Math.round(priority * 100);
        valueEl.textContent = `Приоритет: ${percent}% (${category.label})`;
        commentEl.textContent = getPriorityWeakLinkComment(candidate);
        if (category.key === "low") preview.classList.add("priority-low");
        else if (category.key === "medium")
          preview.classList.add("priority-medium");
        else if (category.key === "high") preview.classList.add("priority-high");
      }
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
        if (typeof window.hideModal === "function") {
          window.hideModal("addTechPanel");
        }
      };
    }

    const cancelEdit = document.getElementById("cancelEdit");
    if (cancelEdit) {
      cancelEdit.onclick = () => {
        if (typeof window.hideModal === "function") {
          window.hideModal("editTechPanel");
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

    // Обработчики для модального окна подтверждения удаления
    const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");
    if (confirmDeleteBtn) {
      confirmDeleteBtn.onclick = () => {
        if (
          typeof window.getCurrentTech === "function" &&
          typeof window.getTechnologies === "function" &&
          typeof window.setTechnologies === "function"
        ) {
          const currentTech = window.getCurrentTech();
          if (!currentTech) return;
          const technologies = window.getTechnologies();
          window.setTechnologies(
            technologies.filter((t) => t.id !== currentTech.id)
          );

          if (
            typeof window.getQuadrantsCache === "function" &&
            typeof window.setQuadrantsCacheVersion === "function"
          ) {
            const quadrantsCache = window.getQuadrantsCache();
            if (quadrantsCache) quadrantsCache.clear();
            window.setQuadrantsCacheVersion(
              (window.getQuadrantsCacheVersion() || 0) + 1
            );
          }

          // Сначала сбрасываем выбранную технологию, чтобы панель не переоткрылась при обновлении радара
          if (typeof window.setSelectedBlipId === "function") {
            window.setSelectedBlipId(null);
          }
          if (typeof window.setCurrentTech === "function") {
            window.setCurrentTech(null);
          }

          // Полностью закрываем панель подробной информации
          const detailPanel = DOMCache.get("detailPanel");
          if (detailPanel) {
            // Очищаем все inline стили, которые были установлены
            detailPanel.style.removeProperty("visibility");
            detailPanel.style.removeProperty("opacity");
            detailPanel.style.removeProperty("transform");
            detailPanel.style.removeProperty("position");
            detailPanel.style.removeProperty("z-index");
            detailPanel.style.removeProperty("display");
            // Удаляем класс active
            detailPanel.classList.remove("active");
            // Снимаем выделение с blip'ов
            const svg = DOMCache.get("techRadar");
            if (svg) {
              svg
                .querySelectorAll(".blip.selected")
                .forEach((el) => el.classList.remove("selected"));
            }
          }
          if (typeof window.unzoom === "function") {
            window.unzoom();
          }
          if (typeof window.updateRadar === "function") {
            window.updateRadar();
          }

          try {
            if (
              typeof window.getEnterpriseData === "function" &&
              typeof window.getCurrentEnterprise === "function" &&
              typeof window.getTechnologies === "function" &&
              typeof window.setEnterpriseData === "function" &&
              typeof window.vfsWrite === "function"
            ) {
              const enterpriseData = window.getEnterpriseData();
              const currentEnterprise = window.getCurrentEnterprise();
              const technologies = window.getTechnologies();
              enterpriseData[currentEnterprise] = [...technologies];
              window.setEnterpriseData({ ...enterpriseData });
              window.vfsWrite("enterpriseData.json", enterpriseData);
            }
          } catch (err) {
            console.warn(
              "Не удалось сохранить enterpriseData после удаления",
              err
            );
          }

          if (typeof window.showNotification === "function") {
            window.showNotification("Технология удалена!", true);
          }
          
          // Логируем удаление технологии
          try {
            if (typeof window.appendAdminAudit === 'function') {
              window.appendAdminAudit('delete', `Удалена технология: "${currentTech.name}" (ID: ${currentTech.id})`);
            } else {
              // Fallback: прямое логирование в localStorage если функция недоступна
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
                action: 'delete',
                details: `Удалена технология: "${currentTech.name}" (ID: ${currentTech.id})`,
                tz: 'local',
                ip: 'local'
              });
              localStorage.setItem(key, JSON.stringify(arr));
            }
          } catch (err) {
            console.warn('Ошибка при логировании удаления:', err);
          }
          
          if (typeof window.hideModal === "function") {
            window.hideModal("deleteConfirmModal");
          }
        }
      };
    }

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
    }

    // ===== ОБРАБОТЧИКИ КНОПОК РЕДАКТИРОВАНИЯ И УДАЛЕНИЯ =====
    // Обработчики кнопок редактирования и удаления через делегирование событий
    // Используем делегирование, так как элементы могут быть созданы динамически
    document.addEventListener("click", (e) => {
      if (e.target.closest("#editTechBtn")) {
        if (
          typeof window.getCurrentTech !== "function" ||
          typeof window.checkArchitectRole !== "function"
        )
          return;
        const currentTech = window.getCurrentTech();
        if (!window.checkArchitectRole() || !currentTech) return;
        const f = document.getElementById("editTechForm");
        if (!f) return;
        // Сбрасываем предыдущий snapshot, если он был
        if (f.dataset.initial) delete f.dataset.initial;

        f.querySelector("#editId").value = currentTech.id;
        f.querySelector("#editName").value = currentTech.name;
        if (typeof window.setCustomSelectValue === "function") {
          window.setCustomSelectValue(
            "editBlock",
            currentTech.blocks && currentTech.blocks.length
              ? currentTech.blocks
              : currentTech.block
              ? [currentTech.block]
              : []
          );
          window.setCustomSelectValue(
            "editFunc",
            currentTech.functions && currentTech.functions.length
              ? currentTech.functions
              : currentTech.func
              ? [currentTech.func]
              : []
          );
          window.setCustomSelectValue(
            "editTechType",
            currentTech.techType || ""
          );
          window.setCustomSelectValue(
            "editStatus",
            currentTech.level || currentTech.status || ""
          );
          // Устанавливаем предприятия
          const companies = Array.isArray(currentTech.company)
            ? currentTech.company
            : currentTech.company
            ? [currentTech.company]
            : [];
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
        }
        // ratings - устанавливаем значения в выпадающие списки
        const ratingOptions = {
          0: "0 — Не готова",
          1: "1 — Низкая",
          2: "2 — Средняя",
          3: "3 — Высокая",
        };
        if (typeof window.setCustomSelectValue === "function") {
          // Технологическая готовность
          if (
            currentTech.techRead !== undefined &&
            currentTech.techRead !== null
          ) {
            const trValue = ratingOptions[currentTech.techRead];
            window.setCustomSelectValue("editTechRead", trValue || "");
          } else {
            window.setCustomSelectValue("editTechRead", "");
          }
          // Организационная готовность
          if (
            currentTech.organRead !== undefined &&
            currentTech.organRead !== null
          ) {
            const orValue = ratingOptions[currentTech.organRead];
            window.setCustomSelectValue("editOrganRead", orValue || "");
          } else {
            window.setCustomSelectValue("editOrganRead", "");
          }
          // Покрытие функций
          if (
            currentTech.funcCover !== undefined &&
            currentTech.funcCover !== null
          ) {
            const fcValue = ratingOptions[currentTech.funcCover];
            window.setCustomSelectValue("editFuncCover", fcValue || "");
          } else {
            window.setCustomSelectValue("editFuncCover", "");
          }
        }
        // Устанавливаем значение TRL в кастомный селект
        if (
          currentTech.trlStage !== undefined &&
          currentTech.trlStage !== null
        ) {
          const trlOptions = {
            1: "1 — Ранняя стадия (исследование)",
            2: "2 — Разработка (прототип)",
            3: "3 — Зрелость (готовность к внедрению)",
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
          }
        }, 0);
      }

      if (e.target.closest("#deleteTechBtn")) {
        if (
          typeof window.getCurrentTech !== "function" ||
          typeof window.checkArchitectRole !== "function"
        )
          return;
        const currentTech = window.getCurrentTech();
        if (!window.checkArchitectRole() || !currentTech) return;
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

  // Обработчик формы добавления технологии
  function handleAddTechFormSubmit(e) {
    e.preventDefault();
    const DOMCache = getDOMCache();
    const StateAccessors = getStateAccessors();
    const DataLoader = getDataLoader();
    const Positioning = getPositioning();

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
    const rawBlock = getFormFieldValue("techBlock");
    const rawFunc = getFormFieldValue("techFunc");
    const selStatus = getFormFieldValue("techStatus").trim();
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
    if (companiesVal.length === 0) {
      companiesVal = [StateAccessors.getCurrentEnterprise()];
    }

    const t = {
      id: nextId++,
      name: getFormFieldValue("techName").trim(),
      sector: sectorArray.length > 1 ? sectorArray : sectorName,
      block: Array.isArray(rawBlockVal) ? (rawBlockVal[0] || '') : (rawBlockVal || ''),
      blocks: Array.isArray(rawBlockVal) ? rawBlockVal : (rawBlockVal ? [rawBlockVal] : []),
      func: Array.isArray(rawFuncVal) ? (rawFuncVal[0] || '') : (rawFuncVal || ''),
      functions: Array.isArray(rawFuncVal) ? rawFuncVal : (rawFuncVal ? [rawFuncVal] : []),
      techType: '',
      level: '',
      company: companiesVal.length === 1 ? companiesVal[0] : companiesVal,
      description: getFormFieldValue("techDesc").trim(),
      exampleDesc: getFormFieldValue('techExampleDesc').trim(),
    };

    t.level = selStatus || ((RINGS && RINGS.length) ? RINGS[0] : 'Используемые');
    t.status = t.level;

    const costVal = Number(getFormFieldValue('techCostProm'));
    if (!Number.isNaN(costVal)) t.costProm = costVal; else delete t.costProm;

    const clamp03 = (n) => Math.max(0, Math.min(3, Number(n)));
    const clamp13 = (n) => Math.max(1, Math.min(3, Number(n)));
    // Извлекаем значение покрытия функций из выпадающего списка
    const fc = getFormFieldValue('techFuncCover');
    if (fc !== undefined && fc !== null && fc !== '' && String(fc).trim() !== '') {
      const fcMatch = String(fc).match(/^(\d+)/);
      if (fcMatch) {
        const fcNum = parseInt(fcMatch[1], 10);
        if (fcNum >= 0 && fcNum <= 3) {
          t.funcCover = fcNum;
        }
      } else {
        t.funcCover = clamp03(fc);
      }
    }

    const trlValue = getFormFieldValue('techTrlStage');
    if (trlValue !== undefined && trlValue !== null && trlValue !== '' && String(trlValue).trim() !== '') {
      const trlMatch = String(trlValue).match(/^(\d+)/);
      if (trlMatch) {
        const trlNum = parseInt(trlMatch[1], 10);
        if (trlNum >= 1 && trlNum <= 3) {
          t.trlStage = trlNum;
        }
      }
    }

    if (companiesVal.length === 1) {
      // Извлекаем значения технологической и организационной готовности из выпадающих списков
      const tr = getFormFieldValue('techTechRead');
      const or = getFormFieldValue('techOrganRead');
      if (tr !== undefined && tr !== null && tr !== '' && String(tr).trim() !== '') {
        const trMatch = String(tr).match(/^(\d+)/);
        if (trMatch) {
          const trNum = parseInt(trMatch[1], 10);
          if (trNum >= 0 && trNum <= 3) {
            t.techRead = trNum;
          }
        } else {
          t.techRead = clamp03(tr);
        }
      }
      if (or !== undefined && or !== null && or !== '' && String(or).trim() !== '') {
        const orMatch = String(or).match(/^(\d+)/);
        if (orMatch) {
          const orNum = parseInt(orMatch[1], 10);
          if (orNum >= 0 && orNum <= 3) {
            t.organRead = orNum;
          }
        } else {
          t.organRead = clamp03(or);
        }
      }
    } else if (companiesVal.length > 1) {
      const companyRatings = {};
      let hasAnyRatings = false;
      companiesVal.forEach(company => {
        // Извлекаем значения из выпадающих списков для каждого предприятия
        const techReadVal = getFormFieldValue(`techTechRead_${company}`);
        const organReadVal = getFormFieldValue(`techOrganRead_${company}`);

        const ratings = {};
        if (techReadVal !== undefined && techReadVal !== null && techReadVal !== '' && String(techReadVal).trim() !== '') {
          const trMatch = String(techReadVal).match(/^(\d+)/);
          if (trMatch) {
            const trNum = parseInt(trMatch[1], 10);
            if (trNum >= 0 && trNum <= 3) {
              ratings.techRead = trNum;
              hasAnyRatings = true;
            }
          } else {
            ratings.techRead = clamp03(techReadVal);
            hasAnyRatings = true;
          }
        }
        if (organReadVal !== undefined && organReadVal !== null && organReadVal !== '' && String(organReadVal).trim() !== '') {
          const orMatch = String(organReadVal).match(/^(\d+)/);
          if (orMatch) {
            const orNum = parseInt(orMatch[1], 10);
            if (orNum >= 0 && orNum <= 3) {
              ratings.organRead = orNum;
              hasAnyRatings = true;
            }
          } else {
            ratings.organRead = clamp03(organReadVal);
            hasAnyRatings = true;
          }
        }

        if (Object.keys(ratings).length > 0) {
          companyRatings[company] = ratings;
        }
      });

      if (hasAnyRatings) {
        t.companyRatings = companyRatings;
      }
    }

    t.techType = getFormFieldValue('techTechType') || '';
    const shapeFromType = window.computeShapeByTechType ? window.computeShapeByTechType(t.techType) : null;
    if (shapeFromType) t.shape = shapeFromType;

    const blockKeyForLookup = (t.blocks && t.blocks.length) ? (typeof t.blocks[0] === 'string' ? t.blocks[0].trim() : t.blocks[0]) : (typeof t.block === 'string' ? t.block.trim() : t.block);
    t.block = blockKeyForLookup;
    const blockToQuadrant = StateAccessors.getBlockToQuadrant();
    const blocksList = StateAccessors.getBlocksList();

    if (!blockToQuadrant.hasOwnProperty(blockKeyForLookup) || blockToQuadrant[blockKeyForLookup] == null) {
      blockToQuadrant[blockKeyForLookup] = 1;
      StateAccessors.setBlockToQuadrant({...blockToQuadrant});
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
          li.innerHTML = `<label class="option-label"><input type="checkbox" class="option-checkbox" /><span>${blockKeyForLookup}</span></label>`;
          opts.appendChild(li);
        }
      });
      try {
        if (!blocksList.includes(blockKeyForLookup)) {
          StateAccessors.setBlocksList([...blocksList, blockKeyForLookup]);
        }
        DataLoader.vfsWrite('bloks.json', StateAccessors.getBlocksList());
        DataLoader.vfsWrite('blockToQuadrant.json', StateAccessors.getBlockToQuadrant());
      } catch (err) { console.warn('Не удалось сохранить новый блок в VFS', err); }
    }

    const bk = t.block;
    const blockToQuadrantMap = StateAccessors.getBlockToQuadrant();
    if (!bk || !blockToQuadrantMap || !Object.prototype.hasOwnProperty.call(blockToQuadrantMap, bk) || blockToQuadrantMap[bk] == null) {
      console.warn('addTech: block mapping missing for', bk, '— defaulting to quadrant 1 and adding option');
      blockToQuadrantMap[bk] = 1;
      StateAccessors.setBlockToQuadrant({...blockToQuadrantMap});
      const sidebarSelect = DOMCache.find('.custom-select[data-filter="block"] .select-options');
      if (sidebarSelect) { const li = document.createElement('li'); li.textContent = bk; li.setAttribute('data-value', bk); sidebarSelect.appendChild(li); }
      DOMCache.queryAll('.custom-select-modal[data-field="techBlock"], .custom-select-modal[data-field="editBlock"]').forEach(ms => {
        const opts = ms.querySelector('.select-options');
        if (opts) {
          const li = document.createElement('li');
          li.classList.add('select-option-item');
          li.setAttribute('data-value', bk);
          li.innerHTML = `<label class="option-label"><input type="checkbox" class="option-checkbox" /><span>${bk}</span></label>`;
          opts.appendChild(li);
        }
      });
      const blocksList = StateAccessors.getBlocksList();
      if (!blocksList.includes(bk)) {
        StateAccessors.setBlocksList([...blocksList, bk]);
      }
      try { DataLoader.vfsWrite('bloks.json', StateAccessors.getBlocksList()); DataLoader.vfsWrite('blockToQuadrant.json', StateAccessors.getBlockToQuadrant()); } catch (err) { console.warn('vfs write failed for new block', err); }
    }

    if (!levelToRing || !Object.prototype.hasOwnProperty.call(levelToRing, t.level)) {
      console.warn('addTech: level mapping missing for', t.level, '— defaulting to "Существующие"');
      t.level = (RINGS && RINGS.length) ? RINGS[0] : 'Используемые';
    }

    Positioning.computeCoordinates(t);

    try {
      console.debug('addTech: new tech BEFORE persist', { id: t.id, name: t.name, block: t.block, quadrant: Positioning.getQuadrantIdForBlock(t.block), level: t.level, ring: levelToRing[t.level], x: t.x, y: t.y });
    } catch (e) { /* ignore */ }

    const technologies = StateAccessors.getTechnologies();
    technologies.push(t);
    StateManager.set('nextId', nextId);

    const quadrantsCache = StateAccessors.getQuadrantsCache();
    quadrantsCache.clear();
    StateAccessors.setQuadrantsCacheVersion(StateAccessors.getQuadrantsCacheVersion() + 1);

    if (typeof window.rebuildTechnologiesIndex === 'function') {
      window.rebuildTechnologiesIndex();
    }

    DataLoader.ensureAndPersistNewTech(t);

    if (typeof window.hideModal === 'function') {
      window.hideModal('addTechPanel');
    }

    const q = Positioning.getQuadrantIdForBlock(t.block);
    if (q != null) {
      const g = DOMCache.find(`.quadrant-group.q${q}`);
      if (g) g.classList.remove('empty');
    }

    try {
      if (typeof window.updateRadar === 'function') {
        window.updateRadar();
      }
    } catch (err) { console.warn('updateRadar failed after add', err); }

    if (q != null) {
      const g = DOMCache.find(`.quadrant-group.q${q}`);
      if (g) g.classList.remove('empty');
      const sidebarItem = DOMCache.find(`.sector-item[data-quadrant="${q}"]`);
      if (sidebarItem) {
        sidebarItem.classList.remove('empty');
        const existing = sidebarItem.nextElementSibling;
        if (!(existing && existing.classList.contains('tech-list'))) {
          DOMCache.queryAll('.tech-list').forEach(tl => tl.parentNode?.removeChild(tl));
          if (typeof window.createTechListForSector === 'function') {
            window.createTechListForSector(sidebarItem, q, StateAccessors.getTechnologies());
          }
        }
        DOMCache.queryAll('.sector-item').forEach(i => i.classList.remove('active'));
        sidebarItem.classList.add('active');
      }

      // Проверяем, добавляется ли технология в несколько секторов
      const isMultipleSectors = Array.isArray(t.sector) && t.sector.length > 1;

      // Проверяем, находятся ли блоки технологии в разных квадрантах
      let isMultipleQuadrants = false;
      if (typeof Positioning.getAllQuadrantsForTech === 'function') {
        const techQuadrants = Positioning.getAllQuadrantsForTech(t);
        isMultipleQuadrants = techQuadrants.length > 1;
      }

      // Делаем зум только если технология добавляется в один сектор и один квадрант
      if (!isMultipleSectors && !isMultipleQuadrants) {
        setTimeout(() => {
          if (typeof window.zoomQuadrant === 'function') {
            window.zoomQuadrant(q);
          }
        }, 100);
      }
    }

    try {
      let enterpriseData = StateAccessors.getEnterpriseData();
      const currentEnterprise = StateAccessors.getCurrentEnterprise();
      const technologies = StateAccessors.getTechnologies();
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
      enterpriseData[currentEnterprise] = [...technologies];
      StateAccessors.setEnterpriseData({...enterpriseData});
      DataLoader.vfsWrite('enterpriseData.json', enterpriseData);
    } catch (err) { console.warn('Не удалось сохранить enterpriseData в VFS', err); }

    DataLoader.showNotification('Технология добавлена!', true);
    
    // Логируем создание технологии
    if (typeof window.appendAdminAudit === 'function') {
      window.appendAdminAudit('create', `Создана технология: "${t.name}" (ID: ${t.id})`);
    }
  }

  // Обработчик формы редактирования технологии
  function handleEditTechFormSubmit(e) {
    e.preventDefault();
    const DOMCache = getDOMCache();
    const StateAccessors = getStateAccessors();
    const DataLoader = getDataLoader();
    const Positioning = getPositioning();

    const RINGS = window.RINGS || [];

    const id = +getFormFieldValue("editId");
    const technologies = StateAccessors.getTechnologies();
    const idx = technologies.findIndex(t => t.id === id);
    if (idx === -1) return;
    const existing = technologies[idx];
    const newTechTypeVal = getFormFieldValue('editTechType') || existing.techType;
    const newStatus = getFormFieldValue('editStatus').trim() || existing.level || existing.status || '';
    const newShape = window.computeShapeByTechType ? (window.computeShapeByTechType(newTechTypeVal) || 'circle') : 'circle';

    const rawBlockE = getFormFieldValue("editBlock");
    const rawFuncE = getFormFieldValue("editFunc");
    let blocksValE = rawBlockE;
    let functionsValE = rawFuncE;
    try { if (rawBlockE && rawBlockE.trim().startsWith('[')) blocksValE = JSON.parse(rawBlockE); } catch (err) {}
    try { if (rawFuncE && rawFuncE.trim().startsWith('[')) functionsValE = JSON.parse(rawFuncE); } catch (err) {}

    // Сохраняем сектор (если он не меняется, оставляем существующий)
    // Сектор может быть строкой или массивом, сохраняем как есть
    const existingSector = existing.sector !== undefined ? existing.sector : null;

    technologies[idx] = Object.assign({}, existing, {
      name: getFormFieldValue("editName"),
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
    });

    // Сохраняем сектор отдельно, чтобы не перезаписать его, если он был
    if (existingSector !== null && existingSector !== undefined) {
      technologies[idx].sector = existingSector;
    }

    const costEdit = Number(getFormFieldValue('editCostProm'));
    if (!Number.isNaN(costEdit)) technologies[idx].costProm = costEdit;
    else delete technologies[idx].costProm;

    const clamp03 = (n) => Math.max(0, Math.min(3, Number(n)));
    // Извлекаем значение покрытия функций из выпадающего списка
    const fc = getFormFieldValue('editFuncCover');
    if (fc !== undefined && fc !== null && fc !== '' && String(fc).trim() !== '') {
      const fcMatch = String(fc).match(/^(\d+)/);
      if (fcMatch) {
        const fcNum = parseInt(fcMatch[1], 10);
        if (fcNum >= 0 && fcNum <= 3) {
          technologies[idx].funcCover = fcNum;
        }
      } else {
        technologies[idx].funcCover = clamp03(fc);
      }
    }

    const trlValue = getFormFieldValue('editTrlStage');
    if (trlValue !== undefined && trlValue !== null && trlValue !== '' && String(trlValue).trim() !== '') {
      const trlMatch = String(trlValue).match(/^(\d+)/);
      if (trlMatch) {
        const trlNum = parseInt(trlMatch[1], 10);
        if (trlNum >= 1 && trlNum <= 3) {
          technologies[idx].trlStage = trlNum;
        } else {
          delete technologies[idx].trlStage;
        }
      } else {
        delete technologies[idx].trlStage;
      }
    } else {
      delete technologies[idx].trlStage;
    }

    // Извлекаем предприятия из формы редактирования
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
    const companies = Array.isArray(companiesValE) && companiesValE.length > 0
      ? companiesValE
      : (Array.isArray(existing.company) ? existing.company : (existing.company ? [existing.company] : []));

    // Обновляем поле company в технологии
    technologies[idx].company = companies.length === 1 ? companies[0] : companies;

    if (companies.length === 1) {
      // Извлекаем значения технологической и организационной готовности из выпадающих списков
      const tr = getFormFieldValue('editTechRead');
      const or = getFormFieldValue('editOrganRead');
      if (tr !== undefined && tr !== null && tr !== '' && String(tr).trim() !== '') {
        const trMatch = String(tr).match(/^(\d+)/);
        if (trMatch) {
          const trNum = parseInt(trMatch[1], 10);
          if (trNum >= 0 && trNum <= 3) {
            technologies[idx].techRead = trNum;
          }
        } else {
          technologies[idx].techRead = clamp03(tr);
        }
      }
      if (or !== undefined && or !== null && or !== '' && String(or).trim() !== '') {
        const orMatch = String(or).match(/^(\d+)/);
        if (orMatch) {
          const orNum = parseInt(orMatch[1], 10);
          if (orNum >= 0 && orNum <= 3) {
            technologies[idx].organRead = orNum;
          }
        } else {
          technologies[idx].organRead = clamp03(or);
        }
      }
      if (technologies[idx].companyRatings) {
        delete technologies[idx].companyRatings;
      }
    } else if (companies.length > 1) {
      const companyRatings = {};
      let hasAnyRatings = false;
      companies.forEach(company => {
        // Извлекаем значения из выпадающих списков для каждого предприятия
        const techReadVal = getFormFieldValue(`editTechRead_${company}`);
        const organReadVal = getFormFieldValue(`editOrganRead_${company}`);

        const ratings = {};
        if (techReadVal !== undefined && techReadVal !== null && techReadVal !== '' && String(techReadVal).trim() !== '') {
          const trMatch = String(techReadVal).match(/^(\d+)/);
          if (trMatch) {
            const trNum = parseInt(trMatch[1], 10);
            if (trNum >= 0 && trNum <= 3) {
              ratings.techRead = trNum;
              hasAnyRatings = true;
            }
          } else {
            ratings.techRead = clamp03(techReadVal);
            hasAnyRatings = true;
          }
        }
        if (organReadVal !== undefined && organReadVal !== null && organReadVal !== '' && String(organReadVal).trim() !== '') {
          const orMatch = String(organReadVal).match(/^(\d+)/);
          if (orMatch) {
            const orNum = parseInt(orMatch[1], 10);
            if (orNum >= 0 && orNum <= 3) {
              ratings.organRead = orNum;
              hasAnyRatings = true;
            }
          } else {
            ratings.organRead = clamp03(organReadVal);
            hasAnyRatings = true;
          }
        }

        if (Object.keys(ratings).length > 0) {
          companyRatings[company] = ratings;
        }
      });

      if (hasAnyRatings) {
        technologies[idx].companyRatings = companyRatings;
      } else {
        if (technologies[idx].companyRatings) {
          delete technologies[idx].companyRatings;
        }
      }
    }

    // Проверяем, нужно ли пересчитывать координаты
    const blockChanged = JSON.stringify(technologies[idx].blocks || [technologies[idx].block]) !==
                         JSON.stringify(existing.blocks || [existing.block]);
    const statusChanged = technologies[idx].status !== existing.status ||
                          technologies[idx].level !== existing.level;

    if (blockChanged || statusChanged) {
      // Пересчитываем координаты
      Positioning.computeCoordinates(technologies[idx]);

      // Инвалидируем кэш квадрантов
      const quadrantsCache = StateAccessors.getQuadrantsCache();
      quadrantsCache.clear();
      StateAccessors.setQuadrantsCacheVersion(StateAccessors.getQuadrantsCacheVersion() + 1);
    }

    StateAccessors.setTechnologies([...technologies]);

    if (typeof window.rebuildTechnologiesIndex === 'function') {
      window.rebuildTechnologiesIndex();
    }

    // Сохраняем в VFS
    DataLoader.ensureAndPersistNewTech(technologies[idx]);

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

      StateAccessors.setEnterpriseData({...enterpriseData});
      DataLoader.vfsWrite('enterpriseData.json', enterpriseData);
    } catch (err) { console.warn('Не удалось сохранить enterpriseData после редактирования', err); }

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
    
    // Логируем редактирование технологии
    if (typeof window.appendAdminAudit === 'function') {
      const techName = technologies[idx]?.name || 'Неизвестная технология';
      window.appendAdminAudit('update', `Отредактирована технология: "${techName}" (ID: ${id})`);
    }
  }

  // Инициализация обработчика формы добавления блока
  function initAddBlockFormHandler() {
    const DOMCache = getDOMCache();
    const StateAccessors = getStateAccessors();
    const DataLoader = getDataLoader();

    const QUADRANTS = window.QUADRANTS || [];

    const addBlockForm = DOMCache.get('addBlockForm');
    if (addBlockForm) {
      addBlockForm.onsubmit = async (e) => {
        e.preventDefault();
        const nameInput = DOMCache.get('blockName');
        const sectorInput = DOMCache.get('blockSector');
        if (!nameInput) { DataLoader.showNotification('Не найдено поле имени блока (blockName)', false); return; }
        if (!sectorInput) { DataLoader.showNotification('Не найдено поле выбора сектора (blockSector)', false); return; }
        const blockName = (nameInput.value || '').trim();
        const sectorName = (sectorInput.value || '').trim();
        if (!blockName) { DataLoader.showNotification('Введите имя блока', false); return; }
        if (!sectorName) { DataLoader.showNotification('Выберите сектор', false); return; }

        const quad = QUADRANTS.find(q => q.name === sectorName) || QUADRANTS[0];
        const qId = quad ? quad.id : 1;

        const blockToQuadrantMap = StateAccessors.getBlockToQuadrant();
        blockToQuadrantMap[blockName] = qId;
        StateAccessors.setBlockToQuadrant({...blockToQuadrantMap});

        const sidebarSelect = DOMCache.find('.custom-select[data-filter="block"] .select-options');
        if (sidebarSelect) {
          const li = document.createElement('li'); li.textContent = blockName; li.setAttribute('data-value', blockName);
          sidebarSelect.appendChild(li);
        }
        const modalSelects = DOMCache.queryAll('.custom-select-modal[data-field="techBlock"], .custom-select-modal[data-field="editBlock"]');
        modalSelects.forEach(ms => {
          const opts = ms.querySelector('.select-options');
          if (opts) {
            const li = document.createElement('li');
            li.classList.add('select-option-item');
            li.setAttribute('data-value', blockName);
            li.innerHTML = `<label class="option-label"><input type="checkbox" class="option-checkbox" /><span>${blockName}</span></label>`;
            opts.appendChild(li);
          }
        });

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

        try {
          const blocksList = StateAccessors.getBlocksList();
          if (!blocksList.includes(blockName)) {
            StateAccessors.setBlocksList([...blocksList, blockName]);
          }
          DataLoader.vfsWrite('bloks.json', StateAccessors.getBlocksList());
          DataLoader.vfsWrite('blockToQuadrant.json', StateAccessors.getBlockToQuadrant());
        } catch (err) { console.warn('Не удалось сохранить блоки в VFS', err); }

        if (typeof window.hideModal === 'function') {
          window.hideModal('addBlockPanel');
        }

        DataLoader.showNotification('Функциональный блок добавлен и сектор разблокирован', true);
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

    // Экспорт FormHandlers для обратной совместимости
    window.FormHandlers = {
      getFormFieldValue,
      handleAddTechFormSubmit,
      handleEditTechFormSubmit,
      initAddBlockFormHandler
    };

    // Инициализация обработчика формы добавления блока при загрузке
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        setTimeout(initAddBlockFormHandler, 0);
      });
    } else {
      setTimeout(initAddBlockFormHandler, 0);
    }
  }
})();
