import { useEffect, useRef, type ReactNode } from 'react';
import type { SiteBranding } from '../types';
import { DEFAULT_SITE_BRANDING } from '../siteBranding';
import { attachPageWheelScroll } from '../utils/wheelScroll';
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
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    return attachPageWheelScroll(el);
  }, []);

  return (
    <div
      className={`guest-layout${centered ? ' guest-layout--centered auth-page' : ' app-public-info'}`}
      ref={bodyRef}
    >
      <GuestHeader branding={branding} />
      <div className="guest-layout-body">{children}</div>
      <SiteFooter variant="auth" text={branding.footerText} />
    </div>
  );
}
