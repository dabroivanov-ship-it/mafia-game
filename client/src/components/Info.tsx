import { useState } from 'react';
import Rules from './Rules';
import ChatRules from './ChatRules';
import Staff from './Staff';

type InfoSection = 'hub' | 'rules' | 'chatRules' | 'team';

export default function Info() {
  const [section, setSection] = useState<InfoSection>('hub');

  if (section === 'rules') {
    return (
      <div className="info-page">
        <nav className="info-back">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSection('hub')}>
            ← Информация
          </button>
        </nav>
        <header className="page-header">
          <h1>📜 Правила игры</h1>
          <p className="muted">Как играть, роли и фазы</p>
        </header>
        <Rules embedded />
      </div>
    );
  }

  if (section === 'chatRules') {
    return (
      <div className="info-page">
        <nav className="info-back">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSection('hub')}>
            ← Информация
          </button>
        </nav>
        <header className="page-header">
          <h1>💬 Правила чата</h1>
          <p className="muted">Общение в комнатах и во время игры</p>
        </header>
        <ChatRules embedded />
      </div>
    );
  }

  if (section === 'team') {
    return (
      <div className="info-page">
        <nav className="info-back">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSection('hub')}>
            ← Информация
          </button>
        </nav>
        <Staff embedded />
      </div>
    );
  }

  return (
    <div className="info-page">
      <header className="page-header">
        <h1>ℹ️ Информация</h1>
        <p className="muted">Правила игры, чата, команда проекта и полезные сведения</p>
      </header>

      <div className="info-hub">
        <button type="button" className="info-hub-card" onClick={() => setSection('rules')}>
          <span className="info-hub-icon" aria-hidden="true">
            📜
          </span>
          <span className="info-hub-body">
            <strong>Правила игры</strong>
            <span className="muted">Как играть, роли, день и ночь</span>
          </span>
          <span className="info-hub-arrow" aria-hidden="true">
            →
          </span>
        </button>

        <button type="button" className="info-hub-card" onClick={() => setSection('chatRules')}>
          <span className="info-hub-icon" aria-hidden="true">
            💬
          </span>
          <span className="info-hub-body">
            <strong>Правила чата</strong>
            <span className="muted">Общение, профили и модерация</span>
          </span>
          <span className="info-hub-arrow" aria-hidden="true">
            →
          </span>
        </button>

        <button type="button" className="info-hub-card" onClick={() => setSection('team')}>
          <span className="info-hub-icon" aria-hidden="true">
            🛡️
          </span>
          <span className="info-hub-body">
            <strong>Команда</strong>
            <span className="muted">Администраторы и модераторы</span>
          </span>
          <span className="info-hub-arrow" aria-hidden="true">
            →
          </span>
        </button>
      </div>
    </div>
  );
}
