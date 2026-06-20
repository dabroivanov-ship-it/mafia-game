import { useEffect, useRef } from 'react';
import { telegramLogin, type TelegramAuthPayload } from '../api';
import type { User } from '../types';

interface TelegramLoginWidgetProps {
  botUsername: string;
  loginReady: boolean;
  loading: boolean;
  onLoadingChange: (loading: boolean) => void;
  onError: (message: string) => void;
  onAuthenticated: (token: string, user: User) => void;
}

export default function TelegramLoginWidget({
  botUsername,
  loginReady,
  loading,
  onLoadingChange,
  onError,
  onAuthenticated,
}: TelegramLoginWidgetProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!botUsername || !loginReady || !containerRef.current) return;

    const container = containerRef.current;
    container.innerHTML = '';

    const handler = (payload: TelegramAuthPayload) => {
      onError('');
      onLoadingChange(true);
      void telegramLogin({ telegram: payload, remember: true })
        .then(({ token, user }: { token: string; user: User }) => {
          onAuthenticated(token, user);
        })
        .catch((err) => {
          onError(err instanceof Error ? err.message : 'Ошибка Telegram входа');
        })
        .finally(() => {
          onLoadingChange(false);
        });
    };

    window.onTelegramAuth = handler;

    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.setAttribute('data-telegram-login', botUsername);
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-radius', '8');
    script.setAttribute('data-userpic', 'false');
    script.setAttribute('data-onauth', 'onTelegramAuth(user)');
    container.appendChild(script);

    return () => {
      container.innerHTML = '';
      if (window.onTelegramAuth === handler) {
        delete window.onTelegramAuth;
      }
    };
  }, [botUsername, loginReady, onAuthenticated, onError, onLoadingChange]);

  if (!loginReady) {
    return (
      <div className="auth-telegram-block auth-telegram-hint">
        <p className="muted">
          Вход через Telegram временно недоступен. Администратору нужно указать бота в админке, добавить{' '}
          <code>TELEGRAM_BOT_TOKEN</code> на сервер и выполнить <code>/setdomain</code> в BotFather для домена
          сайта.
        </p>
      </div>
    );
  }

  return (
    <div className="auth-telegram-block">
      <p className="auth-telegram-label">Быстрый вход через Telegram</p>
      <div ref={containerRef} className="auth-telegram-widget" />
      {loading && <p className="muted">Проверяем Telegram...</p>}
    </div>
  );
}

declare global {
  interface Window {
    onTelegramAuth?: (payload: TelegramAuthPayload) => void;
  }
}
