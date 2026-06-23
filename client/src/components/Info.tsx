import { useEffect, useState } from 'react';
import Rules from './Rules';
import Roles from './Roles';
import ChatRules from './ChatRules';
import Staff from './Staff';
import PlayerRating from './PlayerRating';
import Faq from './Faq';
import QuizLeaders from './QuizLeaders';
import {
  type InfoSection,
  infoSectionFromPath,
  pathForInfoSection,
} from '../infoRouting';
import { INFO_PAGE_META, updatePageMeta } from '../seo';
import { ROLES_INTRO } from '../content/rolesContent';

import type { User } from '../types';

interface InfoProps {
  initialSection?: InfoSection;
  publicMode?: boolean;
  currentUser?: User | null;
  onWriteMessage?: (userId: number, username: string) => void;
  onOpenStatistics?: (userId: number) => void;
}

export default function Info({
  initialSection,
  publicMode = false,
  currentUser = null,
  onWriteMessage,
  onOpenStatistics,
}: InfoProps) {
  const [section, setSection] = useState<InfoSection>(
    initialSection ?? infoSectionFromPath(window.location.pathname)
  );

  useEffect(() => {
    if (initialSection) setSection(initialSection);
  }, [initialSection]);

  useEffect(() => {
    const meta = INFO_PAGE_META[section] ?? INFO_PAGE_META.hub;
    updatePageMeta(meta);
  }, [section]);

  useEffect(() => {
    const onPopState = () => setSection(infoSectionFromPath(window.location.pathname));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = (next: InfoSection) => {
    const path = pathForInfoSection(next);
    if (window.location.pathname !== path) {
      window.history.pushState(null, '', path);
    }
    setSection(next);
  };

  const backNav = (target: InfoSection, label: string) => (
    <nav className="info-back">
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate(target)}>
        ← {label}
      </button>
    </nav>
  );

  if (section === 'rules') {
    return (
      <div className="info-page">
        {backNav('hub', 'Информация')}
        <header className="page-header">
          <h1>📜 Правила игры</h1>
          <p className="muted">Как играть, фазы дня и ночи, победа и очки</p>
        </header>
        <Rules embedded />
      </div>
    );
  }

  if (section === 'roles') {
    return (
      <div className="info-page">
        {backNav('hub', 'Информация')}
        <header className="page-header">
          <h1>🎭 Игровые роли</h1>
          <p className="roles-intro muted">{ROLES_INTRO}</p>
        </header>
        <Roles embedded />
      </div>
    );
  }

  if (section === 'chatRules') {
    return (
      <div className="info-page">
        {backNav('hub', 'Информация')}
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
        {backNav('hub', 'Информация')}
        <Staff embedded />
      </div>
    );
  }

  if (section === 'rating') {
    return (
      <div className="info-page">
        {backNav('hub', 'Информация')}
        <header className="page-header">
          <h1>🏆 Рейтинг игроков</h1>
          <p className="muted">Топ-100 по очкам за сыгранные партии</p>
        </header>
        <PlayerRating
          embedded
          currentUser={currentUser}
          onWriteMessage={onWriteMessage}
          onOpenStatistics={onOpenStatistics}
        />
      </div>
    );
  }

  if (section === 'quizLeaders') {
    return (
      <div className="info-page">
        {backNav('hub', 'Информация')}
        <header className="page-header">
          <h1>🧠 Самые умные</h1>
          <p className="muted">Топ-10 по верным ответам в викторине</p>
        </header>
        <QuizLeaders
          embedded
          currentUser={currentUser}
          onWriteMessage={onWriteMessage}
          onOpenStatistics={onOpenStatistics}
        />
      </div>
    );
  }

  if (section === 'faq') {
    return (
      <div className="info-page">
        {backNav('hub', 'Информация')}
        <Faq />
      </div>
    );
  }

  return (
    <div className="info-page">
      {publicMode && (
        <div className="public-info-banner">
          <p>
            Бесплатная онлайн-игра «Мафия» — регистрация, комнаты, чат и роли.{' '}
            <a href="/">Войти и играть →</a>
          </p>
        </div>
      )}

      <header className="page-header">
        <h1>ℹ️ Информация</h1>
        <p className="muted">Правила, роли, чат, рейтинг и команда проекта</p>
      </header>

      <div className="info-hub">
        <button type="button" className="info-hub-card" onClick={() => navigate('roles')}>
          <span className="info-hub-icon" aria-hidden="true">
            🎭
          </span>
          <span className="info-hub-body">
            <strong>Игровые роли</strong>
            <span className="muted">Мафия, город, маньяк — все способности</span>
          </span>
          <span className="info-hub-arrow" aria-hidden="true">
            →
          </span>
        </button>

        <button type="button" className="info-hub-card" onClick={() => navigate('rules')}>
          <span className="info-hub-icon" aria-hidden="true">
            📜
          </span>
          <span className="info-hub-body">
            <strong>Правила игры</strong>
            <span className="muted">Как начать, фазы, победа и очки</span>
          </span>
          <span className="info-hub-arrow" aria-hidden="true">
            →
          </span>
        </button>

        <button type="button" className="info-hub-card" onClick={() => navigate('faq')}>
          <span className="info-hub-icon" aria-hidden="true">
            ❓
          </span>
          <span className="info-hub-body">
            <strong>Частые вопросы</strong>
            <span className="muted">Как начать, роли и ведущий</span>
          </span>
          <span className="info-hub-arrow" aria-hidden="true">
            →
          </span>
        </button>

        <button type="button" className="info-hub-card" onClick={() => navigate('chatRules')}>
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

        <button type="button" className="info-hub-card" onClick={() => navigate('rating')}>
          <span className="info-hub-icon" aria-hidden="true">
            🏆
          </span>
          <span className="info-hub-body">
            <strong>Рейтинг игроков</strong>
            <span className="muted">Топ по очкам, играм и репутации</span>
          </span>
          <span className="info-hub-arrow" aria-hidden="true">
            →
          </span>
        </button>

        <button type="button" className="info-hub-card" onClick={() => navigate('quizLeaders')}>
          <span className="info-hub-icon" aria-hidden="true">
            🧠
          </span>
          <span className="info-hub-body">
            <strong>Самые умные</strong>
            <span className="muted">Топ-10 викторины по верным ответам</span>
          </span>
          <span className="info-hub-arrow" aria-hidden="true">
            →
          </span>
        </button>

        {!publicMode && (
          <button type="button" className="info-hub-card" onClick={() => navigate('team')}>
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
        )}
      </div>
    </div>
  );
}

export type { InfoSection };
