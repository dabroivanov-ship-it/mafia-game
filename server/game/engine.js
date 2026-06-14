import { CONFIG, PHASE } from './config.js';
import { distributeRoles, isMafia, isTown, isEvil, isMafiaImmune, isSeductionImmune, getRoleLabel } from './roles.js';

let nextPlayerId = 1;

export function createInitialRooms() {
  const rooms = new Map();
  for (let i = 1; i <= CONFIG.ROOM_COUNT; i++) {
    rooms.set(i, createRoom(i));
  }
  return rooms;
}

function createRoom(id) {
  return {
    id,
    name: `Комната ${id}`,
    phase: PHASE.WAITING,
    maxPlayers: CONFIG.DEFAULT_MAX_PLAYERS,
    players: [],
    chat: [],
    mafiaChat: [],
    nightNumber: 0,
    timerEnd: null,
    timerReason: null,
    votes: {},
    nightActions: {},
    seducedPlayerId: null,
    commissarAlive: true,
    wifeRevengeAvailable: false,
    wifeRevengeUsed: false,
    clownUsed: false,
    doctorLastSelfHealNight: -999,
    mafiaDonId: null,
    votingStarted: false,
    winnerTeam: null,
    systemMessages: [],
  };
}

export function getLobbySnapshot(rooms) {
  return Array.from(rooms.values()).map((room) => ({
    id: room.id,
    name: room.name,
    playerCount: room.players.filter((p) => p.connected).length,
    maxPlayers: room.maxPlayers,
    phase: room.phase,
  }));
}

export function addPlayerToRoom(room, { name, socketId }) {
  const existing = room.players.find((p) => p.socketId === socketId);
  if (existing) {
    existing.name = name;
    existing.connected = true;
    return existing;
  }

  const connectedCount = room.players.filter((p) => p.connected).length;
  const canJoin = [PHASE.WAITING, PHASE.REGISTRATION].includes(room.phase);
  if (canJoin && connectedCount >= room.maxPlayers) {
    throw new Error('Комната заполнена');
  }

  const player = {
    id: nextPlayerId++,
    name,
    socketId,
    role: null,
    alive: true,
    score: 0,
    connected: true,
    isDon: false,
    hasVoted: false,
    nightActionDone: false,
    leftEarly: false,
  };

  room.players.push(player);

  if (room.phase === PHASE.REGISTRATION && connectedCount + 1 >= room.maxPlayers) {
    tryStartGameAfterRegistration(room);
  }

  return player;
}

export function removePlayer(room, socketId, applyPenalty = true) {
  const player = room.players.find((p) => p.socketId === socketId);
  if (!player) return null;

  const gameActive = ![PHASE.WAITING, PHASE.ENDED].includes(room.phase);

  if (gameActive && applyPenalty && player.alive && player.connected) {
    player.score -= 100;
    player.leftEarly = true;
    addSystemMessage(room, `${player.name} покинул игру (−100 очков).`);
  }

  player.connected = false;
  player.socketId = null;

  if (room.phase === PHASE.WAITING && room.players.every((p) => !p.connected)) {
    resetRoom(room);
  }

  return player;
}

export function reconnectPlayer(room, playerId, socketId, name) {
  const player = room.players.find((p) => p.id === playerId);
  if (!player) return null;
  player.socketId = socketId;
  player.connected = true;
  if (name) player.name = name;
  return player;
}

export function startRegistration(room) {
  if (room.phase !== PHASE.WAITING && room.phase !== PHASE.ENDED) {
    throw new Error('Игра уже идёт');
  }
  if (room.phase === PHASE.ENDED) {
    resetRoom(room);
  }
  room.phase = PHASE.REGISTRATION;
  room.chat = [];
  room.mafiaChat = [];
  room.systemMessages = [];
  addSystemMessage(room, 'Регистрация открыта! Ожидайте других игроков.');
  setTimer(room, CONFIG.REGISTRATION_SEC * 1000, 'registration');
}

export function setTimer(room, ms, reason) {
  room.timerEnd = Date.now() + ms;
  room.timerReason = reason;
}

export function clearTimer(room) {
  room.timerEnd = null;
  room.timerReason = null;
}

