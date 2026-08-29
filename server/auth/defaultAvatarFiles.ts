import fs from 'fs';
import path from 'path';
import { getProjectRoot, getServerRoot } from '../paths.js';

const ALLOWED_DEFAULT_AVATARS = new Set([
  'default-male.png',
  'default-female.png',
  'default-male.svg',
  'default-female.svg',
]);

export function resolveDefaultAvatarFile(filename: string): string | null {
  const base = path.basename(filename);
  if (!ALLOWED_DEFAULT_AVATARS.has(base)) return null;

  const projectRoot = getProjectRoot();
  const serverRoot = getServerRoot();
  const candidates = [
    path.join(projectRoot, 'client', 'public', 'avatars', base),
    path.join(projectRoot, 'client', 'dist', 'avatars', base),
    path.join(serverRoot, '..', 'client', 'public', 'avatars', base),
    path.join(serverRoot, '..', 'client', 'dist', 'avatars', base),
  ];

  return candidates.find((filePath) => fs.existsSync(filePath)) ?? null;
}
