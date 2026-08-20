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
  onOpenStatistics?: () => void;
  onLogout: () => void;
  onBack: () => void;
}

const HUB_ITEMS = [
  { title: 'Письма', desc: 'История переписки и новые сообщения', action: 'messages' as const },
  { title: 'Поддержка', desc: 'Сообщить о проблеме администратору', action: 'support' as const },
  { title: 'Поиск пользователей', desc: 'Найти игрока по логину, имени или городу', action: 'search' as const },
  { title: 'Анкета', desc: 'Имя, город, аватар, о себе', action: 'profile' as const },
  { title: 'Настройки', desc: 'Тема, пароль и лимит чата', action: 'account' as const },
];

export default function CabinetHub({
  user,
  unreadMailCount = 0,
  onOpenProfileSettings,
  onOpenAccountSettings,
  onOpenMessages,
  onOpenSupport,
  onOpenUserSearch,
  onOpenStatistics,
  onLogout,
  onBack,
}: CabinetHubProps) {
  const handlers = {
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

      <header className="page-header">
        <h1>Кабинет</h1>
      </header>

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
        {HUB_ITEMS.map((item, index) => (
          <button
            key={item.action}
            type="button"
            className="info-hub-card"
            onClick={handlers[item.action]}
          >
            <span className="info-hub-index" aria-hidden="true">
              {String(index + 1).padStart(2, '0')}
            </span>
            <span className="info-hub-body">
              <strong>
                {item.title}
                {item.action === 'messages' && unreadMailCount > 0 && (
                  <span className="cabinet-hub-badge">{unreadMailCount > 99 ? '99+' : unreadMailCount}</span>
                )}
              </strong>
              <span className="muted">{item.desc}</span>
            </span>
            <span className="info-hub-arrow" aria-hidden="true">
              →
            </span>
          </button>
        ))}
      </div>

      <div className="cabinet-hub-logout">
        <button type="button" className="btn btn-ghost danger" onClick={onLogout}>
          Выйти
        </button>
      </div>
    </div>
  );
}
