import { useState, FormEvent, useEffect, useCallback } from 'react';
import {
  login,
  register,
  saveSession,
  loadRememberedLogin,
  saveRememberedLogin,
  fetchTelegramSettings,
  fetchVkSettings,
  completeVkUsernameSetup,
  telegramWebAppLogin,
  fetchMe,
} from '../api';
import type { User } from '../types';
import { USER_GENDER_LABELS } from '../gender';
import { isTelegramWebApp, waitForTelegramWebApp } from '../telegramWebApp';
import TelegramLoginWidget from './TelegramLoginWidget';
import TelegramIcon from './TelegramIcon';
import VkLoginWidget from './VkLoginWidget';
import GuestLayout from './GuestLayout';
import { DEFAULT_PAGE_META, updatePageMeta } from '../seo';
import type { SiteBranding } from '../types';
import { DEFAULT_SITE_BRANDING } from '../siteBranding';

interface AuthProps {
  onSuccess: (user: User, token: string) => void;
  branding?: SiteBranding;
}

export default function Auth({ onSuccess, branding = DEFAULT_SITE_BRANDING }: AuthProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [telegramOidcRedirectUri, setTelegramOidcRedirectUri] = useState<string | null>(null);
  const [telegramLoginReady, setTelegramLoginReady] = useState(false);
  const [telegramLoading, setTelegramLoading] = useState(false);
  const [telegramWebAppMode, setTelegramWebAppMode] = useState(false);
  const [vkRedirectUri, setVkRedirectUri] = useState<string | null>(null);
  const [vkLoginReady, setVkLoginReady] = useState(false);
  const [vkLoading, setVkLoading] = useState(false);
  const [vkSetup, setVkSetup] = useState<{
    setupToken: string;
    suggestedUsername: string;
    displayName: string;
    takenUsername: string;
  } | null>(null);
  const [vkUsername, setVkUsername] = useState('');

  const [loginForm, setLoginForm] = useState({ login: '', password: '' });
  const [regForm, setRegForm] = useState({
    username: '',
    email: '',
    password: '',
    confirm: '',
    displayName: '',
    gender: '' as '' | 'male' | 'female',
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

  const completeAuth = useCallback(
    (user: User, token: string, rememberLogin: string) => {
      saveRememberedLogin(rememberLogin, true);
      saveSession(token, user);
      onSuccess(user, token);
    },
    [onSuccess]
  );

  useEffect(() => {
    fetchTelegramSettings()
      .then(({ oidcRedirectUri, loginReady }) => {
        setTelegramOidcRedirectUri(oidcRedirectUri);
        setTelegramLoginReady(loginReady);
      })
      .catch(() => {
        setTelegramOidcRedirectUri(null);
        setTelegramLoginReady(false);
      });

    fetchVkSettings()
      .then(({ redirectUri, loginReady }) => {
        setVkRedirectUri(redirectUri);
        setVkLoginReady(loginReady);
      })
      .catch(() => {
        setVkRedirectUri(null);
        setVkLoginReady(false);
      });
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tgError = params.get('tg_error');
    const tgToken = params.get('tg_token');
    const vkError = params.get('vk_error');
    const vkToken = params.get('vk_token');
    const vkSetupToken = params.get('vk_setup');

    if (tgError || vkError) {
      setError(tgError || vkError || '');
      window.history.replaceState(null, '', window.location.pathname);
      return;
    }

    if (vkSetupToken) {
      const suggested = params.get('vk_suggested') || '';
      const displayName = params.get('vk_display') || '';
      const taken = params.get('vk_taken') || suggested;
      setVkSetup({
        setupToken: vkSetupToken,
        suggestedUsername: suggested,
        displayName,
        takenUsername: taken,
      });
      setVkUsername('');
      setError(
        taken
          ? `Ник «${taken}» уже занят. Придумайте другой логин.`
          : 'Придумайте логин для входа.'
      );
      setMode('login');
      window.history.replaceState(null, '', window.location.pathname);
      return;
    }

    const oauthToken = tgToken || vkToken;
    if (!oauthToken) return;

    let cancelled = false;
    if (tgToken) setTelegramLoading(true);
    if (vkToken) setVkLoading(true);
    setError('');
    localStorage.setItem('mafia_token', oauthToken);
    window.history.replaceState(null, '', window.location.pathname);

    void fetchMe()
      .then(({ user }) => {
        if (cancelled) return;
        const loginName =
          user.telegramUsername || user.vkUsername || user.username || String(user.id);
        completeAuth(user, oauthToken, loginName);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        localStorage.removeItem('mafia_token');
        setError(
          err instanceof Error
            ? err.message
            : tgToken
              ? 'Ошибка Telegram входа'
              : 'Ошибка VK входа'
        );
      })
      .finally(() => {
        if (!cancelled) {
          setTelegramLoading(false);
          setVkLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [completeAuth]);

  useEffect(() => {
    let cancelled = false;

    void waitForTelegramWebApp().then((webApp) => {
      if (cancelled || !webApp || !isTelegramWebApp()) return;

      setTelegramWebAppMode(true);
      setTelegramLoading(true);
      setError('');

      void telegramWebAppLogin(webApp.initData, true)
        .then(({ token, user }: { token: string; user: User }) => {
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
    });

    return () => {
      cancelled = true;
    };
  }, [completeAuth]);

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

  const handleVkUsernameSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!vkSetup) return;
    setError('');
    setVkLoading(true);
    try {
      const { token, user } = await completeVkUsernameSetup({
        setupToken: vkSetup.setupToken,
        username: vkUsername.trim(),
      });
      setVkSetup(null);
      completeAuth(user, token, user.username);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка регистрации через VK');
    } finally {
      setVkLoading(false);
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

    if (regForm.gender !== 'male' && regForm.gender !== 'female') {
      setError('Укажите пол');
      return;
    }

    setLoading(true);
    try {
      const { token, user } = await register({
        username: regForm.username,
        email: regForm.email,
        password: regForm.password,
        displayName: regForm.displayName || regForm.username,
        gender: regForm.gender,
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
    <GuestLayout branding={branding} centered>
      <div className="auth-card">
        <header className="auth-header">
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
            disabled={!!vkSetup}
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
            disabled={!!vkSetup}
          >
            Регистрация
          </button>
        </div>

        {error && <div className="auth-error">{error}</div>}

        {telegramWebAppMode && telegramLoading && (
          <p className="muted auth-telegram-block auth-telegram-loading">
            <TelegramIcon className="auth-telegram-btn-icon" />
            Входим через Telegram...
          </p>
        )}

        {vkSetup ? (
          <form className="auth-form auth-vk-setup" onSubmit={handleVkUsernameSubmit}>
            <p className="muted auth-vk-setup-name">
              Имя из VK: <strong>{vkSetup.displayName || '—'}</strong>
            </p>
            <label>
              Придумайте логин
              <input
                type="text"
                value={vkUsername}
                onChange={(e) => setVkUsername(e.target.value)}
                placeholder={vkSetup.suggestedUsername || 'username'}
                required
                minLength={3}
                maxLength={20}
                pattern="[A-Za-z0-9_]+"
                title="Только латинские буквы, цифры и _"
                autoComplete="username"
                autoFocus
              />
            </label>
            <p className="muted auth-vk-setup-hint">
              3–20 символов: латиница, цифры и _. Отображаемое имя останется «
              {vkSetup.displayName || 'из VK'}».
            </p>
            <button type="submit" className="btn btn-lg auth-vk-btn" disabled={vkLoading}>
              {vkLoading ? 'Сохраняем...' : 'Продолжить'}
            </button>
          </form>
        ) : (
          !(mode === 'login' && telegramWebAppMode && telegramLoading) &&
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
                  placeholder="Будет отображаться в игре"
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
                Ваше имя
                <input
                  type="text"
                  value={regForm.displayName}
                  onChange={(e) => setRegForm({ ...regForm, displayName: e.target.value })}
                  placeholder="Ваше имя"
                  maxLength={20}
                />
              </label>
              <label>
                Пол
                <select
                  value={regForm.gender}
                  onChange={(e) =>
                    setRegForm({
                      ...regForm,
                      gender: e.target.value as '' | 'male' | 'female',
                    })
                  }
                  required
                >
                  <option value="">Выберите пол</option>
                  <option value="male">{USER_GENDER_LABELS.male}</option>
                  <option value="female">{USER_GENDER_LABELS.female}</option>
                </select>
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

          ))
        )}

        {!vkSetup && mode === 'login' && !telegramWebAppMode && (
          <div className="auth-social">
            <p className="auth-social-or">
              <span>или</span>
            </p>
            <div className="auth-social-row">
              <TelegramLoginWidget
                loginReady={telegramLoginReady}
                oidcRedirectUri={telegramOidcRedirectUri}
                remember={rememberMe}
                loading={telegramLoading || vkLoading}
                onError={setError}
              />
              <VkLoginWidget
                loginReady={vkLoginReady}
                redirectUri={vkRedirectUri}
                remember={rememberMe}
                loading={telegramLoading || vkLoading}
                onError={setError}
              />
            </div>
          </div>
        )}



      </div>
    </GuestLayout>
  );
}

