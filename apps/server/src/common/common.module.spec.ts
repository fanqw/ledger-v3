import { Injectable } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { CommonModule } from './common.module';
import { PrismaService } from './prisma.service';
import { RedisService } from './redis.service';

@Injectable()
class CommonServicesConsumer {
  constructor(
    readonly prisma: PrismaService,
    readonly redis: RedisService,
  ) {}
}

describe('CommonModule', () => {
  it('provides and exports the shared Prisma and Redis services', async () => {
    const prisma = { $connect: jest.fn(), $disconnect: jest.fn() };
    const redis = { ping: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      imports: [CommonModule],
      providers: [CommonServicesConsumer],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(RedisService)
      .useValue(redis)
      .compile();

    const consumer = moduleRef.get(CommonServicesConsumer);

    expect(consumer.prisma).toBe(prisma);
    expect(consumer.redis).toBe(redis);
    expect(moduleRef.get(PrismaService)).toBe(prisma);
    expect(moduleRef.get(RedisService)).toBe(redis);
    await moduleRef.close();
  });

  it('propagates provider initialization failures', async () => {
    expect.assertions(1);
    const initializationError = new Error('redis initialization failed');
    const moduleRef = await Test.createTestingModule({ imports: [CommonModule] })
      .overrideProvider(PrismaService)
      .useValue({ onModuleInit: jest.fn().mockResolvedValue(undefined) })
      .overrideProvider(RedisService)
      .useValue({ onModuleInit: jest.fn().mockRejectedValue(initializationError) })
      .compile();

    await expect(moduleRef.init()).rejects.toBe(initializationError);
  });
});
