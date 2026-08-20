export type GamePhase =
  | 'waiting'
  | 'registration'
  | 'roles'
  | 'day'
  | 'voting'
  | 'night'
  | 'ended';

export type UserRole = 'user' | 'watcher' | 'moderator' | 'admin';

export type RoomKind = 'game' | 'chat';

export type ThemeId = 'midnight' | 'emerald' | 'crimson' | 'day' | 'aurora' | 'sunset' | 'ocean';

export interface SiteBranding {
  logoUrl: string | null;
  logoText: string;
  logoMark: string;
  footerText: string;
}

export interface LobbyAnnouncement {
  enabled: boolean;
  text: string;
}

export type NotificationType = 'mail' | 'reputation_up' | 'reputation_down' | 'system';

export type AuthProvider = 'telegram' | 'vk' | 'email';

export type UserGender = 'male' | 'female' | '';

export interface UserNotification {
  id: number;
  type: NotificationType;
  title: string;
  body: string;
  action: string | null;
  payload: Record<string, unknown> | null;
  isRead: boolean;
  createdAt: string;
}

export interface User {
  id: number;
  username: string;
  email: string;
  displayName: string;
  gender: UserGender;
  city: string;
  bio: string;
  avatar: string | null;
  role: UserRole;
  isAdmin: boolean;
  isModerator: boolean;
  isWatcher: boolean;
  isStaff: boolean;
  canAccessAdminPanel: boolean;
  totalScore: number;
  mmr: number;
  gamesPlayed?: number;
  reputation?: number;
  createdAt: string;
  isBanned: boolean;
  banReason: string | null;
  bannedUntil?: string | null;
  chatLimit: number;
  theme: string | null;
  telegramUsername?: string | null;
  vkUsername?: string | null;
  needsEmailLink?: boolean;
  authProviders?: AuthProvider[];
}

export interface PublicUser extends User {
  messageCount?: number;
  quizCorrectAnswers?: number;
}

export interface LobbyRoom {
  id: number;
  name: string;
  kind: RoomKind;
  playerCount: number;
  spectatorCount: number;
  maxPlayers: number;
  phase: GamePhase;
  aiEnabled?: boolean;
  aiCount?: number;
}

export type ChatChannel = 'public' | 'mafia' | 'dead' | 'spectator' | 'private';

export interface ChatMessage {
  id: string | number;
  playerId?: number | null;
  playerName: string;
  authorGender?: UserGender;
  text: string;
  time: string;
  userId?: number | null;
  system?: boolean;
  deleted?: boolean;
  sourceChannel?: ChatChannel;
  isPrivate?: boolean;
  toPlayerId?: number | null;
  toPlayerName?: string | null;
  isBot?: boolean;
}

