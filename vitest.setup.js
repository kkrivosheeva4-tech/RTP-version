// vitest.setup.js
// Настройка окружения для тестов

import { vi } from 'vitest';

// Мокаем window объект
global.window = global.window || {};

// Мокаем localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
global.localStorage = localStorageMock;

// Мокаем fetch
global.fetch = vi.fn();
