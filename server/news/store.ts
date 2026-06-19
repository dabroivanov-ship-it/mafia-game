import db, { findUserById } from '../auth/db.js';
import { MAX_NEWS_BODY_LENGTH } from '../security/constants.js';

db.exec(`
  CREATE TABLE IF NOT EXISTS news_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    cover_image TEXT,
    is_published INTEGER NOT NULL DEFAULT 1,
    author_id INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_news_published ON news_posts(is_published, created_at DESC);
`);

const newsCols = db.prepare('PRAGMA table_info(news_posts)').all() as { name: string }[];
if (!newsCols.some((c) => c.name === 'cover_image')) {
  db.exec('ALTER TABLE news_posts ADD COLUMN cover_image TEXT DEFAULT NULL');
}
if (!newsCols.some((c) => c.name === 'is_featured')) {
  db.exec('ALTER TABLE news_posts ADD COLUMN is_featured INTEGER NOT NULL DEFAULT 0');
}

interface NewsRow {
  id: number;
  title: string;
  body: string;
  cover_image: string | null;
  is_published: number;
  is_featured: number;
  author_id: number;
  created_at: string;
  updated_at: string;
}

export interface NewsPost {
  id: number;
  title: string;
  body: string;
  coverImage: string | null;
  isPublished: boolean;
  isFeatured: boolean;
  authorId: number;
  authorName?: string;
  createdAt: string;
  updatedAt: string;
}

function rowToPost(row: NewsRow): NewsPost {
  const author = findUserById(row.author_id);
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    coverImage: row.cover_image?.trim() || null,
    isPublished: !!row.is_published,
    isFeatured: !!row.is_featured,
    authorId: row.author_id,
    authorName: author?.display_name || author?.username,
    createdAt: row.created_at.includes('T') ? row.created_at : `${row.created_at.replace(' ', 'T')}Z`,
    updatedAt: row.updated_at.includes('T') ? row.updated_at : `${row.updated_at.replace(' ', 'T')}Z`,
  };
}

export function listPublishedNews(limit = 50): NewsPost[] {
  const rows = db
    .prepare(
      `SELECT * FROM news_posts WHERE is_published = 1 ORDER BY is_featured DESC, created_at DESC LIMIT ?`
    )
    .all(limit) as NewsRow[];
  return rows.map(rowToPost);
}

export function listAllNews(limit = 100): NewsPost[] {
  const rows = db
    .prepare(`SELECT * FROM news_posts ORDER BY created_at DESC LIMIT ?`)
    .all(limit) as NewsRow[];
  return rows.map(rowToPost);
}

export function createNews(
  authorId: number,
  data: {
    title: string;
    body: string;
    coverImage?: string | null;
    isPublished?: boolean;
    isFeatured?: boolean;
  }
): NewsPost {
  const title = String(data.title || '').trim().slice(0, 120);
  const body = String(data.body || '').trim().slice(0, MAX_NEWS_BODY_LENGTH);
  const coverImage = data.coverImage?.trim() || null;
  if (!title || !body) throw new Error('Заголовок и текст обязательны');

  const result = db
    .prepare(
      `INSERT INTO news_posts (title, body, cover_image, is_published, is_featured, author_id) VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      title,
      body,
      coverImage,
      data.isPublished === false ? 0 : 1,
      data.isFeatured ? 1 : 0,
      authorId
    );

  const row = db
    .prepare('SELECT * FROM news_posts WHERE id = ?')
    .get(Number(result.lastInsertRowid)) as NewsRow;
  return rowToPost(row);
}

export function updateNews(
  id: number,
  data: {
    title?: string;
    body?: string;
    coverImage?: string | null;
    isPublished?: boolean;
    isFeatured?: boolean;
  }
): NewsPost | null {
  const existing = db.prepare('SELECT * FROM news_posts WHERE id = ?').get(id) as NewsRow | undefined;
  if (!existing) return null;

  const title = data.title != null ? String(data.title).trim().slice(0, 120) : existing.title;
  const body =
    data.body != null ? String(data.body).trim().slice(0, MAX_NEWS_BODY_LENGTH) : existing.body;
  const coverImage =
    data.coverImage !== undefined
      ? data.coverImage?.trim() || null
      : existing.cover_image?.trim() || null;
  const isPublished =
    data.isPublished != null ? (data.isPublished ? 1 : 0) : existing.is_published;
  const isFeatured =
    data.isFeatured != null ? (data.isFeatured ? 1 : 0) : existing.is_featured ?? 0;

  db.prepare(
    `UPDATE news_posts SET title = ?, body = ?, cover_image = ?, is_published = ?, is_featured = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(title, body, coverImage, isPublished, isFeatured, id);

  const row = db.prepare('SELECT * FROM news_posts WHERE id = ?').get(id) as NewsRow;
  return rowToPost(row);
}

export function deleteNews(id: number): boolean {
  const result = db.prepare('DELETE FROM news_posts WHERE id = ?').run(id);
  return Number(result.changes) > 0;
}
