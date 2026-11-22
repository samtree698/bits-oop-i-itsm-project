/**
 * Strategy Pattern: Priority Determination (PDF Page 5-6)
 * Priority Score = Impact * Urgency * Business Criticality
 * Maps score to P1 (Critical), P2 (High), P3 (Medium), P4 (Low)
 */
class PriorityStrategy {
  constructor(name) {
    if (new.target === PriorityStrategy) {
      throw new Error('PriorityStrategy is an abstract strategy interface.');
    }
    this.name = name;
  }

  calculatePriority(incidentInput, service) {
    throw new Error('Subclasses must implement calculatePriority(incidentInput, service)');
  }
}

/**
 * Strategy 1: RuleBasedPriorityStrategy (Exact PDF Formula: Impact * Urgency * Business Criticality)
 * Impact: 1..3, Urgency: 1..3, Business Criticality: 1..5 -> Score range: 1..45
 */
class RuleBasedPriorityStrategy extends PriorityStrategy {
  constructor() {
    super('RULE_BASED');
  }

  calculatePriority(incidentInput, service) {
    const impact = Math.min(3, Math.max(1, Number(incidentInput.impact || 2)));
    const urgency = Math.min(3, Math.max(1, Number(incidentInput.urgency || 2)));
    const criticality = Math.min(5, Math.max(1, Number(service?.businessCriticality ?? incidentInput.businessCriticality ?? 3)));

    const score = impact * urgency * criticality;
    let priority = 'P4';
    if (score >= 27) {
      priority = 'P1'; // Critical
    } else if (score >= 15) {
      priority = 'P2'; // High
    } else if (score >= 6) {
      priority = 'P3'; // Medium
    } else {
      priority = 'P4'; // Low
    }

    return {
      priority,
      priorityScore: score,
      strategyUsed: this.name,
      rationale: `Rule-Based Formula: Impact(${impact}) × Urgency(${urgency}) × Criticality(${criticality}) = ${score} -> ${priority}`
    };
  }
}

/**
 * Strategy 2: WeightedScoringPriorityStrategy
 * Incorporates number of affected users alongside Impact, Urgency, and Service Criticality
 */
class WeightedScoringPriorityStrategy extends PriorityStrategy {
  constructor() {
    super('WEIGHTED_SCORING');
  }

  calculatePriority(incidentInput, service) {
    const impact = Math.min(3, Math.max(1, Number(incidentInput.impact || 2)));
    const urgency = Math.min(3, Math.max(1, Number(incidentInput.urgency || 2)));
    const criticality = Math.min(5, Math.max(1, Number(service?.businessCriticality ?? incidentInput.businessCriticality ?? 3)));
    const affectedUsers = Math.max(1, Number(incidentInput.affectedUsers || 1));

    const userScaleBonus = affectedUsers >= 100 ? 15 : affectedUsers >= 25 ? 10 : affectedUsers >= 5 ? 5 : 0;
    const weightedScore = Math.round(impact * 8 + urgency * 7 + criticality * 4 + userScaleBonus);

    let priority = 'P4';
    if (weightedScore >= 52) {
      priority = 'P1';
    } else if (weightedScore >= 38) {
      priority = 'P2';
    } else if (weightedScore >= 24) {
      priority = 'P3';
    } else {
      priority = 'P4';
    }

    return {
      priority,
      priorityScore: weightedScore,
      strategyUsed: this.name,
      rationale: `Weighted Score: Impact(${impact}*8) + Urgency(${urgency}*7) + Criticality(${criticality}*4) + UsersBonus(${userScaleBonus}) = ${weightedScore} -> ${priority}`
    };
  }
}

const PRIORITY_STRATEGIES = {
  RULE_BASED: new RuleBasedPriorityStrategy(),
  WEIGHTED_SCORING: new WeightedScoringPriorityStrategy()
};

module.exports = {
  PriorityStrategy,
  RuleBasedPriorityStrategy,
  WeightedScoringPriorityStrategy,
  PRIORITY_STRATEGIES
};
