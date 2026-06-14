import { useEffect, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import Lobby from './components/Lobby.jsx';
import Room from './components/Room.jsx';

const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ??
  (import.meta.env.DEV ? 'http://localhost:3001' : undefined);

export default function App() {
  const [socket, setSocket] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [roomState, setRoomState] = useState(null);
  const [playerName, setPlayerName] = useState(() => localStorage.getItem('mafia_player_name') || '');
  const [playerId, setPlayerId] = useState(() => {
    const v = localStorage.getItem('mafia_player_id');
    return v ? Number(v) : null;
  });
  const [currentRoomId, setCurrentRoomId] = useState(null);
  const [notification, setNotification] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const s = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
    setSocket(s);

    s.on('lobby:update', setRooms);
    s.on('room:state', setRoomState);
    s.on('notification:private', ({ message }) => {
      setNotification(message);
      setTimeout(() => setNotification(null), 8000);
    });

    return () => s.disconnect();
  }, []);

  const saveName = useCallback((name) => {
    setPlayerName(name);
    localStorage.setItem('mafia_player_name', name);
  }, []);

  const joinRoom = useCallback(
    (roomId, name) => {
      if (!socket) return;
      saveName(name);
      setError(null);

      socket.emit(
        'room:join',
        { roomId, playerName: name, playerId },
        (res) => {
          if (res?.error) {
            setError(res.error);
            return;
          }
          setPlayerId(res.playerId);
          localStorage.setItem('mafia_player_id', String(res.playerId));
          setCurrentRoomId(roomId);
          setRoomState(res.state);
        }
      );
    },
    [socket, playerId, saveName]
  );

  const leaveRoom = useCallback(() => {
    setCurrentRoomId(null);
    setRoomState(null);
    localStorage.removeItem('mafia_player_id');
    setPlayerId(null);
  }, []);

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
        <Lobby rooms={rooms} onJoin={joinRoom} defaultName={playerName} />
      ) : (
        <Room
          socket={socket}
          state={roomState}
          onLeave={leaveRoom}
        />
      )}
    </div>
  );
}
