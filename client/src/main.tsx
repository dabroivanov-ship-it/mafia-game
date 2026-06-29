import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import { fetchMetrikaSettings } from './api';
import { initTelegramWebApp } from './telegramWebApp';
import { initYandexMetrika } from './metrika';
import './themes.css';
import './App.css';

if ('serviceWorker' in navigator) {
  registerSW({ immediate: true });
}

initTelegramWebApp();

function scheduleMetrika() {
  void fetchMetrikaSettings()
    .then(({ metrikaId }) => initYandexMetrika(metrikaId))
    .catch(() => {});
}

scheduleMetrika();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
