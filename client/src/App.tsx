import { lazy, Suspense, useEffect, useState, useCallback, useRef, type ReactNode } from 'react';
import type { Socket } from 'socket.io-client';
import Auth from './components/Auth';
import Menu, { type MenuView } from './components/Menu';
import Lobby, { type LobbyScreen } from './components/Lobby';
import CabinetHub from './components/CabinetHub';
import PageLoader from './components/PageLoader';
import { infoSectionFromPath, isPublicInfoPath, pathForInfoSection, INFO_PATHS } from './infoRouting';
import { isPublicBlogPath } from './blogRouting';
import { isPublicOnlinePath } from './onlineRouting';
import {
  isPublicProfilePath,
  profileStatsPath,
  profileUserIdFromPath,
  readInitialProfileUserId,
} from './profileRouting';
import {
  parseRoomPath,
  readInitialRoomScreen,
  roomGamePath,
  roomMembersPath,
  type RoomScreen,
} from './roomRouting';
import { DEFAULT_PAGE_META, updatePageMeta } from './seo';
import { clearSession, fetchMe, fetchUnreadMailCount, fetchUnreadNewsCount, fetchThemeSettings, fetchNotifications, markNotificationRead, markAllNotificationsRead, saveSession, loadStoredPlayerId, saveStoredPlayerId, clearStoredPlayerIds, telegramWebAppLogin } from './api';
import { isLikelyTelegramWebApp, waitForTelegramWebApp } from './telegramWebApp';
import type { LobbyRoom, RoomState, User, ThemeId, LobbyUpdate, SiteBranding, UserNotification, LobbyAnnouncement } from './types';
import { applyTheme, resolveTheme, DEFAULT_THEME } from './themes';
import { cacheSiteBranding, loadCachedBranding } from './siteBranding';
import SiteFooter from './components/SiteFooter';
import GuestLayout from './components/GuestLayout';
import InstallAppBanner from './components/InstallAppBanner';
import NotificationBell from './components/NotificationBell';
import {
  getMobileNavPlacement,
  type MobileNavPlacement,
} from './utils/mobileNav';
import { attachPageWheelScroll } from './utils/wheelScroll';

const OnlineUsers = lazy(() => import('./components/OnlineUsers'));
const News = lazy(() => import('./components/News'));
const Info = lazy(() => import('./components/Info'));
const BlogPage = lazy(() => import('./components/BlogPage'));
const AdminPanel = lazy(() => import('./components/AdminPanel'));
const Room = lazy(() => import('./components/Room'));
const RoomMembersPage = lazy(() => import('./components/RoomMembersPage'));
const Messages = lazy(() => import('./components/Messages'));
const UserSearch = lazy(() => import('./components/UserSearch'));
const CabinetProfileSettings = lazy(() => import('./components/CabinetProfileSettings'));
const CabinetAccountSettings = lazy(() => import('./components/CabinetAccountSettings'));
const CabinetSupport = lazy(() => import('./components/CabinetSupport'));
const Clans = lazy(() => import('./components/Clans'));
const UserStatisticsPage = lazy(() => import('./components/UserStatisticsPage'));

function ViewSuspense({ children, label }: { children: ReactNode; label?: string }) {
  return <Suspense fallback={<PageLoader label={label} compact />}>{children}</Suspense>;
}
const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ??
  (import.meta.env.DEV ? 'http://localhost:3001' : undefined);

type AppView = MenuView | 'room' | 'blog';

function presenceSection(
  view: AppView,
  lobbyScreen: LobbyScreen,
  profileStatsUserId: number | null,
  inVisibleRoom: boolean
): string {
  if (profileStatsUserId != null) return 'profile';
  if (inVisibleRoom || view === 'room') return 'room';
  if (view === 'news') return 'news';
  if (view === 'clans') return 'clans';
  if (view === 'cabinet') return 'cabinet';
  if (view === 'info') return 'info';
  if (view === 'blog') return 'blog';
  if (view === 'admin') return 'admin';
  if (view === 'lobby' && lobbyScreen === 'online-users') return 'online';
  return 'lobby';
}

