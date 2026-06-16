# Мафия — онлайн

Многопользовательская игра «Мафия» с регистрацией, профилями, комнатами, чатом и WebSocket в реальном времени.

## Стек

| Часть | Технологии |
|-------|------------|
| Сервер | Node.js, Express, Socket.IO, SQLite, **TypeScript** |
| Клиент | React, Vite, **TypeScript** |
| Продакшен | PM2 + Caddy (HTTPS) |

---

## Требования

- **Node.js 20+** (18 тоже подойдёт)
- **npm**
- **Git**

На Linux для `better-sqlite3` могут понадобиться: `build-essential`, `python3`.

---

## Быстрые команды

| Задача | Команда |
|--------|---------|
| Локальная разработка (сервер) | `cd server && npm install && npm run dev` |
| Локальная разработка (клиент) | `cd client && npm install && npm run dev` |
| Сборка всего | `cd client && npm run build` → `cd ../server && npm run build` |
| Обновление на VPS | см. [раздел 4](#4-обновление-на-сервере) |

---

## 1. Локальная установка

### 1.1. Клонировать репозиторий

```bash
git clone https://github.com/dabroivanov-ship-it/mafia-game.git
cd mafia-game
```

### 1.2. Установить зависимости

```bash
cd server && npm install
cd ../client && npm install
```

### 1.3. Запуск для разработки

Нужны **два терминала**.

**Терминал 1 — сервер** (TypeScript через `tsx`, перезапуск при изменениях):

```bash
cd server
npm run dev
```

→ API и WebSocket: http://localhost:3001

**Терминал 2 — клиент** (Vite с hot reload):

```bash
cd client
npm run dev
```

→ Интерфейс: http://localhost:5173

Клиент в dev-режиме проксирует `/socket.io` на порт 3001 (см. `client/vite.config.ts`).

### 1.4. Локальный запуск «как на проде»

```bash
# Клиент → client/dist
cd client
npm run build

# Сервер → server/dist
cd ../server
npm run build
npm start
```

Откройте http://localhost:3001 — сервер отдаёт и API, и собранный React.

### 1.5. Первый вход

1. Откройте http://localhost:5173 (dev) или http://localhost:3001 (prod-режим)
2. Зарегистрируйтесь (логин, email, пароль)
3. Зайдите в комнату → **«Запустить игру»** → другие игроки нажимают **«Присоединиться»**
4. Минимум **3 игрока** в регистрации (удобно проверить в нескольких вкладках с разными аккаунтами)

База данных создаётся автоматически: `server/data/mafia.db`  
Аватары: `server/uploads/avatars/`

---

## 2. Установка на VPS (продакшен)

Пример: Ubuntu VPS, домен **24vpsbro.ru**, каталог **`/home/mafia-game`**.

### 2.1. DNS

| Тип | Имя | Значение |
|-----|-----|----------|
| A | `@` | IP VPS |
| A | `www` | IP VPS |

### 2.2. Подключение

```bash
ssh root@IP_ВАШЕГО_VPS
```

### 2.3. Установка ПО

```bash
apt update && apt upgrade -y
apt install -y git build-essential python3

# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Caddy (HTTPS)
apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt update && apt install -y caddy

# PM2
npm install -g pm2
```

### 2.4. Скачать и собрать проект

```bash
cd /home
git clone https://github.com/dabroivanov-ship-it/mafia-game.git
cd mafia-game

# Зависимости и сборка клиента (TypeScript + Vite → client/dist)
cd client
npm install
npm run build

# Зависимости и сборка сервера (TypeScript → server/dist)
cd ../server
npm install
npm run build
```

Проверка:

```bash
test -f /home/mafia-game/client/dist/index.html && echo "client OK"
test -f /home/mafia-game/server/dist/server.js && echo "server OK"
```

### 2.5. Переменные окружения (PM2)

```bash
nano /home/mafia-game/ecosystem.config.cjs
```

Обязательно задайте **`JWT_SECRET`** (длинная случайная строка). Пример:

```js
env: {
  NODE_ENV: 'production',
  PORT: 3001,
  JWT_SECRET: 'ваш-длинный-случайный-ключ-минимум-32-символа',
  ADMIN_USERNAMES: 'admin',  // логины админов через запятую
},
```

PM2 запускает **`server/dist/server.js`** (скомпилированный TypeScript).

### 2.6. Запуск бэкенда

```bash
cd /home/mafia-game
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup   # выполните команду, которую выведет pm2
```

Проверка:

```bash
pm2 status
curl http://127.0.0.1:3001/api/health
curl -sI http://127.0.0.1:3001/ | head -3
```

### 2.7. Caddy

```bash
cd /home/mafia-game
cp Caddyfile /etc/caddy/Caddyfile
# замените 24vpsbro.ru на свой домен, если нужно
caddy validate --config /etc/caddy/Caddyfile
systemctl reload caddy
systemctl enable caddy
```

### 2.8. Firewall

```bash
ufw allow OpenSSH
ufw allow 80
ufw allow 443
ufw enable
```

Порт **3001** наружу не открывайте — к нему ходит только Caddy локально.

### 2.9. Проверка

```bash
curl -sI https://24vpsbro.ru/ | head -3
pm2 logs mafia-server --lines 20
```

Откройте **https://24vpsbro.ru** → регистрация → комнаты.

---

## 3. Схема работы

```
Браузер
   ↓ HTTPS :443
 Caddy
   ↓ reverse_proxy 127.0.0.1:3001
 Node.js (server/dist/server.js)
   ├─ /api/auth/*      → регистрация, вход
   ├─ /api/profile/*   → профиль, настройки
   ├─ /api/admin/*     → админ-панель
   ├─ /api/health      → статус
   ├─ /socket.io/*     → игра (WebSocket)
   ├─ /uploads/*       → аватары
   └─ /*               → React (client/dist)
```

---

## 4. Обновление на сервере

Одной цепочкой:

```bash
cd /home/mafia-game && git pull && \
cd client && npm install && npm run build && \
cd ../server && npm install && npm run build && \
cd .. && pm2 restart mafia-server
```

Проверка после обновления:

```bash
pm2 logs mafia-server --lines 15
curl -s http://127.0.0.1:3001/api/health
```

---

## 5. npm-скрипты

### Сервер (`server/`)

| Скрипт | Описание |
|--------|----------|
| `npm run dev` | Разработка: `tsx watch server.ts` |
| `npm run build` | Компиляция TypeScript → `dist/` |
| `npm start` | Запуск: `node dist/server.js` |

### Клиент (`client/`)

| Скрипт | Описание |
|--------|----------|
| `npm run dev` | Vite dev-сервер :5173 |
| `npm run build` | `tsc` + сборка в `dist/` |
| `npm run preview` | Просмотр production-сборки |

---

## 6. Настройки игры

Файл **`server/game/config.ts`** (после правок на сервере: `npm run build` в `server/` и `pm2 restart`):

| Параметр | По умолчанию | Описание |
|----------|--------------|----------|
| MIN_PLAYERS | 3 | Минимум игроков для старта |
| MAX_PLAYERS | 10 | Абсолютный максимум |
| DEFAULT_MAX_PLAYERS | 6 | Мест в комнате |
| REGISTRATION_SEC | 60 | Время регистрации (сек) |
| JOIN_GAME_COOLDOWN_SEC | 15 | Пауза перед повторным «Присоединиться» |
| DAY_DISCUSSION_SEC | 60 | Дневное обсуждение |
| NIGHT_ACTIONS_SEC | 60 | Ночные действия |
| ROOM_COUNT | 3 | Число комнат в лобби |

---

## 7. Переменные окружения

| Переменная | Описание |
|------------|----------|
| `PORT` | Порт сервера (по умолчанию 3001) |
| `JWT_SECRET` | Секрет JWT (**обязателен на проде**) |
| `JWT_EXPIRES` | Срок токена (по умолчанию 7d) |
| `DB_PATH` | Путь к SQLite (по умолчанию `server/data/mafia.db`) |
| `UPLOADS_DIR` | Папка аватаров |
| `ADMIN_USERNAMES` | Логины админов через запятую |

---

## 8. API (основное)

| Метод | URL | Описание |
|-------|-----|----------|
| POST | `/api/auth/register` | Регистрация |
| POST | `/api/auth/login` | Вход |
| GET | `/api/auth/me` | Текущий пользователь (Bearer token) |
| PUT | `/api/profile` | Обновление профиля (в т.ч. лимит сообщений в чате) |
| GET | `/api/health` | Статус сервера и комнат |

---

## 9. Частые проблемы

| Проблема | Решение |
|----------|---------|
| Сайт **502 Bad Gateway** | Caddy работает, Node — нет: `pm2 logs mafia-server --lines 50`, затем `bash scripts/deploy.sh` или ручная пересборка (см. ниже) |
| Сайт 404 / «Клиент не собран» | `cd client && npm run build`, затем `pm2 restart mafia-server` |
| Сервер не стартует после pull | `cd server && npm install && npm run build` |
| «Загрузка комнат...» | `pm2 status` — процесс `mafia-server` должен быть online |
| `git pull` конфликт | `git stash && git pull`, затем пересборка и `pm2 restart mafia-server` |
| Нет HTTPS | DNS → IP сервера; порты 80/443 открыты |
| Ошибка `better-sqlite3` | `apt install -y build-essential python3`, затем `npm install` в `server/` |
| TypeScript-ошибки при сборке | Исправить код, затем `npm run build` в `client/` и `server/` |

---

## 10. Структура проекта

```
mafia-game/
├── server/
│   ├── server.ts          # Исходник: Express + Socket.IO
│   ├── dist/              # Сборка tsc (в .gitignore)
│   ├── tsconfig.json
│   ├── types/             # Типы сервера
│   ├── auth/              # JWT, SQLite, пользователи
│   ├── game/              # Логика мафии (engine.ts, config.ts)
│   ├── history/           # Лог чата и событий
│   ├── profile/           # API профиля
│   ├── admin/             # Админ-панель API
│   └── data/mafia.db      # БД (создаётся автоматически)
├── client/
│   ├── src/
│   │   ├── types/         # Типы клиента
│   │   ├── components/    # React (.tsx)
│   │   ├── App.tsx
│   │   └── api.ts
│   ├── dist/              # Сборка Vite (в .gitignore)
│   └── vite.config.ts
├── Caddyfile
├── ecosystem.config.cjs   # PM2 → server/dist/server.js
└── README.md
```
