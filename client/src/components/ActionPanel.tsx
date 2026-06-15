import { useState } from 'react';
import type { RoomPlayer, RoomState } from '../types';

interface ActionPanelProps {
  state: RoomState;
  emit: (event: string, data?: unknown) => Promise<{ error?: string } | undefined>;
}

export default function ActionPanel({ state, emit }: ActionPanelProps) {
  const [clownStep, setClownStep] = useState<'first' | 'second' | null>(null);
  const [clownFirst, setClownFirst] = useState<number | null>(null);
  const [commissarMode, setCommissarMode] = useState<'check' | 'kill' | null>(null);

  const me = state.myPlayer;
  const meInList = state.players.find((p) => p.id === state.myId);
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
      {player.name}
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
    const hasVoted = me?.hasVoted ?? meInList?.hasVoted;
    if (hasVoted) {
      return (
        <div className="action-panel">
          <p className="muted">Вы проголосовали ✓</p>
        </div>
      );
    }
    return (
      <div className="action-panel">
        <h3>🗳️ Голосование — выберите игрока</h3>
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
