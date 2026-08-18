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

export default function GuestLayout({
  branding = DEFAULT_SITE_BRANDING,
  centered = false,
  children,
}: GuestLayoutProps) {
  return (
    <div
      className={`guest-layout${centered ? ' guest-layout--centered auth-page' : ' app-public-info'}`}
    >
      <GuestHeader branding={branding} />
      <div className="guest-layout-body">{children}</div>
      <SiteFooter variant="auth" text={branding.footerText} />
    </div>
  );
}
