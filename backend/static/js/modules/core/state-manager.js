// state-manager.js — ES module
// StateManager: простое централизованное состояние с подписками.
// API: get(key), set(key, value), subscribe(fn) -> unsubscribe, subscribeToKey(key, fn) -> unsubscribe, clear()

import Logger from './logger.js';

const state = {};
const listeners = new Set();
const keyListeners = new Map();

function safeCall(fn, ...args) {
  try {
    fn(...args);
  } catch (e) {
    Logger.warn('StateManager listener error', e);
  }
}

const StateManager = {
  get(key) {
    return state[key];
  },

  set(key, value) {
    const oldValue = state[key];
    if (oldValue === value) return;

    state[key] = value;
    listeners.forEach((fn) => safeCall(fn, key, value, oldValue));

    const keySubscribers = keyListeners.get(key);
    if (keySubscribers) {
      keySubscribers.forEach((fn) => safeCall(fn, value, oldValue, key));
    }
  },

  subscribe(fn) {
    if (typeof fn !== 'function') return () => {};
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  subscribeToKey(key, fn) {
    if (typeof fn !== 'function') return () => {};

    if (!keyListeners.has(key)) {
      keyListeners.set(key, new Set());
    }
    keyListeners.get(key).add(fn);

    return () => {
      const subscribers = keyListeners.get(key);
      if (subscribers) {
        subscribers.delete(fn);
        if (subscribers.size === 0) {
          keyListeners.delete(key);
        }
      }
    };
  },

  clear() {
    Object.keys(state).forEach((k) => delete state[k]);
    listeners.clear();
    keyListeners.clear();
  }
};

if (typeof window !== 'undefined') {
  window.StateManager = StateManager;
}

export default StateManager;
export { StateManager };
