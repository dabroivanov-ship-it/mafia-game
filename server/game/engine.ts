import { CONFIG, PHASE, isLobbyPhase, isActiveGamePhase } from './config.js';
import { distributeRoles, isMafia, isTown, isEvil, isMafiaImmune, isSeductionImmune, getRoleLabel } from './roles.js';
import {
  buildRoleRevealNotes,
  buildNightReminderNotes,
  buildDayDiscussionNotes,
  buildVotingReminderNotes,
  buildMorningReportMessages,
  getCommissarCheckResultMessage,
  getHomelessCheckResultMessage,
  getGameStartSystemMessage,
  getRolesRevealSystemMessage,
  getNightAtmosphereMessages,
  getGameEndRolesMessage,
  getScoreSummaryMessage,
  getDayDiscussionMessage,
  getVotingStartMessage,
  getHangVerdictMessage,
  getVotingTieMessage,
  type NightReport,
} from './host.js';
import {
  saveChatMessage,
  saveGameEvent,
  markChatDeleted,
  deleteRoomChatLog,
  hydrateRoomHistory,
} from '../history/store.js';
import { loadRoomNames, saveRoomName, deleteRoomName } from '../rooms/store.js';
import type {
  ChatChannel,
  ChatMessage,
  GamePlayer,
  GameRoom,
  LobbyRoom,
  NightAction,
  NightResolveResult,
  PrivateNote,
  RoomState,
  RoomStatePlayer,
  TimerReason,
} from '../types/index.js';

let nextPlayerId = 1;

export function createInitialRooms(): Map<number, GameRoom> {
  const rooms = new Map<number, GameRoom>();
  const savedNames = loadRoomNames();
  for (let i = 1; i <= CONFIG.ROOM_COUNT; i++) {
    const room = createRoom(i);
    if (savedNames.has(i)) {
      room.name = savedNames.get(i)!;
    }
    rooms.set(i, room);
  }
  return rooms;
}

function createRoom(id: number): GameRoom {
  return {
    id,
    name: `Комната ${id}`,
    phase: PHASE.WAITING,
    maxPlayers: CONFIG.DEFAULT_MAX_PLAYERS,
    players: [],
    chat: [],
    mafiaChat: [],
    deadChat: [],
    spectatorChat: [],
    privateChat: [],
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
    scoresSynced: false,
    sessionId: null,
    historyLoaded: false,
  };
}

export function getLobbySnapshot(rooms: Map<number, GameRoom>): LobbyRoom[] {
  return Array.from(rooms.values()).map((room) => {
    const inGame = room.players.filter((p) => p.connected && p.inGame).length;
    const connected = room.players.filter((p) => p.connected).length;
    const gameRunning = !isLobbyPhase(room.phase);
    return {
      id: room.id,
      name: room.name,
      playerCount: gameRunning ? inGame : connected,
      spectatorCount: gameRunning ? room.players.filter((p) => p.connected && !p.inGame).length : 0,
      maxPlayers: room.maxPlayers,
      phase: room.phase,
    };
  });
}

export function renameRoom(rooms: Map<number, GameRoom>, roomId: number, name: string): GameRoom {
  const room = rooms.get(Number(roomId));
  if (!room) throw new Error('Комната не найдена');
  const trimmed = String(name || '').trim().slice(0, 50);
  if (!trimmed) throw new Error('Название не может быть пустым');
  room.name = trimmed;
  saveRoomName(room.id, trimmed);
  return room;
}

export function addRoom(rooms: Map<number, GameRoom>, name: string): GameRoom {
  let maxId = 0;
  for (const id of rooms.keys()) maxId = Math.max(maxId, id);
  const id = maxId + 1;
  const room = createRoom(id);
  const trimmed = String(name || '').trim().slice(0, 50);
  room.name = trimmed || `Комната ${id}`;
  rooms.set(id, room);
  saveRoomName(id, room.name);
  return room;
}

export function removeRoom(rooms: Map<number, GameRoom>, roomId: number): GameRoom {
  if (rooms.size <= 1) throw new Error('Нельзя удалить последнюю комнату');
  const id = Number(roomId);
  if (!rooms.has(id)) throw new Error('Комната не найдена');
  const room = rooms.get(id)!;
  rooms.delete(id);
  deleteRoomName(id);
  return room;
}

