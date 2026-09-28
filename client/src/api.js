// Small fetch wrapper: adds the JWT, parses JSON, throws readable errors
const API_BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

export async function api(path, { method = 'GET', body, form } = {}) {
  const headers = {};
  const token = localStorage.getItem('token');
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (form) payload = form;
  else if (body) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(`${API_BASE_URL}/api${path}`, { method, headers, body: payload });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || 'Something went wrong');
    err.status = res.status;
    throw err;
  }
  return data;
}

// Uploaded files need the login token (they are not public)
export function fileUrl(url, download = false) {
  const token = localStorage.getItem('token') || '';
  const resolvedUrl = url.startsWith('/') ? `${API_BASE_URL}${url}` : url;
  return `${resolvedUrl}?token=${encodeURIComponent(token)}${download ? '&download=1' : ''}`;
}
