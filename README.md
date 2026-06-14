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

---

## Деплой на сервер через Caddy

Caddy отдаёт сайт, сам получает HTTPS и проксирует WebSocket на Node.js.

### 1. На сервере (Ubuntu/Debian)

```bash
# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Caddy
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install caddy

# PM2
sudo npm install -g pm2
```

### 2. Загрузите проект

```bash
cd /home/user
git clone https://github.com/dabroivanov-ship-it/mafia-game.git
cd mafia-game
```

### 3. Сборка

```bash
cd client && npm install && npm run build
cd ../server && npm install
```

Клиент в продакшене подключается к тому же домену автоматически (без `VITE_SOCKET_URL`).

### 4. Запуск бэкенда (PM2)

```bash
cd /home/user/mafia-game
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

### 5. Настройка Caddy

Отредактируйте `Caddyfile` в корне проекта:
- замените `mafia.example.com` на ваш домен
- замените `/home/user/mafia-game` на реальный путь

```bash
sudo cp Caddyfile /etc/caddy/Caddyfile
# или добавьте import в /etc/caddy/Caddyfile:
# import /home/user/mafia-game/Caddyfile

sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

DNS: A-запись домена → IP сервера. Caddy сам выпустит SSL.

### 6. Проверка

```bash
pm2 status
curl http://127.0.0.1:3001/api/health
curl -I https://mafia.example.com
```

Откройте `https://ваш-домен` в браузере.

### Схема

```
Браузер → Caddy (:443)
            ├─ /           → client/dist (React)
            ├─ /socket.io  → Node.js :3001 (WebSocket)
            └─ /api        → Node.js :3001
```

Порт **3001** наружу открывать не нужно — только 80/443 для Caddy.
