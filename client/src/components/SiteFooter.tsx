interface SiteFooterProps {
  text?: string;
}

const TELEGRAM_BOT = 'realmaf_bot';

export default function SiteFooter({ text = '' }: SiteFooterProps) {
  return (
    <footer className="site-footer">
      <section className="site-footer-social" aria-label="Соцсети">
        <h2 className="site-footer-title">Соцсети</h2>
        <p className="site-footer-lead">
          Подписывайтесь на нас в соцсетях, чтобы быть в курсе обновлений игры.
        </p>
        <a className="site-footer-link" href={`https://t.me/${TELEGRAM_BOT}`} target="_blank" rel="noreferrer">
          Telegram @{TELEGRAM_BOT}
        </a>
      </section>
      {text.trim() && <p className="site-footer-extra">{text}</p>}
    </footer>
  );
}
