#!/bin/bash

echo "========================================"
echo "  Запуск локального веб-сервера"
echo "========================================"
echo ""
echo "Выберите способ запуска:"
echo "1. Python HTTP Server (рекомендуется)"
echo "2. PHP Built-in Server"
echo "3. Выход"
echo ""
read -p "Введите номер (1-3): " choice

case $choice in
    1)
        echo ""
        echo "Проверка наличия Python..."
        if ! command -v python3 &> /dev/null; then
            echo "ОШИБКА: Python3 не найден!"
            echo "Установите Python с https://www.python.org/"
            exit 1
        fi
        echo "Python найден!"
        echo ""
        echo "Запуск сервера на http://localhost:8000"
        echo "Нажмите Ctrl+C для остановки"
        echo ""
        python3 -m http.server 8000
        ;;
    2)
        echo ""
        echo "Проверка наличия PHP..."
        if ! command -v php &> /dev/null; then
            echo "ОШИБКА: PHP не найден!"
            exit 1
        fi
        echo "PHP найден!"
        echo ""
        echo "Запуск сервера на http://localhost:8000"
        echo "Нажмите Ctrl+C для остановки"
        echo ""
        php -S localhost:8000
        ;;
    3)
        exit 0
        ;;
    *)
        echo "Неверный выбор!"
        exit 1
        ;;
esac
