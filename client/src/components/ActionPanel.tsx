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
  const [voteTargetId, setVoteTargetId] = useState<number | null>(null);
  const [voteSubmitting, setVoteSubmitting] = useState(false);

  const me = state.myPlayer;
  const meInList = state.players.find((p) => p.id === state.myId);
  const hasVoted = me?.hasVoted ?? meInList?.hasVoted;

  useEffect(() => {
    if (state.phase !== 'voting') {
      setVoteTargetId(null);
      setVoteSubmitting(false);
    }
  }, [state.phase]);

  useEffect(() => {
    if (state.phase === 'voting' && !hasVoted) {
      setVoteTargetId(null);
      setVoteSubmitting(false);
    }
  }, [state.phase, hasVoted]);

  const alive = me?.alive ?? meInList?.alive;
  if (!state.isInGame || !alive || !state.myRole) return null;

  const aliveOthers = state.players.filter((p) => p.alive && p.id !== state.myId);
  const allAlive = state.players.filter((p) => p.alive);

  if (state.phase !== 'night' && state.phase !== 'day' && state.phase !== 'voting') {
    return null;
  }

  const targetBtn = (player: RoomPlayer, onClick: (id: number) => void, selected = false) => (
    <button
      key={player.id}
      type="button"
      className={`btn btn-target ${selected ? 'selected' : ''}`}
      onClick={() => onClick(player.id)}
    >
      {player.username || player.name}
    </button>
  );

  if (state.phase === 'day') {
    return (
      <div className="action-panel">
        <h3>Дневные действия</h3>
        <button type="button" className="btn btn-action btn-lg" onClick={() => emit('game:startVoting')}>
          Начать голосование
        </button>
      </div>
    );
  }

  if (state.phase === 'voting') {
    if (hasVoted) {
      const waitingOthers = state.players.some(
        (p) => p.alive && p.inGame && p.id !== state.myId && !p.hasVoted
      );
      return (
        <div className="action-panel">
          <p className="muted">Вы подтвердили казнь ✓</p>
          {waitingOthers && (
            <p className="muted" style={{ marginTop: 8 }}>
              Ожидание остальных игроков...
            </p>
          )}
        </div>
      );
    }

    const voteTarget = voteTargetId != null ? aliveOthers.find((p) => p.id === voteTargetId) : null;

    if (voteTarget) {
      const targetName = voteTarget.username || voteTarget.name;
      return (
        <div className="action-panel">
          <h3>🗳️ Подтверждение</h3>
          <p style={{ marginBottom: 16 }}>
            Вы уверены, что хотите казнить <strong>{targetName}</strong>?
          </p>
          <div className="action-row">
            <button
              type="button"
              className="btn btn-action danger"
              disabled={voteSubmitting}
              onClick={() => {
                setVoteSubmitting(true);
                void emit('game:vote', { targetId: voteTarget.id, confirmed: true })
                  .then((res) => {
                    if (res?.error) {
                      setVoteSubmitting(false);
                      return;
                    }
                    setVoteTargetId(null);
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
              onClick={() => setVoteTargetId(null)}
            >
              Нет — выбрать другого
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="action-panel">
        <h3>🗳️ Этап отбора — кого казнить?</h3>
        <p className="muted" style={{ marginBottom: 12, fontSize: '0.9rem' }}>
          Выберите игрока, затем подтвердите или откажитесь и выберите заново.
        </p>
        <div className="target-grid">
          {aliveOthers.map((p) => targetBtn(p, (id) => setVoteTargetId(id)))}
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
      return (
        <div className="action-panel">
          <h3>🔫 Выберите жертву {state.isDon ? '(вы главный маф)' : ''}</h3>
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
