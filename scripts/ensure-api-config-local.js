/**
 * Шаг 10.1: перед сборкой создаёт api-config.local.js из примера, если файл отсутствует.
 * Позволяет собирать проект без предварительного копирования конфига.
 */
import { copyFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const example = join(root, 'src', 'js', 'config', 'api-config.local.example.js');
const local = join(root, 'src', 'js', 'config', 'api-config.local.js');

if (!existsSync(local) && existsSync(example)) {
  copyFileSync(example, local);
  console.log('[prebuild] Создан api-config.local.js из примера');
}
