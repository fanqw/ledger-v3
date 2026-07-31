import { createCorsOptions } from './cors.config';

type OriginCallback = (err: Error | null, allow?: boolean) => void;

function callOrigin(options: ReturnType<typeof createCorsOptions>, origin: string) {
  let error: Error | null = null;
  let allowed = false;

  (options.origin as (origin: string, callback: OriginCallback) => void)(origin, (err, allow) => {
    error = err;
    allowed = allow === true;
  });

  return { error, allowed };
}

describe('createCorsOptions', () => {
  it('allows localhost dev origins with credentials', () => {
    const options = createCorsOptions();
    const result = callOrigin(options, 'http://localhost:5173');

    expect(result.error).toBeNull();
    expect(result.allowed).toBe(true);
    expect(options.credentials).toBe(true);
  });

  it('rejects untrusted origins', () => {
    const result = callOrigin(createCorsOptions(), 'https://evil.example');

    expect(result.error).toBeInstanceOf(Error);
    expect(result.allowed).toBe(false);
  });

  it('allows requests without an origin header', () => {
    const result = callOrigin(createCorsOptions(), '');

    expect(result.error).toBeNull();
    expect(result.allowed).toBe(true);
  });

  it('includes additional origins from CORS_ORIGINS', () => {
    const options = createCorsOptions({
      CORS_ORIGINS: 'https://app.example.com',
    } as NodeJS.ProcessEnv);
    const result = callOrigin(options, 'https://app.example.com');

    expect(result.error).toBeNull();
    expect(result.allowed).toBe(true);
  });
});
