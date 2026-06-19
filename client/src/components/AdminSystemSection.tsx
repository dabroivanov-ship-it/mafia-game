import { FormEvent, ReactNode, useState } from 'react';
import ThemePicker from './ThemePicker';
import AdminBotPhrasesEditor from './AdminBotPhrasesEditor';
import type { ThemeId } from '../types';
import { THEMES } from '../themes';

export type SystemView =
  | 'hub'
  | 'users'
  | 'banlist'
  | 'rooms-game'
  | 'rooms-chat'
  | 'news'
  | 'violations'
  | 'telegram'
  | 'metrika'
  | 'game';

interface AdminSystemSectionProps {
  view?: SystemView;
  onViewChange?: (view: SystemView) => void;
  usersCount: number;
  banListCount?: number;
  gameRoomsCount?: number;
  chatRoomsCount?: number;
  violationsCount: number;
  newsCount?: number;
  defaultTheme: ThemeId;
  themeSaving: boolean;
  onThemeChange: (id: ThemeId) => void;
  telegramForm: { botUsername: string; webAppUrl: string };
  telegramSaving: boolean;
  onTelegramFormChange: (patch: Partial<{ botUsername: string; webAppUrl: string }>) => void;
  onSaveTelegram: (e: FormEvent) => void;
  telegramBotLink: string;
  metrikaId: string;
  metrikaDisabled: boolean;
  metrikaSaving: boolean;
  onMetrikaIdChange: (value: string) => void;
  onMetrikaDisabledChange: (disabled: boolean) => void;
  onSaveMetrika: (e: FormEvent) => void;
  panels: {
    users: ReactNode;
    banlist: ReactNode;
    roomsGame: ReactNode;
    roomsChat: ReactNode;
    news: ReactNode;
    violations: ReactNode;
  };
}

const SYSTEM_CATEGORIES: {
  id: SystemView;
  icon: string;
  title: string;
  links: { view: SystemView; label: string }[];
}[] = [
  {
    id: 'users',
    icon: '👥',
    title: 'Пользователи',
    links: [
      { view: 'users', label: 'Управление аккаунтами' },
      { view: 'banlist', label: 'Бан-лист' },
    ],
  },
  {
    id: 'rooms-game',
    icon: '🎭',
    title: 'Комнаты мафии',
    links: [{ view: 'rooms-game', label: 'Игровые комнаты' }],
  },
  {
    id: 'rooms-chat',
    icon: '💬',
    title: 'Чат-комнаты',
    links: [{ view: 'rooms-chat', label: 'Чат-комнаты' }],
  },
  {
    id: 'news',
    icon: '📰',
    title: 'Новости',
    links: [{ view: 'news', label: 'Публикации и черновики' }],
  },
  {
    id: 'violations',
    icon: '⚠️',
    title: 'Лог нарушений',
    links: [{ view: 'violations', label: 'Журнал модерации' }],
  },
  {
    id: 'telegram',
    icon: '📱',
    title: 'Интеграции',
    links: [{ view: 'telegram', label: 'Telegram-бот' }],
  },
  {
    id: 'metrika',
    icon: '📈',
    title: 'Аналитика',
    links: [{ view: 'metrika', label: 'Яндекс.Метрика' }],
  },
  {
    id: 'game',
    icon: '🎮',
    title: 'Настройки игры',
    links: [
      { view: 'game', label: 'Тема сайта' },
      { view: 'game', label: 'Фразы ведущего' },
    ],
  },
];

const VIEW_TITLES: Record<Exclude<SystemView, 'hub'>, string> = {
  users: 'Пользователи',
  banlist: 'Бан-лист',
  'rooms-game': 'Комнаты мафии',
  'rooms-chat': 'Чат-комнаты',
  news: 'Новости',
  violations: 'Лог нарушений',
  telegram: 'Интеграции',
  metrika: 'Аналитика',
  game: 'Настройки игры',
};

