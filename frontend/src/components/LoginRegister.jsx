import React, { useState } from 'react';
import { apiRequest } from '../api/client';

const DEMO_ACCOUNTS = [
  { label: 'Administrator (IT Manager)', email: 'admin@bits-itsm.edu', password: 'Admin@123', badge: 'ADMIN' },
  { label: 'Technician: Arjun (Payment/App)', email: 'tech.arjun@bits-itsm.edu', password: 'Tech@123', badge: 'TECH T101' },
  { label: 'Technician: Priya (Network/Cloud)', email: 'tech.priya@bits-itsm.edu', password: 'Tech@123', badge: 'TECH T102' },
  { label: 'Technician: Rohan (Database/Auth)', email: 'tech.rohan@bits-itsm.edu', password: 'Tech@123', badge: 'TECH T103' },
  { label: 'Employee: Ananya Deshmukh', email: 'emp.ananya@bits-itsm.edu', password: 'Emp@123', badge: 'EMPLOYEE' },
  { label: 'Employee: Vikramaditya Rao', email: 'emp.vikram@bits-itsm.edu', password: 'Emp@123', badge: 'EMPLOYEE' }
];

export default function LoginRegister({ onAuthSuccess }) {
  const [mode, setMode] = useState('LOGIN'); // 'LOGIN' | 'REGISTER'
  const [email, setEmail] = useState('emp.ananya@bits-itsm.edu');
  const [password, setPassword] = useState('Emp@123');
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('Computer Science & IS');
  const [location, setLocation] = useState('Hyderabad Campus');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'LOGIN') {
        const res = await apiRequest('/auth/login', {
          method: 'POST',
          body: { email, password }
        });
        onAuthSuccess(res.user, res.token);
      } else {
        const res = await apiRequest('/auth/register', {
          method: 'POST',
          body: { name, email, password, department, location }
        });
        onAuthSuccess(res.user, res.token);
      }
    } catch (err) {
      setError(`${err.type}: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (acct) => {
    setError('');
    setLoading(true);
    try {
      const res = await apiRequest('/auth/login', {
        method: 'POST',
        body: { email: acct.email, password: acct.password }
      });
      onAuthSuccess(res.user, res.token);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="auth-header">
          <span className="course-pill">BITS Pilani • CS F213 / MAC F212 OOP Project</span>
          <h1>Intelligent IT Service Management (I-ITSM)</h1>
          <p>Report • Classify • Prioritize • Assign • Investigate • Resolve • Verify • Close</p>
        </div>

        <div className="tab-switch">
          <button
            type="button"
            className={mode === 'LOGIN' ? 'active' : ''}
            onClick={() => {
              setMode('LOGIN');
              setError('');
            }}
          >
            Sign In with Credentials
          </button>
          <button
            type="button"
            className={mode === 'REGISTER' ? 'active' : ''}
            onClick={() => {
              setMode('REGISTER');
              setEmail('');
              setPassword('');
              setError('');
            }}
          >
            Register New Employee
          </button>
        </div>

        {error && <div className="alert-error">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          {mode === 'REGISTER' && (
            <>
              <div className="form-group">
                <label>Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Rohan Kulkarni"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Department</label>
                  <input
                    type="text"
                    required
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Location</label>
                  <input
                    type="text"
                    required
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                  />
                </div>
              </div>
            </>
          )}

          <div className="form-group">
            <label>Organization Email</label>
            <input
              type="email"
              required
              placeholder="name@bits-itsm.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              required
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button type="submit" className="btn-primary full-width" disabled={loading}>
            {loading ? 'Processing...' : mode === 'LOGIN' ? 'Login to Portal' : 'Create Employee Account'}
          </button>
        </form>

        <div className="demo-switcher">
          <h4>One-Click Role Login (For Live Demo & Testing)</h4>
          <div className="demo-grid">
            {DEMO_ACCOUNTS.map((acct) => (
              <button
                key={acct.email}
                type="button"
                className="btn-demo"
                onClick={() => handleQuickLogin(acct)}
              >
                <span className="demo-badge">{acct.badge}</span>
                <span className="demo-name">{acct.label}</span>
                <small>{acct.email}</small>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
