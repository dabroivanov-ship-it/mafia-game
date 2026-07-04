export type UserGender = 'male' | 'female' | '';

export const USER_GENDER_LABELS: Record<'male' | 'female', string> = {
  male: 'Мужской',
  female: 'Женский',
};

export function normalizeGender(value: unknown): UserGender {
  if (value === 'male' || value === 'female') return value;
  return '';
}

export function isValidRegistrationGender(value: unknown): value is 'male' | 'female' {
  return value === 'male' || value === 'female';
}

export function genderLabel(gender: UserGender | string | null | undefined): string {
  if (gender === 'male') return USER_GENDER_LABELS.male;
  if (gender === 'female') return USER_GENDER_LABELS.female;
  return '—';
}
