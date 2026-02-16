// Управление авторизацией (для auth.html)
// Список пользователей для mock-входа — из единого конфига (config/roles-config.js)
function getUsers() {
    if (typeof window.RolesConfig !== 'undefined' && typeof window.RolesConfig.getUsersForMockAuth === 'function') {
        return window.RolesConfig.getUsersForMockAuth();
    }
    return [];
}

function pad2(n) {
    const v = Number(n) || 0;
    return v < 10 ? `0${v}` : String(v);
}

function getAuditTimestampLocal() {
    const d = new Date();
    const y = d.getFullYear();
    const m = pad2(d.getMonth() + 1);
    const day = pad2(d.getDate());
    const hh = pad2(d.getHours());
    const mm = pad2(d.getMinutes());
    const ss = pad2(d.getSeconds());
    return `${y}-${m}-${day} ${hh}:${mm}:${ss}`;
}

// Проверка состояния авторизации при загрузке
document.addEventListener('DOMContentLoaded', function() {
    // Проверяем, не авторизован ли пользователь уже
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    const savedUsername = localStorage.getItem('username');
    if (isLoggedIn && savedUsername) {
        const user = getUsers().find(u => u.username === savedUsername);
        if (user) {
            // Если сессия уже активна — логируем "автовход" (на случай, когда пользователь не вводит пароль повторно)
            try {
                let ok = false;
                if (typeof window.appendAdminAudit === 'function') {
                    ok = !!window.appendAdminAudit('login', `Автовход (сессия активна) (${user.role})`);
                }
                if (!ok) {
                    const key = 'adminAuditLogs';
                    const raw = localStorage.getItem(key);
                    const list = raw ? (JSON.parse(raw) || []) : [];
                    const arr = Array.isArray(list) ? list : [];
                    const now = getAuditTimestampLocal();
                    const nextId = arr.length > 0 ? (Math.max(...arr.map(x => Number(x && x.id) || 0)) + 1) : 1;
                    arr.unshift({
                        id: nextId,
                        date: now,
                        user: savedUsername,
                        action: 'login',
                        details: `Автовход (сессия активна) (${user.role})`,
                        tz: 'local',
                        ip: 'local'
                    });
                    localStorage.setItem(key, JSON.stringify(arr));
                }
            } catch (err) {
                if (window.Logger) window.Logger.warn('Ошибка при логировании автовхода:', err);
            }
            // Если пользователь уже авторизован, перенаправляем его на нужную страницу в зависимости от роли
            // Директоры и РП теперь идут на index.html, а затем выбирают предприятие для перехода на радар
            window.location.href = 'index.html';
            return; // Прерываем выполнение
        } else {
            // Если пользователь сохранен, но не найден в списке, очищаем localStorage
            localStorage.removeItem('isLoggedIn');
            localStorage.removeItem('username');
        }
    }

    // Если пользователь не авторизован, инициализируем частицы при наличии контейнера
    const particlesContainer = document.getElementById('particles');
    if (particlesContainer && typeof createParticles === 'function') {
        createParticles();
    }

    // Инициализация темы + переключатель (унифицировано с остальными страницами)
    (function themeInit() {
        const saved = localStorage.getItem('theme') || 'light';
        const systemDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        const theme = saved || (systemDark ? 'dark' : 'light');
        // Используем body.light/body.dark вместо data-theme для унификации
        document.body.classList.remove('light', 'dark');
        document.body.classList.add(theme);
        const themeToggleBtn = document.getElementById('themeToggle');
        if (themeToggleBtn) {
            themeToggleBtn.checked = theme === 'dark';
        }
        const sun = document.getElementById('iconSun');
        const moon = document.getElementById('iconMoon');
        if (sun && moon) {
            if (theme === 'dark') { sun.style.display = 'none'; moon.style.display = 'block'; }
            else { sun.style.display = 'block'; moon.style.display = 'none'; }
        }
    })();
    const themeToggleBtn = document.getElementById('themeToggle');
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            const current = document.body.classList.contains('dark') ? 'dark' : 'light';
            const next = current === 'dark' ? 'light' : 'dark';
            document.body.classList.remove('light', 'dark');
            document.body.classList.add(next);
            themeToggleBtn.checked = next === 'dark';
            localStorage.setItem('theme', next);
            const sun = document.getElementById('iconSun');
            const moon = document.getElementById('iconMoon');
            if (sun && moon) {
                if (next === 'dark') { sun.style.display = 'none'; moon.style.display = 'block'; }
                else { sun.style.display = 'block'; moon.style.display = 'none'; }
            }
        });
    }

    // Переключатель видимости пароля
    (function setupPasswordToggle() {
        const input = document.getElementById('password');
        const toggle = document.getElementById('passwordToggle');
        const eyeOn = document.getElementById('eyeOn');
        const eyeOff = document.getElementById('eyeOff');
        if (!input || !toggle || !eyeOn || !eyeOff) return;
        toggle.addEventListener('click', () => {
            const isPwd = input.type === 'password';
            input.type = isPwd ? 'text' : 'password';
            toggle.setAttribute('aria-label', isPwd ? 'Скрыть пароль' : 'Показать пароль');
            eyeOn.style.display = isPwd ? 'none' : 'block';
            eyeOff.style.display = isPwd ? 'block' : 'none';
        });
    })();

    // Обработчик кнопки "Войти как гость"
    const guestBtn = document.getElementById('guestBtn');
    if (guestBtn) {
        guestBtn.addEventListener('click', function() {
            // Логируем вход как гость (если пользователь выбирает гостевой режим)
            try {
                let ok = false;
                if (typeof window.appendAdminAudit === 'function') {
                    ok = !!window.appendAdminAudit('login', 'Вход как гость');
                }
                if (!ok) {
                    const key = 'adminAuditLogs';
                    const raw = localStorage.getItem(key);
                    const list = raw ? (JSON.parse(raw) || []) : [];
                    const arr = Array.isArray(list) ? list : [];
                    const now = getAuditTimestampLocal();
                    const nextId = arr.length > 0 ? (Math.max(...arr.map(x => Number(x && x.id) || 0)) + 1) : 1;
                    arr.unshift({
                        id: nextId,
                        date: now,
                        user: 'guest',
                        action: 'login',
                        details: 'Вход как гость',
                        tz: 'local',
                        ip: 'local'
                    });
                    localStorage.setItem(key, JSON.stringify(arr));
                }
            } catch (err) {
                if (window.Logger) window.Logger.warn('Ошибка при логировании входа гостя:', err);
            }
            // Перенаправляем на основное приложение без авторизации
            window.location.href = 'index.html';
        });
    }
    // Обработка формы входа
    const form = document.getElementById('loginForm');
    if (form) {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            if (!form.checkValidity()) {
                form.reportValidity();
                return;
            }
            const submitBtn = document.getElementById('submitBtn');
            if (submitBtn) {
                submitBtn.classList.add('loading');
                submitBtn.setAttribute('disabled', 'true');
            }

            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            const remember = document.getElementById('remember') ? document.getElementById('remember').checked : false;

            const user = getUsers().find(u => u.username === username && u.password === password);
            if (user) {
                localStorage.setItem('isLoggedIn', 'true');
                localStorage.setItem('username', username);
                localStorage.setItem('role', user.role);

                // Пишем событие входа в журнал аудита (важное действие → должно попадать на график)
                try {
                    let ok = false;
                    if (typeof window.appendAdminAudit === 'function') {
                        ok = !!window.appendAdminAudit('login', `Успешный вход в систему (${user.role})`);
                    }
                    if (!ok) {
                        // Fallback: прямое логирование в localStorage если функция недоступна (например, на auth.html)
                        const key = 'adminAuditLogs';
                        const raw = localStorage.getItem(key);
                        const list = raw ? (JSON.parse(raw) || []) : [];
                        const arr = Array.isArray(list) ? list : [];
                        const now = getAuditTimestampLocal();
                        const nextId = arr.length > 0 ? (Math.max(...arr.map(x => Number(x && x.id) || 0)) + 1) : 1;
                        arr.unshift({
                            id: nextId,
                            date: now,
                            user: username,
                            action: 'login',
                            details: `Успешный вход в систему (${user.role})`,
                            tz: 'local',
                            ip: 'local'
                        });
                        localStorage.setItem(key, JSON.stringify(arr));
                    }
                } catch (err) {
                    if (window.Logger) window.Logger.warn('Ошибка при логировании входа:', err);
                }

                // После успешной авторизации перенаправляем на нужную страницу в зависимости от роли
                // Директоры и РП теперь идут на index.html, а затем выбирают предприятие для перехода на радар
                window.location.href = 'index.html';
            } else {
                if (submitBtn) {
                    submitBtn.classList.remove('loading');
                    submitBtn.removeAttribute('disabled');
                }
                showNotification('Неверное имя пользователя или пароль', 'error');
            }
        });
    }
});

