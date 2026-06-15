import { useEffect, useState } from 'react';
import { Socket } from 'socket.io-client';
import Chat from './Chat';
import ActionPanel from './ActionPanel';
import UserProfileModal from './UserProfileModal';
import type { GamePhase, RoomState } from '../types';

const PHASE_LABELS: Record<GamePhase, string> = {
  waiting: 'Ожидание',
  registration: 'Регистрация',
  day: 'День',
  voting: 'Голосование',
  night: 'Ночь',
  ended: 'Игра окончена',
};

function useTimer(timerEnd: number | null) {
  const [left, setLeft] = useState(0);

  useEffect(() => {
    if (!timerEnd) {
      setLeft(0);
      return;
    }
    const tick = () => {
      const sec = Math.max(0, Math.ceil((timerEnd - Date.now()) / 1000));
      setLeft(sec);
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [timerEnd]);

  return left;
}

function useCountdown(seconds: number) {
  const [left, setLeft] = useState(seconds);

  useEffect(() => {
    setLeft(seconds);
  }, [seconds]);

  useEffect(() => {
    if (seconds <= 0) return;
    const id = setInterval(() => setLeft((v) => Math.max(0, v - 1)), 1000);
    return () => clearInterval(id);
  }, [seconds]);

  return left;
}

interface RoomProps {
  socket: Socket | null;
  state: RoomState | null;
  onLeave: () => void;
  currentUserId: number;
}

export default function Room({ socket, state, onLeave, currentUserId }: RoomProps) {
  const [mafiaTab, setMafiaTab] = useState(false);
  const [profileUserId, setProfileUserId] = useState<number | null>(null);
  const [loadingMoreChat, setLoadingMoreChat] = useState(false);

  const timerLeft = useTimer(state?.timerEnd ?? null);
  const joinCooldown = useCountdown(state?.joinGameCooldownSec || 0);

  if (!state) {
    return (
      <div className="room loading">
        <p>Подключение к комнате...</p>
      </div>
    );
  }

  const me = state.myPlayer;
  const isMafia = state.myRole === 'mafia' && me?.alive;
  const showJoin =
    state.phase === 'registration' &&
    me &&
    !state.isInGame &&
    state.registeredCount < state.maxPlayers;

  const emit = (event: string, data?: unknown) =>
    new Promise<{ error?: string } | undefined>((resolve) => {
      socket?.emit(event, data, resolve);
    });

  const loadMoreChat = async () => {
    setLoadingMoreChat(true);
    try {
      await emit('room:loadMoreChat');
    } finally {
      setLoadingMoreChat(false);
    }
  };

  return (
    <div className="room">
      <header className="room-header">
        <div className="room-header-main">
          <h1>{state.name}</h1>
          <div className="room-header-meta">
            <span className="phase-badge">{PHASE_LABELS[state.phase]}</span>
            {timerLeft > 0 && <span className="timer">⏱ {timerLeft} сек</span>}
            {state.phase === 'registration' && (
              <span className="registration-count">
                {state.registeredCount}/{state.maxPlayers} в игре
              </span>
            )}
          </div>
        </div>
        <button type="button" className="btn btn-ghost btn-leave" onClick={onLeave}>
          ← Выйти
        </button>
      </header>

      {showJoin && (
        <div className="join-game-banner">
          <p>Идёт регистрация — нажмите, чтобы участвовать в партии.</p>
          <button
            type="button"
            className="btn btn-primary btn-lg btn-block"
            disabled={joinCooldown > 0 || !state.canJoinGame}
            onClick={async () => {
              const res = await emit('room:joinGame');
              if (res?.error) alert(res.error);
            }}
          >
            {joinCooldown > 0
              ? `Подождите ${joinCooldown} сек.`
              : `Присоединиться (${state.registeredCount}/${state.maxPlayers})`}
          </button>
        </div>
      )}

      {state.canLeaveGame && (
        <div className="join-game-banner leave-game-banner">
          <p>Вы зарегистрированы ({state.registeredCount}/{state.maxPlayers}). Ожидайте других или таймера.</p>
          <button type="button" className="btn btn-ghost btn-block" onClick={() => emit('room:leaveGame')}>
            Выйти из игры
          </button>
        </div>
      )}

      {state.isSpectator && !showJoin && (
        <div className="spectator-banner">
          👁 Вы наблюдаете. Видите чат игры; ваши сообщения видят только наблюдатели.
        </div>
      )}

      {state.myRole && !state.isSpectator && (
        <div className="my-role-card">
          <strong>Ваша роль:</strong> {state.myRoleLabel}
          {state.isDon && ' (главный маф)'}
        </div>
      )}

      <div className="room-layout room-layout-chat">
        <main className="main-area main-area-full">
          {isMafia && state.phase === 'night' && (
            <div className="mafia-tabs">
              <button type="button" className={!mafiaTab ? 'active' : ''} onClick={() => setMafiaTab(false)}>
                Игра
              </button>
              <button type="button" className={mafiaTab ? 'active' : ''} onClick={() => setMafiaTab(true)}>
                Чат мафии
              </button>
            </div>
          )}

          {!mafiaTab ? (
            <>
              <div className="chat-header-bar">
                <span className="chat-header-title">
                  {state.chatMode === 'spectator'
                    ? '👁 Игра + наблюдатели'
                    : state.chatMode === 'dead'
                      ? '💀 Чат выбывших'
                      : '💬 Чат'}
                </span>
                {state.chatMode === 'spectator' && (
                  <span className="chat-header-hint muted">👁 — только для зрителей</span>
                )}
                {state.chatMode === 'dead' && (
                  <span className="chat-header-hint muted">Живые вас не видят</span>
                )}
              </div>
              <Chat
                messages={state.chat}
                canSend={state.canChat}
                onSend={(text) => {
                  void emit('chat:send', { text });
                }}
                onViewProfile={setProfileUserId}
                canModerate={state.canModerate}
                hasMoreChat={state.hasMoreChat}
                onLoadMore={loadMoreChat}
                loadingMore={loadingMoreChat}
                onDeleteMessage={
                  state.canModerate
                    ? (messageId, sourceChannel) =>
                        emit('admin:deleteMessage', {
                          messageId,
                          channel:
                            sourceChannel === 'spectator'
                              ? 'spectator'
                              : state.chatMode === 'dead'
                                ? 'dead'
                                : 'public',
                        })
                    : null
                }
                placeholder={
                  state.chatMode === 'spectator'
                    ? 'Для наблюдателей...'
                    : state.chatMode === 'dead'
                      ? 'Для выбывших...'
                      : 'Сообщение...'
                }
              />
              {!state.isSpectator && <ActionPanel state={state} emit={emit} />}
            </>
          ) : (
            <Chat
              messages={state.mafiaChat}
              canSend={state.phase === 'night'}
              onSend={(text) => {
                void emit('chat:mafia', { text });
              }}
              onViewProfile={setProfileUserId}
              canModerate={state.canModerate}
              hasMoreChat={false}
              onDeleteMessage={
                state.canModerate
                  ? (messageId) => emit('admin:deleteMessage', { messageId, channel: 'mafia' })
                  : null
              }
              placeholder="Сообщение для мафии..."
            />
          )}
        </main>
      </div>

      <footer className="room-footer">
        {state.canStartGame && state.phase === 'waiting' && (
          <button
            type="button"
            className="btn btn-primary btn-lg btn-block"
            onClick={async () => {
              const res = await emit('room:start');
              if (res?.error) alert(res.error);
            }}
          >
            Запустить игру
          </button>
        )}
        {state.phase === 'registration' && me && !state.isInGame && !showJoin && (
          <p className="muted">Все места заняты — дождитесь начала или наблюдайте в чате.</p>
        )}
        {state.phase === 'ended' && (
          <button type="button" className="btn btn-primary btn-lg btn-block" onClick={() => emit('room:newGame')}>
            Новая игра
          </button>
        )}
      </footer>

      {profileUserId && (
        <UserProfileModal
          userId={profileUserId}
          currentUserId={currentUserId}
          viewerIsAdmin={state.isAdmin}
          viewerCanModerate={state.canModerate}
          onClose={() => setProfileUserId(null)}
        />
      )}
    </div>
  );
}
