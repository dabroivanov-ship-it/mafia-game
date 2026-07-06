import TelegramIcon from './TelegramIcon';

interface SiteFooterProps {
  text?: string;
  variant?: 'auth' | 'minimal';
}

const TELEGRAM_BOT = 'realmaf_bot';
const TELEGRAM_URL = `https://t.me/${TELEGRAM_BOT}`;

export default function SiteFooter({ text = '', variant = 'minimal' }: SiteFooterProps) {
  const hasExtra = text.trim().length > 0;
  const showSocial = variant === 'auth';

  if (!showSocial && !hasExtra) return null;

  return (
    <footer className={`site-footer site-footer--${variant}`}>
      {showSocial && (
        <section className="site-footer-social" aria-label="Наши соцсети">
          <h2 className="site-footer-title">Наши соцсети</h2>
          <p className="site-footer-lead">
            Подписывайтесь на нас в соцсетях, чтобы быть в курсе обновлений игры.
          </p>
          <a
            className="site-footer-telegram-icon"
            href={TELEGRAM_URL}
            target="_blank"
            rel="noreferrer"
            aria-label="Telegram"
            title="Telegram"
          >
            <TelegramIcon />
          </a>
        </section>
      )}
      {hasExtra && <p className="site-footer-extra">{text}</p>}
    </footer>
  );
}
