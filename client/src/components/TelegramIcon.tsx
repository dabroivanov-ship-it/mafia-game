interface TelegramIconProps {
  className?: string;
}

export default function TelegramIcon({ className }: TelegramIconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={className}>
      <path
        fill="currentColor"
        d="M9.78 15.28 9.5 19.3c.43 0 .62-.19.85-.41l2.04-1.96 4.23 3.1c.78.43 1.33.21 1.54-.74l2.78-13.05h.01c.25-1.16-.42-1.61-1.18-1.33L2.1 9.74c-1.14.44-1.12 1.08-.19 1.37l4.98 1.55L18.9 6.1c.56-.37 1.08-.17.66.23"
      />
    </svg>
  );
}
