// export-fields-config.js
// Конфигурация полей и опций для экспорта PDF.
// Вынесено из export.js для этапа 3 рефакторинга.

'use strict';

/** Порядок колонок в PDF (первые — приоритет) */
const EXPORT_COLUMN_ORDER = ['company', 'blocks', 'functions', 'name'];

/** Поля по умолчанию при открытии модального окна экспорта */
const DEFAULT_EXPORT_FIELDS = {
  name: true,
  company: true,
  blocks: true,
  functions: false,
  techTypes: false,
  status: true,
  costProm: false,
  description: false,
  exampleDesc: false,
  techRead: false,
  organRead: false,
  trlStage: false,
  priority: false,
  vendors: false,
  integrators: false
};

/** Метки полей для модального окна и валидации (совпадают с detail-panel getFieldLabel) */
const EXPORT_FIELD_LABELS = {
  company: 'Предприятия',
  blocks: 'Функциональный блок',
  functions: 'Функции',
  name: 'Название',
  techTypes: 'Тип технологии',
  status: 'Статус',
  costProm: 'Стоимость внедрения',
  techRead: 'Технологическая готовность',
  organRead: 'Организационная готовность',
  trlStage: 'TRL-стадия',
  priority: 'Приоритет',
  vendors: 'Вендору',
  integrators: 'Интеграторы',
  description: 'Описание',
  exampleDesc: 'Примеры внедрения'
};

/** Поля с множественным выбором в фильтрах экспорта */
const MULTI_SELECT_FIELDS = [
  'company', 'blocks', 'functions', 'status', 'costProm',
  'techRead', 'organRead', 'trlStage', 'priority', 'vendors', 'integrators', 'techTypes'
];

/** Текстовые поля в фильтрах экспорта */
const TEXT_FIELDS = ['description', 'exampleDesc'];

/** Опции стоимости внедрения (перспективные) */
const COST_PROM_OPTIONS = [
  '0 - 1 000 000',
  '1 000 000 - 5 000 000',
  '5 000 000 - 10 000 000',
  'Более 10 000 000'
];

/** Опции рейтингов (техн./орган. готовность) */
const RATING_OPTIONS = ['0', '1', '2', '3'];

/** Опции TRL-стадии */
const TRL_OPTIONS = ['1', '2', '3'];

/** Опции приоритета */
const PRIORITY_OPTIONS = [
  'Высокий (60-100%)',
  'Средний (30-60%)',
  'Низкий (0-30%)'
];

/** Опции статуса внедрения */
const STATUS_OPTIONS = ['Внедренные', 'Невнедренные'];

const ExportFieldsConfig = {
  EXPORT_COLUMN_ORDER,
  DEFAULT_EXPORT_FIELDS,
  EXPORT_FIELD_LABELS,
  MULTI_SELECT_FIELDS,
  TEXT_FIELDS,
  COST_PROM_OPTIONS,
  RATING_OPTIONS,
  TRL_OPTIONS,
  PRIORITY_OPTIONS,
  STATUS_OPTIONS
};

if (typeof window !== 'undefined') {
  window.ExportFieldsConfig = ExportFieldsConfig;
}

export default ExportFieldsConfig;
export {
  EXPORT_COLUMN_ORDER,
  DEFAULT_EXPORT_FIELDS,
  EXPORT_FIELD_LABELS,
  MULTI_SELECT_FIELDS,
  TEXT_FIELDS,
  COST_PROM_OPTIONS,
  RATING_OPTIONS,
  TRL_OPTIONS,
  PRIORITY_OPTIONS,
  STATUS_OPTIONS,
};
