import type { User, SiteBranding } from '../types';
import SiteLogo from './SiteLogo';
import { DEFAULT_SITE_BRANDING } from '../siteBranding';

export type MenuView = 'lobby' | 'news' | 'cabinet' | 'info' | 'admin';

interface MenuItem {
  id: MenuView;
  icon: string;
  label: string;
  mobileBottom?: boolean;
  desktopOnly?: boolean;
}

const ITEMS: MenuItem[] = [
  { id: 'lobby', icon: '🏠', label: 'Комнаты', mobileBottom: true },
  { id: 'news', icon: '📰', label: 'Новости', mobileBottom: true },
  { id: 'cabinet', icon: '👤', label: 'Кабинет', mobileBottom: true },
  { id: 'info', icon: 'ℹ️', label: 'Инфо', mobileBottom: true },
];

interface MenuProps {
  user: User;
  branding?: SiteBranding;
  view: MenuView;
  onNavigate: (view: MenuView) => void;
  onLogout: () => void;
  unreadMailCount?: number;
}

export default function Menu({
  user,
  branding = DEFAULT_SITE_BRANDING,
  view,
  onNavigate,
  onLogout,
  unreadMailCount = 0,
}: MenuProps) {
  return (
    <nav className="main-menu" aria-label="Главное меню">
      <SiteLogo branding={branding} className="menu-logo" />
      <div className="menu-items">
        {ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`menu-item ${view === item.id ? 'active' : ''}${
              item.mobileBottom ? ' menu-item-mobile-nav' : ''
            }${item.desktopOnly ? ' menu-item-desktop-only' : ''}`}
            onClick={() => onNavigate(item.id)}
          >
            <span className="menu-icon">{item.icon}</span>
            <span className="menu-label">{item.label}</span>
            {item.id === 'cabinet' && unreadMailCount > 0 && (
              <span className="menu-badge">{unreadMailCount > 99 ? '99+' : unreadMailCount}</span>
            )}
          </button>
        ))}
        {user.isAdmin && (
          <button
            type="button"
            className={`menu-item admin menu-item-mobile-nav ${view === 'admin' ? 'active' : ''}`}
            onClick={() => onNavigate('admin')}
          >
            <span className="menu-icon">⚙️</span>
            <span className="menu-label">Админ</span>
          </button>
        )}
        <button type="button" className="menu-item logout menu-item-desktop-only" onClick={onLogout}>
          <span className="menu-icon">🚪</span>
          <span className="menu-label">Выйти</span>
        </button>
      </div>
    </nav>
  );
}
