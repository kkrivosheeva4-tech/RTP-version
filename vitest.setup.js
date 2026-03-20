// vitest.setup.js
// Настройка окружения для тестов

import { vi, beforeAll, afterEach, afterAll } from 'vitest';
import { server } from './src/test/mocks/server.js';

// Мокаем window объект
global.window = global.window || {};

// Мокаем localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
};
global.localStorage = localStorageMock;

// MSW: перехват запросов в тестах (шаг 10.3)
beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
