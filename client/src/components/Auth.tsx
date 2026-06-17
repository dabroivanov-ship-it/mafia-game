import { useState, FormEvent, useEffect, useRef } from 'react';
import {
  login,
  register,
  saveSession,
  loadRememberedLogin,
  saveRememberedLogin,
  fetchTelegramSettings,
  telegramLogin,
  telegramWebAppLogin,
  type TelegramAuthPayload,
} from '../api';
import type { User } from '../types';

interface AuthProps {
  onSuccess: (user: User, token: string) => void;
}

declare global {
  interface Window {
    onTelegramAuth?: (payload: TelegramAuthPayload) => void;
    Telegram?: {
      WebApp: {
        initData: string;
        initDataUnsafe: {
          user?: { id: number; username?: string; first_name?: string };
        };
        ready: () => void;
        expand: () => void;
      };
    };
  }
}

export default function Auth({ onSuccess }: AuthProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [telegramBotUsername, setTelegramBotUsername] = useState<string | null>(null);
  const [telegramLoading, setTelegramLoading] = useState(false);
  const [telegramWebAppMode, setTelegramWebAppMode] = useState(false);
  const telegramWidgetRef = useRef<HTMLDivElement | null>(null);

  const [loginForm, setLoginForm] = useState({ login: '', password: '' });
  const [regForm, setRegForm] = useState({
    username: '',
    email: '',
    password: '',
    confirm: '',
    displayName: '',
  });

  useEffect(() => {
    const saved = loadRememberedLogin();
    setRememberMe(saved.remember);
    if (saved.login) {
      setLoginForm((prev) => ({ ...prev, login: saved.login }));
    }
  }, []);

  useEffect(() => {
    fetchTelegramSettings()
      .then(({ botUsername }) => {
        setTelegramBotUsername(botUsername);
      })
      .catch(() => {
        setTelegramBotUsername(null);
      });
  }, []);

  useEffect(() => {
    const webApp = window.Telegram?.WebApp;
    if (!webApp?.initData) return;

    webApp.ready();
    webApp.expand();
    setTelegramWebAppMode(true);
    setTelegramLoading(true);
    setError('');

    telegramWebAppLogin(webApp.initData, true)
      .then(({ token, user }) => {
        const username =
          webApp.initDataUnsafe.user?.username || String(webApp.initDataUnsafe.user?.id || '');
        saveRememberedLogin(username, true);
        saveSession(token, user);
        onSuccess(user, token);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Ошибка Telegram входа');
      })
      .finally(() => {
        setTelegramLoading(false);
      });
  }, [onSuccess]);

  useEffect(() => {
    if (!telegramBotUsername || !telegramWidgetRef.current || telegramWebAppMode) return;
    telegramWidgetRef.current.innerHTML = '';
    window.onTelegramAuth = async (payload: TelegramAuthPayload) => {
      setError('');
      setTelegramLoading(true);
      try {
        const { token, user } = await telegramLogin({ telegram: payload, remember: true });
        saveRememberedLogin(payload.username || String(payload.id), true);
        saveSession(token, user);
        onSuccess(user, token);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ошибка Telegram входа');
      } finally {
        setTelegramLoading(false);
      }
    };
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.setAttribute('data-telegram-login', telegramBotUsername);
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-radius', '8');
    script.setAttribute('data-userpic', 'false');
    script.setAttribute('data-onauth', 'onTelegramAuth(user)');
    telegramWidgetRef.current.appendChild(script);
    return () => {
      if (window.onTelegramAuth) delete window.onTelegramAuth;
    };
  }, [telegramBotUsername, onSuccess, telegramWebAppMode]);

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
              {telegramBotUsername && !telegramWebAppMode && (
                <div className="auth-telegram-block">
                  <p className="muted">Быстрый вход через Telegram</p>
                  <div ref={telegramWidgetRef} />
                  {telegramLoading && <p className="muted">Проверяем Telegram...</p>}
                </div>
              )}
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
      </div>
    </div>
  );
}
