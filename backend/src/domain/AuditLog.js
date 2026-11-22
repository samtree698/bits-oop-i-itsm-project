/**
 * AuditLog & Notification Domain Classes (PDF Page 7-8)
 */
class AuditLog {
  constructor({ auditId, timestamp = new Date().toISOString(), userId, userName, userRole, action, incidentId, previousState = null, newState = null, description }) {
    this.auditId = auditId || `AUD-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    this.timestamp = timestamp;
    this.userId = userId || 'SYSTEM';
    this.userName = userName || 'System Automator';
    this.userRole = userRole || 'SYSTEM';
    this.action = action;
    this.incidentId = incidentId;
    this.previousState = previousState;
    this.newState = newState;
    this.description = description;
  }

  toJSON() {
    return {
      auditId: this.auditId,
      timestamp: this.timestamp,
      userId: this.userId,
      userName: this.userName,
      userRole: this.userRole,
      action: this.action,
      incidentId: this.incidentId,
      previousState: this.previousState,
      newState: this.newState,
      description: this.description
    };
  }
}

class Notification {
  constructor({ notificationId, recipientId, recipientEmail, channel = 'IN_APP', eventType, incidentId, title, message, read = false, createdAt = new Date().toISOString() }) {
    this.notificationId = notificationId || `NTF-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    this.recipientId = recipientId;
    this.recipientEmail = recipientEmail || '';
    this.channel = channel; // IN_APP | EMAIL_SIMULATION | SMS_SIMULATION
    this.eventType = eventType;
    this.incidentId = incidentId;
    this.title = title;
    this.message = message;
    this.read = Boolean(read);
    this.createdAt = createdAt;
  }

  markRead() {
    this.read = true;
  }

  toJSON() {
    return {
      notificationId: this.notificationId,
      recipientId: this.recipientId,
      recipientEmail: this.recipientEmail,
      channel: this.channel,
      eventType: this.eventType,
      incidentId: this.incidentId,
      title: this.title,
      message: this.message,
      read: this.read,
      createdAt: this.createdAt
    };
  }
}

module.exports = {
  AuditLog,
  Notification
};
