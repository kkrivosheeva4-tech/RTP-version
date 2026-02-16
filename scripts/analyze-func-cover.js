/**
 * Скрипт для анализа покрытия функций по блокам
 * Использование: node scripts/analyze-func-cover.js
 */

const fs = require('fs');
const path = require('path');

// Пути к файлам данных
const FUNCTION_TO_BLOCK_PATH = path.join(__dirname, '../src/data/ru/functionToBlock.json');
const BLOCKS_PATH = path.join(__dirname, '../src/data/ru/blocks.json');

// Загрузка данных
function loadJson(filePath) {
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Ошибка загрузки ${filePath}:`, error.message);
    return null;
  }
}

// Подсчет функций в каждом блоке
function analyzeBlockFunctions() {
  const functionToBlock = loadJson(FUNCTION_TO_BLOCK_PATH);
  const blocks = loadJson(BLOCKS_PATH);

  if (!functionToBlock || !blocks) {
    console.error('Не удалось загрузить необходимые файлы');
    return;
  }

  // Создаем словарь блоков
  const blockMap = {};
  blocks.forEach(block => {
    if (block.id && block.name) {
      blockMap[block.id] = {
        id: block.id,
        name: block.name,
        functionCount: 0,
        functions: []
      };
    }
  });

  // Подсчитываем функции
  Object.entries(functionToBlock).forEach(([functionName, blockIds]) => {
    // blockIds может быть числом или массивом
    const blocks = Array.isArray(blockIds) ? blockIds : [blockIds];

    blocks.forEach(blockId => {
      if (blockMap[blockId]) {
        blockMap[blockId].functionCount++;
        blockMap[blockId].functions.push(functionName);
      } else {
        console.warn(`Функция "${functionName}" ссылается на несуществующий блок ${blockId}`);
      }
    });
  });

  // Сортируем по ID блока
  const sortedBlocks = Object.values(blockMap).sort((a, b) => a.id - b.id);

  // Выводим результаты
  console.log('\n=== АНАЛИЗ ПОКРЫТИЯ ФУНКЦИЙ ПО БЛОКАМ ===\n');
  console.log('| ID | Название блока | Кол-во функций |');
  console.log('|----|----------------|----------------|');

  sortedBlocks.forEach(block => {
    const paddedName = block.name.padEnd(40);
    console.log(`| ${block.id.toString().padStart(2)} | ${paddedName} | ${block.functionCount.toString().padStart(14)} |`);
  });

  console.log('\n=== ДЕТАЛЬНАЯ ИНФОРМАЦИЯ ===\n');

  sortedBlocks.forEach(block => {
    console.log(`\nБлок ${block.id}: ${block.name}`);
    console.log(`Количество функций: ${block.functionCount}`);
    console.log('Функции:');
    block.functions.forEach((func, idx) => {
      console.log(`  ${idx + 1}. ${func}`);
    });
  });

  // Статистика
  console.log('\n=== СТАТИСТИКА ===\n');
  const totalFunctions = Object.keys(functionToBlock).length;
  const totalBlocks = blocks.length;
  const avgFunctionsPerBlock = (totalFunctions / totalBlocks).toFixed(2);
  const minFunctions = Math.min(...sortedBlocks.map(b => b.functionCount));
  const maxFunctions = Math.max(...sortedBlocks.map(b => b.functionCount));

  console.log(`Всего функций: ${totalFunctions}`);
  console.log(`Всего блоков: ${totalBlocks}`);
  console.log(`Среднее количество функций на блок: ${avgFunctionsPerBlock}`);
  console.log(`Минимум функций в блоке: ${minFunctions}`);
  console.log(`Максимум функций в блоке: ${maxFunctions}`);

  // Блоки с малым количеством функций (≤3)
  const smallBlocks = sortedBlocks.filter(b => b.functionCount <= 3);
  console.log(`\nБлоки с малым количеством функций (≤3): ${smallBlocks.length}`);
  smallBlocks.forEach(block => {
    console.log(`  - ${block.name} (${block.functionCount} ${block.functionCount === 1 ? 'функция' : 'функции'})`);
  });

  // Пример расчетов funcCover
  console.log('\n=== ПРИМЕРЫ РАСЧЕТОВ funcCover ===\n');

  // Пример 1: Блок с 1 функцией
  const block5 = blockMap[5];
  if (block5) {
    console.log(`Пример 1: ${block5.name}`);
    console.log(`  Всего функций: ${block5.functionCount}`);
    console.log(`  Покрыто: 1 функция`);
    console.log(`  Процент: ${(1/block5.functionCount * 100).toFixed(1)}%`);
    console.log(`  funcCover: ${Math.ceil((1/block5.functionCount) * 3)}`);
  }

  // Пример 2: Блок с 22 функциями
  const block13 = blockMap[13];
  if (block13) {
    console.log(`\nПример 2: ${block13.name}`);
    console.log(`  Всего функций: ${block13.functionCount}`);
    console.log(`  Покрыто: 4 функции`);
    console.log(`  Процент: ${(4/block13.functionCount * 100).toFixed(1)}%`);
    console.log(`  funcCover: ${Math.ceil((4/block13.functionCount) * 3)}`);
  }

  // Пример 3: Множественные блоки
  const block1 = blockMap[1];
  const block2 = blockMap[2];
  if (block1 && block2) {
    const totalFuncs = block1.functionCount + block2.functionCount;
    const covered = 5;
    console.log(`\nПример 3: ${block1.name} + ${block2.name}`);
    console.log(`  Всего функций: ${block1.functionCount} + ${block2.functionCount} = ${totalFuncs}`);
    console.log(`  Покрыто: ${covered} функций`);
    console.log(`  Процент: ${(covered/totalFuncs * 100).toFixed(1)}%`);
    console.log(`  funcCover: ${Math.ceil((covered/totalFuncs) * 3)}`);
  }
}

// Запуск анализа
analyzeBlockFunctions();
