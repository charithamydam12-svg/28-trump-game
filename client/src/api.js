// API helper for auth & profile

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

async function request(path, options = {}) {
  const token = localStorage.getItem('28trump_token');
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${SERVER_URL}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export const api = {
  signup: (body)  => request('/api/signup',  { method: 'POST', body: JSON.stringify(body) }),
  login:  (body)  => request('/api/login',   { method: 'POST', body: JSON.stringify(body) }),
  me:     ()      => request('/api/me'),
  updateProfile: (body) => request('/api/profile', { method: 'PUT', body: JSON.stringify(body) }),
  leaderboard:   () => request('/api/leaderboard'),
};

export const auth = {
  getToken: ()      => localStorage.getItem('28trump_token'),
  getUser:  ()      => { try { return JSON.parse(localStorage.getItem('28trump_user')); } catch { return null; } },
  save: (token, user) => {
    localStorage.setItem('28trump_token', token);
    localStorage.setItem('28trump_user', JSON.stringify(user));
  },
  updateUser: (user) => localStorage.setItem('28trump_user', JSON.stringify(user)),
  logout: () => {
    localStorage.removeItem('28trump_token');
    localStorage.removeItem('28trump_user');
    localStorage.removeItem('28trump_session');
  },
  isLoggedIn: () => !!localStorage.getItem('28trump_token'),
};
