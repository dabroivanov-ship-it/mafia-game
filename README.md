<div align="center">

<img src="logo.jpg" alt="realmafia" width="800" />
# Мафия — онлайн

Бесплатная многопользовательская игра «Мафия» с регистрацией, комнатами, чатом, рейтингом, AI-агентами и WebSocket в реальном времени.

**Стек:** Node.js + Express + Socket.IO + SQLite (сервер), React + Vite (клиент). Продакшен: PM2 + Caddy (HTTPS).

---

## Возможности

### Игра
- Комнаты на 3–15 игроков, регистрация в партию, фазы дня и ночи
- Роли: мафия (дон выбирает ночную жертву), комиссар (Катани), доктор, маньяк, адвокат и др. — состав зависит от числа игроков
- После ночи — сводка в чате, сразу дневное голосование (90 сек): сначала выдвижение, затем «да/нет»; больше половины «нет» — оправдание
- Казнь, если строго больше половины живых нажали «да»
- Чат в комнате (общий, мафия ночью, выбывшие, наблюдатели)
- Комнаты с меткой **AI**: виртуальные игроки (DeepSeek) пишут в чат, голосуют и ходят ночью
- MMR и статистика после партий, репутация игроков

### Сайт
- **Комнаты** — игровые и чат-комнаты (в чат-комнатах работает викторина)
- **Новости** — объявления администрации, голосования, комментарии с ответами, бейдж непрочитанного
- **Кабинет** — профиль, личные сообщения, поддержка, поиск игроков, тема оформления
- **Информация** — правила, роли, игры с AI-агентами, FAQ, рейтинг, топ викторины, команда проекта
- **Вход** — логин/пароль, Telegram OIDC, VK ID
- **Админ-панель** — пользователи, комнаты (в т.ч. AI), новости, модерация, DeepSeek, бэкапы (в т.ч. отправка в Telegram), настройки сайта

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
| **Первая установка на VPS** | `sudo bash scripts/install.sh` — [автоустановщик](#автоустановка-на-vps) |

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
2. Зарегистрируйтесь (или войдите через Telegram / VK)
3. Зайдите в комнату → **«Запустить игру»** → другие игроки нажимают **«Вступить в игру»**
4. Минимум **3 игрока** (удобно проверить в нескольких вкладках; в комнате с AI свободные места занимают боты)

**Данные:**
- База SQLite: `server/data/mafia.db` (создаётся автоматически)
- Аватары: `server/uploads/avatars/`
- Изображения новостей: `server/uploads/news/`

Схема БД и новые таблицы (голосования, прочитанные новости и т.д.) применяются **автоматически** при старте сервера — отдельная миграция не нужна.

---

## Автоустановка на VPS

Скрипт ставит Node.js, Caddy, PM2, клонирует/собирает проект, создаёт `server/.env`, настраивает Caddy и запускает PM2.

**На чистом Ubuntu/Debian (от root):**

```bash
apt install -y git
git clone https://github.com/dabroivanov-ship-it/mafia-game.git /home/mafia-game
cd /home/mafia-game
chmod +x scripts/install.sh
sudo bash scripts/install.sh
```

Скрипт спросит **домен**, **логин админа**, **Telegram-бот**, **OIDC/VK/DeepSeek** (можно пропустить), затем покажет сводку и начнёт установку. DNS (A-запись `@` и `www`) должен указывать на IP сервера.

**Шаги мастера:** приветствие → домен и админ → Telegram-бот (токен, chat ID бэкапов) → Telegram OIDC → VK → DeepSeek → firewall → подтверждение → установка.

**Без вопросов (CI / повторный запуск):**

```bash
sudo DOMAIN=realmafia.online ADMIN_USER=admin bash scripts/install.sh
```

**Переменные окружения для install.sh:**

| Переменная | По умолчанию | Описание |
|------------|--------------|----------|
| `INSTALL_DIR` | `/home/mafia-game` | Каталог проекта |
| `DOMAIN` | спросит | Домен без `www` |
| `ADMIN_USER` | `admin` | `ADMIN_USERNAMES` в `.env` |
| `TELEGRAM_BOT_TOKEN` | — | опционально |
| `SKIP_APT=1` | — | не ставить пакеты через apt |
| `SKIP_UFW=1` | — | не включать ufw |
| `SKIP_CADDY=1` | — | не перезаписывать `/etc/caddy/Caddyfile` |

После установки обновления — только `bash scripts/deploy.sh` (без sudo).

---

## Установка на VPS (продакшен)

Пример: Ubuntu VPS, домен **realmafia.online**, каталог проекта **`/home/mafia-game`**.

> **Важно про каталоги.** Почти все команды ниже выполняются из **корня проекта** `/home/mafia-game`.
> - `Caddyfile`, `ecosystem.config.cjs`, `scripts/` — в корне
> - `.env`, `.env.example` — в `server/`
>
> Если вы уже в `/home/mafia-game/server`, не добавляйте префикс `server/`:
> ```bash
> # из корня проекта          # уже в server/
> cp server/.env.example server/.env    cp .env.example .env
> ```
>
> Проверка, где вы находитесь:
> ```bash
> pwd
> ls Caddyfile server/.env.example
> ```
> Оба файла должны находиться относительно текущего каталога.

### DNS

| Тип | Имя | Значение |
|-----|-----|----------|
| A | `@` | IP VPS |
| A | `www` | IP VPS |

Убедитесь, что подключаетесь по SSH к **актуальному IP из панели хостинга** (DNS может указывать на другой адрес, чем старый VPS).

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
cd /home/mafia-game

cd client && npm install && npm run build
cd ../server && npm install && npm run build
cd ..
```

Проверка:

```bash
cd /home/mafia-game
test -f client/dist/index.html && echo "client OK"
test -f server/dist/server.js && echo "server OK"
test -f Caddyfile && echo "Caddyfile OK"
test -f server/.env.example && echo "env example OK"
```

### Переменные окружения

```bash
cd /home/mafia-game
cp server/.env.example server/.env
nano server/.env
```

Сгенерировать секрет:

```bash
openssl rand -hex 32
```

Обязательно на проде:

| Переменная | Описание |
|------------|----------|
| `JWT_SECRET` | Случайная строка **минимум 32 символа** |
| `CORS_ORIGIN` | Публичный URL сайта без слэша, напр. `https://realmafia.online` |
| `SITE_URL` | То же, что `CORS_ORIGIN` (для ссылок в письмах и OAuth) |
| `TRUST_PROXY=1` | За Caddy/nginx — корректный IP клиента в логах и лимитах |

Рекомендуется:

| Переменная | Описание |
|------------|----------|
| `ADMIN_USERNAMES` | Логины админов через запятую (права выдаются при старте) |
| `TELEGRAM_BOT_TOKEN` | Бот: Web App, вход, **отправка бэкапов** |
| `TELEGRAM_BACKUP_CHAT_ID` | Chat ID для бэкапов (или задаётся в админке → Резервные копии) |

Полный список — см. [переменные окружения](#переменные-окружения).

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
cd /home/mafia-game
nano Caddyfile   # замените realmafia.online на свой домен, если нужно
cp Caddyfile /etc/caddy/Caddyfile
caddy validate --config /etc/caddy/Caddyfile
systemctl reload caddy
systemctl enable caddy
```

Проверка снаружи: `https://ваш-домен/api/health`

### Firewall

```bash
ufw allow OpenSSH
ufw allow 80
ufw allow 443
ufw enable
```

Порт **3001** наружу не открывайте — к нему ходит только Caddy локально.

### Викторина (опционально)

Файл вопросов: `questions.txt` в корне проекта (формат: `вопрос|ответ`).
Путь можно переопределить: `QUIZ_QUESTIONS_PATH` в `server/.env`.

### Бэкапы в Telegram (опционально)

1. Задайте `TELEGRAM_BOT_TOKEN` в `server/.env`, перезапустите PM2
2. Получатель пишет боту `/start`
3. Узнайте chat ID (@userinfobot) и укажите в админке → **Система → Резервные копии** или в `TELEGRAM_BACKUP_CHAT_ID`
4. Нажмите **«В Telegram»** у нужной копии (лимит Telegram — 50 МБ)

### Чеклист первого запуска

```bash
cd /home/mafia-game
# 1. код и сборка
git pull
cd client && npm install && npm run build
cd ../server && npm install && npm run build
cd ..
# 2. env
test -f server/.env || cp server/.env.example server/.env
nano server/.env
# 3. pm2
pm2 start ecosystem.config.cjs
pm2 save
# 4. caddy
cp Caddyfile /etc/caddy/Caddyfile
caddy validate --config /etc/caddy/Caddyfile
systemctl reload caddy
# 5. проверка
curl -s http://127.0.0.1:3001/api/health
curl -sI https://realmafia.online | head -3
```

---

## Обновление на сервере

**Рекомендуемый способ** — скрипт деплоя из **корня проекта**:

```bash
cd /home/mafia-game
bash scripts/deploy.sh
```

Скрипт: `git pull`, сборка client/server, проверка БД, restart PM2. Локальные правки **отслеживаемых** файлов сбрасываются. Файлы вне git (`server/.env`, `server/data/`, `uploads/`) не трогаются.

После деплоя, если менялся домен или `Caddyfile`:

```bash
cd /home/mafia-game
cp Caddyfile /etc/caddy/Caddyfile
caddy validate --config /etc/caddy/Caddyfile
systemctl reload caddy
```

Если `git pull` / deploy падает с «would be overwritten by merge»:

```bash
cd /home/mafia-game
git fetch origin
git reset --hard origin/main
bash scripts/deploy.sh
```

**Вручную:**

```bash
cd /home/mafia-game
git pull
cd client && npm install && npm run build
cd ../server && npm install && npm run build
cd .. && pm2 restart mafia-server
```

В браузере — жёсткое обновление (Ctrl+F5).

Файл **`server/data/mafia.db`** не удаляйте.

### Частые ошибки

| Ошибка | Причина | Решение |
|--------|---------|---------|
| `cannot stat 'server/.env.example'` | Вы в каталоге `server/`, а не в корне | `cd /home/mafia-game`, затем `cp server/.env.example server/.env` |
| `cannot stat 'Caddyfile'` | То же: вы в `server/` | `cd /home/mafia-game`, затем `cp Caddyfile /etc/caddy/Caddyfile` |
| `JWT_SECRET is empty` | Нет или пустой `server/.env` | `cp server/.env.example server/.env && nano server/.env` |
| SSH connection refused | Старый IP или VPS выключен | IP из панели хостинга; проверьте, что VPS запущен |

---

## Схема работы

```
Браузер
   ↓ HTTPS :443
 Caddy
   ↓ reverse_proxy 127.0.0.1:3001
 Node.js (server/dist/server.js)
   ├─ /api/auth/*        → регистрация, вход, Telegram OIDC, VK ID
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

## Переменные окружения

Файл-образец: `server/.env.example`. На VPS из **корня проекта**: `cp server/.env.example server/.env`.

| Переменная | Обязательно | Описание |
|------------|-------------|----------|
| `JWT_SECRET` | да (prod) | Секрет JWT, мин. 32 символа |
| `CORS_ORIGIN` | да (prod) | URL сайта, напр. `https://example.ru` |
| `SITE_URL` | да (prod) | Публичный URL сайта (часто = `CORS_ORIGIN`) |
| `TRUST_PROXY` | рекомендуется | `1` за Caddy/nginx |
| `PORT` | нет | Порт сервера (по умолчанию 3001) |
| `JWT_EXPIRES` | нет | Срок токена (по умолчанию 7d) |
| `ADMIN_USERNAMES` | нет | Логины админов через запятую |
| `DB_PATH` | нет | Путь к SQLite (по умолчанию `server/data/mafia.db`) |
| `UPLOADS_DIR` | нет | Папка аватаров |
| `TELEGRAM_BOT_TOKEN` | нет | Telegram-бот (Web App, вход, бэкапы) |
| `TELEGRAM_WEBAPP_URL` | нет | URL Web App |
| `TELEGRAM_BACKUP_CHAT_ID` | нет | Chat ID для отправки бэкапов (или в админке) |
| `TELEGRAM_OIDC_CLIENT_ID` | нет | Вход через Telegram OIDC |
| `TELEGRAM_OIDC_CLIENT_SECRET` | нет | Секрет OIDC |
| `VK_CLIENT_ID` | нет | Вход через VK ID |
| `VK_CLIENT_SECRET` | нет | Секрет VK ID |
| `VK_REDIRECT_URI` | нет | Callback VK (по умолчанию `{CORS_ORIGIN}/api/auth/vk/callback`) |
| `QUIZ_QUESTIONS_PATH` | нет | Путь к `questions.txt` для викторины |
| `DEEPSEEK_API_KEY` | нет | Ключ DeepSeek для AI-игроков (можно задать в админке) |
| `DEEPSEEK_BASE_URL` | нет | Базовый URL API DeepSeek (опционально, прокси) |
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
│   ├── auth/              # JWT, SQLite, Telegram OIDC, VK ID
│   ├── game/              # Движок мафии, роли, AI-агенты (DeepSeek)
│   ├── news/              # Новости, комментарии, голосования
│   ├── admin/             # API админ-панели
│   ├── profile/           # Профиль, рейтинг, staff
│   ├── messages/          # Личные сообщения
│   ├── moderation/        # Модерация, лог нарушений
│   ├── quiz/              # Викторина в чат-комнатах
│   ├── data/mafia.db      # БД (создаётся автоматически)
│   └── .env.example
├── scripts/
│   ├── install.sh         # Автоустановка на VPS (sudo)
│   ├── deploy.sh          # Деплой / обновление (запускать из корня проекта)
│   └── verify-db.mjs      # Проверка схемы SQLite
├── questions.txt          # Вопросы викторины (вопрос|ответ)
├── Caddyfile              # Конфиг Caddy (в корне, не в server/)
├── ecosystem.config.cjs   # PM2 (в корне)
└── README.md
```

---

## Лицензия и репозиторий

GitHub: https://github.com/dabroivanov-ship-it/mafia-game
