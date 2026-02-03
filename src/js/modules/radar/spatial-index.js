/**
 * Модуль пространственных индексов для оптимизации алгоритма разведения наложений
 * Использует Quadtree для ускорения поиска коллизий
 */
(function(window) {
  'use strict';

  // Модуль SpatialIndex инициализирован

  /**
   * Простая реализация Quadtree для 2D пространства
   */
  class Quadtree {
    constructor(bounds, maxObjects = 10, maxLevels = 5, level = 0) {
      this.bounds = bounds; // {x, y, width, height}
      this.maxObjects = maxObjects;
      this.maxLevels = maxLevels;
      this.level = level;
      this.objects = [];
      this.nodes = [];
    }

    /**
     * Разделение узла на 4 подузла
     */
    split() {
      const subWidth = this.bounds.width / 2;
      const subHeight = this.bounds.height / 2;
      const x = this.bounds.x;
      const y = this.bounds.y;

      this.nodes[0] = new Quadtree(
        { x: x + subWidth, y: y, width: subWidth, height: subHeight },
        this.maxObjects,
        this.maxLevels,
        this.level + 1
      );
      this.nodes[1] = new Quadtree(
        { x: x, y: y, width: subWidth, height: subHeight },
        this.maxObjects,
        this.maxLevels,
        this.level + 1
      );
      this.nodes[2] = new Quadtree(
        { x: x, y: y + subHeight, width: subWidth, height: subHeight },
        this.maxObjects,
        this.maxLevels,
        this.level + 1
      );
      this.nodes[3] = new Quadtree(
        { x: x + subWidth, y: y + subHeight, width: subWidth, height: subHeight },
        this.maxObjects,
        this.maxLevels,
        this.level + 1
      );
    }

    /**
     * Определение индекса подузла для объекта
     */
    getIndex(rect) {
      const verticalMidpoint = this.bounds.x + (this.bounds.width / 2);
      const horizontalMidpoint = this.bounds.y + (this.bounds.height / 2);

      const topQuadrant = rect.y < horizontalMidpoint && rect.y + rect.height < horizontalMidpoint;
      const bottomQuadrant = rect.y > horizontalMidpoint;

      if (rect.x < verticalMidpoint && rect.x + rect.width < verticalMidpoint) {
        if (topQuadrant) return 1;
        if (bottomQuadrant) return 2;
      } else if (rect.x > verticalMidpoint) {
        if (topQuadrant) return 0;
        if (bottomQuadrant) return 3;
      }

      return -1; // Объект пересекает границы
    }

    /**
     * Вставка объекта в дерево
     */
    insert(obj) {
      const rect = {
        x: obj.x - obj.size,
        y: obj.y - obj.size,
        width: obj.size * 2,
        height: obj.size * 2
      };

      if (this.nodes.length > 0) {
        const index = this.getIndex(rect);
        if (index !== -1) {
          this.nodes[index].insert(obj);
          return;
        }
      }

      this.objects.push(obj);

      if (this.objects.length > this.maxObjects && this.level < this.maxLevels) {
        if (this.nodes.length === 0) {
          this.split();
        }

        let i = 0;
        while (i < this.objects.length) {
          const index = this.getIndex({
            x: this.objects[i].x - this.objects[i].size,
            y: this.objects[i].y - this.objects[i].size,
            width: this.objects[i].size * 2,
            height: this.objects[i].size * 2
          });

          if (index !== -1) {
            this.nodes[index].insert(this.objects.splice(i, 1)[0]);
          } else {
            i++;
          }
        }
      }
    }

    /**
     * Поиск объектов в заданной области
     */
    retrieve(rect, found = []) {
      if (this.nodes.length > 0) {
        const index = this.getIndex(rect);
        if (index !== -1) {
          this.nodes[index].retrieve(rect, found);
        } else {
          // Проверяем все подузлы
          for (let i = 0; i < this.nodes.length; i++) {
            this.nodes[i].retrieve(rect, found);
          }
        }
      }

      found.push(...this.objects);
      return found;
    }

    /**
     * Очистка дерева
     */
    clear() {
      this.objects = [];
      this.nodes = [];
    }
  }

  /**
   * Поиск коллизий с использованием Quadtree
   * @param {Array} technologies - Массив технологий
   * @param {Object} bounds - Границы области ({x, y, width, height})
   * @returns {Array} Массив пар технологий с коллизиями
   */
  function findCollisionsWithQuadtree(technologies, bounds) {
    if (!technologies || technologies.length === 0) return [];

    // Создаем Quadtree
    const quadtree = new Quadtree(bounds, 10, 5);

    // Вставляем все технологии
    technologies.forEach(tech => {
      if (tech.x !== undefined && tech.y !== undefined && tech.size !== undefined) {
        quadtree.insert(tech);
      }
    });

    // Находим коллизии
    const collisions = [];
    const checked = new Set();

    technologies.forEach((tech, i) => {
      if (tech.x === undefined || tech.y === undefined || tech.size === undefined) return;

      const rect = {
        x: tech.x - tech.size * 2,
        y: tech.y - tech.size * 2,
        width: tech.size * 4,
        height: tech.size * 4
      };

      const candidates = quadtree.retrieve(rect);

      candidates.forEach(candidate => {
        if (candidate === tech) return;

        const pairKey = `${Math.min(tech.id, candidate.id)}-${Math.max(tech.id, candidate.id)}`;
        if (checked.has(pairKey)) return;

        checked.add(pairKey);

        // Проверяем коллизию
        const dx = candidate.x - tech.x;
        const dy = candidate.y - tech.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const minDist = tech.size + candidate.size + 4; // Зазор

        if (dist < minDist) {
          collisions.push({ tech1: tech, tech2: candidate, distance: dist, minDist: minDist });
        }
      });
    });

    return collisions;
  }

  /**
   * Оптимизированное разведение наложений с использованием пространственного индекса
   * @param {Array} technologies - Массив технологий
   * @param {Object} bounds - Границы области
   * @param {Object} options - Опции алгоритма
   * @returns {Array} Массив технологий с обновленными позициями
   */
  function optimizeLayoutWithSpatialIndex(technologies, bounds, options = {}) {
    if (!technologies || technologies.length === 0) return technologies;

    const maxIterations = options.maxIterations || 80;
    const dampingFactor = options.dampingFactor || 0.98;
    const convergenceThreshold = options.convergenceThreshold || 0.1;

    let iteration = 0;
    let maxDisplacement = Infinity;

    while (iteration < maxIterations && maxDisplacement > convergenceThreshold) {
      maxDisplacement = 0;

      // Находим коллизии с помощью Quadtree
      const collisions = findCollisionsWithQuadtree(technologies, bounds);

      // Применяем силы отталкивания
      collisions.forEach(({ tech1, tech2, distance, minDist }) => {
        const overlap = minDist - distance;
        if (overlap <= 0) return;

        const dx = tech2.x - tech1.x;
        const dy = tech2.y - tech1.y;
        const dist = Math.max(distance, 0.001);

        // Сила отталкивания
        const force = (overlap / dist) * dampingFactor;
        const shiftX = (dx / dist) * force * 0.5;
        const shiftY = (dy / dist) * force * 0.5;

        // Применяем смещение
        tech1.x -= shiftX;
        tech1.y -= shiftY;
        tech2.x += shiftX;
        tech2.y += shiftY;

        // Ограничиваем границами
        tech1.x = Math.max(bounds.x, Math.min(bounds.x + bounds.width, tech1.x));
        tech1.y = Math.max(bounds.y, Math.min(bounds.y + bounds.height, tech1.y));
        tech2.x = Math.max(bounds.x, Math.min(bounds.x + bounds.width, tech2.x));
        tech2.y = Math.max(bounds.y, Math.min(bounds.y + bounds.height, tech2.y));

        maxDisplacement = Math.max(maxDisplacement, Math.abs(shiftX) + Math.abs(shiftY));
      });

      iteration++;
    }

    if (window.Logger && typeof window.Logger.debug === 'function') {
      window.Logger.debug(`[SpatialIndex] Оптимизация завершена за ${iteration} итераций, максимальное смещение: ${maxDisplacement.toFixed(2)}`);
    }

    return technologies;
  }

  // Публичный API
  window.SpatialIndex = {
    Quadtree: Quadtree,
    findCollisionsWithQuadtree: findCollisionsWithQuadtree,
    optimizeLayoutWithSpatialIndex: optimizeLayoutWithSpatialIndex
  };

  // Модуль SpatialIndex загружен

})(window);
