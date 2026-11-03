import type { Request } from 'express';

/** Login/session mutations use headers, never credentials in a URL. */
export function bearerToken(req: Pick<Request, 'headers'>): string | undefined {
  return req.headers.authorization?.trim().match(/^Bearer\s+(\S+)$/i)?.[1];
}

/** Query tokens remain supported only for direct GET/HEAD media links. */
export function requestToken(req: Pick<Request, 'headers' | 'method' | 'query'>): string | undefined {
  const header = bearerToken(req);
  if (header) return header;
  if (req.method !== 'GET' && req.method !== 'HEAD') return undefined;
  return typeof req.query.token === 'string' ? req.query.token : undefined;
}
