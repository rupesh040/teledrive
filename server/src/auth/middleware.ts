import type { Request, Response, NextFunction } from 'express';
import { isValidToken } from './tokens.js';

// Require a valid token via the `Authorization: Bearer <token>` header or
// the `?token=` query (for GET media used directly in <img>/<a>).
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization ?? '';
  const fromHeader = header.startsWith('Bearer ') ? header.slice(7) : '';
  const fromQuery = typeof req.query.token === 'string' ? req.query.token : '';
  if (!isValidToken(fromHeader || fromQuery)) {
    res.status(401).json({ error: 'Session locked. Enter your PIN.' });
    return;
  }
  next();
}
