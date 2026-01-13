// Модуль модальных окон
// Экспортирует функции в window.Modals для использования в RMK2.js
// Использует глобальные переменные из RMK2.js и функции из других модулей

(function() {
  'use strict';

  // Показать модальное окно
  function showModal(panelId) {
    const panel = typeof panelId === 'string' ? (window.DOMCache ? window.DOMCache.get(panelId) : document.getElementById(panelId)) : panelId;
    if (!panel) return;
    panel.style.display = 'block';
    // игнорировать внешние клики в течение короткого окна после открытия
    // Увеличим окно игнорирования до 500ms — это предотвращает моментальное закрытие
    // модалки в тех браузерах/сценариях, где глобальный document.click обрабатывается
    // после локального обработчика открытия в той же цепочке событий.
    if (typeof window.ignoreOutsideClickUntil !== 'undefined') {
      // Если время уже установлено (например, из обработчика открытия), не уменьшаем его
      const currentTime = Date.now() + 500;
      if (window.ignoreOutsideClickUntil < currentTime) {
        window.ignoreOutsideClickUntil = currentTime;
      }
    }
    // Убеждаемся, что все поля активны
    const inputs = panel.querySelectorAll('input, textarea, select, .custom-select-modal');
    inputs.forEach(input => {
      if (input.disabled) input.disabled = false;
      if (input.readOnly) input.readOnly = false;
      input.style.pointerEvents = 'auto';
      input.style.opacity = '1';
    });
    // Сделаем снимок начального состояния формы внутри панели (если есть) для dirty-check
    try {
      const form = panel.querySelector && panel.querySelector('form');
      if (form && !form.dataset.initial && typeof window.snapshotFormInitial === 'function') {
        window.snapshotFormInitial(form);
      }
    } catch (e) { /* ignore */ }
    requestAnimationFrame(() => {
      panel.classList.add('open');

      // Устанавливаем высокий z-index для панелей редактирования и удаления,
      // чтобы они были выше detail-panel (которая имеет z-index 10005)
      if (panel.id === 'editTechPanel' || panel.id === 'deleteConfirmModal') {
        panel.style.setProperty('z-index', '10006', 'important');
      }

      // Инициализация фильтрации для модального окна добавления технологии
      if (panel.id === 'addTechPanel' && typeof window.initModalFilters === 'function') {
        setTimeout(() => {
          window.initModalFilters();
        }, 100);
      }
    });
  }

  // Скрыть модальное окно
  function hideModal(panelIdOrEl) {
    const panel = typeof panelIdOrEl === 'string' ? document.getElementById(panelIdOrEl) : panelIdOrEl;
    if (!panel) return;
    panel.classList.remove('open');
    const onEnd = () => {
      panel.style.display = 'none';
      panel.removeEventListener('transitionend', onEnd);

      // Дополнительная логика сброса форм после закрытия
      if (panel.id === 'addTechPanel') {
        const DOMCache = window.DOMCache;
        if (DOMCache) {
          const addForm = DOMCache.get('addTechForm');
          if (addForm) addForm.reset();
          if (typeof window.resetCustomSelects === 'function') {
            // В addTechPanel поля имеют префикс tech* (techSector, techBlock, techFunc, ...)
            window.resetCustomSelects('tech');
          }
          const functionsContainer = DOMCache.get('functionsContainer');
          if (functionsContainer) functionsContainer.innerHTML = '';
          const companyRatingsContainer = DOMCache.get('techCompanyRatingsContainer');
          if (companyRatingsContainer) companyRatingsContainer.innerHTML = '';
          // Сбрасываем видимость полей оценок
          if (typeof window.updateTechRatingsVisibility === 'function') {
            setTimeout(() => {
              window.updateTechRatingsVisibility();
            }, 50);
          }
        }
      }
      if (panel.id === 'editTechPanel') {
        const DOMCache = window.DOMCache;
        if (DOMCache) {
          const editForm = DOMCache.get('editTechForm');
          if (editForm) editForm.reset();
          if (typeof window.resetCustomSelects === 'function') {
            window.resetCustomSelects('edit');
          }
        }
      }
      if (panel.id === 'addBlockPanel') {
        const DOMCache = window.DOMCache;
        if (DOMCache) {
          const addBlockForm = DOMCache.get('addBlockForm');
          if (addBlockForm) addBlockForm.reset();
          const functionsContainer = DOMCache.get('functionsContainer');
          if (functionsContainer) functionsContainer.innerHTML = '';
          // Сброс кастомных выпадающих списков
          const sectorSelect = DOMCache.find('.custom-select-modal[data-field="blockSector"]');
          if (sectorSelect) {
            const hiddenInput = DOMCache.get('blockSector');
            if (hiddenInput) hiddenInput.value = '';
            const selectedTextEl = sectorSelect.querySelector('.selected-text');
            if (selectedTextEl) selectedTextEl.textContent = 'Выберите';
            sectorSelect.classList.remove('open');
            sectorSelect.querySelectorAll('.select-options li').forEach(li => li.classList.remove('selected'));
          }
        }
      }
    };
    const dur = parseFloat(getComputedStyle(panel).transitionDuration) || 0;
    if (dur > 0) {
      panel.addEventListener('transitionend', onEnd);
    } else {
      setTimeout(onEnd, 220);
    }
  }

  // Показать внутреннее подтверждение
  function showInternalConfirm(message, onCloseConfirmed) {
    let confirmEl = document.getElementById('internalConfirm');
    if (!confirmEl) {
      confirmEl = document.createElement('div');
      confirmEl.id = 'internalConfirm';
      confirmEl.className = 'modal-panel confirm-panel';
      confirmEl.innerHTML = `
        <div class="modal-header"><h2>Подтвердите действие</h2></div>
        <div class="modal-body"><p class="confirm-message"></p>
          <div class="form-actions" style="margin-top:12px; display:flex; gap:8px; justify-content:flex-end">
            <button class="btn-secondary" data-action="cancel">Отмена</button>
            <button class="btn-primary" data-action="close">Закрыть</button>
          </div>
        </div>`;
      document.body.appendChild(confirmEl);
      confirmEl.querySelector('[data-action="cancel"]').addEventListener('click', () => {
        confirmEl.classList.remove('open');
        setTimeout(() => confirmEl.style.display = 'none', 220);
      });
      confirmEl.querySelector('[data-action="close"]').addEventListener('click', (ev) => {
        ev.stopPropagation();
        confirmEl.classList.remove('open');
        // Сначала скрываем окно подтверждения, затем выполняем callback и гарантированно закрываем целевую панель
        setTimeout(() => {
          confirmEl.style.display = 'none';
          try { if (typeof confirmEl._onClose === 'function') confirmEl._onClose(); } catch(e) { console.error(e); }
          try {
            const related = confirmEl._relatedPanel;
            if (related) hideModal(related);
          } catch(e) { /* ignore */ }
        }, 220);
      });
    }
    confirmEl.querySelector('.confirm-message').textContent = message;
    // store callback and related panel on element for safe later invocation
    confirmEl._onClose = onCloseConfirmed;
    confirmEl._relatedPanel = arguments[2] || null;
    confirmEl.style.display = 'block';
    requestAnimationFrame(() => confirmEl.classList.add('open'));
  }

  // Экспорт функций
  window.Modals = {
    showModal,
    hideModal,
    showInternalConfirm
  };

  // Экспорт функций в window для обратной совместимости
  window.showModal = showModal;
  window.hideModal = hideModal;
})();
