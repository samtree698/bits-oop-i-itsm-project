const { Employee, Technician, Administrator } = require('../../domain/User');
const { Incident, SLARecord } = require('../../domain/Incident');
const { Notification, AuditLog } = require('../../domain/AuditLog');
const { InvalidUserInputException } = require('../../exceptions/AppExceptions');

/**
 * Factory Pattern (PDF Page 11)
 * Centralizes polymorphic object creation for Users, Incidents, Notifications, and AuditLogs
 */
class UserFactory {
  static createUser(data) {
    if (!data || !data.role) {
      throw new InvalidUserInputException('User role is required for UserFactory.');
    }
    const role = String(data.role).toUpperCase();
    switch (role) {
      case 'EMPLOYEE':
      case 'CUSTOMER':
        return new Employee(data);
      case 'TECHNICIAN':
      case 'SUPPORT_ENGINEER':
      case 'TEAM_LEAD':
      case 'SYS_ADMIN':
        return new Technician({ ...data, role: 'TECHNICIAN', escalationRole: role });
      case 'ADMIN':
      case 'ADMINISTRATOR':
      case 'IT_MANAGER':
        return new Administrator(data);
      default:
        throw new InvalidUserInputException(`Unsupported user role '${data.role}'.`);
    }
  }
}

class IncidentFactory {
  static createIncident({ payload, reporter, service, categoryName, priorityResult, slaDeadlines, incidentNumber }) {
    const slaRecord = new SLARecord({
      priority: priorityResult.priority,
      responseMinutes: slaDeadlines.responseMinutes,
      resolutionMinutes: slaDeadlines.resolutionMinutes,
      responseDeadline: slaDeadlines.responseDeadline,
      resolutionDeadline: slaDeadlines.resolutionDeadline
    });

    return new Incident({
      incidentId: incidentNumber || `INC${Math.floor(1000 + Math.random() * 9000)}`,
      title: payload.title,
      description: payload.description,
      reporterId: reporter.id,
      reporterName: reporter.name,
      serviceId: service.serviceId,
      serviceName: service.name,
      category: categoryName,
      impact: payload.impact ?? 2,
      urgency: payload.urgency ?? 2,
      affectedUsers: payload.affectedUsers ?? 1,
      businessCriticality: service.businessCriticality,
      priority: priorityResult.priority,
      priorityScore: priorityResult.priorityScore,
      status: 'NEW',
      slaRecord
    });
  }
}

class NotificationFactory {
  static createNotification({ recipientId, recipientEmail, channel, eventType, incidentId, title, message }) {
    return new Notification({
      recipientId,
      recipientEmail,
      channel,
      eventType,
      incidentId,
      title,
      message
    });
  }

  static createAuditLog(params) {
    return new AuditLog(params);
  }
}

module.exports = {
  UserFactory,
  IncidentFactory,
  NotificationFactory
};
