/**
 * MSW server для Node (Vitest).
 * Шаг 10.3.
 */
import { setupServer } from 'msw/node';
import { handlers } from './handlers.js';

export const server = setupServer(...handlers);
