// events.js
// Модуль централизованной обработки всех событий интерфейса
// Использует EventManager для делегирования событий
import { EventManager } from '../core/core-utils.js';
import { DOMCache } from '../core/dom-utils.js';

"use strict";

  const UI_DEBUG = typeof window !== "undefined"
    && new URLSearchParams(window.location.search).get("debugUi") === "true";

  // Ленивая загрузка зависимостей для совместимости (другие модули из window)
  function getDependency(name) {
    if (name === "DOMCache") return DOMCache;
    if (name === "EventManager") return EventManager;
    if (typeof window === "undefined" || !window[name]) {
      throw new Error(
        `Зависимость ${name} не загружена. Подключите необходимые модули перед вызовом initEventHandlers.`
      );
    }
    return window[name];
  }

  // Функция для инициализации поиска (может быть вызвана повторно)
  function initSearchHandler() {
    let searchInput = DOMCache.get("searchInput");
    if (!searchInput) {
      searchInput = document.getElementById("searchInput");
    }

    if (searchInput && !searchInput.dataset.searchHandlerAttached) {
      if (typeof window.debounce === "function") {
        const debouncedSearch = window.debounce(() => {
          if (typeof window.updateRadar === "function") {
            window.updateRadar();
          }
        }, 300);

        const handleSearch = () => {
          debouncedSearch();
        };

        searchInput.addEventListener("input", handleSearch);
        searchInput.addEventListener("keyup", handleSearch);
        searchInput.dataset.searchHandlerAttached = "true";

        if (UI_DEBUG && window.Logger) window.Logger.debug("Обработчик поиска успешно привязан к searchInput");
        return true;
      }
    }
    return false;
  }

  // Инициализация обработчиков событий
  function initEventHandlers() {
    // Guard: предотвращаем повторную инициализацию
    if (window.__eventsInitialized) {
      if (UI_DEBUG && window.Logger) window.Logger.debug('initEventHandlers уже выполнен, пропускаем повторную инициализацию');
      return;
    }
    window.__eventsInitialized = true;

    // Проверяем, что все зависимости доступны
    const EventManager = getDependency("EventManager");

    // Ленивая загрузка функций из window (будут доступны после загрузки RMK2.js)
    function getWindowFunction(name) {
      return function (...args) {
        const fn = window[name];
        if (typeof fn !== "function") {
          if (window.Logger) window.Logger.warn(`Функция ${name} не найдена в window`);
          return;
        }
        return fn(...args);
      };
    }

    // ===== ТЕМА =====
    const themeToggle = document.getElementById("themeToggle");
    if (themeToggle) {
      const savedTheme = localStorage.getItem("theme") || "light";
      const isDark = savedTheme === "dark";
      // Убеждаемся, что есть правильный класс для темы
      document.body.classList.remove("light", "dark");
      document.body.classList.add(isDark ? "dark" : "light");
      if (isDark) {
        themeToggle.checked = true;
      }

      themeToggle.addEventListener("change", (e) => {
        e.stopPropagation(); // Останавливаем всплытие события
        const isDarkNow = themeToggle.checked;
        // Убираем оба класса и добавляем нужный
        document.body.classList.remove("light", "dark");
        document.body.classList.add(isDarkNow ? "dark" : "light");
        const newTheme = isDarkNow ? "dark" : "light";
        localStorage.setItem("theme", newTheme);
      });
      // Также обрабатываем клик на label или обертку переключателя темы
      themeToggle.addEventListener("click", (e) => {
        e.stopPropagation(); // Останавливаем всплытие события
      });
    }

    // ===== ПОИСК =====
    // Инициализация поиска вынесена в отдельную функцию initSearchHandler
    // для возможности повторной инициализации, если элемент не найден сразу
    initSearchHandler();

    // ===== ФИЛЬТРЫ =====
    const filterBtn = DOMCache.get("filterBtn");
    const filterPanel = DOMCache.get("filterPanel");
    if (filterBtn && filterPanel) {
      filterBtn.onclick = (e) => {
        e.stopPropagation();
        document
          .querySelectorAll(".custom-select")
          .forEach((s) => s.classList.remove("open"));
        const opening = !filterPanel.classList.contains("open");
        if (opening) {
          filterPanel.classList.remove("closing");
          filterPanel.classList.add("open");
        } else {
          filterPanel.classList.remove("open");
          filterPanel.classList.add("closing");
          setTimeout(() => filterPanel.classList.remove("closing"), 450);
        }
      };
    }

    // ===== КАСТОМНЫЕ СЕЛЕКТЫ (SIDEBAR И МОДАЛЬНЫЕ) =====
    // Обработчики селектов вынесены в ui/select-events.js
    if (typeof window.initSelectEvents === "function") {
      window.initSelectEvents();
    }

    // ===== ПАНЕЛЬ СПИСКА ТЕХНОЛОГИЙ =====
    const closeQuadrantPriorityPanelBtn = document.getElementById(
      "closeQuadrantPriorityPanel"
    );
    if (closeQuadrantPriorityPanelBtn) {
      closeQuadrantPriorityPanelBtn.addEventListener("click", (e) => {
        e.preventDefault();
        if (typeof window.unzoom === "function") {
          window.unzoom();
        }
      });
    }

    // Обработчик кликов по quadrantPriorityPanel (фильтр по статусу в модальном окне убран — список зависит только от фильтров боковой панели)

    const qpSearchInput = DOMCache.get("qpSearchInput");
    if (qpSearchInput) {
      if (typeof window.debounce === "function") {
        const debouncedQpSearch = window.debounce(() => {
          if (typeof window.getCurrentZoomedQuadrant === "function") {
            const currentZoomed = window.getCurrentZoomedQuadrant();
            if (
              currentZoomed != null &&
              typeof window.recomputeQuadrantPriorityList === "function"
            ) {
              window.recomputeQuadrantPriorityList(currentZoomed);
            }
          }
        }, 300);
        qpSearchInput.addEventListener("input", debouncedQpSearch);
      }
    }

    // ===== СБРОС ФИЛЬТРОВ =====
    const resetFiltersAndSelection = () => {
      document
        .querySelectorAll(".sector-item")
        .forEach((i) => i.classList.remove("active"));
      document.querySelectorAll(".tech-list").forEach((tl) => tl.remove());
      document.querySelectorAll(".custom-select").forEach((select) => {
        const filterKey = select.getAttribute("data-filter");
        const hiddenInput = filterKey
          ? document.getElementById(`filter_${filterKey}`)
          : null;
        select.setAttribute("data-value", "");
        if (hiddenInput) hiddenInput.value = "";
        const placeholder =
          select.getAttribute("data-placeholder") || "Выберите";
        const selectedText = select.querySelector(".selected-text");
        if (selectedText) {
          selectedText.textContent = placeholder;
          selectedText.innerHTML = placeholder;
        }
        select
          .querySelectorAll(".select-options li")
          .forEach((li) => {
            li.classList.remove("selected");
            const checkbox = li.querySelector('input[type="checkbox"]');
            if (checkbox) checkbox.checked = false;
          });
      });
      document
        .querySelectorAll(".custom-select .select-search input")
        .forEach((inp) => {
          inp.value = "";
          inp.dispatchEvent(new Event("input"));
        });
      const searchInput = DOMCache.get("searchInput");
      if (searchInput) searchInput.value = "";
      try {
        localStorage.removeItem("selectedEnterprise");
      } catch (_) {}
      if (typeof window.setSelectedBlipId === "function") {
        window.setSelectedBlipId(null);
      }
      const svg = DOMCache.get("techRadar");
      if (svg) {
        svg
          .querySelectorAll(".blip.highlighted")
          .forEach((el) => el.classList.remove("highlighted"));
        svg
          .querySelectorAll(".blip.selected")
          .forEach((el) => el.classList.remove("selected"));
      }
      if (typeof window.setCurrentTech === "function") {
        window.setCurrentTech(null);
      }
      const detailPanel = DOMCache.get("detailPanel");
      if (detailPanel && detailPanel.classList.contains("active")) {
        // Деактивируем focus trap перед закрытием
        if (window.FocusTrap && typeof window.FocusTrap.release === 'function') {
          window.FocusTrap.release();
        }
        detailPanel.classList.remove("active");
        detailPanel.style.display = "none";
      }
      if (typeof window.unzoom === "function") {
        window.unzoom();
      }
      // Перестроить списки блоков и функций уже после снятия зума,
      // чтобы блоки не фильтровались по старому квадранту.
      if (typeof window.Filters?.updateFiltersForEnterprises === "function") {
        window.Filters.updateFiltersForEnterprises();
      }
      if (typeof window.updateRadar === "function") {
        window.updateRadar();
      }
      if (typeof window.showNotification === "function") {
        window.showNotification("Выбор сброшен!", true);
      }
    };

    const resetSectorBtn = document.getElementById("resetSectorBtn");
    if (resetSectorBtn) {
      resetSectorBtn.addEventListener("click", resetFiltersAndSelection);
    }

    const resetIconBtn = document.getElementById("resetIconBtn");
    if (resetIconBtn) {
      resetIconBtn.addEventListener("click", (e) => {
        const resetSectorBtn = document.getElementById("resetSectorBtn");
        if (resetSectorBtn) {
          resetSectorBtn.click();
        } else {
          resetFiltersAndSelection();
        }

        // Анимация иконки
        const prefersReduced =
          window.matchMedia &&
          window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (!prefersReduced) {
          const svg = resetIconBtn.querySelector(".icon-broom-leaf");
          if (svg) {
            svg.classList.remove("animate");
            void svg.offsetWidth;
            svg.classList.add("animate");
            setTimeout(() => svg.classList.remove("animate"), 1500);
          }
        }
      });
    }

    // ===== АНИМАЦИИ КНОПОК =====
    const prefersReduced =
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Broom animation (reset button)
    if (resetSectorBtn) {
      resetSectorBtn.addEventListener("click", () => {
        if (prefersReduced) return;
        const svg = resetSectorBtn.querySelector(".icon-broom-leaf");
        if (!svg) return;
        svg.classList.remove("animate");
        void svg.offsetWidth;
        svg.classList.add("animate");
        setTimeout(() => svg.classList.remove("animate"), 1500);
      });
    }

    // Export PDF animation
    const exportBtn = document.getElementById("exportPdfBtn");
    if (exportBtn) {
      exportBtn.addEventListener("click", (ev) => {
        if (prefersReduced) return;
        const svg = exportBtn.querySelector(".icon-pdf");
        if (!svg) return;
        svg.classList.remove("animate");
        void svg.offsetWidth;
        svg.classList.add("animate");
        setTimeout(() => svg.classList.remove("animate"), 950);
      });
    }

    // Add tech button pulse
    const addBtn = document.getElementById("addTechBtn");
    if (addBtn) {
      addBtn.addEventListener("click", (ev) => {
        if (prefersReduced) return;
        const svgWrap = addBtn.querySelector(".icon-add");
        if (!svgWrap) return;
        svgWrap.classList.remove("animate");
        void svgWrap.offsetWidth;
        svgWrap.classList.add("animate");
        setTimeout(() => svgWrap.classList.remove("animate"), 650);
      });
    }

    // Filter button: toggle animation
    if (filterBtn && filterPanel) {
      let wasOpen = filterPanel.classList.contains("open");
      const updateIconState = () => {
        const icon =
          filterBtn.querySelector("svg") ||
          filterBtn.querySelector(".icon-filter");
        if (!icon) return;
        if (prefersReduced) return;
        const isOpen = filterPanel.classList.contains("open");
        if (isOpen !== wasOpen) {
          icon.classList.remove("toggle", "filter-reset");
          void icon.offsetWidth;
          if (isOpen) {
            icon.classList.add("toggle");
          } else {
            icon.classList.add("filter-reset");
          }
          wasOpen = isOpen;
        }
      };
      const observer = new MutationObserver(updateIconState);
      observer.observe(filterPanel, {
        attributes: true,
        attributeFilter: ["class"],
      });
      updateIconState();
    }

    // Filter icon button animation (filterIconBtn)
    const filterIconBtn = document.getElementById("filterIconBtn");
    if (filterIconBtn && filterPanel) {
      let filterIconWasOpen = filterPanel.classList.contains("open");
      const updateFilterIconState = () => {
        const icon = filterIconBtn.querySelector(".icon-filter");
        if (!icon) return;
        if (prefersReduced) return;
        const isOpen = filterPanel.classList.contains("open");
        if (isOpen !== filterIconWasOpen) {
          icon.classList.remove("toggle", "filter-reset");
          void icon.offsetWidth;
          if (isOpen) {
            icon.classList.add("toggle");
          } else {
            icon.classList.add("filter-reset");
          }
          filterIconWasOpen = isOpen;
        }
      };
      const filterObserver = new MutationObserver(updateFilterIconState);
      filterObserver.observe(filterPanel, {
        attributes: true,
        attributeFilter: ["class"],
      });
      updateFilterIconState();
    }

    // Add icon button animation (addIconBtn)
    const addIconBtn = document.getElementById("addIconBtn");
    if (addIconBtn) {
      addIconBtn.addEventListener("click", (ev) => {
        if (prefersReduced) return;
        const svgWrap = addIconBtn.querySelector(".icon-add");
        if (!svgWrap) return;
        svgWrap.classList.remove("animate");
        void svgWrap.offsetWidth;
        svgWrap.classList.add("animate");
        setTimeout(() => svgWrap.classList.remove("animate"), 650);
      });
    }

    // Report/Export PDF icon button animation (reportIconBtn)
    const reportIconBtn = document.getElementById("reportIconBtn");
    if (reportIconBtn) {
      reportIconBtn.addEventListener("click", (ev) => {
        if (prefersReduced) return;
        const svg = reportIconBtn.querySelector(".icon-pdf");
        if (!svg) return;
        svg.classList.remove("animate");
        void svg.offsetWidth;
        svg.classList.add("animate");
        setTimeout(() => svg.classList.remove("animate"), 950);
      });
    }

    // ===== ОБРАБОТЧИКИ РАДАРА =====
    // Обработчики радара (blip hover, клики по радару, секторы) вынесены в radar/radar-events.js
    if (typeof window.initRadarEvents === "function") {
      window.initRadarEvents();
    }
    // attachBlipHoverHandlers экспортируется из radar-events.js для использования в RMK2.js


    // ===== ОБЩИЙ СБРОС ПО КЛИКУ ВНЕ =====
    document.addEventListener("click", (e) => {
      // Игнорируем клики по переключателю темы и его элементам
      if (e.target.closest("#themeToggle") || e.target.id === "themeToggle" ||
        e.target.closest("label[for='themeToggle']") ||
        e.target.closest(".theme-switch") ||
        e.target.closest(".theme-toggle-wrapper")) {
        return;
      }
      const clickedOnSidebarInteractive =
        e.target.closest(".sidebar-wrapper") ||
        e.target.closest(".sector-item") ||
        e.target.closest(".tech-list-item") ||
        e.target.closest(".search-box") ||
        e.target.closest(".filter-toggle-btn") ||
        e.target.closest(".custom-select") ||
        e.target.closest(".filter-panel-sidebar");

      if (
        clickedOnSidebarInteractive ||
        e.target.closest(".modal-panel") ||
        e.target.closest(".popover-menu") ||
        e.target.closest("header") ||
        e.target.closest(".controls") ||
        e.target.closest("#techRadar") ||
        e.target.closest(".detail-panel") ||
        e.target.closest("#quadrantPriorityPanel") ||
        e.target.closest("#notificationDetailsModal") ||
        e.target.closest(".notification-details-modal") ||
        e.target.closest("#notificationsPanel") ||
        e.target.closest(".notifications-panel")
      ) {
        return;
      }

      document
        .querySelectorAll(".sector-item")
        .forEach((i) => i.classList.remove("active"));
      document
        .querySelectorAll(".tech-list")
        .forEach((tl) => tl.parentNode?.removeChild(tl));
      document
        .querySelectorAll(".custom-select")
        .forEach((s) => s.classList.remove("open"));
      document
        .querySelectorAll(".tech-list-item.selected")
        .forEach((li) => li.classList.remove("selected"));
      if (typeof window.setSelectedBlipId === "function") {
        window.setSelectedBlipId(null);
      }
      const svg = DOMCache.get("techRadar");
      if (svg) {
        svg
          .querySelectorAll(".blip.highlighted")
          .forEach((el) => el.classList.remove("highlighted"));
        svg
          .querySelectorAll(".blip.selected")
          .forEach((el) => el.classList.remove("selected"));
      }
      if (typeof window.setCurrentTech === "function") {
        window.setCurrentTech(null);
      }
      const detailPanel = DOMCache.get("detailPanel");
      if (detailPanel && detailPanel.classList.contains("active")) {
        // Деактивируем focus trap перед закрытием
        if (window.FocusTrap && typeof window.FocusTrap.release === 'function') {
          window.FocusTrap.release();
        }
        detailPanel.classList.remove("active");
        detailPanel.style.display = "none";
      }
      if (typeof window.unzoom === "function") {
        window.unzoom();
      }

      // Сбрасываем активные фильтры и поиск
      document.querySelectorAll(".custom-select").forEach((select) => {
        select.setAttribute("data-value", "");
        const placeholder =
          select.getAttribute("data-placeholder") || "Выберите";
        const st = select.querySelector(".selected-text");
        if (st) st.textContent = placeholder;
      });
      document
        .querySelectorAll(".custom-select .select-search input")
        .forEach((inp) => {
          inp.value = "";
          inp.dispatchEvent(new Event("input"));
        });
      const searchInput = DOMCache.get("searchInput");
      if (searchInput) searchInput.value = "";
      if (typeof window.updateRadar === "function") {
        window.updateRadar();
      }
    });

    // ===== ДЕТАЛЬНАЯ ПАНЕЛЬ =====
    const closeDetailEl = document.getElementById("closeDetailPanel");
    if (closeDetailEl) {
      // Используем делегирование событий для надежности, если элемент пересоздается
      const handleCloseDetail = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const detailPanel = DOMCache.get("detailPanel") || document.getElementById("detailPanel");
        if (detailPanel) {
          // Деактивируем focus trap ПЕРЕД закрытием панели
          if (window.FocusTrap && typeof window.FocusTrap.release === 'function') {
            try {
              window.FocusTrap.release();
            } catch (err) {
              if (window.Logger) window.Logger.warn('Ошибка при освобождении focus trap', err);
            }
          }
          // Очищаем все inline стили, которые были установлены
          detailPanel.style.removeProperty("visibility");
          detailPanel.style.removeProperty("opacity");
          detailPanel.style.removeProperty("transform");
          detailPanel.style.removeProperty("position");
          detailPanel.style.removeProperty("z-index");
          detailPanel.style.removeProperty("display");
          detailPanel.style.removeProperty("right");
          detailPanel.style.removeProperty("left");
          // Удаляем класс active
          detailPanel.classList.remove("active");
          // Сбрасываем выбранную технологию
          if (typeof window.setSelectedBlipId === "function") {
            window.setSelectedBlipId(null);
          }
          if (typeof window.setCurrentTech === "function") {
            window.setCurrentTech(null);
          }
          // Снимаем выделение с blip'ов
          const svg = DOMCache.get("techRadar") || document.getElementById("techRadar");
          if (svg) {
            svg
              .querySelectorAll(".blip.selected")
              .forEach((el) => el.classList.remove("selected"));
          }
        }
      };

      // Добавляем обработчик напрямую
      closeDetailEl.addEventListener("click", handleCloseDetail);

      // Также добавляем обработчик через делегирование на document для надежности
      // (на случай, если элемент пересоздается при переключении предприятий)
      document.addEventListener("click", (e) => {
        if (e.target && (e.target.id === "closeDetailPanel" || e.target.closest("#closeDetailPanel"))) {
          handleCloseDetail(e);
        }
      });
    }

    // Кнопка «Назад» в панели подробной информации
    const detailPanel = DOMCache.get("detailPanel");
    if (detailPanel) {
      const detailHeader = detailPanel.querySelector(".detail-header");
      if (detailHeader) {
        let backBtn = detailPanel.querySelector("#detailBackFromPriorityBtn");
        if (!backBtn) {
          backBtn = document.createElement("button");
          backBtn.type = "button";
          backBtn.id = "detailBackFromPriorityBtn";
          backBtn.className = "detail-back-btn";
          backBtn.setAttribute("aria-label", "Назад к списку технологий");
          backBtn.setAttribute("data-tooltip", "Назад к списку технологий");
          backBtn.title = "Назад к списку технологий";
          const backBtnSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
          backBtnSvg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
          backBtnSvg.setAttribute("width", "18");
          backBtnSvg.setAttribute("height", "18");
          backBtnSvg.setAttribute("viewBox", "0 0 24 24");
          backBtnSvg.setAttribute("aria-hidden", "true");
          backBtnSvg.setAttribute("focusable", "false");
          const backBtnPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
          backBtnPath.setAttribute("d", "M15.5 19.5L8 12l7.5-7.5");
          backBtnPath.setAttribute("fill", "none");
          backBtnPath.setAttribute("stroke", "currentColor");
          backBtnPath.setAttribute("stroke-width", "2");
          backBtnPath.setAttribute("stroke-linecap", "round");
          backBtnPath.setAttribute("stroke-linejoin", "round");
          backBtnSvg.appendChild(backBtnPath);
          backBtn.appendChild(backBtnSvg);
          backBtn.style.display = "none";
          detailHeader.insertBefore(backBtn, detailHeader.firstChild);
        }

        backBtn.addEventListener("click", (ev) => {
          ev.stopPropagation();

          // Очищаем все inline стили
          detailPanel.style.removeProperty("visibility");
          detailPanel.style.removeProperty("opacity");
          detailPanel.style.removeProperty("transform");
          detailPanel.style.removeProperty("position");
          detailPanel.style.removeProperty("z-index");
          detailPanel.style.removeProperty("display");
          // Деактивируем focus trap перед закрытием
          if (window.FocusTrap && typeof window.FocusTrap.release === 'function') {
            window.FocusTrap.release();
          }
          // Удаляем класс active
          detailPanel.classList.remove("active");

          // Сбрасываем выбранную технологию
          if (typeof window.setSelectedBlipId === "function") {
            window.setSelectedBlipId(null);
          }
          // НЕ сбрасываем currentTech, так как мы возвращаемся к списку технологий

          // Открываем модальное окно со списком технологий
          if (
            typeof window.getCurrentZoomedQuadrant === "function" &&
            typeof window.zoomQuadrant === "function" &&
            typeof window.openQuadrantPriorityPanel === "function" &&
            typeof window.recomputeQuadrantPriorityList === "function"
          ) {
            const currentZoomed = window.getCurrentZoomedQuadrant();
            if (currentZoomed != null) {
              const g = document.querySelector(
                `.quadrant-group.q${currentZoomed}`
              );
              if (g && !g.classList.contains("zoomed-in")) {
                window.zoomQuadrant(currentZoomed, { source: "priority" });
              }
              // Открываем модальное окно со списком технологий
              window.openQuadrantPriorityPanel(currentZoomed);
              window.recomputeQuadrantPriorityList(currentZoomed);
            } else {
              if (window.Logger) window.Logger.warn(
                'Кнопка "Назад": текущий зуммированный квадрант не найден'
              );
            }
          } else {
            if (window.Logger) window.Logger.warn(
              'Кнопка "Назад": функции для работы с модальным окном списка технологий недоступны'
            );
          }
        });
      }
    }

    // ===== СЕКТОРЫ =====
    // Обработчики секторов вынесены в radar/radar-events.js

    // ===== МОДАЛЬНЫЕ ОКНА =====
    const addBtnEl = document.getElementById("addTechBtn");
    if (addBtnEl) {
      addBtnEl.addEventListener("click", (e) => {
        e.stopPropagation();
        if (
          window.ModerationFlow &&
          typeof window.ModerationFlow.canSubmitTechnologyChanges === 'function' &&
          !window.ModerationFlow.canSubmitTechnologyChanges()
        )
          return;
        const pop = document.getElementById("addChoicePopover");
        if (!pop) return;
        if (pop.style.display === "block" || pop.classList.contains("open")) {
          pop.classList.remove("open");
          pop.style.display = "none";
          return;
        }
        const rect = addBtnEl.getBoundingClientRect();
        pop.style.display = "block";
        pop.style.position = "fixed";
        pop.style.top = `${rect.bottom + 8}px`;
        pop.style.left = `${Math.max(8, rect.left)}px`;
        requestAnimationFrame(() => {
          pop.classList.add("open");
          const pw = pop.offsetWidth;
          const ph = pop.offsetHeight;
          let top = rect.bottom + 8;
          let left = rect.left;
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
              left = rect.left;
              if (left + pw + 8 > window.innerWidth)
                left = window.innerWidth - pw - 8;
              if (left < 8) left = 8;
            }
          } else {
            if (left + pw + 8 > window.innerWidth)
              left = window.innerWidth - pw - 8;
            if (left < 8) left = 8;
          }
          pop.style.top = `${Math.round(top)}px`;
          pop.style.left = `${Math.round(left)}px`;
        });
      });
    }

    document.querySelectorAll(".close-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const panelId = e.currentTarget.dataset.close;
        const panel = panelId
          ? document.getElementById(panelId)
          : e.currentTarget.closest(".modal-panel");
        if (!panel) return;
        if (panel.id === "deleteConfirmModal") {
          if (typeof window.hideModal === "function") {
            window.hideModal(panel);
          }
          return;
        }
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
                  panel.id === "addTechPanel" &&
                  typeof window.resetCustomSelects === "function"
                ) {
                  // В addTechPanel поля имеют префикс tech* (techSector, techBlock, techFunc, ...)
                  window.resetCustomSelects("tech");
                }
                if (
                  panel.id === "editTechPanel" &&
                  typeof window.resetCustomSelects === "function"
                ) {
                  window.resetCustomSelects("edit");
                }
                if (panel.id === "addTechPanel") {
                  const companyRatingsContainer = document.getElementById("techCompanyRatingsContainer");
                  if (companyRatingsContainer) companyRatingsContainer.innerHTML = "";
                  if (typeof window.updateTechRatingsVisibility === "function") {
                    // Приводим видимость полей оценок в дефолтное состояние
                    window.updateTechRatingsVisibility();
                  }
                }
              },
              panel
            );
          } else {
            window.hideModal(panel);
          }
        }
      });
    });

    const chooseAddTechBtn = document.getElementById("chooseAddTech");
    if (chooseAddTechBtn) {
      chooseAddTechBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const pop = document.getElementById("addChoicePopover");
        if (pop) pop.style.display = "none";
        if (typeof window.showModal === "function") {
          window.showModal("addTechPanel");

          // Логируем открытие модального окна добавления технологии
          if (typeof window.appendAdminAudit === 'function') {
            window.appendAdminAudit('create', 'Открыто модальное окно добавления технологии');
          }
        }
        // Инициализация фильтрации при открытии модального окна
        if (typeof window.initModalFilters === "function") {
          setTimeout(() => {
            window.initModalFilters();
          }, 100);
        }
        if (typeof window.updateTechRatingsVisibility === "function") {
          setTimeout(() => {
            window.updateTechRatingsVisibility();
          }, 100);
        }
        if (typeof window.snapshotFormInitial === "function") {
          const form = document.getElementById("addTechForm");
          if (form) window.snapshotFormInitial(form);
        }
      });
    }

    // Обработчик изменения выбора предприятий в форме добавления технологии
    const techCompanyInput = document.getElementById("techCompany");
    if (techCompanyInput) {
      const companyObserver = new MutationObserver(() => {
        if (typeof window.updateTechRatingsVisibility === "function") {
          window.updateTechRatingsVisibility();
        }
      });
      companyObserver.observe(techCompanyInput, {
        attributes: true,
        attributeFilter: ["value"],
      });

      const techCompanySelect = document.querySelector(
        '.custom-select-modal[data-field="techCompany"]'
      );
      if (techCompanySelect) {
        if (typeof window.updateTechRatingsVisibility === "function") {
          techCompanyInput.addEventListener(
            "change",
            window.updateTechRatingsVisibility
          );
          techCompanyInput.addEventListener(
            "input",
            window.updateTechRatingsVisibility
          );

          const companyOptions =
            techCompanySelect.querySelector(".select-options");
          if (companyOptions) {
            companyOptions.addEventListener("click", (e) => {
              setTimeout(() => {
                if (typeof window.updateTechRatingsVisibility === "function") {
                  window.updateTechRatingsVisibility();
                }
              }, 50);
            });
          }
        }
      }
    }

    const chooseAddBlockBtn = document.getElementById("chooseAddBlock");
    if (chooseAddBlockBtn) {
      chooseAddBlockBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (
          !window.ModerationFlow ||
          (
            (typeof window.ModerationFlow.canManageTechnologies !== "function" ||
              !window.ModerationFlow.canManageTechnologies()) &&
            (typeof window.ModerationFlow.isProposalOnlyMode !== "function" ||
              !window.ModerationFlow.isProposalOnlyMode())
          )
        ) {
          return;
        }
        const pop = document.getElementById("addChoicePopover");
        if (pop) pop.style.display = "none";
        if (typeof window.showModal === "function") {
          window.showModal("addBlockPanel");
        }
        if (typeof window.snapshotFormInitial === "function") {
          const form = document.getElementById("addBlockForm");
          if (form) window.snapshotFormInitial(form);
        }
      });
    }

    // Закрытие popover
    document.addEventListener("click", (e) => {
      const pop = document.getElementById("addChoicePopover");
      if (!pop) return;
      const isInside =
        e.target.closest &&
        (e.target.closest("#addChoicePopover") ||
          e.target.closest("#addTechBtn") ||
          e.target.closest("#addIconBtn"));
      if (
        !isInside &&
        (pop.style.display === "block" || pop.classList.contains("open"))
      ) {
        pop.classList.remove("open");
        pop.style.display = "none";
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        const pop = document.getElementById("addChoicePopover");
        if (
          pop &&
          (pop.style.display === "block" || pop.classList.contains("open"))
        ) {
          pop.classList.remove("open");
          pop.style.display = "none";
        }
        const deleteConfirmModal =
          document.getElementById("deleteConfirmModal");
        if (
          deleteConfirmModal &&
          deleteConfirmModal.classList.contains("open")
        ) {
          if (typeof window.hideModal === "function") {
            window.hideModal("deleteConfirmModal");
          }
        }
      }
    });

    // Встроенное модальное подтверждение
    function showInternalConfirm(message, onCloseConfirmed) {
      let confirmEl = document.getElementById("internalConfirm");
      if (!confirmEl) {
        confirmEl = document.createElement("div");
        confirmEl.id = "internalConfirm";
        confirmEl.className = "modal-panel confirm-panel";
        // Создаем структуру модального окна через createElement (безопаснее чем innerHTML)
        const modalHeader = document.createElement('div');
        modalHeader.className = 'modal-header';
        const modalTitle = document.createElement('h2');
        modalTitle.textContent = 'Подтвердите действие';
        modalHeader.appendChild(modalTitle);

        const modalBody = document.createElement('div');
        modalBody.className = 'modal-body';
        const confirmMessage = document.createElement('p');
        confirmMessage.className = 'confirm-message';
        modalBody.appendChild(confirmMessage);

        const formActions = document.createElement('div');
        formActions.style.marginTop = '12px';
        formActions.style.display = 'flex';
        formActions.style.gap = '8px';
        formActions.style.justifyContent = 'flex-end';

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'btn-secondary';
        cancelBtn.setAttribute('data-action', 'cancel');
        cancelBtn.textContent = 'Отмена';

        const closeBtn = document.createElement('button');
        closeBtn.className = 'btn-primary';
        closeBtn.setAttribute('data-action', 'close');
        closeBtn.textContent = 'Закрыть';

        formActions.appendChild(cancelBtn);
        formActions.appendChild(closeBtn);
        modalBody.appendChild(formActions);

        confirmEl.appendChild(modalHeader);
        confirmEl.appendChild(modalBody);
        // Сохраняем ссылку на элемент сообщения для последующего использования
        confirmEl._confirmMessageEl = confirmMessage;
        document.body.appendChild(confirmEl);
        cancelBtn.addEventListener("click", () => {
          confirmEl.classList.remove("open");
          setTimeout(() => (confirmEl.style.display = "none"), 220);
        });
        closeBtn.addEventListener("click", (ev) => {
          ev.stopPropagation();
          confirmEl.classList.remove("open");
          setTimeout(() => {
            confirmEl.style.display = "none";
            try {
              if (typeof confirmEl._onClose === "function")
                confirmEl._onClose();
            } catch (e) {
              // Ошибка обработки события
            }
            try {
              const related = confirmEl._relatedPanel;
              if (related && typeof window.hideModal === "function")
                window.hideModal(related);
            } catch (e) {
              /* ignore */
            }
          }, 220);
        });
      }
      // Используем сохраненную ссылку или querySelector как fallback
      const messageEl = confirmEl._confirmMessageEl || confirmEl.querySelector(".confirm-message");
      if (messageEl) messageEl.textContent = message;
      confirmEl._onClose = onCloseConfirmed;
      confirmEl._relatedPanel = arguments[2] || null;
      confirmEl.style.display = "block";
      requestAnimationFrame(() => confirmEl.classList.add("open"));
    }
    window.showInternalConfirm = showInternalConfirm;

    // Закрытие модалей по клику вне
    let ignoreOutsideClickUntil = 0;
    document.addEventListener("click", (e) => {
      if (Date.now() < ignoreOutsideClickUntil) return;
      // Во время интерактивного тура не закрываем модальные окна по внешнему клику:
      // кнопки "Назад/Далее" в tooltip технически являются внешним кликом для модалок.
      if (
        window.__onboardingTourActive === true ||
        !!document.querySelector(".onboarding-tooltip.visible")
      ) return;
      // Игнорируем клики по переключателю темы и его элементам
      if (e.target.closest("#themeToggle") || e.target.id === "themeToggle" ||
        e.target.closest("label[for='themeToggle']") ||
        e.target.closest(".theme-switch") ||
        e.target.closest(".theme-toggle-wrapper")) {
        return;
      }
      const mod = e.target.closest(".modal-panel");
      if (mod) {
        if (mod.id === "reportLoadingModal" || mod.id === "prospectsModal") return;
        return;
      }

      const loadingModal = document.getElementById("reportLoadingModal");
      if (
        loadingModal &&
        (loadingModal.style.display === "block" ||
          loadingModal.classList.contains("open"))
      ) {
        return;
      }

      const pop = document.getElementById("addChoicePopover");
      if (
        pop &&
        !e.target.closest("#addTechBtn") &&
        !e.target.closest("#addIconBtn")
      ) {
        if (pop.style.display === "block" || pop.classList.contains("open")) {
          pop.classList.remove("open");
          pop.style.display = "none";
        }
      }

      ["addTechPanel", "editTechPanel", "addBlockPanel"].forEach((id) => {
        const panel = document.getElementById(id);
        if (!panel) return;
        const isOpen =
          panel.style.display === "block" || panel.classList.contains("open");
        if (!isOpen) return;
        if (Date.now() < ignoreOutsideClickUntil) return;

        const form = panel.querySelector("form");
        if (!form || !form.dataset.initial) {
          if (typeof window.hideModal === "function") {
            window.hideModal(panel);
          }
          return;
        }
        if (typeof window.isFormDirty === "function") {
          const wasDirty = window.isFormDirty(form);
          if (!wasDirty) {
            if (typeof window.hideModal === "function") {
              window.hideModal(panel);
            }
          } else {
            if (typeof window.showInternalConfirm === "function") {
              window.showInternalConfirm(
                "Вы заполнили/изменили некоторые поля. Уверены, что хотите закрыть? Все изменения будут потеряны.",
                () => {
                  form?.reset();
                  if (
                    id === "addTechPanel" &&
                    typeof window.resetCustomSelects === "function"
                  ) {
                    // В addTechPanel поля имеют префикс tech* (techSector, techBlock, techFunc, ...)
                    window.resetCustomSelects("tech");
                  }
                  if (
                    id === "editTechPanel" &&
                    typeof window.resetCustomSelects === "function"
                  ) {
                    window.resetCustomSelects("edit");
                  }
                  if (id === "addBlockPanel") {
                    /* nothing extra */
                  }
                  if (id === "addTechPanel") {
                    const companyRatingsContainer = document.getElementById("techCompanyRatingsContainer");
                    if (companyRatingsContainer) companyRatingsContainer.innerHTML = "";
                    if (typeof window.updateTechRatingsVisibility === "function") {
                      window.updateTechRatingsVisibility();
                    }
                  }
                },
                panel
              );
            }
          }
        }
      });
    });

    // ===== ФОРМЫ =====
    // Обработчики форм и кнопок редактирования/удаления вынесены в ui/form-events.js
    if (typeof window.initFormEvents === "function") {
      window.initFormEvents();
    }

  }

  // ===== UTILS =====
  // Модуль вспомогательных утилит

  // Константы
  const NUMERIC_FIELDS = ['techRead', 'organRead', 'funcCover', 'costProm'];
  const READINESS_FIELDS = ['techRead', 'organRead', 'funcCover'];
  const READINESS_COLORS = {
    0: '#E74C3C', // Красный
    1: '#FF8C00', // Оранжевый
    2: '#FFD700', // Желтый
    3: '#28A745'  // Зеленый
  };
  const DEFAULT_COLOR = '#000000';

  // Проверка, заполнена ли оценка
  function isRatingFilled(rating) {
    if (rating === undefined || rating === null) return false;
    const str = String(rating).trim();
    return str !== '' && str !== 'null' && str !== 'undefined';
  }

  // Проверка, является ли поле числовым
  function isNumericField(fieldName) {
    return NUMERIC_FIELDS.includes(fieldName);
  }

  // Получение цвета на основе значения готовности (0-3)
  function getReadinessColor(value) {
    const numValue = Number(value);
    if (isNaN(numValue) || numValue < 0 || numValue > 3) {
      return DEFAULT_COLOR;
    }
    return READINESS_COLORS[numValue] || DEFAULT_COLOR;
  }

  // Проверка, является ли поле полем готовности
  function isReadinessField(fieldName) {
    return READINESS_FIELDS.includes(fieldName);
  }

  // Преобразование имени в kebab-case
  function toKebab(name) {
    if (typeof name !== 'string') return '';
    return name
      .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
      .replace(/_/g, '-')
      .toLowerCase();
  }

  // Экспорт Utils
  const Utils = {
    isRatingFilled,
    isNumericField,
    getReadinessColor,
    isReadinessField,
    toKebab
  };

  // Экспорт в window и ES export (инициализация вызывается из app-init после загрузки всех модулей)
  if (typeof window !== "undefined") {
    window.initEventHandlers = initEventHandlers;
    window.initSearchHandler = initSearchHandler; // Экспорт функции инициализации поиска
    // Экспорт Utils для обратной совместимости
    window.Utils = Utils;
    Object.keys(Utils).forEach(key => {
      window[key] = Utils[key];
    });
  }

  export default { initEventHandlers, initSearchHandler, Utils };
  export { initEventHandlers, initSearchHandler, Utils, isRatingFilled, isNumericField, getReadinessColor, isReadinessField, toKebab };
