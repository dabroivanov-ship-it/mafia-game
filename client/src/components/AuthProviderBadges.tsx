import type { AuthProvider } from '../types';

const LABELS: Record<AuthProvider, string> = {
  telegram: 'TG',
  vk: 'VK',
  email: 'другое',
};

const TITLES: Record<AuthProvider, string> = {
  telegram: 'Вход через Telegram',
  vk: 'Вход через VK',
  email: 'Логин и пароль',
};

export function AuthProviderBadges({ providers }: { providers?: AuthProvider[] | null }) {
  if (!providers?.length) return null;
  return (
    <>
      {providers.map((provider) => (
        <span
          key={provider}
          className={`admin-auth-badge admin-auth-badge-${provider}`}
          title={TITLES[provider]}
        >
          {LABELS[provider]}
        </span>
      ))}
    </>
  );
}
