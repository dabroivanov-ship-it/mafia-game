import { CONFIG, ROLE_LABELS } from './config.js';
import { getRoleLabel, isEvil, isMafia } from './roles.js';
import type { GamePlayer, GameRoom, PrivateNote, RoleId } from '../types/index.js';

export function playerNick(p: Pick<GamePlayer, 'username' | 'name'>): string {
  return p.username || p.name;
}

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function aliveNames(room: GameRoom, excludeId?: number): string[] {
  return room.players
    .filter((p) => p.alive && p.inGame && p.role && p.id !== excludeId)
    .map((p) => playerNick(p));
}

function nightActionPrompt(player: GamePlayer, room: GameRoom): string {
  if (!player.role || !player.alive) return 'Ожидайте следующей фазы.';

  const targets = aliveNames(room, player.id);
  const list = targets.length ? `\nИгроки: ${targets.join(', ')}.` : '';

  switch (player.role) {
    case 'mafia':
      return player.isDon
        ? `Вы — главарь мафии. Выберите жертву в панели действий (ваш голос решающий).${list}`
        : `Выберите жертву вместе с мафией в панели действий.${list}`;
    case 'commissar':
      return `Комиссар Катани: проверьте игрока (узнаете роль в личном сообщении) или совершите выстрел.${list}`;
    case 'doctor':
      return `Выберите, кого вылечить этой ночью (себя — не чаще раза в 3 ночи).${list}`;
    case 'homeless':
      return `Выберите игрока для проверки — роль узнаете в личном сообщении.${list}`;
    case 'prostitute':
      return `Выберите, кого соблазнить — его ночное действие будет заблокировано.${list}`;
    case 'maniac':
      return `Выберите жертву для убийства.${list}`;
    case 'clown':
      return room.clownUsed
        ? 'Способность клоуна уже использована.'
        : `Один раз за игру: выберите двух игроков для обмена ролями.${list}`;
    case 'commissar_wife':
      return room.wifeRevengeAvailable && !room.wifeRevengeUsed
        ? `Доступна месть! Выберите игрока для убийства.${list}`
        : 'Пока комиссар жив — особых действий нет.';
    case 'highlander':
      return 'Вы горец — мафия не может вас убить. Ночных действий нет.';
    default:
      return 'У вашей роли нет ночных действий. Дождитесь утра.';
  }
}

function actionHint(player: GamePlayer, room: GameRoom): string {
  return nightActionPrompt(player, room).replace(/\nИгроки:.*$/, '');
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

    notes.push({
      playerId: player.id,
      message: `🌙 Ночь ${room.nightNumber}.\n${nightActionPrompt(player, room)}`,
    });
  }
  return notes;
}

export function buildDayDiscussionNotes(room: GameRoom): PrivateNote[] {
  const notes: PrivateNote[] = [];
  const alive = room.players.filter((p) => p.alive && p.inGame && p.role);
  for (const player of alive) {
    notes.push({
      playerId: player.id,
      message: `☀️ День ${room.nightNumber + 1}. Обсудите подозреваемых в общем чате. Когда будете готовы — нажмите «Начать голосование» в панели действий.`,
    });
  }
  return notes;
}

export function buildVotingReminderNotes(room: GameRoom): PrivateNote[] {
  const notes: PrivateNote[] = [];
  const alive = room.players.filter((p) => p.alive && p.inGame && p.role);
  for (const player of alive) {
    const others = aliveNames(room, player.id);
    notes.push({
      playerId: player.id,
      message: `🗳️ Голосование! Кого подозреваете? Выберите игрока в панели действий.\n${others.length ? `Участники: ${others.join(', ')}.` : ''}`,
    });
  }
  return notes;
}

export interface NightReport {
  prostituteSeduced?: GamePlayer;
  commissarChecked?: GamePlayer;
  commissarKilled?: GamePlayer;
  homelessChecked?: GamePlayer;
  doctorHealed?: GamePlayer;
  doctorSelfHeal?: boolean;
  mafiaAttacked?: GamePlayer;
  mafiaKilled?: GamePlayer;
  mafiaTied?: boolean;
  highlanderAttacked?: GamePlayer;
  maniacKilled?: GamePlayer;
  wifeKilled?: GamePlayer;
  clownSwapped?: [GamePlayer, GamePlayer];
  killed: GamePlayer[];
}

