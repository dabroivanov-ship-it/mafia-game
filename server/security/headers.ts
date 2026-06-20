import type { NextFunction, Request, Response } from 'express';

export function securityHeadersMiddleware(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' https://telegram.org https://mc.yandex.ru https://yastatic.net",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https: https://mc.yandex.ru",
      "connect-src 'self' wss: ws: https://mc.yandex.ru https://yandex.ru https://*.yandex.ru https://log.strm.yandex.ru",
      "frame-src https://mc.yandex.ru",
      "font-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ')
  );
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
}
