import React, { useState } from 'react';
import { apiRequest } from '../api/client';

const LIFECYCLE_STEPS = [
  'NEW',
  'CLASSIFIED',
  'ASSIGNED',
  'ACKNOWLEDGED',
  'IN_PROGRESS',
  'RESOLVED',
  'VERIFIED',
  'CLOSED'
];

export default function EmployeePortal({ user, catalog, incidents, onRefresh }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [serviceId, setServiceId] = useState(catalog.services?.[0]?.serviceId || 'SVC-PAYMENT');
  const [category, setCategory] = useState('AUTO');
  const [impact, setImpact] = useState(3);
  const [urgency, setUrgency] = useState(3);
  const [affectedUsers, setAffectedUsers] = useState(50);

  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [replyText, setReplyText] = useState({});
  const [feedbackData, setFeedbackData] = useState({});

  const handleAnalyze = async () => {
    if (!title && !description) return;
    setError('');
    try {
      const res = await apiRequest('/intelligence/analyze', {
        method: 'POST',
        body: { title, description, serviceId }
      });
      setAiAnalysis(res);
      if (res.categorySuggestion?.suggestedCategory) {
        setCategory(res.categorySuggestion.suggestedCategory);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleReportSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setMessage('');
    try {
      const res = await apiRequest('/incidents', {
        method: 'POST',
        body: {
          title,
          description,
          serviceId,
          category,
          impact: Number(impact),
          urgency: Number(urgency),
          affectedUsers: Number(affectedUsers)
        }
      });
      setMessage(
        `Incident ${res.incident.incidentId} created! Classified as ${res.incident.category}, Priority ${res.incident.priority}, Assigned to ${res.incident.assignedTechnicianName || 'Queue'}.`
      );
      setTitle('');
      setDescription('');
      setAiAnalysis(null);
      onRefresh();
    } catch (err) {
      setError(`${err.type}: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendAdditionalInfo = async (incidentId, isResponse) => {
    const content = replyText[incidentId];
    if (!content) return;
    try {
      await apiRequest(`/incidents/${incidentId}/notes`, {
        method: 'POST',
        body: { content, isEmployeeResponse: isResponse }
      });
      setReplyText({ ...replyText, [incidentId]: '' });
      onRefresh();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleFeedbackSubmit = async (incidentId) => {
    const fb = feedbackData[incidentId] || { rating: 5, feedback: 'Issue resolved satisfactorily.' };
    try {
      await apiRequest(`/incidents/${incidentId}/feedback`, {
        method: 'POST',
        body: {
          rating: Number(fb.rating || 5),
          feedback: fb.feedback || 'Resolved satisfactorily',
          verifyAndClose: true
        }
      });
      onRefresh();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="portal-grid">
      <div className="panel">
        <h2>Report an IT Incident</h2>
        <p className="muted">
          Describe the issue you are experiencing. Our intelligent engine automatically classifies, calculates SLA
          priority, detects duplicates, and assigns the best technician.
        </p>

        {message && <div className="alert-success">{message}</div>}
        {error && <div className="alert-error">{error}</div>}

        <form onSubmit={handleReportSubmit} className="incident-form">
          <div className="form-group">
            <label>Incident Summary / Title</label>
            <input
              type="text"
              required
              placeholder="e.g., Payment application unavailable"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Detailed Problem Description</label>
            <textarea
              rows={3}
              required
              placeholder="Describe error messages, affected transactions, and when the issue started..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="ai-bar">
            <button type="button" className="btn-secondary" onClick={handleAnalyze}>
              Auto-Analyze Description (Intelligent Assistant)
            </button>
            <button
              type="button"
              className="btn-outline"
              onClick={() => {
                setTitle("The organization's payment application is unavailable");
                setDescription(
                  "The organization's payment application is unavailable and users are unable to complete transactions."
                );
                setServiceId('SVC-PAYMENT');
                setImpact(3);
                setUrgency(3);
                setAffectedUsers(250);
              }}
            >
              Fill PDF Problem Scenario (Payment Outage)
            </button>
          </div>

          {aiAnalysis && (
            <div className="ai-insight-box">
              <h4>Intelligent Pre-Submission Analysis</h4>
              <p>
                <strong>Auto-Suggested Category:</strong> {aiAnalysis.categorySuggestion.suggestedCategory} (Confidence:{' '}
                {Math.round(aiAnalysis.categorySuggestion.confidence * 100)}%)
              </p>
              {aiAnalysis.duplicateCheck?.isPotentialDuplicate && (
                <div className="dup-warning">
                  <strong>Potential Duplicate Detected:</strong> Similar active incident(s):{' '}
                  {aiAnalysis.duplicateCheck.duplicates.map((d) => `${d.incidentId} (${d.title})`).join(', ')}
                </div>
              )}
              {aiAnalysis.suggestedResolution && (
                <p>
                  <strong>Historical Resolution Hint ({aiAnalysis.suggestedResolution.sourceIncidentId}):</strong>{' '}
                  {aiAnalysis.suggestedResolution.recommendedFix}
                </p>
              )}
            </div>
          )}

          <div className="form-row">
            <div className="form-group">
              <label>Affected IT Service</label>
              <select value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
                {catalog.services?.map((s) => (
                  <option key={s.serviceId} value={s.serviceId}>
                    {s.name} (Criticality: {s.businessCriticality}/5)
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Incident Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="AUTO">Auto-Detect via NLP Classifier</option>
                {catalog.categories?.map((c) => (
                  <option key={c.categoryId} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row three-col">
            <div className="form-group">
              <label>Business Impact (1-3)</label>
              <select value={impact} onChange={(e) => setImpact(e.target.value)}>
                <option value={1}>1 - Low (Single User)</option>
                <option value={2}>2 - Medium (Department)</option>
                <option value={3}>3 - High (Organization-Wide)</option>
              </select>
            </div>

            <div className="form-group">
              <label>Urgency (1-3)</label>
              <select value={urgency} onChange={(e) => setUrgency(e.target.value)}>
                <option value={1}>1 - Low (Workaround exists)</option>
                <option value={2}>2 - Medium (Degraded service)</option>
                <option value={3}>3 - High (Immediate blocker)</option>
              </select>
            </div>

            <div className="form-group">
              <label>Affected Users</label>
              <input
                type="number"
                min={1}
                value={affectedUsers}
                onChange={(e) => setAffectedUsers(e.target.value)}
              />
            </div>
          </div>

          <button type="submit" className="btn-primary full-width" disabled={submitting}>
            {submitting ? 'Submitting & Running Priority Engine...' : 'Submit Incident Report'}
          </button>
        </form>
      </div>

      <div className="panel">
        <h2>My Submitted Incidents ({incidents.length})</h2>
        <div className="incident-list">
          {incidents.map((inc) => {
            const stepIdx = LIFECYCLE_STEPS.indexOf(inc.status);
            return (
              <div key={inc.incidentId} className={`incident-card priority-border-${inc.priority}`}>
                <div className="card-top">
                  <div>
                    <span className="inc-id">{inc.incidentId}</span>
                    <span className={`badge priority-${inc.priority}`}>{inc.priority}</span>
                    <span className={`badge status-${inc.status}`}>{inc.status}</span>
                    <span className={`badge sla-${inc.slaRecord?.slaStatus}`}>
                      SLA: {inc.slaRecord?.slaStatus}
                    </span>
                  </div>
                  <small>{new Date(inc.createdAt).toLocaleString()}</small>
                </div>

                <h3>{inc.title}</h3>
                <p className="inc-desc">{inc.description}</p>

                <div className="meta-row">
                  <span>
                    <strong>Service:</strong> {inc.serviceName}
                  </span>
                  <span>
                    <strong>Category:</strong> {inc.category}
                  </span>
                  <span>
                    <strong>Assigned Technician:</strong> {inc.assignedTechnicianName || 'Pending'}
                  </span>
                  <span>
                    <strong>Resolution Deadline:</strong>{' '}
                    {inc.slaRecord?.resolutionDeadline
                      ? new Date(inc.slaRecord.resolutionDeadline).toLocaleTimeString()
                      : 'N/A'}
                  </span>
                </div>

                {/* Lifecycle Progress Bar */}
                <div className="lifecycle-bar">
                  {LIFECYCLE_STEPS.map((st, idx) => (
                    <span key={st} className={`step-chip ${idx <= stepIdx ? 'completed' : ''}`}>
                      {st}
                    </span>
                  ))}
                </div>

                {inc.isPotentialDuplicate && (
                  <div className="dup-tag">
                    Correlated / Potential Duplicate of: {inc.duplicateOf.join(', ')}
                  </div>
                )}

                {inc.awaitingEmployeeInfo && (
                  <div className="info-request-alert">
                    <strong>Action Required:</strong> Technician requested additional information on this incident.
                  </div>
                )}

                {/* Investigation Notes & Info Requests */}
                {inc.investigationNotes?.length > 0 && (
                  <div className="notes-box">
                    <strong>Activity & Support Messages:</strong>
                    {inc.investigationNotes.map((n) => (
                      <div key={n.noteId} className="note-item">
                        <span>
                          <strong>{n.authorName}</strong> ({n.authorRole})
                          {n.isInfoRequest ? ' [REQUESTED INFO]' : ''}:
                        </span>{' '}
                        {n.content}
                      </div>
                    ))}
                  </div>
                )}

                {/* Resolution Details if Resolved/Verified/Closed */}
                {inc.resolution?.resolutionSummary && (
                  <div className="resolution-box">
                    <strong>Resolution Provided by {inc.resolution.resolvedByName}:</strong>
                    <p>
                      <em>Root Cause:</em> {inc.resolution.rootCause}
                    </p>
                    <p>
                      <em>Fix Applied:</em> {inc.resolution.resolutionSummary}
                    </p>
                  </div>
                )}

                {/* Add Info / Respond to Support Request */}
                {inc.status !== 'CLOSED' && (
                  <div className="reply-row">
                    <input
                      type="text"
                      placeholder={
                        inc.awaitingEmployeeInfo
                          ? 'Respond to technician support request...'
                          : 'Add additional information to this incident...'
                      }
                      value={replyText[inc.incidentId] || ''}
                      onChange={(e) => setReplyText({ ...replyText, [inc.incidentId]: e.target.value })}
                    />
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => handleSendAdditionalInfo(inc.incidentId, inc.awaitingEmployeeInfo)}
                    >
                      {inc.awaitingEmployeeInfo ? 'Send Response' : 'Add Info'}
                    </button>
                  </div>
                )}

                {/* Post-Resolution Feedback & Verification */}
                {inc.status === 'RESOLVED' && (
                  <div className="feedback-box">
                    <h4>Verify Resolution & Provide Feedback</h4>
                    <div className="form-row">
                      <select
                        value={feedbackData[inc.incidentId]?.rating || 5}
                        onChange={(e) =>
                          setFeedbackData({
                            ...feedbackData,
                            [inc.incidentId]: {
                              ...feedbackData[inc.incidentId],
                              rating: e.target.value
                            }
                          })
                        }
                      >
                        <option value={5}>5 Stars - Excellent</option>
                        <option value={4}>4 Stars - Good</option>
                        <option value={3}>3 Stars - Satisfactory</option>
                        <option value={2}>2 Stars - Slow Response</option>
                        <option value={1}>1 Star - Unsatisfactory</option>
                      </select>
                      <input
                        type="text"
                        placeholder="Share feedback on resolution..."
                        value={feedbackData[inc.incidentId]?.feedback || ''}
                        onChange={(e) =>
                          setFeedbackData({
                            ...feedbackData,
                            [inc.incidentId]: {
                              ...feedbackData[inc.incidentId],
                              feedback: e.target.value
                            }
                          })
                        }
                      />
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={() => handleFeedbackSubmit(inc.incidentId)}
                      >
                        Verify & Close Incident
                      </button>
                    </div>
                  </div>
                )}

                {inc.closure?.rating && (
                  <div className="closed-feedback">
                    <strong>Submitted Feedback:</strong> {inc.closure.rating}/5 Stars — "{inc.closure.employeeFeedback}"
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
