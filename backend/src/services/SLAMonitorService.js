const { MissingSLAConfigurationException } = require('../exceptions/AppExceptions');

/**
 * SLAMonitorService (PDF Page 6-7 & 9-10)
 * Handles:
 * - SLA Policy lookup & deadline computation
 * - Continuous SLA compliance evaluation
 * - Warning detection (>= 75% target elapsed)
 * - Violation recording (Response & Resolution breaches)
 * - Automatic 4-Tier Escalation: Technician -> Team Lead -> System Administrator -> IT Manager
 */
const ESCALATION_CHAIN = ['TECHNICIAN', 'TEAM_LEAD', 'SYSTEM_ADMIN', 'IT_MANAGER'];

class SLAMonitorService {
  constructor({ slaPolicyRepo, incidentRepo, userRepo, eventPublisher }) {
    this.slaPolicyRepo = slaPolicyRepo;
    this.incidentRepo = incidentRepo;
    this.userRepo = userRepo;
    this.eventPublisher = eventPublisher;
  }

  async calculateSLADeadlines(priority, createdAt = new Date()) {
    const policy = await this.slaPolicyRepo.findByKey(priority);
    if (!policy) {
      throw new MissingSLAConfigurationException(priority);
    }
    return policy.calculateDeadlines(createdAt);
  }

  getNextEscalationLevel(currentLevel) {
    const idx = ESCALATION_CHAIN.indexOf(currentLevel);
    if (idx === -1) return 'TEAM_LEAD';
    if (idx < ESCALATION_CHAIN.length - 1) return ESCALATION_CHAIN[idx + 1];
    return 'IT_MANAGER';
  }

  /**
   * Scans all open incidents for approaching SLAs, SLA violations, and unacknowledged critical escalations
   */
  async evaluateAllOpenIncidents(referenceTime = new Date()) {
    const allIncidents = await this.incidentRepo.findAll();
    const openIncidents = allIncidents.filter((inc) => !['RESOLVED', 'VERIFIED', 'CLOSED'].includes(inc.status));
    const users = await this.userRepo.findAll();
    const admins = users.filter((u) => u.role === 'ADMIN');

    const summary = {
      evaluatedCount: openIncidents.length,
      warningsTriggered: [],
      violationsDetected: [],
      escalationsTriggered: []
    };

    for (const incident of openIncidents) {
      const prevResponseViolated = incident.slaRecord.responseViolated;
      const prevResolutionViolated = incident.slaRecord.resolutionViolated;
      const prevWarning = incident.slaRecord.warningIssued;

      const statusResult = incident.slaRecord.evaluateCompliance(referenceTime, incident.status, incident.createdAt);
      let modified = false;

      // 1. Check newly issued SLA Approaching Warning
      if (!prevWarning && statusResult.warningIssued && !statusResult.isViolated) {
        modified = true;
        summary.warningsTriggered.push(incident.incidentId);
        await this.eventPublisher.notify('SLA_APPROACHING', {
          incident,
          recipients: admins,
          title: `SLA Approaching Deadline: ${incident.incidentId}`,
          message: `Incident ${incident.incidentId} (${incident.priority}) has consumed over 75% of its resolution SLA window.`,
          description: `SLA warning triggered for ${incident.incidentId} (Resolution deadline: ${incident.slaRecord.resolutionDeadline})`
        });
      }

      // 2. Check Response SLA Violation & Automatic Escalation (Feature C)
      if (!prevResponseViolated && statusResult.responseViolated) {
        modified = true;
        summary.violationsDetected.push({ incidentId: incident.incidentId, type: 'RESPONSE_SLA_VIOLATION' });

        const nextLevel = this.getNextEscalationLevel(
          incident.slaRecord.escalationLevel === 'NONE' ? 'TECHNICIAN' : incident.slaRecord.escalationLevel
        );
        incident.slaRecord.escalationLevel = nextLevel;
        incident.slaRecord.escalationHistory.push({
          level: nextLevel,
          reason: 'Unacknowledged past Response SLA target',
          timestamp: new Date(referenceTime).toISOString()
        });
        summary.escalationsTriggered.push({ incidentId: incident.incidentId, escalatedTo: nextLevel });

        await this.eventPublisher.notify('SLA_VIOLATED', {
          incident,
          recipients: admins,
          title: `SLA Violated & Escalated to ${nextLevel}: ${incident.incidentId}`,
          message: `Response SLA breached for ${incident.incidentId}. Automatically escalated to ${nextLevel}.`,
          description: `Response SLA violated; automatically escalated along hierarchy to ${nextLevel}`
        });
      }

      // 3. Check Resolution SLA Violation
      if (!prevResolutionViolated && statusResult.resolutionViolated) {
        modified = true;
        summary.violationsDetected.push({ incidentId: incident.incidentId, type: 'RESOLUTION_SLA_VIOLATION' });

        const nextLevel = this.getNextEscalationLevel(
          incident.slaRecord.escalationLevel === 'NONE' ? 'TEAM_LEAD' : incident.slaRecord.escalationLevel
        );
        incident.slaRecord.escalationLevel = nextLevel;
        incident.slaRecord.escalationHistory.push({
          level: nextLevel,
          reason: 'Unresolved past Resolution SLA target',
          timestamp: new Date(referenceTime).toISOString()
        });
        summary.escalationsTriggered.push({ incidentId: incident.incidentId, escalatedTo: nextLevel });

        await this.eventPublisher.notify('SLA_VIOLATED', {
          incident,
          recipients: admins,
          title: `Resolution SLA Violated (${nextLevel}): ${incident.incidentId}`,
          message: `Resolution SLA breached for ${incident.incidentId}. Escalated to ${nextLevel}.`,
          description: `Resolution SLA violated; escalated to ${nextLevel}`
        });
      }

      if (modified) {
        await this.incidentRepo.save(incident);
      }
    }

    return summary;
  }

  /**
   * Explicitly escalate an incident one step up the hierarchy:
   * TECHNICIAN -> TEAM_LEAD -> SYSTEM_ADMIN -> IT_MANAGER
   */
  async escalateIncident(incidentId, reason = 'Manual or automated SLA escalation', actor = null) {
    const incident = await this.incidentRepo.findByKey(incidentId);
    if (!incident) return null;

    const current = incident.slaRecord.escalationLevel === 'NONE' ? 'TECHNICIAN' : incident.slaRecord.escalationLevel;
    const nextLevel = this.getNextEscalationLevel(current);
    incident.slaRecord.escalationLevel = nextLevel;
    incident.slaRecord.escalationHistory.push({
      level: nextLevel,
      reason,
      timestamp: new Date().toISOString()
    });

    await this.incidentRepo.save(incident);
    const users = await this.userRepo.findAll();
    const admins = users.filter((u) => u.role === 'ADMIN');

    await this.eventPublisher.notify('INCIDENT_ESCALATED', {
      incident,
      actor,
      recipients: admins,
      title: `Incident Escalated to ${nextLevel}: ${incident.incidentId}`,
      message: `Incident ${incident.incidentId} escalated from ${current} to ${nextLevel}. Reason: ${reason}`,
      description: `Escalated ${incident.incidentId} from ${current} -> ${nextLevel} (${reason})`
    });

    return incident;
  }
}

module.exports = { SLAMonitorService, ESCALATION_CHAIN };
