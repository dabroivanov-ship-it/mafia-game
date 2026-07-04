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
          <h1>Правила игры</h1>
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
          <h1>Игровые роли</h1>
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
          <h1>Правила чата</h1>
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
          <p className="muted">Рейтинг игроков по MMR и репутации · по 15 на странице</p>
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
        <h1>Информация</h1>
        <p className="muted">Правила, роли, чат, рейтинг и команда проекта</p>
      </header>

      <div className="info-hub">
        {(
          [
            { n: '01', section: 'roles' as const, title: 'Игровые роли', desc: 'Мафия, город, маньяк — все способности' },
            { n: '02', section: 'rules' as const, title: 'Правила игры', desc: 'Как начать, фазы, победа и очки' },
            { n: '03', section: 'faq' as const, title: 'Частые вопросы', desc: 'Как начать, роли и ведущий' },
            { n: '04', section: 'chatRules' as const, title: 'Правила чата', desc: 'Общение, профили и модерация' },
            { n: '05', section: 'rating' as const, title: 'Рейтинг игроков', desc: 'Топ по очкам, играм и репутации' },
            { n: '06', section: 'quizLeaders' as const, title: 'Самые умные', desc: 'Топ-10 викторины по верным ответам' },
            ...(!publicMode
              ? [{ n: '07', section: 'team' as const, title: 'Команда', desc: 'Администраторы и модераторы' }]
              : []),
          ] as const
        ).map((item) => (
          <button
            key={item.section}
            type="button"
            className="info-hub-card"
            onClick={() => navigate(item.section)}
          >
            <span className="info-hub-index" aria-hidden="true">
              {item.n}
            </span>
            <span className="info-hub-body">
              <strong>{item.title}</strong>
              <span className="muted">{item.desc}</span>
            </span>
            <span className="info-hub-arrow" aria-hidden="true">
              →
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export type { InfoSection };
