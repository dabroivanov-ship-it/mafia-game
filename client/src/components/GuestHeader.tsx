import type { SiteBranding } from '../types';
import { DEFAULT_SITE_BRANDING } from '../siteBranding';
import SiteLogo from './SiteLogo';

const GUEST_NAV = [
  { href: '/info/rules', label: 'Правила' },
  { href: '/info/rating', label: 'Лидеры' },
  { href: '/info/faq', label: 'FAQ' },
  { href: '/info/about', label: 'Об игре' },
  { href: '/blog', label: 'Блог' },
] as const;

interface GuestHeaderProps {
  branding?: SiteBranding;
}

export default function GuestHeader({ branding = DEFAULT_SITE_BRANDING }: GuestHeaderProps) {
  const path =
    typeof window === 'undefined' ? '/' : window.location.pathname.replace(/\/+$/, '') || '/';

  return (
    <div className="auth-page-bar">
      <a href="/" className="auth-brand" aria-label={branding.logoText || 'Mafia'}>
        <SiteLogo branding={branding} className="auth-brand-logo" />
      </a>
      <nav className="auth-top-links home-quick-links" aria-label="О сайте">
        {GUEST_NAV.map((item) => {
          const active = path === item.href || path.startsWith(`${item.href}/`);
          return (
            <a
              key={item.href}
              href={item.href}
              className={`home-quick-link${active ? ' is-active' : ''}`}
              aria-current={active ? 'page' : undefined}
            >
              {item.label}
            </a>
          );
        })}
      </nav>
    </div>
  );
}
