const { PRIORITY_STRATEGIES } = require('../patterns/strategy/PriorityStrategy');
const { ASSIGNMENT_STRATEGIES } = require('../patterns/strategy/AssignmentStrategy');
const { IncidentFactory } = require('../patterns/factory/EntityFactory');
const {
  ServiceNotFoundException,
  InvalidIncidentException,
  UnauthorizedOperationException,
  DuplicateIncidentException
} = require('../exceptions/AppExceptions');

/**
 * IncidentService
 * Orchestrates the 14-step ITSM Problem Scenario (PDF Page 3):
 * 1. Create incident -> 2. Classify -> 3. Identify service -> 4. Business impact ->
 * 5. Calculate priority -> 6. Determine SLA -> 7. Identify technicians -> 8. Assign ->
 * 9. Notify personnel -> 10. Track investigation/resolution -> 11. Monitor SLA ->
 * 12. Record audit trail -> 13. Close after verification -> 14. Reports & analytics.
 */
class IncidentService {
  constructor({
    incidentRepo,
    userRepo,
    serviceRepo,
    categoryRepo,
    slaPolicyRepo,
    auditLogRepo,
    slaMonitorService,
    intelligenceService,
    eventPublisher
  }) {
    this.incidentRepo = incidentRepo;
    this.userRepo = userRepo;
    this.serviceRepo = serviceRepo;
    this.categoryRepo = categoryRepo;
    this.slaPolicyRepo = slaPolicyRepo;
    this.auditLogRepo = auditLogRepo;
    this.slaMonitorService = slaMonitorService;
    this.intelligenceService = intelligenceService;
    this.eventPublisher = eventPublisher;

    // Active Strategy configurations (Runtime swappable by Admin)
    this.activePriorityStrategyKey = 'RULE_BASED';
    this.activeAssignmentStrategyKey = 'SKILL_BASED';
  }

  getActiveStrategies() {
    return {
      priorityStrategy: this.activePriorityStrategyKey,
      availablePriorityStrategies: Object.keys(PRIORITY_STRATEGIES),
      assignmentStrategy: this.activeAssignmentStrategyKey,
      availableAssignmentStrategies: Object.keys(ASSIGNMENT_STRATEGIES)
    };
  }

  setStrategies({ priorityStrategy, assignmentStrategy }) {
    if (priorityStrategy) {
      if (!PRIORITY_STRATEGIES[priorityStrategy]) {
        throw new InvalidIncidentException(`Unknown priority strategy '${priorityStrategy}'.`);
      }
      this.activePriorityStrategyKey = priorityStrategy;
    }
    if (assignmentStrategy) {
      if (!ASSIGNMENT_STRATEGIES[assignmentStrategy]) {
        throw new InvalidIncidentException(`Unknown assignment strategy '${assignmentStrategy}'.`);
      }
      this.activeAssignmentStrategyKey = assignmentStrategy;
    }
    return this.getActiveStrategies();
  }

