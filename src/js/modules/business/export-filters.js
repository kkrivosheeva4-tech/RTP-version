// export-filters.js
// Применение фильтров к списку технологий для экспорта.
// Вынесено из export.js для этапа 3 рефакторинга.

(function () {
  'use strict';

  /**
   * Применяет фильтры экспорта к списку технологий.
   * @param {Array} sourceList - исходный список технологий
   * @param {object} filters - объект фильтров (company, blocks, functions, status, costProm, description, techRead, organRead, trlStage, vendors, integrators)
   * @returns {Array} отфильтрованный список технологий
   */
  function applyFiltersToTechnologies(sourceList, filters) {
    if (!sourceList || sourceList.length === 0) return sourceList;

    return sourceList.filter(tech => {
      if (filters.company && Array.isArray(filters.company) && filters.company.length > 0) {
        const techCompanies = Array.isArray(tech.company) ? tech.company : (tech.company ? [tech.company] : []);
        const hasMatchingCompany = techCompanies.some(comp => filters.company.includes(comp));
        if (!hasMatchingCompany) return false;
      }

      if (filters.blocks && Array.isArray(filters.blocks) && filters.blocks.length > 0) {
        const techBlocks = Array.isArray(tech.blocks)
          ? tech.blocks.map(b => {
              if (typeof b === 'number' && typeof window.blockIdToName !== 'undefined' && window.blockIdToName[b]) {
                return window.blockIdToName[b];
              }
              return String(b || '');
            })
          : [tech.block || tech.blocks].filter(Boolean);
        const hasMatchingBlock = techBlocks.some(block => filters.blocks.includes(block));
        if (!hasMatchingBlock) return false;
      }

      if (filters.functions && Array.isArray(filters.functions) && filters.functions.length > 0) {
        const techFunctions = Array.isArray(tech.functions) ? tech.functions : [tech.func || tech.functions].filter(Boolean);
        const hasMatchingFunction = techFunctions.some(func => filters.functions.includes(func));
        if (!hasMatchingFunction) return false;
      }

      if (filters.status && Array.isArray(filters.status) && filters.status.length > 0) {
        const companies = Array.isArray(tech.company) ? tech.company : (tech.company ? [tech.company] : []);
        let isImplemented = false;

        if (companies.length > 1 && tech.companyRatings && typeof tech.companyRatings === 'object') {
          isImplemented = companies.some(company => {
            const ratings = tech.companyRatings[company];
            return ratings && ratings.isImplemented === true;
          });
        } else {
          if (companies.length === 1 && tech.companyRatings && typeof tech.companyRatings === 'object') {
            const ratings = tech.companyRatings[companies[0]];
            isImplemented = ratings && ratings.isImplemented === true;
          } else {
            isImplemented = tech.isImplemented === true;
          }
        }

        const statusValue = isImplemented ? 'Внедренные' : 'Невнедренные';
        if (!filters.status.includes(statusValue)) return false;
      }

      if (filters.costProm && Array.isArray(filters.costProm) && filters.costProm.length > 0) {
        const isPerspective = tech.status === 'Перспективные' || tech.level === 'Перспективные';
        if (!isPerspective) return false;

        const cost = Number(tech.costProm) || 0;
        let matchesAnyRange = false;

        filters.costProm.forEach(range => {
          if (range === '0 - 1 000 000' && cost >= 0 && cost <= 1000000) matchesAnyRange = true;
          if (range === '1 000 000 - 5 000 000' && cost > 1000000 && cost <= 5000000) matchesAnyRange = true;
          if (range === '5 000 000 - 10 000 000' && cost > 5000000 && cost <= 10000000) matchesAnyRange = true;
          if (range === 'Более 10 000 000' && cost > 10000000) matchesAnyRange = true;
        });

        if (!matchesAnyRange) return false;
      }

      if (filters.description && filters.description !== '') {
        const desc = (tech.description || '').toLowerCase();
        const searchText = filters.description.toLowerCase();
        if (!desc.includes(searchText)) return false;
      }

      if (filters.techRead && Array.isArray(filters.techRead) && filters.techRead.length > 0) {
        const techRead = String(tech.techRead || '');
        if (!filters.techRead.includes(techRead)) return false;
      }

      if (filters.organRead && Array.isArray(filters.organRead) && filters.organRead.length > 0) {
        const organRead = String(tech.organRead || '');
        if (!filters.organRead.includes(organRead)) return false;
      }

      if (filters.trlStage && Array.isArray(filters.trlStage) && filters.trlStage.length > 0) {
        const trlStage = String(tech.trlStage || '');
        if (!filters.trlStage.includes(trlStage)) return false;
      }

      if (filters.vendors && Array.isArray(filters.vendors) && filters.vendors.length > 0) {
        if (!tech.vendors || !Array.isArray(tech.vendors) || tech.vendors.length === 0) return false;

        const techVendorNames = tech.vendors.map(v => {
          if (typeof v === 'object' && v !== null) {
            return v.name || v.id || String(v);
          }
          return String(v);
        }).map(name => String(name).trim()).filter(Boolean);

        const hasMatchingVendor = techVendorNames.some(vendorName => {
          return filters.vendors.some(filterVendor => {
            return String(vendorName).toLowerCase() === String(filterVendor).toLowerCase();
          });
        });

        if (!hasMatchingVendor) return false;
      }

      if (filters.integrators && Array.isArray(filters.integrators) && filters.integrators.length > 0) {
        if (!tech.vendors || !Array.isArray(tech.vendors) || tech.vendors.length === 0) return false;

        const allIntegrators = [];
        tech.vendors.forEach(vendor => {
          if (vendor && typeof vendor === 'object' && vendor.integrators && Array.isArray(vendor.integrators)) {
            vendor.integrators.forEach(integrator => {
              const integratorName = typeof integrator === 'object' && integrator !== null
                ? (integrator.name || integrator.id || String(integrator))
                : String(integrator);
              const normalizedName = String(integratorName).trim();
              if (normalizedName && !allIntegrators.includes(normalizedName)) {
                allIntegrators.push(normalizedName);
              }
            });
          }
        });

        const hasMatchingIntegrator = allIntegrators.some(integratorName => {
          return filters.integrators.some(filterIntegrator => {
            return String(integratorName).toLowerCase() === String(filterIntegrator).toLowerCase();
          });
        });

        if (!hasMatchingIntegrator) return false;
      }

      return true;
    });
  }

  window.ExportFilters = {
    applyFiltersToTechnologies
  };

  window.applyFiltersToTechnologies = applyFiltersToTechnologies;
})();
