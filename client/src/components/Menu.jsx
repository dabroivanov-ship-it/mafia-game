import { avatarUrl } from '../api.js';

const ITEMS = [
  { id: 'lobby', icon: '🏠', label: 'Комнаты' },
  { id: 'rules', icon: '📖', label: 'Правила' },
  { id: 'profile', icon: null, label: 'Профиль', avatar: true },
];

export default function Menu({ user, view, onNavigate, onLogout }) {
  return (
    <nav className="main-menu" aria-label="Главное меню">
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
                <img src={avatarUrl(user.avatar)} alt="" className="menu-avatar" />
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
