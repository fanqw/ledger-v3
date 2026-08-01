export interface JwtSecrets {
  accessSecret: string;
  refreshSecret: string;
}

const INSECURE_PLACEHOLDER_SECRETS = new Set([
  'dev-jwt-secret-change-in-production',
  'dev-refresh-secret-change-in-production',
]);

export function getJwtSecrets(): JwtSecrets {
  const accessSecret = process.env.JWT_SECRET;
  const refreshSecret = process.env.JWT_REFRESH_SECRET;

  if (!accessSecret?.trim() || INSECURE_PLACEHOLDER_SECRETS.has(accessSecret.trim())) {
    throw new Error('JWT_SECRET is required; refusing to start with a fallback secret');
  }
  if (!refreshSecret?.trim() || INSECURE_PLACEHOLDER_SECRETS.has(refreshSecret.trim())) {
    throw new Error('JWT_REFRESH_SECRET is required; refusing to start with a fallback secret');
  }

  return { accessSecret, refreshSecret };
}
