import React from 'react';

export default function NotificationCenter({ notifications, onClose }) {
  return (
    <div className="notif-drawer-backdrop" onClick={onClose}>
      <div className="notif-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="notif-header">
          <h3>Multi-Channel Notifications ({notifications.length})</h3>
          <button type="button" className="btn-outline btn-sm" onClick={onClose}>
            Close
          </button>
        </div>
        <p className="muted-small">
          Observer Pattern Output: Real-Time In-App Alerts & Simulated Email Dispatches
        </p>
        <div className="notif-list">
          {notifications.map((n) => (
            <div key={n.notificationId} className={`notif-item channel-${n.channel}`}>
              <div className="notif-top">
                <span className="badge">{n.channel}</span>
                <small>{new Date(n.createdAt).toLocaleTimeString()}</small>
              </div>
              <strong>{n.title}</strong>
              <p>{n.message}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
