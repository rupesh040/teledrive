import type { RequestHandler } from 'express';

/** Cross-origin access is opt-in and limited to exact, configured web origins. */
export function createCors(allowedOrigins: readonly string[] = []): RequestHandler {
  const allowed = new Set(allowedOrigins.map(origin => {
    let url: URL;
    try { url = new URL(origin); }
    catch { throw new Error('ALLOWED_ORIGINS must contain complete http:// or https:// origins.'); }
    if (!['http:', 'https:'].includes(url.protocol) || url.hostname.includes('*') || url.username || url.password
      || url.pathname !== '/' || url.search || url.hash) {
      throw new Error('ALLOWED_ORIGINS accepts exact origins only, without paths, credentials, or wildcards.');
    }
    return url.origin;
  }));

  return (req, res, next) => {
    // An unset allowlist retains the existing same-origin/local-proxy behavior.
    // Browsers cannot use this API cross-origin without the headers below.
    if (!allowed.size) { next(); return; }

    res.vary('Origin');
    const origin = req.get('Origin');
    // Server-to-server clients and direct navigation do not send an Origin header.
    if (!origin) { next(); return; }
    if (!allowed.has(origin)) {
      res.status(403).json({ error: 'This website is not allowed to access this drive.', code: 'ORIGIN_NOT_ALLOWED' });
      return;
    }

    res.set('Access-Control-Allow-Origin', origin);
    res.set('Access-Control-Expose-Headers', 'Retry-After, Content-Disposition');
    if (req.method === 'OPTIONS') {
      res.set('Access-Control-Allow-Methods', 'GET, HEAD, POST, PATCH, DELETE, OPTIONS');
      res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      res.set('Access-Control-Max-Age', '600');
      res.vary('Access-Control-Request-Method');
      res.vary('Access-Control-Request-Headers');
      res.sendStatus(204);
      return;
    }
    next();
  };
}
