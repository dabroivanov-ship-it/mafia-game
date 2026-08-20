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

/** Роль жертвы в винительном падеже для сводки ночи: «мафия убила комиссара nick». */
const KILL_TARGET_ROLE: Record<RoleId, string> = {
  mafia: 'мафиози',
  commissar: 'комиссара Катани',
  doctor: 'доктора',
  homeless: 'бомжа',
  prostitute: 'путану',
  maniac: 'маньяка',
  clown: 'клоуна',
  commissar_wife: 'жену комиссара',
  highlander: 'горца',
  civilian: 'мирного жителя',
  advocate: 'адвоката',
};

function getKillTargetRolePhrase(target: GamePlayer): string {
  if (target.isDon) return 'главаря мафии';
  if (!target.role) return 'игрока';
  return KILL_TARGET_ROLE[target.role] || getRoleLabel(target.role).toLowerCase();
}

function killReportVars(target: GamePlayer): { nick: string; role: string; roleName: string } {
  return {
    nick: playerNick(target),
    role: getKillTargetRolePhrase(target),
    roleName: target.role ? getRoleLabel(target.role) : 'игрок',
  };
}

function morningDeathLabel(player: GamePlayer): string {
  const nick = playerNick(player);
  if (player.role === 'commissar') return `комиссар Катани ${nick}`;
  if (player.isDon) return `главарь мафии ${nick}`;
  if (player.role === 'mafia') return `мафия ${nick}`;
  if (player.role === 'commissar_wife') return `жена комиссара ${nick}`;
  if (player.role === 'civilian') return `мирный житель ${nick}`;
  const role = player.role ? getRoleLabel(player.role) : 'игрок';
  return `${role.toLowerCase()} ${nick}`;
}

function morningDeathsLine(killed: GamePlayer[]): string {
  if (killed.length === 0) return '';
  return getPhraseText('morning.deaths', {
    list: killed.map(morningDeathLabel).join(', '),
  });
}

function getCommissarKillReportLine(target: GamePlayer): string {
  const vars = killReportVars(target);
  if (target.isDon) {
    return getPhraseText('report.commissar_kill_don', vars);
  }
  if (isMafia(target.role) || target.role === 'advocate') {
    return getPhraseText('report.commissar_kill_mafioso', vars);
  }
  return getPhraseText('report.commissar_kill_other', vars);
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

        : getPhraseText('prompt.mafia.wait');

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

      (player.role === 'mafia' && player.isDon) ||

      player.role === 'advocate' ||

      player.role === 'commissar' ||

      player.role === 'doctor' ||

      player.role === 'homeless' ||

      player.role === 'prostitute' ||

      player.role === 'maniac' ||

      (player.role === 'clown' && !room.clownUsed) ||

      (player.role === 'commissar_wife' && room.wifeRevengeAvailable && !room.wifeRevengeUsed);



    if (player.role === 'mafia' && !player.isDon) {
      notes.push({
        playerId: player.id,
        message: getPhraseText('prompt.mafia.wait'),
      });
      continue;
    }

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

  commissarSaved?: GamePlayer;

  homelessChecked?: GamePlayer;

  advocateCovered?: GamePlayer;

  doctorHealed?: GamePlayer;

  doctorSelfHeal?: boolean;

  mafiaAttacked?: GamePlayer;

  mafiaKilled?: GamePlayer;

  mafiaNoDecision?: boolean;

  highlanderAttacked?: GamePlayer;

  maniacKilled?: GamePlayer;

  maniacSaved?: GamePlayer;

  wifeKilled?: GamePlayer;

  clownSwapped?: [GamePlayer, GamePlayer];

  killed: GamePlayer[];

}