interface RoomJoinResponse {
  error?: string;
  playerId?: number;
  state?: RoomState;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('mafia_token'));
  const [authLoading, setAuthLoading] = useState(true);
  const [view, setView] = useState<AppView>('lobby');

  const [socket, setSocket] = useState<Socket | null>(null);
  const [rooms, setRooms] = useState<LobbyRoom[]>([]);
  const [siteOnlineCount, setSiteOnlineCount] = useState(0);
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [currentRoomId, setCurrentRoomId] = useState<number | null>(null);
  const [roomScreen, setRoomScreen] = useState<RoomScreen>(() => readInitialRoomScreen());
  const [roomMinimized, setRoomMinimized] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [unreadMailCount, setUnreadMailCount] = useState(0);
  const [unreadNewsCount, setUnreadNewsCount] = useState(0);
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [notificationUnreadCount, setNotificationUnreadCount] = useState(0);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [lobbyScreen, setLobbyScreen] = useState<LobbyScreen>('rooms');
  const [mobileNav, setMobileNav] = useState<MobileNavPlacement>(() => getMobileNavPlacement());
  const [clansInitialId, setClansInitialId] = useState<number | null>(null);
  const [clansBackTo, setClansBackTo] = useState<'rooms' | 'cabinet'>('rooms');
  const appBodyRef = useRef<HTMLDivElement>(null);
  const [composeToUserId, setComposeToUserId] = useState<number | null>(null);
  const [composeToUsername, setComposeToUsername] = useState<string | null>(null);
  const [messageThreadUserId, setMessageThreadUserId] = useState<number | null>(null);
  const [messageThreadUsername, setMessageThreadUsername] = useState<string | null>(null);
  const [messagesOpenUnread, setMessagesOpenUnread] = useState(false);
  const [adminInitialView, setAdminInitialView] = useState<'hub' | 'violations'>('hub');
  const [mailReadReceipt, setMailReadReceipt] = useState<{
    readerId: number;
    messageIds: number[];
  } | null>(null);
  const [profileStatsUserId, setProfileStatsUserId] = useState<number | null>(() =>
    readInitialProfileUserId()
  );
  const statsReturnRef = useRef<{
    path: string;
    view: AppView;
    lobbyScreen: LobbyScreen;
  } | null>(null);
  const currentRoomIdRef = useRef<number | null>(null);
  currentRoomIdRef.current = currentRoomId;

  const applyRoomState = useCallback((state: RoomState) => {
    const activeId = currentRoomIdRef.current;
    if (activeId != null && state.id !== activeId) return;
    setRoomState(state);
  }, []);
  const [siteDefaultTheme, setSiteDefaultTheme] = useState<ThemeId>(DEFAULT_THEME);
  const [siteBranding, setSiteBranding] = useState<SiteBranding>(loadCachedBranding);
  const [lobbyAnnouncement, setLobbyAnnouncement] = useState<LobbyAnnouncement>({
    enabled: false,
    text: '',
  });

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      const themePromise = fetchThemeSettings()
        .then(({ defaultTheme, branding, lobbyAnnouncement: announcement }) => {
          if (cancelled) return;
          setSiteDefaultTheme(defaultTheme);
          setSiteBranding(branding);
          cacheSiteBranding(branding);
          setLobbyAnnouncement(announcement ?? { enabled: false, text: '' });
        })
        .catch(() => {});

      const storedToken = localStorage.getItem('mafia_token');

      const webApp = await waitForTelegramWebApp();
      if (cancelled) return;

      // Telegram WebApp auto-login only when there is no password/session token yet.
      if (webApp?.initData && !storedToken) {
        try {
          const { token: tgToken, user: tgUser } = await telegramWebAppLogin(webApp.initData, true);
          if (cancelled) return;
          saveSession(tgToken, tgUser);
          setToken(tgToken);
          setUser(tgUser);
          await themePromise;
          if (!cancelled) setAuthLoading(false);
          return;
        } catch {
          if (!cancelled) {
            clearSession();
            setToken(null);
            setUser(null);
          }
        }
      }

      if (!storedToken) {
        await themePromise;
        if (!cancelled) setAuthLoading(false);
        return;
      }

      try {
        const [{ user: me }] = await Promise.all([fetchMe(), themePromise]);
        if (cancelled) return;
        setUser(me);
        saveSession(storedToken, me);
        setToken(storedToken);
      } catch {
        if (!cancelled) {
          clearSession();
          setToken(null);
          setUser(null);
        }
      } finally {
        if (!cancelled) setAuthLoading(false);
      }
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    applyTheme(resolveTheme(user?.theme ?? null, siteDefaultTheme));
  }, [user?.theme, siteDefaultTheme]);

  useEffect(() => {
    const el = appBodyRef.current;
    if (!el) return;
    return attachPageWheelScroll(el);
  }, [user, token]);

  useEffect(() => {
    if (!user) return;
    if (isPublicInfoPath(window.location.pathname)) {
      setView('info');
    } else if (isPublicBlogPath(window.location.pathname)) {
      setView('blog');
    }
    const profileId = profileUserIdFromPath(window.location.pathname);
    if (profileId) setProfileStatsUserId(profileId);
  }, [user]);

  useEffect(() => {
    if (!user || view === 'info' || view === 'room' || view === 'blog') return;
    if (view === 'lobby') {
      updatePageMeta(DEFAULT_PAGE_META);
    } else if (view === 'news') {
      updatePageMeta({
        title: 'Новости',
        description: 'Новости и объявления онлайн-игры «Мафия».',
        path: '/news',
      });
    }
  }, [view, user]);

  useEffect(() => {
    if (!user) return;
    const onPopState = () => {
      const path = window.location.pathname;
      const roomPath = parseRoomPath(path);
      if (roomPath && currentRoomId === roomPath.roomId) {
        setRoomScreen(roomPath.screen);
        setRoomMinimized(false);
        setProfileStatsUserId(null);
        return;
      }
      if (isPublicInfoPath(path)) {
        setView('info');
        setProfileStatsUserId(null);
      } else if (isPublicBlogPath(path)) {
        setView('blog');
        setProfileStatsUserId(null);
      } else if (isPublicProfilePath(path)) {
        setProfileStatsUserId(profileUserIdFromPath(path));
        setView('lobby');
      } else if (path === '/' || path === '') {
        setLobbyScreen('rooms');
        setView('lobby');
        setProfileStatsUserId(null);
        statsReturnRef.current = null;
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [user, currentRoomId]);

  useEffect(() => {
    if (!user) return;
    void import('./components/Room');
    if (user.canAccessAdminPanel) void import('./components/AdminPanel');
  }, [user]);

  useEffect(() => {
    if (!token || !user) {
      setSocket(null);
      return;
    }

    let cancelled = false;
    let active: Socket | null = null;
    const authToken = token;

    void (async () => {
      try {
        const { io } = await import('socket.io-client');
        if (cancelled) return;

        const s = io(SOCKET_URL, {
          transports: ['websocket', 'polling'],
          auth: { token: authToken },
        });
        active = s;

        s.on('connect_error', (err: Error) => {
          const msg = err.message || '';
          if (msg.includes('авториза') || msg.includes('токен') || msg.includes('заблокирован')) {
            clearSession();
            setUser(null);
            setToken(null);
            setError(msg.includes('заблокирован') ? msg : 'Сессия истекла. Войдите снова.');
          }
        });

        s.on('lobby:update', (payload: LobbyRoom[] | LobbyUpdate) => {
          if (Array.isArray(payload)) {
            setRooms(payload);
          } else {
            setRooms(payload.rooms);
            setSiteOnlineCount(payload.onlineCount);
          }
        });
        s.on('room:state', applyRoomState);
        s.on('notification:private', ({ message }: { message: string }) => {
          setNotification(message);
          setTimeout(() => setNotification(null), 8000);
        });

        s.on('pm:unread', ({ count }: { count: number }) => {
          setUnreadMailCount(count);
        });

        s.on(
          'pm:read',
          ({ readerId, messageIds }: { readerId: number; messageIds: number[] }) => {
            setMailReadReceipt({ readerId, messageIds });
          }
        );

        const applyNotificationSync = (list: UserNotification[], unreadCount: number) => {
          setNotifications(list);
          setNotificationUnreadCount(unreadCount);
        };

        s.on('connect', () => {
          void fetchNotifications()
            .then(({ notifications: list, unreadCount }) => applyNotificationSync(list, unreadCount))
            .catch(() => {});
        });

        s.on(
          'notification:sync',
          ({ notifications: list, unreadCount }: { notifications: UserNotification[]; unreadCount: number }) => {
            applyNotificationSync(list, unreadCount);
          }
        );

        s.on(
          'notification:new',
          ({ notification, unreadCount }: { notification: UserNotification; unreadCount: number }) => {
            setNotifications((prev) => {
              const without = prev.filter((item) => item.id !== notification.id);
              return [notification, ...without].slice(0, 40);
            });
            setNotificationUnreadCount(unreadCount);
            if (notification.type === 'mail') {
              const payload = notification.payload;
              const fromUserId = typeof payload?.fromUserId === 'number' ? payload.fromUserId : undefined;
              if (fromUserId) {
                void fetchUnreadMailCount()
                  .then(({ count }) => setUnreadMailCount(count))
                  .catch(() => {});
              }
            }
          }
        );

        s.on(
          'pm:received',
          ({ unreadCount }: { fromDisplayName: string; preview: string; unreadCount: number }) => {
            setUnreadMailCount(unreadCount);
            void fetchNotifications()
              .then(({ notifications: list, unreadCount: bellUnread }) =>
                applyNotificationSync(list, bellUnread)
              )
              .catch(() => {});
          }
        );

        s.on('auth:kicked', ({ reason }: { reason?: string }) => {
          clearSession();
          setUser(null);
          setToken(null);
          setSocket(null);
          currentRoomIdRef.current = null;
          setCurrentRoomId(null);
          setRoomState(null);
          setRoomMinimized(false);
          setRoomScreen('game');
          clearStoredPlayerIds();
          setView('lobby');
          setError(reason || 'Сессия завершена');
        });

        s.on('room:kicked', ({ reason, roomId }: { reason?: string; roomId?: number }) => {
          if (roomId != null && currentRoomIdRef.current != null && roomId !== currentRoomIdRef.current) {
            return;
          }
          currentRoomIdRef.current = null;
          setCurrentRoomId(null);
          setRoomState(null);
          setRoomMinimized(false);
          setRoomScreen('game');
          setView('lobby');
          clearStoredPlayerIds();
          setError(reason || 'Вы вышли из комнаты');
        });

        if (cancelled) {
          s.disconnect();
          return;
        }
        setSocket(s);
      } catch (err) {
        if (!cancelled) {
          console.error('socket.io load failed', err);
          setError('Не удалось подключиться. Обновите страницу.');
        }
      }
    })();

    return () => {
      cancelled = true;
      active?.disconnect();
    };
  }, [token, user?.id, applyRoomState]);

  useEffect(() => {
    if (!socket) return;
    const emitWhere = () => {
      socket.emit('presence:where', {
        section: presenceSection(
          view,
          lobbyScreen,
          profileStatsUserId,
          !!currentRoomId && !roomMinimized
        ),
      });
    };
    emitWhere();
    socket.on('connect', emitWhere);
    return () => {
      socket.off('connect', emitWhere);
    };
  }, [socket, view, lobbyScreen, profileStatsUserId, currentRoomId, roomMinimized]);

  useEffect(() => {
    if (!token) return;
    void fetchUnreadMailCount()
      .then(({ count }) => setUnreadMailCount(count))
      .catch(() => {});
    void fetchUnreadNewsCount()
      .then(({ count }) => setUnreadNewsCount(count))
      .catch(() => {});
    setNotificationsLoading(true);
    void fetchNotifications()
      .then(({ notifications: list, unreadCount }) => {
        setNotifications(list);
        setNotificationUnreadCount(unreadCount);
      })
      .catch(() => {})
      .finally(() => setNotificationsLoading(false));
  }, [token]);

  const openMessages = useCallback(
    (opts?: { userId?: number; username?: string; thread?: boolean; openUnread?: boolean }) => {
      if (opts?.thread && opts.userId) {
        setMessageThreadUserId(opts.userId);
        setMessageThreadUsername(opts.username ?? null);
        setComposeToUserId(null);
        setComposeToUsername(null);
        setMessagesOpenUnread(false);
      } else if (opts?.openUnread) {
        setMessageThreadUserId(null);
        setMessageThreadUsername(null);
        setComposeToUserId(null);
        setComposeToUsername(null);
        setMessagesOpenUnread(true);
      } else {
        setMessageThreadUserId(null);
        setMessageThreadUsername(null);
        setComposeToUserId(opts?.userId ?? null);
        setComposeToUsername(opts?.username ?? null);
        setMessagesOpenUnread(false);
      }
      // Room UI is a full-screen branch — leave it so cabinet mail can render.
      if (currentRoomIdRef.current != null) {
        setRoomMinimized(true);
      }
      setView('cabinet');
      setLobbyScreen('cabinet-messages');
    },
    []
  );

  const openProfileStatistics = useCallback(
    (userId: number) => {
      if (profileStatsUserId == null) {
        statsReturnRef.current = {
          path: `${window.location.pathname}${window.location.hash}`,
          view,
          lobbyScreen,
        };
      }
      window.history.pushState(null, '', profileStatsPath(userId));
      setProfileStatsUserId(userId);
    },
    [view, lobbyScreen, profileStatsUserId]
  );

  const openClan = useCallback((clanId: number) => {
    if (currentRoomIdRef.current != null) {
      setRoomMinimized(true);
    }
    setProfileStatsUserId(null);
    setClansBackTo(
      view === 'cabinet' || String(lobbyScreen).startsWith('cabinet') ? 'cabinet' : 'rooms'
    );
    setClansInitialId(clanId);
    setView('clans');
    window.history.pushState(null, '', '/');
  }, [view, lobbyScreen]);

  const closeProfileStatistics = useCallback(() => {
    setProfileStatsUserId(null);
    const ctx = statsReturnRef.current;
    statsReturnRef.current = null;
    if (ctx && !currentRoomId) {
      setView(ctx.view);
      setLobbyScreen(ctx.lobbyScreen);
      window.history.pushState(null, '', ctx.path || '/');
    } else if (window.location.pathname.startsWith('/profile/')) {
      window.history.pushState(null, '', '/');
    }
  }, [currentRoomId]);

  const handleAuthSuccess = useCallback((authUser: User, authToken: string) => {
    setError(null);
    setLobbyScreen('rooms');
    setProfileStatsUserId(null);
    setClansInitialId(null);
    currentRoomIdRef.current = null;
    setCurrentRoomId(null);
    setRoomState(null);
    setRoomMinimized(false);
    setRoomScreen('game');
    setRooms([]);
    setView('lobby');
    setUser(authUser);
    setToken(authToken);
    setAuthLoading(false);
    window.history.replaceState(null, '', '/');
  }, []);

  const goToLobbyRooms = useCallback(() => {
    setLobbyScreen('rooms');
    setComposeToUserId(null);
    setComposeToUsername(null);
    setView('lobby');
  }, []);

  const leaveClans = useCallback(() => {
    setClansInitialId(null);
    if (clansBackTo === 'cabinet') {
      setLobbyScreen('cabinet');
      setView('cabinet');
      return;
    }
    goToLobbyRooms();
  }, [clansBackTo, goToLobbyRooms]);

  const openClansBrowse = useCallback((from: 'rooms' | 'cabinet' = 'rooms') => {
    setClansBackTo(from);
    setClansInitialId(null);
    setView('clans');
  }, []);

  const handleLogout = useCallback(() => {
    socket?.disconnect();
    clearSession();
    setUser(null);
    setToken(null);
    setSocket(null);
    setRooms([]);
    setRoomState(null);
    currentRoomIdRef.current = null;
    setCurrentRoomId(null);
    setRoomMinimized(false);
    setRoomScreen('game');
    clearStoredPlayerIds();
    setView('lobby');
  }, [socket]);

  const handleUserUpdate = useCallback(
    (updated: User) => {
      setUser(updated);
      if (token) saveSession(token, updated);
    },
    [token]
  );

  const joinRoom = useCallback(
    (roomId: number) => {
      if (!socket || !user) return;
      if (currentRoomIdRef.current === roomId) {
        setRoomMinimized(false);
        setRoomScreen('game');
        setView('room');
        window.history.pushState(null, '', roomGamePath(roomId));
        return;
      }
      setError(null);
      const previousId = currentRoomIdRef.current;
      currentRoomIdRef.current = roomId;
      setCurrentRoomId(roomId);
      setRoomState(null);
      setRoomMinimized(false);
      setRoomScreen('game');
      setView('room');
      window.history.pushState(null, '', roomGamePath(roomId));

      const reconnectId = loadStoredPlayerId(user.id, roomId);
      socket.emit('room:join', { roomId, playerId: reconnectId ?? undefined }, (res: RoomJoinResponse) => {
        if (res?.error) {
          currentRoomIdRef.current = previousId;
          setCurrentRoomId(previousId);
          setError(res.error);
          if (!previousId) {
            setRoomState(null);
            setLobbyScreen('rooms');
            setView('lobby');
            window.history.pushState(null, '', '/');
          }
          return;
        }
        if (res.playerId != null) {
          saveStoredPlayerId(user.id, res.playerId, roomId);
        }
        if (res.state) applyRoomState(res.state);
      });
    },
    [socket, user, applyRoomState]
  );

  const leaveRoom = useCallback(() => {
    socket?.emit('room:detach');
    currentRoomIdRef.current = null;
    setCurrentRoomId(null);
    setRoomState(null);
    setRoomMinimized(false);
    setRoomScreen('game');
    setLobbyScreen('rooms');
    setView('lobby');
    window.history.pushState(null, '', '/');
  }, [socket]);

  const minimizeMafiaRoom = useCallback(() => {
    setRoomMinimized(true);
    setRoomScreen('game');
    setLobbyScreen('rooms');
    setView('lobby');
    window.history.pushState(null, '', '/');
  }, []);

  const handleNotificationSelect = useCallback(
    async (notification: UserNotification) => {
      if (!notification.isRead) {
        try {
          const { unreadCount } = await markNotificationRead(notification.id);
          setNotificationUnreadCount(unreadCount);
          setNotifications((prev) =>
            prev.map((item) => (item.id === notification.id ? { ...item, isRead: true } : item))
          );
        } catch {
          /* ignore */
        }
      }
      setNotificationsOpen(false);

      if (currentRoomId && !roomMinimized) {
        if ((roomState?.kind === 'chat' || roomState?.kind === 'clan')) leaveRoom();
        else minimizeMafiaRoom();
      }

      if (notification.action === 'messages') {
        const fromUserId =
          typeof notification.payload?.fromUserId === 'number'
            ? notification.payload.fromUserId
            : undefined;
        const fromUsername =
          typeof notification.payload?.fromUsername === 'string'
            ? notification.payload.fromUsername
            : undefined;
        openMessages({ userId: fromUserId, username: fromUsername, thread: true });
        return;
      }

      if (notification.action === 'admin_violations') {
        if (user?.canAccessAdminPanel) {
          if (currentRoomId && !roomMinimized) {
            if ((roomState?.kind === 'chat' || roomState?.kind === 'clan')) leaveRoom();
            else minimizeMafiaRoom();
          }
          setAdminInitialView('violations');
          setView('admin');
        }
        return;
      }

      if (notification.action === 'profile') {
        const userId =
          typeof notification.payload?.userId === 'number' ? notification.payload.userId : user?.id;
        if (userId) openProfileStatistics(userId);
      }
    },
    [
      currentRoomId,
      roomMinimized,
      roomState?.kind,
      leaveRoom,
      minimizeMafiaRoom,
      openMessages,
      openProfileStatistics,
      user?.id,
    ]
  );

  const handleMarkAllNotificationsRead = useCallback(async () => {
    try {
      const { unreadCount } = await markAllNotificationsRead();
      setNotificationUnreadCount(unreadCount);
      setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
    } catch {
      /* ignore */
    }
  }, []);

  const notificationBar = (
    <header className="app-topbar">
      <NotificationBell
        notifications={notifications}
        unreadCount={notificationUnreadCount}
        open={notificationsOpen}
        loading={notificationsLoading}
        onToggle={() => {
          setNotificationsOpen((prev) => {
            const next = !prev;
            if (next) {
              void fetchNotifications()
                .then(({ notifications: list, unreadCount }) => {
                  setNotifications(list);
                  setNotificationUnreadCount(unreadCount);
                })
                .catch(() => {});
            }
            return next;
          });
        }}
        onClose={() => setNotificationsOpen(false)}
        onMarkAllRead={() => void handleMarkAllNotificationsRead()}
        onSelect={(item) => void handleNotificationSelect(item)}
      />
    </header>
  );

  const openRoomMembers = useCallback(() => {
    if (!currentRoomId) return;
    setRoomScreen('members');
    window.history.pushState(null, '', roomMembersPath(currentRoomId));
  }, [currentRoomId]);

  const backToRoomGame = useCallback(() => {
    if (!currentRoomId) return;
    setRoomScreen('game');
    window.history.pushState(null, '', roomGamePath(currentRoomId));
  }, [currentRoomId]);

  useEffect(() => {
    if (!socket || !currentRoomId || !user) return;

    const resyncRoom = () => {
      const reconnectId = loadStoredPlayerId(user.id, currentRoomId);
      socket.emit('room:join', { roomId: currentRoomId, playerId: reconnectId ?? undefined }, (res: RoomJoinResponse) => {
        if (res?.error) {
          setError(res.error);
          currentRoomIdRef.current = null;
          setCurrentRoomId(null);
          setRoomState(null);
          clearStoredPlayerIds();
          setLobbyScreen('rooms');
          setView('lobby');
          return;
        }
        if (res?.playerId != null) {
          saveStoredPlayerId(user.id, res.playerId, currentRoomId);
        }
        if (res?.state) applyRoomState(res.state);
      });
    };

    socket.on('connect', resyncRoom);
    return () => {
      socket.off('connect', resyncRoom);
    };
  }, [socket, currentRoomId, user, applyRoomState]);

  if (authLoading && (token || isLikelyTelegramWebApp())) {
    return (
      <div className="app loading-screen">
        <PageLoader label="Подключаемся…" />
      </div>
    );
  }

  if ((!user || !token) && isPublicProfilePath(window.location.pathname)) {
    const profileId = profileUserIdFromPath(window.location.pathname);
    if (profileId) {
      return (
        <GuestLayout branding={siteBranding}>
          <ViewSuspense label="Загружаем статистику…">
            <UserStatisticsPage
              userId={profileId}
              onBack={() => {
                window.history.pushState(null, '', '/');
                window.location.href = '/';
              }}
            />
          </ViewSuspense>
        </GuestLayout>
      );
    }
  }

  if ((!user || !token) && isPublicInfoPath(window.location.pathname)) {
    return (
      <GuestLayout branding={siteBranding}>
        <ViewSuspense label="Загружаем раздел…">
          <Info
            initialSection={infoSectionFromPath(window.location.pathname)}
            publicMode
          />
        </ViewSuspense>
      </GuestLayout>
    );
  }

  if ((!user || !token) && isPublicBlogPath(window.location.pathname)) {
    return (
      <GuestLayout branding={siteBranding}>
        <ViewSuspense label="Загружаем блог…">
          <BlogPage />
        </ViewSuspense>
      </GuestLayout>
    );
  }

  if ((!user || !token) && isPublicOnlinePath(window.location.pathname)) {
    return (
      <GuestLayout branding={siteBranding}>
        <ViewSuspense label="Игроки онлайн…">
          <OnlineUsers
            onBack={() => {
              window.location.href = '/';
            }}
            onOpenStatistics={(userId) => {
              window.location.href = profileStatsPath(userId);
            }}
            backLabel="← Вход"
          />
        </ViewSuspense>
      </GuestLayout>
    );
  }

  if (!user || !token) {
    return <Auth onSuccess={handleAuthSuccess} branding={siteBranding} />;
  }

  if (currentRoomId && !roomMinimized) {
    const isChatRoom = roomState?.kind === 'chat' || roomState?.kind === 'clan';
    return (
      <div className="app app-in-room">
        {notificationBar}
        {notification && (
          <div className="toast" onClick={() => setNotification(null)}>
            🔒 {notification}
          </div>
        )}
        {error && (
          <div className="toast error" onClick={() => setError(null)}>
            {error}
          </div>
        )}
        {profileStatsUserId != null ? (
          <ViewSuspense label="Статистика…">
            <UserStatisticsPage
              userId={profileStatsUserId}
              currentUser={user}
              onBack={closeProfileStatistics}
              onWriteMessage={(userId, username) => openMessages({ userId, username })}
            />
          </ViewSuspense>
        ) : roomScreen === 'members' && roomState ? (
          <ViewSuspense label="Кто в комнате…">
            <RoomMembersPage
              state={roomState}
              onBack={backToRoomGame}
              onViewProfile={openProfileStatistics}
            />
          </ViewSuspense>
        ) : (
          <ViewSuspense label="Загружаем комнату…">
            <Room
              socket={socket}
              state={roomState}
              onLeave={!roomState || isChatRoom ? leaveRoom : minimizeMafiaRoom}
              onOpenMembers={openRoomMembers}
              onStateUpdate={applyRoomState}
              currentUserId={user.id}
              onJoinRoom={joinRoom}
              onWriteMessage={(userId, username) => openMessages({ userId, username })}
              onOpenStatistics={openProfileStatistics}
              onOpenClan={openClan}
            />
          </ViewSuspense>
        )}
      </div>
    );
  }

  return (
    <div className="app app-shell" data-mobile-nav={mobileNav}>
      {notification && (
        <div className="toast" onClick={() => setNotification(null)}>
          🔒 {notification}
        </div>
      )}
      {error && (
        <div className="toast error" onClick={() => setError(null)}>
          {error}
        </div>
      )}

      <div className="app-main">
        {notificationBar}
        <div className="app-body" ref={appBodyRef}>
        {profileStatsUserId != null ? (
          <ViewSuspense label="Статистика…">
            <UserStatisticsPage
              userId={profileStatsUserId}
              currentUser={user}
              onBack={closeProfileStatistics}
              onWriteMessage={(userId, username) => openMessages({ userId, username })}
            />
          </ViewSuspense>
        ) : (
          <>
        {view === 'lobby' && lobbyScreen === 'rooms' && (
          <Lobby
            rooms={rooms}
            siteOnlineCount={siteOnlineCount}
            announcement={lobbyAnnouncement}
            onJoin={joinRoom}
            unreadMailCount={unreadMailCount}
            onOpenMessages={() => openMessages({ openUnread: true })}
            onOpenOnlineUsers={() => setLobbyScreen('online-users')}
          />
        )}
        {view === 'lobby' && lobbyScreen === 'online-users' && (
          <ViewSuspense label="Игроки онлайн…">
            <OnlineUsers
              currentUser={user}
              onBack={() => setLobbyScreen('rooms')}
              onWriteMessage={(userId, username) => openMessages({ userId, username })}
              onOpenStatistics={openProfileStatistics}
              onOpenClan={openClan}
              onJoinRoom={joinRoom}
            />
          </ViewSuspense>
        )}
        {view === 'news' && (
          <ViewSuspense label="Новости…">
            <News
              user={user}
              onBack={() => goToLobbyRooms()}
              onRead={() => setUnreadNewsCount(0)}
            />
          </ViewSuspense>
        )}
        {view === 'clans' && (
          <ViewSuspense label="Кланы…">
            <Clans
              key={clansInitialId ?? 'browse'}
              initialClanId={clansInitialId}
              backLabel={clansBackTo === 'cabinet' ? '← Кабинет' : '← Комнаты'}
              onBack={leaveClans}
              onJoinRoom={joinRoom}
            />
          </ViewSuspense>
        )}
        {view === 'cabinet' && lobbyScreen === 'cabinet-settings' && (
          <ViewSuspense label="Анкета…">
            <CabinetProfileSettings
              user={user}
              onUpdate={handleUserUpdate}
              onOpenStatistics={() => openProfileStatistics(user.id)}
              onBack={() => setLobbyScreen('cabinet')}
            />
          </ViewSuspense>
        )}
        {view === 'cabinet' && lobbyScreen === 'cabinet-account-settings' && (
          <ViewSuspense label="Настройки…">
            <CabinetAccountSettings
              user={user}
              onUpdate={handleUserUpdate}
              onBack={() => setLobbyScreen('cabinet')}
              mobileNav={mobileNav}
              onMobileNavChange={setMobileNav}
            />
          </ViewSuspense>
        )}
        {view === 'cabinet' && lobbyScreen === 'cabinet-messages' && (
          <ViewSuspense label="Сообщения…">
            <Messages
              composeToUserId={composeToUserId}
              composeToUsername={composeToUsername}
              threadUserId={messageThreadUserId}
              threadUsername={messageThreadUsername}
              openUnread={messagesOpenUnread}
              mailReadReceipt={mailReadReceipt}
              onUnreadChange={setUnreadMailCount}
              onOpenFaq={() => {
                window.history.pushState({}, '', INFO_PATHS.faq);
                setView('info');
                setLobbyScreen('rooms');
              }}
              onInitialNavigationHandled={() => {
                setMessageThreadUserId(null);
                setMessageThreadUsername(null);
                setMessagesOpenUnread(false);
              }}
              onBack={() => {
                setComposeToUserId(null);
                setComposeToUsername(null);
                setMessageThreadUserId(null);
                setMessageThreadUsername(null);
                setMessagesOpenUnread(false);
                setLobbyScreen('cabinet');
              }}
            />
          </ViewSuspense>
        )}
        {view === 'cabinet' && lobbyScreen === 'cabinet-search' && (
          <ViewSuspense label="Поиск…">
            <UserSearch
              currentUser={user}
              onBack={() => setLobbyScreen('cabinet')}
              onWriteMessage={(userId, username) => openMessages({ userId, username })}
              onOpenStatistics={openProfileStatistics}
              onOpenClan={openClan}
            />
          </ViewSuspense>
        )}
        {view === 'cabinet' && lobbyScreen === 'cabinet-support' && (
          <ViewSuspense label="Поддержка…">
            <CabinetSupport onBack={() => setLobbyScreen('cabinet')} />
          </ViewSuspense>
        )}
        {view === 'cabinet' && lobbyScreen === 'cabinet' && (
          <CabinetHub
            user={user}
            unreadMailCount={unreadMailCount}
            onOpenProfileSettings={() => setLobbyScreen('cabinet-settings')}
            onOpenAccountSettings={() => setLobbyScreen('cabinet-account-settings')}
            onOpenMessages={() => openMessages({ openUnread: unreadMailCount > 0 })}
            onOpenSupport={() => setLobbyScreen('cabinet-support')}
            onOpenUserSearch={() => setLobbyScreen('cabinet-search')}
            onOpenClans={() => openClansBrowse('cabinet')}
            onOpenStatistics={() => openProfileStatistics(user.id)}
            onLogout={handleLogout}
            onBack={() => goToLobbyRooms()}
          />
        )}
        {view === 'info' && (
          <ViewSuspense label="Информация…">
            <Info
              initialSection={infoSectionFromPath(window.location.pathname)}
              currentUser={user}
              onWriteMessage={(userId, username) => openMessages({ userId, username })}
              onOpenStatistics={openProfileStatistics}
              onOpenClan={openClan}
            />
          </ViewSuspense>
        )}
        {view === 'blog' && (
          <ViewSuspense label="Блог…">
            <BlogPage
              onBack={() => {
                window.history.pushState(null, '', '/');
                goToLobbyRooms();
              }}
              backLabel="← Комнаты"
            />
          </ViewSuspense>
        )}
        {view === 'admin' && user.canAccessAdminPanel && (
          <ViewSuspense label="Админка…">
            <AdminPanel
              key={adminInitialView}
              initialSystemView={adminInitialView}
              onDefaultThemeChange={setSiteDefaultTheme}
              onBrandingChange={(branding) => {
                setSiteBranding(branding);
                cacheSiteBranding(branding);
              }}
              onLobbyAnnouncementChange={setLobbyAnnouncement}
              onOpenStatistics={openProfileStatistics}
            />
          </ViewSuspense>
        )}
          </>
        )}
        </div>

        <SiteFooter text={siteBranding.footerText} />
      </div>

      <InstallAppBanner />

      <Menu
        user={user}
        branding={siteBranding}
        view={view === 'room' || view === 'blog' ? 'lobby' : view}
        onNavigate={(v) => {
          if (v === 'lobby') {
            setLobbyScreen('rooms');
            setComposeToUserId(null);
            setComposeToUsername(null);
            setProfileStatsUserId(null);
            window.history.pushState(null, '', '/');
          }
          if (v === 'cabinet') {
            setLobbyScreen('cabinet');
            setComposeToUserId(null);
            setComposeToUsername(null);
            window.history.pushState(null, '', '/');
          }
          if (v === 'info') {
            window.history.pushState(null, '', pathForInfoSection('hub'));
          }
          if (v === 'news') {
            window.history.pushState(null, '', '/news');
          }
          if (v === 'clans') {
            setClansBackTo('rooms');
            setClansInitialId(null);
            window.history.pushState(null, '', '/');
          }
          if (v === 'admin') {
            setAdminInitialView('hub');
          }
          setView(v);
        }}
        onLogout={handleLogout}
        unreadMailCount={unreadMailCount}
        unreadNewsCount={unreadNewsCount}
      />
    </div>
  );
}
