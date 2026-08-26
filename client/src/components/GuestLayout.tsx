import type { ReactNode } from 'react';
import type { SiteBranding } from '../types';
import { DEFAULT_SITE_BRANDING } from '../siteBranding';
import GuestHeader from './GuestHeader';
import SiteFooter from './SiteFooter';

interface GuestLayoutProps {
  branding?: SiteBranding;
  centered?: boolean;
  children: ReactNode;
}

function isRulesPath(): boolean {
  if (typeof window === 'undefined') return false;
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  return path === '/info/rules';
}

export default function GuestLayout({
  branding = DEFAULT_SITE_BRANDING,
  centered = false,
  children,
}: GuestLayoutProps) {
  const rulesBg = !centered && isRulesPath();

  return (
    <div
      className={`guest-layout${centered ? ' guest-layout--centered auth-page' : ' app-public-info'}${
        rulesBg ? ' guest-layout--rules-bg' : ''
      }`}
    >
      {centered && (
        <div className="auth-hero" aria-hidden="true">
          <picture>
            <source media="(max-width: 720px)" srcSet="/auth-hero-sm.jpg" />
            <img className="auth-hero-media" src="/auth-hero.jpg" alt="" decoding="async" />
          </picture>
        </div>
      )}
      {rulesBg && (
        <div className="rules-hero" aria-hidden="true">
          <picture>
            <source media="(max-width: 720px)" srcSet="/rules-hero-sm.jpg" />
            <img className="rules-hero-media" src="/rules-hero.jpg" alt="" decoding="async" />
          </picture>
        </div>
      )}
      <GuestHeader branding={branding} />
      <div className="guest-layout-body">{children}</div>
      <SiteFooter variant="auth" text={branding.footerText} />
    </div>
  );
}
