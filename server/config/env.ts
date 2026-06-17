const WEAK_JWT_SECRETS = new Set([
  'mafia-dev-secret-change-in-production',
  'change-me-in-production',
]);

export function getJwtSecret(): string {
  return process.env.JWT_SECRET || 'mafia-dev-secret-change-in-production';
}

export function isWeakJwtSecret(secret: string | undefined): boolean {
  if (!secret) return true;
  if (secret.length < 32) return true;
  return WEAK_JWT_SECRETS.has(secret);
}

function isDevInsecureAllowed(): boolean {
  return process.env.NODE_ENV !== 'production' && process.env.ALLOW_INSECURE_DEV === '1';
}

/** Exit if JWT_SECRET is missing or weak (unless explicit insecure dev mode). */
export function assertProductionEnv(): void {
  if (isDevInsecureAllowed()) {
    console.warn('⚠️ ALLOW_INSECURE_DEV=1 — weak JWT/CORS checks disabled for local dev only.');
    return;
  }

  if (isWeakJwtSecret(process.env.JWT_SECRET)) {
    console.error(
      'FATAL: Set JWT_SECRET (min 32 random chars) in server/.env before starting the server.'
    );
    process.exit(1);
  }

  if (process.env.NODE_ENV === 'production') {
    const cors = process.env.CORS_ORIGIN?.split(',').map((s) => s.trim()).filter(Boolean);
    if (!cors?.length) {
      console.error('FATAL: Set CORS_ORIGIN in server/.env for production (e.g. https://your-domain.ru).');
      process.exit(1);
    }
  }
}
