import { useId } from 'react';
import { avatarUrl } from '../api';
import type { SiteBranding } from '../types';

interface SiteLogoProps {
  branding: SiteBranding;
  className?: string;
  /** Компактный штамп как «КОД ГОРОДА» (гость/авторизация). */
  variant?: 'inline' | 'stamp';
}

function stampLines(logoText: string): string[] {
  const normalized = logoText.replace(/\s+/g, ' ').trim();
  if (!normalized) return ['МАФИЯ'];
  const parts = normalized.split(' ');
  if (parts.length >= 2) {
    return [parts[0]!, parts.slice(1).join(' ')].map((p) => p.toUpperCase());
  }
  return [normalized.toUpperCase()];
}

export default function SiteLogo({
  branding,
  className = '',
  variant = 'inline',
}: SiteLogoProps) {
  const filterId = useId().replace(/:/g, '');
  const logoSrc = avatarUrl(branding.logoUrl);
  const text = branding.logoText || 'Реальная мафия';

  if (variant === 'stamp') {
    const lines = stampLines(text);
    const filterUrl = `url(#${filterId})`;
    return (
      <div className={`site-logo site-logo--stamp ${className}`.trim()}>
        <svg className="site-logo-stamp-defs" width="0" height="0" aria-hidden="true" focusable="false">
          <defs>
            <filter id={filterId} x="-8%" y="-8%" width="116%" height="116%">
              <feTurbulence type="fractalNoise" baseFrequency="1.15" numOctaves="3" result="noise" seed="7" />
              <feDisplacementMap in="SourceGraphic" in2="noise" scale="2.6" xChannelSelector="R" yChannelSelector="G" />
            </filter>
          </defs>
        </svg>
        <div className="site-logo-stamp-stack" style={{ filter: filterUrl }}>
          {lines.map((line, i) => (
            <span
              key={`${i}-${line}`}
              className={`site-logo-stamp-line${i === 0 && lines.length > 1 ? ' site-logo-stamp-line--lead' : ''}`}
            >
              {line}
            </span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`site-logo ${className}`.trim()}>
      {logoSrc ? (
        <img src={logoSrc} alt="" className="site-logo-image" />
      ) : (
        <span className="site-logo-mark">{branding.logoMark || '♠'}</span>
      )}
      <span className="site-logo-text">{text}</span>
    </div>
  );
}
