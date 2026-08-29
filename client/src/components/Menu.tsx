import type { User, SiteBranding } from '../types';
import SiteLogo from './SiteLogo';
import MenuIcon from './MenuIcon';
import { DEFAULT_SITE_BRANDING } from '../siteBranding';

export type MenuView = 'lobby' | 'news' | 'clans' | 'cabinet' | 'info' | 'admin';

interface MenuItem {
  id: Exclude<MenuView, 'admin'>;
  label: string;
  mobileLabel?: string;
  mobileBottom?: boolean;
  desktopOnly?: boolean;
  mobileOnly?: boolean;
}

const ITEMS: MenuItem[] = [
  { id: 'lobby', label: 'Комнаты', mobileBottom: true },
  { id: 'news', label: 'Новости', mobileBottom: true },
  { id: 'clans', label: 'Кланы', desktopOnly: true },
  { id: 'cabinet', label: 'Кабинет', mobileLabel: 'Кабинет', mobileBottom: true, mobileOnly: true },
  { id: 'info', label: 'Информация', mobileLabel: 'Инфо', mobileBottom: true },
];

interface MenuProps {
  user: User;
  branding?: SiteBranding;
  view: MenuView;
  onNavigate: (view: MenuView) => void;
  unreadNewsCount?: number;
}

export default function Menu({
  user,
  branding = DEFAULT_SITE_BRANDING,
  view,
  onNavigate,
  unreadNewsCount = 0,
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
            }${item.desktopOnly ? ' menu-item-desktop-only' : ''}${
              item.mobileOnly ? ' menu-item-mobile-only' : ''
            }`}
            onClick={() => onNavigate(item.id)}
          >
            <span className="menu-icon" aria-hidden="true">
              <MenuIcon id={item.id} />
            </span>
            <span className="menu-label menu-label-full">{item.label}</span>
            <span className="menu-label menu-label-short">{item.mobileLabel ?? item.label}</span>
            {item.id === 'news' && unreadNewsCount > 0 && (
              <span className="menu-badge">+{unreadNewsCount > 99 ? '99' : unreadNewsCount}</span>
            )}
          </button>
        ))}
        {user.canAccessAdminPanel && (
          <button
            type="button"
            className={`menu-item admin menu-item-mobile-nav ${view === 'admin' ? 'active' : ''}${
              user.isWatcher ? ' watcher' : user.isModerator && !user.isAdmin ? ' mod' : ''
            }`}
            onClick={() => onNavigate('admin')}
          >
            <span className="menu-icon" aria-hidden="true">
              <MenuIcon id="admin" />
            </span>
            <span className="menu-label">
              {user.isAdmin ? 'Админ' : user.isModerator ? 'Модер' : 'Смотр'}
            </span>
          </button>
        )}
      </div>
    </nav>
  );
}
