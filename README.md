<div align="center">

<img src="logo.jpg" alt="realmafia" width="800" />

# Мафия — онлайн

Бесплатная многопользовательская «Мафия» в браузере: комнаты, чат, рейтинг, викторина, AI-игроки.

**Сайт:** [realmafia.online](https://realmafia.online) · **Репозиторий:** [github.com/dabroivanov-ship-it/mafia-game](https://github.com/dabroivanov-ship-it/mafia-game)

**Стек:** React + Vite · Node.js + Express + Socket.IO · SQLite · PM2 · Caddy

</div>

---

## Содержание

- [Возможности](#возможности)
- [Быстрый старт](#быстрый-старт)
- [Установка на VPS](#установка-на-vps)
- [Обновление](#обновление)
- [Настройка (.env)](#настройка-env)
- [Архитектура](#архитектура)
- [Структура проекта](#структура-проекта)
- [API](#api)
- [Решение проблем](#решение-проблем)

---

## Возможности

**Игра** — комнаты 3–15 человек, день/ночь, роли (мафия, дон, комиссар, доктор, маньяк, адвокат и др.), голосование, чат (общий, мафия, выбывшие). Комнаты с AI: боты на DeepSeek играют, пишут и голосуют. MMR и статистика после партий.

**Сайт** — регистрация, кабинет, личные сообщения, новости с опросами, кланы, рейтинг, викторина в чат-комнате, вход через Telegram и VK.

**Админка** — пользователи, комнаты, новости, модерация, фразы ведущего, DeepSeek, бэкапы (в том числе отправка архива в Telegram), брендинг, аналитика.

---

## Быстрый старт

### Локальная разработка

```bash
git clone https://github.com/dabroivanov-ship-it/mafia-game.git
cd mafia-game

cd server && npm install && npm run dev    # терминал 1 → :3001
cd client && npm install && npm run dev    # терминал 2 → :5173
```

Клиент проксирует `/api` и `/socket.io` на сервер. БД создаётся сама: `server/data/mafia.db`.

**Prod-режим локально:**

```bash
cd client && npm run build
cd ../server && npm run build && npm start
# → http://localhost:3001
```

### Команды

| Задача | Команда |
|--------|---------|
| Dev-сервер | `cd server && npm run dev` |
| Dev-клиент | `cd client && npm run dev` |
| Сборка | `cd client && npm run build` · `cd server && npm run build` |
| **Установка VPS** | `sudo bash scripts/install.sh` |
| **Обновление VPS** | `bash scripts/deploy.sh` |

**Требования:** Node.js 18+ (рекомендуется 20), npm, Git. На Linux для SQLite: `build-essential`, `python3`.

---

## Установка на VPS

Рекомендуемый путь — **пошаговый мастер** `scripts/install.sh`. Он ставит Node.js, Caddy, PM2, собирает проект, создаёт `server/.env`, настраивает HTTPS и запускает приложение.

### 1. DNS

| Тип | Имя | Значение |
|-----|-----|----------|
| A | `@` | IP вашего VPS |
| A | `www` | IP вашего VPS |

Подключайтесь по SSH к **актуальному IP из панели хостинга**, а не к старому.

### 2. Мастер установки

```bash
apt install -y git
git clone https://github.com/dabroivanov-ship-it/mafia-game.git /home/mafia-game
cd /home/mafia-game
sudo bash scripts/install.sh
```

Мастер проведёт по шагам:

1. Домен и логин администратора  
2. Telegram-бот (токен, chat ID для бэкапов) — можно пропустить  
3. Вход через Telegram OIDC — опционально  
4. Вход через VK ID — опционально  
5. DeepSeek для AI-игроков — опционально  
6. Firewall (ufw)  
7. Сводка настроек и подтверждение  
8. Установка и проверка  

После установки **зарегистрируйте на сайте аккаунт с логином админа** — права выдадутся автоматически.

**Без диалога** (если все переменные известны заранее):

```bash
sudo DOMAIN=realmafia.online \
     ADMIN_USER=admin \
     TELEGRAM_BOT_TOKEN=123456:AA... \
     bash scripts/install.sh
```

| Переменная | Описание |
|------------|----------|
| `DOMAIN` | Домен без `www` и без `https://` |
| `ADMIN_USER` | Логин(и) админа через запятую |
| `TELEGRAM_BOT_TOKEN` | Токен @BotFather |
| `TELEGRAM_BACKUP_CHAT_ID` | Chat ID для бэкапов |
| `TELEGRAM_OIDC_CLIENT_ID` / `TELEGRAM_OIDC_CLIENT_SECRET` | Telegram Login |
| `VK_CLIENT_ID` / `VK_CLIENT_SECRET` | VK ID |
| `DEEPSEEK_API_KEY` | AI-игроки |
| `SKIP_APT=1` | Не ставить системные пакеты |
| `SKIP_UFW=1` | Не настраивать firewall |
| `SKIP_CADDY=1` | Не перезаписывать `/etc/caddy/Caddyfile` |

### 3. Где что лежит

Все команды ниже — из **корня проекта** `/home/mafia-game`:

```
/home/mafia-game/
├── Caddyfile              ← конфиг HTTPS (копируется в /etc/caddy/)
├── ecosystem.config.cjs   ← PM2
├── scripts/install.sh
├── scripts/deploy.sh
├── questions.txt          ← викторина (вопрос|ответ)
└── server/
    ├── .env               ← секреты (не в git!)
    └── data/mafia.db      ← база
```

Проверка каталога:

```bash
cd /home/mafia-game
pwd
ls Caddyfile server/.env.example
```

### 4. Ручная установка

Если мастер не подходит — те же шаги вручную:

```bash
cd /home/mafia-game
cp server/.env.example server/.env && nano server/.env   # JWT_SECRET, CORS_ORIGIN
cd client && npm install && npm run build
cd ../server && npm install && npm run build
pm2 start ecosystem.config.cjs && pm2 save
cp Caddyfile /etc/caddy/Caddyfile
caddy validate --config /etc/caddy/Caddyfile && systemctl reload caddy
curl http://127.0.0.1:3001/api/health
```

`JWT_SECRET`: `openssl rand -hex 32`

Порт **3001** наружу не открывайте — только Caddy на 80/443.

---

## Обновление

Из корня проекта:

```bash
cd /home/mafia-game
bash scripts/deploy.sh
```

Скрипт: `git pull`, сборка, проверка БД, restart PM2. Файлы **вне git** (`server/.env`, `server/data/`, `uploads/`) не трогает.

Если деплой конфликтует с локальными правками:

```bash
git fetch origin && git reset --hard origin/main
bash scripts/deploy.sh
```

После смены домена или `Caddyfile`:

```bash
cp Caddyfile /etc/caddy/Caddyfile
caddy validate --config /etc/caddy/Caddyfile
systemctl reload caddy
```

В браузере — Ctrl+F5. **`server/data/mafia.db` не удаляйте.**

---

## Настройка (.env)

Образец: `server/.env.example`. Создание:

```bash
cd /home/mafia-game
cp server/.env.example server/.env
```

### Обязательно на продакшене

| Переменная | Описание |
|------------|----------|
| `JWT_SECRET` | Минимум 32 символа (`openssl rand -hex 32`) |
| `CORS_ORIGIN` | `https://ваш-домен.ru` |
| `SITE_URL` | Обычно то же, что `CORS_ORIGIN` |
| `TRUST_PROXY` | `1` за Caddy |

### Часто используемые

| Переменная | Описание |
|------------|----------|
| `ADMIN_USERNAMES` | Логины админов через запятую |
| `TELEGRAM_BOT_TOKEN` | Бот: Web App, /start, бэкапы |
| `TELEGRAM_WEBAPP_URL` | URL сайта для Web App |
| `TELEGRAM_BACKUP_CHAT_ID` | Chat ID для бэкапов (или в админке) |
| `TELEGRAM_OIDC_*` | Вход через Telegram |
| `VK_CLIENT_ID` / `VK_CLIENT_SECRET` | Вход через VK |
| `DEEPSEEK_API_KEY` | AI-игроки (или в админке) |
| `QUIZ_QUESTIONS_PATH` | Путь к `questions.txt` |
| `DB_PATH` | Путь к SQLite |

PM2 читает `server/.env` через `ecosystem.config.cjs`.

### Бэкапы в Telegram

1. `TELEGRAM_BOT_TOKEN` в `.env`, перезапуск PM2  
2. Получатель пишет боту `/start`  
3. Chat ID — @userinfobot или админка → **Система → Резервные копии**  
4. Кнопка **«В Telegram»** у копии (лимит — 50 МБ; без uploads, если архив большой)

---

## Архитектура

```
Браузер
   ↓ HTTPS :443
 Caddy
   ↓ 127.0.0.1:3001
 Node.js (PM2)
   ├─ /api/*         REST
   ├─ /socket.io/*   игра, чат, викторина
   ├─ /uploads/*     файлы
   └─ /*             React (client/dist)
```

---

## Структура проекта

```
mafia-game/
├── client/           React + Vite
├── server/
│   ├── auth/       JWT, SQLite, Telegram, VK
│   ├── game/       движок, роли, AI
│   ├── admin/      API админки
│   ├── quiz/       викторина
│   ├── backup/     резервные копии
│   └── telegram/   бот
├── scripts/
│   ├── install.sh  установка (sudo)
│   └── deploy.sh   обновление
├── Caddyfile
├── ecosystem.config.cjs
└── questions.txt
```

---

## API

| Метод | URL | Описание |
|-------|-----|----------|
| POST | `/api/auth/register` | Регистрация |
| POST | `/api/auth/login` | Вход |
| GET | `/api/auth/me` | Текущий пользователь |
| GET | `/api/profile/leaderboard` | Рейтинг |
| GET | `/api/news` | Новости |
| GET | `/api/health` | Статус сервера |

WebSocket: `/socket.io` — комнаты, игра, чат.

---

## Решение проблем

| Симптом | Что делать |
|---------|------------|
| `cannot stat 'server/.env.example'` | Вы в `server/`, а не в корне → `cd /home/mafia-game` |
| `cannot stat 'Caddyfile'` | То же → `cd /home/mafia-game` |
| Caddy показывает `:80` и `/usr/share/caddy` | Замените конфиг: `cp /home/mafia-game/Caddyfile /etc/caddy/Caddyfile && systemctl reload caddy` |
| `JWT_SECRET is empty` | `cp server/.env.example server/.env && nano server/.env` |
| SSH connection refused | Проверьте IP в панели хостинга, что VPS включён |
| Сайт не открывается | `pm2 status` · `curl localhost:3001/api/health` · `systemctl status caddy` |
| `pm2 logs mafia-server` | Логи приложения |
| `Could not get lock /var/lib/dpkg/lock-frontend` | Фоновый `apt-get` (unattended-upgrades) | Подождите 2–5 мин или `ps aux \| grep apt` · `sudo kill 1369` · `sudo dpkg --configure -a` |

---

## Лицензия

Проект: [dabroivanov-ship-it/mafia-game](https://github.com/dabroivanov-ship-it/mafia-game)
