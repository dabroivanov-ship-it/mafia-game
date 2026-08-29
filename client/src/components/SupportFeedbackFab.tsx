interface SupportFeedbackFabProps {
  onClick: () => void;
}

export default function SupportFeedbackFab({ onClick }: SupportFeedbackFabProps) {
  return (
    <button
      type="button"
      className="support-feedback-fab"
      onClick={onClick}
      aria-label="Обратная связь"
      title="Обратная связь"
    >
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
        />
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M8 10h8M8 14h5"
        />
      </svg>
      <span className="support-feedback-fab-label">Обратная связь</span>
    </button>
  );
}
