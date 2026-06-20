import type { NextFunction, Request, Response } from 'express';

interface Hit {
  count: number;
  resetAt: number;
}

export class RateLimiter {
  private readonly hits = new Map<string, Hit>();

  constructor(
    private readonly max: number,
    private readonly windowMs: number
  ) {}

  try(key: string): boolean {
    const now = Date.now();
    let entry = this.hits.get(key);
    if (!entry || now >= entry.resetAt) {
      entry = { count: 0, resetAt: now + this.windowMs };
      this.hits.set(key, entry);
    }
    entry.count += 1;
    if (entry.count > this.max) return false;
    return true;
  }
}

function clientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'unknown';
}

export function createRateLimitMiddleware(limiter: RateLimiter, keyFn?: (req: Request) => string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const key = keyFn ? keyFn(req) : clientIp(req);
    if (!limiter.try(key)) {
      res.status(429).json({ error: 'Слишком много запросов. Попробуйте позже.' });
      return;
    }
    next();
  };
}

export const authRateLimiter = new RateLimiter(20, 15 * 60 * 1000);
export const pmRateLimiter = new RateLimiter(30, 60 * 1000);
export const supportRateLimiter = new RateLimiter(5, 60 * 60 * 1000);
export const searchRateLimiter = new RateLimiter(40, 60 * 1000);
export const chatSocketRateLimiter = new RateLimiter(25, 10 * 1000);
