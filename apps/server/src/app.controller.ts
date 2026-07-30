import { Controller, Get } from '@nestjs/common';
import { PrismaService } from './common/prisma.service';
import { RedisService } from './common/redis.service';
import { Public } from './modules/auth/jwt-auth.guard';

@Controller('health')
export class AppController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Public()
  @Get()
  async health() {
    let db = 'disconnected';
    let redis = 'disconnected';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      db = 'connected';
    } catch {}
    try {
      await this.redis.ping();
      redis = 'connected';
    } catch {}
    return {
      success: true,
      data: { db, redis, uptime: process.uptime() },
    };
  }
}
