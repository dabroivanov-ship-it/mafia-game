import { avatarUrl } from '../api.js';

export default function Menu({ user, view, onNavigate, onLogout }) {
  return (
    <nav className="main-menu">
      <button
        type="button"
        className={`menu-item ${view === 'lobby' ? 'active' : ''}`}
        onClick={() => onNavigate('lobby')}
      >
        🏠 Комнаты
      </button>
      <button
        type="button"
        className={`menu-item ${view === 'profile' ? 'active' : ''}`}
        onClick={() => onNavigate('profile')}
      >
        {user.avatar ? (
          <img src={avatarUrl(user.avatar)} alt="" className="menu-avatar" />
        ) : (
          <span className="menu-avatar placeholder">👤</span>
        )}
        Профиль
      </button>
      {user.isAdmin && (
        <button
          type="button"
          className={`menu-item admin ${view === 'admin' ? 'active' : ''}`}
          onClick={() => onNavigate('admin')}
        >
          🛡️ Админ
        </button>
      )}
      <button type="button" className="menu-item logout" onClick={onLogout}>
        Выйти
      </button>
    </nav>
  );
}
