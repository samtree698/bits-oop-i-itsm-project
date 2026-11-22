const { InvalidStateTransitionException } = require('../../exceptions/AppExceptions');

/**
 * State Pattern for Incident Lifecycle (PDF Page 7)
 * Lifecycle: NEW -> CLASSIFIED -> ASSIGNED -> ACKNOWLEDGED -> IN_PROGRESS -> RESOLVED -> VERIFIED -> CLOSED
 * Prevents invalid transitions such as NEW -> CLOSED
 */
class IncidentState {
  constructor(name, allowedNextStates = []) {
    if (new.target === IncidentState) {
      throw new Error('IncidentState is an abstract state contract.');
    }
    this.name = name;
    this.allowedNextStates = allowedNextStates;
  }

  canTransitionTo(targetState) {
    return this.allowedNextStates.includes(targetState);
  }

  validateTransition(targetState) {
    if (!this.canTransitionTo(targetState)) {
      throw new InvalidStateTransitionException(
        this.name,
        targetState,
        `Allowed transitions from '${this.name}' are: [${this.allowedNextStates.join(', ') || 'NONE'}].`
      );
    }
  }
}

class NewState extends IncidentState {
  constructor() {
    super('NEW', ['CLASSIFIED']);
  }
}

class ClassifiedState extends IncidentState {
  constructor() {
    super('CLASSIFIED', ['ASSIGNED']);
  }
}

class AssignedState extends IncidentState {
  constructor() {
    super('ASSIGNED', ['ACKNOWLEDGED', 'ASSIGNED']); // ASSIGNED -> ASSIGNED allowed for reassignment/escalation
  }
}

class AcknowledgedState extends IncidentState {
  constructor() {
    super('ACKNOWLEDGED', ['IN_PROGRESS', 'ASSIGNED']);
  }
}

class InProgressState extends IncidentState {
  constructor() {
    super('IN_PROGRESS', ['RESOLVED', 'ASSIGNED']);
  }
}

class ResolvedState extends IncidentState {
  constructor() {
    super('RESOLVED', ['VERIFIED', 'IN_PROGRESS']); // Can reopen to IN_PROGRESS if verification fails
  }
}

class VerifiedState extends IncidentState {
  constructor() {
    super('VERIFIED', ['CLOSED']);
  }
}

class ClosedState extends IncidentState {
  constructor() {
    super('CLOSED', []);
  }
}

const STATE_REGISTRY = {
  NEW: new NewState(),
  CLASSIFIED: new ClassifiedState(),
  ASSIGNED: new AssignedState(),
  ACKNOWLEDGED: new AcknowledgedState(),
  IN_PROGRESS: new InProgressState(),
  RESOLVED: new ResolvedState(),
  VERIFIED: new VerifiedState(),
  CLOSED: new ClosedState()
};

class IncidentStateFactory {
  static getState(stateName) {
    const state = STATE_REGISTRY[stateName];
    if (!state) {
      throw new InvalidStateTransitionException('UNKNOWN', stateName, `Unknown incident state '${stateName}'.`);
    }
    return state;
  }
}

module.exports = {
  IncidentState,
  IncidentStateFactory,
  STATE_REGISTRY
};
