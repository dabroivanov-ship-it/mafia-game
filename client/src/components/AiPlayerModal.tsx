interface AiPlayerModalProps {
  playerName: string;
  roleLabel?: string | null;
  alive?: boolean;
  inGame?: boolean;
  onClose: () => void;
  onWriteMessage?: () => void;
  canWrite?: boolean;
}

export default function AiPlayerModal({
  playerName,
  roleLabel,
  alive = true,
  inGame = true,
  onClose,
  onWriteMessage,
  canWrite = false,
}: AiPlayerModalProps) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card ai-player-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Закрыть">
          ✕
        </button>
        <h3>{playerName}</h3>
        <p className="ai-player-badge">AI игрок</p>
        <ul className="ai-player-meta">
          <li>{inGame ? (alive ? 'В игре · жив' : 'В игре · выбыл') : 'Не в игре'}</li>
          {roleLabel && <li>Роль: {roleLabel}</li>}
        </ul>
        {canWrite && onWriteMessage && (
          <button type="button" className="btn btn-primary" onClick={onWriteMessage}>
            Написать в чат
          </button>
        )}
      </div>
    </div>
  );
}
