const crypto = require('crypto');
const { InvalidUserInputException, TechnicianWorkloadExceededException } = require('../exceptions/AppExceptions');

/**
 * Abstract Base Class: User
 * Demonstrates Abstraction, Encapsulation (#passwordHash), Inheritance, and Polymorphism
 */
class User {
  #passwordHash;

  constructor({ id, name, email, passwordHash, password, role, active = true, createdAt = new Date().toISOString() }) {
    if (new.target === User) {
      throw new Error('User is an abstract class and cannot be instantiated directly.');
    }
    if (!name || !email) {
      throw new InvalidUserInputException('User name and email are required.');
    }
    this.id = id || `USR-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    this.name = name.trim();
    this.email = email.trim().toLowerCase();
    this.role = role;
    this.active = Boolean(active);
    this.createdAt = createdAt;

    if (passwordHash) {
      this.#passwordHash = passwordHash;
    } else if (password) {
      this.#passwordHash = User.hashPassword(password);
    } else {
      throw new InvalidUserInputException('User requires a password or passwordHash.');
    }
  }

  static hashPassword(plainPassword) {
    if (!plainPassword || String(plainPassword).length < 4) {
      throw new InvalidUserInputException('Password must be at least 4 characters long.');
    }
    return crypto.createHash('sha256').update(`bits_itsm_salt_${plainPassword}`).digest('hex');
  }

  verifyPassword(plainPassword) {
    if (!plainPassword) return false;
    return this.#passwordHash === User.hashPassword(plainPassword);
  }

  getPasswordHash() {
    return this.#passwordHash;
  }

  // Abstract polymorphic methods to be overridden by subclasses
  getPermissions() {
    throw new Error('Subclasses must implement getPermissions()');
  }

  canTransitionTo(targetState) {
    throw new Error('Subclasses must implement canTransitionTo()');
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      email: this.email,
      role: this.role,
      active: this.active,
      createdAt: this.createdAt,
      permissions: this.getPermissions()
    };
  }

  toPersistence() {
    return {
      ...this.toJSON(),
      passwordHash: this.#passwordHash
    };
  }
}

/**
 * Employee / Customer Subclass
 */
class Employee extends User {
  constructor(props) {
    super({ ...props, role: 'EMPLOYEE' });
    this.department = props.department || 'General Operations';
    this.location = props.location || 'Hyderabad Campus';
  }

  getPermissions() {
    return [
      'INCIDENT_CREATE',
      'INCIDENT_VIEW_OWN',
      'INCIDENT_ADD_INFO',
      'INCIDENT_RESPOND_REQUEST',
      'INCIDENT_PROVIDE_FEEDBACK',
      'INCIDENT_VERIFY'
    ];
  }

  canTransitionTo(targetState) {
    return ['NEW', 'VERIFIED', 'CLOSED'].includes(targetState);
  }

  toJSON() {
    return {
      ...super.toJSON(),
      department: this.department,
      location: this.location
    };
  }
}

/**
 * Technician / Support Engineer Subclass
 */
class Technician extends User {
  constructor(props) {
    super({ ...props, role: props.role || 'TECHNICIAN' });
    this.skills = Array.isArray(props.skills) ? props.skills : ['Software', 'Application'];
    this.serviceExperience = Array.isArray(props.serviceExperience) ? props.serviceExperience : [];
    this.experienceYears = Number(props.experienceYears ?? 2);
    this.currentWorkload = Number(props.currentWorkload ?? 0);
    this.maxWorkload = Number(props.maxWorkload ?? 5);
    this.available = props.available !== undefined ? Boolean(props.available) : true;
    this.escalationRole = props.escalationRole || 'TECHNICIAN'; // TECHNICIAN | TEAM_LEAD | SYS_ADMIN | IT_MANAGER
  }

  getPermissions() {
    return [
      'INCIDENT_VIEW_ASSIGNED',
      'INCIDENT_ACKNOWLEDGE',
      'INCIDENT_INVESTIGATE',
      'INCIDENT_ADD_NOTE',
      'INCIDENT_REQUEST_INFO',
      'INCIDENT_RESOLVE',
      'WORKLOAD_VIEW'
    ];
  }

  canTransitionTo(targetState) {
    return ['ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED'].includes(targetState);
  }

  hasSkill(category) {
    if (!category) return false;
    return this.skills.some((s) => s.toLowerCase() === category.toLowerCase());
  }

  hasServiceExperience(serviceId) {
    return this.serviceExperience.includes(serviceId);
  }

  canAcceptAssignment() {
    return this.active && this.available && this.currentWorkload < this.maxWorkload;
  }

  incrementWorkload() {
    if (this.currentWorkload >= this.maxWorkload) {
      throw new TechnicianWorkloadExceededException(this.name, this.maxWorkload);
    }
    this.currentWorkload += 1;
  }

  decrementWorkload() {
    this.currentWorkload = Math.max(0, this.currentWorkload - 1);
  }

  toJSON() {
    return {
      ...super.toJSON(),
      skills: this.skills,
      serviceExperience: this.serviceExperience,
      experienceYears: this.experienceYears,
      currentWorkload: this.currentWorkload,
      maxWorkload: this.maxWorkload,
      available: this.available,
      escalationRole: this.escalationRole
    };
  }
}

/**
 * Administrator / IT Manager Subclass
 */
class Administrator extends User {
  constructor(props) {
    super({ ...props, role: 'ADMIN' });
    this.accessLevel = props.accessLevel || 'IT_MANAGER';
  }

  getPermissions() {
    return [
      'USER_MANAGE',
      'TECHNICIAN_MANAGE',
      'SERVICE_MANAGE',
      'SLA_CONFIGURE',
      'CATEGORY_CONFIGURE',
      'STRATEGY_CONFIGURE',
      'INCIDENT_MONITOR_ALL',
      'INCIDENT_ASSIGN',
      'INCIDENT_VERIFY',
      'INCIDENT_CLOSE',
      'REPORT_VIEW',
      'AUDIT_VIEW',
      'SLA_MONITOR'
    ];
  }

  canTransitionTo(targetState) {
    return ['NEW', 'CLASSIFIED', 'ASSIGNED', 'ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED', 'VERIFIED', 'CLOSED'].includes(
      targetState
    );
  }

  toJSON() {
    return {
      ...super.toJSON(),
      accessLevel: this.accessLevel
    };
  }
}

module.exports = {
  User,
  Employee,
  Technician,
  Administrator
};
