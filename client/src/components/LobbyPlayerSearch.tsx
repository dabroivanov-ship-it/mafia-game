import { useEffect, useRef, useState } from 'react';
import { avatarUrl, searchUsers } from '../api';
import type { User, UserSearchHit } from '../types';
import { formatPresenceLabel } from '../utils/presence';
import UserProfileModal from './UserProfileModal';

interface LobbyPlayerSearchProps {
  currentUser: User;
  onWriteMessage: (userId: number, username: string) => void;
  onOpenStatistics?: (userId: number) => void;
  onOpenClan?: (clanId: number) => void;
}

export default function LobbyPlayerSearch({
  currentUser,
  onWriteMessage,
  onOpenStatistics,
  onOpenClan,
}: LobbyPlayerSearchProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserSearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [profileUserId, setProfileUserId] = useState<number | null>(null);

  const trimmed = query.trim();

  useEffect(() => {
    if (trimmed.length < 2) {
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
          const { users } = await searchUsers(trimmed);
          setResults(users);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Ошибка поиска');
          setResults([]);
        } finally {
          setLoading(false);
        }
      })();
    }, 280);

    return () => window.clearTimeout(timer);
  }, [trimmed]);

  useEffect(() => {
    const onDocClick = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, []);

  const showPanel = open && trimmed.length > 0;

  return (
    <div className="lobby-player-search" ref={wrapRef}>
      <label className="lobby-player-search-field">
        <span className="sr-only">Поиск игроков</span>
        <input
          type="search"
          className="lobby-player-search-input"
          placeholder="Найти игрока"
          value={query}
          maxLength={50}
          enterKeyHint="search"
          autoComplete="off"
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
        />
      </label>

      {showPanel && (
        <div className="lobby-player-search-panel" role="listbox" aria-label="Результаты поиска">
          {trimmed.length < 2 && (
            <p className="muted lobby-player-search-hint">Введите хотя бы 2 символа</p>
          )}
          {trimmed.length >= 2 && loading && <p className="muted lobby-player-search-hint">Поиск…</p>}
          {error && <p className="auth-error lobby-player-search-hint">{error}</p>}
          {trimmed.length >= 2 && !loading && !error && results.length === 0 && (
            <p className="muted lobby-player-search-hint">Никого не найдено</p>
          )}
          {results.map((hit) => (
            <button
              key={hit.id}
              type="button"
              className="lobby-player-search-hit"
              onClick={() => {
                setProfileUserId(hit.id);
                setOpen(false);
              }}
            >
              {hit.avatar ? (
                <img src={avatarUrl(hit.avatar) ?? undefined} alt="" className="lobby-player-search-avatar" />
              ) : (
                <span className="lobby-player-search-avatar placeholder" aria-hidden="true" />
              )}
              <span className="lobby-player-search-hit-body">
                <strong>{hit.displayName || hit.username}</strong>
                <span className="muted">@{hit.username}</span>
              </span>
              <span
                className={`presence-label ${hit.isOnline ? 'presence-online' : 'presence-offline'}`}
              >
                {formatPresenceLabel(hit)}
              </span>
            </button>
          ))}
        </div>
      )}

      {profileUserId != null && (
        <UserProfileModal
          userId={profileUserId}
          currentUserId={currentUser.id}
          viewerIsAdmin={currentUser.isAdmin}
          viewerCanModerate={currentUser.isStaff}
          onClose={() => setProfileUserId(null)}
          onWriteMessage={onWriteMessage}
          onOpenStatistics={onOpenStatistics}
          onOpenClan={onOpenClan}
        />
      )}
    </div>
  );
}
