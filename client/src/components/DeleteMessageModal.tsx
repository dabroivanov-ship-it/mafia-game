export type ViolationType = 'profanity' | 'advertising' | 'other';

export const VIOLATION_TYPE_LABELS: Record<ViolationType, string> = {
  profanity: 'Мат',
  advertising: 'Реклама',
  other: 'Другое',
};

interface DeleteMessageModalProps {
  authorName: string;
  messageText: string;
  onConfirm: (violationType: ViolationType) => void;
  onCancel: () => void;
}

export default function DeleteMessageModal({
  authorName,
  messageText,
  onConfirm,
  onCancel,
}: DeleteMessageModalProps) {
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="delete-msg-title">
      <div className="modal-card delete-message-modal">
        <h3 id="delete-msg-title">Удалить сообщение?</h3>
        <p className="muted">
          <strong>{authorName}</strong>
        </p>
        <blockquote className="delete-message-preview">{messageText}</blockquote>
        <p className="delete-message-hint">Выберите тип нарушения — запись попадёт в лог админки.</p>
        <div className="delete-message-actions">
          {(Object.keys(VIOLATION_TYPE_LABELS) as ViolationType[]).map((type) => (
            <button
              key={type}
              type="button"
              className={`btn btn-sm ${type === 'profanity' ? 'danger' : 'btn-primary'}`}
              onClick={() => onConfirm(type)}
            >
              {VIOLATION_TYPE_LABELS[type]}
            </button>
          ))}
        </div>
        <button type="button" className="btn btn-ghost btn-block" onClick={onCancel}>
          Отмена
        </button>
      </div>
    </div>
  );
}
