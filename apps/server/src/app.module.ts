import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { PrismaService } from './common/prisma.service';
import { RedisService } from './common/redis.service';

@Module({
  imports: [],
  controllers: [AppController],
  providers: [PrismaService, RedisService],
})
export class AppModule {}
