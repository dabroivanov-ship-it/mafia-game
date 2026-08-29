import { avatarUrl } from '../api';
import type { User } from '../types';
import type { ReactNode } from 'react';

interface CabinetHubProps {
  user: User;
  unreadMailCount?: number;
  onOpenProfileSettings: () => void;
  onOpenAccountSettings: () => void;
  onOpenMessages: () => void;
  onOpenSupport: () => void;
  onOpenSanctions: () => void;
  onOpenUserSearch: () => void;
  onOpenClans?: () => void;
  onOpenStatistics?: () => void;
  onLogout: () => void;
  onBack: () => void;
}

type HubAction = 'clans' | 'messages' | 'support' | 'search' | 'sanctions' | 'profile' | 'account';
type HubIconId = 'clans' | 'mail' | 'support' | 'search' | 'sanctions' | 'profile' | 'settings' | 'edit' | 'logout' | 'chevron';

const HUB_ITEMS: { title: string; action: HubAction; icon: HubIconId }[] = [
  { title: 'Кланы', action: 'clans', icon: 'clans' },
  { title: 'Письма', action: 'messages', icon: 'mail' },
  { title: 'Поддержка', action: 'support', icon: 'support' },
  { title: 'Поиск пользователей', action: 'search', icon: 'search' },
  { title: 'Санкции', action: 'sanctions', icon: 'sanctions' },
  { title: 'Анкета', action: 'profile', icon: 'profile' },
  { title: 'Настройки', action: 'account', icon: 'settings' },
];

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

function HubIcon({ id }: { id: HubIconId }) {
  let children: ReactNode;
  switch (id) {
    case 'clans':
      children = (
        <>
          <path {...stroke} d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle {...stroke} cx="9" cy="7" r="4" />
          <path {...stroke} d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path {...stroke} d="M16 3.13a4 4 0 0 1 0 7.75" />
        </>
      );
      break;
    case 'mail':
      children = (
        <>
          <rect {...stroke} x="3" y="5" width="18" height="14" rx="2" />
          <path {...stroke} d="m3 7 9 6 9-6" />
        </>
      );
      break;
    case 'support':
      children = (
        <>
          <circle {...stroke} cx="12" cy="12" r="10" />
          <path {...stroke} d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3" />
          <path {...stroke} d="M12 17h.01" />
        </>
      );
      break;
    case 'search':
      children = (
        <>
          <circle {...stroke} cx="11" cy="11" r="7" />
          <path {...stroke} d="m20 20-3.5-3.5" />
        </>
      );
      break;
    case 'sanctions':
      children = (
        <>
          <path {...stroke} d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
          <path {...stroke} d="M9 12l2 2 4-4" />
        </>
      );
      break;
    case 'profile':
      children = (
        <>
          <path {...stroke} d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
          <circle {...stroke} cx="12" cy="7" r="4" />
        </>
      );
      break;
    case 'settings':
      children = (
        <>
          <path
            {...stroke}
            d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"
          />
          <circle {...stroke} cx="12" cy="12" r="3" />
        </>
      );
      break;
    case 'edit':
      children = (
        <>
          <path {...stroke} d="M12 20h9" />
          <path {...stroke} d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </>
      );
      break;
    case 'logout':
      children = (
        <>
          <path {...stroke} d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline {...stroke} points="16 17 21 12 16 7" />
          <line {...stroke} x1="21" y1="12" x2="9" y2="12" />
        </>
      );
      break;
    case 'chevron':
      children = <path {...stroke} d="m9 18 6-6-6-6" />;
      break;
    default:
      children = null;
  }

  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

export default function CabinetHub({
  user,
  unreadMailCount = 0,
  onOpenProfileSettings,
  onOpenAccountSettings,
  onOpenMessages,
  onOpenSupport,
  onOpenSanctions,
  onOpenUserSearch,
  onOpenClans,
  onOpenStatistics,
  onLogout,
  onBack,
}: CabinetHubProps) {
  const handlers: Record<HubAction, (() => void) | undefined> = {
    clans: onOpenClans,
    messages: onOpenMessages,
    support: onOpenSupport,
    search: onOpenUserSearch,
    sanctions: onOpenSanctions,
    profile: onOpenProfileSettings,
    account: onOpenAccountSettings,
  };

  const displayName = user.displayName?.trim() || user.username;
  const chipLabel = user.email?.trim() ? user.email : `@${user.username}`;

  return (
    <div className="cabinet-hub-page">
      <nav className="info-back">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onBack}>
          ← Комнаты
        </button>
      </nav>

      <section className="cabinet-hub-profile">
        <div className="cabinet-hub-avatar-wrap">
          {user.avatar ? (
            <img src={avatarUrl(user.avatar) ?? undefined} alt="" className="cabinet-hub-avatar" />
          ) : (
            <div className="cabinet-hub-avatar placeholder" aria-hidden="true" />
          )}
          <button
            type="button"
            className="cabinet-hub-edit-btn"
            onClick={onOpenProfileSettings}
            aria-label="Редактировать анкету"
            title="Анкета"
          >
            <HubIcon id="edit" />
          </button>
        </div>

        <h1 className="cabinet-hub-name">{displayName}</h1>
        <span className="cabinet-hub-chip">{chipLabel}</span>

        {onOpenStatistics ? (
          <button type="button" className="cabinet-hub-mmr-link" onClick={onOpenStatistics}>
            MMR {user.mmr ?? user.totalScore}
          </button>
        ) : (
          <span className="muted cabinet-hub-mmr-static">MMR {user.mmr ?? user.totalScore}</span>
        )}
      </section>

      <div className="cabinet-hub-menu">
        {HUB_ITEMS.map((item) => {
          const handler = handlers[item.action];
          if (!handler) return null;
          return (
            <button
              key={item.action}
              type="button"
              className="cabinet-hub-menu-item"
              onClick={handler}
            >
              <span className="cabinet-hub-menu-icon" aria-hidden="true">
                <HubIcon id={item.icon} />
              </span>
              <span className="cabinet-hub-menu-label">
                {item.title}
                {item.action === 'messages' && unreadMailCount > 0 && (
                  <span className="cabinet-hub-badge">
                    {unreadMailCount > 99 ? '99+' : unreadMailCount}
                  </span>
                )}
              </span>
              <span className="cabinet-hub-menu-chevron" aria-hidden="true">
                <HubIcon id="chevron" />
              </span>
            </button>
          );
        })}

        <button
          type="button"
          className="cabinet-hub-menu-item cabinet-hub-menu-item--danger"
          onClick={onLogout}
        >
          <span className="cabinet-hub-menu-icon" aria-hidden="true">
            <HubIcon id="logout" />
          </span>
          <span className="cabinet-hub-menu-label">Выйти</span>
          <span className="cabinet-hub-menu-chevron" aria-hidden="true">
            <HubIcon id="chevron" />
          </span>
        </button>
      </div>
    </div>
  );
}
