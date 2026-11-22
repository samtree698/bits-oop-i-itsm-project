const { InvalidUserInputException } = require('../exceptions/AppExceptions');

/**
 * SLAPolicy Domain Class (PDF Page 6-7)
 * P1: 5 mins response / 30 mins resolution
 * P2: 15 mins response / 120 mins (2 hrs) resolution
 * P3: 60 mins (1 hr) response / 480 mins (8 hrs) resolution
 * P4: 240 mins (4 hrs) response / 1440 mins (24 hrs) resolution
 */
class SLAPolicy {
  constructor({ priority, label, responseMinutes, resolutionMinutes, warningThresholdRatio = 0.75 }) {
    if (!['P1', 'P2', 'P3', 'P4'].includes(priority)) {
      throw new InvalidUserInputException(`Invalid SLA priority level '${priority}'. Must be P1, P2, P3, or P4.`);
    }
    if (Number(responseMinutes) <= 0 || Number(resolutionMinutes) <= 0) {
      throw new InvalidUserInputException('SLA response and resolution targets must be positive minutes.');
    }
    this.priority = priority;
    this.label = label || priority;
    this.responseMinutes = Number(responseMinutes);
    this.resolutionMinutes = Number(resolutionMinutes);
    this.warningThresholdRatio = Number(warningThresholdRatio);
  }

  calculateDeadlines(creationTime = new Date()) {
    const startMs = new Date(creationTime).getTime();
    const responseDeadline = new Date(startMs + this.responseMinutes * 60 * 1000).toISOString();
    const resolutionDeadline = new Date(startMs + this.resolutionMinutes * 60 * 1000).toISOString();
    return {
      priority: this.priority,
      responseMinutes: this.responseMinutes,
      resolutionMinutes: this.resolutionMinutes,
      responseDeadline,
      resolutionDeadline
    };
  }

  toJSON() {
    return {
      priority: this.priority,
      label: this.label,
      responseMinutes: this.responseMinutes,
      resolutionMinutes: this.resolutionMinutes,
      warningThresholdRatio: this.warningThresholdRatio
    };
  }
}

module.exports = { SLAPolicy };
