import type { User } from './index.js';

declare global {
  namespace Express {
    interface Request {
      userId?: number;
      user?: User;
    }
  }
}

export {};
