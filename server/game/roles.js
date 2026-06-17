import { ROLE_LABELS } from './config.js';

/**
 * Распределение ролей по количеству игроков (4–10).
 * Первый мафия в списке становится главным (don).
 */
export function distributeRoles(playerCount) {
  const pool = [];

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
    pool.push('civilian');
  }
  if (playerCount >= 8) {
    pool.push('maniac');
  }
  if (playerCount >= 9) {
    pool.push('clown');
  }
  if (playerCount >= 10) {
    // 10 игроков: добавляем жену, горца, убираем одного мирного
    const idx = pool.lastIndexOf('civilian');
    if (idx !== -1) pool.splice(idx, 1);
    pool.push('commissar_wife', 'highlander', 'civilian');
  }

  // Обрезаем до нужного количества
  while (pool.length > playerCount) pool.pop();
  while (pool.length < playerCount) pool.push('civilian');

  return shuffle(pool);
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function getRoleLabel(role) {
  return ROLE_LABELS[role] || role;
}

export function isMafia(role) {
  return role === 'mafia';
}

export function isTown(role) {
  return role !== 'mafia' && role !== 'maniac';
}

export function isEvil(role) {
  return role === 'mafia' || role === 'maniac';
}

/** Горец не убивается мафией */
export function isMafiaImmune(role) {
  return role === 'highlander';
}

/** Клоун не подвержен соблазнению путаны */
export function isSeductionImmune(role) {
  return role === 'clown';
}
