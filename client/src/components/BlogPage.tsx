import { useEffect, useState } from 'react';
import { avatarUrl, fetchBlog } from '../api';
import type { BlogPost } from '../types';
import { BLOG_PATH, blogPostIdFromPath, blogPostPath } from '../blogRouting';
import { updatePageMeta } from '../seo';
import NewsBody from './NewsBody';

interface BlogPageProps {
  initialPostId?: number | null;
  onBack?: () => void;
  backLabel?: string;
}

export default function BlogPage({
  initialPostId = null,
  onBack,
  backLabel = '← Вход',
}: BlogPageProps) {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(
    initialPostId ?? blogPostIdFromPath(window.location.pathname)
  );

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

  useEffect(() => {
    const selected = selectedId != null ? posts.find((p) => p.id === selectedId) : null;
    if (selected) {
      updatePageMeta({
        title: selected.title,
        description: 'Статья блога онлайн-игры «Мафия».',
        path: blogPostPath(selected.id),
        type: 'article',
      });
      return;
    }
    updatePageMeta({
      title: 'Блог',
      description: 'Обновления и заметки онлайн-игры «Мафия».',
      path: BLOG_PATH,
    });
  }, [selectedId, posts]);

  const openPost = (id: number | null) => {
    setSelectedId(id);
    const next = id == null ? BLOG_PATH : blogPostPath(id);
    window.history.pushState(null, '', next);
  };

  const selected = selectedId != null ? posts.find((p) => p.id === selectedId) : null;

  return (
    <div className="cabinet-page blog-page">
      <nav className="info-back">
        {selected ? (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => openPost(null)}>
            ← К списку
          </button>
        ) : onBack ? (
          <button type="button" className="btn btn-ghost btn-sm" onClick={onBack}>
            {backLabel}
          </button>
        ) : (
          <a href="/" className="btn btn-ghost btn-sm">
            {backLabel}
          </a>
        )}
      </nav>

      <header className="page-header">
        <h1>Блог</h1>
        <p className="muted">Обновления игры и заметки с сайта</p>
      </header>

      {loading && <p className="muted">Загрузка…</p>}
      {error && <div className="auth-error">{error}</div>}

      {!loading && !error && posts.length === 0 && (
        <p className="muted">Пока нет опубликованных статей.</p>
      )}

      {!loading && !error && selected && (
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
      )}

      {!loading && !error && !selected && posts.length > 0 && (
        <ul className="lobby-blog-list">
          {posts.map((post) => (
            <li key={post.id}>
              <button
                type="button"
                className="lobby-blog-item"
                onClick={() => openPost(post.id)}
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
      )}
    </div>
  );
}
