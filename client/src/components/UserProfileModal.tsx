import { useEffect, useRef, useState, FormEvent } from 'react';
import {
  avatarUrl,
  fetchUserProfile,
  adminBan,
  adminUnban,
  modBan,
  modUnban,
  adminDeleteUser,
  adminUpdateUser,
  sendPrivateMessage,
} from '../api';
import type { User, ProfileStaffMeta, ChatReplyTarget } from '../types';

type ChatVisibility = 'all' | 'direct' | 'private';

interface UserProfileModalProps {
  userId: number;
  currentUserId: number;
  viewerIsAdmin: boolean;
  viewerCanModerate?: boolean;
  onClose: () => void;
  onAdminAction?: () => void;
  replyTarget?: ChatReplyTarget | null;
  canSendChat?: boolean;
  onSendChat?: (
    text: string,
    opts: { toPlayerId?: number; isPrivate?: boolean }
  ) => Promise<{ error?: string } | void>;
}

interface ProfileData {
  user: User & { messageCount?: number };
  canAdmin: boolean;
  canModerate: boolean;
  staffMeta?: ProfileStaffMeta;
}

export default function UserProfileModal({
  userId,
  currentUserId,
  viewerIsAdmin,
  viewerCanModerate = false,
  onClose,
  onAdminAction,
  replyTarget = null,
  canSendChat = false,
  onSendChat,
}: UserProfileModalProps) {
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({ displayName: '', city: '', bio: '' });
  const [banReason, setBanReason] = useState('Нарушение правил');
  const [banHours, setBanHours] = useState('');
  const [showBanForm, setShowBanForm] = useState(false);
  const [showMailCompose, setShowMailCompose] = useState(false);
  const [mailText, setMailText] = useState('');
  const [mailSending, setMailSending] = useState(false);
  const [mailSuccess, setMailSuccess] = useState('');
  const [chatText, setChatText] = useState('');
  const [chatVisibility, setChatVisibility] = useState<ChatVisibility>('direct');
  const [chatSending, setChatSending] = useState(false);
  const [chatSuccess, setChatSuccess] = useState('');
  const chatInputRef = useRef<HTMLTextAreaElement>(null);

  const showChatCompose =
    !!onSendChat && !!replyTarget && canSendChat && userId !== currentUserId;

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

  useEffect(() => {
    if (replyTarget) {
      setChatVisibility('direct');
      setChatText('');
      setChatSuccess('');
    }
  }, [replyTarget?.playerId, userId]);

  useEffect(() => {
    if (showChatCompose && !loading) {
      chatInputRef.current?.focus();
    }
  }, [showChatCompose, loading]);

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

  const handleSendMail = async () => {
    if (!mailText.trim()) return;
    setMailSending(true);
    setError('');
    setMailSuccess('');
    try {
      await sendPrivateMessage(userId, mailText.trim());
      setMailText('');
      setShowMailCompose(false);
      setMailSuccess('Письмо отправлено');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка отправки');
    } finally {
      setMailSending(false);
    }
  };

  const handleSendChat = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = chatText.trim();
    if (!trimmed || !onSendChat) return;

    setChatSending(true);
    setError('');
    setChatSuccess('');

    const opts =
      chatVisibility === 'all'
        ? {}
        : chatVisibility === 'private'
          ? { toPlayerId: replyTarget!.playerId, isPrivate: true }
          : { toPlayerId: replyTarget!.playerId, isPrivate: false };

    try {
      const res = await onSendChat(trimmed, opts);
      if (res?.error) {
        setError(res.error);
      } else {
        setChatText('');
        setChatSuccess('Сообщение отправлено в чат');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка отправки');
    } finally {
      setChatSending(false);
    }
  };

  const user = data?.user;
  const canAdmin = data?.canAdmin && viewerIsAdmin;
  const canModerate = (data?.canModerate && viewerCanModerate) || canAdmin;
  const canWriteMail = userId !== currentUserId;
  const displayTitle = user?.displayName || replyTarget?.playerName || 'Игрок';

  return (
    <div className="modal-overlay player-page-overlay" onClick={onClose}>
      <div className="modal player-page-modal" onClick={(e) => e.stopPropagation()}>
        <div className="player-page-top">
          <button type="button" className="btn btn-ghost btn-sm player-page-close" onClick={onClose}>
            ✕ Закрыть
          </button>
          <h2 className="player-page-name">{displayTitle}</h2>

          {showChatCompose && (
            <form className="player-page-compose" onSubmit={handleSendChat}>
              <textarea
                ref={chatInputRef}
                value={chatText}
                onChange={(e) => setChatText(e.target.value)}
                rows={4}
                maxLength={300}
                placeholder="Напишите сообщение..."
                disabled={chatSending}
              />
              <div className="player-page-compose-controls">
                <label className="player-page-select-wrap">
                  <span className="sr-only">Кому</span>
                  <select
                    value={chatVisibility}
                    onChange={(e) => setChatVisibility(e.target.value as ChatVisibility)}
                    disabled={chatSending}
                  >
                    <option value="all">Всем</option>
                    <option value="direct">{replyTarget!.playerName}</option>
                    <option value="private">Приватно [P]</option>
                  </select>
                </label>
                <button
                  type="submit"
                  className="btn btn-primary player-page-say-btn"
                  disabled={chatSending || !chatText.trim()}
                >
                  {chatSending ? '...' : 'Сказать'}
                </button>
              </div>
            </form>
          )}

          {chatSuccess && <div className="auth-success player-page-flash">{chatSuccess}</div>}
        </div>

        {loading && <p className="muted player-page-body">Загрузка...</p>}
        {error && <div className="auth-error player-page-body">{error}</div>}
        {mailSuccess && <div className="auth-success player-page-body">{mailSuccess}</div>}

        {!loading && user && (
          <div className="player-page-body">
            {!editMode ? (
              <>
                <div className="player-page-avatar-row">
                  {user.avatar ? (
                    <img src={avatarUrl(user.avatar) ?? undefined} alt="" className="profile-avatar" />
                  ) : (
                    <div className="profile-avatar placeholder">👤</div>
                  )}
                  <div>
                    <strong>@{user.username}</strong>
                    {user.isAdmin && <span className="admin-badge">admin</span>}
                    {user.isModerator && <span className="mod-badge">mod</span>}
                  </div>
                </div>

                <ul className="player-page-info">
                  <li>
                    <span className="player-page-label">Имя</span>
                    <span>{user.displayName}</span>
                  </li>
                  <li>
                    <span className="player-page-label">Город</span>
                    <span>{user.city || '—'}</span>
                  </li>
                  <li>
                    <span className="player-page-label">Очки</span>
                    <span>{user.totalScore}</span>
                  </li>
                  <li>
                    <span className="player-page-label">Сообщений в чате</span>
                    <span>{user.messageCount ?? 0}</span>
                  </li>
                  <li>
                    <span className="player-page-label">Регистрация</span>
                    <span>{new Date(user.createdAt).toLocaleDateString('ru-RU')}</span>
                  </li>
                  {user.isBanned && (
                    <li className="player-page-banned">
                      <span className="player-page-label">Статус</span>
                      <span>Заблокирован{user.banReason ? `: ${user.banReason}` : ''}</span>
                    </li>
                  )}
                </ul>

                {user.bio && (
                  <div className="player-page-bio">
                    <span className="player-page-label">О себе</span>
                    <p>{user.bio}</p>
                  </div>
                )}

                {canWriteMail && (
                  <div className="player-page-actions">
                    {!showMailCompose ? (
                      <button
                        type="button"
                        className="player-page-link"
                        onClick={() => setShowMailCompose(true)}
                      >
                        &gt; ✉️ Написать письмо
                      </button>
                    ) : (
                      <div className="mail-compose-inline">
                        <textarea
                          value={mailText}
                          onChange={(e) => setMailText(e.target.value)}
                          rows={4}
                          maxLength={2000}
                          placeholder="Личное сообщение в кабинет..."
                        />
                        <div className="profile-actions">
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => setShowMailCompose(false)}
                          >
                            Отмена
                          </button>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            disabled={mailSending}
                            onClick={() => void handleSendMail()}
                          >
                            {mailSending ? 'Отправка...' : 'Отправить'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {canModerate && data?.staffMeta && (
                  <div className="profile-staff-meta">
                    <h4>Данные подключения</h4>
                    <div className="profile-staff-meta-row">
                      <span className="muted">IP</span>
                      <strong>{data.staffMeta.lastIp || '—'}</strong>
                    </div>
                    <div className="profile-staff-meta-row">
                      <span className="muted">Софт / браузер</span>
                      <strong className="profile-user-agent">
                        {data.staffMeta.lastUserAgent || '—'}
                      </strong>
                    </div>
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

            {canModerate && !editMode && (
              <div className="admin-profile-actions">
                <h4>{canAdmin ? 'Администрирование' : 'Модерация'}</h4>
                <div className="admin-profile-buttons">
                  {canAdmin && (
                    <button type="button" className="btn btn-sm" onClick={() => setEditMode(true)}>
                      Редактировать
                    </button>
                  )}
                  {!user.isBanned ? (
                    <button type="button" className="btn btn-sm danger" onClick={() => setShowBanForm(true)}>
                      Забанить
                    </button>
                  ) : (
                    <button type="button" className="btn btn-sm" onClick={handleUnban}>
                      Разбанить
                    </button>
                  )}
                  {canAdmin && (
                    <button type="button" className="btn btn-sm btn-ghost" onClick={handleDelete}>
                      Удалить
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
          </div>
        )}
      </div>
    </div>
  );
}
