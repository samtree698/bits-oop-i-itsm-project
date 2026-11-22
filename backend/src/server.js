try {
  require('dotenv').config();
} catch {}

const { dbManager } = require('./config/db');
const {
  UserRepository,
  ServiceRepository,
  CategoryRepository,
  SLAPolicyRepository,
  IncidentRepository,
  AuditLogRepository,
  NotificationRepository
} = require('./repositories/ITSMRepositories');
const {
  IncidentEventPublisher,
  AuditLogObserver,
  InAppNotificationObserver,
  EmailSimulationObserver
} = require('./patterns/observer/IncidentObserver');
const { AuthService } = require('./services/AuthService');
const { IntelligenceService } = require('./services/IntelligenceService');
const { SLAMonitorService } = require('./services/SLAMonitorService');
const { IncidentService } = require('./services/IncidentService');
const { errorMiddleware } = require('./middleware/errorMiddleware');
const { seedSystemData } = require('./seed/seedData');

function createAppContext() {
  const repositories = {
    userRepo: new UserRepository(),
    serviceRepo: new ServiceRepository(),
    categoryRepo: new CategoryRepository(),
    slaPolicyRepo: new SLAPolicyRepository(),
    incidentRepo: new IncidentRepository(),
    auditLogRepo: new AuditLogRepository(),
    notificationRepo: new NotificationRepository()
  };

  // Wire Observer Pattern
  const eventPublisher = new IncidentEventPublisher();
  eventPublisher.subscribe(new AuditLogObserver(repositories.auditLogRepo));
  eventPublisher.subscribe(new InAppNotificationObserver(repositories.notificationRepo));
  eventPublisher.subscribe(new EmailSimulationObserver(repositories.notificationRepo));

  const authService = new AuthService(repositories.userRepo);
  const intelligenceService = new IntelligenceService(repositories);
  const slaMonitorService = new SLAMonitorService({
    ...repositories,
    eventPublisher
  });
  const incidentService = new IncidentService({
    ...repositories,
    slaMonitorService,
    intelligenceService,
    eventPublisher
  });

  return {
    repositories,
    eventPublisher,
    authService,
    intelligenceService,
    slaMonitorService,
    incidentService
  };
}

function createExpressApp(context) {
  const express = require('express');
  const cors = require('cors');
  const { createApiRouter } = require('./routes/apiRoutes');

  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use('/api', createApiRouter({ ...context, seedSystemData }));
  app.use(errorMiddleware);
  return app;
}

async function startServer() {
  const mode = await dbManager.connect();
  const context = createAppContext();
  const existingUsers = await context.repositories.userRepo.findAll();
  if (existingUsers.length === 0) {
    await seedSystemData(context);
  }

  const app = createExpressApp(context);
  const port = process.env.PORT || 5000;

  // Continuous background SLA monitor every 60 seconds
  const slaTimer = setInterval(() => {
    context.slaMonitorService.evaluateAllOpenIncidents().catch(() => {});
  }, 60 * 1000);
  slaTimer.unref?.();

  app.listen(port, () => {
    console.log(`[I-ITSM Backend] Server listening on http://localhost:${port} (Persistence: ${mode})`);
  });
}

if (require.main === module) {
  startServer();
}

module.exports = {
  createAppContext,
  createExpressApp
};
