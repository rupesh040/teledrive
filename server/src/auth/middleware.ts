import type { Request, Response, NextFunction } from 'express';
import { isValidToken } from './tokens.js';
import { requestToken } from './requestToken.js';

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!isValidToken(requestToken(req))) {
    res.set('Cache-Control', 'no-store');
    res.status(401).json({ error: 'Your session has expired. Please sign in again.', code: 'SESSION_EXPIRED' });
    return;
  }
  next();
}
