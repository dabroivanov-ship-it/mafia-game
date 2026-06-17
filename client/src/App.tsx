import { useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import Auth from './components/Auth';
import Menu, { type MenuView } from './components/Menu';
import Lobby, { type LobbyScreen } from './components/Lobby';
import News from './components/News';
import CabinetHub from './components/CabinetHub';
import CabinetProfileSettings from './components/CabinetProfileSettings';
import CabinetSiteSettings from './components/CabinetSiteSettings';
import Messages from './components/Messages';
import Info from './components/Info';
import AdminPanel from './components/AdminPanel';
import Room from './components/Room';
import { clearSession, fetchMe, fetchUnreadMailCount, fetchThemeSettings, saveSession, loadStoredPlayerId, saveStoredPlayerId, clearStoredPlayerIds } from './api';
import type { LobbyRoom, RoomState, User, ThemeId } from './types';
import { applyTheme, resolveTheme, DEFAULT_THEME } from './themes';

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

  useEffect(() => {
    fetchThemeSettings()
      .then(({ defaultTheme }) => setSiteDefaultTheme(defaultTheme))
      .catch(() => {});
  }, []);

  useEffect(() => {
    applyTheme(resolveTheme(user?.theme ?? null, siteDefaultTheme));
  }, [user?.theme, siteDefaultTheme]);

  useEffect(() => {
    async function checkAuth() {
      if (!token) {
        setAuthLoading(false);
        return;
      }
      try {
        const { user: me } = await fetchMe();
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
    checkAuth();
  }, [token]);

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

    s.on('lobby:update', setRooms);
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
        <p>Загрузка...</p>
      </div>
    );
  }

  if (!user || !token) {
    return <Auth onSuccess={handleAuthSuccess} />;
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
        <Room
          socket={socket}
          state={roomState}
          onLeave={leaveRoom}
          onStateUpdate={setRoomState}
          currentUserId={user.id}
        />
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
        {view === 'lobby' && (
          <Lobby
            rooms={rooms}
            onJoin={joinRoom}
            onOpenNews={() => setView('news')}
            onOpenInfo={() => setView('info')}
            onOpenCabinet={() => {
              setLobbyScreen('cabinet');
              setView('cabinet');
            }}
            onLogout={handleLogout}
            unreadMailCount={unreadMailCount}
            onOpenMessages={() => openMessages()}
          />
        )}
        {view === 'news' && <News onBack={() => setView('lobby')} />}
        {view === 'cabinet' && lobbyScreen === 'cabinet-settings' && (
          <CabinetProfileSettings
            user={user}
            onUpdate={handleUserUpdate}
            onBack={() => setLobbyScreen('cabinet')}
          />
        )}
        {view === 'cabinet' && lobbyScreen === 'cabinet-site-settings' && (
          <CabinetSiteSettings
            user={user}
            onUpdate={handleUserUpdate}
            onBack={() => setLobbyScreen('cabinet')}
          />
        )}
        {view === 'cabinet' && lobbyScreen === 'cabinet-messages' && (
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
        )}
        {view === 'cabinet' && lobbyScreen === 'cabinet' && (
          <CabinetHub
            user={user}
            unreadMailCount={unreadMailCount}
            onOpenProfileSettings={() => setLobbyScreen('cabinet-settings')}
            onOpenSiteSettings={() => setLobbyScreen('cabinet-site-settings')}
            onOpenMessages={() => setLobbyScreen('cabinet-messages')}
            onBack={() => setView('lobby')}
          />
        )}
        {view === 'info' && <Info />}
        {view === 'admin' && user.isAdmin && (
          <AdminPanel
            onBack={() => setView('lobby')}
            onDefaultThemeChange={setSiteDefaultTheme}
          />
        )}
      </div>

      <Menu
        user={user}
        view={view === 'room' ? 'lobby' : view}
        onNavigate={(v) => {
          if (v === 'lobby') {
            setLobbyScreen('rooms');
            setComposeToUserId(null);
            setComposeToUsername(null);
          }
          if (v === 'cabinet') {
            setLobbyScreen('cabinet');
            setComposeToUserId(null);
            setComposeToUsername(null);
          }
          setView(v);
        }}
        onLogout={handleLogout}
        unreadMailCount={unreadMailCount}
      />
    </div>
  );
}
