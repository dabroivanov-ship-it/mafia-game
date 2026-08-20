import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import type { Request } from 'express';
import {
  createUser,
  fillEmptyProfileFields,
  findUserByEmail,
  findUserByUsername,
  findUserByVkId,
  isAdminReservedUsername,
  isUserBanned,
} from './db.js';
import { sendWelcomeLetter } from '../messages/welcome.js';
import { getSiteOrigin } from './telegramOidc.js';
import { createOauthLoginTicket } from './oauthTicket.js';
import type { User, UserGender } from '../types/index.js';

const VK_AUTHORIZE_URL = 'https://id.vk.ru/authorize';
const VK_TOKEN_URL = 'https://id.vk.ru/oauth2/auth';
const VK_USER_INFO_URL = 'https://id.vk.ru/oauth2/user_info';
const VK_STATE_TTL_MS = 10 * 60 * 1000;
const VK_SETUP_TTL_MS = 15 * 60 * 1000;

interface PendingVkState {
  codeVerifier: string;
  remember: boolean;
  createdAt: number;
}

export interface PendingVkSignup {
  vkId: string;
  displayName: string;
  gender: UserGender;
  suggestedUsername: string;
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

export type VkAuthResult =
  | { status: 'ok'; user: User; remember: boolean }
  | {
      status: 'need_username';
      setupToken: string;
      suggestedUsername: string;
      displayName: string;
      takenUsername: string;
      remember: boolean;
    };

const pendingStates = new Map<string, PendingVkState>();
const pendingSignups = new Map<string, PendingVkSignup>();

const CYR_TO_LAT: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'e',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'y',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'h',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'sch',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
};

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
  for (const [token, entry] of pendingSignups.entries()) {
    if (now - entry.createdAt > VK_SETUP_TTL_MS) pendingSignups.delete(token);
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

function genderFromVkSex(sex: unknown): UserGender {
  if (sex === 2 || sex === '2' || sex === 'male') return 'male';
  if (sex === 1 || sex === '1' || sex === 'female') return 'female';
  return '';
}

function displayNameFromVk(firstName: string, lastName: string, vkId: string): string {
  const first = firstName.trim();
  if (first) return first.slice(0, 30);
  const full = `${firstName} ${lastName}`.trim();
  if (full) return full.slice(0, 30);
  return `Игрок ${vkId.slice(-4)}`.slice(0, 30);
}

function transliterate(text: string): string {
  let out = '';
  for (const ch of text.toLowerCase()) {
    if (CYR_TO_LAT[ch] !== undefined) out += CYR_TO_LAT[ch];
    else out += ch;
  }
  return out;
}

/** Build a login-safe username candidate from VK name. */
export function buildVkUsernameCandidate(firstName?: string, lastName?: string, vkId?: string): string {
  const fallback = (vkId || 'user').slice(-8);
  const raw = transliterate(`${firstName || ''}${lastName || ''}`).replace(/[^a-z0-9_]/g, '');
  let base = raw.slice(0, 20);
  if (base.length < 3) {
    const fromFirst = transliterate(firstName || '')
      .replace(/[^a-z0-9_]/g, '')
      .slice(0, 20);
    base = fromFirst.length >= 3 ? fromFirst : `vk${fallback}`;
  }
  if (isAdminReservedUsername(base)) {
    base = `vk${fallback}`.slice(0, 20);
  }
  return base.slice(0, 20);
}

function isUsernameAvailable(username: string): boolean {
  if (username.length < 3 || username.length > 20) return false;
  if (!/^[a-zA-Z0-9_]+$/.test(username)) return false;
  if (isAdminReservedUsername(username)) return false;
  return !findUserByUsername(username);
}

function allocateEmail(vkId: string): string {
  const baseEmail = `vk_${vkId}@vk.local`;
  let email = baseEmail;
  let e = 1;
  while (findUserByEmail(email)) {
    email = `vk_${vkId}_${e}@vk.local`;
    e += 1;
  }
  return email;
}

export async function createVkUserWithUsername(input: {
  vkId: string;
  username: string;
  displayName: string;
  gender?: UserGender;
}): Promise<User | undefined> {
  const vkId = String(input.vkId);
  if (findUserByVkId(vkId)) {
    throw new Error('Аккаунт VK уже зарегистрирован');
  }
  const username = input.username.trim();
  if (!isUsernameAvailable(username)) {
    throw new Error('Этот логин уже занят или недопустим');
  }
  const displayName = (input.displayName.trim() || username).slice(0, 30);
  const passwordHash = await bcrypt.hash(crypto.randomUUID(), 10);
  const user = createUser({
    username,
    email: allocateEmail(vkId),
    passwordHash,
    displayName,
    gender: input.gender,
    vkId,
    vkUsername: `id${vkId}`.slice(0, 32),
  });
  if (user) sendWelcomeLetter(user);
  return user;
}

function createSetupToken(signup: Omit<PendingVkSignup, 'createdAt'>): string {
  purgeExpiredStates();
  const token = crypto.randomBytes(24).toString('base64url');
  pendingSignups.set(token, { ...signup, createdAt: Date.now() });
  return token;
}

export function getPendingVkSignup(setupToken: string): PendingVkSignup | null {
  purgeExpiredStates();
  const pending = pendingSignups.get(setupToken);
  if (!pending) return null;
  if (Date.now() - pending.createdAt > VK_SETUP_TTL_MS) {
    pendingSignups.delete(setupToken);
    return null;
  }
  return pending;
}

export async function completeVkUsernameSetup(
  setupToken: string,
  usernameRaw: string
): Promise<{ user: User; remember: boolean }> {
  const pending = getPendingVkSignup(setupToken);
  if (!pending) {
    throw new Error('Сессия регистрации через VK истекла, войдите снова');
  }

  const existing = findUserByVkId(pending.vkId);
  if (existing) {
    pendingSignups.delete(setupToken);
    if (isUserBanned(existing)) {
      throw new Error(`Аккаунт заблокирован: ${existing.ban_reason || ''}`);
    }
    const updated =
      fillEmptyProfileFields(existing.id, {
        displayName: pending.displayName,
        gender: pending.gender,
      }) || existing;
    return { user: updated, remember: pending.remember };
  }

  const username = usernameRaw.trim();
  if (username.length < 3 || username.length > 20) {
    throw new Error('Логин: от 3 до 20 символов');
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    throw new Error('Логин: только латинские буквы, цифры и _');
  }
  if (isAdminReservedUsername(username)) {
    throw new Error('Этот логин зарезервирован');
  }
  if (findUserByUsername(username)) {
    throw new Error('Этот логин уже занят');
  }

  const user = await createVkUserWithUsername({
    vkId: pending.vkId,
    username,
    displayName: pending.displayName,
    gender: pending.gender,
  });
  if (!user) {
    throw new Error('Ошибка регистрации через VK');
  }
  pendingSignups.delete(setupToken);
  return { user, remember: pending.remember };
}

export async function completeVkAuthorization(req: Request): Promise<VkAuthResult> {
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

  let firstName = '';
  let lastName = '';
  let gender: UserGender = '';
  try {
    const info = await fetchVkUserInfo(accessToken);
    firstName = info.first_name?.trim() || '';
    lastName = info.last_name?.trim() || '';
    gender = genderFromVkSex(info.sex);
    if (info.user_id != null && String(info.user_id) !== userId) {
      throw new Error('Идентификатор пользователя VK не совпадает');
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes('не совпадает')) throw err;
    console.warn('VK user_info failed, using token user_id only:', err);
  }

  const displayName = displayNameFromVk(firstName, lastName, userId);

  const existing = findUserByVkId(userId);
  if (existing) {
    if (isUserBanned(existing)) {
      throw new Error(`Аккаунт заблокирован: ${existing.ban_reason || ''}`);
    }
    const updated =
      fillEmptyProfileFields(existing.id, { displayName, gender }) || existing;
    return { status: 'ok', user: updated, remember: pending.remember };
  }

  const suggestedUsername = buildVkUsernameCandidate(firstName, lastName, userId);

  if (isUsernameAvailable(suggestedUsername)) {
    const user = await createVkUserWithUsername({
      vkId: userId,
      username: suggestedUsername,
      displayName,
      gender,
    });
    if (!user) {
      throw new Error('Ошибка регистрации через VK');
    }
    return { status: 'ok', user, remember: pending.remember };
  }

  const setupToken = createSetupToken({
    vkId: userId,
    displayName,
    gender,
    suggestedUsername,
    remember: pending.remember,
  });

  return {
    status: 'need_username',
    setupToken,
    suggestedUsername,
    displayName: displayName.slice(0, 30),
    takenUsername: suggestedUsername,
    remember: pending.remember,
  };
}

export function buildVkSuccessRedirect(token: string, req?: Request): string {
  const origin = getSiteOrigin(req);
  const ticket = createOauthLoginTicket(token);
  return `${origin}/#vk_login=${encodeURIComponent(ticket)}`;
}

export function buildVkUsernameRedirect(
  setup: {
    setupToken: string;
    suggestedUsername: string;
    displayName: string;
    takenUsername: string;
  },
  req?: Request
): string {
  const origin = getSiteOrigin(req);
  const url = new URL(origin);
  url.searchParams.set('vk_setup', setup.setupToken);
  url.searchParams.set('vk_suggested', setup.suggestedUsername);
  url.searchParams.set('vk_display', setup.displayName);
  url.searchParams.set('vk_taken', setup.takenUsername);
  return url.toString();
}

export function buildVkErrorRedirect(message: string, req?: Request): string {
  const origin = getSiteOrigin(req);
  return `${origin}/?vk_error=${encodeURIComponent(message)}`;
}
