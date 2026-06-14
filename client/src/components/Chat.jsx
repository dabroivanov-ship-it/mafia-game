import { useState, useRef, useEffect } from 'react';

export default function Chat({
  messages,
  canSend,
  onSend,
  onDeleteMessage,
  isAdmin,
  placeholder = 'Сообщение...',
}) {
  const [text, setText] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || !canSend) return;
    onSend(trimmed);
    setText('');
  };

  const formatTime = (iso) => {
    try {
      return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <div className="chat">
      <div className="chat-messages">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`chat-msg ${msg.system ? 'system' : ''} ${msg.deleted ? 'deleted' : ''} ${msg.sourceChannel === 'spectator' ? 'spectator-only' : ''}`}
          >
            <span className="chat-time">{formatTime(msg.time)}</span>
            {msg.sourceChannel === 'spectator' && (
              <span className="chat-spectator-tag" title="Только для наблюдателей">👁</span>
            )}
            <span className="chat-author">{msg.playerName}:</span>
            <span className="chat-text">{msg.text}</span>
            {isAdmin && !msg.system && !msg.deleted && onDeleteMessage && (
              <button
                type="button"
                className="chat-delete-btn"
                title="Удалить сообщение"
                onClick={() => onDeleteMessage(msg.id, msg.sourceChannel)}
              >
                ✕
              </button>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form className="chat-input" onSubmit={handleSubmit}>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={canSend ? placeholder : 'Чат недоступен'}
          disabled={!canSend}
          maxLength={300}
        />
        <button type="submit" className="btn btn-primary" disabled={!canSend || !text.trim()}>
          ➤
        </button>
      </form>
    </div>
  );
}
