const { InvalidUserInputException } = require('../exceptions/AppExceptions');

/**
 * ITService Domain Class
 * Represents organizational IT services (Cloud, Database, Payment, Network, Auth, Storage, etc.)
 */
class ITService {
  constructor({ serviceId, name, category, description = '', businessCriticality = 3, status = 'OPERATIONAL', ownerTeam = 'Core IT' }) {
    if (!name || !category) {
      throw new InvalidUserInputException('IT Service name and category are required.');
    }
    const crit = Number(businessCriticality);
    if (Number.isNaN(crit) || crit < 1 || crit > 5) {
      throw new InvalidUserInputException('Business criticality must be between 1 (Low) and 5 (Mission Critical).');
    }
    this.serviceId = serviceId || `SVC-${Date.now()}`;
    this.name = name.trim();
    this.category = category.trim();
    this.description = description;
    this.businessCriticality = crit;
    this.status = status; // OPERATIONAL | DEGRADED | OUTAGE
    this.ownerTeam = ownerTeam;
  }

  toJSON() {
    return {
      serviceId: this.serviceId,
      name: this.name,
      category: this.category,
      description: this.description,
      businessCriticality: this.businessCriticality,
      status: this.status,
      ownerTeam: this.ownerTeam
    };
  }
}

/**
 * IncidentCategory Domain Class
 * Allows dynamic addition of new categories without modifying core code (Open/Closed Principle)
 */
class IncidentCategory {
  constructor({ categoryId, name, description = '', keywords = [], defaultImpact = 2, active = true }) {
    if (!name) {
      throw new InvalidUserInputException('Category name is required.');
    }
    this.categoryId = categoryId || `CAT-${name.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;
    this.name = name.trim();
    this.description = description;
    this.keywords = Array.isArray(keywords) ? keywords : [];
    this.defaultImpact = Number(defaultImpact) || 2;
    this.active = Boolean(active);
  }

  toJSON() {
    return {
      categoryId: this.categoryId,
      name: this.name,
      description: this.description,
      keywords: this.keywords,
      defaultImpact: this.defaultImpact,
      active: this.active
    };
  }
}

module.exports = {
  ITService,
  IncidentCategory
};