  /**
   * Steps 1-9: End-to-End Incident Reporting, Classification, Prioritization, SLA, Assignment, Notification & Audit
   */
  async reportIncident(payload, reporterUser) {
    if (!payload.title || !payload.description || !payload.serviceId) {
      throw new InvalidIncidentException('Title, description, and affected serviceId are mandatory.');
    }

    // Step 3 & 4: Identify affected service & business criticality
    const service = await this.serviceRepo.findByKey(payload.serviceId);
    if (!service) {
      throw new ServiceNotFoundException(payload.serviceId);
    }

    // Intelligent Duplicate & Correlation check
    const intel = await this.intelligenceService.detectDuplicatesAndCorrelations({
      title: payload.title,
      description: payload.description,
      serviceId: service.serviceId
    });

    if (payload.rejectOnExactDuplicate && intel.isPotentialDuplicate && intel.duplicates[0].similarityScore >= 0.85) {
      throw new DuplicateIncidentException(intel.duplicates[0].incidentId, intel.duplicates[0].similarityScore);
    }

    // Step 2: Classify the incident (use user-provided category or auto-classify via IntelligenceService)
    let categoryName = payload.category;
    if (!categoryName || categoryName === 'AUTO') {
      const catSuggestion = await this.intelligenceService.suggestCategory(payload.title, payload.description);
      categoryName = catSuggestion.suggestedCategory;
    }

    // Step 5: Calculate Priority using active PriorityStrategy
    const priorityStrategy = PRIORITY_STRATEGIES[this.activePriorityStrategyKey];
    const priorityResult = priorityStrategy.calculatePriority(payload, service);

    // Step 6: Determine applicable SLA & calculate deadlines
    const slaDeadlines = await this.slaMonitorService.calculateSLADeadlines(priorityResult.priority);

    // Step 1: Instantiate Incident via IncidentFactory (starts in NEW state)
    const incidentNumber = await this.incidentRepo.nextIncidentId();
    const incident = IncidentFactory.createIncident({
      payload,
      reporter: reporterUser,
      service,
      categoryName,
      priorityResult,
      slaDeadlines,
      incidentNumber
    });

    // Attach intelligent insights
    incident.isPotentialDuplicate = intel.isPotentialDuplicate;
    incident.duplicateOf = intel.duplicates.map((d) => d.incidentId);
    incident.correlatedIncidents = intel.correlatedIncidents.map((c) => c.incidentId);
    incident.suggestedResolution = await this.intelligenceService.suggestHistoricalResolution({
      title: payload.title,
      description: payload.description,
      category: categoryName,
      serviceId: service.serviceId
    });

    await this.eventPublisher.notify('INCIDENT_CREATED', {
      incident,
      actor: reporterUser,
      previousState: null,
      newState: 'NEW',
      description: `${incident.incidentId} created by ${reporterUser.name} for service '${service.name}'`
    });

    // Transition NEW -> CLASSIFIED
    incident.transitionState('CLASSIFIED');
    await this.eventPublisher.notify('INCIDENT_CLASSIFIED', {
      incident,
      actor: reporterUser,
      previousState: 'NEW',
      newState: 'CLASSIFIED',
      description: `Incident classified as '${categoryName}'; Priority calculated as ${priorityResult.priority} (${priorityResult.rationale})`
    });

    // Step 7 & 8: Identify suitable technician & Assign using active AssignmentStrategy
    const technicians = await this.userRepo.findTechnicians();
    const assignmentStrategy = ASSIGNMENT_STRATEGIES[this.activeAssignmentStrategyKey];

    try {
      const selectedTech = assignmentStrategy.selectTechnician(incident, technicians);
      selectedTech.incrementWorkload();
      await this.userRepo.save(selectedTech);

      incident.assignedTechnicianId = selectedTech.id;
      incident.assignedTechnicianName = selectedTech.name;
      incident.assignmentStrategyUsed = assignmentStrategy.name;
      incident.transitionState('ASSIGNED');

      // Step 9: Notify relevant personnel (Reporter + Assigned Technician) & record Audit
      await this.eventPublisher.notify('INCIDENT_ASSIGNED', {
        incident,
        actor: { id: 'SYSTEM', name: `Auto-Assigner (${assignmentStrategy.name})`, role: 'SYSTEM' },
        previousState: 'CLASSIFIED',
        newState: 'ASSIGNED',
        recipients: [reporterUser, selectedTech],
        title: `Incident ${incident.incidentId} Assigned (${incident.priority})`,
        message: `Incident '${incident.title}' [${incident.priority}] has been assigned to Technician ${selectedTech.name} via ${assignmentStrategy.name}.`,
        description: `Assigned to Technician ${selectedTech.name} (${selectedTech.id}) using ${assignmentStrategy.name}`
      });
    } catch (assignErr) {
      // Keep incident in CLASSIFIED state if all technicians are unavailable or at max capacity
      await this.eventPublisher.notify('ASSIGNMENT_PENDING', {
        incident,
        actor: { id: 'SYSTEM', name: 'Assignment Engine', role: 'SYSTEM' },
        previousState: 'CLASSIFIED',
        newState: 'CLASSIFIED',
        recipients: [reporterUser],
        title: `Incident ${incident.incidentId} Queued for Technician`,
        message: `Incident '${incident.title}' is classified (${incident.priority}) and queued: ${assignErr.message}`,
        description: `Technician auto-assignment deferred: ${assignErr.message}`
      });
    }

    await this.incidentRepo.save(incident);
    return incident;
  }

