import React, { useState, useEffect } from 'react';
import { apiRequest } from './api/client';
import LoginRegister from './components/LoginRegister';
import EmployeePortal from './components/EmployeePortal';
import TechnicianPortal from './components/TechnicianPortal';
import AdminPortal from './components/AdminPortal';
import ReportsDashboard from './components/ReportsDashboard';
import NotificationCenter from './components/NotificationCenter';

export default function App() {
  const [user, setUser] = useState(null);
  const [catalog, setCatalog] = useState({ services: [], categories: [], slaPolicies: [], strategies: {} });
  const [incidents, setIncidents] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [activeView, setActiveView] = useState('WORKSPACE'); // 'WORKSPACE' | 'REPORTS'
  const [showNotif, setShowNotif] = useState(false);

  const loadCatalog = async () => {
    try {
      const res = await apiRequest('/catalog');
      setCatalog(res);
    } catch {}
  };

  const loadWorkspaceData = async () => {
    if (!user) return;
    try {
      const [incRes, notifRes, catRes] = await Promise.all([
        apiRequest(`/incidents?onlyOwn=${user.role === 'EMPLOYEE' ? 'true' : 'false'}`),
        apiRequest('/notifications'),
        apiRequest('/catalog')
      ]);
      setIncidents(incRes.incidents || []);
      setNotifications(notifRes.notifications || []);
      setCatalog(catRes);
    } catch {}
  };

  useEffect(() => {
    loadCatalog();
  }, []);

  useEffect(() => {
    if (user) {
      loadWorkspaceData();
    }
  }, [user]);

  const handleAuthSuccess = (loggedInUser, token) => {
    localStorage.setItem('itsm_token', token);
    setUser(loggedInUser);
    setActiveView('WORKSPACE');
  };

  const handleLogout = () => {
    localStorage.removeItem('itsm_token');
    setUser(null);
    setIncidents([]);
  };

  if (!user) {
    return <LoginRegister onAuthSuccess={handleAuthSuccess} />;
  }

  return (
    <div className="app-shell">
      <header className="top-navbar">
        <div className="brand-area">
          <span className="logo-badge">I-ITSM</span>
          <div>
            <strong>Intelligent IT Service Management</strong>
            <span className="role-tag">Role: {user.role}</span>
          </div>
        </div>

        <nav className="nav-links">
          <button
            type="button"
            className={activeView === 'WORKSPACE' ? 'active' : ''}
            onClick={() => setActiveView('WORKSPACE')}
          >
            {user.role === 'EMPLOYEE'
              ? 'Employee Self-Service Portal'
              : user.role === 'TECHNICIAN'
              ? 'Technician Incident Workspace'
              : 'Admin & Governance Console'}
          </button>
          <button
            type="button"
            className={activeView === 'REPORTS' ? 'active' : ''}
            onClick={() => setActiveView('REPORTS')}
          >
            Search & Analytics Reports
          </button>
        </nav>

        <div className="user-controls">
          <button type="button" className="btn-notif" onClick={() => setShowNotif(true)}>
            Notifications ({notifications.length})
          </button>
          <span className="user-name">{user.name}</span>
          <button type="button" className="btn-outline btn-sm" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      <main className="main-container">
        {activeView === 'REPORTS' ? (
          <ReportsDashboard catalog={catalog} />
        ) : user.role === 'EMPLOYEE' ? (
          <EmployeePortal
            user={user}
            catalog={catalog}
            incidents={incidents}
            onRefresh={loadWorkspaceData}
          />
        ) : user.role === 'TECHNICIAN' ? (
          <TechnicianPortal
            user={user}
            incidents={incidents}
            onRefresh={loadWorkspaceData}
            onUserUpdate={(updatedTech) => setUser(updatedTech)}
          />
        ) : (
          <AdminPortal
            catalog={catalog}
            incidents={incidents}
            onRefresh={loadWorkspaceData}
          />
        )}
      </main>

      {showNotif && (
        <NotificationCenter
          notifications={notifications}
          onClose={() => setShowNotif(false)}
        />
      )}
    </div>
  );
}
