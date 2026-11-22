import React, { useState } from 'react';
import { apiRequest } from '../api/client';

export default function TechnicianPortal({ user, incidents, onRefresh, onUserUpdate }) {
  const [onlyAssigned, setOnlyAssigned] = useState(true);
  const [noteInput, setNoteInput] = useState({});
  const [requestInfoFlag, setRequestInfoFlag] = useState({});
  const [resolutionForm, setResolutionForm] = useState({});
  const [error, setError] = useState('');
  const [statusMsg, setStatusMsg] = useState('');

  const displayedIncidents = onlyAssigned
    ? incidents.filter((i) => i.assignedTechnicianId === user.id)
    : incidents;

  const activeCount = incidents.filter(
    (i) => i.assignedTechnicianId === user.id && !['RESOLVED', 'VERIFIED', 'CLOSED'].includes(i.status)
  ).length;

  const handleToggleAvailability = async () => {
    try {
      const res = await apiRequest(`/technicians/${user.id}/availability`, {
        method: 'PATCH',
        body: { available: !user.available }
      });
      onUserUpdate(res.technician);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleStateTransition = async (incidentId, targetState, extra = {}) => {
    setError('');
    setStatusMsg('');
    try {
      await apiRequest(`/incidents/${incidentId}/state`, {
        method: 'PATCH',
        body: { targetState, ...extra }
      });
      setStatusMsg(`Incident ${incidentId} transitioned to ${targetState}.`);
      onRefresh();
    } catch (err) {
      setError(`${err.type}: ${err.message}`);
    }
  };

  const handleAddInvestigationNote = async (incidentId) => {
    const content = noteInput[incidentId];
    if (!content) return;
    setError('');
    try {
      await apiRequest(`/incidents/${incidentId}/notes`, {
        method: 'POST',
        body: {
          content,
          isInfoRequest: Boolean(requestInfoFlag[incidentId])
        }
      });
      setNoteInput({ ...noteInput, [incidentId]: '' });
      setRequestInfoFlag({ ...requestInfoFlag, [incidentId]: false });
      setStatusMsg(`Added investigation note to ${incidentId}.`);
      onRefresh();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEscalate = async (incidentId) => {
    try {
      await apiRequest(`/incidents/${incidentId}/escalate`, {
        method: 'POST',
        body: { reason: `Escalated by Technician ${user.name} for senior intervention` }
      });
      setStatusMsg(`Incident ${incidentId} escalated along the management chain.`);
      onRefresh();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      <div className="tech-workload-banner">
        <div>
          <h2>Technician Support Console — {user.name}</h2>
          <p>
            <strong>Skills:</strong> {user.skills?.join(', ')} • <strong>Escalation Tier:</strong>{' '}
            {user.escalationRole || 'TECHNICIAN'} • <strong>Experience:</strong> {user.experienceYears} yrs
          </p>
        </div>
        <div className="workload-Right">
          <div className="workload-pill">
            Active Workload: <strong>{activeCount} / {user.maxWorkload || 5}</strong>
          </div>
          <button
            type="button"
            className={user.available ? 'btn-primary' : 'btn-secondary'}
            onClick={handleToggleAvailability}
          >
            Status: {user.available ? 'AVAILABLE (Online)' : 'UNAVAILABLE (Offline)'}
          </button>
        </div>
      </div>

      {statusMsg && <div className="alert-success">{statusMsg}</div>}
      {error && <div className="alert-error">{error}</div>}

      <div className="filter-toggle-row">
        <button
          type="button"
          className={onlyAssigned ? 'btn-primary' : 'btn-outline'}
          onClick={() => setOnlyAssigned(true)}
        >
          My Assigned Queue ({incidents.filter((i) => i.assignedTechnicianId === user.id).length})
        </button>
        <button
          type="button"
          className={!onlyAssigned ? 'btn-primary' : 'btn-outline'}
          onClick={() => setOnlyAssigned(false)}
        >
          All Organization Incidents ({incidents.length})
        </button>
      </div>

      <div className="incident-list">
        {displayedIncidents.map((inc) => {
          const resData = resolutionForm[inc.incidentId] || {
            rootCause: inc.suggestedResolution?.rootCause || '',
            resolutionSummary: inc.suggestedResolution?.recommendedFix || ''
          };

          return (
            <div key={inc.incidentId} className={`incident-card priority-border-${inc.priority}`}>
              <div className="card-top">
                <div>
                  <span className="inc-id">{inc.incidentId}</span>
                  <span className={`badge priority-${inc.priority}`}>
                    {inc.priority} (Score: {inc.priorityScore})
                  </span>
                  <span className={`badge status-${inc.status}`}>{inc.status}</span>
                  <span className={`badge sla-${inc.slaRecord?.slaStatus}`}>
                    SLA: {inc.slaRecord?.slaStatus}
                  </span>
                  {inc.slaRecord?.escalationLevel !== 'NONE' && (
                    <span className="badge escalated">Escalated: {inc.slaRecord.escalationLevel}</span>
                  )}
                </div>
                <small>
                  Response Target:{' '}
                  {inc.slaRecord?.responseDeadline
                    ? new Date(inc.slaRecord.responseDeadline).toLocaleTimeString()
                    : 'N/A'}{' '}
                  | Resolution Target:{' '}
                  {inc.slaRecord?.resolutionDeadline
                    ? new Date(inc.slaRecord.resolutionDeadline).toLocaleTimeString()
                    : 'N/A'}
                </small>
              </div>

              <h3>{inc.title}</h3>
              <p>{inc.description}</p>

              <div className="meta-row">
                <span>
                  <strong>Reporter:</strong> {inc.reporterName}
                </span>
                <span>
                  <strong>Service:</strong> {inc.serviceName}
                </span>
                <span>
                  <strong>Category:</strong> {inc.category}
                </span>
                <span>
                  <strong>Impact/Urgency:</strong> {inc.impact} / {inc.urgency}
                </span>
              </div>

              {inc.suggestedResolution && (
                <div className="ai-insight-box">
                  <strong>Intelligent Resolution Recommendation ({inc.suggestedResolution.sourceIncidentId}):</strong>{' '}
                  {inc.suggestedResolution.recommendedFix}
                </div>
              )}

              {/* State Pattern Guided Actions */}
              {inc.assignedTechnicianId === user.id && (
                <div className="tech-actions-bar">
                  {inc.status === 'ASSIGNED' && (
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => handleStateTransition(inc.incidentId, 'ACKNOWLEDGED')}
                    >
                      1. Accept / Acknowledge Incident (ASSIGNED → ACKNOWLEDGED)
                    </button>
                  )}

                  {inc.status === 'ACKNOWLEDGED' && (
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => handleStateTransition(inc.incidentId, 'IN_PROGRESS')}
                    >
                      2. Start Technical Investigation (ACKNOWLEDGED → IN_PROGRESS)
                    </button>
                  )}

                  {!['RESOLVED', 'VERIFIED', 'CLOSED'].includes(inc.status) && (
                    <button
                      type="button"
                      className="btn-outline"
                      onClick={() => handleEscalate(inc.incidentId)}
                    >
                      Escalate Incident
                    </button>
                  )}
                </div>
              )}

              {/* Investigation Notes Log */}
              {inc.investigationNotes?.length > 0 && (
                <div className="notes-box">
                  <strong>Investigation & Diagnostic Notes:</strong>
                  {inc.investigationNotes.map((n) => (
                    <div key={n.noteId} className="note-item">
                      <strong>{n.authorName}</strong> ({n.authorRole})
                      {n.isInfoRequest ? ' [INFO REQUEST]' : ''}
                      {n.isEmployeeResponse ? ' [EMPLOYEE REPLY]' : ''}: {n.content}
                    </div>
                  ))}
                </div>
              )}

              {/* Add Investigation Note or Request Info */}
              {inc.assignedTechnicianId === user.id &&
                !['RESOLVED', 'VERIFIED', 'CLOSED'].includes(inc.status) && (
                  <div className="tech-note-form">
                    <input
                      type="text"
                      placeholder="Add diagnostic findings or question for employee..."
                      value={noteInput[inc.incidentId] || ''}
                      onChange={(e) => setNoteInput({ ...noteInput, [inc.incidentId]: e.target.value })}
                    />
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={Boolean(requestInfoFlag[inc.incidentId])}
                        onChange={(e) =>
                          setRequestInfoFlag({ ...requestInfoFlag, [inc.incidentId]: e.target.checked })
                        }
                      />
                      Request Info from Employee
                    </label>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => handleAddInvestigationNote(inc.incidentId)}
                    >
                      Save Note
                    </button>
                  </div>
                )}

              {/* Resolution Form (Available when IN_PROGRESS) */}
              {inc.assignedTechnicianId === user.id && inc.status === 'IN_PROGRESS' && (
                <div className="resolve-panel">
                  <h4>Provide Resolution & Mark Incident RESOLVED</h4>
                  <div className="form-row">
                    <input
                      type="text"
                      placeholder="Root Cause (e.g., Connection pool exhausted)"
                      value={resData.rootCause}
                      onChange={(e) =>
                        setResolutionForm({
                          ...resolutionForm,
                          [inc.incidentId]: { ...resData, rootCause: e.target.value }
                        })
                      }
                    />
                    <input
                      type="text"
                      placeholder="Resolution Details & Fix Applied"
                      value={resData.resolutionSummary}
                      onChange={(e) =>
                        setResolutionForm({
                          ...resolutionForm,
                          [inc.incidentId]: { ...resData, resolutionSummary: e.target.value }
                        })
                      }
                    />
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() =>
                        handleStateTransition(inc.incidentId, 'RESOLVED', {
                          rootCause: resData.rootCause,
                          resolutionSummary: resData.resolutionSummary
                        })
                      }
                    >
                      3. Resolve Incident (IN_PROGRESS → RESOLVED)
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
