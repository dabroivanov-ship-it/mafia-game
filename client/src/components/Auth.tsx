import { useState, FormEvent, useEffect, useCallback } from 'react';
import {
  login,
  register,
  saveSession,
  loadRememberedLogin,
  saveRememberedLogin,
  fetchTelegramSettings,
  telegramWebAppLogin,
} from '../api';
import type { User } from '../types';
import { getTelegramWebApp, isTelegramWebApp } from '../telegramWebApp';
import TelegramLoginWidget from './TelegramLoginWidget';
import { DEFAULT_PAGE_META, updatePageMeta } from '../seo';

interface AuthProps {
  onSuccess: (user: User, token: string) => void;
}

export default function Auth({ onSuccess }: AuthProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [telegramBotUsername, setTelegramBotUsername] = useState<string | null>(null);
  const [telegramLoginReady, setTelegramLoginReady] = useState(false);
  const [telegramLoading, setTelegramLoading] = useState(false);
  const [telegramWebAppMode, setTelegramWebAppMode] = useState(false);

  const [loginForm, setLoginForm] = useState({ login: '', password: '' });
  const [regForm, setRegForm] = useState({
    username: '',
    email: '',
    password: '',
    confirm: '',
    displayName: '',
  });

  useEffect(() => {
    updatePageMeta(DEFAULT_PAGE_META);
  }, []);

  useEffect(() => {
    const saved = loadRememberedLogin();
    setRememberMe(saved.remember);
    if (saved.login) {
      setLoginForm((prev) => ({ ...prev, login: saved.login }));
    }
  }, []);

  useEffect(() => {
    fetchTelegramSettings()
      .then(({ botUsername, loginReady }: { botUsername: string | null; loginReady: boolean; webAppUrl: string | null;}) => {
        setTelegramBotUsername(botUsername);
        setTelegramLoginReady(loginReady);
      })
      .catch(() => {
        setTelegramBotUsername(null);
        setTelegramLoginReady(false);
      });
  }, []);

  const completeAuth = useCallback(
    (user: User, token: string, rememberLogin: string) => {
      saveRememberedLogin(rememberLogin, true);
      saveSession(token, user);
      onSuccess(user, token);
    },
    [onSuccess]
  );

  useEffect(() => {
    let cancelled = false;

    const tryWebAppLogin = () => {
      const webApp = getTelegramWebApp();
      if (!isTelegramWebApp() || !webApp) return false;

      setTelegramWebAppMode(true);
      setTelegramLoading(true);
      setError('');

      void telegramWebAppLogin(webApp.initData, true)
        .then(({ token, user }: { token: string; user: User;}) => {
          if (cancelled) return;
          const username =
            webApp.initDataUnsafe.user?.username || String(webApp.initDataUnsafe.user?.id || '');
          completeAuth(user, token, username);
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          setError(err instanceof Error ? err.message : 'Ошибка Telegram входа');
        })
        .finally(() => {
          if (!cancelled) setTelegramLoading(false);
        });

      return true;
    };

    if (tryWebAppLogin()) {
      return () => {
        cancelled = true;
      };
    }

    const intervalId = window.setInterval(() => {
      if (cancelled) return;
      if (tryWebAppLogin()) window.clearInterval(intervalId);
    }, 150);

    const timeoutId = window.setTimeout(() => window.clearInterval(intervalId), 5000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.clearTimeout(timeoutId);
    };
  }, [completeAuth]);

  const handleTelegramAuthenticated = useCallback(
    (token: string, user: User) => {
      const loginName = user.telegramUsername || user.username || String(user.id);
      completeAuth(user, token, loginName);
    },
    [completeAuth]
  );

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { token, user } = await login({ ...loginForm, remember: rememberMe });
      saveRememberedLogin(loginForm.login.trim(), rememberMe);
      saveSession(token, user);
      onSuccess(user, token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка входа');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (regForm.password.length < 8) {
      setError('Пароль: минимум 8 символов');
      return;
    }

    if (regForm.password !== regForm.confirm) {
      setError('Пароли не совпадают');
      return;
    }

    setLoading(true);
    try {
      const { token, user } = await register({
        username: regForm.username,
        email: regForm.email,
        password: regForm.password,
        displayName: regForm.displayName || regForm.username,
      });
      saveRememberedLogin(regForm.username.trim(), true);
      saveSession(token, user);
      onSuccess(user, token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка регистрации');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <header className="auth-header">
          <h1>🎭 Мафия</h1>
          <p>Войдите или зарегистрируйтесь, чтобы играть</p>
        </header>

        <div className="auth-tabs">
          <button
            type="button"
            className={mode === 'login' ? 'active' : ''}
            onClick={() => {
              setMode('login');
              setError('');
            }}
          >
            Вход
          </button>
          <button
            type="button"
            className={mode === 'register' ? 'active' : ''}
            onClick={() => {
              setMode('register');
              setError('');
            }}
          >
            Регистрация
          </button>
        </div>

        {error && <div className="auth-error">{error}</div>}

        {telegramWebAppMode && telegramLoading && (
          <p className="muted auth-telegram-block">Входим через Telegram...</p>
        )}

        {!(mode === 'login' && telegramWebAppMode && telegramLoading) &&
          (mode === 'login' ? (
            <form className="auth-form" onSubmit={handleLogin}>
              <label>
                Логин или email
                <input
                  type="text"
                  value={loginForm.login}
                  onChange={(e) => setLoginForm({ ...loginForm, login: e.target.value })}
                  placeholder="username или email"
                  required
                  autoComplete="username"
                />
              </label>
              <label>
                Пароль
                <input
                  type="password"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                />
              </label>
              <label className="auth-remember">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span>Запомнить меня</span>
              </label>
              <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
                {loading ? 'Вход...' : 'Войти'}

              </button>

            </form>

          ) : (

            <form className="auth-form" onSubmit={handleRegister}>

              <label>

                Логин

                <input

                  type="text"

                  value={regForm.username}

                  onChange={(e) => setRegForm({ ...regForm, username: e.target.value })}
                  placeholder="player123"
                  required
                  minLength={3}
                  maxLength={20}
                  autoComplete="username"
                />
              </label>
              <label>
                Email
                <input
                  type="email"
                  value={regForm.email}
                  onChange={(e) => setRegForm({ ...regForm, email: e.target.value })}
                  placeholder="you@mail.ru"
                  required
                  autoComplete="email"
                />
              </label>
              <label>
                Имя
                <input
                  type="text"
                  value={regForm.displayName}
                  onChange={(e) => setRegForm({ ...regForm, displayName: e.target.value })}
                  placeholder="Как вас видят другие"
                  maxLength={20}
                />
              </label>
              <label>
                Пароль
                <input
                  type="password"
                  value={regForm.password}
                  onChange={(e) => setRegForm({ ...regForm, password: e.target.value })}
                  placeholder="минимум 8 символов"
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </label>
              <label>
                Повтор пароля
                <input
                  type="password"
                  value={regForm.confirm}
                  onChange={(e) => setRegForm({ ...regForm, confirm: e.target.value })}
                  placeholder="••••••••"
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </label>
              <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
                {loading ? 'Регистрация...' : 'Зарегистрироваться'}

              </button>

            </form>

          ))}



        {mode === 'login' && !telegramWebAppMode && telegramBotUsername && (

          <TelegramLoginWidget

            botUsername={telegramBotUsername}

            loginReady={telegramLoginReady}

            loading={telegramLoading}

            onLoadingChange={setTelegramLoading}

            onError={setError}

            onAuthenticated={handleTelegramAuthenticated}

          />

        )}



        {!telegramWebAppMode && (

          <a href="/info" className="auth-info-card">

            <span className="auth-info-card-icon" aria-hidden="true">

              ℹ️

            </span>

            <span className="auth-info-card-body">

              <strong>Правила, роли и рейтинг</strong>

              <span className="muted">Информация об игре для новичков и опытных игроков</span>

            </span>

            <span className="auth-info-card-arrow" aria-hidden="true">

              →

            </span>

          </a>

        )}

      </div>

    </div>

  );

}

