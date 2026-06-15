export type GamePhase =
  | 'waiting'
  | 'registration'
  | 'roles'
  | 'day'
  | 'voting'
  | 'night'
  | 'ended';

export type RoleId =
  | 'mafia'
  | 'commissar'
  | 'doctor'
  | 'homeless'
  | 'prostitute'
  | 'maniac'
  | 'clown'
  | 'commissar_wife'
  | 'highlander'
  | 'civilian';

export type ChatChannel = 'public' | 'mafia' | 'dead' | 'spectator' | 'private';

export type TimerReason = 'registration' | 'roles' | 'day' | 'night';

export type WinnerTeam = 'town' | 'mafia' | null;

export interface User {
  id: number;
  username: string;
  email: string;
  password_hash: string;
  display_name: string;
  city: string;
  bio: string;
  avatar: string | null;
  role: string;
  is_banned: number;
  ban_reason: string | null;
  banned_until: string | null;
  total_score: number;
  created_at: string;
  chat_limit?: number;
  last_ip?: string | null;
  last_user_agent?: string | null;
}

export interface StaffMember {
  id: number;
  username: string;
  displayName: string;
  city: string;
  avatar: string | null;
  role: 'admin' | 'moderator';
}

export interface PublicUser {
  id: number;
  username: string;
  email?: string;
  displayName: string;
  city: string;
  bio: string;
  avatar: string | null;
  role: string;
  isAdmin: boolean;
  isModerator: boolean;
  isStaff: boolean;
  totalScore: number;
  createdAt: string;
  isBanned: boolean;
  banReason?: string | null;
  chatLimit: number;
}

export interface ChatMessage {
  id: string;
  dbId?: number;
  playerId: number | null;
  userId: number | null;
  playerName: string;
  text: string;
  time: string;
  system?: boolean;
  deleted?: boolean;
  sourceChannel?: ChatChannel;
  isPrivate?: boolean;
  toPlayerId?: number | null;
  toPlayerName?: string | null;
}

export interface GamePlayer {
  id: number;
  userId: number | null;
  name: string;
  username: string;
  socketId: string | null;
  inGame: boolean;
  role: RoleId | null;
  alive: boolean;
  score: number;
  connected: boolean;
  isDon: boolean;
  hasVoted: boolean;
  nightActionDone: boolean;
  leftEarly?: boolean;
  joinGameAvailableAt?: number;
  disconnectedAt?: number | null;
}

export interface GameRoom {
  id: number;
  name: string;
  phase: GamePhase;
  maxPlayers: number;
  players: GamePlayer[];
  chat: ChatMessage[];
  mafiaChat: ChatMessage[];
  deadChat: ChatMessage[];
  spectatorChat: ChatMessage[];
  privateChat: ChatMessage[];
  nightNumber: number;
  timerEnd: number | null;
  timerReason: TimerReason | null;
  votes: Record<number, number>;
  nightActions: Record<number, NightAction>;
  seducedPlayerId: number | null;
  commissarAlive: boolean;
  wifeRevengeAvailable: boolean;
  wifeRevengeUsed: boolean;
  clownUsed: boolean;
  doctorLastSelfHealNight: number;
  mafiaDonId: number | null;
  votingStarted: boolean;
  winnerTeam: WinnerTeam;
  systemMessages: { text: string; time: string }[];
  scoresSynced: boolean;
  sessionId: number | null;
  historyLoaded: boolean;
}

export interface RoomStatePlayer {
  id: number;
  userId: number | null;
  name: string;
  username: string;
  inGame: boolean;
  alive: boolean;
  score: number;
  connected: boolean;
  hasVoted: boolean;
  role: RoleId | null;
  roleLabel: string | null;
  isDon: boolean;
}

export interface RoomState {
  id: number;
  name: string;
  phase: GamePhase;
  maxPlayers: number;
  registeredCount: number;
  nightNumber: number;
  timerEnd: number | null;
  timerReason: TimerReason | null;
  winnerTeam: WinnerTeam;
  myId: number;
  isSpectator: boolean;
  isInGame: boolean;
  canJoinGame: boolean;
  joinGameCooldownSec: number;
  canLeaveGame: boolean;
  myPlayer: {
    id: number;
    userId: number | null;
    name: string;
    username: string;
    inGame: boolean;
    connected: boolean;
    alive: boolean;
    hasVoted: boolean;
  } | null;
  myRole: RoleId | null;
  myRoleLabel: string | null;
  isDon: boolean;
  players: RoomStatePlayer[];
  spectators: { id: number; userId: number | null; name: string; username: string; connected: boolean }[];
  chat: ChatMessage[];
  chatMode: 'spectator' | 'dead' | 'alive';
  hasMoreChat: boolean;
  mafiaChat: ChatMessage[];
  canStartGame: boolean;
  canChat: boolean;
  canPlay: boolean;
  wifeRevengeAvailable: boolean;
  clownAvailable: boolean;
  votingStarted: boolean;
  myVote: number | null;
  nightActionDone: boolean;
  isAdmin: boolean;
  canModerate: boolean;
}

export interface Session {
  roomId: number;
  playerId: number;
  userId?: number;
  chatLimit?: number;
}

export interface LobbyRoom {
  id: number;
  name: string;
  playerCount: number;
  spectatorCount: number;
  maxPlayers: number;
  phase: GamePhase;
}

export type NightAction =
  | { type: 'kill'; targetId: number }
  | { type: 'check'; targetId: number }
  | { type: 'heal'; targetId: number }
  | { type: 'seduce'; targetId: number }
  | { type: 'swap'; targetId: number; targetId2: number }
  | { type: 'revenge'; targetId: number };

export interface PrivateNote {
  playerId: number;
  message: string;
}

export interface NightResolveResult {
  privateNotes: PrivateNote[];
}