  /**
   * Manual or Admin Reassignment of an Incident
   */
  async assignIncident(incidentId, technicianId, actorUser) {
    const incident = await this.incidentRepo.findByKey(incidentId);
    if (!incident) throw new InvalidIncidentException(`Incident '${incidentId}' not found.`);

    const tech = await this.userRepo.findByKey(technicianId);
    if (!tech || tech.role !== 'TECHNICIAN') {
      throw new InvalidIncidentException(`Technician '${technicianId}' not found.`);
    }

    if (incident.assignedTechnicianId && incident.assignedTechnicianId !== tech.id) {
      const prevTech = await this.userRepo.findByKey(incident.assignedTechnicianId);
      if (prevTech) {
        prevTech.decrementWorkload();
        await this.userRepo.save(prevTech);
      }
    }

    tech.incrementWorkload();
    await this.userRepo.save(tech);

    const prevState = incident.status;
    if (incident.status === 'NEW') {
      incident.transitionState('CLASSIFIED', actorUser);
    }
    if (['CLASSIFIED', 'ASSIGNED', 'ACKNOWLEDGED', 'IN_PROGRESS'].includes(incident.status)) {
      incident.transitionState('ASSIGNED', actorUser);
    }

    incident.assignedTechnicianId = tech.id;
    incident.assignedTechnicianName = tech.name;
    incident.assignmentStrategyUsed = 'MANUAL_ADMIN_ASSIGNMENT';
    await this.incidentRepo.save(incident);

    const reporter = await this.userRepo.findByKey(incident.reporterId);
    await this.eventPublisher.notify('TECHNICIAN_ASSIGNED', {
      incident,
      actor: actorUser,
      previousState: prevState,
      newState: incident.status,
      recipients: [tech, reporter].filter(Boolean),
      title: `Technician Assigned: ${incident.incidentId}`,
      message: `Incident ${incident.incidentId} is now assigned to ${tech.name}.`,
      description: `Manually assigned to Technician ${tech.name} by ${actorUser.name}`
    });

    return incident;
  }

  /**
   * Step 10: Lifecycle State Transitions (Acknowledge, Start Investigation, Verify, Close)
   */
  async updateIncidentState(incidentId, targetState, actorUser, payload = {}) {
    const incident = await this.incidentRepo.findByKey(incidentId);
    if (!incident) {
      throw new InvalidIncidentException(`Incident '${incidentId}' not found.`);
    }

    // Verify ownership for Technician
    if (
      actorUser.role === 'TECHNICIAN' &&
      incident.assignedTechnicianId &&
      incident.assignedTechnicianId !== actorUser.id
    ) {
      throw new UnauthorizedOperationException('Technicians can only update incidents assigned to them.');
    }

    const previousState = incident.status;

    if (targetState === 'RESOLVED') {
      incident.applyResolution(
        {
          rootCause: payload.rootCause,
          resolutionSummary: payload.resolutionSummary,
          stepsTaken: payload.stepsTaken,
          resolvedBy: actorUser.id,
          resolvedByName: actorUser.name
        },
        actorUser
      );

      // Decrement technician active workload upon resolution
      if (incident.assignedTechnicianId) {
        const tech = await this.userRepo.findByKey(incident.assignedTechnicianId);
        if (tech) {
          tech.decrementWorkload();
          await this.userRepo.save(tech);
        }
      }
    } else {
      incident.transitionState(targetState, actorUser);
    }

    if (payload.note) {
      incident.addInvestigationNote({
        authorId: actorUser.id,
        authorName: actorUser.name,
        authorRole: actorUser.role,
        content: payload.note
      });
    }

    await this.incidentRepo.save(incident);

    const reporter = await this.userRepo.findByKey(incident.reporterId);
    const assignedTech = incident.assignedTechnicianId
      ? await this.userRepo.findByKey(incident.assignedTechnicianId)
      : null;

    await this.eventPublisher.notify(`INCIDENT_${targetState}`, {
      incident,
      actor: actorUser,
      previousState,
      newState: targetState,
      recipients: [reporter, assignedTech].filter(Boolean),
      title: `Incident ${incident.incidentId} is now ${targetState}`,
      message:
        targetState === 'RESOLVED'
          ? `Incident '${incident.title}' has been resolved by ${actorUser.name}: ${incident.resolution.resolutionSummary}`
          : `Incident '${incident.title}' transitioned from ${previousState} to ${targetState}.`,
      description: `State transitioned ${previousState} -> ${targetState} by ${actorUser.name}`
    });

    return incident;
  }

