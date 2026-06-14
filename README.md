# Мафия — онлайн

Многопользовательская игра «Мафия» с регистрацией, комнатами, чатом и WebSocket в реальном времени.

## Стек

| Часть | Технологии |
|-------|------------|
| Сервер | Node.js, Express, Socket.IO, SQLite |
| Клиент | React, Vite |
| Продакшен | PM2 + Caddy (HTTPS) |

---

## Требования

- **Node.js 18+** (рекомендуется 20)
- **npm**
- **Git** (для клонирования)

---

## 1. Локальная установка (Windows / Mac / Linux)

### Скачать проект

```bash
git clone https://github.com/dabroivanov-ship-it/mafia-game.git
cd mafia-game
```

### Установить зависимости

```bash
cd server
npm install

cd ../client
npm install
```

### Запуск (два терминала)

**Терминал 1 — сервер:**
```bash
cd server
npm run server
```
→ http://localhost:3001

**Терминал 2 — клиент:**
```bash
cd client
npm run dev
```
→ http://localhost:5173

### Первый вход

1. Откройте http://localhost:5173
2. **Зарегистрируйтесь** (логин, email, пароль)
3. Войдите в комнату → «Запустить игру»
4. Нужно **минимум 4 игрока** (откройте несколько вкладок с разными аккаунтами)

База данных создаётся автоматически: `server/data/mafia.db`

---

## 2. Установка на VPS (продакшен)

Пример: Ubuntu VPS + домен **24vpsbro.ru**

### 2.1. DNS

| Тип | Имя | Значение |
|-----|-----|----------|
| A | `@` | IP вашего VPS |
| A | `www` | IP вашего VPS |

### 2.2. Подключение к серверу

```bash
ssh root@IP_ВАШЕГО_VPS
```

### 2.3. Установка ПО

```bash
apt update && apt upgrade -y

# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs git

# Caddy (веб-сервер + HTTPS)
apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt update && apt install -y caddy

# PM2 (автозапуск Node.js)
npm install -g pm2
```

### 2.4. Скачать и собрать проект

```bash
cd /home
git clone https://github.com/dabroivanov-ship-it/mafia-game.git
cd mafia-game

# Клиент
cd client
npm install
npm run build

# Сервер
cd ../server
npm install
```

Проверка сборки:
```bash
ls client/dist/index.html   # файл должен существовать
```

### 2.5. Секрет JWT (обязательно на продакшене)

```bash
nano /home/mafia-game/ecosystem.config.cjs
```

Добавьте в `env`:
```js
JWT_SECRET: 'ваш-длинный-случайный-ключ-минимум-32-символа',
```

### 2.6. Запуск бэкенда

```bash
cd /home/mafia-game
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup    # выполните команду, которую выведет pm2
```

Проверка:
```bash
pm2 status
curl http://127.0.0.1:3001/api/health
curl -sI http://127.0.0.1:3001/ | head -3   # должно быть HTTP/1.1 200
```

### 2.7. Настройка Caddy

```bash
cd /home/mafia-game
git pull   # если конфликт с Caddyfile: git stash && git pull

cp Caddyfile /etc/caddy/Caddyfile
caddy validate --config /etc/caddy/Caddyfile
systemctl reload caddy
systemctl enable caddy
```

В `Caddyfile` замените `24vpsbro.ru` на ваш домен, если другой.

### 2.8. Firewall

```bash
ufw allow OpenSSH
ufw allow 80
ufw allow 443
ufw enable
```

Порт **3001** наружу не открывайте.

### 2.9. Проверка

```bash
curl -sI https://24vpsbro.ru/ | head -3
pm2 logs mafia-server --lines 10
```

Откройте **https://24vpsbro.ru** → регистрация → комнаты.

---

## 3. Схема работы

```
Браузер
   ↓ HTTPS :443
 Caddy
   ↓ reverse_proxy
 Node.js :3001
   ├─ /api/auth/*     → регистрация, вход
   ├─ /api/health     → статус
   ├─ /socket.io/*    → игра (WebSocket)
   └─ /*              → React (client/dist)
```

---

## 4. Обновление на сервере

```bash
cd /home/mafia-game
git pull

cd client && npm install && npm run build
cd ../server && npm install

cd /home/mafia-game
pm2 restart mafia-server
```

---

## 5. Настройки игры

Файл `server/game/config.js`:

| Параметр | По умолчанию | Описание |
|----------|--------------|----------|
| MIN_PLAYERS | 4 | Минимум для старта |
| MAX_PLAYERS | 10 | Абсолютный максимум |
| DEFAULT_MAX_PLAYERS | 6 | Максимум в комнате |
| REGISTRATION_SEC | 30 | Регистрация перед игрой |
| DAY_DISCUSSION_SEC | 60 | Дневное обсуждение |
| NIGHT_ACTIONS_SEC | 60 | Ночные действия |

---

## 6. Переменные окружения

| Переменная | Описание |
|------------|----------|
| `PORT` | Порт сервера (по умолчанию 3001) |
| `JWT_SECRET` | Секрет для токенов (**обязателен на проде**) |
| `JWT_EXPIRES` | Срок токена (по умолчанию 7d) |
| `DB_PATH` | Путь к SQLite (по умолчанию server/data/mafia.db) |

---

## 7. API авторизации

| Метод | URL | Описание |
|-------|-----|----------|
| POST | `/api/auth/register` | Регистрация |
| POST | `/api/auth/login` | Вход |
| GET | `/api/auth/me` | Текущий пользователь (Bearer token) |

---

## 8. Частые проблемы

| Проблема | Решение |
|----------|---------|
| Сайт 404 | `cd client && npm run build`, затем `pm2 restart mafia-server` |
| «Загрузка комнат...» | `pm2 status` — сервер должен быть online |
| `git pull` конфликт | `git stash && git pull && pm2 restart mafia-server` |
| Нет HTTPS | DNS → IP сервера; порты 80/443 открыты |
| `better-sqlite3` ошибка | `apt install -y build-essential python3`, затем `npm install` в server/ |

---

## 9. Структура проекта

```
mafia-game/
├── server/
│   ├── server.js          # Express + Socket.IO
│   ├── auth/              # Регистрация, JWT, SQLite
│   ├── game/              # Логика мафии
│   └── data/mafia.db      # База (создаётся автоматически)
├── client/
│   └── src/
│       ├── components/
│       │   ├── Auth.jsx   # Вход / регистрация
│       │   ├── Lobby.jsx
│       │   └── Room.jsx
│       └── App.jsx
├── Caddyfile              # Конфиг веб-сервера
├── ecosystem.config.cjs   # Конфиг PM2
└── README.md
```
