import { Controller, Get, Logger } from '@nestjs/common';
import { PrismaService } from './common/prisma.service';
import { RedisService } from './common/redis.service';
import { Public } from './modules/auth/jwt-auth.guard';

@Controller('health')
export class AppController {
  private readonly logger = new Logger(AppController.name);

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
    } catch (error) {
      this.logger.warn('Database health check failed', error);
    }
    try {
      await this.redis.ping();
      redis = 'connected';
    } catch (error) {
      this.logger.warn('Redis health check failed', error);
    }
    return {
      success: true,
      data: { db, redis, uptime: process.uptime() },
    };
  }
}
