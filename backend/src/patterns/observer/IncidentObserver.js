const { NotificationFactory } = require('../factory/EntityFactory');

/**
 * Observer Pattern (PDF Page 7-8 & 11)
 * Decouples Incident lifecycle events from Audit Logging and Multi-Channel Notifications (In-App + Simulated Email)
 */
class IncidentObserver {
  update(eventType, payload) {
    throw new Error('Observer subclasses must implement update(eventType, payload)');
  }
}

class AuditLogObserver extends IncidentObserver {
  constructor(auditLogRepository) {
    super();
    this.auditLogRepository = auditLogRepository;
  }

  async update(eventType, payload) {
    const { incident, actor, previousState = null, newState = null, description } = payload;
    const log = NotificationFactory.createAuditLog({
      userId: actor?.id || 'SYSTEM',
      userName: actor?.name || 'System Automator',
      userRole: actor?.role || 'SYSTEM',
      action: eventType,
      incidentId: incident.incidentId,
      previousState,
      newState: newState || incident.status,
      description: description || `Event ${eventType} occurred on ${incident.incidentId}`
    });
    await this.auditLogRepository.save(log);
  }
}

class InAppNotificationObserver extends IncidentObserver {
  constructor(notificationRepository) {
    super();
    this.notificationRepository = notificationRepository;
  }

  async update(eventType, payload) {
    const { incident, recipients = [], title, message } = payload;
    if (!recipients.length || !message) return;

    for (const recipient of recipients) {
      if (!recipient?.id) continue;
      const notif = NotificationFactory.createNotification({
        recipientId: recipient.id,
        recipientEmail: recipient.email || '',
        channel: 'IN_APP',
        eventType,
        incidentId: incident.incidentId,
        title: title || `[${incident.incidentId}] ${eventType.replace(/_/g, ' ')}`,
        message
      });
      await this.notificationRepository.save(notif);
    }
  }
}

class EmailSimulationObserver extends IncidentObserver {
  constructor(notificationRepository) {
    super();
    this.notificationRepository = notificationRepository;
  }

  async update(eventType, payload) {
    const { incident, recipients = [], title, message } = payload;
    if (!recipients.length || !message) return;

    for (const recipient of recipients) {
      if (!recipient?.id) continue;
      const emailNotif = NotificationFactory.createNotification({
        recipientId: recipient.id,
        recipientEmail: recipient.email || 'user@bits-itsm.edu',
        channel: 'EMAIL_SIMULATION',
        eventType,
        incidentId: incident.incidentId,
        title: `[Simulated Email -> ${recipient.email || recipient.name}] ${title || eventType}`,
        message: `Dear ${recipient.name || 'User'}, ${message} (Priority: ${incident.priority}, Status: ${incident.status})`
      });
      await this.notificationRepository.save(emailNotif);
    }
  }
}

class IncidentEventPublisher {
  constructor() {
    this.observers = [];
  }

  subscribe(observer) {
    this.observers.push(observer);
  }

  unsubscribe(observer) {
    this.observers = this.observers.filter((obs) => obs !== observer);
  }

  async notify(eventType, payload) {
    for (const observer of this.observers) {
      await observer.update(eventType, payload);
    }
  }
}

module.exports = {
  IncidentObserver,
  AuditLogObserver,
  InAppNotificationObserver,
  EmailSimulationObserver,
  IncidentEventPublisher
};
