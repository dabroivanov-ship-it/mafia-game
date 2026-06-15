import { useEffect, useState } from 'react';
import { fetchNews } from '../api';
import type { NewsPost } from '../types';

interface NewsProps {
  onBack: () => void;
}

export default function News({ onBack }: NewsProps) {
  const [news, setNews] = useState<NewsPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setError('');
      try {
        const { news: list } = await fetchNews();
        setNews(list);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ошибка загрузки');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

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
                <h2>{item.title}</h2>
                <time className="muted" dateTime={item.createdAt}>
                  {new Date(item.createdAt).toLocaleString('ru-RU')}
                </time>
              </header>
              {item.authorName && <p className="news-author muted">Автор: {item.authorName}</p>}
              <div className="news-body">{item.body}</div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
