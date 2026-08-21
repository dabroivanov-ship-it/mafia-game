import { useEffect, useState } from 'react';
import { fetchOnlineUsers } from '../api';
import { ONLINE_PAGE_META, updatePageMeta } from '../seo';
import { profileStatsPath } from '../profileRouting';
import type { User, UserSearchHit } from '../types';
import UserProfileModal from './UserProfileModal';

interface OnlineUsersProps {
  currentUser?: User | null;
  onBack: () => void;
  onWriteMessage?: (userId: number, username: string) => void;
  onOpenStatistics?: (userId: number) => void;
  onOpenClan?: (clanId: number) => void;
  backLabel?: string;
}

export default function OnlineUsers({
  currentUser = null,
  onBack,
  onWriteMessage,
  onOpenStatistics,
  onOpenClan,
  backLabel = '← Комнаты',
}: OnlineUsersProps) {
  const [users, setUsers] = useState<UserSearchHit[]>([]);
  const [onlineCount, setOnlineCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [profileUserId, setProfileUserId] = useState<number | null>(null);

  const load = async () => {
    setError('');
    try {
      const data = await fetchOnlineUsers();
      setUsers(data.users);
      setOnlineCount(data.onlineCount);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!currentUser) updatePageMeta(ONLINE_PAGE_META);
    void load();
    const id = window.setInterval(() => void load(), 15000);
    return () => window.clearInterval(id);
  }, [currentUser]);

  const openUser = (userId: number) => {
    if (currentUser) {
      setProfileUserId(userId);
      return;
    }
    if (onOpenStatistics) {
      onOpenStatistics(userId);
      return;
    }
    window.location.href = profileStatsPath(userId);
  };

  return (
    <div className="online-users-page">
      <nav className="info-back">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onBack}>
          {backLabel}
        </button>
      </nav>

      <header className="page-header">
        <h1>В сети</h1>
        <p className="muted">
          {loading
            ? 'Загрузка...'
            : `На сайте сейчас ${onlineCount} игрок${onlineCount === 1 ? '' : onlineCount < 5 ? 'а' : 'ов'}`}
        </p>
      </header>

      {error && <div className="auth-error">{error}</div>}

      {!loading && !error && users.length === 0 && (
        <p className="muted">Сейчас никого нет в сети</p>
      )}

      <ul className="online-users-list">
        {users.map((hit) => (
          <li key={hit.id} className="online-user-item">
            <span className="online-user-dot" aria-hidden="true" title="В сети" />
            <button
              type="button"
              className="online-user-name"
              onClick={() => openUser(hit.id)}
            >
              {hit.username}
            </button>
            {hit.location && (
              <span className="online-user-location">{hit.location}</span>
            )}
          </li>
        ))}
      </ul>

      {currentUser && profileUserId != null && (
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
