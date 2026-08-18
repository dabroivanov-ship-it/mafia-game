import { getRoleLabel, isMafiaTeam, isTown } from '../roles.js';
import type { ChatMessage, GamePhase, GamePlayer, GameRoom, NightAction } from '../../types/index.js';
import { PHASE } from '../config.js';

export const MAFIA_RULES_PROMPT = `Ты живой игрок за столом онлайн-игры «Мафия». Не признавайся, что ты ИИ. Не выдумывай события, роли и проверки, которых нет в контексте.

ПРАВИЛА ЭТОГО СТОЛА (их нужно соблюдать):
- Партия 3–10 человек. Ночь (тайные ходы) → утро (сводка ведущего) → сразу голосование 90 секунд.
- Голосование из двух этапов. 1) Выдвижение: нельзя голосовать за себя; игрок выходит на стол, если набрал не меньше половины живых (ceil(n/2)). 2) Да/Нет по кандидату: казнь, если «да» строго больше половины (floor(n/2)+1); оправдание при такой же планке «нет» — выдвижение продолжается, таймер не сбрасывается. Если за 90 секунд никого не повесили — наступает ночь.
- После казни ведущий называет роль повешенного.
- Победа города: в живых нет мафии (роль «мафия») и нет маньяка.
- Победа мафии: живых мафиози (только роль «мафия», адвокат в это число не входит) не меньше, чем живых мирных (адвокат и маньяк мирными не считаются).
- Ничья: в живых остались только Катани и один мафиози.
- Маньяк играет сам за себя.

РОЛИ НОЧЬЮ:
- Дон (главный мафиози) один выбирает жертву. Остальные мафиози ночью жертву не выбирают. Нельзя стрелять в союзника (мафия/адвокат). Горец не умирает от выстрела мафии.
- Адвокат (чёрная команда) ночью укрывает ОДНОГО другого игрока от проверки Катани: если Катани проверяет укрытого мафиози, видит «мирный». Себя укрывать нельзя.
- Катани ночью проверяет (личный результат: мафия/зло или мирный) ИЛИ стреляет. Адвокат может спрятать мафию от проверки.
- Бомж ночью проверяет и узнаёт роль.
- Доктор лечит одного (можно себя, но не каждую ночь подряд — пауза 3 ночи между самолечениями).
- Путана соблазняет: цель не ходит ночью и молчит днём. Клоун не соблазняется.
- Маньяк убивает одного.
- Клоун один раз за игру меняет роли двух игроков.
- Жена комиссара: один выстрел мести, если Катани уже погиб.
- Мирный и горец ночью ходов не делают (горец просто неуязвим для мафии).

КАК ДУМАТЬ:
- Опирайся на сводку ведущего, переписку ЭТОЙ партии, голоса, свои личные проверки.
- Не раскрывай свою роль без крайней нужды. Мафия и адвокат врут. Город ищет чёрных.
- Не повторяй одни и те же фразы. Говори коротко, по делу, как за столом.`;

export function phaseLabel(phase: GamePhase): string {
  switch (phase) {
    case PHASE.DAY:
      return 'дневное обсуждение';
    case PHASE.VOTING:
      return 'голосование';
    case PHASE.NIGHT:
      return 'ночь';
    case PHASE.REGISTRATION:
      return 'регистрация';
    case PHASE.ROLES:
      return 'раздача ролей';
    case PHASE.ENDED:
      return 'игра окончена';
    default:
      return 'ожидание';
  }
}

export function alivePlayers(room: GameRoom, opts?: { excludeId?: number; includeSelf?: boolean }): GamePlayer[] {
  const excludeId = opts?.excludeId;
  return room.players.filter((p) => {
    if (!p.alive || !p.inGame || !p.role || !p.connected) return false;
    if (excludeId != null && p.id === excludeId && !opts?.includeSelf) return false;
    return true;
  });
}

export function nightTargetsForBot(bot: GamePlayer, room: GameRoom): GamePlayer[] {
  const others = alivePlayers(room, { excludeId: bot.id });
  if (bot.role === 'mafia' && bot.isDon) {
    return others.filter((p) => !isMafiaTeam(p.role));
  }
  if (bot.role === 'doctor') {
    return alivePlayers(room, { includeSelf: true });
  }
  if (bot.role === 'advocate') {
    return others;
  }
  return others;
}

export function canDoctorSelfHeal(room: GameRoom): boolean {
  return room.nightNumber - room.doctorLastSelfHealNight >= 3;
}