export function tryStartGameAfterRegistration(room) {
  if (room.phase !== PHASE.REGISTRATION) return false;
  const connected = room.players.filter((p) => p.connected);
  if (connected.length >= room.maxPlayers) {
    beginGame(room);
    return true;
  }
  return false;
}

export function onRegistrationTimerEnd(room) {
  if (room.phase !== PHASE.REGISTRATION) return;
  const connected = room.players.filter((p) => p.connected);
  if (connected.length < CONFIG.MIN_PLAYERS) {
    room.phase = PHASE.WAITING;
    clearTimer(room);
    addSystemMessage(room, `Недостаточно игроков (минимум ${CONFIG.MIN_PLAYERS}). Игра отменена.`);
    return;
  }
  beginGame(room);
}

function beginGame(room) {
  clearTimer(room);
  room.players = room.players.filter((p) => p.connected);

  const roles = distributeRoles(room.players.length);
  room.players.forEach((p, i) => {
    p.role = roles[i];
    p.alive = true;
    p.score = 0;
    p.isDon = false;
    p.hasVoted = false;
    p.nightActionDone = false;
    p.leftEarly = false;
  });

  const firstMafia = room.players.find((p) => isMafia(p.role));
  if (firstMafia) {
    firstMafia.isDon = true;
    room.mafiaDonId = firstMafia.id;
  }

  room.phase = PHASE.DAY;
  room.nightNumber = 0;
  room.commissarAlive = room.players.some((p) => p.role === 'commissar');
  room.wifeRevengeAvailable = false;
  room.wifeRevengeUsed = false;
  room.clownUsed = false;
  room.doctorLastSelfHealNight = -999;

  addSystemMessage(room, `Игра началась! Игроков: ${room.players.length}. Роли разданы.`);
  startDayPhase(room);
}

export function startDayPhase(room) {
  room.phase = PHASE.DAY;
  room.votes = {};
  room.votingStarted = false;
  room.players.forEach((p) => {
    p.hasVoted = false;
  });
  addSystemMessage(room, `☀️ День ${room.nightNumber + 1}. Обсуждайте и голосуйте.`);
  setTimer(room, CONFIG.DAY_DISCUSSION_SEC * 1000, 'day');
}

export function startVoting(room) {
  if (room.phase !== PHASE.DAY) return;
  room.phase = PHASE.VOTING;
  room.votingStarted = true;
  clearTimer(room);
  room.votes = {};
  room.players.forEach((p) => {
    p.hasVoted = false;
  });
  addSystemMessage(room, '🗳️ Голосование началось! Выберите игрока.');
}

export function onDayTimerEnd(room) {
  if (room.phase === PHASE.DAY) startVoting(room);
}

export function castDayVote(room, voterId, targetId) {
  if (room.phase !== PHASE.VOTING) throw new Error('Сейчас не время голосования');

  const voter = room.players.find((p) => p.id === voterId);
  const target = room.players.find((p) => p.id === targetId);
  if (!voter?.alive || !target?.alive) throw new Error('Недопустимый голос');
  if (voterId === targetId) throw new Error('Нельзя голосовать за себя');

  room.votes[voterId] = targetId;
  voter.hasVoted = true;

  const alive = room.players.filter((p) => p.alive);
  if (alive.every((p) => p.hasVoted)) resolveDayVote(room);
}

function resolveDayVote(room) {
  const tally = {};
  for (const targetId of Object.values(room.votes)) {
    tally[targetId] = (tally[targetId] || 0) + 1;
  }

  let maxVotes = 0;
  let candidates = [];
  for (const [id, count] of Object.entries(tally)) {
    if (count > maxVotes) {
      maxVotes = count;
      candidates = [Number(id)];
    } else if (count === maxVotes) {
      candidates.push(Number(id));
    }
  }

  if (candidates.length === 1 && maxVotes > 0) {
    eliminatePlayer(room, candidates[0]);
  } else {
    addSystemMessage(room, '🗳️ Ничья — никто не выбывает.');
  }

  if (checkWin(room)) return;
  startNightPhase(room);
}

