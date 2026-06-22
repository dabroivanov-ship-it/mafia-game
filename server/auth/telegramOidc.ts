import crypto from 'crypto';
import jwt from 'jsonwebtoken';

const JWKS_URL = 'https://oauth.telegram.org/.well-known/jwks.json';
const ISSUER = 'https://oauth.telegram.org';
const JWKS_TTL_MS = 60 * 60 * 1000;

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

let jwksCache: { keys: JwkKey[]; fetchedAt: number } | null = null;

function getOidcClientId(): string {
  return process.env.TELEGRAM_OIDC_CLIENT_ID?.trim() || '';
}

export function isTelegramOidcConfigured(): boolean {
  return !!(getOidcClientId() && process.env.TELEGRAM_OIDC_CLIENT_SECRET?.trim());
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
