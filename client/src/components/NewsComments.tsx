import { useEffect, useState, FormEvent } from 'react';
import {
  avatarUrl,
  fetchNewsComments,
  postNewsComment,
  deleteNewsComment,
} from '../api';
import type { NewsComment } from '../types';

interface NewsCommentsProps {
  newsId: number;
  initialCount?: number;
  currentUserId: number;
  isStaff?: boolean;
}

export default function NewsComments({
  newsId,
  initialCount = 0,
  currentUserId,
  isStaff = false,
}: NewsCommentsProps) {
  const [comments, setComments] = useState<NewsComment[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(initialCount > 0);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || loaded) return;
    setLoading(true);
    setError('');
    void fetchNewsComments(newsId)
      .then(({ comments: list }) => {
        setComments(list);
        setLoaded(true);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Ошибка загрузки комментариев');
      })
      .finally(() => setLoading(false));
  }, [open, loaded, newsId]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setSubmitting(true);
    setError('');
    try {
      const { comment } = await postNewsComment(newsId, body);
      setComments((prev) => [...prev, comment]);
      setText('');
      setLoaded(true);
      setOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось отправить');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (commentId: number) => {
    if (!confirm('Удалить комментарий?')) return;
    try {
      await deleteNewsComment(commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка удаления');
    }
  };

  const count = loaded ? comments.length : initialCount;

  return (
    <section className="news-comments">
      <button
        type="button"
        className="news-comments-toggle"
        onClick={() => setOpen((v) => !v)}
      >
        💬 Комментарии {count > 0 ? `(${count})` : ''}
        <span className="news-comments-toggle-arrow">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="news-comments-panel">
          {loading && <p className="muted">Загрузка...</p>}
          {error && <div className="auth-error">{error}</div>}

          {!loading && comments.length === 0 && (
            <p className="muted news-comments-empty">Комментариев пока нет — будьте первым</p>
          )}

          <ul className="news-comments-list">
            {comments.map((comment) => {
              const canDelete = comment.userId === currentUserId || isStaff;
              return (
                <li key={comment.id} className="news-comment">
                  <div className="news-comment-head">
                    {comment.authorAvatar ? (
                      <img
                        src={avatarUrl(comment.authorAvatar) ?? undefined}
                        alt=""
                        className="news-comment-avatar"
                      />
                    ) : (
                      <span className="news-comment-avatar placeholder">👤</span>
                    )}
                    <div className="news-comment-meta">
                      <strong>{comment.authorName}</strong>
                      <span className="muted">
                        @{comment.authorUsername} ·{' '}
                        {new Date(comment.createdAt).toLocaleString('ru-RU')}
                      </span>
                    </div>
                    {canDelete && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm news-comment-delete"
                        onClick={() => void handleDelete(comment.id)}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  <p className="news-comment-body">{comment.body}</p>
                </li>
              );
            })}
          </ul>

          <form className="news-comment-form" onSubmit={handleSubmit}>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Написать комментарий..."
              maxLength={2000}
              rows={3}
              disabled={submitting}
            />
            <button type="submit" className="btn btn-primary btn-sm" disabled={submitting || !text.trim()}>
              {submitting ? 'Отправка...' : 'Отправить'}
            </button>
          </form>
        </div>
      )}
    </section>
  );
}
