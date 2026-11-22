const { TechnicianUnavailableException, TechnicianWorkloadExceededException } = require('../../exceptions/AppExceptions');

/**
 * Strategy Pattern: Intelligent Technician Assignment (PDF Page 6)
 * Implements 4 interchangeable strategies:
 * 1. SkillBasedAssignmentStrategy
 * 2. LoadBasedAssignmentStrategy
 * 3. RoundRobinAssignmentStrategy
 * 4. ExperienceBasedAssignmentStrategy
 */
class AssignmentStrategy {
  constructor(name) {
    if (new.target === AssignmentStrategy) {
      throw new Error('AssignmentStrategy is an abstract strategy interface.');
    }
    this.name = name;
  }

  filterEligible(technicians) {
    if (!Array.isArray(technicians) || technicians.length === 0) {
      throw new TechnicianUnavailableException('No technicians registered in the system.');
    }
    const activeAndAvailable = technicians.filter((t) => t.active && t.available);
    if (activeAndAvailable.length === 0) {
      throw new TechnicianUnavailableException('All technicians are currently marked offline/unavailable.');
    }
    const withCapacity = activeAndAvailable.filter((t) => t.currentWorkload < t.maxWorkload);
    if (withCapacity.length === 0) {
      throw new TechnicianWorkloadExceededException(
        activeAndAvailable.map((t) => t.name).join(', '),
        activeAndAvailable[0].maxWorkload
      );
    }
    return withCapacity;
  }

  selectTechnician(incident, technicians) {
    throw new Error('Subclasses must implement selectTechnician(incident, technicians)');
  }
}

/**
 * Strategy 1: Skill-Based Assignment (Matches incident category + service experience, tie-breaks by lower load)
 */
class SkillBasedAssignmentStrategy extends AssignmentStrategy {
  constructor() {
    super('SKILL_BASED');
  }

  selectTechnician(incident, technicians) {
    const eligible = this.filterEligible(technicians);
    const scored = eligible.map((tech) => {
      let score = 0;
      if (tech.hasSkill(incident.category)) score += 50;
      if (tech.hasServiceExperience(incident.serviceId)) score += 30;
      score += Math.min(20, tech.experienceYears * 3);
      score -= (tech.currentWorkload / tech.maxWorkload) * 25;
      return { tech, score };
    });

    scored.sort((a, b) => b.score - a.score || a.tech.currentWorkload - b.tech.currentWorkload);
    return scored[0].tech;
  }
}

/**
 * Strategy 2: Load-Based Assignment (Assigns to technician with lowest current workload ratio)
 */
class LoadBasedAssignmentStrategy extends AssignmentStrategy {
  constructor() {
    super('LOAD_BASED');
  }

  selectTechnician(incident, technicians) {
    const eligible = this.filterEligible(technicians);
    const sorted = [...eligible].sort((a, b) => {
      const ratioA = a.currentWorkload / a.maxWorkload;
      const ratioB = b.currentWorkload / b.maxWorkload;
      if (ratioA !== ratioB) return ratioA - ratioB;
      // Tie-break by skill match
      const skillA = a.hasSkill(incident.category) ? 1 : 0;
      const skillB = b.hasSkill(incident.category) ? 1 : 0;
      return skillB - skillA;
    });
    return sorted[0];
  }
}

/**
 * Strategy 3: Round-Robin Assignment (Cycles evenly across eligible technicians)
 */
class RoundRobinAssignmentStrategy extends AssignmentStrategy {
  constructor() {
    super('ROUND_ROBIN');
    this.lastAssignedIndex = -1;
  }

  selectTechnician(incident, technicians) {
    const eligible = this.filterEligible(technicians);
    this.lastAssignedIndex = (this.lastAssignedIndex + 1) % eligible.length;
    return eligible[this.lastAssignedIndex];
  }
}

/**
 * Strategy 4: Experience-Based Assignment (Prioritizes senior technicians for P1/P2 critical incidents)
 */
class ExperienceBasedAssignmentStrategy extends AssignmentStrategy {
  constructor() {
    super('EXPERIENCE_BASED');
  }

  selectTechnician(incident, technicians) {
    const eligible = this.filterEligible(technicians);
    const sorted = [...eligible].sort((a, b) => {
      const serviceExpA = a.hasServiceExperience(incident.serviceId) ? 1 : 0;
      const serviceExpB = b.hasServiceExperience(incident.serviceId) ? 1 : 0;
      if (serviceExpA !== serviceExpB) return serviceExpB - serviceExpA;
      if (b.experienceYears !== a.experienceYears) return b.experienceYears - a.experienceYears;
      return a.currentWorkload - b.currentWorkload;
    });
    return sorted[0];
  }
}

const ASSIGNMENT_STRATEGIES = {
  SKILL_BASED: new SkillBasedAssignmentStrategy(),
  LOAD_BASED: new LoadBasedAssignmentStrategy(),
  ROUND_ROBIN: new RoundRobinAssignmentStrategy(),
  EXPERIENCE_BASED: new ExperienceBasedAssignmentStrategy()
};

module.exports = {
  AssignmentStrategy,
  SkillBasedAssignmentStrategy,
  LoadBasedAssignmentStrategy,
  RoundRobinAssignmentStrategy,
  ExperienceBasedAssignmentStrategy,
  ASSIGNMENT_STRATEGIES
};
