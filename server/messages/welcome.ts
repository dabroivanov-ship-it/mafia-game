import { findPrimaryAdmin } from '../auth/db.js';
import type { User } from '../types/index.js';
import { pushMailNotification } from '../notifications/push.js';
import { sendPrivateMessage } from './store.js';

function greeting(user: User): string {
  if (user.gender === 'female') return `Дорогая ${user.username}!`;
  if (user.gender === 'male') return `Дорогой ${user.username}!`;
  return `Привет, ${user.username}!`;
}

export function buildWelcomeLetter(user: User, admin: User): string {
  return [
    greeting(user),
    '',
    'Рады видеть тебя за столом. Аккаунт создан — можно заходить в лобби и садиться в комнату.',
    '',
    'Правила чата и ответы на частые вопросы собраны в разделе FAQ: /info/faq',
    '',
    `По вопросам и пожеланиям пиши ${admin.username}.`,
    '',
    'Удачи за столом.',
  ].join('\n');
}

export function sendWelcomeLetter(user: User): void {
  if (!user?.id) return;
  try {
    const admin = findPrimaryAdmin();
    if (!admin) {
      console.warn('Welcome letter skipped: no admin account');
      return;
    }
    if (admin.id === user.id) return;

    const text = buildWelcomeLetter(user, admin);
    const message = sendPrivateMessage(admin.id, user.id, text, null, { hideFromSender: true });
    if (!message) return;

    pushMailNotification(user.id, {
      fromUserId: admin.id,
      fromUsername: admin.username,
      fromDisplayName: admin.display_name || admin.username,
      preview: text.replace(/\s+/g, ' ').trim().slice(0, 120),
    });
  } catch (err) {
    console.error('Failed to send welcome letter:', err);
  }
}
