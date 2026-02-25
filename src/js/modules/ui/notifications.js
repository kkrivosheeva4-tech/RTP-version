// notifications.js — ES module
// Система уведомлений для отслеживания изменений в технологиях

import { escapeHtml as escapeHtmlUtil } from '../core/escape-utils.js';
import Logger from '../core/logger.js';


  const STORAGE_KEY = 'tech_notifications';
  const MAX_NOTIFICATIONS = 100; // Максимальное количество уведомлений

  // Типы уведомлений
  const NOTIFICATION_TYPES = {
    ADD: 'add',
    EDIT: 'edit',
    DELETE: 'delete'
  };

  /**
   * Получить все уведомления из localStorage
   */
  function getNotifications() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      Logger.warn('Ошибка при чтении уведомлений из localStorage', e);
    }
    return [];
  }

  /**
   * Сохранить уведомления в localStorage
   */
  function saveNotifications(notifications) {
    try {
      // Ограничиваем количество уведомлений
      const limited = notifications.slice(-MAX_NOTIFICATIONS);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(limited));
      return limited;
    } catch (e) {
      Logger.warn('Ошибка при сохранении уведомлений в localStorage', e);
      return notifications;
    }
  }

  /**
   * Получить SVG иконку для типа уведомления
   */
  function getNotificationIconSVG(type) {
    switch (type) {
      case NOTIFICATION_TYPES.ADD:
        return '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 4V16M4 10H16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      case NOTIFICATION_TYPES.EDIT:
        return '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M11.333 2.667a1.414 1.414 0 0 1 2 2L5.333 12.667 2 13.333l.667-3.333L9.333 2.667z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      case NOTIFICATION_TYPES.DELETE:
        return '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2 4h12M6 4V2.667A1.333 1.333 0 0 1 7.333 1.333h1.334A1.333 1.333 0 0 1 10 2.667V4m2 0v9.333A1.333 1.333 0 0 1 10.667 14.667H5.333A1.333 1.333 0 0 1 4 13.333V4h10zM6.667 7.333v4M9.333 7.333v4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      default:
        return '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 2C5.582 2 2 5.582 2 10s3.582 8 8 8 8-3.582 8-8-3.582-8-8-8zm0 14c-3.314 0-6-2.686-6-6s2.686-6 6-6 6 2.686 6 6-2.686 6-6 6z" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>';
    }
  }

  /**
   * Добавить новое уведомление
   * @param {string} type - Тип уведомления (ADD, EDIT, DELETE)
   * @param {string} techName - Название технологии
   * @param {string|number} techId - ID технологии
   * @param {Object} details - Дополнительные данные (companies, changedFields, oldTech)
   */
  function addNotification(type, techName, techId, details = {}) {
    try {
      // Убеждаемся, что модуль инициализирован
      const panel = document.getElementById('notificationsPanel');
      if (!panel) {
        initNotifications();
      }

      const notifications = getNotifications();
      const timestamp = new Date().toISOString();

      let message = '';

      switch (type) {
        case NOTIFICATION_TYPES.ADD:
          message = `Добавлена технология: ${techName}`;
          break;
        case NOTIFICATION_TYPES.EDIT:
          message = `Отредактирована технология: ${techName}`;
          break;
        case NOTIFICATION_TYPES.DELETE:
          message = `Удалена технология: ${techName}`;
          break;
        default:
          message = `Изменение в технологии: ${techName}`;
      }

      const notification = {
        id: Date.now() + Math.random(),
        type: type,
        message: message,
        techName: techName || 'Неизвестная технология',
        techId: techId,
        timestamp: timestamp,
        read: false,
        // Дополнительные данные для подробного просмотра
        companies: details.companies || [],
        changedFields: details.changedFields || {},
        oldTech: details.oldTech || null
      };

      notifications.push(notification);
      const saved = saveNotifications(notifications);

      // Логируем для отладки
      // Уведомление добавлено в localStorage
      Logger.info('Уведомление добавлено:', notification);

      // Обновляем UI немедленно и с задержкой для надежности
      updateNotificationUI();
      setTimeout(() => {
        updateNotificationUI();
      }, 100);
      setTimeout(() => {
        updateNotificationUI();
      }, 500);

      return notification;
    } catch (error) {
      Logger.error('Ошибка при добавлении уведомления:', error);
      // Ошибка при добавлении уведомления
      return null;
    }
  }

  /**
   * Отметить уведомление как прочитанное
   */
  function markAsRead(notificationId) {
    const notifications = getNotifications();
    const notification = notifications.find(n => n.id === notificationId);
    if (notification) {
      notification.read = true;
      saveNotifications(notifications);
      updateNotificationUI();
    }
  }

  /**
   * Отметить все уведомления как прочитанные
   */
  function markAllAsRead() {
    const notifications = getNotifications();
    notifications.forEach(n => n.read = true);
    saveNotifications(notifications);
    updateNotificationUI();
  }

  /**
   * Удалить уведомление
   */
  function removeNotification(notificationId) {
    const notifications = getNotifications();
    const filtered = notifications.filter(n => n.id !== notificationId);
    saveNotifications(filtered);
    updateNotificationUI();
  }

  /**
   * Показать модальное окно подтверждения очистки уведомлений
   */
  function showClearConfirmModal(onConfirm) {
    // Создаем модальное окно, если его еще нет
    let modal = document.getElementById('clearNotificationsConfirmModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'clearNotificationsConfirmModal';
      modal.className = 'clear-notifications-confirm-modal';
      modal.innerHTML = `
        <div class="clear-notifications-overlay"></div>
        <div class="clear-notifications-content">
          <div class="clear-notifications-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14zM10 11v6M14 11v6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <h3 class="clear-notifications-title">Очистить все?</h3>
          <p class="clear-notifications-message">Все уведомления будут удалены</p>
          <div class="clear-notifications-actions">
            <button class="clear-notifications-btn clear-notifications-btn-cancel" data-action="cancel">
              Отмена
            </button>
            <button class="clear-notifications-btn clear-notifications-btn-confirm" data-action="confirm">
              Очистить
            </button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);

      // Обработчики закрытия
      const overlay = modal.querySelector('.clear-notifications-overlay');
      const cancelBtn = modal.querySelector('[data-action="cancel"]');
      const confirmBtn = modal.querySelector('[data-action="confirm"]');

      const closeModal = () => {
        // Деактивируем focus trap
        if (window.FocusTrap && typeof window.FocusTrap.release === 'function') {
          window.FocusTrap.release();
        }

        // Удаляем обработчик Escape
        if (modal._handleEscape) {
          document.removeEventListener('keydown', modal._handleEscape);
        }

        modal.classList.remove('active');
        setTimeout(() => {
          modal.style.display = 'none';
        }, 200);
      };

      overlay.onclick = closeModal;
      cancelBtn.onclick = closeModal;

      confirmBtn.onclick = (e) => {
        e.stopPropagation();
        closeModal();
        if (typeof onConfirm === 'function') {
          setTimeout(() => {
            onConfirm();
          }, 100);
        }
      };

      // Закрытие по Escape
      const handleEscape = (e) => {
        if (e.key === 'Escape' && modal.classList.contains('active')) {
          closeModal();
        }
      };
      modal._handleEscape = handleEscape;
    }

    // Позиционируем окно относительно панели уведомлений
    const panel = document.getElementById('notificationsPanel');
    const content = modal.querySelector('.clear-notifications-content');
    if (panel && content) {
      const panelRect = panel.getBoundingClientRect();
      const contentWidth = 280;
      const spacing = 12;

      // Пытаемся разместить справа от панели
      const rightPosition = panelRect.right + spacing;
      if (rightPosition + contentWidth + 20 <= window.innerWidth) {
        content.style.left = `${rightPosition}px`;
        content.style.right = 'auto';
        content.style.top = `${panelRect.top}px`;
      } else {
        // Если справа не помещается, размещаем слева
        const leftPosition = panelRect.left - contentWidth - spacing;
        if (leftPosition >= 20) {
          content.style.left = `${leftPosition}px`;
          content.style.right = 'auto';
          content.style.top = `${panelRect.top}px`;
        } else {
          // Если не помещается ни справа, ни слева, размещаем над панелью по правому краю
          content.style.right = `${window.innerWidth - panelRect.right}px`;
          content.style.left = 'auto';
          content.style.top = `${Math.max(20, panelRect.top - 180)}px`;
        }
      }
    } else if (content) {
      // Если панель не найдена, размещаем в правом верхнем углу
      content.style.right = '20px';
      content.style.left = 'auto';
      content.style.top = '80px';
    }

    // Показываем модальное окно
    modal.style.display = 'block';
    requestAnimationFrame(() => {
      modal.classList.add('active');
      document.addEventListener('keydown', modal._handleEscape);

      // Активируем focus trap
      if (window.FocusTrap && typeof window.FocusTrap.trap === 'function') {
        setTimeout(() => {
          window.FocusTrap.trap(modal);
        }, 50);
      }
    });
  }

  /**
   * Удалить все уведомления
   */
  function clearAllNotifications() {
    saveNotifications([]);
    updateNotificationUI();
  }

  /**
   * Получить количество непрочитанных уведомлений
   */
  function getUnreadCount() {
    const notifications = getNotifications();
    return notifications.filter(n => !n.read).length;
  }

  /**
   * Форматировать дату для отображения
   */
  function formatDate(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;

    // Меньше минуты
    if (diff < 60000) {
      return 'только что';
    }

    // Меньше часа
    if (diff < 3600000) {
      const minutes = Math.floor(diff / 60000);
      return `${minutes} ${minutes === 1 ? 'минуту' : minutes < 5 ? 'минуты' : 'минут'} назад`;
    }

    // Сегодня
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    }

    // Вчера
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return `вчера в ${date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
    }

    // Старше
    return date.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * Показать модальное окно с подробной информацией об уведомлении
   */
  function showNotificationDetails(notification) {
    // Создаем модальное окно, если его еще нет
    let modal = document.getElementById('notificationDetailsModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'notificationDetailsModal';
      modal.className = 'notification-details-modal';
      modal.innerHTML = `
        <div class="notification-details-overlay"></div>
        <div class="notification-details-content">
          <div class="notification-details-header">
            <h3>Подробности уведомления</h3>
            <button class="notification-details-close" aria-label="Закрыть">&times;</button>
          </div>
          <div class="notification-details-body"></div>
        </div>
      `;
      document.body.appendChild(modal);

      // Обработчик закрытия
      const closeBtn = modal.querySelector('.notification-details-close');
      const overlay = modal.querySelector('.notification-details-overlay');
      const closeModal = () => {
        modal.classList.remove('active');
        // НЕ закрываем панель уведомлений и НЕ сбрасываем зум сектора
      };
      closeBtn.onclick = (e) => {
        e.stopPropagation();
        closeModal();
      };
      overlay.onclick = (e) => {
        e.stopPropagation();
        closeModal();
      };
    }

    const body = modal.querySelector('.notification-details-body');
    let content = '';

    // Формируем контент в зависимости от типа уведомления
    switch (notification.type) {
      case NOTIFICATION_TYPES.ADD:
        content = `
          <div class="notification-detail-section">
            <h4>Технология добавлена</h4>
            <p><strong>Название:</strong> ${escapeHtml(notification.techName)}</p>
            ${notification.companies && notification.companies.length > 0 ? `
              <p><strong>Добавлена в предприятия:</strong></p>
              <ul>
                ${notification.companies.map(c => `<li>${escapeHtml(c)}</li>`).join('')}
              </ul>
            ` : '<p><em>Предприятия не указаны</em></p>'}
          </div>
        `;
        break;

      case NOTIFICATION_TYPES.EDIT:
        const changedFields = notification.changedFields || {};
        const fieldsList = Object.keys(changedFields);
        content = `
          <div class="notification-detail-section">
            <h4>Технология отредактирована</h4>
            <p><strong>Название:</strong> ${escapeHtml(notification.techName)}</p>
            ${fieldsList.length > 0 ? `
              <p><strong>Измененные поля:</strong></p>
              <ul class="changed-fields-list">
                ${fieldsList.map(field => {
                  const change = changedFields[field];
                  const oldVal = formatFieldValue(change.old, field);
                  const newVal = formatFieldValue(change.new, field);

                  return `<li>
                    <strong>${escapeHtml(getFieldDisplayName(field))}:</strong><br>
                    <span class="old-value">Было: ${escapeHtml(oldVal)}</span><br>
                    <span class="new-value">Стало: ${escapeHtml(newVal)}</span>
                  </li>`;
                }).join('')}
              </ul>
            ` : '<p><em>Детали изменений не сохранены</em></p>'}
          </div>
        `;
        break;

      case NOTIFICATION_TYPES.DELETE:
        const oldTech = notification.oldTech || {};
        const oldCompanies = oldTech.company ?
          (Array.isArray(oldTech.company) ? oldTech.company : [oldTech.company]) : [];
        content = `
          <div class="notification-detail-section">
            <h4>Технология удалена</h4>
            <p><strong>Название:</strong> ${escapeHtml(notification.techName)}</p>
            ${oldCompanies.length > 0 ? `
              <p><strong>Удалена из предприятий:</strong></p>
              <ul>
                ${oldCompanies.map(c => `<li>${escapeHtml(c)}</li>`).join('')}
              </ul>
            ` : '<p><em>Информация о предприятиях не сохранена</em></p>'}
          </div>
        `;
        break;

      default:
        content = `<div class="notification-detail-section"><p>${escapeHtml(notification.message)}</p></div>`;
    }

    body.innerHTML = content;
    modal.classList.add('active');
  }

  /**
   * Получить отображаемое имя поля
   */
  function getFieldDisplayName(field) {
    const fieldNames = {
      'name': 'Название',
      'description': 'Описание',
      'block': 'Блок',
      'blocks': 'Блоки',
      'status': 'Статус',
      'level': 'Уровень',
      'direction': 'Направление',
      'directions': 'Направления',
      'company': 'Предприятие',
      'companies': 'Предприятия',
      'trlStage': 'Стадия TRL',
      'funcCover': 'Покрытие функций',
      'techRead': 'Технологическая готовность',
      'organRead': 'Организационная готовность',
      'isImplemented': 'Внедрена',
      'holdingWide': 'Холдинговое',
      'companyRatings': 'Оценки по предприятиям',
      'vendors': 'Вендоры',
      'files': 'Файлы'
    };
    return fieldNames[field] || field;
  }

  /**
   * Форматировать значение поля для отображения
   */
  function formatFieldValue(value, fieldName) {
    if (value === null || value === undefined) {
      return '—';
    }

    // Специальная обработка для companyRatings
    if (fieldName === 'companyRatings' && typeof value === 'object') {
      const companies = Object.keys(value);
      if (companies.length === 0) {
        return 'Нет оценок';
      }
      return companies.map(company => {
        const ratings = value[company];
        const parts = [];
        if (ratings.techRead !== undefined && ratings.techRead !== null) {
          parts.push(`Техн. готовность: ${ratings.techRead}`);
        }
        if (ratings.organRead !== undefined && ratings.organRead !== null) {
          parts.push(`Орг. готовность: ${ratings.organRead}`);
        }
        if (ratings.isImplemented !== undefined) {
          parts.push(`Внедрена: ${ratings.isImplemented ? 'Да' : 'Нет'}`);
        }
        return `${company}: ${parts.join(', ')}`;
      }).join('; ');
    }

    // Специальная обработка для vendors (вендоры с интеграторами)
    if (fieldName === 'vendors' && Array.isArray(value)) {
      if (value.length === 0) {
        return 'Вендоры не указаны';
      }
      return value.map(vendor => {
        const vendorName = (vendor && typeof vendor === 'object') ? (vendor.name || vendor.id || '') : String(vendor || '');
        const integrators = (vendor && typeof vendor === 'object' && Array.isArray(vendor.integrators))
          ? vendor.integrators.map(i => (i && typeof i === 'object') ? (i.name || i.id || '') : String(i || '')).filter(Boolean)
          : [];
        if (integrators.length > 0) {
          return `${vendorName} (интеграторы: ${integrators.join(', ')})`;
        }
        return vendorName;
      }).join('; ');
    }

    // Специальная обработка для files (файлы)
    if (fieldName === 'files' && Array.isArray(value)) {
      if (value.length === 0) {
        return 'Файлы не прикреплены';
      }
      return value.map(file => {
        const fileName = (file && typeof file === 'object') ? (file.name || 'Без названия') : String(file || '');
        return fileName;
      }).join(', ');
    }

    // Обычная обработка
    if (Array.isArray(value)) {
      return value.length > 0 ? value.join(', ') : 'Пусто';
    }
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return String(value);
  }

  function escapeHtml(text) {
    return escapeHtmlUtil(text);
  }

  /**
   * Создать элемент уведомления
   */
  function createNotificationElement(notification) {
    const item = document.createElement('div');
    item.className = `notification-item ${notification.read ? 'read' : 'unread'}`;
    item.dataset.notificationId = notification.id;

    const icon = document.createElement('div');
    icon.className = 'notification-icon';
    icon.innerHTML = getNotificationIconSVG(notification.type);

    const content = document.createElement('div');
    content.className = 'notification-content';

    const message = document.createElement('div');
    message.className = 'notification-message';
    message.textContent = notification.message;

    const time = document.createElement('div');
    time.className = 'notification-time';
    time.textContent = formatDate(notification.timestamp);

    content.appendChild(message);
    content.appendChild(time);

    // Кнопка "Подробнее"
    const detailsBtn = document.createElement('button');
    detailsBtn.className = 'notification-details-btn';
    detailsBtn.setAttribute('aria-label', 'Подробнее');
    detailsBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8 2C4.5 2 1.73 4.11 1 7c.73 2.89 3.5 5 7 5s6.27-2.11 7-5c-.73-2.89-3.5-5-7-5zM8 11.5c-2.49 0-4.5-2.01-4.5-4.5S5.51 2.5 8 2.5s4.5 2.01 4.5 4.5-2.01 4.5-4.5 4.5z" stroke="currentColor" stroke-width="1.5" fill="none"/><circle cx="8" cy="7" r="1.5" fill="currentColor"/></svg>';
    detailsBtn.onclick = (e) => {
      e.stopPropagation();
      showNotificationDetails(notification);
    };

    const removeBtn = document.createElement('button');
    removeBtn.className = 'notification-remove';
    removeBtn.setAttribute('aria-label', 'Удалить уведомление');
    removeBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 4L4 12M4 4L12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    removeBtn.onclick = (e) => {
      e.stopPropagation();
      removeNotification(notification.id);
    };

    const actions = document.createElement('div');
    actions.className = 'notification-actions';
    actions.appendChild(detailsBtn);
    actions.appendChild(removeBtn);

    item.appendChild(icon);
    item.appendChild(content);
    item.appendChild(actions);

    // При клике на уведомление отмечаем его как прочитанное (но не закрываем)
    item.onclick = (e) => {
      e.stopPropagation(); // Предотвращаем всплытие события, чтобы не закрывалась панель
      // Не обрабатываем клик, если кликнули на кнопки
      if (e.target.closest('.notification-actions')) {
        return;
      }
      if (!notification.read) {
        markAsRead(notification.id);
      }
    };

    return item;
  }

  /**
   * Обновить UI уведомлений
   */
  function updateNotificationUI() {
    try {
      const bellBtn = document.getElementById('notificationsBtn');
      const badge = document.getElementById('notificationsBadge');
      const panel = document.getElementById('notificationsPanel');

      if (!bellBtn) {
        // Если кнопка еще не создана, инициализируем
        if (!panel) {
          initNotifications();
        }
        return;
      }

      const unreadCount = getUnreadCount();
      const notifications = getNotifications();

      // Обновление UI уведомлений

      // Обновляем badge
      if (badge) {
        if (unreadCount > 0) {
          badge.textContent = unreadCount > 99 ? '99+' : unreadCount.toString();
          badge.classList.add('has-notifications');
        } else {
          badge.textContent = '';
          badge.classList.remove('has-notifications');
        }
      }

      // Обновляем панель уведомлений
      if (panel) {
        const list = panel.querySelector('.notifications-list');
        const emptyState = panel.querySelector('.notifications-empty');

        if (list) {
          list.innerHTML = '';

          if (notifications.length === 0) {
            if (emptyState) {
              emptyState.style.display = 'block';
            }
            list.style.display = 'none';
          } else {
            if (emptyState) {
              emptyState.style.display = 'none';
            }
            list.style.display = 'block';

            // Показываем уведомления в обратном порядке (новые сверху)
            const reversed = [...notifications].reverse();
            reversed.forEach(notification => {
              list.appendChild(createNotificationElement(notification));
            });
          }
        }
      }
    } catch (error) {
      // Ошибка при обновлении UI уведомлений
      Logger.error('Ошибка при обновлении UI уведомлений:', error);
    }
  }

  /**
   * Инициализация системы уведомлений
   */
  function initNotifications() {
    // Создаем панель уведомлений, если её нет
    let panel = document.getElementById('notificationsPanel');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'notificationsPanel';
      panel.className = 'notifications-panel';
      panel.setAttribute('aria-label', 'Панель уведомлений');
      panel.setAttribute('aria-hidden', 'true');

      const header = document.createElement('div');
      header.className = 'notifications-header';

      const title = document.createElement('h3');
      title.textContent = 'Уведомления';

      // Кнопка закрытия панели уведомлений
      const closeBtn = document.createElement('button');
      closeBtn.className = 'notifications-close-btn';
      closeBtn.setAttribute('aria-label', 'Закрыть панель уведомлений');
      closeBtn.setAttribute('data-tooltip', 'Закрыть');
      closeBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M15 5L5 15M5 5L15 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      closeBtn.onclick = (e) => {
        e.stopPropagation();
        panel.setAttribute('aria-hidden', 'true');
        panel.classList.remove('active');
        // Убираем активное состояние кнопки колокольчика
        const bellBtn = document.getElementById('notificationsBtn');
        if (bellBtn) {
          bellBtn.classList.remove('active');
        }
      };

      const actions = document.createElement('div');
      actions.className = 'notifications-actions';

      const markAllReadBtn = document.createElement('button');
      markAllReadBtn.className = 'notifications-action-btn';
      markAllReadBtn.setAttribute('data-tooltip', 'Отметить все как прочитанные');
      markAllReadBtn.setAttribute('aria-label', 'Отметить все как прочитанные');
      markAllReadBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M16.667 5L7.5 14.167 3.333 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      markAllReadBtn.onclick = () => markAllAsRead();

      const clearAllBtn = document.createElement('button');
      clearAllBtn.className = 'notifications-action-btn';
      clearAllBtn.setAttribute('data-tooltip', 'Очистить все');
      clearAllBtn.setAttribute('aria-label', 'Очистить все');
      clearAllBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2 4h12M6 4V2.667A1.333 1.333 0 0 1 7.333 1.333h1.334A1.333 1.333 0 0 1 10 2.667V4m2 0v9.333A1.333 1.333 0 0 1 10.667 14.667H5.333A1.333 1.333 0 0 1 4 13.333V4h10zM6.667 7.333v4M9.333 7.333v4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      clearAllBtn.onclick = () => {
        showClearConfirmModal(() => {
          clearAllNotifications();
        });
      };

      actions.appendChild(markAllReadBtn);
      actions.appendChild(clearAllBtn);

      header.appendChild(title);
      header.appendChild(actions);
      header.appendChild(closeBtn);

      // Инициализируем tooltip для кнопок действий, если система tooltip доступна
      // Tooltip автоматически обрабатывается через script.js для элементов с data-tooltip

      const list = document.createElement('div');
      list.className = 'notifications-list';

      const emptyState = document.createElement('div');
      emptyState.className = 'notifications-empty';
      emptyState.innerHTML = '<p>Нет уведомлений</p>';

      panel.appendChild(header);
      panel.appendChild(list);
      panel.appendChild(emptyState);

      document.body.appendChild(panel);
    }

    /**
     * Позиционирует панель уведомлений по центру под кнопкой колокольчика
     */
    function positionPanel() {
      const bellBtn = document.getElementById('notificationsBtn');
      if (!bellBtn || !panel) return;

      const bellRect = bellBtn.getBoundingClientRect();
      const padding = 10; // Отступ от кнопки
      const margin = 20; // Минимальный отступ от края экрана

      // Получаем размеры панели (может потребоваться пересчет после изменения стилей)
      const panelRect = panel.getBoundingClientRect();
      const panelWidth = panelRect.width || 400; // Fallback на ширину по умолчанию

      // Позиционируем панель по центру под кнопкой
      const top = bellRect.bottom + padding;
      let left = bellRect.left + (bellRect.width / 2) - (panelWidth / 2);

      // Проверяем, не выходит ли панель за пределы экрана
      if (left < margin) {
        left = margin;
      } else if (left + panelWidth > window.innerWidth - margin) {
        left = window.innerWidth - panelWidth - margin;
      }

      // На мобильных устройствах центрируем относительно кнопки, но не выходим за границы
      if (window.innerWidth <= 768) {
        // На мобильных устройствах панель может быть шире, чем кнопка
        // Центрируем относительно кнопки, но с учетом границ экрана
        left = Math.max(margin, Math.min(
          bellRect.left + (bellRect.width / 2) - (panelWidth / 2),
          window.innerWidth - panelWidth - margin
        ));
      }

      panel.style.top = `${top}px`;
      panel.style.left = `${left}px`;
      panel.style.right = 'auto'; // Сбрасываем right, если он был установлен
    }

    // Инициализируем кнопку колокольчика
    const bellBtn = document.getElementById('notificationsBtn');
    if (bellBtn) {
      // Функция для обновления состояния активности кнопки
      const updateButtonState = (isActive) => {
        if (isActive) {
          bellBtn.classList.add('active');
        } else {
          bellBtn.classList.remove('active');
        }
      };

      bellBtn.onclick = (e) => {
        e.stopPropagation();
        const isOpen = panel.getAttribute('aria-hidden') === 'false';
        panel.setAttribute('aria-hidden', isOpen ? 'true' : 'false');
        panel.classList.toggle('active', !isOpen);

        // Обновляем состояние кнопки
        updateButtonState(!isOpen);

        // Позиционируем панель при открытии
        if (!isOpen) {
          // Используем requestAnimationFrame для корректного расчета размеров после применения стилей
          requestAnimationFrame(() => {
            positionPanel();
            // Дополнительный вызов после следующего кадра для точного позиционирования
            requestAnimationFrame(() => {
              positionPanel();
            });
          });
        }

        // Закрываем при клике вне панели
        if (!isOpen) {
          setTimeout(() => {
            const closeOnOutsideClick = (event) => {
              // Не закрываем панель, если кликнули на модальное окно подробностей уведомлений
              if (event.target.closest('#notificationDetailsModal') ||
                  event.target.closest('.notification-details-modal')) {
                return;
              }
              // Не закрываем панель, если кликнули на переключатель темы
              if (event.target.closest("#themeToggle") || event.target.id === "themeToggle" ||
                  event.target.closest("label[for='themeToggle']") ||
                  event.target.closest(".theme-switch") ||
                  event.target.closest(".theme-toggle-wrapper")) {
                return;
              }
              // Не закрываем панель, если кликнули на элемент внутри панели (включая уведомления)
              if (panel.contains(event.target) || event.target === bellBtn) {
                return;
              }
              // Закрываем панель только при клике вне панели
              panel.setAttribute('aria-hidden', 'true');
              panel.classList.remove('active');
              updateButtonState(false);
              document.removeEventListener('click', closeOnOutsideClick);
            };
            setTimeout(() => document.addEventListener('click', closeOnOutsideClick), 0);
          }, 0);
        }
      };
    }

    // Обновляем позицию при изменении размера окна
    let resizeTimeout;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        if (panel && panel.classList.contains('active')) {
          positionPanel();
        }
      }, 100);
    });

    // Обновляем UI при загрузке
    updateNotificationUI();

    Notifications._initialized = true;
  }

  const Notifications = {
    add: addNotification,
    markAsRead: markAsRead,
    markAllAsRead: markAllAsRead,
    remove: removeNotification,
    clearAll: clearAllNotifications,
    getUnreadCount: getUnreadCount,
    getNotifications: getNotifications,
    updateUI: updateNotificationUI,
    init: initNotifications,
    TYPES: NOTIFICATION_TYPES,
    _initialized: false
  };

  if (typeof window !== 'undefined') window.Notifications = Notifications;

  function delayedInit() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        setTimeout(initNotifications, 100);
      });
    } else {
      setTimeout(initNotifications, 100);
    }
  }

  // Инициализируем сразу, если DOM готов, иначе ждем
  delayedInit();

  if (typeof window !== 'undefined' && window.addEventListener) {
    window.addEventListener('load', () => {
      if (!document.getElementById('notificationsPanel')) initNotifications();
      updateNotificationUI();
    });
  }

  export default Notifications;
