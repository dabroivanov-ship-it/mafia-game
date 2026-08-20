import { useEffect, useState } from 'react';
import { avatarUrl, fetchBlog } from '../api';
import type { BlogPost } from '../types';
import NewsBody from './NewsBody';

interface LobbyBlogProps {
  selectedId?: number | null;
  onSelect: (id: number | null) => void;
}

export default function LobbyBlog({ selectedId = null, onSelect }: LobbyBlogProps) {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError('');
      try {
        const { posts: list } = await fetchBlog();
        if (!cancelled) setPosts(list);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Ошибка загрузки');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = selectedId != null ? posts.find((p) => p.id === selectedId) : null;

  if (loading) {
    return (
      <section className="lobby-rooms-section lobby-blog-section">
        <h2 className="lobby-section-title">Блог</h2>
        <p className="muted">Загрузка…</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="lobby-rooms-section lobby-blog-section">
        <h2 className="lobby-section-title">Блог</h2>
        <p className="auth-error">{error}</p>
      </section>
    );
  }

  if (posts.length === 0) {
    return null;
  }

  if (selected) {
    return (
      <section className="lobby-rooms-section lobby-blog-section">
        <nav className="info-back">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onSelect(null)}>
            ← К списку
          </button>
        </nav>
        <article className="blog-article">
          <header className="blog-article-header">
            <h2>{selected.title}</h2>
            <time className="muted" dateTime={selected.createdAt}>
              {new Date(selected.createdAt).toLocaleString('ru-RU')}
            </time>
          </header>
          {selected.authorName && (
            <p className="news-author muted">Автор: {selected.authorName}</p>
          )}
          {selected.coverImage && (
            <img
              src={avatarUrl(selected.coverImage) ?? undefined}
              alt=""
              className="news-cover-image"
            />
          )}
          <NewsBody body={selected.body} />
        </article>
      </section>
    );
  }

  return (
    <section className="lobby-rooms-section lobby-blog-section">
      <h2 className="lobby-section-title">Блог</h2>
      <ul className="lobby-blog-list">
        {posts.map((post) => (
          <li key={post.id}>
            <button
              type="button"
              className="lobby-blog-item"
              onClick={() => onSelect(post.id)}
            >
              {post.coverImage && (
                <img
                  src={avatarUrl(post.coverImage) ?? undefined}
                  alt=""
                  className="lobby-blog-thumb"
                />
              )}
              <span className="lobby-blog-item-body">
                <span className="lobby-blog-item-title">{post.title}</span>
                <time className="muted" dateTime={post.createdAt}>
                  {new Date(post.createdAt).toLocaleDateString('ru-RU')}
                </time>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
