import { FormEvent, useEffect, useState, type WheelEvent } from 'react';
import {
  fetchAdminBackups,
  fetchBackupSchedule,
  fetchTelegramBackupSettings,
  adminCreateBackup,
  adminSaveBackupSchedule,
  adminSaveTelegramBackupSettings,
  adminRestoreBackup,
  adminDeleteBackup,
  adminSendBackupToTelegram,
  type AdminBackupInfo,
  type BackupScheduleSettings,
  type TelegramBackupSettings,
} from '../api';

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

/** Не даём колёсику мыши менять значение вместо прокрутки страницы. */
function blurInputOnWheel(e: WheelEvent<HTMLInputElement>) {
  if (document.activeElement === e.currentTarget) {
    e.currentTarget.blur();
  }
}

export default function AdminBackupPanel() {
  const [backups, setBackups] = useState<AdminBackupInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [includeUploads, setIncludeUploads] = useState(true);
  const [error, setError] = useState('');
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const [schedule, setSchedule] = useState<BackupScheduleSettings>({
    enabled: false,
    time: '03:00',
    includeUploads: true,
    keepCount: 7,
    lastRunAt: null,
  });
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [scheduleSaved, setScheduleSaved] = useState(false);

  const [telegramSettings, setTelegramSettings] = useState<TelegramBackupSettings>({
    chatId: null,
    botConfigured: false,
    ready: false,
  });
  const [telegramChatId, setTelegramChatId] = useState('');
  const [telegramSaving, setTelegramSaving] = useState(false);
  const [telegramSaved, setTelegramSaved] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);

  const load = async () => {
    setError('');
    try {
      const [{ backups: list }, { schedule: saved }, { settings: telegram }] = await Promise.all([
        fetchAdminBackups(),
        fetchBackupSchedule(),
        fetchTelegramBackupSettings(),
      ]);
      setBackups(list);
      setSchedule(saved);
      setTelegramSettings(telegram);
      setTelegramChatId(telegram.chatId ?? '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError('');
    try {
      await adminCreateBackup(includeUploads);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка создания бэкапа');
    } finally {
      setCreating(false);
    }
  };

  const handleSaveSchedule = async (e: FormEvent) => {
    e.preventDefault();
    setScheduleSaving(true);
    setScheduleSaved(false);
    setError('');
    try {
      const { schedule: saved } = await adminSaveBackupSchedule({
        enabled: schedule.enabled,
        time: schedule.time,
        includeUploads: schedule.includeUploads,
        keepCount: schedule.keepCount,
      });
      setSchedule(saved);
      setScheduleSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения расписания');
    } finally {
      setScheduleSaving(false);
    }
  };

  const handleRestore = async (id: string) => {
    if (
      !confirm(
        'Восстановить базу из этой копии? Текущие данные будут перезаписаны. Сервер перезапустится автоматически.'
      )
    ) {
      return;
    }
    setRestoringId(id);
    setError('');
    try {
      await adminRestoreBackup(id);
      alert('База восстановлена. Сервер перезапускается — обновите страницу через 10–15 секунд.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка восстановления');
    } finally {
      setRestoringId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить эту резервную копию?')) return;
    setError('');
    try {
      await adminDeleteBackup(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка удаления');
    }
  };

  const handleSaveTelegram = async (e: FormEvent) => {
    e.preventDefault();
    setTelegramSaving(true);
    setTelegramSaved(false);
    setError('');
    try {
      const { settings } = await adminSaveTelegramBackupSettings(telegramChatId.trim());
      setTelegramSettings(settings);
      setTelegramChatId(settings.chatId ?? '');
      setTelegramSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения Telegram');
    } finally {
      setTelegramSaving(false);
    }
  };

  const handleSendTelegram = async (id: string) => {
    if (!telegramSettings.ready) {
      setError('Настройте TELEGRAM_BOT_TOKEN на сервере и chat ID получателя');
      return;
    }
    setSendingId(id);
    setError('');
    try {
      await adminSendBackupToTelegram(id);
      alert('Бэкап отправлен в Telegram');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка отправки в Telegram');
    } finally {
      setSendingId(null);
    }
  };

  return (
    <div className="admin-backup-panel">
      {error && <div className="auth-error">{error}</div>}

      <form className="admin-backup-telegram theme-settings-block" onSubmit={handleSaveTelegram}>
        <h4>Отправка в Telegram</h4>
        <p className="theme-settings-hint">
          Архив копии отправляется вашему боту. На сервере должен быть задан{' '}
          <code>TELEGRAM_BOT_TOKEN</code>. Получатель должен написать боту /start. Chat ID можно узнать
          через @userinfobot.
        </p>
        {!telegramSettings.botConfigured && (
          <p className="theme-settings-hint">TELEGRAM_BOT_TOKEN на сервере не настроен.</p>
        )}
        <label>
          Chat ID получателя
          <input
            type="text"
            inputMode="numeric"
            placeholder="123456789"
            value={telegramChatId}
            onChange={(e) => {
              setTelegramChatId(e.target.value);
              setTelegramSaved(false);
            }}
            disabled={telegramSaving}
          />
        </label>
        <div className="profile-actions">
          <button type="submit" className="btn btn-primary" disabled={telegramSaving}>
            {telegramSaving ? 'Сохранение…' : 'Сохранить chat ID'}
          </button>
          {telegramSaved && <span className="muted">Сохранено</span>}
        </div>
      </form>

      <form className="admin-backup-schedule theme-settings-block" onSubmit={handleSaveSchedule}>
        <h4>Автоматический бэкап</h4>
        <p className="theme-settings-hint">
          Копия создаётся ежедневно в указанное время по часам сервера. Если сервер был выключен — копия
          создастся при следующем запуске после этого времени.
        </p>

        <label className="theme-use-default">
          <input
            type="checkbox"
            checked={schedule.enabled}
            onChange={(e) => {
              setSchedule((prev) => ({ ...prev, enabled: e.target.checked }));
              setScheduleSaved(false);
            }}
            disabled={scheduleSaving}
          />
          <span>Включить автобэкап</span>
        </label>

        <label>
          Время (ЧЧ:ММ)
          <input
            type="time"
            value={schedule.time}
            onChange={(e) => {
              setSchedule((prev) => ({ ...prev, time: e.target.value }));
              setScheduleSaved(false);
            }}
            onWheel={blurInputOnWheel}
            disabled={scheduleSaving || !schedule.enabled}
            required
          />
        </label>

        <label className="theme-use-default">
          <input
            type="checkbox"
            checked={schedule.includeUploads}
            onChange={(e) => {
              setSchedule((prev) => ({ ...prev, includeUploads: e.target.checked }));
              setScheduleSaved(false);
            }}
            disabled={scheduleSaving || !schedule.enabled}
          />
          <span>Включать uploads в автокопию</span>
        </label>

        <label>
          Хранить последних копий (0 — все)
          <input
            type="number"
            min={0}
            max={100}
            value={schedule.keepCount}
            onChange={(e) => {
              setSchedule((prev) => ({
                ...prev,
                keepCount: Math.max(0, Math.min(100, Number(e.target.value) || 0)),
              }));
              setScheduleSaved(false);
            }}
            onWheel={blurInputOnWheel}
            disabled={scheduleSaving || !schedule.enabled}
          />
        </label>

        {schedule.lastRunAt && (
          <p className="theme-settings-hint">
            Последний автобэкап:{' '}
            <strong>{new Date(schedule.lastRunAt).toLocaleString('ru-RU')}</strong>
          </p>
        )}

        <div className="profile-actions">
          <button type="submit" className="btn btn-primary" disabled={scheduleSaving}>
            {scheduleSaving ? 'Сохранение…' : 'Сохранить расписание'}
          </button>
          {scheduleSaved && <span className="muted">Сохранено</span>}
        </div>
      </form>

      <form className="admin-backup-create theme-settings-block" onSubmit={handleCreate}>
        <h4>Ручной бэкап</h4>
        <p className="theme-settings-hint">
          Создаётся копия базы данных SQLite. Можно включить папку uploads (аватары, обложки новостей).
        </p>
        <label className="theme-use-default">
          <input
            type="checkbox"
            checked={includeUploads}
            onChange={(e) => setIncludeUploads(e.target.checked)}
            disabled={creating}
          />
          <span>Включить uploads</span>
        </label>
        <button type="submit" className="btn btn-primary" disabled={creating}>
          {creating ? 'Создание…' : 'Создать бэкап'}
        </button>
      </form>

      {loading && backups.length === 0 && <p className="muted">Загрузка…</p>}

      {backups.length === 0 && !loading && <p className="muted">Резервных копий пока нет</p>}

      {backups.length > 0 && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Дата</th>
                <th>Размер</th>
                <th>Uploads</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {backups.map((b) => (
                <tr key={b.id}>
                  <td>{new Date(b.createdAt).toLocaleString('ru-RU')}</td>
                  <td>{formatSize(b.sizeBytes)}</td>
                  <td>{b.includeUploads ? 'да' : 'нет'}</td>
                  <td className="admin-actions">
                    <button
                      type="button"
                      className="btn btn-sm"
                      disabled={!telegramSettings.ready || sendingId === b.id}
                      onClick={() => void handleSendTelegram(b.id)}
                      title={
                        telegramSettings.ready
                          ? 'Отправить архив в Telegram'
                          : 'Настройте TELEGRAM_BOT_TOKEN и chat ID'
                      }
                    >
                      {sendingId === b.id ? '…' : 'В Telegram'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm"
                      disabled={restoringId === b.id}
                      onClick={() => void handleRestore(b.id)}
                    >
                      {restoringId === b.id ? '…' : 'Восстановить'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-ghost danger"
                      onClick={() => void handleDelete(b.id)}
                    >
                      Удалить
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
