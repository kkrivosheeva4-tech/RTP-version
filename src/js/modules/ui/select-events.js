// select-events.js
// Модуль обработки событий для кастомных селектов (sidebar и модальных)
// Вынесено из events.js для улучшения читаемости и поддержки

(function () {
  "use strict";

  // Ленивая загрузка зависимостей для совместимости
  function getDependency(name) {
    if (typeof window === "undefined" || !window[name]) {
      throw new Error(
        `Зависимость ${name} не загружена. Подключите необходимые модули перед select-events.js`
      );
    }
    return window[name];
  }

  // Инициализация обработчиков событий для селектов
  function initSelectEvents() {
    // Проверяем, что все зависимости доступны
    const DOMCache = getDependency("DOMCache");

    // ===== КАСТОМНЫЕ СЕЛЕКТЫ (SIDEBAR) =====
    // Используем прямое делегирование для более надежной работы
    // Используем capture phase для раннего перехвата
    document.addEventListener(
      "click",
      (e) => {
        // Проверяем, что клик был внутри .custom-select (не модального)
        const select = e.target.closest(".custom-select");
        if (!select) return;

        // Игнорируем клики на модальные селекты (они обрабатываются отдельно)
        if (select.classList.contains("custom-select-modal")) return;

        // Игнорируем клики на опции внутри открытого списка - они обрабатываются отдельным обработчиком
        const clickedOption = e.target.closest(".select-options li");
        if (clickedOption) return;

        // Проверяем, что клик был на .select-trigger или внутри него
        const trigger = select.querySelector(".select-trigger");
        if (!trigger) return;

        // Проверяем, что клик был на триггере или внутри него
        if (!trigger.contains(e.target) && e.target !== trigger) return;

        // Останавливаем распространение события, чтобы предотвратить срабатывание обработчика "ОБЩИЙ СБРОС"
        e.stopPropagation();

        document.querySelectorAll(".custom-select").forEach((s) => {
          if (s !== select) s.classList.remove("open");
        });
        select.classList.toggle("open");
        if (select.classList.contains("open")) {
          if (typeof window.positionOptions === "function") {
            window.positionOptions(select);
          }
          const searchInputInside = select.querySelector(
            ".select-search input"
          );
          if (searchInputInside) setTimeout(() => searchInputInside.focus(), 0);
        }
      },
      true
    ); // Используем capture phase

    // Обработка кликов по опциям в кастомных селектах (sidebar)
    document.addEventListener("click", (e) => {
      // Проверяем, что клик внутри выпадающего списка фильтров (sidebar, не модального)
      const isInSelectOptions = e.target.closest(
        ".custom-select:not(.custom-select-modal) .select-options"
      );
      if (!isInSelectOptions) {
        return;
      }

      // Пропускаем клики по триггеру открытия/закрытия
      if (e.target.closest(".select-trigger")) {
        return;
      }

      // Пропускаем клики по элементам поиска
      if (e.target.closest(".select-search")) {
        return;
      }

      // ИСПРАВЛЕНО: Находим li элемент, включая клики по span, label и чекбоксу
      let li = e.target.closest("li");

      // Если клик был по чекбоксу, label или span внутри label, находим родительский li
      if (
        !li ||
        e.target.type === "checkbox" ||
        e.target.tagName === "LABEL" ||
        e.target.tagName === "SPAN"
      ) {
        // Пробуем найти через closest
        li = e.target.closest("li");
        // Если не нашли, ищем через родительские элементы
        if (!li) {
          let current = e.target;
          while (current && current !== document.body) {
            if (current.tagName === "LI") {
              const selectOptions = current.closest(".select-options");
              const sidebarSelect = selectOptions
                ? selectOptions.closest(
                    ".custom-select:not(.custom-select-modal)"
                  )
                : null;
              if (
                sidebarSelect &&
                selectOptions &&
                selectOptions.contains(current)
              ) {
                li = current;
                break;
              }
            }
            current = current.parentElement;
          }
        }
      }

      // Проверяем, что li находится внутри sidebar селекта (не модального)
      if (!li) {
        return;
      }

      const sidebarSelect = li.closest(".custom-select");
      if (
        !sidebarSelect ||
        sidebarSelect.classList.contains("custom-select-modal")
      ) {
        return;
      }

      // Проверяем, что li находится внутри .select-options
      const optionsContainer = sidebarSelect.querySelector(".select-options");
      if (!optionsContainer || !optionsContainer.contains(li)) {
        return;
      }

      // ИСПРАВЛЕНО: Если клик был по label или span, обрабатываем через label
      // Клик по label автоматически активирует связанный чекбокс
      if (
        e.target.tagName === "LABEL" ||
        (e.target.tagName === "SPAN" && e.target.closest(".option-label"))
      ) {
        e.stopPropagation();
      }

      // Если клик был непосредственно на чекбокс, позволяем стандартное поведение браузера
      // Браузер сам переключит checked состояние
      if (e.target.type === "checkbox") {
        // Не блокируем стандартное поведение - позволяем браузеру переключить чекбокс
        e.stopPropagation(); // Останавливаем всплытие, чтобы избежать двойной обработки на уровне li
      }

      const select = sidebarSelect;
      const isMulti = select.getAttribute("data-multi") === "true";
      const key = select.getAttribute("data-filter");
      const hiddenInput = key ? document.getElementById(`filter_${key}`) : null;

      // Пропускаем клики по элементам поиска
      if (li.classList.contains("select-search")) return;

      // Обработка "Выбрать все" для мультиселектов
      if (li.classList.contains("select-all-option") && isMulti) {
        const allCheckbox = li.querySelector('input[type="checkbox"]');
        // Определяем новое состояние.
        // ВАЖНО: при клике по label/span браузер переключает checkbox ПОСЛЕ текущего click.
        // Если мы выставим checked "вручную" и пометим programmaticChange, то последующий change
        // от браузера может быть пропущен (и визуально будет казаться, что клик "не сработал").
        let shouldSelectAll;
        const clickedCheckbox = e.target.type === "checkbox";
        const clickedLabelLike = !clickedCheckbox && !!e.target.closest(".option-label");

        if (clickedCheckbox) {
          // Клик был по чекбоксу - используем его новое состояние (уже переключено выше)
          shouldSelectAll = allCheckbox ? allCheckbox.checked : true;
        } else if (clickedLabelLike) {
          // Клик по тексту/лейблу - берём "следующее" значение (инверсия текущего),
          // при этом НЕ трогаем allCheckbox.checked здесь: браузер переключит его сам.
          shouldSelectAll = allCheckbox ? !allCheckbox.checked : true;
        } else {
          // Клик был по другой части - инвертируем
          shouldSelectAll = allCheckbox ? !allCheckbox.checked : true;
          // Клик по пустой зоне строки: браузер НЕ переключит checkbox сам,
          // поэтому синхронизируем checked вручную.
          if (allCheckbox) {
            allCheckbox.dataset.programmaticChange = "true";
            allCheckbox.checked = shouldSelectAll;
            setTimeout(() => {
              delete allCheckbox.dataset.programmaticChange;
            }, 100);
          }
        }

        const optionLis = Array.from(
          select.querySelectorAll(".select-options li.select-option-item")
        );
        optionLis.forEach((optLi) => {
          optLi.classList.toggle("selected", shouldSelectAll);
          const cb = optLi.querySelector('input[type="checkbox"]');
          if (cb) {
            cb.dataset.programmaticChange = "true";
            cb.checked = shouldSelectAll;
            setTimeout(() => {
              delete cb.dataset.programmaticChange;
            }, 100);
          }
        });

        const selectedValues = shouldSelectAll
          ? optionLis
              .map((optLi) => optLi.getAttribute("data-value"))
              .filter((v) => v && v.length > 0)
          : [];

        if (hiddenInput) hiddenInput.value = JSON.stringify(selectedValues);
        select.setAttribute(
          "data-value",
          hiddenInput ? hiddenInput.value : JSON.stringify(selectedValues)
        );

        if (typeof window.renderMultiSelectTags === "function") {
          window.renderMultiSelectTags(select);
        }
        if (typeof window.positionOptions === "function") {
          window.positionOptions(select);
        }

        if (
          key === "block" &&
          typeof window.updateFunctionFilterForBlock === "function"
        ) {
          window.updateFunctionFilterForBlock(selectedValues);
        }
        if (typeof window.updateRadar === "function") {
          window.updateRadar();
        }
        return;
      }

      const value = li.getAttribute("data-value");

      // Пропускаем клики по элементам поиска
      if (li.classList.contains("select-search")) return;

      if (isMulti) {
        // Множественный выбор: переключаем выделение
        const checkbox = li.querySelector('input[type="checkbox"]');
        let newSelected;

        const clickedCheckbox = e.target.type === "checkbox";
        const clickedLabelLike = !clickedCheckbox && !!e.target.closest(".option-label");

        if (clickedCheckbox) {
          // Клик по чекбоксу: браузер уже переключил checked к моменту bubble-click
          newSelected = checkbox ? checkbox.checked : !li.classList.contains("selected");
        } else if (clickedLabelLike) {
          // Клик по тексту/лейблу: checkbox будет переключён браузером ПОСЛЕ текущего click,
          // поэтому берём "следующее" состояние как инверсию текущего checked.
          newSelected = checkbox ? !checkbox.checked : !li.classList.contains("selected");
        } else {
          // Клик по свободной области строки (не по label): управляем только через класс li
          newSelected = !li.classList.contains("selected");
        }

        // Обновляем состояние li
        li.classList.toggle("selected", newSelected);

        // ВАЖНО:
        // - если клик был по label/span, НЕ трогаем checkbox.checked здесь (браузер сделает это сам),
        //   иначе возможна рассинхронизация и пропуск обработчика change из-за programmaticChange.
        // - если клик был по чекбоксу, тоже не нужно выставлять checked (он уже выставлен браузером).
        // - если клик был по пустой зоне строки (не по label), браузер НЕ переключит checkbox,
        //   поэтому синхронизируем checked вручную.
        if (checkbox && !clickedCheckbox && !clickedLabelLike) {
          checkbox.dataset.programmaticChange = "true";
          checkbox.checked = newSelected;
          setTimeout(() => {
            delete checkbox.dataset.programmaticChange;
          }, 100);
        }

        const selected = Array.from(
          select.querySelectorAll(
            ".select-options li.select-option-item.selected"
          )
        )
          .map((x) => x.getAttribute("data-value"))
          .filter((v) => v && v.length > 0);

        if (hiddenInput) hiddenInput.value = JSON.stringify(selected);
        select.setAttribute(
          "data-value",
          hiddenInput ? hiddenInput.value : JSON.stringify(selected)
        );

        // Синхронизация состояния чекбокса "Выбрать все"
        const allLi = select.querySelector(".select-all-option");
        const allCheckbox = allLi
          ? allLi.querySelector('input[type="checkbox"]')
          : null;
        if (allCheckbox) {
          const optionLis = Array.from(
            select.querySelectorAll(".select-options li.select-option-item")
          );
          const allSelected =
            optionLis.length > 0 &&
            optionLis.every((optLi) => optLi.classList.contains("selected"));
          allCheckbox.dataset.programmaticChange = "true";
          allCheckbox.checked = allSelected;
          setTimeout(() => {
            delete allCheckbox.dataset.programmaticChange;
          }, 100);
        }

        if (typeof window.renderMultiSelectTags === "function") {
          window.renderMultiSelectTags(select);
        }
        if (typeof window.positionOptions === "function") {
          window.positionOptions(select);
        }

        if (
          key === "block" &&
          typeof window.updateFunctionFilterForBlock === "function"
        ) {
          window.updateFunctionFilterForBlock(selected);
        }

        if (typeof window.updateRadar === "function") {
          window.updateRadar();
        }
        return;
      }

      // Одиночный выбор
      // Извлекаем текст правильно: если есть span в label, берем текст из span, иначе из li
      let text = "";
      const span = li.querySelector(".option-label span");
      if (span) {
        text = span.textContent.trim();
      } else {
        text = li.textContent.trim();
      }

      // Проверяем, что value существует и не пустое
      if (!value || value === "" || value === null) {
        select.setAttribute("data-value", "");
        const textEl = select.querySelector(".selected-text");
        if (textEl) {
          textEl.textContent =
            select.getAttribute("data-placeholder") || "Выберите";
        }
        select
          .querySelectorAll(".select-options li")
          .forEach((opt) => opt.classList.remove("selected"));
        select.classList.remove("open");
        if (hiddenInput) {
          hiddenInput.value = "";
          hiddenInput.dispatchEvent(new Event("change", { bubbles: true }));
        }
        if (typeof window.updateRadar === "function") {
          window.updateRadar();
        }
        if (
          key === "block" &&
          typeof window.updateFunctionFilterForBlock === "function"
        ) {
          window.updateFunctionFilterForBlock(null);
        }
        return;
      }

      // Устанавливаем выбранное значение
      select.setAttribute("data-value", value);
      const textEl = select.querySelector(".selected-text");
      if (textEl) {
        textEl.textContent = text || value;
      }

      // Обновляем визуальное выделение
      select.querySelectorAll(".select-options li").forEach((opt) => {
        opt.classList.remove("selected");
        if (opt === li) {
          opt.classList.add("selected");
        }
      });

      select.classList.remove("open");

      if (hiddenInput) {
        hiddenInput.value = value;
        // Триггерим событие change для скрытого поля
        hiddenInput.dispatchEvent(new Event("change", { bubbles: true }));
      }

      if (
        key === "block" &&
        typeof window.updateFunctionFilterForBlock === "function"
      ) {
        window.updateFunctionFilterForBlock(value);
      }

      if (typeof window.updateRadar === "function") {
        window.updateRadar();
      }

      if (!e.target.closest(".custom-select")) {
        document
          .querySelectorAll(".custom-select")
          .forEach((s) => s.classList.remove("open"));
      }
    });

    // Обработчик для синхронизации состояния чекбоксов при прямом клике на них (sidebar)
    // ИСПРАВЛЕНО: Этот обработчик теперь только для случаев, когда клик был непосредственно на чекбокс
    // и не был обработан в обработчике click (например, через клавиатуру или программно)
    document.addEventListener("change", (e) => {
      if (
        e.target.type === "checkbox" &&
        e.target.closest(
          ".custom-select:not(.custom-select-modal) .select-options"
        )
      ) {
        const checkbox = e.target;

        // Пропускаем обработку, если изменение было программным (из обработчика click)
        if (checkbox.dataset.programmaticChange === "true") {
          return;
        }

        const li = checkbox.closest(".select-options li");
        if (!li) return;

        const select = li.closest(".custom-select");
        if (!select || select.classList.contains("custom-select-modal")) return;
        const isMulti = select.getAttribute("data-multi") === "true";
        if (!isMulti) return;

        const key = select.getAttribute("data-filter");
        const hiddenInput = key
          ? document.getElementById(`filter_${key}`)
          : null;

        // Обработка "Выбрать все"
        if (li.classList.contains("select-all-option")) {
          const shouldSelectAll = checkbox.checked;
          const optionLis = Array.from(
            select.querySelectorAll(".select-options li.select-option-item")
          );
          optionLis.forEach((optLi) => {
            optLi.classList.toggle("selected", shouldSelectAll);
            const cb = optLi.querySelector('input[type="checkbox"]');
            if (cb) {
              cb.dataset.programmaticChange = "true";
              cb.checked = shouldSelectAll;
              setTimeout(() => {
                delete cb.dataset.programmaticChange;
              }, 100);
            }
          });

          const selectedValues = shouldSelectAll
            ? optionLis
                .map((optLi) => optLi.getAttribute("data-value"))
                .filter((v) => v && v.length > 0)
            : [];

          if (hiddenInput) hiddenInput.value = JSON.stringify(selectedValues);
          select.setAttribute(
            "data-value",
            hiddenInput ? hiddenInput.value : JSON.stringify(selectedValues)
          );

          if (typeof window.renderMultiSelectTags === "function") {
            window.renderMultiSelectTags(select);
          }
          if (typeof window.positionOptions === "function") {
            window.positionOptions(select);
          }

          if (
            key === "block" &&
            typeof window.updateFunctionFilterForBlock === "function"
          ) {
            window.updateFunctionFilterForBlock(selectedValues);
          }
          if (typeof window.updateRadar === "function") {
            window.updateRadar();
          }
          return;
        }

        // Обычные элементы списка
        if (checkbox.checked) {
          li.classList.add("selected");
        } else {
          li.classList.remove("selected");
        }

        const selected = Array.from(
          select.querySelectorAll(
            ".select-options li.select-option-item.selected"
          )
        )
          .map((x) => x.getAttribute("data-value"))
          .filter((v) => v && v.length > 0);

        if (hiddenInput) hiddenInput.value = JSON.stringify(selected);
        select.setAttribute(
          "data-value",
          hiddenInput ? hiddenInput.value : JSON.stringify(selected)
        );

        // Синхронизация состояния чекбокса "Выбрать все"
        const allLi = select.querySelector(".select-all-option");
        const allCheckbox = allLi
          ? allLi.querySelector('input[type="checkbox"]')
          : null;
        if (allCheckbox) {
          const optionLis = Array.from(
            select.querySelectorAll(".select-options li.select-option-item")
          );
          const allSelected =
            optionLis.length > 0 &&
            optionLis.every((optLi) => optLi.classList.contains("selected"));
          allCheckbox.dataset.programmaticChange = "true";
          allCheckbox.checked = allSelected;
          setTimeout(() => {
            delete allCheckbox.dataset.programmaticChange;
          }, 100);
        }

        if (typeof window.renderMultiSelectTags === "function") {
          window.renderMultiSelectTags(select);
        }

        if (
          key === "block" &&
          typeof window.updateFunctionFilterForBlock === "function"
        ) {
          window.updateFunctionFilterForBlock(selected);
        }

        if (typeof window.updateRadar === "function") {
          window.updateRadar();
        }
      }
    });

    // ===== КЛАВИАТУРА ДЛЯ СЕЛЕКТОВ =====
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        document
          .querySelectorAll(".custom-select")
          .forEach((s) => s.classList.remove("open"));
      }
      const active = document.activeElement?.closest(".custom-select");
      if (!active || !active.classList.contains("open")) return;
      const items = Array.from(active.querySelectorAll(".select-options li"));
      if (items.length === 0) return;
      let idx = parseInt(active.getAttribute("data-kb-index") || "-1", 10);
      if (e.key === "ArrowDown") idx = Math.min(idx + 1, items.length - 1);
      if (e.key === "ArrowUp") idx = Math.max(idx - 1, 0);
      if (["ArrowDown", "ArrowUp"].includes(e.key)) {
        e.preventDefault();
        active.setAttribute("data-kb-index", String(idx));
        items.forEach((el, i) => el.classList.toggle("selected", i === idx));
        items[idx].scrollIntoView({ block: "nearest" });
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const sel =
          active.querySelector(".select-options li.selected") || items[0];
        if (sel) sel.click();
      }
    });

    // ===== ПОИСК В ФИЛЬТРАХ =====
    document.addEventListener("input", (e) => {
      const wrap = e.target.closest(".select-search");
      if (!wrap) return;
      const select =
        wrap.closest(".custom-select") || wrap.closest(".custom-select-modal");
      const list = select?.querySelector(".select-options");
      if (!list) return;
      const query = (e.target.value || "").toLowerCase();
      const items = Array.from(list.querySelectorAll("li[data-value]"));
      const starts = [];
      const contains = [];
      items.forEach((li) => {
        const txt = (li.textContent || "").toLowerCase();
        if (!query) {
          starts.push(li);
          return;
        }
        if (txt.startsWith(query)) starts.push(li);
        else if (txt.includes(query)) contains.push(li);
        else li.style.display = "none";
      });
      let idx = 0;
      [...starts, ...contains].forEach((li) => {
        li.style.display = "";
        li.style.order = String(idx++);
      });
    });

    // ===== МОДАЛЬНЫЕ СЕЛЕКТЫ =====
    // Используем прямое делегирование для более надежной работы
    // Используем capture phase для раннего перехвата, но с более высоким приоритетом
    document.addEventListener(
      "click",
      (e) => {
        // Сначала проверяем, что это модальный селект (ранняя проверка)
        const select = e.target.closest(".custom-select-modal");
        if (!select) return;

        // Игнорируем клики на опции внутри открытого списка - они обрабатываются отдельным обработчиком
        if (e.target.closest(".select-options li")) return;

        // Игнорируем клики на теги и кнопки удаления тегов (multi-tag, multi-tag-remove)
        if (
          e.target.closest(".multi-tag") ||
          e.target.classList.contains("multi-tag-remove") ||
          e.target.closest(".multi-tag-remove")
        )
          return;

        // Затем проверяем, что клик был на .select-trigger
        const trigger = e.target.closest(".select-trigger");
        if (!trigger || !select.contains(trigger)) return;

        e.stopPropagation();

        document.querySelectorAll(".custom-select-modal").forEach((s) => {
          if (s !== select) s.classList.remove("open");
        });
        select.classList.toggle("open");
        if (select.classList.contains("open")) {
          if (typeof window.positionOptions === "function") {
            window.positionOptions(select);
          }
          const searchInputInside = select.querySelector(
            ".select-search input"
          );
          if (searchInputInside) setTimeout(() => searchInputInside.focus(), 0);
        }
      },
      true
    ); // Используем capture phase

    // Обработка кликов по опциям в модальных селектах
    // Используем bubble phase (по умолчанию), чтобы сработать после обработчика открытия/закрытия
    document.addEventListener("click", (e) => {
      // Проверяем, что клик внутри выпадающего списка модального селекта
      const isInModalSelectOptions = e.target.closest(
        ".custom-select-modal .select-options"
      );
      if (!isInModalSelectOptions) {
        return;
      }

      // Пропускаем клики по элементам поиска
      if (e.target.closest(".select-search")) {
        return;
      }

      // Пропускаем клики по триггеру открытия/закрытия
      if (e.target.closest(".select-trigger")) {
        return;
      }

      // ИСПРАВЛЕНО: Находим li элемент, включая клики по span, label и чекбоксу
      let li = null;
      const modalSelect = e.target.closest(".custom-select-modal");

      if (modalSelect) {
        // Пробуем найти через closest
        li = e.target.closest("li");

        // Если не нашли, ищем через родительские элементы
        if (!li) {
          let current = e.target;
          while (current && current !== document.body) {
            if (current.tagName === "LI") {
              const selectOptions =
                modalSelect.querySelector(".select-options");
              if (selectOptions && selectOptions.contains(current)) {
                li = current;
                break;
              }
            }
            current = current.parentElement;
          }
        }

        // Проверяем, что li находится внутри .select-options модального селекта
        if (li) {
          const selectOptions = modalSelect.querySelector(".select-options");
          if (!selectOptions || !selectOptions.contains(li)) {
            li = null;
          }
        }
      }

      // Если li не найден или modalSelect не найден, выходим
      if (!li || !modalSelect) {
        return;
      }

      // Проверяем, что li находится внутри .select-options модального селекта
      const optionsContainer = modalSelect.querySelector(".select-options");
      if (!optionsContainer || !optionsContainer.contains(li)) {
        return;
      }

      // ИСПРАВЛЕНО: Если клик был по label или span, обрабатываем через label
      // Клик по label автоматически активирует связанный чекбокс
      if (
        e.target.tagName === "LABEL" ||
        (e.target.tagName === "SPAN" && e.target.closest(".option-label"))
      ) {
        e.stopPropagation();
      }

      // Если клик был непосредственно на чекбокс, позволяем стандартное поведение браузера
      // Браузер сам переключит checked состояние
      if (e.target.type === "checkbox") {
        // Не блокируем стандартное поведение - позволяем браузеру переключить чекбокс
        e.stopPropagation(); // Останавливаем всплытие, чтобы избежать двойной обработки на уровне li
      } else {
        e.stopPropagation();
      }

      const select = modalSelect;
      const hiddenInputId = select.dataset.field;
      const hiddenInput = document.getElementById(hiddenInputId);
      const isMulti = select.getAttribute("data-multi") === "true";

      // Пропускаем клики по элементам поиска
      if (li.classList.contains("select-search")) return;

      // Определяем, есть ли чекбоксы в этом селекте
      const hasCheckboxes = [
        "techBlock",
        "techFunc",
        "editBlock",
        "editFunc",
      ].includes(hiddenInputId);

      // Обработка "Выбрать все" для селектов с чекбоксами
      if (
        li.classList.contains("select-all-option") &&
        isMulti &&
        hasCheckboxes
      ) {
        const allCheckbox = li.querySelector('input[type="checkbox"]');
        // Определяем новое состояние.
        // ВАЖНО: при клике по label/span браузер переключает checkbox ПОСЛЕ текущего click.
        // Если выставить checked вручную и пометить programmaticChange, можно "съесть" change.
        let shouldSelectAll;
        const clickedCheckbox = e.target.type === "checkbox";
        const clickedLabelLike = !clickedCheckbox && !!e.target.closest(".option-label");

        if (clickedCheckbox) {
          // Клик был по чекбоксу - используем его новое состояние (уже переключено выше)
          shouldSelectAll = allCheckbox ? allCheckbox.checked : true;
        } else if (clickedLabelLike) {
          // Клик по тексту/лейблу - берём "следующее" значение (инверсия текущего),
          // при этом НЕ трогаем allCheckbox.checked здесь: браузер переключит его сам.
          shouldSelectAll = allCheckbox ? !allCheckbox.checked : true;
        } else {
          // Клик был по другой части - инвертируем
          shouldSelectAll = allCheckbox ? !allCheckbox.checked : true;
          // Клик по пустой зоне строки: браузер НЕ переключит checkbox сам,
          // поэтому синхронизируем checked вручную.
          if (allCheckbox) {
            allCheckbox.dataset.programmaticChange = "true";
            allCheckbox.checked = shouldSelectAll;
            setTimeout(() => {
              delete allCheckbox.dataset.programmaticChange;
            }, 100);
          }
        }

        const optionLis = Array.from(
          select.querySelectorAll(".select-options li.select-option-item")
        );
        optionLis.forEach((optLi) => {
          optLi.classList.toggle("selected", shouldSelectAll);
          const cb = optLi.querySelector('input[type="checkbox"]');
          if (cb) {
            cb.dataset.programmaticChange = "true";
            cb.checked = shouldSelectAll;
            setTimeout(() => {
              delete cb.dataset.programmaticChange;
            }, 100);
          }
        });

        const selectedValues = shouldSelectAll
          ? optionLis
              .map((optLi) => optLi.getAttribute("data-value"))
              .filter((v) => v && v.length > 0)
          : [];

        if (hiddenInput) hiddenInput.value = JSON.stringify(selectedValues);
        select.setAttribute(
          "data-value",
          hiddenInput ? hiddenInput.value : JSON.stringify(selectedValues)
        );

        if (typeof window.renderMultiSelectTags === "function") {
          window.renderMultiSelectTags(select);
        }
        if (typeof window.positionOptions === "function") {
          window.positionOptions(select);
        }

        // Динамическая фильтрация
        if (
          hiddenInputId === "techBlock" &&
          typeof window.updateModalFunctionsForBlocks === "function"
        ) {
          window.updateModalFunctionsForBlocks(selectedValues, "techFunc");
        } else if (
          hiddenInputId === "editBlock" &&
          typeof window.updateModalFunctionsForBlocks === "function"
        ) {
          window.updateModalFunctionsForBlocks(selectedValues, "editFunc");
        }
        return;
      }

      // Пропускаем клики по элементам поиска и другим служебным элементам
      if (li.classList.contains("select-search")) return;

      // Пропускаем элементы без data-value (служебные элементы)
      const value = li.getAttribute("data-value");
      if (value === null && !li.classList.contains("select-all-option")) {
        return;
      }

      // Извлекаем текст правильно: если есть span в label, берем текст из span, иначе из li
      let text = "";
      const span = li.querySelector(".option-label span");
      if (span) {
        text = span.textContent.trim();
      } else {
        text = li.textContent.trim();
      }

      if (isMulti) {
        // Множественный выбор: переключаем выделение
        const checkbox = li.querySelector('input[type="checkbox"]');
        let newSelected;

        const clickedCheckbox = e.target.type === "checkbox";
        const clickedLabelLike = !clickedCheckbox && !!e.target.closest(".option-label");

        if (clickedCheckbox) {
          // Клик по чекбоксу: браузер уже переключил checked к моменту bubble-click
          newSelected = checkbox ? checkbox.checked : !li.classList.contains("selected");
        } else if (clickedLabelLike) {
          // Клик по тексту/лейблу: checkbox будет переключён браузером ПОСЛЕ текущего click,
          // поэтому берём "следующее" состояние как инверсию текущего checked.
          newSelected = checkbox ? !checkbox.checked : !li.classList.contains("selected");
        } else {
          // Клик по свободной области строки (не по label): управляем только через класс li
          newSelected = !li.classList.contains("selected");
        }

        // Обновляем состояние li
        li.classList.toggle("selected", newSelected);

        // ВАЖНО:
        // - если клик был по label/span, НЕ трогаем checkbox.checked здесь (браузер сделает это сам),
        //   иначе возможна рассинхронизация и пропуск обработчика change из-за programmaticChange.
        // - если клик был по чекбоксу, тоже не нужно выставлять checked (он уже выставлен браузером).
        // - если клик был по пустой зоне строки (не по label), браузер НЕ переключит checkbox,
        //   поэтому синхронизируем checked вручную.
        if (hasCheckboxes && checkbox && !clickedCheckbox && !clickedLabelLike) {
          checkbox.dataset.programmaticChange = "true";
          checkbox.checked = newSelected;
          setTimeout(() => {
            delete checkbox.dataset.programmaticChange;
          }, 100);
        }

        // Получаем выбранные значения
        const selectedSelector = hasCheckboxes
          ? ".select-options li.select-option-item.selected"
          : ".select-options li.selected";
        const selected = Array.from(select.querySelectorAll(selectedSelector))
          .map((x) => x.getAttribute("data-value"))
          .filter((v) => v && v.length > 0);

        if (hiddenInput) hiddenInput.value = JSON.stringify(selected);
        select.setAttribute(
          "data-value",
          hiddenInput ? hiddenInput.value : JSON.stringify(selected)
        );

        // Синхронизация состояния чекбокса "Выбрать все"
        if (hasCheckboxes) {
          const allLi = select.querySelector(".select-all-option");
          const allCheckbox = allLi
            ? allLi.querySelector('input[type="checkbox"]')
            : null;
          if (allCheckbox) {
            const optionLis = Array.from(
              select.querySelectorAll(".select-options li.select-option-item")
            );
            const allSelected =
              optionLis.length > 0 &&
              optionLis.every((optLi) => optLi.classList.contains("selected"));
            allCheckbox.dataset.programmaticChange = "true";
            allCheckbox.checked = allSelected;
            setTimeout(() => {
              delete allCheckbox.dataset.programmaticChange;
            }, 100);
          }
        }

        if (typeof window.renderMultiSelectTags === "function") {
          window.renderMultiSelectTags(select);
        }
        if (typeof window.positionOptions === "function") {
          window.positionOptions(select);
        }

        // Если это поле techCompany, обновляем видимость полей оценок
        if (
          hiddenInputId === "techCompany" &&
          typeof window.updateTechRatingsVisibility === "function"
        ) {
          setTimeout(() => {
            window.updateTechRatingsVisibility();
          }, 50);
        }
        // Если это поле editCompany, обновляем видимость полей оценок в форме редактирования
        if (
          hiddenInputId === "editCompany" &&
          typeof window.updateEditTechRatingsVisibility === "function"
        ) {
          setTimeout(() => {
            window.updateEditTechRatingsVisibility();
          }, 50);
        }

        // Динамическая фильтрация блоков и функций в модалке добавления технологии
        if (
          hiddenInputId === "techSector" &&
          typeof window.updateModalBlocksForSectors === "function"
        ) {
          window.updateModalBlocksForSectors(selected);
        } else if (
          hiddenInputId === "techBlock" &&
          typeof window.updateModalFunctionsForBlocks === "function"
        ) {
          window.updateModalFunctionsForBlocks(selected, "techFunc");
        } else if (
          hiddenInputId === "editBlock" &&
          typeof window.updateModalFunctionsForBlocks === "function"
        ) {
          window.updateModalFunctionsForBlocks(selected, "editFunc");
        }
        return;
      }

      // single-select (для селектов без чекбоксов или одиночного выбора)
      // Проверяем, что value существует и не пустое
      if (!value || value === "" || value === null) {
        if (hiddenInput) hiddenInput.value = "";
        select.setAttribute("data-value", "");
        const textEl = select.querySelector(".selected-text");
        if (textEl) {
          textEl.textContent =
            select.getAttribute("data-placeholder") || "Выберите";
        }
        select
          .querySelectorAll(".select-options li")
          .forEach((opt) => opt.classList.remove("selected"));
        select.classList.remove("open");
        return;
      }

      // Устанавливаем выбранное значение
      if (hiddenInput) {
        hiddenInput.value = value;
        // Триггерим событие change для скрытого поля, чтобы формы могли его обработать
        hiddenInput.dispatchEvent(new Event("change", { bubbles: true }));
      }
      select.setAttribute("data-value", value);

      const textEl = select.querySelector(".selected-text");
      if (textEl) {
        textEl.textContent = text || value;
      }

      // Обновляем визуальное выделение
      select.querySelectorAll(".select-options li").forEach((opt) => {
        opt.classList.remove("selected");
        if (opt === li) {
          opt.classList.add("selected");
        }
      });

      // Закрываем выпадающий список
      select.classList.remove("open");

      // Обновляем видимость полей оценок для techCompany
      if (
        hiddenInputId === "techCompany" &&
        typeof window.updateTechRatingsVisibility === "function"
      ) {
        setTimeout(() => {
          window.updateTechRatingsVisibility();
        }, 50);
      }
      // Обновляем видимость полей оценок для editCompany
      if (
        hiddenInputId === "editCompany" &&
        typeof window.updateEditTechRatingsVisibility === "function"
      ) {
        setTimeout(() => {
          window.updateEditTechRatingsVisibility();
        }, 50);
      }

      // Динамическая фильтрация для techSector (single-select)
      if (
        hiddenInputId === "techSector" &&
        typeof window.updateModalBlocksForSectors === "function"
      ) {
        window.updateModalBlocksForSectors([value]);
      }
      // Динамическая фильтрация для techBlock (single-select)
      if (
        hiddenInputId === "techBlock" &&
        typeof window.updateModalFunctionsForBlocks === "function"
      ) {
        window.updateModalFunctionsForBlocks([value], "techFunc");
      }

      if (!e.target.closest(".custom-select-modal")) {
        document
          .querySelectorAll(".custom-select-modal")
          .forEach((s) => s.classList.remove("open"));
      }
    });

    // Обработчик для синхронизации состояния чекбоксов при прямом клике на них в модальных селектах
    // ИСПРАВЛЕНО: Этот обработчик теперь только для случаев, когда клик был непосредственно на чекбокс
    // и не был обработан в обработчике click (например, через клавиатуру или программно)
    document.addEventListener("change", (e) => {
      if (
        e.target.type === "checkbox" &&
        e.target.closest(".custom-select-modal .select-options")
      ) {
        const checkbox = e.target;

        // Пропускаем обработку, если изменение было программным (из обработчика click)
        if (checkbox.dataset.programmaticChange === "true") {
          return;
        }

        const li = checkbox.closest(".select-options li");
        if (!li) return;

        const select = li.closest(".custom-select-modal");
        if (!select) return;
        const isMulti = select.getAttribute("data-multi") === "true";
        if (!isMulti) return;

        const hiddenInputId = select.dataset.field;
        const hiddenInput = document.getElementById(hiddenInputId);
        const hasCheckboxes = [
          "techBlock",
          "techFunc",
          "editBlock",
          "editFunc",
        ].includes(hiddenInputId);

        // Обработка "Выбрать все"
        if (li.classList.contains("select-all-option") && hasCheckboxes) {
          const shouldSelectAll = checkbox.checked;
          const optionLis = Array.from(
            select.querySelectorAll(".select-options li.select-option-item")
          );
          optionLis.forEach((optLi) => {
            optLi.classList.toggle("selected", shouldSelectAll);
            const cb = optLi.querySelector('input[type="checkbox"]');
            if (cb) {
              cb.dataset.programmaticChange = "true";
              cb.checked = shouldSelectAll;
              setTimeout(() => {
                delete cb.dataset.programmaticChange;
              }, 100);
            }
          });

          const selectedValues = shouldSelectAll
            ? optionLis
                .map((optLi) => optLi.getAttribute("data-value"))
                .filter((v) => v && v.length > 0)
            : [];

          if (hiddenInput) hiddenInput.value = JSON.stringify(selectedValues);
          select.setAttribute(
            "data-value",
            hiddenInput ? hiddenInput.value : JSON.stringify(selectedValues)
          );

          if (typeof window.renderMultiSelectTags === "function") {
            window.renderMultiSelectTags(select);
          }
          if (typeof window.positionOptions === "function") {
            window.positionOptions(select);
          }

          // Динамическая фильтрация
          if (
            hiddenInputId === "techSector" &&
            typeof window.updateModalBlocksForSectors === "function"
          ) {
            window.updateModalBlocksForSectors(selectedValues);
          } else if (
            hiddenInputId === "techBlock" &&
            typeof window.updateModalFunctionsForBlocks === "function"
          ) {
            window.updateModalFunctionsForBlocks(selectedValues, "techFunc");
          } else if (
            hiddenInputId === "editBlock" &&
            typeof window.updateModalFunctionsForBlocks === "function"
          ) {
            window.updateModalFunctionsForBlocks(selectedValues, "editFunc");
          }
          return;
        }

        // Обычные элементы списка
        if (checkbox.checked) {
          li.classList.add("selected");
        } else {
          li.classList.remove("selected");
        }

        const selectedSelector = hasCheckboxes
          ? ".select-options li.select-option-item.selected"
          : ".select-options li.selected";
        const selected = Array.from(select.querySelectorAll(selectedSelector))
          .map((x) => x.getAttribute("data-value"))
          .filter((v) => v && v.length > 0);

        if (hiddenInput) hiddenInput.value = JSON.stringify(selected);
        select.setAttribute(
          "data-value",
          hiddenInput ? hiddenInput.value : JSON.stringify(selected)
        );

        // Синхронизация состояния чекбокса "Выбрать все"
        if (hasCheckboxes) {
          const allLi = select.querySelector(".select-all-option");
          const allCheckbox = allLi
            ? allLi.querySelector('input[type="checkbox"]')
            : null;
          if (allCheckbox) {
            const optionLis = Array.from(
              select.querySelectorAll(".select-options li.select-option-item")
            );
            const allSelected =
              optionLis.length > 0 &&
              optionLis.every((optLi) => optLi.classList.contains("selected"));
            allCheckbox.dataset.programmaticChange = "true";
            allCheckbox.checked = allSelected;
            setTimeout(() => {
              delete allCheckbox.dataset.programmaticChange;
            }, 100);
          }
        }

        if (typeof window.renderMultiSelectTags === "function") {
          window.renderMultiSelectTags(select);
        }

        // Если это поле techCompany, обновляем видимость полей оценок
        if (
          hiddenInputId === "techCompany" &&
          typeof window.updateTechRatingsVisibility === "function"
        ) {
          setTimeout(() => {
            window.updateTechRatingsVisibility();
          }, 50);
        }
        // Если это поле editCompany, обновляем видимость полей оценок в форме редактирования
        if (
          hiddenInputId === "editCompany" &&
          typeof window.updateEditTechRatingsVisibility === "function"
        ) {
          setTimeout(() => {
            window.updateEditTechRatingsVisibility();
          }, 50);
        }

        // Динамическая фильтрация блоков и функций в модалке добавления технологии
        if (
          hiddenInputId === "techSector" &&
          typeof window.updateModalBlocksForSectors === "function"
        ) {
          window.updateModalBlocksForSectors(selected);
        } else if (
          hiddenInputId === "techBlock" &&
          typeof window.updateModalFunctionsForBlocks === "function"
        ) {
          window.updateModalFunctionsForBlocks(selected, "techFunc");
        } else if (
          hiddenInputId === "editBlock" &&
          typeof window.updateModalFunctionsForBlocks === "function"
        ) {
          window.updateModalFunctionsForBlocks(selected, "editFunc");
        }
      }
    });

    // Клавиатура для модальных селектов
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        document
          .querySelectorAll(".custom-select-modal")
          .forEach((s) => s.classList.remove("open"));
      }
      const active = e.target.closest(".custom-select-modal");
      if (!active || !active.classList.contains("open")) return;
      const items = Array.from(active.querySelectorAll(".select-options li"));
      if (items.length === 0) return;
      let idx = parseInt(active.getAttribute("data-kb-index") || "-1", 10);
      if (e.key === "ArrowDown") idx = Math.min(idx + 1, items.length - 1);
      if (e.key === "ArrowUp") idx = Math.max(idx - 1, 0);
      if (["ArrowDown", "ArrowUp"].includes(e.key)) {
        e.preventDefault();
        active.setAttribute("data-kb-index", String(idx));
        items.forEach((el, i) => el.classList.toggle("selected", i === idx));
        items[idx].scrollIntoView({ block: "nearest" });
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const sel =
          active.querySelector(".select-options li.selected") || items[0];
        if (sel) sel.click();
      }
    });

    // Поиск в модальных селектах
    document.addEventListener("input", (e) => {
      const wrap = e.target.closest(".select-search");
      if (!wrap) return;
      const select = wrap.closest(".custom-select-modal");
      const list = select?.querySelector(".select-options");
      if (!list) return;
      const query = (e.target.value || "").toLowerCase();
      const items = Array.from(list.querySelectorAll("li[data-value]"));
      const starts = [];
      const contains = [];
      items.forEach((li) => {
        const txt = (li.textContent || "").toLowerCase();
        if (!query) {
          starts.push(li);
          return;
        }
        if (txt.startsWith(query)) starts.push(li);
        else if (txt.includes(query)) contains.push(li);
        else li.style.display = "none";
      });
      let idx = 0;
      [...starts, ...contains].forEach((li) => {
        li.style.display = "";
        li.style.order = String(idx++);
      });
    });
  }

  // ===== SELECT POSITIONING =====
  // Модуль для позиционирования выпадающих списков селектов

  function positionOptions(select) {
    if (!select) return;

    const dropdown = select.querySelector('.select-dropdown');
    const list = dropdown || select.querySelector('.select-options');
    if (!list) return;

    // Если есть dropdown, просто устанавливаем ширину
    if (dropdown) {
      const width = select.offsetWidth;
      dropdown.style.minWidth = `${width}px`;
      dropdown.style.width = `${width}px`;
      return;
    }

    // Позиционирование для обычного списка
    const selectRect = select.getBoundingClientRect();
    const listRect = list.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const spaceBelow = viewportHeight - selectRect.bottom;
    const spaceAbove = selectRect.top;

    if (spaceBelow < listRect.height && spaceAbove > spaceBelow) {
      // Открываем вверх
      list.style.bottom = `${select.offsetHeight}px`;
      list.style.top = 'auto';
    } else {
      // Открываем вниз
      list.style.top = `${select.offsetHeight}px`;
      list.style.bottom = 'auto';
    }
  }

  // Экспорт функции инициализации для использования в events.js
  // Инициализация происходит через events.js, который правильно обрабатывает загрузку DOM
  if (typeof window !== "undefined") {
    window.initSelectEvents = initSelectEvents;
    // Экспорт SelectPositioning для обратной совместимости
    window.SelectPositioning = { positionOptions };
    window.positionOptions = positionOptions;
  }
})();