function eliminatePlayer(room, playerId) {
  const player = room.players.find((p) => p.id === playerId);
  if (!player?.alive) return;

  player.alive = false;
  addSystemMessage(room, `💀 ${player.name} выбыл(а)! Роль: ${getRoleLabel(player.role)}.`);

  if (player.role === 'commissar') {
    room.commissarAlive = false;
    const wife = room.players.find((p) => p.role === 'commissar_wife' && p.alive);
    if (wife) {
      room.wifeRevengeAvailable = true;
      room.wifeRevengeUsed = false;
    }
  }

  if (player.role === 'mafia' && player.isDon) {
    const nextMafia = room.players.find((p) => p.alive && p.role === 'mafia');
    room.players.forEach((p) => {
      p.isDon = false;
    });
    if (nextMafia) {
      nextMafia.isDon = true;
      room.mafiaDonId = nextMafia.id;
      addSystemMessage(room, `🎩 ${nextMafia.name} стал(а) главным мафиози.`);
    } else {
      room.mafiaDonId = null;
    }
  }
}

export function startNightPhase(room) {
  room.phase = PHASE.NIGHT;
  room.nightNumber += 1;
  room.nightActions = {};
  room.seducedPlayerId = null;
  room.players.forEach((p) => {
    p.nightActionDone = false;
  });
  addSystemMessage(room, `🌙 Ночь ${room.nightNumber}. Город засыпает...`);
  setTimer(room, CONFIG.NIGHT_ACTIONS_SEC * 1000, 'night');
}

export function onNightTimerEnd(room) {
  if (room.phase === PHASE.NIGHT) return resolveNight(room);
  return null;
}

export function submitNightAction(room, playerId, action) {
  if (room.phase !== PHASE.NIGHT) throw new Error('Сейчас не ночь');

  const player = room.players.find((p) => p.id === playerId);
  if (!player?.alive) throw new Error('Вы не можете действовать');

  room.nightActions[playerId] = action;
  player.nightActionDone = true;

  const needAction = getPlayersNeedingNightAction(room);
  if (needAction.every((p) => p.nightActionDone)) {
    clearTimer(room);
    return resolveNight(room);
  }
  return null;
}

function getPlayersNeedingNightAction(room) {
  return room.players.filter((p) => {
    if (!p.alive) return false;
    if (p.role === 'prostitute') return true;
    if (p.role === 'mafia') return true;
    if (p.role === 'commissar') return true;
    if (p.role === 'maniac') return true;
    if (p.role === 'doctor') return true;
    if (p.role === 'homeless') return true;
    if (p.role === 'clown' && !room.clownUsed) return true;
    if (p.role === 'commissar_wife' && room.wifeRevengeAvailable && !room.wifeRevengeUsed) return true;
    return false;
  });
}

