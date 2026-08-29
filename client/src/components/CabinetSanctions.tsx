import { useEffect, useState } from 'react';
import { fetchMySanctions, type UserSanctionEntry } from '../api';

interface CabinetSanctionsProps {
  onBack: () => void;
}

const TYPE_LABELS: Record<UserSanctionEntry['sanctionType'], string> = {
  ban: 'Блокировка аккаунта',
  silence: 'Заглушка в чате',
};

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatUntil(entry: UserSanctionEntry): string {
  if (entry.liftedAt) return `снято ${formatDateTime(entry.liftedAt)}`;
  if (!entry.untilAt) return 'бессрочно';
  const until = new Date(entry.untilAt);
  if (Number.isNaN(until.getTime())) return entry.untilAt;
  if (until.getTime() <= Date.now()) return `до ${formatDateTime(entry.untilAt)} (истекло)`;
  return `до ${formatDateTime(entry.untilAt)}`;
}

function isActive(entry: UserSanctionEntry): boolean {
  if (entry.liftedAt) return false;
  if (!entry.untilAt) return true;
  const until = new Date(entry.untilAt);
  return !Number.isNaN(until.getTime()) && until.getTime() > Date.now();
}

function formatModeratorName(name: string): string {
  if (!name || name === 'Модерация' || name === 'Авто') return name;
  return `@${name.replace(/^@/, '')}`;
}

export default function CabinetSanctions({ onBack }: CabinetSanctionsProps) {
  const [sanctions, setSanctions] = useState<UserSanctionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    void fetchMySanctions()
      .then(({ sanctions: list }) => setSanctions(list))
      .catch((err) => setError(err instanceof Error ? err.message : 'Ошибка загрузки'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="cabinet-page">
      <nav className="info-back">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onBack}>
          ← Кабинет
        </button>
      </nav>

      <header className="cabinet-sanctions-header">
        <h1>Санкции</h1>
        <p className="muted">
          Полная история ограничений: что, за что, кем и до какого числа.
        </p>
      </header>

      {error && <div className="auth-error">{error}</div>}

      {loading && <p className="muted">Загрузка…</p>}

      {!loading && sanctions.length === 0 && !error && (
        <div className="profile-card cabinet-card cabinet-sanctions-empty">
          <p>Ограничений не было. Так держать.</p>
        </div>
      )}

      {!loading && sanctions.length > 0 && (
        <div className="cabinet-sanctions-list">
          {sanctions.map((entry) => (
            <article
              key={entry.id}
              className={`profile-card cabinet-card cabinet-sanction-card${
                isActive(entry) ? ' cabinet-sanction-card--active' : ''
              }`}
            >
              <div className="cabinet-sanction-card-top">
                <h2>{TYPE_LABELS[entry.sanctionType]}</h2>
                {isActive(entry) && <span className="cabinet-sanction-badge">активно</span>}
              </div>
              <dl className="cabinet-sanction-meta">
                <div>
                  <dt>Причина</dt>
                  <dd>{entry.reason}</dd>
                </div>
                <div>
                  <dt>Кем</dt>
                  <dd>{formatModeratorName(entry.moderatorName)}</dd>
                </div>
                <div>
                  <dt>Срок</dt>
                  <dd>{formatUntil(entry)}</dd>
                </div>
                <div>
                  <dt>Назначено</dt>
                  <dd>{formatDateTime(entry.createdAt)}</dd>
                </div>
                {entry.roomName && (
                  <div>
                    <dt>Комната</dt>
                    <dd>{entry.roomName}</dd>
                  </div>
                )}
              </dl>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
