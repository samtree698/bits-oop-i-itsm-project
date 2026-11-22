const { InvalidIncidentException, UnauthorizedOperationException } = require('../exceptions/AppExceptions');
const { IncidentStateFactory } = require('../patterns/state/IncidentState');

/**
 * Composed Value Object: SLARecord
 */
class SLARecord {
  constructor(props = {}) {
    this.priority = props.priority || 'P3';
    this.responseMinutes = Number(props.responseMinutes || 60);
    this.resolutionMinutes = Number(props.resolutionMinutes || 480);
    this.responseDeadline = props.responseDeadline || null;
    this.resolutionDeadline = props.resolutionDeadline || null;
    this.acknowledgedAt = props.acknowledgedAt || null;
    this.resolvedAt = props.resolvedAt || null;
    this.responseViolated = Boolean(props.responseViolated || false);
    this.resolutionViolated = Boolean(props.resolutionViolated || false);
    this.warningIssued = Boolean(props.warningIssued || false);
    this.escalationLevel = props.escalationLevel || 'NONE'; // NONE | TECHNICIAN | TEAM_LEAD | SYSTEM_ADMIN | IT_MANAGER
    this.escalationHistory = Array.isArray(props.escalationHistory) ? props.escalationHistory : [];
  }

  evaluateCompliance(referenceDate = new Date(), currentStatus = 'ASSIGNED', createdAt = new Date()) {
    const nowMs = new Date(referenceDate).getTime();
    const createdMs = new Date(createdAt).getTime();

    if (this.responseDeadline && !this.acknowledgedAt && ['NEW', 'CLASSIFIED', 'ASSIGNED'].includes(currentStatus)) {
      if (nowMs > new Date(this.responseDeadline).getTime()) {
        this.responseViolated = true;
      }
    }

    if (this.resolutionDeadline && !this.resolvedAt && !['RESOLVED', 'VERIFIED', 'CLOSED'].includes(currentStatus)) {
      const resDeadlineMs = new Date(this.resolutionDeadline).getTime();
      if (nowMs > resDeadlineMs) {
        this.resolutionViolated = true;
      } else {
        const totalWindow = resDeadlineMs - createdMs;
        const elapsed = nowMs - createdMs;
        if (totalWindow > 0 && elapsed / totalWindow >= 0.75) {
          this.warningIssued = true;
        }
      }
    }

    const isViolated = this.responseViolated || this.resolutionViolated;
    return {
      isViolated,
      responseViolated: this.responseViolated,
      resolutionViolated: this.resolutionViolated,
      warningIssued: this.warningIssued,
      slaStatus: isViolated ? 'VIOLATED' : this.warningIssued ? 'AT_RISK' : 'COMPLIANT'
    };
  }

  toJSON() {
    return {
      priority: this.priority,
      responseMinutes: this.responseMinutes,
      resolutionMinutes: this.resolutionMinutes,
      responseDeadline: this.responseDeadline,
      resolutionDeadline: this.resolutionDeadline,
      acknowledgedAt: this.acknowledgedAt,
      resolvedAt: this.resolvedAt,
      responseViolated: this.responseViolated,
      resolutionViolated: this.resolutionViolated,
      warningIssued: this.warningIssued,
      escalationLevel: this.escalationLevel,
      escalationHistory: this.escalationHistory,
      slaStatus: (this.responseViolated || this.resolutionViolated)
        ? 'VIOLATED'
        : this.warningIssued
        ? 'AT_RISK'
        : 'COMPLIANT'
    };
  }
}

/**
 * Composed Value Object: InvestigationNote
 */
