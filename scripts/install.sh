#!/usr/bin/env bash
# Автоустановка «Мафия — онлайн» на Ubuntu/Debian VPS (пошаговый мастер).
#
#   git clone https://github.com/dabroivanov-ship-it/mafia-game.git /home/mafia-game
#   cd /home/mafia-game
#   sudo bash scripts/install.sh
#
# Неинтерактивно:
#   sudo DOMAIN=realmafia.online ADMIN_USER=admin TELEGRAM_BOT_TOKEN=... bash scripts/install.sh

set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-/home/mafia-game}"
REPO_URL="${REPO_URL:-https://github.com/dabroivanov-ship-it/mafia-game.git}"
SKIP_APT="${SKIP_APT:-0}"
SKIP_UFW="${SKIP_UFW:-}"
SKIP_CADDY="${SKIP_CADDY:-0}"
NONINTERACTIVE="${NONINTERACTIVE:-0}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -f "$SCRIPT_DIR/../Caddyfile" ]]; then
  ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
else
  ROOT="$INSTALL_DIR"
fi

TOTAL_STEPS=9
CURRENT_STEP=0

log() { echo "==> $*"; }
warn() { echo "WARN: $*" >&2; }
die() { echo "ERROR: $*" >&2; exit 1; }

step_title() {
  CURRENT_STEP=$((CURRENT_STEP + 1))
  echo
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  Шаг ${CURRENT_STEP}/${TOTAL_STEPS}: $1"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo
}

press_enter() {
  [[ "$NONINTERACTIVE" == "1" || ! -t 0 ]] && return 0
  read -r -p "Нажмите Enter для продолжения…" _
}

require_root() {
  if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
    die "Запустите с sudo: sudo bash scripts/install.sh"
  fi
}

is_interactive() {
  [[ "$NONINTERACTIVE" != "1" && -t 0 ]]
}

# Запрос, если переменная ещё не задана через env
prompt_value() {
  local var_name="$1" prompt_text="$2" default_value="${3:-}"
  if [[ -n "${!var_name:-}" ]]; then
    return 0
  fi
  if ! is_interactive; then
    if [[ -n "$default_value" ]]; then
      eval "$var_name=\"\$default_value\""
      return 0
    fi
    die "Не задан $var_name. Задайте переменную окружения или запустите интерактивно."
  fi
  if [[ -n "$default_value" ]]; then
    read -r -p "$prompt_text [$default_value]: " reply
    eval "$var_name=\"\${reply:-$default_value}\""
  else
    read -r -p "$prompt_text: " reply
    eval "$var_name=\"\$reply\""
  fi
}

prompt_secret() {
  local var_name="$1" prompt_text="$2"
  if [[ -n "${!var_name:-}" ]]; then
    return 0
  fi
  if ! is_interactive; then
    return 0
  fi
  read -r -s -p "$prompt_text: " reply
  echo
  eval "$var_name=\"\$reply\""
}

prompt_yes_no() {
  local var_name="$1" prompt_text="$2" default_yes="${3:-y}"
  if [[ -n "${!var_name:-}" ]]; then
    return 0
  fi
  if ! is_interactive; then
    if [[ "$default_yes" == "y" ]]; then
      eval "$var_name=1"
    else
      eval "$var_name=0"
    fi
    return 0
  fi
  local hint="y/n"
  [[ "$default_yes" == "y" ]] && hint="Y/n" || hint="y/N"
  while true; do
    read -r -p "$prompt_text ($hint): " reply
    reply="${reply:-$default_yes}"
    case "${reply,,}" in
      y|yes|д|да) eval "$var_name=1"; return 0 ;;
      n|no|н|нет) eval "$var_name=0"; return 0 ;;
      *) echo "Введите y или n" ;;
    esac
  done
}

