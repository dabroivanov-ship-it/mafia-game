import fs from 'fs';
import type { RoleId, NightAction } from '../types/index.js';
import { MAX_CHAT_MESSAGE_LENGTH, MAX_MODERATION_REASON_LENGTH, VIOLATION_TYPES, type ViolationTypeId } from './constants.js';

export function normalizeChatText(text: unknown): string | null {
  const trimmed = String(text ?? '').trim();
  if (!trimmed) return null;
  if (trimmed.length > MAX_CHAT_MESSAGE_LENGTH) {
    return trimmed.slice(0, MAX_CHAT_MESSAGE_LENGTH);
  }
  return trimmed;
}

export function normalizeModerationReason(reason: unknown): string {
  return String(reason ?? '')
    .trim()
    .slice(0, MAX_MODERATION_REASON_LENGTH);
}

export function parseViolationType(value: unknown): ViolationTypeId | null {
  const v = String(value ?? '').trim().toLowerCase();
  return (VIOLATION_TYPES as readonly string[]).includes(v) ? (v as ViolationTypeId) : null;
}

export function isValidWebAppUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

const IMAGE_SIGNATURES: { mime: string; check: (buf: Buffer) => boolean }[] = [
  { mime: 'image/jpeg', check: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: 'image/png', check: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  {
    mime: 'image/gif',
    check: (b) =>
      b.slice(0, 3).toString('ascii') === 'GIF' &&
      (b.slice(3, 6).toString('ascii') === '87a' || b.slice(3, 6).toString('ascii') === '89a'),
  },
  {
    mime: 'image/webp',
    check: (b) =>
      b.length >= 12 &&
      b.slice(0, 4).toString('ascii') === 'RIFF' &&
      b.slice(8, 12).toString('ascii') === 'WEBP',
  },
];

export function validateImageFile(filePath: string, mimetype: string): boolean {
  let buf: Buffer;
  try {
    buf = fs.readFileSync(filePath).subarray(0, 13);
  } catch {
    return false;
  }
  const sig = IMAGE_SIGNATURES.find((s) => s.mime === mimetype);
  if (!sig) return false;
  return sig.check(buf);
}

export function isValidNightActionForRole(
  role: RoleId,
  action: NightAction,
  opts: { clownUsed: boolean; wifeRevengeAvailable: boolean; wifeRevengeUsed: boolean }
): boolean {
  switch (role) {
    case 'mafia':
      return action.type === 'kill' && Number.isFinite(action.targetId);
    case 'commissar':
      return (action.type === 'check' || action.type === 'kill') && Number.isFinite(action.targetId);
    case 'doctor':
      return action.type === 'heal' && Number.isFinite(action.targetId);
    case 'prostitute':
      return action.type === 'seduce' && Number.isFinite(action.targetId);
    case 'homeless':
      return action.type === 'check' && Number.isFinite(action.targetId);
    case 'maniac':
      return action.type === 'kill' && Number.isFinite(action.targetId);
    case 'clown':
      return (
        !opts.clownUsed &&
        action.type === 'swap' &&
        Number.isFinite(action.targetId) &&
        Number.isFinite(action.targetId2) &&
        action.targetId !== action.targetId2
      );
    case 'commissar_wife':
      return (
        opts.wifeRevengeAvailable &&
        !opts.wifeRevengeUsed &&
        action.type === 'revenge' &&
        Number.isFinite(action.targetId)
      );
    default:
      return false;
  }
}
