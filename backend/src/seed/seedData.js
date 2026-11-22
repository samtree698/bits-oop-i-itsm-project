const { UserFactory } = require('../patterns/factory/EntityFactory');
const { ITService, IncidentCategory } = require('../domain/ITService');
const { SLAPolicy } = require('../domain/SLAPolicy');

async function seedSystemData({ repositories, incidentService }) {
  const { userRepo, serviceRepo, categoryRepo, slaPolicyRepo, incidentRepo, auditLogRepo, notificationRepo } = repositories;

  await userRepo.clear();
  await serviceRepo.clear();
  await categoryRepo.clear();
  await slaPolicyRepo.clear();
  await incidentRepo.clear();
  await auditLogRepo.clear();
  await notificationRepo.clear();

  // 1. Seed SLA Policies (Exact PDF Page 7 table)
  const slaPolicies = [
    new SLAPolicy({ priority: 'P1', label: 'P1 - Critical', responseMinutes: 5, resolutionMinutes: 30 }),
    new SLAPolicy({ priority: 'P2', label: 'P2 - High', responseMinutes: 15, resolutionMinutes: 120 }),
    new SLAPolicy({ priority: 'P3', label: 'P3 - Medium', responseMinutes: 60, resolutionMinutes: 480 }),
    new SLAPolicy({ priority: 'P4', label: 'P4 - Low', responseMinutes: 240, resolutionMinutes: 1440 })
  ];
  for (const policy of slaPolicies) {
    await slaPolicyRepo.save(policy);
  }

  // 2. Seed Incident Categories (Exact PDF Page 5 list)
  const categories = [
    new IncidentCategory({
      categoryId: 'CAT-APPLICATION',
      name: 'Application',
      description: 'Enterprise web, mobile, and payment applications',
      keywords: ['payment', 'transaction', 'checkout', 'application', 'portal', 'erp']
    }),
    new IncidentCategory({
      categoryId: 'CAT-NETWORK',
      name: 'Network',
      description: 'Campus LAN, Wi-Fi, VPN, DNS, and core routing infrastructure',
      keywords: ['network', 'vpn', 'wifi', 'router', 'dns', 'switch', 'latency']
    }),
    new IncidentCategory({
      categoryId: 'CAT-DATABASE',
      name: 'Database',
      description: 'Production relational and NoSQL database clusters',
      keywords: ['database', 'mongodb', 'sql', 'postgres', 'query', 'connection pool']
    }),
    new IncidentCategory({
      categoryId: 'CAT-AUTHENTICATION',
      name: 'Authentication',
      description: 'Single Sign-On (SSO), LDAP, MFA, and IAM services',
      keywords: ['login', 'password', 'sso', 'mfa', 'authentication', 'oauth']
    }),
    new IncidentCategory({
      categoryId: 'CAT-CLOUD',
      name: 'Cloud',
      description: 'Cloud compute nodes, Kubernetes clusters, and container registries',
      keywords: ['cloud', 'aws', 'azure', 'kubernetes', 'docker', 'pod']
    }),
    new IncidentCategory({
      categoryId: 'CAT-SECURITY',
      name: 'Security',
      description: 'Endpoint security, certificates, firewall rules, and threat alerts',
      keywords: ['security', 'firewall', 'ssl', 'certificate', 'phishing', 'breach']
    }),
    new IncidentCategory({
      categoryId: 'CAT-STORAGE',
      name: 'Storage',
      description: 'SAN/NAS volumes, object storage buckets, and backup archives',
      keywords: ['storage', 'disk', 'backup', 's3', 'volume', 'quota']
    }),
    new IncidentCategory({
      categoryId: 'CAT-HARDWARE',
      name: 'Hardware',
      description: 'Workstations, servers, printers, and lab hardware',
      keywords: ['hardware', 'laptop', 'printer', 'monitor', 'server']
    }),
    new IncidentCategory({
      categoryId: 'CAT-SOFTWARE',
      name: 'Software',
      description: 'OS images, developer tools, and productivity software licenses',
      keywords: ['software', 'license', 'install', 'driver', 'windows', 'linux']
    })
  ];
  for (const cat of categories) {
    await categoryRepo.save(cat);
  }

  // 3. Seed IT Services (PDF Page 1, 3, 9)
  const services = [
    new ITService({
      serviceId: 'SVC-PAYMENT',
      name: 'Enterprise Payment Gateway',
      category: 'Application',
      description: 'Handles fee payments, merchant transactions, and billing settlements',
      businessCriticality: 5,
      status: 'DEGRADED',
      ownerTeam: 'FinTech & Core Apps'
    }),
    new ITService({
      serviceId: 'SVC-NETWORK',
      name: 'Campus Core Network & VPN',
      category: 'Network',
      description: 'Backbone routing, firewall, and remote access VPN concentrators',
      businessCriticality: 4,
      status: 'OPERATIONAL',
      ownerTeam: 'Network Operations (NOC)'
    }),
    new ITService({
      serviceId: 'SVC-DATABASE',
      name: 'Primary ERP Database Cluster',
      category: 'Database',
      description: 'High-availability MongoDB and PostgreSQL production cluster',
      businessCriticality: 5,
      status: 'OPERATIONAL',
      ownerTeam: 'Database Reliability Engineering'
    }),
    new ITService({
      serviceId: 'SVC-AUTH',
      name: 'Central SSO & Identity Provider',
      category: 'Authentication',
      description: 'Organization-wide OAuth2/JWT and LDAP directory service',
      businessCriticality: 5,
      status: 'OPERATIONAL',
      ownerTeam: 'Identity & Access Management'
    }),
    new ITService({
      serviceId: 'SVC-STORAGE',
      name: 'Cloud Object Storage & Backup',
      category: 'Storage',
      description: 'Distributed document storage and automated disaster recovery snapshots',
      businessCriticality: 3,
      status: 'OPERATIONAL',
      ownerTeam: 'Cloud Infrastructure'
    }),
    new ITService({
      serviceId: 'SVC-CLOUD',
      name: 'Kubernetes App Platform',
      category: 'Cloud',
      description: 'Container orchestration platform hosting internal microservices',
      businessCriticality: 4,
      status: 'OPERATIONAL',
      ownerTeam: 'Cloud Infrastructure'
    })
  ];
  for (const svc of services) {
    await serviceRepo.save(svc);
  }

  // 4. Seed Users (Admin, 3 Technicians, 2 Employees)
  const admin = UserFactory.createUser({
    id: 'USR-ADMIN-01',
    name: 'Dr. Rajeshwari Nair (IT Manager)',
    email: 'admin@bits-itsm.edu',
    password: 'Admin@123',
    role: 'ADMIN',
    accessLevel: 'IT_MANAGER'
  });

  const techArjun = UserFactory.createUser({
    id: 'T101',
    name: 'Arjun Mehta',
    email: 'tech.arjun@bits-itsm.edu',
    password: 'Tech@123',
    role: 'TECHNICIAN',
    skills: ['Application', 'Software', 'Database'],
    serviceExperience: ['SVC-PAYMENT', 'SVC-DATABASE'],
    experienceYears: 5,
    currentWorkload: 0,
    maxWorkload: 5,
    available: true,
    escalationRole: 'TEAM_LEAD'
  });

  const techPriya = UserFactory.createUser({
    id: 'T102',
    name: 'Priya Sharma',
    email: 'tech.priya@bits-itsm.edu',
    password: 'Tech@123',
    role: 'TECHNICIAN',
    skills: ['Network', 'Cloud', 'Security'],
    serviceExperience: ['SVC-NETWORK', 'SVC-CLOUD'],
    experienceYears: 4,
    currentWorkload: 0,
    maxWorkload: 5,
    available: true,
    escalationRole: 'TECHNICIAN'
  });

  const techRohan = UserFactory.createUser({
    id: 'T103',
    name: 'Rohan Verma',
    email: 'tech.rohan@bits-itsm.edu',
    password: 'Tech@123',
    role: 'TECHNICIAN',
    skills: ['Database', 'Authentication', 'Storage', 'Hardware'],
    serviceExperience: ['SVC-AUTH', 'SVC-STORAGE', 'SVC-DATABASE'],
    experienceYears: 6,
    currentWorkload: 0,
    maxWorkload: 5,
    available: true,
    escalationRole: 'SYS_ADMIN'
  });

  const empAnanya = UserFactory.createUser({
    id: 'E101',
    name: 'Ananya Deshmukh',
    email: 'emp.ananya@bits-itsm.edu',
    password: 'Emp@123',
    role: 'EMPLOYEE',
    department: 'Finance & Accounts',
    location: 'Hyderabad Campus - Block A'
  });

  const empVikram = UserFactory.createUser({
    id: 'E102',
    name: 'Vikramaditya Rao',
    email: 'emp.vikram@bits-itsm.edu',
    password: 'Emp@123',
    role: 'EMPLOYEE',
    department: 'Academic Operations',
    location: 'Hyderabad Campus - Block C'
  });

  for (const u of [admin, techArjun, techPriya, techRohan, empAnanya, empVikram]) {
    await userRepo.save(u);
  }

  // 5. Seed Sample Incidents demonstrating lifecycle states & historical resolutions
  if (incidentService) {
    // Historical Resolved & Closed Incident (provides historical resolution recommendations)
    const inc1 = await incidentService.reportIncident(
      {
        title: 'Payment gateway timeout during peak fee settlement',
        description: 'Users unable to complete payment transactions due to database connection pool exhaustion.',
        serviceId: 'SVC-PAYMENT',
        category: 'Application',
        impact: 3,
        urgency: 3,
        affectedUsers: 120
      },
      empAnanya
    );
    const assignedTech1 = await userRepo.findByKey(inc1.assignedTechnicianId);
    await incidentService.updateIncidentState(inc1.incidentId, 'ACKNOWLEDGED', assignedTech1, {
      note: 'Acknowledged P1 alert. Inspecting payment microservice pod logs.'
    });
    await incidentService.updateIncidentState(inc1.incidentId, 'IN_PROGRESS', assignedTech1, {
      note: 'Identified leaked DB connections in payment worker pool.'
    });
    await incidentService.updateIncidentState(inc1.incidentId, 'RESOLVED', assignedTech1, {
      rootCause: 'Connection pool exhaustion on payment transaction service',
      resolutionSummary: 'Restarted payment worker pods, cleared stuck transactions, and raised max pool size to 200.',
      stepsTaken: '1. Drained degraded worker node 2. Applied connection pool patch 3. Verified checkout latency < 150ms'
    });
    await incidentService.submitEmployeeFeedback(
      inc1.incidentId,
      {
        feedback: 'Transactions are completing smoothly now. Thank you for the rapid fix!',
        rating: 5,
        verifyAndClose: true
      },
      empAnanya
    );

    // Active P1 Incident (PDF Problem Scenario Page 3)
    await incidentService.reportIncident(
      {
        title: 'Payment application unavailable',
        description: "The organization's payment application is unavailable and users are unable to complete transactions.",
        serviceId: 'SVC-PAYMENT',
        category: 'Application',
        impact: 3,
        urgency: 3,
        affectedUsers: 250
      },
      empAnanya
    );

    // Active Network Incident in Investigation
    const inc3 = await incidentService.reportIncident(
      {
        title: 'Intermittent VPN packet loss in Block C',
        description: 'Remote faculty VPN tunnel drops packets every 10 minutes due to router latency.',
        serviceId: 'SVC-NETWORK',
        category: 'Network',
        impact: 2,
        urgency: 2,
        affectedUsers: 35
      },
      empVikram
    );
    const assignedTech3 = await userRepo.findByKey(inc3.assignedTechnicianId);
    if (assignedTech3) {
      await incidentService.updateIncidentState(inc3.incidentId, 'ACKNOWLEDGED', assignedTech3);
      await incidentService.updateIncidentState(inc3.incidentId, 'IN_PROGRESS', assignedTech3, {
        note: 'Tracing BGP route flapping on campus edge firewall.'
      });
    }
  }
}

module.exports = { seedSystemData };