export function buildMorningReportMessage(
  _room: GameRoom,
  report: NightReport,
  _hadActions: boolean
): string {
  const parts: string[] = [getMorningIntroMessage(report.killed)];

  if (report.commissarChecked) {
    parts.push(
      pickPhraseLine('report.commissar_check', { nick: playerNick(report.commissarChecked) })
    );
  }

  if (report.homelessChecked) {
    parts.push(pickPhraseLine('report.homeless_check', { nick: playerNick(report.homelessChecked) }));
  }

  if (report.prostituteSeduced) {
    parts.push(pickPhraseLine('report.prostitute', { nick: playerNick(report.prostituteSeduced) }));
  }

  if (report.advocateCovered) {
    parts.push(pickPhraseLine('report.advocate_cover', { nick: playerNick(report.advocateCovered) }));
  }

  const doctorSavedThisNight = Boolean(
    report.commissarSaved ||
      report.maniacSaved ||
      (report.mafiaAttacked &&
        report.doctorHealed &&
        report.mafiaAttacked.id === report.doctorHealed.id &&
        !report.mafiaKilled &&
        !report.highlanderAttacked)
  );

  if (report.doctorHealed && !doctorSavedThisNight) {
    const nick = playerNick(report.doctorHealed);
    parts.push(
      report.doctorSelfHeal
        ? pickPhraseLine('report.doctor_self', { nick })
        : pickPhraseLine('report.doctor_heal', { nick })
    );
  }

  if (report.commissarKilled) {
    parts.push(getCommissarKillReportLine(report.commissarKilled));
  } else if (report.commissarSaved) {
    parts.push(pickPhraseLine('report.commissar_saved', { nick: playerNick(report.commissarSaved) }));
  }

  if (report.maniacKilled) {
    parts.push(pickPhraseLine('report.maniac_kill', killReportVars(report.maniacKilled)));
  } else if (report.maniacSaved) {
    parts.push(pickPhraseLine('report.maniac_saved', { nick: playerNick(report.maniacSaved) }));
  }

  if (report.wifeKilled) {
    parts.push(getPhraseText('report.wife_kill', killReportVars(report.wifeKilled)));
  }

  if (report.clownSwapped) {
    const [a, b] = report.clownSwapped;
    parts.push(pickPhraseLine('report.clown_swap', { a: playerNick(a), b: playerNick(b) }));
  }

  if (report.mafiaNoDecision) {
    parts.push(getPhraseText('report.mafia_no_decision'));
  } else if (report.mafiaAttacked) {
    if (report.highlanderAttacked) {
      parts.push(pickPhraseLine('report.highlander', { nick: playerNick(report.highlanderAttacked) }));
    } else if (report.mafiaKilled) {
      parts.push(pickPhraseLine('report.mafia_kill', killReportVars(report.mafiaKilled)));
    } else if (report.doctorHealed && report.mafiaAttacked.id === report.doctorHealed.id) {
      parts.push(pickPhraseLine('report.mafia_saved', { nick: playerNick(report.mafiaAttacked) }));
    }
  }

  const deaths = morningDeathsLine(report.killed);
  if (deaths) parts.push(deaths);

  return parts.filter(Boolean).join(' ');
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



export function getVotingMajorityMessage(votes: number, total: number, name: string): string {

  return getPhraseText('voting.majority', { votes, total, name });

}



export function getHangChoiceMessage(voter: GamePlayer, yes: boolean): string {

  return getPhraseText('voting.hang_choice', {

    voter: playerNick(voter),

    choice: yes ? 'да, казнить' : 'нет, пощадить',

  });

}



export function getVotingSparedMessage(player: GamePlayer): string {

  return getPhraseText('voting.spared', { name: playerNick(player) });

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



export function getVotingTimeoutMessage(): string {

  return getPhraseText('voting.timeout');

}



export function getVotingCastMessage(voter: GamePlayer, target: GamePlayer): string {

  return getPhraseText('voting.cast', {

    voter: playerNick(voter),

    target: playerNick(target),

  });

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

    case 'prostitute':

      return pickPhraseLine('atmosphere.prostitute');

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
  return getPhraseText('morning.intro_prefix');
}



export function getGameEndRolesMessage(room: GameRoom): string {
  const donId =
    room.players.find((p) => p.inGame && p.role === 'mafia' && p.isDon)?.id ??
    room.mafiaDonId;

  const lines = room.players
    .filter((p) => p.inGame && p.alive && p.role)
    .map((p) => {
      const role = getRoleLabel(p.role);
      if (p.role === 'mafia' && p.id === donId) {
        return `${playerNick(p)} — ${role} (главарь)`;
      }
      return `${playerNick(p)} — ${role}`;
    });

  if (!lines.length) return '';
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


