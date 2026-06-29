import { useEffect, useState } from 'react';
import { dismissInstallBanner, shouldShowInstallBanner } from '../utils/pwa';

export default function InstallAppBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(shouldShowInstallBanner());
  }, []);

  if (!visible) return null;

  function handleDismiss() {
    dismissInstallBanner();
    setVisible(false);
  }

  return (
    <div className="install-app-banner" role="region" aria-label="Установка приложения">
      <div className="install-app-banner-body">
        <p className="install-app-banner-title">Добавьте «Мафию» на экран</p>
        <p className="install-app-banner-text">
          Нажмите «Поделиться» в Safari, затем «На экран «Домой»» — и игра будет открываться как приложение.
        </p>
      </div>
      <button type="button" className="install-app-banner-close" onClick={handleDismiss} aria-label="Закрыть">
        ✕
      </button>
    </div>
  );
}
