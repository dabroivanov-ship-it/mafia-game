import { useState } from 'react';
import { voteNewsPoll } from '../api';
import type { NewsPoll } from '../types';

interface NewsPollBlockProps {
  newsId: number;
  poll: NewsPoll;
  onPollChange: (poll: NewsPoll) => void;
}

export default function NewsPollBlock({ newsId, poll, onPollChange }: NewsPollBlockProps) {
  const [voting, setVoting] = useState(false);
  const [error, setError] = useState('');

  const hasVoted = poll.userVoteOptionId != null;
  const showResults = hasVoted || poll.isClosed;

  const handleVote = async (optionId: number) => {
    if (poll.isClosed || hasVoted || voting) return;
    setVoting(true);
    setError('');
    try {
      const { poll: updated } = await voteNewsPoll(newsId, optionId);
      onPollChange(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось проголосовать');
    } finally {
      setVoting(false);
    }
  };

  return (
    <section className="news-poll">
      <h3 className="news-poll-question">📊 {poll.question}</h3>

      {poll.endsAt && (
        <p className="news-poll-meta muted">
          {poll.isClosed
            ? `Голосование завершено ${new Date(poll.endsAt).toLocaleString('ru-RU')}`
            : `До ${new Date(poll.endsAt).toLocaleString('ru-RU')}`}
        </p>
      )}

      {error && <div className="auth-error">{error}</div>}

      <div className="news-poll-options">
        {poll.options.map((option) => {
          const isSelected = poll.userVoteOptionId === option.id;

          if (showResults) {
            return (
              <div
                key={option.id}
                className={`news-poll-result${isSelected ? ' news-poll-result-selected' : ''}`}
              >
                <div className="news-poll-result-head">
                  <span>{option.label}</span>
                  <span className="muted">
                    {option.voteCount} · {option.percent}%
                  </span>
                </div>
                <div className="news-poll-bar" aria-hidden="true">
                  <div className="news-poll-bar-fill" style={{ width: `${option.percent}%` }} />
                </div>
              </div>
            );
          }

          return (
            <button
              key={option.id}
              type="button"
              className="news-poll-option-btn"
              disabled={voting}
              onClick={() => void handleVote(option.id)}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      <p className="news-poll-footer muted">
        {hasVoted && !poll.isClosed && 'Вы уже проголосовали. '}
        Всего голосов: {poll.totalVotes}
      </p>
    </section>
  );
}
