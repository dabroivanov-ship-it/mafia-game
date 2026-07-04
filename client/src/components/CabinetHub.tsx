import { avatarUrl } from '../api';
import type { User } from '../types';

interface CabinetHubProps {
  user: User;
  unreadMailCount?: number;
  onOpenProfileSettings: () => void;
  onOpenSiteSettings: () => void;
  onOpenMessages: () => void;
  onOpenSupport: () => void;
  onOpenUserSearch: () => void;
  onOpenInfo?: () => void;
  onOpenStatistics?: () => void;
  onLogout: () => void;
  onBack: () => void;
}

const HUB_ITEMS = [
  { icon: '✉️', title: 'Письма', desc: 'История переписки и новые сообщения', action: 'messages' as const },
  { icon: '🆘', title: 'Поддержка', desc: 'Сообщить о проблеме администратору', action: 'support' as const },
  { icon: '🔍', title: 'Поиск пользователей', desc: 'Найти игрока по логину, имени или городу', action: 'search' as const },
  { icon: '👤', title: 'Личные настройки', desc: 'Имя, город, аватар, лимит чата', action: 'profile' as const },
  { icon: '🎨', title: 'Оформление сайта', desc: 'Цветовая тема интерфейса', action: 'theme' as const },
  { icon: 'ℹ️', title: 'Информация', desc: 'Правила, роли, рейтинг и FAQ', action: 'info' as const },
];

export default function CabinetHub({
  user,
  unreadMailCount = 0,
  onOpenProfileSettings,
  onOpenSiteSettings,
  onOpenMessages,
  onOpenSupport,
  onOpenUserSearch,
  onOpenInfo,
  onOpenStatistics,
  onLogout,
  onBack,
}: CabinetHubProps) {
  const handlers = {
    messages: onOpenMessages,
    support: onOpenSupport,
    search: onOpenUserSearch,
    profile: onOpenProfileSettings,
    theme: onOpenSiteSettings,
    info: () => onOpenInfo?.(),
  };

  const hubItems = HUB_ITEMS.filter((item) => item.action !== 'info' || onOpenInfo);

  return (
    <div className="cabinet-hub-page">
      <nav className="info-back">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onBack}>
          ← Комнаты
        </button>
      </nav>

      <header className="page-header">
        <h1>👤 Кабинет</h1>
      </header>

      <div className="cabinet-hub-user">
        {user.avatar ? (
          <img src={avatarUrl(user.avatar) ?? undefined} alt="" className="cabinet-hub-avatar" />
        ) : (
          <div className="cabinet-hub-avatar placeholder" aria-hidden="true">
            👤
          </div>
        )}
        <div>
          <strong>{user.username}</strong>
          {onOpenStatistics ? (
            <button type="button" className="cabinet-hub-mmr-link" onClick={onOpenStatistics}>
              🏆 MMR {user.mmr ?? user.totalScore}
            </button>
          ) : (
            <span className="muted">🏆 MMR {user.mmr ?? user.totalScore}</span>
          )}
        </div>
      </div>

      <div className="info-hub">
        {hubItems.map((item) => (
          <button
            key={item.action}
            type="button"
            className={`info-hub-card${item.action === 'info' ? ' cabinet-hub-item-mobile-only' : ''}`}
            onClick={handlers[item.action]}
          >
            <span className="info-hub-icon" aria-hidden="true">
              {item.icon}
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
          🚪 Выйти
        </button>
      </div>
    </div>
  );
}