export default function AdminSystemSection({
  view: controlledView,
  onViewChange,
  usersCount,
  banListCount = 0,
  gameRoomsCount = 0,
  chatRoomsCount = 0,
  violationsCount,
  newsCount = 0,
  defaultTheme,
  themeSaving,
  onThemeChange,
  telegramForm,
  telegramSaving,
  onTelegramFormChange,
  onSaveTelegram,
  telegramBotLink,
  metrikaId,
  metrikaDisabled,
  metrikaSaving,
  onMetrikaIdChange,
  onMetrikaDisabledChange,
  onSaveMetrika,
  panels,
}: AdminSystemSectionProps) {
  const [internalView, setInternalView] = useState<SystemView>('hub');
  const view = controlledView ?? internalView;

  const setView = (next: SystemView) => {
    if (onViewChange) onViewChange(next);
    else setInternalView(next);
  };

  const badgeFor = (categoryId: SystemView) => {
    if (categoryId === 'users') return usersCount;
    if (categoryId === 'banlist') return banListCount;
    if (categoryId === 'rooms-game') return gameRoomsCount;
    if (categoryId === 'rooms-chat') return chatRoomsCount;
    if (categoryId === 'news') return newsCount;
    if (categoryId === 'violations') return violationsCount;
    if (categoryId === 'game') return THEMES.length + 1;
    return 1;
  };

  if (view !== 'hub') {
    return (
      <section className="admin-section admin-system-section">
        <div className="admin-system-detail-head">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setView('hub')}>
            ← К разделам
          </button>
          <h3>{VIEW_TITLES[view]}</h3>
        </div>

        {view === 'users' && <div className="admin-system-detail-panel admin-system-wide">{panels.users}</div>}

        {view === 'banlist' && <div className="admin-system-detail-panel admin-system-wide">{panels.banlist}</div>}

        {view === 'rooms-game' && (
          <div className="admin-system-detail-panel admin-system-wide">{panels.roomsGame}</div>
        )}

        {view === 'rooms-chat' && (
          <div className="admin-system-detail-panel admin-system-wide">{panels.roomsChat}</div>
        )}

        {view === 'news' && <div className="admin-system-detail-panel admin-system-wide">{panels.news}</div>}

        {view === 'violations' && (
          <div className="admin-system-detail-panel admin-system-wide">{panels.violations}</div>
        )}

        {view === 'telegram' && (
          <form className="admin-system-detail-panel theme-settings-block admin-theme-block" onSubmit={onSaveTelegram}>
            <h4>Telegram бот и сайт</h4>
            <p className="theme-settings-hint">
              Укажите username бота и URL сайта. Это включает Telegram Login Widget и ссылку на Web App.
            </p>
            <label>
              Username бота (без @)
              <input
                value={telegramForm.botUsername}
                onChange={(e) => onTelegramFormChange({ botUsername: e.target.value })}
                placeholder="my_mafia_bot"
                maxLength={64}
                required
              />
            </label>
            <label>
              URL сайта для Web App
              <input
                value={telegramForm.webAppUrl}
                onChange={(e) => onTelegramFormChange({ webAppUrl: e.target.value })}
                placeholder="https://example.com"
                maxLength={300}
                required
              />
            </label>
            <div className="profile-actions">
              <button type="submit" className="btn btn-primary" disabled={telegramSaving}>
                {telegramSaving ? 'Сохранение...' : 'Сохранить Telegram'}
              </button>
            </div>
            {telegramBotLink && (
              <p className="theme-settings-hint">
                Ссылка на бота:{' '}
                <a href={telegramBotLink} target="_blank" rel="noreferrer">
                  {telegramBotLink}
                </a>
              </p>
            )}
            <p className="theme-settings-hint">
              В BotFather откройте вашего бота → <code>/setdomain</code> и укажите домен сайта.
            </p>
          </form>
        )}

        {view === 'metrika' && (
          <form className="admin-system-detail-panel theme-settings-block admin-theme-block" onSubmit={onSaveMetrika}>
            <h4>Яндекс.Метрика</h4>
            <p className="theme-settings-hint">
              Номер счётчика из{' '}
              <a href="https://metrika.yandex.ru/" target="_blank" rel="noreferrer">
                metrika.yandex.ru
              </a>
              . После сохранения метрика подключается на сайте без пересборки.
            </p>
            <label className="theme-use-default">
              <input
                type="checkbox"
                checked={metrikaDisabled}
                onChange={(e) => onMetrikaDisabledChange(e.target.checked)}
                disabled={metrikaSaving}
              />
              <span>Отключить счётчик</span>
            </label>
            <label>
              Номер счётчика
              <input
                value={metrikaId}
                onChange={(e) => onMetrikaIdChange(e.target.value)}
                placeholder="109982503"
                maxLength={12}
                disabled={metrikaDisabled || metrikaSaving}
                required={!metrikaDisabled}
              />
            </label>
            <div className="profile-actions">
              <button type="submit" className="btn btn-primary" disabled={metrikaSaving}>
                {metrikaSaving ? 'Сохранение...' : 'Сохранить Метрику'}
              </button>
            </div>
          </form>
        )}

        {view === 'game' && (
          <div className="admin-system-detail-panel theme-settings-block admin-theme-block">
            <h4>Тема оформления сайта</h4>
            <p className="theme-settings-hint">
              Основная тема для всех пользователей. Личная тема в кабинете перекрывает эту настройку.
            </p>
            <ThemePicker value={defaultTheme} onChange={onThemeChange} disabled={themeSaving} />

            <h4 className="admin-game-phrases-title">Фразы ведущего</h4>
            <AdminBotPhrasesEditor />
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="admin-section admin-system-section">
      <div className="admin-system-categories">
        {SYSTEM_CATEGORIES.map((category) => (
          <article key={category.id} className="admin-system-category-card">
            <header className="admin-system-category-head">
              <span className="admin-system-category-icon" aria-hidden>
                {category.icon}
              </span>
              <h4>{category.title}</h4>
              <span className="admin-system-category-badge">{badgeFor(category.id)}</span>
            </header>
            <ul className="admin-system-category-links">
              {category.links.map((link) => (
                <li key={link.label}>
                  <button type="button" onClick={() => setView(link.view)}>
                    {link.label}
                  </button>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}
