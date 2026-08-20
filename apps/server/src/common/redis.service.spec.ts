import { Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { RedisService } from './redis.service';

jest.mock('ioredis', () => ({
  __esModule: true,
  default: jest.fn(),
}));

describe('RedisService', () => {
  const client = {
    connect: jest.fn(),
    quit: jest.fn(),
    ping: jest.fn(),
    set: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
    keys: jest.fn(),
  };
  const RedisMock = Redis as unknown as jest.Mock;
  let service: RedisService;
  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.resetAllMocks();
    delete process.env.REDIS_HOST;
    delete process.env.REDIS_PORT;
    RedisMock.mockImplementation(() => client);
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    service = new RedisService();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('connects with defaults and exposes the client', async () => {
    client.connect.mockResolvedValue(undefined);

    await service.onModuleInit();

    expect(RedisMock).toHaveBeenCalledWith(expect.objectContaining({
      host: 'redis',
      port: 6379,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    }));
    const options = RedisMock.mock.calls[0][0];
    expect(options.retryStrategy(3)).toBe(600);
    expect(options.retryStrategy(20)).toBe(2000);
    expect(service.client).toBe(client);
    expect(logSpy).toHaveBeenCalledWith('Redis connected');
  });

  it('uses configured host and port and degrades when connect fails', async () => {
    process.env.REDIS_HOST = 'cache.internal';
    process.env.REDIS_PORT = '6380';
    client.connect.mockRejectedValue(new Error('offline'));

    await service.onModuleInit();

    expect(RedisMock).toHaveBeenCalledWith(expect.objectContaining({
      host: 'cache.internal',
      port: 6380,
    }));
    expect(warnSpy).toHaveBeenCalledWith('Redis unavailable — operating in degraded mode');
  });

  it('degrades when connecting times out', async () => {
    client.connect.mockReturnValue(new Promise(() => undefined));

    const initialization = service.onModuleInit();
    await jest.advanceTimersByTimeAsync(2000);
    await initialization;

    expect(warnSpy).toHaveBeenCalledWith('Redis unavailable — operating in degraded mode');
  });

  it('quits cleanly and logs shutdown errors', async () => {
    client.connect.mockResolvedValue(undefined);
    client.quit.mockResolvedValueOnce('OK').mockRejectedValueOnce(new Error('quit failed'));
    await service.onModuleInit();

    await service.onModuleDestroy();
    await service.onModuleDestroy();

    expect(client.quit).toHaveBeenCalledTimes(2);
    expect(warnSpy).toHaveBeenCalledWith('Redis shutdown failed', expect.any(Error));
  });

  it('returns ping results, falls back on failure, and exposes strict failure', async () => {
    client.connect.mockResolvedValue(undefined);
    client.ping
      .mockResolvedValueOnce('PONG')
      .mockRejectedValueOnce(new Error('offline'))
      .mockRejectedValueOnce(new Error('strict offline'));
    await service.onModuleInit();

    await expect(service.ping()).resolves.toBe('PONG');
    await expect(service.ping()).resolves.toBe('PONG');
    await expect(service.pingOrThrow()).rejects.toThrow('strict offline');
  });

  it('sets values with and without TTL and degrades on failure', async () => {
    client.connect.mockResolvedValue(undefined);
    client.set
      .mockResolvedValueOnce('OK')
      .mockResolvedValueOnce('OK')
      .mockRejectedValueOnce(new Error('offline'));
    await service.onModuleInit();

    await service.set('plain', 'value');
    await service.set('expiring', 'value', 60);
    await service.set('failed', 'value');

    expect(client.set).toHaveBeenNthCalledWith(1, 'plain', 'value');
    expect(client.set).toHaveBeenNthCalledWith(2, 'expiring', 'value', 'EX', 60);
    expect(warnSpy).toHaveBeenCalledWith('Redis SET failed: failed');
  });

  it('sets strictly with and without TTL and propagates failures', async () => {
    client.connect.mockResolvedValue(undefined);
    client.set
      .mockResolvedValueOnce('OK')
      .mockResolvedValueOnce('OK')
      .mockRejectedValueOnce(new Error('strict set failed'));
    await service.onModuleInit();

    await service.setOrThrow('plain', 'value');
    await service.setOrThrow('expiring', 'value', 30);
    await expect(service.setOrThrow('failed', 'value')).rejects.toThrow('strict set failed');

    expect(client.set).toHaveBeenNthCalledWith(1, 'plain', 'value');
    expect(client.set).toHaveBeenNthCalledWith(2, 'expiring', 'value', 'EX', 30);
  });

  it('gets values with degraded and strict failure behavior', async () => {
    client.connect.mockResolvedValue(undefined);
    client.get
      .mockResolvedValueOnce('value')
      .mockRejectedValueOnce(new Error('offline'))
      .mockRejectedValueOnce(new Error('strict get failed'));
    await service.onModuleInit();

    await expect(service.get('key')).resolves.toBe('value');
    await expect(service.get('key')).resolves.toBeNull();
    await expect(service.getOrThrow('key')).rejects.toThrow('strict get failed');
  });

  it('deletes values with degraded and strict failure behavior', async () => {
    client.connect.mockResolvedValue(undefined);
    client.del
      .mockResolvedValueOnce(1)
      .mockRejectedValueOnce(new Error('offline'))
      .mockRejectedValueOnce(new Error('strict delete failed'));
    await service.onModuleInit();

    await service.del('key');
    await service.del('failed');
    await expect(service.delOrThrow('strict')).rejects.toThrow('strict delete failed');

    expect(warnSpy).toHaveBeenCalledWith('Redis DEL failed: failed', expect.any(Error));
  });

  it('lists keys with degraded and strict failure behavior', async () => {
    client.connect.mockResolvedValue(undefined);
    client.keys
      .mockResolvedValueOnce(['session:1'])
      .mockRejectedValueOnce(new Error('offline'))
      .mockRejectedValueOnce(new Error('strict keys failed'));
    await service.onModuleInit();

    await expect(service.keys('session:*')).resolves.toEqual(['session:1']);
    await expect(service.keys('session:*')).resolves.toEqual([]);
    await expect(service.keysOrThrow('session:*')).rejects.toThrow('strict keys failed');
  });
});
