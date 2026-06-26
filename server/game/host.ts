import { CONFIG } from './config.js';

import { getRoleLabel, isEvil, isMafia } from './roles.js';

import {

  getPhraseText,

  pickPhraseLine,

  renderPhraseTemplate,

} from './botPhrases.js';

import type { GamePlayer, GameRoom, PrivateNote, RoleId } from '../types/index.js';



export function playerNick(p: Pick<GamePlayer, 'username' | 'name'>): string {
  return p.username || p.name;
}

function getCommissarKillReportLine(target: GamePlayer): string {
  const nick = playerNick(target);
  if (target.isDon) {
    return getPhraseText('report.commissar_kill_don', { nick });
  }
  if (isMafia(target.role) || target.role === 'advocate') {
    return getPhraseText('report.commissar_kill_mafioso', { nick });
  }
  return getPhraseText('report.commissar_kill_other', { nick });
}



function aliveNames(room: GameRoom, excludeId?: number): string[] {

  return room.players

    .filter((p) => p.alive && p.inGame && p.role && p.id !== excludeId)

    .map((p) => playerNick(p));

}



function withPlayerList(prompt: string, room: GameRoom, excludeId?: number): string {

  const targets = aliveNames(room, excludeId);

  if (!targets.length) return prompt;

  return `${prompt}${getPhraseText('prompt.players_suffix', { list: targets.join(', ') })}`;

}



function nightActionPrompt(player: GamePlayer, room: GameRoom): string {

  if (!player.role || !player.alive) return 'Ожидайте следующей фазы.';



  let prompt: string;

  switch (player.role) {

    case 'mafia':

      prompt = player.isDon

        ? getPhraseText('prompt.mafia.don')

        : getPhraseText('prompt.mafia');

      break;

    case 'commissar':

      prompt = getPhraseText('prompt.commissar');

      break;

    case 'doctor':

      prompt = getPhraseText('prompt.doctor');

      break;

    case 'homeless':

      prompt = getPhraseText('prompt.homeless');

      break;

    case 'prostitute':

      prompt = getPhraseText('prompt.prostitute');

      break;

    case 'maniac':

      prompt = getPhraseText('prompt.maniac');

      break;

    case 'clown':

      prompt = room.clownUsed

        ? getPhraseText('prompt.clown_used')

        : getPhraseText('prompt.clown');

      break;

    case 'commissar_wife':

      prompt =

        room.wifeRevengeAvailable && !room.wifeRevengeUsed

          ? getPhraseText('prompt.wife_revenge')

          : getPhraseText('prompt.wife_idle');

      break;

    case 'highlander':

      prompt = getPhraseText('prompt.highlander');

      break;

    case 'advocate':

      prompt = getPhraseText('prompt.advocate');

      break;

    default:

      prompt = getPhraseText('prompt.civilian');

  }



  return withPlayerList(prompt, room, player.id);

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

      message: getPhraseText('note.role_reveal', {

        role: roleLine,

        donLine,

        hint: actionHint(player, room),

      }),

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

      player.role === 'advocate' ||

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

      message: getPhraseText('note.night_reminder', {

        night: room.nightNumber,

        prompt: nightActionPrompt(player, room),

      }),

    });

  }

  return notes;

}



export function buildDayDiscussionNotes(room: GameRoom): PrivateNote[] {

  const notes: PrivateNote[] = [];

  const day = room.nightNumber + 1;

  for (const player of room.players.filter((p) => p.alive && p.inGame && p.role)) {

    notes.push({

      playerId: player.id,

      message: getPhraseText('day.discussion_private', { day }),

    });

  }

  return notes;

}



export function buildVotingReminderNotes(room: GameRoom): PrivateNote[] {

  const notes: PrivateNote[] = [];

  const alive = room.players.filter((p) => p.alive && p.inGame && p.role);

  for (const player of alive) {

    const others = aliveNames(room, player.id);

    const othersLine = others.length

      ? getPhraseText('note.voting_others', { list: others.join(', ') })

      : '';

    notes.push({

      playerId: player.id,

      message: getPhraseText('note.voting_reminder', { others: othersLine }),

    });

  }

  return notes;

}



export interface NightReport {

  prostituteSeduced?: GamePlayer;

  commissarChecked?: GamePlayer;

  commissarKilled?: GamePlayer;

  homelessChecked?: GamePlayer;

  advocateCovered?: GamePlayer;

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
    parts.push(getCommissarKillReportLine(report.commissarKilled));
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



