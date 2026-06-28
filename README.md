# Мафия — онлайн

Бесплатная многопользовательская игра «Мафия» с регистрацией, комнатами, чатом, рейтингом и WebSocket в реальном времени.

**Стек:** Node.js + Express + Socket.IO + SQLite (сервер), React + Vite (клиент). Продакшен: PM2 + Caddy (HTTPS).

---

## Возможности

### Игра
- Комнаты на 3–10 игроков, регистрация в партию, фазы дня и ночи
- Роли: мафия, дон, комиссар (Катани), доктор, маньяк, адвокат и др. — состав зависит от числа игроков
- Чат в комнате, голосование днём, ночные действия ролей
- MMR и статистика после партий, репутация игроков

### Сайт
- **Комнаты** — игровые и чат-комнаты (в чат-комнатах работает викторина)
- **Новости** — объявления администрации, голосования, комментарии с ответами, бейдж непрочитанного
- **Кабинет** — профиль, личные сообщения, поддержка, поиск игроков, тема оформления
- **Информация** — правила, роли, FAQ, рейтинг (по 15 игроков на странице), топ викторины, команда проекта
- **Админ-панель** — пользователи, комнаты, новости с опросами, модерация, настройки сайта

---

## Требования

- Node.js **20+** (18 тоже подойдёт)
- npm
- Git

На Linux для `better-sqlite3` могут понадобиться: `build-essential`, `python3`.

---

## Быстрые команды

