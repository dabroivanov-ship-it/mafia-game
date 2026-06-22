import { useCallback, useEffect, useState } from 'react';
import { telegramOidcLogin } from '../api';
import type { User } from '../types';

const TELEGRAM_OIDC_SCRIPT = 'https://oauth.telegram.org/js/telegram-login.js';

interface TelegramLoginWidgetProps {
  oidcClientId: string;
  loginReady: boolean;
  loading: boolean;
  onLoadingChange: (loading: boolean) => void;
  onError: (message: string) => void;
  onAuthenticated: (token: string, user: User) => void;
}

function loadTelegramOidcScript(): Promise<void> {
  if (window.Telegram?.Login) return Promise.resolve();

  const existing = document.querySelector<HTMLScriptElement>('script[data-tg-oidc="1"]');
  if (existing) {
    return new Promise((resolve, reject) => {
      if (window.Telegram?.Login) {
        resolve();
        return;
      }
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Не удалось загрузить Telegram OIDC')), {
        once: true,
      });
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = TELEGRAM_OIDC_SCRIPT;
    script.async = true;
    script.dataset.tgOidc = '1';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Не удалось загрузить Telegram OIDC'));
    document.head.appendChild(script);
  });
}

export default function TelegramLoginWidget({
  oidcClientId,
  loginReady,
  loading,
  onLoadingChange,
  onError,
  onAuthenticated,
}: TelegramLoginWidgetProps) {
  const [scriptReady, setScriptReady] = useState(false);

  useEffect(() => {
    if (!loginReady) return;
    let cancelled = false;
    void loadTelegramOidcScript()
      .then(() => {
        if (!cancelled) setScriptReady(true);
      })
      .catch((err) => {
        if (!cancelled) {
          onError(err instanceof Error ? err.message : 'Ошибка загрузки Telegram OIDC');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [loginReady, onError]);

  const handleLogin = useCallback(() => {
    if (!window.Telegram?.Login) {
      onError('Telegram OIDC ещё не загружен');
      return;
    }

    onError('');
    window.Telegram.Login.auth(
      {
        client_id: Number(oidcClientId),
      },
      (data) => {
        if (data.error) {
          onError(data.error);
          return;
        }
        if (!data.id_token) {
          onError('Telegram не вернул id_token');
          return;
        }

        onLoadingChange(true);
        void telegramOidcLogin(data.id_token, true)
          .then(({ token, user }) => {
            onAuthenticated(token, user);
          })
          .catch((err) => {
            onError(err instanceof Error ? err.message : 'Ошибка Telegram входа');
          })
          .finally(() => {
            onLoadingChange(false);
          });
      }
    );
  }, [oidcClientId, onAuthenticated, onError, onLoadingChange]);

  if (!loginReady) {
    return (
      <div className="auth-telegram-block auth-telegram-hint">
        <p className="muted">
          Вход через Telegram временно недоступен. В BotFather включите Web Login → OpenID Connect и
          добавьте в <code>server/.env</code> переменные <code>TELEGRAM_OIDC_CLIENT_ID</code> и{' '}
          <code>TELEGRAM_OIDC_CLIENT_SECRET</code>, а также зарегистрируйте URL сайта.
        </p>
      </div>
    );
  }

  return (
    <div className="auth-telegram-block">
      <button
        type="button"
        className="btn btn-primary btn-lg auth-telegram-btn"
        onClick={handleLogin}
        disabled={!scriptReady || loading}
      >
        {loading ? 'Входим через Telegram...' : 'Войти через Telegram'}
      </button>
    </div>
  );
}
