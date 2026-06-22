import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import type { Request } from 'express';
import { getOrCreateUserFromTelegram } from './telegram.js';
import { findUserById, isUserBanned, publicUser } from './db.js';
import type { User } from '../types/index.js';

const JWKS_URL = 'https://oauth.telegram.org/.well-known/jwks.json';
const ISSUER = 'https://oauth.telegram.org';
const JWKS_TTL_MS = 60 * 60 * 1000;
const OIDC_STATE_TTL_MS = 10 * 60 * 1000;
const TELEGRAM_AUTH_URL = 'https://oauth.telegram.org/auth';
const TELEGRAM_TOKEN_URL = 'https://oauth.telegram.org/token';

interface JwkKey {
  kid: string;
  kty: string;
  n: string;
  e: string;
  alg: string;
  use: string;
}

export interface TelegramOidcClaims {
  sub: string;
  id?: number;
  preferred_username?: string;
  name?: string;
  picture?: string;
  phone_number?: string;
}

interface PendingOidcState {
  codeVerifier: string;
  remember: boolean;
  createdAt: number;
}

let jwksCache: { keys: JwkKey[]; fetchedAt: number } | null = null;
const pendingStates = new Map<string, PendingOidcState>();

function getOidcClientId(): string {
  return process.env.TELEGRAM_OIDC_CLIENT_ID?.trim() || '';
}

function getOidcClientSecret(): string {
  return process.env.TELEGRAM_OIDC_CLIENT_SECRET?.trim() || '';
}

export function getSiteOrigin(req?: Request): string {
  const fromEnv = process.env.CORS_ORIGIN?.split(',')[0]?.trim().replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  if (req) {
    const proto = req.get('x-forwarded-proto') || req.protocol;
    const host = req.get('x-forwarded-host') || req.get('host');
    if (host) return `${proto}://${host}`.replace(/\/$/, '');
  }
  return 'http://localhost:3001';
}

export function getTelegramOidcRedirectUri(req?: Request): string {
  const configured = process.env.TELEGRAM_OIDC_REDIRECT_URI?.trim();
  if (configured) return configured.replace(/\/$/, '');
  return `${getSiteOrigin(req)}/api/auth/telegram/oidc/callback`;
}

export function isTelegramOidcConfigured(): boolean {
  return !!(getOidcClientId() && getOidcClientSecret());
}

function purgeExpiredStates(): void {
  const now = Date.now();
  for (const [state, entry] of pendingStates.entries()) {
    if (now - entry.createdAt > OIDC_STATE_TTL_MS) pendingStates.delete(state);
  }
}

function createCodeVerifier(): string {
  return crypto.randomBytes(32).toString('base64url');
}

function createCodeChallenge(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

export function createTelegramOidcAuthorizationUrl(remember: boolean, req?: Request): string {
  purgeExpiredStates();
  const clientId = getOidcClientId();
  const redirectUri = getTelegramOidcRedirectUri(req);
  const state = crypto.randomBytes(24).toString('base64url');
  const codeVerifier = createCodeVerifier();
  const codeChallenge = createCodeChallenge(codeVerifier);

  pendingStates.set(state, { codeVerifier, remember, createdAt: Date.now() });

  const url = new URL(TELEGRAM_AUTH_URL);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid profile');
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  return url.toString();
}

async function exchangeAuthorizationCode(
  code: string,
  codeVerifier: string,
  req?: Request
): Promise<string> {
  const clientId = getOidcClientId();
  const clientSecret = getOidcClientSecret();
  const redirectUri = getTelegramOidcRedirectUri(req);
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const res = await fetch(TELEGRAM_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basic}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      code_verifier: codeVerifier,
    }),
  });

  const data = (await res.json()) as { id_token?: string; error?: string; error_description?: string };
  if (!res.ok) {
    throw new Error(data.error_description || data.error || 'Не удалось обменять код Telegram OIDC');
  }
  if (!data.id_token) {
    throw new Error('Telegram не вернул id_token');
  }
  return data.id_token;
}

