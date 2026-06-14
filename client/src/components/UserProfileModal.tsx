import { useEffect, useState } from 'react';
import {
  avatarUrl,
  fetchUserProfile,
  adminBan,
  adminUnban,
  modBan,
  modUnban,
  adminDeleteUser,
  adminUpdateUser,
} from '../api';
import type { User } from '../types';

interface UserProfileModalProps {
  userId: number;
  viewerIsAdmin: boolean;
  viewerCanModerate?: boolean;
  onClose: () => void;
  onAdminAction?: () => void;
}

interface ProfileData {
  user: User & { messageCount?: number };
  canAdmin: boolean;
  canModerate: boolean;
}

export default function UserProfileModal({
  userId,
  viewerIsAdmin,
  viewerCanModerate = false,
  onClose,
  onAdminAction,
}: UserProfileModalProps) {
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({ displayName: '', city: '', bio: '' });
  const [banReason, setBanReason] = useState('Нарушение правил');
  const [banHours, setBanHours] = useState('');
  const [showBanForm, setShowBanForm] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchUserProfile(userId);
      setData(res);
      setEditForm({
        displayName: res.user.displayName || '',
        city: res.user.city || '',
        bio: res.user.bio || '',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userId) void load();
  }, [userId]);

  const handleSave = async () => {
    try {
      await adminUpdateUser(userId, editForm);
      setEditMode(false);
      await load();
      onAdminAction?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения');
    }
  };

  const handleBan = async () => {
    try {
      const ban = viewerIsAdmin ? adminBan : modBan;
      await ban(userId, banReason, banHours ? Number(banHours) : null);
      setShowBanForm(false);
      await load();
      onAdminAction?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка бана');
    }
  };

  const handleUnban = async () => {
    try {
      const unban = viewerIsAdmin ? adminUnban : modUnban;
      await unban(userId);
      await load();
      onAdminAction?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка разбана');
    }
  };

  const handleDelete = async () => {
    if (!confirm('Удалить пользователя и его профиль?')) return;
    try {
      await adminDeleteUser(userId);
      onAdminAction?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка удаления');
    }
  };

  const user = data?.user;
  const canAdmin = data?.canAdmin && viewerIsAdmin;
  const canModerate = (data?.canModerate && viewerCanModerate) || canAdmin;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide user-profile-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header-row">
          <h3>Профиль игрока</h3>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>

        {loading && <p className="muted">Загрузка...</p>}
        {error && <div className="auth-error">{error}</div>}

        {!loading && user && (
          <>
            <div className="profile-avatar-block">
              {user.avatar ? (
                <img src={avatarUrl(user.avatar) ?? undefined} alt="" className="profile-avatar" />
              ) : (
                <div className="profile-avatar placeholder">👤</div>
              )}
              <div className="profile-avatar-info">
                <strong>{user.displayName}</strong>
                <p className="muted">@{user.username}</p>
                {user.isAdmin && <span className="admin-badge">admin</span>}
                {user.isModerator && <span className="mod-badge">mod</span>}
              </div>
            </div>

            {!editMode ? (
              <>
                <div className="profile-stats">
                  <span>🏆 {user.totalScore} очков</span>
                  {user.city && <span>📍 {user.city}</span>}
                  <span>📅 с {new Date(user.createdAt).toLocaleDateString('ru-RU')}</span>
                  <span>💬 {user.messageCount ?? 0} сообщ.</span>
                </div>
                {user.bio && <p className="profile-bio">{user.bio}</p>}
                {user.isBanned && (
                  <div className="auth-error">
                    Заблокирован{user.banReason ? `: ${user.banReason}` : ''}
                  </div>
                )}
              </>
            ) : (
              <div className="auth-form">
                <label>
                  Имя
                  <input
                    value={editForm.displayName}
                    onChange={(e) => setEditForm({ ...editForm, displayName: e.target.value })}
                    maxLength={30}
                  />
                </label>
                <label>
                  Город
                  <input
                    value={editForm.city}
                    onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                    maxLength={50}
                  />
                </label>
                <label>
                  О себе
                  <textarea
                    value={editForm.bio}
                    onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                    maxLength={500}
                    rows={3}
                  />
                </label>
                <div className="profile-actions">
                  <button type="button" className="btn btn-ghost" onClick={() => setEditMode(false)}>
                    Отмена
                  </button>
                  <button type="button" className="btn btn-primary" onClick={handleSave}>
                    Сохранить
                  </button>
                </div>
              </div>
            )}

            {canModerate && !editMode && !canAdmin && (
              <div className="admin-profile-actions">
                <h4>Модерация</h4>
                <div className="admin-profile-buttons">
                  {!user.isBanned ? (
                    <button type="button" className="btn btn-sm danger" onClick={() => setShowBanForm(true)}>
                      Забанить
                    </button>
                  ) : (
                    <button type="button" className="btn btn-sm" onClick={handleUnban}>
                      Разбанить
                    </button>
                  )}
                </div>

                {showBanForm && (
                  <div className="ban-form">
                    <label>
                      Причина
                      <input value={banReason} onChange={(e) => setBanReason(e.target.value)} />
                    </label>
                    <label>
                      Часов (пусто = навсегда)
                      <input
                        type="number"
                        min="1"
                        value={banHours}
                        onChange={(e) => setBanHours(e.target.value)}
                        placeholder="24"
                      />
                    </label>
                    <div className="profile-actions">
                      <button type="button" className="btn btn-ghost" onClick={() => setShowBanForm(false)}>
                        Отмена
                      </button>
                      <button type="button" className="btn btn-primary danger" onClick={handleBan}>
                        Забанить
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {canAdmin && !editMode && (
              <div className="admin-profile-actions">
                <h4>Администрирование</h4>
                <div className="admin-profile-buttons">
                  <button type="button" className="btn btn-sm" onClick={() => setEditMode(true)}>
                    Редактировать
                  </button>
                  {!user.isBanned ? (
                    <button type="button" className="btn btn-sm danger" onClick={() => setShowBanForm(true)}>
                      Забанить
                    </button>
                  ) : (
                    <button type="button" className="btn btn-sm" onClick={handleUnban}>
                      Разбанить
                    </button>
                  )}
                  <button type="button" className="btn btn-sm btn-ghost" onClick={handleDelete}>
                    Удалить
                  </button>
                </div>

                {showBanForm && (
                  <div className="ban-form">
                    <label>
                      Причина
                      <input value={banReason} onChange={(e) => setBanReason(e.target.value)} />
                    </label>
                    <label>
                      Часов (пусто = навсегда)
                      <input
                        type="number"
                        min="1"
                        value={banHours}
                        onChange={(e) => setBanHours(e.target.value)}
                        placeholder="24"
                      />
                    </label>
                    <div className="profile-actions">
                      <button type="button" className="btn btn-ghost" onClick={() => setShowBanForm(false)}>
                        Отмена
                      </button>
                      <button type="button" className="btn btn-primary danger" onClick={handleBan}>
                        Забанить
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
