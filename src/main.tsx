import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Automatically inject session authentication token into all API calls
const originalFetch = window.fetch;
window.fetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
  const token = localStorage.getItem('vasco_session_token');
  if (token) {
    const headers = new Headers(init.headers || {});
    if (!headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    init.headers = headers;
  }
  const response = await originalFetch(input, init);
  if (
    response.status === 401 &&
    typeof input === 'string' &&
    input.startsWith('/api') &&
    !input.includes('/api/auth/login')
  ) {
    localStorage.removeItem('vasco_session_token');
    window.dispatchEvent(new Event('vasco_unauthorized'));
  }
  return response;
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
