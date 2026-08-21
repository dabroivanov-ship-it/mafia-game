import { findUserById } from '../auth/db.js';
import { pushMailNotification } from '../notifications/push.js';
import { sendPrivateMessage } from '../messages/store.js';

export function notifyClanAction(fromUserId: number, toUserId: number, text: string): void {
  if (!fromUserId || !toUserId || fromUserId === toUserId) return;
  try {
    const message = sendPrivateMessage(fromUserId, toUserId, text);
    if (!message) return;
    const from = findUserById(fromUserId);
    pushMailNotification(toUserId, {
      fromUserId,
      fromUsername: from?.username || '',
      fromDisplayName: from?.display_name || from?.username || '',
      preview: text.replace(/\s+/g, ' ').trim().slice(0, 120),
    });
  } catch (err) {
    console.error('Clan mail notify failed:', err);
  }
}
