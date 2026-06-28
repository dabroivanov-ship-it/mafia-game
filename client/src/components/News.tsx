import { useEffect, useState } from 'react';

import { fetchNews, markNewsRead, avatarUrl } from '../api';

import type { NewsPoll, NewsPost, User } from '../types';

import NewsBody from './NewsBody';
import NewsPollBlock from './NewsPollBlock';
import NewsComments from './NewsComments';

interface NewsProps {
  user: User;
  onBack: () => void;
  onRead?: () => void;
}

export default function News({ user, onBack, onRead }: NewsProps) {
  const [news, setNews] = useState<NewsPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setError('');
      try {
        const [{ news: list }] = await Promise.all([fetchNews(), markNewsRead()]);
        setNews(list);
        onRead?.();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ошибка загрузки');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handlePollChange = (newsId: number, poll: NewsPoll) => {
    setNews((prev) => prev.map((item) => (item.id === newsId ? { ...item, poll } : item)));
  };

  return (
    <div className="cabinet-page news-page">
      <nav className="info-back">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onBack}>
          ← Комнаты
        </button>
      </nav>

      <header className="page-header">
        <h1>📰 Новости</h1>
        <p className="muted">Объявления и обновления проекта</p>
      </header>

      {loading && <p className="muted">Загрузка...</p>}
      {error && <div className="auth-error">{error}</div>}

      {!loading && !error && (
        <div className="news-list">
          {news.length === 0 && <p className="muted">Новостей пока нет</p>}
          {news.map((item) => (
            <article key={item.id} className="news-card">
              <header className="news-card-header">
                <h2>
                  {item.isFeatured && <span className="news-featured-badge" title="Избранное">★</span>}
                  {item.title}
                </h2>
                <time className="muted" dateTime={item.createdAt}>
                  {new Date(item.createdAt).toLocaleString('ru-RU')}
                </time>
              </header>
              {item.authorName && <p className="news-author muted">Автор: {item.authorName}</p>}
              {item.coverImage && (
                <img
                  src={avatarUrl(item.coverImage) ?? undefined}
                  alt=""
                  className="news-cover-image"
                />
              )}
              <NewsBody body={item.body} />
              {item.poll && (
                <NewsPollBlock
                  newsId={item.id}
                  poll={item.poll}
                  onPollChange={(poll) => handlePollChange(item.id, poll)}
                />
              )}
              <NewsComments
                newsId={item.id}
                initialCount={item.commentCount ?? 0}
                currentUserId={user.id}
                isStaff={user.isStaff}
              />
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
