import { useEffect, useState } from 'react';
import { Socket } from 'socket.io-client';
import Chat from './Chat';
import ActionPanel from './ActionPanel';
import UserProfileModal from './UserProfileModal';
import type { GamePhase, RoomState, ChatReplyTarget, ChatChannel, ViolationType } from '../types';

const PHASE_LABELS: Record<GamePhase, string> = {
  waiting: 'Ожидание',
  registration: 'Регистрация',
  roles: 'Раздача ролей',
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
  onOpenMembers?: () => void;
  onStateUpdate?: (state: RoomState) => void;
  currentUserId: number;
  onWriteMessage?: (userId: number, username: string) => void;
  onOpenStatistics?: (userId: number) => void;
}

export default function Room({
  socket,
  state,
  onLeave,
  onOpenMembers,
  onStateUpdate,
  currentUserId,
  onWriteMessage,
  onOpenStatistics,
}: RoomProps) {
  const [mafiaTab, setMafiaTab] = useState(false);
  const [profileTarget, setProfileTarget] = useState<ChatReplyTarget | null>(null);
  const [loadingMoreChat, setLoadingMoreChat] = useState(false);
  const [chatReplyTo, setChatReplyTo] = useState<ChatReplyTarget | null>(null);
  const [chatPrivateMode, setChatPrivateMode] = useState(false);

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
  const isChatRoom = state.kind === 'chat';
  const isMafia = !isChatRoom && (state.myRole === 'mafia' || state.myRole === 'advocate') && me?.alive;
  const showJoin =
    !isChatRoom &&
    state.phase === 'registration' &&
    me &&
    !state.isInGame &&
    state.registeredCount < state.maxPlayers;

  const emit = (event: string, data?: unknown) =>
    new Promise<{ error?: string; state?: RoomState } | undefined>((resolve) => {
      socket?.emit(event, data, resolve);
    });

  const openPlayerPage = (target: ChatReplyTarget) => {
    if (!target.userId || target.userId === currentUserId) return;
    const livePlayer = state.players.find((p) => p.userId === target.userId);
    setProfileTarget({
      userId: target.userId,
      playerName: target.playerName,
      playerId: target.playerId ?? livePlayer?.id,
    });
  };

  const sendRoomChat = async (
    text: string,
    opts?: { toPlayerId?: number; isPrivate?: boolean }
  ) => {
    return emit('chat:send', {
      text,
      toPlayerId: opts?.toPlayerId,
      isPrivate: opts?.isPrivate,
    });
  };

  const resolveDeleteChannel = (
    sourceChannel: ChatChannel | undefined,
    chatMode: RoomState['chatMode']
  ): string => {
    if (sourceChannel === 'private') return 'private';
    if (sourceChannel === 'spectator') return 'spectator';
    if (sourceChannel === 'dead' || chatMode === 'dead') return 'dead';
    if (sourceChannel === 'mafia') return 'mafia';
    return 'public';
  };

  const deleteModeratedMessage = async (
    messageId: string | number,
    sourceChannel: ChatChannel | undefined,
    violationType: ViolationType
  ) => {
    const res = await emit('admin:deleteMessage', {
      messageId,
      channel: resolveDeleteChannel(sourceChannel, state.chatMode),
      violationType,
    });
    if (res?.error) alert(res.error);
  };

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
            {!isChatRoom && (
              <>
                <span className="phase-badge">{PHASE_LABELS[state.phase]}</span>
                {timerLeft > 0 && <span className="timer">⏱ {timerLeft} сек</span>}
                {state.phase === 'registration' && (
                  <span className="registration-count">
                    {state.registeredCount}/{state.maxPlayers} в игре
                  </span>
                )}
                {state.phase === 'roles' && (
                  <span className="registration-count">Ночь начнётся после раздачи ролей</span>
                )}
              </>
            )}
            {isChatRoom && (
              <span className="registration-count">{state.registeredCount} онлайн</span>
            )}
          </div>
        </div>
        <div className="room-header-actions">
          {!isChatRoom && onOpenMembers && (
            <button type="button" className="btn btn-ghost" onClick={onOpenMembers}>
              Кто тут
            </button>
          )}
          <button type="button" className="btn btn-ghost btn-leave" onClick={onLeave}>
            {isChatRoom ? '← Выйти' : '← Назад'}
          </button>
        </div>
      </header>

      {!isChatRoom && state.phase === 'roles' && !state.isSpectator && (
        <div className="join-game-banner roles-banner">
          <p>🎭 Раздача ролей. Ведущий сообщит вашу роль в личных сообщениях [P]. Ожидайте ночи…</p>
        </div>
      )}

      {!isChatRoom && showJoin && (
        <div className="join-game-banner">
          <p>Идёт регистрация — нажмите, чтобы участвовать в партии.</p>
          <button
            type="button"
            className="btn btn-primary btn-lg btn-block"
            disabled={joinCooldown > 0 || !state.canJoinGame}
            onClick={async () => {
              const res = await emit('room:joinGame');
              if (res?.error) alert(res.error);
              else if (res?.state) onStateUpdate?.(res.state);
            }}
          >
            {joinCooldown > 0
              ? `Подождите ${joinCooldown} сек.`
              : `Присоединиться (${state.registeredCount}/${state.maxPlayers})`}
          </button>
        </div>
      )}

      {!isChatRoom && state.isInGame && state.phase === 'registration' && (
        <div className="join-game-banner">
          <p>
            Вы зарегистрированы ({state.registeredCount}/{state.maxPlayers}). Ожидайте других или
            таймера.
          </p>
        </div>
      )}

      {!isChatRoom && state.isSpectator && !showJoin && (
        <div className="spectator-banner">
          👁 Вы наблюдаете. Видите чат игры; ваши сообщения видят только наблюдатели.
        </div>
      )}

      {!isChatRoom && state.myRole && !state.isSpectator && (
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
                {isChatRoom
                  ? '💬 Общий чат'
                  : state.chatMode === 'spectator'
                    ? '👁 Игра + наблюдатели'
                    : state.chatMode === 'dead'
                      ? '💀 Чат выбывших'
                      : '💬 Чат'}
                </span>
                {state.chatMode === 'spectator' && (
                  <span className="chat-header-hint muted">👁 — только для зрителей</span>
                )}
                {state.chatMode === 'dead' && (
                  <span className="chat-header-hint muted">Только выбывшие · живые вас не видят</span>
                )}
                {state.myPlayer?.silenced && (
                  <span className="chat-header-hint muted">🔇 Молчание — ваши сообщения видите только вы</span>
                )}
              </div>
              <Chat
                messages={state.chat}
                canSend={state.canChat}
                myPlayerId={state.myId}
                currentUserId={currentUserId}
                replyTo={chatReplyTo}
                onReplyToChange={setChatReplyTo}
                privateMode={chatPrivateMode}
                onPrivateModeChange={setChatPrivateMode}
                onSend={(text, opts) => {
                  void emit('chat:send', {
                    text,
                    toPlayerId: opts?.toPlayerId,
                    isPrivate: opts?.isPrivate,
                  }).then((res) => {
                    if (res?.error) alert(res.error);
                    else {
                      setChatReplyTo(null);
                      setChatPrivateMode(false);
                    }
                  });
                }}
                onOpenPlayerPage={openPlayerPage}
                canModerate={state.canModerate}
                hasMoreChat={state.hasMoreChat}
                onLoadMore={loadMoreChat}
                loadingMore={loadingMoreChat}
                onDeleteMessage={
                  state.canModerate
                    ? (messageId, sourceChannel, violationType) =>
                        void deleteModeratedMessage(messageId, sourceChannel, violationType)
                    : undefined
                }
                placeholder={
                  isChatRoom
                    ? 'Сообщение...'
                    : state.chatMode === 'spectator'
                      ? 'Для наблюдателей...'
                      : state.chatMode === 'dead'
                        ? 'Для выбывших...'
                        : 'Сообщение...'
                }
              />
              {!isChatRoom && !state.isSpectator && <ActionPanel state={state} emit={emit} />}
            </>
          ) : (
            <Chat
              messages={state.mafiaChat}
              canSend={state.phase === 'night'}
              myPlayerId={state.myId}
              currentUserId={currentUserId}
              onOpenPlayerPage={openPlayerPage}
              onSend={(text) => {
                void emit('chat:mafia', { text });
              }}
              canModerate={state.canModerate}
              hasMoreChat={false}
              onDeleteMessage={
                state.canModerate
                  ? (messageId, _sourceChannel, violationType) =>
                      void deleteModeratedMessage(messageId, 'mafia', violationType)
                  : undefined
              }
              placeholder="Сообщение для мафии..."
            />
          )}
        </main>
      </div>

      {!isChatRoom && (
        <footer className="room-footer">
          {state.canStartGame && state.phase === 'waiting' && (
            <button
              type="button"
              className="btn btn-primary btn-lg btn-block"
              onClick={async () => {
                const res = await emit('room:start');
                if (res?.error) alert(res.error);
                else if (res?.state) onStateUpdate?.(res.state);
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
      )}

      {profileTarget?.userId && (
        <UserProfileModal
          userId={profileTarget.userId}
          currentUserId={currentUserId}
          viewerIsAdmin={state.isAdmin}
          viewerCanModerate={state.canModerate}
          replyTarget={profileTarget}
          canSendChat={state.canChat}
          onSendChat={sendRoomChat}
          onClose={() => setProfileTarget(null)}
          inRoom
          targetPlayerId={profileTarget.playerId}
          targetSilenced={
            state.players.find(
              (p) =>
                p.id === profileTarget.playerId ||
                (profileTarget.userId != null && p.userId === profileTarget.userId)
            )?.silenced ?? false
          }
          onSilence={async ({ userId: targetUserId, playerId, reason, hours }) => {
            const res = await emit('mod:silence', {
              targetUserId,
              targetPlayerId: playerId,
              reason,
              hours,
            });
            if (res?.error) throw new Error(res.error);
          }}
          onUnsilence={async ({ userId: targetUserId, playerId }) => {
            const res = await emit('mod:unsilence', {
              targetUserId,
              targetPlayerId: playerId,
            });
            if (res?.error) throw new Error(res.error);
          }}
          onWriteMessage={onWriteMessage}
          onOpenStatistics={onOpenStatistics}
        />
      )}
    </div>
  );
}