export function buildMorningReportMessage(
  _room: GameRoom,
  report: NightReport,
  hadActions: boolean
): string {
  const parts: string[] = [];

  if (hadActions) {
    parts.push(getNightCompleteMessage());
  }

  if (report.prostituteSeduced) {
    parts.push(
      `Путана соблазнила ${playerNick(report.prostituteSeduced)} — его ночное действие заблокировано.`
    );
  }

  if (report.commissarChecked) {
    parts.push(`Комиссар Катани проверил ${playerNick(report.commissarChecked)}.`);
  }
  if (report.commissarKilled) {
    parts.push(
      `Комиссар Катани убил ${playerNick(report.commissarKilled)} (${getRoleLabel(report.commissarKilled.role)})!`
    );
  }

  if (report.homelessChecked) {
    parts.push(`Бомж проверил ${playerNick(report.homelessChecked)}.`);
  }

  if (report.doctorHealed) {
    const nick = playerNick(report.doctorHealed);
    if (report.doctorSelfHeal) {
      parts.push(`Доктор вылечил себя (${nick}).`);
    } else {
      parts.push(`Доктор вылечил ${nick}.`);
    }
  }

  if (report.maniacKilled) {
    parts.push(
      `Маньяк убил ${playerNick(report.maniacKilled)} (${getRoleLabel(report.maniacKilled.role)})!`
    );
  }

  if (report.wifeKilled) {
    parts.push(
      `Жена комиссара отомстила — убила ${playerNick(report.wifeKilled)} (${getRoleLabel(report.wifeKilled.role)})!`
    );
  }

  if (report.clownSwapped) {
    const [a, b] = report.clownSwapped;
    parts.push(`Клоун поменял роли ${playerNick(a)} и ${playerNick(b)}!`);
  }

  if (report.mafiaTied) {
    parts.push('Мафия не договорилась о жертве — от их рук никто не пострадал.');
  } else if (report.mafiaAttacked) {
    if (report.highlanderAttacked) {
      parts.push(
        `Мафия напала на ${playerNick(report.highlanderAttacked)}, но горец пережил атаку!`
      );
    } else if (report.mafiaKilled) {
      parts.push(
        `Мафия убила ${playerNick(report.mafiaKilled)} (${getRoleLabel(report.mafiaKilled.role)})!`
      );
    } else if (
      report.doctorHealed &&
      report.mafiaAttacked.id === report.doctorHealed.id
    ) {
      parts.push(
        `Мафия напала на ${playerNick(report.mafiaAttacked)}, но доктор спас ${playerNick(report.mafiaAttacked)}!`
      );
    } else {
      parts.push(`Мафия выбрала жертвой ${playerNick(report.mafiaAttacked)}.`);
    }
  }

  parts.push(getMorningIntroMessage(report.killed));
  return parts.join('\n');
}

/** @deprecated Use buildMorningReportMessage */
export function buildMorningReportMessages(room: GameRoom, report: NightReport): string[] {
  return [buildMorningReportMessage(room, report, true)];
}

export function getCommissarCheckResultMessage(target: GamePlayer): string {
  const role = getRoleLabel(target.role);
  const verdict = isEvil(target.role) ? 'Это мафия (или зло)!' : 'Это не мафия.';
  return `🔍 Результат проверки: ${playerNick(target)} — ${role}. ${verdict}`;
}

export function getHomelessCheckResultMessage(target: GamePlayer): string {
  return `🔍 Результат проверки: ${playerNick(target)} — ${getRoleLabel(target.role)}.`;
}

export function getHangVerdictMessage(player: GamePlayer): string {
  return `Город решил повесить ${playerNick(player)}. Он оказался ${getRoleLabel(player.role)}.`;
}

export function getVotingTieMessage(): string {
  return 'Голоса разделились — никто не был повешен этим днём.';
}

export function getDayDiscussionMessage(dayNumber: number): string {
  return `☀️ День ${dayNumber}. Обсуждайте подозреваемых и готовьтесь к голосованию.`;
}

export function getVotingStartMessage(): string {
  return '🗳️ Голосование началось! Выберите, кого повесить.';
}

export function getRolesRevealSystemMessage(_playerCount: number): string {
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

const MANIAC_ATMOSPHERE = ['Где-то в темноте маньяк выбирает новую жертву...'];

export function getNightFallMessage(): string {
  return pick(NIGHT_FALL);
}

/** Одно атмосферное сообщение для роли после ночного хода (или null). */
export function getRoleNightAtmosphereMessage(role: RoleId): string | null {
  switch (role) {
    case 'mafia':
      return pick(MAFIA_ATMOSPHERE);
    case 'commissar':
      return pick(COMMISSAR_ATMOSPHERE);
    case 'doctor':
      return pick(DOCTOR_ATMOSPHERE);
    case 'maniac':
      return pick(MANIAC_ATMOSPHERE);
    default:
      return null;
  }
}

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
    const nick = playerNick(p);
    if (p.role === 'commissar') {
      return `Не все дожили до рассвета — среди погибших комиссар ${nick}.`;
    }
    if (isMafia(p.role)) {
      return `${nick} (${role}) не дожил(а) до утра.`;
    }
    return `${nick} (${role}) не дожил(а) до утра.`;
  });

  return `Вот и день наступил. Но все ли дожили до него? ${parts.join(' ')}`;
}

export function getGameEndRolesMessage(room: GameRoom): string {
  const lines = room.players
    .filter((p) => p.inGame && p.role)
    .map((p) => `${playerNick(p)} — ${getRoleLabel(p.role)}`);
  return `А роли были такие: ${lines.join(', ')}`;
}

export function getScoreSummaryMessage(room: GameRoom): string {
  const scorers = room.players
    .filter((p) => p.inGame)
    .map((p) => `${playerNick(p)}: ${p.score}`)
    .join(', ');
  return scorers ? `За эту игру заработали очков: ${scorers}` : '';
}

export function getRoleLabelRu(role: RoleId | null | undefined): string {
  if (!role) return '';
  return ROLE_LABELS[role] || role;
}