export function addPlayerToRoom(
  room: GameRoom,
  {
    name,
    username,
    socketId,
    userId,
  }: {
    name: string;
    username: string;
    socketId: string;
    userId: number;
  }
): { player: GamePlayer; privateNotes: PrivateNote[] } {
  const existingSocket = room.players.find((p) => p.socketId === socketId);
  if (existingSocket) {
    existingSocket.name = name;
    if (username) existingSocket.username = username;
    existingSocket.connected = true;
    return { player: existingSocket, privateNotes: [] };
  }

  // Переподключение того же аккаунта
  const existingUser = room.players.find((p) => p.userId === userId);
  if (existingUser) {
    if (existingUser.connected && existingUser.socketId) {
      throw new Error('Вы уже в этой комнате');
    }
    existingUser.socketId = socketId;
    existingUser.name = name;
    if (username) existingUser.username = username;
    existingUser.connected = true;
    if (isLobbyPhase(room.phase)) {
      existingUser.inGame = true;
    }
    return { player: existingUser, privateNotes: [] };
  }

  const connectedCount = room.players.filter((p) => p.connected).length;
  const inGameCount = room.players.filter((p) => p.connected && p.inGame).length;
  const isGamePhase = !isLobbyPhase(room.phase);
  const defaultInGame = !isGamePhase;

  if (isLobbyPhase(room.phase) && connectedCount >= room.maxPlayers + 20) {
    throw new Error('Комната переполнена');
  }

  const player: GamePlayer = {
    id: nextPlayerId++,
    userId,
    name,
    username: username || name,
    socketId,
    inGame: defaultInGame,
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

  hydrateRoomHistory(room);

  let privateNotes: PrivateNote[] = [];
  if (room.phase === PHASE.REGISTRATION && player.inGame && inGameCount + 1 >= room.maxPlayers) {
    privateNotes = tryStartGameAfterRegistration(room);
  }

  return { player, privateNotes };
}

export function markPlayerDisconnected(room: GameRoom, socketId: string): GamePlayer | null {
  const player = room.players.find((p) => p.socketId === socketId);
  if (!player) return null;

  player.connected = false;
  player.socketId = null;
  player.disconnectedAt = Date.now();

  const gameActive = !isLobbyPhase(room.phase);
  if (gameActive && player.inGame && player.alive) {
    addSystemMessage(
      room,
      `${player.name} отошёл от игры. Есть ${CONFIG.DISCONNECT_GRACE_SEC} сек. на возвращение.`
    );
  }

  if (room.phase === PHASE.WAITING && room.players.every((p) => !p.connected)) {
    resetRoom(room);
  }

  return player;
}

export function finalizePlayerLeave(room: GameRoom, playerId: number): boolean {
  const player = room.players.find((p) => p.id === playerId);
  if (!player || player.connected) return false;

  const gameActive = !isLobbyPhase(room.phase);
  if (!gameActive || !player.inGame || !player.alive) return false;

  player.score -= 100;
  player.leftEarly = true;
  player.alive = false;
  addSystemMessage(
    room,
    `${player.name} покинул игру из-за неактивности (−100 очков). Роль: ${getRoleLabel(player.role)}.`
  );

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

  return true;
}

export function removePlayer(room: GameRoom, socketId: string, applyPenalty = true): GamePlayer | null {
  const player = room.players.find((p) => p.socketId === socketId);
  if (!player) return null;

  const gameActive = !isLobbyPhase(room.phase);

  if (gameActive && applyPenalty && player.inGame && player.alive && player.connected) {
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

export function reconnectPlayer(
  room: GameRoom,
  playerId: number,
  socketId: string,
  name: string,
  username: string
): GamePlayer | null {
  const player = room.players.find((p) => p.id === playerId);
  if (!player) return null;
  player.socketId = socketId;
  player.connected = true;
  player.disconnectedAt = null;
  if (name) player.name = name;
  if (username) player.username = username;
  return player;
}

export function startRegistration(room: GameRoom, starterPlayerId: number | null = null): void {
  if (room.phase !== PHASE.WAITING && room.phase !== PHASE.ENDED) {
    throw new Error('Игра уже идёт');
  }
  if (room.phase === PHASE.ENDED) {
    resetRoom(room);
  }
  for (const p of room.players) {
    p.inGame = false;
    p.role = null;
    p.joinGameAvailableAt = 0;
  }
  if (starterPlayerId) {
    const starter = room.players.find((p) => p.id === starterPlayerId);
    if (starter) starter.inGame = true;
  }
  room.phase = PHASE.REGISTRATION;
  room.sessionId = Date.now();
  hydrateRoomHistory(room);
  saveGameEvent(room.id, room.sessionId, 'registration_start', {
    roomName: room.name,
  });
  addSystemMessage(
    room,
    '——— Регистрация открыта! Нажмите «Присоединиться к игре», чтобы участвовать. ———'
  );
  setTimer(room, CONFIG.REGISTRATION_SEC * 1000, 'registration');
}

export function joinGame(room: GameRoom, playerId: number): { player: GamePlayer; privateNotes: PrivateNote[] } {
  if (room.phase !== PHASE.REGISTRATION) {
    throw new Error('Присоединиться можно только во время регистрации');
  }
  const player = room.players.find((p) => p.id === playerId);
  if (!player?.connected) throw new Error('Игрок не найден');
  if (player.inGame) throw new Error('Вы уже в игре');

  const inGameCount = room.players.filter((p) => p.connected && p.inGame).length;
  if (inGameCount >= room.maxPlayers) {
    throw new Error('Все места в игре заняты');
  }

  const now = Date.now();
  if (player.joinGameAvailableAt && now < player.joinGameAvailableAt) {
    const sec = Math.ceil((player.joinGameAvailableAt - now) / 1000);
    throw new Error(`Подождите ${sec} сек. перед повторным присоединением`);
  }

  player.inGame = true;
  addSystemMessage(room, `${player.username || player.name} присоединяется к игре!`);
  const privateNotes = tryStartGameAfterRegistration(room);
  return { player, privateNotes };
}

export function leaveGame(room: GameRoom, playerId: number): GamePlayer {
  if (room.phase !== PHASE.REGISTRATION) {
    throw new Error('Выйти из игры можно только во время регистрации');
  }
  const player = room.players.find((p) => p.id === playerId);
  if (!player?.connected) throw new Error('Игрок не найден');
  if (!player.inGame) throw new Error('Вы не в игре');

  player.inGame = false;
  player.joinGameAvailableAt = Date.now() + CONFIG.JOIN_GAME_COOLDOWN_SEC * 1000;
  addSystemMessage(room, `${player.username || player.name} вышел из регистрации.`);
  return player;
}

export function setTimer(room: GameRoom, ms: number, reason: TimerReason): void {
  room.timerEnd = Date.now() + ms;
  room.timerReason = reason;
}

export function clearTimer(room: GameRoom): void {
  room.timerEnd = null;
  room.timerReason = null;
}

export function tryStartGameAfterRegistration(room: GameRoom): PrivateNote[] {
  if (room.phase !== PHASE.REGISTRATION) return [];
  const registered = room.players.filter((p) => p.connected && p.inGame);
  if (registered.length >= room.maxPlayers) {
    return beginGame(room);
  }
  return [];
}

export function onRegistrationTimerEnd(room: GameRoom): PrivateNote[] {
  if (room.phase !== PHASE.REGISTRATION) return [];
  const registered = room.players.filter((p) => p.connected && p.inGame);
  if (registered.length < CONFIG.MIN_PLAYERS) {
    room.phase = PHASE.WAITING;
    clearTimer(room);
    room.players.forEach((p) => {
      p.inGame = true;
    });
    addSystemMessage(
      room,
      `⏱ Регистрация завершена: записалось ${registered.length} из ${CONFIG.MIN_PLAYERS} нужных. Игра не состоялась — можно запустить снова, когда наберётся больше игроков.`
    );
    return [];
  }
  return beginGame(room);
}

export function onRolesTimerEnd(room: GameRoom): PrivateNote[] {
  if (room.phase !== PHASE.ROLES) return [];
  for (const msg of getNightAtmosphereMessages(room)) {
    addSystemMessage(room, msg);
  }
  return startNightPhase(room);
}

function beginGame(room: GameRoom): PrivateNote[] {
  clearTimer(room);
  const participants = room.players.filter((p) => p.connected && p.inGame);

  const roles = distributeRoles(participants.length);
  participants.forEach((p, i) => {
    p.role = roles[i];
    p.alive = true;
    p.score = 0;
    p.isDon = false;
    p.hasVoted = false;
    p.nightActionDone = false;
    p.leftEarly = false;
  });

  room.players.forEach((p) => {
    if (!p.inGame) {
      p.role = null;
      p.alive = true;
      p.hasVoted = false;
      p.nightActionDone = false;
    }
  });

  const firstMafia = room.players.find((p) => isMafia(p.role));
  if (firstMafia) {
    firstMafia.isDon = true;
    room.mafiaDonId = firstMafia.id;
  }

  room.nightNumber = 0;
  room.commissarAlive = room.players.some((p) => p.role === 'commissar');
  room.wifeRevengeAvailable = false;
  room.wifeRevengeUsed = false;
  room.clownUsed = false;
  room.doctorLastSelfHealNight = -999;

  saveGameEvent(room.id, room.sessionId, 'game_start', {
    playerCount: participants.length,
    players: participants.map((p) => ({ name: p.name, userId: p.userId })),
  });
  addSystemMessage(room, getGameStartSystemMessage(participants.length));
  addSystemMessage(room, getRolesRevealSystemMessage(participants.length));
  room.phase = PHASE.ROLES;
  setTimer(room, CONFIG.ROLE_REVEAL_SEC * 1000, 'roles');
  return buildRoleRevealNotes(room);
}

export function startDayPhase(room: GameRoom): PrivateNote[] {
  room.phase = PHASE.DAY;
  room.votes = {};
  room.votingStarted = false;
  room.players.forEach((p) => {
    p.hasVoted = false;
  });
  addSystemMessage(room, getDayDiscussionMessage(room.nightNumber + 1));
  setTimer(room, CONFIG.DAY_DISCUSSION_SEC * 1000, 'day');
  return buildDayDiscussionNotes(room);
}

export function startVoting(room: GameRoom): PrivateNote[] {
  if (room.phase !== PHASE.DAY) return [];
  room.phase = PHASE.VOTING;
  room.votingStarted = true;
  clearTimer(room);
  room.votes = {};
  room.players.forEach((p) => {
    p.hasVoted = false;
  });
  addSystemMessage(room, getVotingStartMessage());
  return buildVotingReminderNotes(room);
}

export function onDayTimerEnd(room: GameRoom): PrivateNote[] {
  if (room.phase === PHASE.DAY) return startVoting(room);
  return [];
}

export function castDayVote(room: GameRoom, voterId: number, targetId: number): PrivateNote[] {
  if (room.phase !== PHASE.VOTING) throw new Error('Сейчас не время голосования');

  const voter = room.players.find((p) => p.id === voterId);
  const target = room.players.find((p) => p.id === targetId);
  if (!voter?.inGame || !voter.role) throw new Error('Вы не участвуете в игре');
  if (!voter?.alive || !target?.alive) throw new Error('Недопустимый голос');
  if (voterId === targetId) throw new Error('Нельзя голосовать за себя');

  room.votes[voterId] = targetId;
  voter.hasVoted = true;

  const alive = room.players.filter((p) => p.alive && p.inGame && p.role && p.connected);
  if (alive.every((p) => p.hasVoted)) return resolveDayVote(room);
  return [];
}

function resolveDayVote(room: GameRoom): PrivateNote[] {
  const tally: Record<number, number> = {};
  for (const targetId of Object.values(room.votes)) {
    tally[targetId] = (tally[targetId] || 0) + 1;
  }

  let maxVotes = 0;
  let candidates: number[] = [];
  for (const [id, count] of Object.entries(tally)) {
    if (count > maxVotes) {
      maxVotes = count;
      candidates = [Number(id)];
    } else if (count === maxVotes) {
      candidates.push(Number(id));
    }
  }

  if (candidates.length === 1 && maxVotes > 0) {
    const hanged = room.players.find((p) => p.id === candidates[0]);
    if (hanged) {
      addSystemMessage(room, getHangVerdictMessage(hanged));
      eliminatePlayer(room, candidates[0], { silent: true });
    }
  } else {
    addSystemMessage(room, getVotingTieMessage());
  }

  if (checkWin(room)) return [];
  return startNightPhase(room);
}

function eliminatePlayer(room: GameRoom, playerId: number, opts: { silent?: boolean } = {}): void {
  const player = room.players.find((p) => p.id === playerId);
  if (!player?.alive) return;

  player.alive = false;
  if (!opts.silent) {
    addSystemMessage(room, `💀 ${player.name} выбыл(а)! Роль: ${getRoleLabel(player.role)}.`);
  }

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

export function startNightPhase(room: GameRoom): PrivateNote[] {
  room.phase = PHASE.NIGHT;
  room.nightNumber += 1;
  room.nightActions = {};
  room.seducedPlayerId = null;
  room.players.forEach((p) => {
    p.nightActionDone = false;
  });

  if (room.nightNumber > 1) {
    for (const msg of getNightAtmosphereMessages(room)) {
      addSystemMessage(room, msg);
    }
  }

  setTimer(room, CONFIG.NIGHT_ACTIONS_SEC * 1000, 'night');
  return buildNightReminderNotes(room);
}

export function onNightTimerEnd(room: GameRoom): NightResolveResult | null {
  if (room.phase === PHASE.NIGHT) return resolveNight(room);
  return null;
}

export function submitNightAction(
  room: GameRoom,
  playerId: number,
  action: NightAction
): NightResolveResult | null {
  if (room.phase !== PHASE.NIGHT) throw new Error('Сейчас не ночь');

  const player = room.players.find((p) => p.id === playerId);
  if (!player?.alive || !player.inGame || !player.role) throw new Error('Вы не можете действовать');

  room.nightActions[playerId] = action;
  player.nightActionDone = true;

  const needAction = getPlayersNeedingNightAction(room);
  if (needAction.every((p) => p.nightActionDone)) {
    clearTimer(room);
    return resolveNight(room);
  }
  return null;
}

function getPlayersNeedingNightAction(room: GameRoom): GamePlayer[] {
  return room.players.filter((p) => {
    if (!p.alive || !p.connected) return false;
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

export function resolveNight(room: GameRoom): NightResolveResult {
  clearTimer(room);

  const actions = room.nightActions;
  const deaths = new Set<number>();
  const heals = new Set<number>();
  const privateNotes: PrivateNote[] = [];
  const report: NightReport = { killed: [] };

  const prostitute = room.players.find((p) => p.alive && p.role === 'prostitute');
  if (prostitute && actions[prostitute.id]?.type === 'seduce') {
    const act = actions[prostitute.id] as Extract<NightAction, { type: 'seduce' }>;
    const target = room.players.find((p) => p.id === act.targetId);
    if (target && !isSeductionImmune(target.role)) {
      room.seducedPlayerId = target.id;
      prostitute.score += 5;
    }
  }

  const isSeduced = (playerId: number): boolean => {
    const p = room.players.find((pl) => pl.id === playerId);
    if (!p || isSeductionImmune(p.role)) return false;
    return room.seducedPlayerId === playerId;
  };

  const mafiaVotes: Record<number, number> = {};
  room.players
    .filter((p) => p.alive && p.role === 'mafia')
    .forEach((m) => {
      const act = actions[m.id];
      if (act?.type === 'kill' && !isSeduced(m.id)) {
        mafiaVotes[act.targetId] = (mafiaVotes[act.targetId] || 0) + 1;
      }
    });

  let mafiaTarget: number | null = null;
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
        report.commissarChecked = target;
        privateNotes.push({
          playerId: commissar.id,
          message: getCommissarCheckResultMessage(target),
        });
      }
    } else if (act?.type === 'kill') {
      const target = room.players.find((p) => p.id === act.targetId);
      if (target?.alive) {
        if (isEvil(target.role)) commissar.score += 20;
        else commissar.score -= 5;
        deaths.add(target.id);
        report.commissarKilled = target;
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
        report.maniacKilled = target;
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
          message: getHomelessCheckResultMessage(target),
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
      const target = room.players.find((p) => p.id === act.targetId);
      if (target) {
        deaths.add(act.targetId);
        wife.score += 50;
        room.wifeRevengeUsed = true;
        room.wifeRevengeAvailable = false;
        report.wifeKilled = target;
      }
    }
  }

  if (mafiaTarget) {
    const target = room.players.find((p) => p.id === mafiaTarget);
    if (target?.alive) {
      if (isMafiaImmune(target.role)) {
        report.highlanderAttacked = target;
      } else if (!heals.has(mafiaTarget)) {
        deaths.add(mafiaTarget);
        report.mafiaKilled = target;
        room.players.filter((p) => p.alive && p.role === 'mafia').forEach((m) => {
          m.score += 10;
        });
      } else {
        const doc = room.players.find((p) => p.role === 'doctor' && p.alive);
        if (doc) doc.score += 15;
        report.doctorSaved = target;
      }
    }
  }

  const killedTonight: GamePlayer[] = [];
  for (const id of deaths) {
    const p = room.players.find((pl) => pl.id === id);
    if (p?.alive) killedTonight.push(p);
  }
  report.killed = killedTonight;

  for (const msg of buildMorningReportMessages(room, report)) {
    addSystemMessage(room, msg);
  }

  if (killedTonight.length > 0) {
    killedTonight.forEach((p) => eliminatePlayer(room, p.id, { silent: true }));
  }

  room.nightActions = {};

  if (checkWin(room)) return { privateNotes };
  const dayNotes = startDayPhase(room);
  privateNotes.push(...dayNotes);
  return { privateNotes };
}

export function checkWin(room: GameRoom): boolean {
  const alive = room.players.filter((p) => p.alive && p.inGame && p.role);
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

function endGame(room: GameRoom, team: 'town' | 'mafia', message: string): void {
  room.phase = PHASE.ENDED;
  clearTimer(room);
  addSystemMessage(room, `🏁 ${message}`);
  addSystemMessage(room, getGameEndRolesMessage(room));
  const scoreMsg = getScoreSummaryMessage(room);
  if (scoreMsg) addSystemMessage(room, scoreMsg);
  saveGameEvent(room.id, room.sessionId, 'game_end', {
    winnerTeam: team,
    message,
    players: room.players.map((p) => ({
      name: p.name,
      role: p.role,
      alive: p.alive,
      score: p.score,
    })),
  });

  room.players.forEach((p) => {
    if (team === 'town' && isTown(p.role)) {
      p.score += p.alive ? 100 : 50;
    } else if (team === 'mafia' && p.role === 'mafia') {
      p.score += p.alive ? 50 : 0;
    }
  });
}

export function resetRoom(room: GameRoom): void {
  const id = room.id;
  const name = room.name;
  const chat = room.chat;
  const mafiaChat = room.mafiaChat;
  const deadChat = room.deadChat;
  const spectatorChat = room.spectatorChat;
  const privateChat = room.privateChat;
  const historyLoaded = room.historyLoaded;
  const connectedPlayers = room.players.filter((p) => p.connected);
  Object.assign(room, createRoom(id));
  room.name = name;
  room.chat = chat;
  room.mafiaChat = mafiaChat;
  room.deadChat = deadChat;
  room.spectatorChat = spectatorChat;
  room.privateChat = privateChat;
  room.historyLoaded = historyLoaded;
  room.players = connectedPlayers.map((p) => ({
    ...p,
    inGame: true,
    role: null,
    alive: true,
    score: 0,
    isDon: false,
    hasVoted: false,
    nightActionDone: false,
    leftEarly: false,
  }));
  addSystemMessage(room, '——— Новая игра ———');
}

export function addChatMessage(
  room: GameRoom,
  playerId: number,
  text: string,
  channel: ChatChannel = 'public',
  options: { toPlayerId?: number } = {}
): ChatMessage | null {
  const player = room.players.find((p) => p.id === playerId);
  if (!player) return null;

  const msg: ChatMessage = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    playerId,
    userId: player.userId || null,
    playerName: player.username || player.name,
    text,
    time: new Date().toISOString(),
    deleted: false,
    isPrivate: false,
  };

  if (options.toPlayerId) {
    const target = room.players.find((p) => p.id === options.toPlayerId);
    if (target) {
      msg.toPlayerId = target.id;
      msg.toPlayerName = target.username || target.name;
    }
  }

  if (channel === 'mafia') room.mafiaChat.push(msg);
  else if (channel === 'dead') room.deadChat.push(msg);
  else if (channel === 'spectator') room.spectatorChat.push(msg);
  else room.chat.push(msg);

  saveChatMessage(room.id, room.sessionId, msg, channel);
  return msg;
}

export function addHostPrivateMessage(room: GameRoom, toPlayerId: number, text: string): void {
  const to = room.players.find((p) => p.id === toPlayerId);
  if (!to) return;

  const msg: ChatMessage = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    playerId: null,
    userId: null,
    playerName: '🤖 Ведущий',
    toPlayerId: to.id,
    toPlayerName: to.username || to.name,
    text,
    time: new Date().toISOString(),
    system: true,
    deleted: false,
    isPrivate: true,
  };

  room.privateChat = room.privateChat || [];
  room.privateChat.push(msg);
  saveChatMessage(room.id, room.sessionId, msg, 'private');
}

export function addPrivateChatMessage(
  room: GameRoom,
  fromPlayerId: number,
  toPlayerId: number,
  text: string
): ChatMessage | null {
  const from = room.players.find((p) => p.id === fromPlayerId);
  const to = room.players.find((p) => p.id === toPlayerId);
  if (!from || !to || fromPlayerId === toPlayerId) return null;

  const msg: ChatMessage = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    playerId: fromPlayerId,
    userId: from.userId || null,
    playerName: from.username || from.name,
    toPlayerId: to.id,
    toPlayerName: to.username || to.name,
    text,
    time: new Date().toISOString(),
    deleted: false,
    isPrivate: true,
  };

  room.privateChat = room.privateChat || [];
  room.privateChat.push(msg);
  saveChatMessage(room.id, room.sessionId, msg, 'private');
  return msg;
}

export function deleteChatMessage(
  room: GameRoom,
  messageId: string,
  channel: ChatChannel = 'public'
): boolean {
  const list =
    channel === 'mafia'
      ? room.mafiaChat
      : channel === 'dead'
        ? room.deadChat
        : channel === 'spectator'
          ? room.spectatorChat
          : channel === 'private'
            ? room.privateChat
            : room.chat;
  const msg = list.find((m) => m.id === messageId);
  if (!msg || msg.system) return false;
  msg.deleted = true;
  msg.text = '[сообщение удалено модератором]';
  markChatDeleted(messageId);
  return true;
}

export function clearRoomChat(room: GameRoom): number {
  const cleared =
    room.chat.length +
    room.mafiaChat.length +
    room.deadChat.length +
    room.spectatorChat.length +
    room.privateChat.length;
  room.chat = [];
  room.mafiaChat = [];
  room.deadChat = [];
  room.spectatorChat = [];
  room.privateChat = [];
  deleteRoomChatLog(room.id);
  addSystemMessage(room, '🧹 История чата очищена администратором.');
  return cleared;
}

export interface ModerationSnapshot {
  rooms: LobbyRoom[];
  messages: (ChatMessage & { roomId: number; roomName: string; channel: ChatChannel })[];
}

export function getModerationSnapshot(rooms: Map<number, GameRoom>): ModerationSnapshot {
  const messages: ModerationSnapshot['messages'] = [];
  for (const room of rooms.values()) {
    for (const msg of room.chat) {
      if (!msg.system) {
        messages.push({
          ...msg,
          roomId: room.id,
          roomName: room.name,
          channel: 'public',
        });
      }
    }
    for (const msg of room.mafiaChat) {
      messages.push({
        ...msg,
        roomId: room.id,
        roomName: room.name,
        channel: 'mafia',
      });
    }
    for (const msg of room.deadChat) {
      messages.push({
        ...msg,
        roomId: room.id,
        roomName: room.name,
        channel: 'dead',
      });
    }
    for (const msg of room.spectatorChat) {
      messages.push({
        ...msg,
        roomId: room.id,
        roomName: room.name,
        channel: 'spectator',
      });
    }
  }
  messages.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

  return {
    rooms: getLobbySnapshot(rooms),
    messages: messages.slice(0, 80),
  };
}

function addSystemMessage(room: GameRoom, text: string): void {
  const time = new Date().toISOString();
  room.systemMessages.push({ text, time });
  const msg: ChatMessage = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    playerId: null,
    playerName: '🤖 Ведущий',
    text,
    time,
    system: true,
    deleted: false,
    userId: null,
  };
  room.chat.push(msg);
  saveChatMessage(room.id, room.sessionId, msg, 'public');
}

const DEFAULT_CHAT_LIMIT = 15;
const MAX_CHAT_LIMIT = 300;

function sliceChatMessages(
  messages: ChatMessage[],
  chatLimit: number
): { messages: ChatMessage[]; hasMoreChat: boolean } {
  const limit = Math.min(MAX_CHAT_LIMIT, Math.max(15, chatLimit || DEFAULT_CHAT_LIMIT));
  const total = messages.length;
  return {
    messages: messages.slice(-limit),
    hasMoreChat: total > limit,
  };
}

function appendPrivateMessages(
  messages: ChatMessage[],
  room: GameRoom,
  myPlayerId: number | undefined
): ChatMessage[] {
  if (!myPlayerId) return messages;
  const privateChat = room.privateChat || [];
  const mine = privateChat.filter(
    (m) => m.playerId === myPlayerId || m.toPlayerId === myPlayerId
  );
  if (mine.length === 0) return messages;
  return [...messages, ...mine].sort(
    (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()
  );
}

/** Чат для конкретного игрока */
function buildChatView(
  room: GameRoom,
  me: GamePlayer | undefined,
  chatLimit = DEFAULT_CHAT_LIMIT
): { messages: ChatMessage[]; mode: 'spectator' | 'dead' | 'alive'; hasMoreChat: boolean } {
  const gameRunning = isActiveGamePhase(room.phase);
  const isSpectator = me && !me.inGame && gameRunning;
  const myId = me?.id;

  if (isSpectator) {
    const gameMsgs = room.chat.map((m) => ({ ...m, sourceChannel: 'public' as ChatChannel }));
    const specMsgs = room.spectatorChat.map((m) => ({ ...m, sourceChannel: 'spectator' as ChatChannel }));
    const combined = appendPrivateMessages(
      [...gameMsgs, ...specMsgs].sort(
        (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()
      ),
      room,
      myId
    );
    const sliced = sliceChatMessages(combined, chatLimit);
    return { messages: sliced.messages, mode: 'spectator', hasMoreChat: sliced.hasMoreChat };
  }

  const systemMsgs = room.chat.filter((m) => m.system);

  if (!me || !me.inGame || !me.role || me.alive) {
    const combined = appendPrivateMessages(room.chat, room, myId);
    const sliced = sliceChatMessages(combined, chatLimit);
    return {
      messages: sliced.messages,
      mode: me?.inGame && me?.role && !me.alive ? 'dead' : 'alive',
      hasMoreChat: sliced.hasMoreChat,
    };
  }

  const combined = appendPrivateMessages(
    [...systemMsgs, ...room.deadChat].sort(
      (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()
    ),
    room,
    myId
  );
  const sliced = sliceChatMessages(combined, chatLimit);

  return {
    messages: sliced.messages,
    mode: 'dead',
    hasMoreChat: sliced.hasMoreChat,
  };
}

function mapPlayerPublic(p: GamePlayer, _room: GameRoom, playerId: number): RoomStatePlayer {
  return {
    id: p.id,
    userId: p.userId || null,
    name: p.name,
    inGame: !!p.inGame,
    alive: p.alive,
    score: p.score,
    connected: p.connected,
    hasVoted: p.hasVoted,
    role: !p.alive || p.id === playerId ? p.role : null,
    roleLabel: !p.alive || p.id === playerId ? getRoleLabel(p.role) : null,
    isDon: p.isDon && p.id === playerId,
  };
}

function getJoinCooldownSec(player: GamePlayer | undefined): number {
  if (!player?.joinGameAvailableAt) return 0;
  return Math.max(0, Math.ceil((player.joinGameAvailableAt - Date.now()) / 1000));
}

export function serializeRoomForPlayer(
  room: GameRoom,
  playerId: number,
  options: { isAdmin?: boolean; canModerate?: boolean; chatLimit?: number } = {}
): RoomState {
  const me = room.players.find((p) => p.id === playerId);
  const { isAdmin = false, canModerate = false, chatLimit = DEFAULT_CHAT_LIMIT } = options;
  const chatView = buildChatView(room, me, chatLimit);
  const gameRunning = isActiveGamePhase(room.phase);
  const isSpectator = !!(me && !me.inGame && gameRunning);
  const registeredCount = room.players.filter((p) => p.connected && p.inGame).length;
  const slotsAvailable = registeredCount < room.maxPlayers;
  const joinGameCooldownSec = getJoinCooldownSec(me);

  const visiblePlayers = room.players.filter(
    (p) => p.inGame && (p.connected || room.phase !== PHASE.WAITING)
  );
  const visibleSpectators = gameRunning
    ? room.players.filter((p) => p.connected && !p.inGame)
    : [];

  return {
    id: room.id,
    name: room.name,
    phase: room.phase,
    maxPlayers: room.maxPlayers,
    registeredCount,
    nightNumber: room.nightNumber,
    timerEnd: room.timerEnd,
    timerReason: room.timerReason,
    winnerTeam: room.winnerTeam,
    myId: playerId,
    isSpectator,
    isInGame: !!me?.inGame,
    canJoinGame:
      room.phase === PHASE.REGISTRATION &&
      !!me?.connected &&
      !me.inGame &&
      slotsAvailable &&
      joinGameCooldownSec === 0,
    joinGameCooldownSec,
    canLeaveGame:
      room.phase === PHASE.REGISTRATION && !!me?.connected && !!me.inGame,
    myPlayer: me
      ? {
          id: me.id,
          userId: me.userId || null,
          name: me.name,
          username: me.username || me.name,
          inGame: !!me.inGame,
          connected: me.connected,
        }
      : null,
    myRole: me?.inGame ? me.role || null : null,
    myRoleLabel: me?.inGame && me.role ? getRoleLabel(me.role) : null,
    isDon: me?.isDon || false,
    players: visiblePlayers.map((p) => mapPlayerPublic(p, room, playerId)),
    spectators: visibleSpectators.map((p) => ({
      id: p.id,
      userId: p.userId || null,
      name: p.name,
      connected: p.connected,
    })),
    chat: chatView.messages,
    chatMode: chatView.mode,
    hasMoreChat: chatView.hasMoreChat,
    mafiaChat: me?.role === 'mafia' && me.alive && me.inGame ? room.mafiaChat.slice(-50) : [],
    canStartGame:
      room.phase === PHASE.WAITING || room.phase === PHASE.REGISTRATION || room.phase === PHASE.ENDED,
    canChat: !!me?.connected && room.phase !== PHASE.ROLES,
    canPlay: !!me?.inGame && !!me?.role && room.phase === PHASE.NIGHT,
    wifeRevengeAvailable:
      me?.role === 'commissar_wife' && room.wifeRevengeAvailable && !room.wifeRevengeUsed,
    clownAvailable: me?.role === 'clown' && !room.clownUsed,
    votingStarted: room.votingStarted,
    myVote: room.votes[playerId] || null,
    nightActionDone: me?.nightActionDone || false,
    isAdmin,
    canModerate,
  };
}
