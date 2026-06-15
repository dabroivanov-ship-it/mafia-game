export type GamePhase =
  | 'waiting'
  | 'registration'
  | 'roles'
  | 'day'
  | 'voting'
  | 'night'
  | 'ended';

export type UserRole = 'user' | 'moderator' | 'admin';

export interface User {
  id: number;
  username: string;
  email: string;
  displayName: string;
  city: string;
  bio: string;
  avatar: string | null;
  role: UserRole;
  isAdmin: boolean;
  isModerator: boolean;
  isStaff: boolean;
  totalScore: number;
  createdAt: string;
  isBanned: boolean;
  banReason: string | null;
  chatLimit: number;
}

export interface PublicUser extends User {
  messageCount?: number;
}

export interface LobbyRoom {
  id: number;
  name: string;
  playerCount: number;
  spectatorCount: number;
  maxPlayers: number;
  phase: GamePhase;
}

export type ChatChannel = 'public' | 'mafia' | 'dead' | 'spectator' | 'private';

export interface ChatMessage {
  id: string | number;
  playerId?: number | null;
  playerName: string;
  text: string;
  time: string;
  userId?: number | null;
  system?: boolean;
  deleted?: boolean;
  sourceChannel?: ChatChannel;
  isPrivate?: boolean;
  toPlayerId?: number | null;
  toPlayerName?: string | null;
}

export interface ChatReplyTarget {
  playerId: number;
  playerName: string;
  userId?: number | null;
}

export type GameRole =
  | 'mafia'
  | 'commissar'
  | 'doctor'
  | 'homeless'
  | 'prostitute'
  | 'maniac'
  | 'clown'
  | 'commissar_wife'
  | 'citizen'
  | 'mountaineer'
  | null;

export interface RoomPlayer {
  id: number;
  userId: number | null;
  name: string;
  inGame: boolean;
  alive: boolean;
  score: number;
  connected: boolean;
  hasVoted: boolean;
  role: GameRole;
  roleLabel: string | null;
  isDon: boolean;
}

export interface RoomSpectator {
  id: number;
  userId: number | null;
  name: string;
  connected: boolean;
}

export interface MyPlayer {
  id: number;
  userId: number | null;
  name: string;
  username: string;
  inGame: boolean;
  connected: boolean;
  alive?: boolean;
  hasVoted?: boolean;
}

export interface RoomState {
  id: number;
  name: string;
  phase: GamePhase;
  maxPlayers: number;
  registeredCount: number;
  nightNumber: number;
  timerEnd: number | null;
  timerReason: string | null;
  winnerTeam: string | null;
  myId: number;
  isSpectator: boolean;
  isInGame: boolean;
  canJoinGame: boolean;
  joinGameCooldownSec: number;
  canLeaveGame: boolean;
  myPlayer: MyPlayer | null;
  myRole: GameRole;
  myRoleLabel: string | null;
  isDon: boolean;
  players: RoomPlayer[];
  spectators: RoomSpectator[];
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

export interface ApiError {
  error: string;
}

export interface StaffMember {
  id: number;
  username: string;
  displayName: string;
  city: string;
  avatar: string | null;
  role: 'admin' | 'moderator';
}

export interface NewsPost {
  id: number;
  title: string;
  body: string;
  isPublished: boolean;
  authorId?: number;
  authorName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProfileStaffMeta {
  lastIp: string | null;
  lastUserAgent: string | null;
}

export interface PrivateMessage {
  id: number;
  text: string;
  createdAt: string;
  isRead: boolean;
  direction?: 'in' | 'out';
  otherUser: {
    id: number;
    username: string;
    displayName: string;
    avatar: string | null;
  };
}

export interface MailConversation {
  otherUser: PrivateMessage['otherUser'];
  lastMessage: {
    id: number;
    text: string;
    createdAt: string;
    direction: 'in' | 'out';
  };
  unreadCount: number;
}
