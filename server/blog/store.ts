import db, { findUserById } from '../auth/db.js';
import { MAX_NEWS_BODY_LENGTH } from '../security/constants.js';

db.exec(`
  CREATE TABLE IF NOT EXISTS blog_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    cover_image TEXT,
    is_published INTEGER NOT NULL DEFAULT 1,
    author_id INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_blog_published ON blog_posts(is_published, created_at DESC);
`);

interface BlogRow {
  id: number;
  title: string;
  body: string;
  cover_image: string | null;
  is_published: number;
  author_id: number;
  created_at: string;
  updated_at: string;
}

export interface BlogPost {
  id: number;
  title: string;
  body: string;
  coverImage: string | null;
  isPublished: boolean;
  authorId: number;
  authorName?: string;
  createdAt: string;
  updatedAt: string;
}

function rowToPost(row: BlogRow): BlogPost {
  const author = findUserById(row.author_id);
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    coverImage: row.cover_image?.trim() || null,
    isPublished: !!row.is_published,
    authorId: row.author_id,
    authorName: author?.display_name || author?.username,
    createdAt: row.created_at.includes('T') ? row.created_at : `${row.created_at.replace(' ', 'T')}Z`,
    updatedAt: row.updated_at.includes('T') ? row.updated_at : `${row.updated_at.replace(' ', 'T')}Z`,
  };
}

export function listPublishedBlog(limit = 30): BlogPost[] {
  const rows = db
    .prepare(
      `SELECT * FROM blog_posts WHERE is_published = 1 ORDER BY created_at DESC LIMIT ?`
    )
    .all(limit) as BlogRow[];
  return rows.map(rowToPost);
}

export function listAllBlog(limit = 100): BlogPost[] {
  const rows = db
    .prepare(`SELECT * FROM blog_posts ORDER BY created_at DESC LIMIT ?`)
    .all(limit) as BlogRow[];
  return rows.map(rowToPost);
}

export function findBlogById(id: number): BlogPost | null {
  const row = db.prepare('SELECT * FROM blog_posts WHERE id = ?').get(id) as BlogRow | undefined;
  return row ? rowToPost(row) : null;
}

export function createBlogPost(
  authorId: number,
  data: {
    title: string;
    body: string;
    coverImage?: string | null;
    isPublished?: boolean;
  }
): BlogPost {
  const title = String(data.title || '').trim().slice(0, 120);
  const body = String(data.body || '').trim().slice(0, MAX_NEWS_BODY_LENGTH);
  const coverImage = data.coverImage?.trim() || null;
  if (!title || !body) throw new Error('Заголовок и текст обязательны');

  const result = db
    .prepare(
      `INSERT INTO blog_posts (title, body, cover_image, is_published, author_id)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(title, body, coverImage, data.isPublished === false ? 0 : 1, authorId);

  const row = db
    .prepare('SELECT * FROM blog_posts WHERE id = ?')
    .get(Number(result.lastInsertRowid)) as BlogRow;
  return rowToPost(row);
}

export function updateBlogPost(
  id: number,
  data: {
    title?: string;
    body?: string;
    coverImage?: string | null;
    isPublished?: boolean;
  }
): BlogPost | null {
  const existing = db.prepare('SELECT * FROM blog_posts WHERE id = ?').get(id) as BlogRow | undefined;
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

  if (!title || !body) throw new Error('Заголовок и текст обязательны');

  db.prepare(
    `UPDATE blog_posts
     SET title = ?, body = ?, cover_image = ?, is_published = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(title, body, coverImage, isPublished, id);

  return findBlogById(id);
}

export function deleteBlogPost(id: number): boolean {
  const result = db.prepare('DELETE FROM blog_posts WHERE id = ?').run(id);
  return result.changes > 0;
}

export function countPublishedBlog(): number {
  return (db.prepare('SELECT COUNT(*) AS c FROM blog_posts WHERE is_published = 1').get() as { c: number })
    .c;
}
