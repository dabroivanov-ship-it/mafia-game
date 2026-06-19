import { ROLE_LABELS } from './config.js';
import type { RoleId } from '../types/index.js';

/**
 * Распределение ролей по количеству игроков (3–10).
 * Первый мафия в списке становится главным (don).
 */
export function distributeRoles(playerCount: number): RoleId[] {
  if (playerCount === 3) {
    return shuffle(['mafia', 'commissar', 'civilian']);
  }

  const pool: RoleId[] = [];

  if (playerCount >= 4) {
    pool.push('mafia', 'commissar', 'doctor', 'civilian');
  }
  if (playerCount >= 5) {
    pool[3] = 'prostitute'; // заменяем мирного на путану при 5+
    if (playerCount === 5) pool.push('civilian');
  }
  if (playerCount >= 6) {
    pool.push('mafia'); // второй маф
    pool[pool.length - 2] = 'homeless'; // вместо лишнего мирного — бомж
  }
  if (playerCount >= 7) {
    pool.push('advocate');
  }
  if (playerCount >= 8) {
    pool.push('maniac');
  }
  if (playerCount >= 9) {
    pool.push('clown');
  }
  if (playerCount >= 10) {
    // 10 игроков: 3 мафии (первый — дон), 6 мирных, 1 маньяк
    while (pool.includes('civilian')) {
      const idx = pool.lastIndexOf('civilian');
      if (idx === -1) break;
      pool.splice(idx, 1);
    }
    pool.push('commissar_wife', 'highlander', 'mafia');
  }

  // Обрезаем до нужного количества
  while (pool.length > playerCount) pool.pop();
  while (pool.length < playerCount) pool.push('civilian');

  return shuffle(pool);
}

function shuffle(arr: RoleId[]): RoleId[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function getRoleLabel(role: RoleId | null | undefined): string {
  if (!role) return '';
  return ROLE_LABELS[role] || role;
}

export function isMafia(role: RoleId | null | undefined): boolean {
  return role === 'mafia';
}

export function isMafiaTeam(role: RoleId | null | undefined): boolean {
  return role === 'mafia' || role === 'advocate';
}

export function isTown(role: RoleId | null | undefined): boolean {
  return role !== 'mafia' && role !== 'maniac' && role !== 'advocate';
}

export function isEvil(role: RoleId | null | undefined): boolean {
  return role === 'mafia' || role === 'maniac';
}

/** Горец не убивается мафией */
export function isMafiaImmune(role: RoleId | null | undefined): boolean {
  return role === 'highlander';
}

/** Клоун не подвержен соблазнению путаны */
export function isSeductionImmune(role: RoleId | null | undefined): boolean {
  return role === 'clown';
}
