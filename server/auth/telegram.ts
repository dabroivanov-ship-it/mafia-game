import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import {
  findUserByUsername,
  findUserByEmail,
  findUserByTelegramId,
  createUser,
} from './db.js';
import type { User } from '../types/index.js';

export interface TelegramAuthPayload {
  id: number | string;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number | string;
  hash: string;
}

export interface TelegramWebAppUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
}

export function verifyTelegramWidgetAuth(payload: TelegramAuthPayload, botToken: string): boolean {
  const data: Record<string, string> = {};
  for (const [k, v] of Object.entries(payload)) {
    if (k === 'hash') continue;
    if (v == null) continue;
    data[k] = String(v);
  }
  const checkString = Object.keys(data)
    .sort()
    .map((k) => `${k}=${data[k]}`)
    .join('\n');
  const secret = crypto.createHash('sha256').update(botToken).digest();
  const digest = crypto.createHmac('sha256', secret).update(checkString).digest('hex');
  return digest === payload.hash;
}

export function verifyTelegramWebAppInitData(initData: string, botToken: string): boolean {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return false;

  const pairs: string[] = [];
  for (const [key, value] of params.entries()) {
    if (key === 'hash') continue;
    pairs.push(`${key}=${value}`);
  }
  pairs.sort();
  const dataCheckString = pairs.join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const calculatedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');
  return calculatedHash === hash;
}

export function parseTelegramWebAppUser(initData: string): TelegramWebAppUser | null {
  const params = new URLSearchParams(initData);
  const rawUser = params.get('user');
  if (!rawUser) return null;
  try {
    const user = JSON.parse(rawUser) as TelegramWebAppUser;
    if (!user?.id) return null;
    return user;
  } catch {
    return null;
  }
}

export function getTelegramAuthDate(initData: string): number | null {
  const params = new URLSearchParams(initData);
  const authDate = Number(params.get('auth_date'));
  if (!Number.isFinite(authDate)) return null;
  return authDate * 1000;
}

function safeTelegramUsername(input: string | undefined, fallback: string): string {
  const base = (input || fallback).toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20);
  return base.length >= 3 ? base : `tg_${fallback}`.slice(0, 20);
}

export async function getOrCreateUserFromTelegram(input: {
  telegramId: string;
  username?: string | null;
  firstName?: string;
  lastName?: string;
}): Promise<User | undefined> {
  const telegramId = String(input.telegramId);
  let user = findUserByTelegramId(telegramId);

  if (!user) {
    const fallback = telegramId.slice(-8);
    const baseUsername = safeTelegramUsername(input.username || undefined, `tg${fallback}`);
    let username = baseUsername;
    let i = 1;
    while (findUserByUsername(username)) {
      username = `${baseUsername.slice(0, Math.max(3, 20 - String(i).length))}${i}`;
      i += 1;
    }

    const baseEmail = `tg_${telegramId}@telegram.local`;
    let email = baseEmail;
    let e = 1;
    while (findUserByEmail(email)) {
      email = `tg_${telegramId}_${e}@telegram.local`;
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
      telegramId,
      telegramUsername: input.username ? String(input.username).slice(0, 32) : null,
    });
  }

  return user;
}
