import {
  createNotification,
  getUnreadNotificationCount,
  type NotificationType,
  type UserNotification,
} from './store.js';

type NotifyFn = (userId: number, event: string, data: unknown) => void;

let notifyFn: NotifyFn | null = null;

export function initNotificationPush(fn: NotifyFn): void {
  notifyFn = fn;
}

export function pushNotification(
  userId: number,
  input: {
    type: NotificationType;
    title: string;
    body: string;
    action?: string | null;
    payload?: Record<string, unknown> | null;
  }
): UserNotification {
  const notification = createNotification(userId, input);
  const unreadCount = getUnreadNotificationCount(userId);
  notifyFn?.(userId, 'notification:new', { notification, unreadCount });
  return notification;
}

export function pushMailNotification(
  recipientId: number,
  payload: {
    fromUserId: number;
    fromUsername: string;
    fromDisplayName: string;
    preview: string;
  }
): UserNotification {
  const name = payload.fromDisplayName || payload.fromUsername || 'Игрок';
  return pushNotification(recipientId, {
    type: 'mail',
    title: 'Новое сообщение',
    body: `${name}: ${payload.preview}`,
    action: 'messages',
    payload: {
      fromUserId: payload.fromUserId,
      fromUsername: payload.fromUsername,
    },
  });
}

export function pushReputationNotification(
  targetId: number,
  value: -1 | 1,
  reputation: number,
  voterDisplayName: string
): UserNotification {
  const up = value === 1;
  const sign = reputation > 0 ? '+' : '';
  return pushNotification(targetId, {
    type: up ? 'reputation_up' : 'reputation_down',
    title: up ? 'Репутация повышена' : 'Репутация понижена',
    body: `${voterDisplayName} ${up ? 'положительно' : 'отрицательно'} оценил вас. Сейчас: ${sign}${reputation}`,
    action: 'profile',
    payload: { userId: targetId },
  });
}

export function pushAdminReputationNotification(
  userId: number,
  reputation: number
): UserNotification {
  const sign = reputation > 0 ? '+' : '';
  return pushNotification(userId, {
    type: reputation >= 0 ? 'reputation_up' : 'reputation_down',
    title: 'Репутация изменена',
    body: `Администратор установил вашу репутацию: ${sign}${reputation}`,
    action: 'profile',
    payload: { userId },
  });
}

const VIOLATION_TITLE: Record<string, string> = {
  advertising: 'Реклама',
  profanity: 'Мат',
  other: 'Спам',
};

/** Notify admins/moderators/watchers about an auto-moderation hit. */
export function pushStaffAutoModerationAlert(input: {
  violationType: string;
  authorName: string;
  authorUserId: number | null;
  preview: string;
  place: string;
  staffUserIds: number[];
}): void {
  const kind = VIOLATION_TITLE[input.violationType] || 'Нарушение';
  const preview = input.preview.trim().slice(0, 120);
  const body = `${input.authorName} · ${input.place}: ${preview || '—'}`;
  for (const staffId of input.staffUserIds) {
    if (input.authorUserId != null && staffId === input.authorUserId) continue;
    pushNotification(staffId, {
      type: 'system',
      title: `Автомодерация: ${kind}`,
      body,
      action: 'admin_violations',
      payload: {
        authorUserId: input.authorUserId,
        violationType: input.violationType,
      },
    });
  }
}
