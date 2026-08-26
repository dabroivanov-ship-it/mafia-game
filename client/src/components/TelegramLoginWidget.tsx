import TelegramIcon from './TelegramIcon';

interface TelegramLoginWidgetProps {
  loginReady: boolean;
  remember: boolean;
  loading: boolean;
  onError: (message: string) => void;
}

export default function TelegramLoginWidget({
  loginReady,
  remember,
  loading,
  onError,
}: TelegramLoginWidgetProps) {
  if (!loginReady) return null;

  const handleLogin = () => {
    onError('');
    const base =
      import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? 'http://localhost:3001' : '');
    const rememberParam = remember ? '1' : '0';
    window.location.href = `${base}/api/auth/telegram/oidc/start?remember=${rememberParam}`;
  };

  return (
    <button
      type="button"
      className="auth-social-btn"
      onClick={handleLogin}
      disabled={loading}
      title={loading ? 'Входим через Telegram...' : 'Войти через Telegram'}
    >
      <TelegramIcon className="auth-social-btn-icon auth-telegram-btn-icon" />
      <span>Telegram</span>
    </button>
  );
}