export function resolveNight(room) {
  clearTimer(room);

  const actions = room.nightActions;
  const deaths = new Set();
  const heals = new Set();
  const privateNotes = [];

  const prostitute = room.players.find((p) => p.alive && p.role === 'prostitute');
  if (prostitute && actions[prostitute.id]?.type === 'seduce') {
    const target = room.players.find((p) => p.id === actions[prostitute.id].targetId);
    if (target && !isSeductionImmune(target.role)) {
      room.seducedPlayerId = target.id;
      prostitute.score += 5;
    }
  }

  const isSeduced = (playerId) => {
    const p = room.players.find((pl) => pl.id === playerId);
    if (!p || isSeductionImmune(p.role)) return false;
    return room.seducedPlayerId === playerId;
  };

  const mafiaVotes = {};
  room.players
    .filter((p) => p.alive && p.role === 'mafia')
    .forEach((m) => {
      const act = actions[m.id];
      if (act?.type === 'kill' && !isSeduced(m.id)) {
        mafiaVotes[act.targetId] = (mafiaVotes[act.targetId] || 0) + 1;
      }
    });

  let mafiaTarget = null;
  const entries = Object.entries(mafiaVotes);
  if (entries.length > 0) {
    entries.sort((a, b) => b[1] - a[1]);
    const top = entries.filter(([, c]) => c === entries[0][1]);
    if (top.length === 1) mafiaTarget = Number(top[0][0]);
  }

  const commissar = room.players.find((p) => p.alive && p.role === 'commissar');
  if (commissar && !isSeduced(commissar.id)) {
    const act = actions[commissar.id];
    if (act?.type === 'check') {
      const target = room.players.find((p) => p.id === act.targetId);
      if (target) {
        commissar.score += 5;
        privateNotes.push({
          playerId: commissar.id,
          message: `Проверка: ${target.name} — ${getRoleLabel(target.role)}`,
        });
      }
    } else if (act?.type === 'kill') {
      const target = room.players.find((p) => p.id === act.targetId);
      if (target?.alive) {
        if (isEvil(target.role)) commissar.score += 20;
        else commissar.score -= 5;
        deaths.add(target.id);
      }
    }
  }

  const maniac = room.players.find((p) => p.alive && p.role === 'maniac');
  if (maniac && !isSeduced(maniac.id)) {
    const act = actions[maniac.id];
    if (act?.type === 'kill') {
      const target = room.players.find((p) => p.id === act.targetId);
      if (target) {
        if (isMafia(target.role)) maniac.score += 20;
        else maniac.score -= 5;
        deaths.add(target.id);
      }
    }
  }

  const doctor = room.players.find((p) => p.alive && p.role === 'doctor');
  if (doctor && !isSeduced(doctor.id)) {
    const act = actions[doctor.id];
    if (act?.type === 'heal') {
      const selfHeal = act.targetId === doctor.id;
      if (!selfHeal || room.nightNumber - room.doctorLastSelfHealNight >= 3) {
        doctor.score += 5;
        heals.add(act.targetId);
        if (selfHeal) room.doctorLastSelfHealNight = room.nightNumber;
      }
    }
  }

  const homeless = room.players.find((p) => p.alive && p.role === 'homeless');
  if (homeless && !isSeduced(homeless.id)) {
    const act = actions[homeless.id];
    if (act?.type === 'check') {
      const target = room.players.find((p) => p.id === act.targetId);
      if (target) {
        homeless.score += 5;
        privateNotes.push({
          playerId: homeless.id,
          message: `Проверка: ${target.name} — ${getRoleLabel(target.role)}`,
        });
      }
    }
  }

  const clown = room.players.find((p) => p.alive && p.role === 'clown');
  if (clown && !room.clownUsed && !isSeduced(clown.id)) {
    const act = actions[clown.id];
    if (act?.type === 'swap' && act.targetId && act.targetId2) {
      const a = room.players.find((p) => p.id === act.targetId);
      const b = room.players.find((p) => p.id === act.targetId2);
      if (a && b) {
        [a.role, b.role] = [b.role, a.role];
        room.players.forEach((p) => {
          p.isDon = false;
        });
        const newDon = room.players.find((p) => p.alive && p.role === 'mafia');
        if (newDon) {
          newDon.isDon = true;
          room.mafiaDonId = newDon.id;
        }
        room.clownUsed = true;
        clown.score += 30 * room.nightNumber;
        addSystemMessage(room, '🎭 Клоун поменял роли двух игроков!');
      }
    }
  }

  const wife = room.players.find((p) => p.alive && p.role === 'commissar_wife');
  if (wife && room.wifeRevengeAvailable && !room.wifeRevengeUsed && !isSeduced(wife.id)) {
    const act = actions[wife.id];
    if (act?.type === 'revenge') {
      deaths.add(act.targetId);
      wife.score += 50;
      room.wifeRevengeUsed = true;
      room.wifeRevengeAvailable = false;
    }
  }

  if (mafiaTarget) {
    const target = room.players.find((p) => p.id === mafiaTarget);
    if (target?.alive) {
      if (isMafiaImmune(target.role)) {
        addSystemMessage(room, '🏔️ Горец пережил атаку мафии!');
      } else if (!heals.has(mafiaTarget)) {
        deaths.add(mafiaTarget);
        room.players.filter((p) => p.alive && p.role === 'mafia').forEach((m) => {
          m.score += 10;
        });
      } else {
        const doc = room.players.find((p) => p.role === 'doctor' && p.alive);
        if (doc) doc.score += 15;
        addSystemMessage(room, '💊 Доктор спас жертву мафии!');
      }
    }
  }

  const killedTonight = [];
  for (const id of deaths) {
    const p = room.players.find((pl) => pl.id === id);
    if (p?.alive) killedTonight.push(p);
  }

  if (killedTonight.length === 0) {
    addSystemMessage(room, '🌅 Утро. Этой ночью никто не погиб.');
  } else {
    killedTonight.forEach((p) => eliminatePlayer(room, p.id));
  }

  room.nightActions = {};

  if (checkWin(room)) return { privateNotes };
  startDayPhase(room);
  return { privateNotes };
}

