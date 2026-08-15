import { getJwtSecrets } from './auth.config';

describe('getJwtSecrets', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
  });

  function setSecrets(access?: string, refresh?: string) {
    process.env = { ...originalEnv, JWT_SECRET: access, JWT_REFRESH_SECRET: refresh };
  }

  it('returns distinct configured secrets', () => {
    setSecrets('access-secret', 'refresh-secret');
    expect(getJwtSecrets()).toEqual({ accessSecret: 'access-secret', refreshSecret: 'refresh-secret' });
  });

  it.each([undefined, '', '   ', 'dev-secret', 'change-me-in-production'])(
    'rejects an unsafe access secret: %p',
    (secret) => {
      setSecrets(secret, 'refresh-secret');
      expect(() => getJwtSecrets()).toThrow('JWT_SECRET is required');
    },
  );

  it.each([undefined, '', '   ', 'dev-refresh-secret', 'change-me-refresh-in-production'])(
    'rejects an unsafe refresh secret: %p',
    (secret) => {
      setSecrets('access-secret', secret);
      expect(() => getJwtSecrets()).toThrow('JWT_REFRESH_SECRET is required');
    },
  );

  it('rejects identical access and refresh secrets', () => {
    setSecrets('same-secret', 'same-secret');
    expect(() => getJwtSecrets()).toThrow('must be different');
  });
});
