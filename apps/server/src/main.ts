import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '../.env') });

import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { createCorsOptions } from './common/cors.config';
import { getJwtSecrets } from './modules/auth/auth.config';

export async function bootstrap() {
  getJwtSecrets();
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');

  const swaggerConfig = new DocumentBuilder()
    .setTitle('台帐系统 V3 API')
    .setDescription('台帐系统 V3 REST API 文档')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  app.use(cookieParser());
  app.enableCors(createCorsOptions());
  await app.listen(3001);
}
export async function start() {
  if (process.env.NODE_ENV !== 'test') {
    await bootstrap();
  }
}

void start();
