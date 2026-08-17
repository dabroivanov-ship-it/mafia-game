import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import type { Request } from 'express';
import {
  createUser,
  findUserByEmail,
  findUserByUsername,
  findUserByVkId,
  isUserBanned,
} from './db.js';
import { getSiteOrigin } from './telegramOidc.js';
import type { User } from '../types/index.js';

const VK_AUTHORIZE_URL = 'https://id.vk.ru/authorize';
const VK_TOKEN_URL = 'https://id.vk.ru/oauth2/auth';
const VK_USER_INFO_URL = 'https://id.vk.ru/oauth2/user_info';
const VK_STATE_TTL_MS = 10 * 60 * 1000;

interface PendingVkState {
  codeVerifier: string;
  remember: boolean;
  createdAt: number;
}

interface VkUserInfo {
  user_id?: string | number;
  first_name?: string;
  last_name?: string;
  avatar?: string;
  email?: string;
  sex?: number;
}

const pendingStates = new Map<string, PendingVkState>();

function getVkClientId(): string {
  return process.env.VK_CLIENT_ID?.trim() || '';
}

function getVkClientSecret(): string {
  return process.env.VK_CLIENT_SECRET?.trim() || '';
}

export function getVkRedirectUri(req?: Request): string {
  const configured = process.env.VK_REDIRECT_URI?.trim();
  if (configured) return configured.replace(/\/$/, '');
  return `${getSiteOrigin(req)}/api/auth/vk/callback`;
}

export function isVkAuthConfigured(): boolean {
  return !!(getVkClientId() && getVkClientSecret());
}

function purgeExpiredStates(): void {
  const now = Date.now();
  for (const [state, entry] of pendingStates.entries()) {
    if (now - entry.createdAt > VK_STATE_TTL_MS) pendingStates.delete(state);
  }
}

function createCodeVerifier(): string {
  return crypto.randomBytes(32).toString('base64url');
}

function createCodeChallenge(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

export function createVkAuthorizationUrl(remember: boolean, req?: Request): string {
  purgeExpiredStates();
  const clientId = getVkClientId();
  const redirectUri = getVkRedirectUri(req);
  const state = crypto.randomBytes(24).toString('base64url');
  const codeVerifier = createCodeVerifier();
  const codeChallenge = createCodeChallenge(codeVerifier);

  pendingStates.set(state, { codeVerifier, remember, createdAt: Date.now() });

  const url = new URL(VK_AUTHORIZE_URL);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('scope', 'vkid.personal_info');
  url.searchParams.set('lang_id', '0');
  return url.toString();
}

function parseCallbackParams(req: Request): {
  code: string;
  state: string;
  deviceId: string;
  error: string;
} {
  const payloadRaw = String(req.query.payload || '').trim();
  if (payloadRaw) {
    try {
      const payload = JSON.parse(payloadRaw) as {
        code?: string;
        state?: string;
        device_id?: string;
        error?: string;
        error_description?: string;
      };
      return {
        code: String(payload.code || '').trim(),
        state: String(payload.state || '').trim(),
        deviceId: String(payload.device_id || '').trim(),
        error: String(payload.error_description || payload.error || '').trim(),
      };
    } catch {
      /* fall through to query params */
    }
  }

  return {
    code: String(req.query.code || '').trim(),
    state: String(req.query.state || '').trim(),
    deviceId: String(req.query.device_id || '').trim(),
    error: String(req.query.error_description || req.query.error || '').trim(),
  };
}

async function exchangeAuthorizationCode(
  code: string,
  codeVerifier: string,
  deviceId: string,
  state: string,
  req?: Request
): Promise<{ accessToken: string; userId: string }> {
  const clientId = getVkClientId();
  const serviceToken = getVkClientSecret();
  const redirectUri = getVkRedirectUri(req);

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    code_verifier: codeVerifier,
    client_id: clientId,
    device_id: deviceId,
    redirect_uri: redirectUri,
    state,
    service_token: serviceToken,
  });

  const res = await fetch(VK_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const data = (await res.json()) as {
    access_token?: string;
    user_id?: string | number;
    error?: string;
    error_description?: string;
    error_msg?: string;
  };

  if (!res.ok || !data.access_token) {
    throw new Error(
      data.error_description || data.error_msg || data.error || 'Не удалось обменять код VK ID'
    );
  }

  const userId = data.user_id != null ? String(data.user_id) : '';
  if (!userId) {
    throw new Error('VK не вернул идентификатор пользователя');
  }

  return { accessToken: data.access_token, userId };
}

