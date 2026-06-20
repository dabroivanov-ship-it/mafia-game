import { avatarUrl } from '../api';
import type { SiteBranding } from '../types';

interface SiteLogoProps {
  branding: SiteBranding;
  className?: string;
}

export default function SiteLogo({ branding, className = '' }: SiteLogoProps) {
  const logoSrc = avatarUrl(branding.logoUrl);

  return (
    <div className={`site-logo ${className}`.trim()}>
      {logoSrc ? (
        <img src={logoSrc} alt="" className="site-logo-image" />
      ) : (
        <span className="site-logo-mark">{branding.logoMark || '♠'}</span>
      )}
      <span className="site-logo-text">{branding.logoText || 'Mafia'}</span>
    </div>
  );
}
