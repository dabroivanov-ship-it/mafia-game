import { CONFIG, ROLE_LABELS } from './config.js';
import { getRoleLabel, isMafia } from './roles.js';
import type { GamePlayer, GameRoom, PrivateNote, RoleId } from '../types/index.js';

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function aliveNames(room: GameRoom): string[] {
  return room.players.filter((p) => p.alive && p.inGame && p.role).map((p) => p.name);
}

function actionHint(player: GamePlayer, room: GameRoom): string {
  if (!player.role || !player.alive) return 'Ожидайте следующей фазы.';

  switch (player.role) {
    case 'mafia':
      return player.isDon
        ? 'Ночью вы — главарь мафии. Выберите жертву (ваш голос решающий при равенстве).'
        : 'Ночью выберите жертву вместе с мафией.';
    case 'commissar':
      return 'Ночью проверьте игрока или совершите выстрел.';
    case 'doctor':
      return 'Ночью выберите, кого вылечить (себя — не чаще раза в 3 ночи).';
    case 'homeless':
      return 'Ночью выберите игрока для проверки — узнаете его роль.';
    case 'prostitute':
      return 'Ночью выберите, кого соблазнить — его действие будет заблокировано.';
    case 'maniac':
      return 'Ночью выберите жертву для убийства.';
    case 'clown':
      return room.clownUsed
        ? 'Способность клоуна уже использована.'
        : 'Один раз за игру ночью можно поменять роли двух игроков.';
    case 'commissar_wife':
      return room.wifeRevengeAvailable && !room.wifeRevengeUsed
        ? 'Доступна месть: выберите игрока для убийства.'
        : 'Пока комиссар жив — особых действий нет.';
    case 'highlander':
      return 'Вы горец — мафия не может вас убить. Ночных действий нет.';
    default:
      return 'У вашей роли нет ночных действий. Дождитесь утра.';
  }
}

export function buildRoleRevealNotes(room: GameRoom): PrivateNote[] {
  const notes: PrivateNote[] = [];
  for (const player of room.players) {
    if (!player.inGame || !player.role || !player.alive) continue;
    const roleLine = getRoleLabel(player.role);
    const donLine = player.isDon ? ' Вы — главарь мафии.' : '';
    notes.push({
      playerId: player.id,
      message: `🎭 Ваша роль: ${roleLine}.${donLine}\n${actionHint(player, room)}`,
    });
  }
  return notes;
}

export function buildNightReminderNotes(room: GameRoom): PrivateNote[] {
  const notes: PrivateNote[] = [];
  for (const player of room.players) {
    if (!player.alive || !player.inGame || !player.role) continue;
    const needsAction =
      player.role === 'mafia' ||
      player.role === 'commissar' ||
      player.role === 'doctor' ||
      player.role === 'homeless' ||
      player.role === 'prostitute' ||
      player.role === 'maniac' ||
      (player.role === 'clown' && !room.clownUsed) ||
      (player.role === 'commissar_wife' && room.wifeRevengeAvailable && !room.wifeRevengeUsed);

    if (!needsAction) continue;

    const targets = aliveNames(room).filter((n) => n !== player.name);
    const targetHint = targets.length ? ` Игроки: ${targets.join(', ')}.` : '';

    notes.push({
      playerId: player.id,
      message: `🌙 Ночь ${room.nightNumber}. ${actionHint(player, room)}${targetHint}`,
    });
  }
  return notes;
}

export function getRolesRevealSystemMessage(playerCount: number): string {
  return `Раздача ролей окончена! Ночь начнётся через ${CONFIG.ROLE_REVEAL_SEC} сек.`;
}

export function getGameStartSystemMessage(playerCount: number): string {
  return `Начинается игра «Мафия»! Зарегистрировалось игроков: ${playerCount}.`;
}

const NIGHT_FALL = [
  'Наступает ночь, все жители засыпают, кроме некоторых...',
  'Город погружаетcя в темноту. Ночь начинается...',
  'Фонари гаснут. Наступает ночь...',
];

const MAFIA_ATMOSPHERE = [
  'Главарь мафии высматривает свою жертву. За ним следуют его союзники...',
  'Мафиози, вооружившись до зубов, направляются на встречу со своей жертвой...',
  'В тени переулков мафия выбирает, кто не доживёт до рассвета...',
];

const COMMISSAR_ATMOSPHERE = [
  'Комиссар Катани ходит по комнате и вычисляет мафию...',
  'Комиссар Катани лежит в засаде и следит за мафией...',
  'Инспектор Катани внимательно изучает поведение игроков...',
];

const DOCTOR_ATMOSPHERE = [
  'Доктор готовит аптечку и выбирает, кого спасти этой ночью...',
];

const MANIAC_ATMOSPHERE = [
  'Где-то в темноте маньяк выбирает новую жертву...',
];

export function getNightAtmosphereMessages(room: GameRoom): string[] {
  const messages = [pick(NIGHT_FALL)];

  if (room.players.some((p) => p.alive && p.role === 'mafia')) {
    messages.push(pick(MAFIA_ATMOSPHERE));
  }
  if (room.players.some((p) => p.alive && p.role === 'commissar')) {
    messages.push(pick(COMMISSAR_ATMOSPHERE));
  }
  if (room.players.some((p) => p.alive && p.role === 'doctor')) {
    messages.push(pick(DOCTOR_ATMOSPHERE));
  }
  if (room.players.some((p) => p.alive && p.role === 'maniac')) {
    messages.push(pick(MANIAC_ATMOSPHERE));
  }

  return messages;
}

export function getNightCompleteMessage(): string {
  return 'Всё, что могло свершиться ночью, свершилось.';
}

export function getMorningIntroMessage(killed: GamePlayer[]): string {
  if (killed.length === 0) {
    return 'Вот и день наступил. Этой ночью все остались живы.';
  }

  const parts = killed.map((p) => {
    const role = getRoleLabel(p.role);
    if (p.role === 'commissar') {
      return `Мафия расправилась с комиссаром ${p.name}!`;
    }
    if (isMafia(p.role)) {
      return `Мафия сегодня не оставила шансов ${p.name} (${role})!`;
    }
    return `${p.name} (${role}) не дожил(а) до рассвета.`;
  });

  return `Вот и день наступил. Но все ли дожили до него? ${parts.join(' ')}`;
}

export function getGameEndRolesMessage(room: GameRoom): string {
  const lines = room.players
    .filter((p) => p.inGame && p.role)
    .map((p) => `${p.name} — ${getRoleLabel(p.role)}`);
  return `А роли были такие: ${lines.join(', ')}`;
}

export function getScoreSummaryMessage(room: GameRoom): string {
  const scorers = room.players
    .filter((p) => p.inGame)
    .map((p) => `${p.name}: ${p.score}`)
    .join(', ');
  return scorers ? `За эту игру заработали очков: ${scorers}` : '';
}

export function getRoleLabelRu(role: RoleId | null | undefined): string {
  if (!role) return '';
  return ROLE_LABELS[role] || role;
}
