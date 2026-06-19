import { useEffect, useState } from 'react';
import { avatarUrl, searchUsers } from '../api';
import type { User, UserSearchHit } from '../types';
import UserProfileModal from './UserProfileModal';

interface UserSearchProps {
  currentUser: User;
  onBack: () => void;
}

export default function UserSearch({ currentUser, onBack }: UserSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserSearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [profileUserId, setProfileUserId] = useState<number | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setError('');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const { users } = await searchUsers(q);
          setResults(users);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Ошибка поиска');
          setResults([]);
        } finally {
          setLoading(false);
        }
      })();
    }, 300);

    return () => window.clearTimeout(timer);
  }, [query]);

  return (
    <div className="user-search-page">
      <nav className="info-back">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onBack}>
          ← Кабинет
        </button>
      </nav>

      <header className="page-header">
        <h1>🔍 Поиск пользователей</h1>
        <p className="muted">По логину, имени в игре или городу — минимум 2 символа</p>
      </header>

      <div className="user-search-field">
        <input
          type="search"
          className="admin-search-input user-search-input"
          placeholder="Например: ivan или Москва"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
          maxLength={50}
          enterKeyHint="search"
        />
      </div>

      {loading && <p className="muted">Поиск...</p>}
      {error && <div className="auth-error">{error}</div>}

      {!loading && !error && query.trim().length >= 2 && results.length === 0 && (
        <p className="muted">Никого не найдено</p>
      )}

      {query.trim().length < 2 && !loading && (
        <p className="muted user-search-hint">Введите хотя бы 2 символа</p>
      )}

      <div className="user-search-results">
        {results.map((hit) => (
          <button
            key={hit.id}
            type="button"
            className="user-search-card"
            onClick={() => setProfileUserId(hit.id)}
          >
            {hit.avatar ? (
              <img src={avatarUrl(hit.avatar) ?? undefined} alt="" className="user-search-avatar" />
            ) : (
              <div className="user-search-avatar placeholder">👤</div>
            )}
            <div className="user-search-card-body">
              <strong>{hit.displayName}</strong>
              <span className="muted">@{hit.username}</span>
              {hit.city && <span className="muted">📍 {hit.city}</span>}
              <span className="muted">🏆 {hit.totalScore} очков</span>
            </div>
            <span className="info-hub-arrow" aria-hidden="true">
              →
            </span>
          </button>
        ))}
      </div>

      {profileUserId != null && (
        <UserProfileModal
          userId={profileUserId}
          currentUserId={currentUser.id}
          viewerIsAdmin={currentUser.isAdmin}
          viewerCanModerate={currentUser.isStaff}
          onClose={() => setProfileUserId(null)}
        />
      )}
    </div>
  );
}
