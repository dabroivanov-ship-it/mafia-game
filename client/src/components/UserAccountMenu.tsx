import { useEffect, useRef, useState } from 'react';
import { avatarUrl } from '../api';
import type { User } from '../types';

interface UserAccountMenuProps {
  user: User;
  onOpenProfile: () => void;
  onOpenFriends: () => void;
  onOpenStatistics: () => void;
  onOpenSettings: () => void;
}

export default function UserAccountMenu({
  user,
  onOpenProfile,
  onOpenFriends,
  onOpenStatistics,
  onOpenSettings,
}: UserAccountMenuProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const label = user.displayName?.trim() || user.username;

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const run = (action: () => void) => {
    setOpen(false);
    action();
  };

  return (
    <div className="user-account-menu" ref={wrapRef}>
      <button
        type="button"
        className={`user-account-menu-btn${open ? ' open' : ''}`}
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Меню: ${label}`}
      >
        {user.avatar ? (
          <img
            src={avatarUrl(user.avatar) ?? undefined}
            alt=""
            className="user-account-menu-avatar"
          />
        ) : (
          <span className="user-account-menu-avatar placeholder" aria-hidden="true" />
        )}
        <span className="user-account-menu-label">{label}</span>
        <span className="user-account-menu-chevron" aria-hidden="true">
          ▾
        </span>
      </button>

      {open && (
        <div className="user-account-menu-dropdown" role="menu">
          <button
            type="button"
            className="user-account-menu-item"
            role="menuitem"
            onClick={() => run(onOpenProfile)}
          >
            Профиль
          </button>
          <button
            type="button"
            className="user-account-menu-item"
            role="menuitem"
            onClick={() => run(onOpenFriends)}
          >
            Друзья
          </button>
          <button
            type="button"
            className="user-account-menu-item"
            role="menuitem"
            onClick={() => run(onOpenStatistics)}
          >
            Статистика
          </button>
          <button
            type="button"
            className="user-account-menu-item"
            role="menuitem"
            onClick={() => run(onOpenSettings)}
          >
            Настройки
          </button>
        </div>
      )}
    </div>
  );
}
