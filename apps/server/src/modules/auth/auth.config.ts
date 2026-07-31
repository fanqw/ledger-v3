export interface JwtSecrets {
  accessSecret: string;
  refreshSecret: string;
}

export function getJwtSecrets(): JwtSecrets {
  const accessSecret = process.env.JWT_SECRET?.trim();
  const refreshSecret = process.env.JWT_REFRESH_SECRET?.trim();

  if (!accessSecret) {
    throw new Error('JWT_SECRET is required; refusing to start with a fallback secret');
  }
  if (!refreshSecret) {
    throw new Error('JWT_REFRESH_SECRET is required; refusing to start with a fallback secret');
  }

  return { accessSecret, refreshSecret };
}
