/**
 * Модуль для автоматического расчета покрытия функций
 * ПРИМЕЧАНИЕ: Устаревший метод (по количеству направлений). Новый — в func-cover-utils.js.
 * ES module
 */
'use strict';

    /**
     * Вычисление значения покрытия функций на основе количества направлений
     * @param {number} directionsCount - Количество выбранных направлений
     * @returns {number} Значение покрытия функций (0-3)
     */
    function calculateFuncCover(directionsCount) {
        if (directionsCount === 0) return 0;
        if (directionsCount === 1) return 1;
        if (directionsCount === 2) return 2;
        return 3; // 3 или более направлений
    }

    /**
     * Получение текстового представления для селекта
     * @param {number} value - Значение покрытия функций (0-3)
     * @returns {string} Текстовое представление
     */
    function getFuncCoverText(value) {
        const options = {
            0: '0 — Не покрывает',
            1: '1 — Низкое покрытие',
            2: '2 — Среднее покрытие',
            3: '3 — Полное покрытие'
        };
        return options[value] || '';
    }

    /**
     * Обновление поля funcCover
     * @param {string} funcCoverFieldId - ID поля funcCover
     * @param {number} value - Новое значение
     */
    function updateFuncCoverField(funcCoverFieldId, value) {
        const funcCoverInput = document.getElementById(funcCoverFieldId);
        if (!funcCoverInput) {
            // Не выводим warning, так как поле может быть необязательным
            return;
        }

        // Обновляем скрытое поле
        funcCoverInput.value = value;

        // Обновляем визуальное отображение custom select
        const customSelect = document.querySelector(`[data-field="${funcCoverFieldId}"]`);
        if (customSelect) {
            const selectedText = customSelect.querySelector('.selected-text');
            if (selectedText) {
                selectedText.textContent = getFuncCoverText(value);
            }
        }

        // Покрытие функций обновлено
    }

    /**
     * Получение количества выбранных направлений
     * @param {string} directionsFieldId - ID поля directions
     * @returns {number} Количество выбранных направлений
     */
    function getDirectionsCount(directionsFieldId) {
        const directionsInput = document.getElementById(directionsFieldId);
        if (!directionsInput || !directionsInput.value) {
            return 0;
        }

        try {
            const directionsValue = directionsInput.value;
            if (directionsValue.startsWith('[')) {
                // Массив направлений
                const directions = JSON.parse(directionsValue);
                return Array.isArray(directions) ? directions.length : 0;
            } else {
                // Одно направление
                return directionsValue.trim() ? 1 : 0;
            }
        } catch (e) {
            // Ошибка при парсинге направлений
            return 0;
        }
    }

    /**
     * Обработчик изменения направлений
     * @param {string} directionsFieldId - ID поля directions
     * @param {string} funcCoverFieldId - ID поля funcCover
     */
    function handleDirectionsChange(directionsFieldId, funcCoverFieldId) {
        const directionsCount = getDirectionsCount(directionsFieldId);
        const funcCoverValue = calculateFuncCover(directionsCount);
        updateFuncCoverField(funcCoverFieldId, funcCoverValue);
    }

    /**
     * Инициализация для формы добавления технологии
     */
    function initForAddForm() {
        // Инициализация для формы добавления

        const directionsInput = document.getElementById('techDirections');
        if (!directionsInput) {
            // Поле techDirections не найдено
            return;
        }

        // Добавляем обработчик изменения
        directionsInput.addEventListener('change', () => {
            handleDirectionsChange('techDirections', 'techFuncCover');
        });

        // Инициализируем значение при загрузке
        handleDirectionsChange('techDirections', 'techFuncCover');
    }

    /**
     * Инициализация для формы редактирования технологии
     */
    function initForEditForm() {
        // Инициализация для формы редактирования

        const directionsInput = document.getElementById('editDirections');
        if (!directionsInput) {
            // Поле editDirections не найдено
            return;
        }

        // Добавляем обработчик изменения
        directionsInput.addEventListener('change', () => {
            handleDirectionsChange('editDirections', 'editFuncCover');
        });

        // Инициализируем значение при загрузке (будет вызвано при открытии модального окна)
        handleDirectionsChange('editDirections', 'editFuncCover');
    }

    /**
     * Инициализация модуля
     */
    function init() {
        // Инициализация FuncCoverCalculator

        // Инициализируем для формы добавления
        initForAddForm();

        // Для формы редактирования будет инициализировано при открытии модального окна
        // через метод initForEditForm
    }

    // Публичный API
    const FuncCoverCalculator = {
        init: init,
        initForEditForm: initForEditForm,
        calculateFuncCover: calculateFuncCover,
        updateFuncCoverField: updateFuncCoverField,
        handleDirectionsChange: handleDirectionsChange
    };

    if (typeof window !== 'undefined') {
        window.FuncCoverCalculator = FuncCoverCalculator;
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init);
        } else {
            setTimeout(init, 100);
        }
    }

    export default FuncCoverCalculator;
