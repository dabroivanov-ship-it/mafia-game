interface SiteFooterProps {
  text: string;
}

export default function SiteFooter({ text }: SiteFooterProps) {
  if (!text.trim()) return null;

  return (
    <footer className="site-footer">
      <p>{text}</p>
    </footer>
  );
}
