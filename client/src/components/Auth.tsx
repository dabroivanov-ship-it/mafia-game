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
  completeOauthLogin,
  fetchOnlineCount,
  fetchSiteStats,
} from '../api';
import type { User, PublicSiteStats } from '../types';
import { USER_GENDER_LABELS } from '../gender';
import { isTelegramWebApp, waitForTelegramWebApp } from '../telegramWebApp';
import TelegramLoginWidget from './TelegramLoginWidget';
import TelegramIcon from './TelegramIcon';
import VkLoginWidget from './VkLoginWidget';
import GuestLayout from './GuestLayout';
import SiteServerStats from './SiteServerStats';
import SiteOnlineStatus from './SiteOnlineStatus';
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
  const [telegramLoginReady, setTelegramLoginReady] = useState(false);
  const [telegramLoading, setTelegramLoading] = useState(false);
  const [telegramWebAppMode, setTelegramWebAppMode] = useState(false);
  const [vkLoginReady, setVkLoginReady] = useState(false);
  const [vkLoading, setVkLoading] = useState(false);
  const [vkSetup, setVkSetup] = useState<{
    setupToken: string;
    suggestedUsername: string;
    displayName: string;
    takenUsername: string;
  } | null>(null);
  const [vkUsername, setVkUsername] = useState('');
  const [onlineCount, setOnlineCount] = useState(0);
  const [siteStats, setSiteStats] = useState<PublicSiteStats | null>(null);

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
    let cancelled = false;
    const load = async () => {
      try {
        const data = await fetchSiteStats();
        if (!cancelled) {
          setSiteStats(data);
          setOnlineCount(data.online);
        }
      } catch {
        try {
          const online = await fetchOnlineCount();
          if (!cancelled) setOnlineCount(online.onlineCount);
        } catch {
          /* keep last known count */
        }
      }
    };
    void load();
    const id = window.setInterval(() => void load(), 15000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    // Прогрев chunk socket.io, чтобы после входа лобби не зависало на чёрном экране.
    void import('socket.io-client').catch(() => {});
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
      .then(({ loginReady }) => {
        setTelegramLoginReady(loginReady);
      })
      .catch(() => {
        setTelegramLoginReady(false);
      });

    fetchVkSettings()
      .then(({ loginReady }) => {
        setVkLoginReady(loginReady);
      })
      .catch(() => {
        setVkLoginReady(false);
      });
  }, []);

  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const queryParams = new URLSearchParams(window.location.search);
    const tgError = hashParams.get('tg_error') || queryParams.get('tg_error');
    const vkError = hashParams.get('vk_error') || queryParams.get('vk_error');
    const tgLogin = hashParams.get('tg_login');
    const vkLogin = hashParams.get('vk_login');
    const vkSetupToken = queryParams.get('vk_setup');

    const clearCallbackUrl = () => {
      window.history.replaceState(null, '', window.location.pathname);
    };

    if (tgError || vkError) {
      setError(tgError || vkError || '');
      clearCallbackUrl();
      return;
    }

    if (vkSetupToken) {
      const suggested = queryParams.get('vk_suggested') || '';
      const displayName = queryParams.get('vk_display') || '';
      const taken = queryParams.get('vk_taken') || suggested;
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
      clearCallbackUrl();
      return;
    }

    const oauthTicket = tgLogin || vkLogin;
    if (!oauthTicket) return;

    let cancelled = false;
    if (tgLogin) setTelegramLoading(true);
    if (vkLogin) setVkLoading(true);
    setError('');
    clearCallbackUrl();

    void completeOauthLogin(oauthTicket)
      .then(({ token, user }) => {
        if (cancelled) return;
        const loginName =
          user.telegramUsername || user.vkUsername || user.username || String(user.id);
        completeAuth(user, token, loginName);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(
          err instanceof Error
            ? err.message
            : tgLogin
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
            {telegramLoginReady || vkLoginReady ? (
              <div className="auth-social-row">
                <TelegramLoginWidget
                  loginReady={telegramLoginReady}
                  remember={rememberMe}
                  loading={telegramLoading || vkLoading}
                  onError={setError}
                />
                <VkLoginWidget
                  loginReady={vkLoginReady}
                  remember={rememberMe}
                  loading={telegramLoading || vkLoading}
                  onError={setError}
                />
              </div>
            ) : (
              <p className="muted auth-social-unavailable">Авторизация временно недоступна</p>
            )}
          </div>
        )}



      </div>
      <footer className="auth-online-footer">
        {siteStats ? (
          <SiteServerStats stats={siteStats} onlineHref="/online" />
        ) : (
          <SiteOnlineStatus count={onlineCount} href="/online" />
        )}
      </footer>
    </GuestLayout>
  );
}

