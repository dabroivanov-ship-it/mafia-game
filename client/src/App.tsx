import { useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import Auth from './components/Auth';
import Menu from './components/Menu';
import Lobby from './components/Lobby';
import Info from './components/Info';
import Staff from './components/Staff';
import Profile from './components/Profile';
import AdminPanel from './components/AdminPanel';
import Room from './components/Room';
import { clearSession, fetchMe, fetchUnreadMailCount, saveSession } from './api';
import type { LobbyRoom, RoomState, User } from './types';

const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ??
  (import.meta.env.DEV ? 'http://localhost:3001' : undefined);

type AppView = 'lobby' | 'info' | 'staff' | 'profile' | 'admin' | 'room';

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
  const [playerId, setPlayerId] = useState<number | null>(() => {
    const v = localStorage.getItem('mafia_player_id');
    return v ? Number(v) : null;
  });
  const [currentRoomId, setCurrentRoomId] = useState<number | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [unreadMailCount, setUnreadMailCount] = useState(0);
  const [pmNotice, setPmNotice] = useState<string | null>(null);
  const [profileTab, setProfileTab] = useState<'settings' | 'messages'>('settings');
  const [composeToUserId, setComposeToUserId] = useState<number | null>(null);
  const [composeToUsername, setComposeToUsername] = useState<string | null>(null);

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

    s.on('room:kicked', ({ reason }: { reason?: string }) => {
      setCurrentRoomId(null);
      setRoomState(null);
      setPlayerId(null);
      setView('lobby');
      localStorage.removeItem('mafia_player_id');
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
    setProfileTab('messages');
    setComposeToUserId(opts?.userId ?? null);
    setComposeToUsername(opts?.username ?? null);
    setView('profile');
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
    setPlayerId(null);
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
      if (!socket) return;
      setError(null);
      setView('room');

      socket.emit('room:join', { roomId, playerId }, (res: RoomJoinResponse) => {
        if (res?.error) {
          setError(res.error);
          setView('lobby');
          return;
        }
        if (res.playerId != null) {
          setPlayerId(res.playerId);
          localStorage.setItem('mafia_player_id', String(res.playerId));
        }
        setCurrentRoomId(roomId);
        if (res.state) setRoomState(res.state);
      });
    },
    [socket, playerId]
  );

  const leaveRoom = useCallback(() => {
    setCurrentRoomId(null);
    setRoomState(null);
    localStorage.removeItem('mafia_player_id');
    setPlayerId(null);
    setView('lobby');
  }, []);

  useEffect(() => {
    if (!socket || !currentRoomId) return;

    const resyncRoom = () => {
      socket.emit('room:join', { roomId: currentRoomId, playerId }, (res: RoomJoinResponse) => {
        if (res?.error) {
          setError(res.error);
          setCurrentRoomId(null);
          setRoomState(null);
          setPlayerId(null);
          localStorage.removeItem('mafia_player_id');
          setView('lobby');
          return;
        }
        if (res?.playerId != null) {
          setPlayerId(res.playerId);
          localStorage.setItem('mafia_player_id', String(res.playerId));
        }
        if (res?.state) setRoomState(res.state);
      });
    };

    socket.on('connect', resyncRoom);
    return () => {
      socket.off('connect', resyncRoom);
    };
  }, [socket, currentRoomId, playerId]);

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
            unreadMailCount={unreadMailCount}
            onOpenMessages={() => openMessages()}
          />
        )}
        {view === 'info' && <Info />}
        {view === 'staff' && <Staff />}
        {view === 'profile' && (
          <Profile
            user={user}
            onUpdate={handleUserUpdate}
            onBack={() => {
              setView('lobby');
              setComposeToUserId(null);
              setComposeToUsername(null);
              setProfileTab('settings');
            }}
            initialTab={profileTab}
            composeToUserId={composeToUserId}
            composeToUsername={composeToUsername}
            onUnreadChange={setUnreadMailCount}
          />
        )}
        {view === 'admin' && user.isAdmin && (
          <AdminPanel onBack={() => setView('lobby')} />
        )}
      </div>

      <Menu
        user={user}
        view={view}
        unreadMailCount={unreadMailCount}
        onNavigate={(v) => {
          if (v === 'profile') {
            setProfileTab('settings');
            setComposeToUserId(null);
          }
          setView(v);
        }}
        onLogout={handleLogout}
      />
    </div>
  );
}
