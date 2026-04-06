// radar-events.js
// Модуль обработки событий для радара технологий
// Вынесено из events.js для улучшения читаемости и поддержки

import { DOMCache } from '../core/dom-utils.js';
import Logger from '../core/logger.js';

"use strict";

  // Проверка: есть ли технологии в квадранте (учитывает технологии с несколькими блоками/квадрантами)
  function quadrantHasTechs(qId) {
    if (!qId) return false;
    const techs = typeof window.getTechnologies === "function" ? window.getTechnologies() : [];
    // Используем функции из window.Positioning, если они доступны
    const getAllQuadrantsForTech =
      (window.Positioning && typeof window.Positioning.getAllQuadrantsForTech === "function")
        ? window.Positioning.getAllQuadrantsForTech
        : (typeof window.getAllQuadrantsForTech === "function" ? window.getAllQuadrantsForTech : null);
    const getQuadrantIdForBlock =
      (window.Positioning && typeof window.Positioning.getQuadrantIdForBlock === "function")
        ? window.Positioning.getQuadrantIdForBlock
        : (typeof window.getQuadrantIdForBlock === "function" ? window.getQuadrantIdForBlock : null);

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
  // ОПТИМИЗАЦИЯ: Используем делегирование событий вместо клонирования элементов
  let hoverHandlersAttached = false;
  let currentHoveredBlip = null;

  function attachBlipHoverHandlers() {
    const svg = DOMCache.get("techRadar");
    if (!svg) return;

    // Если обработчики уже прикреплены, не делаем ничего (они работают через делегирование)
    if (hoverHandlersAttached) return;

    const hoverLabel = document.getElementById("hoverLabel");
    let quadrantPriorityPanel = document.getElementById("quadrantPriorityPanel");
    let qpListEl = quadrantPriorityPanel
      ? quadrantPriorityPanel.querySelector("#qpList")
      : null;

    // Используем mouseover/mouseout с делегированием (mouseenter/mouseleave не всплывают)
    svg.addEventListener("mouseover", (e) => {
      const b = e.target.closest(".blip");
      if (!b || b === currentHoveredBlip) return; // Предотвращаем повторную обработку

      // Скрываем предыдущий hover
      if (currentHoveredBlip) {
        currentHoveredBlip.classList.remove("highlighted");
      }

      currentHoveredBlip = b;
      const id = +b.dataset.id;
      if (typeof window.getTechById !== "function") return;
      const tech = window.getTechById(id);
      if (!tech) return;
      b.classList.add("highlighted");

      // Обновляем ссылки на элементы (могут измениться)
      if (!quadrantPriorityPanel) quadrantPriorityPanel = document.getElementById("quadrantPriorityPanel");
      if (quadrantPriorityPanel && !qpListEl) qpListEl = quadrantPriorityPanel.querySelector("#qpList");

      // Подсвечиваем соответствующий элемент в модальном окне списка технологий (если открыто)
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
    }, true); // Используем capture phase для лучшей производительности

    svg.addEventListener("mouseout", (e) => {
      const b = e.target.closest(".blip");
      if (!b || b !== currentHoveredBlip) return;

      // Проверяем, что мы действительно покидаем blip (а не переходим к дочернему элементу)
      const relatedTarget = e.relatedTarget;
      if (relatedTarget && b.contains(relatedTarget)) return;

      currentHoveredBlip = null;
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
    }, true);

    hoverHandlersAttached = true;
  }

  // Инициализация обработчиков событий для радара
  function initRadarEvents() {
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
          if (Logger) Logger.debug("radar-events.js: обработчик клика на blip", {
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
              if (Logger) Logger.warn("radar-events.js: showDetail не доступна");
            }
          } else {
            if (Logger) Logger.warn("radar-events.js: detailPanel не найден");
          }

          // При клике по blip НЕ открываем модальное окно списка технологий
          // Только зумируем квадрант, если он еще не зуммирован
          const blockKeyZoom =
            currentTech.blocks && currentTech.blocks.length
              ? currentTech.blocks[0]
              : currentTech.block;
          const getQuadrantIdForBlockFn =
            (window.Positioning && typeof window.Positioning.getQuadrantIdForBlock === "function")
              ? window.Positioning.getQuadrantIdForBlock
              : (typeof window.getQuadrantIdForBlock === "function" ? window.getQuadrantIdForBlock : null);
          if (
            getQuadrantIdForBlockFn &&
            typeof window.zoomQuadrant === "function"
          ) {
            const q = getQuadrantIdForBlockFn(blockKeyZoom);
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
              if (Logger) Logger.warn("Не удалось открыть сектор в сайдбаре:", err);
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
            // Деактивируем focus trap перед закрытием
            if (window.FocusTrap && typeof window.FocusTrap.release === 'function') {
              window.FocusTrap.release();
            }
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
  if (typeof window !== "undefined") {
    window.initRadarEvents = initRadarEvents;
    window.attachBlipHoverHandlers = attachBlipHoverHandlers;
  }

  export { initRadarEvents, attachBlipHoverHandlers };
  export default { initRadarEvents, attachBlipHoverHandlers };
