import React, { useState, useEffect } from 'react';
import { apiRequest } from '../api/client';

export default function ReportsDashboard({ catalog }) {
  const [report, setReport] = useState(null);
  const [filteredIncidents, setFilteredIncidents] = useState([]);
  const [filters, setFilters] = useState({
    incidentId: '',
    status: 'ALL',
    priority: 'ALL',
    category: 'ALL',
    serviceId: 'ALL',
    technicianId: 'ALL',
    slaStatus: 'ALL',
    startDate: '',
    endDate: '',
    onlyOwn: 'false'
  });

  const loadReportAndSearch = async () => {
    const query = new URLSearchParams(filters).toString();
    const [repRes, searchRes] = await Promise.all([
      apiRequest('/reports/dashboard'),
      apiRequest(`/incidents?${query}`)
    ]);
    setReport(repRes.report);
    setFilteredIncidents(searchRes.incidents || []);
  };

  useEffect(() => {
    loadReportAndSearch();
  }, [filters]);

  if (!report) return <div className="panel">Loading Operational Analytics...</div>;

  return (
    <div>
      {/* 1. Incident Overview KPI Row (PDF Page 9) */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <span>Total Incidents</span>
          <strong>{report.incidentOverview.totalIncidents}</strong>
        </div>
        <div className="kpi-card">
          <span>Open Incidents</span>
          <strong>{report.incidentOverview.openIncidents}</strong>
        </div>
        <div className="kpi-card critical">
          <span>Critical (P1) Incidents</span>
          <strong>{report.incidentOverview.criticalIncidents}</strong>
        </div>
        <div className="kpi-card success">
          <span>Resolved / Closed</span>
          <strong>{report.incidentOverview.resolvedIncidents}</strong>
        </div>
        <div className="kpi-card danger">
          <span>SLA Violations</span>
          <strong>{report.incidentOverview.slaViolations}</strong>
        </div>
      </div>

      {/* 2. Technician Workload & Service Analysis (PDF Page 9) */}
      <div className="portal-grid">
        <div className="panel">
          <h3>Technician Workload Analysis</h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>Technician ID</th>
                <th>Name</th>
                <th>Skills</th>
                <th>Active Incidents</th>
                <th>Resolved</th>
              </tr>
            </thead>
            <tbody>
              {report.technicianWorkload.map((t) => (
                <tr key={t.technicianId}>
                  <td><strong>{t.technicianId}</strong></td>
                  <td>{t.name}</td>
                  <td>{t.skills?.join(', ')}</td>
                  <td>
                    <strong>{t.activeIncidents} / {t.maxWorkload}</strong>
                  </td>
                  <td>{t.resolvedIncidents}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="panel">
          <h3>Service Incident Analysis</h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>Service</th>
                <th>Category</th>
                <th>Criticality</th>
                <th>Total Incidents</th>
                <th>Open</th>
                <th>SLA Breaches</th>
              </tr>
            </thead>
            <tbody>
              {report.serviceAnalysis.map((s) => (
                <tr key={s.serviceId}>
                  <td><strong>{s.serviceName}</strong></td>
                  <td>{s.category}</td>
                  <td>{s.businessCriticality}/5</td>
                  <td><strong>{s.incidentCount}</strong></td>
                  <td>{s.openCount}</td>
                  <td>{s.slaViolations}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. Multi-Criteria Search & Filtering (8 Criteria per PDF Page 8-9) */}
      <div className="panel" style={{ marginTop: '1.25rem' }}>
        <h3>Multi-Criteria Incident Search & Filter (8 Criteria)</h3>
        <div className="search-filter-grid">
          <input
            type="text"
            placeholder="1. Incident ID or Title keyword..."
            value={filters.incidentId}
            onChange={(e) => setFilters({ ...filters, incidentId: e.target.value })}
          />
          <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
            <option value="ALL">2. All Statuses</option>
            <option value="NEW">NEW</option>
            <option value="CLASSIFIED">CLASSIFIED</option>
            <option value="ASSIGNED">ASSIGNED</option>
            <option value="ACKNOWLEDGED">ACKNOWLEDGED</option>
            <option value="IN_PROGRESS">IN_PROGRESS</option>
            <option value="RESOLVED">RESOLVED</option>
            <option value="VERIFIED">VERIFIED</option>
            <option value="CLOSED">CLOSED</option>
          </select>
          <select value={filters.priority} onChange={(e) => setFilters({ ...filters, priority: e.target.value })}>
            <option value="ALL">3. All Priorities</option>
            <option value="P1">P1 - Critical</option>
            <option value="P2">P2 - High</option>
            <option value="P3">P3 - Medium</option>
            <option value="P4">P4 - Low</option>
          </select>
          <select value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })}>
            <option value="ALL">4. All Categories</option>
            {catalog.categories?.map((c) => (
              <option key={c.categoryId} value={c.name}>{c.name}</option>
            ))}
          </select>
          <select value={filters.serviceId} onChange={(e) => setFilters({ ...filters, serviceId: e.target.value })}>
            <option value="ALL">5. All IT Services</option>
            {catalog.services?.map((s) => (
              <option key={s.serviceId} value={s.serviceId}>{s.name}</option>
            ))}
          </select>
          <select value={filters.technicianId} onChange={(e) => setFilters({ ...filters, technicianId: e.target.value })}>
            <option value="ALL">6. All Technicians</option>
            {report.technicianWorkload.map((t) => (
              <option key={t.technicianId} value={t.technicianId}>{t.name}</option>
            ))}
          </select>
          <select value={filters.slaStatus} onChange={(e) => setFilters({ ...filters, slaStatus: e.target.value })}>
            <option value="ALL">7. All SLA Statuses</option>
            <option value="COMPLIANT">COMPLIANT</option>
            <option value="AT_RISK">AT_RISK</option>
            <option value="VIOLATED">VIOLATED</option>
          </select>
          <input
            type="date"
            title="8. Filter by Creation Date"
            value={filters.startDate}
            onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
          />
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>Incident ID</th>
              <th>Title</th>
              <th>Category</th>
              <th>Service</th>
              <th>Priority</th>
              <th>Status</th>
              <th>Technician</th>
              <th>SLA Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredIncidents.map((inc) => (
              <tr key={inc.incidentId}>
                <td><strong>{inc.incidentId}</strong></td>
                <td>{inc.title}</td>
                <td>{inc.category}</td>
                <td>{inc.serviceName}</td>
                <td><span className={`badge priority-${inc.priority}`}>{inc.priority}</span></td>
                <td><span className={`badge status-${inc.status}`}>{inc.status}</span></td>
                <td>{inc.assignedTechnicianName || 'Unassigned'}</td>
                <td><span className={`badge sla-${inc.slaRecord?.slaStatus}`}>{inc.slaRecord?.slaStatus}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
