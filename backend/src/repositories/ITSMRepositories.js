const { BaseRepository } = require('./BaseRepository');
const { UserFactory } = require('../patterns/factory/EntityFactory');
const { Incident } = require('../domain/Incident');
const { ITService, IncidentCategory } = require('../domain/ITService');
const { SLAPolicy } = require('../domain/SLAPolicy');
const { AuditLog, Notification } = require('../domain/AuditLog');

class UserRepository extends BaseRepository {
  constructor() {
    super(
      'User',
      {
        id: { type: String, index: true },
        name: String,
        email: { type: String, index: true },
        passwordHash: String,
        role: String,
        active: Boolean
      },
      'id'
    );
  }

  hydrate(rawDoc) {
    return UserFactory.createUser(rawDoc);
  }

  async findByEmail(email) {
    const normalized = String(email || '').trim().toLowerCase();
    const all = await this.findAll();
    return all.find((u) => u.email === normalized) || null;
  }

  async findTechnicians() {
    const all = await this.findAll();
    return all.filter((u) => u.role === 'TECHNICIAN');
  }
}

class ServiceRepository extends BaseRepository {
  constructor() {
    super(
      'ITService',
      {
        serviceId: { type: String, index: true },
        name: String,
        category: String,
        businessCriticality: Number,
        status: String
      },
      'serviceId'
    );
  }

  hydrate(rawDoc) {
    return new ITService(rawDoc);
  }
}

class CategoryRepository extends BaseRepository {
  constructor() {
    super(
      'IncidentCategory',
      {
        categoryId: { type: String, index: true },
        name: String,
        description: String,
        keywords: [String],
        active: Boolean
      },
      'categoryId'
    );
  }

  hydrate(rawDoc) {
    return new IncidentCategory(rawDoc);
  }

  async findByName(name) {
    const all = await this.findAll();
    return all.find((c) => c.name.toLowerCase() === String(name || '').toLowerCase()) || null;
  }
}

class SLAPolicyRepository extends BaseRepository {
  constructor() {
    super(
      'SLAPolicy',
      {
        priority: { type: String, index: true },
        label: String,
        responseMinutes: Number,
        resolutionMinutes: Number
      },
      'priority'
    );
  }

  hydrate(rawDoc) {
    return new SLAPolicy(rawDoc);
  }
}

class IncidentRepository extends BaseRepository {
  constructor() {
    super(
      'Incident',
      {
        incidentId: { type: String, index: true },
        title: String,
        description: String,
        reporterId: String,
        serviceId: String,
        category: String,
        priority: String,
        status: String,
        assignedTechnicianId: String,
        createdAt: String
      },
      'incidentId'
    );
    this.sequenceCounter = 1000;
  }

  hydrate(rawDoc) {
    return new Incident(rawDoc);
  }

  async nextIncidentId() {
    const all = await this.findAll();
    const maxNum = all.reduce((max, inc) => {
      const match = String(inc.incidentId).match(/INC(\d+)/);
      return match ? Math.max(max, Number(match[1])) : max;
    }, this.sequenceCounter);
    this.sequenceCounter = maxNum + 1;
    return `INC${this.sequenceCounter}`;
  }
}

class AuditLogRepository extends BaseRepository {
  constructor() {
    super(
      'AuditLog',
      {
        auditId: { type: String, index: true },
        timestamp: String,
        incidentId: String,
        action: String
      },
      'auditId'
    );
  }

  hydrate(rawDoc) {
    return new AuditLog(rawDoc);
  }

  async findByIncident(incidentId) {
    const all = await this.findAll();
    return all
      .filter((a) => a.incidentId === incidentId)
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }
}

class NotificationRepository extends BaseRepository {
  constructor() {
    super(
      'Notification',
      {
        notificationId: { type: String, index: true },
        recipientId: String,
        channel: String,
        incidentId: String,
        createdAt: String
      },
      'notificationId'
    );
  }

  hydrate(rawDoc) {
    return new Notification(rawDoc);
  }

  async findByRecipient(recipientId) {
    const all = await this.findAll();
    return all
      .filter((n) => n.recipientId === recipientId || n.recipientId === 'ALL_ADMINS')
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }
}

const repositories = {
  userRepo: new UserRepository(),
  serviceRepo: new ServiceRepository(),
  categoryRepo: new CategoryRepository(),
  slaPolicyRepo: new SLAPolicyRepository(),
  incidentRepo: new IncidentRepository(),
  auditLogRepo: new AuditLogRepository(),
  notificationRepo: new NotificationRepository()
};

module.exports = {
  UserRepository,
  ServiceRepository,
  CategoryRepository,
  SLAPolicyRepository,
  IncidentRepository,
  AuditLogRepository,
  NotificationRepository,
  repositories
};
