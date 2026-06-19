export interface UserPresence {
  isOnline: boolean;
  lastSeenAt: string | null;
}

export function formatPresenceLabel(presence: UserPresence | undefined): string {
  if (!presence) return 'Нет данных';
  if (presence.isOnline) return 'В сети';

  if (!presence.lastSeenAt) return 'Давно не был(а)';

  const date = new Date(presence.lastSeenAt);
  if (Number.isNaN(date.getTime())) return 'Давно не был(а)';

  const diffMs = Date.now() - date.getTime();
  if (diffMs < 60_000) return 'Был(а) только что';
  if (diffMs < 3600_000) {
    const mins = Math.max(1, Math.floor(diffMs / 60_000));
    return `Был(а) ${mins} мин. назад`;
  }
  if (diffMs < 86400_000) {
    const hours = Math.max(1, Math.floor(diffMs / 3600_000));
    return `Был(а) ${hours} ч. назад`;
  }
  if (diffMs < 172800_000) return 'Был(а) вчера';

  return `Был(а) ${date.toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}
