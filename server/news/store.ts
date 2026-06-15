import db, { findUserById } from '../auth/db.js';

db.exec(`
  CREATE TABLE IF NOT EXISTS news_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    is_published INTEGER NOT NULL DEFAULT 1,
    author_id INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_news_published ON news_posts(is_published, created_at DESC);
`);

interface NewsRow {
  id: number;
  title: string;
  body: string;
  is_published: number;
  author_id: number;
  created_at: string;
  updated_at: string;
}

export interface NewsPost {
  id: number;
  title: string;
  body: string;
  isPublished: boolean;
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
    isPublished: !!row.is_published,
    authorId: row.author_id,
    authorName: author?.display_name || author?.username,
    createdAt: row.created_at.includes('T') ? row.created_at : `${row.created_at.replace(' ', 'T')}Z`,
    updatedAt: row.updated_at.includes('T') ? row.updated_at : `${row.updated_at.replace(' ', 'T')}Z`,
  };
}

export function listPublishedNews(limit = 50): NewsPost[] {
  const rows = db
    .prepare(
      `SELECT * FROM news_posts WHERE is_published = 1 ORDER BY created_at DESC LIMIT ?`
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
  data: { title: string; body: string; isPublished?: boolean }
): NewsPost {
  const title = String(data.title || '').trim().slice(0, 120);
  const body = String(data.body || '').trim().slice(0, 5000);
  if (!title || !body) throw new Error('Заголовок и текст обязательны');

  const result = db
    .prepare(
      `INSERT INTO news_posts (title, body, is_published, author_id) VALUES (?, ?, ?, ?)`
    )
    .run(title, body, data.isPublished === false ? 0 : 1, authorId);

  const row = db
    .prepare('SELECT * FROM news_posts WHERE id = ?')
    .get(Number(result.lastInsertRowid)) as NewsRow;
  return rowToPost(row);
}

export function updateNews(
  id: number,
  data: { title?: string; body?: string; isPublished?: boolean }
): NewsPost | null {
  const existing = db.prepare('SELECT * FROM news_posts WHERE id = ?').get(id) as NewsRow | undefined;
  if (!existing) return null;

  const title = data.title != null ? String(data.title).trim().slice(0, 120) : existing.title;
  const body = data.body != null ? String(data.body).trim().slice(0, 5000) : existing.body;
  const isPublished =
    data.isPublished != null ? (data.isPublished ? 1 : 0) : existing.is_published;

  db.prepare(
    `UPDATE news_posts SET title = ?, body = ?, is_published = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(title, body, isPublished, id);

  const row = db.prepare('SELECT * FROM news_posts WHERE id = ?').get(id) as NewsRow;
  return rowToPost(row);
}

export function deleteNews(id: number): boolean {
  const result = db.prepare('DELETE FROM news_posts WHERE id = ?').run(id);
  return Number(result.changes) > 0;
}
