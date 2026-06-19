import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { fetchMetrikaSettings } from './api';
import { initTelegramWebApp } from './telegramWebApp';
import { initYandexMetrika } from './metrika';
import './themes.css';
import './App.css';

initTelegramWebApp();

function scheduleMetrika() {
  void fetchMetrikaSettings()
    .then(({ metrikaId }) => initYandexMetrika(metrikaId))
    .catch(() => {});
}

if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
  window.requestIdleCallback(() => scheduleMetrika(), { timeout: 3000 });
} else {
  window.setTimeout(scheduleMetrika, 1500);
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
