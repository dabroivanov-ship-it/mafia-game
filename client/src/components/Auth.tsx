import { useState, FormEvent } from 'react';
import { login, register, saveSession } from '../api';
import type { User } from '../types';

interface AuthProps {
  onSuccess: (user: User, token: string) => void;
}

export default function Auth({ onSuccess }: AuthProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [loginForm, setLoginForm] = useState({ login: '', password: '' });
  const [regForm, setRegForm] = useState({
    username: '',
    email: '',
    password: '',
    confirm: '',
    displayName: '',
  });

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { token, user } = await login(loginForm);
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

        {mode === 'login' ? (
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
                placeholder="••••••"
                required
                autoComplete="current-password"
              />
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
              Имя в игре
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
                placeholder="минимум 6 символов"
                required
                minLength={6}
                autoComplete="new-password"
              />
            </label>
            <label>
              Повтор пароля
              <input
                type="password"
                value={regForm.confirm}
                onChange={(e) => setRegForm({ ...regForm, confirm: e.target.value })}
                placeholder="••••••"
                required
                autoComplete="new-password"
              />
            </label>
            <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
              {loading ? 'Регистрация...' : 'Зарегистрироваться'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