  if (report.advocateCovered) {

    parts.push(`Адвокат укрыл ${playerNick(report.advocateCovered)} от проверки Катани.`);

  }



  if (report.maniacKilled) {
    parts.push(
      getPhraseText('report.maniac_kill', { nick: playerNick(report.maniacKilled) })
    );
  }



  if (report.wifeKilled) {
    parts.push(getPhraseText('report.wife_kill', { nick: playerNick(report.wifeKilled) }));
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
      parts.push(getPhraseText('report.mafia_kill', { nick: playerNick(report.mafiaKilled) }));
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



  if (!hadActions) {
    parts.push(getMorningIntroMessage(report.killed));
  }

  return parts.join('\n');

}



/** @deprecated Use buildMorningReportMessage */

export function buildMorningReportMessages(room: GameRoom, report: NightReport): string[] {

  return [buildMorningReportMessage(room, report, true)];

}



export function getCommissarCheckResultMessage(target: GamePlayer, coveredFromCheck = false): string {

  const masked = coveredFromCheck && isMafia(target.role);

  const role = masked

    ? getPhraseText('check.commissar_masked_role')

    : getRoleLabel(target.role);

  const verdict = masked || !isEvil(target.role)

    ? getPhraseText('check.commissar_verdict_town')

    : getPhraseText('check.commissar_verdict_evil');

  return getPhraseText('check.commissar', {

    nick: playerNick(target),

    role,

    verdict,

  });

}



export function getHomelessCheckResultMessage(target: GamePlayer): string {

  return getPhraseText('check.homeless', {

    nick: playerNick(target),

    role: getRoleLabel(target.role),

  });

}



export function getHangVerdictMessage(player: GamePlayer): string {

  return getPhraseText('voting.hang', {

    nick: playerNick(player),

    role: getRoleLabel(player.role),

  });

}



export function getVotingTieMessage(): string {

  return getPhraseText('voting.tie');

}



export function getVotingCountMessage(): string {

  return getPhraseText('voting.count');

}



export function getVotingRestartMessage(): string {

  return getPhraseText('voting.restart');

}



export function getDayDiscussionMessage(dayNumber: number): string {

  return getPhraseText('day.discussion', { day: dayNumber });

}



export function getVotingStartMessage(): string {

  return getPhraseText('voting.start');

}



export function getRolesRevealSystemMessage(_playerCount: number): string {

  return getPhraseText('game.roles_reveal', { seconds: CONFIG.ROLE_REVEAL_SEC });

}



export function getGameStartSystemMessage(playerCount: number): string {

  return getPhraseText('game.start', { count: playerCount });

}



export function getNightFallMessage(): string {

  return pickPhraseLine('night.fall');

}



/** Одно атмосферное сообщение для роли после ночного хода (или null). */

export function getRoleNightAtmosphereMessage(role: RoleId): string | null {

  switch (role) {

    case 'mafia':

      return pickPhraseLine('atmosphere.mafia');

    case 'commissar':

      return pickPhraseLine('atmosphere.commissar');

    case 'doctor':

      return pickPhraseLine('atmosphere.doctor');

    case 'maniac':

      return pickPhraseLine('atmosphere.maniac');

    case 'advocate':

      return pickPhraseLine('atmosphere.advocate');

    default:

      return null;

  }

}



export function getNightAtmosphereMessages(room: GameRoom): string[] {

  const messages = [pickPhraseLine('night.fall')];



  if (room.players.some((p) => p.alive && p.role === 'mafia')) {

    messages.push(pickPhraseLine('atmosphere.mafia'));

  }

  if (room.players.some((p) => p.alive && p.role === 'commissar')) {

    messages.push(pickPhraseLine('atmosphere.commissar'));

  }

  if (room.players.some((p) => p.alive && p.role === 'doctor')) {

    messages.push(pickPhraseLine('atmosphere.doctor'));

  }

  if (room.players.some((p) => p.alive && p.role === 'maniac')) {

    messages.push(pickPhraseLine('atmosphere.maniac'));

  }



  return messages;

}



export function getNightCompleteMessage(): string {

  return getPhraseText('night.complete');

}



export function getMorningIntroMessage(killed: GamePlayer[]): string {
  if (killed.length === 0) {
    return getPhraseText('morning.all_alive');
  }
  return getPhraseText('morning.after_kills');
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

  return getRoleLabel(role);

}


