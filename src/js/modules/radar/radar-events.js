// radar-events.js
// Модуль обработки событий для радара технологий
// Вынесено из events.js для улучшения читаемости и поддержки

(function () {
  "use strict";

  // Ленивая загрузка зависимостей для совместимости
  function getDependency(name) {
    if (typeof window === "undefined" || !window[name]) {
      throw new Error(
        `Зависимость ${name} не загружена. Подключите необходимые модули перед radar-events.js`
      );
    }
    return window[name];
  }

  // Проверка: есть ли технологии в квадранте (учитывает технологии с несколькими блоками/квадрантами)
  function quadrantHasTechs(qId) {
    if (!qId) return false;
    const techs = typeof window.getTechnologies === "function" ? window.getTechnologies() : [];
    const getAllQuadrantsForTech =
      typeof window.getAllQuadrantsForTech === "function" ? window.getAllQuadrantsForTech : null;
    const getQuadrantIdForBlock =
      typeof window.getQuadrantIdForBlock === "function" ? window.getQuadrantIdForBlock : null;

    return (Array.isArray(techs) ? techs : []).some((t) => {
      if (!t) return false;

      if (getAllQuadrantsForTech) {
        try {
          const qs = getAllQuadrantsForTech(t) || [];
          return Array.isArray(qs) && qs.includes(qId);
        } catch (_) {
          // fallback ниже
        }
      }

      if (!getQuadrantIdForBlock) return false;
      const blocks = Array.isArray(t.blocks) && t.blocks.length ? t.blocks : t.block ? [t.block] : [];
      return blocks.some((b) => getQuadrantIdForBlock(b) === qId);
    });
  }

  // ===== ОБРАБОТЧИКИ BLIP HOVER =====
  // Функция для привязки обработчиков hover к blip элементам
  function attachBlipHoverHandlers() {
    const DOMCache = getDependency("DOMCache");
    const svg = DOMCache.get("techRadar");
    if (!svg) return;

    const hoverLabel = document.getElementById("hoverLabel");
    const quadrantPriorityPanel = document.getElementById(
      "quadrantPriorityPanel"
    );
    const qpListEl = quadrantPriorityPanel
      ? quadrantPriorityPanel.querySelector("#qpList")
      : null;

    svg.querySelectorAll(".blip").forEach((b) => {
      b.replaceWith(b.cloneNode(true));
    });

    svg.querySelectorAll(".blip").forEach((b) => {
      b.addEventListener("mouseenter", () => {
        const id = +b.dataset.id;
        if (typeof window.getTechById !== "function") return;
        const tech = window.getTechById(id);
        if (!tech) return;
        b.classList.add("highlighted");

        // Подсвечиваем соответствующий элемент в модальном окне приоритетных технологий (если открыто)
        if (
          quadrantPriorityPanel &&
          quadrantPriorityPanel.classList.contains("open") &&
          qpListEl
        ) {
          qpListEl
            .querySelectorAll(".qp-item")
            .forEach((el) => el.classList.remove("highlighted"));
          const priorityItem = qpListEl.querySelector(
            `.qp-item[data-tech-id="${id}"]`
          );
          if (priorityItem) {
            priorityItem.classList.add("highlighted");
            // Прокручиваем к элементу, если он не виден
            priorityItem.scrollIntoView({
              behavior: "smooth",
              block: "nearest",
            });
          }
        }

        if (hoverLabel && typeof window.getHoverText === "function") {
          const rect = b.getBoundingClientRect();
          const svgRect = svg.getBoundingClientRect();
          const text = window.getHoverText(tech);
          hoverLabel.textContent = text;
          hoverLabel.classList.remove(
            "priority-low",
            "priority-medium",
            "priority-high"
          );
          // Точное позиционирование подсказки над blip по центру
          hoverLabel.style.left = `${
            rect.left + rect.width / 2 - svgRect.left
          }px`;
          hoverLabel.style.top = `${rect.top - svgRect.top}px`;
          hoverLabel.classList.add("visible");
        }
      });

      b.addEventListener("mouseleave", () => {
        // Подсветка бордером только при ховере
        b.classList.remove("highlighted");
        if (hoverLabel) {
          hoverLabel.classList.remove("visible");
        }
        // Убираем подсветку с элемента в модальном окне
        if (qpListEl) {
          qpListEl
            .querySelectorAll(".qp-item")
            .forEach((el) => el.classList.remove("highlighted"));
        }
      });

      // Надёжный обработчик клика на каждом blip, добавляем после клонирования.
      // Примечание: после клонирования blip теряет обработчики из createBlip, поэтому добавляем здесь
      b.addEventListener("click", (ev) => {
        ev.stopPropagation();
        const id = +b.dataset.id;
        const blipQuadrant = b.dataset.quadrant ? +b.dataset.quadrant : null;
        if (typeof window.getTechById !== "function") return;
        const tech = window.getTechById(id);
        if (!tech) return;
        // Установим как текущую технологию
        if (typeof window.setCurrentTech === "function") {
          window.setCurrentTech(tech);
        }
        b.classList.remove("highlighted"); // убрать бордер, он только для hover

        // Обновим панель деталей, передавая квадрант blip'а
        // showDetail сам выделит все blip'ы технологии (подсветка и пульсация) и выполнит зум
        if (typeof window.showDetail === "function") {
          window.showDetail(tech, "blip", blipQuadrant);
        }
      });
    });
  }

  // Инициализация обработчиков событий для радара
  function initRadarEvents() {
    const DOMCache = getDependency("DOMCache");

    // Вызываем attachBlipHoverHandlers при инициализации, если DOM готов
    const svgForBlipHandlers = DOMCache.get("techRadar");
    if (svgForBlipHandlers) {
      // Вызываем attachBlipHoverHandlers после небольшой задержки, чтобы убедиться, что blip элементы созданы
      setTimeout(() => {
        attachBlipHoverHandlers();
      }, 100);
    }

    // ===== КЛИК ПО РАДАРУ =====
    const svg = DOMCache.get("techRadar");
    if (svg) {
      svg.addEventListener("click", (e) => {
        const blip = e.target.closest(".blip");
        const sectorLabel =
          e.target.closest(".sector-label-group") ||
          e.target.closest(".sector-label-click-area");
        const sector = e.target.closest(".quadrant-group");

        if (blip) {
          const id = +blip.dataset.id;
          let currentTech = null;
          if (
            typeof window.DataIndex !== "undefined" &&
            window.DataIndex.getById
          ) {
            currentTech = window.DataIndex.getById(id);
          }
          if (!currentTech && typeof window.getTechById === "function") {
            currentTech = window.getTechById(id);
          }
          if (!currentTech) return;

          if (typeof window.setCurrentTech === "function") {
            window.setCurrentTech(currentTech);
          }
          if (typeof window.setSelectedBlipId === "function") {
            window.setSelectedBlipId(id);
          }

          svg
            .querySelectorAll(".blip.selected")
            .forEach((el) => el.classList.remove("selected"));
          blip.classList.remove("highlighted");
          blip.classList.add("selected");

          const detailPanel = DOMCache.get("detailPanel");
          const blipQuadrant = blip.dataset.quadrant
            ? +blip.dataset.quadrant
            : null;
          console.debug("radar-events.js: обработчик клика на blip", {
            techId: currentTech.id,
            techName: currentTech.name,
            detailPanel: detailPanel ? "найден" : "не найден",
            showDetail:
              typeof window.showDetail === "function"
                ? "доступна"
                : "недоступна",
          });
          if (detailPanel) {
            if (typeof window.showDetail === "function") {
              window.showDetail(currentTech, "blip", blipQuadrant);
            } else {
              console.warn("radar-events.js: showDetail не доступна");
            }
          } else {
            console.warn("radar-events.js: detailPanel не найден");
          }

          // При клике по blip НЕ открываем модальное окно приоритетных технологий
          // Только зумируем квадрант, если он еще не зуммирован
          const blockKeyZoom =
            currentTech.blocks && currentTech.blocks.length
              ? currentTech.blocks[0]
              : currentTech.block;
          if (
            typeof window.getQuadrantIdForBlock === "function" &&
            typeof window.zoomQuadrant === "function"
          ) {
            const q = window.getQuadrantIdForBlock(blockKeyZoom);
            const currentZoomed =
              typeof window.getCurrentZoomedQuadrant === "function"
                ? window.getCurrentZoomedQuadrant()
                : null;
            // Зумируем только если квадрант еще не зуммирован
            if (currentZoomed !== q) {
              window.zoomQuadrant(q, {
                source: "blip",
                skipPriorityPanel: true,
              });
            }

            try {
              const sectorItem = document.querySelector(
                `.sector-item[data-quadrant="${q}"]`
              );
              if (sectorItem) {
                document
                  .querySelectorAll(".sector-item")
                  .forEach((i) => i.classList.remove("active"));
                sectorItem.classList.add("active");
                const existing = sectorItem.nextElementSibling;
                if (existing && existing.classList.contains("tech-list")) {
                  const listItem = existing.querySelector(
                    `.tech-list-item[data-tech-id="${currentTech.id}"]`
                  );
                  if (listItem) {
                    existing
                      .querySelectorAll(".tech-list-item")
                      .forEach((li) => li.classList.remove("selected"));
                    listItem.classList.add("selected");
                    listItem.scrollIntoView({
                      block: "nearest",
                      behavior: "smooth",
                    });
                  }
                } else {
                  if (
                    typeof window.createTechListForSector === "function" &&
                    typeof window.getTechnologies === "function"
                  ) {
                    const technologies = window.getTechnologies();
                    window.createTechListForSector(sectorItem, q, technologies);
                    const newList = sectorItem.nextElementSibling;
                    if (newList && newList.classList.contains("tech-list")) {
                      const listItem = newList.querySelector(
                        `.tech-list-item[data-tech-id="${currentTech.id}"]`
                      );
                      if (listItem) {
                        newList
                          .querySelectorAll(".tech-list-item")
                          .forEach((li) => li.classList.remove("selected"));
                        listItem.classList.add("selected");
                        listItem.scrollIntoView({
                          block: "nearest",
                          behavior: "smooth",
                        });
                      }
                    }
                  }
                }
              }
            } catch (err) {
              console.warn("Не удалось открыть сектор в сайдбаре:", err);
            }
          }
        } else if (sectorLabel) {
          // Обработка клика на метку сектора
          const qId = sectorLabel.dataset.quadrant
            ? +sectorLabel.dataset.quadrant
            : sectorLabel.closest(".quadrant-group")
            ? +sectorLabel.closest(".quadrant-group").dataset.quadrant
            : null;
          if (qId && !quadrantHasTechs(qId)) {
            if (typeof window.showNotification === "function") {
              window.showNotification(
                "На данный момент в данном секторе отсутствуют технологии, но мы активно работаем над внедрением новых технологий.",
                false
              );
            }
            return;
          }
          if (qId && typeof window.unzoom === "function") {
            window.unzoom();
          }
          if (qId) {
            setTimeout(() => {
              if (typeof window.zoomQuadrant === "function") {
                window.zoomQuadrant(qId, { source: "sector" });
              }
            }, 50);

            const sidebarItem = document.querySelector(
              `.sector-item[data-quadrant="${qId}"]`
            );
            if (sidebarItem) {
              sidebarItem.click();
            }
          }
        } else if (sector) {
          const qId = +sector.dataset.quadrant;
          if (qId && !quadrantHasTechs(qId)) {
            if (typeof window.showNotification === "function") {
              window.showNotification(
                "На данный момент в данном секторе отсутствуют технологии, но мы активно работаем над внедрением новых технологий.",
                false
              );
            }
            return;
          }
          if (typeof window.unzoom === "function") {
            window.unzoom();
          }
          setTimeout(() => {
            if (typeof window.zoomQuadrant === "function") {
              window.zoomQuadrant(qId, { source: "sector" });
            }
          }, 50);

          const sidebarItem = document.querySelector(
            `.sector-item[data-quadrant="${qId}"]`
          );
          if (sidebarItem) {
            sidebarItem.click();
          }
        } else {
          // Клик по пустому месту - закрываем панель подробной информации и сбрасываем зум
          const detailPanel = DOMCache.get("detailPanel");
          if (detailPanel && detailPanel.classList.contains("active")) {
            // Очищаем все inline стили, которые были установлены при открытии панели
            detailPanel.style.removeProperty("visibility");
            detailPanel.style.removeProperty("opacity");
            detailPanel.style.removeProperty("transform");
            detailPanel.style.removeProperty("position");
            detailPanel.style.removeProperty("z-index");
            detailPanel.style.removeProperty("display");
            // Удаляем класс active
            detailPanel.classList.remove("active");
          }
          if (typeof window.setSelectedBlipId === "function") {
            window.setSelectedBlipId(null);
          }
          svg
            .querySelectorAll(".blip.highlighted")
            .forEach((el) => el.classList.remove("highlighted"));
          svg
            .querySelectorAll(".blip.selected")
            .forEach((el) => el.classList.remove("selected"));
          document
            .querySelectorAll(".tech-list")
            .forEach((tl) => tl.parentNode?.removeChild(tl));
          document
            .querySelectorAll(".sector-item")
            .forEach((i) => i.classList.remove("active"));
          document
            .querySelectorAll(".tech-list-item.selected")
            .forEach((li) => li.classList.remove("selected"));
          if (typeof window.setCurrentTech === "function") {
            window.setCurrentTech(null);
          }
          if (typeof window.unzoom === "function") {
            window.unzoom();
          }
        }
      });
    }

    // ===== СЕКТОРЫ =====
    document.querySelectorAll(".sector-item").forEach((item) => {
      item.addEventListener("mouseenter", () => {
        const q = parseInt(item.dataset.quadrant, 10);
        const g = document.querySelector(`.quadrant-group.q${q}`);
        if (g) g.classList.add("highlight");
      });
      item.addEventListener("mouseleave", () => {
        const q = parseInt(item.dataset.quadrant, 10);
        const g = document.querySelector(`.quadrant-group.q${q}`);
        if (g) g.classList.remove("highlight");
      });
      item.addEventListener("click", (ev) => {
        ev.stopPropagation();
        if (item.classList.contains("empty")) {
          if (typeof window.showNotification === "function") {
            window.showNotification(
              "На данный момент в данном секторе отсутствуют технологии, но мы активно работаем над внедрением новых технологий.",
              false
            );
          }
          return;
        }
        const q = parseInt(item.dataset.quadrant, 10);
        document
          .querySelectorAll(".tech-list")
          .forEach((tl) => tl.parentNode?.removeChild(tl));
        document
          .querySelectorAll(".sector-item")
          .forEach((i) => i.classList.remove("active"));
        item.classList.add("active");

        if (typeof window.unzoom === "function") {
          window.unzoom();
        }
        if (!Number.isNaN(q) && typeof window.zoomQuadrant === "function") {
          setTimeout(() => window.zoomQuadrant(q, { source: "sector" }), 50);
        }
      });
    });
  }

  // Экспорт функций для использования в events.js и RMK2.js
  // Инициализация происходит через events.js, который правильно обрабатывает загрузку DOM
  if (typeof window !== "undefined") {
    window.initRadarEvents = initRadarEvents;
    window.attachBlipHoverHandlers = attachBlipHoverHandlers;
  }
})();