export async function completeTelegramOidcAuthorization(
  code: string,
  state: string,
  req?: Request
): Promise<{ user: User; remember: boolean }> {
  purgeExpiredStates();
  const pending = pendingStates.get(state);
  pendingStates.delete(state);
  if (!pending) {
    throw new Error('Сессия Telegram OIDC истекла, попробуйте снова');
  }
  if (Date.now() - pending.createdAt > OIDC_STATE_TTL_MS) {
    throw new Error('Сессия Telegram OIDC истекла, попробуйте снова');
  }

  const idToken = await exchangeAuthorizationCode(code, pending.codeVerifier, req);
  const claims = await verifyTelegramOidcIdToken(idToken);
  const user = await getOrCreateUserFromTelegram({
    telegramId: claims.telegramId,
    username: claims.username,
    firstName: claims.firstName,
    lastName: claims.lastName,
  });
  if (!user) {
    throw new Error('Ошибка регистрации через Telegram');
  }
  if (isUserBanned(user)) {
    throw new Error(`Аккаунт заблокирован: ${user.ban_reason || ''}`);
  }
  return { user, remember: pending.remember };
}

export function buildTelegramOidcSuccessRedirect(token: string, req?: Request): string {
  const origin = getSiteOrigin(req);
  return `${origin}/?tg_token=${encodeURIComponent(token)}`;
}

export function buildTelegramOidcErrorRedirect(message: string, req?: Request): string {
  const origin = getSiteOrigin(req);
  return `${origin}/?tg_error=${encodeURIComponent(message)}`;
}

async function getJwks(): Promise<JwkKey[]> {
  if (jwksCache && Date.now() - jwksCache.fetchedAt < JWKS_TTL_MS) {
    return jwksCache.keys;
  }

  const res = await fetch(JWKS_URL);
  if (!res.ok) {
    throw new Error('Не удалось загрузить ключи Telegram OIDC');
  }

  const data = (await res.json()) as { keys?: JwkKey[] };
  const keys = data.keys || [];
  jwksCache = { keys, fetchedAt: Date.now() };
  return keys;
}

function jwkToPem(jwk: JwkKey): string {
  const keyObject = crypto.createPublicKey({
    key: { kty: 'RSA', n: jwk.n, e: jwk.e },
    format: 'jwk',
  });
  return keyObject.export({ type: 'spki', format: 'pem' }) as string;
}

function parseName(name: string | undefined): { firstName?: string; lastName?: string } {
  const trimmed = name?.trim();
  if (!trimmed) return {};
  const parts = trimmed.split(/\s+/);
  return {
    firstName: parts[0],
    lastName: parts.length > 1 ? parts.slice(1).join(' ') : undefined,
  };
}

export async function verifyTelegramOidcIdToken(idToken: string): Promise<{
  telegramId: string;
  username: string | null;
  firstName?: string;
  lastName?: string;
}> {
  const clientId = getOidcClientId();
  if (!isTelegramOidcConfigured()) {
    throw new Error('Telegram OIDC не настроен на сервере');
  }

  const decoded = jwt.decode(idToken, { complete: true });
  const kid = decoded?.header?.kid;
  if (!kid || typeof kid !== 'string') {
    throw new Error('Некорректный id_token');
  }

  const keys = await getJwks();
  const jwk = keys.find((key) => key.kid === kid);
  if (!jwk) {
    jwksCache = null;
    throw new Error('Неизвестный ключ подписи Telegram');
  }

  const pem = jwkToPem(jwk);
  const payload = jwt.verify(idToken, pem, {
    algorithms: ['RS256'],
    issuer: ISSUER,
    audience: clientId,
  }) as jwt.JwtPayload & TelegramOidcClaims;

  const telegramId =
    (payload.sub && String(payload.sub)) ||
    (payload.id != null ? String(payload.id) : '');
  if (!telegramId) {
    throw new Error('В id_token нет идентификатора пользователя');
  }

  const { firstName, lastName } = parseName(payload.name);
  return {
    telegramId,
    username: payload.preferred_username ? String(payload.preferred_username) : null,
    firstName,
    lastName,
  };
}