export function checkWin(room) {
  const alive = room.players.filter((p) => p.alive);
  const mafiaAlive = alive.filter((p) => p.role === 'mafia').length;
  const maniacAlive = alive.filter((p) => p.role === 'maniac').length;
  const townAlive = alive.filter((p) => isTown(p.role)).length;

  if (mafiaAlive === 0 && maniacAlive === 0) {
    endGame(room, 'town', 'Мирные победили!');
    return true;
  }
  if (mafiaAlive > 0 && mafiaAlive >= townAlive) {
    endGame(room, 'mafia', 'Мафия победила!');
    return true;
  }
  return false;
}

function endGame(room, team, message) {
  room.phase = PHASE.ENDED;
  clearTimer(room);
  addSystemMessage(room, `🏁 ${message}`);

  room.players.forEach((p) => {
    if (team === 'town' && isTown(p.role)) {
      p.score += p.alive ? 100 : 50;
    } else if (team === 'mafia' && p.role === 'mafia') {
      p.score += p.alive ? 50 : 0;
    }
  });
}

export function resetRoom(room) {
  const id = room.id;
  const name = room.name;
  Object.assign(room, createRoom(id));
  room.name = name;
}

export function addChatMessage(room, playerId, text, channel = 'public') {
  const player = room.players.find((p) => p.id === playerId);
  if (!player) return null;

  const msg = {
    id: Date.now() + Math.random(),
    playerId,
    playerName: player.name,
    text,
    time: new Date().toISOString(),
  };

  if (channel === 'mafia') room.mafiaChat.push(msg);
  else room.chat.push(msg);
  return msg;
}

function addSystemMessage(room, text) {
  room.systemMessages.push({ text, time: new Date().toISOString() });
  room.chat.push({
    id: Date.now() + Math.random(),
    playerId: null,
    playerName: '🤖 Ведущий',
    text,
    time: new Date().toISOString(),
    system: true,
  });
}

export function serializeRoomForPlayer(room, playerId) {
  const me = room.players.find((p) => p.id === playerId);

  return {
    id: room.id,
    name: room.name,
    phase: room.phase,
    maxPlayers: room.maxPlayers,
    nightNumber: room.nightNumber,
    timerEnd: room.timerEnd,
    timerReason: room.timerReason,
    winnerTeam: room.winnerTeam,
    myId: playerId,
    myRole: me?.role || null,
    myRoleLabel: me ? getRoleLabel(me.role) : null,
    isDon: me?.isDon || false,
    players: room.players
      .filter((p) => p.connected || room.phase !== PHASE.WAITING)
      .map((p) => ({
        id: p.id,
        name: p.name,
        alive: p.alive,
        score: p.score,
        connected: p.connected,
        hasVoted: p.hasVoted,
        role: !p.alive || p.id === playerId ? p.role : null,
        roleLabel: !p.alive || p.id === playerId ? getRoleLabel(p.role) : null,
        isDon: p.isDon && p.id === playerId,
      })),
    chat: room.chat.slice(-100),
    mafiaChat: me?.role === 'mafia' && me.alive ? room.mafiaChat.slice(-50) : [],
    canStartGame: room.phase === PHASE.WAITING || room.phase === PHASE.REGISTRATION || room.phase === PHASE.ENDED,
    canChat: room.phase === PHASE.DAY,
    wifeRevengeAvailable: me?.role === 'commissar_wife' && room.wifeRevengeAvailable && !room.wifeRevengeUsed,
    clownAvailable: me?.role === 'clown' && !room.clownUsed,
    votingStarted: room.votingStarted,
    myVote: room.votes[playerId] || null,
    nightActionDone: me?.nightActionDone || false,
  };
}
