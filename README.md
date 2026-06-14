# Мафия — онлайн

Многопользовательская игра «Мафия» с автоматическим ведущим-ботом, комнатами, чатом и WebSocket-обновлениями в реальном времени.

## Стек

- **Сервер:** Node.js, Express, Socket.IO
- **Клиент:** React, Vite, Socket.IO-client

## Быстрый старт

### 1. Установка

```bash
cd server && npm install
cd ../client && npm install
```

### 2. Запуск

**Терминал 1:**
```bash
cd server
npm run server
```

**Терминал 2:**
```bash
cd client
npm run dev
```

Откройте http://localhost:5173

## Игра

1. Введите имя (сохраняется в localStorage)
2. Войдите в комнату
3. Нажмите «Запустить игру» — регистрация 30 сек
4. Минимум 4 игрока для старта

## Настройки (server/game/config.js)

- MIN_PLAYERS: 4, MAX_PLAYERS: 10, DEFAULT_MAX_PLAYERS: 6
- REGISTRATION_SEC: 30, DAY_DISCUSSION_SEC: 60, NIGHT_ACTIONS_SEC: 60
