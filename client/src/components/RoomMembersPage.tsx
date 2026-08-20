import type { RoomPresence, RoomState } from '../types';

const PHASE_LABELS: Record<RoomState['phase'], string> = {
  waiting: 'Ожидание',
  registration: 'Регистрация',
  roles: 'Раздача ролей',
  day: 'День',
  voting: 'Голосование',
  night: 'Ночь',
  ended: 'Игра окончена',
};

interface RoomMembersPageProps {
  state: RoomState;
  onBack: () => void;
  onViewProfile?: (userId: number) => void;
}

function displayName(p: RoomPresence): string {
  return p.username || p.name;
}

function PersonRow({
  person,
  onViewProfile,
  extraStatus,
}: {
  person: RoomPresence;
  onViewProfile?: (userId: number) => void;
  extraStatus?: string;
}) {
  return (
    <li className={`room-member-row${person.isMe ? ' me' : ''}`}>
      <button
        type="button"
        className="player-name-btn"
        onClick={() => person.userId && onViewProfile?.(person.userId)}
        disabled={!person.userId}
        title={person.userId ? 'Открыть профиль' : undefined}
      >
        {displayName(person)}
      </button>
      {person.isMe && <span className="room-member-status muted">вы</span>}
      {extraStatus && <span className="room-member-status muted">{extraStatus}</span>}
    </li>
  );
}

export default function RoomMembersPage({ state, onBack, onViewProfile }: RoomMembersPageProps) {
  const isChatRoom = state.kind === 'chat';
  const connected = state.presence.filter((p) => p.connected);
  const inGame = connected.filter((p) => p.inGame && p.alive);
  const notInGame = connected.filter((p) => !p.inGame || (p.inGame && !p.alive));

  return (
    <div className="room room-members-page">
      <header className="room-header">
        <div className="room-header-main">
          <h1>Кто тут</h1>
          <div className="room-header-meta">
            <span className="phase-badge">{state.name}</span>
            {!isChatRoom && (
              <span className="registration-count">{PHASE_LABELS[state.phase]}</span>
            )}
          </div>
        </div>
        <div className="room-header-actions">
          <button type="button" className="btn btn-ghost btn-leave" onClick={onBack}>
            ← Назад
          </button>
        </div>
      </header>

      <div className="room-members-content">
        {isChatRoom ? (
          <section className="room-members-section">
            <h2>В комнате ({connected.length})</h2>
            {connected.length === 0 ? (
              <p className="muted">Сейчас никого нет в комнате.</p>
            ) : (
              <ul className="room-members-list">
                {connected.map((p) => (
                  <PersonRow key={p.id} person={p} onViewProfile={onViewProfile} />
                ))}
              </ul>
            )}
          </section>
        ) : (
          <>
            <section className="room-members-section">
              <h2>В игре ({inGame.length})</h2>
              {inGame.length === 0 ? (
                <p className="muted">Никто не вступил в игру.</p>
              ) : (
                <ul className="room-members-list">
                  {inGame.map((p) => (
                    <PersonRow key={p.id} person={p} onViewProfile={onViewProfile} />
                  ))}
                </ul>
              )}
            </section>

            <section className="room-members-section">
              <h2>Не в игре ({notInGame.length})</h2>
              {notInGame.length === 0 ? (
                <p className="muted">Наблюдателей и выбывших нет.</p>
              ) : (
                <ul className="room-members-list">
                  {notInGame.map((p) => (
                    <PersonRow
                      key={p.id}
                      person={p}
                      onViewProfile={onViewProfile}
                      extraStatus={p.inGame && !p.alive ? 'выбыл' : undefined}
                    />
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
