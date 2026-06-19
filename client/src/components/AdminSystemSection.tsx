import { FormEvent, useState } from 'react';
import ThemePicker from './ThemePicker';
import type { ThemeId } from '../types';
import { THEMES } from '../themes';

type SystemView = 'hub' | 'overview' | 'theme' | 'telegram' | 'metrika';

interface AdminSystemSectionProps {
  usersCount: number;
  roomsCount: number;
  gameRoomsCount: number;
  chatRoomsCount: number;
  violationsCount: number;
  onSync: () => void;
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
}

const SYSTEM_CATEGORIES: {
  id: SystemView;
  icon: string;
  title: string;
  links: { view: SystemView; label: string }[];
}[] = [
  {
    id: 'overview',
    icon: '📊',
    title: 'Обзор',
    links: [
      { view: 'overview', label: 'Статистика проекта' },
      { view: 'overview', label: 'Синхронизация данных' },
    ],
  },
  {
    id: 'theme',
    icon: '🎨',
    title: 'Оформление',
    links: [{ view: 'theme', label: 'Тема сайта' }],
  },
  {
    id: 'telegram',
    icon: '📱',
    title: 'Интеграции',
    links: [
      { view: 'telegram', label: 'Telegram-бот' },
      { view: 'telegram', label: 'Web App и вход' },
    ],
  },
  {
    id: 'metrika',
    icon: '📈',
    title: 'Аналитика',
    links: [{ view: 'metrika', label: 'Яндекс.Метрика' }],
  },
];

const VIEW_TITLES: Record<Exclude<SystemView, 'hub'>, string> = {
  overview: 'Обзор',
  theme: 'Оформление',
  telegram: 'Интеграции',
  metrika: 'Аналитика',
};

export default function AdminSystemSection({
  usersCount,
  roomsCount,
  gameRoomsCount,
  chatRoomsCount,
  violationsCount,
  onSync,
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
}: AdminSystemSectionProps) {
  const [view, setView] = useState<SystemView>('hub');

  const badgeFor = (categoryId: SystemView) => {
    if (categoryId === 'overview') return 2;
    if (categoryId === 'theme') return THEMES.length;
    if (categoryId === 'telegram') return 2;
    return 1;
  };

  if (view !== 'hub') {
    return (
      <section className="admin-section admin-system-section">
        <div className="admin-system-detail-head">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setView('hub')}>
            ← К разделам системы
          </button>
          <h3>{VIEW_TITLES[view]}</h3>
        </div>

        {view === 'overview' && (
          <div className="admin-system-detail-panel">
            <div className="admin-system-stats">
              <div className="admin-system-stat-card">
                <span className="admin-system-stat-icon" aria-hidden>
                  👥
                </span>
                <div>
                  <span className="muted">Пользователей</span>
                  <strong>{usersCount}</strong>
                </div>
              </div>
              <div className="admin-system-stat-card">
                <span className="admin-system-stat-icon" aria-hidden>
                  🏠
                </span>
                <div>
                  <span className="muted">Комнат</span>
                  <strong>{roomsCount}</strong>
                  <span className="muted admin-system-detail">
                    {gameRoomsCount} игр. · {chatRoomsCount} чат
                  </span>
                </div>
              </div>
              <div className="admin-system-stat-card">
                <span className="admin-system-stat-icon" aria-hidden>
                  ⚠️
                </span>
                <div>
                  <span className="muted">Нарушений в логе</span>
                  <strong>{violationsCount}</strong>
                </div>
              </div>
            </div>
            <div className="theme-settings-block admin-theme-block">
              <h4>Синхронизация</h4>
              <p className="theme-settings-hint">
                Обновить список пользователей и комнат с сервера, подтянуть актуальные названия комнат.
              </p>
              <button type="button" className="btn btn-primary" onClick={onSync}>
                Синхронизировать данные
              </button>
            </div>
          </div>
        )}

        {view === 'theme' && (
          <div className="admin-system-detail-panel theme-settings-block admin-theme-block">
            <h4>Тема оформления сайта</h4>
            <p className="theme-settings-hint">
              Основная тема для всех пользователей. Личная тема в кабинете перекрывает эту настройку.
            </p>
            <ThemePicker value={defaultTheme} onChange={onThemeChange} disabled={themeSaving} />
          </div>
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
              В BotFather откройте вашего бота → <code>/setdomain</code> и укажите домен сайта. При нажатии
              «Старт» в боте пользователь получит сообщение с кнопкой «Играть».
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
      </section>
    );
  }

  return (
    <section className="admin-section admin-system-section">
      <h3>Система</h3>

      <div className="admin-system-stats admin-system-stats-compact">
        <div className="admin-system-stat-card">
          <span className="admin-system-stat-icon" aria-hidden>
            👥
          </span>
          <div>
            <span className="muted">Пользователей</span>
            <strong>{usersCount}</strong>
          </div>
        </div>
        <div className="admin-system-stat-card">
          <span className="admin-system-stat-icon" aria-hidden>
            🏠
          </span>
          <div>
            <span className="muted">Комнат</span>
            <strong>{roomsCount}</strong>
          </div>
        </div>
        <div className="admin-system-stat-card">
          <span className="admin-system-stat-icon" aria-hidden>
            ⚠️
          </span>
          <div>
            <span className="muted">Нарушений</span>
            <strong>{violationsCount}</strong>
          </div>
        </div>
      </div>

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