mask_secret() {
  local value="$1"
  if [[ -z "$value" ]]; then
    echo "—"
  elif [[ ${#value} -le 8 ]]; then
    echo "****"
  else
    echo "${value:0:4}…${value: -4}"
  fi
}

normalize_domain() {
  local raw="$1"
  raw="${raw#https://}"
  raw="${raw#http://}"
  raw="${raw%%/*}"
  raw="${raw#www.}"
  echo "$raw" | tr '[:upper:]' '[:lower:]'
}

wait_for_apt_lock() {
  local max_wait="${APT_LOCK_TIMEOUT:-600}"
  local waited=0
  local locks=(
    /var/lib/dpkg/lock-frontend
    /var/lib/dpkg/lock
    /var/lib/apt/lists/lock
    /var/cache/apt/archives/lock
  )

  while true; do
    local busy=0 lock
    for lock in "${locks[@]}"; do
      if [[ -e "$lock" ]] && fuser "$lock" >/dev/null 2>&1; then
        busy=1
        break
      fi
    done
    [[ "$busy" -eq 0 ]] && return 0

    if [[ "$waited" -eq 0 ]]; then
      echo
      log "Другой apt-процесс занят lock (часто unattended-upgrades на свежем VPS)"
      ps aux | grep -E '[a]pt-get|[a]pt |[d]pkg' | head -5 || true
      log "Ждём до ${max_wait} сек… (или Ctrl+C и повторите позже)"
    elif [[ $((waited % 30)) -eq 0 ]]; then
      echo "  … всё ещё ждём (${waited}/${max_wait} сек)"
    fi

    sleep 5
    waited=$((waited + 5))
    if [[ "$waited" -ge "$max_wait" ]]; then
      die "apt занят слишком долго. На сервере:
  ps aux | grep -E 'apt|dpkg'
  sudo kill <PID>          # если процесс завис
  sudo dpkg --configure -a
  sudo bash scripts/install.sh"
    fi
  done
}

apt_get() {
  wait_for_apt_lock
  DEBIAN_FRONTEND=noninteractive apt-get "$@"
}

run_wizard() {
  step_title "Приветствие"
  cat <<'EOF'
  Мастер установки «Мафия — онлайн»

  Будет установлено:
    • Node.js, Caddy (HTTPS), PM2
    • Сборка клиента и сервера
    • server/.env и reverse proxy на порт 3001

  DNS: A-запись домена должна указывать на IP этого сервера.
EOF
  press_enter

  step_title "Домен и администратор"
  echo "Укажите основной домен (без https:// и без www)."
  echo "Пример: realmafia.online"
  echo
  prompt_value DOMAIN "Домен" "realmafia.online"
  DOMAIN="$(normalize_domain "$DOMAIN")"
  [[ -n "$DOMAIN" ]] || die "Домен не может быть пустым"
  echo "→ Сайт: https://${DOMAIN}"
  echo

  prompt_value ADMIN_USER "Логин администратора (можно несколько через запятую)" "admin"
  [[ -n "$ADMIN_USER" ]] || die "Логин админа не может быть пустым"
  echo "→ После установки зарегистрируйте аккаунт с этим логином на сайте."
  press_enter

  step_title "Telegram-бот"
  cat <<'EOF'
  Бот нужен для:
    • кнопки «Играть» в Telegram
    • отправки бэкапов из админки
    • (опционально) входа через Telegram OIDC — следующий шаг

  Токен берётся у @BotFather. Получатель бэкапов должен написать боту /start.
  Chat ID — через @userinfobot или админку → Резервные копии.
EOF
  echo
  prompt_yes_no SETUP_TELEGRAM "Настроить Telegram-бот сейчас?" "y"
  if [[ "${SETUP_TELEGRAM:-0}" == "1" ]]; then
    prompt_secret TELEGRAM_BOT_TOKEN "TELEGRAM_BOT_TOKEN (BotFather)"
    if [[ -z "${TELEGRAM_BOT_TOKEN:-}" ]]; then
      warn "Токен не введён — блок Telegram пропущен"
      SETUP_TELEGRAM=0
    else
      prompt_value TELEGRAM_BACKUP_CHAT_ID "Chat ID для бэкапов (Enter — пропустить, зададите в админке)" ""
    fi
  fi
  press_enter

  step_title "Вход через Telegram (OIDC)"
  cat <<'EOF'
  Опционально. Нужны Client ID и Secret из BotFather:
  Bot Settings → Web Login → OpenID Connect.

  Если не используете — просто нажмите Enter / n.
EOF
  echo
  prompt_yes_no SETUP_TELEGRAM_OIDC "Настроить вход через Telegram OIDC?" "n"
  if [[ "${SETUP_TELEGRAM_OIDC:-0}" == "1" ]]; then
    prompt_value TELEGRAM_OIDC_CLIENT_ID "TELEGRAM_OIDC_CLIENT_ID" ""
    prompt_secret TELEGRAM_OIDC_CLIENT_SECRET "TELEGRAM_OIDC_CLIENT_SECRET"
    if [[ -z "${TELEGRAM_OIDC_CLIENT_ID:-}" || -z "${TELEGRAM_OIDC_CLIENT_SECRET:-}" ]]; then
      warn "OIDC Telegram: не все поля заполнены — пропуск"
      SETUP_TELEGRAM_OIDC=0
    fi
  fi
  press_enter

  step_title "Вход через VK ID"
  cat <<'EOF'
  Опционально. Client ID и Secret из кабинета VK ID (id.vk.com).
  Redirect URI будет: https://ВАШ_ДОМЕН/api/auth/vk/callback
EOF
  echo
  prompt_yes_no SETUP_VK "Настроить вход через VK?" "n"
  if [[ "${SETUP_VK:-0}" == "1" ]]; then
    prompt_value VK_CLIENT_ID "VK_CLIENT_ID" ""
    prompt_secret VK_CLIENT_SECRET "VK_CLIENT_SECRET"
    if [[ -z "${VK_CLIENT_ID:-}" || -z "${VK_CLIENT_SECRET:-}" ]]; then
      warn "VK: не все поля заполнены — пропуск"
      SETUP_VK=0
    fi
  fi
  press_enter

  step_title "AI-игроки (DeepSeek)"
  cat <<'EOF'
  Опционально. API-ключ DeepSeek для ботов в игровых комнатах.
  Можно добавить позже в админке → DeepSeek.
EOF
  echo
  prompt_yes_no SETUP_DEEPSEEK "Задать DEEPSEEK_API_KEY сейчас?" "n"
  if [[ "${SETUP_DEEPSEEK:-0}" == "1" ]]; then
    prompt_secret DEEPSEEK_API_KEY "DEEPSEEK_API_KEY"
    [[ -n "${DEEPSEEK_API_KEY:-}" ]] || SETUP_DEEPSEEK=0
  fi
  press_enter

  step_title "Firewall и системные пакеты"
  if [[ -z "$SKIP_UFW" ]]; then
    prompt_yes_no ENABLE_UFW "Включить ufw (SSH, 80, 443)?" "y"
    SKIP_UFW=$([[ "${ENABLE_UFW:-1}" == "1" ]] && echo 0 || echo 1)
  fi
  if [[ "$SKIP_APT" != "1" ]] && is_interactive; then
    prompt_yes_no INSTALL_PACKAGES "Установить/обновить Node.js, Caddy, PM2 через apt?" "y"
    [[ "${INSTALL_PACKAGES:-1}" == "1" ]] || SKIP_APT=1
  fi
  press_enter

  step_title "Проверьте настройки"
  cat <<EOF
  Каталог проекта:  ${ROOT}
  Домен:            https://${DOMAIN}
  Админ(ы):         ${ADMIN_USER}

  Telegram-бот:     $([[ "${SETUP_TELEGRAM:-0}" == "1" ]] && echo "да, токен $(mask_secret "${TELEGRAM_BOT_TOKEN:-}")" || echo "нет")
  Chat ID бэкапов:  ${TELEGRAM_BACKUP_CHAT_ID:-—}
  Telegram OIDC:    $([[ "${SETUP_TELEGRAM_OIDC:-0}" == "1" ]] && echo "да" || echo "нет")
  VK ID:            $([[ "${SETUP_VK:-0}" == "1" ]] && echo "да" || echo "нет")
  DeepSeek:         $([[ "${SETUP_DEEPSEEK:-0}" == "1" ]] && echo "да, ключ $(mask_secret "${DEEPSEEK_API_KEY:-}")" || echo "нет")
  Firewall (ufw):   $([[ "$SKIP_UFW" == "1" ]] && echo "нет" || echo "да")
  Caddy:            $([[ "$SKIP_CADDY" == "1" ]] && echo "пропуск" || echo "да")
EOF
  echo
  if is_interactive; then
    prompt_yes_no CONFIRM_INSTALL "Начать установку?" "y"
    [[ "${CONFIRM_INSTALL:-0}" == "1" ]] || die "Установка отменена"
  else
    CONFIRM_INSTALL=1
  fi
}

install_system_packages() {
  [[ "$SKIP_APT" == "1" ]] && { log "Пропуск установки системных пакетов (SKIP_APT=1)"; return 0; }

  log "Обновление системы"
  apt_get update -qq
  apt_get upgrade -y -qq
  apt_get install -y -qq git curl ca-certificates build-essential python3 openssl

  if ! command -v node >/dev/null 2>&1 || [[ "$(node -p 'process.versions.node.split(".")[0]')" -lt 18 ]]; then
    log "Node.js 20"
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt_get install -y -qq nodejs
  else
    log "Node.js уже установлен: $(node -v)"
  fi

  if ! command -v caddy >/dev/null 2>&1; then
    log "Caddy"
    apt_get install -y -qq debian-keyring debian-archive-keyring apt-transport-https curl
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
      | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
      | tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
    apt_get update -qq
    apt_get install -y -qq caddy
  else
    log "Caddy уже установлен"
  fi

  if ! command -v pm2 >/dev/null 2>&1; then
    log "PM2"
    npm install -g pm2
  else
    log "PM2 уже установлен"
  fi
}

ensure_repository() {
  if [[ -f "$ROOT/Caddyfile" && -f "$ROOT/server/.env.example" ]]; then
    log "Проект: $ROOT"
    return 0
  fi

  log "Клонирование в $INSTALL_DIR"
  mkdir -p "$(dirname "$INSTALL_DIR")"
  if [[ -d "$INSTALL_DIR/.git" ]]; then
    git -C "$INSTALL_DIR" fetch origin
    git -C "$INSTALL_DIR" reset --hard origin/main 2>/dev/null || git -C "$INSTALL_DIR" reset --hard origin/master
  else
    git clone "$REPO_URL" "$INSTALL_DIR"
  fi
  ROOT="$INSTALL_DIR"
}

set_env_value() {
  local file="$1" key="$2" value="$3"
  if [[ -z "$value" ]]; then
    return 0
  fi
  local escaped="${value//\\/\\\\}"
  escaped="${escaped//&/\\&}"
  if grep -q "^${key}=" "$file"; then
    sed -i "s|^${key}=.*|${key}=${escaped}|" "$file"
  elif grep -q "^# ${key}=" "$file"; then
    sed -i "s|^# ${key}=.*|${key}=${escaped}|" "$file"
  else
    echo "${key}=${value}" >>"$file"
  fi
}

remove_env_key() {
  local file="$1" key="$2"
  sed -i "/^${key}=/d" "$file"
}

setup_env_file() {
  local env_file="$ROOT/server/.env"
  local example="$ROOT/server/.env.example"
  [[ -f "$example" ]] || die "Не найден $example"

  if [[ ! -f "$env_file" ]]; then
    log "Создание server/.env"
    cp "$example" "$env_file"
  else
    log "Обновление server/.env (файл уже существует)"
  fi

  local site_url="https://${DOMAIN}"
  local jwt
  jwt="$(grep '^JWT_SECRET=' "$env_file" | cut -d= -f2- || true)"
  if [[ -z "$jwt" || ${#jwt} -lt 32 ]]; then
    jwt="$(openssl rand -hex 32)"
    log "Сгенерирован JWT_SECRET"
  fi

  set_env_value "$env_file" NODE_ENV production
  set_env_value "$env_file" PORT 3001
  set_env_value "$env_file" JWT_SECRET "$jwt"
  set_env_value "$env_file" CORS_ORIGIN "$site_url"
  set_env_value "$env_file" SITE_URL "$site_url"
  set_env_value "$env_file" TRUST_PROXY 1
  set_env_value "$env_file" ADMIN_USERNAMES "$ADMIN_USER"

  if [[ "${SETUP_TELEGRAM:-0}" == "1" && -n "${TELEGRAM_BOT_TOKEN:-}" ]]; then
    set_env_value "$env_file" TELEGRAM_BOT_TOKEN "$TELEGRAM_BOT_TOKEN"
    set_env_value "$env_file" TELEGRAM_WEBAPP_URL "$site_url"
    set_env_value "$env_file" TELEGRAM_BACKUP_CHAT_ID "${TELEGRAM_BACKUP_CHAT_ID:-}"
  else
    remove_env_key "$env_file" TELEGRAM_BOT_TOKEN
    remove_env_key "$env_file" TELEGRAM_WEBAPP_URL
    remove_env_key "$env_file" TELEGRAM_BACKUP_CHAT_ID
  fi

  if [[ "${SETUP_TELEGRAM_OIDC:-0}" == "1" ]]; then
    set_env_value "$env_file" TELEGRAM_OIDC_CLIENT_ID "$TELEGRAM_OIDC_CLIENT_ID"
    set_env_value "$env_file" TELEGRAM_OIDC_CLIENT_SECRET "$TELEGRAM_OIDC_CLIENT_SECRET"
  else
    remove_env_key "$env_file" TELEGRAM_OIDC_CLIENT_ID
    remove_env_key "$env_file" TELEGRAM_OIDC_CLIENT_SECRET
  fi

  if [[ "${SETUP_VK:-0}" == "1" ]]; then
    set_env_value "$env_file" VK_CLIENT_ID "$VK_CLIENT_ID"
    set_env_value "$env_file" VK_CLIENT_SECRET "$VK_CLIENT_SECRET"
  else
    remove_env_key "$env_file" VK_CLIENT_ID
    remove_env_key "$env_file" VK_CLIENT_SECRET
  fi

  if [[ "${SETUP_DEEPSEEK:-0}" == "1" && -n "${DEEPSEEK_API_KEY:-}" ]]; then
    set_env_value "$env_file" DEEPSEEK_API_KEY "$DEEPSEEK_API_KEY"
  else
    remove_env_key "$env_file" DEEPSEEK_API_KEY
  fi
}

npm_install_build() {
  local dir="$1" label="$2"
  log "Сборка: $label"
  cd "$dir"
  export NODE_ENV=production
  npm install --include=dev --no-audit --no-fund
  npm run build
}

build_application() {
  npm_install_build "$ROOT/client" "client"
  npm_install_build "$ROOT/server" "server"
  [[ -f "$ROOT/server/dist/server.js" ]] || die "Сборка server не удалась"
  [[ -f "$ROOT/client/dist/index.html" ]] || die "Сборка client не удалась"
  log "Проверка схемы БД"
  node "$ROOT/scripts/verify-db.mjs"
}

write_caddyfile() {
  [[ "$SKIP_CADDY" == "1" ]] && { log "Пропуск Caddy (SKIP_CADDY=1)"; return 0; }

  local dest="/etc/caddy/Caddyfile"
  log "Caddy → $dest"

  cat >"$dest" <<EOF
# Mafia game — scripts/install.sh

${DOMAIN} {
	encode zstd gzip
	reverse_proxy 127.0.0.1:3001
}

www.${DOMAIN} {
	redir https://${DOMAIN}{uri} permanent
}
EOF

  caddy validate --config "$dest"
  systemctl enable caddy
  systemctl reload caddy
}

setup_pm2() {
  log "PM2"
  cd "$ROOT"
  pm2 delete mafia-server 2>/dev/null || true
  pm2 start ecosystem.config.cjs --update-env
  pm2 save

  local startup_cmd
  startup_cmd="$(pm2 startup systemd -u "${SUDO_USER:-root}" --hp "$(eval echo "~${SUDO_USER:-root}")" 2>/dev/null | grep '^sudo' || true)"
  if [[ -n "$startup_cmd" ]]; then
    echo
    warn "Автозапуск после перезагрузки — выполните отдельно:"
    echo "  $startup_cmd"
  fi
}

setup_firewall() {
  [[ "$SKIP_UFW" == "1" ]] && return 0
  command -v ufw >/dev/null 2>&1 || return 0
  log "ufw: SSH, 80, 443"
  ufw allow OpenSSH >/dev/null 2>&1 || ufw allow 22/tcp >/dev/null 2>&1 || true
  ufw allow 80/tcp >/dev/null 2>&1 || true
  ufw allow 443/tcp >/dev/null 2>&1 || true
  ufw --force enable >/dev/null 2>&1 || true
}

wait_for_health() {
  log "Проверка /api/health"
  local health=""
  for _ in $(seq 1 15); do
    health="$(curl -sf http://127.0.0.1:3001/api/health || true)"
    [[ -n "$health" ]] && break
    sleep 1
  done
  if [[ -z "$health" ]]; then
    warn "Health check не прошёл"
    pm2 logs mafia-server --lines 20 --nostream || true
    return 1
  fi
  echo "$health" | head -c 200
  echo
}

print_summary() {
  step_title "Готово"
  cat <<EOF
  Сайт:        https://${DOMAIN}
  Каталог:     ${ROOT}
  Админ:       ${ADMIN_USER} — зарегистрируйте этот логин на сайте

  Проверка:
    curl http://127.0.0.1:3001/api/health
    curl -sI https://${DOMAIN} | head -3

  Telegram-бот: $([[ "${SETUP_TELEGRAM:-0}" == "1" ]] && echo "настроен" || echo "не задан — nano ${ROOT}/server/.env")
  Бэкапы в TG:  ${TELEGRAM_BACKUP_CHAT_ID:-задайте в админке → Резервные копии}

  Обновление:   cd ${ROOT} && bash scripts/deploy.sh
  Логи:         pm2 logs mafia-server
  Настройки:    nano ${ROOT}/server/.env

EOF
}

run_installation() {
  CURRENT_STEP=0
  TOTAL_STEPS=6

  step_title "Установка системных пакетов"
  install_system_packages

  step_title "Подготовка проекта"
  ensure_repository
  cd "$ROOT"

  step_title "Файл server/.env"
  setup_env_file

  step_title "Сборка приложения"
  build_application

  step_title "Caddy (HTTPS)"
  write_caddyfile

  step_title "Запуск PM2"
  setup_pm2
  setup_firewall
  wait_for_health || true

  print_summary
}

main() {
  require_root

  if [[ -n "${DOMAIN:-}" || "${NONINTERACTIVE:-0}" == "1" ]]; then
    NONINTERACTIVE=1
    prompt_value DOMAIN "Домен" "${DOMAIN:-realmafia.online}"
    DOMAIN="$(normalize_domain "$DOMAIN")"
    prompt_value ADMIN_USER "Админ" "${ADMIN_USER:-admin}"
    SETUP_TELEGRAM=$([[ -n "${TELEGRAM_BOT_TOKEN:-}" ]] && echo 1 || echo 0)
    SETUP_TELEGRAM_OIDC=$([[ -n "${TELEGRAM_OIDC_CLIENT_ID:-}" && -n "${TELEGRAM_OIDC_CLIENT_SECRET:-}" ]] && echo 1 || echo 0)
    SETUP_VK=$([[ -n "${VK_CLIENT_ID:-}" && -n "${VK_CLIENT_SECRET:-}" ]] && echo 1 || echo 0)
    SETUP_DEEPSEEK=$([[ -n "${DEEPSEEK_API_KEY:-}" ]] && echo 1 || echo 0)
    SKIP_UFW="${SKIP_UFW:-0}"
    CONFIRM_INSTALL=1
  else
    run_wizard
  fi

  run_installation
}

main "$@"
