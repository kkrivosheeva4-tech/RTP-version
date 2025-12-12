// Управление авторизацией (для auth.html)
const authPage = document.getElementById('auth-page');
const loginForm = document.getElementById('loginForm');
// Пользователи системы
let users = [
    { username: 'admin', password: 'admin123', role: 'admin' },
    { username: 'architect', password: 'architect123', role: 'architect' },
    { username: 'guest', password: 'guest123', role: 'guest' }
];

// Проверка состояния авторизации при загрузке
document.addEventListener('DOMContentLoaded', function() {
    // Проверяем, не авторизован ли пользователь уже
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    const savedUsername = localStorage.getItem('username');
    if (isLoggedIn && savedUsername) {
        const user = users.find(u => u.username === savedUsername);
        if (user) {
            // Если пользователь уже авторизован, перенаправляем его на основное приложение
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

    // Инициализация темы + переключатель
    (function themeInit() {
        const root = document.documentElement;
        const saved = localStorage.getItem('theme');
        const systemDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        const theme = saved || (systemDark ? 'dark' : 'light');
        root.setAttribute('data-theme', theme);
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
            const root = document.documentElement;
            const current = root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
            const next = current === 'dark' ? 'light' : 'dark';
            root.setAttribute('data-theme', next);
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
});

// Обработка формы входа
loginForm.addEventListener('submit', function(e) {
    e.preventDefault();
    if (loginForm && !loginForm.checkValidity()) {
        loginForm.reportValidity();
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

    const user = users.find(u => u.username === username && u.password === password);
    if (user) {
        localStorage.setItem('isLoggedIn', 'true');
        localStorage.setItem('username', username);
        localStorage.setItem('role', user.role);

        // После успешной авторизации перенаправляем на основное приложение
        window.location.href = 'index.html';
    } else {
        if (submitBtn) {
            submitBtn.classList.remove('loading');
            submitBtn.removeAttribute('disabled');
        }
        showNotification('Неверное имя пользователя или пароль', 'error');
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
