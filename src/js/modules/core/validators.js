// validators.js
// Валидация данных: дубликаты технологий, вендоров и т.д. с учётом омоглифов и регистра

(function () {
  "use strict";

  /**
   * Приводит строку к единому виду для сравнения: trim, нижний регистр,
   * замена русско-английских омоглифов (а↔a, о↔o, е↔e, р↔p, у↔y, с↔c, х↔x) к латинскому виду.
   * Используется во всех валидациях дубликатов.
   * @param {string} str - исходная строка
   * @returns {string} нормализованная строка
   */
  function normalizeForComparison(str) {
    if (str == null || typeof str !== "string") return "";
    let s = str.trim().toLowerCase();
    // Кириллица → латиница (омоглифы а↔a, о↔o, е↔e, р↔p, у↔y, с↔c, х↔x)
    const homoglyphs = [
      ["а", "a"], ["е", "e"], ["о", "o"], ["р", "p"], ["у", "y"], ["с", "c"], ["х", "x"]
    ];
    for (const [cyr, lat] of homoglyphs) {
      s = s.split(cyr).join(lat);
    }
    return s;
  }

  /**
   * Проверяет, что технология с таким названием ещё не существует.
   * Учитывает регистр, пробелы и омоглифы (а↔a, о↔o, е↔e и т.д.).
   * @param {string} name - название технологии
   * @param {number|string|null|undefined} excludeId - ID технологии, которую исключить из проверки (при редактировании)
   * @returns {{ valid: boolean, message?: string }}
   */
  function validateDuplicateTechnology(name, excludeId) {
    const StateManager = typeof window !== "undefined" && window.StateManager;
    if (!StateManager || typeof StateManager.get !== "function") {
      return { valid: true };
    }
    const technologies = StateManager.get("technologies") || [];
    const normalized = normalizeForComparison(name);
    if (!normalized) {
      return { valid: false, message: "Введите название технологии" };
    }
    const duplicate = technologies.find(function (t) {
      if (excludeId != null && t.id === excludeId) return false;
      return normalizeForComparison(t.name) === normalized;
    });
    return duplicate
      ? { valid: false, message: "Технология с таким названием уже существует" }
      : { valid: true };
  }

  // Экспорт в глобальную область для использования в формах и других модулях
  window.normalizeForComparison = normalizeForComparison;
  window.validateDuplicateTechnology = validateDuplicateTechnology;
})();
