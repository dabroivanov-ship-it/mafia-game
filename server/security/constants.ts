export const MAX_CHAT_MESSAGE_LENGTH = 300;
export const MAX_PM_MESSAGE_LENGTH = 2000;
export const MAX_SUPPORT_MESSAGE_LENGTH = 1500;
export const MAX_MODERATION_REASON_LENGTH = 500;
export const MAX_PASSWORD_LENGTH = 128;
export const MAX_NEWS_BODY_LENGTH = 50000;
export const MAX_NEWS_COMMENT_LENGTH = 2000;
export const MAX_NEWS_POLL_QUESTION_LENGTH = 200;
export const MAX_NEWS_POLL_OPTION_LENGTH = 120;
export const MIN_NEWS_POLL_OPTIONS = 2;
export const MAX_NEWS_POLL_OPTIONS = 10;

export const VIOLATION_TYPES = ['profanity', 'advertising', 'other'] as const;
export type ViolationTypeId = (typeof VIOLATION_TYPES)[number];

export const VIOLATION_TYPE_LABELS: Record<ViolationTypeId, string> = {
  profanity: 'Мат',
  advertising: 'Реклама',
  other: 'Другое',
};
