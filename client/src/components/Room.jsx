import { useEffect, useState } from 'react';
import Chat from './Chat.jsx';
import PlayersList from './PlayersList.jsx';
import ActionPanel from './ActionPanel.jsx';

const PHASE_LABELS = {
  waiting: 'Ожидание',
  registration: 'Регистрация',
  day: 'День',
  voting: 'Голосование',
  night: 'Ночь',
  ended: 'Игра окончена',
};

function useTimer(timerEnd) {
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

export default function Room({ socket, state, user, onLeave }) {
  const [mafiaTab, setMafiaTab] = useState(false);

  if (!state) {
    return (
      <div className="room loading">
        <p>Подключение к комнате...</p>
      </div>
    );
  }

  const timerLeft = useTimer(state.timerEnd);
  const me = state.players.find((p) => p.id === state.myId);
  const isMafia = state.myRole === 'mafia' && me?.alive;

  const emit = (event, data) =>
    new Promise((resolve) => {
      socket.emit(event, data, resolve);
    });

  return (
    <div className="room">
      <header className="room-header">
        <div>
          <h1>{state.name}</h1>
          <span className="phase-badge">{PHASE_LABELS[state.phase]}</span>
          {timerLeft > 0 && (
            <span className="timer">⏱ {timerLeft} сек</span>
          )}
        </div>
        <button className="btn btn-ghost" onClick={onLeave}>
          Выйти
        </button>
      </header>

      {state.myRole && (
        <div className="my-role-card">
          <strong>Ваша роль:</strong> {state.myRoleLabel}
          {state.isDon && ' (главный маф)'}
          {me && <span className="my-score">Очки: {me.score}</span>}
        </div>
      )}

      <div className="room-layout">
        <aside className="sidebar">
          <PlayersList players={state.players} myId={state.myId} />
        </aside>

        <main className="main-area">
          {isMafia && state.phase === 'night' && (
            <div className="mafia-tabs">
              <button
                className={!mafiaTab ? 'active' : ''}
                onClick={() => setMafiaTab(false)}
              >
                Игра
              </button>
              <button
                className={mafiaTab ? 'active' : ''}
                onClick={() => setMafiaTab(true)}
              >
                Чат мафии
              </button>
            </div>
          )}

          {!mafiaTab ? (
            <>
              <div className="chat-header-bar">
                <span className="chat-header-title">
                  {state.chatMode === 'dead' ? '💀 Чат выбывших' : '💬 Чат'}
                </span>
                {state.chatMode === 'dead' && (
                  <span className="chat-header-hint muted">Живые игроки вас не видят</span>
                )}
              </div>
              <Chat
                messages={state.chat}
                canSend={state.canChat}
                onSend={(text) => emit('chat:send', { text })}
                isAdmin={state.isAdmin}
                onDeleteMessage={
                  state.isAdmin
                    ? (messageId) =>
                        emit('admin:deleteMessage', {
                          messageId,
                          channel: state.chatMode === 'dead' ? 'dead' : 'public',
                        })
                    : null
                }
                placeholder={
                  state.chatMode === 'dead'
                    ? 'Сообщение для выбывших...'
                    : 'Сообщение...'
                }
              />
              <ActionPanel state={state} emit={emit} />
            </>
          ) : (
            <Chat
              messages={state.mafiaChat}
              canSend={state.phase === 'night'}
              onSend={(text) => emit('chat:mafia', { text })}
              isAdmin={state.isAdmin}
              onDeleteMessage={
                state.isAdmin
                  ? (messageId) => emit('admin:deleteMessage', { messageId, channel: 'mafia' })
                  : null
              }
              placeholder="Сообщение для мафии..."
            />
          )}
        </main>
      </div>

      <footer className="room-footer">
        {state.canStartGame && state.phase !== 'registration' && (
          <button className="btn btn-primary btn-lg" onClick={() => emit('room:start')}>
            Запустить игру
          </button>
        )}
        {state.phase === 'registration' && (
          <p className="muted">Регистрация... Дождитесь других игроков или таймера.</p>
        )}
        {state.phase === 'ended' && (
          <button className="btn btn-primary btn-lg" onClick={() => emit('room:newGame')}>
            Новая игра
          </button>
        )}
      </footer>
    </div>
  );
}