class InvestigationNote {
  constructor({ noteId, authorId, authorName, authorRole, content, isInfoRequest = false, isEmployeeResponse = false, timestamp = new Date().toISOString() }) {
    this.noteId = noteId || `NOTE-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    this.authorId = authorId;
    this.authorName = authorName;
    this.authorRole = authorRole;
    this.content = content;
    this.isInfoRequest = Boolean(isInfoRequest);
    this.isEmployeeResponse = Boolean(isEmployeeResponse);
    this.timestamp = timestamp;
  }

  toJSON() {
    return {
      noteId: this.noteId,
      authorId: this.authorId,
      authorName: this.authorName,
      authorRole: this.authorRole,
      content: this.content,
      isInfoRequest: this.isInfoRequest,
      isEmployeeResponse: this.isEmployeeResponse,
      timestamp: this.timestamp
    };
  }
}

/**
 * Composed Value Object: ResolutionDetails
 */
class ResolutionDetails {
  constructor({ rootCause = '', resolutionSummary = '', stepsTaken = '', resolvedBy = '', resolvedByName = '', resolvedAt = null } = {}) {
    this.rootCause = rootCause;
    this.resolutionSummary = resolutionSummary;
    this.stepsTaken = stepsTaken;
    this.resolvedBy = resolvedBy;
    this.resolvedByName = resolvedByName;
    this.resolvedAt = resolvedAt;
  }

  toJSON() {
    return {
      rootCause: this.rootCause,
      resolutionSummary: this.resolutionSummary,
      stepsTaken: this.stepsTaken,
      resolvedBy: this.resolvedBy,
      resolvedByName: this.resolvedByName,
      resolvedAt: this.resolvedAt
    };
  }
}

/**
 * Composed Value Object: ClosureDetails
 */
class ClosureDetails {
  constructor({ verifiedBy = null, verifiedAt = null, closedBy = null, closedAt = null, employeeFeedback = '', rating = null } = {}) {
    this.verifiedBy = verifiedBy;
    this.verifiedAt = verifiedAt;
    this.closedBy = closedBy;
    this.closedAt = closedAt;
    this.employeeFeedback = employeeFeedback;
    this.rating = rating !== null && rating !== undefined ? Number(rating) : null;
  }

  toJSON() {
    return {
      verifiedBy: this.verifiedBy,
      verifiedAt: this.verifiedAt,
      closedBy: this.closedBy,
      closedAt: this.closedAt,
      employeeFeedback: this.employeeFeedback,
      rating: this.rating
    };
  }
}

/**
 * Aggregate Root: Incident (PDF Page 5 & 7)
 * Demonstrates Composition, Encapsulation, and State Pattern delegation
 */
class Incident {
  constructor(props) {
    if (!props.title || !props.description || !props.reporterId || !props.serviceId) {
      throw new InvalidIncidentException('Incident requires title, description, reporterId, and affected serviceId.');
    }
    this.incidentId = props.incidentId || `INC${Math.floor(1000 + Math.random() * 9000)}`;
    this.title = props.title.trim();
    this.description = props.description.trim();
    this.reporterId = props.reporterId;
    this.reporterName = props.reporterName || 'Employee';
    this.serviceId = props.serviceId;
    this.serviceName = props.serviceName || props.serviceId;
    this.category = props.category || 'Uncategorized';
    this.impact = Number(props.impact || 2); // 1 (Low), 2 (Medium), 3 (High)
    this.urgency = Number(props.urgency || 2); // 1 (Low), 2 (Medium), 3 (High)
    this.affectedUsers = Number(props.affectedUsers || 1);
    this.businessCriticality = Number(props.businessCriticality || 3);
    this.priority = props.priority || 'P3';
    this.priorityScore = Number(props.priorityScore || 0);
    this.status = props.status || 'NEW';
    this.createdAt = props.createdAt || new Date().toISOString();
    this.updatedAt = props.updatedAt || this.createdAt;
    this.assignedTechnicianId = props.assignedTechnicianId || null;
    this.assignedTechnicianName = props.assignedTechnicianName || null;
    this.assignmentStrategyUsed = props.assignmentStrategyUsed || null;
    this.awaitingEmployeeInfo = Boolean(props.awaitingEmployeeInfo || false);

    // Composition relationships
    this.slaRecord = props.slaRecord instanceof SLARecord ? props.slaRecord : new SLARecord(props.slaRecord || {});
    this.investigationNotes = (props.investigationNotes || []).map((n) =>
      n instanceof InvestigationNote ? n : new InvestigationNote(n)
    );
    this.resolution =
      props.resolution instanceof ResolutionDetails ? props.resolution : new ResolutionDetails(props.resolution || {});
    this.closure =
      props.closure instanceof ClosureDetails ? props.closure : new ClosureDetails(props.closure || {});

    // Intelligent metadata
    this.isPotentialDuplicate = Boolean(props.isPotentialDuplicate || false);
    this.duplicateOf = Array.isArray(props.duplicateOf) ? props.duplicateOf : [];
    this.correlatedIncidents = Array.isArray(props.correlatedIncidents) ? props.correlatedIncidents : [];
    this.suggestedResolution = props.suggestedResolution || null;
  }

  /**
   * State Pattern guarded transition
   */
  transitionState(targetState, actorUser = null) {
    const currentStateObj = IncidentStateFactory.getState(this.status);
    currentStateObj.validateTransition(targetState);

    if (actorUser && typeof actorUser.canTransitionTo === 'function') {
      if (!actorUser.canTransitionTo(targetState)) {
        throw new UnauthorizedOperationException(
          `Role '${actorUser.role}' is not permitted to transition incident to '${targetState}'.`
        );
      }
    }

    const previousState = this.status;
    this.status = targetState;
    this.updatedAt = new Date().toISOString();

    if (targetState === 'ACKNOWLEDGED' && !this.slaRecord.acknowledgedAt) {
      this.slaRecord.acknowledgedAt = this.updatedAt;
      if (this.slaRecord.responseDeadline) {
        this.slaRecord.responseViolated =
          new Date(this.updatedAt).getTime() > new Date(this.slaRecord.responseDeadline).getTime();
      }
    }

    if (targetState === 'RESOLVED') {
      this.slaRecord.resolvedAt = this.updatedAt;
      this.awaitingEmployeeInfo = false;
      if (this.slaRecord.resolutionDeadline) {
        this.slaRecord.resolutionViolated =
          new Date(this.updatedAt).getTime() > new Date(this.slaRecord.resolutionDeadline).getTime();
      }
    }

    if (targetState === 'VERIFIED') {
      this.closure.verifiedAt = this.updatedAt;
      this.closure.verifiedBy = actorUser ? actorUser.name : 'System';
    }

    if (targetState === 'CLOSED') {
      this.closure.closedAt = this.updatedAt;
      this.closure.closedBy = actorUser ? actorUser.name : 'System';
    }

    return { previousState, newState: this.status };
  }

  addInvestigationNote({ authorId, authorName, authorRole, content, isInfoRequest = false, isEmployeeResponse = false }) {
    if (!content || !String(content).trim()) {
      throw new InvalidIncidentException('Investigation note or response content cannot be empty.');
    }
    const note = new InvestigationNote({
      authorId,
      authorName,
      authorRole,
      content: content.trim(),
      isInfoRequest,
      isEmployeeResponse
    });
    this.investigationNotes.push(note);
    if (isInfoRequest) {
      this.awaitingEmployeeInfo = true;
    }
    if (isEmployeeResponse) {
      this.awaitingEmployeeInfo = false;
    }
    this.updatedAt = new Date().toISOString();
    return note;
  }

  applyResolution({ rootCause, resolutionSummary, stepsTaken = '', resolvedBy, resolvedByName }, actorUser = null) {
    if (!resolutionSummary || !String(resolutionSummary).trim()) {
      throw new InvalidIncidentException('Resolution summary is required to resolve an incident.');
    }
    this.transitionState('RESOLVED', actorUser);
    this.resolution = new ResolutionDetails({
      rootCause: rootCause || 'Identified during technical investigation',
      resolutionSummary: resolutionSummary.trim(),
      stepsTaken: stepsTaken.trim(),
      resolvedBy,
      resolvedByName,
      resolvedAt: this.updatedAt
    });
  }

  recordFeedback({ feedback, rating, actorUser = null, autoVerify = true }) {
    this.closure.employeeFeedback = feedback || '';
    if (rating !== undefined && rating !== null) {
      this.closure.rating = Math.min(5, Math.max(1, Number(rating)));
    }
    if (autoVerify && this.status === 'RESOLVED') {
      this.transitionState('VERIFIED', actorUser);
    }
    this.updatedAt = new Date().toISOString();
  }

  toJSON() {
    this.slaRecord.evaluateCompliance(new Date(), this.status, this.createdAt);
    return {
      incidentId: this.incidentId,
      title: this.title,
      description: this.description,
      reporterId: this.reporterId,
      reporterName: this.reporterName,
      serviceId: this.serviceId,
      serviceName: this.serviceName,
      category: this.category,
      impact: this.impact,
      urgency: this.urgency,
      affectedUsers: this.affectedUsers,
      businessCriticality: this.businessCriticality,
      priority: this.priority,
      priorityScore: this.priorityScore,
      status: this.status,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      assignedTechnicianId: this.assignedTechnicianId,
      assignedTechnicianName: this.assignedTechnicianName,
      assignmentStrategyUsed: this.assignmentStrategyUsed,
      awaitingEmployeeInfo: this.awaitingEmployeeInfo,
      slaRecord: this.slaRecord.toJSON(),
      investigationNotes: this.investigationNotes.map((n) => n.toJSON()),
      resolution: this.resolution.toJSON(),
      closure: this.closure.toJSON(),
      isPotentialDuplicate: this.isPotentialDuplicate,
      duplicateOf: this.duplicateOf,
      correlatedIncidents: this.correlatedIncidents,
      suggestedResolution: this.suggestedResolution
    };
  }
}

module.exports = {
  Incident,
  SLARecord,
  InvestigationNote,
  ResolutionDetails,
  ClosureDetails
};
