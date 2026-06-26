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
  showStatus = true,
}: {
  person: RoomPresence;
  onViewProfile?: (userId: number) => void;
  showStatus?: boolean;
}) {
  const statusParts: string[] = [];
  if (person.isMe) statusParts.push('вы');
  if (person.inGame) {
    if (person.alive) statusParts.push('в игре');
    else statusParts.push('выбыл(а)');
  } else {
    statusParts.push('в комнате');
  }
  if (!person.connected) statusParts.push('не в сети');

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
      {showStatus && <span className="room-member-status muted">{statusParts.join(' · ')}</span>}
      {person.roleLabel && <span className="player-role">{person.roleLabel}</span>}
    </li>
  );
}

export default function RoomMembersPage({ state, onBack, onViewProfile }: RoomMembersPageProps) {
  const connected = state.presence.filter((p) => p.connected);
  const inGame = connected.filter((p) => p.inGame);
  const inGameAlive = inGame.filter((p) => p.alive);
  const inGameDead = inGame.filter((p) => !p.alive);
  const visitors = connected.filter((p) => !p.inGame);

  return (
    <div className="room room-members-page">
      <header className="room-header">
        <div className="room-header-main">
          <h1>Кто тут</h1>
          <div className="room-header-meta">
            <span className="phase-badge">{state.name}</span>
            <span className="registration-count">{PHASE_LABELS[state.phase]}</span>
            <span className="registration-count">{connected.length} в комнате</span>
          </div>
        </div>
        <button type="button" className="btn btn-ghost btn-leave" onClick={onBack}>
          ← К игре
        </button>
      </header>

      <div className="room-members-content">
        {inGame.length > 0 && (
          <section className="room-members-section">
            <h2>Участники партии ({inGame.length})</h2>
            {inGameAlive.length > 0 && (
              <>
                <h3>Живые ({inGameAlive.length})</h3>
                <ul className="room-members-list">
                  {inGameAlive.map((p) => (
                    <PersonRow key={p.id} person={p} onViewProfile={onViewProfile} />
                  ))}
                </ul>
              </>
            )}
            {inGameDead.length > 0 && (
              <>
                <h3>Выбыли ({inGameDead.length})</h3>
                <ul className="room-members-list">
                  {inGameDead.map((p) => (
                    <PersonRow key={p.id} person={p} onViewProfile={onViewProfile} />
                  ))}
                </ul>
              </>
            )}
          </section>
        )}

        {visitors.length > 0 && (
          <section className="room-members-section">
            <h2>В комнате, не в партии ({visitors.length})</h2>
            <ul className="room-members-list">
              {visitors.map((p) => (
                <PersonRow key={p.id} person={p} onViewProfile={onViewProfile} />
              ))}
            </ul>
          </section>
        )}

        {connected.length === 0 && <p className="muted">Сейчас никого нет в комнате.</p>}
      </div>
    </div>
  );
}
