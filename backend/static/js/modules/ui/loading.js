// loading.js — ES module
// Модуль для управления индикаторами загрузки и прогресс-барами

let activeLoaders = new Map();
let loaderCounter = 0;

  /** Создает и показывает индикатор загрузки. Возвращает ID загрузчика. */
  export function show(message = 'Загрузка...', id = null) {
    const loaderId = id || `loader_${Date.now()}_${++loaderCounter}`;

    // Если загрузчик с таким ID уже существует, обновляем его
    if (activeLoaders.has(loaderId)) {
      const existing = activeLoaders.get(loaderId);
      if (existing.messageEl) {
        existing.messageEl.textContent = message;
      }
      return loaderId;
    }

    // Создаем контейнер для загрузчика
    let container = document.getElementById('loadingContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'loadingContainer';
      container.className = 'loading-container';
      document.body.appendChild(container);
    }

    // Создаем элемент загрузчика
    const loaderEl = document.createElement('div');
    loaderEl.className = 'loading-spinner-wrapper';
    loaderEl.id = `loader_${loaderId}`;
    loaderEl.setAttribute('data-loader-id', loaderId);

    loaderEl.innerHTML = `
      <div class="loading-spinner">
        <div class="spinner-ring"></div>
      </div>
      <div class="loading-message">${message}</div>
    `;

    container.appendChild(loaderEl);

    // Восстанавливаем размытие фона при показе индикатора
    container.style.backdropFilter = '';
    container.style.webkitBackdropFilter = '';
    container.style.background = '';

    // Анимация появления
    requestAnimationFrame(() => {
      loaderEl.classList.add('visible');
    });

    // Сохраняем ссылку на элемент
    activeLoaders.set(loaderId, {
      element: loaderEl,
      messageEl: loaderEl.querySelector('.loading-message'),
      container: container
    });

    return loaderId;
  }

  /** Скрывает индикатор загрузки */
  export function hide(id) {
    if (!id || !activeLoaders.has(id)) {
      // Если ID не указан, скрываем все загрузчики
      if (!id) {
        activeLoaders.forEach((loader, loaderId) => {
          hideLoader(loaderId);
        });
        return;
      }
      return;
    }

    hideLoader(id);
  }

  function hideLoader(id) {
    const loader = activeLoaders.get(id);
    if (!loader) return;

    const { element, container } = loader;
    element.classList.remove('visible');
    element.classList.add('hiding');

    // Проверяем, остались ли активные загрузчики (до удаления текущего)
    const willRemainActive = activeLoaders.size > 1;

    // Убираем размытие фона сразу при скрытии индикатора, если это последний
    if (!willRemainActive && container) {
      container.style.backdropFilter = 'none';
      container.style.webkitBackdropFilter = 'none';
      container.style.background = 'transparent';
    }

    // Удаляем элемент после анимации
    setTimeout(() => {
      if (element.parentNode) {
        element.parentNode.removeChild(element);
      }
      activeLoaders.delete(id);

      // Если контейнер пуст, удаляем его
      const container = document.getElementById('loadingContainer');
      if (container && container.children.length === 0) {
        container.remove();
      }
    }, 300);
  }

  /** Показывает/обновляет прогресс-бар. Возвращает ID загрузчика. */
  export function showProgress(current, total, message = null, id = null) {
    const loaderId = id || `progress_${Date.now()}_${++loaderCounter}`;
    const percentage = total > 0 ? Math.round((current / total) * 100) : 0;

    let loader = activeLoaders.get(loaderId);

    if (!loader) {
      // Создаем новый прогресс-бар
      let container = document.getElementById('loadingContainer');
      if (!container) {
        container = document.createElement('div');
        container.id = 'loadingContainer';
        container.className = 'loading-container';
        document.body.appendChild(container);
      }

      const progressEl = document.createElement('div');
      progressEl.className = 'loading-progress-wrapper';
      progressEl.id = `loader_${loaderId}`;
      progressEl.setAttribute('data-loader-id', loaderId);

      progressEl.innerHTML = `
        <div class="loading-progress">
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${percentage}%"></div>
          </div>
          <div class="progress-text">${percentage}%</div>
        </div>
        ${message ? `<div class="loading-message">${message}</div>` : ''}
      `;

      container.appendChild(progressEl);

      // Восстанавливаем размытие фона при показе индикатора
      container.style.backdropFilter = '';
      container.style.webkitBackdropFilter = '';
      container.style.background = '';

      requestAnimationFrame(() => {
        progressEl.classList.add('visible');
      });

      loader = {
        element: progressEl,
        progressFill: progressEl.querySelector('.progress-fill'),
        progressText: progressEl.querySelector('.progress-text'),
        messageEl: progressEl.querySelector('.loading-message'),
        container: container
      };

      activeLoaders.set(loaderId, loader);
    } else {
      // Обновляем существующий прогресс-бар
      if (loader.progressFill) {
        loader.progressFill.style.width = `${percentage}%`;
      }
      if (loader.progressText) {
        loader.progressText.textContent = `${percentage}%`;
      }
      if (message && loader.messageEl) {
        loader.messageEl.textContent = message;
      }
    }

    return loaderId;
  }

  /** Обновляет сообщение загрузчика */
  export function updateMessage(id, message) {
    const loader = activeLoaders.get(id);
    if (loader && loader.messageEl) {
      loader.messageEl.textContent = message;
    }
  }

  const LoadingManager = { show, hide, showProgress, updateMessage };
  if (typeof window !== 'undefined') window.LoadingManager = LoadingManager;
  export default LoadingManager;
