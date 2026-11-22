# Intelligent IT Service Management & Incident Resolution System (I-ITSM)
**Course:** CS F213 / MAC F212 Object-Oriented Programming (Semester-I, 2026–2027)  
**Institution:** BITS Pilani  
**Architecture:** Option C — Full-Stack Layered Web Application (React + Node.js/Express + MongoDB)  
**Team Size:** 3 Students

---

## 1. Quick Start Guide

### Prerequisites
- **Node.js** (v18+ recommended)
- **MongoDB** (Local `mongod` on `mongodb://127.0.0.1:27017/i_itsm_db` or MongoDB Atlas URI)
  - *Note:* The Repository Layer includes an automatic **Dual-Mode Persistence Engine** (Mongoose + JSON/In-Memory fallback) so you can run, test, and demo the entire project immediately even if `mongod` is not running locally.

### Step 1: Start the Backend Server
```bash
cd backend
npm install
npm run seed   # Optional: Pre-populates sample users, IT services, SLAs, categories, and incidents
npm start      # Runs on http://localhost:5000
```

### Step 2: Run the Automated Test Suite (18 OOP & Business Rule Tests)
```bash
cd backend
npm test
```

### Step 3: Start the React Frontend
```bash
cd frontend
npm install
npm run dev    # Runs on http://localhost:5173
```

---

## 2. Default Demo Credentials (Pre-Seeded)

| Role | Email / Username | Password | Key Capabilities |
| :--- | :--- | :--- | :--- |
| **Administrator / IT Manager** | `admin@bits-itsm.edu` | `Admin@123` | Manage Users, Technicians, IT Services, SLA Policies, Categories, Assignment Strategies, SLA Violations, Audit Logs, Verify & Close Incidents, Analytics Dashboard |
| **Technician (Payment & App)** | `tech.arjun@bits-itsm.edu` | `Tech@123` | View Assigned Incidents, Acknowledge (`ASSIGNED -> ACKNOWLEDGED`), Investigate (`IN_PROGRESS`), Add Notes, Request Info from Employee, Resolve (`RESOLVED`), View Workload |
| **Technician (Network & Cloud)** | `tech.priya@bits-itsm.edu` | `Tech@123` | Assigned Network/Cloud/Security incidents, Skill & Load-based assignment target |
| **Technician (Database & Auth)** | `tech.rohan@bits-itsm.edu` | `Tech@123` | Assigned Database/Storage/Auth incidents |
| **Employee / Customer 1** | `emp.ananya@bits-itsm.edu` | `Emp@123` | Register/Login, Report Incident, Auto-Category & Duplicate Check, Track Status, Respond to Technician Info Requests, Provide Feedback & Rating |
| **Employee / Customer 2** | `emp.vikram@bits-itsm.edu` | `Emp@123` | Report correlated/duplicate incidents for Workflow 3 demonstration |

*New employees can also self-register directly from the **Register New Employee** tab on the login screen.*

---

## 3. Repository Structure

```text
i-itsm-project/
├── README.md                                  # Setup instructions, credentials, and overview
├── docs/
│   ├── PROJECT_BLUEPRINT_AND_REPORT.md        # Complete Deliverables 1–8 (Problem, SRS, Architecture, UML, Tech Report, DB, 18 Tests)
├── backend/
│   ├── package.json
│   ├── .env.example
│   ├── src/
│   │   ├── server.js                          # Express app entry point & background SLA monitor
│   │   ├── config/
│   │   │   └── db.js                          # MongoDB connection + automatic in-memory fallback
│   │   ├── exceptions/
│   │   │   └── AppExceptions.js               # 12 custom OOP exception classes extending ITSMException
│   │   ├── domain/
│   │   │   ├── User.js                        # Abstract User + Employee, Technician, Administrator subclasses
│   │   │   ├── Incident.js                    # Encapsulated Incident aggregate root + SLARecord, InvestigationNote, ResolutionDetails
│   │   │   ├── ITService.js                   # ITService & IncidentCategory domain models
│   │   │   ├── SLAPolicy.js                   # SLAPolicy domain class (P1–P4 targets & deadline calculation)
│   │   │   └── AuditLog.js                    # Immutable AuditLog & Notification domain models
│   │   ├── patterns/
│   │   │   ├── state/
│   │   │   │   └── IncidentState.js           # State Pattern: NEW -> CLASSIFIED -> ASSIGNED -> ACKNOWLEDGED -> IN_PROGRESS -> RESOLVED -> VERIFIED -> CLOSED
│   │   │   ├── strategy/
│   │   │   │   ├── PriorityStrategy.js        # Strategy Pattern: RuleBasedPriorityStrategy & WeightedScoringPriorityStrategy
│   │   │   │   └── AssignmentStrategy.js      # Strategy Pattern: SkillBased, LoadBased, RoundRobin, ExperienceBased
│   │   │   ├── observer/
│   │   │   │   └── IncidentObserver.js        # Observer Pattern: Publisher + InAppNotification, EmailSimulation, AuditTrail Observers
│   │   │   └── factory/
│   │   │       └── EntityFactory.js           # Factory Pattern: UserFactory, IncidentFactory, NotificationFactory
│   │   ├── repositories/
│   │   │   ├── BaseRepository.js              # Repository Pattern contract
│   │   │   └── ITSMRepositories.js            # User, Incident, Service, SLAPolicy, Category, AuditLog, Notification repositories
│   │   ├── services/
│   │   │   ├── AuthService.js                 # Registration, credential verification, JWT token issuance
│   │   │   ├── IncidentService.js             # End-to-end 14-step incident lifecycle orchestration
│   │   │   ├── SLAMonitorService.js           # SLA calculation, warning detection, violation logging, auto-escalation
│   │   │   └── IntelligenceService.js         # Duplicate detection, service correlation, smart tech recommendation, auto-categorization, suggested resolutions
│   │   ├── middleware/
│   │   │   ├── authMiddleware.js              # JWT authentication & role-based access control (RBAC)
│   │   │   └── errorMiddleware.js             # Centralized polymorphic exception handler
│   │   ├── routes/
│   │   │   └── apiRoutes.js                   # RESTful endpoints for Auth, Incidents, Admin, Reports, Notifications
│   │   └── seed/
│   │       └── seedData.js                    # Initial enterprise data seeder
│   └── tests/
│       └── itsm.test.js                       # 18 automated test cases covering all OOP & MVP requirements
└── frontend/
    ├── package.json
    ├── vite.config.js
    ├── index.html
    └── src/
        ├── main.jsx
        ├── App.jsx                            # Role-aware routing & layout shell
        ├── styles.css                         # Clean enterprise UI stylesheet
        ├── api/
        │   └── client.js                      # Axios/Fetch API client with JWT interceptor
        └── components/
            ├── LoginRegister.jsx              # Login + New Employee Registration + Quick Demo Role Switcher
            ├── EmployeePortal.jsx             # Report Incident (with live AI suggestions), Track Status, Respond to Tech, Feedback
            ├── TechnicianPortal.jsx           # Assigned Queue, Lifecycle Controls, Investigation Notes, Request Info, Resolve
            ├── AdminPortal.jsx                # Manage Users/Techs/Services/Categories/SLAs, Strategy Switcher, Verify/Close, Audit Logs
            ├── ReportsDashboard.jsx           # Incident Overview, Technician Workload, Service Analysis, Multi-Criteria Search (8 filters)
            └── NotificationCenter.jsx         # Real-time In-App & Simulated Email/SMS Notification Drawer
```
