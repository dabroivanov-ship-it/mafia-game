import { lazy, Suspense, useEffect, useState, useCallback, type ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import Auth from './components/Auth';
import Menu, { type MenuView } from './components/Menu';
import Lobby, { type LobbyScreen } from './components/Lobby';
import CabinetHub from './components/CabinetHub';
import PageLoader from './components/PageLoader';
import { infoSectionFromPath, isPublicInfoPath, pathForInfoSection } from './infoRouting';
import { DEFAULT_PAGE_META, updatePageMeta } from './seo';
import { clearSession, fetchMe, fetchUnreadMailCount, fetchThemeSettings, saveSession, loadStoredPlayerId, saveStoredPlayerId, clearStoredPlayerIds } from './api';
import type { LobbyRoom, RoomState, User, ThemeId, LobbyUpdate, SiteBranding } from './types';
import { applyTheme, resolveTheme, DEFAULT_THEME } from './themes';
import { DEFAULT_SITE_BRANDING } from './siteBranding';
import SiteFooter from './components/SiteFooter';

const OnlineUsers = lazy(() => import('./components/OnlineUsers'));
const News = lazy(() => import('./components/News'));
const Info = lazy(() => import('./components/Info'));
const AdminPanel = lazy(() => import('./components/AdminPanel'));
const Room = lazy(() => import('./components/Room'));
const Messages = lazy(() => import('./components/Messages'));
const UserSearch = lazy(() => import('./components/UserSearch'));
const CabinetProfileSettings = lazy(() => import('./components/CabinetProfileSettings'));
const CabinetSiteSettings = lazy(() => import('./components/CabinetSiteSettings'));

function ViewSuspense({ children, label }: { children: ReactNode; label?: string }) {
  return <Suspense fallback={<PageLoader label={label} compact />}>{children}</Suspense>;
}
const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ??
  (import.meta.env.DEV ? 'http://localhost:3001' : undefined);

type AppView = MenuView | 'room';

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
  const [notification, setNotification] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [unreadMailCount, setUnreadMailCount] = useState(0);
  const [pmNotice, setPmNotice] = useState<string | null>(null);
  const [lobbyScreen, setLobbyScreen] = useState<LobbyScreen>('rooms');
  const [composeToUserId, setComposeToUserId] = useState<number | null>(null);
  const [composeToUsername, setComposeToUsername] = useState<string | null>(null);
  const [siteDefaultTheme, setSiteDefaultTheme] = useState<ThemeId>(DEFAULT_THEME);
  const [siteBranding, setSiteBranding] = useState<SiteBranding>(DEFAULT_SITE_BRANDING);

  useEffect(() => {
    async function bootstrap() {
      const themePromise = fetchThemeSettings()
        .then(({ defaultTheme, branding }) => {
          setSiteDefaultTheme(defaultTheme);
          setSiteBranding(branding);
        })
        .catch(() => {});

      if (!token) {
        await themePromise;
        setAuthLoading(false);
        return;
      }

      try {
        const [{ user: me }] = await Promise.all([fetchMe(), themePromise]);
        setUser(me);
        saveSession(token, me);
      } catch {
        clearSession();
        setToken(null);
        setUser(null);
      } finally {
        setAuthLoading(false);
      }
    }
    void bootstrap();
  }, [token]);

  useEffect(() => {
    applyTheme(resolveTheme(user?.theme ?? null, siteDefaultTheme));
  }, [user?.theme, siteDefaultTheme]);

  useEffect(() => {
    if (!user) return;
    if (isPublicInfoPath(window.location.pathname)) {
      setView('info');
    }
  }, [user]);

  useEffect(() => {
    if (!user || view === 'info' || view === 'room') return;
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
      if (isPublicInfoPath(path)) {
        setView('info');
      } else if (path === '/' || path === '') {
        setView('lobby');
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    void import('./components/Room');
    if (user.isAdmin) void import('./components/AdminPanel');
  }, [user]);

  useEffect(() => {
    if (!token || !user) {
      setSocket(null);
      return;
    }

    const s = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      auth: { token },
    });

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
    s.on('room:state', setRoomState);
    s.on('notification:private', ({ message }: { message: string }) => {
      setNotification(message);
      setTimeout(() => setNotification(null), 8000);
    });

    s.on('pm:unread', ({ count }: { count: number }) => {
      setUnreadMailCount(count);
    });

    s.on(
      'pm:received',
      ({
        fromDisplayName,
        preview,
        unreadCount,
      }: {
        fromDisplayName: string;
        preview: string;
        unreadCount: number;
      }) => {
        setUnreadMailCount(unreadCount);
        setPmNotice(`✉️ ${fromDisplayName}: ${preview}`);
      }
    );

    s.on('auth:kicked', ({ reason }: { reason?: string }) => {
      clearSession();
      setUser(null);
      setToken(null);
      setSocket(null);
      setCurrentRoomId(null);
      setRoomState(null);
      clearStoredPlayerIds();
      setView('lobby');
      setError(reason || 'Сессия завершена');
    });

    s.on('room:kicked', ({ reason }: { reason?: string }) => {
      setCurrentRoomId(null);
      setRoomState(null);
      setView('lobby');
      clearStoredPlayerIds();
      setError(reason || 'Вы вышли из комнаты');
    });

    setSocket(s);
    return () => {
      s.disconnect();
    };
  }, [token, user]);

  useEffect(() => {
    if (!token) return;
    void fetchUnreadMailCount()
      .then(({ count }) => setUnreadMailCount(count))
      .catch(() => {});
  }, [token]);

  const openMessages = useCallback((opts?: { userId?: number; username?: string }) => {
    setComposeToUserId(opts?.userId ?? null);
    setComposeToUsername(opts?.username ?? null);
    setView('cabinet');
    setLobbyScreen('cabinet-messages');
    setPmNotice(null);
  }, []);

  const handleAuthSuccess = useCallback((authUser: User, authToken: string) => {
    setUser(authUser);
    setToken(authToken);
    setView('lobby');
  }, []);

  const handleLogout = useCallback(() => {
    socket?.disconnect();
    clearSession();
    setUser(null);
    setToken(null);
    setSocket(null);
    setRooms([]);
    setRoomState(null);
    setCurrentRoomId(null);
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
      setError(null);
      setView('room');

      const reconnectId = loadStoredPlayerId(user.id);
      socket.emit('room:join', { roomId, playerId: reconnectId ?? undefined }, (res: RoomJoinResponse) => {
        if (res?.error) {
          setError(res.error);
          setView('lobby');
          return;
        }
        if (res.playerId != null) {
          saveStoredPlayerId(user.id, res.playerId);
        }
        setCurrentRoomId(roomId);
        if (res.state) setRoomState(res.state);
      });
    },
    [socket, user]
  );

  const leaveRoom = useCallback(() => {
    socket?.emit('room:detach');
    setCurrentRoomId(null);
    setRoomState(null);
    setView('lobby');
  }, [socket]);

  useEffect(() => {
    if (!socket || !currentRoomId || !user) return;

    const resyncRoom = () => {
      const reconnectId = loadStoredPlayerId(user.id);
      socket.emit('room:join', { roomId: currentRoomId, playerId: reconnectId ?? undefined }, (res: RoomJoinResponse) => {
        if (res?.error) {
          setError(res.error);
          setCurrentRoomId(null);
          setRoomState(null);
          clearStoredPlayerIds();
          setView('lobby');
          return;
        }
        if (res?.playerId != null) {
          saveStoredPlayerId(user.id, res.playerId);
        }
        if (res?.state) setRoomState(res.state);
      });
    };

    socket.on('connect', resyncRoom);
    return () => {
      socket.off('connect', resyncRoom);
    };
  }, [socket, currentRoomId, user]);

  if (authLoading) {
    return (
      <div className="app loading-screen">
        <PageLoader label="Подключаемся…" />
      </div>
    );
  }

  if ((!user || !token) && isPublicInfoPath(window.location.pathname)) {
    return (
      <div className="app app-public-info">
        <ViewSuspense label="Загружаем раздел…">
          <Info
            initialSection={infoSectionFromPath(window.location.pathname)}
            publicMode
          />
        </ViewSuspense>
      </div>
    );
  }

  if (!user || !token) {
    return <Auth onSuccess={handleAuthSuccess} branding={siteBranding} />;
  }

  if (currentRoomId) {
    return (
      <div className="app">
        {notification && (
          <div className="toast" onClick={() => setNotification(null)}>
            🔒 {notification}
          </div>
        )}
        {pmNotice && (
          <div
            className="toast pm-toast"
            onClick={() => {
              leaveRoom();
              openMessages();
            }}
          >
            {pmNotice}
          </div>
        )}
        {error && (
          <div className="toast error" onClick={() => setError(null)}>
            {error}
          </div>
        )}
        <ViewSuspense label="Загружаем комнату…">
          <Room
            socket={socket}
            state={roomState}
            onLeave={leaveRoom}
            onStateUpdate={setRoomState}
            currentUserId={user.id}
            onWriteMessage={(userId, username) => openMessages({ userId, username })}
          />
        </ViewSuspense>
      </div>
    );
  }

  return (
    <div className="app app-shell">
      {pmNotice && (
        <div className="toast pm-toast" onClick={() => { setPmNotice(null); openMessages(); }}>
          {pmNotice}
        </div>
      )}
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

      <div className="app-body">
        {view === 'lobby' && lobbyScreen === 'rooms' && (
          <Lobby
            rooms={rooms}
            siteOnlineCount={siteOnlineCount}
            onJoin={joinRoom}
            unreadMailCount={unreadMailCount}
            onOpenMessages={() => openMessages()}
            onOpenOnlineUsers={() => setLobbyScreen('online-users')}
          />
        )}
        {view === 'lobby' && lobbyScreen === 'online-users' && (
          <ViewSuspense label="Игроки онлайн…">
            <OnlineUsers
              currentUser={user}
              onBack={() => setLobbyScreen('rooms')}
              onWriteMessage={(userId, username) => openMessages({ userId, username })}
            />
          </ViewSuspense>
        )}
        {view === 'news' && (
          <ViewSuspense label="Новости…">
            <News user={user} onBack={() => setView('lobby')} />
          </ViewSuspense>
        )}
        {view === 'cabinet' && lobbyScreen === 'cabinet-settings' && (
          <ViewSuspense label="Профиль…">
            <CabinetProfileSettings
              user={user}
              onUpdate={handleUserUpdate}
              onBack={() => setLobbyScreen('cabinet')}
            />
          </ViewSuspense>
        )}
        {view === 'cabinet' && lobbyScreen === 'cabinet-site-settings' && (
          <ViewSuspense label="Настройки…">
            <CabinetSiteSettings
              user={user}
              onUpdate={handleUserUpdate}
              onBack={() => setLobbyScreen('cabinet')}
            />
          </ViewSuspense>
        )}
        {view === 'cabinet' && lobbyScreen === 'cabinet-messages' && (
          <ViewSuspense label="Сообщения…">
            <Messages
              composeToUserId={composeToUserId}
              composeToUsername={composeToUsername}
              onUnreadChange={setUnreadMailCount}
              onBack={() => {
                setComposeToUserId(null);
                setComposeToUsername(null);
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
            />
          </ViewSuspense>
        )}
        {view === 'cabinet' && lobbyScreen === 'cabinet' && (
          <CabinetHub
            user={user}
            unreadMailCount={unreadMailCount}
            onOpenProfileSettings={() => setLobbyScreen('cabinet-settings')}
            onOpenSiteSettings={() => setLobbyScreen('cabinet-site-settings')}
            onOpenMessages={() => setLobbyScreen('cabinet-messages')}
            onOpenUserSearch={() => setLobbyScreen('cabinet-search')}
            onLogout={handleLogout}
            onBack={() => setView('lobby')}
          />
        )}
        {view === 'info' && (
          <ViewSuspense label="Информация…">
            <Info
              currentUser={user}
              onWriteMessage={(userId, username) => openMessages({ userId, username })}
            />
          </ViewSuspense>
        )}
        {view === 'admin' && user.isAdmin && (
          <ViewSuspense label="Админка…">
            <AdminPanel
              onBack={() => setView('lobby')}
              onDefaultThemeChange={setSiteDefaultTheme}
              onBrandingChange={setSiteBranding}
            />
          </ViewSuspense>
        )}
      </div>

      <SiteFooter text={siteBranding.footerText} />

      <Menu
        user={user}
        branding={siteBranding}
        view={view === 'room' ? 'lobby' : view}
        onNavigate={(v) => {
          if (v === 'lobby') {
            setLobbyScreen('rooms');
            setComposeToUserId(null);
            setComposeToUsername(null);
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
          setView(v);
        }}
        onLogout={handleLogout}
        unreadMailCount={unreadMailCount}
      />
    </div>
  );
}
