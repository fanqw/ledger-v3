const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

export function createCorsOptions(env: NodeJS.ProcessEnv = process.env) {
  const configuredOrigins = (env.CORS_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const allowedOrigins = [...DEFAULT_ALLOWED_ORIGINS, ...configuredOrigins];

  return {
    origin(origin: string, callback: (error: Error | null, allow?: boolean) => void) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Origin not allowed by CORS'));
      }
    },
    credentials: true,
  };
}
