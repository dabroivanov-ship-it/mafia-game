import type { UserGender } from './gender.js';
import { normalizeGender } from './gender.js';

export const DEFAULT_AVATAR_MALE = '/avatars/default-male.svg';
export const DEFAULT_AVATAR_FEMALE = '/avatars/default-female.svg';

export function defaultAvatarForGender(gender: UserGender | string | null | undefined): string | null {
  const normalized = normalizeGender(gender);
  if (normalized === 'male') return DEFAULT_AVATAR_MALE;
  if (normalized === 'female') return DEFAULT_AVATAR_FEMALE;
  return null;
}

export function isDefaultAvatar(path: string | null | undefined): boolean {
  return path === DEFAULT_AVATAR_MALE || path === DEFAULT_AVATAR_FEMALE;
}

export function isCustomAvatar(path: string | null | undefined): boolean {
  return !!path && path.startsWith('/uploads/avatars/');
}

export function resolveUserAvatar(
  stored: string | null | undefined,
  gender: UserGender | string | null | undefined
): string | null {
  if (stored && isCustomAvatar(stored)) return stored;
  if (stored && isDefaultAvatar(stored)) return stored;
  return defaultAvatarForGender(gender);
}

export function shouldUseGenderDefaultAvatar(stored: string | null | undefined): boolean {
  return !stored || isDefaultAvatar(stored);
}
