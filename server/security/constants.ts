export const MAX_CHAT_MESSAGE_LENGTH = 300;
export const MAX_PM_MESSAGE_LENGTH = 2000;
export const MAX_MODERATION_REASON_LENGTH = 500;
export const MAX_PASSWORD_LENGTH = 128;
export const MAX_NEWS_BODY_LENGTH = 50000;

export const VIOLATION_TYPES = ['profanity', 'advertising', 'other'] as const;
export type ViolationTypeId = (typeof VIOLATION_TYPES)[number];

export const VIOLATION_TYPE_LABELS: Record<ViolationTypeId, string> = {
  profanity: 'Мат',
  advertising: 'Реклама',
  other: 'Другое',
};
