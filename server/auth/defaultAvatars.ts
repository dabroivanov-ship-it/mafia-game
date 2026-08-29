import type { UserGender } from './gender.js';
import { normalizeGender } from './gender.js';

export const DEFAULT_AVATAR_MALE = '/avatars/default-male.png';
export const DEFAULT_AVATAR_FEMALE = '/avatars/default-female.png';

const LEGACY_DEFAULT_AVATARS = new Set([
  '/avatars/default-male.svg',
  '/avatars/default-female.svg',
]);

export function defaultAvatarForGender(gender: UserGender | string | null | undefined): string | null {
  const normalized = normalizeGender(gender);
  if (normalized === 'male') return DEFAULT_AVATAR_MALE;
  if (normalized === 'female') return DEFAULT_AVATAR_FEMALE;
  return null;
}

export function isDefaultAvatar(path: string | null | undefined): boolean {
  return (
    path === DEFAULT_AVATAR_MALE ||
    path === DEFAULT_AVATAR_FEMALE ||
    (!!path && LEGACY_DEFAULT_AVATARS.has(path))
  );
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
