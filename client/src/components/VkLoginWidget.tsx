import VkIcon from './VkIcon';

interface VkLoginWidgetProps {
  loginReady: boolean;
  redirectUri?: string | null;
  remember: boolean;
  loading: boolean;
  onError: (message: string) => void;
}

export default function VkLoginWidget({
  loginReady,
  redirectUri,
  remember,
  loading,
  onError,
}: VkLoginWidgetProps) {
  const handleLogin = () => {
    onError('');
    const base =
      import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? 'http://localhost:3001' : '');
    const rememberParam = remember ? '1' : '0';
    window.location.href = `${base}/api/auth/vk/start?remember=${rememberParam}`;
  };

  if (!loginReady) {
    return (
      <div className="auth-vk-block auth-vk-hint">
        <p className="muted">
          Вход через VK временно недоступен. Создайте приложение в{' '}
          <a href="https://id.vk.com" target="_blank" rel="noreferrer">
            VK ID
          </a>{' '}
          и добавьте в <code>server/.env</code> переменные <code>VK_CLIENT_ID</code> и{' '}
          <code>VK_CLIENT_SECRET</code>.
          {redirectUri ? (
            <>
              {' '}
              Зарегистрируйте redirect URI: <code>{redirectUri}</code>
            </>
          ) : (
            <> Также укажите домен сайта и redirect URI в настройках приложения.</>
          )}
        </p>
      </div>
    );
  }

  return (
    <button
      type="button"
      className="auth-social-btn"
      onClick={handleLogin}
      disabled={loading}
      title={loading ? 'Входим через VK...' : 'Войти через VK'}
    >
      <VkIcon className="auth-social-btn-icon auth-vk-btn-icon" />
      <span>VK</span>
    </button>
  );
}
