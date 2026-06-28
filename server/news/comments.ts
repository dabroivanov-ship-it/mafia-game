import db, { findUserById } from '../auth/db.js';
import { MAX_NEWS_COMMENT_LENGTH } from '../security/constants.js';

db.exec(`
  CREATE TABLE IF NOT EXISTS news_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    news_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (news_id) REFERENCES news_posts(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_news_comments_news ON news_comments(news_id, created_at ASC);
`);

const commentCols = db.prepare('PRAGMA table_info(news_comments)').all() as { name: string }[];
if (!commentCols.some((c) => c.name === 'parent_id')) {
  db.exec('ALTER TABLE news_comments ADD COLUMN parent_id INTEGER DEFAULT NULL');
}
db.exec('CREATE INDEX IF NOT EXISTS idx_news_comments_parent ON news_comments(parent_id)');

interface CommentRow {
  id: number;
  news_id: number;
  user_id: number;
  body: string;
  parent_id: number | null;
  created_at: string;
}

export interface NewsComment {
  id: number;
  newsId: number;
  userId: number;
  body: string;
  parentId: number | null;
  replyToUserId: number | null;
  replyToAuthorName: string | null;
  replyToAuthorUsername: string | null;
  createdAt: string;
  authorName: string;
  authorUsername: string;
  authorAvatar: string | null;
}

function formatDate(value: string): string {
  return value.includes('T') ? value : `${value.replace(' ', 'T')}Z`;
}

function rowToComment(row: CommentRow): NewsComment {
  const author = findUserById(row.user_id);
  let replyToUserId: number | null = null;
  let replyToAuthorName: string | null = null;
  let replyToAuthorUsername: string | null = null;

  if (row.parent_id) {
    const parent = db
      .prepare('SELECT user_id FROM news_comments WHERE id = ?')
      .get(row.parent_id) as { user_id: number } | undefined;
    if (parent) {
      const parentAuthor = findUserById(parent.user_id);
      replyToUserId = parent.user_id;
      replyToAuthorName = parentAuthor?.display_name || parentAuthor?.username || 'Игрок';
      replyToAuthorUsername = parentAuthor?.username || '';
    }
  }

  return {
    id: row.id,
    newsId: row.news_id,
    userId: row.user_id,
    body: row.body,
    parentId: row.parent_id ?? null,
    replyToUserId,
    replyToAuthorName,
    replyToAuthorUsername,
    createdAt: formatDate(row.created_at),
    authorName: author?.display_name || author?.username || 'Игрок',
    authorUsername: author?.username || '',
    authorAvatar: author?.avatar || null,
  };
}

export function countNewsComments(newsId: number): number {
  const row = db
    .prepare('SELECT COUNT(*) AS count FROM news_comments WHERE news_id = ?')
    .get(newsId) as { count: number };
  return row?.count ?? 0;
}

export function listNewsComments(newsId: number, limit = 200): NewsComment[] {
  const rows = db
    .prepare(
      `SELECT * FROM news_comments WHERE news_id = ? ORDER BY created_at ASC LIMIT ?`
    )
    .all(newsId, limit) as CommentRow[];
  return rows.map(rowToComment);
}

export function addNewsComment(
  newsId: number,
  userId: number,
  body: string,
  parentId?: number | null
): NewsComment {
  const text = String(body || '').trim().slice(0, MAX_NEWS_COMMENT_LENGTH);
  if (!text) throw new Error('Комментарий не может быть пустым');

  const post = db.prepare('SELECT id FROM news_posts WHERE id = ? AND is_published = 1').get(newsId);
  if (!post) throw new Error('Новость не найдена');

  let safeParentId: number | null = null;
  if (parentId != null) {
    const parent = db
      .prepare('SELECT id FROM news_comments WHERE id = ? AND news_id = ?')
      .get(parentId, newsId) as { id: number } | undefined;
    if (!parent) throw new Error('Комментарий для ответа не найден');
    safeParentId = parent.id;
  }

  const result = db
    .prepare('INSERT INTO news_comments (news_id, user_id, body, parent_id) VALUES (?, ?, ?, ?)')
    .run(newsId, userId, text, safeParentId);

  const row = db
    .prepare('SELECT * FROM news_comments WHERE id = ?')
    .get(Number(result.lastInsertRowid)) as CommentRow;
  return rowToComment(row);
}

function collectDescendantCommentIds(rootId: number): number[] {
  const ids = [rootId];
  const queue = [rootId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    const children = db
      .prepare('SELECT id FROM news_comments WHERE parent_id = ?')
      .all(id) as { id: number }[];
    for (const child of children) {
      ids.push(child.id);
      queue.push(child.id);
    }
  }
  return ids;
}

export function deleteNewsComment(commentId: number, userId: number, isStaff: boolean): boolean {
  const row = db.prepare('SELECT * FROM news_comments WHERE id = ?').get(commentId) as
    | CommentRow
    | undefined;
  if (!row) return false;
  if (!isStaff && row.user_id !== userId) return false;

  const ids = collectDescendantCommentIds(commentId);
  const placeholders = ids.map(() => '?').join(', ');
  const result = db.prepare(`DELETE FROM news_comments WHERE id IN (${placeholders})`).run(...ids);
  return Number(result.changes) > 0;
}
