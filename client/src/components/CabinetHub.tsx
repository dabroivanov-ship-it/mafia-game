import { avatarUrl } from '../api';
import type { User } from '../types';

interface CabinetHubProps {
  user: User;
  unreadMailCount?: number;
  onOpenSettings: () => void;
  onOpenMessages: () => void;
  onBack: () => void;
}

export default function CabinetHub({
  user,
  unreadMailCount = 0,
  onOpenSettings,
  onOpenMessages,
  onBack,
}: CabinetHubProps) {
  return (
    <div className="cabinet-hub-page">
      <nav className="info-back">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onBack}>
          ← Комнаты
        </button>
      </nav>

      <header className="page-header">
        <h1>👤 Кабинет</h1>
        <p className="muted">@{user.username}</p>
      </header>

      <div className="cabinet-hub-user">
        {user.avatar ? (
          <img src={avatarUrl(user.avatar) ?? undefined} alt="" className="cabinet-hub-avatar" />
        ) : (
          <div className="cabinet-hub-avatar placeholder">👤</div>
        )}
        <div>
          <strong>{user.displayName}</strong>
          <span className="muted">🏆 {user.totalScore} очков</span>
        </div>
      </div>

      <div className="info-hub">
        <button type="button" className="info-hub-card" onClick={onOpenMessages}>
          <span className="info-hub-icon" aria-hidden="true">
            ✉️
          </span>
          <span className="info-hub-body">
            <strong>
              Письма
              {unreadMailCount > 0 && (
                <span className="cabinet-hub-badge">{unreadMailCount > 99 ? '99+' : unreadMailCount}</span>
              )}
            </strong>
            <span className="muted">История переписки и новые сообщения</span>
          </span>
          <span className="info-hub-arrow" aria-hidden="true">
            →
          </span>
        </button>

        <button type="button" className="info-hub-card" onClick={onOpenSettings}>
          <span className="info-hub-icon" aria-hidden="true">
            ⚙️
          </span>
          <span className="info-hub-body">
            <strong>Настройки профиля</strong>
            <span className="muted">Имя, город, аватар, лимит чата</span>
          </span>
          <span className="info-hub-arrow" aria-hidden="true">
            →
          </span>
        </button>
      </div>
    </div>
  );
}
