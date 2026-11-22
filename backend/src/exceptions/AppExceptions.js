/**
 * OOP Custom Exception Hierarchy (PDF Page 12-13)
 * Demonstrates Inheritance, Encapsulation, and Polymorphic HTTP Error Mapping
 */
class ITSMException extends Error {
  constructor(message, statusCode = 400, errorCode = 'ITSM_ERROR', details = null) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    this.timestamp = new Date().toISOString();
    Error.captureStackTrace?.(this, this.constructor);
  }

  toJSON() {
    return {
      success: false,
      error: {
        type: this.name,
        code: this.errorCode,
        message: this.message,
        details: this.details,
        timestamp: this.timestamp
      }
    };
  }
}

class InvalidLoginException extends ITSMException {
  constructor(message = 'Invalid email or password credentials provided.') {
    super(message, 401, 'INVALID_LOGIN');
  }
}

class UnauthorizedOperationException extends ITSMException {
  constructor(message = 'You are not authorized to perform this operation.') {
    super(message, 403, 'UNAUTHORIZED_OPERATION');
  }
}

class InvalidIncidentException extends ITSMException {
  constructor(message = 'Incident payload is invalid or missing required attributes.', details = null) {
    super(message, 400, 'INVALID_INCIDENT', details);
  }
}

class InvalidStateTransitionException extends ITSMException {
  constructor(currentState, targetState, reason = '') {
    const msg = `Invalid state transition from '${currentState}' to '${targetState}'. ${reason}`.trim();
    super(msg, 400, 'INVALID_STATE_TRANSITION', { currentState, targetState });
  }
}

class TechnicianUnavailableException extends ITSMException {
  constructor(message = 'No suitable technician is currently available for assignment.') {
    super(message, 409, 'TECHNICIAN_UNAVAILABLE');
  }
}

class TechnicianWorkloadExceededException extends ITSMException {
  constructor(technicianName, maxWorkload) {
    super(
      `Technician '${technicianName}' has reached maximum workload capacity (${maxWorkload}).`,
      409,
      'TECHNICIAN_WORKLOAD_EXCEEDED',
      { technicianName, maxWorkload }
    );
  }
}

class ServiceNotFoundException extends ITSMException {
  constructor(serviceId) {
    super(`Affected IT Service '${serviceId}' was not found in the service catalog.`, 404, 'SERVICE_NOT_FOUND');
  }
}

class MissingSLAConfigurationException extends ITSMException {
  constructor(priority) {
    super(`No SLA Policy configuration found for priority '${priority}'.`, 500, 'MISSING_SLA_CONFIGURATION');
  }
}

class DuplicateIncidentException extends ITSMException {
  constructor(existingIncidentId, similarityScore) {
    super(
      `Duplicate incident detected matching active incident '${existingIncidentId}' (similarity: ${Math.round(similarityScore * 100)}%).`,
      409,
      'DUPLICATE_INCIDENT',
      { existingIncidentId, similarityScore }
    );
  }
}

class DatabaseFailureException extends ITSMException {
  constructor(operation, originalError = '') {
    super(`Database persistence failure during '${operation}': ${originalError}`, 503, 'DATABASE_FAILURE');
  }
}

class NetworkFailureException extends ITSMException {
  constructor(serviceName = 'External Gateway') {
    super(`Network communication failure while reaching '${serviceName}'.`, 503, 'NETWORK_FAILURE');
  }
}

class InvalidUserInputException extends ITSMException {
  constructor(message = 'Invalid user input supplied.', fieldErrors = null) {
    super(message, 400, 'INVALID_USER_INPUT', fieldErrors);
  }
}

module.exports = {
  ITSMException,
  InvalidLoginException,
  UnauthorizedOperationException,
  InvalidIncidentException,
  InvalidStateTransitionException,
  TechnicianUnavailableException,
  TechnicianWorkloadExceededException,
  ServiceNotFoundException,
  MissingSLAConfigurationException,
  DuplicateIncidentException,
  DatabaseFailureException,
  NetworkFailureException,
  InvalidUserInputException
};