  /**
   * Add Investigation Note / Request Info / Employee Response
   */
  async addNoteOrResponse(incidentId, { content, isInfoRequest = false, isEmployeeResponse = false }, actorUser) {
    const incident = await this.incidentRepo.findByKey(incidentId);
    if (!incident) {
      throw new InvalidIncidentException(`Incident '${incidentId}' not found.`);
    }

    const note = incident.addInvestigationNote({
      authorId: actorUser.id,
      authorName: actorUser.name,
      authorRole: actorUser.role,
      content,
      isInfoRequest,
      isEmployeeResponse
    });

    await this.incidentRepo.save(incident);

    const reporter = await this.userRepo.findByKey(incident.reporterId);
    const assignedTech = incident.assignedTechnicianId
      ? await this.userRepo.findByKey(incident.assignedTechnicianId)
      : null;

    const actionType = isInfoRequest
      ? 'INFO_REQUESTED'
      : isEmployeeResponse
      ? 'EMPLOYEE_INFO_PROVIDED'
      : 'INVESTIGATION_NOTE_ADDED';

    await this.eventPublisher.notify(actionType, {
      incident,
      actor: actorUser,
      previousState: incident.status,
      newState: incident.status,
      recipients: isInfoRequest ? [reporter].filter(Boolean) : [assignedTech].filter(Boolean),
      title: `[${incident.incidentId}] ${actionType.replace(/_/g, ' ')}`,
      message: `${actorUser.name}: "${content}"`,
      description: `${actorUser.name} (${actorUser.role}) added note: ${content}`
    });

    return { incident, note };
  }

  /**
   * Employee Feedback & Verification
   */
  async submitEmployeeFeedback(incidentId, { feedback, rating, verifyAndClose = false }, actorUser) {
    const incident = await this.incidentRepo.findByKey(incidentId);
    if (!incident) {
      throw new InvalidIncidentException(`Incident '${incidentId}' not found.`);
    }
    const prevState = incident.status;
    incident.recordFeedback({ feedback, rating, actorUser, autoVerify: true });

    if (verifyAndClose && incident.status === 'VERIFIED') {
      incident.transitionState('CLOSED', actorUser);
    }

    await this.incidentRepo.save(incident);

    await this.eventPublisher.notify('FEEDBACK_SUBMITTED', {
      incident,
      actor: actorUser,
      previousState: prevState,
      newState: incident.status,
      description: `Employee ${actorUser.name} provided rating ${rating}/5 and feedback: "${feedback}"`
    });

    return incident;
  }

