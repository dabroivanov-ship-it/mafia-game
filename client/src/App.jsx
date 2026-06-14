import { useEffect, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import Auth from './components/Auth.jsx';
import Menu from './components/Menu.jsx';
import Lobby from './components/Lobby.jsx';
import Profile from './components/Profile.jsx';
import AdminPanel from './components/AdminPanel.jsx';
import Room from './components/Room.jsx';
import { clearSession, fetchMe, saveSession } from './api.js';

const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ??
  (import.meta.env.DEV ? 'http://localhost:3001' : undefined);

export default function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('mafia_token'));
  const [authLoading, setAuthLoading] = useState(true);
  const [view, setView] = useState('lobby');

  const [socket, setSocket] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [roomState, setRoomState] = useState(null);
  const [playerId, setPlayerId] = useState(() => {
    const v = localStorage.getItem('mafia_player_id');
    return v ? Number(v) : null;
  });
  const [currentRoomId, setCurrentRoomId] = useState(null);
  const [notification, setNotification] = useState(null);
  const [error, setError] = useState(null);

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

    s.on('connect_error', (err) => {
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
    s.on('notification:private', ({ message }) => {
      setNotification(message);
      setTimeout(() => setNotification(null), 8000);
    });

    s.on('room:kicked', ({ reason }) => {
      setCurrentRoomId(null);
      setRoomState(null);
      setPlayerId(null);
      setView('lobby');
      localStorage.removeItem('mafia_player_id');
      setError(reason || 'Вы вышли из комнаты');
    });

    setSocket(s);
    return () => s.disconnect();
  }, [token, user]);

  const handleAuthSuccess = useCallback((authUser, authToken) => {
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

  const handleUserUpdate = useCallback((updated) => {
    setUser(updated);
    saveSession(token, updated);
  }, [token]);

  const joinRoom = useCallback(
    (roomId) => {
      if (!socket) return;
      setError(null);
      setView('room');

      socket.emit('room:join', { roomId, playerId }, (res) => {
        if (res?.error) {
          setError(res.error);
          setView('lobby');
          return;
        }
        setPlayerId(res.playerId);
        localStorage.setItem('mafia_player_id', String(res.playerId));
        setCurrentRoomId(roomId);
        setRoomState(res.state);
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
        {error && (
          <div className="toast error" onClick={() => setError(null)}>
            {error}
          </div>
        )}
        <Room socket={socket} state={roomState} user={user} onLeave={leaveRoom} />
      </div>
    );
  }

  return (
    <div className="app">
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

      <Menu
        user={user}
        view={view}
        onNavigate={setView}
        onLogout={handleLogout}
      />

      {view === 'lobby' && (
        <Lobby rooms={rooms} user={user} onJoin={joinRoom} />
      )}
      {view === 'profile' && (
        <Profile user={user} onUpdate={handleUserUpdate} onBack={() => setView('lobby')} />
      )}
      {view === 'admin' && user.isAdmin && (
        <AdminPanel onBack={() => setView('lobby')} />
      )}
    </div>
  );
}
