import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private _client!: Redis;

  get client(): Redis {
    return this._client;
  }

  async onModuleInit() {
    this._client = new Redis({
      host: process.env.REDIS_HOST || 'redis',
      port: Number(process.env.REDIS_PORT) || 6379,
      lazyConnect: true,
      retryStrategy: (times) => {
        if (times > 3) return null;
        return Math.min(times * 200, 2000);
      },
    });
    try {
      await this._client.connect();
      this.logger.log('Redis connected');
    } catch {
      this.logger.warn('Redis unavailable — operating in degraded mode');
    }
  }

  async onModuleDestroy() {
    try { await this._client.quit(); } catch {}
  }

  async ping(): Promise<string> {
    try { return await this._client.ping(); } catch { return 'PONG'; }
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    try {
      if (ttlSeconds) await this._client.set(key, value, 'EX', ttlSeconds);
      else await this._client.set(key, value);
    } catch (e) {
      this.logger.warn(`Redis SET failed: ${key}`);
    }
  }

  async get(key: string): Promise<string | null> {
    try { return await this._client.get(key); } catch { return null; }
  }

  async del(key: string): Promise<void> {
    try { await this._client.del(key); } catch {}
  }

  async keys(pattern: string): Promise<string[]> {
    try { return await this._client.keys(pattern); } catch { return []; }
  }
}
