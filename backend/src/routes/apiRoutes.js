const express = require('express');
const { UserFactory } = require('../patterns/factory/EntityFactory');
const { ITService, IncidentCategory } = require('../domain/ITService');
const { SLAPolicy } = require('../domain/SLAPolicy');
const { createAuthMiddleware } = require('../middleware/authMiddleware');
const { InvalidUserInputException } = require('../exceptions/AppExceptions');

function createApiRouter({
  repositories,
  authService,
  incidentService,
  slaMonitorService,
  intelligenceService,
  seedSystemData
}) {
  const router = express.Router();
  const { userRepo, serviceRepo, categoryRepo, slaPolicyRepo, incidentRepo, auditLogRepo, notificationRepo } =
    repositories;
  const { authenticate, authorizeRoles } = createAuthMiddleware(authService, userRepo);

  // Health & System Info
  router.get('/health', (req, res) => {
    res.json({
      success: true,
      service: 'I-ITSM Enterprise OOP Backend',
      strategies: incidentService.getActiveStrategies(),
      timestamp: new Date().toISOString()
    });
  });

  // Public Catalog metadata for Login/Registration & Reporting
  router.get('/catalog', async (req, res, next) => {
    try {
      const [services, categories, slaPolicies] = await Promise.all([
        serviceRepo.findAll(),
        categoryRepo.findAll(),
        slaPolicyRepo.findAll()
      ]);
      res.json({
        success: true,
        services: services.map((s) => s.toJSON()),
        categories: categories.map((c) => c.toJSON()),
        slaPolicies: slaPolicies.map((p) => p.toJSON()),
        strategies: incidentService.getActiveStrategies()
      });
    } catch (err) {
      next(err);
    }
  });

  // Authentication & Employee Self-Registration
  router.post('/auth/register', async (req, res, next) => {
    try {
      const result = await authService.registerEmployee(req.body);
      res.status(201).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  });

  router.post('/auth/login', async (req, res, next) => {
    try {
      const result = await authService.login(req.body);
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  });

  router.get('/auth/me', authenticate, async (req, res) => {
    res.json({ success: true, user: req.user.toJSON() });
  });

  // Intelligent Pre-Submission Assistant (Auto-Category, Duplicate Detection, Historical Resolution)
  router.post('/intelligence/analyze', authenticate, async (req, res, next) => {
    try {
      const { title = '', description = '', serviceId = '' } = req.body;
      const [catSuggestion, dupResult] = await Promise.all([
        intelligenceService.suggestCategory(title, description),
        intelligenceService.detectDuplicatesAndCorrelations({ title, description, serviceId })
      ]);
      const suggestedResolution = await intelligenceService.suggestHistoricalResolution({
        title,
        description,
        category: catSuggestion.suggestedCategory,
        serviceId
      });
      const recommendedTechnicians = await intelligenceService.recommendTechnicians({
        category: catSuggestion.suggestedCategory,
        serviceId,
        priority: 'P2'
      });

      res.json({
        success: true,
        categorySuggestion: catSuggestion,
        duplicateCheck: dupResult,
        suggestedResolution,
        recommendedTechnicians
      });
    } catch (err) {
      next(err);
    }
  });

  // Incident Management Endpoints
  router.get('/incidents', authenticate, async (req, res, next) => {
    try {
      const incidents = await incidentService.searchIncidents(req.query, req.user);
      res.json({ success: true, count: incidents.length, incidents });
    } catch (err) {
      next(err);
    }
  });

  router.get('/incidents/:incidentId', authenticate, async (req, res, next) => {
    try {
      const incident = await incidentRepo.findByKey(req.params.incidentId);
      if (!incident) {
        return res.status(404).json({ success: false, error: { message: 'Incident not found.' } });
      }
      const auditTrail = await auditLogRepo.findByIncident(incident.incidentId);
      const recommendedTechnicians = await intelligenceService.recommendTechnicians({
        category: incident.category,
        serviceId: incident.serviceId,
        priority: incident.priority
      });
      res.json({
        success: true,
        incident: incident.toJSON(),
        auditTrail: auditTrail.map((a) => a.toJSON()),
        recommendedTechnicians
      });
    } catch (err) {
      next(err);
    }
  });

  router.post('/incidents', authenticate, async (req, res, next) => {
    try {
      const incident = await incidentService.reportIncident(req.body, req.user);
      res.status(201).json({ success: true, incident: incident.toJSON() });
    } catch (err) {
      next(err);
    }
  });

  router.patch('/incidents/:incidentId/state', authenticate, async (req, res, next) => {
    try {
      const { targetState, rootCause, resolutionSummary, stepsTaken, note } = req.body;
      const updated = await incidentService.updateIncidentState(req.params.incidentId, targetState, req.user, {
        rootCause,
        resolutionSummary,
        stepsTaken,
        note
      });
      res.json({ success: true, incident: updated.toJSON() });
    } catch (err) {
      next(err);
    }
  });

  router.post('/incidents/:incidentId/notes', authenticate, async (req, res, next) => {
    try {
      const result = await incidentService.addNoteOrResponse(req.params.incidentId, req.body, req.user);
      res.json({ success: true, incident: result.incident.toJSON(), note: result.note.toJSON() });
    } catch (err) {
      next(err);
    }
  });

  router.post('/incidents/:incidentId/feedback', authenticate, async (req, res, next) => {
    try {
      const updated = await incidentService.submitEmployeeFeedback(req.params.incidentId, req.body, req.user);
      res.json({ success: true, incident: updated.toJSON() });
    } catch (err) {
      next(err);
    }
  });

  router.post('/incidents/:incidentId/assign', authenticate, authorizeRoles('ADMIN'), async (req, res, next) => {
    try {
      const updated = await incidentService.assignIncident(
        req.params.incidentId,
        req.body.technicianId,
        req.user
      );
      res.json({ success: true, incident: updated.toJSON() });
    } catch (err) {
      next(err);
    }
  });

  router.post('/incidents/:incidentId/escalate', authenticate, async (req, res, next) => {
    try {
      const updated = await slaMonitorService.escalateIncident(
        req.params.incidentId,
        req.body.reason || 'Manual escalation triggered',
        req.user
      );
      res.json({ success: true, incident: updated.toJSON() });
    } catch (err) {
      next(err);
    }
  });

  // Technician Availability Toggle
  router.patch('/technicians/:id/availability', authenticate, authorizeRoles('TECHNICIAN', 'ADMIN'), async (req, res, next) => {
    try {
      const tech = await userRepo.findByKey(req.params.id);
      if (!tech || tech.role !== 'TECHNICIAN') {
        throw new InvalidUserInputException('Technician not found.');
      }
      tech.available = Boolean(req.body.available);
      if (Array.isArray(req.body.skills)) {
        tech.skills = req.body.skills;
      }
      await userRepo.save(tech);
      res.json({ success: true, technician: tech.toJSON() });
    } catch (err) {
      next(err);
    }
  });

  // Notifications
  router.get('/notifications', authenticate, async (req, res, next) => {
    try {
      const list = await notificationRepo.findByRecipient(req.user.id);
      res.json({ success: true, notifications: list.map((n) => n.toJSON()) });
    } catch (err) {
      next(err);
    }
  });

  router.patch('/notifications/:id/read', authenticate, async (req, res, next) => {
    try {
      const notif = await notificationRepo.findByKey(req.params.id);
      if (notif) {
        notif.markRead();
        await notificationRepo.save(notif);
      }
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  // Admin Governance Endpoints (Manage Users, Technicians, Services, Categories, SLAs, Strategies, Audit Logs)
  router.get('/admin/users', authenticate, authorizeRoles('ADMIN'), async (req, res, next) => {
    try {
      const users = await userRepo.findAll();
      res.json({ success: true, users: users.map((u) => u.toJSON()) });
    } catch (err) {
      next(err);
    }
  });

  router.post('/admin/users', authenticate, authorizeRoles('ADMIN'), async (req, res, next) => {
    try {
      const existing = await userRepo.findByEmail(req.body.email);
      if (existing) {
        throw new InvalidUserInputException(`Email '${req.body.email}' is already registered.`);
      }
      const newUser = UserFactory.createUser(req.body);
      await userRepo.save(newUser);
      res.status(201).json({ success: true, user: newUser.toJSON() });
    } catch (err) {
      next(err);
    }
  });

  router.patch('/admin/users/:id/status', authenticate, authorizeRoles('ADMIN'), async (req, res, next) => {
    try {
      const user = await userRepo.findByKey(req.params.id);
      if (!user) throw new InvalidUserInputException('User not found.');
      user.active = Boolean(req.body.active);
      await userRepo.save(user);
      res.json({ success: true, user: user.toJSON() });
    } catch (err) {
      next(err);
    }
  });

  router.post('/admin/services', authenticate, authorizeRoles('ADMIN'), async (req, res, next) => {
    try {
      const service = new ITService(req.body);
      await serviceRepo.save(service);
      res.status(201).json({ success: true, service: service.toJSON() });
    } catch (err) {
      next(err);
    }
  });

  router.post('/admin/categories', authenticate, authorizeRoles('ADMIN'), async (req, res, next) => {
    try {
      const category = new IncidentCategory(req.body);
      await categoryRepo.save(category);
      res.status(201).json({ success: true, category: category.toJSON() });
    } catch (err) {
      next(err);
    }
  });

  router.put('/admin/sla-policies/:priority', authenticate, authorizeRoles('ADMIN'), async (req, res, next) => {
    try {
      const policy = new SLAPolicy({ ...req.body, priority: req.params.priority });
      await slaPolicyRepo.save(policy);
      res.json({ success: true, slaPolicy: policy.toJSON() });
    } catch (err) {
      next(err);
    }
  });

  router.put('/admin/strategies', authenticate, authorizeRoles('ADMIN'), async (req, res, next) => {
    try {
      const updated = incidentService.setStrategies(req.body);
      res.json({ success: true, strategies: updated });
    } catch (err) {
      next(err);
    }
  });

  router.post('/admin/sla-scan', authenticate, authorizeRoles('ADMIN', 'TECHNICIAN'), async (req, res, next) => {
    try {
      // Optional offsetMinutes allows simulating future time during live demo to demonstrate SLA violation & escalation
      const offsetMinutes = Number(req.body.simulateOffsetMinutes || 0);
      const refTime = new Date(Date.now() + offsetMinutes * 60 * 1000);
      const summary = await slaMonitorService.evaluateAllOpenIncidents(refTime);
      res.json({ success: true, referenceTime: refTime.toISOString(), summary });
    } catch (err) {
      next(err);
    }
  });

  router.get('/admin/audit-logs', authenticate, authorizeRoles('ADMIN'), async (req, res, next) => {
    try {
      const logs = await auditLogRepo.findAll();
      const sorted = logs.map((l) => l.toJSON()).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      res.json({ success: true, count: sorted.length, auditLogs: sorted });
    } catch (err) {
      next(err);
    }
  });

  router.get('/reports/dashboard', authenticate, async (req, res, next) => {
    try {
      const report = await incidentService.generateReports();
      res.json({ success: true, report });
    } catch (err) {
      next(err);
    }
  });

  router.post('/admin/reset-demo', authenticate, authorizeRoles('ADMIN'), async (req, res, next) => {
    try {
      await seedSystemData({ repositories, incidentService });
      res.json({ success: true, message: 'Demo database reset to initial state.' });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

module.exports = { createApiRouter };
