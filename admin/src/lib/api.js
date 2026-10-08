const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');

function getStoredToken() {
  try {
    return localStorage.getItem('admin_token') || '';
  } catch {
    return '';
  }
}

function clearSession() {
  try {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
  } catch {
    // no-op
  }

  if (window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
}

function buildUrl(path) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL || ''}${normalizedPath}`;
}

async function request(path, options = {}) {
  const token = getStoredToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(buildUrl(path), {
    ...options,
    headers,
  });

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();

  if (response.status === 401) {
    clearSession();
    throw new Error(payload?.message || 'Authentication required');
  }

  if (!response.ok) {
    const message = typeof payload === 'string' ? payload : payload?.message || 'Request failed';
    const error = new Error(message);
    error.details = payload?.errors;
    throw error;
  }

  if (typeof payload === 'string') {
    return payload;
  }

  if (payload && Object.prototype.hasOwnProperty.call(payload, 'data')) {
    return payload;
  }

  return { success: true, data: payload, message: 'Success' };
}

export const api = {
  get: (path, config = {}) => request(path, { method: 'GET', ...config }),
  post: (path, body, config = {}) => request(path, { method: 'POST', body: JSON.stringify(body ?? {}), ...config }),
  put: (path, body, config = {}) => request(path, { method: 'PUT', body: JSON.stringify(body ?? {}), ...config }),
  patch: (path, body, config = {}) => request(path, { method: 'PATCH', body: JSON.stringify(body ?? {}), ...config }),
  delete: (path, body, config = {}) => request(path, { method: 'DELETE', body: body ? JSON.stringify(body) : undefined, ...config }),
};

const inflightGetRequests = new Map();

export async function apiGet(path) {
  if (inflightGetRequests.has(path)) {
    return inflightGetRequests.get(path);
  }

  const requestPromise = api.get(path)
    .then((payload) => payload.data ?? payload)
    .finally(() => {
      inflightGetRequests.delete(path);
    });

  inflightGetRequests.set(path, requestPromise);
  return requestPromise;
}

export async function apiGetKycDocument(documentId) {
  const response = await fetch(
    buildUrl(`/admin/kyc/documents/${encodeURIComponent(documentId)}`),
    { headers: { Authorization: `Bearer ${getStoredToken()}` } },
  );
  if (response.status === 401) {
    clearSession();
    throw new Error("Authentication required");
  }
  if (!response.ok) {
    throw new Error("Unable to load KYC document");
  }
  return response.blob();
}

export async function apiPost(path, payload) {
  return api.post(path, payload).then((body) => body.data ?? body);
}

export async function apiPut(path, payload) {
  return api.put(path, payload).then((body) => body.data ?? body);
}

export async function apiPatch(path, payload) {
  return api.patch(path, payload).then((body) => body.data ?? body);
}

export async function apiDelete(path, payload) {
  return api.delete(path, payload).then((body) => body.data ?? body);
}
