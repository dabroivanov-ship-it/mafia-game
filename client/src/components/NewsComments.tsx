import { useEffect, useMemo, useState, FormEvent, useRef } from 'react';
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
  const [replyTo, setReplyTo] = useState<NewsComment | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const formRef = useRef<HTMLFormElement>(null);

  const childrenByParent = useMemo(() => {
    const map = new Map<number | null, NewsComment[]>();
    for (const comment of comments) {
      const key = comment.parentId ?? null;
      const list = map.get(key) ?? [];
      list.push(comment);
      map.set(key, list);
    }
    return map;
  }, [comments]);

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

  const startReply = (comment: NewsComment) => {
    setReplyTo(comment);
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  const cancelReply = () => {
    setReplyTo(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setSubmitting(true);
    setError('');
    try {
      const { comment } = await postNewsComment(newsId, body, replyTo?.id ?? null);
      setComments((prev) => [...prev, comment]);
      setText('');
      setReplyTo(null);
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
      setComments((prev) => {
        const toRemove = new Set<number>();
        const queue = [commentId];
        while (queue.length > 0) {
          const id = queue.shift()!;
          toRemove.add(id);
          for (const c of prev) {
            if (c.parentId === id) queue.push(c.id);
          }
        }
        return prev.filter((c) => !toRemove.has(c.id));
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка удаления');
    }
  };

  const renderComment = (comment: NewsComment) => {
    const canDelete = comment.userId === currentUserId || isStaff;
    const replies = childrenByParent.get(comment.id) ?? [];

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
              @{comment.authorUsername} · {new Date(comment.createdAt).toLocaleString('ru-RU')}
            </span>
            {comment.replyToAuthorUsername && (
              <span className="news-comment-reply-to muted">
                ↳ в ответ <strong>@{comment.replyToAuthorUsername}</strong>
              </span>
            )}
          </div>
          <div className="news-comment-actions">
            <button
              type="button"
              className="btn btn-ghost btn-sm news-comment-reply-btn"
              onClick={() => startReply(comment)}
            >
              Ответить
            </button>
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
        </div>
        <p className="news-comment-body">{comment.body}</p>
        {replies.length > 0 && (
          <ul className="news-comments-list news-comments-replies">
            {replies.map((reply) => renderComment(reply))}
          </ul>
        )}
      </li>
    );
  };

  const count = loaded ? comments.length : initialCount;
  const rootComments = childrenByParent.get(null) ?? [];

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

          <ul className="news-comments-list">{rootComments.map((comment) => renderComment(comment))}</ul>

          <form ref={formRef} className="news-comment-form" onSubmit={handleSubmit}>
            {replyTo && (
              <div className="news-comment-reply-banner">
                <span className="muted">
                  Ответ для <strong>@{replyTo.authorUsername}</strong>
                </span>
                <button type="button" className="btn btn-ghost btn-sm" onClick={cancelReply}>
                  Отмена
                </button>
              </div>
            )}
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={
                replyTo ? `Ответ @${replyTo.authorUsername}...` : 'Написать комментарий...'
              }
              maxLength={2000}
              rows={3}
              disabled={submitting}
            />
            <button type="submit" className="btn btn-primary btn-sm" disabled={submitting || !text.trim()}>
              {submitting ? 'Отправка...' : replyTo ? 'Ответить' : 'Отправить'}
            </button>
          </form>
        </div>
      )}
    </section>
  );
}
