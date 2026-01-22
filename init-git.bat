@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Инициализация Git репозитория...
git init
git config user.email "kkrivosheeva4@gmail.com"
git config user.name "kkrivosheeva4-tech"
git remote remove origin 2>nul
git remote add origin https://github.com/kkrivosheeva4-tech/RTP-version.git
echo.
echo Добавление файлов проекта...
git add .
echo.
echo Создание первого коммита...
git commit -m "Initial commit"
echo.
echo Git настроен успешно!
echo.
echo Для отправки в GitHub выполните:
echo git push -u origin main
pause
