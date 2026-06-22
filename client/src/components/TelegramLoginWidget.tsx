interface TelegramLoginWidgetProps {
  loginReady: boolean;
  oidcRedirectUri?: string | null;
  remember: boolean;
  loading: boolean;
  onError: (message: string) => void;
}

export default function TelegramLoginWidget({
  loginReady,
  oidcRedirectUri,
  remember,
  loading,
  onError,
}: TelegramLoginWidgetProps) {
  const handleLogin = () => {
    onError('');
    const base =
      import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? 'http://localhost:3001' : '');
    const rememberParam = remember ? '1' : '0';
    window.location.href = `${base}/api/auth/telegram/oidc/start?remember=${rememberParam}`;
  };

  if (!loginReady) {
    return (
      <div className="auth-telegram-block auth-telegram-hint">
        <p className="muted">
          Вход через Telegram временно недоступен. В BotFather включите Web Login → OpenID Connect и
          добавьте в <code>server/.env</code> переменные <code>TELEGRAM_OIDC_CLIENT_ID</code> и{' '}
          <code>TELEGRAM_OIDC_CLIENT_SECRET</code>.
          {oidcRedirectUri ? (
            <>
              {' '}
              Зарегистрируйте redirect URI: <code>{oidcRedirectUri}</code>
            </>
          ) : (
            <> Также зарегистрируйте URL сайта и redirect URI в BotFather.</>
          )}
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
        disabled={loading}
      >
        {loading ? 'Входим через Telegram...' : 'Войти через Telegram'}
      </button>
    </div>
  );
}