  /**
   * Search and Filtering across all 8 criteria (PDF Page 8-9):
   * 1. Incident ID / Keyword, 2. Date range, 3. Status, 4. Priority,
   * 5. Category, 6. Service, 7. Technician, 8. SLA status
   */
  async searchIncidents(filters = {}, requestingUser = null) {
    const all = await this.incidentRepo.findAll();
    const now = new Date();

    return all
      .map((inc) => inc.toJSON())
      .filter((inc) => {
        if (requestingUser?.role === 'EMPLOYEE' && filters.onlyOwn !== 'false') {
          if (inc.reporterId !== requestingUser.id) return false;
        }
        if (filters.incidentId) {
          const q = String(filters.incidentId).toLowerCase();
          const matchId = inc.incidentId.toLowerCase().includes(q);
          const matchTitle = inc.title.toLowerCase().includes(q);
          if (!matchId && !matchTitle) return false;
        }
        if (filters.status && filters.status !== 'ALL' && inc.status !== filters.status) {
          return false;
        }
        if (filters.priority && filters.priority !== 'ALL' && inc.priority !== filters.priority) {
          return false;
        }
        if (filters.category && filters.category !== 'ALL' && inc.category !== filters.category) {
          return false;
        }
        if (filters.serviceId && filters.serviceId !== 'ALL' && inc.serviceId !== filters.serviceId) {
          return false;
        }
        if (filters.technicianId && filters.technicianId !== 'ALL' && inc.assignedTechnicianId !== filters.technicianId) {
          return false;
        }
        if (filters.slaStatus && filters.slaStatus !== 'ALL' && inc.slaRecord.slaStatus !== filters.slaStatus) {
          return false;
        }
        if (filters.startDate) {
          if (new Date(inc.createdAt) < new Date(filters.startDate)) return false;
        }
        if (filters.endDate) {
          const end = new Date(filters.endDate);
          end.setHours(23, 59, 59, 999);
          if (new Date(inc.createdAt) > end) return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  /**
   * Step 14: Operational Reports & Analytics Dashboard (PDF Page 9)
   * Generates Incident Overview, Technician Workload, and Service Analysis
   */
  async generateReports() {
    const incidents = (await this.incidentRepo.findAll()).map((i) => i.toJSON());
    const technicians = await this.userRepo.findTechnicians();
    const services = await this.serviceRepo.findAll();

    const totalIncidents = incidents.length;
    const openIncidents = incidents.filter((i) => !['RESOLVED', 'VERIFIED', 'CLOSED'].includes(i.status)).length;
    const criticalIncidents = incidents.filter((i) => i.priority === 'P1').length;
    const resolvedIncidents = incidents.filter((i) => ['RESOLVED', 'VERIFIED', 'CLOSED'].includes(i.status)).length;
    const slaViolations = incidents.filter((i) => i.slaRecord.slaStatus === 'VIOLATED').length;
    const slaAtRisk = incidents.filter((i) => i.slaRecord.slaStatus === 'AT_RISK').length;

    const technicianWorkload = technicians.map((tech) => {
      const assignedActive = incidents.filter(
        (i) => i.assignedTechnicianId === tech.id && !['RESOLVED', 'VERIFIED', 'CLOSED'].includes(i.status)
      ).length;
      const resolvedCount = incidents.filter(
        (i) => i.assignedTechnicianId === tech.id && ['RESOLVED', 'VERIFIED', 'CLOSED'].includes(i.status)
      ).length;
      return {
        technicianId: tech.id,
        name: tech.name,
        skills: tech.skills,
        activeIncidents: assignedActive,
        maxWorkload: tech.maxWorkload,
        resolvedIncidents: resolvedCount,
        available: tech.available
      };
    });

    const serviceAnalysis = services.map((svc) => {
      const svcIncidents = incidents.filter((i) => i.serviceId === svc.serviceId);
      return {
        serviceId: svc.serviceId,
        serviceName: svc.name,
        category: svc.category,
        businessCriticality: svc.businessCriticality,
        status: svc.status,
        incidentCount: svcIncidents.length,
        openCount: svcIncidents.filter((i) => !['RESOLVED', 'VERIFIED', 'CLOSED'].includes(i.status)).length,
        slaViolations: svcIncidents.filter((i) => i.slaRecord.slaStatus === 'VIOLATED').length
      };
    });

    const categoryBreakdown = {};
    const priorityBreakdown = { P1: 0, P2: 0, P3: 0, P4: 0 };
    for (const inc of incidents) {
      categoryBreakdown[inc.category] = (categoryBreakdown[inc.category] || 0) + 1;
      if (priorityBreakdown[inc.priority] !== undefined) {
        priorityBreakdown[inc.priority] += 1;
      }
    }

    return {
      incidentOverview: {
        totalIncidents,
        openIncidents,
        criticalIncidents,
        resolvedIncidents,
        slaViolations,
        slaAtRisk
      },
      technicianWorkload,
      serviceAnalysis,
      categoryBreakdown,
      priorityBreakdown
    };
  }
}

module.exports = { IncidentService };
