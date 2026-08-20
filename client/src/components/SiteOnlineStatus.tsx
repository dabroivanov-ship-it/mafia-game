interface SiteOnlineStatusProps {
  count: number;
  href?: string;
  onOpen?: () => void;
}

export default function SiteOnlineStatus({ count, href, onOpen }: SiteOnlineStatusProps) {
  const label = `${count} в сети, открыть список`;
  const number = href ? (
    <a href={href} className="lobby-online-link" aria-label={label}>
      {count}
    </a>
  ) : (
    <button type="button" className="lobby-online-link" onClick={onOpen} aria-label={label}>
      {count}
    </button>
  );

  return (
    <p className="lobby-online-count muted">
      На сайте: {number} в сети
    </p>
  );
}