function voteTally(votes: Record<number, number>): { id: number; name: string; count: number }[] {
  const counts = new Map<number, number>();
  for (const targetId of Object.values(votes)) {
    counts.set(targetId, (counts.get(targetId) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([id, count]) => ({ id, name: '', count }))
    .sort((a, b) => b.count - a.count);
}

export function buildRoleStrategy(bot: GamePlayer, room: GameRoom): string {
  const role = bot.role;
  if (!role) return '';

  if (role === 'mafia') {
    if (bot.isDon) {
      return [
        'СТРАТЕГИЯ ДОНА:',
        'Ночью убивай опасных для мафии: тех, кто ведёт город, кого могут счесть Катани, кто давит на твоих союзников.',
        'Не стреляй в адвоката и других мафиози. Если ведущий сказал, что горец пережил атаку — больше не трать выстрел на него.',
        'Днём изображай мирного. Не защищай союзника слишком яро. На голосовании лучше идти с городом против постороннего, чем спасать мафа ценой палева.',
        'Если на столе союзник — голосуй «нет». Если на столе опасный мирный — «да».',
      ].join('\n');
    }
    return [
      'СТРАТЕГИЯ МАФИОЗИ:',
      'Ночью жертву выбирает только дон — ты ждёшь.',
      'Днём не пали команду. Поддакивай городу, голосуй как большинство, не спасай союзника слишком явно.',
    ].join('\n');
  }

  if (role === 'advocate') {
    return [
      'СТРАТЕГИЯ АДВОКАТА:',
      'Ты за мафию. Ночью укрывай дона или самого паленого мафиози от Катани. Себя укрывать нельзя.',
      'Днём молчи или будь «тихим мирным». Раскрытие адвоката выдаёт размер чёрной команды.',
    ].join('\n');
  }

  if (role === 'commissar') {
    return [
      'СТРАТЕГИЯ КАТАНИ:',
      'Первые ночи обычно проверяй, не стреляй вслепую — ошибка казнит мирного.',
      'Не проверяй повторно того, кого уже проверял (смотри личные результаты).',
      'Если проверка показала зло — либо стреляй ночью, либо аккуратно выводи на голосование, не свети роль без нужды.',
      'Помни: адвокат может показать мафиози как «мирного».',
    ].join('\n');
  }

  if (role === 'homeless') {
    return [
      'СТРАТЕГИЯ БОМЖА:',
      'Проверяй тех, кого ещё не проверял. Результат роли — только тебе.',
      'Днём используй знание осторожно, не выдавай, что ты бомж, если это опасно.',
    ].join('\n');
  }

  if (role === 'doctor') {
    const self = canDoctorSelfHeal(room)
      ? 'Себя сейчас лечить можно.'
      : 'Себя сейчас лечить нельзя (недавно уже лечил).';
    return [
      'СТРАТЕГИЯ ДОКТОРА:',
      'Лечи вероятного Катани или того, кого мафия явно хочет снять. Если неясно — важного говоруна или себя.',
      self,
    ].join('\n');
  }

  if (role === 'prostitute') {
    return 'СТРАТЕГИЯ ПУТАНЫ: соблазняй вероятного дона/мафиози или того, кто слишком давит ночью. Не трать ход на клоуна — он не соблазняется.';
  }

  if (role === 'maniac') {
    return [
      'СТРАТЕГИЯ МАНЬЯКА:',
      'Ты не с городом и не с мафией. Убивай сильных: Катани, доктора, мафию — кто мешает остаться тебе.',
      'Днём прикидывайся мирным. Не голосуй так, чтобы тебя сразу вычислили.',
    ].join('\n');
  }

  if (role === 'clown') {
    return room.clownUsed
      ? 'Клоунский обмен уже использован. Дальше играй как внимательный мирный.'
      : 'СТРАТЕГИЯ КЛОУНА: обмен ролей — один раз. Меняй, только если это ломает мафию или спасает город, не ради хаоса.';
  }

  if (role === 'commissar_wife') {
    if (room.wifeRevengeAvailable && !room.wifeRevengeUsed) {
      return 'Катани погиб — у тебя один выстрел мести. Стреляй в самого вероятного мафиози по сводке и чату.';
    }
    return 'Пока Катани жив, ты тихий мирный. Не свети, что ты жена комиссара.';
  }

  if (role === 'highlander') {
    return 'Ты горец: мафия тебя ночью не убьёт, но казнь и маньяк опасны. Играй как уверенный мирный.';
  }

  return 'СТРАТЕГИЯ МИРНОГО: слушай сводку, сравнивай, кто давит и кто отмазывает. Выдвигай самых подозрительных, не раскачивай стол без фактов.';
}

function formatChatLines(messages: ChatMessage[], limit: number): string {
  return messages
    .filter((m) => !m.deleted)
    .slice(-limit)
    .map((m) => {
      const to = m.toPlayerName ? ` → ${m.toPlayerName}` : '';
      return `${m.playerName}${to}: ${m.text}`;
    })
    .join('\n');
}

export function buildGameContextForBot(
  room: GameRoom,
  bot: GamePlayer,
  trigger?: { authorName: string; authorId: number; text: string; toPlayerId?: number | null }
): string {
  const dayNumber = room.nightNumber + (room.phase === PHASE.NIGHT ? 0 : 1);
  const alive = alivePlayers(room, { includeSelf: true });
  const dead = room.players.filter((p) => p.inGame && p.role && !p.alive);
  const n = alive.length;
  const nominateNeed = Math.ceil(n / 2);
  const hangNeed = Math.floor(n / 2) + 1;

  const playerLines = room.players
    .filter((p) => p.inGame && p.role)
    .map((p) => {
      const you = p.id === bot.id ? ', это ты' : '';
      const don = p.id === bot.id && bot.isDon ? ', ты дон' : '';
      if (p.id === bot.id) {
        return `#${p.id} ${p.username} — жив${you}, роль: ${getRoleLabel(p.role)}${don}`;
      }
      if (!p.alive) {
        return `#${p.id} ${p.username} — мёртв (роль названа ведущим, если была казнь/разоблачение)`;
      }
      if (isMafiaTeam(bot.role) && isMafiaTeam(p.role)) {
        const mark = p.isDon ? ', дон' : '';
        return `#${p.id} ${p.username} — жив, союзник (${getRoleLabel(p.role)}${mark})`;
      }
      return `#${p.id} ${p.username} — жив, роль тебе неизвестна`;
    })
    .join('\n');

  const hostEvents = formatChatLines(
    room.chat.filter((m) => m.system),
    16
  );

  const playerChat = formatChatLines(
    room.chat.filter((m) => !m.system && m.playerId != null),
    28
  );

  const privateNotes = formatChatLines(
    (room.privateChat || []).filter(
      (m) => m.system && m.isPrivate && m.toPlayerId === bot.id
    ),
    12
  );

  const mafiaChat =
    isMafiaTeam(bot.role) && room.mafiaChat.length
      ? formatChatLines(room.mafiaChat, 12)
      : '';

  let votingInfo = '';
  if (room.phase === PHASE.VOTING) {
    const eligible = n;
    if (room.votingStage === 'confirm' && room.accusedId != null) {
      const accused = room.players.find((p) => p.id === room.accusedId);
      const yes = Object.values(room.hangVotes).filter(Boolean).length;
      const no = Object.values(room.hangVotes).filter((v) => !v).length;
      const hangLines = Object.entries(room.hangVotes)
        .map(([voterId, voteYes]) => {
          const voter = room.players.find((p) => p.id === Number(voterId));
          return `${voter?.username ?? voterId}: ${voteYes ? 'да (казнить)' : 'нет (оправдать)'}`;
        })
        .join('\n');
      votingInfo = [
        `Этап: Да/Нет по кандидату ${accused?.username ?? room.accusedId} (#${room.accusedId}).`,
        `Для казни или оправдания нужно ${hangNeed} из ${eligible}. Сейчас да=${yes}, нет=${no}.`,
        hangLines ? `Голоса Да/Нет:\n${hangLines}` : 'Пока никто не нажал Да/Нет.',
      ].join('\n');
    } else {
      const tally = voteTally(room.votes).map((row) => {
        const t = room.players.find((p) => p.id === row.id);
        return `${t?.username ?? row.id}: ${row.count}`;
      });
      const voteLines = Object.entries(room.votes)
        .map(([voterId, targetId]) => {
          const voter = room.players.find((p) => p.id === Number(voterId));
          const target = room.players.find((p) => p.id === targetId);
          return `${voter?.username ?? voterId} выдвигает ${target?.username ?? targetId}`;
        })
        .join('\n');
      votingInfo = [
        `Этап: выдвижение. Чтобы вывести на стол, нужно ${nominateNeed} голосов из ${eligible}.`,
        tally.length ? `Счёт: ${tally.join('; ')}` : 'Голосов пока нет.',
        voteLines ? `Кто за кого:\n${voteLines}` : '',
      ]
        .filter(Boolean)
        .join('\n');
    }
  }

  const counts = [
    `Живых за столом: ${alive.length}. Выбыло: ${dead.length}.`,
    `Фаза: ${phaseLabel(room.phase)}. ${room.phase === PHASE.NIGHT ? `Ночь ${room.nightNumber}` : `День ${dayNumber}`}.`,
  ];

  if (bot.role === 'doctor') {
    counts.push(
      canDoctorSelfHeal(room)
        ? 'Самолечение сейчас доступно.'
        : 'Самолечение сейчас недоступно.'
    );
  }

  const parts = [
    `=== Партия, комната «${room.name}» ===`,
    counts.join(' '),
    `Твоя роль: ${getRoleLabel(bot.role)}${bot.isDon ? ' (дон)' : ''}.`,
    `Игроки:\n${playerLines}`,
    hostEvents ? `Ведущий (факты этой игры):\n${hostEvents}` : '',
    privateNotes ? `Личные сообщения ведущего только тебе (проверки и подсказки):\n${privateNotes}` : '',
    mafiaChat ? `Ночной чат мафии:\n${mafiaChat}` : '',
    votingInfo ? `Голосование:\n${votingInfo}` : '',
    playerChat ? `Общий чат этой партии:\n${playerChat}` : 'В общем чате пока тихо.',
    buildRoleStrategy(bot, room),
  ];

  if (trigger) {
    parts.push(
      `=== Сообщение игрока ===\n${trigger.authorName} (#${trigger.authorId}): «${trigger.text}»`
    );
    if (trigger.toPlayerId === bot.id) {
      parts.push('Это обращение лично к тебе — ответь по фактам партии.');
    }
  }

  return parts.filter(Boolean).join('\n\n');
}

export function isBotAlly(bot: GamePlayer, other: GamePlayer): boolean {
  if (bot.id === other.id) return true;
  return Boolean(isMafiaTeam(bot.role) && isMafiaTeam(other.role));
}

export function heuristicNominateTarget(
  bot: GamePlayer,
  room: GameRoom,
  targets: GamePlayer[]
): GamePlayer | null {
  if (!targets.length) return null;
  const enemies = targets.filter((p) => !isBotAlly(bot, p));
  const pool = enemies.length ? enemies : targets;

  const counts = new Map<number, number>();
  for (const targetId of Object.values(room.votes)) {
    counts.set(targetId, (counts.get(targetId) || 0) + 1);
  }
  pool.sort((a, b) => (counts.get(b.id) || 0) - (counts.get(a.id) || 0));
  const lead = pool[0];
  if (lead && (counts.get(lead.id) || 0) > 0) return lead;
  return pool[Math.floor(Math.random() * pool.length)] ?? null;
}

export function heuristicHangYes(bot: GamePlayer, room: GameRoom): boolean {
  const accused = room.players.find((p) => p.id === room.accusedId);
  if (!accused) return false;
  if (accused.id === bot.id) return false;
  if (isBotAlly(bot, accused)) return false;
  if (isMafiaTeam(bot.role)) return true;
  if (isTown(bot.role)) {
    const yes = Object.values(room.hangVotes).filter(Boolean).length;
    const no = Object.values(room.hangVotes).filter((v) => !v).length;
    if (no > yes) return false;
    return true;
  }
  return true;
}

function alreadyCheckedIds(bot: GamePlayer, room: GameRoom): Set<number> {
  const ids = new Set<number>();
  const notes = (room.privateChat || []).filter(
    (m) => m.system && m.isPrivate && m.toPlayerId === bot.id
  );
  for (const note of notes) {
    for (const p of room.players) {
      if (p.id === bot.id) continue;
      if (note.text.includes(p.username) || note.text.includes(p.name)) {
        ids.add(p.id);
      }
    }
  }
  return ids;
}

function noteSaysEvil(bot: GamePlayer, room: GameRoom, player: GamePlayer): boolean {
  const notes = (room.privateChat || []).filter(
    (m) => m.system && m.isPrivate && m.toPlayerId === bot.id
  );
  return notes.some((m) => {
    const about = m.text.includes(player.username) || m.text.includes(player.name);
    if (!about) return false;
    const lower = m.text.toLowerCase();
    return lower.includes('мафия') || lower.includes('зло');
  });
}

export function heuristicNightAction(bot: GamePlayer, room: GameRoom): NightAction | null {
  const targets = nightTargetsForBot(bot, room);
  if (!bot.role || !targets.length) return null;

  const pick = (pool: GamePlayer[]): GamePlayer | null => {
    if (!pool.length) return null;
    return pool[Math.floor(Math.random() * pool.length)] ?? null;
  };

  switch (bot.role) {
    case 'mafia': {
      if (!bot.isDon) return null;
      const target = pick(targets);
      return target ? { type: 'kill', targetId: target.id } : null;
    }
    case 'maniac': {
      const target = pick(targets);
      return target ? { type: 'kill', targetId: target.id } : null;
    }
    case 'commissar': {
      const evil = targets.find((p) => noteSaysEvil(bot, room, p));
      if (evil && room.nightNumber > 1) {
        return { type: 'kill', targetId: evil.id };
      }
      const checked = alreadyCheckedIds(bot, room);
      const fresh = targets.filter((p) => !checked.has(p.id));
      const target = pick(fresh.length ? fresh : targets);
      if (!target) return null;
      return room.nightNumber <= 1 || !evil
        ? { type: 'check', targetId: target.id }
        : { type: 'kill', targetId: target.id };
    }
    case 'homeless': {
      const checked = alreadyCheckedIds(bot, room);
      const fresh = targets.filter((p) => !checked.has(p.id));
      const target = pick(fresh.length ? fresh : targets);
      return target ? { type: 'check', targetId: target.id } : null;
    }
    case 'doctor': {
      const selfOk = canDoctorSelfHeal(room);
      const others = targets.filter((p) => p.id !== bot.id);
      if (room.nightNumber <= 1 && selfOk) {
        return { type: 'heal', targetId: bot.id };
      }
      const heal = pick(others.length ? others : targets);
      return heal ? { type: 'heal', targetId: heal.id } : null;
    }
    case 'prostitute': {
      const target = pick(targets);
      return target ? { type: 'seduce', targetId: target.id } : null;
    }
    case 'advocate': {
      const allies = targets.filter((p) => isMafiaTeam(p.role));
      const cover = pick(allies.length ? allies : targets.filter((p) => p.id !== bot.id));
      return cover && cover.id !== bot.id ? { type: 'cover', targetId: cover.id } : null;
    }
    case 'clown': {
      if (room.clownUsed) return null;
      const first = pick(targets);
      if (!first) return null;
      const second = pick(targets.filter((p) => p.id !== first.id));
      if (!second) return null;
      return { type: 'swap', targetId: first.id, targetId2: second.id };
    }
    case 'commissar_wife': {
      if (!room.wifeRevengeAvailable || room.wifeRevengeUsed) return null;
      const target = pick(targets);
      return target ? { type: 'revenge', targetId: target.id } : null;
    }
    default:
      return null;
  }
}

export function nightInstruction(bot: GamePlayer, room: GameRoom): string {
  if (!bot.role) return '';
  if (bot.role === 'mafia' && !bot.isDon) return '';
  const ids = nightTargetsForBot(bot, room)
    .map((p) => `#${p.id} ${p.username}`)
    .join(', ');
  const suffix = ids ? ` Доступные цели: ${ids}.` : '';

  switch (bot.role) {
    case 'mafia':
      return `Выбери жертву дона. Не стреляй в союзников.${suffix} JSON: {"action":"kill","targetId":число,"reason":"..."}`;
    case 'commissar':
      return `Проверь нового игрока или стреляй, если уже знаешь зло. Не проверяй повторно без нужды.${suffix} JSON: {"action":"check"|"kill","targetId":число,"reason":"..."}`;
    case 'doctor':
      return `Кого лечить? ${canDoctorSelfHeal(room) ? 'Себя можно.' : 'Себя нельзя.'}${suffix} JSON: {"action":"heal","targetId":число,"reason":"..."}`;
    case 'prostitute':
      return `Кого соблазнить, чтобы выключить ночной ход?${suffix} JSON: {"action":"seduce","targetId":число,"reason":"..."}`;
    case 'homeless':
      return `Проверь того, кого ещё не проверял.${suffix} JSON: {"action":"check","targetId":число,"reason":"..."}`;
    case 'maniac':
      return `Убей того, кто мешает тебе остаться последним.${suffix} JSON: {"action":"kill","targetId":число,"reason":"..."}`;
    case 'clown':
      return `Поменяй роли двух игроков, только если это полезно городу.${suffix} JSON: {"action":"swap","targetId":число,"targetId2":число,"reason":"..."}`;
    case 'commissar_wife':
      return `Один выстрел мести — в вероятного мафиози.${suffix} JSON: {"action":"revenge","targetId":число,"reason":"..."}`;
    case 'advocate':
      return `Укрыть союзника от Катани (не себя).${suffix} JSON: {"action":"cover","targetId":число,"reason":"..."}`;
    default:
      return '';
  }
}