async function fetchVkUserInfo(accessToken: string): Promise<VkUserInfo> {
  const res = await fetch(VK_USER_INFO_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      access_token: accessToken,
      client_id: getVkClientId(),
    }),
  });

  const data = (await res.json()) as {
    user?: VkUserInfo;
    error?: string;
    error_description?: string;
  };

  if (!res.ok || !data.user) {
    throw new Error(data.error_description || data.error || 'Не удалось получить профиль VK');
  }

  return data.user;
}

function safeVkUsername(input: string | undefined, fallback: string): string {
  const adminNames = new Set(
    (process.env.ADMIN_USERNAMES || 'admin')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
  let base = (input || fallback).toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20);
  if (base.length < 3) base = `vk_${fallback}`.slice(0, 20);
  if (adminNames.has(base)) {
    base = `vk_${fallback}`.slice(0, 20);
  }
  return base;
}

export async function getOrCreateUserFromVk(input: {
  vkId: string;
  firstName?: string;
  lastName?: string;
  email?: string | null;
}): Promise<User | undefined> {
  const vkId = String(input.vkId);
  let user = findUserByVkId(vkId);

  if (!user) {
    const fallback = vkId.slice(-8);
    const baseUsername = safeVkUsername(undefined, `vk${fallback}`);
    let username = baseUsername;
    let i = 1;
    while (findUserByUsername(username)) {
      username = `${baseUsername.slice(0, Math.max(3, 20 - String(i).length))}${i}`;
      i += 1;
    }

    const baseEmail = `vk_${vkId}@vk.local`;
    let email = baseEmail;
    let e = 1;
    while (findUserByEmail(email)) {
      email = `vk_${vkId}_${e}@vk.local`;
      e += 1;
    }

    const displayName =
      `${input.firstName || ''} ${input.lastName || ''}`.trim() || username;
    const passwordHash = await bcrypt.hash(crypto.randomUUID(), 10);
    user = createUser({
      username,
      email,
      passwordHash,
      displayName: displayName.slice(0, 20),
      vkId,
      vkUsername: `id${vkId}`.slice(0, 32),
    });
  }

  return user;
}

export async function completeVkAuthorization(
  req: Request
): Promise<{ user: User; remember: boolean }> {
  purgeExpiredStates();
  const params = parseCallbackParams(req);
  if (params.error) {
    throw new Error(params.error);
  }
  if (!params.code || !params.state) {
    throw new Error('Некорректный ответ VK ID');
  }
  if (!params.deviceId) {
    throw new Error('VK не вернул device_id');
  }

  const pending = pendingStates.get(params.state);
  pendingStates.delete(params.state);
  if (!pending) {
    throw new Error('Сессия VK ID истекла, попробуйте снова');
  }
  if (Date.now() - pending.createdAt > VK_STATE_TTL_MS) {
    throw new Error('Сессия VK ID истекла, попробуйте снова');
  }

  const { accessToken, userId } = await exchangeAuthorizationCode(
    params.code,
    pending.codeVerifier,
    params.deviceId,
    params.state,
    req
  );

  let firstName: string | undefined;
  let lastName: string | undefined;
  let email: string | null = null;
  try {
    const info = await fetchVkUserInfo(accessToken);
    firstName = info.first_name;
    lastName = info.last_name;
    email = info.email || null;
    if (info.user_id != null && String(info.user_id) !== userId) {
      throw new Error('Идентификатор пользователя VK не совпадает');
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes('не совпадает')) throw err;
    console.warn('VK user_info failed, using token user_id only:', err);
  }

  const user = await getOrCreateUserFromVk({
    vkId: userId,
    firstName,
    lastName,
    email,
  });
  if (!user) {
    throw new Error('Ошибка регистрации через VK');
  }
  if (isUserBanned(user)) {
    throw new Error(`Аккаунт заблокирован: ${user.ban_reason || ''}`);
  }
  return { user, remember: pending.remember };
}

export function buildVkSuccessRedirect(token: string, req?: Request): string {
  const origin = getSiteOrigin(req);
  return `${origin}/?vk_token=${encodeURIComponent(token)}`;
}

export function buildVkErrorRedirect(message: string, req?: Request): string {
  const origin = getSiteOrigin(req);
  return `${origin}/?vk_error=${encodeURIComponent(message)}`;
}
