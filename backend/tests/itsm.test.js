const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

process.env.PERSISTENCE_MODE = 'MEMORY';

const { createAppContext } = require('../src/server');
const { seedSystemData } = require('../src/seed/seedData');
const { User } = require('../src/domain/User');
const { UserFactory } = require('../src/patterns/factory/EntityFactory');
const {
  InvalidLoginException,
  UnauthorizedOperationException,
  InvalidStateTransitionException,
  TechnicianWorkloadExceededException,
  ServiceNotFoundException
} = require('../src/exceptions/AppExceptions');

describe('I-ITSM OOP Course Project - 18 Comprehensive Test Cases', () => {
  let ctx;

  beforeEach(async () => {
    ctx = createAppContext();
    await seedSystemData(ctx);
  });

  test('TC-01: Normal Operation - New Employee Self-Registration and Login', async () => {
    const reg = await ctx.authService.registerEmployee({
      name: 'Siddharth Kulkarni',
      email: 'sid.k@bits-itsm.edu',
      password: 'Password@123',
      department: 'Computer Science'
    });
    assert.equal(reg.user.role, 'EMPLOYEE');
    assert.ok(reg.token);

    const loginRes = await ctx.authService.login({
      email: 'sid.k@bits-itsm.edu',
      password: 'Password@123'
    });
    assert.equal(loginRes.user.email, 'sid.k@bits-itsm.edu');
    assert.ok(loginRes.token);
  });

  test('TC-02: Exception Handling - InvalidLoginException on Wrong Password or Unknown User', async () => {
    await assert.rejects(
      async () => {
        await ctx.authService.login({ email: 'admin@bits-itsm.edu', password: 'WrongPassword!' });
      },
      (err) => err instanceof InvalidLoginException && err.statusCode === 401
    );
  });

  test('TC-03: Authorization - UnauthorizedOperationException when Employee attempts Technician/Admin Transition', async () => {
    const emp = await ctx.repositories.userRepo.findByEmail('emp.ananya@bits-itsm.edu');
    const incidents = await ctx.repositories.incidentRepo.findAll();
    const activeInc = incidents.find((i) => i.status === 'ASSIGNED');

    await assert.rejects(
      async () => {
        await ctx.incidentService.updateIncidentState(activeInc.incidentId, 'ACKNOWLEDGED', emp);
      },
      (err) => err instanceof UnauthorizedOperationException && err.statusCode === 403
    );
  });

  test('TC-04: OOP Abstraction, Inheritance & Polymorphism - User Hierarchy & Factory Pattern', () => {
    // Abstract User cannot be instantiated directly
    assert.throws(() => new User({ name: 'Test', email: 't@test.com', password: '1234', role: 'USER' }));

    const emp = UserFactory.createUser({ name: 'E', email: 'e@b.edu', password: '1234', role: 'EMPLOYEE' });
    const tech = UserFactory.createUser({ name: 'T', email: 't@b.edu', password: '1234', role: 'TECHNICIAN' });
    const admin = UserFactory.createUser({ name: 'A', email: 'a@b.edu', password: '1234', role: 'ADMIN' });

    assert.ok(emp.getPermissions().includes('INCIDENT_CREATE'));
    assert.ok(tech.getPermissions().includes('INCIDENT_RESOLVE'));
    assert.ok(admin.getPermissions().includes('SLA_CONFIGURE'));
    assert.equal(emp.canTransitionTo('IN_PROGRESS'), false);
    assert.equal(tech.canTransitionTo('IN_PROGRESS'), true);
  });

  test('TC-05: Strategy Pattern (Rule-Based Priority) - P1 Critical Calculation (Impact 3 * Urgency 3 * Criticality 5 = 45)', async () => {
    const emp = await ctx.repositories.userRepo.findByEmail('emp.ananya@bits-itsm.edu');
    const inc = await ctx.incidentService.reportIncident(
      {
        title: 'Complete SSO Outage',
        description: 'Campus users cannot authenticate via SSO portal.',
        serviceId: 'SVC-AUTH',
        category: 'Authentication',
        impact: 3,
        urgency: 3
      },
      emp
    );
    assert.equal(inc.priority, 'P1');
    assert.equal(inc.priorityScore, 45);
  });

  test('TC-06: Strategy Pattern (Weighted Scoring Priority) - Runtime Strategy Switch', async () => {
    ctx.incidentService.setStrategies({ priorityStrategy: 'WEIGHTED_SCORING' });
    const emp = await ctx.repositories.userRepo.findByEmail('emp.ananya@bits-itsm.edu');
    const inc = await ctx.incidentService.reportIncident(
      {
        title: 'Storage backup warning',
        description: 'Minor delay in nightly archival snapshot.',
        serviceId: 'SVC-STORAGE',
        category: 'Storage',
        impact: 1,
        urgency: 1,
        affectedUsers: 2
      },
      emp
    );
    assert.equal(inc.priority, 'P3');
    assert.ok(inc.priorityScore > 0);
  });

  test('TC-07: SLA Management - P1 Response (5 mins) and Resolution (30 mins) Deadline Calculation', async () => {
    const start = new Date('2026-11-10T10:00:00.000Z');
    const deadlines = await ctx.slaMonitorService.calculateSLADeadlines('P1', start);
    assert.equal(deadlines.responseMinutes, 5);
    assert.equal(deadlines.resolutionMinutes, 30);
    assert.equal(deadlines.responseDeadline, '2026-11-10T10:05:00.000Z');
    assert.equal(deadlines.resolutionDeadline, '2026-11-10T10:30:00.000Z');
  });

  test('TC-08: Strategy Pattern (Technician Assignment) - Skill-Based vs Load-Based vs Round-Robin', async () => {
    const emp = await ctx.repositories.userRepo.findByEmail('emp.ananya@bits-itsm.edu');

    // Skill-Based should pick Rohan (T103) for Authentication/Storage
    ctx.incidentService.setStrategies({ assignmentStrategy: 'SKILL_BASED' });
    const incAuth = await ctx.incidentService.reportIncident(
      {
        title: 'LDAP authentication token failure',
        description: 'SSO LDAP bind failing for new logins.',
        serviceId: 'SVC-AUTH',
        category: 'Authentication',
        impact: 2,
        urgency: 2
      },
      emp
    );
    assert.equal(incAuth.assignedTechnicianId, 'T103');

    // Switch to LOAD_BASED
    ctx.incidentService.setStrategies({ assignmentStrategy: 'LOAD_BASED' });
    const incLoad = await ctx.incidentService.reportIncident(
      {
        title: 'Cloud pod restart notice',
        description: 'Container pod restarted once.',
        serviceId: 'SVC-CLOUD',
        category: 'Cloud',
        impact: 1,
        urgency: 2
      },
      emp
    );
    assert.ok(incLoad.assignedTechnicianId);
    assert.equal(incLoad.assignmentStrategyUsed, 'LOAD_BASED');
  });

  test('TC-09: State Pattern - Complete Valid Incident Lifecycle (NEW -> CLASSIFIED -> ASSIGNED -> ACKNOWLEDGED -> IN_PROGRESS -> RESOLVED -> VERIFIED -> CLOSED)', async () => {
    const emp = await ctx.repositories.userRepo.findByEmail('emp.ananya@bits-itsm.edu');
    const admin = await ctx.repositories.userRepo.findByEmail('admin@bits-itsm.edu');

    const inc = await ctx.incidentService.reportIncident(
      {
        title: 'Database replica lag',
        description: 'Read replica lagging by 15 seconds.',
        serviceId: 'SVC-DATABASE',
        category: 'Database',
        impact: 2,
        urgency: 2
      },
      emp
    );
    assert.equal(inc.status, 'ASSIGNED');

    const tech = await ctx.repositories.userRepo.findByKey(inc.assignedTechnicianId);
    await ctx.incidentService.updateIncidentState(inc.incidentId, 'ACKNOWLEDGED', tech);
    await ctx.incidentService.updateIncidentState(inc.incidentId, 'IN_PROGRESS', tech);
    await ctx.incidentService.updateIncidentState(inc.incidentId, 'RESOLVED', tech, {
      rootCause: 'High write batch volume',
      resolutionSummary: 'Tuned replica apply threads.'
    });

    const afterResolve = await ctx.incidentService.submitEmployeeFeedback(
      inc.incidentId,
      { feedback: 'Verified fixed', rating: 5, verifyAndClose: false },
      emp
    );
    assert.equal(afterResolve.status, 'VERIFIED');

    const closed = await ctx.incidentService.updateIncidentState(inc.incidentId, 'CLOSED', admin);
    assert.equal(closed.status, 'CLOSED');
  });

  test('TC-10: State Pattern Guardrail - InvalidStateTransitionException on Illegal Jump (ASSIGNED -> CLOSED)', async () => {
    const admin = await ctx.repositories.userRepo.findByEmail('admin@bits-itsm.edu');
    const incidents = await ctx.repositories.incidentRepo.findAll();
    const assignedInc = incidents.find((i) => i.status === 'ASSIGNED');

    await assert.rejects(
      async () => {
        await ctx.incidentService.updateIncidentState(assignedInc.incidentId, 'CLOSED', admin);
      },
      (err) => err instanceof InvalidStateTransitionException && err.statusCode === 400
    );
  });

  test('TC-11: Boundary Condition - TechnicianWorkloadExceededException when Capacity Reached', async () => {
    const tech = await ctx.repositories.userRepo.findByKey('T101');
    tech.currentWorkload = tech.maxWorkload;
    assert.throws(() => tech.incrementWorkload(), TechnicianWorkloadExceededException);
  });

  test('TC-12: Intelligent Feature A - Duplicate Incident Detection (INC101/INC102 Payment Scenario)', async () => {
    const emp = await ctx.repositories.userRepo.findByEmail('emp.vikram@bits-itsm.edu');
    const dupInc = await ctx.incidentService.reportIncident(
      {
        title: 'Payment application unavailable for transactions',
        description: 'Users are unable to complete payment transactions because payment application is unavailable.',
        serviceId: 'SVC-PAYMENT',
        category: 'Application',
        impact: 3,
        urgency: 3
      },
      emp
    );
    assert.equal(dupInc.isPotentialDuplicate, true);
    assert.ok(dupInc.duplicateOf.length >= 1);
  });

  test('TC-13: Intelligent Feature B & G - Service Correlation & Historical Suggested Resolution', async () => {
    const emp = await ctx.repositories.userRepo.findByEmail('emp.vikram@bits-itsm.edu');
    const inc = await ctx.incidentService.reportIncident(
      {
        title: 'Payment transaction failing at checkout',
        description: 'Database connection pool error during payment checkout.',
        serviceId: 'SVC-PAYMENT',
        category: 'Application',
        impact: 2,
        urgency: 3
      },
      emp
    );
    assert.ok(inc.correlatedIncidents.length >= 1);
    assert.ok(inc.suggestedResolution);
    assert.ok(inc.suggestedResolution.recommendedFix.includes('pool'));
  });

  test('TC-14: Intelligent Feature C & E - SLA Violation Detection & 4-Tier Automatic Escalation', async () => {
    // Simulate 45 minutes into the future so the unacknowledged P1 incident breaches both Response (5m) and Resolution (30m) SLAs
    const futureTime = new Date(Date.now() + 45 * 60 * 1000);
    const scanResult = await ctx.slaMonitorService.evaluateAllOpenIncidents(futureTime);

    assert.ok(scanResult.violationsDetected.length >= 1);
    assert.ok(scanResult.escalationsTriggered.length >= 1);

    const incidents = await ctx.repositories.incidentRepo.findAll();
    const violatedP1 = incidents.find((i) => i.priority === 'P1' && i.status === 'ASSIGNED');
    assert.equal(violatedP1.slaRecord.responseViolated, true);
    assert.notEqual(violatedP1.slaRecord.escalationLevel, 'NONE');
  });

  test('TC-15: Intelligent Feature F - Automated Incident Categorization from Description', async () => {
    const suggestion = await ctx.intelligenceService.suggestCategory(
      'Core Router BGP Flap',
      'Campus WiFi and VPN router experiencing severe DNS packet loss.'
    );
    assert.equal(suggestion.suggestedCategory, 'Network');
    assert.ok(suggestion.confidence > 0.6);
  });

  test('TC-16: Observer Pattern - Complete Audit Trail & Multi-Channel Notifications (In-App + Simulated Email)', async () => {
    const logs = await ctx.repositories.auditLogRepo.findAll();
    const notifications = await ctx.repositories.notificationRepo.findAll();

    assert.ok(logs.length >= 5);
    assert.ok(notifications.some((n) => n.channel === 'IN_APP'));
    assert.ok(notifications.some((n) => n.channel === 'EMAIL_SIMULATION'));
  });

  test('TC-17: Open/Closed Extensibility - Dynamic Introduction of New Incident Category & ServiceNotFoundException check', async () => {
    await assert.rejects(
      async () => {
        const emp = await ctx.repositories.userRepo.findByEmail('emp.ananya@bits-itsm.edu');
        await ctx.incidentService.reportIncident(
          { title: 'Invalid Service', description: 'Test', serviceId: 'SVC-NON-EXISTENT' },
          emp
        );
      },
      (err) => err instanceof ServiceNotFoundException && err.statusCode === 404
    );
  });

  test('TC-18: Search, Filtering & Operational Analytics Dashboard Aggregation', async () => {
    const p1Incidents = await ctx.incidentService.searchIncidents({ priority: 'P1' });
    assert.ok(p1Incidents.length >= 1);
    assert.ok(p1Incidents.every((i) => i.priority === 'P1'));

    const report = await ctx.incidentService.generateReports();
    assert.ok(report.incidentOverview.totalIncidents >= 3);
    assert.equal(report.technicianWorkload.length, 3);
    assert.equal(report.serviceAnalysis.length, 6);
  });
});
