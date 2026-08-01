import { AppController } from './app.controller';
import { PrismaService } from './common/prisma.service';
import { RedisService } from './common/redis.service';

describe('AppController', () => {
  const queryRaw = jest.fn();
  const ping = jest.fn();
  const controller = new AppController(
    { $queryRaw: queryRaw } as unknown as PrismaService,
    { ping } as unknown as RedisService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(process, 'uptime').mockReturnValue(123);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('reports both dependencies as connected when their checks succeed', async () => {
    queryRaw.mockResolvedValueOnce([{ '?column?': 1 }]);
    ping.mockResolvedValueOnce('PONG');

    await expect(controller.health()).resolves.toEqual({
      success: true,
      data: { db: 'connected', redis: 'connected', uptime: 123 },
    });
  });

  it('reports both dependencies as disconnected when their checks fail', async () => {
    queryRaw.mockRejectedValueOnce(new Error('database unavailable'));
    ping.mockRejectedValueOnce(new Error('redis unavailable'));

    await expect(controller.health()).resolves.toEqual({
      success: true,
      data: { db: 'disconnected', redis: 'disconnected', uptime: 123 },
    });
  });

  it('reports database and Redis status independently', async () => {
    queryRaw.mockResolvedValueOnce([{ '?column?': 1 }]);
    ping.mockRejectedValueOnce(new Error('redis unavailable'));

    await expect(controller.health()).resolves.toEqual({
      success: true,
      data: { db: 'connected', redis: 'disconnected', uptime: 123 },
    });
  });

  it('keeps Redis connected when only the database check fails', async () => {
    queryRaw.mockRejectedValueOnce(new Error('database unavailable'));
    ping.mockResolvedValueOnce('PONG');

    await expect(controller.health()).resolves.toEqual({
      success: true,
      data: { db: 'disconnected', redis: 'connected', uptime: 123 },
    });
  });
});
