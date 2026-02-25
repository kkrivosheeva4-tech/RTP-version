/**
 * DataService — слой абстракции для переключения между mock (JSON + VFS) и API.
 * Этап 9.2: структура с методами; реализация — шаг 9.3.
 *
 * @module data-service
 */

/** Имена справочников, доступных через loadReference */
export const REFERENCE_NAMES = [
  'blocks',
  'functions',
  'functionToBlock',
  'digitalDirections',
  'directionToQuadrant',
  'vendors',
  'integrators',
  'enterprises'
];

/**
 * DataService — единая точка доступа к данным (mock или API).
 */
const DataService = {
  /**
   * Загружает список технологий.
   * @param {number|string} [enterpriseId] — опционально: фильтр по ID предприятия
   * @returns {Promise<Array>} массив технологий в нормализованном формате
   */
  async loadTechnologies(enterpriseId) {
    return Promise.reject(new Error('DataService.loadTechnologies: not implemented (step 9.3)'));
  },

  /**
   * Загружает справочник по имени.
   * @param {string} name — имя справочника: blocks, functions, vendors, integrators, enterprises, digitalDirections, directionToQuadrant, functionToBlock
   * @returns {Promise<Array|Object>} данные справочника (массив или объект)
   */
  async loadReference(name) {
    if (!REFERENCE_NAMES.includes(name)) {
      return Promise.reject(new Error(`DataService.loadReference: unknown reference "${name}"`));
    }
    return Promise.reject(new Error('DataService.loadReference: not implemented (step 9.3)'));
  },

  /**
   * Создаёт новую технологию.
   * @param {Object} tech — данные технологии
   * @returns {Promise<Object>} созданная технология в нормализованном формате
   */
  async createTech(tech) {
    return Promise.reject(new Error('DataService.createTech: not implemented (step 9.3)'));
  },

  /**
   * Обновляет технологию по ID.
   * @param {number|string} id — ID технологии
   * @param {Object} tech — данные для обновления
   * @returns {Promise<Object>} обновлённая технология
   */
  async updateTech(id, tech) {
    return Promise.reject(new Error('DataService.updateTech: not implemented (step 9.3)'));
  },

  /**
   * Удаляет технологию по ID.
   * @param {number|string} id — ID технологии
   * @returns {Promise<void>}
   */
  async deleteTech(id) {
    return Promise.reject(new Error('DataService.deleteTech: not implemented (step 9.3)'));
  },

  /**
   * Загружает список предприятий.
   * @returns {Promise<Array>} массив предприятий
   */
  async loadEnterprises() {
    return Promise.reject(new Error('DataService.loadEnterprises: not implemented (step 9.3)'));
  },

  /**
   * Загружает данные по предприятиям (enterpriseData: { [companyName]: technology[] }).
   * @returns {Promise<Object>}
   */
  async loadEnterpriseData() {
    return Promise.reject(new Error('DataService.loadEnterpriseData: not implemented (step 9.3)'));
  }
};

if (typeof window !== 'undefined') {
  window.DataService = DataService;
}

export default DataService;
