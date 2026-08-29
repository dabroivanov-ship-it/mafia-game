import { useEffect, useState } from 'react';
import { avatarUrl, fetchFriends, searchUsers } from '../api';
import type { FriendUser, User, UserSearchHit } from '../types';
import { formatPresenceLabel } from '../utils/presence';
import UserProfileModal from './UserProfileModal';

interface CabinetFriendsProps {
  currentUser: User;
  onBack: () => void;
  onWriteMessage: (userId: number, username: string) => void;
  onOpenStatistics?: (userId: number) => void;
  onOpenClan?: (clanId: number) => void;
}

function FriendItem({
  friend,
  onWrite,
  onOpenProfile,
}: {
  friend: FriendUser;
  onWrite: () => void;
  onOpenProfile?: (userId: number) => void;
}) {
  const name = friend.displayName || friend.username;

  return (
    <div className="mail-item friend-item">
      <div className="mail-item-header">
        <button
          type="button"
          className="cabinet-friend-profile"
          onClick={() => onOpenProfile?.(friend.id)}
          disabled={!onOpenProfile}
          aria-label={onOpenProfile ? `Профиль ${name}` : undefined}
        >
          {friend.avatar ? (
            <img src={avatarUrl(friend.avatar) ?? undefined} alt="" className="mail-avatar" />
          ) : (
            <span className="mail-avatar placeholder" aria-hidden="true" />
          )}
          <div className="mail-conversation-body">
            <div className="mail-conversation-top">
              <strong>{name}</strong>
              <span
                className={`presence-label ${friend.isOnline ? 'presence-online' : 'presence-offline'}`}
              >
                {friend.isOnline ? 'в сети' : 'не в сети'}
              </span>
            </div>
            <span className="muted mail-conversation-login">@{friend.username}</span>
          </div>
        </button>
        <button type="button" className="btn btn-primary btn-sm" onClick={onWrite}>
          Написать
        </button>
      </div>
    </div>
  );
}

export default function CabinetFriends({
  currentUser,
  onBack,
  onWriteMessage,
  onOpenStatistics,
  onOpenClan,
}: CabinetFriendsProps) {
  const [friends, setFriends] = useState<FriendUser[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(true);
  const [friendsError, setFriendsError] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserSearchHit[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [profileUserId, setProfileUserId] = useState<number | null>(null);

  useEffect(() => {
    void fetchFriends()
      .then(({ friends: list }) => setFriends(list))
      .catch((err) => setFriendsError(err instanceof Error ? err.message : 'Ошибка загрузки'))
      .finally(() => setFriendsLoading(false));
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setSearchError('');
      setSearchLoading(false);
      return;
    }

    setSearchLoading(true);
    setSearchError('');
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const { users } = await searchUsers(q);
          setResults(users);
        } catch (err) {
          setSearchError(err instanceof Error ? err.message : 'Ошибка поиска');
          setResults([]);
        } finally {
          setSearchLoading(false);
        }
      })();
    }, 300);

    return () => window.clearTimeout(timer);
  }, [query]);

  const trimmedQuery = query.trim();
  const showSearch = trimmedQuery.length >= 2;

  return (
    <div className="cabinet-page cabinet-friends-page">
      <nav className="info-back">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onBack}>
          ← Кабинет
        </button>
      </nav>

      <header className="cabinet-friends-header">
        <h1>Друзья</h1>
        <p className="muted">Ищите игроков и переписывайтесь с друзьями.</p>
      </header>

      <div className="user-search-field cabinet-friends-search">
        <input
          type="search"
          className="admin-search-input user-search-input"
          placeholder="Поиск по логину, имени или городу"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          maxLength={50}
          enterKeyHint="search"
        />
      </div>

      {showSearch && (
        <section className="cabinet-friends-section">
          <h2 className="cabinet-friends-section-title">Результаты поиска</h2>
          {searchLoading && <p className="muted">Поиск…</p>}
          {searchError && <div className="auth-error">{searchError}</div>}
          {!searchLoading && !searchError && results.length === 0 && (
            <p className="muted">Никого не найдено</p>
          )}
          <div className="user-search-results">
            {results.map((hit) => {
              const isSelf = hit.id === currentUser.id;
              return (
                <div key={hit.id} className="user-search-card">
                  <button
                    type="button"
                    className="user-search-card-main"
                    onClick={() => setProfileUserId(hit.id)}
                  >
                    {hit.avatar ? (
                      <img src={avatarUrl(hit.avatar) ?? undefined} alt="" className="user-search-avatar" />
                    ) : (
                      <div className="user-search-avatar placeholder" aria-hidden="true" />
                    )}
                    <div className="user-search-card-body">
                      <strong>{hit.username}</strong>
                      <span
                        className={`presence-label ${hit.isOnline ? 'presence-online' : 'presence-offline'}`}
                      >
                        {formatPresenceLabel(hit)}
                      </span>
                      {hit.city && <span className="muted">📍 {hit.city}</span>}
                    </div>
                    <span className="info-hub-arrow" aria-hidden="true">
                      →
                    </span>
                  </button>
                  {(onOpenStatistics || !isSelf) && (
                    <div className="user-search-card-actions">
                      {onOpenStatistics && (
                        <button
                          type="button"
                          className="btn btn-sm btn-ghost"
                          onClick={() => onOpenStatistics(hit.id)}
                        >
                          MMR {hit.mmr ?? hit.totalScore}
                        </button>
                      )}
                      {!isSelf && (
                        <button
                          type="button"
                          className="btn btn-sm btn-primary"
                          onClick={() => onWriteMessage(hit.id, hit.username)}
                        >
                          Написать
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {!showSearch && trimmedQuery.length > 0 && (
        <p className="muted user-search-hint">Введите хотя бы 2 символа для поиска</p>
      )}

      <section className="cabinet-friends-section">
        <h2 className="cabinet-friends-section-title">Мои друзья</h2>
        {friendsError && <div className="auth-error">{friendsError}</div>}
        {friendsLoading && <p className="muted">Загрузка…</p>}
        {!friendsLoading && friends.length === 0 && !friendsError && (
          <div className="profile-card cabinet-card cabinet-friends-empty">
            <p>Друзей пока нет. Найдите игроков через поиск и добавьте их из профиля.</p>
          </div>
        )}
        {!friendsLoading && friends.length > 0 && (
          <div className="profile-card cabinet-card cabinet-friends-list">
            <div className="mail-list friends-list">
              {friends.map((friend) => (
                <FriendItem
                  key={friend.id}
                  friend={friend}
                  onWrite={() => onWriteMessage(friend.id, friend.username)}
                  onOpenProfile={setProfileUserId}
                />
              ))}
            </div>
          </div>
        )}
      </section>

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
