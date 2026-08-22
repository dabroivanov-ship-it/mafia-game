import { useEffect, useRef, useState, FormEvent } from 'react';
import {
  avatarUrl,
  fetchUserProfile,
  adminBan,
  adminUnban,
  modBan,
  modUnban,
  adminUpdateUser,
  sendPrivateMessage,
  addFriend,
  removeFriend,
  voteReputation,
} from '../api';
import type { User, ProfileStaffMeta, ChatReplyTarget, UserPresence } from '../types';
import { USER_GENDER_LABELS, genderLabel } from '../gender';
import { formatPresenceLabel, formatOnlineDuration } from '../utils/presence';
import { userPositionLabel } from '../userPosition';

function quizAnswersLabel(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} ответ`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} ответа`;
  return `${count} ответов`;
}

type ChatVisibility = 'direct' | 'private';

interface UserProfileModalProps {
  userId: number;
  currentUserId: number;
  viewerIsAdmin: boolean;
  viewerCanModerate?: boolean;
  viewerCanSilence?: boolean;
  onClose: () => void;
  onAdminAction?: () => void;
  onWriteMessage?: (userId: number, username: string) => void;
  onOpenStatistics?: (userId: number) => void;
  onOpenClan?: (clanId: number) => void;
  replyTarget?: ChatReplyTarget | null;
  canSendChat?: boolean;
  onSendChat?: (
    text: string,
    opts: { toPlayerId?: number; toUserId?: number; isPrivate?: boolean }
  ) => Promise<{ error?: string } | void>;
  targetPlayerId?: number;
  targetSilenced?: boolean;
  inRoom?: boolean;
  onSilence?: (payload: {
    userId: number;
    playerId?: number;
    reason: string;
    minutes: number | null;
  }) => Promise<void>;
  onUnsilence?: (payload: { userId: number; playerId?: number }) => Promise<void>;
}

interface ProfileData {
  user: User & { messageCount?: number; gamesPlayed?: number; reputation?: number; quizCorrectAnswers?: number };
  clan?: { id: number; name: string } | null;
  presence: UserPresence;
  isFriend?: boolean;
  reputationVote?: -1 | 1 | null;
  canVoteReputation?: boolean;
  reputationMinGames?: number;
  viewerGamesPlayed?: number;
  canAdmin: boolean;
  canModerate: boolean;
  canSilence: boolean;
  staffMeta?: ProfileStaffMeta;
}