// Создание частиц
function createParticles() {
    const particlesContainer = document.getElementById('particles');
    particlesContainer.innerHTML = '';
    const particleCount = 20;
    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.classList.add('particle');
        const size = Math.random() * 10 + 5;
        const posX = Math.random() * 100;
        const duration = Math.random() * 20 + 10;
        const delay = Math.random() * 5;
        const opacity = Math.random() * 0.5 + 0.1;
        particle.style.width = `${size}px`;
        particle.style.height = `${size}px`;
        particle.style.left = `${posX}%`;
        particle.style.bottom = `-${size}px`;
        particle.style.animationDuration = `${duration}s`;
        particle.style.animationDelay = `${delay}s`;
        particle.style.opacity = opacity;
        const colors = ['#c0c0c0', '#b87333'];
        particle.style.background = colors[Math.floor(Math.random() * colors.length)];
        particlesContainer.appendChild(particle);
    }
}

// Уведомления
function showNotification(message, type) {
    // Создаем панель уведомлений если её нет
    let panel = document.getElementById('notificationPanel');
    if (!panel) {
        panel = document.createElement('div');
        panel.id = 'notificationPanel';
        panel.className = 'notification-panel';
        document.body.appendChild(panel);
    }

    // Создаем новое уведомление
    const notification = document.createElement('div');
    notification.className = 'notification ' + type;
    notification.textContent = message;

    // Добавляем в начало панели (новые уведомления сверху)
    panel.insertBefore(notification, panel.firstChild);

    // Показываем уведомление
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);

    // Автоматически скрываем через 3 секунды
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}
