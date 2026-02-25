// toast.js — ES module
// Модуль для toast уведомлений с очередью

import { escapeHtml } from '../core/escape-utils.js';

const queue = [];
const maxVisible = 3;
let visibleCount = 0;
let toastIdCounter = 0;

export const ToastType = {
  SUCCESS: 'success',
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info'
};

const icons = {
  [ToastType.SUCCESS]: `
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
  `,
  [ToastType.ERROR]: `
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="12" y1="8" x2="12" y2="12"></line>
      <line x1="12" y1="16" x2="12.01" y2="16"></line>
    </svg>
  `,
  [ToastType.WARNING]: `
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
      <line x1="12" y1="9" x2="12" y2="13"></line>
      <line x1="12" y1="17" x2="12.01" y2="17"></line>
    </svg>
  `,
  [ToastType.INFO]: `
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="12" y1="16" x2="12" y2="12"></line>
      <line x1="12" y1="8" x2="12.01" y2="8"></line>
    </svg>
  `
};

const defaultDuration = {
  [ToastType.SUCCESS]: 3000,
  [ToastType.ERROR]: 5000,
  [ToastType.WARNING]: 4000,
  [ToastType.INFO]: 3000
};

function ensureContainer() {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    container.setAttribute('aria-live', 'polite');
    container.setAttribute('aria-atomic', 'true');
    document.body.appendChild(container);
  }
  return container;
}

function processQueue() {
  if (visibleCount >= maxVisible || queue.length === 0) return;
  const toast = queue.shift();
  showToast(toast);
}

function showToast(options) {
  const {
    message,
    type = ToastType.INFO,
    duration = defaultDuration[type],
    id = `toast_${Date.now()}_${++toastIdCounter}`
  } = options;

  visibleCount++;
  const container = ensureContainer();
  const toastEl = document.createElement('div');
  toastEl.className = `toast toast-${type}`;
  toastEl.id = id;
  toastEl.setAttribute('role', 'alert');
  toastEl.setAttribute('aria-live', 'assertive');

  const escapedMessage = escapeHtml(message);
  toastEl.innerHTML = `
    <div class="toast-icon">${icons[type] || icons[ToastType.INFO]}</div>
    <div class="toast-message">${escapedMessage}</div>
    <button class="toast-close" aria-label="Закрыть уведомление">&times;</button>
  `;

  container.appendChild(toastEl);
  requestAnimationFrame(() => toastEl.classList.add('visible'));

  const closeBtn = toastEl.querySelector('.toast-close');
  if (closeBtn) closeBtn.addEventListener('click', () => hideToast(id));

  if (duration > 0) {
    const timeoutId = setTimeout(() => hideToast(id), duration);
    toastEl.dataset.timeoutId = timeoutId;
  }
}

function hideToast(id) {
  const toastEl = document.getElementById(id);
  if (!toastEl) return;
  const timeoutId = toastEl.dataset.timeoutId;
  if (timeoutId) clearTimeout(parseInt(timeoutId, 10));
  toastEl.classList.remove('visible');
  toastEl.classList.add('hiding');
  setTimeout(() => {
    if (toastEl.parentNode) toastEl.parentNode.removeChild(toastEl);
    visibleCount--;
    processQueue();
  }, 300);
}

export function show(message, type = ToastType.INFO, duration = null) {
  const toastOptions = {
    message,
    type,
    duration: duration !== null ? duration : defaultDuration[type]
  };
  if (visibleCount >= maxVisible) queue.push(toastOptions);
  else showToast(toastOptions);
}

export function success(message, duration = null) {
  show(message, ToastType.SUCCESS, duration);
}

export function error(message, duration = null) {
  show(message, ToastType.ERROR, duration);
}

export function warning(message, duration = null) {
  show(message, ToastType.WARNING, duration);
}

export function info(message, duration = null) {
  show(message, ToastType.INFO, duration);
}

export function hideAll() {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  container.querySelectorAll('.toast').forEach(toast => hideToast(toast.id));
  queue.length = 0;
}

const Toast = { show, success, error, warning, info, hideAll, ToastType };
if (typeof window !== 'undefined') window.Toast = Toast;
export default Toast;