export default function UserProfileModal({
  userId,
  currentUserId,
  viewerIsAdmin,
  viewerCanModerate = false,
  viewerCanSilence = false,
  onClose,
  onAdminAction,
  onWriteMessage,
  onOpenStatistics,
  onOpenClan,
  replyTarget = null,
  canSendChat = false,
  onSendChat,
  targetPlayerId,
  targetSilenced = false,
  inRoom = false,
  onSilence,
  onUnsilence,
}: UserProfileModalProps) {
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({
    displayName: '',
    gender: '' as '' | 'male' | 'female',
    city: '',
    bio: '',
  });
  const [banReason, setBanReason] = useState('Нарушение правил');
  const [banMinutes, setBanMinutes] = useState('');
  const [showBanForm, setShowBanForm] = useState(false);
  const [silenceReason, setSilenceReason] = useState('Нарушение правил чата');
  const [silenceMinutes, setSilenceMinutes] = useState('');
  const [showSilenceForm, setShowSilenceForm] = useState(false);
  const [showMailCompose, setShowMailCompose] = useState(false);
  const [mailText, setMailText] = useState('');
  const [mailSending, setMailSending] = useState(false);
  const [mailSuccess, setMailSuccess] = useState('');
  const [chatText, setChatText] = useState('');
  const [chatVisibility, setChatVisibility] = useState<ChatVisibility>('direct');
  const [chatSending, setChatSending] = useState(false);
  const [chatSuccess, setChatSuccess] = useState('');
  const [friendBusy, setFriendBusy] = useState(false);
  const [reputationBusy, setReputationBusy] = useState(false);
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
        gender: res.user.gender || '',
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
      await ban(userId, banReason, banMinutes ? Number(banMinutes) : null);
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

  const handleSilence = async () => {
    if (!onSilence) return;
    try {
      await onSilence({
        userId,
        playerId: targetPlayerId,
        reason: silenceReason,
        minutes: silenceMinutes ? Number(silenceMinutes) : null,
      });
      setShowSilenceForm(false);
      onAdminAction?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка молчания');
    }
  };

  const handleUnsilence = async () => {
    if (!onUnsilence) return;
    try {
      await onUnsilence({ userId, playerId: targetPlayerId });
      onAdminAction?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка снятия молчания');
    }
  };

  const handleToggleFriend = async () => {
    if (!user) return;
    setFriendBusy(true);
    setError('');
    try {
      if (data?.isFriend) {
        await removeFriend(userId);
      } else {
        await addFriend(userId);
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка друзей');
    } finally {
      setFriendBusy(false);
    }
  };

  const handleReputationVote = async (value: -1 | 1) => {
    const targetName = user?.displayName || user?.username || 'этого игрока';
    const voteLabel = value > 0 ? 'положительный' : 'отрицательный';
    if (!confirm(`Вы хотите отдать ${voteLabel} голос пользователю ${targetName}?`)) return;

    setReputationBusy(true);
    setError('');
    try {
      await voteReputation(userId, value);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка репутации');
    } finally {
      setReputationBusy(false);
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

    const opts = {
      toPlayerId: replyTarget!.playerId,
      toUserId: replyTarget!.userId,
      isPrivate: chatVisibility === 'private',
    };

    try {
      const res = await onSendChat(trimmed, opts);
      if (res?.error) {
        setError(res.error);
      } else {
        setChatText('');
        if (inRoom) {
          onClose();
        } else {
          setChatSuccess('Сообщение отправлено в чат');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка отправки');
    } finally {
      setChatSending(false);
    }
  };

  const user = data?.user;
  const canAdmin = data?.canAdmin && viewerIsAdmin;
  const canProfileModerate = (data?.canModerate && viewerCanModerate) || canAdmin;
  const canRoomSilence =
    inRoom && viewerCanSilence && userId !== currentUserId && !!onSilence;
  const canWriteMail = userId !== currentUserId;
  const displayTitle = user?.username || replyTarget?.playerName || 'Игрок';

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
                placeholder={`Сообщение для ${replyTarget!.playerName}...`}
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
                    <div className="profile-avatar placeholder" aria-hidden="true" />
                  )}
                  <div>
                    <strong>@{user.username}</strong>
                  </div>
                </div>

                <ul className="player-page-info">
                  <li>
                    <span className="player-page-label">Имя</span>
                    <span>{user.displayName}</span>
                  </li>
                  <li>
                    <span className="player-page-label">Пол</span>
                    <span>{genderLabel(user.gender)}</span>
                  </li>
                  <li>
                    <span className="player-page-label">Город</span>
                    <span>{user.city || '—'}</span>
                  </li>
                  <li>
                    <span className="player-page-label">Активность</span>
                    <span
                      className={`presence-label ${
                        data?.presence?.isOnline ? 'presence-online' : 'presence-offline'
                      }`}
                    >
                      {formatPresenceLabel(data?.presence)}
                    </span>
                  </li>
                  <li>
                    <span className="player-page-label">Клан</span>
                    {data?.clan ? (
                      onOpenClan ? (
                        <button
                          type="button"
                          className="player-page-mmr-link"
                          onClick={() => {
                            onOpenClan(data.clan!.id);
                            onClose();
                          }}
                        >
                          {data.clan.name}
                        </button>
                      ) : (
                        <span>{data.clan.name}</span>
                      )
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </li>
                  <li>
                    <span className="player-page-label">Игр сыграно</span>
                    <span>{user.gamesPlayed ?? 0}</span>
                  </li>
                  <li>
                    <span className="player-page-label">Репутация</span>
                    <span
                      className={
                        (user.reputation ?? 0) > 0
                          ? 'reputation-positive'
                          : (user.reputation ?? 0) < 0
                            ? 'reputation-negative'
                            : ''
                      }
                    >
                      {(user.reputation ?? 0) > 0 ? '+' : ''}
                      {user.reputation ?? 0}
                    </span>
                  </li>
                  <li>
                    <span className="player-page-label">MMR</span>
                    {onOpenStatistics ? (
                      <button
                        type="button"
                        className="player-page-mmr-link"
                        onClick={() => {
                          onOpenStatistics(userId);
                          onClose();
                        }}
                      >
                        {user.mmr ?? user.totalScore}
                      </button>
                    ) : (
                      <span>{user.mmr ?? user.totalScore}</span>
                    )}
                  </li>
                  <li>
                    <span className="player-page-label">Сообщений в чате</span>
                    <span>{user.messageCount ?? 0}</span>
                  </li>
                  <li>
                    <span className="player-page-label">Викторина</span>
                    <span>{quizAnswersLabel(data?.user.quizCorrectAnswers ?? 0)}</span>
                  </li>
                  <li>
                    <span className="player-page-label">Должность</span>
                    <span>{userPositionLabel(user)}</span>
                  </li>
                  <li>
                    <span className="player-page-label">Регистрация</span>
                    <span>{new Date(user.createdAt).toLocaleDateString('ru-RU')}</span>
                  </li>
                  <li>
                    <span className="player-page-label">Онлайн</span>
                    <span>{formatOnlineDuration(user.onlineSeconds)}</span>
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
                      <div className="player-page-mail-actions">
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          disabled={friendBusy}
                          onClick={() => void handleToggleFriend()}
                        >
                          {data?.isFriend ? 'Удалить из друзей' : 'В друзья'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => {
                            if (onWriteMessage && user) {
                              onWriteMessage(user.id, user.username);
                              onClose();
                            } else {
                              setShowMailCompose(true);
                            }
                          }}
                        >
                          Написать письмо
                        </button>
                      </div>
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

                {canWriteMail && !editMode && (
                  <div className="profile-reputation-block">
                    {data?.reputationVote != null ? (
                      <p className="muted">
                        Ваша оценка: {data.reputationVote > 0 ? 'положительная' : 'отрицательная'}
                      </p>
                    ) : data?.canVoteReputation ? (
                      <div className="profile-reputation-actions">
                        <span className="muted">Оценить репутацию (один раз):</span>
                        <button
                          type="button"
                          className="btn btn-sm"
                          disabled={reputationBusy}
                          onClick={() => void handleReputationVote(1)}
                          title="Положительный голос"
                        >
                          👍
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm"
                          disabled={reputationBusy}
                          onClick={() => void handleReputationVote(-1)}
                          title="Отрицательный голос"
                        >
                          👎
                        </button>
                      </div>
                    ) : (
                      <p className="muted">
                        Репутацию можно ставить после {data?.reputationMinGames ?? 100} игр
                        {data?.viewerGamesPlayed != null
                          ? ` (у вас: ${data.viewerGamesPlayed})`
                          : ''}
                        .
                      </p>
                    )}
                  </div>
                )}

                {canProfileModerate && data?.staffMeta && (
                  <details className="profile-staff-meta">
                    <summary className="profile-staff-meta-summary">Данные подключения</summary>
                    <div className="profile-staff-meta-body">
                      <div className="profile-staff-meta-row">
                        <span className="muted">IP</span>
                        <strong>
                          {data.staffMeta.lastIp?.startsWith('::ffff:')
                            ? data.staffMeta.lastIp.slice(7)
                            : data.staffMeta.lastIp || '—'}
                        </strong>
                      </div>
                      <details className="profile-staff-meta-expand">
                        <summary className="profile-staff-meta-expand-summary">Софт / браузер</summary>
                        <p className="profile-user-agent">{data.staffMeta.lastUserAgent || '—'}</p>
                      </details>
                    </div>
                  </details>
                )}
              </>
            ) : (
              <div className="auth-form">
                <label>
                  Должность
                  <input value={userPositionLabel(user)} readOnly />
                </label>
                <label>
                  Имя
                  <input
                    value={editForm.displayName}
                    onChange={(e) => setEditForm({ ...editForm, displayName: e.target.value })}
                    maxLength={30}
                  />
                </label>
                <label>
                  Пол
                  <select
                    value={editForm.gender}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        gender: e.target.value as '' | 'male' | 'female',
                      })
                    }
                  >
                    <option value="">Не указан</option>
                    <option value="male">{USER_GENDER_LABELS.male}</option>
                    <option value="female">{USER_GENDER_LABELS.female}</option>
                  </select>
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

            {(canProfileModerate || canRoomSilence) && !editMode && (
              <div className="admin-profile-actions">
                <h4>{canAdmin ? 'Администрирование' : 'Модерация'}</h4>
                <div className="admin-profile-buttons">
                  {canAdmin && (
                    <button type="button" className="btn btn-sm" onClick={() => setEditMode(true)}>
                      Редактировать
                    </button>
                  )}
                  {canProfileModerate &&
                    (!user.isBanned ? (
                    <button type="button" className="btn btn-sm danger" onClick={() => setShowBanForm(true)}>
                      Забанить
                    </button>
                  ) : (
                    <button type="button" className="btn btn-sm" onClick={handleUnban}>
                      Разбанить
                    </button>
                  ))}
                  {canRoomSilence &&
                    (targetSilenced ? (
                      <button type="button" className="btn btn-sm" onClick={() => void handleUnsilence()}>
                        Снять молчание
                      </button>
                    ) : (
                      <button type="button" className="btn btn-sm" onClick={() => setShowSilenceForm(true)}>
                        Молчание
                      </button>
                    ))}
                </div>

                {showSilenceForm && (
                  <div className="ban-form">
                    <label>
                      Причина
                      <input value={silenceReason} onChange={(e) => setSilenceReason(e.target.value)} />
                    </label>
                    <label>
                      Минут (пусто = бессрочно)
                      <input
                        type="number"
                        min="1"
                        value={silenceMinutes}
                        onChange={(e) => setSilenceMinutes(e.target.value)}
                        placeholder="60"
                      />
                    </label>
                    <div className="profile-actions">
                      <button type="button" className="btn btn-ghost" onClick={() => setShowSilenceForm(false)}>
                        Отмена
                      </button>
                      <button type="button" className="btn btn-primary danger" onClick={() => void handleSilence()}>
                        Наложить молчание
                      </button>
                    </div>
                  </div>
                )}

                {showBanForm && (
                  <div className="ban-form">
                    <label>
                      Причина
                      <input value={banReason} onChange={(e) => setBanReason(e.target.value)} />
                    </label>
                    <label>
                      Минут (пусто = навсегда)
                      <input
                        type="number"
                        min="1"
                        value={banMinutes}
                        onChange={(e) => setBanMinutes(e.target.value)}
                        placeholder="60"
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
