/**
 * Единый конфиг опций для селектов форм.
 * ES module (шаг 7.5).
 */
  /** Опции стадии TRL для модальных форм */
  var TRL_OPTIONS = [
    '1-Исследовательская',
    '2-Прототип',
    '3-Технология готова к внедрению'
  ];

  /** Опции рейтинга (0–3) для техн./орган. готовности и покрытия функций */
  var RATING_OPTIONS = [
    '0 — Не готова',
    '1 — Низкая',
    '2 — Средняя',
    '3 — Высокая'
  ];

  /** Опции статуса внедрения (sidebar-фильтр «Статус» / level) */
  var STATUS_OPTIONS = ['Внедренная', 'Невнедренная'];

  /** Подсказки для стадии TRL */
  var TRL_TOOLTIPS = {
    '1-Исследовательская': 'Ранняя исследовательская стадия: технология находится на начальном этапе разработки, концепция только формируется',
    '2-Прототип': 'Стадия разработки и прототипирования: технология проходит активную разработку, создаются прототипы',
    '3-Технология готова к внедрению': 'Зрелая стадия: технология готова к внедрению и использованию в производстве'
  };

  /** Подсказки для технологической готовности (techTechRead) */
  var TECH_READ_TOOLTIPS = {
    '0 — Не готова': 'Технология находится на начальной стадии, не применима',
    '1 — Низкая': 'Начальная стадия разработки, требуется значительная доработка',
    '2 — Средняя': 'Технология частично готова, требуется доработка',
    '3 — Высокая': 'Технология готова к применению'
  };

  /** Подсказки для организационной готовности (techOrganRead) */
  var ORGAN_READ_TOOLTIPS = {
    '0 — Не готова': 'Организация не готова к внедрению',
    '1 — Низкая': 'Начальный этап подготовки, требуется значительная работа',
    '2 — Средняя': 'Частичная готовность, требуется дополнительная подготовка',
    '3 — Высокая': 'Организация полностью готова к внедрению'
  };

  /** Подсказки для покрытия функций (techFuncCover) */
  var FUNC_COVER_TOOLTIPS = {
    '0 — Не готова': 'Функции не покрыты технологией',
    '1 — Низкая': 'Покрыта небольшая часть функций',
    '2 — Средняя': 'Покрыта значительная часть функций',
    '3 — Высокая': 'Покрыты все необходимые функции'
  };

  /** Id полей модальных форм (блок, функция, TRL, рейтинги) для единой ссылки */
  var MODAL_FIELD_IDS = {
    block: 'techBlock',
    func: 'techFunc',
    editBlock: 'editBlock',
    editFunc: 'editFunc',
    trlStage: 'techTrlStage',
    editTrlStage: 'editTrlStage',
    funcCover: 'techFuncCover',
    editFuncCover: 'editFuncCover',
    techRead: 'techTechRead',
    editTechRead: 'editTechRead',
    organRead: 'techOrganRead',
    editOrganRead: 'editOrganRead'
  };

  var FormFieldOptions = {
    TRL_OPTIONS: TRL_OPTIONS,
    RATING_OPTIONS: RATING_OPTIONS,
    STATUS_OPTIONS: STATUS_OPTIONS,
    TRL_TOOLTIPS: TRL_TOOLTIPS,
    TECH_READ_TOOLTIPS: TECH_READ_TOOLTIPS,
    ORGAN_READ_TOOLTIPS: ORGAN_READ_TOOLTIPS,
    FUNC_COVER_TOOLTIPS: FUNC_COVER_TOOLTIPS,
    MODAL_FIELD_IDS: MODAL_FIELD_IDS
  };

  if (typeof window !== 'undefined') {
    window.FormFieldOptions = FormFieldOptions;
  }
export {};
