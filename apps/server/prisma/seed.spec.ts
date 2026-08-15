const upsert = jest.fn();
const disconnect = jest.fn();

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => ({ user: { upsert }, $disconnect: disconnect })),
}));
jest.mock('bcryptjs', () => ({ hash: jest.fn(async (value: string) => `hash:${value}`) }));
jest.mock('fs', () => ({ existsSync: jest.fn(), readFileSync: jest.fn() }));

import * as fs from 'fs';
import { createUser, run, seed } from './seed';

describe('database seed', () => {
  beforeEach(() => jest.clearAllMocks());

  it('upserts YAML users with defaults and disconnects', async () => {
    jest.mocked(fs.existsSync).mockReturnValue(true);
    jest.mocked(fs.readFileSync).mockReturnValue('users:\n  - username: alice\n    password: secret\n');

    await seed();

    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { username: 'alice' },
      create: expect.objectContaining({ passwordHash: 'hash:secret', role: 'admin' }),
    }));
    expect(disconnect).toHaveBeenCalled();
  });

  it('creates a CLI user with the selected role', async () => {
    await run(['node', 'seed.ts', '--username', 'bob', '--password', 'pw', '--role', 'viewer']);
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: { username: 'bob', passwordHash: 'hash:pw', role: 'viewer' },
    }));
    expect(disconnect).toHaveBeenCalled();
  });

  it('disconnects when createUser fails', async () => {
    upsert.mockRejectedValueOnce(new Error('db failed'));
    await expect(createUser('bob', 'pw')).rejects.toThrow('db failed');
    expect(disconnect).toHaveBeenCalled();
  });
});
