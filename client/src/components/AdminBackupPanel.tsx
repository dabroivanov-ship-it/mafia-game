import { FormEvent, useEffect, useState } from 'react';
import {
  fetchAdminBackups,
  adminCreateBackup,
  adminRestoreBackup,
  adminDeleteBackup,
  type AdminBackupInfo,
} from '../api';

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

export default function AdminBackupPanel() {
  const [backups, setBackups] = useState<AdminBackupInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [includeUploads, setIncludeUploads] = useState(true);
  const [error, setError] = useState('');
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const load = async () => {
    setError('');
    try {
      const { backups: list } = await fetchAdminBackups();
      setBackups(list);
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

  const handleRestore = async (id: string) => {
    if (
      !confirm(
        'Восстановить базу из этой копии? Текущие данные будут перезаписаны. Рекомендуется перезапустить сервер после восстановления.'
      )
    ) {
      return;
    }
    setRestoringId(id);
    setError('');
    try {
      await adminRestoreBackup(id);
      alert('База восстановлена. Перезагрузите страницу.');
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

  return (
    <div className="admin-backup-panel">
      {error && <div className="auth-error">{error}</div>}

      <form className="admin-backup-create" onSubmit={handleCreate}>
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
