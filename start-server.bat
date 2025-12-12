@echo off
echo ========================================
echo   Запуск локального веб-сервера
echo ========================================
echo.
echo Выберите способ запуска:
echo 1. Python HTTP Server (рекомендуется)
echo 2. PowerShell HTTP Server
echo 3. Выход
echo.
set /p choice="Введите номер (1-3): "

if "%choice%"=="1" goto python
if "%choice%"=="2" goto powershell
if "%choice%"=="3" goto end
goto menu

:python
echo.
echo Проверка наличия Python...
python --version >nul 2>&1
if errorlevel 1 (
    echo ОШИБКА: Python не найден!
    echo Установите Python с https://www.python.org/
    pause
    goto end
)
echo Python найден!
echo.
echo Запуск сервера на http://localhost:8000
echo Нажмите Ctrl+C для остановки
echo.
python -m http.server 8000
goto end

:powershell
echo.
echo Запуск PowerShell HTTP Server...
echo Сервер будет доступен на http://localhost:8000
echo Нажмите Ctrl+C для остановки
echo.
powershell -Command "$listener = New-Object System.Net.HttpListener; $listener.Prefixes.Add('http://localhost:8000/'); $listener.Start(); Write-Host 'Сервер запущен на http://localhost:8000' -ForegroundColor Green; while ($listener.IsListening) { $context = $listener.GetContext(); $request = $context.Request; $response = $context.Response; $localPath = $request.Url.LocalPath; if ($localPath -eq '/') { $localPath = '/index.html' }; $filePath = Join-Path $PWD $localPath.TrimStart('/'); if (Test-Path $filePath -PathType Leaf) { $content = [System.IO.File]::ReadAllBytes($filePath); $response.ContentLength64 = $content.Length; $response.ContentType = [System.Web.MimeMapping]::GetMimeMapping($filePath); $response.OutputStream.Write($content, 0, $content.Length) } else { $response.StatusCode = 404; $buffer = [System.Text.Encoding]::UTF8.GetBytes('404 Not Found'); $response.ContentLength64 = $buffer.Length; $response.OutputStream.Write($buffer, 0, $buffer.Length) }; $response.Close() }"
goto end

:end
pause
