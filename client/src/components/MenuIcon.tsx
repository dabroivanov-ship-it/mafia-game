import type { ReactNode } from 'react';

export type MenuIconId = 'lobby' | 'news' | 'clans' | 'cabinet' | 'info' | 'admin' | 'logout';

const strokeProps = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

/** Контурные иконки бокового меню (стиль outline). */
export default function MenuIcon({ id }: { id: MenuIconId }) {
  switch (id) {
    case 'lobby':
      return (
        <Icon>
          <path {...strokeProps} d="M3 21h18" />
          <path {...strokeProps} d="M5 21V7l7-4 7 4v14" />
          <path {...strokeProps} d="M9 21v-6h6v6" />
        </Icon>
      );
    case 'news':
      return (
        <Icon>
          <path
            {...strokeProps}
            d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2V8"
          />
          <path {...strokeProps} d="M10 6h8" />
          <path {...strokeProps} d="M10 10h8" />
          <path {...strokeProps} d="M10 14h5" />
        </Icon>
      );
    case 'clans':
      return (
        <Icon>
          <path {...strokeProps} d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle {...strokeProps} cx="9" cy="7" r="4" />
          <path {...strokeProps} d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path {...strokeProps} d="M16 3.13a4 4 0 0 1 0 7.75" />
        </Icon>
      );
    case 'cabinet':
      return (
        <Icon>
          <path {...strokeProps} d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
          <circle {...strokeProps} cx="12" cy="7" r="4" />
        </Icon>
      );
    case 'info':
      return (
        <Icon>
          <circle {...strokeProps} cx="12" cy="12" r="10" />
          <path {...strokeProps} d="M12 16v-4" />
          <path {...strokeProps} d="M12 8h.01" />
        </Icon>
      );
    case 'admin':
      return (
        <Icon>
          <path
            {...strokeProps}
            d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"
          />
          <circle {...strokeProps} cx="12" cy="12" r="3" />
        </Icon>
      );
    case 'logout':
      return (
        <Icon>
          <path {...strokeProps} d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline {...strokeProps} points="16 17 21 12 16 7" />
          <line {...strokeProps} x1="21" y1="12" x2="9" y2="12" />
        </Icon>
      );
    default:
      return null;
  }
}
