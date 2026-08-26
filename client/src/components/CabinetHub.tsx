import { avatarUrl } from '../api';
import type { User } from '../types';

interface CabinetHubProps {
  user: User;
  unreadMailCount?: number;
  onOpenProfileSettings: () => void;
  onOpenAccountSettings: () => void;
  onOpenMessages: () => void;
  onOpenSupport: () => void;
  onOpenUserSearch: () => void;
  onOpenClans?: () => void;
  onOpenStatistics?: () => void;
  onLogout: () => void;
  onBack: () => void;
}

const HUB_ITEMS = [
  { title: 'Кланы', action: 'clans' as const },
  { title: 'Письма', action: 'messages' as const },
  { title: 'Поддержка', action: 'support' as const },
  { title: 'Поиск пользователей', action: 'search' as const },
  { title: 'Анкета', action: 'profile' as const },
  { title: 'Настройки', action: 'account' as const },
];

export default function CabinetHub({
  user,
  unreadMailCount = 0,
  onOpenProfileSettings,
  onOpenAccountSettings,
  onOpenMessages,
  onOpenSupport,
  onOpenUserSearch,
  onOpenClans,
  onOpenStatistics,
  onLogout,
  onBack,
}: CabinetHubProps) {
  const handlers = {
    clans: onOpenClans,
    messages: onOpenMessages,
    support: onOpenSupport,
    search: onOpenUserSearch,
    profile: onOpenProfileSettings,
    account: onOpenAccountSettings,
  };

  return (
    <div className="cabinet-hub-page">
      <nav className="info-back">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onBack}>
          ← Комнаты
        </button>
      </nav>

      <div className="cabinet-hub-user">
        {user.avatar ? (
          <img src={avatarUrl(user.avatar) ?? undefined} alt="" className="cabinet-hub-avatar" />
        ) : (
          <div className="cabinet-hub-avatar placeholder" aria-hidden="true" />
        )}
        <div>
          <strong>{user.username}</strong>
          {onOpenStatistics ? (
            <button type="button" className="cabinet-hub-mmr-link" onClick={onOpenStatistics}>
              MMR {user.mmr ?? user.totalScore}
            </button>
          ) : (
            <span className="muted">MMR {user.mmr ?? user.totalScore}</span>
          )}
        </div>
      </div>

      <div className="info-hub">
        {HUB_ITEMS.map((item) => {
          const handler = handlers[item.action];
          if (!handler) return null;
          return (
            <button
              key={item.action}
              type="button"
              className="info-hub-card"
              onClick={handler}
            >
              <span className="info-hub-body">
                <strong>
                  {item.title}
                  {item.action === 'messages' && unreadMailCount > 0 && (
                    <span className="cabinet-hub-badge">
                      {unreadMailCount > 99 ? '99+' : unreadMailCount}
                    </span>
                  )}
                </strong>
              </span>
              <span className="info-hub-arrow" aria-hidden="true">
                →
              </span>
            </button>
          );
        })}
      </div>

      <div className="cabinet-hub-logout">
        <button type="button" className="btn btn-ghost danger" onClick={onLogout}>
          Выйти
        </button>
      </div>
    </div>
  );
}
