/**
 * Скрипт для анализа распределения технологий по квадрантам радара
 *
 * Использование:
 * 1. Запустить приложение
 * 2. Открыть консоль браузера
 * 3. Выполнить: await analyzeQuadrantDistribution()
 *
 * Или использовать в Node.js (требует загрузки данных):
 * node scripts/analyze-quadrant-distribution.js
 */

/**
 * Анализирует распределение технологий по квадрантам
 * @returns {Object} Результаты анализа
 */
async function analyzeQuadrantDistribution() {
  // Загружаем данные
  let technologies = [];
  let directionToQuadrant = {};
  // УДАЛЕНО (2026-01-29): blockToQuadrant больше не используется
  let digitalDirections = [];
  let blocks = [];

  // Пробуем загрузить данные из разных источников
  if (typeof window !== 'undefined') {
    // Браузерная среда
    if (window.StateAccessors && typeof window.StateAccessors.getTechnologies === 'function') {
      technologies = window.StateAccessors.getTechnologies() || [];
    } else if (window.technologies && Array.isArray(window.technologies)) {
      technologies = window.technologies;
    }

    directionToQuadrant = window.directionToQuadrant || {};
    // УДАЛЕНО (2026-01-29): blockToQuadrant больше не используется
    digitalDirections = window.StateManager?.get('digitalDirections') || window.digitalDirections || [];
    blocks = window.StateManager?.get('blocks') || window.blocks || [];
  } else {
    // Node.js среда
    const fs = require('fs');
    const path = require('path');

    try {
      const techPath = path.join(__dirname, '../src/data/ru/technologies.json');
      const dirToQuadPath = path.join(__dirname, '../src/data/ru/directionToQuadrant.json');
      // УДАЛЕНО (2026-01-29): blockToQuadrant.json больше не используется
      const directionsPath = path.join(__dirname, '../src/data/ru/digitalDirections.json');
      const blocksPath = path.join(__dirname, '../src/data/ru/bloks.json');

      technologies = JSON.parse(fs.readFileSync(techPath, 'utf8'));
      directionToQuadrant = JSON.parse(fs.readFileSync(dirToQuadPath, 'utf8'));
      // УДАЛЕНО (2026-01-29): blockToQuadrant.json больше не загружается

      if (fs.existsSync(directionsPath)) {
        digitalDirections = JSON.parse(fs.readFileSync(directionsPath, 'utf8'));
      }
      if (fs.existsSync(blocksPath)) {
        blocks = JSON.parse(fs.readFileSync(blocksPath, 'utf8'));
      }
    } catch (error) {
      console.error('Ошибка загрузки данных:', error);
      return null;
    }
  }

  // Функция для получения названия направления по ID
  function getDirectionNameById(directionId) {
    if (directionId == null) return null;
    if (typeof directionId === 'string') return directionId;

    const id = typeof directionId === 'number' ? directionId : Number(directionId);
    if (isNaN(id)) return null;

    const direction = digitalDirections.find(d => d && typeof d === 'object' && d.id === id);
    return direction && direction.name ? direction.name : null;
  }

  // Функция для получения квадрантов направления
  function getQuadrantsForDirection(directionNameOrId) {
    if (directionNameOrId == null || !directionToQuadrant) return [];

    const directionName = getDirectionNameById(directionNameOrId) || directionNameOrId;
    const m = directionToQuadrant[directionName];
    if (m == null) return [];
    if (Array.isArray(m)) return m.filter(q => typeof q === 'number');
    if (typeof m === 'number') return [m];
    return [];
  }

  // Функция для получения всех квадрантов технологии
  // ОБНОВЛЕНО (2026-01-29): Удален fallback через блоки
  // Блоки больше не привязаны к квадрантам, они являются отдельными критериями технологии
  function getAllQuadrantsForTech(tech) {
    if (!tech) return [];
    const quadrantsSet = new Set();

    // Используем только направления
    const directions = Array.isArray(tech.directions) && tech.directions.length
      ? tech.directions
      : (tech.direction ? [tech.direction] : []);

    if (directions.length > 0) {
      directions.forEach(directionName => {
        const directionQuadrants = getQuadrantsForDirection(directionName);
        directionQuadrants.forEach(q => quadrantsSet.add(q));
      });
    }

    // Квадрант по умолчанию, если нет направлений
    if (quadrantsSet.size === 0) {
      quadrantsSet.add(1);
    }

    return Array.from(quadrantsSet);
  }

  // Анализ распределения
  const distribution = {
    1: { count: 0, technologies: [], byDirection: {} },
    2: { count: 0, technologies: [], byDirection: {} },
    3: { count: 0, technologies: [], byDirection: {} },
    4: { count: 0, technologies: [], byDirection: {} },
    unassigned: { count: 0, technologies: [] }
  };

  const issues = {
    noDirections: [],
    invalidDirections: [],
    multipleQuadrants: []
  };

  technologies.forEach(tech => {
    const quadrants = getAllQuadrantsForTech(tech);

    // Проверяем наличие направлений
    const hasDirections = Array.isArray(tech.directions) && tech.directions.length > 0;
    const hasDirection = tech.direction && tech.direction.length > 0;

    if (!hasDirections && !hasDirection) {
      issues.noDirections.push({
        id: tech.id,
        name: tech.name || 'Без названия'
      });
    }

    // Проверяем валидность направлений
    if (hasDirections || hasDirection) {
      const directions = Array.isArray(tech.directions) ? tech.directions : [tech.direction];
      directions.forEach(dir => {
        const directionName = getDirectionNameById(dir);
        if (!directionName) {
          issues.invalidDirections.push({
            techId: tech.id,
            techName: tech.name || 'Без названия',
            directionId: dir
          });
        } else if (!directionToQuadrant[directionName]) {
          issues.invalidDirections.push({
            techId: tech.id,
            techName: tech.name || 'Без названия',
            directionName: directionName
          });
        }
      });
    }

    // УДАЛЕНО (2026-01-29): Проверка блоков на квадранты больше не нужна
    // Блоки являются отдельными критериями технологии и не влияют на квадранты

    // Учитываем технологии с несколькими квадрантами
    if (quadrants.length > 1) {
      issues.multipleQuadrants.push({
        id: tech.id,
        name: tech.name || 'Без названия',
        quadrants: quadrants
      });
    }

    // Распределяем по квадрантам
    if (quadrants.length === 0) {
      distribution.unassigned.count++;
      distribution.unassigned.technologies.push({
        id: tech.id,
        name: tech.name || 'Без названия'
      });
    } else {
      quadrants.forEach(q => {
        if (distribution[q]) {
          distribution[q].count++;
          if (!distribution[q].technologies.find(t => t.id === tech.id)) {
            distribution[q].technologies.push({
              id: tech.id,
              name: tech.name || 'Без названия',
              directions: tech.directions || tech.direction,
              blocks: tech.blocks || tech.block
            });
          }

          // Группируем по направлениям
          const directions = Array.isArray(tech.directions) ? tech.directions : (tech.direction ? [tech.direction] : []);
          directions.forEach(dir => {
            const dirName = getDirectionNameById(dir) || dir;
            if (!distribution[q].byDirection[dirName]) {
              distribution[q].byDirection[dirName] = 0;
            }
            distribution[q].byDirection[dirName]++;
          });

          // УДАЛЕНО (2026-01-29): Группировка по блокам больше не используется
          // Блоки не привязаны к квадрантам
        }
      });
    }
  });

  // Вычисляем статистику
  const total = technologies.length;
  const stats = {
    total,
    distribution: {
      1: {
        count: distribution[1].count,
        percentage: ((distribution[1].count / total) * 100).toFixed(1) + '%',
        unique: distribution[1].technologies.length
      },
      2: {
        count: distribution[2].count,
        percentage: ((distribution[2].count / total) * 100).toFixed(1) + '%',
        unique: distribution[2].technologies.length
      },
      3: {
        count: distribution[3].count,
        percentage: ((distribution[3].count / total) * 100).toFixed(1) + '%',
        unique: distribution[3].technologies.length
      },
      4: {
        count: distribution[4].count,
        percentage: ((distribution[4].count / total) * 100).toFixed(1) + '%',
        unique: distribution[4].technologies.length
      },
      unassigned: {
        count: distribution.unassigned.count,
        percentage: ((distribution.unassigned.count / total) * 100).toFixed(1) + '%'
      }
    }
  };

  // Вычисляем баланс
  const counts = [1, 2, 3, 4].map(q => distribution[q].count);
  const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
  const variance = counts.reduce((sum, count) => sum + Math.pow(count - avg, 2), 0) / counts.length;
  const stdDev = Math.sqrt(variance);
  const balance = 100 - (stdDev / avg * 100);

  stats.balance = {
    average: avg.toFixed(1),
    variance: variance.toFixed(1),
    stdDev: stdDev.toFixed(1),
    balanceScore: balance.toFixed(1) + '%',
    recommendation: balance > 80 ? '✅ Хорошо сбалансировано' :
                   balance > 60 ? '⚠️ Требуется небольшая перебалансировка' :
                   '❌ Требуется значительная перебалансировка'
  };

  // Формируем результат
  const result = {
    summary: stats,
    distribution: {
      1: {
        count: distribution[1].count,
        technologies: distribution[1].technologies.slice(0, 10), // Первые 10 для примера
        totalTechnologies: distribution[1].technologies.length,
        byDirection: distribution[1].byDirection
      },
      2: {
        count: distribution[2].count,
        technologies: distribution[2].technologies.slice(0, 10),
        totalTechnologies: distribution[2].technologies.length,
        byDirection: distribution[2].byDirection
      },
      3: {
        count: distribution[3].count,
        technologies: distribution[3].technologies.slice(0, 10),
        totalTechnologies: distribution[3].technologies.length,
        byDirection: distribution[3].byDirection
      },
      4: {
        count: distribution[4].count,
        technologies: distribution[4].technologies.slice(0, 10),
        totalTechnologies: distribution[4].technologies.length,
        byDirection: distribution[4].byDirection
      },
      unassigned: distribution.unassigned
    },
    issues: {
      noDirections: {
        count: issues.noDirections.length,
        technologies: issues.noDirections.slice(0, 10)
      },
      invalidDirections: {
        count: issues.invalidDirections.length,
        issues: issues.invalidDirections.slice(0, 10)
      },
      // УДАЛЕНО (2026-01-29): Проверка блоков больше не нужна
      multipleQuadrants: {
        count: issues.multipleQuadrants.length,
        technologies: issues.multipleQuadrants.slice(0, 10)
      }
    }
  };

  // Выводим результаты
  console.log('=== АНАЛИЗ РАСПРЕДЕЛЕНИЯ ТЕХНОЛОГИЙ ПО КВАДРАНТАМ ===\n');
  console.log('📊 Общая статистика:');
  console.log(`Всего технологий: ${total}`);
  console.log(`Квадрант 1: ${stats.distribution[1].count} (${stats.distribution[1].percentage}) - ${stats.distribution[1].unique} уникальных`);
  console.log(`Квадрант 2: ${stats.distribution[2].count} (${stats.distribution[2].percentage}) - ${stats.distribution[2].unique} уникальных`);
  console.log(`Квадрант 3: ${stats.distribution[3].count} (${stats.distribution[3].percentage}) - ${stats.distribution[3].unique} уникальных`);
  console.log(`Квадрант 4: ${stats.distribution[4].count} (${stats.distribution[4].percentage}) - ${stats.distribution[4].unique} уникальных`);
  console.log(`Не назначены: ${stats.distribution.unassigned.count} (${stats.distribution.unassigned.percentage})\n`);

  console.log('⚖️ Баланс распределения:');
  console.log(`Среднее: ${stats.balance.average}`);
  console.log(`Стандартное отклонение: ${stats.balance.stdDev}`);
  console.log(`Оценка баланса: ${stats.balance.balanceScore}`);
  console.log(`Рекомендация: ${stats.balance.recommendation}\n`);

  if (result.issues.noDirections.count > 0) {
    console.log(`⚠️ Технологий без направлений: ${result.issues.noDirections.count}`);
  }
  if (result.issues.invalidDirections.count > 0) {
    console.log(`❌ Невалидных направлений: ${result.issues.invalidDirections.count}`);
  }
  // УДАЛЕНО (2026-01-29): Проверка блоков больше не нужна
  if (result.issues.multipleQuadrants.count > 0) {
    console.log(`📌 Технологий в нескольких квадрантах: ${result.issues.multipleQuadrants.count}`);
  }

  console.log('\n=== ДЕТАЛЬНАЯ ИНФОРМАЦИЯ ===');
  console.log('Для просмотра детальной информации используйте:');
  console.log('  result.distribution[1] - информация о квадранте 1');
  console.log('  result.issues - список проблем');
  console.log('  result.summary - общая статистика');

  return result;
}

// Экспорт для использования в браузере
if (typeof window !== 'undefined') {
  window.analyzeQuadrantDistribution = analyzeQuadrantDistribution;
}

// Экспорт для использования в Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { analyzeQuadrantDistribution };
}

// Автоматический запуск в Node.js
if (typeof require !== 'undefined' && require.main === module) {
  analyzeQuadrantDistribution()
    .then(result => {
      if (result) {
        console.log('\n✅ Анализ завершен успешно');
      } else {
        console.error('\n❌ Ошибка при выполнении анализа');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('\n❌ Ошибка:', error);
      process.exit(1);
    });
}
