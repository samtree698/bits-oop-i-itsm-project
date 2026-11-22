const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export async function apiRequest(endpoint, { method = 'GET', body = null, token = null } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const activeToken = token || localStorage.getItem('itsm_token');
  if (activeToken) {
    headers.Authorization = `Bearer ${activeToken}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false) {
    const errMsg = data?.error?.message || `Request failed with status ${response.status}`;
    const err = new Error(errMsg);
    err.code = data?.error?.code || 'API_ERROR';
    err.type = data?.error?.type || 'Error';
    throw err;
  }
  return data;
}
