import { useEffect, useState } from 'react';
import type { RoomPlayer, RoomState } from '../types';

interface ActionPanelProps {
  state: RoomState;
  emit: (event: string, data?: unknown) => Promise<{ error?: string } | undefined>;
}

export default function ActionPanel({ state, emit }: ActionPanelProps) {
  const [clownStep, setClownStep] = useState<'first' | 'second' | null>(null);
  const [clownFirst, setClownFirst] = useState<number | null>(null);
  const [commissarMode, setCommissarMode] = useState<'check' | 'kill' | null>(null);
  const [voteSubmitting, setVoteSubmitting] = useState(false);

  const me = state.myPlayer;
  const meInList = state.players.find((p) => p.id === state.myId);
  const hasVoted = me?.hasVoted ?? meInList?.hasVoted;

  useEffect(() => {
    if (state.phase !== 'voting') {
      setVoteSubmitting(false);
    }
  }, [state.phase]);

  useEffect(() => {
    setVoteSubmitting(false);
  }, [state.votingStage, state.accusedId]);

  const alive = me?.alive ?? meInList?.alive;
  if (!state.isInGame || !alive || !state.myRole) return null;

  const aliveOthers = state.players.filter((p) => p.alive && p.id !== state.myId);
  const allAlive = state.players.filter((p) => p.alive);

  if (state.phase !== 'night' && state.phase !== 'day' && state.phase !== 'voting') {
    return null;
  }

  const targetBtn = (
    player: RoomPlayer,
    onClick: (id: number) => void,
    selected = false,
    opts?: { disabled?: boolean; hint?: string }
  ) => (
    <button
      key={player.id}
      type="button"
      className={`btn btn-target ${selected ? 'selected' : ''}${opts?.disabled ? ' disabled-target' : ''}`}
      disabled={opts?.disabled}
      onClick={() => onClick(player.id)}
    >
      {player.username || player.name}
      {opts?.hint ? <span className="target-hint"> {opts.hint}</span> : null}
    </button>
  );

  if (state.phase === 'day') {
    return null;
  }

  if (state.phase === 'voting') {
    const votingStage = state.votingStage ?? 'nominate';
    const hasNominated = hasVoted;
    const hasHangVoted = state.hasHangVoted ?? me?.hasHangVoted ?? false;
    const accusedName = state.accusedName;

    if (votingStage === 'confirm') {
      if (hasHangVoted) {
        return (
          <div className="action-panel">
            <p className="muted">Вы проголосовали ✓</p>
            <p className="muted" style={{ marginTop: 8 }}>
              Ожидание остальных: казнить {accusedName || 'кандидата'}?
            </p>
          </div>
        );
      }
      return (
        <div className="action-panel">
          <h3>🗳️ Казнить {accusedName || 'кандидата'}?</h3>
          <p className="muted" style={{ marginBottom: 16 }}>
            Половина выдвинула этого игрока. «Да» — казнить, «Нет» — оправдать. Если больше половины
            нажмут «нет», кандидат оправдан и можно выдвинуть другого.
          </p>
          <div className="action-row">
            <button
              type="button"
              className="btn btn-action danger"
              disabled={voteSubmitting}
              onClick={() => {
                setVoteSubmitting(true);
                void emit('game:hangVote', { yes: true })
                  .then((res) => {
                    if (res?.error) setVoteSubmitting(false);
                  })
                  .catch(() => setVoteSubmitting(false));
              }}
            >
              Да — казнить
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={voteSubmitting}
              onClick={() => {
                setVoteSubmitting(true);
                void emit('game:hangVote', { yes: false })
                  .then((res) => {
                    if (res?.error) setVoteSubmitting(false);
                  })
                  .catch(() => setVoteSubmitting(false));
              }}
            >
              Нет — пощадить
            </button>
          </div>
        </div>
      );
    }

    if (hasNominated) {
      const waitingOthers = state.players.some(
        (p) => p.alive && p.inGame && p.id !== state.myId && !p.hasVoted
      );
      return (
        <div className="action-panel">
          <p className="muted">Вы выдвинули кандидата ✓</p>
          {waitingOthers && (
            <p className="muted" style={{ marginTop: 8 }}>
              Ждём остальных. Кнопки «да» / «нет» появятся, когда одного выберут не меньше половины.
            </p>
          )}
        </div>
      );
    }

    return (
      <div className="action-panel">
        <h3>🗳️ Выдвиньте кандидата</h3>
        <p className="muted" style={{ marginBottom: 12, fontSize: '0.9rem' }}>
          Выберите, кого выдвинуть на казнь. «Да» или «нет» появятся, когда одного игрока выберут не
          меньше половины.
        </p>
        <div className="target-grid">
          {aliveOthers.map((p) =>
            targetBtn(p, (id) => {
              void emit('game:vote', { targetId: id });
            })
          )}
        </div>
      </div>
    );
  }

  if (state.phase === 'night') {
    if (state.nightActionDone) {
      return (
        <div className="action-panel">
          <p className="muted">Действие отправлено. Ожидайте других...</p>
        </div>
      );
    }

    const role = state.myRole;

    if (role === 'prostitute') {
      return (
        <div className="action-panel">
          <h3>💋 Выберите клиента (соблазнить)</h3>
          <div className="target-grid">
            {aliveOthers.map((p) =>
              targetBtn(p, (id) => {
                void emit('game:nightAction', { type: 'seduce', targetId: id });
              })
            )}
          </div>
        </div>
      );
    }

    if (role === 'mafia') {
      if (!state.isDon) {
        return (
          <div className="action-panel">
            <h3>🎩 Мафия</h3>
            <p className="muted" style={{ marginBottom: 12 }}>
              Жертву выбирает главарь. Если он погибнет — главой станете вы.
            </p>
            {state.mafiaTeam && state.mafiaTeam.length > 0 && (
              <p className="muted">
                Союзники:{' '}
                {state.mafiaTeam
                  .map((m) => `${m.username}${m.isDon ? ' (главарь)' : ''}`)
                  .join(', ')}
              </p>
            )}
          </div>
        );
      }

      const mafiaAllyIds = new Set(
        state.players.filter((p) => p.isMafiaAlly).map((p) => p.id)
      );

      return (
        <div className="action-panel">
          <h3>🔫 Выберите жертву (вы главарь мафии)</h3>
          {state.mafiaTeam && state.mafiaTeam.length > 1 && (
            <p className="muted" style={{ marginBottom: 12, fontSize: '0.9rem' }}>
              Союзники:{' '}
              {state.mafiaTeam
                .filter((m) => m.id !== state.myId)
                .map((m) => m.username)
                .join(', ')}
            </p>
          )}
          <div className="target-grid">
            {aliveOthers.map((p) =>
              targetBtn(
                p,
                (id) => {
                  void emit('game:nightAction', { type: 'kill', targetId: id });
                },
                false,
                mafiaAllyIds.has(p.id) ? { disabled: true, hint: '· союзник' } : undefined
              )
            )}
          </div>
        </div>
      );
    }

    if (role === 'commissar') {
      if (!commissarMode) {
        return (
          <div className="action-panel">
            <h3>🕵️ Инспектор Катани</h3>
            <div className="action-row">
              <button type="button" className="btn btn-action" onClick={() => setCommissarMode('check')}>
                Проверить
              </button>
              <button type="button" className="btn btn-action danger" onClick={() => setCommissarMode('kill')}>
                Убить
              </button>
            </div>
          </div>
        );
      }
      return (
        <div className="action-panel">
          <h3>{commissarMode === 'check' ? '🔍 Кого проверить?' : '🔫 Кого убить?'}</h3>
          <div className="target-grid">
            {aliveOthers.map((p) =>
              targetBtn(p, (id) => {
                void emit('game:nightAction', { type: commissarMode, targetId: id });
              })
            )}
          </div>
          <button type="button" className="btn btn-ghost" onClick={() => setCommissarMode(null)}>
            Назад
          </button>
        </div>
      );
    }

    if (role === 'maniac') {
      return (
        <div className="action-panel">
          <h3>🪓 Маньяк — выберите жертву</h3>
          <div className="target-grid">
            {aliveOthers.map((p) =>
              targetBtn(p, (id) => {
                void emit('game:nightAction', { type: 'kill', targetId: id });
              })
            )}
          </div>
        </div>
      );
    }

    if (role === 'doctor') {
      return (
        <div className="action-panel">
          <h3>💊 Кого лечить?</h3>
          <div className="target-grid">
            {allAlive.map((p) =>
              targetBtn(p, (id) => {
                void emit('game:nightAction', { type: 'heal', targetId: id });
              })
            )}
          </div>
        </div>
      );
    }

    if (role === 'advocate') {
      return (
        <div className="action-panel">
          <h3>⚖️ Кого укрыть от проверки Катани?</h3>
          <p className="muted" style={{ marginBottom: 12, fontSize: '0.9rem' }}>
            Нельзя защитить себя. Приоритет — дон и активные мафиози.
          </p>
          <div className="target-grid">
            {aliveOthers.map((p) =>
              targetBtn(p, (id) => {
                void emit('game:nightAction', { type: 'cover', targetId: id });
              })
            )}
          </div>
        </div>
      );
    }

    if (role === 'homeless') {
      return (
        <div className="action-panel">
          <h3>👁️ Кого проверить?</h3>
          <div className="target-grid">
            {aliveOthers.map((p) =>
              targetBtn(p, (id) => {
                void emit('game:nightAction', { type: 'check', targetId: id });
              })
            )}
          </div>
        </div>
      );
    }

    if (role === 'clown' && state.clownAvailable) {
      if (!clownStep) {
        return (
          <div className="action-panel">
            <h3>🎭 Сменить роли (1 раз за игру)</h3>
            <button type="button" className="btn btn-action btn-lg" onClick={() => setClownStep('first')}>
              Сменить роли
            </button>
          </div>
        );
      }
      if (clownStep === 'first') {
        return (
          <div className="action-panel">
            <h3>Выберите первого игрока</h3>
            <div className="target-grid">
              {allAlive.map((p) =>
                targetBtn(p, (id) => {
                  setClownFirst(id);
                  setClownStep('second');
                })
              )}
            </div>
          </div>
        );
      }
      return (
        <div className="action-panel">
          <h3>Выберите второго игрока</h3>
          <div className="target-grid">
            {allAlive
              .filter((p) => p.id !== clownFirst)
              .map((p) =>
                targetBtn(p, (id) => {
                  void emit('game:nightAction', {
                    type: 'swap',
                    targetId: clownFirst,
                    targetId2: id,
                  });
                })
              )}
          </div>
        </div>
      );
    }

    if (role === 'commissar_wife' && state.wifeRevengeAvailable) {
      return (
        <div className="action-panel">
          <h3>⚔️ Мстить — выберите жертву</h3>
          <div className="target-grid">
            {aliveOthers.map((p) =>
              targetBtn(p, (id) => {
                void emit('game:nightAction', { type: 'revenge', targetId: id });
              })
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="action-panel">
        <p className="muted">🌙 Ночь. Вы спите...</p>
      </div>
    );
  }

  return null;
}
