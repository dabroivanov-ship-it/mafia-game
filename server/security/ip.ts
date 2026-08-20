type HeaderMap = Record<string, string | string[] | undefined>;

export function normalizeIp(ip: string | null | undefined): string {
  if (!ip) return '';
  let value = String(ip).trim();
  if (value.startsWith('[') && value.endsWith(']')) {
    value = value.slice(1, -1);
  }
  if (value.startsWith('::ffff:')) {
    value = value.slice('::ffff:'.length);
  }
  return value.trim();
}

export function isLoopbackIp(ip: string | null | undefined): boolean {
  const value = normalizeIp(ip);
  return value === '127.0.0.1' || value === '::1' || value === 'localhost' || value === '0.0.0.0';
}

function headerValue(headers: HeaderMap, name: string): string {
  const raw = headers[name];
  const first = Array.isArray(raw) ? raw[0] : raw;
  return typeof first === 'string' ? first.trim() : '';
}

export function ipFromForwardedHeaders(headers: HeaderMap): string {
  const forwarded = headerValue(headers, 'x-forwarded-for');
  if (forwarded) {
    return normalizeIp(forwarded.split(',')[0]);
  }
  return normalizeIp(headerValue(headers, 'x-real-ip'));
}

export function resolveClientIp(remoteAddress: string | undefined, headers: HeaderMap): string {
  const remote = normalizeIp(remoteAddress);
  const trustForwarded =
    process.env.TRUST_PROXY === '1' ||
    process.env.NODE_ENV === 'production' ||
    isLoopbackIp(remote);
  if (trustForwarded) {
    const forwarded = ipFromForwardedHeaders(headers);
    if (forwarded) return forwarded;
  }
  return remote;
}
