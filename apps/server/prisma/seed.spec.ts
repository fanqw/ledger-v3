const upsert = jest.fn();
const disconnect = jest.fn();
const hash = jest.fn();

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => ({ user: { upsert }, $disconnect: disconnect })),
}));
jest.mock('bcryptjs', () => ({ hash }));
jest.mock('fs');
jest.mock('yaml');

import * as fs from 'fs';
import * as yaml from 'yaml';
import { createUser, run, seed } from './seed';

describe('database seed', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    hash.mockResolvedValue('hashed-password');
    upsert.mockResolvedValue({});
    disconnect.mockResolvedValue(undefined);
  });

  it('upserts configured users and defaults their role to admin', async () => {
    jest.mocked(fs.existsSync).mockReturnValue(true);
    jest.mocked(fs.readFileSync).mockReturnValue('users: []');
    jest.mocked(yaml.parse).mockReturnValue({
      users: [{ username: 'alice', password: 'secret' }],
    });

    await seed();

    expect(hash).toHaveBeenCalledWith('secret', 10);
    expect(upsert).toHaveBeenCalledWith({
      where: { username: 'alice' },
      update: { passwordHash: 'hashed-password' },
      create: { username: 'alice', passwordHash: 'hashed-password', role: 'admin' },
    });
    expect(disconnect).toHaveBeenCalled();
  });

  it('creates a CLI user with the requested role', async () => {
    await createUser('bob', 'secret', 'viewer');

    expect(upsert).toHaveBeenCalledWith({
      where: { username: 'bob' },
      update: { passwordHash: 'hashed-password' },
      create: { username: 'bob', passwordHash: 'hashed-password', role: 'viewer' },
    });
    expect(disconnect).toHaveBeenCalled();
  });

  it('runs CLI creation with the default role', async () => {
    await run(['node', 'seed.ts', '--username', 'carol', '--password', 'secret']);

    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ username: 'carol', role: 'admin' }),
    }));
  });

  it('reports a missing seed file', async () => {
    jest.mocked(fs.existsSync).mockReturnValue(false);
    const exit = jest.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('exit 1');
    }) as never);

    await expect(seed()).rejects.toThrow('exit 1');
    expect(exit).toHaveBeenCalledWith(1);
    exit.mockRestore();
  });
});
