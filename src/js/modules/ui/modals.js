// Модуль модальных окон
// Экспортирует функции в window.Modals для использования в RMK2.js
// Использует глобальные переменные из RMK2.js и функции из других модулей

(function () {
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

      // Активируем focus trap
      if (window.FocusTrap && typeof window.FocusTrap.trap === 'function') {
        setTimeout(() => {
          window.FocusTrap.trap(panel);
        }, 50);
      }

      // Инициализация фильтрации для модального окна добавления технологии
      if (panel.id === 'addTechPanel' && typeof window.initModalFilters === 'function') {
        setTimeout(() => {
          window.initModalFilters();
        }, 100);
      }

      // Инициализация менеджера вкладок для формы добавления технологии
      if (panel.id === 'addTechPanel' && window.TechTabsManager && typeof window.TechTabsManager.init === 'function') {
        setTimeout(() => {
          window.TechTabsManager.init();
        }, 150);
      }

      // Инициализация менеджера вкладок для формы редактирования технологии
      if (panel.id === 'editTechPanel' && window.EditTechTabsManager && typeof window.EditTechTabsManager.init === 'function') {
        // Инициализация EditTechTabsManager для editTechPanel
        setTimeout(() => {
          window.EditTechTabsManager.init();
        }, 150);

        // Инициализация автоматического расчета покрытия функций для формы редактирования
        if (window.AutoFuncCover && typeof window.AutoFuncCover.initForEditForm === 'function') {
          setTimeout(() => {
            window.AutoFuncCover.initForEditForm();
          }, 200);
        }
      }

      // Инициализация автоматического расчета покрытия функций для формы добавления
      if (panel.id === 'addTechPanel' && window.AutoFuncCover && typeof window.AutoFuncCover.initForAddForm === 'function') {
        setTimeout(() => {
          window.AutoFuncCover.initForAddForm();
        }, 200);
      }

      // Инициализация управления файлами
      if (window.VendorsFiles) {
        if (panel.id === 'addTechPanel') {
          setTimeout(() => {
            // Инициализация управления файлами
            window.VendorsFiles.initFilesManagement('techFilesInput', 'techFilesList', false);
          }, 100);
        } else if (panel.id === 'editTechPanel') {
          setTimeout(() => {
            // Инициализация управления файлами
            if (window.VendorsFiles) {
              window.VendorsFiles.initFilesManagement('editFilesInput', 'editFilesList', true);
            }
          }, 100);
        }
      }
    });
  }

  // Скрыть модальное окно
  function hideModal(panelIdOrEl) {
    const panel = typeof panelIdOrEl === 'string' ? document.getElementById(panelIdOrEl) : panelIdOrEl;
    if (!panel) return;

    // Деактивируем focus trap перед закрытием
    if (window.FocusTrap && typeof window.FocusTrap.release === 'function') {
      window.FocusTrap.release();
    }

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
          // Сбрасываем блок «интеграторы по вендору», чтобы при следующем открытии он не показывал старый выбор
          const techVendorIntegratorsByVendor = document.getElementById('techVendorIntegratorsByVendor');
          if (techVendorIntegratorsByVendor) techVendorIntegratorsByVendor.innerHTML = '';
          const techVendorIntegratorsGroup = document.getElementById('techVendorIntegratorsGroup');
          if (techVendorIntegratorsGroup) techVendorIntegratorsGroup.style.display = 'none';
          const functionsContainer = DOMCache.get('functionsContainer');
          if (functionsContainer) functionsContainer.innerHTML = '';
          const companyRatingsContainer = DOMCache.get('techCompanyRatingsContainer');
          if (companyRatingsContainer) companyRatingsContainer.innerHTML = '';
          // Сбрасываем файлы
          const filesList = DOMCache.get('techFilesList');
          if (filesList) filesList.innerHTML = '';
          const filesInput = DOMCache.get('techFilesInput');
          if (filesInput) filesInput.value = '';
          // Сбрасываем флаг инициализации для файлового input
          if (window.VendorsFiles && typeof window.VendorsFiles.resetFileInputInitialization === 'function') {
            window.VendorsFiles.resetFileInputInitialization('techFilesInput');
          }
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
          // Сбрасываем блок «интеграторы по вендору»
          const editVendorIntegratorsByVendor = document.getElementById('editVendorIntegratorsByVendor');
          if (editVendorIntegratorsByVendor) editVendorIntegratorsByVendor.innerHTML = '';
          const editVendorIntegratorsGroup = document.getElementById('editVendorIntegratorsGroup');
          if (editVendorIntegratorsGroup) editVendorIntegratorsGroup.style.display = 'none';
          // Сбрасываем файлы
          const filesList = DOMCache.get('editFilesList');
          if (filesList) filesList.innerHTML = '';
          const filesInput = DOMCache.get('editFilesInput');
          if (filesInput) filesInput.value = '';
          // Сбрасываем флаг инициализации для файлового input
          if (window.VendorsFiles && typeof window.VendorsFiles.resetFileInputInitialization === 'function') {
            window.VendorsFiles.resetFileInputInitialization('editFilesInput');
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
          try { if (typeof confirmEl._onClose === 'function') confirmEl._onClose(); } catch (e) { console.error(e); }
          try {
            const related = confirmEl._relatedPanel;
            if (related) hideModal(related);
          } catch (e) { /* ignore */ }
        }, 220);
      });
    }
    confirmEl.querySelector('.confirm-message').textContent = message;
    // store callback and related panel on element for safe later invocation
    confirmEl._onClose = onCloseConfirmed;
    confirmEl._relatedPanel = arguments[2] || null;
    // Устанавливаем z-index выше модального окна редактирования (10006)
    confirmEl.style.setProperty('z-index', '10007', 'important');
    confirmEl.style.display = 'block';
    requestAnimationFrame(() => {
      confirmEl.classList.add('open');
      // Активируем focus trap для окна подтверждения
      if (window.FocusTrap && typeof window.FocusTrap.trap === 'function') {
        setTimeout(() => {
          window.FocusTrap.trap(confirmEl);
        }, 50);
      }
    });
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
