# 🚀 Запуск проекта без Node.js

Этот проект может работать **полностью без Node.js**! Все зависимости загружаются через CDN (Content Delivery Network), а данные хранятся в JSON файлах.

## 📋 Быстрый старт

### Вариант 1: Автоматический запуск (Windows)

1. Дважды кликните на файл `start-server.bat`
2. Выберите способ запуска (рекомендуется Python)
3. Откройте браузер и перейдите на `http://localhost:8000`

### Вариант 2: Автоматический запуск (Linux/Mac)

1. Откройте терминал в папке проекта
2. Выполните:
   ```bash
   chmod +x start-server.sh
   ./start-server.sh
   ```
3. Выберите способ запуска
4. Откройте браузер и перейдите на `http://localhost:8000`

### Вариант 3: Ручной запуск

#### Python (рекомендуется)

**Windows:**
```bash
python -m http.server 8000
```

**Linux/Mac:**
```bash
python3 -m http.server 8000
```

#### PHP

```bash
php -S localhost:8000
```

#### PowerShell (только Windows)

```powershell
# Запустите PowerShell в папке проекта и выполните:
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add('http://localhost:8000/')
$listener.Start()
Write-Host 'Сервер запущен на http://localhost:8000' -ForegroundColor Green

while ($listener.IsListening) {
    $context = $listener.GetContext()
    $request = $context.Request
    $response = $context.Response

    $localPath = $request.Url.LocalPath
    if ($localPath -eq '/') { $localPath = '/index.html' }

    $filePath = Join-Path $PWD $localPath.TrimStart('/')

    if (Test-Path $filePath -PathType Leaf) {
        $content = [System.IO.File]::ReadAllBytes($filePath)
        $response.ContentLength64 = $content.Length
        $response.ContentType = [System.Web.MimeMapping]::GetMimeMapping($filePath)
        $response.OutputStream.Write($content, 0, $content.Length)
    } else {
        $response.StatusCode = 404
        $buffer = [System.Text.Encoding]::UTF8.GetBytes('404 Not Found')
        $response.ContentLength64 = $buffer.Length
        $response.OutputStream.Write($buffer, 0, $buffer.Length)
    }

    $response.Close()
}
```

## ⚠️ Важно!

**НЕ открывайте HTML файлы напрямую** (двойным кликом), так как:
- Браузер блокирует загрузку JSON файлов из-за политики безопасности CORS
- Некоторые функции могут не работать

**Всегда используйте локальный веб-сервер!**

## 📦 Что не требуется

- ❌ Node.js
- ❌ npm
- ❌ Установка зависимостей
- ❌ node_modules

## ✅ Что используется

- ✅ CDN для всех библиотек (jsPDF, html2canvas, Chart.js)
- ✅ JSON файлы для данных
- ✅ LocalStorage для хранения настроек
- ✅ Обычный веб-сервер (Python/PHP/PowerShell)

## 🔧 Используемые CDN библиотеки

Проект автоматически загружает следующие библиотеки через CDN:

- **jsPDF** (v2.5.1) - для экспорта в PDF
- **jsPDF AutoTable** (v3.5.28) - для таблиц в PDF
- **html2canvas** (v1.4.1) - для конвертации HTML в изображения
- **Chart.js** - для графиков (только на странице аналитики)

## 📁 Структура данных

Все данные хранятся в папке `data/ru/`:
- `enterpriseData.json` - данные о технологиях
- `bloks.json` - функциональные блоки
- `functions.json` - функции
- `blockToQuadrant.json` - соответствие блоков квадрантам
- `functionToBlock.json` - соответствие функций блокам
- `sector.json` - секторы
- `status.json` - статусы
- `techTypes.json` - типы технологий

## 🌐 Требования к браузеру

- Современный браузер (Chrome, Firefox, Edge, Safari)
- Подключение к интернету (для загрузки CDN библиотек)
- JavaScript включен

## 🐛 Решение проблем

### Проблема: "Не загружаются данные"

**Решение:**
1. Убедитесь, что вы используете локальный сервер (не открывайте файлы напрямую)
2. Проверьте, что все файлы в папке `data/ru/` на месте
3. Откройте консоль браузера (F12) и проверьте ошибки

### Проблема: "Библиотеки не загружаются"

**Решение:**
1. Проверьте подключение к интернету
2. Проверьте, что CDN доступен (откройте ссылку в браузере)
3. Попробуйте другой браузер

### Проблема: "Сервер не запускается"

**Решение:**
1. Убедитесь, что порт 8000 свободен
2. Попробуйте другой порт: `python -m http.server 8080`
3. Проверьте, что Python/PHP установлен и доступен в PATH

## 📝 Примечания

- Проект полностью работает без Node.js
- Все зависимости загружаются автоматически через CDN
- Данные хранятся локально в JSON файлах
- Для работы требуется только веб-сервер (Python/PHP/PowerShell)

---

**Готово!** Теперь вы можете запускать проект на любом компьютере без установки Node.js! 🎉
