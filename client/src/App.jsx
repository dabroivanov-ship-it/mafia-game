import { useEffect, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import Auth from './components/Auth.jsx';
import Lobby from './components/Lobby.jsx';
import Room from './components/Room.jsx';
import { clearSession, fetchMe, saveSession } from './api.js';

const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ??
  (import.meta.env.DEV ? 'http://localhost:3001' : undefined);

export default function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('mafia_token'));
  const [authLoading, setAuthLoading] = useState(true);

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

  // Проверка сессии при загрузке
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

  // Socket только после авторизации
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
      if (err.message.includes('авториза') || err.message.includes('токен')) {
        clearSession();
        setUser(null);
        setToken(null);
        setError('Сессия истекла. Войдите снова.');
      }
    });

    s.on('lobby:update', setRooms);
    s.on('room:state', setRoomState);
    s.on('notification:private', ({ message }) => {
      setNotification(message);
      setTimeout(() => setNotification(null), 8000);
    });

    setSocket(s);
    return () => s.disconnect();
  }, [token, user]);

  const handleAuthSuccess = useCallback((authUser, authToken) => {
    setUser(authUser);
    setToken(authToken);
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
  }, [socket]);

  const joinRoom = useCallback(
    (roomId) => {
      if (!socket) return;
      setError(null);

      socket.emit('room:join', { roomId, playerId }, (res) => {
        if (res?.error) {
          setError(res.error);
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

      {!currentRoomId ? (
        <Lobby
          rooms={rooms}
          user={user}
          onJoin={joinRoom}
          onLogout={handleLogout}
        />
      ) : (
        <Room
          socket={socket}
          state={roomState}
          user={user}
          onLeave={leaveRoom}
        />
      )}
    </div>
  );
}
