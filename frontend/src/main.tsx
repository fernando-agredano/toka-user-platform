import { sessionCleared, sessionStarted } from '@/api/auth-slice';
import { refreshSession } from '@/api/base-query';
import { store } from '@/api/store';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { App } from './app';
import './index.css';

// The access token lives only in memory, so every page load restores the session from the refresh cookie.
refreshSession().then((session) => store.dispatch(session ? sessionStarted(session) : sessionCleared()));

const root = document.getElementById('root');
if (!root) throw new Error('Root element #root not found');

createRoot(root).render(
  <StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </StrictMode>,
);
