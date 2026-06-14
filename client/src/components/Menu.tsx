import { avatarUrl } from '../api';
import type { User } from '../types';

type MenuView = 'lobby' | 'rules' | 'profile' | 'admin' | 'room';

interface MenuItem {
  id: MenuView;
  icon: string | null;
  label: string;
  avatar?: boolean;
}

const ITEMS: MenuItem[] = [
  { id: 'lobby', icon: '🏠', label: 'Комнаты' },
  { id: 'rules', icon: '📖', label: 'Правила' },
  { id: 'profile', icon: null, label: 'Профиль', avatar: true },
];

interface MenuProps {
  user: User;
  view: MenuView;
  onNavigate: (view: MenuView) => void;
  onLogout: () => void;
}

export default function Menu({ user, view, onNavigate, onLogout }: MenuProps) {
  return (
    <nav className="main-menu" aria-label="Главное меню">
      <div className="menu-logo" aria-hidden="true">
        <span className="menu-logo-mark">♠</span>
        <span className="menu-logo-text">Mafia</span>
      </div>
      <div className="menu-items">
        {ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`menu-item ${view === item.id ? 'active' : ''}`}
            onClick={() => onNavigate(item.id)}
          >
            {item.avatar ? (
              user.avatar ? (
                <img src={avatarUrl(user.avatar) ?? undefined} alt="" className="menu-avatar" />
              ) : (
                <span className="menu-icon menu-avatar placeholder">👤</span>
              )
            ) : (
              <span className="menu-icon">{item.icon}</span>
            )}
            <span className="menu-label">{item.label}</span>
          </button>
        ))}
        {user.isAdmin && (
          <button
            type="button"
            className={`menu-item admin ${view === 'admin' ? 'active' : ''}`}
            onClick={() => onNavigate('admin')}
          >
            <span className="menu-icon">🛡️</span>
            <span className="menu-label">Админ</span>
          </button>
        )}
        <button type="button" className="menu-item logout" onClick={onLogout}>
          <span className="menu-icon">🚪</span>
          <span className="menu-label">Выйти</span>
        </button>
      </div>
    </nav>
  );
}
