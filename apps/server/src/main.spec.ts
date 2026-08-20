import { config } from 'dotenv';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { createCorsOptions } from './common/cors.config';
import { getJwtSecrets } from './modules/auth/auth.config';
import { bootstrap, start } from './main';

jest.mock('dotenv', () => ({ config: jest.fn() }));
jest.mock('@nestjs/core', () => ({ NestFactory: { create: jest.fn() } }));
jest.mock('@nestjs/swagger', () => ({
  DocumentBuilder: jest.fn(),
  SwaggerModule: { createDocument: jest.fn(), setup: jest.fn() },
}));
jest.mock('cookie-parser', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('./app.module', () => ({ AppModule: class AppModule {} }));
jest.mock('./common/cors.config', () => ({ createCorsOptions: jest.fn() }));
jest.mock('./modules/auth/auth.config', () => ({ getJwtSecrets: jest.fn() }));

const dotenvConfigCall = (config as jest.Mock).mock.calls[0];

describe('bootstrap', () => {
  const app = {
    setGlobalPrefix: jest.fn(),
    use: jest.fn(),
    enableCors: jest.fn(),
    listen: jest.fn(),
  };
  const builder = {
    setTitle: jest.fn(),
    setDescription: jest.fn(),
    setVersion: jest.fn(),
    addBearerAuth: jest.fn(),
    build: jest.fn(),
  };
  const corsOptions = { credentials: true };
  const middleware = jest.fn();

  beforeEach(() => {
    jest.resetAllMocks();
    builder.setTitle.mockReturnValue(builder);
    builder.setDescription.mockReturnValue(builder);
    builder.setVersion.mockReturnValue(builder);
    builder.addBearerAuth.mockReturnValue(builder);
    builder.build.mockReturnValue({ openapi: '3.0.0' });
    (DocumentBuilder as jest.Mock).mockImplementation(() => builder);
    (NestFactory.create as jest.Mock).mockResolvedValue(app);
    (SwaggerModule.createDocument as jest.Mock).mockReturnValue({ paths: {} });
    (cookieParser as unknown as jest.Mock).mockReturnValue(middleware);
    (createCorsOptions as jest.Mock).mockReturnValue(corsOptions);
    app.listen.mockResolvedValue(undefined);
  });

  it('loads dotenv from the server environment file', () => {
    expect(dotenvConfigCall).toEqual([{ path: expect.stringMatching(/apps\/server\/\.env$/) }]);
  });

  it('configures auth, Swagger, cookies, CORS, and the HTTP listener', async () => {
    await bootstrap();

    expect(getJwtSecrets).toHaveBeenCalledTimes(1);
    expect(NestFactory.create).toHaveBeenCalledWith(AppModule);
    expect(app.setGlobalPrefix).toHaveBeenCalledWith('api');
    expect(builder.setTitle).toHaveBeenCalledWith('台帐系统 V3 API');
    expect(builder.setDescription).toHaveBeenCalledWith('台帐系统 V3 REST API 文档');
    expect(builder.setVersion).toHaveBeenCalledWith('1.0');
    expect(builder.addBearerAuth).toHaveBeenCalledTimes(1);
    expect(SwaggerModule.createDocument).toHaveBeenCalledWith(app, { openapi: '3.0.0' });
    expect(SwaggerModule.setup).toHaveBeenCalledWith('api/docs', app, { paths: {} });
    expect(cookieParser).toHaveBeenCalledTimes(1);
    expect(app.use).toHaveBeenCalledWith(middleware);
    expect(app.enableCors).toHaveBeenCalledWith(corsOptions);
    expect(app.listen).toHaveBeenCalledWith(3001);
  });

  it('propagates application creation failures without configuring middleware', async () => {
    (NestFactory.create as jest.Mock).mockRejectedValue(new Error('create failed'));

    await expect(bootstrap()).rejects.toThrow('create failed');

    expect(app.setGlobalPrefix).not.toHaveBeenCalled();
    expect(app.listen).not.toHaveBeenCalled();
  });

  it('propagates listener failures after configuration', async () => {
    app.listen.mockRejectedValue(new Error('listen failed'));

    await expect(bootstrap()).rejects.toThrow('listen failed');

    expect(app.enableCors).toHaveBeenCalledWith(corsOptions);
    expect(app.listen).toHaveBeenCalledWith(3001);
  });

  it('starts automatically outside the test environment', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    try {
      await start();
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
    }

    expect(app.listen).toHaveBeenCalledWith(3001);
  });
});
