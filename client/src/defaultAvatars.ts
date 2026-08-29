export const DEFAULT_AVATAR_MALE = '/avatars/default-male.svg';
export const DEFAULT_AVATAR_FEMALE = '/avatars/default-female.svg';

export type DefaultAvatarChoice = 'male' | 'female';

export const DEFAULT_AVATAR_OPTIONS: {
  id: DefaultAvatarChoice;
  path: string;
  label: string;
}[] = [
  { id: 'male', path: DEFAULT_AVATAR_MALE, label: 'Мужской' },
  { id: 'female', path: DEFAULT_AVATAR_FEMALE, label: 'Женский' },
];

export function avatarChoiceFromPath(path: string | null | undefined): DefaultAvatarChoice | null {
  if (!path) return null;
  if (path.includes('default-male')) return 'male';
  if (path.includes('default-female')) return 'female';
  return null;
}