export interface ChatReplyTarget {
  playerId?: number;
  playerName: string;
  userId?: number;
  isBot?: boolean;
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
  | 'advocate'
  | 'highlander'
  | 'samurai'
  | 'citizen'
  | 'mountaineer'
  | null;

export interface RoomPlayer {
  id: number;
  userId: number | null;
  name: string;
  username: string;
  inGame: boolean;
  alive: boolean;
  score: number;
  connected: boolean;
  hasVoted: boolean;
  role: GameRole;
  roleLabel: string | null;
  isDon: boolean;
  isMafiaAlly?: boolean;
  isBot?: boolean;
  silenced?: boolean;
}

export interface RoomSpectator {
  id: number;
  userId: number | null;
  name: string;
  username: string;
  connected: boolean;
}

export interface RoomPresence {
  id: number;
  userId: number | null;
  name: string;
  username: string;
  connected: boolean;
  inGame: boolean;
  alive: boolean;
  roleLabel: string | null;
  isMe: boolean;
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
  hasHangVoted?: boolean;
  silenced?: boolean;
}

export interface RoomState {
  id: number;
  name: string;
  kind: RoomKind;
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
  leaveGameCooldownSec?: number;
  myPlayer: MyPlayer | null;
  myRole: GameRole;
  myRoleLabel: string | null;
  isDon: boolean;
  players: RoomPlayer[];
  spectators: RoomSpectator[];
  presence: RoomPresence[];
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
  votingStage?: 'nominate' | 'confirm';
  accusedId?: number | null;
  accusedName?: string | null;
  hasHangVoted?: boolean;
  nightActionDone: boolean;
  isAdmin: boolean;
  canModerate: boolean;
  canSilence: boolean;
  isQuizRoom?: boolean;
  aiEnabled?: boolean;
  aiCount?: number;
  mafiaTeam?: { id: number; username: string; isDon: boolean; roleLabel?: string }[];
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
  role: 'admin' | 'moderator' | 'watcher';
}

export interface UserSearchHit {
  id: number;
  username: string;
  displayName: string;
  city: string;
  avatar: string | null;
  totalScore: number;
  mmr?: number;
  isAdmin: boolean;
  isModerator: boolean;
  isOnline: boolean;
  lastSeenAt: string | null;
  location?: string;
}

export interface LeaderboardEntry {
  rank: number;
  id: number;
  username: string;
  displayName: string;
  city: string;
  avatar: string | null;
  totalScore: number;
  mmr: number;
  gamesPlayed: number;
  reputation: number;
  isAdmin: boolean;
  isModerator: boolean;
}

export interface QuizLeaderboardEntry {
  id: number;
  username: string;
  displayName: string;
  avatar: string | null;
  quizCorrectAnswers: number;
}

export interface UserPresence {
  isOnline: boolean;
  lastSeenAt: string | null;
}

export interface TeamStatBucket {
  games: number;
  wins: number;
  winRate: number;
}

export interface RoleStatBucket {
  role: string;
  roleLabel: string;
  games: number;
  wins: number;
  winRate: number;
}

export interface RecentGameStat {
  id: number;
  roomId: number;
  role: string;
  roleLabel: string;
  won: boolean;
  isDraw?: boolean;
  score: number;
  mmrDelta: number;
  mmrAfter: number;
  createdAt: string;
}

export interface UserStatistics {
  userId: number;
  mmr: number;
  rank: number | null;
  gamesPlayed: number;
  wins: number;
  losses: number;
  winRate: number;
  averageScore: number;
  town: TeamStatBucket;
  mafia: TeamStatBucket;
  roles: RoleStatBucket[];
  recentGames: RecentGameStat[];
}

export interface UserStatisticsResponse {
  user: User;
  statistics: UserStatistics;
}

export interface NewsPollOption {
  id: number;
  label: string;
  voteCount: number;
  percent: number;
}

export interface NewsPoll {
  id: number;
  newsId: number;
  question: string;
  endsAt: string | null;
  isClosed: boolean;
  totalVotes: number;
  options: NewsPollOption[];
  userVoteOptionId: number | null;
}

export interface NewsPollInput {
  enabled: boolean;
  question: string;
  options: string[];
  endsAt?: string | null;
}

export interface NewsPost {
  id: number;
  title: string;
  body: string;
  coverImage?: string | null;
  isPublished: boolean;
  isFeatured?: boolean;
  authorId?: number;
  authorName?: string;
  createdAt: string;
  updatedAt: string;
  commentCount?: number;
  poll?: NewsPoll | null;
}

export interface BlogPost {
  id: number;
  title: string;
  body: string;
  coverImage?: string | null;
  isPublished: boolean;
  authorId?: number;
  authorName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NewsComment {
  id: number;
  newsId: number;
  userId: number;
  body: string;
  parentId: number | null;
  replyToUserId: number | null;
  replyToAuthorName: string | null;
  replyToAuthorUsername: string | null;
  createdAt: string;
  authorName: string;
  authorUsername: string;
  authorAvatar: string | null;
}

export type ViolationType = 'profanity' | 'advertising' | 'other';

export interface ViolationLogEntry {
  id: number;
  violationType: ViolationType;
  messageText: string;
  authorUserId: number | null;
  authorName: string;
  roomId: number;
  roomName: string;
  channel: string;
  messageId: string;
  moderatorId: number;
  moderatorName: string;
  createdAt: string;
  messageAt?: string;
}

export interface LobbyUpdate {
  rooms: LobbyRoom[];
  onlineCount: number;
  siteStats?: PublicSiteStats;
}

export interface PublicSiteStats {
  gamesArchived: number;
  mafiaWins: number;
  townWins: number;
  draws: number;
  online: number;
  activePlayers: number;
}

export interface FriendUser extends PublicUser {
  isOnline: boolean;
  lastSeenAt: string | null;
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
  attachmentUrl?: string | null;
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
    isRead: boolean;
  };
  unreadCount: number;
}
