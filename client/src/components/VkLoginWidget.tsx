import VkIcon from './VkIcon';

interface VkLoginWidgetProps {
  loginReady: boolean;
  remember: boolean;
  loading: boolean;
  onError: (message: string) => void;
}

export default function VkLoginWidget({
  loginReady,
  remember,
  loading,
  onError,
}: VkLoginWidgetProps) {
  if (!loginReady) return null;

  const handleLogin = () => {
    onError('');
    const base =
      import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? 'http://localhost:3001' : '');
    const rememberParam = remember ? '1' : '0';
    window.location.href = `${base}/api/auth/vk/start?remember=${rememberParam}`;
  };

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
