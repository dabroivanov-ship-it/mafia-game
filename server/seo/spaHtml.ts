import fs from 'fs';
import path from 'path';
import type { Request, Response } from 'express';
import {
  SITE_DEFAULT_DESCRIPTION,
  SITE_NAME,
  applySpaHtmlMeta,
  classifySpaPath,
  getPublicPageMeta,
  getPublicSiteOrigin,
  normalizePath,
  type PublicPageMeta,
} from './siteSeo.js';

let cachedIndex: { file: string; mtime: number; html: string } | null = null;

function readClientIndexHtml(clientDist: string): string {
  const file = path.join(clientDist, 'index.html');
  const mtime = fs.statSync(file).mtimeMs;
  if (cachedIndex && cachedIndex.file === file && cachedIndex.mtime === mtime) {
    return cachedIndex.html;
  }
  const html = fs.readFileSync(file, 'utf8');
  cachedIndex = { file, mtime, html };
  return html;
}

function metaForRequest(pathname: string): PublicPageMeta {
  const kind = classifySpaPath(pathname);
  const known = getPublicPageMeta(pathname);
  if (known) {
    return kind === 'indexed' ? known : { ...known, noindex: true };
  }
  return {
    title: SITE_NAME,
    description: SITE_DEFAULT_DESCRIPTION,
    path: normalizePath(pathname),
    noindex: true,
  };
}

export function sendSpaIndex(req: Request, res: Response, clientDist: string): void {
  const indexFile = path.join(clientDist, 'index.html');
  if (!fs.existsSync(indexFile)) {
    res.status(404).send('Клиент не собран. Выполните: cd client && npm install && npm run build');
    return;
  }

  const kind = classifySpaPath(req.path);
  const html = applySpaHtmlMeta(readClientIndexHtml(clientDist), metaForRequest(req.path), getPublicSiteOrigin());
  if (kind === 'unknown') res.status(404);
  res.setHeader('Cache-Control', 'no-cache');
  res.type('html').send(html);
}
