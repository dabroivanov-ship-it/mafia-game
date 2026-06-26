import { useEffect, useState, type DragEvent, type ReactNode } from 'react';
import { adminReorderRooms, type AdminRoom } from '../api';
import type { RoomKind } from '../types';

interface AdminRoomOrderListProps {
  rooms: AdminRoom[];
  kind: RoomKind;
  onReordered?: () => void | Promise<void>;
  renderRow: (room: AdminRoom) => ReactNode;
}

export default function AdminRoomOrderList({
  rooms,
  kind,
  onReordered,
  renderRow,
}: AdminRoomOrderListProps) {
  const [items, setItems] = useState(rooms);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setItems(rooms);
  }, [rooms]);

  const moveItem = (from: number, to: number): AdminRoom[] => {
    if (from === to) return items;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    return next;
  };

  const persistOrder = async (next: AdminRoom[]) => {
    setSaving(true);
    try {
      await adminReorderRooms(
        kind,
        next.map((room) => room.id)
      );
      await onReordered?.();
    } finally {
      setSaving(false);
    }
  };

  const handleDrop = async (targetIndex: number) => {
    if (dragIndex == null || dragIndex === targetIndex) {
      setDragIndex(null);
      setOverIndex(null);
      return;
    }
    const next = moveItem(dragIndex, targetIndex);
    setItems(next);
    setDragIndex(null);
    setOverIndex(null);
    await persistOrder(next);
  };

  const handleDragStart = (index: number) => {
    setDragIndex(index);
    setOverIndex(index);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>, index: number) => {
    event.preventDefault();
    if (dragIndex == null || dragIndex === index) return;
    setOverIndex(index);
  };

  return (
    <div className={`admin-room-list admin-room-list-draggable${saving ? ' is-saving' : ''}`}>
      <p className="muted admin-room-order-hint">Перетащите комнаты за ☰, чтобы изменить порядок в лобби.</p>
      {items.map((room, index) => (
        <div
          key={room.id}
          className={`admin-room-row admin-room-row-draggable${
            dragIndex === index ? ' is-dragging' : ''
          }${overIndex === index && dragIndex !== index ? ' is-drop-target' : ''}`}
          onDragOver={(event) => handleDragOver(event, index)}
          onDrop={() => void handleDrop(index)}
        >
          <button
            type="button"
            className="admin-room-drag-handle"
            aria-label="Перетащить комнату"
            draggable={!saving}
            onDragStart={() => handleDragStart(index)}
            onDragEnd={() => {
              setDragIndex(null);
              setOverIndex(null);
            }}
          >
            ☰
          </button>
          {renderRow(room)}
        </div>
      ))}
    </div>
  );
}
