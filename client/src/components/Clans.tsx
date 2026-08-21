import { FormEvent, useEffect, useState } from 'react';
import {
  applyToClan,
  createClan,
  createClanNews,
  decideClanApplication,
  deleteClanNews,
  dissolveClan,
  fetchClan,
  fetchClanNews,
  fetchClans,
  kickClanMember,
  blacklistClanMember,
  removeClanBlacklistMember,
  clearClanChat,
  leaveClan,
  transferClanLeadership,
  updateClan,
} from '../api';
import type { ClanDetail, ClanEligibility, ClanJoinMode, ClanListItem, ClanNewsItem } from '../types';

interface ClansProps {
  onBack: () => void;
  onJoinRoom: (roomId: number) => void;
  initialClanId?: number | null;
}

type Screen = 'list' | 'create' | 'detail';

export default function Clans({ onBack, onJoinRoom, initialClanId = null }: ClansProps) {
  const [screen, setScreen] = useState<Screen>('list');
  const [clans, setClans] = useState<ClanListItem[]>([]);
  const [eligibility, setEligibility] = useState<ClanEligibility | null>(null);
  const [createMinPosts, setCreateMinPosts] = useState(50);
  const [clan, setClan] = useState<ClanDetail | null>(null);
  const [news, setNews] = useState<ClanNewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [joinMode, setJoinMode] = useState<ClanJoinMode>('approval');
  const [newsTitle, setNewsTitle] = useState('');
  const [newsBody, setNewsBody] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editJoinMode, setEditJoinMode] = useState<ClanJoinMode>('approval');

  const loadList = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchClans();
      setClans(res.clans);
      setEligibility(res.eligibility);
      setCreateMinPosts(res.createMinPosts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить кланы');
    } finally {
      setLoading(false);
    }
  };

  const openClan = async (clanId: number) => {
    setLoading(true);
    setError('');
    try {
      const { clan: detail } = await fetchClan(clanId);
      setClan(detail);
      setEditDescription(detail.description);
      setEditJoinMode(detail.joinMode);
      setScreen('detail');
      if (detail.myRole) {
        const newsRes = await fetchClanNews(clanId);
        setNews(newsRes.news);
      } else {
        setNews([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось открыть клан');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadList();
  }, []);

  useEffect(() => {
    if (initialClanId == null) return;
    void openClan(initialClanId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open once when id is provided on mount/change
  }, [initialClanId]);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { clan: created } = await createClan({ name, description, joinMode });
      setName('');
      setDescription('');
      setJoinMode('approval');
      await openClan(created.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось создать клан');
    } finally {
      setBusy(false);
    }
  };

  const myClan = clans.find((c) => c.myRole);

  return (
    <div className="clans-page">
      <nav className="info-back">
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => {
            if (screen === 'list') onBack();
            else {
              setScreen('list');
              setClan(null);
              void loadList();
            }
          }}
        >
          ← {screen === 'list' ? 'Назад' : 'К кланам'}
        </button>
      </nav>

      <header className="page-header">
        <h1>Кланы</h1>
        <p className="muted">
          Один клан на игрока. Комната и новости клана — только для членов.
        </p>
      </header>

      {error && <p className="form-error">{error}</p>}

      {screen === 'list' && (
        <>
          {myClan && (
            <div className="clans-my">
              <span className="muted">Ваш клан</span>
              <button type="button" className="clans-card clans-card-mine" onClick={() => void openClan(myClan.id)}>
                <strong>{myClan.name}</strong>
                <span className="muted">
                  {myClan.memberCount} чел. · {myClan.myRole === 'leader' ? 'глава' : 'участник'}
                </span>
              </button>
            </div>
          )}

          {!myClan && eligibility && (
            <div className="clans-create-bar">
              {eligibility.canCreate ? (
                <button type="button" className="btn btn-primary" onClick={() => setScreen('create')}>
                  Создать клан
                </button>
              ) : (
                <p className="muted">
                  Создать клан можно после {createMinPosts} сообщений в чате (у вас{' '}
                  {eligibility.messageCount}).
                </p>
              )}
            </div>
          )}

          {loading && !clans.length ? (
            <p className="muted">Загрузка…</p>
          ) : clans.length === 0 ? (
            <p className="muted">Кланов пока нет</p>
          ) : (
            <div className="clans-list">
              {clans.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="clans-card"
                  onClick={() => void openClan(item.id)}
                >
                  <strong>{item.name}</strong>
                  <span className="muted">
                    {item.memberCount} чел. · глава @{item.leaderName} ·{' '}
                    {item.joinMode === 'open' ? 'открытый' : 'по заявке'}
                  </span>
                  {item.description ? <span className="clans-card-desc">{item.description}</span> : null}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {screen === 'create' && (
        <form className="clans-form" onSubmit={handleCreate}>
          <label>
            Название
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
              required
              disabled={busy}
            />
          </label>
          <label>
            Описание
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={400}
              rows={3}
              disabled={busy}
            />
          </label>
          <fieldset className="clans-join-mode">
            <legend>Вступление</legend>
            <label className="clans-radio">
              <input
                type="radio"
                name="joinMode"
                checked={joinMode === 'open'}
                onChange={() => setJoinMode('open')}
                disabled={busy}
              />
              Открытое — входят сразу
            </label>
            <label className="clans-radio">
              <input
                type="radio"
                name="joinMode"
                checked={joinMode === 'approval'}
                onChange={() => setJoinMode('approval')}
                disabled={busy}
              />
              По заявке — решает глава
            </label>
          </fieldset>
          <div className="clans-form-actions">
            <button type="submit" className="btn btn-primary" disabled={busy || name.trim().length < 2}>
              {busy ? 'Создание…' : 'Создать'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setScreen('list')} disabled={busy}>
              Отмена
            </button>
          </div>
        </form>
      )}

      {screen === 'detail' && clan && (
        <div className="clans-detail">
          <div className="clans-detail-head">
            <h2>{clan.name}</h2>
            <p className="muted">
              Глава @{clan.leaderName} · {clan.memberCount} чел. ·{' '}
              {clan.joinMode === 'open' ? 'открытый вход' : 'вход по заявке'}
            </p>
            {clan.description ? <p>{clan.description}</p> : null}
          </div>

          <div className="clans-actions">
            {clan.myRole && clan.roomId != null && (
              <button type="button" className="btn btn-primary" onClick={() => onJoinRoom(clan.roomId!)}>
                Комната клана
              </button>
            )}
            {!clan.myRole && !clan.amBanned && clan.myApplicationStatus !== 'pending' && (
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy || !!myClan}
                onClick={() => {
                  setBusy(true);
                  setError('');
                  void applyToClan(clan.id)
                    .then((res) => {
                      setClan(res.clan);
                      return loadList();
                    })
                    .catch((err) => setError(err instanceof Error ? err.message : 'Ошибка'))
                    .finally(() => setBusy(false));
                }}
              >
                {clan.joinMode === 'open' ? 'Вступить' : 'Подать заявку'}
              </button>
            )}
            {clan.myApplicationStatus === 'pending' && (
              <p className="muted">Заявка ожидает решения главы</p>
            )}
            {clan.amBanned && <p className="form-error">Вам запрещено подавать заявку в этот клан</p>}
            {clan.myRole === 'member' && (
              <button
                type="button"
                className="btn btn-ghost danger"
                disabled={busy}
                onClick={() => {
                  if (!confirm('Выйти из клана?')) return;
                  setBusy(true);
                  void leaveClan(clan.id)
                    .then(() => {
                      setScreen('list');
                      setClan(null);
                      return loadList();
                    })
                    .catch((err) => setError(err instanceof Error ? err.message : 'Ошибка'))
                    .finally(() => setBusy(false));
                }}
              >
                Выйти из клана
              </button>
            )}
            {clan.myRole === 'leader' && (
              <button
                type="button"
                className="btn btn-ghost danger"
                disabled={busy}
                onClick={() => {
                  if (!confirm('Распустить клан? Комната и новости будут удалены.')) return;
                  setBusy(true);
                  void dissolveClan(clan.id)
                    .then(() => {
                      setScreen('list');
                      setClan(null);
                      return loadList();
                    })
                    .catch((err) => setError(err instanceof Error ? err.message : 'Ошибка'))
                    .finally(() => setBusy(false));
                }}
              >
                Распустить клан
              </button>
            )}
            {clan.myRole === 'leader' && clan.roomId != null && (
              <button
                type="button"
                className="btn btn-ghost"
                disabled={busy}
                onClick={() => {
                  if (!confirm('Очистить весь чат комнаты клана?')) return;
                  setBusy(true);
                  setError('');
                  void clearClanChat(clan.id)
                    .then((res) => setClan(res.clan))
                    .catch((err) => setError(err instanceof Error ? err.message : 'Ошибка'))
                    .finally(() => setBusy(false));
                }}
              >
                Очистить чат
              </button>
            )}
          </div>

          {clan.myRole === 'leader' && (
            <section className="clans-section">
              <h3>Настройки</h3>
              <form
                className="clans-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  setBusy(true);
                  setError('');
                  void updateClan(clan.id, {
                    description: editDescription,
                    joinMode: editJoinMode,
                  })
                    .then((res) => setClan(res.clan))
                    .catch((err) => setError(err instanceof Error ? err.message : 'Ошибка'))
                    .finally(() => setBusy(false));
                }}
              >
                <label>
                  Описание
                  <textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    maxLength={400}
                    rows={3}
                    disabled={busy}
                  />
                </label>
                <fieldset className="clans-join-mode">
                  <legend>Вступление</legend>
                  <label className="clans-radio">
                    <input
                      type="radio"
                      checked={editJoinMode === 'open'}
                      onChange={() => setEditJoinMode('open')}
                      disabled={busy}
                    />
                    Открытое
                  </label>
                  <label className="clans-radio">
                    <input
                      type="radio"
                      checked={editJoinMode === 'approval'}
                      onChange={() => setEditJoinMode('approval')}
                      disabled={busy}
                    />
                    По заявке
                  </label>
                </fieldset>
                <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
                  Сохранить
                </button>
              </form>
            </section>
          )}

          {clan.myRole === 'leader' && clan.pendingApplications.length > 0 && (
            <section className="clans-section">
              <h3>Заявки</h3>
              <ul className="clans-apps">
                {clan.pendingApplications.map((app) => (
                  <li key={app.id}>
                    <span>
                      <strong>{app.displayName}</strong>{' '}
                      <span className="muted">@{app.username}</span>
                    </span>
                    <span className="clans-app-actions">
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={busy}
                        onClick={() => {
                          setBusy(true);
                          void decideClanApplication(clan.id, app.id, 'approve')
                            .then((res) => setClan(res.clan))
                            .catch((err) => setError(err instanceof Error ? err.message : 'Ошибка'))
                            .finally(() => setBusy(false));
                        }}
                      >
                        Принять
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        disabled={busy}
                        onClick={() => {
                          setBusy(true);
                          void decideClanApplication(clan.id, app.id, 'reject')
                            .then((res) => setClan(res.clan))
                            .catch((err) => setError(err instanceof Error ? err.message : 'Ошибка'))
                            .finally(() => setBusy(false));
                        }}
                      >
                        Отклонить
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm danger"
                        disabled={busy}
                        title="Запретить повторные заявки"
                        onClick={() => {
                          if (!confirm('Запретить этому игроку подавать заявки в клан?')) return;
                          setBusy(true);
                          void decideClanApplication(clan.id, app.id, 'ban')
                            .then((res) => setClan(res.clan))
                            .catch((err) => setError(err instanceof Error ? err.message : 'Ошибка'))
                            .finally(() => setBusy(false));
                        }}
                      >
                        Запрет
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="clans-section">
            <h3>Участники</h3>
            <ul className="clans-members">
              {clan.members.map((m) => (
                <li key={m.userId}>
                  <span>
                    <strong>{m.displayName}</strong>{' '}
                    <span className="muted">
                      @{m.username}
                      {m.role === 'leader' ? ' · глава' : ''}
                    </span>
                  </span>
                  {clan.myRole === 'leader' && m.role !== 'leader' && (
                    <span className="clans-app-actions">
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        disabled={busy}
                        onClick={() => {
                          if (!confirm(`Передать главенство игроку ${m.username}?`)) return;
                          setBusy(true);
                          void transferClanLeadership(clan.id, m.userId)
                            .then((res) => setClan(res.clan))
                            .catch((err) => setError(err instanceof Error ? err.message : 'Ошибка'))
                            .finally(() => setBusy(false));
                        }}
                      >
                        Сделать главой
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm danger"
                        disabled={busy}
                        onClick={() => {
                          if (!confirm(`Исключить ${m.username} из клана?`)) return;
                          setBusy(true);
                          void kickClanMember(clan.id, m.userId)
                            .then((res) => setClan(res.clan))
                            .catch((err) => setError(err instanceof Error ? err.message : 'Ошибка'))
                            .finally(() => setBusy(false));
                        }}
                      >
                        Исключить
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm danger"
                        disabled={busy}
                        title="Исключить и запретить повторные заявки"
                        onClick={() => {
                          if (
                            !confirm(
                              `Добавить ${m.username} в чёрный список? Игрок будет исключён и не сможет подать заявку снова.`
                            )
                          ) {
                            return;
                          }
                          setBusy(true);
                          void blacklistClanMember(clan.id, m.userId)
                            .then((res) => setClan(res.clan))
                            .catch((err) => setError(err instanceof Error ? err.message : 'Ошибка'))
                            .finally(() => setBusy(false));
                        }}
                      >
                        Чёрный список
                      </button>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>

          {clan.myRole === 'leader' && (clan.blacklist?.length ?? 0) > 0 && (
            <section className="clans-section">
              <h3>Чёрный список</h3>
              <ul className="clans-members">
                {clan.blacklist!.map((entry) => (
                  <li key={entry.userId}>
                    <span>
                      <strong>{entry.displayName}</strong>{' '}
                      <span className="muted">@{entry.username}</span>
                    </span>
                    <span className="clans-app-actions">
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        disabled={busy}
                        onClick={() => {
                          setBusy(true);
                          setError('');
                          void removeClanBlacklistMember(clan.id, entry.userId)
                            .then((res) => setClan(res.clan))
                            .catch((err) => setError(err instanceof Error ? err.message : 'Ошибка'))
                            .finally(() => setBusy(false));
                        }}
                      >
                        Убрать
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {clan.myRole && (
            <section className="clans-section">
              <h3>Новости клана</h3>
              {clan.myRole === 'leader' && (
                <form
                  className="clans-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    setBusy(true);
                    setError('');
                    void createClanNews(clan.id, { title: newsTitle, body: newsBody })
                      .then((res) => {
                        setNews((prev) => [res.news, ...prev]);
                        setNewsTitle('');
                        setNewsBody('');
                      })
                      .catch((err) => setError(err instanceof Error ? err.message : 'Ошибка'))
                      .finally(() => setBusy(false));
                  }}
                >
                  <label>
                    Заголовок
                    <input
                      value={newsTitle}
                      onChange={(e) => setNewsTitle(e.target.value)}
                      maxLength={120}
                      required
                      disabled={busy}
                    />
                  </label>
                  <label>
                    Текст
                    <textarea
                      value={newsBody}
                      onChange={(e) => setNewsBody(e.target.value)}
                      maxLength={8000}
                      rows={4}
                      required
                      disabled={busy}
                    />
                  </label>
                  <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
                    Опубликовать
                  </button>
                </form>
              )}
              {news.length === 0 ? (
                <p className="muted">Пока нет новостей</p>
              ) : (
                <ul className="clans-news">
                  {news.map((item) => (
                    <li key={item.id}>
                      <div className="clans-news-head">
                        <strong>{item.title}</strong>
                        {clan.myRole === 'leader' && (
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm danger"
                            disabled={busy}
                            onClick={() => {
                              if (!confirm('Удалить новость?')) return;
                              setBusy(true);
                              void deleteClanNews(clan.id, item.id)
                                .then(() => setNews((prev) => prev.filter((n) => n.id !== item.id)))
                                .catch((err) =>
                                  setError(err instanceof Error ? err.message : 'Ошибка')
                                )
                                .finally(() => setBusy(false));
                            }}
                          >
                            Удалить
                          </button>
                        )}
                      </div>
                      <p className="muted">
                        @{item.authorName} ·{' '}
                        {new Date(item.createdAt).toLocaleString('ru-RU', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                      <p className="clans-news-body">{item.body}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {!clan.myRole && (
            <p className="muted">
              Комната и новости клана откроются после вступления. Список участников доступен всем.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
