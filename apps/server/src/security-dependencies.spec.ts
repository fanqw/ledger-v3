import { createRequire } from 'module';

const platformExpressRequire = createRequire(require.resolve('@nestjs/platform-express'));
const multerVersion = platformExpressRequire('multer/package.json').version;

describe('security dependencies', () => {
  it('uses multer >= 2.1.0 to avoid incomplete upload cleanup DoS', () => {
    const [major, minor] = multerVersion.split('.').map(Number);
    const isSafe = major > 2 || (major === 2 && minor >= 1);

    expect(isSafe).toBe(true);
  });
});