| Задача | Команда |
|--------|---------|
| Dev: сервер | `cd server && npm install && npm run dev` |
| Dev: клиент | `cd client && npm install && npm run dev` |
| Сборка клиента | `cd client && npm run build` |
| Сборка сервера | `cd server && npm run build` |
| Запуск prod локально | `cd server && npm start` (после сборки обоих) |
| Обновление на VPS | `bash scripts/deploy.sh` или [раздел ниже](#обновление-на-сервере) |

---

## Локальная разработка

### 1. Клонировать и установить зависимости

```bash
git clone https://github.com/dabroivanov-ship-it/mafia-game.git
cd mafia-game

cd server && npm install
cd ../client && npm install
```

### 2. Запуск (два терминала)

**Сервер** — TypeScript через `tsx`, перезапуск при изменениях:

```bash
cd server
npm run dev
```

→ API и WebSocket: http://localhost:3001

**Клиент** — Vite с hot reload:

```bash
cd client
npm run dev
```

→ Интерфейс: http://localhost:5173

Клиент в dev-режиме проксирует `/socket.io` и `/api` на порт 3001 (см. `client/vite.config.ts`).

### 3. Локальный запуск «как на проде»

```bash
cd client && npm run build
cd ../server && npm run build && npm start
```

Откройте http://localhost:3001 — сервер отдаёт и API, и собранный React из `client/dist`.

### 4. Первый вход

1. Откройте http://localhost:5173 (dev) или http://localhost:3001 (prod-режим)
2. Зарегистрируйтесь
3. Зайдите в комнату → **«Запустить игру»** → другие игроки нажимают **«Присоединиться»**
4. Минимум **3 игрока** (удобно проверить в нескольких вкладках)

**Данные:**
- База SQLite: `server/data/mafia.db` (создаётся автоматически)
- Аватары: `server/uploads/avatars/`
- Изображения новостей: `server/uploads/news/`

Схема БД и новые таблицы (голосования, прочитанные новости и т.д.) применяются **автоматически** при старте сервера — отдельная миграция не нужна.

---

## Установка на VPS (продакшен)

Пример: Ubuntu VPS, домен **24vpsbro.ru**, каталог **`/home/mafia-game`**.

### DNS

| Тип | Имя | Значение |
|-----|-----|----------|
| A | `@` | IP VPS |
| A | `www` | IP VPS |

### ПО на сервере

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

npm install -g pm2
```

### Клонирование и сборка

```bash
cd /home
git clone https://github.com/dabroivanov-ship-it/mafia-game.git
cd mafia-game

cd client && npm install && npm run build
cd ../server && npm install && npm run build
```

Проверка:

```bash
test -f client/dist/index.html && echo "client OK"
test -f server/dist/server.js && echo "server OK"
```

### Переменные окружения

```bash
cp server/.env.example server/.env
nano server/.env
```

Обязательно на проде:

| Переменная | Описание |
|------------|----------|
| `JWT_SECRET` | Случайная строка **минимум 32 символа** (`openssl rand -hex 32`) |
| `CORS_ORIGIN` | Публичный URL сайта без слэша в конце, напр. `https://24vpsbro.ru` |

Остальное — см. [переменные окружения](#переменные-окружения).

PM2 читает `server/.env` через `ecosystem.config.cjs`.

### Запуск

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
```

### Caddy

```bash
cp Caddyfile /etc/caddy/Caddyfile
# замените домен в Caddyfile на свой
caddy validate --config /etc/caddy/Caddyfile
systemctl reload caddy
systemctl enable caddy
```

### Firewall

```bash
ufw allow OpenSSH
ufw allow 80
ufw allow 443
ufw enable
```

Порт **3001** наружу не открывайте — к нему ходит только Caddy локально.

---

## Обновление на сервере

**Рекомендуемый способ** — скрипт деплоя (pull, сборка, проверка БД, restart PM2):

```bash
cd /home/mafia-game
bash scripts/deploy.sh
```

**Вручную:**

```bash
cd /home/mafia-game && git pull && \
cd client && npm install && npm run build && \
cd ../server && npm install && npm run build && \
cd .. && pm2 restart mafia-server
```

После обновления:

```bash
pm2 logs mafia-server --lines 20
curl -s http://127.0.0.1:3001/api/health
```

В браузере — жёсткое обновление (Ctrl+F5), чтобы подтянуть новый клиент.

Файл **`server/data/mafia.db`** не удаляйте.

---

## Схема работы

```
Браузер
   ↓ HTTPS :443
 Caddy
   ↓ reverse_proxy 127.0.0.1:3001
 Node.js (server/dist/server.js)
   ├─ /api/auth/*        → регистрация, вход, Telegram OIDC
   ├─ /api/profile/*     → профиль, рейтинг, поиск
   ├─ /api/news/*        → новости, комментарии, голосования
   ├─ /api/messages/*    → личные сообщения
   ├─ /api/admin/*       → админ-панель
   ├─ /api/health        → статус
   ├─ /socket.io/*       → игра и чат (WebSocket)
   ├─ /uploads/*         → аватары, новости, брендинг
   └─ /*                 → React (client/dist)
```

---

## npm-скрипты

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

## Настройки игры

Файл **`server/game/config.ts`**. После правок на сервере: `npm run build` в `server/` и `pm2 restart mafia-server`.

| Параметр | По умолчанию | Описание |
|----------|--------------|----------|
| `MIN_PLAYERS` | 3 | Минимум игроков для старта |
| `MAX_PLAYERS` | 10 | Абсолютный максимум |
| `DEFAULT_MAX_PLAYERS` | 10 | Мест в комнате |
| `REGISTRATION_SEC` | 60 | Время регистрации (сек) |
| `JOIN_GAME_COOLDOWN_SEC` | 15 | Пауза перед повторным «Присоединиться» |
| `DAY_DISCUSSION_SEC` | 60 | Дневное обсуждение |
| `NIGHT_ACTIONS_SEC` | 60 | Ночные действия |
| `ROOM_COUNT` | 1 | Число игровых комнат в лобби |
| `CHAT_ROOM_MAX_PLAYERS` | 50 | Лимит в чат-комнате |

---

## Переменные окружения

Файл-образец: `server/.env.example`. На VPS копируйте в `server/.env`.

| Переменная | Обязательно | Описание |
|------------|-------------|----------|
| `JWT_SECRET` | да (prod) | Секрет JWT, мин. 32 символа |
| `CORS_ORIGIN` | да (prod) | URL сайта, напр. `https://example.ru` |
| `PORT` | нет | Порт сервера (по умолчанию 3001) |
| `JWT_EXPIRES` | нет | Срок токена (по умолчанию 7d) |
| `ADMIN_USERNAMES` | нет | Логины админов через запятую |
| `DB_PATH` | нет | Путь к SQLite (по умолчанию `server/data/mafia.db`) |
| `UPLOADS_DIR` | нет | Папка аватаров |
| `TELEGRAM_BOT_TOKEN` | нет | Telegram-бот |
| `TELEGRAM_WEBAPP_URL` | нет | URL Web App |
| `TELEGRAM_OIDC_CLIENT_ID` | нет | Вход через Telegram OIDC |
| `TELEGRAM_OIDC_CLIENT_SECRET` | нет | Секрет OIDC |
| `ALLOW_INSECURE_DEV` | нет | Только локально: ослабить проверки JWT/CORS |

---

## API (основное)

| Метод | URL | Описание |
|-------|-----|----------|
| POST | `/api/auth/register` | Регистрация |
| POST | `/api/auth/login` | Вход |
| GET | `/api/auth/me` | Текущий пользователь (Bearer token) |
| GET | `/api/profile/leaderboard` | Рейтинг игроков (`limit`, `offset`) |
| GET | `/api/news` | Опубликованные новости |
| POST | `/api/news/:id/poll/vote` | Голос в опросе новости |
| GET | `/api/messages/unread-count` | Непрочитанные личные сообщения |
| GET | `/api/health` | Статус сервера |

WebSocket: `/socket.io` — комнаты, игра, чат, викторина.

---

## Частые проблемы

| Проблема | Решение |
|----------|---------|
| **502 Bad Gateway** | Node не запущен: `pm2 logs mafia-server`, затем `bash scripts/deploy.sh` |
| **404 / «Клиент не собран»** | `cd client && npm run build`, `pm2 restart mafia-server` |
| Сервер не стартует после pull | `cd server && npm install && npm run build` |
| «Загрузка комнат...» | `pm2 status` — процесс `mafia-server` должен быть online |
| Конфликт `git pull` | `git stash && git pull`, пересборка, `pm2 restart mafia-server` |
| Нет HTTPS | DNS → IP сервера; порты 80/443 открыты |
| Ошибка `better-sqlite3` | `apt install -y build-essential python3`, затем `npm install` в `server/` |
| Ошибки TypeScript при сборке | Исправить код, `npm run build` в `client/` и `server/` |
| Старый интерфейс после деплоя | Ctrl+F5 в браузере |

---

## Структура проекта

```
mafia-game/
├── client/
│   ├── src/
│   │   ├── components/    # React-компоненты
│   │   ├── content/       # Тексты правил, FAQ, ролей
│   │   ├── App.tsx
│   │   └── api.ts
│   └── dist/              # Сборка Vite (не в git)
├── server/
│   ├── server.ts          # Express + Socket.IO
│   ├── dist/              # Сборка tsc (не в git)
│   ├── auth/              # JWT, SQLite, пользователи
│   ├── game/              # Движок мафии, config, роли
│   ├── news/              # Новости, комментарии, голосования
│   ├── admin/             # API админ-панели
│   ├── profile/           # Профиль, рейтинг, staff
│   ├── messages/          # Личные сообщения
│   ├── moderation/        # Модерация, лог нарушений
│   ├── quiz/              # Викторина в чат-комнатах
│   ├── data/mafia.db      # БД (создаётся автоматически)
│   └── .env.example
├── scripts/
│   ├── deploy.sh          # Деплой на VPS
│   └── verify-db.mjs      # Проверка схемы SQLite
├── Caddyfile
├── ecosystem.config.cjs   # PM2
└── README.md
```

---

## Лицензия и репозиторий

GitHub: https://github.com/dabroivanov-ship-it/mafia-game
