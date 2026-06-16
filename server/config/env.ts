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

/** Exit on production if JWT_SECRET is missing or weak. */
export function assertProductionEnv(): void {
  if (process.env.NODE_ENV !== 'production') return;
  if (isWeakJwtSecret(process.env.JWT_SECRET)) {
    console.error(
      'FATAL: Set JWT_SECRET (min 32 chars) in server/.env before starting in production.'
    );
    process.exit(1);
  }
}
