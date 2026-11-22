import React, { useState, useEffect } from 'react';
import { apiRequest } from '../api/client';

export default function AdminPortal({ catalog, incidents, onRefresh }) {
  const [subTab, setSubTab] = useState('INCIDENTS'); // 'INCIDENTS' | 'GOVERNANCE' | 'USERS' | 'CATALOG' | 'AUDIT'
  const [users, setUsers] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Strategy state
  const [priorityStrategy, setPriorityStrategy] = useState(
    catalog.strategies?.priorityStrategy || 'RULE_BASED'
  );
  const [assignmentStrategy, setAssignmentStrategy] = useState(
    catalog.strategies?.assignmentStrategy || 'SKILL_BASED'
  );

  // New User Form
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    password: 'Password@123',
    role: 'TECHNICIAN',
    skills: 'Application,Network',
    experienceYears: 3
  });

  // New Service & Category Forms
  const [newService, setNewService] = useState({
    name: '',
    category: 'Application',
    businessCriticality: 4,
    description: ''
  });
  const [newCategory, setNewCategory] = useState({
    name: '',
    description: '',
    keywords: ''
  });

  const loadAdminData = async () => {
    try {
      const [uRes, aRes] = await Promise.all([
        apiRequest('/admin/users'),
        apiRequest('/admin/audit-logs')
      ]);
      setUsers(uRes.users || []);
      setAuditLogs(aRes.auditLogs || []);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, [incidents]);

  const technicians = users.filter((u) => u.role === 'TECHNICIAN');

  const handleSaveStrategies = async () => {
    setError('');
    try {
      await apiRequest('/admin/strategies', {
        method: 'PUT',
        body: { priorityStrategy, assignmentStrategy }
      });
      setMessage(
        `Updated active strategies: Priority=${priorityStrategy}, Technician Assignment=${assignmentStrategy}`
      );
      onRefresh();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSimulateSLAScan = async (offsetMinutes) => {
    setError('');
    try {
      const res = await apiRequest('/admin/sla-scan', {
        method: 'POST',
        body: { simulateOffsetMinutes: offsetMinutes }
      });
      setMessage(
        `SLA Monitor Scan complete (+${offsetMinutes}m): ${res.summary.violationsDetected.length} violations detected, ${res.summary.escalationsTriggered.length} automatic escalations triggered.`
      );
      onRefresh();
      loadAdminData();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleManualAssign = async (incidentId, technicianId) => {
    if (!technicianId) return;
    try {
      await apiRequest(`/incidents/${incidentId}/assign`, {
        method: 'POST',
        body: { technicianId }
      });
      setMessage(`Reassigned ${incidentId} to technician ${technicianId}.`);
      onRefresh();
      loadAdminData();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleAdminStateTransition = async (incidentId, targetState) => {
    try {
      await apiRequest(`/incidents/${incidentId}/state`, {
        method: 'PATCH',
        body: { targetState }
      });
      setMessage(`Incident ${incidentId} transitioned to ${targetState}.`);
      onRefresh();
      loadAdminData();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      await apiRequest('/admin/users', {
        method: 'POST',
        body: {
          ...newUser,
          skills: newUser.skills.split(',').map((s) => s.trim()).filter(Boolean),
          experienceYears: Number(newUser.experienceYears)
        }
      });
      setMessage(`Created ${newUser.role} account for ${newUser.name}.`);
      setNewUser({ name: '', email: '', password: 'Password@123', role: 'TECHNICIAN', skills: 'Application', experienceYears: 3 });
      loadAdminData();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCreateService = async (e) => {
    e.preventDefault();
    try {
      await apiRequest('/admin/services', {
        method: 'POST',
        body: newService
      });
      setMessage(`Added IT Service '${newService.name}'.`);
      setNewService({ name: '', category: 'Application', businessCriticality: 4, description: '' });
      onRefresh();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCreateCategory = async (e) => {
    e.preventDefault();
    try {
      await apiRequest('/admin/categories', {
        method: 'POST',
        body: {
          name: newCategory.name,
          description: newCategory.description,
          keywords: newCategory.keywords.split(',').map((k) => k.trim()).filter(Boolean)
        }
      });
      setMessage(`Added new dynamic Incident Category '${newCategory.name}'.`);
      setNewCategory({ name: '', description: '', keywords: '' });
      onRefresh();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      <div className="admin-subnav">
        <button className={subTab === 'INCIDENTS' ? 'active' : ''} onClick={() => setSubTab('INCIDENTS')}>
          Monitor Incidents & SLA Violations ({incidents.length})
        </button>
        <button className={subTab === 'GOVERNANCE' ? 'active' : ''} onClick={() => setSubTab('GOVERNANCE')}>
          Configure Strategies & SLA Policies
        </button>
        <button className={subTab === 'USERS' ? 'active' : ''} onClick={() => setSubTab('USERS')}>
          Manage Users & Technicians ({users.length})
        </button>
        <button className={subTab === 'CATALOG' ? 'active' : ''} onClick={() => setSubTab('CATALOG')}>
          Manage IT Services & Categories
        </button>
        <button className={subTab === 'AUDIT' ? 'active' : ''} onClick={() => setSubTab('AUDIT')}>
          Complete Incident Audit Trail ({auditLogs.length})
        </button>
      </div>

      {message && <div className="alert-success">{message}</div>}
      {error && <div className="alert-error">{error}</div>}

      {subTab === 'INCIDENTS' && (
        <div className="panel">
          <div className="panel-header-flex">
            <div>
              <h2>Enterprise Incident Operations & SLA Escalation Monitor</h2>
              <p className="muted">
                Monitor all open/resolved incidents, trigger SLA compliance scans, reassign technicians, or verify and
                close resolved incidents.
              </p>
            </div>
            <div className="sla-sim-buttons">
              <button type="button" className="btn-secondary" onClick={() => handleSimulateSLAScan(0)}>
                Run Live SLA Check
              </button>
              <button type="button" className="btn-danger" onClick={() => handleSimulateSLAScan(45)}>
                Simulate +45m SLA Breach & 4-Tier Escalation
              </button>
            </div>
          </div>

          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Title & Service</th>
                <th>Category</th>
                <th>Priority</th>
                <th>Status</th>
                <th>SLA Status & Escalation</th>
                <th>Assigned Technician</th>
                <th>Governance Actions</th>
              </tr>
            </thead>
            <tbody>
              {incidents.map((inc) => (
                <tr key={inc.incidentId}>
                  <td>
                    <strong>{inc.incidentId}</strong>
                    {inc.isPotentialDuplicate && <div className="mini-dup">DUP: {inc.duplicateOf.join(',')}</div>}
                  </td>
                  <td>
                    <strong>{inc.title}</strong>
                    <div className="muted-small">{inc.serviceName} (Reporter: {inc.reporterName})</div>
                  </td>
                  <td>{inc.category}</td>
                  <td>
                    <span className={`badge priority-${inc.priority}`}>
                      {inc.priority} ({inc.priorityScore})
                    </span>
                  </td>
                  <td>
                    <span className={`badge status-${inc.status}`}>{inc.status}</span>
                  </td>
                  <td>
                    <span className={`badge sla-${inc.slaRecord?.slaStatus}`}>{inc.slaRecord?.slaStatus}</span>
                    {inc.slaRecord?.escalationLevel !== 'NONE' && (
                      <div className="mini-esc">Tier: {inc.slaRecord.escalationLevel}</div>
                    )}
                  </td>
                  <td>
                    <select
                      value={inc.assignedTechnicianId || ''}
                      onChange={(e) => handleManualAssign(inc.incidentId, e.target.value)}
                    >
                      <option value="">-- Unassigned --</option>
                      {technicians.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({t.currentWorkload}/{t.maxWorkload})
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <div className="action-stack">
                      {inc.status === 'RESOLVED' && (
                        <button
                          type="button"
                          className="btn-primary btn-sm"
                          onClick={() => handleAdminStateTransition(inc.incidentId, 'VERIFIED')}
                        >
                          Verify (→ VERIFIED)
                        </button>
                      )}
                      {inc.status === 'VERIFIED' && (
                        <button
                          type="button"
                          className="btn-primary btn-sm"
                          onClick={() => handleAdminStateTransition(inc.incidentId, 'CLOSED')}
                        >
                          Close (→ CLOSED)
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {subTab === 'GOVERNANCE' && (
        <div className="portal-grid">
          <div className="panel">
            <h2>OOP Strategy Pattern Configuration</h2>
            <p className="muted">
              Dynamically swap the active Priority Determination Strategy and Technician Assignment Strategy at runtime
              without modifying application logic.
            </p>
            <div className="form-group">
              <label>Active Priority Calculation Strategy</label>
              <select value={priorityStrategy} onChange={(e) => setPriorityStrategy(e.target.value)}>
                <option value="RULE_BASED">RULE_BASED (Impact × Urgency × Business Criticality)</option>
                <option value="WEIGHTED_SCORING">WEIGHTED_SCORING (Weighted Factors + Affected User Scale)</option>
              </select>
            </div>
            <div className="form-group">
              <label>Active Technician Assignment Strategy</label>
              <select value={assignmentStrategy} onChange={(e) => setAssignmentStrategy(e.target.value)}>
                <option value="SKILL_BASED">SKILL_BASED (Category Skill + Service Experience + Load)</option>
                <option value="LOAD_BASED">LOAD_BASED (Lowest Active Workload Ratio)</option>
                <option value="ROUND_ROBIN">ROUND_ROBIN (Balanced Cyclic Distribution)</option>
                <option value="EXPERIENCE_BASED">EXPERIENCE_BASED (Seniority & Past Service Mastery)</option>
              </select>
            </div>
            <button type="button" className="btn-primary" onClick={handleSaveStrategies}>
              Apply Active Strategies
            </button>
          </div>

          <div className="panel">
            <h2>Configured SLA Policies (PDF Page 7 Targets)</h2>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Priority</th>
                  <th>Classification</th>
                  <th>Response Target</th>
                  <th>Resolution Target</th>
                </tr>
              </thead>
              <tbody>
                {catalog.slaPolicies?.map((p) => (
                  <tr key={p.priority}>
                    <td>
                      <span className={`badge priority-${p.priority}`}>{p.priority}</span>
                    </td>
                    <td>{p.label}</td>
                    <td>{p.responseMinutes} mins</td>
                    <td>{p.resolutionMinutes >= 60 ? `${p.resolutionMinutes / 60} hours (${p.resolutionMinutes} mins)` : `${p.resolutionMinutes} mins`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {subTab === 'USERS' && (
        <div className="portal-grid">
          <div className="panel">
            <h2>Create User / Technician Account</h2>
            <form onSubmit={handleCreateUser} className="incident-form">
              <div className="form-group">
                <label>Full Name</label>
                <input
                  type="text"
                  required
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  required
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Role</label>
                  <select value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}>
                    <option value="TECHNICIAN">TECHNICIAN</option>
                    <option value="EMPLOYEE">EMPLOYEE</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Password</label>
                  <input
                    type="text"
                    required
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  />
                </div>
              </div>
              {newUser.role === 'TECHNICIAN' && (
                <div className="form-row">
                  <div className="form-group">
                    <label>Technical Skills (comma-separated)</label>
                    <input
                      type="text"
                      value={newUser.skills}
                      onChange={(e) => setNewUser({ ...newUser, skills: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Experience (Years)</label>
                    <input
                      type="number"
                      min={1}
                      value={newUser.experienceYears}
                      onChange={(e) => setNewUser({ ...newUser, experienceYears: e.target.value })}
                    />
                  </div>
                </div>
              )}
              <button type="submit" className="btn-primary">
                Create Account
              </button>
            </form>
          </div>

          <div className="panel">
            <h2>Registered Users & Technicians</h2>
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name & Email</th>
                  <th>Role</th>
                  <th>Skills / Department</th>
                  <th>Workload</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>{u.id}</td>
                    <td>
                      <strong>{u.name}</strong>
                      <div className="muted-small">{u.email}</div>
                    </td>
                    <td>
                      <span className="badge">{u.role}</span>
                    </td>
                    <td>{u.role === 'TECHNICIAN' ? u.skills?.join(', ') : u.department || u.accessLevel}</td>
                    <td>
                      {u.role === 'TECHNICIAN' ? `${u.currentWorkload}/${u.maxWorkload} (${u.available ? 'Online' : 'Offline'})` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {subTab === 'CATALOG' && (
        <div className="portal-grid">
          <div className="panel">
            <h2>Manage IT Services ({catalog.services?.length})</h2>
            <form onSubmit={handleCreateService} className="incident-form">
              <div className="form-row">
                <input
                  type="text"
                  required
                  placeholder="New IT Service Name"
                  value={newService.name}
                  onChange={(e) => setNewService({ ...newService, name: e.target.value })}
                />
                <input
                  type="text"
                  required
                  placeholder="Category (e.g., Cloud)"
                  value={newService.category}
                  onChange={(e) => setNewService({ ...newService, category: e.target.value })}
                />
                <select
                  value={newService.businessCriticality}
                  onChange={(e) => setNewService({ ...newService, businessCriticality: Number(e.target.value) })}
                >
                  <option value={5}>Criticality 5 (Mission Critical)</option>
                  <option value={4}>Criticality 4 (High)</option>
                  <option value={3}>Criticality 3 (Medium)</option>
                  <option value={2}>Criticality 2 (Low)</option>
                  <option value={1}>Criticality 1 (Minimal)</option>
                </select>
                <button type="submit" className="btn-primary">
                  Add Service
                </button>
              </div>
            </form>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Service ID</th>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Business Criticality</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {catalog.services?.map((s) => (
                  <tr key={s.serviceId}>
                    <td>{s.serviceId}</td>
                    <td><strong>{s.name}</strong></td>
                    <td>{s.category}</td>
                    <td>{s.businessCriticality} / 5</td>
                    <td>{s.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="panel">
            <h2>Dynamic Incident Categories ({catalog.categories?.length})</h2>
            <p className="muted">
              Demonstrates Open/Closed Principle: new categories and NLP keywords can be added without modifying code.
            </p>
            <form onSubmit={handleCreateCategory} className="incident-form">
              <div className="form-row">
                <input
                  type="text"
                  required
                  placeholder="Category Name (e.g., Biometric IoT)"
                  value={newCategory.name}
                  onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                />
                <input
                  type="text"
                  placeholder="Keywords (comma-separated)"
                  value={newCategory.keywords}
                  onChange={(e) => setNewCategory({ ...newCategory, keywords: e.target.value })}
                />
                <button type="submit" className="btn-primary">
                  Add Category
                </button>
              </div>
            </form>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Description</th>
                  <th>Auto-Classifier Keywords</th>
                </tr>
              </thead>
              <tbody>
                {catalog.categories?.map((c) => (
                  <tr key={c.categoryId}>
                    <td><strong>{c.name}</strong></td>
                    <td>{c.description}</td>
                    <td>{c.keywords?.join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {subTab === 'AUDIT' && (
        <div className="panel">
          <h2>Complete Incident Audit Trail (PDF Page 8 Specification)</h2>
          <table className="data-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Incident ID</th>
                <th>Actor</th>
                <th>Action</th>
                <th>State Transition</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {auditLogs.map((log) => (
                <tr key={log.auditId}>
                  <td>{new Date(log.timestamp).toLocaleTimeString()}</td>
                  <td><strong>{log.incidentId}</strong></td>
                  <td>{log.userName} ({log.userRole})</td>
                  <td><span className="badge">{log.action}</span></td>
                  <td>{log.previousState ? `${log.previousState} → ${log.newState}` : log.newState}</td>
                  <td>{log.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
