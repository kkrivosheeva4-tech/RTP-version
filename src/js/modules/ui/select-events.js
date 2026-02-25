// select-events.js — ES module
// Обработка событий для кастомных селектов (sidebar и модальных)

import { DOMCache } from '../core/dom-utils.js';

"use strict";

  // Инициализация обработчиков событий для селектов
  function initSelectEvents() {
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
          // Убираем класс с родительского filter-group при закрытии других селектов
          const parentGroup = s.closest("#filterPanel .filter-group");
          if (parentGroup) {
            parentGroup.classList.remove("has-open-dropdown");
          }
        });
        select.classList.toggle("open");
        // Управляем классом на родительском filter-group для поддержки браузеров без :has()
        const parentGroup = select.closest("#filterPanel .filter-group");
        if (parentGroup) {
          if (select.classList.contains("open")) {
            parentGroup.classList.add("has-open-dropdown");
          } else {
            parentGroup.classList.remove("has-open-dropdown");
          }
        }
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
            // Удаляем флаг программного изменения в следующем кадре
            requestAnimationFrame(() => {
              delete cb.dataset.programmaticChange;
            });
          }
        });

        const selectedValues = shouldSelectAll
          ? optionLis
              .map((optLi) => optLi.getAttribute("data-value"))
              .filter((v) => v && v.length > 0)
          : [];

        if (hiddenInput) {
          hiddenInput.value = JSON.stringify(selectedValues);
          hiddenInput.dispatchEvent(new Event("input", { bubbles: true }));
          hiddenInput.dispatchEvent(new Event("change", { bubbles: true }));
        }
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

        // Выполняем тяжелые операции асинхронно, чтобы не блокировать обработчик событий
        requestAnimationFrame(() => {
          if (
            key === "block" &&
            typeof window.updateFunctionFilterForBlock === "function"
          ) {
            window.updateFunctionFilterForBlock(selectedValues);
          }
          if (typeof window.updateRadar === "function") {
            window.updateRadar();
          }
        });
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
          // Клик по тексту/лейблу (span/label): браузер переключит checkbox автоматически
          // НЕ обновляем класс li здесь - событие change обработает это полностью
          // Это предотвращает рассинхронизацию между классом li и состоянием checkbox
          return; // Выходим раньше, чтобы событие change обработало обновление
        } else {
          // Клик по свободной области строки (не по label): управляем вручную
          newSelected = !li.classList.contains("selected");
          li.classList.toggle("selected", newSelected);
          if (checkbox) {
            checkbox.dataset.programmaticChange = "true";
            checkbox.checked = newSelected;
            requestAnimationFrame(() => {
              delete checkbox.dataset.programmaticChange;
            });
          }
        }

        // Если клик был по чекбоксу, обновляем класс li синхронно с состоянием checkbox
        if (clickedCheckbox && checkbox) {
          li.classList.toggle("selected", checkbox.checked);
        }

        // Выполняем все операции асинхронно, чтобы не блокировать обработчик событий
        requestAnimationFrame(() => {
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
            requestAnimationFrame(() => {
              delete allCheckbox.dataset.programmaticChange;
            });
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
        });
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
        // Убираем класс с родительского filter-group при закрытии селекта
        const parentGroupForReset = select.closest("#filterPanel .filter-group");
        if (parentGroupForReset) {
          parentGroupForReset.classList.remove("has-open-dropdown");
        }
        if (hiddenInput) {
          hiddenInput.value = "";
          hiddenInput.dispatchEvent(new Event("change", { bubbles: true }));
        }
        // Выполняем тяжелые операции асинхронно, чтобы не блокировать обработчик событий
        requestAnimationFrame(() => {
          if (typeof window.updateRadar === "function") {
            window.updateRadar();
          }
          if (
            key === "block" &&
            typeof window.updateFunctionFilterForBlock === "function"
          ) {
            window.updateFunctionFilterForBlock(null);
          }
        });
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
      // Убираем класс с родительского filter-group при закрытии селекта
      const parentGroupForOption = select.closest("#filterPanel .filter-group");
      if (parentGroupForOption) {
        parentGroupForOption.classList.remove("has-open-dropdown");
      }

      if (hiddenInput) {
        hiddenInput.value = value;
        // Триггерим событие change для скрытого поля
        hiddenInput.dispatchEvent(new Event("change", { bubbles: true }));
      }

      // Выполняем тяжелые операции асинхронно, чтобы не блокировать обработчик событий
      requestAnimationFrame(() => {
        if (
          key === "block" &&
          typeof window.updateFunctionFilterForBlock === "function"
        ) {
          window.updateFunctionFilterForBlock(value);
        }

        if (typeof window.updateRadar === "function") {
          window.updateRadar();
        }
      });

      if (!e.target.closest(".custom-select")) {
        document
          .querySelectorAll(".custom-select")
          .forEach((s) => {
            s.classList.remove("open");
            // Убираем класс с родительского filter-group при закрытии селекта
            const parentGroup = s.closest("#filterPanel .filter-group");
            if (parentGroup) {
              parentGroup.classList.remove("has-open-dropdown");
            }
          });
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
              // Удаляем флаг программного изменения в следующем кадре
              requestAnimationFrame(() => {
                delete cb.dataset.programmaticChange;
              });
            }
          });

          const selectedValues = shouldSelectAll
            ? optionLis
                .map((optLi) => optLi.getAttribute("data-value"))
                .filter((v) => v && v.length > 0)
            : [];

          if (hiddenInput) {
            hiddenInput.value = JSON.stringify(selectedValues);
            hiddenInput.dispatchEvent(new Event("input", { bubbles: true }));
            hiddenInput.dispatchEvent(new Event("change", { bubbles: true }));
          }
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

          // Выполняем тяжелые операции асинхронно, чтобы не блокировать обработчик событий
          requestAnimationFrame(() => {
            if (
              key === "block" &&
              typeof window.updateFunctionFilterForBlock === "function"
            ) {
              window.updateFunctionFilterForBlock(selectedValues);
            }
            if (typeof window.updateRadar === "function") {
              window.updateRadar();
            }
          });
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

        if (hiddenInput) {
          hiddenInput.value = JSON.stringify(selected);
          hiddenInput.dispatchEvent(new Event("input", { bubbles: true }));
          hiddenInput.dispatchEvent(new Event("change", { bubbles: true }));
        }
        select.setAttribute(
          "data-value",
          hiddenInput ? hiddenInput.value : JSON.stringify(selected)
        );

        // Выполняем все тяжелые операции асинхронно, чтобы не блокировать обработчик событий
        requestAnimationFrame(() => {
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
            requestAnimationFrame(() => {
              delete allCheckbox.dataset.programmaticChange;
            });
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
        });
      }
    });

    // ===== КЛАВИАТУРА ДЛЯ СЕЛЕКТОВ =====
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        document
          .querySelectorAll(".custom-select")
          .forEach((s) => {
            s.classList.remove("open");
            // Убираем класс с родительского filter-group при закрытии селекта
            const parentGroup = s.closest("#filterPanel .filter-group");
            if (parentGroup) {
              parentGroup.classList.remove("has-open-dropdown");
            }
          });
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

    // Флаг для предотвращения немедленного закрытия только что открытого селекта
    const recentlyOpenedSelects = new WeakMap();
    let recentlyOpenedTimeout = null;

    document.addEventListener(
      "click",
      (e) => {
        // Сначала проверяем, что это модальный селект (ранняя проверка)
        const select = e.target.closest(".custom-select-modal");
        if (!select) return;

        // Игнорируем клики на опции внутри открытого списка - они обрабатываются отдельным обработчиком
        // НО только если это не клик по кнопке добавления нового вендора/интегратора
        const clickedLi = e.target.closest(".select-options li");
        if (clickedLi && !clickedLi.classList.contains("add-new-vendor-option") && !clickedLi.classList.contains("add-new-integrator-option")) {
          return;
        }

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

        // Устанавливаем флаг на самом событии ПЕРЕД остановкой распространения
        // чтобы глобальный обработчик мог его проверить даже если событие остановлено
        e._selectHandled = true;
        e._selectElement = select; // Сохраняем ссылку на селект для дополнительной проверки

        // Останавливаем распространение события, чтобы другие обработчики не закрыли список
        // Важно: stopImmediatePropagation останавливает все обработчики на текущей фазе,
        // но обработчики в других фазах (bubble) все еще могут сработать
        e.stopPropagation();
        e.stopImmediatePropagation(); // Останавливаем все обработчики на этом элементе

        document.querySelectorAll(".custom-select-modal").forEach((s) => {
          if (s !== select) s.classList.remove("open");
        });
        const isVendorSelect = select.classList.contains("vendor-select");
        const isIntegratorSelect = select.classList.contains("integrator-select");
        const options = select.querySelector(".select-options");

        const wasOpen = select.classList.contains("open");

        select.classList.toggle("open");
        const isNowOpen = select.classList.contains("open");

        // Для селектов вендоров и интеграторов применяем стили ПОСЛЕ добавления класса open
        // чтобы CSS правила для .open сработали, а затем inline стили гарантируют отображение
        if ((isVendorSelect || isIntegratorSelect) && options && isNowOpen && !wasOpen) {
          // Если открывается селект интеграторов - скрываем кнопку добавления интегратора
          if (isIntegratorSelect) {
            const vendorIntegratorsSection = select.closest('.vendor-integrators');
            if (vendorIntegratorsSection) {
              const addIntegratorBtn = vendorIntegratorsSection.querySelector('.add-integrator-btn');
              if (addIntegratorBtn) {
                addIntegratorBtn.style.display = 'none';
              }
            }
          }
          // Функция для принудительного применения стилей
          const applyStyles = () => {
            // Для absolute позиционирования не нужно вычислять координаты вручную
            // CSS уже установит правильную позицию через top: calc(100% + 6px)
            // Просто убеждаемся, что стили видимости применены

            options.style.setProperty('display', 'block', 'important');
            options.style.setProperty('visibility', 'visible', 'important');
            options.style.setProperty('opacity', '1', 'important');
            options.style.setProperty('pointer-events', 'auto', 'important');
            options.style.setProperty('z-index', '10008', 'important');
            options.style.setProperty('position', 'absolute', 'important');
            // Убеждаемся, что позиционирование установлено правильно
            options.style.setProperty('top', 'calc(100% + 6px)', 'important');
            options.style.setProperty('left', '0', 'important');
            options.style.setProperty('right', '0', 'important');
            options.style.setProperty('width', '100%', 'important');

            void options.offsetHeight; // Force reflow

            // Получаем координаты селекта для логирования
            const selectRect = select.getBoundingClientRect();
            // Проверяем, что список имеет высоту и виден
            const rect = options.getBoundingClientRect();
            const hasItems = options.querySelectorAll('li').length > 0;

            if (window.Logger) {
              window.Logger.debug(`${isVendorSelect ? 'Вендор' : 'Интегратор'} селект: применение стилей`, {
                selectRect: {
                  top: selectRect.top,
                  bottom: selectRect.bottom,
                  left: selectRect.left,
                  width: selectRect.width
                },
                optionsStyle: {
                  top: options.style.top,
                  left: options.style.left,
                  width: options.style.width
                },
                computedStyle: {
                  display: window.getComputedStyle(options).display,
                  visibility: window.getComputedStyle(options).visibility,
                  opacity: window.getComputedStyle(options).opacity,
                  position: window.getComputedStyle(options).position
                },
                rect: {
                  top: rect.top,
                  left: rect.left,
                  height: rect.height,
                  width: rect.width
                },
                hasItems: hasItems,
                itemsCount: options.querySelectorAll('li').length
              });
            }

            if (rect.height === 0 && hasItems) {
              // Если высота 0, но есть элементы - принудительно устанавливаем высоту
              options.style.setProperty('min-height', '40px', 'important');
              void options.offsetHeight; // Force reflow again
            }
          };

          // Применяем стили синхронно после добавления класса open
          applyStyles();

          // Дополнительно проверяем стили через requestAnimationFrame
          // чтобы гарантировать правильное отображение после всех обновлений DOM
          requestAnimationFrame(() => {
            if (options) {
              const computedStyle = window.getComputedStyle(options);
              if (computedStyle.display === 'none' || computedStyle.visibility === 'hidden' || computedStyle.opacity === '0') {
                options.style.setProperty('display', 'block', 'important');
                options.style.setProperty('visibility', 'visible', 'important');
                options.style.setProperty('opacity', '1', 'important');
              }
              // Убеждаемся, что позиционирование правильное
              options.style.setProperty('position', 'absolute', 'important');
              options.style.setProperty('top', 'calc(100% + 6px)', 'important');
              options.style.setProperty('left', '0', 'important');
              options.style.setProperty('right', '0', 'important');
              options.style.setProperty('width', '100%', 'important');
            }
          });

          // Создаем MutationObserver для отслеживания изменений стилей
          // и автоматического восстановления их при необходимости
          const styleObserver = new MutationObserver(() => {
            if (select.classList.contains('open')) {
              const computedStyle = window.getComputedStyle(options);
              if (computedStyle.display === 'none' || computedStyle.visibility === 'hidden' || computedStyle.opacity === '0') {
                applyStyles();
              }
            }
          });

          // Наблюдаем за изменениями атрибутов style и class
          styleObserver.observe(options, {
            attributes: true,
            attributeFilter: ['style', 'class']
          });

          styleObserver.observe(select, {
            attributes: true,
            attributeFilter: ['class']
          });

          // Функция для обновления позиции при скролле или изменении размера окна
          // Для absolute позиционирования обновление не требуется, так как позиция относительная
          const updatePosition = () => {
            // Для absolute позиционирования позиция автоматически обновляется относительно родителя
            // Ничего делать не нужно
          };

          // Обработчики для обновления позиции
          const scrollHandler = () => updatePosition();
          const resizeHandler = () => updatePosition();

          // Добавляем обработчики на window и modal-body
          window.addEventListener('scroll', scrollHandler, true);
          window.addEventListener('resize', resizeHandler);
          const modalBody = select.closest('.modal-body');
          if (modalBody) {
            modalBody.addEventListener('scroll', scrollHandler, true);
          }

          // Сохраняем observer и обработчики для очистки при закрытии
          select._vendorStyleObserver = styleObserver;
          select._vendorScrollHandler = scrollHandler;
          select._vendorResizeHandler = resizeHandler;
          select._vendorModalBody = modalBody;
          // Для интеграторов используем те же имена свойств для единообразия
          if (isIntegratorSelect) {
            select._integratorStyleObserver = styleObserver;
            select._integratorScrollHandler = scrollHandler;
            select._integratorResizeHandler = resizeHandler;
            select._integratorModalBody = modalBody;
          }

          // Дополнительно: убеждаемся, что стили применены через микро-задержку
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              const computedStyle = window.getComputedStyle(options);
              if (computedStyle.display === 'none' || computedStyle.visibility === 'hidden' || computedStyle.opacity === '0') {
                applyStyles();
              }

              if (window.Logger) {
                window.Logger.debug(`${isVendorSelect ? 'Вендор' : 'Интегратор'} селект: стили применены после открытия`, {
                  display: computedStyle.display,
                  visibility: computedStyle.visibility,
                  opacity: computedStyle.opacity,
                  zIndex: computedStyle.zIndex
                });
              }
            });
          });
        }

        // Если селект только что открылся, помечаем его как недавно открытый
        // чтобы предотвратить немедленное закрытие другими обработчиками
        if (isNowOpen && !wasOpen) {
          const openTime = Date.now();
          recentlyOpenedSelects.set(select, openTime);
          // Очищаем флаг через 500мс (увеличено для надежности, особенно для первого открытия)
          if (recentlyOpenedTimeout) clearTimeout(recentlyOpenedTimeout);
          recentlyOpenedTimeout = setTimeout(() => {
            recentlyOpenedSelects.delete(select);
          }, 500);

          // Также устанавливаем глобальный флаг для защиты от других обработчиков
          if (typeof window.ignoreOutsideClickUntil !== 'undefined') {
            window.ignoreOutsideClickUntil = Math.max(window.ignoreOutsideClickUntil || 0, openTime + 500);
          }

          // Для селектов вендоров и интеграторов добавляем дополнительную защиту при первом открытии
          // так как они могут инициализироваться с задержкой
          if (isVendorSelect || isIntegratorSelect) {
            // Устанавливаем дополнительный флаг на самом селекте
            select.dataset.recentlyOpened = 'true';
            setTimeout(() => {
              delete select.dataset.recentlyOpened;
            }, 500);
          }
        }

        if (isNowOpen) {
          // Для селектов вендоров и интеграторов дополнительная проверка через requestAnimationFrame
          // чтобы гарантировать, что стили применены после всех обновлений DOM
          if ((isVendorSelect || isIntegratorSelect) && options) {
            // Дополнительная проверка через requestAnimationFrame для гарантии
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                // Убеждаемся, что стили применены после всех обновлений
                const computedStyle = window.getComputedStyle(options);
                if (computedStyle.display === 'none' || computedStyle.visibility === 'hidden' || computedStyle.opacity === '0') {
                  // Если стили не применились, принудительно применяем еще раз
                  options.style.setProperty('display', 'block', 'important');
                  options.style.setProperty('visibility', 'visible', 'important');
                  options.style.setProperty('opacity', '1', 'important');
                  options.style.setProperty('pointer-events', 'auto', 'important');
                  options.style.setProperty('z-index', '10008', 'important');

                  // Принудительно обновляем layout
                  void options.offsetHeight; // Force reflow
                }

                if (window.Logger) {
                  const optionsCount = options.querySelectorAll("li").length;
                  window.Logger.debug("Вендор селект открыт (финальная проверка):", {
                    isOpen: select.classList.contains('open'),
                    optionsCount: optionsCount,
                    hasOptions: !!options,
                    computedDisplay: computedStyle.display,
                    computedVisibility: computedStyle.visibility,
                    computedOpacity: computedStyle.opacity,
                    zIndex: computedStyle.zIndex
                  });
                }
              });
            });
          }

          if (typeof window.positionOptions === "function") {
          // Для селектов вендоров и интеграторов не используем стандартную функцию positionOptions,
          // так как мы используем absolute позиционирование
          if (!isVendorSelect && !isIntegratorSelect) {
              window.positionOptions(select);
            } else {
            // Для селектов вендоров позиционирование уже установлено в applyStyles
            // Просто убеждаемся, что стили применены после всех изменений DOM
            requestAnimationFrame(() => {
              if (options) {
                const computedStyle = window.getComputedStyle(options);
                if (computedStyle.display === 'none' || computedStyle.visibility === 'hidden' || computedStyle.opacity === '0') {
                  options.style.setProperty('display', 'block', 'important');
                  options.style.setProperty('visibility', 'visible', 'important');
                  options.style.setProperty('opacity', '1', 'important');
                }
              }
            });
            }
          }
          const searchInputInside = select.querySelector(
            ".select-search input"
          );
          if (searchInputInside) setTimeout(() => searchInputInside.focus(), 0);
        } else {
          // При закрытии убеждаемся, что стили сброшены
          if ((isVendorSelect || isIntegratorSelect) && options) {
            options.style.removeProperty('display');
            options.style.removeProperty('visibility');
            options.style.removeProperty('opacity');
            options.style.removeProperty('pointer-events');
            options.style.removeProperty('z-index');
          }
          // Удаляем флаг недавно открытого при закрытии
          if (select.dataset.recentlyOpened) {
            delete select.dataset.recentlyOpened;
          }
          // Останавливаем observer и удаляем обработчики при закрытии
          if (select._vendorStyleObserver) {
            select._vendorStyleObserver.disconnect();
            delete select._vendorStyleObserver;
          }
          if (select._vendorScrollHandler) {
            window.removeEventListener('scroll', select._vendorScrollHandler, true);
            if (select._vendorModalBody) {
              select._vendorModalBody.removeEventListener('scroll', select._vendorScrollHandler, true);
            }
            delete select._vendorScrollHandler;
          }
          if (select._vendorResizeHandler) {
            window.removeEventListener('resize', select._vendorResizeHandler);
            delete select._vendorResizeHandler;
          }
          delete select._vendorModalBody;
        }
      },
      true
    ); // Используем capture phase

    // Глобальный обработчик для закрытия модальных селектов при клике вне их
    // Запускается в bubble phase ПОСЛЕ обработчика открытия
    document.addEventListener("click", (e) => {
      // Если событие уже обработано обработчиком открытия - игнорируем
      if (e._selectHandled) {
        // Если это был клик на селект вендоров или интеграторов, который только что открылся - не закрываем
        if (e._selectElement && (e._selectElement.classList.contains("vendor-select") || e._selectElement.classList.contains("integrator-select"))) {
          return;
        }
      }

      // Проверяем глобальный флаг защиты от немедленного закрытия
      if (typeof window.ignoreOutsideClickUntil !== 'undefined' && Date.now() < window.ignoreOutsideClickUntil) {
        return;
      }

      // Игнорируем клики внутри модальных селектов (триггеры и опции)
      const clickedSelect = e.target.closest(".custom-select-modal");
      if (clickedSelect) {
        // Если клик был на триггер или внутри опций - не закрываем
        const clickedTrigger = e.target.closest(".custom-select-modal .select-trigger");
        const clickedOptions = e.target.closest(".custom-select-modal .select-options");
        if (clickedTrigger || clickedOptions) {
          return;
        }
        // Дополнительная проверка: если клик был на сам селект (не на опции или триггер),
        // но селект открыт - это может быть клик на триггер, который мы пропустили
        // В этом случае не закрываем селект
        if (clickedSelect.classList.contains("open")) {
          // Проверяем, не был ли это клик на триггер (даже если closest не сработал)
          const trigger = clickedSelect.querySelector(".select-trigger");
          if (trigger && (trigger.contains(e.target) || e.target === trigger)) {
            return;
          }
        }
      }

      // Игнорируем клики на кнопки добавления вендоров
      if (e.target.closest(".add-vendor-btn") || e.target.closest(".add-new-vendor-option")) {
        return;
      }

      // Закрываем все модальные селекты, кроме недавно открытых
      document.querySelectorAll(".custom-select-modal.open").forEach((select) => {
        // Проверяем, не был ли селект только что открыт
        if (recentlyOpenedSelects.has(select)) {
          const openTime = recentlyOpenedSelects.get(select);
          // Если селект был открыт менее 500мс назад - не закрываем
          if (Date.now() - openTime < 500) {
            return;
          }
        }

          // Дополнительная проверка для селектов вендоров и интеграторов
          if (select.dataset.recentlyOpened === 'true') {
            return;
          }

          // Для селектов вендоров и интеграторов дополнительно проверяем, что стили применены
          // Если стили еще не применены (селект только что открылся), не закрываем
          const isVendorSelect = select.classList.contains("vendor-select");
          const isIntegratorSelect = select.classList.contains("integrator-select");
          if (isVendorSelect || isIntegratorSelect) {
          const options = select.querySelector(".select-options");
          if (options) {
            const computedStyle = window.getComputedStyle(options);
            // Если селект только что открылся и стили еще не применены полностью - не закрываем
            if (computedStyle.display === 'none' || computedStyle.visibility === 'hidden' || computedStyle.opacity === '0') {
              // Стили еще не применены - это значит селект только что открылся, не закрываем
              return;
            }
          }
        }

        select.classList.remove("open");
        // Убираем класс с родительского filter-group при закрытии селекта
        const parentGroupForModal = select.closest("#filterPanel .filter-group");
        if (parentGroupForModal) {
          parentGroupForModal.classList.remove("has-open-dropdown");
        }
        // Сбрасываем inline стили при закрытии для селектов вендоров и интеграторов
        if (isVendorSelect || isIntegratorSelect) {
          // Если закрывается селект интеграторов - показываем кнопку добавления интегратора обратно
          if (isIntegratorSelect) {
            const vendorIntegratorsSection = select.closest('.vendor-integrators');
            if (vendorIntegratorsSection) {
              const addIntegratorBtn = vendorIntegratorsSection.querySelector('.add-integrator-btn');
              if (addIntegratorBtn) {
                addIntegratorBtn.style.display = '';
              }
            }
          }
          const options = select.querySelector(".select-options");
          if (options) {
            options.style.removeProperty('display');
            options.style.removeProperty('visibility');
            options.style.removeProperty('opacity');
            options.style.removeProperty('pointer-events');
            options.style.removeProperty('z-index');
          }
          // Останавливаем observer и удаляем обработчики при закрытии
          if (select._vendorStyleObserver) {
            select._vendorStyleObserver.disconnect();
            delete select._vendorStyleObserver;
          }
          if (select._integratorStyleObserver) {
            select._integratorStyleObserver.disconnect();
            delete select._integratorStyleObserver;
          }
          if (select._vendorScrollHandler) {
            window.removeEventListener('scroll', select._vendorScrollHandler, true);
            if (select._vendorModalBody) {
              select._vendorModalBody.removeEventListener('scroll', select._vendorScrollHandler, true);
            }
            delete select._vendorScrollHandler;
          }
          if (select._integratorScrollHandler) {
            window.removeEventListener('scroll', select._integratorScrollHandler, true);
            if (select._integratorModalBody) {
              select._integratorModalBody.removeEventListener('scroll', select._integratorScrollHandler, true);
            }
            delete select._integratorScrollHandler;
          }
          if (select._vendorResizeHandler) {
            window.removeEventListener('resize', select._vendorResizeHandler);
            delete select._vendorResizeHandler;
          }
          if (select._integratorResizeHandler) {
            window.removeEventListener('resize', select._integratorResizeHandler);
            delete select._integratorResizeHandler;
          }
          if (select._vendorModalBody) {
            delete select._vendorModalBody;
          }
          if (select._integratorModalBody) {
            delete select._integratorModalBody;
          }
        }
      });
    }, false); // Bubble phase (по умолчанию)

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

      // ВАЖНО: Пропускаем клики по кнопкам добавления вендоров и интеграторов
      // Эти клики должны обрабатываться обработчиками в vendors-files.js и filters.js
      if (e.target.closest(".add-new-vendor-btn") ||
          e.target.closest(".add-new-integrator-btn") ||
          e.target.closest(".add-new-vendor-option") ||
          e.target.closest(".add-new-option") ||
          e.target.closest(".add-new-btn") ||
          e.target.closest(".add-new-input") ||
          e.target.closest(".add-new-integrator-option") ||
          e.target.classList.contains("new-vendor-input") ||
          e.target.classList.contains("new-integrator-input")) {
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
      // Проверяем по ID поля или по наличию класса select-option-item
      const hasCheckboxes = [
        "techBlock",
        "techFunc",
        "editBlock",
        "editFunc",
      ].includes(hiddenInputId) ||
      (hiddenInputId && hiddenInputId.startsWith('integrator-')) ||
      select.querySelector('.select-options li.select-option-item') !== null;

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
            // Используем requestAnimationFrame для более быстрого обновления
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                delete cb.dataset.programmaticChange;
              });
            });
          }
        });

        const selectedValues = shouldSelectAll
          ? optionLis
              .map((optLi) => optLi.getAttribute("data-value"))
              .filter((v) => v && v.length > 0)
          : [];

        if (hiddenInput) {
          hiddenInput.value = JSON.stringify(selectedValues);
          hiddenInput.dispatchEvent(new Event("input", { bubbles: true }));
          hiddenInput.dispatchEvent(new Event("change", { bubbles: true }));
        }
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

        if (hiddenInput) {
          hiddenInput.value = JSON.stringify(selected);
          hiddenInput.dispatchEvent(new Event("input", { bubbles: true }));
          hiddenInput.dispatchEvent(new Event("change", { bubbles: true }));
        }
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

        // Обновление данных вендоров при изменении интеграторов
        if (hiddenInputId && hiddenInputId.startsWith('integrator-')) {
          const integratorItem = select.closest('.integrator-item');
          if (integratorItem) {
            const container = integratorItem.closest('.vendors-container');
            if (container) {
              const containerId = container.id;
              const isEdit = containerId.includes('edit');
              // Вызываем updateVendorsHiddenInput через модуль vendors-files
              if (window.VendorsFiles && typeof window.VendorsFiles.updateVendorsHiddenInput === 'function') {
                setTimeout(() => {
                  window.VendorsFiles.updateVendorsHiddenInput(containerId, isEdit);
                }, 0);
              }
            }
          }
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
          // Обновляем покрытие функций при изменении блоков
          if (window.AutoFuncCover && typeof window.AutoFuncCover.calculateAndUpdateFuncCover === "function") {
            setTimeout(() => {
              window.AutoFuncCover.calculateAndUpdateFuncCover("techFunc", "techBlock", "techFuncCover");
            }, 50);
          }
        } else if (
          hiddenInputId === "editBlock" &&
          typeof window.updateModalFunctionsForBlocks === "function"
        ) {
          window.updateModalFunctionsForBlocks(selected, "editFunc");
          // Обновляем покрытие функций при изменении блоков
          if (window.AutoFuncCover && typeof window.AutoFuncCover.calculateAndUpdateFuncCover === "function") {
            setTimeout(() => {
              window.AutoFuncCover.calculateAndUpdateFuncCover("editFunc", "editBlock", "editFuncCover");
            }, 50);
          }
        } else if (
          hiddenInputId === "techFunc" &&
          window.AutoFuncCover &&
          typeof window.AutoFuncCover.calculateAndUpdateFuncCover === "function"
        ) {
          // Обновляем покрытие функций при изменении функций в форме добавления
          setTimeout(() => {
            window.AutoFuncCover.calculateAndUpdateFuncCover("techFunc", "techBlock", "techFuncCover");
          }, 50);
        } else if (
          hiddenInputId === "editFunc" &&
          window.AutoFuncCover &&
          typeof window.AutoFuncCover.calculateAndUpdateFuncCover === "function"
        ) {
          // Обновляем покрытие функций при изменении функций в форме редактирования
          setTimeout(() => {
            window.AutoFuncCover.calculateAndUpdateFuncCover("editFunc", "editBlock", "editFuncCover");
          }, 50);
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
        // Убираем класс с родительского filter-group при закрытии селекта
        const parentGroupForClear = select.closest("#filterPanel .filter-group");
        if (parentGroupForClear) {
          parentGroupForClear.classList.remove("has-open-dropdown");
        }
        return;
      }

      // Устанавливаем выбранное значение
      if (hiddenInput) {
        hiddenInput.value = value;
        // Триггерим событие change для скрытого поля, чтобы формы могли его обработать
        // Используем setTimeout для гарантии, что событие обработается после закрытия селекта
        setTimeout(() => {
          hiddenInput.dispatchEvent(new Event("change", { bubbles: true }));
        }, 0);
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
      // Убираем класс с родительского filter-group при закрытии селекта
      const parentGroupForClose = select.closest("#filterPanel .filter-group");
      if (parentGroupForClose) {
        parentGroupForClose.classList.remove("has-open-dropdown");
      }

      // Для селектов вендоров и интеграторов сбрасываем inline стили при закрытии и показываем секцию интеграторов
      const isVendorSelect = select.classList.contains("vendor-select");
      const isIntegratorSelect = select.classList.contains("integrator-select");
      if (isVendorSelect || isIntegratorSelect) {
        // Если закрывается селект интеграторов - показываем кнопку добавления интегратора обратно
        if (isIntegratorSelect) {
          const vendorIntegratorsSection = select.closest('.vendor-integrators');
          if (vendorIntegratorsSection) {
            const addIntegratorBtn = vendorIntegratorsSection.querySelector('.add-integrator-btn');
            if (addIntegratorBtn) {
              addIntegratorBtn.style.display = '';
            }
          }
        }
        const options = select.querySelector(".select-options");
        if (options) {
          options.style.removeProperty('display');
          options.style.removeProperty('visibility');
          options.style.removeProperty('opacity');
          options.style.removeProperty('pointer-events');
        }
        // Показываем секцию интеграторов при выборе вендора
        if (value && hiddenInput) {
          // Находим элемент вендора, к которому относится этот селект
          const vendorItem = select.closest('.vendor-item');
          if (vendorItem) {
            const vendorIntegratorsSection = vendorItem.querySelector('.vendor-integrators');
            if (vendorIntegratorsSection) {
              vendorIntegratorsSection.style.display = '';
              vendorIntegratorsSection.setAttribute('aria-hidden', 'false');
            }
          }
        }
      }

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

      // Не закрываем селекты здесь - это делается глобальным обработчиком выше
      // Оставляем эту проверку только для обратной совместимости, но с проверкой на недавно открытые
      if (!e.target.closest(".custom-select-modal")) {
        document.querySelectorAll(".custom-select-modal").forEach((s) => {
          if (!recentlyOpenedSelects.has(s)) {
            s.classList.remove("open");
          }
        });
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

          if (hiddenInput) {
            hiddenInput.value = JSON.stringify(selectedValues);
            hiddenInput.dispatchEvent(new Event("input", { bubbles: true }));
            hiddenInput.dispatchEvent(new Event("change", { bubbles: true }));
          }
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
            // TODO: убрать после перевода всех потребителей на state. Синхронизация для обратной совместимости.
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

        if (hiddenInput) {
          hiddenInput.value = JSON.stringify(selected);
          hiddenInput.dispatchEvent(new Event("input", { bubbles: true }));
          hiddenInput.dispatchEvent(new Event("change", { bubbles: true }));
        }
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

  // Экспорт для использования в events.js и обратной совместимости
  if (typeof window !== "undefined") {
    window.initSelectEvents = initSelectEvents;
    window.SelectPositioning = { positionOptions };
    window.positionOptions = positionOptions;
  }

  export { initSelectEvents, positionOptions };
